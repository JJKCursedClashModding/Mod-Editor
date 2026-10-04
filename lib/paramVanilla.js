// Vanilla parameter values from cooked uassets + binary bake of new rows.
//
// Reads the vendored pristine GameWidget*Parameter_BP pairs (data/parameters)
// through the vendored CookedDatatablePatcher build, giving the editor real
// vanilla baselines for display/provenance/cloning, and bakes new rows into
// patched .uasset/.uexp override pairs at export time.
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const config = require("./config");
const schema = require("./schema");

const APP_DIR = path.join(__dirname, "..");
const VENDOR_DIR = path.join(APP_DIR, "vendor", "cooked-patcher");
const VANILLA_DIR = path.join(APP_DIR, "data", "parameters");

// Game-relative override path for baked parameter assets (matches how
// full new-character mods ship them under Content/Mods/<Mod>/assets/...).
const BAKED_ASSET_PREFIX = "assets/Jujutsu Kaisen CC/Content/Widgets/Commons";

let patcherCache = null;
let patcherRoot = null;
let dumpCache = new Map(); // short -> {key, data}

function vendorUsable() {
  try {
    return fs.existsSync(path.join(VENDOR_DIR, "dist", "index.js"));
  } catch {
    return false;
  }
}

function resolvePatcherRoot() {
  if (vendorUsable()) return VENDOR_DIR;
  const mm = config.get().modManagerDir;
  if (mm && fs.existsSync(path.join(mm, "CookedDatatablePatcher", "dist", "index.js"))) {
    return path.join(mm, "CookedDatatablePatcher");
  }
  return null;
}

function locateUsmap(root) {
  const c = path.join(root, "mappings.usmap");
  if (fs.existsSync(c)) return c;
  return null;
}

async function importRel(root, rel) {
  return import(pathToFileURL(path.join(root, "dist", rel)).href);
}

async function loadPatcher() {
  const root = resolvePatcherRoot();
  if (!root) throw new Error("No patcher build available (vendor/ missing and no Mod Manager dir configured).");
  if (patcherCache && patcherRoot === root) return patcherCache;
  const usmapPath = locateUsmap(root);
  if (!usmapPath) throw new Error(`mappings.usmap not found under ${root}`);
  const [index, codec, binary, maps, summary, usmapMod, bpmod, nameMap, serializer] = await Promise.all([
    importRel(root, "index.js"),
    importRel(root, "bpdata/codec.js"),
    importRel(root, "io/binary.js"),
    importRel(root, "package/maps.js"),
    importRel(root, "package/summary.js"),
    importRel(root, "schema/usmap.js"),
    importRel(root, "bpdata/modmanager.js"),
    importRel(root, "package/nameMap.js"),
    importRel(root, "unversioned/serializer.js"),
  ]);
  const registry = new usmapMod.SchemaRegistry(
    usmapMod.parseUsmap(fs.readFileSync(usmapPath)),
  );
  patcherCache = { root, usmapPath, index, codec, binary, maps, summary, registry, bpmod, nameMap, serializer };
  patcherRoot = root;
  return patcherCache;
}

function assetDef(short) {
  const a = schema.BP_PARAMETER_ASSETS.find((x) => x.shortName === short);
  if (!a) throw new Error(`Unknown parameter file: ${short}`);
  return a;
}

function vanillaKey(short) {
  try {
    const a = assetDef(short);
    const s1 = fs.statSync(path.join(VANILLA_DIR, `${a.assetName}.uasset`));
    const s2 = fs.statSync(path.join(VANILLA_DIR, `${a.assetName}.uexp`));
    return `${s1.mtimeMs}:${s1.size}:${s2.mtimeMs}:${s2.size}`;
  } catch {
    return "missing";
  }
}

