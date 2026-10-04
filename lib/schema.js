// Schema layer: field schemas come hardcoded from JJKJsonEditor types/*.ts
// (exact field lists + enum refs); row values only supply counts/prefixes.
// Falls back to inferring from rows when no types file resolves. Also parses
// JJKJsonEditor enums.ts / constants.ts, and resolves field
// documentation from wiki/*.md overlaid with the user-editable field-docs.json.
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const config = require("./config");

const UE_ENUM_RE = /^EGame[A-Za-z0-9_]+::[A-Za-z0-9_]+$/;
const ROW_PREFIX_RE = /^((?:CN|CP)_\d{3})/;

// Mod-facing parameter assets (mirrors CookedDatatablePatcher src/bpdata/parameters.ts).
const BP_PARAMETER_ASSETS = [
  {
    shortName: "sceneCapture",
    assetName: "GameWidgetSceneCaptureParameter_BP",
    className: "GameWidgetSceneCaptureParameter",
    mapProp: "CharacterParameterMap",
    keyKind: "name",
    valueKind: "ref",
    desc: "Per-character 3D preview. Value names the GameWidgetCharacterSceneCapture_*_BP asset to reference (short char ID like CP_010 or a full package path).",
  },
  {
    shortName: "character",
    assetName: "GameWidgetCharacterParameter_BP",
    className: "GameWidgetCharacterParameter",
    mapProp: "CharaModelViewerParameterMap",
    keyKind: "name",
    valueKind: "struct",
    desc: "Per-character model-viewer framing (GameWidgetCharaModelViewerParameter). Sparse structs allowed; absent fields use defaults.",
  },
  {
    shortName: "storyDemo",
    assetName: "GameWidgetStoryDemoParameter_BP",
    className: "GameWidgetStoryDemoParameter",
    mapProp: "CharacterParameterMap",
    keyKind: "name",
    valueKind: "struct",
    desc: "Per-character story-demo framing (GameStoryDemoCharacterParameter): facial texture rect, scale, pivot.",
  },
  {
    shortName: "exchangeImage",
    assetName: "GameWidgetExchangeImageParameter_BP",
    className: "GameWidgetExchangeImageParameter",
    mapProp: "ImageOffsetParameterMap",
    keyKind: "costume",
    valueKind: "rows",
    desc: "Per-costume UI image offsets (costume IDs like CP_300_00). Offset applies to all image entries unless an entries map narrows it per entry.",
  },
  {
    shortName: "dynamicIcon",
    assetName: "GameWidgetDynamicIconParameter_BP",
    className: "GameWidgetDynamicIconParameter",
    mapProp: "FallbackInputGuideParameterMap",
    keyKind: "costume",
    valueKind: "struct",
    desc: "Per-costume input-guide fallbacks (GameWidgetFallbackInputGuideParameter): brush, tint, outline, font per costume row.",
  },
];

let tablesCache = null; // [{file, base, family, locale, rows, group}]
let tablesCacheKey = "";
let parsedTableCache = new Map(); // file -> {rows, mtimeMs}
let enumsCache = null;
let enumsCacheKey = "";
let charsCache = null;
let charsCacheKey = "";
let schemaCache = new Map(); // file -> {schema, mtimeMs}
let rowTypesCache = null; // {byBase: Map<lowerTypesBase, {...}>}
let rowTypesKey = "";
let wikiIndexCache = null;
let wikiIndexKey = "";
let docsCache = new Map(); // base -> docs
let userDocsCache = null;
let userDocsKey = "";
let tableCategoriesCache = null; // {sig, byFile} from ../tableCategories.js

function refresh() {
  tablesCache = null;
  parsedTableCache = new Map();
  enumsCache = null;
  schemaCache = new Map();
  rowTypesCache = null;
  rowTypesKey = "";
  wikiIndexCache = null;
  docsCache = new Map();
  userDocsCache = null;
  tableCategoriesCache = null;
  seedAttempted = false;
  try {
    require("./characters").refresh();
  } catch {
    /* ignore */
  }
}

