// Cross-store orchestrations mirroring the global functions in
// renderer/app.js (selectScope, jumpToRow, doNewRow, export flows, …).
// Stores never import this module (no cycles); components and App call it.
import { client } from "../api/client";
import { api } from "../api/ipc";
import { fetchParamRowsFiltered, fetchTableRowsAll, fetchTableSchema, keys } from "../api/queries";
import { charLabelOf, useProject } from "../stores/project";
import { makeRestoredTab, tabSpecKey, useTabs } from "../stores/tabs";
import type { Tab } from "../api/types";
import { useUi } from "../stores/ui";

export function shortVal(v: any, max = 160): string {
  let s: string;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (s === undefined) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function baseFamilyOf(file: string | null | undefined): { base: string; family: string } {
  const entry = (file && useProject.getState().tableByFile[file]) || null;
  if (entry) return { base: entry.base, family: entry.family };
  let stem = String(file || "").replace(/\.json$/i, "");
  const m = stem.match(/_((?:Es_LA)|(?:Zh_Han[st])|De|En|Es|Fr|It|Ja|Ko|Pt)$/);
  let locale: string | null = null;
  if (m) {
    locale = m[1];
    stem = stem.slice(0, -(locale.length + 1));
  }
  const family = stem.replace(/\d+$/, "") || stem;
  return { base: stem, family };
}

export function docsBaseOf(tab: Tab): string {
  if (tab.kind === "param") return `parameters.${tab.short}`;
  return baseFamilyOf(tab.file).base;
}

export function docsFamilyOf(tab: Tab): string {
  if (tab.kind === "param") return `parameters.${tab.short}`;
  return baseFamilyOf(tab.file).family;
}

export async function guard(fn: () => Promise<any> | any, busyMsg?: string) {
  const ui = useUi.getState();
  try {
    if (busyMsg) ui.setBusy(busyMsg);
    await fn();
  } catch (e: any) {
    ui.toast(e?.message || String(e), "error");
  } finally {
    if (busyMsg) ui.setBusy(null);
  }
}

// ---------------- cache refresh ----------------

export function invalidateDiff() {
  void client.invalidateQueries({ queryKey: keys.diff });
}

export function refreshTabRows(tab: Tab) {
  if (tab.kind === "table" && tab.file) {
    void client.invalidateQueries({ queryKey: ["tableRows", tab.file] });
    void client.invalidateQueries({ queryKey: ["row", tab.file] });
  } else if (tab.kind === "param" && tab.short) {
    void client.invalidateQueries({ queryKey: ["paramRows", tab.short] });
    void client.invalidateQueries({ queryKey: ["paramRow", tab.short] });
  }
  invalidateDiff();
}

export async function refreshAfterHistory(d: { project: any; changed: any }) {
  useProject.getState().reloadAfterHistory(d.project, d.changed || {});
  await client.invalidateQueries();
  void useProject.getState().refreshHistory();
}

// ---------------- tabs ----------------

export function prefetchTab(tab: Tab) {
  try {
    if (tab.kind === "table" && tab.file) {
      void client.prefetchQuery({
        queryKey: keys.schema(tab.file),
        queryFn: () => fetchTableSchema(tab.file!),
        staleTime: 5 * 60_000,
      });
      void client.prefetchQuery({
        queryKey: keys.tableRows(tab.file, tab.charPrefix || "", tab.search || ""),
        queryFn: () => fetchTableRowsAll(tab.file!, tab.charPrefix || "", tab.search || ""),
        staleTime: 10_000,
      });
    } else if (tab.kind === "param" && tab.short) {
      void client.prefetchQuery({
        queryKey: keys.paramRows(tab.short, tab.search || "", tab.charPrefix || ""),
        queryFn: () => fetchParamRowsFiltered(tab.short!, tab.search || "", tab.charPrefix || ""),
        staleTime: 10_000,
      });
    } else if (tab.kind === "rules" && tab.file) {
      void client.prefetchQuery({
        queryKey: keys.schema(tab.file),
        queryFn: () => fetchTableSchema(tab.file!),
        staleTime: 5 * 60_000,
      });
    }
  } catch {
    /* best effort */
  }
}

export function selectScope(scope: { kind: "table"; file: string } | { kind: "param"; short: string }) {
  const tabs = useTabs.getState();
  const charMode = useProject.getState().charMode || "";
  let t: Tab;
  if (scope.kind === "table") t = tabs.openTable(scope.file, charMode);
  else t = tabs.openParam(scope.short, charMode);
  const live = useTabs.getState().tabs.find((x) => x.id === t.id) || t;
  prefetchTab(live);
  // Like loadTabRows(t, true): reselecting a scope reloads it from the server.
  refreshTabRows(live);
}

export async function openOriginalJson(file: string) {
  await guard(async () => {
    await api.fileOpenOriginal(file);
  });
}

export async function openProjectJson() {
  await guard(async () => {
    await api.fileOpenProject();
  });
}

export function openRulesTab(file: string) {
  const t = useTabs.getState().openRules(file);
  prefetchTab(useTabs.getState().tabs.find((x) => x.id === t.id) || t);
}

export function flashField(rowId: string, focusField?: string | null) {
  if (!focusField) return;
  try {
    const card = document.querySelector(`#centerBody [data-card="${CSS.escape(rowId)}"]`);
    if (!card) return;
    const el = card.querySelector(`[data-field="${CSS.escape(focusField)}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 2200);
    }
  } catch {
    /* ignore */
  }
}

export async function jumpToRow(file: string, rowId: string, focusField?: string | null) {
  const tabs = useTabs.getState();
  const open = tabs.tabs.filter((x) => x.kind === "table" && x.file === file);
  const rowPrefix = (String(rowId || "").match(/^(?:CN|CP)_\d{3}/) || [""])[0];
  let t =
    open.find((x) => (x.charPrefix || "") === rowPrefix) ||
    open.find((x) => !x.charPrefix) ||
    open[0];
  if (!t) {
    // New tab is opened for this row: scope it so the row is visible.
    t = tabs.openSpecificTable(file, rowPrefix);
  } else {
    tabs.activate(t.id);
  }
  const id = t.id;
  prefetchTab(t);
  refreshTabRows(t);
  if (rowId && t.charPrefix && !rowId.startsWith(t.charPrefix)) {
    useUi.getState().toast(`Target is outside this tab's ${t.charPrefix} filter — opening anyway`, "warn");
  }
  useTabs.getState().setExpanded(id, rowId, true);
  useTabs.getState().patch(id, { flash: { row: rowId, field: focusField || null } });
}

export async function resolveAndJump(family: string, rowId: string) {
  await guard(async () => {
    const ui = useUi.getState();
    ui.setBusy("Locating row…");
    let file: string | null = null;
    try {
      if (family === "__attack__" || family === "__damage__") {
        const d = await api.globalSearch(rowId, 10);
        const hit = (d.results || []).find((r) => r.rowId === rowId);
        if (hit) file = hit.file;
      } else file = family;
    } finally {
      ui.setBusy(null);
    }
    if (!file) {
      ui.toast(`Row not found: ${rowId}`, "error");
      return;
    }
    void jumpToRow(file, rowId);
  });
}

// ---------------- rows ----------------

let lastCommitKey = "";
export async function commitTableField(tab: Tab, rowId: string, field: string, value: any) {
  const ckey = `table:${tab.file}:${rowId}:${field}:${JSON.stringify(value)}`;
  if (lastCommitKey === ckey) return;
  lastCommitKey = ckey;
  await guard(async () => {
    const d = await api.rowSetField(tab.file!, rowId, field, value);
    if (d.warning) useUi.getState().toast(d.warning, "warn");
    useProject.getState().setChanged(d.changed || useProject.getState().changed);
    await client.invalidateQueries({ queryKey: keys.row(tab.file!, rowId) });
    refreshTabRows(tab);
  });
}

export function setPathLocal(obj: any, p: string, v: any) {
  const segs = String(p).split(".");
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur[segs[i]] === null || typeof cur[segs[i]] !== "object") cur[segs[i]] = {};
    cur = cur[segs[i]];
  }
  cur[segs[segs.length - 1]] = v;
  return obj;
}

