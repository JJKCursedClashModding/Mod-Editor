// prestart for `npm start`: guarantee frontend/dist matches frontend/src.
//
// - One-time `npm --prefix frontend install` when frontend/node_modules is
//   missing (fresh clone), so `npm install && npm start` just works.
// - Always runs the production build (tsc + vite), so Electron never loads
//   a stale bundle. Any failure aborts before Electron launches.
//
// Usage: npm start  (runs automatically as the `prestart` script)
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const APP_DIR = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(APP_DIR, "frontend");

// Single command string (never an args array) so Node does not emit DEP0190
// and no argument splitting can occur. All commands here are hardcoded.
function run(cmd) {
  const r = spawnSync(cmd, { cwd: APP_DIR, stdio: "inherit", shell: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`'${cmd}' exited with code ${r.status}`);
}

function main() {
  const viteBin = path.join(FRONTEND_DIR, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
  if (!fs.existsSync(viteBin)) {
    console.log("[prestart] frontend dependencies missing — installing once (npm --prefix frontend install)...");
    run("npm --prefix frontend install --no-audit --no-fund");
  }
  console.log("[prestart] building frontend (tsc + vite)...");
  run("npm --prefix frontend run build");
  require("./stamp-frontend-dist").stamp("npm-start-prestart");
  const indexHtml = path.join(FRONTEND_DIR, "dist", "index.html");
  if (!fs.existsSync(indexHtml)) {
    throw new Error(`frontend build finished but ${indexHtml} is missing`);
  }
  console.log("[prestart] frontend/dist is fresh.");
}

try {
  main();
} catch (err) {
  console.error(`[prestart] FAILED: ${err && err.message ? err.message : err}`);
  process.exit(1);
}
