// Copies JJKJsonEditor's row-type definitions + enums into this app's
// data/types/ and data/enums.ts (the hardcoded schema source — no external
// dependency at runtime). Re-run for manual re-syncs after the editor's
// types change:
//
// Usage: npm run vendor:types [editorRoot]
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const APP_DIR = path.join(__dirname, "..");
const TYPES_DEST = path.join(APP_DIR, "data", "types");
const ENUMS_DEST = path.join(APP_DIR, "data", "enums.ts");
const LEGACY = "C:/Users/Ahmed/Documents/Apps/JJKJsonEditor";

function detectRoot() {
  if (process.argv[2]) return process.argv[2];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(APP_DIR, "config.json"), "utf8"));
    if (raw && raw.editorRoot && fs.existsSync(raw.editorRoot)) return raw.editorRoot;
  } catch {
    /* ignore */
  }
  return LEGACY;
}

async function copyIfChanged(src, dest) {
  try {
    const [a, b] = await Promise.all([fsp.stat(src), fsp.stat(dest)]);
    if (a.size === b.size && a.mtimeMs === b.mtimeMs) return "skipped";
  } catch {
    /* copy */
  }
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(src, dest);
  return "copied";
}

async function main() {
  const root = detectRoot();
  if (!root || !fs.existsSync(root)) throw new Error(`Editor root not found: ${root}`);
  if (path.resolve(root, "types") === path.resolve(TYPES_DEST)) {
    console.log("Source is already the vendored dir; nothing to do.");
    return;
  }
  const srcTypes = path.join(root, "types");
  const files = (await fsp.readdir(srcTypes)).filter((f) => f.toLowerCase().endsWith(".ts"));
  if (files.length === 0) throw new Error(`No .ts files in ${srcTypes}`);
  let copied = 0;
  let skipped = 0;
  for (const f of files) {
    const r = await copyIfChanged(path.join(srcTypes, f), path.join(TYPES_DEST, f));
    if (r === "copied") copied++;
    else skipped++;
  }
  const enumsSrc = path.join(root, "enums.ts");
  if (!fs.existsSync(enumsSrc)) throw new Error(`enums.ts not found in ${root}`);
  const er = await copyIfChanged(enumsSrc, ENUMS_DEST);
  console.log(`Done: types copied ${copied}, up to date ${skipped} → ${TYPES_DEST}; enums.ts ${er} → ${ENUMS_DEST}`);
}

main().catch((err) => {
  console.error(`vendor-types: ${err.message}`);
  process.exit(1);
});