export async function commitParamField(tab: Tab, rowId: string, fieldPath: string, value: any, current: any) {
  await guard(async () => {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      useUi.getState().toast("Row is a single value; editing whole row instead", "warn");
      return;
    }
    const next = JSON.parse(JSON.stringify(current));
    setPathLocal(next, fieldPath, value);
    await api.paramSet(tab.short!, rowId, next);
    await client.invalidateQueries({ queryKey: keys.paramRow(tab.short!, rowId) });
    refreshTabRows(tab);
  });
}

export async function saveScalarParam(tab: Tab, rowId: string, value: string) {
  await guard(async () => {
    await api.paramSet(tab.short!, rowId, value);
    await client.invalidateQueries({ queryKey: keys.paramRow(tab.short!, rowId) });
    refreshTabRows(tab);
    useUi.getState().toast("Saved", "success");
  });
}

export async function resetTableField(tab: Tab, rowId: string, field: string) {
  await guard(async () => {
    const d = await api.rowResetField(tab.file!, rowId, field);
    useProject.getState().setChanged(d.changed);
    await client.invalidateQueries({ queryKey: keys.row(tab.file!, rowId) });
    refreshTabRows(tab);
  });
}

export async function revertTableRow(tab: Tab, rowId: string) {
  await guard(async () => {
    const d = await api.rowRevert(tab.file!, rowId);
    useProject.getState().setChanged(d.changed);
    await client.invalidateQueries({ queryKey: keys.row(tab.file!, rowId) });
    refreshTabRows(tab);
  });
}

