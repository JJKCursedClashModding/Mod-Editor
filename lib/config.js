const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const APP_DIR = path.join(__dirname, "..");
const CONFIG_PATH = path.join(APP_DIR, "config.json");

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
    projectsDir: path.join(APP_DIR, 'projects'),
    bakeParameterAssets: true,
    autoExport: false,
    backupOnExport: true,
    backupsKept: 5,
    autoSnapshotOnExport: true,
    snapshotKeep: 5,
    lastProject: null,
  };
}

let cache = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    cache = { ...defaultConfig(), ...(raw && typeof raw === "object" ? raw : {}) };
  } catch {
    cache = defaultConfig();
  }
  // inputJsonDir was removed: tables are hardcoded to data/input_json/.
  if (cache && "inputJsonDir" in cache) delete cache.inputJsonDir;
  return cache;
}

function get() {
  return cache ? { ...cache } : { ...load() };
}

async function save(patch) {
  const { inputJsonDir, ...clean } = patch || {};
  cache = { ...get(), ...clean };
  if (cache && "inputJsonDir" in cache) delete cache.inputJsonDir;
  await fsp.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fsp.writeFile(CONFIG_PATH, `${JSON.stringify(cache, null, 2)}\n`);
  // Changing source dirs invalidates schema caches.
  try {
    require("./schema").refresh();
  } catch {
    /* schema may not be loaded yet */
  }
  return { ...cache };
}

module.exports = { APP_DIR, CONFIG_PATH, get, save, load, defaultConfig };