// Vanilla tables are vendored with the app (data/input_json/) — hardcoded,
// not a setting. First launch seeds them from the pre-vendor location.
const LEGACY_SEED_DIRS = ["C:/Users/Ahmed/Documents/Apps/JJKJsonEditor/input_json"];
let seedAttempted = false;
function vendoredInputDir() {
  return path.join(__dirname, "..", "data", "input_json");
}
function inputDir() {
  return vendoredInputDir();
}
function ensureInputJson() {
  if (seedAttempted) return;
  seedAttempted = true;
  try {
    if (fs.readdirSync(vendoredInputDir()).some((f) => f.toLowerCase().endsWith(".json"))) return;
  } catch {
    /* not seeded yet */
  }
  const candidates = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8"));
    if (raw && raw.inputJsonDir) candidates.push(raw.inputJsonDir);
  } catch {
    /* ignore */
  }
  const dest = vendoredInputDir();
  for (const src of [...candidates, ...LEGACY_SEED_DIRS]) {
    if (!src) continue;
    try {
      if (path.resolve(src) === path.resolve(dest)) continue;
    } catch {
      continue;
    }
    let files = [];
    try {
      files = fs.readdirSync(src).filter((f) => f.toLowerCase().endsWith(".json"));
    } catch {
      continue;
    }
    if (files.length === 0) continue;
    try {
      fs.mkdirSync(dest, { recursive: true });
      for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dest, f));
    } catch {
      continue;
    }
    break;
  }
}

function editorRoot() {
  return config.get().editorRoot;
}

function parseTableFile(file) {
  const stem = file.replace(/\.json$/i, "");
  let base = stem;
  let locale = null;
  const m = stem.match(/_((?:Es_LA)|(?:Zh_Han[st])|De|En|Es|Fr|It|Ja|Ko|Pt)$/);
  if (m) {
    locale = m[1];
    base = stem.slice(0, -(locale.length + 1));
  }
  const family = base.replace(/\d+$/, "") || base;
  return { stem, base, family, locale };
}

function extractRows(parsed) {
  const pick = (obj) => {
    if (obj && typeof obj === "object" && obj.Rows && typeof obj.Rows === "object") {
      return { rows: obj.Rows, meta: { Name: obj.Name, RowStruct: obj?.Properties?.RowStruct } };
    }
    return null;
  };
  if (Array.isArray(parsed)) {
    const merged = {};
    let meta = null;
    for (const el of parsed) {
      const r = pick(el);
      if (r) {
        Object.assign(merged, r.rows);
        meta = meta || r.meta;
      }
    }
    return { rows: merged, meta };
  }
  const single = pick(parsed);
  if (single) return single;
  // Sparse mod shape: { rowId: { field: value } }
  if (parsed && typeof parsed === "object") return { rows: parsed, meta: null, sparse: true };
  return { rows: {}, meta: null };
}

function statSyncSafe(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function readInputTable(file) {
  const dir = inputDir();
  const abs = path.join(dir, file);
  const st = statSyncSafe(abs);
  if (!st) throw new Error(`Input table not found: ${file}`);
  const hit = parsedTableCache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.data;
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  const data = extractRows(raw);
  parsedTableCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data });
  if (parsedTableCache.size > 60) {
    const first = parsedTableCache.keys().next().value;
    parsedTableCache.delete(first);
  }
  return data;
}

function walkMdFiles(root, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(root, e.name);
    if (e.isDirectory()) walkMdFiles(abs, out);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) out.push(abs);
  }
  return out;
}