export async function deleteNewTableRow(tab: Tab, rowId: string) {
  await guard(async () => {
    const d = await api.rowDelete(tab.file!, rowId);
    useProject.getState().setChanged(d.changed);
    useTabs.getState().setExpanded(tab.id, rowId, false);
    refreshTabRows(tab);
  });
}

export async function propagateEn(tab: Tab, rowId: string) {
  await guard(async () => {
    const ui = useUi.getState();
    ui.setBusy("Copying EN text…");
    try {
      const d = await api.i18nPropagateEn(tab.file!, rowId);
      useProject.getState().setChanged(d.changed || useProject.getState().changed);
      await client.invalidateQueries({ queryKey: keys.row(tab.file!, rowId) });
      refreshTabRows(tab);
      ui.toast(d.copied ? `Copied ${d.copied} field(s) from ${d.srcFile}` : "Already in sync with EN", "success");
    } finally {
      ui.setBusy(null);
    }
  });
}

export async function cloneVanillaParam(tab: Tab, rowId: string) {
  const nid = await useUi.getState().prompt("Clone vanilla row", [{ label: "New row ID", value: rowId }], "Clone");
  if (!nid || typeof nid !== "string") return;
  await guard(async () => {
    await api.paramClone(tab.short!, rowId, nid);
    refreshTabRows(tab);
    useTabs.getState().setExpanded(tab.id, nid, true);
  });
}

export async function deleteParamRow(tab: Tab, rowId: string) {
  await guard(async () => {
    await api.paramDelete(tab.short!, rowId);
    useTabs.getState().setExpanded(tab.id, rowId, false);
    refreshTabRows(tab);
  });
}

export async function dupParamRow(tab: Tab, rowId: string) {
  const nid = await useUi
    .getState()
    .prompt("Duplicate row", [{ label: "New row ID", value: `${rowId}_copy` }], "Duplicate");
  if (!nid || typeof nid !== "string") return;
  await guard(async () => {
    await api.paramCreate(tab.short!, nid, rowId);
    refreshTabRows(tab);
    useTabs.getState().setExpanded(tab.id, nid, true);
  });
}

