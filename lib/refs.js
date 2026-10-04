// Reference graph: Id_* field resolution, reverse lookups, validation,
// character checklists, moveset rollups, global search, project compare.
const fs = require("fs");
const path = require("path");
const config = require("./config");
const schema = require("./schema");
const engine = require("./engine");
const projects = require("./projects");
const exportMod = require("./exportMod");

const ID_FIELD_RE = /^Id_/;
const ROW_PREFIX_RE = /^((?:CN|CP)_\d{3})/;

let rowKeyCache = null; // {key, index: {file: [keys]}}
let refMemo = new Map(); // value -> referencedBy results
let registryCache = null;

function rowKeyCachePath() {
  return path.join(config.get().projectsDir, ".rowkey-cache.json");
}

function buildRowKeyIndex() {
  const dir = schema.inputDir();
  const stamp = `${dir}|${schema.listTables().length}`;
  if (rowKeyCache && rowKeyCache.key === stamp) return rowKeyCache.index;
  let disk = {};
  try {
    disk = JSON.parse(fs.readFileSync(rowKeyCachePath(), "utf8"));
  } catch {
    disk = {};
  }
  const index = {};
  let dirty = false;
  for (const t of schema.listTables()) {
    const abs = path.join(dir, t.file);
    let st = null;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    const ck = `${t.file}:${st.mtimeMs}:${st.size}`;
    if (disk[ck]) {
      index[t.file] = disk[ck];
    } else {
      try {
        index[t.file] = Object.keys(schema.readInputTable(t.file).rows);
      } catch {
        index[t.file] = [];
      }
      disk[ck] = index[t.file];
      dirty = true;
    }
  }
  if (dirty) {
    try {
      fs.mkdirSync(path.dirname(rowKeyCachePath()), { recursive: true });
      const keys = Object.keys(disk).slice(-4000);
      const trimmed = {};
      for (const k of keys) trimmed[k] = disk[k];
      fs.writeFileSync(rowKeyCachePath(), JSON.stringify(trimmed));
    } catch {
      /* best effort */
    }
  }
  rowKeyCache = { key: stamp, index };
  return index;
}

function families() {
  const seen = new Set();
  const out = [];
  for (const t of schema.listTables()) {
    if (!seen.has(t.family)) {
      seen.add(t.family);
      out.push(t.family);
    }
  }
  return out;
}

// Guess the target family of an Id_* field by longest CamelCase-segment match.
function guessFamily(field) {
  const name = String(field).replace(/^Id_/, "");
  const segs = name.split("_").filter(Boolean);
  const fams = families();
  const baseOf = (f) => f.replace(/DataTable$/, "");
  for (let k = segs.length; k >= 1; k--) {
    const cand = segs.slice(0, k).join("");
    const hit = fams.find((f) => baseOf(f) === cand);
    if (hit) return hit;
  }
  return null;
}

function isRefValue(v) {
  return typeof v === "string" && v !== "" && v !== "None";
}

function filesOfFamily(family) {
  return schema.listTables().filter((t) => t.family === family).map((t) => t.file);
}

function projectNewRows(project, file) {
  const st = project.tables && project.tables[file];
  return (st && st.newRows) || {};
}

// Resolve one Id_ value to concrete rows: guessed family first, then global.
function resolveFieldValue(field, value, project) {
  if (!isRefValue(value)) return [];
  const primary = guessFamily(field);
  const index = buildRowKeyIndex();
  const out = [];
  const seen = new Set();
  const push = (file, rowId) => {
    const k = `${file}\u0000${rowId}`;
    if (seen.has(k)) return;
    seen.add(k);
    const isNew = project && projectNewRows(project, file)[rowId] !== undefined;
    out.push({ file, rowId, isNew });
  };
  if (primary) {
    for (const file of filesOfFamily(primary)) {
      if ((index[file] || []).includes(value)) push(file, value);
      if (project && projectNewRows(project, file)[value] !== undefined) push(file, value);
    }
    if (out.length > 0) return out;
  }
  for (const [file, keys] of Object.entries(index)) {
    if (keys.includes(value)) {
      push(file, value);
      if (out.length >= 12) break;
    }
  }
  if (project && out.length < 12) {
    for (const [file, st] of Object.entries(project.tables || {})) {
      if (st.newRows && st.newRows[value] !== undefined) push(file, value);
      if (out.length >= 12) break;
    }
  }
  return out;
}

