// Optional cooked-patch smoke test. Reuses the Mod Manager's
// CookedDatatablePatcher build + cooked data (data/datatables) when a Mod
// Manager directory is configured. Everything is defensive: any missing piece
// becomes a warning, never a crash.
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

function mmConstants(modManagerDir) {
  try {
    // lib/*.js in the Mod Manager are CommonJS.
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const c = require(path.join(modManagerDir, "lib", "constants.js"));
    return c;
  } catch {
    return {};
  }
}

async function importPatcherDist(modManagerDir) {
  const candidates = [
    path.join(modManagerDir, "CookedDatatablePatcher", "dist", "index.js"),
    path.join(modManagerDir, "CookedDatatablePatcher", "dist", "modmanager.js"),
  ];
  let lastErr = null;
  for (const c of candidates) {
    if (!fs.existsSync(c)) {
      lastErr = new Error(`Not found: ${c}`);
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const mod = await import(pathToFileURL(c).href);
      return { mod, entry: c };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `Could not load CookedDatatablePatcher build (${lastErr ? lastErr.message : "missing"}). Run the Mod Manager's patcher:build once.`,
  );
}

function pickFn(mod, names) {
  for (const n of names) {
    if (mod && typeof mod[n] === "function") return { fn: mod[n], name: n };
    if (mod && mod.default && typeof mod.default[n] === "function") {
      return { fn: mod.default[n], name: n };
    }
  }
  return null;
}

async function testPatch({ modManagerDir, datatablesTree, outDir }) {
  const warnings = [];
  if (!modManagerDir || !fs.existsSync(modManagerDir)) {
    throw new Error("No Mod Manager directory configured (Settings).");
  }
  const constants = mmConstants(modManagerDir);
  const cookedDir =
    constants.DATATABLES_DIR ||
    path.join(modManagerDir, "data", "datatables");
  if (!fs.existsSync(cookedDir)) {
    throw new Error(`Cooked datatables not found at ${cookedDir}`);
  }
  const { mod, entry } = await importPatcherDist(modManagerDir);
  const patchOne =
    pickFn(mod, ["patchCookedDataTable", "patchTable", "patch"]) || null;
  const patchDir =
    pickFn(mod, ["patchModManagerDirectory", "patchDirectory", "patchAll"]) || null;
  if (!patchOne && !patchDir) {
    throw new Error(
      `No patch function found in ${entry} (exports: ${Object.keys(mod).join(", ")})`,
    );
  }
  const stage = await fsp.mkdtemp(path.join(os.tmpdir(), "jjk-editor-mm-"));
  const out = outDir || (await fsp.mkdtemp(path.join(os.tmpdir(), "jjk-editor-cooked-")));
  await fsp.mkdir(out, { recursive: true });
  const tableNames = [];
  for (const [rel, content] of datatablesTree) {
    const base = path.basename(rel);
    if (!base.toLowerCase().endsWith(".json")) continue;
    const table = path.basename(base, ".json");
    tableNames.push(table);
    await fsp.writeFile(
      path.join(stage, base),
      Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"),
    );
  }
  const results = [];
  if (patchDir) {
    const summary = await patchDir.fn({
      modManagerDir: stage,
      inputDir: cookedDir,
      outputDir: out,
      addRows: true,
      copyUnpatched: false,
    });
    return { mode: `patchModManagerDirectory (${patchDir.name})`, entry, stage, out, summary, tableNames, warnings };
  }
  const registryArgs = ["registry", "schemaRegistry", "usmap"];
  for (const table of tableNames) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await patchOne.fn({
        inputDir: cookedDir,
        outputDir: out,
        tableAssetName: table,
        table,
        patchJsonPath: path.join(stage, `${table}.json`),
        patchPath: path.join(stage, `${table}.json`),
        addRows: true,
      });
      results.push({ table, ok: true, result: r });
    } catch (err) {
      results.push({ table, ok: false, error: err.message });
      warnings.push(`${table}: ${err.message}`);
    }
  }
  return { mode: `per-table (${patchOne.name})`, entry, stage, out, results, tableNames, warnings, registryArgs };
}

module.exports = { testPatch };
