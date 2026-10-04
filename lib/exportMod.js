// Mod building + export: staging tree (manifest / datatables / parameters /
// assets / AssetRegistry.json), receipt-guarded "Export to Mods folder", .jjkmod
// packaging, and importing existing mod folders back into projects.
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const AdmZip = require("adm-zip");
const schema = require("./schema");
const engine = require("./engine");
const paramVanilla = require("./paramVanilla");

const RECEIPT = ".jjk-editor-receipt.json";

function modFolderName(project) {
  const raw = (project.manifest && project.manifest.title) || project.name || "mod";
  const s = String(raw)
    .replace(/[<>:\"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return (s || "mod").slice(0, 120);
}

function getTableState(project, file) {
  if (!project.tables[file]) {
    project.tables[file] = { globalRules: [], overrides: {}, newRows: {} };
  }
  const st = project.tables[file];
  st.globalRules = Array.isArray(st.globalRules) ? st.globalRules : [];
  st.overrides = st.overrides || {};
  st.newRows = st.newRows || {};
  return st;
}

// ---- family-shared global rules ----
// Numbered splits (DamageDataTable1..5) share one rule list, keyed by the
// family stem. Locales stay separate: BattleTextDataTable_En never shares
// with _Ja. Storage: project.tables[shareKey] = { globalRules }. Reads also
// union legacy per-file lists so old projects work before first migration.
function shareKeyOf(file) {
  try {
    const parsed = schema.parseTableFile(file);
    if (parsed && parsed.family) return parsed.locale ? `${parsed.family}_${parsed.locale}` : parsed.family;
  } catch { /* fall through */ }
  return String(file || "").replace(/\.json$/i, "");
}
function familyMembersOfKey(shareKey) {
  let vendor = [];
  try { vendor = schema.listTables(); } catch { vendor = []; }
  return vendor.filter((t) => t && shareKeyOf(t.file) === shareKey).map((t) => t.file).sort();
}
function familyMembers(file) {
  return familyMembersOfKey(shareKeyOf(file));
}
function getFamilyRules(project, file) {
  const tables = (project && project.tables) || {};
  const out = [];
  const seen = new Set();
  const sk = shareKeyOf(file);
  const pushList = (list) => {
    if (!Array.isArray(list)) return;
    for (const r of list) {
      if (r && r.id && !seen.has(r.id)) { seen.add(r.id); out.push(r); }
    }
  };
  const famEntry = tables[sk];
  pushList(famEntry && famEntry.globalRules);
  for (const key of Object.keys(tables).sort()) {
    if (key === sk || !/\.json$/i.test(key)) continue;
    if (shareKeyOf(key) !== sk) continue;
    pushList(tables[key] && tables[key].globalRules);
  }
  return out;
}
// Pull legacy per-member rule lists into the family entry. Call before any
// rule write; callers must persist afterwards.
function migrateFamilyRules(project, file) {
  if (!project.tables) project.tables = {};
  const sk = shareKeyOf(file);
  const merged = getFamilyRules(project, file);
  const famSt = project.tables[sk] || (project.tables[sk] = { globalRules: [], overrides: {}, newRows: {} });
  famSt.globalRules = merged;
  for (const key of Object.keys(project.tables)) {
    if (key === sk || !/\.json$/i.test(key)) continue;
    if (shareKeyOf(key) === sk && project.tables[key]) project.tables[key].globalRules = [];
  }
  return famSt;
}
function computeTableDiff(file, project, enums) {
  const { rows: vanilla } = schema.readInputTable(file);
  const tableSchema = schema.inferSchema(file);
  const st = getTableState(project, file);
  const famRules = getFamilyRules(project, file);
  const changed = {}; // rowId -> {type, fields:{f:{from,to}}}
  const errors = [];
  for (const [rowId, vanillaRow] of Object.entries(vanilla)) {
    const ov = st.overrides[rowId];
    if (!ov || Object.keys(ov).length === 0) {
      // Still need to check global rules — compute effective only if rules exist.
      if (famRules.length === 0) continue;
    }
    try {
      const { row } = engine.applyTableStateToRow(
        vanillaRow,
        { globalRules: famRules, overrides: ov || {} },
        tableSchema,
        enums,
      );
      const d = engine.diffFields(vanillaRow, row);
      if (Object.keys(d).length > 0) changed[rowId] = { type: "modified", fields: d };
    } catch (err) {
      errors.push(`${rowId}: ${err.message}`);
    }
  }
  const vanillaIds = Object.keys(vanilla);
  const templateRowId = vanillaIds[0] || null;
  const templateRow = templateRowId ? vanilla[templateRowId] : {};
  const fills = [];
  for (const [rowId, nr] of Object.entries(st.newRows)) {
    try {
      let base = {};
      let templateName = null;
      if (nr && nr._base) {
        // Base may live in another file of the same family.
        base = findRowInFamily(file, nr._base) || {};
        templateName = nr._base;
      }
      const effective = engine.applyNewRow(base, nr, tableSchema, enums);
      // New rows ship the FULL vanilla field set: fill anything still absent
      // from the clone base (or the table's first row for blank rows) so the
      // cooked row is complete instead of sparse.
      const hasBase = Object.keys(base).length > 0;
      const template = hasBase ? base : templateRow;
      const usedTemplate = hasBase ? templateName : templateRowId || "(none)";
      let filled = 0;
      for (const k of Object.keys(template)) {
        if (k === "_base") continue;
        if (effective[k] === undefined) {
          effective[k] = engine.clone(template[k]);
          filled++;
        }
      }
      if (tableSchema.fields.ID && effective.ID === undefined) effective.ID = rowId;
      changed[rowId] = { type: "added", fields: objectToDiff(effective) };
      if (filled > 0) fills.push({ rowId, template: usedTemplate, count: filled });
    } catch (err) {
      errors.push(`${rowId}: ${err.message}`);
    }
  }
  return { changed, errors, fills };
}

function objectToDiff(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (k === "_base") continue;
    out[k] = { from: undefined, to: engine.clone(v) };
  }
  return out;
}

function findRowInFamily(file, rowId) {
  try {
    const entry = schema.getTableEntry(file);
    const family = entry ? entry.family : schema.parseTableFile(file).family;
    for (const t of schema.listTables()) {
      if (t.family !== family) continue;
      const { rows } = schema.readInputTable(t.file);
      if (rows[rowId]) return rows[rowId];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function diffToSparse(changed) {
  const sparse = {};
  for (const [rowId, info] of Object.entries(changed)) {
    const fields = {};
    for (const [f, d] of Object.entries(info.fields)) fields[f] = engine.clone(d.to);
    sparse[rowId] = fields;
  }
  return sparse;
}

// Plan which parameter rows can be binary-baked (new IDs only — the cooked
// patcher adds rows, it never rewrites existing ones).
async function planParamBake(project) {
  const avail = paramVanilla.availability();
  if (!avail.available) {
    return { available: false, reason: avail.reason, newRowsByShort: {}, modified: [] };
  }
  const newRowsByShort = {};
  const modified = [];
  const vanillaErrors = [];
  for (const [short, pstate] of Object.entries(project.parameters || {})) {
    const rows = (pstate && pstate.rows) || {};
    const ids = Object.keys(rows).filter((k) => !k.startsWith("$"));
    if (ids.length === 0) continue;
    let vanilla = null;
    try {
      vanilla = await paramVanilla.dumpShort(short);
    } catch (err) {
      vanillaErrors.push(`${short}: ${err.message}`);
      continue;
    }
    if (!vanilla || vanilla.error) {
      vanillaErrors.push(`${short}: ${(vanilla && vanilla.error) || "dump failed"}`);
      continue;
    }
    for (const id of ids.sort()) {
      if (vanilla.rows[id] !== undefined) modified.push({ short, id });
      else {
        newRowsByShort[short] = newRowsByShort[short] || {};
        newRowsByShort[short][id] = engine.clone(rows[id]);
      }
    }
    if (newRowsByShort[short] && Object.keys(newRowsByShort[short]).length === 0) {
      delete newRowsByShort[short];
    }
  }
  return { available: true, newRowsByShort, modified, vanillaErrors };
}

// Build the full mod file tree in memory: relPath -> string|Buffer.
async function buildModTree(project, enums, opts) {
  const bakeEnabled = !opts || opts.bake !== false;
  const files = new Map();
  const warnings = [];
  const stats = { tables: 0, rows: 0, params: 0, paramRows: 0, assets: 0 };
  const touchedKeys = Object.keys(project.tables || {}).filter((f) => {
    const st = project.tables[f];
    return (
      (st.globalRules && st.globalRules.length > 0) ||
      (st.overrides && Object.keys(st.overrides).length > 0) ||
      (st.newRows && Object.keys(st.newRows).length > 0)
    );
  });
  // Family rule entries (stem keys) and legacy per-member rule lists fan out
  // to every member file so shared rules bake into all numbered splits.
  const touchedTables = [...new Set(touchedKeys.flatMap((k) => {
    const st = project.tables[k];
    if (st && st.globalRules && st.globalRules.length > 0) {
      return familyMembersOfKey(/\.json$/i.test(k) ? shareKeyOf(k) : k);
    }
    return /\.json$/i.test(k) ? [k] : [];
  }))];
  const bake = { attempted: false, baked: [], skippedReason: null, modified: [], newShorts: [] };
  for (const file of touchedTables.sort()) {
    let entry = null;
    try {
      entry = schema.getTableEntry(file);
      if (!entry) {
        warnings.push(`${file}: input table not found, skipped`);
        continue;
      }
      const { changed, errors, fills } = computeTableDiff(file, project, enums);
      for (const e of errors) warnings.push(`${file}: ${e}`);
      for (const f of fills || []) {
        warnings.push(
          `${file}: new row ${f.rowId} filled ${f.count} untouched field(s) from template ${f.template} (full field set)`,
        );
      }
      if (Object.keys(changed).length === 0) continue;
      files.set(`datatables/${file}`, `${JSON.stringify(diffToSparse(changed), null, 2)}\n`);
      stats.tables++;
      stats.rows += Object.keys(changed).length;
    } catch (err) {
      warnings.push(`${file}: ${err.message}`);
    }
  }
  for (const [short, pstate] of Object.entries(project.parameters || {})) {
    const rows = (pstate && pstate.rows) || {};
    const ids = Object.keys(rows).filter((k) => !k.startsWith("$"));
    if (ids.length === 0) continue;
    const out = {};
    if (pstate.comment) out.$comment = pstate.comment;
    for (const id of ids.sort()) out[id] = rows[id];
    files.set(`parameters/${short}.json`, `${JSON.stringify(out, null, 2)}\n`);
    stats.params++;
    stats.paramRows += ids.length;
  }
  if (Array.isArray(project.registryRows) && project.registryRows.length > 0) {
    files.set("AssetRegistry.json", `${JSON.stringify(project.registryRows, null, 2)}\n`);
  }
  const manifest = { ...(project.manifest || {}) };
  if (!manifest.title) manifest.title = project.name;
  files.set("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  // Icon: copy into tree when it is a real file; keep rel path in manifest.
  if (manifest.icon && typeof manifest.icon === "string") {
    const iconAbs = manifest.icon;
    if (path.isAbsolute(iconAbs) && fs.existsSync(iconAbs)) {
      const base = path.basename(iconAbs);
      try {
        files.set(`icon/${base}`, fs.readFileSync(iconAbs));
        manifest.icon = `icon/${base}`;
        files.set("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
      } catch (err) {
        warnings.push(`icon: ${err.message}`);
      }
    }
  }
  // Binary-baked parameter assets (patched .uasset/.uexp overrides).
  if (bakeEnabled) {
    try {
      const plan = await planParamBake(project);
      bake.attempted = true;
      bake.modified = plan.modified || [];
      bake.newShorts = Object.keys(plan.newRowsByShort || {});
      for (const e of plan.vanillaErrors || []) warnings.push(`parameter vanilla: ${e}`);
      const shorts = [...new Set([...bake.newShorts, ...bake.modified.map((m) => m.short)])];
      if (plan.available && shorts.length > 0) {
        // Upsert: new IDs are added, existing vanilla rows are replaced in
        // the baked binary (datatable-style). Note: the Mod Manager's own
        // merge is add-only, so replaced rows apply to direct Mods-folder
        // use; the JSON is still manager-compatible.
        const replacedByShort = {};
        for (const m of bake.modified) {
          const rows = (project.parameters[m.short] && project.parameters[m.short].rows) || {};
          if (rows[m.id] !== undefined) {
            replacedByShort[m.short] = replacedByShort[m.short] || {};
            replacedByShort[m.short][m.id] = engine.clone(rows[m.id]);
          }
        }
        const res = await paramVanilla.bakeUpsert(plan.newRowsByShort, replacedByShort);
        if (!res.ok) {
          bake.skippedReason = res.reason;
          warnings.push(`Parameter binary bake failed: ${res.reason} (parameters/*.json still exported)`);
        } else {
          for (const b of res.baked) {
            files.set(`${paramVanilla.BAKED_ASSET_PREFIX}/${b.asset}.uasset`, b.uasset);
            files.set(`${paramVanilla.BAKED_ASSET_PREFIX}/${b.asset}.uexp`, b.uexp);
            stats.assets += 2;
            bake.baked.push({ short: b.short, asset: b.asset, added: b.added, replaced: b.replaced });
          }
          if (bake.modified.length > 0) {
            warnings.push(
              `parameters: ${bake.modified.length} vanilla row(s) replaced in baked binaries (direct Mods-folder use); the Mod Manager merge is add-only and will reject replacements`,
            );
          }
        }
      } else if (!plan.available) {
        bake.skippedReason = plan.reason;
        warnings.push(`Parameter binary bake skipped: ${plan.reason} (parameters/*.json still exported)`);
      }
    } catch (err) {
      warnings.push(`Parameter binary bake error: ${err.message} (parameters/*.json still exported)`);
    }
  }
  // Duplicate / extra assets.
  for (const a of project.assets || []) {
    if (!a || !a.src || !a.dest) continue;
    try {
      const st = fs.statSync(a.src);
      if (st.isDirectory()) {
        const walk = (dir) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) walk(abs);
            else if (e.isFile()) {
              const rel = path.relative(a.src, abs).replace(/\\/g, "/");
              files.set(`${a.dest.replace(/\\/g, "/")}/${rel}`, fs.readFileSync(abs));
              stats.assets++;
            }
          }
        };
        walk(a.src);
      } else if (st.isFile()) {
        files.set(a.dest.replace(/\\/g, "/"), fs.readFileSync(a.src));
        stats.assets++;
      }
    } catch (err) {
      warnings.push(`asset ${a.dest}: ${err.message}`);
    }
  }
  return { files, warnings, stats, bake };
}

async function writeTree(root, files) {
  for (const [rel, content] of files) {
    const abs = path.join(root, rel);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, content);
  }
}

async function readReceipt(modRoot) {
  try {
    const raw = JSON.parse(await fsp.readFile(path.join(modRoot, RECEIPT), "utf8"));
    if (raw && Array.isArray(raw.owned)) return raw;
  } catch {
    /* none */
  }
  return null;
}

// Export to <modsDir>/<Folder>: overwrite only files the editor owns
// (tracked in the receipt) plus the files it is writing now. Unrelated
// uassets / pak files / other mods are never touched.
async function backupModFolder(modsDir, folder, root, kept) {
  const outDir = path.join(modsDir, ".jjk-editor-backups", folder);
  await fsp.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(outDir, `${folder}_${stamp}.zip`);
  const zip = new AdmZip();
  zip.addLocalFolder(root, folder);
  zip.writeZip(dest);
  const keep = Math.max(1, kept || 5);
  const entries = (await fsp.readdir(outDir)).filter((f) => f.toLowerCase().endsWith(".zip")).sort();
  while (entries.length > keep) {
    const old = entries.shift();
    try {
      await fsp.unlink(path.join(outDir, old));
    } catch {
      /* ignore */
    }
  }
  return dest;
}

async function exportToModsFolder(project, enums, modsDir, opts) {
  if (!modsDir) throw new Error("No Mods folder configured (Settings).");
  const o = opts || {};
  const folder = modFolderName(project);
  const root = path.join(modsDir, folder);
  const { files, warnings, stats, bake } = await buildModTree(project, enums, o);
  const warningsOut0 = [...warnings];
  // Auto-backup the existing mod folder before overwriting (zip, pruned).
  let backupPath = null;
  if (o.backup !== false) {
    try {
      const st = await fsp.stat(root);
      if (st.isDirectory()) {
        backupPath = await backupModFolder(modsDir, folder, root, o.backupsKept);
      }
    } catch (err) {
      if (!err || err.code !== "ENOENT") warningsOut0.push(`backup failed: ${err.message}`);
    }
  }
  const owned = [...files.keys()].sort();
  const receipt = await readReceipt(root);
  const previouslyOwned = receipt ? receipt.owned : [];
  const warningsOut = [...warningsOut0];
  let removed = 0;
  let overwrittenUntracked = 0;
  await fsp.mkdir(root, { recursive: true });
  for (const rel of previouslyOwned) {
    if (files.has(rel)) continue;
    // Only delete files inside editor-managed namespaces.
    if (!/^(datatables|parameters|icon)\//.test(rel) && rel !== "manifest.json" && rel !== "AssetRegistry.json" && !rel.startsWith("assets/")) {
      continue;
    }
    try {
      await fsp.unlink(path.join(root, rel));
      removed++;
    } catch (err) {
      if (!err || err.code !== "ENOENT") warningsOut.push(`could not remove stale ${rel}: ${err.message}`);
    }
  }
  if (!receipt) {
    for (const rel of owned) {
      try {
        await fsp.stat(path.join(root, rel));
        overwrittenUntracked++;
      } catch {
        /* new file */
      }
    }
    if (overwrittenUntracked > 0) {
      warningsOut.push(
        `No editor receipt found — overwrote ${overwrittenUntracked} existing file(s) in place; unrelated files were left untouched.`,
      );
    }
  }
  await writeTree(root, files);
  await fsp.writeFile(
    path.join(root, RECEIPT),
    `${JSON.stringify({ tool: "jjk-mod-editor", version: 1, owned, at: Date.now() }, null, 2)}\n`,
  );
  return { path: root, folder, files: owned, removed, warnings: warningsOut, stats, bake, backupPath };
}

async function exportJjkmod(project, enums, outPath, opts) {
  let dest = outPath;
  if (path.extname(dest).toLowerCase() !== ".jjkmod") dest += ".jjkmod";
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const { files, warnings, stats, bake } = await buildModTree(project, enums, opts);
  const folder = modFolderName(project);
  const zip = new AdmZip();
  for (const [rel, content] of files) {
    zip.addFile(`${folder}/${rel}`, Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"));
  }
  zip.writeZip(dest);
  return { path: dest, folder, files: [...files.keys()], warnings, stats, bake };
}

// Import an existing mod folder (Urame-style or manager-style) into project data.
async function importModFolder(folderPath) {
  const st = await fsp.stat(folderPath);
  if (!st.isDirectory()) throw new Error("Not a folder");
  const base = path.basename(folderPath);
  const readJson = async (p) => JSON.parse(await fsp.readFile(p, "utf8"));
  const warnings = [];
  const tables = {};
  const parameters = {};
  let manifest = null;
  try {
    manifest = await readJson(path.join(folderPath, "manifest.json"));
  } catch {
    manifest = null;
  }
  const dtDir = path.join(folderPath, "datatables");
  try {
    const entries = await fsp.readdir(dtDir);
    for (const e of entries) {
      if (!e.toLowerCase().endsWith(".json")) continue;
      let sparse;
      try {
        sparse = await readJson(path.join(dtDir, e));
      } catch (err) {
        warnings.push(`datatables/${e}: ${err.message}`);
        continue;
      }
      if (!sparse || typeof sparse !== "object") continue;
      // Resolve against vanilla: only differing fields become overrides.
      let vanilla = null;
      let tableSchema = null;
      try {
        vanilla = schema.readInputTable(e).rows;
        tableSchema = schema.inferSchema(e);
      } catch {
        vanilla = null;
      }
      const enums = schema.parseEnumsTs();
      const overrides = {};
      const newRows = {};
      for (const [rowId, fields] of Object.entries(sparse)) {
        if (rowId.startsWith("$")) continue;
        if (!fields || typeof fields !== "object") continue;
        if (vanilla && vanilla[rowId]) {
          const d = engine.diffFields(vanilla[rowId], { ...vanilla[rowId], ...fields });
          // Keep only imported values for differing fields.
          const ov = {};
          for (const f of Object.keys(d)) ov[f] = engine.clone(fields[f]);
          if (Object.keys(ov).length > 0) overrides[rowId] = ov;
        } else {
          const copy = { ...fields };
          newRows[rowId] = { _base: null, fields: copy };
        }
      }
      if (Object.keys(overrides).length > 0 || Object.keys(newRows).length > 0) {
        tables[e] = { globalRules: [], overrides, newRows };
      }
    }
  } catch (err) {
    if (!err || err.code !== "ENOENT") warnings.push(`datatables: ${err.message}`);
  }
  const pmDir = path.join(folderPath, "parameters");
  try {
    const entries = await fsp.readdir(pmDir);
    for (const e of entries) {
      if (!e.toLowerCase().endsWith(".json")) continue;
      const short = path.basename(e, ".json");
      let data;
      try {
        data = await readJson(path.join(pmDir, e));
      } catch (err) {
        warnings.push(`parameters/${e}: ${err.message}`);
        continue;
      }
      if (!data || typeof data !== "object") continue;
      const rows = {};
      let comment = "";
      for (const [k, v] of Object.entries(data)) {
        if (k.startsWith("$")) {
          if (typeof v === "string") comment = v;
          continue;
        }
        rows[k] = v;
      }
      if (Object.keys(rows).length > 0) parameters[short] = { rows, comment };
    }
  } catch (err) {
    if (!err || err.code !== "ENOENT") warnings.push(`parameters: ${err.message}`);
  }
  return { base, manifest, tables, parameters, warnings };
}

module.exports = {
  RECEIPT,
  modFolderName,
  getTableState,
  shareKeyOf,
  familyMembersOfKey,
  familyMembers,
  getFamilyRules,
  migrateFamilyRules,
  computeTableDiff,
  findRowInFamily,
  diffToSparse,
  planParamBake,
  buildModTree,
  exportToModsFolder,
  exportJjkmod,
  importModFolder,
};
