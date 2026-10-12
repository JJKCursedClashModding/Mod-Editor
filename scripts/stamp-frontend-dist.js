// Stamp frontend/dist with build provenance so any running app (and any
// screenshot of Help > About) identifies exactly which commit built it.
//
// Writes frontend/dist/build-info.json: { commit, builtAt, source }.
// main.js exposes it via state:init; both UIs show it in Help > About.
//
// Usage: node scripts/stamp-frontend-dist.js [source-label]
// (prestart-frontend.js and beta.yml call this after `vite build` — never
// before, since vite empties dist/ on each build.)
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const APP_DIR = path.join(__dirname, "..");

function stamp(source) {
  const dist = path.join(APP_DIR, "frontend", "dist");
  if (!fs.existsSync(path.join(dist, "index.html"))) {
    throw new Error(`frontend/dist is not built (no index.html under ${dist})`);
  }
  let commit = "unknown";
  let dirty = null;
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: APP_DIR, encoding: "utf8" }).trim() || "unknown";
  } catch {
    /* non-git checkout: stays "unknown" */
  }
  try {
    dirty = execFileSync("git", ["status", "--porcelain"], { cwd: APP_DIR, encoding: "utf8" }).trim().length > 0;
  } catch {
    /* leave null when git cannot tell */
  }
  const info = { commit, dirty, builtAt: new Date().toISOString(), source: source || "manual" };
  fs.writeFileSync(path.join(dist, "build-info.json"), `${JSON.stringify(info, null, 2)}\n`);
  console.log(`[stamp] frontend/dist <- ${commit} @ ${info.builtAt} (${info.source})`);
  return info;
}

if (require.main === module) {
  try {
    stamp(process.argv[2]);
  } catch (err) {
    console.error(`[stamp] FAILED: ${err && err.message ? err.message : err}`);
    process.exit(1);
  }
}

module.exports = { stamp };