function prettifyGroup(g) {
  return g
    .split(/[-_]/g)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function getWikiIndex() {
  const root = editorRoot();
  const key = root || "";
  if (wikiIndexCache && wikiIndexKey === key) return wikiIndexCache;
  const index = new Map(); // lower(stem) -> {group, file}
  const groups = [];
  if (root) {
    const base = path.join(root, "wiki", "datatables");
    for (const abs of walkMdFiles(base)) {
      const rel = path.relative(base, abs);
      const parts = rel.split(path.sep);
      const group = parts.length > 1 ? parts[0] : "other";
      const stem = path.basename(abs, ".md").toLowerCase();
      if (!index.has(stem)) index.set(stem, { group, file: abs });
      if (!groups.includes(group)) groups.push(group);
    }
  }
  wikiIndexCache = { index, groups: groups.sort() };
  wikiIndexKey = key;
  docsCache = new Map();
  return wikiIndexCache;
}

// User-editable category overrides from ../tableCategories.js
// (shape: { "Category": ["File.json", "Base", "Family", ...] }).
// Cleared on refresh(); reloaded when Settings change or on restart.
function getCategoryOverrides() {
  if (tableCategoriesCache) return tableCategoriesCache;
  const byFile = new Map(); // lower(entry) -> category (first wins)
  let sig = "none";
  try {
    const p = path.join(__dirname, "..", "tableCategories.js");
    const st = statSyncSafe(p);
    if (st) {
      sig = `${st.mtimeMs}:${st.size}`;
      delete require.cache[require.resolve(p)];
      const raw = require(p);
      const obj = raw && typeof raw === "object" ? raw : {};
      for (const [cat, list] of Object.entries(obj)) {
        const catName = String(cat).trim();
        if (!catName) continue;
        const arr = Array.isArray(list) ? list : [list];
        for (const entry of arr) {
          const key = String(entry || "").trim().toLowerCase();
          if (!key) continue;
          if (!byFile.has(key)) byFile.set(key, catName);
        }
      }
      sig += `:${byFile.size}`;
    }
  } catch {
    /* missing/broken file = no overrides */
  }
  tableCategoriesCache = { sig, byFile };
  return tableCategoriesCache;
}

function resolveCustomCategory(file, base, family, overrides) {
  return (
    overrides.byFile.get(String(file).toLowerCase()) ||
    overrides.byFile.get(String(base).toLowerCase()) ||
    overrides.byFile.get(String(family).toLowerCase()) ||
    null
  );
}

function tablesCachePath() {
  return path.join(config.get().projectsDir, ".tables-cache.json");
}

function prefixCachePath() {
  return path.join(config.get().projectsDir, ".prefix-cache.json");
}

// Lightweight per-table character-prefix histogram (row keys only, no value
// sampling). Persistently cached by file mtime/size; powers per-character mode.
function tablePrefixes(file) {
  const { rows } = readInputTable(file);
  const counts = {};
  for (const id of Object.keys(rows)) {
    const m = /^((?:CN|CP)_\d{3})/.exec(id);
    if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  return counts;
}

async function buildPrefixIndex(onProgress) {
  const dir = inputDir();
  if (!dir || !fs.existsSync(dir)) return {};
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".json")).sort();
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(prefixCachePath(), "utf8"));
  } catch {
    cache = {};
  }
  const index = {};
  let dirty = false;
  let done = 0;
  for (const file of files) {
    const abs = path.join(dir, file);
    const st = statSyncSafe(abs);
    if (!st) continue;
    const ck = `${file}:${st.mtimeMs}:${st.size}`;
    if (cache[ck]) {
      index[file] = cache[ck];
    } else {
      try {
        index[file] = tablePrefixes(file);
      } catch {
        index[file] = {};
      }
      cache[ck] = index[file];
      dirty = true;
    }
    done++;
    if (onProgress && done % 25 === 0) {
      try {
        await onProgress(done, files.length);
      } catch {
        /* ignore */
      }
    }
  }
  if (dirty) {
    try {
      fs.mkdirSync(path.dirname(prefixCachePath()), { recursive: true });
      const keys = Object.keys(cache).slice(-4000);
      const trimmed = {};
      for (const k of keys) trimmed[k] = cache[k];
      fs.writeFileSync(prefixCachePath(), JSON.stringify(trimmed));
    } catch {
      /* best effort */
    }
  }
  return index;
}

function loadTablesCountCache() {
  try {
    return JSON.parse(fs.readFileSync(tablesCachePath(), "utf8"));
  } catch {
    return {};
  }
}