export async function doNewRow() {
  const t = useTabs.getState().active();
  if (!t || t.kind === "rules") return;
  const ui = useUi.getState();
  if (t.kind === "param") {
    const id = await ui.prompt("New parameter row", [{ label: "Row ID", value: t.charPrefix || "" }], "Create");
    if (!id || typeof id !== "string") return;
    await guard(async () => {
      await api.paramCreate(t.short!, id);
      refreshTabRows(t);
      useTabs.getState().setExpanded(t.id, id, true);
    });
    return;
  }
  const id = await ui.prompt(
    "New row",
    [{ label: "Row ID (unique across table family)", value: t.charPrefix || "" }],
    "Create",
  );
  if (!id || typeof id !== "string") return;
  await guard(
    async () => {
      const d = await api.rowCreate(t.file!, id, null);
      useProject.getState().setChanged(d.changed);
      refreshTabRows(t);
      useTabs.getState().setExpanded(t.id, id, true);
    },
    "Creating row...",
  );
}

export async function doCloneRow() {
  const t = useTabs.getState().active();
  if (!t || t.kind === "rules") return;
  const ui = useUi.getState();
  if (t.kind === "param") {
    const vals = await ui.prompt(
      "Clone parameter row",
      [
        { label: "Clone from row ID (in this file)", value: "" },
        { label: "New row ID", value: "" },
      ],
      "Clone",
    );
    if (!vals || !Array.isArray(vals)) return;
    const [base, nid] = vals;
    if (!base || !nid) {
      ui.toast("Both IDs are required", "error");
      return;
    }
    await guard(async () => {
      await api.paramCreate(t.short!, nid, base);
      refreshTabRows(t);
      useTabs.getState().setExpanded(t.id, nid, true);
    });
    return;
  }
  const vals = await ui.prompt(
    "New row from existing row",
    [
      { label: "Clone from row ID", value: "" },
      { label: "New row ID (unique across table family)", value: t.charPrefix || "" },
    ],
    "Create",
  );
  if (!vals || !Array.isArray(vals)) return;
  const [base, nid] = vals;
  if (!base || !nid) {
    ui.toast("Both IDs are required", "error");
    return;
  }
  await guard(
    async () => {
      const d = await api.rowCreate(t.file!, nid, base);
      useProject.getState().setChanged(d.changed);
      refreshTabRows(t);
      useTabs.getState().setExpanded(t.id, nid, true);
    },
    "Creating row...",
  );
}

// ---------------- rules ----------------

export async function afterRulesMutated(tab: Tab, files?: string[]) {
  refreshTabRows(tab);
  // Rules tab itself re-renders from the server (like renderRulesTab). 
  if (tab.file) void client.invalidateQueries({ queryKey: keys.rules(tab.file) });
  const set = new Set(files && files.length ? files : [tab.file!]);
  for (const f of set) {
    void client.invalidateQueries({ queryKey: ["tableRows", f] });
    void client.invalidateQueries({ queryKey: ["row", f] });
  }
  invalidateDiff();
}

// ---------------- projects ----------------

export async function openProject(name: string) {
  const d = await api.projectOpen(name);
  const proj = useProject.getState();
  useTabs.getState().reset();
  proj.setProjectData({ currentProject: name, project: d.project, changed: d.changed || {} });
  useUi.getState().setProblems(null);
  await client.invalidateQueries();
  const restored = await restoreTabs().catch(() => false);
  if (!restored) {
    if (useProject.getState().charMode) {
      await setCharMode(useProject.getState().charMode);
    }
  }
  void proj.refreshHistory();
}

export async function newProjectFlow() {
  const name = await useUi.getState().prompt("New project", [{ label: "Project name", value: "" }], "Create");
  if (!name || typeof name !== "string") return;
  await guard(async () => {
    const d = await api.projectCreate(name);
    useTabs.getState().reset();
    useProject.getState().setProjectData({ projects: d.projects, currentProject: d.project.name, project: d.project, changed: {} });
    useUi.getState().setProblems(null);
    await client.invalidateQueries();
  }, "Creating...");
}