function readCdo(patcher, asset) {
  const uasset = fs.readFileSync(path.join(VANILLA_DIR, `${asset.assetName}.uasset`));
  const uexp = fs.readFileSync(path.join(VANILLA_DIR, `${asset.assetName}.uexp`));
  const { summary } = patcher.summary.readPackageSummaryWithOffsets(uasset);
  const names = patcher.maps.readNameMap(uasset, summary.nameOffset, summary.nameCount);
  const imports = patcher.maps.readImportMap(uasset, summary.importOffset, summary.importCount);
  const stride = (summary.dependsOffset - summary.exportOffset) / summary.exportCount;
  let cdoIndex = -1;
  for (let i = 0; i < summary.exportCount; i++) {
    const nm = names[uasset.readInt32LE(summary.exportOffset + i * stride + 16)] ?? "";
    if (nm.startsWith("Default__")) cdoIndex = i;
  }
  if (cdoIndex < 0) throw new Error(`${asset.assetName}: no CDO export`);
  const size = Number(uasset.readBigInt64LE(summary.exportOffset + cdoIndex * stride + 28));
  const off = Number(uasset.readBigInt64LE(summary.exportOffset + cdoIndex * stride + 36));
  const blob = Buffer.from(uexp.subarray(off - summary.totalHeaderSize, off - summary.totalHeaderSize + size));
  const usmapSchema = patcher.registry.getFlattenedSchema(asset.className);
  if (!usmapSchema) throw new Error(`${asset.assetName}: missing usmap schema ${asset.className}`);
  const ctx = { names, registry: patcher.registry, zeroStates: new WeakMap() };
  const reader = new patcher.binary.BinaryReader(blob);
  const cdo = patcher.codec.readStruct(reader, usmapSchema, ctx);
  const map = cdo[asset.mapProp];
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    throw new Error(`${asset.assetName}: ${asset.mapProp} is not a map`);
  }
  return { map, names, imports };
}

function resolveRefValue(patcher, cdoData, value) {
  if (typeof value !== "number") return value;
  if (value >= 0) return value;
  const imp = cdoData.imports[-value - 1];
  if (!imp) return value;
  try {
    return patcher.maps.resolveName(cdoData.names, imp.objectNameIndex);
  } catch {
    return value;
  }
}

function stripEnumPrefix(key) {
  const i = String(key).indexOf("::");
  return i >= 0 ? String(key).slice(i + 2) : String(key);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// Dump one short to mod-facing display shape.
async function dumpShort(short) {
  const key = vanillaKey(short);
  const hit = dumpCache.get(short);
  if (hit && hit.key === key) return hit.data;
  const patcher = await loadPatcher();
  const asset = assetDef(short);
  const cdoData = readCdo(patcher, asset);
  const map = cdoData.map;
  let rows;
  let entryKeys = null;
  if (asset.valueKind === "ref") {
    rows = {};
    for (const [k, v] of Object.entries(map)) rows[k] = resolveRefValue(patcher, cdoData, v);
  } else if (asset.valueKind === "rows") {
    // Group cooked entry rows by costume ID for display.
    rows = {};
    entryKeys = Object.keys(map);
    for (const entryKey of entryKeys) {
      const entry = map[entryKey];
      const arr = entry && entry.Array;
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (!row || typeof row !== "object" || typeof row.ID !== "string") continue;
        rows[row.ID] = rows[row.ID] || { entries: {} };
        rows[row.ID].entries[stripEnumPrefix(entryKey)] = clone(row.Offset);
      }
    }
  } else {
    rows = {};
    for (const [k, v] of Object.entries(map)) rows[k] = clone(v);
  }
  const data = {
    short,
    asset: asset.assetName,
    valueKind: asset.valueKind,
    keyKind: asset.keyKind,
    rows,
    ids: Object.keys(rows).sort(),
    count: Object.keys(rows).length,
    entryKeys,
  };
  dumpCache.set(short, { key, data });
  if (dumpCache.size > 12) dumpCache.delete(dumpCache.keys().next().value);
  return data;
}

async function dumpAllShorts() {
  const out = {};
  for (const a of schema.BP_PARAMETER_ASSETS) {
    try {
      out[a.shortName] = await dumpShort(a.shortName);
    } catch (err) {
      out[a.shortName] = { short: a.shortName, error: err.message };
    }
  }
  return out;
}

