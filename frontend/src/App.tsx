// IDE shell: activity bar + sidebar + center + problems panel + status bar.
// Mirrors renderer/index.html layout; behavior mirrors renderer/app.js.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, onMenuAction } from "./api/ipc";
import { keys } from "./api/queries";
import { useProject } from "./stores/project";
import { useTabs } from "./stores/tabs";
import { useUi } from "./stores/ui";
import { ChangesView, Explorer, SearchView } from "./components/Explorer";
import { CenterView, TabStrip } from "./components/TabView";
import { CommandPalette, Modals, StatusBar, Toasts } from "./components/Panels";

function ProblemsPanel() {
  const { data, refetch, isFetching } = useQuery({ queryKey: keys.diff, queryFn: () => api.diffProject() });
  const [problems, setProblems] = useState<any>(null);
  const toast = useUi((s) => s.toast);

  const validate = async () => {
    try {
      const r = await api.validateProject();
      setProblems(r);
      const n = r?.errors?.length || r?.problems?.length || 0;
      toast(n ? `${n} problem(s)` : "No problems", n ? "warn" : "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const errs = [...(data?.errors || []), ...(problems?.errors || problems?.problems || [])];
  return (
    <section id="panel">
      <div id="panelHead">
        <button className="p-tab active">Problems</button>
        <span className="p-count">{errs.length}</span>
        <span style={{ flex: 1 }} />
        <button className="small" disabled={isFetching} onClick={() => { refetch(); validate(); }}>Validate</button>
        <button className="p-close" onClick={() => useUi.getState().setPanelOpen(false)}>×</button>
      </div>
      <div id="panelBody">
        {errs.length === 0 ? <div className="empty-note">No problems. Run Validate to re-check.</div> : errs.map((e: any, i: number) => (
          <div key={i} className="err" style={{ padding: "2px 8px" }}>{typeof e === "string" ? e : JSON.stringify(e)}</div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const ready = useProject((s) => s.ready);
  const error = useProject((s) => s.error);
  const init = useProject((s) => s.init);
  const sideView = useUi((s) => s.sideView);
  const setSideView = useUi((s) => s.setSideView);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const panelOpen = useUi((s) => s.panelOpen);
  const setPanelOpen = useUi((s) => s.setPanelOpen);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const openModal = useUi((s) => s.openModal);

  useEffect(() => {
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist open tabs (debounced) like app.js persistTabsSoon().
  const tabs = useTabs((s) => s.tabs);
  const activeTabId = useTabs((s) => s.activeTabId);
  const currentProject = useProject((s) => s.currentProject);
  useEffect(() => {
    if (!currentProject || tabs.length === 0) return;
    const t = setTimeout(() => {
      const { serialize } = useTabs.getState();
      api.projectSaveUi(currentProject, serialize()).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [tabs, activeTabId, currentProject]);

  // Native menu → actions.
  useEffect(() => {
    return onMenuAction((action) => {
      const ui = useUi.getState();
      const tabsApi = useTabs.getState();
      switch (action) {
        case "project:open-modal": ui.openModal("openProject"); break;
        case "project:new": ui.openModal("newProject"); break;
        case "project:validate": setPanelOpen(true); break;
        case "project:snapshots": ui.openModal("snapshots"); break;
        case "project:changes": ui.setSideView("changes"); break;
        case "file:export-folder":
          setBusy("Exporting…");
          api.exportFolder().then((r: any) => toast(`Exported ${r.files?.length ?? 0} files`, "success")).catch((e: any) => toast(e.message, "error")).finally(() => setBusy(null));
          break;
        case "file:export-jjkmod":
          api.exportJjkmod().then(() => toast("Exported .jjkmod", "success")).catch((e: any) => toast(e.message, "error"));
          break;
        case "mod:preview": ui.openModal("exportPreview"); break;
        case "mod:edit": ui.openModal("mod"); break;
        case "view:tables": useProject.getState().setLeftTab("tables"); break;
        case "view:params": useProject.getState().setLeftTab("params"); break;
        case "view:toggle-sidebar": toggleSidebar(); break;
        case "view:toggle-panel": setPanelOpen(!useUi.getState().panelOpen); break;
        case "view:close-tab": if (tabsApi.activeTabId) tabsApi.close(tabsApi.activeTabId); break;
        case "view:palette":
        case "view:quick-open":
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", ctrlKey: true } as any));
          break;
        case "edit:search": ui.setSideView("search"); break;
        case "edit:undo":
          api.historyUndo().then((d: any) => { useProject.getState().reloadAfterHistory(d.project, d.changed); }).catch((e: any) => toast(e.message, "error"));
          break;
        case "edit:redo":
          api.historyRedo().then((d: any) => { useProject.getState().reloadAfterHistory(d.project, d.changed); }).catch((e: any) => toast(e.message, "error"));
          break;
        default: break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "e" && !e.shiftKey) {
        e.preventDefault();
        setBusy("Exporting…");
        api.exportFolder().then((r: any) => toast(`Exported ${r.files?.length ?? 0} files`, "success")).catch((err: any) => toast(err.message, "error")).finally(() => setBusy(null));
      } else if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); toggleSidebar(); }
      else if (mod && e.key.toLowerCase() === "j") { e.preventDefault(); setPanelOpen(!useUi.getState().panelOpen); }
      else if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); openModal("openProject"); }
      else if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const el = document.activeElement as HTMLElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return; // native undo
        e.preventDefault();
        api.historyUndo().then((d: any) => useProject.getState().reloadAfterHistory(d.project, d.changed)).catch((err: any) => toast(err.message, "error"));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <div className="empty-ide"><div className="empty-logo">JJK</div><p>Loading…</p></div>;
  if (error) return <div className="empty-ide"><div className="empty-logo">JJK</div><div className="err">{error}</div><p>Run inside Electron (npm start), not a plain browser.</p></div>;

  return (
    <div id="ide">
      <nav id="activityBar" aria-label="Activity">
        <div className="ab-top">
          <button className={`abtn${sideView === "explorer" ? " active" : ""}`} title="Explorer (tables & parameters)" onClick={() => setSideView("explorer")}>🗂</button>
          <button className={`abtn${sideView === "search" ? " active" : ""}`} title="Global search" onClick={() => setSideView("search")}>🔍</button>
          <button className={`abtn${sideView === "changes" ? " active" : ""}`} title="Project changes" onClick={() => setSideView("changes")}>⑂</button>
        </div>
        <div className="ab-bottom">
          <button className="abtn" title="Settings" onClick={() => openModal("mod")}>⚙</button>
        </div>
      </nav>

      {sidebarOpen && (
        <aside id="sideBar">
          {sideView === "explorer" && <Explorer />}
          {sideView === "search" && <SearchView />}
          {sideView === "changes" && <ChangesView />}
        </aside>
      )}

      <div id="mainCol">
        <section id="center">
          <TabStrip />
          <CenterView />
        </section>
        {panelOpen && <ProblemsPanel />}
        <StatusBar />
      </div>

      <CommandPalette />
      <Modals />
      <Toasts />
    </div>
  );
}
