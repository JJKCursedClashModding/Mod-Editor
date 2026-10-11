// Marks every vendored vanilla datatable JSON read-only so the originals
// can't be edited by accident (all edits live in projects/*.json, and the
// "Open original JSON" menu opens these reference files).
//
// Usage: npm run protect:input-json [-- --undo]
//   --undo restores writability (e.g. before re-vendoring by hand).
const fsp = require("fs/promises");
const path = require("path");

const DIR = path.join(__dirname, "..", "data", "input_json");
const READ_ONLY = 0o444;
const WRITABLE = 0o666;

async function main() {
  const undo = process.argv.includes("--undo");
  const mode = undo ? WRITABLE : READ_ONLY;
  const files = (await fsp.readdir(DIR)).filter((f) => f.toLowerCase().endsWith(".json"));
  if (files.length === 0) throw new Error(`No .json files in ${DIR}`);
  let changed = 0;
  for (const f of files) {
    try {
      await fsp.chmod(path.join(DIR, f), mode);
      changed++;
    } catch (err) {
      console.error(`  skip ${f}: ${err.message}`);
    }
  }
  console.log(`${undo ? "Writable" : "Read-only"}: ${changed}/${files.length} files in ${DIR}`);
}

main().catch((err) => {
  console.error(`protect-input-json: ${err.message}`);
  process.exit(1);
});