// Convert a grouped exchangeImage display row back to patcher write shape.
function groupedToWriteValue(grouped, entryKeys) {
  const entries = (grouped && grouped.entries) || {};
  const names = Object.keys(entries);
  const first = names.length > 0 ? entries[names[0]] : { X: 0, Y: 0 };
  const full = {};
  // Faithful clone: every vanilla entry, edited values where present.
  for (const ek of entryKeys || names) {
    const short = stripEnumPrefix(ek);
    full[short] = entries[short] !== undefined ? entries[short] : first;
  }
  for (const short of names) {
    if (full[short] === undefined) full[short] = entries[short];
  }
  return { Offset: clone(first), entries: full };
}

function toWriteValue(short, displayValue, vanilla) {
  if (vanilla && vanilla.valueKind === "rows") {
    return groupedToWriteValue(displayValue, vanilla.entryKeys);
  }
  return clone(displayValue);
}

// Bake rows into patched binaries (upsert: new IDs added, existing IDs
// replaced). Returns per-short results with output buffers, or
// {ok:false, reason} when baking is unavailable.
async function bakeUpsert(newRowsByShort, replacedByShort) {
  const paramBake = require("./paramBake");
  const patcher = await loadPatcher();
  const manifestPath = path.join(VANILLA_DIR, "base-manifest.json");
  try {
    patcher.bpmod.verifyBaseManifest(VANILLA_DIR, manifestPath);
  } catch (err) {
    return { ok: false, reason: `base verification failed: ${err.message}` };
  }
  const tmpOut = await fsp.mkdtemp(path.join(os.tmpdir(), "jjk-bake-out-"));
  const shorts = new Set([
    ...Object.keys(newRowsByShort || {}),
    ...Object.keys(replacedByShort || {}),
  ]);
  const baked = [];
  const errors = [];
  for (const s of [...shorts].sort()) {
    const news = (newRowsByShort && newRowsByShort[s]) || {};
    const repls = (replacedByShort && replacedByShort[s]) || {};
    if (Object.keys(news).length === 0 && Object.keys(repls).length === 0) continue;
    const def = assetDef(s);
    try {
      const r = await paramBake.patchBpUpsert(
        patcher,
        { shortName: s, assetName: def.assetName, className: def.className, mapProp: def.mapProp, valueKind: def.valueKind },
        news,
        repls,
        VANILLA_DIR,
        tmpOut,
      );
      baked.push({
        short: r.shortName,
        asset: r.asset,
        added: r.added,
        replaced: r.replaced,
        skipped: r.skipped,
        uasset: await fsp.readFile(path.join(tmpOut, `${r.asset}.uasset`)),
        uexp: await fsp.readFile(path.join(tmpOut, `${r.asset}.uexp`)),
      });
    } catch (err) {
      errors.push(`${s}: ${err.message}`);
    }
  }
  await fsp.rm(tmpOut, { recursive: true, force: true });
  if (errors.length > 0) return { ok: false, reason: errors.join("\n") };
  return { ok: true, baked };
}

function availability() {
  const root = resolvePatcherRoot();
  if (!root) {
    return { available: false, reason: "No patcher build (vendor/ missing, no Mod Manager dir)." };
  }
  const missing = schema.BP_PARAMETER_ASSETS.filter(
    (a) =>
      !fs.existsSync(path.join(VANILLA_DIR, `${a.assetName}.uasset`)) ||
      !fs.existsSync(path.join(VANILLA_DIR, `${a.assetName}.uexp`)),
  );
  if (missing.length > 0) {
    return { available: false, reason: `Missing vanilla assets: ${missing.map((a) => a.assetName).join(", ")}` };
  }
  return { available: true, root };
}

module.exports = {
  BAKED_ASSET_PREFIX,
  VANILLA_DIR,
  availability,
  dumpShort,
  dumpAllShorts,
  toWriteValue,
  bakeUpsert,
  stripEnumPrefix,
};