function listTables() {
  ensureInputJson();
  const dir = inputDir();
  if (!dir || !fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .sort();
  const catOverrides = getCategoryOverrides();
  const key = `${dir}|${files.length}|${files[0] || ""}|${files[files.length - 1] || ""}|${catOverrides.sig}`;
  if (tablesCache && tablesCacheKey === key) return tablesCache;
  const { index } = getWikiIndex();
  const countCache = loadTablesCountCache();
  let countCacheDirty = false;
  const out = [];
  for (const file of files) {
    const abs = path.join(dir, file);
    const st = statSyncSafe(abs);
    if (!st) continue;
    const ck = `${file}:${st.mtimeMs}:${st.size}`;
    let rows = countCache[ck];
    if (typeof rows !== "number") {
      try {
        rows = Object.keys(readInputTable(file).rows).length;
      } catch {
        rows = 0;
      }
      countCache[ck] = rows;
      countCacheDirty = true;
    }
    const { base, family, locale } = parseTableFile(file);
    const custom = resolveCustomCategory(file, base, family, catOverrides);
    const hit =
      index.get(base.toLowerCase()) || index.get(family.toLowerCase()) || null;
    out.push({
      file,
      base,
      family,
      locale,
      rows,
      group: custom || (hit ? hit.group : "other"),
      groupLabel: custom || (hit ? prettifyGroup(hit.group) : "Other"),
    });
  }
  if (countCacheDirty) {
    try {
      fs.mkdirSync(path.dirname(tablesCachePath()), { recursive: true });
      const keys = Object.keys(countCache).slice(-2000);
      const trimmed = {};
      for (const k of keys) trimmed[k] = countCache[k];
      fs.writeFileSync(tablesCachePath(), JSON.stringify(trimmed));
    } catch {
      /* best effort */
    }
  }
  tablesCache = out;
  tablesCacheKey = key;
  return out;
}

function getTableEntry(file) {
  return listTables().find((t) => t.file === file) || null;
}

function parseEnumsTs() {
  const enumsPath = vendoredEnumsPath();
  const key = enumsPath || "";
  if (enumsCache && enumsCacheKey === key) return enumsCache;
  const result = { order: [], map: {} };
  if (enumsPath) {
    try {
      const src = fs.readFileSync(enumsPath, "utf8");
      const enumRe = /export enum (EGame[A-Za-z0-9_]+)\s*\{([^}]*)\}/gs;
      let m;
      while ((m = enumRe.exec(src)) !== null) {
        const name = m[1];
        const body = m[2];
        const valueByMember = {};
        const memberByValue = {};
        const members = [];
        const memRe = /^\s*([A-Za-z0-9_]+)\s*=\s*(-?\d+)/gm;
        let mm;
        while ((mm = memRe.exec(body)) !== null) {
          const mem = mm[1];
          const val = Number(mm[2]);
          valueByMember[mem] = val;
          if (memberByValue[val] === undefined) memberByValue[val] = mem;
          members.push({ name: mem, value: val });
        }
        result.order.push(name);
        result.map[name] = { valueByMember, memberByValue, members };
      }
    } catch {
      /* enums.ts optional */
    }
  }
  enumsCache = result;
  enumsCacheKey = key;
  return result;
}

function getChars() {
  // Delegates to the character registry (vanilla + user-added customs).
  return require("./characters").getMap();
}

function charLabel(prefix) {
  return require("./characters").label(prefix);
}

function baseKindOf(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  switch (typeof v) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return UE_ENUM_RE.test(v) ? "enum" : "string";
    case "object":
      return "struct";
    default:
      return "any";
  }
}

