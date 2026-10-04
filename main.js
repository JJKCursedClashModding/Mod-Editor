const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

app.setName("JJK Mod Editor");
app.disableHardwareAcceleration();

const config = require("./lib/config");
const schema = require("./lib/schema");
const engine = require("./lib/engine");
const projects = require("./lib/projects");
const exportMod = require("./lib/exportMod");
const patcher = require("./lib/patcher");
const paramVanilla = require("./lib/paramVanilla");
const characters = require("./lib/characters");
const refs = require("./lib/refs");

let mainWin = null;
let currentProject = null;

function createWindow() {
  const win = new BrowserWindow({
    title: "JJK Mod Editor",
    width: 1560,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0c0e15",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWin = win;
  win.on("closed", () => {
    if (mainWin === win) mainWin = null;
  });
  // Keep the Open/Recent project submenus fresh.
  win.on("focus", () => {
    refreshAppMenu();
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function ok(data) {
  return { ok: true, data };
}

function fail(err) {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

function sendMenu(action, payload) {
  try {
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("menu:action", action, payload === undefined ? null : payload);
  } catch {
    /* ignore */
  }
}

// ---- recent projects (for the Project > Recent Projects submenu) ----
const MAX_RECENTS = 8;
async function touchRecent(name) {
  if (!name) return;
  try {
    const cfg = config.get();
    const list = [name, ...((cfg.recentProjects || []).filter((n) => n !== name))].slice(0, MAX_RECENTS);
    await config.save({ recentProjects: list });
  } catch {
    /* best effort */
  }
}
async function dropRecent(name) {
  try {
    const cfg = config.get();
    if (!(cfg.recentProjects || []).includes(name)) return;
    await config.save({ recentProjects: (cfg.recentProjects || []).filter((n) => n !== name) });
  } catch {
    /* best effort */
  }
}

// ---- dynamic menu data (project list for Open/Recent submenus) ----
let menuProjects = [];
function recentProjectMenuItems() {
  const recents = (config.get().recentProjects || []).filter((n) => menuProjects.some((p) => p.name === n));
  if (!recents.length) return [{ label: "(empty)", enabled: false }];
  return recents.map((n) => {
    const p = menuProjects.find((x) => x.name === n);
    return {
      label: (p && (p.title || p.name)) || n,
      type: "radio",
      checked: n === currentProject,
      click: () => sendMenu("project:open-name", n),
    };
  });
}
async function refreshAppMenu() {
  try {
    menuProjects = await projects.list();
  } catch {
    menuProjects = [];
  }
  try {
    Menu.setApplicationMenu(buildMenu());
  } catch {
    /* ignore */
  }
}

function buildMenu() {
  const template = [
    {
      label: "&File",
      submenu: [
        { label: "New Project…", accelerator: "Ctrl+N", click: () => sendMenu("project:new") },
        { label: "Open Project…", accelerator: "Ctrl+O", click: () => sendMenu("project:open-modal") },
        { label: "Recent Projects", submenu: recentProjectMenuItems() },
        { type: "separator" },
        { label: "Duplicate Project…", click: () => sendMenu("project:duplicate") },
        { label: "Rename Project…", click: () => sendMenu("project:rename") },
        { label: "Delete Project…", click: () => sendMenu("project:delete") },
        { label: "Open Project Folder", click: () => sendMenu("project:reveal") },
        { type: "separator" },
        { label: "Import Mod…", click: () => sendMenu("file:import") },
        { type: "separator" },
        { label: "Export to Mods Folder", accelerator: "Ctrl+E", click: () => sendMenu("file:export-folder") },
        { label: "Export .jjkmod…", accelerator: "Ctrl+Shift+E", click: () => sendMenu("file:export-jjkmod") },
        { label: "Test Patch…", accelerator: "Ctrl+T", click: () => sendMenu("file:test-patch") },
        { type: "separator" },
        { label: "Settings…", accelerator: "Ctrl+," , click: () => sendMenu("file:settings") },
        { type: "separator" },
        { role: "quit", label: "E&xit" },
      ],
    },
    {
      label: "&Edit",
      submenu: [
        { label: "Undo", accelerator: "Ctrl+Z", click: () => sendMenu("edit:undo") },
        { label: "Redo", accelerator: "Ctrl+Shift+Z", click: () => sendMenu("edit:redo") },
        { type: "separator" },
        { label: "Global Search…", accelerator: "Ctrl+F", click: () => sendMenu("edit:search") },
        { label: "Text Find / Replace…", accelerator: "Ctrl+H", click: () => sendMenu("edit:text-tools") },
        { type: "separator" },
        { role: "selectAll", label: "Select All" },
      ],
    },
    {
      label: "&View",
      submenu: [
        { label: "Tables", click: () => sendMenu("view:tables") },
        { label: "Parameters", click: () => sendMenu("view:params") },
        { type: "separator" },
        { label: "Manage Characters…", click: () => sendMenu("view:characters") },
        { label: "Clear Character Filter", click: () => sendMenu("view:char-clear") },
        { type: "separator" },
        { label: "Close Current Tab", accelerator: "Ctrl+W", click: () => sendMenu("view:close-tab") },
        { label: "Close Other Tabs", click: () => sendMenu("view:close-others") },
      ],
    },
    {
      label: "&Project",
      submenu: [
        { label: "Project Changes…", click: () => sendMenu("project:changes") },
        { label: "Validate Project", accelerator: "Ctrl+Shift+V", click: () => sendMenu("project:validate") },
        { type: "separator" },
        { label: "Snapshots…", accelerator: "Ctrl+S", click: () => sendMenu("project:snapshots") },
        { label: "Conflicts…", click: () => sendMenu("project:conflicts") },
        { type: "separator" },
        { label: "Character Checklist…", click: () => sendMenu("project:checklist") },
        { label: "Character Moveset…", click: () => sendMenu("project:moveset") },
      ],
    },
    {
      label: "&Mod",
      submenu: [
        { label: "Edit Manifest / Assets…", click: () => sendMenu("mod:edit") },
        { label: "Export Preview…", click: () => sendMenu("mod:preview") },
      ],
    },
    {
      label: "&Help",
      submenu: [
        { label: "About JJK Mod Editor", click: () => sendMenu("help:about") },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

function enums() {
  return schema.parseEnumsTs();
}

async function requireProject() {
  if (!currentProject) throw new Error("No project open");
  return projects.load(currentProject);
}

// ---- session undo history (before-images pushed on every persist) ----
const history = {};
const MAX_UNDO = 30;
const MAX_HISTORY_BYTES = 25 * 1024 * 1024;

function hist(name) {
  if (!history[name]) history[name] = { undo: [], redo: [] };
  return history[name];
}

function historyState(name) {
  const h = hist(name);
  return { canUndo: h.undo.length > 0, canRedo: h.redo.length > 0, undoDepth: h.undo.length };
}

function pushUndo(name, before) {
  const h = hist(name);
  const raw = JSON.stringify(before);
  h.undo.push({ ts: Date.now(), data: before, bytes: raw.length });
  h.redo = [];
  let bytes = h.undo.reduce((n, e) => n + e.bytes, 0);
  while ((h.undo.length > MAX_UNDO || bytes > MAX_HISTORY_BYTES) && h.undo.length > 0) {
    bytes -= h.undo[0].bytes;
    h.undo.shift();
  }
}

async function persist(project, msg, opts) {
  const o = opts || {};
  if (!o.skipHistory) {
    try {
      const before = await projects.load(project.name);
      pushUndo(project.name, before);
    } catch {
      /* new project: nothing to undo to */
    }
  }
  await projects.save(project, msg);
  refs.clearMemo();
  if (!o.skipAuto) scheduleAutoExport(project.name);
}

// ---- auto-export to Mods folder (debounced, serialized) ----
let autoTimer = null;
let autoRunning = false;
let autoQueued = null;

function scheduleAutoExport(name) {
  if (!config.get().autoExport) return;
  autoQueued = name;
  if (autoTimer || autoRunning) return;
  autoTimer = setTimeout(() => {
    autoTimer = null;
    runAutoExport().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[auto-export]", err);
    });
  }, 2500);
}

function notifyAutoExport(payload) {
  try {
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("auto-export-done", payload);
  } catch {
    /* ignore */
  }
}

function exportOptsFromConfig() {
  const cfg = config.get();
  return {
    bake: cfg.bakeParameterAssets !== false,
    backup: cfg.backupOnExport !== false,
    backupsKept: cfg.backupsKept || 5,
  };
}

async function runAutoExport() {
  if (autoRunning) return;
  const cfg = config.get();
  if (!cfg.autoExport) {
    autoQueued = null;
    return;
  }
  autoRunning = true;
  try {
    while (autoQueued) {
      const name = autoQueued;
      autoQueued = null;
      if (!cfg.modsDir) {
        notifyAutoExport({ ok: false, error: "Auto-export: no Mods folder configured" });
        continue;
      }
      try {
        const project = await projects.load(name);
        const before = JSON.stringify(project);
        const res = await exportMod.exportToModsFolder(project, enums(), cfg.modsDir, exportOptsFromConfig());
        // Log the export only if nobody edited meanwhile (avoid clobbering).
        try {
          const cur = await projects.load(name);
          if (JSON.stringify(cur) === before) {
            project.changelog = project.changelog || [];
            project.changelog.push({ ts: Date.now(), msg: `Auto-exported to Mods folder (${res.files.length} files)` });
            await projects.save(project);
          }
        } catch {
          /* ignore */
        }
        notifyAutoExport({ ok: true, path: res.path, files: res.files.length, backupPath: res.backupPath || null });
      } catch (err) {
        notifyAutoExport({ ok: false, error: `Auto-export failed: ${err.message}` });
      }
    }
  } finally {
    autoRunning = false;
  }
}

function tableChangedCounts(project) {
  const counts = {};
  for (const [file, st] of Object.entries(project.tables || {})) {
    const rules = (st.globalRules || []).length;
    const ov = Object.keys(st.overrides || {}).length;
    const nw = Object.keys(st.newRows || {}).length;
    if (rules > 0 || ov > 0 || nw > 0) counts[file] = { rules, overrides: ov, newRows: nw };
  }
  return counts;
}

function registerIpc() {
  ipcMain.handle("state:init", async () => {
    const cfg = config.get();
    const list = await projects.list();
    if (cfg.lastProject) {
      try {
        await projects.load(cfg.lastProject);
        currentProject = cfg.lastProject;
      } catch {
        currentProject = null;
      }
    }
    if (!currentProject && list.length > 0) currentProject = list[0].name;
    const project = currentProject ? await projects.load(currentProject) : null;
    let tables = [];
    let tablesError = null;
    try {
      tables = schema.listTables();
    } catch (err) {
      tablesError = err.message;
    }
    return ok({
      config: cfg,
      projects: list,
      currentProject,
      project,
      tables,
      tablesError,
      changed: project ? tableChangedCounts(project) : {},
      enums: enums().order,
      chars: schema.getChars(),
      paramAssets: schema.BP_PARAMETER_ASSETS,
      ruleOps: engine.RULE_OPS,
      condOps: engine.COND_OPS,
    });
  });

  ipcMain.handle("settings:save", async (_, patch) => ok(await config.save(patch || {})));

  ipcMain.handle("dialog:pick-dir", async (_, title) => {
    const r = await dialog.showOpenDialog({ title: title || "Pick folder", properties: ["openDirectory"] });
    return ok(r.canceled ? null : r.filePaths[0]);
  });

  ipcMain.handle("dialog:pick-file", async (_, opts) => {
    const r = await dialog.showOpenDialog({
      title: (opts && opts.title) || "Pick file",
      properties: ["openFile"],
      filters: (opts && opts.filters) || [{ name: "All", extensions: ["*"] }],
    });
    return ok(r.canceled ? null : r.filePaths[0]);
  });

  ipcMain.handle("dialog:save-file", async (_, opts) => {
    const r = await dialog.showSaveDialog({
      title: (opts && opts.title) || "Save",
      defaultPath: (opts && opts.defaultPath) || "",
      filters: (opts && opts.filters) || [{ name: "All", extensions: ["*"] }],
    });
    return ok(r.canceled ? null : r.filePath);
  });

  // ---- projects ----
  ipcMain.handle("project:list", async () => ok(await projects.list()));
  ipcMain.handle("config:get", async () => ok(config.get()));
  ipcMain.handle("project:open", async (_, name) => {
    currentProject = name;
    await config.save({ lastProject: name });
    await touchRecent(name);
    const project = await projects.load(name);
    refreshAppMenu();
    return ok({ project, changed: tableChangedCounts(project) });
  });
  ipcMain.handle("project:create", async (_, name) => {
    const project = await projects.create(name);
    currentProject = project.name;
    await config.save({ lastProject: project.name });
    await touchRecent(project.name);
    refreshAppMenu();
    return ok({ project, projects: await projects.list() });
  });
  ipcMain.handle("project:duplicate", async (_, name, newName) => {
    const project = await projects.duplicate(name, newName);
    await touchRecent(project.name);
    refreshAppMenu();
    return ok({ project, projects: await projects.list() });
  });
  ipcMain.handle("project:delete", async (_, name) => {
    await projects.remove(name);
    delete history[name];
    await dropRecent(name);
    if (currentProject === name) {
      currentProject = null;
      await config.save({ lastProject: null });
    }
    refreshAppMenu();
    return ok({ projects: await projects.list(), currentProject });
  });
  ipcMain.handle("project:rename", async (_, name, newName) => {
    const project = await projects.rename(name, newName);
    if (history[name]) {
      history[project.name] = history[name];
      delete history[name];
    }
    if (currentProject === name) {
      currentProject = project.name;
      await config.save({ lastProject: project.name });
    }
    await dropRecent(name);
    await touchRecent(project.name);
    refreshAppMenu();
    return ok({ project, projects: await projects.list() });
  });
  ipcMain.handle("project:reveal", async () => {
    const p = await requireProject();
    const dir = path.dirname(path.join(config.get().projectsDir, `${p.name}.json`));
    shell.openPath(dir);
    return ok(true);
  });

  // ---- tables ----
  ipcMain.handle("tables:list", async () => {
    const project = await requireProject();
    return ok({ tables: schema.listTables(), changed: tableChangedCounts(project) });
  });

  // ---- character registry ----
  ipcMain.handle("chars:list", async () => {
    const index = await schema.buildPrefixIndex(async () => {
      await new Promise((r) => setImmediate(r));
    });
    const map = characters.getMap();
    const custom = characters.loadCustom();
    const vanilla = characters.parseVanilla(config.get().editorRoot);
    const found = new Set(Object.keys(map));
    for (const counts of Object.values(index)) {
      for (const p of Object.keys(counts)) found.add(p);
    }
    const chars = [...found].sort().map((prefix) => {
      let tables = 0;
      let rows = 0;
      for (const t of schema.listTables()) {
        const n = index[t.file] && index[t.file][prefix];
        if (n) {
          tables++;
          rows += n;
        }
      }
      return {
        prefix,
        name: map[prefix] || prefix,
        source: custom[prefix] !== undefined ? "custom" : vanilla[prefix] !== undefined ? "vanilla" : "found",
        tables,
        rows,
      };
    });
    return ok({ chars });
  });

  ipcMain.handle("chars:set", async (_, prefix, name) => {
    const id = characters.validateId(prefix);
    if (!name || !String(name).trim()) throw new Error("Name is required");
    const custom = characters.loadCustom();
    custom[id] = String(name).trim().slice(0, 60);
    await characters.saveCustom(custom);
    return ok({ chars: characters.getMap() });
  });

  ipcMain.handle("chars:delete", async (_, prefix) => {
    const id = characters.validateId(prefix);
    const custom = characters.loadCustom();
    if (custom[id] === undefined) throw new Error(`${id} is not a custom entry`);
    delete custom[id];
    await characters.saveCustom(custom);
    return ok({ chars: characters.getMap() });
  });

  ipcMain.handle("tables:prefix-index", async () => {
    const index = await schema.buildPrefixIndex(async () => {
      await new Promise((r) => setImmediate(r));
    });
    return ok({ index });
  });

  ipcMain.handle("table:schema", async (_, file) => {
    const s = schema.inferSchema(file);
    const entry = schema.getTableEntry(file);
    const docs = schema.getTableDocs(entry ? entry.base : file, entry ? entry.family : file);
    const docCount = Object.keys(docs.fields).length;
    return ok({ schema: s, docs: { tableDesc: docs.tableDesc, wikiFile: docs.wikiFile, docCount } });
  });

  ipcMain.handle("table:rows", async (_, file, opts) => {
    const project = await requireProject();
    const { rows: vanilla } = schema.readInputTable(file);
    const tableSchema = schema.inferSchema(file);
    const st = exportMod.getTableState(project, file);
    const o = opts || {};
    const prefix = o.charPrefix || "";
    const search = (o.search || "").toLowerCase();
    const summaries = [];
    const allIds = [...Object.keys(vanilla), ...Object.keys(st.newRows || {})];
    for (const id of allIds) {
      if (prefix && !id.startsWith(prefix)) continue;
      if (search && !id.toLowerCase().includes(search)) continue;
      if (st.newRows[id]) {
        const ruleHits = 0;
        summaries.push({ id, status: "new", changeCount: Object.keys(st.newRows[id].fields || {}).length, global: false, overrides: 0, base: st.newRows[id]._base || null });
        continue;
      }
      const vrow = vanilla[id];
      if (!vrow) continue;
      let status = "default";
      let changeCount = 0;
      let global = false;
      const ov = (st.overrides || {})[id];
      const ovCount = ov ? Object.keys(ov).length : 0;
      if (st.globalRules.length > 0) {
        try {
          const eff = engine.applyTableStateToRow(vrow, { globalRules: st.globalRules, overrides: {} }, tableSchema, enums());
          const d = engine.diffFields(vrow, eff.row);
          if (Object.keys(d).length > 0) {
            global = true;
            status = "edited";
            changeCount += Object.keys(d).length;
          }
        } catch {
          /* rule errors surface in row:get */
        }
      }
      if (ovCount > 0) {
        status = "edited";
        changeCount += ovCount;
      }
      summaries.push({ id, status, changeCount, global, overrides: ovCount, base: null });
    }
    summaries.sort((a, b) => a.id.localeCompare(b.id));
    const offset = Math.max(0, o.offset || 0);
    const limit = Math.min(2000, Math.max(50, o.limit || 400));
    return ok({ total: summaries.length, rows: summaries.slice(offset, offset + limit) });
  });

  ipcMain.handle("row:get", async (_, file, rowId) => {
    const project = await requireProject();
    const { rows: vanilla } = schema.readInputTable(file);
    const tableSchema = schema.inferSchema(file);
    const st = exportMod.getTableState(project, file);
    const entry = schema.getTableEntry(file);
    const en = enums();
    if (st.newRows[rowId]) {
      const nr = st.newRows[rowId];
      const base = nr._base ? exportMod.findRowInFamily(file, nr._base) || {} : {};
      const effective = engine.applyNewRow(base, nr, tableSchema, en);
      if (tableSchema.fields.ID && effective.ID === undefined) effective.ID = rowId;
      return ok({
        isNew: true,
        base: nr._base || null,
        vanilla: null,
        effective,
        prov: {},
        fired: {},
        schema: tableSchema,
        enumDocs: enumDocsFor(tableSchema),
        error: null,
      });
    }
    const vrow = vanilla[rowId];
    if (!vrow) throw new Error(`Row not found: ${rowId}`);
    let effective;
    let prov;
    let fired;
    let error = null;
    try {
      const r = engine.applyTableStateToRow(
        vrow,
        { globalRules: st.globalRules, overrides: (st.overrides || {})[rowId] || {} },
        tableSchema,
        en,
      );
      effective = r.row;
      prov = r.prov;
      fired = r.fired;
    } catch (err) {
      error = err.message;
      effective = engine.clone(vrow);
      prov = {};
      fired = {};
    }
    return ok({
      isNew: false,
      vanilla: vrow,
      effective,
      prov,
      fired,
      rules: st.globalRules,
      overrides: (st.overrides || {})[rowId] || {},
      schema: tableSchema,
      enumDocs: enumDocsFor(tableSchema),
      error,
    });
  });

  function enumDocsFor(tableSchema) {
    const out = {};
    const seen = new Set();
    for (const f of Object.values(tableSchema.fields || {})) {
      if (f.enumName && !seen.has(f.enumName)) {
        seen.add(f.enumName);
        out[f.enumName] = schema.getEnumDocs(f.enumName);
      }
    }
    return out;
  }

  ipcMain.handle("row:set-field", async (_, file, rowId, fieldPath, rawValue) => {
    const project = await requireProject();
    const tableSchema = schema.inferSchema(file);
    const { rows: vanilla } = schema.readInputTable(file);
    const st = exportMod.getTableState(project, file);
    const top = String(fieldPath).split(".")[0];
    const fs = (tableSchema.fields || {})[top] || null;
    const sample = vanilla[rowId] ? engine.getPath(vanilla[rowId], fieldPath) : undefined;
    const coerced = engine.coerceValue(rawValue, fs, sample, enums());
    if (coerced.error) throw new Error(coerced.error);
    const value = engine.matchRepr(coerced.value, sample, fs, enums());
    if (st.newRows[rowId]) {
      st.newRows[rowId].fields = st.newRows[rowId].fields || {};
      if (value === null || value === undefined) {
        // Clearing a new-row field unsets it (template fill covers it at export).
        deleteOverridePath(st.newRows[rowId].fields, fieldPath);
      } else {
        engine.setPath(st.newRows[rowId].fields, fieldPath, engine.clone(value));
      }
    } else {
      if (!vanilla[rowId]) throw new Error(`Row not found: ${rowId}`);
      st.overrides[rowId] = st.overrides[rowId] || {};
      engine.setPath(st.overrides[rowId], fieldPath, engine.clone(value));
      // Drop override if it now equals the effective-with-globals value.
      const eff = engine.applyTableStateToRow(
        vanilla[rowId],
        { globalRules: st.globalRules, overrides: {} },
        tableSchema,
        enums(),
      );
      if (engine.deepEqual(engine.getPath(eff.row, fieldPath), value)) {
        deleteOverridePath(st.overrides[rowId], fieldPath);
        if (Object.keys(st.overrides[rowId]).length === 0) delete st.overrides[rowId];
      }
    }
    await persist(project, `Set ${file} ${rowId}.${fieldPath}`);
    return ok({ warning: coerced.warning || null, changed: tableChangedCounts(project) });
  });

  function deleteOverridePath(obj, fieldPath) {
    const segs = String(fieldPath).split(".");
    let cur = obj;
    const stack = [];
    for (const s of segs.slice(0, -1)) {
      if (!cur || typeof cur !== "object") return;
      stack.push([cur, s]);
      cur = cur[s];
    }
    if (cur && typeof cur === "object") delete cur[segs[segs.length - 1]];
    for (let i = stack.length - 1; i >= 0; i--) {
      const [parent, k] = stack[i];
      if (parent[k] && typeof parent[k] === "object" && Object.keys(parent[k]).length === 0) {
        delete parent[k];
      }
    }
  }

  ipcMain.handle("row:reset-field", async (_, file, rowId, fieldPath) => {
    const project = await requireProject();
    const st = exportMod.getTableState(project, file);
    if (st.newRows[rowId]) {
      if (st.newRows[rowId].fields) deleteOverridePath(st.newRows[rowId].fields, fieldPath);
    } else {
      if (st.overrides[rowId]) {
        deleteOverridePath(st.overrides[rowId], fieldPath);
        if (Object.keys(st.overrides[rowId]).length === 0) delete st.overrides[rowId];
      }
    }
    await persist(project, `Reset ${file} ${rowId}.${fieldPath}`);
    return ok({ changed: tableChangedCounts(project) });
  });

  ipcMain.handle("row:revert", async (_, file, rowId) => {
    const project = await requireProject();
    const st = exportMod.getTableState(project, file);
    if (st.newRows[rowId]) throw new Error("Use delete for new rows");
    delete st.overrides[rowId];
    await persist(project, `Reverted ${file} ${rowId}`);
    return ok({ changed: tableChangedCounts(project) });
  });

  ipcMain.handle("row:create", async (_, file, newId, baseId) => {
    const project = await requireProject();
    const id = String(newId || "").trim();
    if (!id) throw new Error("New row needs an ID");
    const { rows: vanilla } = schema.readInputTable(file);
    const st = exportMod.getTableState(project, file);
    if (vanilla[id] || st.newRows[id]) throw new Error(`Row ID already exists in ${file}: ${id}`);
    // Uniqueness across the table family (CookedDatatablePatcher adds by row name).
    const entry = schema.getTableEntry(file);
    const family = entry ? entry.family : schema.parseTableFile(file).family;
    for (const t of schema.listTables()) {
      if (t.family !== family || t.file === file) continue;
      const { rows } = schema.readInputTable(t.file);
      if (rows[id]) throw new Error(`Row ID already exists in family file ${t.file}: ${id}`);
    }
    let fields = {};
    if (baseId) {
      const base = vanilla[baseId] || st.newRows[baseId]?.fields || exportMod.findRowInFamily(file, baseId);
      if (!base) throw new Error(`Base row not found: ${baseId}`);
      fields = engine.clone(base);
      delete fields._base;
    }
    st.newRows[id] = { _base: baseId || null, fields };
    await persist(project, `Added row ${file} ${id}${baseId ? ` (from ${baseId})` : ""}`);
    return ok({ changed: tableChangedCounts(project) });
  });

  ipcMain.handle("row:duplicate", async (_, file, srcId, newId) => {
    const project = await requireProject();
    const id = String(newId || "").trim();
    if (!id) throw new Error("New row needs an ID");
    const { rows: vanilla } = schema.readInputTable(file);
    const st = exportMod.getTableState(project, file);
    if (vanilla[id] || st.newRows[id]) throw new Error(`Row ID already exists: ${id}`);
    const src = vanilla[srcId];
    if (!src) throw new Error(`Source row not found: ${srcId}`);
    // Duplicate the *effective* source so global rules carry over explicitly.
    const tableSchema = schema.inferSchema(file);
    const eff = engine.applyTableStateToRow(
      src,
      { globalRules: st.globalRules, overrides: (st.overrides || {})[srcId] || {} },
      tableSchema,
      enums(),
    );
    st.newRows[id] = { _base: null, fields: engine.clone(eff.row) };
    await persist(project, `Duplicated ${file} ${srcId} -> ${id}`);
    return ok({ changed: tableChangedCounts(project) });
  });

  ipcMain.handle("row:delete", async (_, file, rowId) => {
    const project = await requireProject();
    const st = exportMod.getTableState(project, file);
    if (!st.newRows[rowId]) throw new Error("Only new rows can be deleted");
    delete st.newRows[rowId];
    await persist(project, `Deleted new row ${file} ${rowId}`);
    return ok({ changed: tableChangedCounts(project) });
  });

  // ---- global rules ----
  ipcMain.handle("rules:list", async (_, file) => {
    const project = await requireProject();
    return ok({ rules: exportMod.getTableState(project, file).globalRules });
  });

  ipcMain.handle("rules:add", async (_, file, rule) => {
    const project = await requireProject();
    const st = exportMod.getTableState(project, file);
    const tableSchema = schema.inferSchema(file);
    const r = engine.newRule("", tableSchema);
    Object.assign(r, rule || {});
    r.id = r.id || engine.newRule().id;
    if (!r.field) throw new Error("Rule needs a field");
    if (!r.op) r.op = "set";
    st.globalRules.push(r);
    await persist(project, `Added global rule on ${file}.${r.field}`);
    return ok({ rules: st.globalRules, changed: tableChangedCounts(project) });
  });

  ipcMain.handle("rules:update", async (_, file, ruleId, patch) => {
    const project = await requireProject();
    const st = exportMod.getTableState(project, file);
    const r = st.globalRules.find((x) => x.id === ruleId);
    if (!r) throw new Error("Rule not found");
    Object.assign(r, patch || {}, { id: ruleId });
    await persist(project, `Edited global rule on ${file}.${r.field}`);
    return ok({ rules: st.globalRules, changed: tableChangedCounts(project) });
  });

  ipcMain.handle("rules:delete", async (_, file, ruleId) => {
    const project = await requireProject();
    const st = exportMod.getTableState(project, file);
    st.globalRules = st.globalRules.filter((x) => x.id !== ruleId);
    await persist(project, `Deleted global rule on ${file}`);
    return ok({ rules: st.globalRules, changed: tableChangedCounts(project) });
  });

  ipcMain.handle("rules:move", async (_, file, ruleId, dir) => {
    const project = await requireProject();
    const st = exportMod.getTableState(project, file);
    const i = st.globalRules.findIndex((x) => x.id === ruleId);
    const j = i + (dir === "up" ? -1 : 1);
    if (i < 0 || j < 0 || j >= st.globalRules.length) return ok({ rules: st.globalRules });
    const [r] = st.globalRules.splice(i, 1);
    st.globalRules.splice(j, 0, r);
    await persist(project, `Reordered global rules on ${file}`);
    return ok({ rules: st.globalRules });
  });

  ipcMain.handle("rules:match-count", async (_, file, cond) => {
    const project = await requireProject();
    const { rows: vanilla } = schema.readInputTable(file);
    const st = exportMod.getTableState(project, file);
    const tableSchema = schema.inferSchema(file);
    const en = enums();
    let match = 0;
    let total = 0;
    let error = null;
    for (const [id, vrow] of Object.entries(vanilla)) {
      total++;
      try {
        const eff = engine.applyTableStateToRow(
          vrow,
          { globalRules: st.globalRules, overrides: {} },
          tableSchema,
          en,
        );
        if (!cond || !cond.field) {
          match++;
        } else if (engine.testCondition(engine.getPath(eff.row, cond.field), cond.op, cond.value, en)) {
          match++;
        }
      } catch (err) {
        error = err.message;
        break;
      }
    }
    return ok({ match, total, error });
  });

  // ---- presets ----
  ipcMain.handle("presets:list", async () => ok(await projects.listPresets()));
  ipcMain.handle("presets:save", async (_, name, file) => {
    const project = await requireProject();
    const st = exportMod.getTableState(project, file);
    return ok(await projects.savePreset(name, file, engine.clone(st.globalRules)));
  });
  ipcMain.handle("presets:apply", async (_, name, file, mode) => {
    const project = await requireProject();
    const preset = await projects.loadPreset(name);
    const st = exportMod.getTableState(project, file);
    const fresh = engine.clone(preset.rules || []).map((r) => ({ ...r, id: engine.newRule().id }));
    if (mode === "replace") st.globalRules = fresh;
    else st.globalRules = [...st.globalRules, ...fresh];
    await persist(project, `Applied preset ${preset.name} to ${file}`);
    return ok({ rules: st.globalRules, changed: tableChangedCounts(project) });
  });
  ipcMain.handle("presets:delete", async (_, name) => {
    await projects.deletePreset(name);
    return ok(await projects.listPresets());
  });

  // ---- undo history ----
  ipcMain.handle("history:state", async () => {
    if (!currentProject) return ok({ canUndo: false, canRedo: false, undoDepth: 0 });
    return ok(historyState(currentProject));
  });

  ipcMain.handle("history:undo", async () => {
    const project = await requireProject();
    const h = hist(project.name);
    if (h.undo.length === 0) throw new Error("Nothing to undo");
    const cur = await projects.load(project.name);
    h.redo.push({ ts: Date.now(), data: cur, bytes: JSON.stringify(cur).length });
    const prev = h.undo.pop();
    await projects.save(prev.data, "Undo");
    refs.clearMemo();
    const fresh = await projects.load(project.name);
    return ok({ project: fresh, changed: tableChangedCounts(fresh), history: historyState(project.name) });
  });

  ipcMain.handle("history:redo", async () => {
    const project = await requireProject();
    const h = hist(project.name);
    if (h.redo.length === 0) throw new Error("Nothing to redo");
    const cur = await projects.load(project.name);
    const raw = JSON.stringify(cur);
    h.undo.push({ ts: Date.now(), data: cur, bytes: raw.length });
    const next = h.redo.pop();
    await projects.save(next.data, "Redo");
    refs.clearMemo();
    const fresh = await projects.load(project.name);
    return ok({ project: fresh, changed: tableChangedCounts(fresh), history: historyState(project.name) });
  });

  // ---- snapshots ----
  ipcMain.handle("snapshots:list", async () => {
    const project = await requireProject();
    return ok(await projects.listSnapshots(project.name));
  });

  ipcMain.handle("snapshots:create", async (_, label) => {
    const project = await requireProject();
    const s = await projects.createSnapshot(project.name, label);
    return ok({ snapshot: s, snapshots: await projects.listSnapshots(project.name) });
  });

  ipcMain.handle("snapshots:restore", async (_, file) => {
    const project = await requireProject();
    const data = await projects.readSnapshot(project.name, file);
    data.name = project.name;
    await persist(data, `Restored snapshot ${file}`);
    refs.clearMemo();
    const fresh = await projects.load(project.name);
    return ok({ project: fresh, changed: tableChangedCounts(fresh), history: historyState(project.name) });
  });

  ipcMain.handle("snapshots:delete", async (_, file) => {
    const project = await requireProject();
    await projects.deleteSnapshot(project.name, file);
    return ok(await projects.listSnapshots(project.name));
  });

  // ---- references ----
  ipcMain.handle("refs:targets", async (_, file, rowId) => {
    const project = await requireProject();
    return ok(refs.referenceTargets(file, rowId, project, enums()));
  });

  ipcMain.handle("refs:referenced-by", async (_, value) => {
    const project = await requireProject();
    return ok({ refs: refs.referencedBy(String(value), project, enums()) });
  });

  ipcMain.handle("refs:complete", async (_, field, prefix) => {
    const project = currentProject ? await projects.load(currentProject).catch(() => null) : null;
    return ok({ suggestions: refs.complete(String(field || ""), String(prefix || ""), project, refs.loadIdRegistries()) });
  });

  ipcMain.handle("validate:project", async () => {
    const project = await requireProject();
    return ok(refs.validateProject(project, enums()));
  });

  ipcMain.handle("checklist:character", async (_, prefix) => {
    const project = await requireProject();
    const lists = await refs.checklistFor(String(prefix), project);
    // Parameter presence (vanilla dump + project rows).
    const params = [];
    for (const a of schema.BP_PARAMETER_ASSETS) {
      let vanilla = 0;
      try {
        const v = await paramVanilla.dumpShort(a.shortName);
        vanilla = (v.ids || []).filter((id) => id.startsWith(prefix)).length;
      } catch {
        vanilla = 0;
      }
      const pstate = project.parameters[a.shortName];
      const proj = pstate ? Object.keys(pstate.rows || {}).filter((k) => !k.startsWith("$") && k.startsWith(prefix)).length : 0;
      params.push({ short: a.shortName, asset: a.assetName, vanilla, project: proj, status: vanilla + proj > 0 ? "ok" : "missing" });
    }
    return ok({ ...lists, params });
  });

  ipcMain.handle("moveset:character", async (_, prefix) => ok(refs.movesetFor(String(prefix))));

  ipcMain.handle("search:global", async (_, query, limit) => {
    const project = await requireProject();
    return ok({ results: refs.globalSearch(query, project, limit) });
  });

  ipcMain.handle("diff:projects", async (_, nameB) => {
    if (!currentProject) throw new Error("No project open");
    return ok(await refs.compareProjects(currentProject, nameB));
  });

  // ---- i18n text tools ----
  function siblingLocaleFiles(file) {
    const { family, locale } = schema.parseTableFile(file);
    return schema.listTables().filter((t) => t.family === family && t.file !== file);
  }

  function mergedRowText(file, rowId, project) {
    let vanilla = null;
    try {
      vanilla = schema.readInputTable(file).rows[rowId] || null;
    } catch {
      vanilla = null;
    }
    const st = (project.tables && project.tables[file]) || {};
    const base = vanilla ? engine.clone(vanilla) : {};
    const ov = (st.overrides && st.overrides[rowId]) || {};
    for (const [k, v] of Object.entries(ov)) engine.setPath(base, k, engine.clone(v));
    return base;
  }

  ipcMain.handle("i18n:find", async (_, query, scope) => {
    const project = await requireProject();
    const q = String(query || "");
    if (!q) return ok({ matches: [] });
    const ql = q.toLowerCase();
    let files = schema.listTables().map((t) => t.file);
    if (scope && scope.file) files = [scope.file];
    else if (scope && scope.family) files = files.filter((f) => schema.parseTableFile(f).family === scope.family);
    const matches = [];
    for (const file of files) {
      let rows = null;
      try {
        rows = schema.readInputTable(file).rows;
      } catch {
        continue;
      }
      const st = (project.tables && project.tables[file]) || {};
      const ids = new Set([...Object.keys(rows), ...Object.keys(st.newRows || {})]);
      for (const rowId of ids) {
        if (matches.length >= 400) break;
        const merged = st.newRows && st.newRows[rowId]
          ? engine.applyNewRow({}, st.newRows[rowId], schema.inferSchema(file), enums())
          : mergedRowText(file, rowId, project);
        for (const [k, v] of Object.entries(merged || {})) {
          if (typeof v === "string" && v.toLowerCase().includes(ql)) {
            matches.push({ file, rowId, field: k, value: v.length > 160 ? `${v.slice(0, 160)}…` : v });
            if (matches.length >= 400) break;
          }
        }
      }
      if (matches.length >= 400) break;
    }
    return ok({ matches });
  });

  ipcMain.handle("i18n:replace", async (_, matches, find, replace) => {
    const project = await requireProject();
    const f = String(find || "");
    if (!f) throw new Error("Find text is empty");
    const r = String(replace === undefined || replace === null ? "" : replace);
    let applied = 0;
    const touched = new Set();
    for (const m of matches || []) {
      if (!m || !m.file || !m.rowId || !m.field) continue;
      const cur = mergedRowText(m.file, m.rowId, project);
      const v = engine.getPath(cur, m.field);
      if (typeof v !== "string" || !v.includes(f)) continue;
      const st = exportMod.getTableState(project, m.file);
      if (st.newRows[m.rowId]) {
        st.newRows[m.rowId].fields = st.newRows[m.rowId].fields || {};
        engine.setPath(st.newRows[m.rowId].fields, m.field, v.split(f).join(r));
      } else {
        st.overrides[m.rowId] = st.overrides[m.rowId] || {};
        engine.setPath(st.overrides[m.rowId], m.field, v.split(f).join(r));
      }
      applied++;
      touched.add(m.file);
    }
    if (applied > 0) await persist(project, `Find/replace "${f}" (${applied} fields)`);
    return ok({ applied, files: [...touched], changed: tableChangedCounts(project) });
  });

  ipcMain.handle("i18n:propagate-en", async (_, file, rowId) => {
    const project = await requireProject();
    const { family, locale } = schema.parseTableFile(file);
    if (!locale || locale === "En") throw new Error("Open a non-English locale table to copy FROM English");
    const enFile = schema.listTables().find((t) => t.family === family && (t.locale === "En" || (!t.locale && /Text/.test(t.base))));
    const srcFile = enFile ? enFile.file : schema.listTables().find((t) => t.family === family && !t.locale)?.file;
    if (!srcFile) throw new Error(`No English source found for family ${family}`);
    let srcRow = null;
    try {
      srcRow = schema.readInputTable(srcFile).rows[rowId] || null;
    } catch {
      srcRow = null;
    }
    if (!srcRow) throw new Error(`Row ${rowId} not found in ${srcFile}`);
    const cur = mergedRowText(file, rowId, project);
    const st = exportMod.getTableState(project, file);
    let copied = 0;
    for (const [k, v] of Object.entries(srcRow)) {
      if (typeof v !== "string") continue;
      if (engine.deepEqual(cur[k], v)) continue;
      st.overrides[rowId] = st.overrides[rowId] || {};
      st.overrides[rowId][k] = engine.clone(v);
      copied++;
    }
    if (copied > 0) await persist(project, `Propagated EN text to ${file} ${rowId} (${copied} fields)`);
    return ok({ copied, srcFile, changed: tableChangedCounts(project) });
  });

  // ---- conflicts vs installed mods ----
  ipcMain.handle("conflicts:scan", async () => {
    const project = await requireProject();
    const cfg = config.get();
    if (!cfg.modsDir) throw new Error("No Mods folder configured (Settings).");
    const fsPromises = require("fs/promises");
    // Current project's touched rows per table + params.
    const mine = { tables: {}, params: {} };
    for (const file of Object.keys(project.tables || {})) {
      try {
        const { changed } = exportMod.computeTableDiff(file, project, enums());
        const keys = Object.keys(changed);
        if (keys.length > 0) mine.tables[file] = new Set(keys);
      } catch {
        /* skip errored tables */
      }
    }
    for (const [short, pstate] of Object.entries(project.parameters || {})) {
      const ids = Object.keys((pstate && pstate.rows) || {}).filter((k) => !k.startsWith("$"));
      if (ids.length > 0) mine.params[short] = new Set(ids);
    }
    const myPriority = Number((project.manifest && project.manifest.priority) || 0);
    let entries = [];
    try {
      entries = await fsPromises.readdir(path.join(cfg.modsDir), { withFileTypes: true });
    } catch (err) {
      throw new Error(`Cannot read Mods folder: ${err.message}`);
    }
    const conflicts = [];
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const modRoot = path.join(cfg.modsDir, e.name);
      let manifest = {};
      try {
        manifest = JSON.parse(await fsPromises.readFile(path.join(modRoot, "manifest.json"), "utf8"));
      } catch {
        manifest = {};
      }
      const modPriority = Number(manifest.priority || 0);
      const title = manifest.title || e.name;
      // Datatables.
      let dtFiles = [];
      try {
        dtFiles = (await fsPromises.readdir(path.join(modRoot, "datatables"))).filter((f) => f.toLowerCase().endsWith(".json"));
      } catch {
        dtFiles = [];
      }
      for (const f of dtFiles) {
        if (!mine.tables[f]) continue;
        let rows = null;
        try {
          rows = JSON.parse(await fsPromises.readFile(path.join(modRoot, "datatables", f), "utf8"));
        } catch {
          continue;
        }
        const overlap = Object.keys(rows || {}).filter((k) => !k.startsWith("$") && mine.tables[f].has(k));
        if (overlap.length > 0) {
          conflicts.push({ mod: e.name, title, priority: modPriority, kind: "datatable", file: f, rows: overlap.slice(0, 25), rowCount: overlap.length, winner: modPriority > myPriority ? "them" : modPriority < myPriority ? "you" : "tie" });
        }
      }
      // Parameters.
      let pmFiles = [];
      try {
        pmFiles = (await fsPromises.readdir(path.join(modRoot, "parameters"))).filter((f) => f.toLowerCase().endsWith(".json"));
      } catch {
        pmFiles = [];
      }
      for (const f of pmFiles) {
        const short = f.replace(/\.json$/i, "");
        if (!mine.params[short]) continue;
        let rows = null;
        try {
          rows = JSON.parse(await fsPromises.readFile(path.join(modRoot, "parameters", f), "utf8"));
        } catch {
          continue;
        }
        const overlap = Object.keys(rows || {}).filter((k) => !k.startsWith("$") && mine.params[short].has(k));
        if (overlap.length > 0) {
          conflicts.push({ mod: e.name, title, priority: modPriority, kind: "parameter", file: `parameters/${f}`, rows: overlap.slice(0, 25), rowCount: overlap.length, winner: modPriority > myPriority ? "them" : modPriority < myPriority ? "you" : "tie" });
        }
      }
    }
    conflicts.sort((a, b) => b.rowCount - a.rowCount);
    return ok({ conflicts: conflicts.slice(0, 200), myPriority, modCount: entries.filter((x) => x.isDirectory()).length });
  });

  // ---- diffs ----
  ipcMain.handle("diff:table", async (_, file) => {
    const project = await requireProject();
    const { changed, errors, fills } = exportMod.computeTableDiff(file, project, enums());
    return ok({ changed, errors, fills: fills || [] });
  });

  ipcMain.handle("diff:project", async () => {
    const project = await requireProject();
    const out = {};
    const errors = [];
    for (const file of Object.keys(project.tables || {})) {
      try {
        const { changed, errors: errs } = exportMod.computeTableDiff(file, project, enums());
        for (const e of errs) errors.push(`${file}: ${e}`);
        if (Object.keys(changed).length > 0) out[file] = changed;
      } catch (err) {
        errors.push(`${file}: ${err.message}`);
      }
    }
    const params = {};
    for (const [short, pstate] of Object.entries(project.parameters || {})) {
      const ids = Object.keys((pstate && pstate.rows) || {}).filter((k) => !k.startsWith("$"));
      if (ids.length === 0) continue;
      let vanillaIds = null;
      try {
        const v = await paramVanilla.dumpShort(short);
        vanillaIds = new Set(v.ids || []);
      } catch {
        vanillaIds = null;
      }
      const entry = { new: [], modified: [] };
      for (const id of ids.sort()) {
        if (vanillaIds && vanillaIds.has(id)) entry.modified.push(id);
        else if (vanillaIds) entry.new.push(id);
        else entry.new.push(id);
      }
      params[short] = entry;
    }
    return ok({ tables: out, params, errors });
  });

  // ---- docs ----
  ipcMain.handle("docs:field", async (_, tableBase, tableFamily, field, enumName) => {
    const docs = schema.getTableDocs(tableBase, tableFamily);
    const en = enums();
    const info = docs.fields[field] || { desc: "", source: "none" };
    let enumInfo = null;
    if (enumName && en.map[enumName]) {
      const userEnum = schema.getEnumDocs(enumName);
      enumInfo = {
        name: enumName,
        members: en.map[enumName].members.map((m) => ({
          name: m.name,
          value: m.value,
          desc: userEnum[m.name] || "",
        })),
      };
    }
    return ok({ field: info, tableDesc: docs.tableDesc, wikiFile: docs.wikiFile, enum: enumInfo });
  });
  ipcMain.handle("docs:save-field", async (_, tableKey, field, desc) => {
    await schema.saveFieldDoc(tableKey, field, desc);
    return ok(true);
  });
  ipcMain.handle("docs:save-enum", async (_, enumName, member, desc) => {
    await schema.saveEnumDoc(enumName, member, desc);
    return ok(true);
  });

  // ---- manifest / assets / registry ----
  ipcMain.handle("manifest:get", async () => ok((await requireProject()).manifest));
  ipcMain.handle("manifest:save", async (_, manifest) => {
    const project = await requireProject();
    project.manifest = manifest && typeof manifest === "object" ? manifest : project.manifest;
    await persist(project, "Edited manifest");
    return ok(project.manifest);
  });

  ipcMain.handle("assets:list", async () => ok((await requireProject()).assets));
  ipcMain.handle("assets:add-file", async (_, dest) => {
    const project = await requireProject();
    const r = await dialog.showOpenDialog({ title: "Pick asset file(s)", properties: ["openFile", "multiSelections"] });
    if (r.canceled) return ok(project.assets);
    for (const abs of r.filePaths) {
      const rel = dest || `assets/${path.basename(abs)}`;
      if (!project.assets.find((a) => a.dest === rel)) project.assets.push({ src: abs, dest: rel });
    }
    await persist(project, "Added duplicate asset(s)");
    return ok(project.assets);
  });
  ipcMain.handle("assets:add-dir", async (_, dest) => {
    const project = await requireProject();
    const r = await dialog.showOpenDialog({ title: "Pick asset folder", properties: ["openDirectory"] });
    if (r.canceled) return ok(project.assets);
    const abs = r.filePaths[0];
    const rel = dest || `assets/${path.basename(abs)}`;
    project.assets.push({ src: abs, dest: rel });
    await persist(project, "Added duplicate asset folder");
    return ok(project.assets);
  });
  ipcMain.handle("assets:remove", async (_, dest) => {
    const project = await requireProject();
    project.assets = project.assets.filter((a) => a.dest !== dest);
    await persist(project, "Removed duplicate asset");
    return ok(project.assets);
  });

  ipcMain.handle("registry:get", async () => ok((await requireProject()).registryRows));
  ipcMain.handle("registry:save", async (_, rows) => {
    const project = await requireProject();
    let parsed = rows;
    if (typeof rows === "string") {
      try {
        parsed = JSON.parse(rows);
      } catch (err) {
        throw new Error(`AssetRegistry.json is not valid JSON: ${err.message}`);
      }
    }
    if (!Array.isArray(parsed)) throw new Error("AssetRegistry.json must be an array");
    project.registryRows = parsed;
    await persist(project, "Edited AssetRegistry rows");
    return ok({ count: parsed.length });
  });

  // ---- parameters (vanilla-backed: values read from cooked uassets) ----
  ipcMain.handle("param:vanilla", async (_, short) => {
    const v = await paramVanilla.dumpShort(short);
    return ok({ ids: v.ids, count: v.count, asset: v.asset, valueKind: v.valueKind });
  });

  ipcMain.handle("params:rows", async (_, short) => {
    const project = await requireProject();
    const pstate = project.parameters[short] || { rows: {}, comment: "" };
    const ids = Object.keys(pstate.rows || {}).filter((k) => !k.startsWith("$")).sort();
    let vanillaIds = [];
    let vanillaError = null;
    try {
      vanillaIds = (await paramVanilla.dumpShort(short)).ids || [];
    } catch (err) {
      vanillaError = err.message;
    }
    const projectSet = new Set(ids);
    return ok({
      rows: ids,
      vanillaIds: vanillaIds.filter((id) => !projectSet.has(id)),
      comment: pstate.comment || "",
      count: ids.length,
      vanillaError,
    });
  });

  ipcMain.handle("param:get", async (_, short, rowId) => {
    const project = await requireProject();
    const pstate = project.parameters[short] || { rows: {}, comment: "" };
    const value = pstate.rows[rowId];
    let vanillaRow = null;
    let vanillaError = null;
    try {
      const v = await paramVanilla.dumpShort(short);
      if (v.rows[rowId] !== undefined) vanillaRow = v.rows[rowId];
    } catch (err) {
      vanillaError = err.message;
    }
    const tableSchema = schema.inferParamSchema(short, { ...((vanillaRow && { [rowId]: vanillaRow }) || {}), ...(value !== undefined ? { [rowId]: value } : {}) });
    if (value === undefined) {
      if (vanillaRow === null || vanillaRow === undefined) throw new Error(`Row not found: ${rowId}`);
      return ok({ exists: false, value: null, vanilla: vanillaRow, schema: tableSchema, prov: {}, isNew: false, comment: pstate.comment || "", vanillaError });
    }
    // Provenance vs vanilla (top-level fields).
    const prov = {};
    const isNew = vanillaRow === null || vanillaRow === undefined;
    if (!isNew && value && typeof value === "object" && vanillaRow && typeof vanillaRow === "object") {
      const keys = new Set([...Object.keys(vanillaRow), ...Object.keys(value)]);
      for (const k of keys) {
        if (!engine.deepEqual(vanillaRow[k], value[k])) prov[k] = "override";
      }
    } else if (!isNew && !engine.deepEqual(vanillaRow, value)) {
      prov["(value)"] = "override";
    }
    return ok({ exists: true, value, vanilla: vanillaRow, schema: tableSchema, prov, isNew, enumDocs: {}, comment: pstate.comment || "", vanillaError });
  });

  ipcMain.handle("param:clone", async (_, short, srcId, newId) => {
    const project = await requireProject();
    const id = String(newId || "").trim();
    if (!id) throw new Error("New row needs an ID");
    if (!project.parameters[short]) project.parameters[short] = { rows: {}, comment: "" };
    if (project.parameters[short].rows[id] !== undefined) throw new Error(`Row exists: ${id}`);
    const v = await paramVanilla.dumpShort(short);
    const src = v.rows[srcId];
    if (src === undefined) throw new Error(`Vanilla row not found: ${srcId}`);
    // Convert display shape (grouped exchangeImage) to patcher write shape.
    project.parameters[short].rows[id] = paramVanilla.toWriteValue(short, engine.clone(src), v);
    await persist(project, `Cloned parameters/${short}.json ${srcId} -> ${id}`);
    return ok(true);
  });

  ipcMain.handle("param:set", async (_, short, rowId, value) => {
    const project = await requireProject();
    if (!project.parameters[short]) project.parameters[short] = { rows: {}, comment: "" };
    project.parameters[short].rows[rowId] = value;
    await persist(project, `Set parameters/${short}.json ${rowId}`);
    return ok(true);
  });

  ipcMain.handle("param:create", async (_, short, rowId, baseId, value) => {
    const project = await requireProject();
    const id = String(rowId || "").trim();
    if (!id) throw new Error("New row needs an ID");
    if (!project.parameters[short]) project.parameters[short] = { rows: {}, comment: "" };
    if (project.parameters[short].rows[id] !== undefined) throw new Error(`Row exists: ${id}`);
    if (value !== undefined) {
      project.parameters[short].rows[id] = value;
    } else if (baseId && project.parameters[short].rows[baseId] !== undefined) {
      project.parameters[short].rows[id] = engine.clone(project.parameters[short].rows[baseId]);
    } else {
      const asset = schema.BP_PARAMETER_ASSETS.find((a) => a.shortName === short);
      project.parameters[short].rows[id] =
        asset && asset.valueKind === "ref" ? "" : {};
    }
    await persist(project, `Added parameters/${short}.json ${id}`);
    return ok(true);
  });

  ipcMain.handle("param:delete", async (_, short, rowId) => {
    const project = await requireProject();
    if (project.parameters[short]) delete project.parameters[short].rows[rowId];
    await persist(project, `Deleted parameters/${short}.json ${rowId}`);
    return ok(true);
  });

  ipcMain.handle("param:comment", async (_, short, comment) => {
    const project = await requireProject();
    if (!project.parameters[short]) project.parameters[short] = { rows: {}, comment: "" };
    project.parameters[short].comment = String(comment || "");
    await persist(project, `Edited parameters/${short}.json comment`);
    return ok(true);
  });

  // ---- export / import ----
  function bakeOpts() {
    const cfg = config.get();
    return { bake: cfg.bakeParameterAssets !== false };
  }

  ipcMain.handle("export:preview", async () => {
    const project = await requireProject();
    const { files, warnings, stats, bake } = await exportMod.buildModTree(project, enums(), bakeOpts());
    return ok({
      folder: exportMod.modFolderName(project),
      files: [...files.keys()].sort(),
      warnings,
      stats,
      bake,
    });
  });

  ipcMain.handle("export:folder", async () => {
    const project = await requireProject();
    const cfg = config.get();
    if (cfg.autoSnapshotOnExport !== false) {
      try {
        await projects.autoSnapshot(project.name, cfg.snapshotKeep || 5);
      } catch {
        /* snapshots best-effort */
      }
    }
    const res = await exportMod.exportToModsFolder(project, enums(), cfg.modsDir, exportOptsFromConfig());
    await persist(project, `Exported to Mods folder (${res.files.length} files)`, { skipAuto: true });
    return ok(res);
  });

  ipcMain.handle("export:jjkmod", async (_, outPath) => {
    const project = await requireProject();
    let dest = outPath;
    if (!dest) {
      const m = project.manifest || {};
      const base = `${(m.title || project.name)}${m.version ? ` ${m.version}` : ""}.jjkmod`;
      const r = await dialog.showSaveDialog({
        title: "Export .jjkmod",
        defaultPath: base,
        filters: [{ name: "JJK mod", extensions: ["jjkmod"] }],
      });
      if (r.canceled || !r.filePath) return ok({ cancelled: true });
      dest = r.filePath;
    }
    const res = await exportMod.exportJjkmod(project, enums(), dest, { bake: config.get().bakeParameterAssets !== false });
    await persist(project, `Exported ${path.basename(res.path)}`, { skipAuto: true });
    return ok(res);
  });

  ipcMain.handle("import:folder", async (_, folderPath, asName) => {
    let src = folderPath;
    if (!src) {
      const r = await dialog.showOpenDialog({ title: "Import mod folder", properties: ["openDirectory"] });
      if (r.canceled) return ok({ cancelled: true });
      src = r.filePaths[0];
    }
    const imported = await exportMod.importModFolder(src);
    const name = (asName && String(asName).trim()) || imported.base;
    const project = await projects.create(`${name} (imported)`);
    currentProject = project.name;
    project.tables = imported.tables;
    project.parameters = imported.parameters;
    if (imported.manifest && typeof imported.manifest === "object") {
      const { title, description, version, priority, icon, ...rest } = imported.manifest;
      project.manifest = {
        title: title || project.name,
        description: description || "",
        version: version || "1.0.0",
        priority: priority ?? 0,
        icon: icon || "",
        ...rest,
      };
    }
    project.changelog.push({ ts: Date.now(), msg: `Imported from ${src}` });
    await projects.save(project);
    await config.save({ lastProject: project.name });
    await touchRecent(project.name);
    refreshAppMenu();
    return ok({ project, warnings: imported.warnings, projects: await projects.list() });
  });

  ipcMain.handle("patcher:test", async () => {
    const project = await requireProject();
    const cfg = config.get();
    const { files, warnings, stats, bake } = await exportMod.buildModTree(project, enums(), bakeOpts());
    const dtTree = new Map([...files].filter(([rel]) => rel.startsWith("datatables/")));
    const hasParams = bake && bake.baked && bake.baked.length > 0;
    if (dtTree.size === 0 && !hasParams) throw new Error("Nothing to patch: no datatable or parameter changes in this project");
    let dt = null;
    if (dtTree.size > 0) {
      dt = await patcher.testPatch({ modManagerDir: cfg.modManagerDir, datatablesTree: dtTree });
    }
    return ok({ datatables: dt, bake: bake || null, buildWarnings: warnings, stats });
  });
}

async function preflight() {
  // Warm caches in the background so first paint is fast.
  setImmediate(() => {
    try {
      schema.listTables();
    } catch {
      /* shown in UI */
    }
    try {
      schema.parseEnumsTs();
    } catch {
      /* optional */
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  refreshAppMenu();
  createWindow();
  preflight();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Main-process safety net: never let an IPC throwable kill the app silently.
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[jjk-mod-editor] uncaughtException:", err);
});
