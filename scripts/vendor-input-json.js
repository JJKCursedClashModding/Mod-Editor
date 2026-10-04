// Copies vanilla datatable JSONs into this app's data/input_json/ (the
// hardcoded tables dir). The app also seeds itself from the legacy location
// on first launch, so this script is only needed for manual re-syncs.
//
// Usage: npm run vendor-input-json [sourceDir]
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const APP_DIR = path.join(__dirname, "..");
const DEST = path.join(APP_DIR, "data", "input_json");
const LEGACY = "C:/Users/Ahmed/Documents/Apps/JJKJsonEditor/input_json";

function detectSource() {
  if (process.argv[2]) return process.argv[2];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(APP_DIR, "config.json"), "utf8"));
    if (raw && raw.inputJsonDir && fs.existsSync(raw.inputJsonDir)) return raw.inputJsonDir;
  } catch {
    /* ignore */
  }
  return LEGACY;
}

async function main() {
  const src = detectSource();
  if (!src || !fs.existsSync(src)) throw new Error(`Source input_json dir not found: ${src}`);
  if (path.resolve(src) === path.resolve(DEST)) {
    console.log("Source is already the vendored dir; nothing to do.");
    return;
  }
  const files = (await fsp.readdir(src)).filter((f) => f.toLowerCase().endsWith(".json"));
  if (files.length === 0) throw new Error(`No .json files in ${src}`);
  await fsp.mkdir(DEST, { recursive: true });
  let copied = 0;
  let skipped = 0;
  for (const f of files) {
    const s = path.join(src, f);
    const d = path.join(DEST, f);
    let same = false;
    try {
      const [a, b] = await Promise.all([fsp.stat(s), fsp.stat(d)]);
      same = a.size === b.size && a.mtimeMs === b.mtimeMs;
    } catch {
      same = false;
    }
    if (same) {
      skipped++;
      continue;
    }
    await fsp.copyFile(s, d);
    copied++;
    if (copied % 25 === 0) console.log(`  ...${copied}/${files.length}`);
  }
  console.log(`Done: copied ${copied}, already up to date ${skipped} → ${DEST}`);
}

main().catch((err) => {
  console.error(`vendor-input-json: ${err.message}`);
  process.exit(1);
});