function inferField(samples, enums) {
  const vals = samples.filter((v) => v !== null && v !== undefined);
  if (vals.length === 0) return { kind: "any", nullable: true };
  const kinds = new Set(vals.map(baseKindOf));
  const nullable = vals.length !== samples.length;
  if (kinds.size === 1) {
    const only = [...kinds][0];
    if (only === "boolean" || only === "number" || only === "string" || only === "struct")
      return { kind: only, nullable };
    if (only === "enum") {
      const types = new Set(vals.map((v) => String(v).split("::")[0]));
      if (types.size === 1) {
        const enumName = [...types][0];
        if (enums.map[enumName]) return { kind: "enum", enumName, nullable };
      }
      return { kind: "string", nullable, enumHint: true };
    }
    if (only === "array") {
      const elemKinds = new Set();
      const elemEnumTypes = new Set();
      let sawNonEmpty = false;
      for (const arr of vals) {
        for (const el of arr) {
          sawNonEmpty = true;
          const k = baseKindOf(el);
          elemKinds.add(k);
          if (k === "enum") elemEnumTypes.add(String(el).split("::")[0]);
        }
      }
      if (!sawNonEmpty) return { kind: "any[]", nullable };
      if (elemKinds.size === 1) {
        const ek = [...elemKinds][0];
        if (ek === "enum" && elemEnumTypes.size === 1) {
          const enumName = [...elemEnumTypes][0];
          if (enums.map[enumName]) return { kind: "enum[]", enumName, nullable };
          return { kind: "string[]", nullable };
        }
        if (ek === "number" || ek === "string" || ek === "boolean")
          return { kind: `${ek}[]`, nullable };
      }
      return { kind: "any[]", nullable };
    }
  }
  // Mixed: enum + plain strings (e.g. "None" alongside EGameX::Y)
  if (kinds.size === 2 && kinds.has("enum") && kinds.has("string")) {
    const types = new Set(
      vals.filter((v) => typeof v === "string" && UE_ENUM_RE.test(v)).map((v) => v.split("::")[0]),
    );
    if (types.size === 1 && enums.map[[...types][0]])
      return { kind: "enum", enumName: [...types][0], nullable, allowPlainString: true };
  }
  return { kind: "any", nullable };
}

// ---- hardcoded row schemas from JJKJsonEditor types/*.ts ----
// These are the authoritative field lists + types (including exact enum
// references). Schemas are NOT inferred from row values anymore; rows only
// supply rowCount / character prefixes. Falls back to legacy inference when
// no types file resolves (unmapped table).
// Vendored into this repo (data/types/, data/enums.ts) — no external
// dependency. Refresh with: npm run vendor:types