// All Id_ reference targets of one row (effective values incl. overrides/rules).
function referenceTargets(file, rowId, project, enums) {
  let vanilla = null;
  try {
    vanilla = schema.readInputTable(file).rows[rowId] || null;
  } catch {
    vanilla = null;
  }
  const st = (project.tables && project.tables[file]) || { globalRules: [], overrides: {}, newRows: {} };
  let source;
  let isNew = false;
  if (vanilla) {
    const tableSchema = schema.inferSchema(file);
    const r = engine.applyTableStateToRow(
      vanilla,
      { globalRules: exportMod.getFamilyRules(project, file), overrides: (st.overrides || {})[rowId] || {} },
      tableSchema,
      enums,
    );
    source = r.row;
  } else if (st.newRows && st.newRows[rowId]) {
    isNew = true;
    source = engine.applyNewRow({}, st.newRows[rowId], schema.inferSchema(file), enums);
  } else {
    return { isNew: false, refs: [] };
  }
  const refs = [];
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v)) {
        const vals = v.filter(isRefValue);
        if (vals.length > 0 && (ID_FIELD_RE.test(k) || k === "ID")) {
          if (ID_FIELD_RE.test(k)) {
            refs.push({ field: p, kind: "array", values: vals.map((x) => ({ value: x, targets: resolveFieldValue(k, x, project) })) });
          }
        } else {
          v.forEach((el, i) => {
            if (el && typeof el === "object") walk(el, `${p}.${i}`);
          });
        }
      } else if (v && typeof v === "object") {
        walk(v, p);
      } else if (ID_FIELD_RE.test(k) && isRefValue(v)) {
        refs.push({ field: p, kind: "scalar", values: [{ value: v, targets: resolveFieldValue(k, v, project) }] });
      }
    }
  };
  walk(source, "");
  return { isNew, refs };
}

// Collect Id_* occurrences equal to `value` inside a (possibly nested) row.
// Mirrors the walk in referenceTargets: scalar Id_ fields plus string-array
// Id_ fields, recursing into nested objects / arrays of objects.
function collectRefHits(obj, value, hits, prefix) {
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      if (ID_FIELD_RE.test(k)) {
        if (v.includes(value)) hits.push(p);
      } else {
        v.forEach((el, i) => {
          if (el && typeof el === "object") collectRefHits(el, value, hits, `${p}.${i}`);
        });
      }
    } else if (v && typeof v === "object") {
      collectRefHits(v, value, hits, p);
    } else if (ID_FIELD_RE.test(k) && v === value) {
      hits.push(p);
    }
  }
}

