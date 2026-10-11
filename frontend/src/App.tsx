// IDE shell: activity bar + sidebar + center + problems panel + status bar.
// Mirrors renderer/index.html layout and the DOMContentLoaded/bindEvents
// startup in renderer/app.js.
import { useEffect } from "react";
import { onAutoExport, onMenuAction } from "./api/ipc";
import { useProject } from "./stores/project";
import { useTabs } from "./stores/tabs";
import { useUi } from "./stores/ui";
import { ChangesView, CharPicker, Explorer, SearchView } from "./components/Explorer";
import { CenterView, TabStrip } from "./components/TabView";
import { CommandPalette, ProblemsPanel, StatusBar, Toasts, handleMenuAction } from "./components/Panels";
import { Modals, PromptModal } from "./components/Modals";
import { doCloseTab, doRedo, doUndo, persistTabsSoon, restoreTabs, selectScope, setCharMode } from "./app/flows";

function ActivityBar() {
  const sideView = useUi((s) => s.sideView);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const changed = useProject((s) => s.changed);
  const project = useProject((s) => s.project);
  const activeCls = (v: string) => (sideView === v && sidebarOpen ? " active" : "");

  let n = Object.keys(changed || {}).length;
  if (project?.parameters) {
    for (const p of Object.values<any>(project.parameters)) {
      const rows = (p?.rows || {}) as Record<string, unknown>;
      if (Object.keys(rows).filter((k) => k.charAt(0) !== "$").length > 0) n++;
    }
  }

  const click = (v: "explorer" | "search" | "changes") => {
    const ui = useUi.getState();
    if (!ui.sidebarOpen || ui.sideView !== v) ui.setSideView(v);
    else ui.toggleSidebar();
  };

  return (
    <nav id="activityBar" aria-label="Activity">
      <div className="ab-top">
        <button className={`abtn${activeCls("explorer")}`} data-aview="explorer" title="Explorer (tables & parameters)" onClick={() => click("explorer")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-8-6z" />
            <path d="M13 3v6h6" />
          </svg>
        </button>
        <button className={`abtn${activeCls("search")}`} data-aview="search" title="Global search" onClick={() => click("search")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.8-3.8" />
          </svg>
        </button>
        <button className={`abtn${activeCls("changes")}`} data-aview="changes" title="Project changes" onClick={() => click("changes")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="6" cy="18" r="2.5" />
            <circle cx="18" cy="12" r="2.5" />
            <path d="M6 8.5v7M8 7c4 0 3 4 7.5 4.6" />
          </svg>
          <span className={`abadge${n ? "" : " hidden"}`} id="changesBadge">
            {n > 99 ? "99+" : n}
          </span>
        </button>
      </div>
      <div className="ab-bottom">
        <button className="abtn" id="btnSettings" title="Settings" onClick={() => useUi.getState().openModal("settings")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.04 1.56.63.27 1.36.14 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87c.27.63.88 1.04 1.56 1.04H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.4-1.51 1.04z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  const ready = useProject((s) => s.ready);
  const error = useProject((s) => s.error);
  const sidebarOpen = useUi((s) => s.sidebarOpen);

  // ---- startup (mirrors DOMContentLoaded) ----
  useEffect(() => {
    let live = true;
    (async () => {
      await useProject.getState().init();
      if (!live) return;
      const st = useProject.getState();
      // Character index for filters/picker (best-effort, like app.js).
      st.ensureCharData().catch((e: any) =>
        useUi.getState().toast(`Character index: ${e?.message || e}`, "warn"),
      );
      if (st.project) {
        try {
          const restored = await restoreTabs();
          if (!restored && st.charMode) await setCharMode(st.charMode);
          else if (!restored) openFirstScope();
        } catch {
          openFirstScope();
        }
      } else if (st.charMode) {
        await setCharMode(st.charMode).catch(() => openFirstScope());
      } else {
        openFirstScope();
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- document title (renderProjects) ----
  const projects = useProject((s) => s.projects);
  const currentProject = useProject((s) => s.currentProject);
  const project = useProject((s) => s.project);
  useEffect(() => {
    const cur = (projects || []).find((p) => p.name === currentProject);
    const label = (cur && (cur.title || cur.name)) || project?.manifest?.title || currentProject;
    document.title = label ? `${label} — JJK Mod Editor` : "JJK Mod Editor";
  }, [projects, currentProject, project?.manifest?.title]);

  // ---- persist open tabs (debounced, like persistTabsSoon) ----
  const tabs = useTabs((s) => s.tabs);
  const activeTabId = useTabs((s) => s.activeTabId);
  useEffect(() => {
    if (!currentProject || tabs.length === 0) return;
    persistTabsSoon();
  }, [tabs, activeTabId, currentProject]);

  // ---- native menu + auto-export (bindEvents) ----
  useEffect(() => {
    const offMenu = onMenuAction((action, payload) => handleMenuAction(action, payload));
    const offAuto = onAutoExport((p) => {
      if (!p) return;
      if (p.ok) useUi.getState().toast(`Auto-exported ${p.files} file(s)${p.backupPath ? " (backup kept)" : ""}`, "success");
      else useUi.getState().toast(p.error || "Auto-export failed", "error");
    });
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const t = e.target as HTMLElement;
      if (!mod || (t && t.matches && t.matches("input, textarea, select")) || !useProject.getState().currentProject) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        void doUndo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        void doRedo();
      } else if (k === "w") {
        e.preventDefault();
        doCloseTab();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      offMenu();
      offAuto();
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!ready)
    return (
      <div id="ide">
        <div className="empty-ide" style={{ margin: "auto" }}>
          <p>Loading…</p>
        </div>
      </div>
    );
  if (error)
    return (
      <div style={{ padding: 40 }}>
        <h2>Failed to start</h2>
        <div className="err">{error}</div>
        <p>Run inside Electron (npm start), not a plain browser.</p>
      </div>
    );

  return (
    <div id="ide">
      <ActivityBar />
      <aside id="sideBar" className={sidebarOpen ? "" : "hidden"}>
        <Explorer />
        <SearchView />
        <ChangesView />
      </aside>
      <div id="mainCol">
        <section id="center">
          <TabStrip />
          <CenterView />
        </section>
        <ProblemsPanel />
        <StatusBar />
      </div>
      <CommandPalette />
      <Modals />
      <PromptModal />
      <CharPicker />
      <Toasts />
    </div>
  );
}

function openFirstScope() {
  const st = useProject.getState();
  if (st.tables.length > 0) selectScope({ kind: "table", file: st.tables[0].file });
  else if (st.paramAssets.length > 0) selectScope({ kind: "param", short: st.paramAssets[0].shortName });
}