function stripTsComments(src) {
  return String(src || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Parse `export type <Name>Row = { ... };` — brace-matched, supports nested
// inline structs. Returns {rowTypeName, fields:[{name, tsType}]} or null.
function parseTsRowType(src) {
  const clean = stripTsComments(src);
  const m = clean.match(/export\s+type\s+([A-Za-z0-9_]+Row)\s*=\s*\{/);
  if (!m) return null;
  const rowTypeName = m[1];
  const startBrace = m.index + m[0].length - 1;
  let depth = 0;
  let end = -1;
  for (let i = startBrace; i < clean.length; i++) {
    const c = clean[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  return { rowTypeName, fields: splitTsMembers(clean.slice(startBrace + 1, end)) };
}

function splitTsMembers(body) {
  const out = [];
  let cur = "";
  let depth = 0;
  const flush = () => {
    const t = cur.trim();
    cur = "";
    if (!t) return;
    const mm = t.match(/^([A-Za-z0-9_]+)\s*:\s*([\s\S]+)$/);
    if (mm) out.push({ name: mm[1], tsType: mm[2].trim() });
  };
  for (const ch of body) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (ch === ";" && depth === 0) {
      flush();
      continue;
    }
    cur += ch;
  }
  flush();
  return out;
}

// Minimal TS type AST: primitives, EGame enums, readonly T[] / T[] /
// Array<T>, inline structs. Anything else -> unknown.
function parseTsTypeExpr(expr) {
  let s = String(expr || "").trim();
  if (/^readonly\s+/.test(s)) s = s.replace(/^readonly\s+/, "");
  const arrMatch = s.match(/^Array<([\s\S]+)>$/);
  if (arrMatch) return { t: "array", elem: parseTsTypeExpr(arrMatch[1]) };
  let isArray = false;
  while (s.endsWith("[]")) {
    isArray = true;
    s = s.slice(0, -2).trim();
  }
  let node;
  if (s === "number" || s === "string" || s === "boolean") node = { t: s };
  else if (/^EGame[A-Za-z0-9_]+$/.test(s)) node = { t: "enum", enumName: s };
  else if (s.startsWith("{")) node = { t: "struct" };
  else node = { t: "unknown" };
  if (isArray) return { t: "array", elem: node };
  return node;
}

function tsNodeToField(node, enums) {
  if (!node) return { kind: "any" };
  if (node.t === "number") return { kind: "number" };
  if (node.t === "string") return { kind: "string" };
  if (node.t === "boolean") return { kind: "boolean" };
  if (node.t === "enum") {
    if (enums.map[node.enumName]) return { kind: "enum", enumName: node.enumName };
    return { kind: "string", enumHint: true };
  }
  if (node.t === "array") {
    const e = tsNodeToField(node.elem, enums);
    if (e.kind === "number") return { kind: "number[]" };
    if (e.kind === "string") return { kind: "string[]" };
    if (e.kind === "boolean") return { kind: "boolean[]" };
    if (e.kind === "enum") return { kind: "enum[]", enumName: e.enumName };
    return { kind: "any[]" };
  }
  if (node.t === "struct") return { kind: "struct" };
  return { kind: "any" };
}

function typesDir() {
  return path.join(__dirname, "..", "data", "types");
}
function vendoredEnumsPath() {
  return path.join(__dirname, "..", "data", "enums.ts");
}
function loadRowTypes() {
  const dir = typesDir();
  const key = dir || "";
  if (rowTypesCache && rowTypesKey === key) return rowTypesCache;
  const byBase = new Map();
  if (dir) {
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".ts") && f.toLowerCase() !== "index.ts");
    } catch {
      files = [];
    }
    for (const f of files) {
      try {
        const abs = path.join(dir, f);
        const st = fs.statSync(abs);
        const parsed = parseTsRowType(fs.readFileSync(abs, "utf8"));
        if (!parsed) continue;
        byBase.set(path.basename(f, ".ts").toLowerCase(), {
          ...parsed,
          typesBase: path.basename(f, ".ts"),
          mtimeMs: st.mtimeMs,
          size: st.size,
        });
      } catch {
        /* skip unreadable */
      }
    }
  }
  rowTypesCache = { byBase };
  rowTypesKey = key;
  return rowTypesCache;
}

// Resolve the hardcoded field list for an input table (tries the full base
// name first, then the digit-stripped family for numbered splits).
function hardcodedFieldsFor(base, family, enums) {
  const { byBase } = loadRowTypes();
  if (!byBase.size) return null;
  const hit = byBase.get(String(base).toLowerCase()) || byBase.get(String(family).toLowerCase()) || null;
  if (!hit) return null;
  const fields = {};
  const fieldOrder = [];
  for (const m of hit.fields) {
    fields[m.name] = tsNodeToField(parseTsTypeExpr(m.tsType), enums);
    fields[m.name].hardcoded = true;
    fieldOrder.push(m.name);
  }
  return { fields, fieldOrder, rowType: hit.rowTypeName, typesBase: hit.typesBase, mtimeMs: hit.mtimeMs, size: hit.size };
}

function inferSchema(file) {
  const dir = inputDir();
  const abs = path.join(dir, file);
  const st = statSyncSafe(abs);
  if (!st) throw new Error(`Input table not found: ${file}`);
  const { base, family } = parseTableFile(file);
  const enums = parseEnumsTs();
  const hard = hardcodedFieldsFor(base, family, enums);
  const hardKey = hard ? `${hard.typesBase}:${hard.mtimeMs}:${hard.size}` : "";
  const hit = schemaCache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size && (hit.hardKey || "") === hardKey) {
    return hit.schema;
  }
  const { rows } = readInputTable(file);
  const ids = Object.keys(rows);
  const prefixes = new Map();
  for (const id of ids) {
    const pm = id.match(ROW_PREFIX_RE);
    if (pm) prefixes.set(pm[1], (prefixes.get(pm[1]) || 0) + 1);
  }
  let fields;
  let fieldOrder;
  let schemaSource;
  if (hard) {
    // Authoritative field list + types from types/*.ts. Rows only contribute
    // presence counts; undeclared extras (data drift) append as `any`.
    fields = {};
    fieldOrder = [...hard.fieldOrder];
    for (const name of hard.fieldOrder) fields[name] = { ...hard.fields[name], present: 0 };
    const extra = new Set();
    for (const id of ids) {
      const row = rows[id];
      if (!row || typeof row !== "object") continue;
      for (const f of Object.keys(row)) {
        if (!fields[f]) {
          fields[f] = { kind: "any", hardcoded: false, present: 0 };
          extra.add(f);
        }
        fields[f].present++;
      }
    }
    fieldOrder.push(...[...extra].sort());
    schemaSource = `types/${hard.typesBase}.ts`;
  } else {
    // Fallback: legacy inference from row values (no types file found).
    const collector = new Map(); // field -> {samples, present}
    const order = [];
    for (const id of ids) {
      const row = rows[id];
      if (!row || typeof row !== "object") continue;
      for (const [f, v] of Object.entries(row)) {
        let c = collector.get(f);
        if (!c) {
          c = { samples: [], present: 0 };
          collector.set(f, c);
          order.push(f);
        }
        c.present++;
        if (c.samples.length < 120) c.samples.push(v);
      }
    }
    fields = {};
    for (const [f, c] of collector) {
      const inferred = inferField(c.samples, enums);
      fields[f] = {
        ...inferred,
        present: c.present,
        example: c.samples.find((v) => v !== null && v !== undefined),
      };
    }
    fieldOrder = order;
    schemaSource = "inferred";
  }
  const schema = {
    file,
    rowCount: ids.length,
    fields,
    fieldOrder,
    source: schemaSource,
    prefixes: [...prefixes.entries()]
      .map(([prefix, count]) => ({ prefix, count, label: charLabel(prefix) }))
      .sort((a, b) => a.prefix.localeCompare(b.prefix)),
  };
  schemaCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, hardKey, schema });
  return schema;
}