export async function dupProjectFlow() {
  const cur = useProject.getState().currentProject;
  if (!cur) return;
  const name = await useUi.getState().prompt("Duplicate project", [{ label: "New name", value: `${cur} copy` }], "Duplicate");
  if (!name || typeof name !== "string") return;
  await guard(async () => {
    const d = await api.projectDuplicate(cur, name);
    useProject.getState().setProjectData({ projects: d.projects });
    useUi.getState().toast(`Duplicated as "${d.project.name}"`, "success");
  });
}

export async function renameProjectFlow() {
  const cur = useProject.getState().currentProject;
  if (!cur) return;
  const name = await useUi.getState().prompt("Rename project", [{ label: "New name", value: cur }], "Rename");
  if (!name || typeof name !== "string" || name === cur) return;
  await guard(async () => {
    const d = await api.projectRename(cur, name);
    useProject.getState().setProjectData({ projects: d.projects, currentProject: d.project.name, project: d.project });
  });
}

export async function delProjectFlow() {
  const cur = useProject.getState().currentProject;
  if (!cur) return;
  const name = await useUi
    .getState()
    .prompt("Delete project (cannot be undone)", [{ label: `Type "${cur}" to confirm`, value: "" }], "Delete");
  if (name !== cur) return;
  await guard(async () => {
    const d = await api.projectDelete(cur);
    const proj = useProject.getState();
    proj.setProjectData({ projects: d.projects, currentProject: d.currentProject, project: null, changed: {} });
    useUi.getState().setProblems(null);
    useTabs.getState().reset();
    await client.invalidateQueries();
    if (d.currentProject) {
      const p = await api.projectOpen(d.currentProject);
      proj.setProjectData({ currentProject: d.currentProject, project: p.project, changed: p.changed });
    }
  });
}

// ---------------- per-character mode ----------------

export function projectParamRows(short: string): string[] {
  const p = useProject.getState().project?.parameters?.[short];
  if (!p || !p.rows) return [];
  return Object.keys(p.rows).filter((k) => k.charAt(0) !== "$");
}

export function paramMatchesChar(short: string, projectRows: string[]): boolean {
  const { charMode, paramVanillaIds } = useProject.getState();
  if (!charMode) return true;
  const ids = paramVanillaIds[short] || [];
  if (ids.some((id) => id.startsWith(charMode))) return true;
  return (projectRows || []).some((id) => id.startsWith(charMode));
}

export async function setCharMode(prefix: string) {
  const proj = useProject.getState();
  proj.setCharModeLocal(prefix || "");
  try {
    const cfg = await api.saveSettings({ charMode: prefix || "" });
    useProject.getState().setProjectData({ config: cfg });
  } catch {
    /* non-fatal */
  }
  if (!prefix) return;
  const st = useProject.getState();
  if (!st.prefixIndex) {
    useUi.getState().setBusy("Indexing character rows (one-time)…");
    try {
      await st.ensureCharData();
    } catch (e: any) {
      useUi.getState().toast(`Character index: ${e?.message || e}`, "warn");
    } finally {
      useUi.getState().setBusy(null);
    }
  }
  const s2 = useProject.getState();
  // Existing tabs keep their own filters. Jump to the first scope
  // containing this character's rows.
  let target: { kind: "table"; file: string } | { kind: "param"; short: string } | null = null;
  if (s2.prefixIndex) {
    const hit = s2.tables.find((t) => s2.prefixIndex![t.file]?.[prefix]);
    if (hit) target = { kind: "table", file: hit.file };
  }
  if (!target) {
    const p = s2.paramAssets.find((a) => paramMatchesChar(a.shortName, projectParamRows(a.shortName)));
    if (p) target = { kind: "param", short: p.shortName };
  }
  if (target) {
    if (target.kind === "table") selectScope({ kind: "table", file: target.file });
    else selectScope({ kind: "param", short: target.short });
  } else {
    useUi.getState().toast(`${prefix} has no rows in any table or parameter file`, "warn");
  }
}

// ---------------- history ----------------

