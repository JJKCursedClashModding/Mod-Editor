/* JJK Mod Editor renderer — vanilla JS, no build step.
   Multi-tab UI: each table / param file / ruleset opens as a tab that keeps
   its own character filter, status filter, search and visible-field set. All
   rows (vanilla + edited + new) render in one unified view with badges. */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function shortVal(v, max) {
  let s;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (s === undefined) return "—";
  max = max || 160;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

async function call(ch, ...args) {
  const r = await window.jjkApi[ch](...args);
  if (!r || !r.ok) throw new Error((r && r.error) || "IPC failed");
  return r.data;
}

function toast(msg, kind) {
  const el = document.createElement("div");
  el.className = `toast ${kind || ""}`;
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), kind === "error" ? 8000 : 4500);
}

function busy(msg) {
  const wrap = $("#stBusy");
  const txt = $("#stBusyMsg");
  if (txt) txt.textContent = msg || "Working...";
  if (wrap) wrap.style.display = "";
}
function idle() {
  const wrap = $("#stBusy");
  if (wrap) wrap.style.display = "none";
}

async function guard(fn, busyMsg) {
  try {
    if (busyMsg) busy(busyMsg);
    await fn();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    if (busyMsg) idle();
  }
}

// ---------------- state ----------------
const S = {
  config: null,
  projects: [],
  currentProject: null,
  project: null,
  tables: [],
  tableByFile: {},
  changed: {},
  enums: [],
  chars: {},
  paramAssets: [],
  ruleOps: [],
  condOps: [],
  leftTab: "tables",
  charMode: "",
  prefixIndex: null,
  paramVanillaIds: {},
  scope: null, // legacy mirror of the active tab (kept for helpers)
  tab: "rows",
  charPrefix: "",
  rowSearch: "",
  rowOffset: 0,
  rowTotal: 0,
  rowList: [],
  selectedRow: null,
  rowData: null,
  schema: null,
  paramSchema: null,
  docSummary: null,
  insp: null,
  modCache: { manifest: null, assets: null, registry: null, preview: null },
  presets: [],
  // ---- multi-tab model ----
  // tab: {id, kind:'table'|'param'|'rules', file?, short?, charPrefix,
  //        statusFilter, search, visibleFields|null, rowOffset, rowTotal,
  //        rowList, expanded:{rowId:data}, expandOrder:[], schema,
  //        docSummary, paramComment}
  tabs: [],
  activeTabId: null,
  docsCache: {}, // "base.field" -> {desc, source}
  showFilterPanel: false,
  // ---- IDE shell ----
  sideView: "explorer", // explorer | search | changes
  sidebarOpen: true,
  panelOpen: false,
  panelView: "problems",
  problems: null, // last validate:project result
  diffCache: null, // last diff:project result
  pal: { open: false, mode: "files", cmdLock: false, items: [], sel: 0 },
};

const PAGE = 400;

function tableEntry(file) {
  return S.tableByFile[file] || null;
}

function baseFamilyOf(file) {
  const e = tableEntry(file);
  if (e) return { base: e.base, family: e.family };
  let stem = file.replace(/\.json$/i, "");
  const m = stem.match(/_((?:Es_LA)|(?:Zh_Han[st])|De|En|Es|Fr|It|Ja|Ko|Pt)$/);
  let locale = null;
  if (m) {
    locale = m[1];
    stem = stem.slice(0, -(locale.length + 1));
  }
  const family = stem.replace(/\d+$/, "") || stem;
  return { base: stem, family };
}

// ---------------- multi-tab model ----------------
let _tabSeq = 1;
function newTabId() {
  return `tab${_tabSeq++}_${Date.now().toString(36)}`;
}
function activeTab() {
  return S.tabs.find((t) => t.id === S.activeTabId) || null;
}
function findTab(kind, key) {
  return S.tabs.find((t) => t.kind === kind && (t.file === key || t.short === key)) || null;
}
function findTableTab(file, charPrefix) {
  // Same file may be open in several tabs with different scopes; match both.
  return S.tabs.find((t) => t.kind === "table" && t.file === file && (t.charPrefix || "") === (charPrefix || "")) || null;
}
function findParamTab(short, charPrefix) {
  return S.tabs.find((t) => t.kind === "param" && t.short === short && (t.charPrefix || "") === (charPrefix || "")) || null;
}
function tabTitle(tab) {
  if (tab.kind === "table") return String(tab.file || "").replace(/\.json$/i, "");
  if (tab.kind === "param") return tab.short;
  if (tab.kind === "rules") return `${ruleFamilyKey(tab)} — Rules`;
  return "?";
}
// Family stem for a rules tab (mirrors the backend share key): numbered
// splits collapse to the family, locales stay separate.
function shareKeyOf(file) {
  const stem = String(file || "").replace(/\.json$/i, "");
  const m = stem.match(/_((?:Es_LA)|(?:Zh_Han[st])|De|En|Es|Fr|It|Ja|Ko|Pt)$/);
  let locale = null;
  let base = stem;
  if (m) {
    locale = m[1];
    base = stem.slice(0, -(locale.length + 1));
  }
  const family = base.replace(/\d+$/, "") || base;
  return locale ? `${family}_${locale}` : family;
}
function ruleFamilyKey(tab) {
  if (tab && tab.familyInfo && tab.familyInfo.key) return tab.familyInfo.key;
  return shareKeyOf(tab && tab.file);
}
function isTabDirty(tab) {
  if (!tab) return false;
  const f = tab.kind === "rules" ? tab.file : tab.kind === "table" ? tab.file : null;
  if (f && S.changed[f]) return true;
  if (tab.kind === "param" && S.project && S.project.parameters && S.project.parameters[tab.short]) {
    const rows = S.project.parameters[tab.short].rows || {};
    return Object.keys(rows).filter((k) => k.charAt(0) !== "$").length > 0;
  }
  return false;
}
function syncLegacyScope() {
  // Keep S.scope / S.schema / S.selectedRow etc. mirroring the active tab so
  // shared helpers (widgets, rules, jumps) keep working unchanged.
  const t = activeTab();
  if (!t) {
    S.scope = null;
    S.selectedRow = null;
    S.rowData = null;
    return;
  }
  if (t.kind === "table") {
    S.scope = { kind: "table", file: t.file };
    S.tab = "rows";
    S.charPrefix = t.charPrefix;
    S.rowSearch = t.search;
    S.rowOffset = t.rowOffset;
    S.rowTotal = t.rowTotal;
    S.rowList = t.rowList;
    S.schema = t.schema;
    S.docSummary = t.docSummary;
    const firstOpen = t.expandOrder[0];
    S.selectedRow = firstOpen || null;
    S.rowData = firstOpen ? t.expanded[firstOpen] : null;
  } else if (t.kind === "param") {
    S.scope = { kind: "param", short: t.short };
    S.tab = "rows";
    S.rowSearch = t.search;
    S.rowOffset = t.rowOffset;
    S.rowTotal = t.rowTotal;
    S.rowList = t.rowList;
    S.paramComment = t.paramComment;
    const firstOpen = t.expandOrder[0];
    S.selectedRow = firstOpen || null;
    S.rowData = firstOpen ? t.expanded[firstOpen] : null;
  } else {
    S.scope = { kind: "table", file: t.file };
    S.tab = "rules";
    S.schema = t.schema;
    S.selectedRow = null;
    S.rowData = null;
  }
}

// ---------------- init ----------------
async function init() {
  const d = await call("state:init");
  S.config = d.config;
  S.projects = d.projects;
  S.currentProject = d.currentProject;
  S.project = d.project;
  S.tables = d.tables || [];
  S.tableByFile = {};
  for (const t of S.tables) S.tableByFile[t.file] = t;
  S.changed = d.changed || {};
  S.enums = d.enums || [];
  S.chars = d.chars || {};
  S.paramAssets = d.paramAssets || [];
  S.ruleOps = d.ruleOps || [];
  S.condOps = d.condOps || [];
  if (d.tablesError) toast(`Input tables: ${d.tablesError}`, "warn");
  renderProjects();
  renderScopeList();
  if (S.tables.length > 0) {
    await selectScope({ kind: "table", file: S.tables[0].file });
  } else if (S.paramAssets.length > 0) {
    await selectScope({ kind: "param", short: S.paramAssets[0].shortName });
  } else {
    renderCenter();
  }
  updateProjChangeCount();
}

// ---------------- projects ----------------
function renderProjects() {
  const cur = (S.projects || []).find((p) => p.name === S.currentProject);
  const label = (cur && (cur.title || cur.name))
    || (S.project && S.project.manifest && S.project.manifest.title)
    || S.currentProject;
  document.title = label ? `${label} — JJK Mod Editor` : "JJK Mod Editor";
  renderStatusBar();
}
// Searchable, recency-sorted project opener (File > Open Project…).
async function showOpenProjectModal() {
  await guard(async () => {
    busy("Loading projects…");
    let list = [];
    let cfg = {};
    try {
      list = await call("project:list");
      try { cfg = await call("config:get"); } catch { cfg = {}; }
    } finally {
      idle();
    }
    const rank = new Map(((cfg && cfg.recentProjects) || []).map((n, i) => [n, i]));
    const sorted = [...list].sort((a, b) => {
      const ra = rank.has(a.name) ? rank.get(a.name) : 1e9;
      const rb = rank.has(b.name) ? rank.get(b.name) : 1e9;
      if (ra !== rb) return ra - rb;
      return (b.updated || 0) - (a.updated || 0) || a.name.localeCompare(b.name);
    });
    const box = showModal(`<h2>Open Project</h2>` +
      `<div class="mrow"><input id="projSearch" type="text" placeholder="Search projects…" autocomplete="off"></div>` +
      `<div class="mrow"><div id="projList" style="max-height:340px;overflow-y:auto"></div></div>` +
      `<div class="mfoot"><button class="small" id="btnProjNew">+ New project</button><span style="flex:1"></span><button data-x="ok">Cancel</button></div>`);
    const paint = (q) => {
      const query = (q || "").toLowerCase();
      const rows = sorted.filter((p) => !query || p.name.toLowerCase().includes(query) || (p.title || "").toLowerCase().includes(query));
      $("#projList", box).innerHTML = rows.map((p) =>
        `<div class="diff-row"><div class="dh">` +
        (p.name === S.currentProject ? `<span class="badge new">OPEN</span>` : rank.has(p.name) ? `<span class="badge global">RECENT</span>` : "") +
        `<span style="flex:1">${esc(p.title || p.name)}<br><span style="color:var(--dim);font-size:11px">${esc(p.name)}${p.version ? ` · v${esc(p.version)}` : ""}${p.updated ? ` · ${esc(new Date(p.updated).toLocaleString())}` : ""}</span></span>` +
        `<button class="small" data-open-proj="${esc(p.name)}">Open</button></div></div>`
      ).join("") || `<div class="empty-note">No matches</div>`;
    };
    paint("");
    $("#projSearch", box).addEventListener("input", (e) => paint(e.target.value));
    box.addEventListener("click", async (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      if (e.target.id === "btnProjNew") { closeModal(); newProjectFlow(); return; }
      const n = e.target.dataset && e.target.dataset.openProj;
      if (n) { closeModal(); if (n !== S.currentProject) guard(() => openProject(n)); }
    });
    setTimeout(() => { const s = $("#projSearch", box); if (s) s.focus(); }, 0);
  });
}

async function openProject(name) {
  const d = await call("project:open", name);
  S.currentProject = name;
  S.project = d.project;
  S.changed = d.changed || {};
  S.diffCache = null;
  S.problems = null;
  S.tabs = [];
  S.activeTabId = null;
  S.scope = null;
  S.selectedRow = null;
  S.rowData = null;
  S.schema = null;
  renderProjects();
  let restored = false;
  try { restored = await restoreTabs(); } catch { restored = false; }
  if (!restored) {
    if (S.charMode) {
      await setCharMode(S.charMode);
    } else {
      renderScopeList();
      renderCenter();
    }
  }
  updateProjChangeCount();
  updateDirtyState();
  refreshHistory();
}

function promptModal(title, fields, okLabel) {
  return new Promise((resolve) => {
    const root = $("#modalRoot");
    root.innerHTML = "";
    const ov = document.createElement("div");
    ov.className = "overlay";
    const box = document.createElement("div");
    box.className = "modal";
    box.innerHTML = `<h2>${esc(title)}</h2>` +
      fields.map((f, i) => `<div class="mrow"><label>${esc(f.label)}</label>` +
        (f.type === "select"
          ? `<select data-i="${i}">${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${o.value === f.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`
          : `<input data-i="${i}" type="text" value="${esc(f.value || "")}" placeholder="${esc(f.placeholder || "")}">`) +
        `</div>`).join("") +
      `<div class="mfoot"><button data-x="cancel">Cancel</button><button data-x="ok" class="primary">${esc(okLabel || "OK")}</button></div>`;
    ov.appendChild(box);
    root.appendChild(ov);
    const done = (val) => {
      root.innerHTML = "";
      resolve(val);
    };
    box.addEventListener("click", (e) => {
      const x = e.target.dataset && e.target.dataset.x;
      if (x === "cancel") done(null);
      if (x === "ok") {
        const vals = fields.map((f, i) => {
          const el = box.querySelector(`[data-i="${i}"]`);
          return el ? el.value : "";
        });
        done(vals.length === 1 ? vals[0] : vals);
      }
    });
    ov.addEventListener("mousedown", (e) => {
      if (e.target === ov) done(null);
    });
    const first = box.querySelector("input,select");
    if (first) first.focus();
  });
}

function showModal(html, wide) {
  const root = $("#modalRoot");
  root.innerHTML = "";
  const ov = document.createElement("div");
  ov.className = "overlay";
  const box = document.createElement("div");
  box.className = `modal${wide ? " wide" : ""}`;
  box.innerHTML = html;
  ov.appendChild(box);
  root.appendChild(ov);
  ov.addEventListener("mousedown", (e) => {
    if (e.target === ov) root.innerHTML = "";
  });
  return box;
}
function closeModal() {
  $("#modalRoot").innerHTML = "";
}

// ---------------- per-character mode ----------------
function charLabelOf(prefix) {
  return (S.chars && S.chars[prefix]) || prefix;
}

function charTableCount(prefix) {
  if (!S.prefixIndex) return null;
  let n = 0;
  for (const t of S.tables) {
    if (S.prefixIndex[t.file] && S.prefixIndex[t.file][prefix]) n++;
  }
  return n;
}

function updateCharModeButtons() {
  // Checklist / Moveset live under the Project menu now; nothing to toggle.
}

async function refreshHistory() {
  try {
    S.history = S.currentProject ? await call("history:state") : { canUndo: false, canRedo: false };
  } catch {
    /* ignore */
  }
}
function activeElementIsEditable() {
  const el = document.activeElement;
  return !!el && (el.isContentEditable || (el.matches && el.matches("input, textarea, select")));
}
async function doUndo() {
  // With a text field focused, keep native text undo working.
  if (activeElementIsEditable()) {
    try { document.execCommand("undo"); } catch { /* ignore */ }
    return;
  }
  await guard(async () => {
    const d = await call("history:undo");
    await refreshAfterHistory(d);
    toast("Undone", "success");
  });
}
async function doRedo() {
  if (activeElementIsEditable()) {
    try { document.execCommand("redo"); } catch { /* ignore */ }
    return;
  }
  await guard(async () => {
    const d = await call("history:redo");
    await refreshAfterHistory(d);
    toast("Redone", "success");
  });
}
function doCloseTab() {
  // Closing would drop focus (and a half-typed value): blur first to commit,
  // and let a second press close.
  if (activeElementIsEditable()) {
    try { document.activeElement.blur(); } catch { /* ignore */ }
    return;
  }
  if (S.activeTabId) closeTab(S.activeTabId);
}

async function refreshAfterHistory(d) {
  S.project = d.project;
  S.changed = d.changed || {};
  S.history = d.history || S.history;
  renderScopeList();
  // Reload every open tab against the restored project.
  for (const t of S.tabs) {
    if (t.kind === "rules") continue;
    try {
      await loadTabRows(t, true);
      for (const rowId of [...t.expandOrder]) {
        try {
          t.expanded[rowId] = await fetchRowData(t, rowId);
        } catch {
          delete t.expanded[rowId];
          t.expandOrder = t.expandOrder.filter((x) => x !== rowId);
        }
      }
    } catch {
      /* keep tab as-is */
    }
  }
  syncLegacyScope();
  renderCenter();
  updateProjChangeCount();
  updateDirtyState();
}

function populateCharSelect() {
  const btn = $("#btnCharFilter");
  if (btn) {
    btn.classList.toggle("on", !!S.charMode);
    btn.title = S.charMode
      ? `Character filter: ${S.charMode} — ${charLabelOf(S.charMode)} (click to change)`
      : "Character filter: all (click to change)";
  }
  updateCharModeButtons();
  renderStatusBar();
}
function charPickerOptions() {
  let prefixes = Object.keys(S.chars || {}).sort();
  if (S.prefixIndex) {
    const found = new Set();
    for (const counts of Object.values(S.prefixIndex)) {
      for (const p of Object.keys(counts)) found.add(p);
    }
    prefixes = [...found].sort();
  }
  return prefixes.map((p) => ({ value: p, label: `${p} — ${charLabelOf(p)}`, count: charTableCount(p) }));
}
function closeCharPicker() {
  const m = $("#charPicker");
  if (m) m.remove();
  document.removeEventListener("mousedown", dismissCharPicker, true);
  document.removeEventListener("keydown", escCharPicker, true);
}
function dismissCharPicker(e) {
  const m = $("#charPicker");
  if (m && !m.contains(e.target) && !(e.target.closest && e.target.closest("#btnCharFilter"))) closeCharPicker();
}
function escCharPicker(e) {
  if (e.key === "Escape") closeCharPicker();
}
function toggleCharPicker(anchor, above) {
  if ($("#charPicker")) { closeCharPicker(); return; }
  const btn = anchor || $("#btnCharFilter");
  const r = (btn && btn.getBoundingClientRect) ? btn.getBoundingClientRect() : { left: 8, bottom: 120, top: 100 };
  const div = document.createElement("div");
  div.id = "charPicker";
  div.innerHTML = `<input id="charPickerSearch" type="text" placeholder="Filter characters…" autocomplete="off">` +
    `<div class="cp-list" id="charPickerList"></div>`;
  document.body.appendChild(div);
  const paint = (q) => {
    const query = (q || "").toLowerCase();
    const opts = charPickerOptions().filter((o) => !query || o.value.toLowerCase().includes(query) || o.label.toLowerCase().includes(query));
    $("#charPickerList", div).innerHTML =
      `<div class="cp-item${!S.charMode ? " sel" : ""}" data-char="">All characters</div>` +
      (opts.map((o) => `<div class="cp-item${S.charMode === o.value ? " sel" : ""}" data-char="${esc(o.value)}"><span>${esc(o.label)}</span>${o.count !== null && o.count !== undefined ? `<span class="ct">${o.count}t</span>` : ""}</div>`).join("") || `<div class="empty-note" style="padding:12px">No matches</div>`);
  };
  paint("");
  const search = $("#charPickerSearch", div);
  search.addEventListener("input", () => paint(search.value));
  div.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 272))}px`;
  div.style.top = above
    ? `${Math.max(8, r.top - 336)}px`
    : `${Math.min(r.bottom + 4, window.innerHeight - 240)}px`;
  div.addEventListener("click", (e) => {
    const it = e.target.closest("[data-char]");
    if (!it) return;
    const v = it.dataset.char;
    closeCharPicker();
    guard(() => setCharMode(v), v ? "Switching character…" : undefined);
  });
  setTimeout(() => {
    document.addEventListener("mousedown", dismissCharPicker, true);
    document.addEventListener("keydown", escCharPicker, true);
  }, 0);
  search.focus();
}

async function ensureCharData() {
  if (S.prefixIndex && Object.keys(S.paramVanillaIds).length > 0) return;
  try {
    const d = await call("tables:prefix-index");
    S.prefixIndex = d.index || {};
    try {
      const all = {};
      for (const a of S.paramAssets) {
        const v = await call("param:vanilla", a.shortName);
        all[a.shortName] = v.ids || [];
      }
      S.paramVanillaIds = all;
    } catch {
      /* vanilla unavailable */
    }
    populateCharSelect();
    renderScopeList();
  } catch (err) {
    toast(`Character index: ${err.message}`, "warn");
  }
}

function paramMatchesChar(short, projectRows) {
  if (!S.charMode) return true;
  const ids = S.paramVanillaIds[short] || [];
  if (ids.some((id) => id.startsWith(S.charMode))) return true;
  return (projectRows || []).some((id) => id.startsWith(S.charMode));
}

async function setCharMode(prefix) {
  S.charMode = prefix || "";
  S.rowOffset = 0;
  S.rowSearch = "";
  try {
    S.config = await call("settings:save", { charMode: S.charMode });
  } catch {
    /* non-fatal */
  }
  populateCharSelect();
  if (!S.charMode) {
    renderScopeList();
    return;
  }
  if (!S.prefixIndex) {
    busy("Indexing character rows (one-time)…");
    try {
      await ensureCharData();
    } finally {
      idle();
    }
  }
  // Existing tabs keep their own filters. Jump to the first scope containing
  // this character's rows.
  let target = null;
  if (S.prefixIndex) {
    const hit = S.tables.find((t) => S.prefixIndex[t.file] && S.prefixIndex[t.file][S.charMode]);
    if (hit) target = { kind: "table", file: hit.file };
  }
  if (!target) {
    const p = S.paramAssets.find((a) => paramMatchesChar(a.shortName, projectParamRows(a.shortName)));
    if (p) target = { kind: "param", short: p.shortName };
  }
  if (target) {
    await selectScope(target);
  } else {
    toast(`${S.charMode} has no rows in any table or parameter file`, "warn");
    renderScopeList();
  }
}

function projectParamRows(short) {
  const p = S.project && S.project.parameters && S.project.parameters[short];
  if (!p || !p.rows) return [];
  return Object.keys(p.rows).filter((k) => k.charAt(0) !== "$");
}

// ---------------- character registry ----------------
async function showCharacters() {
  await guard(async () => {
    busy("Loading characters…");
    let chars = [];
    try {
      chars = (await call("chars:list")).chars || [];
    } finally {
      idle();
    }
    const box = showModal(`<h2>Characters</h2>` +
      `<div class="mrow"><label>Register a new character ID (e.g. a mod character like CP_300) so it gets a name everywhere — picker, filters, badges.</label></div>` +
      `<div class="rule-grid" style="grid-template-columns:140px 1fr auto"><div><label>ID (CN_xxx / CP_xxx)</label><input id="newCharId" placeholder="CP_300"></div>` +
      `<div><label>Name</label><input id="newCharName" placeholder="Urame"></div>` +
      `<div><label>&nbsp;</label><button class="small primary" id="btnCharAdd">Add</button></div></div>` +
      `<div class="mrow"><label>Search</label><input id="charSearch" type="text" placeholder="Filter by ID or name…"></div>` +
      `<div class="mrow"><div id="charRows" style="max-height:320px;overflow-y:auto"></div></div>` +
      `<div class="mfoot"><button data-x="ok" class="primary">Done</button></div>`, true);
    const renderRows = (q) => {
      const query = (q || "").toLowerCase();
      const rows = chars.filter((c) => !query || c.prefix.toLowerCase().includes(query) || (c.name || "").toLowerCase().includes(query));
      $("#charRows", box).innerHTML = rows.map((c) =>
        `<div class="kv-row" style="grid-template-columns:86px 1fr auto auto" data-char="${esc(c.prefix)}">` +
        `<span style="font-family:var(--mono);font-size:12px">${esc(c.prefix)}</span>` +
        `<input type="text" data-cname="${esc(c.prefix)}" value="${esc(c.name || "")}" title="Rename (creates a custom entry${c.source === "vanilla" ? ", shadowing the built-in name" : ""})">` +
        `<span class="badge ${c.source === "custom" ? "new" : ""}" style="${c.source === "custom" ? "" : "background:#1a1e2c;color:var(--dim);border:1px solid var(--border)"}">${esc(c.source)}${c.tables ? ` · ${c.tables}t` : ""}</span>` +
        (c.source === "custom"
          ? `<button class="small danger" data-cdel="${esc(c.prefix)}">×</button>`
          : `<span></span>`) +
        `</div>`,
      ).join("") || `<div class="empty-note">No matches</div>`;
    };
    renderRows("");
    $("#charSearch", box).addEventListener("input", (e) => renderRows(e.target.value));
    const refreshAll = async (merged) => {
      if (merged) S.chars = merged;
      populateCharSelect();
      renderScopeList();
      renderCenter();
    };
    box.addEventListener("click", async (e) => {
      const x = e.target.dataset && e.target.dataset.x;
      if (x === "ok") closeModal();
      if (e.target.id === "btnCharAdd") {
        const id = $("#newCharId", box).value;
        const name = $("#newCharName", box).value;
        await guard(async () => {
          const d = await call("chars:set", id, name);
          chars = (await call("chars:list")).chars || [];
          renderRows($("#charSearch", box).value);
          $("#newCharId", box).value = "";
          $("#newCharName", box).value = "";
          toast(`${String(id).toUpperCase()} registered`, "success");
          refreshAll(d.chars);
        });
        return;
      }
      const del = e.target.dataset && e.target.dataset.cdel;
      if (del) {
        await guard(async () => {
          const d = await call("chars:delete", del);
          chars = (await call("chars:list")).chars || [];
          renderRows($("#charSearch", box).value);
          refreshAll(d.chars);
        });
      }
    });
    box.addEventListener("change", async (e) => {
      const input = e.target.dataset && e.target.dataset.cname;
      if (!input) return;
      await guard(async () => {
        const d = await call("chars:set", input, e.target.value);
        chars = (await call("chars:list")).chars || [];
        renderRows($("#charSearch", box).value);
        refreshAll(d.chars);
      });
    });
  });
}

