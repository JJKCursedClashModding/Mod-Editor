// Character registry: vanilla ID -> name map (from JJKJsonEditor
// constants.ts + input_by_char) overlaid with user-added custom entries
// (new characters like CP_300 = Urame) stored in projects/characters.json.
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const config = require("./config");

const ID_RE = /^(CN|CP)_\d{3}$/;

let vanillaCache = null;
let vanillaKey = "";
let mergedCache = null;
let mergedKey = "";

function refresh() {
  vanillaCache = null;
  mergedCache = null;
}

function filePath() {
  return path.join(config.get().projectsDir, "characters.json");
}

function validateId(id) {
  const v = String(id || "").trim().toUpperCase();
  if (!ID_RE.test(v)) {
    throw new Error(`Character ID must look like CP_010 or CN_250 (got "${id}")`);
  }
  return v;
}

function loadCustom() {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath(), "utf8"));
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      try {
        const id = validateId(k);
        if (typeof v === "string" && v.trim()) out[id] = v.trim().slice(0, 60);
      } catch {
        /* skip bad keys */
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function saveCustom(map) {
  const clean = {};
  for (const [k, v] of Object.entries(map || {})) {
    const id = validateId(k);
    if (typeof v === "string" && v.trim()) clean[id] = v.trim().slice(0, 60);
  }
  const p = filePath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, `${JSON.stringify(clean, null, 2)}\n`);
  refresh();
  try {
    require("./schema").refresh();
  } catch {
    /* schema may not be loaded yet */
  }
  return clean;
}

function parseVanilla(editorRoot) {
  const key = editorRoot || "";
  if (vanillaCache && vanillaKey === key) return vanillaCache;
  const map = {};
  if (editorRoot) {
    try {
      const src = fs.readFileSync(path.join(editorRoot, "constants.ts"), "utf8");
      const re = /^\s*((?:CN|CP)_\d{3})\s*:\s*CharacterId\.((?:CN|CP)_\d{3}[A-Za-z0-9_]*)/gm;
      let m;
      while ((m = re.exec(src)) !== null) {
        const prefix = m[1];
        const rest = m[2].slice(prefix.length + 1).replace(/_/g, " ").trim();
        map[prefix] = rest || prefix;
      }
    } catch {
      /* constants.ts optional */
    }
    try {
      const byChar = path.join(editorRoot, "input_by_char");
      for (const d of fs.readdirSync(byChar)) {
        if (/^(?:CN|CP)_\d{3}/.test(d) && !map[d]) map[d] = d;
      }
    } catch {
      /* input_by_char optional */
    }
  }
  vanillaCache = map;
  vanillaKey = key;
  return map;
}

// Effective map: vanilla names shadowed by custom entries.
function getMap() {
  const root = config.get().editorRoot;
  let customMtime = 0;
  try {
    customMtime = fs.statSync(filePath()).mtimeMs;
  } catch {
    /* missing */
  }
  const key = `${root}|${customMtime}`;
  if (mergedCache && mergedKey === key) return mergedCache;
  mergedCache = { ...parseVanilla(root), ...loadCustom() };
  mergedKey = key;
  return mergedCache;
}

function label(prefix) {
  const map = getMap();
  return map[prefix] || prefix;
}

module.exports = {
  ID_RE,
  refresh,
  filePath,
  validateId,
  loadCustom,
  saveCustom,
  parseVanilla,
  getMap,
  label,
};
