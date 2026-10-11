// Status bar, problems panel, command palette, toasts.
// Mirrors renderStatusBar()/renderPanel()/showPalette()/toast in renderer/app.js.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/ipc";
import { fetchParamRowsFiltered, fetchTableRowsAll, keys } from "../api/queries";
import { useProject, charLabelOf } from "../stores/project";
import { useTabs, tabTitle } from "../stores/tabs";
import { useUi, type PaletteItem } from "../stores/ui";
import {
  delProjectFlow,
  doCloneRow,
  doCloseTab,
  doExportFolder,
  doExportJjkmod,
  doImport,
  doNewRow,
  doRedo,
  doTestPatch,
  doUndo,
  dupProjectFlow,
  guard,
  jumpToRow,
  newProjectFlow,
  openProject,
  renameProjectFlow,
  selectScope,
  setCharMode,
  showSearch,
  validateIntoPanel,
} from "../app/flows";

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div id="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function editedCount(changed: Record<string, any>, parameters: any): number {
  let n = Object.keys(changed || {}).length;
  if (parameters) {
    for (const p of Object.values<any>(parameters)) {
      const rows = (p && p.rows) || {};
      if (Object.keys(rows).filter((k) => k.charAt(0) !== "$").length > 0) n++;
    }
  }
  return n;
}

export function StatusBar() {
  const projects = useProject((s) => s.projects);
  const currentProject = useProject((s) => s.currentProject);
  const project = useProject((s) => s.project);
  const changed = useProject((s) => s.changed);
  const chars = useProject((s) => s.chars);
  const charMode = useProject((s) => s.charMode);
  const busy = useUi((s) => s.busy);
  const problems = useUi((s) => s.problems);
  const active = useTabs((s) => s.active());

  const cur = (projects || []).find((p) => p.name === currentProject);
  const title = (cur && (cur.title || cur.name)) || currentProject || "No project";
  const n = editedCount(changed, project?.parameters);

  const total = problems ? problems.total : 0;
  const problemsTxt = problems ? (total ? `✕ ${total}` : "○ 0") : "○ —";
  const problemsTitle = problems ? `${total} problem(s) — click to open panel` : "Validate — click to run validation";

  return (
    <footer id="statusBar">
      <div className="st-left">
        <span className="st-item" id="stProject" title="Open project…" onClick={() => useUi.getState().openModal("openProject")}>
          <span className="st-ico">▦</span>
          <span id="stProjectName">{title}</span>
        </span>
        <span
          className={`st-item${charMode ? " on" : ""}`}
          id="stChar"
          title="Character filter"
          onClick={(e) => {
            useUi.getState().setSideView("explorer");
            const st = useUi.getState();
            st.setCharPicker(st.charPickerAnchor ? null : e.currentTarget);
          }}
        >
          <span className="st-ico">⛉</span>
          <span id="stCharName">{charMode ? `${charMode} — ${charLabelOf(chars, charMode)}` : "All characters"}</span>
        </span>
        {busy && (
          <span className="st-read" id="stBusy">
            <span className="st-spin" />
            <span id="stBusyMsg">{busy}</span>
          </span>
        )}
      </div>
      <div className="st-center">
        <RowsReadout tab={active} />
      </div>
      <div className="st-right">
        <span
          className="st-item"
          id="stProblems"
          title={problemsTitle}
          onClick={() => {
            if (!useUi.getState().problems) void validateIntoPanel();
            else useUi.getState().setPanelOpen(true, "problems");
          }}
        >
          <span id="stProblemsTxt" className={total > 0 ? "bad" : ""}>
            {problemsTxt}
          </span>
        </span>
        <span
          className="st-item"
          id="stDirty"
          title="Edited files — click to open Changes"
          onClick={() => useUi.getState().setSideView("changes")}
        >
          <span id="stDirtyTxt" className={n > 0 ? "dirty" : ""}>
            {n ? `● ${n} edited` : "Clean"}
          </span>
        </span>
        {currentProject && (
          <button className="st-export" id="stExport" title="Export to Mods folder (Ctrl+E)" onClick={() => doExportFolder()}>
            Export
          </button>
        )}
      </div>
    </footer>
  );
}