// ---------------- left: scope list ----------------
function renderScopeList() {
  refreshHistory();
  const q = ($("#scopeSearch").value || "").toLowerCase();
  const list = $("#scopeList");
  $$("#leftTabs button").forEach((b) => b.classList.toggle("active", b.dataset.ltab === S.leftTab));
  const modeBanner = S.charMode
    ? `<div class="group-h">Filtered to ${esc(S.charMode)} — ${esc(charLabelOf(S.charMode))}</div>`
    : "";
  const t = activeTab();
  const activeKey = t ? (t.kind === "param" ? `param:${t.short}` : `table:${t.file}`) : "";
  if (S.leftTab === "params") {
    const pbody = S.paramAssets
      .filter((a) => !q || a.shortName.toLowerCase().includes(q) || a.assetName.toLowerCase().includes(q))
      .filter((a) => paramMatchesChar(a.shortName, projectParamRows(a.shortName)))
      .map((a) => {
        const rows = (S.project && S.project.parameters && S.project.parameters[a.shortName] && S.project.parameters[a.shortName].rows) || {};
        const n = Object.keys(rows).filter((k) => k.charAt(0) !== "$").length;
        const isActive = activeKey === `param:${a.shortName}`;
        return `<div class="scope-item${isActive ? " active" : ""}" data-pshort="${esc(a.shortName)}">` +
          `<span class="dot ${n ? "changed" : "none"}"></span>` +
          `<span class="nm" title="${esc(a.assetName)} (${esc(a.shortName)}.json)">${esc(a.shortName)}</span>` +
          `<span class="ct">${n}</span></div>`;
      }).join("");
    list.innerHTML = modeBanner + (pbody || (S.charMode
      ? `<div class="empty-note">No parameter files contain ${esc(S.charMode)} rows.</div>`
      : `<div class="empty-note">No parameters</div>`));
    return;
  }
  const groups = {};
  const mode = S.charMode;
  const idxReady = !mode || (S.prefixIndex && Object.keys(S.prefixIndex).length > 0);
  for (const tbl of S.tables) {
    if (q && !tbl.file.toLowerCase().includes(q)) continue;
    let matchCount = null;
    if (mode && idxReady) {
      matchCount = (S.prefixIndex[tbl.file] && S.prefixIndex[tbl.file][mode]) || 0;
      if (!matchCount) continue;
    }
    tbl._matchCount = matchCount;
    (groups[tbl.groupLabel] = groups[tbl.groupLabel] || []).push(tbl);
  }
  const names = Object.keys(groups).sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
  const body = names.map((g) =>
    `<div class="group-h">${esc(g)}</div>` +
    groups[g].map((tbl) => {
      const c = S.changed[tbl.file];
      const isActive = activeKey === `table:${tbl.file}`;
      const dot = c ? "changed" : "none";
      const badge = c
        ? `<span class="ct">${(c.rules || 0) + (c.overrides || 0) + (c.newRows || 0)}</span>`
        : (tbl._matchCount !== null && tbl._matchCount !== undefined ? `<span class="ct">${tbl._matchCount}</span>` : `<span class="ct">${tbl.rows}</span>`);
      return `<div class="scope-item${isActive ? " active" : ""}" data-tfile="${esc(tbl.file)}">` +
        `<span class="dot ${dot}"></span><span class="nm" title="${esc(tbl.file)}">${esc(tbl.file.replace(/\.json$/i, ""))}</span>${badge}</div>`;
    }).join(""),
  ).join("");
  list.innerHTML = modeBanner + (body || (S.charMode
    ? `<div class="empty-note">No tables contain ${esc(S.charMode)} rows.</div>`
: `<div class="empty-note">No tables found. Run npm run vendor-input-json, then restart.</div>`));
}

// ---------------- tabs: open / activate / close ----------------
function makeTab(kind, key) {
  return {
    id: newTabId(),
    kind,
    file: kind === "param" ? null : key,
    short: kind === "param" ? key : null,
    // A new tab snapshots the current global character filter, then keeps it
    // even after that filter is turned off. Rules tabs never take one:
    // global rules are always evaluated against every row.
    charPrefix: kind === "rules" ? "" : (S.charMode || ""),
    statusFilter: "all",
    search: "",
    visibleFields: null,
    rowOffset: 0,
    rowTotal: 0,
    rowList: [],
    expanded: {},
    expandOrder: [],
    schema: null,
    docSummary: null,
    paramComment: "",
    rowsLoaded: false,
  };
}

// selectScope(scope) — legacy entry point, now opens/focuses a tab.
async function selectScope(scope, opts) {
  const keep = opts || {};
  if (!scope) return;
  if (keep.keepTab === "rules" && scope.kind === "table") {
    await openRulesTab(scope.file);
    return;
  }
  if (scope.kind === "table") {
    // Reuse the tab matching the current global filter; otherwise open
    // another tab for the same file with the new scope.
    let t = findTableTab(scope.file, S.charMode || "");
    if (!t) {
      t = makeTab("table", scope.file);
      S.tabs.push(t);
    }
    S.activeTabId = t.id;
    syncLegacyScope();
    renderScopeList();
    await guard(async () => {
      busy("Loading...");
      try {
        if (!t.schema) {
          const d = await call("table:schema", scope.file);
          t.schema = d.schema;
          t.docSummary = d.docs;
          const needed = new Set();
          for (const f of Object.values(d.schema.fields || {})) {
            if (f.enumName && (!S._enumsMap[f.enumName] || S._enumsMap[f.enumName].members.length === 0)) needed.add(f.enumName);
          }
          await Promise.all([...needed].map(ensureEnumMembers));
        }
        await loadTabRows(t, true);
        syncLegacyScope();
        renderCenter();
        if (keep.keepRow) await expandRow(t, keep.keepRow);
      } finally {
        idle();
      }
    });
  } else {
    let t = findParamTab(scope.short, S.charMode || "");
    if (!t) {
      t = makeTab("param", scope.short);
      S.tabs.push(t);
    }
    S.activeTabId = t.id;
    syncLegacyScope();
    renderScopeList();
    await guard(async () => {
      busy("Loading...");
      try {
        await loadTabRows(t, true);
        syncLegacyScope();
        renderCenter();
        if (keep.keepRow) await expandRow(t, keep.keepRow);
      } finally {
        idle();
      }
    });
  }
}

async function openRulesTab(file) {
  let t = findTab("rules", file);
  if (!t) {
    t = makeTab("rules", file);
    t.kind = "rules";
    t.file = file;
    S.tabs.push(t);
  }
  t.charPrefix = ""; // global rules are never character scoped.
  S.activeTabId = t.id;
  syncLegacyScope();
  renderScopeList();
  await guard(async () => {
    busy("Loading rules...");
    try {
      if (!t.schema) {
        const d = await call("table:schema", file);
        t.schema = d.schema;
        t.docSummary = d.docs;
        await prefillEnumsFor(t.schema);
      }
      syncLegacyScope();
      renderCenter();
    } finally {
      idle();
    }
  });
}

function activateTab(id) {
  if (!S.tabs.some((t) => t.id === id)) return;
  S.activeTabId = id;
  syncLegacyScope();
  renderScopeList();
  renderCenter();
  // Tabs restored from the project start unloaded: fetch on first visit.
  const t = activeTab();
  const needsLoad = t && (t.kind === "rules" ? !t.schema : !t.rowsLoaded);
  if (needsLoad) {
    ensureTabLoaded(t, true).then(() => {
      if (S.activeTabId === id) { syncLegacyScope(); renderCenter(); }
    });
  }
}

function closeTab(id) {
  const i = S.tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  S.tabs.splice(i, 1);
  if (S.activeTabId === id) {
    const next = S.tabs[Math.min(i, S.tabs.length - 1)];
    S.activeTabId = next ? next.id : null;
  }
  syncLegacyScope();
  renderScopeList();
  renderCenter();
}

function closeOtherTabs(id) {
  S.tabs = S.tabs.filter((t) => t.id === id);
  S.activeTabId = id;
  syncLegacyScope();
  renderScopeList();
  renderCenter();
}

function renderTabStrip() {
  const strip = $("#tabStrip");
  if (!strip) return;
  strip.innerHTML = S.tabs.map((t) => {
    const dirty = isTabDirty(t);
    const kindChip = t.kind === "rules" ? `<span class="tk rules">RULES</span>`
      : t.kind === "param" ? `<span class="tk">PARAM</span>` : "";
    return `<div class="tab${t.id === S.activeTabId ? " active" : ""}${dirty ? " dirty" : ""}" data-tab="${t.id}" role="tab" title="${esc(tabTitle(t))}${t.charPrefix ? ` · filter ${esc(t.charPrefix)}` : ""}">` +
      (dirty ? `<span class="dot-dirty" title="Edited"></span>` : "") +
      `${kindChip}<span class="tt">${esc(tabTitle(t))}</span>` +
      (t.charPrefix ? `<span class="char-tag">${esc(t.charPrefix)}</span>` : "") +
      `<button class="tx" data-closetab="${t.id}" title="Close tab">×</button></div>`;
  }).join("");
}

// ---------------- center ----------------
function renderCenter() {
  syncLegacyScope();
  renderTabStrip();
  const has = !!activeTab();
  $("#tabContent").style.display = has ? "" : "none";
  $("#emptyTabs").classList.toggle("hidden", has);
  if (!has) {
    $("#scopeHeader").innerHTML = "";
    $("#centerBody").innerHTML = "";
    renderFilterPanel();
    renderStatusBar();
    return;
  }
  renderScopeHeader();
  renderTabBody();
  renderFilterPanel();
  updateDirtyState();
}

function scopeTitle() {
  const t = activeTab();
  if (!t) return "No scope";
  return tabTitle(t);
}

function statusFilterOptions(tab) {
  if (tab.kind === "param") {
    return [
      ["all", "All rows"],
      ["edited", "In mod"],
      ["vanilla", "Vanilla only"],
    ];
  }
  return [
    ["all", "All rows"],
    ["edited", "Edited"],
    ["new", "New"],
    ["vanilla", "Vanilla (unchanged)"],
  ];
}

function renderScopeHeader() {
  const h = $("#scopeHeader");
  const t = activeTab();
  if (!t) {
    h.innerHTML = "";
    h.style.display = "none";
    return;
  }
  if (t.kind === "rules") {
    h.innerHTML = `<div class="filter-row">` +
      `<button class="small" id="btnAddRule">+ Add rule</button>` +
      `</div>`;
    h.style.display = "";
    return;
  }
  if (t.kind === "param") {
    const a = S.paramAssets.find((x) => x.shortName === t.short) || {};
    h.innerHTML = (a.desc ? `<div class="desc">${esc(a.desc)}</div>` : "");
    h.style.display = h.innerHTML.trim() ? "" : "none";
  return;
  }
  const doc = t.docSummary && t.docSummary.tableDesc
    ? `<div class="desc">${esc(t.docSummary.tableDesc)}</div>` : "";
  h.innerHTML = `${doc}`;
  h.style.display = h.innerHTML.trim() ? "" : "none";
}


function fieldOrderOf(tab) {
  if (!tab || tab.kind === "rules") return [];
  if (tab.kind === "table") return (tab.schema && tab.schema.fieldOrder) || [];
  if (tab.expandOrder.length && tab.expanded[tab.expandOrder[0]]) {
    const sch = tab.expanded[tab.expandOrder[0]].schema;
    return (sch && sch.fieldOrder) || [];
  }
  return [];
}
function updateFab() {
  const fab = $("#fabFilters");
  if (!fab) return;
  const t = activeTab();
  const show = !!t && t.kind !== "rules";
  const stack = $("#fabStack");
  if (stack) stack.style.display = show ? "" : "none";
  else fab.style.display = show ? "" : "none";
  if (!show) return;
  const order = fieldOrderOf(t);
  const filtersActive = (t.statusFilter && t.statusFilter !== "all") || !!t.search;
  const fieldsActive = t.visibleFields && order.length > 0 && t.visibleFields.length < order.length;
  fab.classList.toggle("glow", !!(filtersActive || fieldsActive));
}
function renderFilterPanel() {
  const panel = $("#filterPanel");
  const t = activeTab();
  if (!panel) return;
  if (!t || t.kind === "rules" || !S.showFilterPanel) {
    panel.classList.add("hidden");
    updateFab();
    return;
  }
  panel.classList.remove("hidden");
  const order = fieldOrderOf(t);
  const sel = new Set(t.visibleFields || order);
  const shownCount = t.visibleFields ? t.visibleFields.length : order.length;
  panel.innerHTML = '<div class="fp-sect"><h4>Filters</h4>' +
    '<label>Status</label>' +
    '<select id="fpStatus">' + statusFilterOptions(t).map(([v, l]) => '<option value="' + v + '"' + (t.statusFilter === v ? " selected" : "") + '>' + l + '</option>').join("") + '</select>' +
    '<label>Filter by name</label>' +
    '<input id="fpSearch" type="text" placeholder="Filter by name..." value="' + esc(t.search) + '" autocomplete="off">' +
    '</div><div class="fp-sect"><h4>Fields <span id="fpCount">' + shownCount + ' / ' + order.length + '</span></h4>' +
    '<div class="fp-btns"><button class="small" id="fpAll">Select all</button>' +
    '<button class="small" id="fpNone">Unselect all</button></div>' +
    (order.length
      ? '<div class="field-checks fp-checks">' + order.map((f) => '<label><input type="checkbox" data-fpfield="' + esc(f) + '"' + (sel.has(f) ? " checked" : "") + '>' + esc(f) + '</label>').join("") + '</div>'
      : '<div class="empty-note" style="padding:12px">Expand a row to load the field list.</div>') +
    '</div>';
  updateFab();
}

function renderCenterTabs() {}

// Legacy wrapper: some flows still call loadRows() — delegate to active tab.
async function loadRows(reset) {
  const t = activeTab();
  if (!t || t.kind === "rules") return;
  await loadTabRows(t, reset !== false);
  syncLegacyScope();
}

async function loadTabRows(tab, reset) {
  if (reset) tab.rowOffset = 0;
  if (tab.kind === "table") {
    // All rows load at once (no paging): loop the 2000-row IPC window.
    const all = [];
    let offset = 0;
    let total = 0;
    for (;;) {
      const d = await call("table:rows", tab.file, {
        charPrefix: tab.charPrefix,
        search: tab.search,
        offset,
        limit: 2000,
      });
      total = d.total;
      const got = d.rows || [];
      all.push(...got);
      offset += got.length;
      if (offset >= total || !got.length) break;
    }
    tab.rowTotal = total;
    tab.rowList = all;
    tab.rowsLoaded = true;
    return;
  }
  if (tab.kind === "param") {
    const d = await call("params:rows", tab.short);
    const q = (tab.search || "").toLowerCase();
    let ids = d.rows || [];
    if (q) ids = ids.filter((id) => id.toLowerCase().includes(q));
    let vanillaIds = d.vanillaIds || [];
    if (tab.charPrefix) {
      // Param tabs keep their snapshot filter too.
      ids = ids.filter((id) => id.startsWith(tab.charPrefix));
      vanillaIds = vanillaIds.filter((id) => id.startsWith(tab.charPrefix));
    }
    if (q) vanillaIds = vanillaIds.filter((id) => id.toLowerCase().includes(q));
    if (d.vanillaError && !q) toast(`Vanilla params unavailable: ${d.vanillaError}`, "warn");
    tab.rowTotal = ids.length + vanillaIds.length;
    tab.rowList = [
      ...ids.map((id) => ({ id, status: "edited", changeCount: 0, global: false, overrides: 0 })),
      ...vanillaIds.map((id) => ({ id, status: "vanilla", changeCount: 0, global: false, overrides: 0 })),
    ];
    tab.paramComment = d.comment || "";
    tab.rowsLoaded = true;
    return;
  }
}

function filteredRows(tab) {
  const f = tab.statusFilter || "all";
  if (f === "all") return tab.rowList;
  if (f === "edited") return tab.rowList.filter((r) => r.status === "edited");
  if (f === "new") return tab.rowList.filter((r) => r.status === "new");
  if (f === "vanilla") return tab.rowList.filter((r) => r.status !== "edited" && r.status !== "new");
  return tab.rowList;
}

function centerScroller(body) {
  const root = body || document.getElementById("centerBody");
  return root ? root.querySelector(":scope > .unified-wrap") : null;
}
function renderTabBody() {
  persistTabsSoon();
  const body = $("#centerBody");
  if (!body) return;
  const t = activeTab();
  if (!t) {
    body.innerHTML = "";
    S._renderedTabId = null;
    renderStatusBar();
    return;
  }
  if (t.kind === "rules") { renderStatusBar(); return void renderRulesTab(body, t); }
  renderUnifiedRows(body, t);
  renderStatusBar();
}

function updateDirtyState() {
  renderTabStrip();
  renderStatusBar();
  const el = $("#dirtyState");
  if (!el) return;
  const files = Object.keys(S.changed || {});
  let nParams = 0;
  if (S.project && S.project.parameters) {
    for (const p of Object.values(S.project.parameters)) {
      const rows = (p && p.rows) || {};
      if (Object.keys(rows).filter((k) => k.charAt(0) !== "$").length > 0) nParams++;
    }
  }
  const total = files.length + nParams;
  el.textContent = total ? `● ${total} file(s) edited` : "Clean";
  el.classList.toggle("dirty", total > 0);
}

