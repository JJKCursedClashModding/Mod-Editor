const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// APP_DIR is the read-only app bundle (resources/app in a packaged build,
// which lives inside app.asar and cannot be written to). Writable state
// (config.json, projects/, caches) must live in userData when packaged.
const APP_DIR = path.join(__dirname, "..");

function getElectronApp() {
  try {
    // In the main process this is the real app object. In plain node
    // (tests/scripts) require("electron") is a path string, so guard hard.
    const electron = require("electron");
    const app = electron && electron.app;
    if (app && typeof app.getPath === "function") return app;
    return null;
  } catch {
    return null;
  }
}

function isPackaged() {
  try {
    const app = getElectronApp();
    return !!(app && app.isPackaged);
  } catch {
    return false;
  }
}

function userDataDir() {
  try {
    const app = getElectronApp();
    if (app && app.isPackaged) return app.getPath("userData");
  } catch {
    /* getPath throws before app is ready — fall through */
  }
  return null;
}

function resolveConfigPath() {
  const userData = userDataDir();
  if (userData) return path.join(userData, "config.json");
  return path.join(APP_DIR, "config.json");
}

function resolveDefaultProjectsDir() {
  const userData = userDataDir();
  if (userData) return path.join(userData, "projects");
  return path.join(APP_DIR, "projects");
}

function defaultConfig() {
  // No machine-specific defaults: fresh installs start empty and the user
  // picks directories in Settings (existing config.json values survive via
  // the merge in load()). The Steam Mods path is the standard install
  // location, so it stays as an exists-checked default.
  const steamMods =
    "C:/Program Files (x86)/Steam/steamapps/common/Jujutsu Kaisen CC/Jujutsu Kaisen CC/Content/Mods";
  const steamDataTables =
    "C:/Program Files (x86)/Steam/steamapps/common/Jujutsu Kaisen CC/Jujutsu Kaisen CC/Content/DataTables";
  return {
    editorRoot: "",
    modsDir: fs.existsSync(steamMods) ? steamMods : "",
    liveTestDir: fs.existsSync(steamDataTables) ? steamDataTables : "",
    liveTestEnabled: false,
    modManagerDir: "",
    projectsDir: resolveDefaultProjectsDir(),
    bakeParameterAssets: true,
    autoExport: false,
    backupOnExport: true,
    backupsKept: 5,
    autoSnapshotOnExport: true,
    snapshotKeep: 5,
    lastProject: null,
  };
}

// A projectsDir pointing inside the app bundle (or inside app.asar) is a
// leftover from before writable state moved to userData, or from a dev
// config.json copied onto another machine. It is read-only and makes
// projects.list() throw ENOTDIR on startup — reset it to the writable default.
function sanitize(cfg) {
  if (!cfg || typeof cfg !== "object") return cfg;
  if ("inputJsonDir" in cfg) delete cfg.inputJsonDir;
  try {
    if (isPackaged()) {
      const pd = typeof cfg.projectsDir === "string" ? cfg.projectsDir : "";
      const norm = pd.replace(/\//g, "\\").toLowerCase();
      const appNorm = APP_DIR.replace(/\//g, "\\").toLowerCase();
      const bad =
        !pd ||
        norm.includes("app.asar") ||
        (appNorm && (norm === appNorm || norm.startsWith(`${appNorm}\\`)));
      if (bad) cfg.projectsDir = resolveDefaultProjectsDir();
    }
  } catch {
    /* never break startup on sanitizing */
  }
  return cfg;
}

let cache = null;

function load() {
  const primary = resolveConfigPath();
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(primary, "utf8"));
  } catch {
    raw = null;
  }
  // Migrate: a packaged install never shipped a config.json, but pick up
  // user values from a legacy bundle-side config if one exists.
  if (!raw && isPackaged()) {
    try {
      const legacy = path.join(APP_DIR, "config.json");
      if (path.resolve(legacy) !== path.resolve(primary)) {
        raw = JSON.parse(fs.readFileSync(legacy, "utf8"));
      }
    } catch {
      raw = null;
    }
  }
  cache = sanitize({ ...defaultConfig(), ...(raw && typeof raw === "object" ? raw : {}) });
  return cache;
}

function get() {
  if (!cache) return { ...load() };
  // Re-sanitize on every read so a stale in-memory value (or a config
  // written before this fix) can never point startup at app.asar again.
  // resolveDefaultProjectsDir() is cheap; userData is stable after ready.
  try {
    const fixed = sanitize({ ...cache });
    if (fixed.projectsDir !== cache.projectsDir) cache = fixed;
  } catch {
    /* ignore */
  }
  return { ...cache };
}

async function save(patch) {
  const { inputJsonDir, ...clean } = patch || {};
  cache = sanitize({ ...get(), ...clean });
  const target = resolveConfigPath();
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, `${JSON.stringify(cache, null, 2)}\n`);
  // Changing source dirs invalidates schema caches.
  try {
    require("./schema").refresh();
  } catch {
    /* schema may not be loaded yet */
  }
  return { ...cache };
}

module.exports = {
  APP_DIR,
  getConfigPath: resolveConfigPath,
  getDefaultProjectsDir: resolveDefaultProjectsDir,
  isPackaged,
  get,
  save,
  load,
  defaultConfig,
};
// Back-compat: CONFIG_PATH was a static string. Keep it readable but always
// resolve dynamically so packaged builds write to userData, not app.asar.
Object.defineProperty(module.exports, "CONFIG_PATH", {
  enumerable: true,
  get: resolveConfigPath,
});