// True when an override/rule provenance map covers the matched field path,
// tolerant of dotted-path keys on either side (e.g. override "Id_Attack.0"
// matching array field "Id_Attack" and vice versa).
function provCovers(prov, field) {
  if (!prov) return false;
  if (prov[field]) return true;
  const top = field.split(".")[0];
  if (prov[top]) return true;
  return Object.keys(prov).some((k) => field === k || field.startsWith(`${k}.`) || k.startsWith(`${field}.`) || k.startsWith(`${top}.`));
}
// Reverse lookup: which rows reference this value via Id_ fields.
// Scans effective rows (vanilla + global rules + overrides, including
// dotted-path override keys), plus same-row-ID counterparts (shared-key
// convention links such as Attack <-> Damage) and project new rows.
function referencedBy(value, project, enums) {
  if (!isRefValue(value)) return [];
  const memoKey = `${(project && project.name) || ""}\u0000${value}`;
  if (refMemo.has(memoKey)) return refMemo.get(memoKey);
  const out = [];
  const tables = schema.listTables();
  for (const t of tables) {
    let rows = null;
    try {
      rows = schema.readInputTable(t.file).rows;
    } catch {
      continue;
    }
    const st = (project.tables && project.tables[t.file]) || {};
    const rules = exportMod.getFamilyRules(project, t.file);
    const hasTableEdits = rules.length > 0 || (st.overrides && Object.keys(st.overrides).length > 0);
    let tableSchema = null;
    for (const [rowId, row] of Object.entries(rows)) {
      if (!row || typeof row !== "object") continue;
      const ov = (st.overrides && st.overrides[rowId]) || null;
      let effective = row;
      let prov = null;
      if (hasTableEdits && ((ov && Object.keys(ov).length > 0) || rules.length > 0)) {
        try {
          if (!tableSchema) tableSchema = schema.inferSchema(t.file);
          const r = engine.applyTableStateToRow(row, { globalRules: rules, overrides: ov || {} }, tableSchema, enums);
          effective = r.row;
          prov = r.prov;
        } catch {
          effective = row;
          prov = null;
        }
      }
      const hits = [];
      collectRefHits(effective, value, hits, "");
      for (const field of hits) {
        out.push({ file: t.file, rowId, field, viaOverride: provCovers(prov, field) });
        if (out.length >= 500) break;
      }
      if (out.length >= 500) break;
    }
    if (out.length >= 500) break;
  }
  // Same-row-ID counterparts: rows stored under the same key in other
  // tables (shared-key convention, e.g. an Attack and its Damage share
  // one ID without an Id_ field linking them).
  try {
    const index = buildRowKeyIndex();
    for (const [file, keys] of Object.entries(index)) {
      if (keys.includes(value)) {
        if (!out.some((e) => e.file === file && e.rowId === value && e.sameId)) {
          out.push({ file, rowId: value, field: "(same row ID)", viaOverride: false, sameId: true });
        }
        if (out.length >= 550) break;
      }
    }
  } catch {
    /* best effort */
  }
  // Project new rows (effective values incl. clone base).
  if (project && out.length < 550) {
    const schemaCache = {};
    for (const [file, st] of Object.entries(project.tables || {})) {
      const nrs = (st && st.newRows) || {};
      for (const [rowId, nr] of Object.entries(nrs)) {
        const fields = (nr && nr.fields) || {};
        if (Object.keys(fields).length === 0 && rowId !== value) continue;
        let effective = null;
        try {
          if (!(file in schemaCache)) {
            try {
              schemaCache[file] = schema.inferSchema(file);
            } catch {
              schemaCache[file] = null;
            }
          }
          let base = {};
          if (nr && nr._base) base = findRowInFamily(file, nr._base) || {};
          effective = engine.applyNewRow(base, nr, schemaCache[file], enums);
        } catch {
          effective = null;
        }
        if (effective) {
          const hits = [];
          collectRefHits(effective, value, hits, "");
          for (const field of hits) out.push({ file, rowId, field, viaOverride: false, isNew: true });
        } else {
          for (const [k, v] of Object.entries(fields)) {
            if (!ID_FIELD_RE.test(k)) continue;
            if (v === value || (Array.isArray(v) && v.includes(value))) out.push({ file, rowId, field: k, viaOverride: false, isNew: true });
          }
        }
        if (rowId === value && !out.some((e) => e.file === file && e.rowId === value && e.sameId)) {
          out.push({ file, rowId, field: "(same row ID)", viaOverride: false, isNew: true, sameId: true });
        }
        if (out.length >= 550) break;
      }
      if (out.length >= 550) break;
    }
  }
  refMemo.set(memoKey, out);
  if (refMemo.size > 200) refMemo.delete(refMemo.keys().next().value);
  return out;
}

function clearMemo() {
  refMemo = new Map();
  rowKeyCache = null;
}

// Autocomplete for Id_ fields: guessed-family keys + project new rows.
function complete(field, prefix, project, registries) {
  const q = String(prefix || "").toLowerCase();
  const primary = guessFamily(field);
  const index = buildRowKeyIndex();
  const seen = new Set();
  const out = [];
  const push = (value, source) => {
    if (seen.has(value)) return;
    seen.add(value);
    out.push({ value, source });
  };
  const accept = (v) => !q || v.toLowerCase().includes(q);
  const files = primary ? filesOfFamily(primary) : Object.keys(index);
  for (const file of files) {
    for (const k of index[file] || []) {
      if (accept(k)) push(k, primary ? "vanilla" : "vanilla");
      if (out.length >= 60) break;
    }
    if (out.length >= 60) break;
  }
  if (project) {
    const pfiles = primary ? [files].flat().filter((f) => project.tables && project.tables[f]) : Object.keys(project.tables || {});
    for (const file of pfiles) {
      for (const k of Object.keys(projectNewRows(project, file))) {
        if (accept(k)) push(k, "new row");
      }
    }
  }
  // Known attack/damage IDs first when relevant.
  if (registries && (primary === "AttackDataTable" || primary === "DamageDataTable" || !primary)) {
    const set = primary === "DamageDataTable" ? registries.damage : registries.attack;
    if (set) {
      const ranked = [];
      const rest = [];
      for (const o of out) {
        (set.has(o.value) ? ranked : rest).push(o);
      }
      return [...ranked, ...rest].slice(0, 30);
    }
  }
  return out.slice(0, 30);
}