function activeElementIsEditable(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || (el.matches !== undefined && el.matches("input, textarea, select")));
}

export async function doUndo() {
  if (activeElementIsEditable()) {
    try {
      document.execCommand("undo");
    } catch {
      /* ignore */
    }
    return;
  }
  await guard(async () => {
    const d = await api.historyUndo();
    await refreshAfterHistory(d);
    useUi.getState().toast("Undone", "success");
  });
}

export async function doRedo() {
  if (activeElementIsEditable()) {
    try {
      document.execCommand("redo");
    } catch {
      /* ignore */
    }
    return;
  }
  await guard(async () => {
    const d = await api.historyRedo();
    await refreshAfterHistory(d);
    useUi.getState().toast("Redone", "success");
  });
}

export function doCloseTab() {
  // Closing would drop focus (and a half-typed value): blur first to commit,
  // and let a second press close.
  if (activeElementIsEditable()) {
    try {
      (document.activeElement as HTMLElement).blur();
    } catch {
      /* ignore */
    }
    return;
  }
  const id = useTabs.getState().activeTabId;
  if (id) useTabs.getState().close(id);
}

// ---------------- export / import / patch ----------------

export async function doExportFolder() {
  await guard(async () => {
    const ui = useUi.getState();
    ui.setBusy("Building mod (baking parameter assets)...");
    try {
      const prev = await api.exportPreview();
      ui.openModal("exportConfirm", { preview: prev });
    } finally {
      ui.setBusy(null);
    }
  });
}

export async function confirmExportFolder() {
  await guard(async () => {
    const res = await api.exportFolder();
    try {
      const d = await api.tablesList();
      const proj = useProject.getState();
      const tableByFile: Record<string, any> = {};
      for (const x of d.tables) tableByFile[x.file] = x;
      proj.setTablesData(d.tables as any, tableByFile, d.changed);
      if (d.tablesError) useUi.getState().toast(d.tablesError, "warn");
    } catch {
      /* ignore */
    }
    await client.invalidateQueries();
    useUi.getState().toast(
      `Exported ${res.files.length} file(s) to ${res.path}${res.removed ? ` (${res.removed} stale removed)` : ""}`,
      "success",
    );
    (res.warnings || []).forEach((w) => useUi.getState().toast(w, "warn"));
  }, "Exporting...");
}

export async function doExportJjkmod() {
  await guard(async () => {
    useUi.getState().setBusy("Packaging .jjkmod...");
    try {
      const res = await api.exportJjkmod();
      if (!res.cancelled) useUi.getState().toast(`Wrote ${res.path}`, "success");
    } finally {
      useUi.getState().setBusy(null);
    }
  });
}

export async function doImport() {
  await guard(async () => {
    const ui = useUi.getState();
    ui.setBusy("Importing...");
    try {
      const res = await api.importFolder();
      if (res.cancelled) return;
      useTabs.getState().reset();
      useProject.getState().setProjectData({ projects: res.projects, currentProject: res.project.name, project: res.project, changed: {} });
      ui.setProblems(null);
      try {
        const d = await api.tablesList();
        const tableByFile: Record<string, any> = {};
        for (const x of d.tables) tableByFile[x.file] = x;
        useProject.getState().setTablesData(d.tables as any, tableByFile, d.changed);
      } catch {
        /* ignore */
      }
      await client.invalidateQueries();
      (res.warnings || []).forEach((w) => ui.toast(w, "warn"));
      ui.toast(`Imported as "${res.project.name}"`, "success");
    } finally {
      ui.setBusy(null);
    }
  });
}

export async function doTestPatch() {
  await guard(async () => {
    const ui = useUi.getState();
    ui.setBusy("Patching cooked tables + baking parameters...");
    try {
      const res = await api.patcherTest();
      ui.openModal("patchResult", { result: res });
    } finally {
      ui.setBusy(null);
    }
  });
}

// ---------------- validation ----------------

export async function validateIntoPanel() {
  const ui = useUi.getState();
  ui.setPanelOpen(true, "problems");
  await guard(async () => {
    const v = await api.validateProject();
    useUi.getState().setProblems(v);
  });
}