function inferParamSchema(shortName, rowsObj) {
  const rows = rowsObj && typeof rowsObj === "object" ? rowsObj : {};
  const ids = Object.keys(rows).filter((k) => !k.startsWith("$"));
  const collector = new Map();
  const order = [];
  const enums = parseEnumsTs();
  for (const id of ids) {
    const row = rows[id];
    if (typeof row === "string" || typeof row === "number" || typeof row === "boolean") {
      let c = collector.get("(value)");
      if (!c) {
        c = { samples: [], present: 0 };
        collector.set("(value)", c);
        order.push("(value)");
      }
      c.present++;
      if (c.samples.length < 120) c.samples.push(row);
      continue;
    }
    if (!row || typeof row !== "object") continue;
    for (const [f, v] of Object.entries(row)) {
      let c = collector.get(f);
      if (!c) {
        c = { samples: [], present: 0 };
        collector.set(f, c);
        order.push(f);
      }
      c.present++;
      if (c.samples.length < 120) c.samples.push(v);
    }
  }
  const fields = {};
  for (const [f, c] of collector) {
    fields[f] = {
      ...inferField(c.samples, enums),
      present: c.present,
      example: c.samples.find((v) => v !== null && v !== undefined),
    };
  }
  return { shortName, rowCount: ids.length, fields, fieldOrder: order, prefixes: [] };
}

function parseWikiDocs(mdText) {
  const fields = {};
  let tableDesc = "";
  const lines = String(mdText || "").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^-\s*\*\*([^*]+)\*\*\s*[—–-]\s*(.+)\s*$/);
    if (m) {
      const name = m[1].trim();
      const desc = m[2].trim();
      if (/^(source|row struct|rows?|fields?)$/i.test(name)) continue;
      fields[name] = desc;
    } else if (!tableDesc) {
      const t = line.trim();
      if (t && !t.startsWith("#") && !t.startsWith("**") && !t.startsWith("Each line")) {
        tableDesc = t;
      }
    }
  }
  return { tableDesc, fields };
}