// ---------------- unified row view (req 4) ----------------
function rowBadges(r) {
  if (!r) return "";
  if (r.status === "new") return `<span class="badge new">NEW</span>`;
  if (r.status === "edited") {
    let s = "";
    if (r.global) s += `<span class="badge global" title="Changed by global rule">G</span>`;
    if (r.overrides) s += `<span class="badge ov" title="Per-row override(s)">O${r.overrides}</span>`;
    return s;
  }
  return `<span class="badge vanilla">VANILLA</span>`;
}
function renderUnifiedRows(body, tab, opts) {
  // Rebuilding body.innerHTML destroys the .unified-wrap scroller, which
  // used to throw the user back to the top on every expand/collapse. Keep
  // the same tab's scroll position across re-renders; a different tab
  // restores its own last position (or starts at the top).
  const sameTab = S._renderedTabId === tab.id;
  let prev = null;
  const cur = body.querySelector(":scope > .unified-wrap");
  if (cur) {
    if (sameTab) {
      prev = { top: cur.scrollTop, left: cur.scrollLeft };
    } else if (S._renderedTabId) {
      const old = S.tabs.find((x) => x.id === S._renderedTabId);
      if (old) old._scrollTop = cur.scrollTop;
    }
  }
  const list = filteredRows(tab);
  let html = `<div class="unified-wrap">`;
  if (!list.length) html += `<div class="empty-note">No rows match. Adjust the filters.</div>`;
  html += list.map((r) => {
    const open = tab.expandOrder.includes(r.id);
    const data = tab.expanded[r.id];
    return `<div class="row-card${open ? " open" : ""}" data-card="${esc(r.id)}">` +
      `<div class="rh" data-toggle="${esc(r.id)}"><span class="chev">${open ? "\u25be" : "\u25b8"}</span>` +
      `<span class="rid">${esc(r.id)}</span>${rowBadges(r)}<button class="icon-btn" data-act="referenced-by" title="Show rows that reference this row">🔗</button></div>` +
      (open ? `<div class="rb">${data ? cardBodyHtml(tab, r.id, data) : `<div class="loading">Loading…</div>`}</div>` : "") + `</div>`;
  }).join("");

  body.innerHTML = html;
  const next = body.querySelector(":scope > .unified-wrap");
  if (next && !(opts && opts.resetScroll)) {
    if (sameTab && prev) {
      next.scrollTop = prev.top;
      next.scrollLeft = prev.left || 0;
    } else if (tab._scrollTop) {
      next.scrollTop = tab._scrollTop;
    }
  }
  S._renderedTabId = tab.id;
  for (const rowId of tab.expandOrder) {
    if (tab.expanded[rowId]) fillInlineDocs(tab, rowId);
  }
}
async function renderNewTab(body) {
  const t = activeTab();
  if (t && t.kind !== "rules") {
    if (t.statusFilter === "all") t.statusFilter = "new";
    renderScopeHeader();
    renderUnifiedRows(body, t);
  }
}
async function renderChangesTab(body) {
  const t = activeTab();
  if (t && t.kind !== "rules") {
    if (t.statusFilter === "all") t.statusFilter = "edited";
    renderScopeHeader();
    renderUnifiedRows(body, t);
  }
}
function renderRowsTab(body) {
  const t = activeTab();
  if (t) renderUnifiedRows(body, t);
}
async function openRow(rowId, focusField) {
  const t = activeTab();
  if (!t || t.kind === "rules") return;
  await expandRow(t, rowId, focusField, true);
}
function renderRight() {}
async function fetchRowData(tab, rowId) {
  if (tab.kind === "param") {
    const d = await call("param:get", tab.short, rowId);
    return { isParam: true, value: d.value, schema: d.schema, vanilla: d.vanilla, prov: d.prov || {}, exists: d.exists, isNew: d.isNew, vanillaError: d.vanillaError };
  }
  return call("row:get", tab.file, rowId);
}
function ensureSummary(tab, rowId, data) {
  let s = tab.rowList.find((x) => x.id === rowId);
  if (!s) {
    s = { id: rowId, status: data && data.isNew ? "new" : "vanilla", changeCount: 0, global: false, overrides: 0 };
    tab.rowList.unshift(s);
    tab.rowTotal = tab.rowList.length;
  }
  return s;
}
async function expandRow(tab, rowId, focusField, force) {
  if (rowId in tab.expanded) {
    if (S.activeTabId === tab.id) {
      renderTabBody();
      flashField(rowId, focusField);
    }
    return;
  }
  tab.expanded[rowId] = null;
  if (!tab.expandOrder.includes(rowId)) tab.expandOrder.push(rowId);
  if (S.activeTabId === tab.id) renderTabBody();
  try {
    const data = await fetchRowData(tab, rowId);
    tab.expanded[rowId] = data;
    ensureSummary(tab, rowId, data);
    if (S.activeTabId === tab.id) {
      syncLegacyScope();
      renderTabBody();
      renderFilterPanel();
      flashField(rowId, focusField);
    }
  } catch (err) {
    delete tab.expanded[rowId];
    tab.expandOrder = tab.expandOrder.filter((x) => x !== rowId);
    if (S.activeTabId === tab.id) renderTabBody();
    toast(err.message, "error");
  }
  void force;
}
function collapseRow(tab, rowId) {
  delete tab.expanded[rowId];
  tab.expandOrder = tab.expandOrder.filter((x) => x !== rowId);
  syncLegacyScope();
  renderTabBody();
  renderFilterPanel();
}
function flashField(rowId, focusField) {
  if (!focusField) return;
  const card = document.querySelector(`#centerBody [data-card="${CSS.escape(rowId)}"]`);
  if (!card) return;
  const el = card.querySelector(`[data-field="${CSS.escape(focusField)}"]`);
  if (el) {
    el.scrollIntoView({ block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 2200);
  }
}
async function jumpToRow(file, rowId, focusField) {
  // Prefer the tab that can actually show the row: matching scope first,
  // then an unscoped tab, then any open tab for the file.
  const open = S.tabs.filter((x) => x.kind === "table" && x.file === file);
  const rowPrefix = (String(rowId || "").match(/^(?:CN|CP)_\d{3}/) || [""])[0];
  let t = open.find((x) => (x.charPrefix || "") === rowPrefix)
    || open.find((x) => !x.charPrefix)
    || open[0];
  if (!t) {
    t = makeTab("table", file);
    t.charPrefix = rowPrefix; // new tab is opened for this row: scope it so the row is visible
    S.tabs.push(t);
  }
  S.activeTabId = t.id;
  syncLegacyScope();
  renderScopeList();
  await guard(async () => {
    busy("Loading...");
    try {
      if (!t.schema) {
        const d = await call("table:schema", file);
        t.schema = d.schema;
        t.docSummary = d.docs;
      }
      await loadTabRows(t, true);
      renderCenter();
      if (rowId && t.charPrefix && !rowId.startsWith(t.charPrefix)) {
        toast(`Target is outside this tab's ${t.charPrefix} filter \u2014 opening anyway`, "warn");
      }
      await expandRow(t, rowId, focusField, true);
    } finally {
      idle();
    }
  });
}
function cardBodyHtml(tab, rowId, rd) {
  if (rd.isParam) return paramBlocksHtml(tab, rowId, rd);
  if (rd.error) return `<div class="row-title">${esc(rowId)}</div><div class="err">Rule error: ${esc(rd.error)}</div>`;
  const acts = [];
  if (rd.isNew) {
    acts.push(`<span>New row${rd.base ? ` (cloned from ${esc(rd.base)})` : " (blank)"}</span>`);
    acts.push(`<button class="small danger" data-act="del-new">Delete row</button>`);
  } else if (hasAnyOverride(rd)) {
    acts.push(`<button class="small" data-act="revert-row">Revert row</button>`);
  }
  let enBtn = "";
  if (!rd.isNew) {
    const loc = baseFamilyOf(tab.file);
    const m = /_((?:Es_LA)|(?:Zh_Han[st])|De|En|Es|Fr|It|Ja|Ko|Pt)$/.exec(tab.file.replace(/\.json$/i, ""));
    const locale = m ? m[1] : (loc && null);
    if (locale && locale !== "En") enBtn = `<button class="small" data-act="propagate-en" title="Copy differing text fields from the English row">Copy EN text here</button>`;
  }
  if (enBtn) acts.push(enBtn);
  let html = `<datalist id="idcomplete"></datalist>` + (acts.length ? `<div class="row-sub">${acts.join(" · ")}</div>` : "");
  for (const f of visibleFieldOrder(tab, rd)) {
    const fs = ((tab.schema && tab.schema.fields) || {})[f] || { kind: "any" };
    const vanilla = rd.vanilla ? rd.vanilla[f] : undefined;
    const eff = rd.effective ? rd.effective[f] : undefined;
    const prov = rd.isNew ? "new" : ((rd.prov || {})[f] || "default");
    const fired = ((rd.fired || {})[f] || []);
    html += renderFieldBlock(tab, f, fs, vanilla, eff, prov, fired, rd.isNew);
  }
  return html;
}
function visibleFieldOrder(tab, rd) {
  const all = rowFieldOrderFor(rd, tab.schema);
  if (!tab.visibleFields) return all;
  const set = new Set(tab.visibleFields);
  return all.filter((f) => set.has(f));
}
function rowFieldOrderFor(rd, sch) {
  if (!rd) return [];
  const order = [];
  const seen = new Set();
  const push = (k) => { if (!seen.has(k)) { seen.add(k); order.push(k); } };
  if (rd.isParam) {
    if (rd.schema && rd.schema.fieldOrder) rd.schema.fieldOrder.forEach(push);
    if (rd.value && typeof rd.value === "object") Object.keys(rd.value).forEach(push);
    if (rd.vanilla && typeof rd.vanilla === "object") Object.keys(rd.vanilla).forEach(push);
    return order.filter((k) => k !== "(value)");
  }
  if (rd.isNew) {
    if (sch && sch.fieldOrder) sch.fieldOrder.forEach(push);
    if (rd.effective) Object.keys(rd.effective).forEach(push);
    return order;
  }
  if (sch && sch.fieldOrder) {
    for (const f of sch.fieldOrder) {
      if (rd.effective && Object.prototype.hasOwnProperty.call(rd.effective, f)) push(f);
    }
  }
  if (rd.effective) Object.keys(rd.effective).forEach(push);
  if (rd.vanilla) Object.keys(rd.vanilla).forEach(push);
  return order;
}
function rowFieldOrder() {
  return rowFieldOrderFor(S.rowData, S.schema);
}
function hasAnyOverride(rd) {
  return rd && rd.overrides && Object.keys(rd.overrides).length > 0;
}
function renderFieldBlock(tab, f, fs, vanilla, eff, prov, fired, isNew) {
  const cls = prov === "global" ? "changed-global" : prov === "override" ? "changed-override" : prov === "new" ? "is-new" : "";
  const typeLabel = fs.enumName ? `${fs.kind} \u00b7 ${fs.enumName}` : fs.kind;
  const ruleBadge = fired && fired.length ? `<span class="badge global" title="Global rule(s): ${esc(fired.join(", "))}">G${fired.length > 1 ? fired.length : ""}</span>` : "";
  const provBadge = prov === "override" ? `<span class="badge ov" title="Per-row override">O</span>` : "";
  const canReset = prov === "override";
  let was = "";
  if (!isNew && prov !== "default" && vanilla !== undefined) was = `<div class="was">vanilla: ${esc(shortVal(vanilla))}</div>`;
  const isIdField = /^Id_/.test(f) && f !== "ID";
  return `<div class="field ${cls}" data-field="${esc(f)}">` +
    `<div class="frow"><span class="prov ${prov}" title="provenance: ${prov}"></span>` +
    `<span class="fname" title="${esc(f)}">${esc(f)}${ruleBadge}${provBadge}</span>` +
    `<div class="fwidget">${renderWidget(f, fs, eff)}</div>` +
    `<span class="fact">` +
    `<button class="icon-btn info-btn" data-fact="info" data-finfo data-ftype="${esc(typeLabel)}" title="${esc(typeLabel)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><text x="12" y="16.5" text-anchor="middle" font-size="12" fill="currentColor" stroke="none">?</text></svg></button>` +
    (isIdField ? `<button class="icon-btn" data-fact="refs" title="Jump to referenced row">\u2192</button>` : "") +
    (canReset ? `<button class="icon-btn" data-fact="reset" title="Reset to global/vanilla value">\u21a9</button>` : "") +
    `</span></div>${was}</div>`;
}
function enumOptions(enumName, selectedRepr) {
  const e = enumsMap()[enumName];
  if (!e) return `<option value="">(unknown enum ${esc(enumName)})</option>`;
  const asNumber = typeof selectedRepr === "number";
  const placeholder = selectedRepr === undefined ? `<option value="">\u2014 pick \u2014</option>` : "";
  return placeholder + e.members.map((m) => {
    const val = asNumber ? m.value : `${enumName}::${m.name}`;
    const sel = selectedRepr !== undefined && String(selectedRepr) === String(val) ? "selected" : "";
    return `<option value="${esc(String(val))}" ${sel}>${esc(m.name)}${asNumber ? ` (${m.value})` : ""}</option>`;
  }).join("");
}
function enumsMap() {
  return S._enumsMap || {};
}
function renderWidget(f, fs, eff) {
  const kind = fs.kind || "any";
  if (kind === "boolean") return `<input type="checkbox" data-w="bool" data-f="${esc(f)}" ${eff ? "checked" : ""}>`;
  if (kind === "number") return `<input type="number" step="any" data-w="num" data-f="${esc(f)}" value="${eff === undefined || eff === null ? "" : esc(String(eff))}">`;
  if (kind === "enum" && fs.enumName && enumsMap()[fs.enumName]) {
    const asNumber = typeof eff === "number";
    return `<select data-w="${asNumber ? "enum-num" : "enum-str"}" data-f="${esc(f)}" data-enum="${esc(fs.enumName)}">${enumOptions(fs.enumName, eff)}</select>`;
  }
  if (kind === "enum[]" && fs.enumName && enumsMap()[fs.enumName]) {
    const e = enumsMap()[fs.enumName];
    const cur = Array.isArray(eff) ? eff.map(String) : [];
    const asNumber = cur.length > 0 && cur.every((x) => /^-?\d+$/.test(x));
    return `<div class="enum-checks">` + e.members.map((m) => {
      const val = asNumber ? String(m.value) : `${fs.enumName}::${m.name}`;
      const on = cur.includes(val) ? "checked" : "";
      return `<label title="${esc(`${fs.enumName}::${m.name} = ${m.value}`)}"><input type="checkbox" data-w="enum-arr" data-f="${esc(f)}" data-enum="${esc(fs.enumName)}" value="${esc(val)}" ${on}>${esc(m.name)}</label>`;
    }).join("") + `</div>`;
  }
  if (kind === "boolean[]") {
    const cur = Array.isArray(eff) ? eff : [];
    return `<div class="enum-checks">` + cur.map((v, i) => `<label><input type="checkbox" data-w="bool-arr" data-f="${esc(f)}" ${v ? "checked" : ""}>${i}</label>`).join("") + `</div>`;
  }
  if (kind === "string[]" || kind === "number[]") return arrayListWidget(f, eff, kind === "number[]");
  if (kind.endsWith("[]") || kind === "struct" || kind === "any") {
    const txt = eff === undefined ? "" : jsonText(eff);
    return `<textarea data-w="json" data-f="${esc(f)}" rows="${kind === "struct" ? 4 : 2}" spellcheck="false">${esc(txt)}</textarea>`;
  }
  const txt = eff === undefined || eff === null ? "" : String(eff);
  if (txt.length > 120 && !(/^Id_/.test(f) && f !== "ID")) return `<textarea data-w="str" data-f="${esc(f)}" rows="2">${esc(txt)}</textarea>`;
  return `<input type="text" data-w="str" data-f="${esc(f)}" value="${esc(txt)}"${/^Id_/.test(f) && f !== "ID" ? ` list="idcomplete" data-idfield="1"` : ""}>`;
}
function arrayListWidget(f, eff, numeric) {
  const arr = Array.isArray(eff) ? eff : [];
  const isId = /^Id_/.test(f) && f !== "ID" && !numeric;
  const rows = arr.map((v) => {
    const val = v === null || v === undefined ? "" : String(v);
    const attrs = numeric ? `type="number" step="any" data-w="list-num"` : `type="text" data-w="list-str"`;
    const idAttrs = isId ? ` list="idcomplete" data-idfield="1"` : "";
    return `<div class="arr-row"><input ${attrs} data-f="${esc(f)}" value="${esc(val)}"${idAttrs}><button class="small danger" data-arrdel title="Remove">×</button></div>`;
  }).join("");
  return `<div class="arr-list" data-f="${esc(f)}">${rows}<button class="small" data-arradd data-addkind="${numeric ? "num" : "str"}" data-addid="${isId ? "1" : ""}">+ add</button></div>`;
}
function jsonText(v) {
  try { return JSON.stringify(v, null, 1); } catch { return String(v); }
}
function readWidgetValue(container, f) {
  const els = $$('[data-f]', container).filter((el) => el.dataset.f === f && el.dataset.w);
  if (!els.length) return { missing: true };
  const first = els[0];
  const w = first.dataset.w;
  if (w === "bool") return { value: first.checked };
  if (w === "num") {
    if (first.value === "" || first.value === null) return { value: null };
    const n = Number(first.value);
    if (!Number.isFinite(n)) return { error: `${f}: not a number` };
    return { value: n };
  }
  if (w === "enum-num") return { value: Number(first.value) };
  if (w === "enum-str") return { value: first.value };
  if (w === "enum-arr") {
    const vals = els.filter((e) => e.checked).map((e) => e.value);
    const asNum = vals.length > 0 && vals.every((x) => /^-?\d+$/.test(x));
    return { value: asNum ? vals.map(Number) : vals };
  }
  if (w === "bool-arr") {
    return { value: els.map((e) => e.checked) };
  }
  if (w === "list-str") {
    return { value: els.map((e) => e.value) };
  }
  if (w === "list-num") {
    const vals = [];
    for (const e of els) {
      if (e.value === "" || e.value === null) return { error: `${f}: empty value is not a number` };
      const n = Number(e.value);
      if (!Number.isFinite(n)) return { error: `${f}: "${e.value}" is not a number` };
      vals.push(n);
    }
    return { value: vals };
  }
  if (w === "json") {
    const t = first.value.trim();
    if (!t) return { value: null };
    try { return { value: JSON.parse(t) }; } catch (err) { return { error: `${f}: invalid JSON (${err.message})` }; }
  }
  return { value: first.value };
}
async function commitFieldFor(tab, rowId, f, card) {
  const read = readWidgetValue(card, f);
  if (read.missing) return;
  if (read.error) { toast(read.error, "error"); return; }
  const ckey = `${tab.kind}:${tab.kind === "table" ? tab.file : tab.short}:${rowId}:${f}:${JSON.stringify(read.value)}`;
  if (S._lastCommitKey === ckey) return;
  S._lastCommitKey = ckey;
  await guard(async () => {
    const data = tab.expanded[rowId];
    if (data && data.isParam) {
      if (data.value === null || typeof data.value !== "object" || Array.isArray(data.value)) { toast("Row is a single value; editing whole row instead", "warn"); return; }
      const next = JSON.parse(JSON.stringify(data.value));
      setPathLocal(next, f, read.value);
      await call("param:set", tab.short, rowId, next);
      tab.expanded[rowId] = await normalizeParamData(tab, rowId);
      syncLegacyScope();
      renderTabBody();
      updateDirtyState();
      return;
    }
    const d = await call("row:set-field", tab.file, rowId, f, read.value);
    if (d.warning) toast(d.warning, "warn");
    S.changed = d.changed || S.changed;
    tab.expanded[rowId] = await call("row:get", tab.file, rowId);
    await loadTabRows(tab, true);
    syncLegacyScope();
    renderScopeHeader();
    renderTabBody();
    renderScopeList();
    updateDirtyState();
    updateProjChangeCount();
  });
}
async function normalizeParamData(tab, rowId) {
  const d = await call("param:get", tab.short, rowId);
  return { isParam: true, value: d.value, schema: d.schema, vanilla: d.vanilla, prov: d.prov || {}, exists: d.exists, isNew: d.isNew, vanillaError: d.vanillaError };
}
async function commitField(f) {
  const t = activeTab();
  if (!t || !S.selectedRow) return;
  const card = document.querySelector(`#centerBody [data-card="${CSS.escape(S.selectedRow)}"]`);
  if (!card) return;
  commitFieldFor(t, S.selectedRow, f, card);
}
function renderRowEditor() {
  const t = activeTab();
  if (t) renderTabBody();
}
function setPathLocal(obj, p, v) {
  const segs = String(p).split(".");
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur[segs[i]] === null || typeof cur[segs[i]] !== "object") cur[segs[i]] = {};
    cur = cur[segs[i]];
  }
  cur[segs[segs.length - 1]] = v;
  return obj;
}
function paramBlocksHtml(tab, rowId, rd) {
  const v = rd.value;
  const sch = rd.schema || { fields: {}, fieldOrder: [] };
  if (!rd.exists) {
    let html = `<div class="row-title">${esc(rowId)} <span class="badge" style="background:#1a1e2c;color:var(--dim);border:1px solid var(--border)">VANILLA</span></div>` +
      `<div class="row-sub">vanilla value from cooked uasset \u00b7 <button class="small" data-pact="clone-vanilla">Clone as new row…</button></div>`;
    if (rd.vanillaError) html += `<div class="err">Vanilla unavailable: ${esc(rd.vanillaError)}</div>`;
    html += `<div class="field"><div class="fwidget"><textarea rows="10" readonly spellcheck="false">${esc(jsonText(rd.vanilla))}</textarea></div></div>`;
    return html;
  }
  let html = `<div class="row-sub">parameters/${esc(tab.short)}.json \u00b7 <button class="small danger" data-pact="del">Delete row</button> <button class="small" data-pact="dup">Duplicate as new…</button></div>`;
  if (rd.vanillaError) html += `<div class="warn">Vanilla unavailable: ${esc(rd.vanillaError)} (no baseline shown)</div>`;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    const prov = (rd.prov && rd.prov["(value)"]) || (rd.isNew ? "new" : "default");
    html += `<div class="field ${prov === "override" ? "changed-override" : prov === "new" ? "is-new" : ""}">` +
      `<div class="frow"><span class="prov ${prov}"></span><span class="fname">(value)</span>` +
      `<div class="fwidget"><input type="text" data-pscalar value="${esc(String(v))}"></div>` +
      `<span class="fact"><button class="small" data-pact="save-scalar">Save</button></span></div>` +
      (rd.vanilla !== null && rd.vanilla !== undefined && !rd.isNew ? `<div class="was">vanilla: ${esc(shortVal(rd.vanilla))}</div>` : "") + `</div>`;
  } else if (v && typeof v === "object") {
    const order = rowFieldOrderFor(rd, null).filter((k) => !tab.visibleFields || tab.visibleFields.includes(k));
    for (const f of order) {
      if (f === "entries" && v.entries && typeof v.entries === "object") continue;
      const top = f.split(".")[0];
      const fs = (sch.fields || {})[top] || (sch.fields || {})[f] || { kind: "any" };
      const vanilla = rd.vanilla && typeof rd.vanilla === "object" ? rd.vanilla[top] : undefined;
      html += renderFieldBlock(tab, f, fs, vanilla, v[f], rd.isNew ? "new" : ((rd.prov || {})[f] || "default"), [], false);
    }
    if (v.entries && typeof v.entries === "object") {
      html += `<div class="row-sub" style="margin-top:6px">entries (per image entry offsets)</div>`;
      for (const ek of Object.keys(v.entries).sort()) {
        const prov = rd.isNew ? "new" : ((rd.prov || {})[`entries.${ek}`] || (rd.prov && rd.prov.entries) || "default");
        const vanilla = rd.vanilla && rd.vanilla.entries ? rd.vanilla.entries[ek] : undefined;
        html += renderFieldBlock(tab, `entries.${ek}`, { kind: "struct" }, vanilla, v.entries[ek], prov === "override" || prov === "new" ? prov : "default", [], false);
      }
    }
  } else {
    html += `<div class="empty-note">Empty row</div>`;
  }
  return html;
}
function docsBaseOf(tab) {
  if (tab.kind === "param") return `parameters.${tab.short}`;
  return baseFamilyOf(tab.file).base;
}
function docsFamilyOf(tab) {
  if (tab.kind === "param") return `parameters.${tab.short}`;
  return baseFamilyOf(tab.file).family;
}
function fieldSchemaOf(field) {
  const t = activeTab();
  if (!t) return null;
  const sch = t.kind === "param"
    ? (t.expandOrder.length && t.expanded[t.expandOrder[0]] ? t.expanded[t.expandOrder[0]].schema : null)
    : t.schema;
  if (!sch || !sch.fields) return null;
  const top = String(field).split(".")[0];
  return sch.fields[top] || sch.fields[field] || null;
}
async function fillInlineDocs(tab, rowId) {
  const base = docsBaseOf(tab);
  const family = docsFamilyOf(tab);
  // Details buttons (header Details + inline More) only appear when the
  // field actually has documentation content: a description or enum notes.
  const paint = () => {
    const live = document.querySelector(`#centerBody [data-card="${CSS.escape(rowId)}"]`);
    if (!live) return;
    for (const s of $$("[data-field]", live)) {
      const f = s.dataset.field;
      if (!f) continue;
      const hit = S.docsCache[`${base}.${f}`];
      if (!hit) continue;
      const info = s.querySelector("[data-finfo]");
      if (!info) continue;
      const typeLabel = info.dataset.ftype || "";
      info.title = hit.desc ? `${typeLabel} — ${hit.desc.length > 300 ? hit.desc.slice(0, 300) + "…" : hit.desc}` : typeLabel;
    }
  };
  paint();
  const card = document.querySelector(`#centerBody [data-card="${CSS.escape(rowId)}"]`);
  if (!card) return;
  const missing = [...new Set($$("[data-field]", card).map((el) => el.dataset.field).filter((f) => f && !S.docsCache[`${base}.${f}`]))];
  if (!missing.length) return;
  try {
    await Promise.all(missing.map(async (f) => {
      const fs = tab.kind === "param" ? null : ((tab.schema && tab.schema.fields) || {})[String(f).split(".")[0]];
      const d = await call("docs:field", base, family, f, (fs && fs.enumName) || null);
      const desc = (d.field && d.field.desc) || "";
      const hasEnum = !!(d.enum && d.enum.members && d.enum.members.length);
      const hasEnumNotes = !!(d.enum && d.enum.members && d.enum.members.some((m) => m.desc && String(m.desc).trim()));
      S.docsCache[`${base}.${f}`] = { desc, source: (d.field && d.field.source) || "none", hasEnum, hasEnumNotes, hasMore: desc.length > 140 || hasEnum, hasContent: desc.length > 0 || hasEnumNotes };
    }));
    if (S.activeTabId === tab.id) paint();
  } catch { /* docs best-effort */ }
}
async function showFieldPopup(tab, rowId, field) {
  const fs = fieldSchemaOf(field) || { kind: "any" };
  const enumName = fs && fs.enumName;
  const base = docsBaseOf(tab);
  const family = docsFamilyOf(tab);
  const data = tab.expanded[rowId];
  const sample = data && !data.isNew && !data.isParam ? (data.vanilla || {})[field] : data && (data.effective || {})[field];
  await guard(async () => {
    const d = await call("docs:field", base, family, field, enumName || null);
    const fullDesc = (d.field && d.field.desc) || "";
    const fullHasEnum = !!(d.enum && d.enum.members && d.enum.members.length);
    const fullHasEnumNotes = !!(d.enum && d.enum.members && d.enum.members.some((m) => m.desc && String(m.desc).trim()));
    S.docsCache[`${base}.${field}`] = { desc: fullDesc, source: (d.field && d.field.source) || "none", hasEnum: fullHasEnum, hasEnumNotes: fullHasEnumNotes, hasMore: fullDesc.length > 140 || fullHasEnum, hasContent: fullDesc.length > 0 || fullHasEnumNotes };
    const box = showModal(`<h2>${esc(field)}</h2>` +
      `<div class="mrow"><label>Type</label><div class="fdoc-full" style="font-family:var(--mono);font-size:12px">${esc(fs.enumName ? `${fs.kind} \u00b7 ${fs.enumName}` : fs.kind)}</div></div>` +
      (sample !== undefined ? `<div class="mrow"><label>Vanilla sample</label><div class="fdoc-full" style="font-family:var(--mono);font-size:12px;word-break:break-all">${esc(shortVal(sample, 300))}</div></div>` : "") +
      `<div class="mrow"><label>Description</label><textarea id="fdocText" rows="4">${esc(d.field.desc || "")}</textarea>` +
      `<div class="src">source: ${esc(d.field.source || "none")} \u00b7 stored in field-docs.json</div>` +
      `<div style="margin-top:4px"><button class="small primary" id="btnSaveFdoc">Save description</button></div></div>` +
      `<div id="fdocEnum"></div><div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    if (d.enum) {
      $("#fdocEnum", box).innerHTML = `<div class="mrow"><label>Enum members \u2014 ${esc(d.enum.name)} (what each value means)</label>` +
        d.enum.members.map((m) => `<div class="member-doc"><div class="mname">${esc(m.name)} = ${m.value}</div>` +
          `<textarea data-enumm="${esc(m.name)}" placeholder="What does this value do?">${esc(m.desc || "")}</textarea></div>`).join("") +
        `<button class="small primary" id="btnSaveEnumDocs" style="margin-top:4px">Save enum notes</button></div>`;
    }
    box.addEventListener("click", async (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      if (e.target.id === "btnSaveFdoc") {
        await guard(async () => {
          await call("docs:save-field", base, field, $("#fdocText", box).value);
          const prevDoc = S.docsCache[`${base}.${field}`] || {};
          const newDesc = $("#fdocText", box).value;
          S.docsCache[`${base}.${field}`] = { desc: newDesc, source: newDesc ? "custom" : "none", hasEnum: !!prevDoc.hasEnum, hasEnumNotes: !!prevDoc.hasEnumNotes, hasMore: newDesc.length > 140 || !!prevDoc.hasEnum, hasContent: newDesc.length > 0 || !!prevDoc.hasEnumNotes };
          toast("Description saved to field-docs.json", "success");
          if (S.activeTabId === tab.id) renderTabBody();
        });
      }
      if (e.target.id === "btnSaveEnumDocs" && d.enum) {
        const updates = $$("[data-enumm]", box).map((el) => [el.dataset.enumm, el.value]);
        await guard(async () => {
          for (const [member, desc] of updates) await call("docs:save-enum", d.enum.name, member, desc);
          const anyNotes = updates.some(([, desc]) => String(desc || "").trim());
          const prevEnum = S.docsCache[`${base}.${field}`] || {};
          const curDesc = prevEnum.desc || "";
          S.docsCache[`${base}.${field}`] = { desc: curDesc, source: prevEnum.source || "none", hasEnum: true, hasEnumNotes: anyNotes, hasMore: curDesc.length > 140 || true, hasContent: curDesc.length > 0 || anyNotes };
          toast(`Enum notes saved (${d.enum.name})`, "success");
          if (S.activeTabId === tab.id) renderTabBody();
        });
      }
    });
  });
}
async function showFieldDocs(field) {
  const t = activeTab();
  if (!t || t.kind === "rules") return;
  const rowId = t.expandOrder[t.expandOrder.length - 1] || t.expandOrder[0];
  if (!rowId) return;
  showFieldPopup(t, rowId, field);
}
async function showRefTargets(field) {
  const t = activeTab();
  if (!t || t.kind !== "table") return;
  const rowId = t.expandOrder[t.expandOrder.length - 1];
  if (!rowId) return;
  await guard(async () => {
    busy("Resolving references…");
    let data = null;
    try { data = await call("refs:targets", t.file, rowId); } finally { idle(); }
    const entry = (data.refs || []).find((r) => r.field === field);
    if (!entry) { toast("No references in this field", "warn"); return; }
    const box = showModal(`<h2>${esc(rowId)} \u2192 ${esc(field)}</h2>` +
      entry.values.map((v) => `<div class="mrow"><label>${esc(shortVal(v.value, 100))}</label>` +
        ((v.targets || []).length ? v.targets.map((x) => `<div class="diff-row"><div class="dh"><span style="flex:1">${esc(x.file)} :: ${esc(x.rowId)}</span>` +
          (x.isNew ? `<span class="badge new">NEW</span>` : "") +
          `<button class="small" data-jump="${esc(x.file)}|${esc(x.rowId)}">Open</button></div></div>`).join("")
          : `<div class="err">Resolves nowhere (dangling reference)</div>`) + `</div>`).join("") +
      `<div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    box.addEventListener("click", (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      const j = e.target.dataset && e.target.dataset.jump;
      if (j) { const i = j.indexOf("|"); closeModal(); jumpToRow(j.slice(0, i), j.slice(i + 1)); }
    });
  });
}
async function showReferencedBy(value) {
  await guard(async () => {
    busy("Scanning references…");
    let refs = [];
    try { refs = (await call("refs:referenced-by", value)).refs || []; } finally { idle(); }
    const direct = refs.filter((r) => !r.sameId);
    const same = refs.filter((r) => r.sameId);
    const refRowHtml = (r) => `<div class="diff-row"><div class="dh"><span style="flex:1">${esc(r.file)} :: ${esc(r.rowId)} <span style="color:var(--dim)">${esc(r.field)}</span></span>` +
      (r.isNew ? `<span class="badge new">NEW</span>` : "") +
      (r.sameId ? `<span class="badge">SAME ID</span>` : "") +
      `<button class="small" data-jump="${esc(r.file)}|${esc(r.rowId)}">Open</button></div></div>`;
    const box = showModal(`<h2>Referenced by ${esc(value)}</h2>` +
      `<div class="mrow"><label>${direct.length} reference(s)${same.length ? ` + ${same.length} same-ID match(es)` : ""} across all tables</label>` +
      (direct.length ? direct.slice(0, 200).map(refRowHtml).join("") +
        (direct.length > 200 ? `<div style="color:var(--dim)">\u2026 ${direct.length - 200} more</div>` : "")
        : `<div class="empty-note">Nothing references this row via Id_ fields.</div>`) +
      (same.length ? `<div class="mrow" style="margin-top:8px"><label>Same row ID in other tables (shared-key counterparts, e.g. Attack \u2194 Damage)</label>` +
        same.slice(0, 50).map(refRowHtml).join("") +
        (same.length > 50 ? `<div style="color:var(--dim)">\u2026 ${same.length - 50} more</div>` : "") + `</div>` : "") +
      `</div><div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    box.addEventListener("click", (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      const j = e.target.dataset && e.target.dataset.jump;
      if (j) { const i = j.indexOf("|"); closeModal(); jumpToRow(j.slice(0, i), j.slice(i + 1)); }
    });
  });
}
async function resolveAndJump(family, rowId) {
  await guard(async () => {
    busy("Locating row…");
    let file = null;
    try {
      if (family === "__attack__" || family === "__damage__") {
        const d = await call("search:global", rowId, 10);
        const hit = (d.results || []).find((r) => r.rowId === rowId);
        if (hit) file = hit.file;
      } else file = family;
    } finally { idle(); }
    if (!file) { toast(`Row not found: ${rowId}`, "error"); return; }
    jumpToRow(file, rowId);
  });
}
function famBannerHtml(family) {
  if (!family || !family.members || family.members.length < 2) return "";
  const ms = family.members;
  const short = (m) => String(m || "").replace(/\.json$/i, "");
  const shown = ms.slice(0, 5).map((m) => `<span class="fam-chip" title="${esc(m)}">${esc(short(m))}</span>`).join("");
  const more = ms.length > 5 ? `<span class="fam-chip" title="${esc(ms.slice(5).join(", "))}">+${ms.length - 5} more</span>` : "";
  return `<div class="fam-note" title="${esc(ms.join(", "))}">` +
    `<div class="fam-head"><span class="fam-title">Shared rules</span> ` +
    `<span class="fam-desc">apply to all <b>${ms.length}</b> tables in the <b>${esc(family.key)}</b> family</span></div>` +
    `<div class="fam-members">${shown}${more}</div></div>`;
}
async function renderRulesTab(body, tab) {
  const sameTab = S._renderedTabId === tab.id;
  const cur = body.querySelector(":scope > .unified-wrap");
  const prevTop = sameTab && cur ? cur.scrollTop : (tab._scrollTop || 0);
  if (!sameTab && S._renderedTabId) {
    const old = S.tabs.find((x) => x.id === S._renderedTabId);
    if (old && cur) old._scrollTop = cur.scrollTop;
  }
  body.innerHTML = `<div class="unified-wrap"><div class="empty-note">Loading rules…</div></div>`;
  S._renderedTabId = tab.id;
  let rules = [];
  let family = null;
  try {
    const d = await call("rules:list", tab.file);
    rules = d.rules || [];
    family = d.family || null;
    tab.familyInfo = family;
  }
  catch (err) { body.innerHTML = `<div class="unified-wrap"><div class="empty-note err">${esc(err.message)}</div></div>`; return; }
  const sch = tab.schema || { fields: {} };
  await prefillEnumsFor(sch);
  const fieldNames = sch.fieldOrder || Object.keys(sch.fields || {});
  body.innerHTML = `<div class="unified-wrap">` +
    famBannerHtml(family) +
    `<div id="ruleCards" style="margin-top:10px;">` + rules.map((r, i) => ruleCard(r, i, rules.length)).join("") + `</div>` +
    `<datalist id="fieldList">${fieldNames.map((f) => `<option value="${esc(f)}">`).join("")}</datalist>` +
    `</div>`;
  const sc = body.querySelector(":scope > .unified-wrap");
  if (sc && prevTop) sc.scrollTop = prevTop;
}
function fsForRuleField(field) {
  const t = activeTab();
  const top = String(field || "").split(".")[0];
  return (((t && t.schema && t.schema.fields) || {})[top]) || ((S.schema && S.schema.fields) || {})[top] || { kind: "any" };
}
function condOpsFor(fs) {
  const ops = S.condOps || [];
  const numeric = fs && fs.kind === "number";
  const keep = numeric ? ["==", "!=", ">", ">=", "<", "<="] : ["==", "!=", "contains", "!contains"];
  const out = ops.filter((o) => keep.includes(o.id));
  return out.length ? out : ops;
}
function actionBlockHtml(a) {
  const fs = fsForRuleField(a.field);
  const ops = (S.ruleOps || []).map((o) => `<option value="${o.id}" ${(a.op || "set") === o.id ? "selected" : ""}>${esc(o.label)}</option>`).join("");
  return `<div class="s-act" data-action>` +
    `<select data-a="op" title="Action">${ops}</select>` +
    `<input data-a="field" list="fieldList" value="${esc(a.field || "")}" placeholder="field" title="Field" spellcheck="false" autocomplete="off">` +
    `<span class="s-val" data-aval>${ruleValueWidget({ op: a.op || "set", value: a.value }, fs)}</span>` +
    `<span class="s-tools">` +
    `<button class="small" data-a="up" title="Move up">\u2191</button>` +
    `<button class="small" data-a="down" title="Move down">\u2193</button>` +
    `<button class="small" data-a="addbelow" title="Insert action below">+</button>` +
    `<button class="small danger" data-a="del" title="Delete action">\u00d7</button>` +
    `</span></div>`;
}
function stackHtml(stackName, actions) {
  const list = Array.isArray(actions) ? actions : [];
  return `<div class="s-stack" data-stack="${stackName}">` +
    (list.length ? list.map((a) => actionBlockHtml(a)).join("") : `<div class="s-empty">no actions — nothing happens here</div>`) +
    `<button class="small s-add" data-a="aadd" data-stack="${stackName}" title="Append action">+ action</button></div>`;
}
function ruleCard(r, i, n) {
  const cond = (r && r.cond) || {};
  const thenActs = Array.isArray(r.then) ? r.then : [];
  const elseActs = Array.isArray(r.else) ? r.else : [];
  const cfs = fsForRuleField(cond.field);
  const cops = condOpsFor(cfs).map((o) => `<option value="${esc(o.id)}" ${cond.op === o.id ? "selected" : ""}>${esc(o.label)}</option>`).join("");
  const cval = cond.value === undefined || cond.value === null ? "" : (typeof cond.value === "object" ? JSON.stringify(cond.value) : String(cond.value));
  return `<div class="rule-card${r.disabled ? " disabled" : ""}" data-rule="${esc(r.id)}">` +
    `<div class="rule-top"><input type="checkbox" data-r="disabled" ${r.disabled ? "" : "checked"} title="Enabled">` +
    `<input class="rname" data-r="name" type="text" placeholder="Rule name (optional)" value="${esc(r.name || "")}">` +
    `<span style="color:var(--dim);font-size:12px">#${i + 1}</span><span style="flex:0"></span>` +
    `<button class="small" data-r="up" ${i === 0 ? "disabled" : ""}>\u2191</button>` +
    `<button class="small" data-r="down" ${i === n - 1 ? "disabled" : ""}>\u2193</button>` +
    `<button class="small danger" data-r="del">Delete</button></div>` +
    `<div class="s-if"><div class="s-ifhead"><span class="s-kw">if</span>` +
    `<input data-r="cfield" list="fieldList" value="${esc(cond.field || "")}" placeholder="field — empty = always" title="Test field (empty = always)" spellcheck="false" autocomplete="off">` +
    `<select data-r="cop" title="Comparison">${cops}</select>` +
    `<input data-r="cvalue" value="${esc(cval)}" placeholder="value" title="Compared to" spellcheck="false" autocomplete="off">` +
    `<button class="small" data-r="match">Test</button><span data-r="matchout"></span></div>` +
    stackHtml("then", thenActs) +
    `<div class="s-elsehead"><span class="s-kw">else</span></div>` +
    stackHtml("else", elseActs) +
    `</div>` +
    `<div class="rule-foot"><button class="small primary" data-r="save">Apply</button></div></div>`;
}
function ruleValueWidget(r, fs) {
  if ((r.op || "set") === "map") return mapValueWidget(r, fs);
  const v = r.value;
  if (fs.kind === "boolean") return `<select data-r="value-bool"><option value="true" ${v === true || v === "true" ? "selected" : ""}>true</option><option value="false" ${v === false || v === "false" ? "selected" : ""}>false</option></select>`;
  if (fs.kind === "number") return `<input data-r="value-num" type="number" step="any" value="${v === null || v === undefined ? "" : esc(String(v))}">`;
  if (fs.kind === "enum" && fs.enumName && enumsMap()[fs.enumName]) {
    const txt = v === null || v === undefined ? "" : (typeof v === "object" ? JSON.stringify(v) : String(v));
    return `<select data-r="value-enum" data-enum="${esc(fs.enumName)}">${enumOptions(fs.enumName, typeof v === "number" ? v : txt || undefined)}</select>`;
  }
  const txt = v === null || v === undefined ? "" : (typeof v === "object" ? JSON.stringify(v, null, 1) : String(v));
  return (txt.length > 80 || txt.includes("\n"))
    ? `<textarea data-r="value-text" rows="3">${esc(txt)}</textarea>`
    : `<input data-r="value-text" type="text" value="${esc(txt)}">`;
}
function mapPairsOf(r) {
  if (Array.isArray(r.value)) return { pairs: r.value, def: undefined };
  if (r.value && typeof r.value === "object") return { pairs: Array.isArray(r.value.pairs) ? r.value.pairs : [], def: r.value.default };
  return { pairs: [], def: undefined };
}
function mapSideInput(kind, enumName, val) {
  const txt = val === undefined || val === null ? "" : (typeof val === "object" ? JSON.stringify(val) : String(val));
  if (enumName && enumsMap()[enumName]) {
    return `<select data-mside="${kind}" data-enum="${esc(enumName)}">${enumOptions(enumName, txt === "" ? undefined : (/^-?\d+$/.test(txt) ? Number(txt) : txt))}</select>`;
  }
  return `<input data-mside="${kind}" type="text" value="${esc(txt)}" placeholder="${kind === "from" ? "current value" : "new value"}">`;
}
function mapValueWidget(r, fs) {
  const pr = mapPairsOf(r);
  const enumName = fs && fs.enumName;
  const defTxt = pr.def === undefined || pr.def === null ? "" : (typeof pr.def === "object" ? JSON.stringify(pr.def) : String(pr.def));
  return `<div class="map-pairs" data-mpairs>` +
    pr.pairs.map((p) => `<div class="map-pair">${mapSideInput("from", enumName, p.from)}<span class="arrow">\u2192</span>${mapSideInput("to", enumName, p.to)}<button class="small danger" data-mdel>\u00d7</button></div>`).join("") +
    `</div><div class="map-foot"><button class="small" data-madd>+ pair</button>` +
    `<label style="color:var(--dim);font-size:11px">Default (unmapped values): <input data-mdef type="text" value="${esc(defTxt)}" placeholder="leave unchanged" style="width:140px"></label></div>` +
    `<div style="color:var(--dim);font-size:11px;margin-top:4px">Maps the field's current value to another. Enum fields offer member dropdowns on both sides.</div>`;
}
function readCond(card) {
  const get = (k) => { const el = card.querySelector(`[data-r="${k}"]`); return el ? el.value : ""; };
  const cfield = get("cfield").trim();
  if (!cfield) return null;
  return { field: cfield, op: get("cop"), value: parseLooseValue(get("cvalue"), fsForRuleField(cfield)) };
}
function readActionValue(el, op, fs) {
  const q = (sel) => el.querySelector(sel);
  if (op === "map") {
    const pairs = [];
    el.querySelectorAll("[data-mpairs] .map-pair").forEach((row) => {
      const fromEl = row.querySelector('[data-mside="from"]');
      const toEl = row.querySelector('[data-mside="to"]');
      const fromTxt = fromEl ? fromEl.value : "";
      const toTxt = toEl ? toEl.value : "";
      if (String(fromTxt).trim() === "" && String(toTxt).trim() === "") return;
      pairs.push({ from: parseLooseValue(fromTxt, fs), to: parseLooseValue(toTxt, fs) });
    });
    const value = { pairs };
    const defEl = q("[data-mdef]");
    if (defEl && String(defEl.value).trim() !== "") value.default = parseLooseValue(defEl.value, fs);
    return value;
  }
  const boolEl = q('[data-r="value-bool"]');
  if (boolEl) return boolEl.value === "true";
  const numEl = q('[data-r="value-num"]');
  if (numEl) {
    const x = numEl.value;
    const v = x === "" ? null : Number(x);
    if (v !== null && !Number.isFinite(v)) throw new Error("Rule action: value is not a number");
    return v;
  }
  const enumEl = q('[data-r="value-enum"]');
  if (enumEl) { const x = enumEl.value; return /^-?\d+$/.test(x) ? Number(x) : x; }
  const txtEl = q('[data-r="value-text"]');
  if (txtEl) return parseLooseValue(txtEl.value, fs);
  return null;
}
function readRuleCard(card) {
  const nameEl = card.querySelector('[data-r="name"]');
  const disEl = card.querySelector('[data-r="disabled"]');
  const readStack = (which) => {
    const host = card.querySelector(`[data-stack="${which}"]`);
    if (!host) return [];
    return [...host.querySelectorAll(":scope > [data-action]")].map((el) => {
      const opEl = el.querySelector('[data-a="op"]');
      const fieldEl = el.querySelector('[data-a="field"]');
      const op = opEl ? opEl.value : "set";
      const field = fieldEl ? fieldEl.value.trim() : "";
      return { field, op, value: readActionValue(el, op, fsForRuleField(field)) };
    });
  };
  return {
    name: nameEl ? nameEl.value : "",
    cond: readCond(card),
    then: readStack("then"),
    else: readStack("else"),
    disabled: disEl ? !disEl.checked : false,
  };
}
function parseLooseValue(x, fs) {
  const s = String(x ?? "").trim();
  if (s === "") return null;
  if (fs.kind === "number") { const n = Number(s); if (!Number.isFinite(n)) throw new Error(`Not a number: ${s}`); return n; }
  if (fs.kind === "boolean") { if (s === "true") return true; if (s === "false") return false; throw new Error(`Not true/false: ${s}`); }
  if (s.startsWith("{") || s.startsWith("[")) { try { return JSON.parse(s); } catch (err) { throw new Error(`Bad JSON: ${err.message}`); } }
  if (/^-?\d+(\.\d+)?$/.test(s) && fs.kind !== "string") return Number(s);
  if (/^(true|false)$/.test(s) && fs.kind !== "string") return s === "true";
  return s;
}
async function afterRulesMutated(tab, files) {
  updateDirtyState();
  renderScopeList();
  const set = new Set(files && files.length ? files : [tab.file]);
  const tts = S.tabs.filter((x) => x.kind === "table" && set.has(x.file));
  for (const tt of tts) {
    try {
      await loadTabRows(tt, true);
      for (const rowId of [...tt.expandOrder]) {
        try { tt.expanded[rowId] = await fetchRowData(tt, rowId); }
        catch { delete tt.expanded[rowId]; tt.expandOrder = tt.expandOrder.filter((x) => x !== rowId); }
      }
    } catch (err) { toast(err.message, "error"); }
  }
  if (S.activeTabId === tab.id || tts.some((x) => x.id === S.activeTabId)) { syncLegacyScope(); renderCenter(); }
}
async function reloadAllTabs() {
  for (const t of S.tabs) {
    if (t.kind === "rules") continue;
    try {
      await loadTabRows(t, true);
      for (const rowId of [...t.expandOrder]) {
        try { t.expanded[rowId] = await fetchRowData(t, rowId); }
        catch { delete t.expanded[rowId]; t.expandOrder = t.expandOrder.filter((x) => x !== rowId); }
      }
    } catch { /* keep tab as-is */ }
  }
  syncLegacyScope();
  renderCenter();
}
async function updateProjChangeCount() {
  try {
    const d = await call("diff:project");
    S.diffCache = d;
    if (S.sidebarOpen && S.sideView === "changes") renderChangesView();
  } catch { /* ignore */ }
  updateDirtyState();
}
// ---------------- Mod modal (req 2: manifest/assets/registry as a modal) ----------------
async function showModModal(previewFirst) {
  if (!S.project) { toast("No project open", "error"); return; }
  const m = (S.project && S.project.manifest) || {};
  const extras = Object.entries(m).filter(([k]) => !["title", "description", "version", "priority", "icon"].includes(k));
  const box = showModal(`<h2>Mod \u2014 ${esc(m.title || S.project.name)}</h2>` +
    `<div class="mod-sect"><h4>Manifest (manifest.json)</h4>` +
    `<label>Title</label><input type="text" id="mTitle" value="${esc(m.title || "")}">` +
    `<label>Description</label><textarea id="mDesc" rows="2">${esc(m.description || "")}</textarea>` +
    `<label>Version</label><input type="text" id="mVersion" value="${esc(m.version || "")}">` +
    `<label>Priority (higher wins vs other mods)</label><input type="number" id="mPriority" value="${esc(String(m.priority ?? 0))}">` +
    `<label>Icon (path relative to mod, or absolute to copy in)</label><input type="text" id="mIcon" value="${esc(m.icon || "")}">` +
    `<div style="margin-top:4px;display:flex;gap:6px"><button class="small" id="btnPickIcon">Browse…</button><button class="small primary" id="btnSaveManifest">Save manifest</button></div>` +
    `<label style="margin-top:8px">Other manifest fields (any extra keys)</label><div id="mExtras">` +
    extras.map(([k, v]) => `<div class="kv-row"><input type="text" data-ek="${esc(k)}" value="${esc(k)}" placeholder="key"><input type="text" data-ev="${esc(k)}" value="${esc(typeof v === "object" ? JSON.stringify(v) : String(v ?? ""))}" placeholder="value"><button class="small danger" data-edel="${esc(k)}">\u00d7</button></div>`).join("") +
    `</div><button class="small" id="btnExtraAdd">+ field</button></div>` +
    `<div class="mod-sect"><h4>Duplicate / extra assets</h4><div style="color:var(--dim);font-size:11.5px;margin-bottom:6px">Files copied into the mod on export (tracked for safe overwrite).</div>` +
    `<div id="assetList"></div><div style="display:flex;gap:6px;margin-top:6px"><button class="small" id="btnAssetFile">+ file(s)</button><button class="small" id="btnAssetDir">+ folder</button></div></div>` +
    `<div class="mod-sect"><h4>AssetRegistry.json (new assets)</h4><div style="color:var(--dim);font-size:11.5px;margin-bottom:6px">Array of asset entries merged by the Mod Manager. Leave <b>[]</b> when the mod adds no new assets.</div>` +
    `<textarea id="regText" rows="4" spellcheck="false"></textarea><div style="display:flex;gap:6px;margin-top:6px;align-items:center"><button class="small primary" id="btnSaveRegistry">Save</button><span id="regCount" style="color:var(--dim);font-size:12px"></span></div></div>` +
    `<div class="mod-sect"><h4>Export preview</h4><div style="display:flex;gap:6px;margin-bottom:6px"><button class="small" id="btnPreview">Refresh</button></div><div id="exportPreview" style="color:var(--dim);font-size:12px">\u2014</div></div>` +
    `<div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
  const loadAssets = async () => {
    try {
      const assets = await call("assets:list");
      const el = $("#assetList", box);
      if (el) el.innerHTML = assets.length
        ? assets.map((a) => `<div class="asset-item"><span title="${esc(a.src)}">\u2192 ${esc(a.dest)}</span><button class="small danger" data-adel="${esc(a.dest)}">\u00d7</button></div>`).join("")
        : `<div style="color:var(--dim);font-size:12px">None</div>`;
    } catch (err) { toast(err.message, "error"); }
  };
  const loadRegistry = async () => {
    try {
      const rows = await call("registry:get");
      $("#regText", box).value = JSON.stringify(rows, null, 1);
      $("#regCount", box).textContent = `${rows.length} row(s)`;
    } catch (err) { toast(err.message, "error"); }
  };
  const refreshPreview = async () => {
    await guard(async () => {
      const prev = await call("export:preview");
      const el = $("#exportPreview", box);
      if (el) el.innerHTML = `<div>${prev.files.length} file(s) \u2192 <b>${esc(prev.folder)}</b>/</div>` +
        (prev.warnings.length ? prev.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join("") : "") +
        `<div class="file-list" style="max-height:180px;margin-top:6px">${prev.files.map(esc).join("<br>")}</div>`;
    });
  };
  loadAssets();
  loadRegistry();
  if (previewFirst) refreshPreview();
  box.addEventListener("click", async (e) => {
    if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
    if (e.target.id === "btnSaveManifest") {
      await guard(async () => {
        const mm = {
          title: $("#mTitle", box).value, description: $("#mDesc", box).value,
          version: $("#mVersion", box).value, priority: Number($("#mPriority", box).value) || 0,
          icon: $("#mIcon", box).value,
        };
        $$("#mExtras .kv-row", box).forEach((row) => {
          const k = row.querySelector("[data-ek]").value.trim();
          let v = row.querySelector("[data-ev]").value;
          if (!k) return;
          try {
            if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith("[") && v.endsWith("]"))) v = JSON.parse(v);
            else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
            else if (v === "true") v = true;
            else if (v === "false") v = false;
          } catch { /* keep string */ }
          mm[k] = v;
        });
        await call("manifest:save", mm);
        S.project.manifest = mm;
        renderProjects();
        toast("Manifest saved", "success");
      });
      return;
    }
    if (e.target.id === "btnPickIcon") {
      const picked = await call("dialog:pick-file", { title: "Pick icon", filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "ico", "webp"] }] });
      if (picked) $("#mIcon", box).value = picked;
      return;
    }
    if (e.target.id === "btnExtraAdd") {
      const host = $("#mExtras", box);
      const div = document.createElement("div");
      div.className = "kv-row";
      const k = `extra${Date.now().toString(36)}`;
      div.innerHTML = `<input type="text" data-ek="${k}" value="" placeholder="key"><input type="text" data-ev="${k}" value="" placeholder="value"><button class="small danger" data-edel="${k}">\u00d7</button>`;
      host.appendChild(div);
      return;
    }
    const edel = e.target.dataset && e.target.dataset.edel;
    if (edel) { e.target.closest(".kv-row").remove(); return; }
    if (e.target.id === "btnAssetFile") { await guard(async () => { await call("assets:add-file"); loadAssets(); }); return; }
    if (e.target.id === "btnAssetDir") { await guard(async () => { await call("assets:add-dir"); loadAssets(); }); return; }
    const adel = e.target.dataset && e.target.dataset.adel;
    if (adel) { await guard(async () => { await call("assets:remove", adel); loadAssets(); }); return; }
    if (e.target.id === "btnSaveRegistry") {
      await guard(async () => {
        const d = await call("registry:save", $("#regText", box).value);
        $("#regCount", box).textContent = `${d.count} row(s)`;
        toast("AssetRegistry saved", "success");
      });
      return;
    }
    if (e.target.id === "btnPreview") refreshPreview();
  });
}
// ---------------- global search ----------------
async function showSearch() {
  const t = activeTab();
  const q = await promptModal("Global search", [{ label: "Row ID or value text", value: (t && t.search) || "" }], "Search");
  if (!q) return;
  await guard(async () => {
    busy("Searching all tables…");
    let results = [];
    try { results = (await call("search:global", q, 300)).results || []; } finally { idle(); }
    const box = showModal(`<h2>Search: ${esc(q)}</h2>` +
      `<div class="mrow"><label>${results.length} match(es)</label>` +
      (results.length ? results.map((r, i) => `<div class="diff-row"><div class="dh"><span style="flex:1">${esc(r.file)} :: ${esc(r.rowId)}${r.field ? ` <span style="color:var(--dim)">${esc(r.field)}</span>` : ""}</span>` +
        (r.source === "project" ? `<span class="badge edited">PRJ</span>` : "") +
        `<button class="small" data-sjump="${i}">Open</button></div>` +
        (r.snippet && r.field ? `<div class="df">${esc(r.snippet)}</div>` : "") + `</div>`).join("")
        : `<div class="empty-note">No matches.</div>`) +
      `</div><div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    box.addEventListener("click", (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      const j = e.target.dataset && e.target.dataset.sjump;
      if (j !== undefined && j !== null && j !== "") {
        const r = results[Number(j)];
        if (r) jumpToRow(r.file, r.rowId, r.field && !r.field.includes(".") ? r.field : null);
      }
    });
  });
}
// ---------------- text find/replace + snapshots + conflicts ----------------
async function showTextTools() {
  const t = activeTab();
  const fam = t && t.kind === "table" ? baseFamilyOf(t.file).family : "";
  const box = showModal(`<h2>Text find / replace</h2>` +
    `<div class="mrow"><label>Scope</label><select id="ttScope">` +
    `<option value="all">All tables</option>` +
    (fam ? `<option value="family" selected>Family: ${esc(fam)}</option>` : "") +
    (t && t.kind === "table" ? `<option value="file">This file: ${esc(t.file)}</option>` : "") +
    `</select></div>` +
    `<div class="mrow"><label>Find</label><input id="ttFind" type="text"></div>` +
    `<div class="mrow"><label>Replace with</label><input id="ttReplace" type="text"></div>` +
    `<div class="mrow"><button class="small" id="btnTtSearch">Search</button> <span id="ttCount" style="color:var(--dim)"></span></div>` +
    `<div class="mrow"><div id="ttResults" class="file-list" style="max-height:240px">\u2014</div></div>` +
    `<div class="mfoot"><button data-x="cancel">Close</button><button data-x="apply" class="primary">Replace checked</button></div>`, true);
  let matches = [];
  const scopeOf = () => {
    const v = $("#ttScope", box).value;
    if (v === "file" && t && t.kind === "table") return { file: t.file };
    if (v === "family") return { family: fam };
    return null;
  };
  box.addEventListener("click", async (e) => {
    if (e.target.dataset && e.target.dataset.x === "cancel") closeModal();
    if (e.target.id === "btnTtSearch") {
      const q = $("#ttFind", box).value;
      if (!q) { toast("Find text is empty", "error"); return; }
      await guard(async () => {
        busy("Searching text…");
        try { matches = (await call("i18n:find", q, scopeOf())).matches || []; } finally { idle(); }
        $("#ttCount", box).textContent = `${matches.length} match(es)`;
        $("#ttResults", box).innerHTML = matches.map((m, i) =>
          `<label style="display:block;padding:3px 0;border-bottom:1px solid var(--border)"><input type="checkbox" data-tt="${i}" checked> ` +
          `<b>${esc(m.file)}</b> :: ${esc(m.rowId)} :: ${esc(m.field)}<br><span style="color:var(--dim)">${esc(m.value)}</span></label>`
        ).join("") || "No matches.";
      });
      return;
    }
    if (e.target.dataset && e.target.dataset.x === "apply") {
      const checked = $$("[data-tt]", box).filter((el) => el.checked).map((el) => matches[Number(el.dataset.tt)]).filter(Boolean);
      if (!checked.length) { toast("Nothing checked", "error"); return; }
      await guard(async () => {
        busy("Replacing…");
        let res = null;
        try { res = await call("i18n:replace", checked, $("#ttFind", box).value, $("#ttReplace", box).value); } finally { idle(); }
        closeModal();
        S.changed = res.changed || S.changed;
        renderScopeList();
        await reloadAllTabs();
        updateProjChangeCount();
        refreshHistory();
        toast(`Replaced in ${res.applied} field(s)`, "success");
      });
    }
  });
}
async function showSnapshots() {
  if (!S.currentProject) { toast("No project open", "error"); return; }
  await guard(async () => {
    const snaps = await call("snapshots:list");
    const renderList = (list) => (list.length ? list.map((s) => `<div class="diff-row"><div class="dh">` +
      `<span class="badge ${s.kind === "auto" ? "global" : "new"}">${esc(s.kind)}</span>` +
      `<span style="flex:1">${esc(new Date(s.ts).toLocaleString())}${s.label ? ` \u2014 ${esc(s.label)}` : ""}</span>` +
      `<button class="small" data-snap-restore="${esc(s.file)}">Restore</button> ` +
      `<button class="small danger" data-snap-del="${esc(s.file)}">Delete</button></div></div>`).join("")
      : `<div class="empty-note">None yet.</div>`);
    const box = showModal(`<h2>Snapshots \u2014 ${esc(S.currentProject)}</h2>` +
      `<div class="mrow"><label>Manual commit (named restore point)</label>` +
      `<div style="display:flex;gap:6px"><input id="snapLabel" type="text" placeholder="before Gojo rework" style="flex:1"><button class="small primary" id="btnSnapSave">Commit</button></div></div>` +
      `<div class="mrow"><label>Restore points (autos kept: last ${S.config.snapshotKeep || 5})</label><div id="snapList">${renderList(snaps)}</div></div>` +
      `<div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    box.addEventListener("click", async (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      if (e.target.id === "btnSnapSave") {
        await guard(async () => {
          const d = await call("snapshots:create", $("#snapLabel", box).value);
          $("#snapList", box).innerHTML = renderList(d.snapshots);
          $("#snapLabel", box).value = "";
          toast("Snapshot committed", "success");
        });
        return;
      }
      const rs = e.target.dataset && e.target.dataset.snapRestore;
      if (rs) {
        await guard(async () => {
          busy("Restoring…");
          try {
            const d = await call("snapshots:restore", rs);
            closeModal();
            await refreshAfterHistory(d);
            toast("Snapshot restored (undoable)", "success");
          } finally { idle(); }
        });
        return;
      }
      const del = e.target.dataset && e.target.dataset.snapDel;
      if (del) {
        await guard(async () => {
          const list = await call("snapshots:delete", del);
          $("#snapList", box).innerHTML = renderList(list);
        });
      }
    });
  });
}
async function showConflicts() {
  if (!S.currentProject) { toast("No project open", "error"); return; }
  await guard(async () => {
    busy("Scanning installed mods…");
    let data = null;
    try { data = await call("conflicts:scan"); } finally { idle(); }
    const list = data.conflicts || [];
    const box = showModal(`<h2>Conflicts \u2014 ${esc(S.currentProject)} (priority ${data.myPriority})</h2>` +
      `<div class="mrow"><label>Same rows touched by this project and ${data.modCount} installed mod(s). Higher priority wins at package time.</label>` +
      (list.length ? list.map((c) => `<div class="diff-row"><div class="dh">` +
        `<span class="badge ${c.winner === "you" ? "new" : c.winner === "them" ? "edited" : "global"}">${c.winner === "you" ? "YOU WIN" : c.winner === "them" ? "THEY WIN" : "TIE"}</span>` +
        `<span style="flex:1">${esc(c.title)} (prio ${c.priority}) \u2014 ${esc(c.file)} \u2014 ${c.rowCount} row(s)</span></div>` +
        `<div class="df">${c.rows.map(esc).join(", ")}${c.rowCount > c.rows.length ? ", \u2026" : ""}</div></div>`).join("")
        : `<div class="empty-note">No overlapping rows. Clean.</div>`) +
      `</div><div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    box.addEventListener("click", (e) => { if (e.target.dataset && e.target.dataset.x === "ok") closeModal(); });
  });
}
async function showChecklist() {
  if (!S.charMode) { toast("Pick a character first (top bar)", "error"); return; }
  await guard(async () => {
    busy("Checking character coverage…");
    let data = null;
    try { data = await call("checklist:character", S.charMode); } finally { idle(); }
    const group = (title, items) => `<div class="mrow"><label>${esc(title)} \u2014 ${items.length - items.filter((i) => i.status === "missing").length}/${items.length} present</label>` +
      items.map((i) => {
        const firstFile = (i.files && i.files[0] && i.files[0].file) || null;
        return `<div class="diff-row"><div class="dh">` +
          `<span class="badge ${i.status === "ok" ? "new" : "edited"}">${i.status === "ok" ? "OK" : "MISSING"}</span>` +
          `<span style="flex:1">${esc(i.family)}</span>` +
          `<span style="color:var(--dim);font-size:11px">vanilla ${i.vanilla} \u00b7 project ${i.project}</span>` +
          (firstFile ? `<button class="small" data-goto-table="${esc(firstFile)}">Open</button>` : "") + `</div></div>`;
      }).join("") + `</div>`;
    const box = showModal(`<h2>Checklist \u2014 ${esc(S.charMode)} (${esc(charLabelOf(S.charMode))})</h2>` +
      group("Core tables (playable character needs these)", data.core || []) +
      `<div class="mrow"><label>Parameters \u2014 ${data.params.filter((p) => p.status === "ok").length}/${data.params.length} present</label>` +
      data.params.map((p) => `<div class="diff-row"><div class="dh">` +
        `<span class="badge ${p.status === "ok" ? "new" : "edited"}">${p.status === "ok" ? "OK" : "MISSING"}</span>` +
        `<span style="flex:1">parameters/${esc(p.short)}.json</span>` +
        `<span style="color:var(--dim);font-size:11px">vanilla ${p.vanilla} \u00b7 project ${p.project}</span>` +
        (p.status === "ok" ? `<button class="small" data-goto-param="${esc(p.short)}">Open</button>` : "") + `</div></div>`).join("") + `</div>` +
      group("Extended tables (nice to have)", data.extended || []) +
      `<div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    box.addEventListener("click", async (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      const gt = e.target.dataset && e.target.dataset.gotoTable;
      if (gt) { closeModal(); await selectScope({ kind: "table", file: gt }); return; }
      const gp = e.target.dataset && e.target.dataset.gotoParam;
      if (gp) { closeModal(); S.leftTab = "params"; await selectScope({ kind: "param", short: gp }); }
    });
  });
}
async function showMoveset() {
  if (!S.charMode) { toast("Pick a character first (top bar)", "error"); return; }
  await guard(async () => {
    busy("Rolling up moveset…");
    let data = null;
    try { data = await call("moveset:character", S.charMode); } finally { idle(); }
    if (!data.actionKey) {
      const b = showModal(`<h2>Moveset \u2014 ${esc(S.charMode)}</h2><div class="empty-note">No Action row for this character.</div><div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
      b.addEventListener("click", (e) => { if (e.target.dataset && e.target.dataset.x === "ok") closeModal(); });
      return;
    }
    const fld = (obj) => Object.entries(obj || {}).map(([k, v]) => `<div><span style="color:var(--accent)">${esc(k)}</span> = ${esc(shortVal(v, 90))}</div>`).join("");
    const box = showModal(`<h2>Moveset \u2014 ${esc(S.charMode)} (${esc(charLabelOf(S.charMode))})</h2>` +
      `<div class="mrow"><label>Action row: ${esc(data.actionKey)} \u00b7 ${data.inputs.length} input(s)</label>` +
      data.inputs.map((inp) => `<div class="diff-row"><div class="dh"><span style="flex:1">${esc(inp.field)}</span></div><div class="df">` +
        inp.sets.map((s) => {
          if (s.missing) return `<div>Set ${esc(s.set)} \u2014 <span class="err">missing row</span></div>`;
          return `<div style="margin-bottom:6px">Set <b>${esc(s.set)}</b> ` +
            `<button class="small" data-jump="AttackSetDataTable.json|${esc(s.set)}">Open</button><br>` +
            (s.hits.length ? s.hits.map((hh) => `<div style="margin:4px 0 4px 12px">Hit <b>${esc(hh.id)}</b> ` +
              `<button class="small" data-jump="__attack__|${esc(hh.id)}">Open</button><br>` +
              (hh.missing ? `<span class="err">missing attack row</span>` : fld(hh.fields)) +
              (hh.damages.length ? hh.damages.map((dd) => `<div style="margin:3px 0 3px 12px">Damage <b>${esc(dd.id)}</b> ` +
                `<button class="small" data-jump="__damage__|${esc(dd.id)}">Open</button><br>` +
                (dd.missing ? `<span class="err">missing damage row</span>` : fld(dd.fields)) + `</div>`).join("")
                : `<div style="color:var(--dim)">no damage rows</div>`) + `</div>`).join("")
              : `<div style="color:var(--dim)">no hits</div>`) + `</div>`;
        }).join("") + `</div></div>`).join("") +
      `</div><div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    box.addEventListener("click", (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      const j = e.target.dataset && e.target.dataset.jump;
      if (j) { const i = j.indexOf("|"); closeModal(); resolveAndJump(j.slice(0, i), j.slice(i + 1)); }
    });
  });
}
async function doExportFolder() {
  await guard(async () => {
    busy("Building mod (baking parameter assets)...");
    const prev = await call("export:preview");
    idle();
    const bk = prev.bake || {};
    const bakeHtml = bk.attempted ? `<div class="mrow"><label>Binary-baked parameter assets</label>` +
      ((bk.baked || []).length ? bk.baked.map((b) => `<div>baked ${esc(b.short)}.json into ${esc(b.asset)} (+${b.added} new, ${b.replaced || 0} replaced)</div>`).join("")
        : `<div style="color:var(--dim)">None (no new parameter rows)</div>`) +
      (bk.skippedReason ? `<div class="warn">bake skipped: ${esc(bk.skippedReason)}</div>` : "") + `</div>` : "";
    const box = showModal(`<h2>Export to Mods folder</h2>` +
      `<div class="mrow"><label>Target</label><div style="font-family:var(--mono);font-size:12px">${esc(S.config.modsDir || "(no Mods folder configured \u2014 Settings)")}/${esc(prev.folder)}</div></div>` +
      `<div class="mrow"><label>manifest.json</label><div style="font-size:12px">Always written (title, description, version, priority, icon + extras).</div></div>` +
      `<div class="stat-grid"><div class="stat"><b>${prev.stats.tables}</b>tables</div><div class="stat"><b>${prev.stats.rows}</b>rows</div><div class="stat"><b>${prev.stats.params}</b>params</div><div class="stat"><b>${prev.stats.assets}</b>assets</div></div>` +
      bakeHtml +
      (prev.warnings.length ? `<div class="mrow"><label>Warnings</label>${prev.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join("")}</div>` : "") +
      `<div class="mrow"><label>Files (${prev.files.length}) \u2014 only these are written; unrelated files are never touched</label><div class="file-list">${prev.files.map(esc).join("<br>")}</div></div>` +
      `<div class="mfoot"><button data-x="cancel">Cancel</button><button data-x="ok" class="primary">Export</button></div>`, true);
    box.addEventListener("click", async (e) => {
      if (e.target.dataset && e.target.dataset.x === "cancel") closeModal();
      if (e.target.dataset && e.target.dataset.x === "ok") {
        closeModal();
        await guard(async () => {
          busy("Exporting...");
          try {
            const res = await call("export:folder");
            S.changed = (await call("tables:list")).changed;
            renderScopeList();
            renderCenter();
            updateProjChangeCount();
            toast(`Exported ${res.files.length} file(s) to ${res.path}${res.removed ? ` (${res.removed} stale removed)` : ""}`, "success");
            (res.warnings || []).forEach((w) => toast(w, "warn"));
          } finally { idle(); }
        });
      }
    });
  });
}
async function doExportJjkmod() {
  await guard(async () => {
    busy("Packaging .jjkmod...");
    try {
      const res = await call("export:jjkmod");
      if (!res.cancelled) toast(`Wrote ${res.path}`, "success");
    } finally { idle(); }
  });
}
async function doImport() {
  await guard(async () => {
    busy("Importing...");
    try {
      const res = await call("import:folder");
      if (res.cancelled) return;
      S.projects = res.projects;
      S.currentProject = res.project.name;
      S.project = res.project;
      S.changed = {};
      S.diffCache = null;
      S.problems = null;
      try { S.changed = (await call("tables:list")).changed; } catch { /* ignore */ }
      S.tabs = [];
      S.activeTabId = null;
      renderProjects();
      renderScopeList();
      renderCenter();
      updateProjChangeCount();
      (res.warnings || []).forEach((w) => toast(w, "warn"));
      toast(`Imported as "${res.project.name}"`, "success");
    } finally { idle(); }
  });
}
async function doTestPatch() {
  await guard(async () => {
    busy("Patching cooked tables + baking parameters...");
    try {
      const res = await call("patcher:test");
      const dt = res.datatables;
      const rows = dt ? (dt.results ? dt.results.map((r) => `<div>${r.ok ? "OK" : "FAIL"} ${esc(r.table)}${r.ok ? "" : ` \u2014 ${esc(r.error)}`}</div>`).join("")
        : `<div style="font-family:var(--mono);font-size:12px">${esc(JSON.stringify(dt.summary, null, 1).slice(0, 2000))}</div>`)
        : `<div style="color:var(--dim)">No datatable changes.</div>`;
      const bkr = res.bake || {};
      const bakeRows = (bkr.baked || []).map((b) => `<div>baked ${esc(b.short)}.json into ${esc(b.asset)} (+${b.added} new, ${b.replaced || 0} replaced)</div>`).join("") +
        (bkr.skippedReason ? `<div class="warn">bake skipped: ${esc(bkr.skippedReason)}</div>` : "") +
        ((bkr.newShorts || []).length === 0 && (bkr.baked || []).length === 0 ? `<div style="color:var(--dim)">No new parameter rows.</div>` : "");
      const box = showModal(`<h2>Test patch</h2>` +
        (dt ? `<div class="mrow"><label>Datatables \u2014 ${esc(dt.mode)}</label><div style="font-family:var(--mono);font-size:12px">out: ${esc(dt.out)}</div><div class="mrow">${rows}</div></div>` : `<div class="mrow">${rows}</div>`) +
        `<div class="mrow"><label>Parameter bake</label>${bakeRows}</div>` +
        ((res.buildWarnings || []).length ? `<div class="mrow">${res.buildWarnings.map((w) => `<div class="warn">${esc(w)}</div>`).join("")}</div>` : "") +
        `<div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`);
      box.addEventListener("click", (e) => { if (e.target.dataset && e.target.dataset.x === "ok") closeModal(); });
    } finally { idle(); }
  });
}
async function showProjectChanges(autoValidate) {
  await guard(async () => {
    const d = await call("diff:project");
    const files = Object.keys(d.tables || {}).sort();
    const params = d.params || {};
    const others = (S.projects || []).filter((p) => p.name !== S.currentProject);
    const box = showModal(`<h2>Project changes</h2>` +
      `<div class="mrow" style="display:flex;gap:6px;flex-wrap:wrap"><button class="small" id="btnValidate">Validate project</button>` +
      (others.length ? `<select id="cmpSelect">${others.map((p) => `<option value="${esc(p.name)}">${esc(p.title || p.name)}</option>`).join("")}</select><button class="small" id="btnCompare">Compare with…</button>` : "") +
      `</div><div id="valResults"></div>` +
      ((d.errors || []).length ? d.errors.map((e) => `<div class="err">${esc(e)}</div>`).join("") : "") +
      (files.length === 0 && Object.keys(params).length === 0 ? `<div class="empty-note">No changes yet.</div>` : "") +
      files.map((f) => `<div class="diff-row"><div class="dh"><span style="flex:1">${esc(f)}</span><span style="color:var(--dim);font-size:11px">${Object.keys(d.tables[f]).sort().length} row(s)</span>` +
        `<button class="small" data-goto="${esc(f)}">Open</button></div></div>`).join("") +
      Object.keys(params).sort().map((p) => `<div class="diff-row"><div class="dh"><span style="flex:1">parameters/${esc(p)}.json</span><span style="color:var(--dim);font-size:11px">${((params[p] && params[p].new) || []).length} new / ${((params[p] && params[p].modified) || []).length} vanilla-modified</span></div></div>`).join("") +
      `<div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`, true);
    box.addEventListener("click", async (e) => {
      if (e.target.dataset && e.target.dataset.x === "ok") closeModal();
      const g = e.target.dataset && e.target.dataset.goto;
      if (g) { closeModal(); await selectScope({ kind: "table", file: g }); const t = activeTab(); if (t) { t.statusFilter = "edited"; renderCenter(); } return; }
      const j = e.target.dataset && e.target.dataset.vjump;
      if (j) { const parts = j.split("|"); closeModal(); jumpToRow(parts[0], parts[1], parts[2] || null); return; }
      if (e.target.id === "btnValidate") { showValidation(box); return; }
      if (e.target.id === "btnCompare") { const sel = $("#cmpSelect", box); if (sel && sel.value) showCompare(box, sel.value); }
    });
    if (autoValidate) showValidation(box);
  });
}
async function showValidation(box) {
  await guard(async () => {
    busy("Validating…");
    let v = null;
    try { v = await call("validate:project"); } finally { idle(); }
    S.problems = v;
    renderStatusBar();
    const host = $("#valResults", box);
    if (!host) return;
    const counts = Object.entries(v.counts || {}).map(([k, n]) => `${n} ${k}`).join(" \u2014 ");
    const where = (i) => `${esc(i.file || (i.short ? `parameters/${i.short}.json` : ""))}${i.rowId ? ` :: ${esc(i.rowId)}` : ""}${i.field ? ` :: ${esc(i.field)}` : ""}`;
    host.innerHTML = `<div class="mrow"><label>Validation \u2014 ${v.total} issue(s)${counts ? ` (${counts})` : ""}</label>` +
      ((v.issues || []).length ? v.issues.slice(0, 150).map((i) => `<div class="diff-row"><div class="dh">` +
        `<span class="badge edited">${esc(i.type)}</span><span style="flex:1">${where(i)}</span></div>` +
        `<div class="df">${esc(i.message || "")}</div>` +
        (i.file && i.rowId ? `<div class="df"><button class="small" data-vjump="${esc(i.file)}|${esc(i.rowId)}|${esc(i.field || "")}">Open</button></div>` : "") + `</div>`).join("") +
        (v.issues.length > 150 ? `<div style="color:var(--dim)">\u2026 ${v.issues.length - 150} more</div>` : "")
        : `<div class="empty-note">Clean \u2014 no issues found.</div>`) + `</div>`;
  });
}
async function showCompare(box, otherName) {
  await guard(async () => {
    busy("Comparing projects…");
    let c = null;
    try { c = await call("diff:projects", otherName); } finally { idle(); }
    const tfiles = Object.keys(c.tables || {});
    const pshorts = Object.keys(c.params || {});
    const host = $("#valResults", box);
    if (!host) return;
    host.innerHTML = `<div class="mrow"><label>Compare: ${esc(S.currentProject)} vs ${esc(otherName)} \u2014 ${tfiles.length} table(s), ${pshorts.length} param(s) differ</label>` +
      (tfiles.length === 0 && pshorts.length === 0 ? `<div class="empty-note">Identical.</div>` : "") +
      tfiles.map((f) => {
        const tt = c.tables[f];
        const rows = Object.keys(tt.rows || {});
        const mark = (rr) => (!rr.inA ? "+ " : !rr.inB ? "\u2212 " : "!= ");
        return `<div class="diff-row"><div class="dh"><span style="flex:1">${esc(f)}</span>` +
          `<span style="color:var(--dim);font-size:11px">${tt.rulesSame ? "" : "rules differ | "}${rows.length} row(s)</span></div>` +
          `<div class="df">` + rows.slice(0, 20).map((r) => {
            const rr = tt.rows[r];
            const fs = Object.keys(rr.fields || {});
            return `<div>${mark(rr)}${esc(r)}${fs.length ? ` <span style="color:var(--dim)">${fs.map(esc).join(", ")}</span>` : ""}</div>`;
          }).join("") + (rows.length > 20 ? `<div style="color:var(--dim)">\u2026 ${rows.length - 20} more</div>` : "") + `</div></div>`;
      }).join("") +
      pshorts.map((p) => `<div class="diff-row"><div class="dh"><span style="flex:1">parameters/${esc(p)}.json</span><span style="color:var(--dim);font-size:11px">${Object.keys(c.params[p] || {}).length} row(s)</span></div></div>`).join("") + `</div>`;
  });
}
async function showSettings() {
  const c = S.config;
  const row = (key, label) => `<div class="set-row"><label>${esc(label)}</label><input type="text" data-set="${key}" value="${esc(c[key] || "")}"><button class="small" data-browse="${key}">\u2026</button></div>`;
  const check = (key, label) => `<div class="set-row"><label>${esc(label)}</label><input type="checkbox" data-set-check="${key}"><span></span></div>`;
  const num = (key, label) => `<div class="set-row"><label>${esc(label)}</label><input type="number" data-set-num="${key}" value="${esc(String(c[key] ?? ""))}" min="1" max="50"><span></span></div>`;
(`<h2>Settings</h2>` + row("editorRoot", "JJKJsonEditor root") +
    row("modsDir", "Game Mods folder") + row("modManagerDir", "Mod Manager dir (fallback patcher)") + row("projectsDir", "Projects dir") +
    check("bakeParameterAssets", "Bake parameter .uasset/.uexp on export") + check("autoExport", "Auto-export to Mods folder a few seconds after each change") +
    check("backupOnExport", "Zip-backup the mod folder before overwriting") + num("backupsKept", "Export backups kept") +
    check("autoSnapshotOnExport", "Auto-snapshot project on Export to Mods") + num("snapshotKeep", "Auto-snapshots kept") +
    `<div class="mrow"><label>Projects live as JSON files in the projects dir \u2014 back them up or commit them to git.</label></div>` +
    `<div class="mfoot"><button data-x="cancel">Cancel</button><button data-x="ok" class="primary">Save</button></div>`);
  const chkDefaults = { bakeParameterAssets: true, autoExport: false, backupOnExport: true, autoSnapshotOnExport: true };
  $$("[data-set-check]", box).forEach((el) => { el.checked = S.config[el.dataset.setCheck] !== undefined ? !!S.config[el.dataset.setCheck] : (chkDefaults[el.dataset.setCheck] !== false); });
  box.addEventListener("click", async (e) => {
    const b = e.target.dataset && e.target.dataset.browse;
    if (b) { const picked = await call("dialog:pick-dir", b); if (picked) box.querySelector(`[data-set="${b}"]`).value = picked; return; }
    if (e.target.dataset && e.target.dataset.x === "cancel") closeModal();
    if (e.target.dataset && e.target.dataset.x === "ok") {
      const patch = {};
      $$("[data-set]", box).forEach((el) => { patch[el.dataset.set] = el.value; });
      $$("[data-set-check]", box).forEach((el) => { patch[el.dataset.setCheck] = el.checked; });
      $$("[data-set-num]", box).forEach((el) => { const n = Number(el.value); if (Number.isFinite(n) && n >= 1) patch[el.dataset.setNum] = Math.min(50, Math.floor(n)); });
      await guard(async () => {
        S.config = await call("settings:save", patch);
        closeModal();
        toast("Settings saved \u2014 reloading tables…", "success");
        const d = await call("tables:list");
        S.tables = d.tables;
        S.tableByFile = {};
        for (const x of S.tables) S.tableByFile[x.file] = x;
        if (d.tablesError) toast(d.tablesError, "warn");
        renderScopeList();
        updateProjChangeCount();
      }, "Saving...");
    }
  });
}
function showAbout() {
  const b = showModal(`<h2>About JJK Mod Editor</h2>` +
    `<div class="mrow"><label>Version</label><div>0.1.0 \u2014 visual editor for Jujutsu Kaisen Cursed Clash datatable + parameter mods.</div></div>` +
    `<div class="mrow"><label>Menus</label><div style="font-size:12px">File (projects, import/export), Edit (undo, search), View (tables, characters, tabs), Project (changes, snapshots, conflicts, checklist, moveset), Mod (manifest, assets, preview).</div></div>` +
    `<div class="mfoot"><button data-x="ok" class="primary">Close</button></div>`);
  b.addEventListener("click", (e) => { if (e.target.dataset && e.target.dataset.x === "ok") closeModal(); });
}
async function newProjectFlow() {
  const name = await promptModal("New project", [{ label: "Project name", value: "" }], "Create");
  if (!name) return;
  await guard(async () => {
    const d = await call("project:create", name);
    S.projects = d.projects;
    S.currentProject = d.project.name;
    S.project = d.project;
    S.changed = {};
    S.diffCache = null;
    S.problems = null;
    S.tabs = [];
    S.activeTabId = null;
    renderProjects();
    if (S.charMode) await setCharMode(S.charMode);
    else { renderScopeList(); renderCenter(); }
  }, "Creating...");
}
async function dupProjectFlow() {
  if (!S.currentProject) return;
  const name = await promptModal("Duplicate project", [{ label: "New name", value: `${S.currentProject} copy` }], "Duplicate");
  if (!name) return;
  await guard(async () => {
    const d = await call("project:duplicate", S.currentProject, name);
    S.projects = d.projects;
    toast(`Duplicated as "${d.project.name}"`, "success");
    renderProjects();
  });
}
async function renameProjectFlow() {
  if (!S.currentProject) return;
  const name = await promptModal("Rename project", [{ label: "New name", value: S.currentProject }], "Rename");
  if (!name || name === S.currentProject) return;
  await guard(async () => {
    const d = await call("project:rename", S.currentProject, name);
    S.projects = d.projects;
    S.currentProject = d.project.name;
    S.project = d.project;
    renderProjects();
  });
}
async function delProjectFlow() {
  if (!S.currentProject) return;
  const name = await promptModal("Delete project (cannot be undone)", [{ label: `Type "${S.currentProject}" to confirm`, value: "" }], "Delete");
  if (name !== S.currentProject) return;
  await guard(async () => {
    const d = await call("project:delete", S.currentProject);
    S.projects = d.projects;
    S.currentProject = d.currentProject;
    S.project = null;
    S.diffCache = null;
    S.problems = null;
    S.tabs = [];
    S.activeTabId = null;
    if (S.currentProject) {
      const p = await call("project:open", S.currentProject);
      S.project = p.project;
      S.changed = p.changed;
    }
    renderProjects();
    renderScopeList();
    renderCenter();
    updateProjChangeCount();
  });
}
function handleMenuAction(action, name) {
  switch (action) {
    case "project:new": newProjectFlow(); break;
    case "project:open-modal": showOpenProjectModal(); break;
    case "project:open-name":
      if (name && name !== S.currentProject) guard(() => openProject(name));
      break;
    case "project:duplicate": dupProjectFlow(); break;
    case "project:rename": renameProjectFlow(); break;
    case "project:delete": delProjectFlow(); break;
    case "project:reveal": guard(() => call("project:reveal")); break;
    case "file:import": doImport(); break;
    case "file:export-folder": doExportFolder(); break;
    case "file:export-jjkmod": doExportJjkmod(); break;
    case "file:test-patch": doTestPatch(); break;
    case "file:settings": showSettings(); break;
    case "edit:undo": doUndo(); break;
    case "edit:redo": doRedo(); break;
    case "edit:search": showSearch(); break;
    case "edit:text-tools": showTextTools(); break;
    case "view:tables": S.leftTab = "tables"; setSideView("explorer"); renderScopeList(); break;
    case "view:params": S.leftTab = "params"; setSideView("explorer"); renderScopeList(); break;
    case "view:characters": showCharacters(); break;
    case "view:char-clear": if (S.charMode) guard(() => setCharMode("")); break;
    case "view:close-tab": doCloseTab(); break;
    case "view:close-others": if (S.activeTabId) closeOtherTabs(S.activeTabId); break;
    case "view:palette": showPalette("cmd"); break;
    case "view:quick-open": showPalette("files"); break;
    case "view:toggle-sidebar": toggleSidebar(); break;
    case "view:toggle-panel": togglePanel(); break;
    case "project:changes": showProjectChanges(false); break;
    case "project:validate": showProjectChanges(true); break;
    case "project:snapshots": showSnapshots(); break;
    case "project:conflicts": showConflicts(); break;
    case "project:checklist": showChecklist(); break;
    case "project:moveset": showMoveset(); break;
    case "mod:edit": showModModal(false); break;
    case "mod:preview": showModModal(true); break;
    case "help:about": showAbout(); break;
    default: break;
  }
}
async function doNewRow() {
  const t = activeTab();
  if (!t || t.kind === "rules") return;
  if (t.kind === "param") {
    const id = await promptModal("New parameter row", [{ label: "Row ID", value: t.charPrefix || "" }], "Create");
    if (!id) return;
    await guard(async () => {
      await call("param:create", t.short, id);
      await loadTabRows(t, true);
      syncLegacyScope();
      renderTabBody();
      await expandRow(t, id, null, true);
    });
    return;
  }
  const id = await promptModal("New row", [{ label: "Row ID (unique across table family)", value: t.charPrefix || "" }], "Create");
  if (!id) return;
  await guard(async () => {
    const d = await call("row:create", t.file, id, null);
    S.changed = d.changed;
    await loadTabRows(t, true);
    syncLegacyScope();
    renderCenter();
    await expandRow(t, id, null, true);
    updateProjChangeCount();
  }, "Creating row...");
}
async function doCloneRow() {
  const t = activeTab();
  if (!t || t.kind === "rules") return;
  if (t.kind === "param") {
    const vals = await promptModal("Clone parameter row", [
      { label: "Clone from row ID (in this file)", value: "" },
      { label: "New row ID", value: "" },
    ], "Clone");
    if (!vals) return;
    const [base, nid] = vals;
    if (!base || !nid) { toast("Both IDs are required", "error"); return; }
    await guard(async () => {
      await call("param:create", t.short, nid, base);
      await loadTabRows(t, true);
      syncLegacyScope();
      renderTabBody();
      await expandRow(t, nid, null, true);
    });
    return;
  }
  const vals = await promptModal("New row from existing row", [
    { label: "Clone from row ID", value: "" },
    { label: "New row ID (unique across table family)", value: t.charPrefix || "" },
  ], "Create");
  if (!vals) return;
  const [base, nid] = vals;
  if (!base || !nid) { toast("Both IDs are required", "error"); return; }
  await guard(async () => {
    const d = await call("row:create", t.file, nid, base);
    S.changed = d.changed;
    await loadTabRows(t, true);
    syncLegacyScope();
    renderCenter();
    await expandRow(t, nid, null, true);
    updateProjChangeCount();
  }, "Creating row...");
}
// ---------------- IDE shell: sidebar / panel / status / palette ----------------
function setSideView(v) {
  S.sideView = v;
  if (!S.sidebarOpen) S.sidebarOpen = true;
  renderSide();
}
function renderSide() {
  $$("#activityBar .abtn[data-aview]").forEach((b) => b.classList.toggle("active", b.dataset.aview === S.sideView && S.sidebarOpen));
  $("#sideBar").classList.toggle("hidden", !S.sidebarOpen);
  const map = { explorer: "#sideExplorer", search: "#sideSearch", changes: "#sideChanges" };
  for (const [v, sel] of Object.entries(map)) {
    const el = $(sel);
    if (el) el.classList.toggle("hidden", !S.sidebarOpen || S.sideView !== v);
  }
  if (S.sidebarOpen && S.sideView === "changes") renderChangesView();
}
function toggleSidebar() {
  S.sidebarOpen = !S.sidebarOpen;
  renderSide();
}
async function runGSearch() {
  const q = ($("#gSearchInput").value || "").trim();
  const host = $("#gSearchResults");
  if (!q) { host.innerHTML = `<div class="empty-note">Type above and hit Search.</div>`; host._results = []; return; }
  host.innerHTML = `<div class="empty-note">Searching…</div>`;
  await guard(async () => {
    const d = await call("search:global", q, 100);
    const results = d.results || [];
    host._results = results;
    host.innerHTML = (results.length ? `<div class="group-h">${results.length} match(es)</div>` : "") +
      (results.map((r, i) => `<div class="g-hit" data-gsjump="${i}"><div class="gf">${esc(r.file)}${r.field ? ` <span style="color:var(--dim)">· ${esc(r.field)}</span>` : ""}</div>` +
        `<div class="gr">${esc(r.rowId)}${r.source === "project" ? ` <span class="badge edited">PRJ</span>` : ""}</div>` +
        (r.snippet ? `<div class="gs">${esc(r.snippet)}</div>` : "") + `</div>`).join("") || `<div class="empty-note">No matches.</div>`);
  });
}
async function renderChangesView() {
  const host = $("#changesList");
  if (!host) return;
  if (!S.diffCache) {
    host.innerHTML = `<div class="empty-note">Loading…</div>`;
    try { S.diffCache = await call("diff:project"); }
    catch (err) { host.innerHTML = `<div class="empty-note err">${esc(err.message)}</div>`; return; }
  }
  const d = S.diffCache;
  const files = Object.keys(d.tables || {}).sort();
  const params = d.params || {};
  const pkeys = Object.keys(params).sort();
  if (!files.length && !pkeys.length) {
    host.innerHTML = `<div class="empty-note">No changes yet.<br>Edits appear here as you work.</div>`;
    return;
  }
  host.innerHTML =
    (files.length ? `<div class="group-h">Tables · ${files.length}</div>` + files.map((f) =>
      `<div class="ch-file" data-chgoto="${esc(f)}" title="Open with Edited filter"><span class="dot changed"></span><span class="nm">${esc(f)}</span><span class="ct">${Object.keys(d.tables[f]).length}</span></div>`
    ).join("") : "") +
    (pkeys.length ? `<div class="group-h">Parameters · ${pkeys.length}</div>` + pkeys.map((p) => {
      const n = ((params[p] && params[p].new) || []).length + ((params[p] && params[p].modified) || []).length;
      return `<div class="ch-file" data-chparam="${esc(p)}" title="Open parameter file"><span class="dot changed"></span><span class="nm">${esc(p)}.json</span><span class="ct">${n}</span></div>`;
    }).join("") : "");
}
function setPanel(open, view) {
  S.panelOpen = open;
  if (view) S.panelView = view;
  renderPanel();
}
function togglePanel() { setPanel(!S.panelOpen); }
function renderPanel() {
  const p = $("#panel");
  if (!p) return;
  p.classList.toggle("hidden", !S.panelOpen);
  if (!S.panelOpen) return;
  $$("#panelHead .p-tab").forEach((b) => b.classList.toggle("active", b.dataset.pview === S.panelView));
  renderPanelBody();
}
function renderPanelBody() {
  const body = $("#panelBody");
  if (!body) return;
  const cnt = $("#panelCount");
  const v = S.problems;
  if (!v) {
    if (cnt) cnt.textContent = "";
    body.innerHTML = `<div class="empty-note">No validation results yet.<br><br><button class="small primary" id="btnPanelValidate2">Validate project</button></div>`;
    return;
  }
  const issues = v.issues || [];
  if (cnt) cnt.textContent = `${v.total} issue(s)`;
  const where = (i) => `${esc(i.file || (i.short ? `parameters/${i.short}.json` : ""))}${i.rowId ? ` :: ${esc(i.rowId)}` : ""}${i.field ? ` :: ${esc(i.field)}` : ""}`;
  body.innerHTML = issues.length ? issues.slice(0, 300).map((i) =>
    `<div class="prob-row"><span class="badge edited">${esc(i.type)}</span><span class="pw">${where(i)}</span><span class="pm">${esc(i.message || "")}</span>` +
    (i.file && i.rowId ? `<button class="small" data-pjump="${esc(i.file)}|${esc(i.rowId)}|${esc(i.field || "")}">Open</button>` : "") + `</div>`
  ).join("") + (issues.length > 300 ? `<div style="color:var(--dim)">… ${issues.length - 300} more</div>` : "")
  : `<div class="empty-note">Clean — no issues found.</div>`;
}
async function validateIntoPanel() {
  setPanel(true);
  const body = $("#panelBody");
  if (body) body.innerHTML = `<div class="empty-note">Validating…</div>`;
  await guard(async () => {
    const v = await call("validate:project");
    S.problems = v;
    renderPanelBody();
    renderStatusBar();
  });
}
function renderStatusBar() {
  const pn = $("#stProjectName");
  if (pn) {
    const cur = (S.projects || []).find((p) => p.name === S.currentProject);
    pn.textContent = (cur && (cur.title || cur.name)) || S.currentProject || "No project";
  }
  const ch = $("#stCharName");
  if (ch) {
    ch.textContent = S.charMode ? `${S.charMode} — ${charLabelOf(S.charMode)}` : "All characters";
    const chip = $("#stChar");
    if (chip) chip.classList.toggle("on", !!S.charMode);
  }
  let n = Object.keys(S.changed || {}).length;
  if (S.project && S.project.parameters) {
    for (const p of Object.values(S.project.parameters)) {
      const rows = (p && p.rows) || {};
      if (Object.keys(rows).filter((k) => k.charAt(0) !== "$").length > 0) n++;
    }
  }
  const dt = $("#stDirtyTxt");
  if (dt) {
    dt.textContent = n ? `● ${n} edited` : "Clean";
    dt.classList.toggle("dirty", n > 0);
  }
  const badge = $("#changesBadge");
  if (badge) {
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.classList.toggle("hidden", !n);
  }
  const pt = $("#stProblemsTxt");
  if (pt) {
    const total = S.problems ? S.problems.total : 0;
    pt.textContent = S.problems ? (total ? `✕ ${total}` : "○ 0") : "○ —";
    pt.classList.toggle("bad", total > 0);
    const holder = $("#stProblems");
    if (holder) holder.title = S.problems ? `${total} problem(s) — click to open panel` : "Validate — click to run validation";
  }
  const ex = $("#stExport");
  if (ex) ex.style.display = S.currentProject ? "" : "none";
  const rows = $("#stRows");
  if (rows) {
    const t = activeTab();
    if (t && t.kind !== "rules") {
      const shown = filteredRows(t).length;
      rows.textContent = `${shown} / ${t.rowTotal} rows${t.statusFilter && t.statusFilter !== "all" ? ` · ${t.statusFilter}` : ""}`;
      rows.style.display = "";
      rows.title = `${tabTitle(t)} — ${shown} of ${t.rowTotal} rows shown`;
    } else {
      rows.textContent = "";
      rows.style.display = "none";
    }
  }
}
function fuzzyMatch(q, s) {
  q = q.toLowerCase(); s = s.toLowerCase();
  let i = 0;
  for (const c of s) { if (c === q[i]) i++; if (i >= q.length) break; }
  return i >= q.length;
}
function palCommands() {
  const hasProj = !!S.currentProject;
  const hasTab = !!activeTab();
  const all = [
    ["New Row", "active table", () => doNewRow(), hasTab],
    ["New Row from Existing Row", "clone · active table", () => doCloneRow(), hasTab],
    ["Global Search…", "Ctrl+F", () => showSearch(), true],
    ["Text Find / Replace…", "Ctrl+H", () => showTextTools(), hasTab],
    ["Validate Project", "problems panel", () => validateIntoPanel(), hasProj],
    ["Project Changes…", "", () => showProjectChanges(false), hasProj],
    ["Export to Mods Folder", "Ctrl+E", () => doExportFolder(), hasProj],
    ["Export .jjkmod…", "", () => doExportJjkmod(), hasProj],
    ["Test Patch…", "Ctrl+T", () => doTestPatch(), hasProj],
    ["Snapshots…", "Ctrl+S", () => showSnapshots(), hasProj],
    ["Conflicts…", "", () => showConflicts(), hasProj],
    ["Character Checklist…", "", () => showChecklist(), hasProj],
    ["Character Moveset…", "", () => showMoveset(), hasProj],
    ["Open Project…", "Ctrl+O", () => showOpenProjectModal(), true],
    ["New Project…", "Ctrl+N", () => newProjectFlow(), true],
    ["Edit Manifest / Assets…", "", () => showModModal(false), hasProj],
    ["Export Preview…", "", () => showModModal(true), hasProj],
    ["Manage Characters…", "", () => showCharacters(), true],
    ["Clear Character Filter", "", () => { if (S.charMode) guard(() => setCharMode("")); }, true],
    ["Toggle Sidebar", "Ctrl+B", () => toggleSidebar(), true],
    ["Toggle Problems Panel", "Ctrl+J", () => togglePanel(), true],
    ["Close Current Tab", "Ctrl+W", () => doCloseTab(), hasTab],
    ["Close Other Tabs", "", () => { if (S.activeTabId) closeOtherTabs(S.activeTabId); }, hasTab],
    ["Settings…", "Ctrl+,", () => showSettings(), true],
  ];
  return all.filter((c) => c[3]).map(([label, hint, run]) => ({ kind: "cmd", label, hint, sub: "", run }));
}
function palFiles() {
  const items = [];
  for (const t of S.tables) {
    const c = S.changed[t.file];
    items.push({ kind: "table", label: t.file, sub: `${t.groupLabel || ""}${c ? " · edited" : ""}`, run: () => selectScope({ kind: "table", file: t.file }) });
  }
  for (const a of S.paramAssets) {
    items.push({ kind: "param", label: `${a.shortName}.json`, sub: a.assetName || "", run: () => { S.leftTab = "params"; selectScope({ kind: "param", short: a.shortName }); } });
  }
  return items;
}
function showPalette(mode) {
  S.pal.open = true;
  S.pal.mode = mode === "cmd" ? "cmd" : "files";
  S.pal.cmdLock = mode === "cmd";
  S.pal.sel = 0;
  $("#palette").classList.remove("hidden");
  const input = $("#palInput");
  input.value = S.pal.mode === "cmd" ? ">" : "";
  paintPalette();
  setTimeout(() => input.focus(), 0);
}
function closePalette() {
  S.pal.open = false;
  $("#palette").classList.add("hidden");
}
function paletteItems() {
  return S.pal.mode === "cmd" ? palCommands() : palFiles();
}
function paintPalette() {
  const input = $("#palInput");
  const raw = input.value || "";
  let q = raw;
  if (raw.startsWith(">")) { S.pal.mode = "cmd"; q = raw.slice(1); }
  else if (!S.pal.cmdLock) S.pal.mode = "files";
  input.placeholder = S.pal.mode === "cmd" ? "Type a command…" : "Type a table name, or > for commands…";
  $("#palHint").textContent = S.pal.mode === "cmd" ? "commands · esc to close" : "tables & parameters · type > for commands · esc to close";
  const query = q.trim().toLowerCase();
  const scored = paletteItems().map((it) => {
    const label = it.label.toLowerCase();
    let score = -1;
    if (!query) score = 0;
    else if (label.startsWith(query)) score = 3;
    else if (label.includes(query)) score = 2;
    else if (fuzzyMatch(query, label)) score = 1;
    return { it, score };
  }).filter((x) => x.score >= 0);
  scored.sort((a, b) => b.score - a.score);
  S.pal.items = scored.map((x) => x.it);
  if (S.pal.sel >= S.pal.items.length) S.pal.sel = 0;
  const list = $("#palList");
  list.innerHTML = S.pal.items.slice(0, 60).map((it, i) =>
    `<div class="pal-item${i === S.pal.sel ? " sel" : ""}" data-pal="${i}">` +
    `<span class="pal-kind">${it.kind === "table" ? "TABLE" : it.kind === "param" ? "PARAM" : "CMD"}</span>` +
    `<span class="pal-label">${esc(it.label)}</span>` +
    (it.sub ? `<span class="pal-sub">${esc(it.sub)}</span>` : "") +
    (it.hint ? `<span class="pal-hint">${esc(it.hint)}</span>` : "") + `</div>`
  ).join("") || `<div class="empty-note">No matches</div>`;
  const selEl = list.querySelector(".pal-item.sel");
  if (selEl) selEl.scrollIntoView({ block: "nearest" });
}
function runPalette(idx) {
  const it = S.pal.items[idx !== undefined ? idx : S.pal.sel];
  closePalette();
  if (it && it.run) it.run();
}
// ---------------- per-project tabs: persist + restore ----------------
let _tabsSaveT = null;
function tabsSig() {
  return JSON.stringify([
    S.currentProject,
    S.activeTabId,
    S.tabs.map((t) => [t.kind, t.file, t.short, t.charPrefix, t.statusFilter, t.search, t.visibleFields]),
  ]);
}
function persistTabsSoon() {
  clearTimeout(_tabsSaveT);
  _tabsSaveT = setTimeout(async () => {
    const name = S.currentProject;
    if (!name || !S.project) return;
    const sig = tabsSig();
    if (sig === S._tabsSavedSig) return;
    try {
      const a = activeTab();
      await call("project:save-ui", name, {
        openTabs: S.tabs.map((t) => ({
          kind: t.kind,
          file: t.file,
          short: t.short,
          charPrefix: t.charPrefix || "",
          statusFilter: t.statusFilter || "all",
          search: t.search || "",
          visibleFields: Array.isArray(t.visibleFields) ? t.visibleFields : null,
        })),
        activeTab: a ? { kind: a.kind, file: a.file, short: a.short, charPrefix: a.charPrefix || "" } : null,
      });
      if (S.currentProject === name) S._tabsSavedSig = sig;
    } catch { /* UI state is best-effort */ }
  }, 400);
}
function specKey(s) {
  return `${s.kind || ""}:${s.kind === "param" ? s.short || "" : s.file || ""}:${s.charPrefix || ""}`;
}
async function ensureTabLoaded(t, showBusy) {
  if (!t) return;
  if (t.kind === "rules") {
    if (t.schema) return;
    await guard(async () => {
      if (showBusy) busy("Loading rules...");
      try {
        const d = await call("table:schema", t.file);
        t.schema = d.schema;
        t.docSummary = d.docs;
        await prefillEnumsFor(t.schema);
      } finally {
        if (showBusy) idle();
      }
    });
    return;
  }
  if (t.rowsLoaded) return;
  await guard(async () => {
    if (showBusy) busy("Loading...");
    try {
      if (t.kind === "table" && !t.schema) {
        const d = await call("table:schema", t.file);
        t.schema = d.schema;
        t.docSummary = d.docs;
        await prefillEnumsFor(t.schema);
      }
      await loadTabRows(t, true);
      syncLegacyScope();
    } finally {
      if (showBusy) idle();
    }
  });
}
async function restoreTabs() {
  const ui = S.project && S.project.ui;
  const specs = ((ui && ui.openTabs) || []).filter((s) => s &&
    (s.kind === "table" || s.kind === "param" || s.kind === "rules") && (s.file || s.short));
  const valid = specs.filter((s) => s.kind === "param"
    ? S.paramAssets.some((a) => a.shortName === s.short)
    : !!S.tableByFile[s.file]);
  if (!valid.length) return false;
  S.tabs = [];
  S.activeTabId = null;
  for (const s of valid) {
    const t = makeTab(s.kind, s.kind === "param" ? s.short : s.file);
    t.charPrefix = s.kind === "rules" ? "" : (s.charPrefix || "");
    t.statusFilter = s.statusFilter || "all";
    t.search = s.search || "";
    t.visibleFields = Array.isArray(s.visibleFields) ? s.visibleFields : null;
    t.rowsLoaded = false;
    S.tabs.push(t);
  }
  const wanted = ui && ui.activeTab;
  const active = (wanted && S.tabs.find((t) => specKey(t) === specKey(wanted))) || S.tabs[0];
  S.activeTabId = active.id;
  syncLegacyScope();
  renderScopeList();
  await ensureTabLoaded(active, true);
  syncLegacyScope();
  renderCenter();
  S._tabsSavedSig = tabsSig();
  return true;
}
function bindEvents() {
  $("#btnCharFilter").addEventListener("click", () => toggleCharPicker());

  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.target.matches("input, textarea, select") || !S.currentProject) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
    else if ((k === "y") || (k === "z" && e.shiftKey)) { e.preventDefault(); doRedo(); }
    else if (k === "w") { e.preventDefault(); doCloseTab(); }
  });
  if (window.jjkApi && window.jjkApi.onAutoExport) {
    window.jjkApi.onAutoExport((p) => {
      if (!p) return;
      if (p.ok) toast(`Auto-exported ${p.files} file(s)${p.backupPath ? " (backup kept)" : ""}`, "success");
      else toast(p.error || "Auto-export failed", "error");
    });
  }
  if (window.jjkApi && window.jjkApi.onMenuAction) {
    window.jjkApi.onMenuAction((action, payload) => handleMenuAction(action, payload));
  }
  $$("#activityBar .abtn[data-aview]").forEach((b) => b.addEventListener("click", () => {
    if (!S.sidebarOpen || S.sideView !== b.dataset.aview) setSideView(b.dataset.aview);
    else toggleSidebar();
  }));
  $("#btnSettings").addEventListener("click", () => showSettings());
  $("#stProject").addEventListener("click", () => showOpenProjectModal());
  $("#stChar").addEventListener("click", (e) => { setSideView("explorer"); toggleCharPicker(e.currentTarget, true); });
  $("#stProblems").addEventListener("click", () => { if (!S.problems) validateIntoPanel(); else setPanel(true); });
  $("#stDirty").addEventListener("click", () => setSideView("changes"));
  $("#stExport").addEventListener("click", () => doExportFolder());
  $("#btnEmptyOpen").addEventListener("click", () => showPalette("files"));
  $("#btnEmptySearch").addEventListener("click", () => showSearch());
  $("#btnEmptyProject").addEventListener("click", () => showOpenProjectModal());
  $("#btnGSearch").addEventListener("click", () => runGSearch());
  $("#gSearchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") runGSearch(); });
  $("#gSearchResults").addEventListener("click", (e) => {
    const h = e.target.closest("[data-gsjump]");
    if (!h) return;
    const r = ($("#gSearchResults")._results || [])[Number(h.dataset.gsjump)];
    if (r) jumpToRow(r.file, r.rowId, r.field && !r.field.includes(".") ? r.field : null);
  });
  $("#changesList").addEventListener("click", async (e) => {
    const f = e.target.closest("[data-chgoto]");
    if (f) {
      await selectScope({ kind: "table", file: f.dataset.chgoto });
      const t = activeTab();
      if (t) { t.statusFilter = "edited"; renderCenter(); }
      return;
    }
    const p = e.target.closest("[data-chparam]");
    if (p) { S.leftTab = "params"; setSideView("explorer"); await selectScope({ kind: "param", short: p.dataset.chparam }); }
  });
  $("#btnChRefresh").addEventListener("click", async () => { S.diffCache = null; await renderChangesView(); renderStatusBar(); });
  $("#btnChValidate").addEventListener("click", () => validateIntoPanel());
  $("#btnChSnap").addEventListener("click", () => showSnapshots());
  $("#panel").addEventListener("click", (e) => {
    if (e.target.id === "btnPanelValidate2") { validateIntoPanel(); return; }
    if (e.target.closest(".p-tab")) { S.panelView = "problems"; renderPanel(); return; }
    const j = e.target.dataset && e.target.dataset.pjump;
    if (j) { const parts = j.split("|"); jumpToRow(parts[0], parts[1], parts[2] || null); }
  });
  $("#btnPanelValidate").addEventListener("click", () => validateIntoPanel());
  $("#btnPanelClose").addEventListener("click", () => setPanel(false));
  $("#palInput").addEventListener("input", () => { S.pal.sel = 0; paintPalette(); });
  $("#palInput").addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closePalette(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); S.pal.sel = Math.min(Math.max(S.pal.items.length - 1, 0), S.pal.sel + 1); paintPalette(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); S.pal.sel = Math.max(0, S.pal.sel - 1); paintPalette(); return; }
    if (e.key === "Enter") { runPalette(); }
  });
  $("#palList").addEventListener("click", (e) => {
    const el = e.target.closest("[data-pal]");
    if (el) runPalette(Number(el.dataset.pal));
  });
  $("#palette").addEventListener("mousedown", (e) => { if (e.target.id === "palette") closePalette(); });
  $("#leftTabs").addEventListener("click", (e) => {
    const x = e.target.dataset && e.target.dataset.ltab;
    if (x) { S.leftTab = x; $("#scopeSearch").value = ""; renderScopeList(); }
  });
  let scopeSearchT = null;
  $("#scopeSearch").addEventListener("input", () => { clearTimeout(scopeSearchT); scopeSearchT = setTimeout(renderScopeList, 200); });
  $("#scopeList").addEventListener("click", (e) => {
    const tf = e.target.closest("[data-tfile]");
    if (tf) { selectScope({ kind: "table", file: tf.dataset.tfile }); return; }
    const ps = e.target.closest("[data-pshort]");
    if (ps) { S.leftTab = "params"; selectScope({ kind: "param", short: ps.dataset.pshort }); }
  });
  $("#scopeList").addEventListener("contextmenu", (e) => {
    const tf = e.target.closest("[data-tfile]");
    if (tf) {
      e.preventDefault();
      const file = tf.dataset.tfile;
      showScopeContextMenu(e.clientX, e.clientY, [
        { label: "Open", onClick: () => selectScope({ kind: "table", file }) },
        { label: "Global Rules", onClick: () => openRulesTab(file) },
      ]);
      return;
    }
    const ps = e.target.closest("[data-pshort]");
    if (ps) {
      e.preventDefault();
      const short = ps.dataset.pshort;
      showScopeContextMenu(e.clientX, e.clientY, [
        { label: "Open", onClick: () => { S.leftTab = "params"; selectScope({ kind: "param", short }); } },
      ]);
    }
  });
function closeScopeMenu() {
  const m = $("#ctxMenu");
  if (m) m.remove();
  document.removeEventListener("mousedown", dismissScopeMenu, true);
  document.removeEventListener("keydown", escScopeMenu, true);
}
function dismissScopeMenu(e) {
  const m = $("#ctxMenu");
  if (m && !m.contains(e.target)) closeScopeMenu();
}
function escScopeMenu(e) {
  if (e.key === "Escape") closeScopeMenu();
}
function showScopeContextMenu(x, y, items) {
  closeScopeMenu();
  const div = document.createElement("div");
  div.id = "ctxMenu";
  div.innerHTML = items.map((it, i) => `<div class="ctx-item" data-ctx="${i}">${esc(it.label)}</div>`).join("");
  document.body.appendChild(div);
  div.style.left = `${Math.max(8, Math.min(x, window.innerWidth - div.offsetWidth - 8))}px`;
  div.style.top = `${Math.max(8, Math.min(y, window.innerHeight - div.offsetHeight - 8))}px`;
  div.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-ctx]");
    if (!el) return;
    const it = items[Number(el.dataset.ctx)];
    closeScopeMenu();
    if (it && it.onClick) it.onClick();
  });
  setTimeout(() => {
    document.addEventListener("mousedown", dismissScopeMenu, true);
    document.addEventListener("keydown", escScopeMenu, true);
  }, 0);
}
  $("#tabStrip").addEventListener("click", (e) => {
    const cx = e.target.closest("[data-closetab]");
    if (cx) { e.stopPropagation(); closeTab(cx.dataset.closetab); return; }
    const tb = e.target.closest("[data-tab]");
    if (tb) activateTab(tb.dataset.tab);
  });
  // Middle-click closes a tab. preventDefault on mousedown stops Chromium
  // from entering autoscroll mode so the close is reliable.
  $("#tabStrip").addEventListener("mousedown", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      const tb = e.target.closest("[data-tab]");
      if (tb) closeTab(tb.dataset.tab);
    }
  });
  // Vertical wheel scrolls an overflowing tab strip horizontally.
  $("#tabStrip").addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const el = e.currentTarget;
    if (el.scrollWidth > el.clientWidth + 1) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  }, { passive: false });
  $("#fabFilters").addEventListener("click", () => {
    S.showFilterPanel = !S.showFilterPanel;
    renderFilterPanel();
  });
  $("#fabNewRow").addEventListener("click", () => doNewRow());
  $("#fabCloneRow").addEventListener("click", () => doCloneRow());
  $("#filterPanel").addEventListener("change", (e) => {
    const t = activeTab();
    if (!t) return;
    if (e.target.id === "fpStatus") {
      t.statusFilter = e.target.value;
      renderTabBody();
      updateFab();
      return;
    }
    if (e.target.dataset && e.target.dataset.fpfield) {
      applyPanelFields(t);
    }
  });
  let fpSearchT = null;
  $("#filterPanel").addEventListener("input", (e) => {
    if (e.target.id !== "fpSearch") return;
    const t = activeTab();
    if (!t) return;
    const v = e.target.value;
    clearTimeout(fpSearchT);
    fpSearchT = setTimeout(() => {
      t.search = v;
      t.rowOffset = 0;
      loadTabRows(t, true).then(() => {
        syncLegacyScope();
        renderTabBody();
        updateFab();
      }).catch((err) => toast(err.message, "error"));
    }, 250);
  });
  $("#filterPanel").addEventListener("click", (e) => {
    const t = activeTab();
    if (!t) return;
    if (e.target.id === "fpAll" || e.target.id === "fpNone") {
      const on = e.target.id === "fpAll";
      $$("[data-fpfield]", $("#filterPanel")).forEach((el) => { el.checked = on; });
      applyPanelFields(t);
    }
  });
function applyPanelFields(t) {
  const order = fieldOrderOf(t);
  const checked = $$("[data-fpfield]", $("#filterPanel")).filter((el) => el.checked).map((el) => el.dataset.fpfield);
  t.visibleFields = checked.length === order.length ? null : checked;
  const cnt = $("#fpCount");
  if (cnt) cnt.textContent = `${checked.length} / ${order.length}`;
  renderTabBody();
  updateFab();
}
  $("#tabContent").addEventListener("click", onTabClick);
  $("#tabContent").addEventListener("change", async (e) => {
    const t = activeTab();
    if (!t) return;
    if (e.target.dataset && e.target.dataset.a && (e.target.dataset.a === "op" || e.target.dataset.a === "field")) {
      const act = e.target.closest("[data-action]");
      if (act) {
        const opEl = act.querySelector('[data-a="op"]');
        const fieldEl = act.querySelector('[data-a="field"]');
        const fs = fsForRuleField(fieldEl ? fieldEl.value.trim() : "");
        const host = act.querySelector("[data-aval]");
        if (host) {
          const curOp = opEl ? opEl.value : "set";
          const keepMap = curOp === "map" && host.querySelector("[data-mpairs]");
          if (!keepMap) host.innerHTML = ruleValueWidget({ op: curOp, value: curOp === "map" ? { pairs: [] } : null }, fs);
          else if (e.target.dataset.a === "field") host.innerHTML = ruleValueWidget({ op: curOp, value: { pairs: [] } }, fs);
        }
      }
      return;
    }
    if (e.target.dataset && e.target.dataset.r === "cfield") {
      const card = e.target.closest("[data-rule]");
      const cop = card && card.querySelector('[data-r="cop"]');
      if (card && cop) {
        const cur = cop.value;
        const list = condOpsFor(fsForRuleField(e.target.value.trim()));
        cop.innerHTML = list.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join("");
        cop.value = list.some((o) => o.id === cur) ? cur : (list[0] && list[0].id);
      }
      return;
    }
    const w = e.target.dataset && e.target.dataset.w;
    if (!w) return;
    const card = e.target.closest("[data-card]");
    if (!card || t.kind === "rules") return;
    commitFieldFor(t, card.dataset.card, e.target.dataset.f, card);
  });
  let completeTimer = null;
  let completeField = null;
  $("#tabContent").addEventListener("focusin", async (e) => {
    const el = e.target;
    if (!el || !el.dataset || !el.dataset.idfield) return;
    const t = activeTab();
    if (!t || t.kind !== "table") return;
    const f = el.dataset.f;
    completeField = `${t.id}:${f}`;
    clearTimeout(completeTimer);
    completeTimer = setTimeout(async () => {
      if (completeField !== `${t.id}:${f}`) return;
      try {
        const d = await call("refs:complete", f, el.value.slice(0, 24));
        if (completeField !== `${t.id}:${f}`) return;
        const card = el.closest("[data-card]");
        const dl = card ? card.querySelector("datalist") : $("#idcomplete");
        if (dl) dl.innerHTML = (d.suggestions || []).map((s) => `<option value="${esc(s.value)}">${esc(s.source)}</option>`).join("");
      } catch { /* autocomplete best-effort */ }
    }, 150);
  });
  $("#tabContent").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const w = e.target.dataset && e.target.dataset.w;
    if (!w) return;
    if (w === "str" || w === "num" || w === "list-str" || w === "list-num") e.target.blur();
  });
}
async function onTabClick(e) {
  const t = activeTab();
  if (!t) return;
  const toggle = e.target.closest("[data-toggle]");
  if (toggle && !e.target.closest("button")) {
    const rowId = toggle.dataset.toggle;
    if (t.expanded[rowId]) collapseRow(t, rowId);
    else await expandRow(t, rowId, null, true);
    return;
  }

  const card = e.target.closest("[data-card]");
  const rowId = card && card.dataset.card;
  const arrBtn = e.target.closest("[data-arrdel],[data-arradd]");
  if (arrBtn && card && rowId) {
    const t = activeTab();
    if (!t || t.kind === "rules") return;
    if (arrBtn.hasAttribute("data-arrdel")) {
      const listEl = arrBtn.closest(".arr-list");
      const row = arrBtn.closest(".arr-row");
      if (row) row.remove();
      if (listEl) commitFieldFor(t, rowId, listEl.dataset.f, card);
    } else {
      const listEl = arrBtn.closest(".arr-list");
      if (listEl) {
        const fname = listEl.dataset.f;
        const numeric = arrBtn.dataset.addkind === "num";
        const div = document.createElement("div");
        div.className = "arr-row";
        const input = document.createElement("input");
        input.dataset.f = fname;
        if (numeric) {
          input.type = "number"; input.step = "any";
          input.dataset.w = "list-num"; input.value = "0";
        } else {
          input.type = "text"; input.dataset.w = "list-str"; input.value = "";
          if (arrBtn.dataset.addid) { input.setAttribute("list", "idcomplete"); input.dataset.idfield = "1"; }
        }
        const del = document.createElement("button");
        del.className = "small danger"; del.setAttribute("data-arrdel", "");
        del.title = "Remove"; del.textContent = "×";
        div.appendChild(input);
        div.appendChild(del);
        listEl.insertBefore(div, arrBtn);
        input.focus();
      }
    }
    return;
  }
  const factEl = e.target.closest && e.target.closest("[data-fact]");
  const fact = factEl && factEl.dataset.fact;
  if (fact && rowId) {
    const fieldEl = e.target.closest("[data-field]");
    const f = fieldEl && fieldEl.dataset.field;
    if (!f) return;
    if (fact === "doc" || fact === "info") { showFieldPopup(t, rowId, f); return; }
    if (fact === "refs") { showRefTargets(f); return; }
    if (fact === "reset") {
      await guard(async () => {
        const d = await call("row:reset-field", t.file, rowId, f);
        S.changed = d.changed;
        t.expanded[rowId] = await call("row:get", t.file, rowId);
        await loadTabRows(t, true);
        syncLegacyScope();
        renderScopeHeader();
        renderTabBody();
        renderScopeList();
        updateProjChangeCount();
        updateDirtyState();
      });
      return;
    }
  }
  const act = e.target.dataset && e.target.dataset.act;
  if (act && rowId) {
    if (act === "referenced-by") { showReferencedBy(rowId); return; }
    if (act === "propagate-en") {
      await guard(async () => {
        busy("Copying EN text…");
        try {
          const d = await call("i18n:propagate-en", t.file, rowId);
          S.changed = d.changed || S.changed;
          t.expanded[rowId] = await call("row:get", t.file, rowId);
          syncLegacyScope();
          renderTabBody();
          renderScopeHeader();
          renderScopeList();
          toast(d.copied ? `Copied ${d.copied} field(s) from ${d.srcFile}` : "Already in sync with EN", "success");
        } finally { idle(); }
      });
      return;
    }
    if (act === "revert-row") {
      await guard(async () => {
        const d = await call("row:revert", t.file, rowId);
        S.changed = d.changed;
        t.expanded[rowId] = await call("row:get", t.file, rowId);
        await loadTabRows(t, true);
        syncLegacyScope();
        renderScopeHeader();
        renderTabBody();
        renderScopeList();
        updateProjChangeCount();
      });
      return;
    }
    if (act === "del-new") {
      await guard(async () => {
        const d = await call("row:delete", t.file, rowId);
        S.changed = d.changed;
        delete t.expanded[rowId];
        t.expandOrder = t.expandOrder.filter((x) => x !== rowId);
        await loadTabRows(t, true);
        syncLegacyScope();
        renderScopeHeader();
        renderTabBody();
        renderScopeList();
        updateProjChangeCount();
      });
      return;
    }
  }
  const pact = e.target.dataset && e.target.dataset.pact;
  if (pact && rowId) {
    if (pact === "clone-vanilla") {
      const nid = await promptModal("Clone vanilla row", [{ label: "New row ID", value: rowId }], "Clone");
      if (!nid) return;
      await guard(async () => {
        await call("param:clone", t.short, rowId, nid);
        await loadTabRows(t, true);
        syncLegacyScope();
        renderTabBody();
        await expandRow(t, nid, null, true);
        updateProjChangeCount();
      });
      return;
    }
    if (pact === "del") {
      await guard(async () => {
        await call("param:delete", t.short, rowId);
        delete t.expanded[rowId];
        t.expandOrder = t.expandOrder.filter((x) => x !== rowId);
        await loadTabRows(t, true);
        syncLegacyScope();
        renderTabBody();
        updateProjChangeCount();
      });
      return;
    }
    if (pact === "dup") {
      const nid = await promptModal("Duplicate row", [{ label: "New row ID", value: `${rowId}_copy` }], "Duplicate");
      if (!nid) return;
      await guard(async () => {
        await call("param:create", t.short, nid, rowId);
        await loadTabRows(t, true);
        syncLegacyScope();
        renderTabBody();
        await expandRow(t, nid, null, true);
      });
      return;
    }
    if (pact === "save-scalar") {
      const input = card.querySelector("[data-pscalar]");
      const v = input ? input.value : "";
      await guard(async () => {
        await call("param:set", t.short, rowId, v);
        t.expanded[rowId] = await normalizeParamData(t, rowId);
        syncLegacyScope();
        renderTabBody();
        toast("Saved", "success");
      });
      return;
    }
  }
  if (e.target.id === "btnAddRule" && t.kind === "rules") {
    await guard(async () => {
      const d = await call("rules:add", t.file, {});
      S.changed = d.changed;
      syncLegacyScope();
      renderTabBody();
      updateDirtyState();
      renderScopeList();
      afterRulesMutated(t, d.affected);
      updateProjChangeCount();
    });
    return;
  }
  if (e.target.dataset && e.target.dataset.madd) {
    const mp = e.target.closest(".map-pairs");
    if (mp) {
      const div = document.createElement("div");
      div.className = "map-pair";
      const act = e.target.closest("[data-action]");
      const fieldEl = act && act.querySelector('[data-a="field"]');
      const fs = fsForRuleField(fieldEl ? fieldEl.value.trim() : "");
      div.innerHTML = `${mapSideInput("from", fs.enumName, "")}<span class="arrow">\u2192</span>${mapSideInput("to", fs.enumName, "")}<button class="small danger" data-mdel>\u00d7</button>`;
      mp.appendChild(div);
    }
    return;
  }
  if (e.target.dataset && (e.target.dataset.mdel !== undefined && e.target.hasAttribute("data-mdel"))) {
    const pr = e.target.closest(".map-pair");
    if (pr) pr.remove();
    return;
  }
  const abtn = e.target.dataset && e.target.dataset.a;
  if (abtn && t.kind === "rules") {
    const rcard = e.target.closest("[data-rule]");
    if (!rcard) return;
    if (abtn === "aadd") {
      const stack = rcard.querySelector(`[data-stack="${e.target.dataset.stack || "then"}"]`);
      const addBtn = stack && stack.querySelector('[data-a="aadd"]');
      if (addBtn) addBtn.insertAdjacentHTML("beforebegin", actionBlockHtml({ field: "", op: "set", value: null }));
      else if (stack) stack.insertAdjacentHTML("beforeend", actionBlockHtml({ field: "", op: "set", value: null }));
      return;
    }
    const act = e.target.closest("[data-action]");
    if (!act) return;
    const stack = act.parentElement;
    if (abtn === "del") { act.remove(); return; }
    const sib = abtn === "up" ? act.previousElementSibling : act.nextElementSibling;
    if ((abtn === "up" || abtn === "down") && sib && sib.hasAttribute("data-action")) {
      stack.insertBefore(abtn === "up" ? act : sib, abtn === "up" ? sib : act);
      return;
    }
    if (abtn === "addbelow") { act.insertAdjacentHTML("afterend", actionBlockHtml({ field: "", op: "set", value: null })); return; }
  }
  const rbtn = e.target.dataset && e.target.dataset.r;
  if (rbtn && t.kind === "rules") {
    const rcard = e.target.closest("[data-rule]");
    const ruleId = rcard && rcard.dataset.rule;
    if (!ruleId) return;
    if (rbtn === "del") {
      await guard(async () => {
        const d = await call("rules:delete", t.file, ruleId);
        S.changed = d.changed;
        renderTabBody();
        afterRulesMutated(t, d.affected);
        updateProjChangeCount();
      });
      return;
    }
    if (rbtn === "up" || rbtn === "down") {
      await guard(async () => {
        const d = await call("rules:move", t.file, ruleId, rbtn);
        S.changed = d.changed || S.changed;
        renderTabBody();
        afterRulesMutated(t, d.affected);
        updateProjChangeCount();
      });
      return;
    }
    if (rbtn === "save") {
      await guard(async () => {
        let patch;
        try { patch = readRuleCard(rcard); }
        catch (err) { toast(err.message, "error"); return; }
        const d = await call("rules:update", t.file, ruleId, patch);
        S.changed = d.changed;
        toast("Rule applied", "success");
        renderTabBody();
        afterRulesMutated(t, d.affected);
        updateProjChangeCount();
      });
      return;
    }
    if (rbtn === "match") {
      await guard(async () => {
        let cond;
        try { cond = readCond(rcard); }
        catch (err) { toast(err.message, "error"); return; }
        const d = await call("rules:match-count", t.file, cond);
        const out = rcard.querySelector('[data-r="matchout"]');
        if (out) out.textContent = d.error ? `error: ${d.error}` : `matches ${d.match} / ${d.total} rows`;
      });
      return;
    }
  }
}
async function loadEnumsMap() {
  const map = {};
  for (const name of S.enums) map[name] = { members: [] };
  S._enumsMap = map;
  return map;
}
const _enumFillInFlight = new Set();
async function ensureEnumMembers(enumName) {
  if (!enumName || !S._enumsMap || !S._enumsMap[enumName]) return;
  if (S._enumsMap[enumName].members.length > 0) return;
  if (_enumFillInFlight.has(enumName)) return;
  _enumFillInFlight.add(enumName);
  try {
    const t = activeTab();
    const base = t && t.kind === "table" ? baseFamilyOf(t.file).base : "DamageDataTable";
    const family = t && t.kind === "table" ? baseFamilyOf(t.file).family : "DamageDataTable";
    const d = await call("docs:field", base, family, "__probe__", enumName);
    if (d.enum && d.enum.members) S._enumsMap[enumName] = { members: d.enum.members };
  } catch { /* leave empty */ }
  finally { _enumFillInFlight.delete(enumName); }
}
async function prefillEnumsFor(schema) {
  if (!schema) return;
  const needed = new Set();
  for (const f of Object.values(schema.fields || {})) {
    if (f.enumName && (!S._enumsMap[f.enumName] || S._enumsMap[f.enumName].members.length === 0)) needed.add(f.enumName);
  }
  await Promise.all([...needed].map(ensureEnumMembers));
}
document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  try {
    const d = await call("state:init");
    S.config = d.config;
    S.projects = d.projects;
    S.currentProject = d.currentProject;
    S.project = d.project;
    S.tables = d.tables || [];
    S.tableByFile = {};
    for (const x of S.tables) S.tableByFile[x.file] = x;
    S.changed = d.changed || {};
    S.enums = d.enums || [];
    S.chars = d.chars || {};
    S.paramAssets = d.paramAssets || [];
    S.ruleOps = d.ruleOps || [];
    S.condOps = d.condOps || [];
    S.charMode = (d.config && d.config.charMode) || "";
    if (d.tablesError) toast(`Input tables: ${d.tablesError}`, "warn");
    S._enumsMap = await loadEnumsMap();
    renderProjects();
    populateCharSelect();
    renderSide();
    renderScopeList();
    renderStatusBar();
    renderPanel();
    ensureCharData();
    let restored = false;
    if (S.project) {
      try { restored = await restoreTabs(); } catch { restored = false; }
    }
    if (!restored) {
      // No saved tabs: fall back to the character jump or the first table.
      // When tabs were restored, skip the jump so it can't hijack the active tab.
      if (S.charMode) {
        await setCharMode(S.charMode);
      } else if (S.tables.length > 0) {
        await selectScope({ kind: "table", file: S.tables[0].file });
      } else if (S.paramAssets.length > 0) {
        await selectScope({ kind: "param", short: S.paramAssets[0].shortName });
      } else renderCenter();
    }
    updateProjChangeCount();
    refreshHistory();
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px"><h2>Failed to start</h2><div class="err">${esc(err.message)}</div></div>`;
  }
});