// ---------------- global search / refs / docs ----------------

export async function showSearch(initial?: string) {
  const q =
    (await useUi
      .getState()
      .prompt("Global search", [{ label: "Row ID or value text", value: initial || "" }], "Search")) as string | null;
  if (!q || typeof q !== "string") return;
  await guard(async () => {
    const ui = useUi.getState();
    ui.setBusy("Searching all tables…");
    try {
      const { results } = await api.globalSearch(q, 300);
      ui.openModal("searchResults", { q, results: results || [] });
    } finally {
      ui.setBusy(null);
    }
  });
}

export async function showRefTargets(tab: Tab, rowId: string, field: string) {
  if (tab.kind !== "table" || !tab.file) return;
  await guard(async () => {
    const ui = useUi.getState();
    ui.setBusy("Resolving references…");
    try {
      const data = await api.refsTargets(tab.file!, rowId);
      const entry = (data.refs || []).find((r: any) => r.field === field);
      if (!entry) {
        ui.toast("No references in this field", "warn");
        return;
      }
      ui.openModal("refTargets", { rowId, field, entry });
    } finally {
      ui.setBusy(null);
    }
  });
}

export async function showReferencedBy(value: string) {
  await guard(async () => {
    const ui = useUi.getState();
    ui.setBusy("Scanning references…");
    try {
      const { refs } = await api.refsReferencedBy(value);
      ui.openModal("referencedBy", { value, refs: refs || [] });
    } finally {
      ui.setBusy(null);
    }
  });
}

// ---------------- tabs persist / restore ----------------

let tabsSaveT: ReturnType<typeof setTimeout> | null = null;
let tabsSavedSig: string | null = null;

function tabsSig(): string {
  const s = useTabs.getState();
  return JSON.stringify([
    useProject.getState().currentProject,
    s.activeTabId,
    s.tabs.map((t) => [t.kind, t.file, t.short, t.charPrefix, t.statusFilter, t.search, t.visibleFields]),
  ]);
}

export function persistTabsSoon() {
  if (tabsSaveT) clearTimeout(tabsSaveT);
  tabsSaveT = setTimeout(async () => {
    const name = useProject.getState().currentProject;
    if (!name || !useProject.getState().project) return;
    const sig = tabsSig();
    if (sig === tabsSavedSig) return;
    try {
      const { openTabs, activeTab } = useTabs.getState().serialize();
      await api.projectSaveUi(name, { openTabs, activeTab });
      if (useProject.getState().currentProject === name) tabsSavedSig = sig;
    } catch {
      /* UI state is best-effort */
    }
  }, 400);
}

export async function restoreTabs(): Promise<boolean> {
  const proj = useProject.getState();
  const ui = (proj.project && proj.project.ui) || null;
  const specs = (((ui && ui.openTabs) || []) as any[]).filter(
    (s) => s && (s.kind === "table" || s.kind === "param" || s.kind === "rules") && (s.file || s.short),
  );
  const valid = specs.filter((s) =>
    s.kind === "param"
      ? proj.paramAssets.some((a) => a.shortName === s.short)
      : !!proj.tableByFile[s.file],
  );
  if (!valid.length) return false;
  const tabs = valid.map((s) =>
    makeRestoredTab({
      kind: s.kind,
      file: s.file ?? null,
      short: s.short ?? null,
      charPrefix: s.kind === "rules" ? "" : s.charPrefix || "",
      statusFilter: s.statusFilter || "all",
      search: s.search || "",
      visibleFields: Array.isArray(s.visibleFields) ? s.visibleFields : null,
    }),
  );
  const wanted = ui && ui.activeTab;
  const active = (wanted && tabs.find((t) => tabSpecKey(t) === tabSpecKey(wanted))) || tabs[0];
  useTabs.getState().replaceAll(tabs, active.id);
  for (const t of tabs) prefetchTab(t);
  tabsSavedSig = tabsSig();
  return true;
}