function RowsReadout({ tab }: { tab: import("../api/types").Tab | null }) {
  const { data: trows } = useTabRowsCount(tab && tab.kind === "table" ? tab.file : null, tab?.charPrefix || "", tab?.search || "");
  const { data: prows } = useParamRowsCount(tab && tab.kind === "param" ? tab.short : null, tab?.search || "", tab?.charPrefix || "");
  if (!tab || tab.kind === "rules") return <span className="st-read" id="stRows" style={{ display: "none" }} />;
  let shown = 0;
  let total = 0;
  const f = tab.statusFilter || "all";
  if (tab.kind === "table" && trows) {
    total = trows.total;
    let rows = trows.rows;
    if (f === "edited") rows = rows.filter((r: any) => r.status === "edited");
    else if (f === "new") rows = rows.filter((r: any) => r.status === "new");
    else if (f === "vanilla") rows = rows.filter((r: any) => r.status !== "edited" && r.status !== "new");
    shown = rows.length;
  } else if (tab.kind === "param" && prows) {
    total = prows.edited.length + prows.vanilla.length;
    if (f === "edited") shown = prows.edited.length;
    else if (f === "vanilla") shown = prows.vanilla.length;
    else shown = total;
  }
  const suffix = tab.statusFilter && tab.statusFilter !== "all" ? ` · ${tab.statusFilter}` : "";
  return (
    <span className="st-read" id="stRows" title={`${tabTitle(tab)} — ${shown} of ${total} rows shown`}>
      {shown} / {total} rows{suffix}
    </span>
  );
}

function useTabRowsCount(file: string | null, charPrefix: string, search: string) {
  return useQuery({
    queryKey: file ? keys.tableRows(file, charPrefix, search) : ["tableRows", "none"],
    queryFn: () => fetchTableRowsAll(file!, charPrefix, search),
    enabled: !!file,
    staleTime: 10_000,
  });
}

function useParamRowsCount(short: string | null, search: string, charPrefix: string) {
  return useQuery({
    queryKey: short ? ["stRowsParam", short, search, charPrefix] : ["stRowsParam", "none"],
    queryFn: async () => {
      const d = await fetchParamRowsFiltered(short!, search, charPrefix);
      return { edited: d.rows, vanilla: d.vanillaIds };
    },
    enabled: !!short,
    staleTime: 10_000,
  });
}

