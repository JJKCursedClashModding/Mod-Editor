// Atomic file writes: write to a temp file in the same directory, then
// rename over the target so a crash/power loss never leaves a half-written
// JSON (project, preset, snapshot, cache, receipt) behind.
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

function tmpPathFor(target) {
  const dir = path.dirname(target);
  const base = path.basename(target);
  const uniq = `${process.pid}.${Date.now().toString(36)}.${Math.floor(Math.random() * 1e9).toString(36)}`;
  return path.join(dir, `.tmp-${uniq}-${base}`);
}

// Async atomic write. Mirrors fsp.writeFile(target, data, options) but crash-safe.
async function writeFileAtomic(target, data, options) {
  const abs = String(target);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  const tmp = tmpPathFor(abs);
  try {
    await fsp.writeFile(tmp, data, options);
    await fsp.rename(tmp, abs);
  } catch (err) {
    try {
      await fsp.unlink(tmp);
    } catch {
      /* best effort cleanup */
    }
    throw err;
  }
}

// Sync atomic write for best-effort cache files on the hot path.
function writeFileAtomicSync(target, data, options) {
  const abs = String(target);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = tmpPathFor(abs);
  try {
    fs.writeFileSync(tmp, data, options);
    fs.renameSync(tmp, abs);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* best effort cleanup */
    }
    throw err;
  }
}

module.exports = { writeFileAtomic, writeFileAtomicSync };
