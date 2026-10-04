// Status bar, toasts, command palette, and modal dialogs.
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ipcRaw } from "../api/ipc";
import { keys } from "../api/queries";
import { useProject } from "../stores/project";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";

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

export function StatusBar() {
  const currentProject = useProject((s) => s.currentProject);
  const project = useProject((s) => s.project);
  const charMode = useProject((s) => s.charMode);
  const setCharMode = useProject((s) => s.setCharMode);
  const changed = useProject((s) => s.changed);
  const busy = useUi((s) => s.busy);
  const setBusy = useUi((s) => s.setBusy);
  const toast = useUi((s) => s.toast);
  const active = useTabs((s) => s.active());
  const openModal = useUi((s) => s.openModal);

  const title = project?.manifest?.title || project?.name || currentProject || "No project";
  const editedCount =
    Object.keys(changed || {}).length +
    Object.values(project?.parameters || {}).filter(
      (p: any) => Object.keys(p?.rows || {}).filter((k) => k.charAt(0) !== "$").length > 0,
    ).length;

  const doExport = async () => {
    setBusy("Exporting…");
    try {
      const r = await api.exportFolder();
      toast(`Exported ${r.files?.length ?? 0} files → ${r.path || ""}`, "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <footer id="statusBar">
      <div className="st-left">
        <span className="st-item" title="Open project…" onClick={() => openModal("openProject")}>
          <span className="st-ico">▦</span>
          <span>{title}</span>
        </span>
        <span
          className="st-item"
          title="Character filter"
          onClick={() => void setCharMode(charMode ? "" : charMode)}
        >
          <span className="st-ico">⛉</span>
          <span>{charMode || "All characters"}</span>
        </span>
        {busy && (
          <span className="st-read" id="stBusy">
            <span className="st-spin" />
            <span>{busy}</span>
          </span>
        )}
      </div>
      <div className="st-center">
        {active && <span className="st-read">{active.kind}:{active.file || active.short}</span>}
      </div>
      <div className="st-right">
        <span className="st-item" title="Edited files">
          <span>{editedCount ? `● ${editedCount} file(s) edited` : "Clean"}</span>
        </span>
        <button className="st-export" title="Export to Mods folder (Ctrl+E)" onClick={doExport}>Export</button>
        <button className="st-export" title="Mod settings" onClick={() => openModal("mod")}>Mod…</button>
      </div>
    </footer>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const tables = useProject((s) => s.tables);
  const paramAssets = useProject((s) => s.paramAssets);
  const openTable = useTabs((s) => s.openTable);
  const openParam = useTabs((s) => s.openParam);
  const charMode = useProject((s) => s.charMode);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const items = useMemo(() => {
    const ql = q.toLowerCase();
    const t = tables
      .filter((x) => !ql || x.file.toLowerCase().includes(ql))
      .slice(0, 30)
      .map((x) => ({ label: x.file, run: () => openTable(x.file, charMode) }));
    const p = paramAssets
      .filter((x) => !ql || x.shortName.toLowerCase().includes(ql))
      .slice(0, 15)
      .map((x) => ({ label: `param: ${x.shortName}`, run: () => openParam(x.shortName, charMode) }));
    return [...t, ...p];
  }, [q, tables, paramAssets, openTable, openParam, charMode]);

  if (!open) return null;
  return (
    <div id="palette">
      <div id="palBox">
        <input autoFocus placeholder="Quick open: type a table…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" spellCheck={false} />
        <div id="palList">
          {items.map((it, i) => (
            <div key={i} className="pal-item" onClick={() => { it.run(); setOpen(false); }}>
              {it.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Modals() {
  const modal = useUi((s) => s.modal);
  const closeModal = useUi((s) => s.closeModal);
  if (!modal) return null;
  return (
    <div id="modalRoot">
      <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal wide">
          {modal === "openProject" && <OpenProjectModal />}
          {modal === "newProject" && <NewProjectModal />}
          {modal === "mod" && <ModModal />}
          {modal === "exportPreview" && <ExportPreviewModal />}
          {modal === "snapshots" && <SnapshotsModal />}
          <div className="mfoot">
            <button className="primary" onClick={closeModal}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OpenProjectModal() {
  const projects = useProject((s) => s.projects);
  const currentProject = useProject((s) => s.currentProject);
  const openProject = useProject((s) => s.openProject);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const [q, setQ] = useState("");

  const list = [...projects].sort((a, b) => (b.updated || 0) - (a.updated || 0) || a.name.localeCompare(b.name));
  const filtered = list.filter(
    (p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.title || "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <h2>Open Project</h2>
      <div className="mrow"><input placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></div>
      <div className="mrow">
        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {filtered.map((p) => (
            <div key={p.name} className="diff-row">
              <div className="dh">
                {p.name === currentProject && <span className="badge new">OPEN</span>}
                <span style={{ flex: 1 }}>{p.title || p.name}<br />
                  <span style={{ color: "var(--dim)", fontSize: 11 }}>{p.name}{p.version ? ` · v${p.version}` : ""}</span>
                </span>
                <button
                  className="small"
                  onClick={async () => {
                    if (p.name === currentProject) return closeModal();
                    setBusy("Opening project…");
                    try {
                      await openProject(p.name);
                      closeModal();
                    } catch (e: any) {
                      toast(e.message, "error");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-note">No matches</div>}
        </div>
      </div>
      <div className="mfoot">
        <button className="small" onClick={() => openModal("newProject")}>+ New project</button>
      </div>
    </>
  );
}

function NewProjectModal() {
  const [name, setName] = useState("");
  const toast = useUi((s) => s.toast);
  const closeModal = useUi((s) => s.closeModal);
  const openProject = useProject((s) => s.openProject);
  return (
    <>
      <h2>New Project</h2>
      <div className="mrow">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-balancing-mod" />
      </div>
      <div className="mfoot">
        <button
          className="primary"
          onClick={async () => {
            if (!name.trim()) return;
            try {
              await api.projectCreate(name.trim());
              await openProject(name.trim());
              closeModal();
              toast("Project created", "success");
            } catch (e: any) {
              toast(e.message, "error");
            }
          }}
        >
          Create
        </button>
      </div>
    </>
  );
}

function ModModal() {
  const project = useProject((s) => s.project);
  const toast = useUi((s) => s.toast);
  const qc = useQueryClient();
  const [title, setTitle] = useState(project?.manifest?.title || "");
  const [desc, setDesc] = useState(project?.manifest?.description || "");
  const [version, setVersion] = useState(project?.manifest?.version || "");
  const [priority, setPriority] = useState(String(project?.manifest?.priority ?? 0));

  return (
    <>
      <h2>Mod — {project?.manifest?.title || project?.name}</h2>
      <div className="mod-sect">
        <h4>Manifest (manifest.json)</h4>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>Description</label>
        <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <label>Version</label>
        <input value={version} onChange={(e) => setVersion(e.target.value)} />
        <label>Priority (higher wins vs other mods)</label>
        <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
        <div style={{ marginTop: 6 }}>
          <button
            className="small primary"
            onClick={async () => {
              try {
                await ipcRaw("manifest:save", { ...(project?.manifest || {}), title, description: desc, version, priority: Number(priority) || 0 });
                toast("Manifest saved", "success");
                qc.invalidateQueries({ queryKey: keys.diff });
              } catch (e: any) {
                toast(e.message, "error");
              }
            }}
          >
            Save manifest
          </button>
        </div>
      </div>
      <div className="mod-sect">
        <h4>Export preview</h4>
        <button className="small" onClick={() => useUi.getState().openModal("exportPreview")}>Open preview…</button>
      </div>
    </>
  );
}

function ExportPreviewModal() {
  const [preview, setPreview] = useState<any>(null);
  const toast = useUi((s) => s.toast);
  useEffect(() => {
    api.exportPreview().then(setPreview).catch((e: any) => toast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!preview) return <div className="empty-note">Loading preview…</div>;
  return (
    <>
      <h2>Export preview</h2>
      <div>{preview.files.length} file(s) → <b>{preview.folder}</b>/</div>
      {(preview.warnings || []).map((w: string, i: number) => <div key={i} className="warn">{w}</div>)}
      <div className="file-list" style={{ maxHeight: 260, marginTop: 6 }}>
        {preview.files.map((f: string) => <div key={f}>{f}</div>)}
      </div>
    </>
  );
}

function SnapshotsModal() {
  const toast = useUi((s) => s.toast);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [label, setLabel] = useState("");
  const refreshAll = useRefreshAllLocal();
  useEffect(() => {
    ipcRaw<any[]>("snapshots:list").then(setSnaps).catch((e: any) => toast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <h2>Snapshots</h2>
      <div className="mrow">
        <div style={{ display: "flex", gap: 6 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="before rework" style={{ flex: 1 }} />
          <button
            className="small primary"
            onClick={async () => {
              try {
                const d: any = await ipcRaw("snapshots:create", label);
                setSnaps(d.snapshots || []);
                setLabel("");
                toast("Snapshot committed", "success");
              } catch (e: any) {
                toast(e.message, "error");
              }
            }}
          >
            Commit
          </button>
        </div>
      </div>
      <div className="mrow">
        {snaps.map((s: any) => (
          <div key={s.file} className="diff-row">
            <div className="dh">
              <span style={{ flex: 1 }}>{new Date(s.ts).toLocaleString()}{s.label ? ` — ${s.label}` : ""}</span>
              <button
                className="small"
                onClick={async () => {
                  try {
                    const d: any = await ipcRaw("snapshots:restore", s.file);
                    await refreshAll(d.project, d.changed);
                    toast("Snapshot restored", "success");
                  } catch (e: any) {
                    toast(e.message, "error");
                  }
                }}
              >
                Restore
              </button>
            </div>
          </div>
        ))}
        {snaps.length === 0 && <div className="empty-note">None yet.</div>}
      </div>
    </>
  );
}

function useRefreshAllLocal() {
  const qc = useQueryClient();
  const reload = useProject((s) => s.reloadAfterHistory);
  return async (project: any, changed: any) => {
    reload(project, changed);
    await qc.invalidateQueries();
  };
}