export function ProblemsPanel() {
  const panelOpen = useUi((s) => s.panelOpen);
  const panelView = useUi((s) => s.panelView);
  const problems = useUi((s) => s.problems);
  if (!panelOpen) return null;
  const issues = problems?.issues || [];
  const where = (i: any) =>
    `${i.file || (i.short ? `parameters/${i.short}.json` : "")}${i.rowId ? ` :: ${i.rowId}` : ""}${i.field ? ` :: ${i.field}` : ""}`;
  return (
    <section id="panel">
      <div id="panelHead">
        <button
          className={`p-tab${panelView === "problems" ? " active" : ""}`}
          data-pview="problems"
          onClick={() => useUi.getState().setPanelOpen(true, "problems")}
        >
          Problems
        </button>
        <span className="p-count" id="panelCount">
          {problems ? `${problems.total} issue(s)` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button className="small" id="btnPanelValidate" title="Re-run validation" onClick={() => validateIntoPanel()}>
          Validate
        </button>
        <button className="p-close" id="btnPanelClose" title="Close panel (Ctrl+J)" onClick={() => useUi.getState().setPanelOpen(false)}>
          ×
        </button>
      </div>
      <div id="panelBody">
        {!problems ? (
          <div className="empty-note">
            No validation results yet.
            <br />
            <br />
            <button className="small primary" onClick={() => validateIntoPanel()}>
              Validate project
            </button>
          </div>
        ) : issues.length ? (
          <>
            {issues.slice(0, 300).map((i: any, ix: number) => (
              <div key={ix} className="prob-row">
                <span className="badge edited">{i.type}</span>
                <span className="pw">{where(i)}</span>
                <span className="pm">{i.message || ""}</span>
                {i.file && i.rowId && (
                  <button className="small" onClick={() => jumpToRow(i.file, i.rowId, i.field || null)}>
                    Open
                  </button>
                )}
              </div>
            ))}
            {issues.length > 300 && <div style={{ color: "var(--dim)" }}>… {issues.length - 300} more</div>}
          </>
        ) : (
          <div className="empty-note">Clean — no issues found.</div>
        )}
      </div>
    </section>
  );
}

// ---------------- command palette ----------------

function fuzzyMatch(q: string, s: string): boolean {
  q = q.toLowerCase();
  s = s.toLowerCase();
  let i = 0;
  for (const c of s) {
    if (c === q[i]) i++;
    if (i >= q.length) break;
  }
  return i >= q.length;
}

function usePaletteItems(): PaletteItem[] {
  const tables = useProject((s) => s.tables);
  const paramAssets = useProject((s) => s.paramAssets);
  const changed = useProject((s) => s.changed);
  const currentProject = useProject((s) => s.currentProject);
  const active = useTabs((s) => s.active());

  return useMemo(() => {
    const hasProj = !!currentProject;
    const hasTab = !!active;
    const cmds: Array<[string, string, () => void, boolean]> = [
      ["New Row", "active table", () => doNewRow(), hasTab],
      ["New Row from Existing Row", "clone · active table", () => doCloneRow(), hasTab],
      ["Global Search…", "Ctrl+F", () => showSearch(), true],
      ["Text Find / Replace…", "Ctrl+H", () => useUi.getState().openModal("textTools"), hasTab],
      ["Validate Project", "problems panel", () => validateIntoPanel(), hasProj],
      ["Project Changes…", "", () => useUi.getState().openModal("projectChanges", { autoValidate: false }), hasProj],
      ["Export to Mods Folder", "Ctrl+E", () => doExportFolder(), hasProj],
      ["Export .jjkmod…", "", () => doExportJjkmod(), hasProj],
      ["Test Patch…", "Ctrl+T", () => doTestPatch(), hasProj],
      ["Snapshots…", "Ctrl+S", () => useUi.getState().openModal("snapshots"), hasProj],
      ["Conflicts…", "", () => useUi.getState().openModal("conflicts"), hasProj],
      ["Character Checklist…", "", () => useUi.getState().openModal("checklist"), hasProj],
      ["Character Moveset…", "", () => useUi.getState().openModal("moveset"), hasProj],
      ["Open Project…", "Ctrl+O", () => useUi.getState().openModal("openProject"), true],
      ["New Project…", "Ctrl+N", () => newProjectFlow(), true],
      ["Edit Manifest / Assets…", "", () => useUi.getState().openModal("mod", {}), hasProj],
      ["Export Preview…", "", () => useUi.getState().openModal("mod", { previewFirst: true }), hasProj],
      ["Manage Characters…", "", () => useUi.getState().openModal("characters"), true],
      ["Clear Character Filter", "", () => { if (useProject.getState().charMode) void guard(() => setCharMode("")); }, true],
      ["Toggle Sidebar", "Ctrl+B", () => useUi.getState().toggleSidebar(), true],
      ["Toggle Problems Panel", "Ctrl+J", () => useUi.getState().setPanelOpen(!useUi.getState().panelOpen), true],
      ["Close Current Tab", "Ctrl+W", () => doCloseTab(), hasTab],
      ["Close Other Tabs", "", () => { const id = useTabs.getState().activeTabId; if (id) useTabs.getState().closeOthers(id); }, hasTab],
      ["Settings…", "Ctrl+,", () => useUi.getState().openModal("settings"), true],
    ];
    const cmdItems: PaletteItem[] = cmds
      .filter((c) => c[3])
      .map(([label, hint, run]) => ({ kind: "cmd" as const, label, hint, sub: "", run }));
    const fileItems: PaletteItem[] = [
      ...tables.map((t) => {
        const c = changed[t.file];
        return {
          kind: "table" as const,
          label: t.file,
          sub: `${t.groupLabel || ""}${c ? " · edited" : ""}`,
          run: () => selectScope({ kind: "table", file: t.file }),
        };
      }),
      ...paramAssets.map((a) => ({
        kind: "param" as const,
        label: `${a.shortName}.json`,
        sub: a.assetName || "",
        run: () => {
          useProject.getState().setLeftTab("params");
          selectScope({ kind: "param", short: a.shortName });
        },
      })),
    ];
    return [...cmdItems, ...fileItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, paramAssets, changed, currentProject, active?.id]);
}

export function CommandPalette() {
  const palette = useUi((s) => s.palette);
  const all = usePaletteItems();
  const [q, setQ] = useState(palette.mode === "cmd" ? ">" : "");

  useEffect(() => {
    if (palette.open) setQ(palette.mode === "cmd" ? ">" : "");
  }, [palette.open, palette.mode]);

  const mode: "files" | "cmd" = q.startsWith(">") ? "cmd" : palette.cmdLock ? "cmd" : "files";
  const query = (mode === "cmd" ? q.slice(1) : q).trim().toLowerCase();

  const items = useMemo(() => {
    const pool = all.filter((it) => (mode === "cmd" ? it.kind === "cmd" : true));
    const scored = pool
      .map((it) => {
        const label = it.label.toLowerCase();
        let score = -1;
        if (!query) score = 0;
        else if (label.startsWith(query)) score = 3;
        else if (label.includes(query)) score = 2;
        else if (fuzzyMatch(query, label)) score = 1;
        return { it, score };
      })
      .filter((x) => x.score >= 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((x) => x.it).slice(0, 60);
  }, [all, mode, query]);

  useEffect(() => {
    useUi.getState().paletteSet({ items, sel: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode, all]);

  if (!palette.open) return null;

  const run = (idx?: number) => {
    const it = (useUi.getState().palette.items.length ? useUi.getState().palette.items : items)[idx ?? useUi.getState().palette.sel];
    useUi.getState().paletteClose();
    if (it && it.run) it.run();
  };

  return (
    <div id="palette" onMouseDown={(e) => { if ((e.target as HTMLElement).id === "palette") useUi.getState().paletteClose(); }}>
      <div id="palBox">
        <input
          id="palInput"
          autoFocus
          placeholder={mode === "cmd" ? "Type a command…" : "Type a table name, or > for commands…"}
          value={q}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value);
            useUi.getState().paletteSet({ sel: 0 });
          }}
          onKeyDown={(e) => {
            const sel = useUi.getState().palette.sel;
            if (e.key === "Escape") useUi.getState().paletteClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              useUi.getState().paletteSet({ sel: Math.min(Math.max(items.length - 1, 0), sel + 1) });
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              useUi.getState().paletteSet({ sel: Math.max(0, sel - 1) });
            } else if (e.key === "Enter") run();
          }}
        />
        <div id="palList">
          {items.map((it, i) => (
            <div
              key={`${it.kind}:${it.label}`}
              className={`pal-item${i === palette.sel ? " sel" : ""}`}
              data-pal={i}
              onClick={() => run(i)}
              onMouseMove={() => { if (palette.sel !== i) useUi.getState().paletteSet({ sel: i }); }}
            >
              <span className="pal-kind">{it.kind === "table" ? "TABLE" : it.kind === "param" ? "PARAM" : "CMD"}</span>
              <span className="pal-label">{it.label}</span>
              {it.sub ? <span className="pal-sub">{it.sub}</span> : null}
              {it.hint ? <span className="pal-hint">{it.hint}</span> : null}
            </div>
          ))}
          {items.length === 0 && <div className="empty-note">No matches</div>}
        </div>
        <div id="palFoot">
          <span id="palHint">{mode === "cmd" ? "commands · esc to close" : "tables & parameters · type > for commands · esc to close"}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- menu action dispatch (all native menu items) ----------------

export function handleMenuAction(action: string, payload?: any) {
  const ui = useUi.getState();
  const tabsApi = useTabs.getState();
  switch (action) {
    case "project:new": void newProjectFlow(); break;
    case "project:open-modal": ui.openModal("openProject"); break;
    case "project:open-name": {
      const name = payload ?? undefined;
      const cur = useProject.getState().currentProject;
      if (name && name !== cur) void guard(() => openProject(name));
      break;
    }
    case "project:duplicate": void dupProjectFlow(); break;
    case "project:rename": void renameProjectFlow(); break;
    case "project:delete": void delProjectFlow(); break;
    case "project:reveal": void guard(() => api.projectReveal()); break;
    case "file:import": void doImport(); break;
    case "file:export-folder": void doExportFolder(); break;
    case "file:export-jjkmod": void doExportJjkmod(); break;
    case "file:test-patch": void doTestPatch(); break;
    case "file:settings": ui.openModal("settings"); break;
    case "edit:undo": void doUndo(); break;
    case "edit:redo": void doRedo(); break;
    case "edit:search": void showSearch(); break;
    case "edit:text-tools": ui.openModal("textTools"); break;
    case "view:tables":
      useProject.getState().setLeftTab("tables");
      ui.setSideView("explorer");
      break;
    case "view:params":
      useProject.getState().setLeftTab("params");
      ui.setSideView("explorer");
      break;
    case "view:characters": ui.openModal("characters"); break;
    case "view:char-clear":
      if (useProject.getState().charMode) void guard(() => setCharMode(""));
      break;
    case "view:close-tab": void doCloseTab(); break;
    case "view:close-others": if (tabsApi.activeTabId) tabsApi.closeOthers(tabsApi.activeTabId); break;
    case "view:palette": ui.paletteOpen("cmd"); break;
    case "view:quick-open": ui.paletteOpen("files"); break;
    case "view:toggle-sidebar": ui.toggleSidebar(); break;
    case "view:toggle-panel": ui.setPanelOpen(!ui.panelOpen); break;
    case "project:changes": ui.openModal("projectChanges", { autoValidate: false }); break;
    case "project:validate": ui.openModal("projectChanges", { autoValidate: true }); break;
    case "project:snapshots": ui.openModal("snapshots"); break;
    case "project:conflicts": ui.openModal("conflicts"); break;
    case "project:checklist": ui.openModal("checklist"); break;
    case "project:moveset": ui.openModal("moveset"); break;
    case "mod:edit": ui.openModal("mod", {}); break;
    case "mod:preview": ui.openModal("mod", { previewFirst: true }); break;
    case "help:about": ui.openModal("about"); break;
    default: break;
  }
}
