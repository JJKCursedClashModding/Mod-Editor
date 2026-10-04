// Project storage: one JSON file per project under <projectsDir>/<name>.json,
// plus shared presets and the user-editable field-docs.json.
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const config = require("./config");

function projectsDir() {
  return config.get().projectsDir;
}

function sanitizeFile(name) {
  const s = String(name || "")
    .replace(/[<>:\"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return s.slice(0, 120) || "Untitled";
}

function projectPath(name) {
  return path.join(projectsDir(), `${sanitizeFile(name)}.json`);
}

function blankProject(name) {
  const now = Date.now();
  return {
    version: 1,
    name: sanitizeFile(name),
    manifest: {
      title: sanitizeFile(name),
      description: "",
      version: "1.0.0",
      priority: 0,
      icon: "",
    },
    tables: {},
    parameters: {},
    assets: [],
    registryRows: [],
    changelog: [{ ts: now, msg: "Project created" }],
  };
}

function blankParamState() {
  return { rows: {}, comment: "" };
}

async function ensureDir() {
  await fsp.mkdir(projectsDir(), { recursive: true });
  await fsp.mkdir(path.join(projectsDir(), "presets"), { recursive: true });
}

async function list() {
  await ensureDir();
  const entries = await fsp.readdir(projectsDir(), { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith(".json")) continue;
    if (e.name.startsWith(".") || e.name === "field-docs.json") continue;
    try {
      const raw = JSON.parse(await fsp.readFile(path.join(projectsDir(), e.name), "utf8"));
      if (raw && typeof raw === "object" && raw.manifest) {
        out.push({
          name: raw.name || path.basename(e.name, ".json"),
          title: raw.manifest.title || raw.name,
          version: raw.manifest.version,
          updated: raw.changelog && raw.changelog.length
            ? raw.changelog[raw.changelog.length - 1].ts
            : 0,
        });
      }
    } catch {
      /* skip unreadable */
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function load(name) {
  const raw = JSON.parse(await fsp.readFile(projectPath(name), "utf8"));
  if (!raw || typeof raw !== "object") throw new Error(`Bad project file: ${name}`);
  raw.tables = raw.tables || {};
  raw.parameters = raw.parameters || {};
  raw.assets = Array.isArray(raw.assets) ? raw.assets : [];
  raw.registryRows = Array.isArray(raw.registryRows) ? raw.registryRows : [];
  raw.changelog = Array.isArray(raw.changelog) ? raw.changelog : [];
  raw.manifest = raw.manifest && typeof raw.manifest === "object" ? raw.manifest : { title: name };
  return raw;
}

async function save(project, msg) {
  await ensureDir();
  if (msg) {
    project.changelog = project.changelog || [];
    project.changelog.push({ ts: Date.now(), msg });
    if (project.changelog.length > 300) {
      project.changelog = project.changelog.slice(-300);
    }
  }
  await fsp.writeFile(projectPath(project.name), `${JSON.stringify(project, null, 2)}\n`);
  return project;
}

async function create(name) {
  await ensureDir();
  const p = projectPath(name);
  try {
    await fsp.stat(p);
    throw new Error(`Project "${sanitizeFile(name)}" already exists`);
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
  }
  const project = blankProject(name);
  await save(project);
  return project;
}

async function duplicate(name, newName) {
  const src = await load(name);
  const copy = JSON.parse(JSON.stringify(src));
  copy.name = sanitizeFile(newName);
  copy.manifest = { ...copy.manifest, title: sanitizeFile(newName) };
  copy.changelog = [{ ts: Date.now(), msg: `Duplicated from ${src.name}` }];
  await save(copy);
  return copy;
}

async function remove(name) {
  await fsp.unlink(projectPath(name));
}

async function rename(name, newName) {
  const src = await load(name);
  const clean = sanitizeFile(newName);
  if (clean === src.name) return src;
  try {
    await fsp.stat(projectPath(clean));
    throw new Error(`Project "${clean}" already exists`);
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
  }
  src.name = clean;
  await save(src);
  await fsp.unlink(projectPath(name));
  return src;
}

// ---- presets (named global-rule bundles) ----

function presetPath(name) {
  return path.join(projectsDir(), "presets", `${sanitizeFile(name)}.json`);
}

async function listPresets() {
  await ensureDir();
  const dir = path.join(projectsDir(), "presets");
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await fsp.readFile(path.join(dir, e.name), "utf8"));
      out.push({
        name: path.basename(e.name, ".json"),
        table: raw.table || "",
        ruleCount: Array.isArray(raw.rules) ? raw.rules.length : 0,
        updated: raw.exportedAt || 0,
      });
    } catch {
      /* skip */
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function savePreset(name, table, rules) {
  await ensureDir();
  const preset = { name: sanitizeFile(name), table, rules, exportedAt: Date.now() };
  await fsp.writeFile(presetPath(name), `${JSON.stringify(preset, null, 2)}\n`);
  return preset;
}

async function loadPreset(name) {
  return JSON.parse(await fsp.readFile(presetPath(name), "utf8"));
}

async function deletePreset(name) {
  await fsp.unlink(presetPath(name));
}

// ---- snapshots (manual commits + limited rotating autosaves) ----
function snapshotsDir() {
  return path.join(projectsDir(), "snapshots");
}

function snapBase(name) {
  return sanitizeFile(name);
}

async function createSnapshot(name, label) {
  await ensureDir();
  const project = await load(name);
  await fsp.mkdir(snapshotsDir(), { recursive: true });
  const labelPart = label && String(label).trim() ? `__${sanitizeFile(label)}` : "";
  const file = `${snapBase(name)}__manual__${Date.now()}${labelPart}.json`;
  await fsp.writeFile(path.join(snapshotsDir(), file), JSON.stringify(project, null, 2));
  return { file, ts: Date.now(), label: label || "" };
}

async function autoSnapshot(name, keep) {
  await ensureDir();
  const project = await load(name);
  await fsp.mkdir(snapshotsDir(), { recursive: true });
  const file = `${snapBase(name)}__auto__${Date.now()}.json`;
  await fsp.writeFile(path.join(snapshotsDir(), file), JSON.stringify(project, null, 2));
  const keepN = Math.max(1, keep || 5);
  const all = await listSnapshots(name);
  const autos = all.filter((s) => s.kind === "auto").sort((a, b) => b.ts - a.ts);
  for (const old of autos.slice(keepN)) {
    try {
      await fsp.unlink(path.join(snapshotsDir(), old.file));
    } catch {
      /* ignore */
    }
  }
  return { file };
}

async function listSnapshots(name) {
  const base = snapBase(name);
  let entries = [];
  try {
    entries = await fsp.readdir(snapshotsDir());
  } catch {
    return [];
  }
  const out = [];
  for (const f of entries) {
    const m = f.match(/^(.*)__(manual|auto)__(\d+)(?:__(.*))?\.json$/);
    if (!m || m[1] !== base) continue;
    out.push({ file: f, kind: m[2], ts: Number(m[3]), label: (m[4] || "").replace(/_/g, " ") });
  }
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

async function readSnapshot(name, file) {
  const base = snapBase(name);
  if (!path.basename(file).startsWith(`${base}__`)) throw new Error("Bad snapshot file");
  const raw = JSON.parse(await fsp.readFile(path.join(snapshotsDir(), path.basename(file)), "utf8"));
  if (!raw || typeof raw !== "object" || !raw.manifest) throw new Error("Bad snapshot data");
  return raw;
}

async function deleteSnapshot(name, file) {
  const base = snapBase(name);
  if (!path.basename(file).startsWith(`${base}__`)) throw new Error("Bad snapshot file");
  await fsp.unlink(path.join(snapshotsDir(), path.basename(file)));
}

module.exports = {
  sanitizeFile,
  blankTableState: null,
  blankProject,
  blankParamState,
  list,
  load,
  save,
  create,
  duplicate,
  remove,
  rename,
  listPresets,
  savePreset,
  loadPreset,
  deletePreset,
  createSnapshot,
  autoSnapshot,
  listSnapshots,
  readSnapshot,
  deleteSnapshot,
};