function userDocsPath() {
  return path.join(config.get().projectsDir, "field-docs.json");
}

function loadUserDocs() {
  const p = userDocsPath();
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(p).mtimeMs;
  } catch {
    /* missing */
  }
  if (userDocsCache && userDocsKey === `${p}:${mtimeMs}`) return userDocsCache;
  let doc = { fields: {}, enums: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (raw && typeof raw === "object") {
      doc = {
        fields: raw.fields && typeof raw.fields === "object" ? raw.fields : {},
        enums: raw.enums && typeof raw.enums === "object" ? raw.enums : {},
      };
    }
  } catch {
    /* start empty */
  }
  userDocsCache = doc;
  userDocsKey = `${p}:${mtimeMs}`;
  return doc;
}

async function saveUserDocs(doc) {
  const p = userDocsPath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, `${JSON.stringify(doc, null, 2)}\n`);
  userDocsCache = null;
}

function getTableDocs(base, family) {
  const key = `${base}|${family}`;
  if (docsCache.has(key)) return docsCache.get(key);
  const { index } = getWikiIndex();
  const hit = index.get(base.toLowerCase()) || index.get(family.toLowerCase()) || null;
  let tableDesc = "";
  let wikiFields = {};
  let wikiFile = null;
  if (hit) {
    wikiFile = hit.file;
    try {
      const parsed = parseWikiDocs(fs.readFileSync(hit.file, "utf8"));
      tableDesc = parsed.tableDesc;
      wikiFields = parsed.fields;
    } catch {
      /* ignore */
    }
  }
  const user = loadUserDocs();
  const fields = {};
  const names = new Set([...Object.keys(wikiFields)]);
  for (const k of Object.keys(user.fields)) {
    const at = k.indexOf(".");
    if (at > 0 && (k.slice(0, at) === base || k.slice(0, at) === family)) {
      names.add(k.slice(at + 1));
    }
  }
  for (const name of names) {
    const customKey =
      user.fields[`${base}.${name}`] !== undefined
        ? `${base}.${name}`
        : user.fields[`${family}.${name}`] !== undefined
          ? `${family}.${name}`
          : null;
    if (customKey) {
      fields[name] = { desc: user.fields[customKey], source: "custom" };
    } else if (wikiFields[name] !== undefined) {
      fields[name] = { desc: wikiFields[name], source: "wiki" };
    }
  }
  const docs = { tableDesc, fields, wikiFile, base, family };
  docsCache.set(key, docs);
  return docs;
}

function getEnumDocs(enumName) {
  const user = loadUserDocs();
  return (user.enums && user.enums[enumName]) || {};
}

async function saveFieldDoc(tableKey, field, desc) {
  const user = loadUserDocs();
  const k = `${tableKey}.${field}`;
  if (desc && desc.trim()) user.fields[k] = desc.trim();
  else delete user.fields[k];
  await saveUserDocs(user);
  docsCache = new Map();
  return true;
}

async function saveEnumDoc(enumName, member, desc) {
  const user = loadUserDocs();
  user.enums[enumName] = user.enums[enumName] || {};
  if (desc && desc.trim()) user.enums[enumName][member] = desc.trim();
  else {
    delete user.enums[enumName][member];
    if (Object.keys(user.enums[enumName]).length === 0) delete user.enums[enumName];
  }
  await saveUserDocs(user);
  return true;
}

module.exports = {
  BP_PARAMETER_ASSETS,
  refresh,
  getCategoryOverrides,
  inputDir,
  listTables,
  getTableEntry,
  readInputTable,
  parseTableFile,
  extractRows,
  parseEnumsTs,
  getChars,
  charLabel,
  inferSchema,
  tablePrefixes,
  buildPrefixIndex,
  inferParamSchema,
  getTableDocs,
  getEnumDocs,
  saveFieldDoc,
  saveEnumDoc,
  loadUserDocs,
  UE_ENUM_RE,
};