function loadIdRegistries() {
  const root = config.get().editorRoot;
  const key = root || "";
  if (registryCache && registryCache.key === key) return registryCache.data;
  const data = { attack: new Set(), damage: new Set() };
  const parse = (abs, set) => {
    try {
      const src = fs.readFileSync(abs, "utf8");
      const re = /"([^"]+)"\s*:\s*true/g;
      let m;
      while ((m = re.exec(src)) !== null) set.add(m[1]);
    } catch {
      /* optional */
    }
  };
  if (root) {
    parse(path.join(root, "attack-data-table-attack-ids.ts"), data.attack);
    parse(path.join(root, "damage-data-table-attack-ids.ts"), data.damage);
  }
  registryCache = { key, data };
  return data;
}

// ---- validation ----
function validateProject(project, enums) {
  const issues = [];
  const push = (issue) => {
    if (issues.length < 1000) issues.push(issue);
  };
  const checkedFams = new Set(); // shared rules validate once per family
  for (const [file, st] of Object.entries(project.tables || {})) {
    if (!/\.json$/i.test(file)) continue; // family rule entries have no input table
    let vanilla = null;
    let tableSchema = null;
    try {
      vanilla = schema.readInputTable(file).rows;
      tableSchema = schema.inferSchema(file);
    } catch (err) {
      push({ type: "table", file, message: `cannot read input table: ${err.message}` });
      continue;
    }
    // Rule evaluation errors (checked once per family — rules are shared).
    const famRules = exportMod.getFamilyRules(project, file);
    if (famRules.length > 0 && !checkedFams.has(exportMod.shareKeyOf(file))) {
      checkedFams.add(exportMod.shareKeyOf(file));
      const sampleId = Object.keys(vanilla)[0];
      if (sampleId) {
        try {
          engine.applyRulesToRow(engine.clone(vanilla[sampleId]), famRules, tableSchema, enums);
        } catch (err) {
          push({ type: "rule", file, message: String(err.message) });
        }
      }
      for (const rawR of famRules) {
        const r = engine.normalizeRule(rawR);
        const label = r.name || r.id || "?";
        for (const a of [...r.then, ...r.else]) {
          if (!a.field) push({ type: "rule", file, message: `rule ${label} has an action with no field` });
        }
      }
    }
    // Dangling Id_ refs in effective rows.
    const checkRow = (rowId, effective, isNew) => {
      const walk = (obj) => {
        for (const [k, v] of Object.entries(obj || {})) {
          if (Array.isArray(v)) {
            if (ID_FIELD_RE.test(k)) {
              for (const el of v) {
                if (isRefValue(el) && resolveFieldValue(k, el, project).length === 0) {
                  push({ type: "dangling-ref", file, rowId, field: k, value: el, isNew, message: `"${el}" resolves nowhere` });
                }
              }
            } else {
              v.forEach((el) => {
                if (el && typeof el === "object") walk(el);
              });
            }
          } else if (v && typeof v === "object") {
            walk(v);
          } else if (ID_FIELD_RE.test(k) && isRefValue(v)) {
            if (resolveFieldValue(k, v, project).length === 0) {
              push({ type: "dangling-ref", file, rowId, field: k, value: v, isNew, message: `"${v}" resolves nowhere` });
            }
          }
        }
      };
      walk(effective);
    };
    for (const [rowId, vrow] of Object.entries(vanilla)) {
      const ov = (st.overrides && st.overrides[rowId]) || {};
      if (Object.keys(ov).length === 0 && exportMod.getFamilyRules(project, file).length === 0) continue;
      try {
        const { row } = engine.applyTableStateToRow(vrow, { globalRules: exportMod.getFamilyRules(project, file), overrides: ov }, tableSchema, enums);
        checkRow(rowId, row, false);
      } catch {
        /* rule error already reported */
      }
    }
    for (const [rowId, nr] of Object.entries((st && st.newRows) || {})) {
      let base = {};
      if (nr && nr._base) {
        base = findRowInFamily(file, nr._base) || {};
        if (!base || Object.keys(base).length === 0) {
          push({ type: "new-row", file, rowId, message: `clone base not found: ${nr._base}` });
        }
      }
      try {
        checkRow(rowId, engine.applyNewRow(base, nr, tableSchema, enums), true);
      } catch (err) {
        push({ type: "new-row", file, rowId, message: String(err.message) });
      }
    }
  }
  // Parameter rows: unknown exchangeImage entries.
  for (const [short, pstate] of Object.entries(project.parameters || {})) {
    const rows = (pstate && pstate.rows) || {};
    for (const [id, val] of Object.entries(rows)) {
      if (id.startsWith("$")) continue;
      if (val === undefined || val === null) {
        push({ type: "param", short, rowId: id, message: "empty value" });
      }
    }
  }
  const counts = {};
  for (const i of issues) counts[i.type] = (counts[i.type] || 0) + 1;
  return { issues: issues.slice(0, 400), counts, total: issues.length };
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

// ---- new-character checklist ----
const CHECKLIST_CORE = [
  "ActionDataTable",
  "AttackSetDataTable",
  "AttackDataTable",
  "DamageDataTable",
  "CharacterDataTable",
  "CharacterSelectDataTable",
  "CharacterBaseParameterDataTable",
  "CharacterCursedEnergyDataTable",
  "ActionMoveDataTable",
  "CharacterAnimationDataTable",
];
const CHECKLIST_EXTENDED = [
  "CharacterCameraDataTable",
  "CharacterSoundDataTable",
  "CharacterVoiceGroupDataTable",
  "CharacterUIDataTable",
  "CharacterVariationDataTable",
  "CharacterChatDataTable",
  "CharacterEffectDataTable",
  "CharacterOperationDataTable",
  "ActionDashDataTable",
  "ActionJumpDataTable",
  "ActionHomingDataTable",
  "ActionStepDataTable",
  "ActionBreakFallDataTable",
  "CharacterMouthPatternDataTable",
  "CharacterCaptureDataTable",
  "CharacterTrapDataTable",
  "CharacterShikigamiDataTable",
  "CharacterDecalDataTable",
  "CharacterWeaponDataTable",
  "CharacterMaterialDataTable",
  "CharacterImageDataTable",
  "CharacterCustomVoiceDataTable",
  "CharacterSpecialAttackDataTable",
  "CharacterArcadeDataTable",
];

async function checklistFor(prefix, project) {
  const index = buildRowKeyIndex();
  const tables = schema.listTables();
  const fam = (family) => {
    const files = tables.filter((t) => t.family === family);
    let vanilla = 0;
    let proj = 0;
    const perFile = [];
    for (const t of files) {
      const v = (index[t.file] || []).filter((k) => k.startsWith(prefix)).length;
      const st = project.tables && project.tables[t.file];
      let p = 0;
      if (st) {
        p += Object.keys(st.newRows || {}).filter((k) => k.startsWith(prefix)).length;
        p += Object.keys(st.overrides || {}).filter((k) => k.startsWith(prefix)).length;
      }
      vanilla += v;
      proj += p;
      if (v > 0 || p > 0) perFile.push({ file: t.file, vanilla: v, project: p });
    }
    return { family, status: vanilla + proj > 0 ? "ok" : "missing", vanilla, project: proj, files: perFile };
  };
  return {
    prefix,
    core: CHECKLIST_CORE.map(fam),
    extended: CHECKLIST_EXTENDED.map(fam),
  };
}

// ---- moveset rollup ----
function keysInFamily(family, key) {
  const out = [];
  for (const t of schema.listTables()) {
    if (t.family !== family) continue;
    try {
      const rows = schema.readInputTable(t.file).rows;
      if (rows[key] !== undefined) out.push({ file: t.file, row: rows[key] });
    } catch {
      /* ignore */
    }
  }
  return out;
}

function attackKeysInRow(row) {
  const hits = [];
  const seen = new Set();
  for (const [k, v] of Object.entries(row || {})) {
    const vals = Array.isArray(v) ? v : [v];
    for (const x of vals) {
      if (typeof x !== "string" || !isRefValue(x) || seen.has(x)) continue;
      if (keysInFamily("AttackDataTable", x).length > 0) {
        seen.add(x);
        hits.push({ field: k, id: x });
      }
    }
  }
  return hits;
}

function damageKeysInRow(row) {
  const out = [];
  const seen = new Set();
  const walk = (v) => {
    const vals = Array.isArray(v) ? v : [v];
    for (const x of vals) {
      if (x && typeof x === "object") {
        Object.values(x).forEach(walk);
      } else if (typeof x === "string" && isRefValue(x) && !seen.has(x)) {
        if (keysInFamily("DamageDataTable", x).length > 0) {
          seen.add(x);
          out.push(x);
        }
      }
    }
  };
  Object.values(row || {}).forEach(walk);
  return out;
}

const MOVESET_ATTACK_FIELDS = ["CharacterAnimation", "AttackTransitionType", "AutoTransitionKind", "Id_ActionHoming"];
const MOVESET_DAMAGE_FIELDS = ["Damage", "DamageType", "DamageKind", "Down_Damage", "HitMax", "GuardDurability_Damage"];

function pickFields(row, fields) {
  const out = {};
  for (const f of fields) {
    if (row && row[f] !== undefined) out[f] = engine.clone(row[f]);
  }
  return out;
}

function movesetFor(prefix) {
  const actionFiles = filesOfFamily("ActionDataTable");
  let actionKey = null;
  let actionRow = null;
  for (const file of actionFiles) {
    try {
      const rows = schema.readInputTable(file).rows;
      if (rows[prefix] !== undefined) {
        actionKey = prefix;
        actionRow = rows[prefix];
        break;
      }
    } catch {
      /* ignore */
    }
  }
  if (!actionRow) {
    for (const file of actionFiles) {
      try {
        const rows = schema.readInputTable(file).rows;
        const k = Object.keys(rows).find((x) => x.startsWith(prefix));
        if (k) {
          actionKey = k;
          actionRow = rows[k];
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (!actionRow) return { prefix, actionKey: null, inputs: [] };
  const inputs = [];
  for (const [field, value] of Object.entries(actionRow)) {
    if (!/^Id_AttackSet/.test(field)) continue;
    const vals = (Array.isArray(value) ? value : [value]).filter(isRefValue);
    if (vals.length === 0) continue;
    const sets = [];
    for (const setId of vals) {
      const found = keysInFamily("AttackSetDataTable", setId);
      if (found.length === 0) {
        sets.push({ set: setId, missing: true, hits: [] });
        continue;
      }
      const hits = [];
      for (const h of attackKeysInRow(found[0].row)) {
        const arows = keysInFamily("AttackDataTable", h.id);
        const arow = arows.length > 0 ? arows[0].row : null;
        const damages = [];
        if (arow) {
          for (const d of damageKeysInRow(arow)) {
            const drows = keysInFamily("DamageDataTable", d);
            damages.push({
              id: d,
              missing: drows.length === 0,
              fields: drows.length > 0 ? pickFields(drows[0].row, MOVESET_DAMAGE_FIELDS) : {},
            });
          }
        }
        hits.push({
          id: h.id,
          via: h.field,
          missing: !arow,
          fields: arow ? pickFields(arow, MOVESET_ATTACK_FIELDS) : {},
          damages,
        });
      }
      sets.push({ set: setId, file: found[0].file, hits });
    }
    inputs.push({ field, sets });
  }
  return { prefix, actionKey, inputs };
}

// ---- global search ----
function globalSearch(query, project, limit) {
  const q = String(query || "").toLowerCase();
  if (!q) return [];
  const out = [];
  const max = Math.min(500, Math.max(50, limit || 300));
  const hit = (entry) => {
    if (out.length < max) out.push(entry);
  };
  for (const t of schema.listTables()) {
    let rows = null;
    try {
      rows = schema.readInputTable(t.file).rows;
    } catch {
      continue;
    }
    const st = (project.tables && project.tables[t.file]) || {};
    for (const [rowId, row] of Object.entries(rows)) {
      if (out.length >= max) break;
      if (rowId.toLowerCase().includes(q)) {
        hit({ file: t.file, rowId, field: null, snippet: `row id`, source: (st.overrides && st.overrides[rowId]) || (st.newRows && st.newRows[rowId]) ? "project" : "vanilla" });
        continue;
      }
      if (!row || typeof row !== "object") continue;
      const merged = { ...row, ...((st.overrides && st.overrides[rowId]) || {}) };
      for (const [k, v] of Object.entries(merged)) {
        const s = typeof v === "string" ? v : Array.isArray(v) ? v.join(" ") : null;
        if (s === null) continue;
        if (s.toLowerCase().includes(q)) {
          hit({ file: t.file, rowId, field: k, snippet: s.length > 120 ? `${s.slice(0, 120)}…` : s, source: st.overrides && st.overrides[rowId] && st.overrides[rowId][k] !== undefined ? "project" : "vanilla" });
          break;
        }
      }
    }
    if (out.length >= max) break;
  }
  // Project new rows.
  if (project && out.length < max) {
    for (const [file, st] of Object.entries(project.tables || {})) {
      for (const [rowId, nr] of Object.entries((st && st.newRows) || {})) {
        if (out.length >= max) break;
        const blob = JSON.stringify((nr && nr.fields) || {});
        if (rowId.toLowerCase().includes(q) || blob.toLowerCase().includes(q)) {
          hit({ file, rowId, field: null, snippet: "new row", source: "project" });
        }
      }
    }
  }
  return out;
}

// ---- project compare ----
async function compareProjects(nameA, nameB) {
  const a = await projects.load(nameA);
  const b = await projects.load(nameB);
  const files = new Set([...Object.keys(a.tables || {}), ...Object.keys(b.tables || {})]);
  const tables = {};
  for (const file of [...files].sort()) {
    if (!/\.json$/i.test(file)) continue; // family rule entries compare via their members
    const sa = a.tables[file] || { globalRules: [], overrides: {}, newRows: {} };
    const sb = b.tables[file] || { globalRules: [], overrides: {}, newRows: {} };
    const ra = exportMod.getFamilyRules(a, file);
    const rb = exportMod.getFamilyRules(b, file);
    const rulesSame = JSON.stringify(ra) === JSON.stringify(rb);
    const rows = {};
    const rowIds = new Set([...Object.keys(sa.overrides || {}), ...Object.keys(sb.overrides || {}), ...Object.keys(sa.newRows || {}), ...Object.keys(sb.newRows || {})]);
    for (const rowId of [...rowIds].sort()) {
      const inA = (sa.overrides && sa.overrides[rowId]) || (sa.newRows && sa.newRows[rowId] && sa.newRows[rowId].fields);
      const inB = (sb.overrides && sb.overrides[rowId]) || (sb.newRows && sb.newRows[rowId] && sb.newRows[rowId].fields);
      const fields = {};
      const keys = new Set([...Object.keys(inA || {}), ...Object.keys(inB || {})]);
      for (const f of [...keys].sort()) {
        const va = inA ? inA[f] : undefined;
        const vb = inB ? inB[f] : undefined;
        if (!engine.deepEqual(va, vb)) fields[f] = { a: engine.clone(va), b: engine.clone(vb) };
      }
      if (Object.keys(fields).length > 0 || (!inA !== !inB)) {
        rows[rowId] = { inA: !!inA, inB: !!inB, fields };
      }
    }
    if (!rulesSame || Object.keys(rows).length > 0) {
      tables[file] = { rulesSame, ruleCountA: ra.length, ruleCountB: rb.length, rows };
    }
  }
  const params = {};
  const shorts = new Set([...Object.keys(a.parameters || {}), ...Object.keys(b.parameters || {})]);
  for (const short of [...shorts].sort()) {
    const ra = ((a.parameters[short] || {}).rows) || {};
    const rb = ((b.parameters[short] || {}).rows) || {};
    const ids = new Set([...Object.keys(ra), ...Object.keys(rb)]);
    const rows = {};
    for (const id of [...ids].sort()) {
      if (id.startsWith("$")) continue;
      if (!engine.deepEqual(ra[id], rb[id])) rows[id] = { inA: ra[id] !== undefined, inB: rb[id] !== undefined };
    }
    if (Object.keys(rows).length > 0) params[short] = rows;
  }
  return { tables, params };
}

module.exports = {
  buildRowKeyIndex,
  guessFamily,
  resolveFieldValue,
  referenceTargets,
  referencedBy,
  clearMemo,
  complete,
  loadIdRegistries,
  validateProject,
  findRowInFamily,
  checklistFor,
  movesetFor,
  globalSearch,
  compareProjects,
};
