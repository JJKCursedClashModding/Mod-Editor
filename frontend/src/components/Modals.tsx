// All modal dialogs. Uncontrolled inputs + DOM reads on save mirror the
// vanilla showModal()/promptModal() flows in renderer/app.js exactly.
import { useEffect, useRef, useState } from "react";
import { api } from "../api/ipc";
import { useDocsField, useRowData, useTableSchema } from "../api/queries";
import { client } from "../api/client";
import {
  confirmExportFolder,
  docsBaseOf,
  docsFamilyOf,
  jumpToRow,
  newProjectFlow,
  openProject,
  refreshAfterHistory,
  resolveAndJump,
  selectScope,
  shortVal,
} from "../app/flows";
import { charLabelOf, useProject } from "../stores/project";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";

function Overlay({ wide, children, onClose }: { wide?: boolean; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) (onClose || useUi.getState().closeModal)();
      }}
    >
      <div className={`modal${wide ? " wide" : ""}`}>{children}</div>
    </div>
  );
}

// ---------------- generic prompt (promptModal) ----------------

export function PromptModal() {
  const req = useUi((s) => s.promptReq);
  const resolve = useUi((s) => s.resolvePrompt);
  const vals = useRef<{ req: unknown; values: string[] }>({ req: null, values: [] });
  if (!req) return null;
  if (vals.current.req !== req) vals.current = { req, values: req.fields.map((f) => f.value || "") };
  const done = (v: string | string[] | null) => resolve(v);
  const values = vals.current.values;
  return (
    <Overlay onClose={() => done(null)}>
      <h2>{req.title}</h2>
      {req.fields.map((f, i) => (
        <div className="mrow" key={i}>
          <label>{f.label}</label>
          {f.type === "select" ? (
            <select defaultValue={f.value} autoFocus={i === 0} onChange={(e) => (values[i] = e.target.value)}>
              {(f.options || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              defaultValue={f.value || ""}
              placeholder={f.placeholder || ""}
              autoFocus={i === 0}
              onChange={(e) => (values[i] = e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") done(req.fields.length === 1 ? values[0] : [...values]);
              }}
            />
          )}
        </div>
      ))}
      <div className="mfoot">
        <button onClick={() => done(null)}>Cancel</button>
        <button className="primary" onClick={() => done(req.fields.length === 1 ? values[0] : [...values])}>
          {req.okLabel || "OK"}
        </button>
      </div>
    </Overlay>
  );
}

// ---------------- open project ----------------

function OpenProjectModal() {
  const projects = useProject((s) => s.projects);
  const currentProject = useProject((s) => s.currentProject);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const [q, setQ] = useState("");
  const [list, setList] = useState(projects);
  const [rank, setRank] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let live = true;
    (async () => {
      setBusy("Loading projects…");
      try {
        const l = await api.projectList();
        let cfg: any = {};
        try {
          cfg = await api.configGet();
        } catch {
          cfg = {};
        }
        if (!live) return;
        const rk = new Map<string, number>(((cfg && cfg.recentProjects) || []).map((n: string, i: number) => [n, i] as [string, number]));
        const sorted = [...l].sort((a, b) => {
          const ra = rk.has(a.name) ? rk.get(a.name)! : 1e9;
          const rb = rk.has(b.name) ? rk.get(b.name)! : 1e9;
          if (ra !== rb) return ra - rb;
          return (b.updated || 0) - (a.updated || 0) || a.name.localeCompare(b.name);
        });
        setList(sorted);
        setRank(rk);
      } catch (e: any) {
        toast(e.message, "error");
      } finally {
        setBusy(null);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = q.toLowerCase();
  const rows = list.filter(
    (p) => !query || p.name.toLowerCase().includes(query) || (p.title || "").toLowerCase().includes(query),
  );

  return (
    <Overlay>
      <h2>Open Project</h2>
      <div className="mrow">
        <input placeholder="Search projects…" value={q} autoComplete="off" autoFocus onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mrow">
        <div id="projList" style={{ maxHeight: 340, overflowY: "auto" }}>
          {rows.map((p) => (
            <div key={p.name} className="diff-row">
              <div className="dh">
                {p.name === currentProject ? (
                  <span className="badge new">OPEN</span>
                ) : rank.has(p.name) ? (
                  <span className="badge global">RECENT</span>
                ) : null}
                <span style={{ flex: 1 }}>
                  {p.title || p.name}
                  <br />
                  <span style={{ color: "var(--dim)", fontSize: 11 }}>
                    {p.name}
                    {p.version ? ` · v${p.version}` : ""}
                    {p.updated ? ` · ${new Date(p.updated).toLocaleString()}` : ""}
                  </span>
                </span>
                <button
                  className="small"
                  onClick={async () => {
                    if (p.name === currentProject) return closeModal();
                    closeModal();
                    setBusy("Opening project…");
                    try {
                      await openProject(p.name);
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
          {rows.length === 0 && <div className="empty-note">No matches</div>}
        </div>
      </div>
      <div className="mfoot">
        <button
          className="small"
          onClick={() => {
            closeModal();
            void newProjectFlow();
          }}
        >
          + New project
        </button>
        <span style={{ flex: 1 }} />
        <button onClick={closeModal}>Cancel</button>
      </div>
    </Overlay>
  );
}

// ---------------- characters ----------------

function CharactersModal() {
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const [chars, setChars] = useState<Array<{ prefix: string; name: string; source: string; tables?: number }>>([]);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setBusy("Loading characters…");
      try {
        const d = await api.charsList();
        if (live) setChars(d.chars || []);
      } catch (e: any) {
        toast(e.message, "error");
      } finally {
        setBusy(null);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshChars = (merged: Record<string, string>) => {
    useProject.getState().setProjectData({ chars: merged });
    void client.invalidateQueries();
  };

  const query = q.toLowerCase();
  const rows = chars.filter(
    (c) => !query || c.prefix.toLowerCase().includes(query) || (c.name || "").toLowerCase().includes(query),
  );

  return (
    <Overlay wide>
      <div ref={boxRef}>
        <h2>Characters</h2>
        <div className="mrow">
          <label>
            Register a new character ID (e.g. a mod character like CP_300) so it gets a name everywhere — picker,
            filters, badges.
          </label>
        </div>
        <div className="rule-grid" style={{ gridTemplateColumns: "140px 1fr auto" }}>
          <div>
            <label>ID (CN_xxx / CP_xxx)</label>
            <input id="newCharId" placeholder="CP_300" />
          </div>
          <div>
            <label>Name</label>
            <input id="newCharName" placeholder="Urame" />
          </div>
          <div>
            <label>&nbsp;</label>
            <button
              className="small primary"
              onClick={async () => {
                const box = boxRef.current;
                if (!box) return;
                const id = (box.querySelector("#newCharId") as HTMLInputElement).value;
                const name = (box.querySelector("#newCharName") as HTMLInputElement).value;
                setBusy("Saving…");
                try {
                  const d = await api.charsSet(id, name);
                  const l = await api.charsList();
                  setChars(l.chars || []);
                  (box.querySelector("#newCharId") as HTMLInputElement).value = "";
                  (box.querySelector("#newCharName") as HTMLInputElement).value = "";
                  toast(`${String(id).toUpperCase()} registered`, "success");
                  refreshChars(d.chars);
                } catch (e: any) {
                  toast(e.message, "error");
                } finally {
                  setBusy(null);
                }
              }}
            >
              Add
            </button>
          </div>
        </div>
        <div className="mrow">
          <label>Search</label>
          <input type="text" placeholder="Filter by ID or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mrow">
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {rows.map((c) => (
              <div key={c.prefix} className="kv-row" style={{ gridTemplateColumns: "86px 1fr auto auto" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{c.prefix}</span>
                <input
                  type="text"
                  defaultValue={c.name || ""}
                  key={`${c.prefix}:${c.name}`}
                  title={`Rename (creates a custom entry${c.source === "vanilla" ? ", shadowing the built-in name" : ""})`}
                  onBlur={async (e) => {
                    if (e.target.value === (c.name || "")) return;
                    setBusy("Saving…");
                    try {
                      const d = await api.charsSet(c.prefix, e.target.value);
                      const l = await api.charsList();
                      setChars(l.chars || []);
                      refreshChars(d.chars);
                    } catch (err: any) {
                      toast(err.message, "error");
                    } finally {
                      setBusy(null);
                    }
                  }}
                />
                <span
                  className={`badge ${c.source === "custom" ? "new" : ""}`}
                  style={c.source === "custom" ? undefined : { background: "#1a1e2c", color: "var(--dim)", border: "1px solid var(--border)" }}
                >
                  {c.source}
                  {c.tables ? ` · ${c.tables}t` : ""}
                </span>
                {c.source === "custom" ? (
                  <button
                    className="small danger"
                    onClick={async () => {
                      setBusy("Saving…");
                      try {
                        const d = await api.charsDelete(c.prefix);
                        const l = await api.charsList();
                        setChars(l.chars || []);
                        refreshChars(d.chars);
                      } catch (err: any) {
                        toast(err.message, "error");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    ×
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            {rows.length === 0 && <div className="empty-note">No matches</div>}
          </div>
        </div>
        <div className="mfoot">
          <button className="primary" onClick={closeModal}>
            Done
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ---------------- settings / about ----------------

function SettingsModal() {
  const config = useProject((s) => s.config) || {};
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const boxRef = useRef<HTMLDivElement>(null);

  const row = (key: string, label: string) => (
    <div className="set-row" key={key}>
      <label>{label}</label>
      <input type="text" data-set={key} defaultValue={config[key] || ""} />
      <button
        className="small"
        onClick={async () => {
          const picked = await api.pickDir(key).catch((e: any) => {
            toast(e.message, "error");
            return null;
          });
          if (picked && boxRef.current) {
            (boxRef.current.querySelector(`[data-set="${key}"]`) as HTMLInputElement).value = picked;
          }
        }}
      >
        …
      </button>
    </div>
  );
  const chkDefaults: Record<string, boolean> = {
    bakeParameterAssets: true,
    autoExport: false,
    backupOnExport: true,
    autoSnapshotOnExport: true,
  };
  const check = (key: string, label: string) => (
    <div className="set-row" key={key}>
      <label>{label}</label>
      <input
        type="checkbox"
        data-set-check={key}
        defaultChecked={config[key] !== undefined ? !!config[key] : chkDefaults[key] !== false}
      />
      <span />
    </div>
  );
  const num = (key: string, label: string) => (
    <div className="set-row" key={key}>
      <label>{label}</label>
      <input type="number" data-set-num={key} defaultValue={config[key] ?? ""} min={1} max={50} />
      <span />
    </div>
  );

  return (
    <Overlay>
      <div ref={boxRef}>
        <h2>Settings</h2>
        {row("editorRoot", "JJKJsonEditor root")}
        {row("modsDir", "Game Mods folder")}
        {row("modManagerDir", "Mod Manager dir (fallback patcher)")}
        {row("projectsDir", "Projects dir")}
        {check("bakeParameterAssets", "Bake parameter .uasset/.uexp on export")}
        {check("autoExport", "Auto-export to Mods folder a few seconds after each change")}
        {check("backupOnExport", "Zip-backup the mod folder before overwriting")}
        {num("backupsKept", "Export backups kept")}
        {check("autoSnapshotOnExport", "Auto-snapshot project on Export to Mods")}
        {num("snapshotKeep", "Auto-snapshots kept")}
        <div className="mrow">
          <label>Projects live as JSON files in the projects dir — back them up or commit them to git.</label>
        </div>
        <div className="mfoot">
          <button onClick={closeModal}>Cancel</button>
          <button
            className="primary"
            onClick={async () => {
              const box = boxRef.current;
              if (!box) return;
              const patch: any = {};
              box.querySelectorAll<HTMLInputElement>("[data-set]").forEach((el) => {
                patch[el.dataset.set!] = el.value;
              });
              box.querySelectorAll<HTMLInputElement>("[data-set-check]").forEach((el) => {
                patch[el.dataset.setCheck!] = el.checked;
              });
              box.querySelectorAll<HTMLInputElement>("[data-set-num]").forEach((el) => {
                const n = Number(el.value);
                if (Number.isFinite(n) && n >= 1) patch[el.dataset.setNum!] = Math.min(50, Math.floor(n));
              });
              setBusy("Saving...");
              try {
                const cfg = await api.saveSettings(patch);
                useProject.getState().setProjectData({ config: cfg });
                closeModal();
                toast("Settings saved — reloading tables…", "success");
                const d = await api.tablesList();
                const tableByFile: Record<string, any> = {};
                for (const x of d.tables) tableByFile[x.file] = x;
                useProject.getState().setTablesData(d.tables as any, tableByFile, d.changed);
                if (d.tablesError) toast(d.tablesError, "warn");
                await client.invalidateQueries();
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(null);
              }
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function AboutModal() {
  const closeModal = useUi((s) => s.closeModal);
  const build = useProject((s) => s.build);
  const ui = useProject((s) => s.ui);
  return (
    <Overlay>
      <h2>About JJK Mod Editor</h2>
      <div className="mrow">
        <label>Version</label>
        <div>0.1.0 — visual editor for Jujutsu Kaisen Cursed Clash datatable + parameter mods.</div>
      </div>
      <div className="mrow">
        <label>Build</label>
        <div style={{ fontSize: 12 }}>
          {build ? `${build.commit || "?"}${build.dirty ? " (dirty tree)" : ""} · ${build.builtAt || "?"} · via ${build.source || "?"}` : "unstamped bundle (no build-info.json)"}
          {ui ? ` · UI: ${ui}` : ""}
        </div>
      </div>
      <div className="mrow">
        <label>Menus</label>
        <div style={{ fontSize: 12 }}>
          File (projects, import/export), Edit (undo, search), View (tables, characters, tabs), Project (changes,
          snapshots, conflicts, checklist, moveset), Mod (manifest, assets, preview).
        </div>
      </div>
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

// ---------------- mod modal ----------------

function ModModal() {
  const project = useProject((s) => s.project);
  const modalProps = useUi((s) => s.modalProps);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const boxRef = useRef<HTMLDivElement>(null);
  const [assets, setAssets] = useState<Array<{ src: string; dest: string }> | null>(null);
  const [regText, setRegText] = useState<string | null>(null);
  const [regCount, setRegCount] = useState("");
  const [preview, setPreview] = useState<any>(null);

  const m: any = (project && project.manifest) || {};
  const extras = Object.entries(m).filter(([k]) => !["title", "description", "version", "priority", "icon"].includes(k));
  const [extraRows, setExtraRows] = useState<Array<[string, string]>>(
    extras.map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v ?? "")]),
  );

  const loadAssets = async () => {
    try {
      setAssets(await api.assetsList());
    } catch (e: any) {
      toast(e.message, "error");
    }
  };
  const loadRegistry = async () => {
    try {
      const rows = await api.registryGet();
      setRegText(JSON.stringify(rows, null, 1));
      setRegCount(`${rows.length} row(s)`);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };
  const refreshPreview = async () => {
    setBusy("Building preview…");
    try {
      setPreview(await api.exportPreview());
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void loadAssets();
    void loadRegistry();
    if (modalProps?.previewFirst) void refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveManifest = async () => {
    const box = boxRef.current;
    if (!box) return;
    setBusy("Saving…");
    try {
      const mm: any = {
        title: (box.querySelector("#mTitle") as HTMLInputElement).value,
        description: (box.querySelector("#mDesc") as HTMLTextAreaElement).value,
        version: (box.querySelector("#mVersion") as HTMLInputElement).value,
        priority: Number((box.querySelector("#mPriority") as HTMLInputElement).value) || 0,
        icon: (box.querySelector("#mIcon") as HTMLInputElement).value,
      };
      extraRows.forEach(([k0, v0]) => {
        const k = k0.trim();
        let v: any = v0;
        if (!k) return;
        try {
          if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith("[") && v.endsWith("]"))) v = JSON.parse(v);
          else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
          else if (v === "true") v = true;
          else if (v === "false") v = false;
        } catch {
          /* keep string */
        }
        mm[k] = v;
      });
      await api.manifestSave(mm);
      useProject.getState().setProjectData({ project: { ...useProject.getState().project, manifest: mm } });
      toast("Manifest saved", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Overlay wide>
      <div ref={boxRef}>
        <h2>Mod — {m.title || project?.name}</h2>
        <div className="mod-sect">
          <h4>Manifest (manifest.json)</h4>
          <label>Title</label>
          <input type="text" id="mTitle" defaultValue={m.title || ""} />
          <label>Description</label>
          <textarea id="mDesc" rows={2} defaultValue={m.description || ""} />
          <label>Version</label>
          <input type="text" id="mVersion" defaultValue={m.version || ""} />
          <label>Priority (higher wins vs other mods)</label>
          <input type="number" id="mPriority" defaultValue={String(m.priority ?? 0)} />
          <label>Icon (path relative to mod, or absolute to copy in)</label>
          <input type="text" id="mIcon" defaultValue={m.icon || ""} />
          <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
            <button
              className="small"
              onClick={async () => {
                const picked = await api
                  .pickFile({ title: "Pick icon", filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "ico", "webp"] }] })
                  .catch((e: any) => {
                    toast(e.message, "error");
                    return null;
                  });
                if (picked && boxRef.current) {
                  (boxRef.current.querySelector("#mIcon") as HTMLInputElement).value = picked;
                }
              }}
            >
              Browse…
            </button>
            <button className="small primary" onClick={saveManifest}>
              Save manifest
            </button>
          </div>
          <label style={{ marginTop: 8 }}>Other manifest fields (any extra keys)</label>
          <div id="mExtras">
            {extraRows.map(([k, v], i) => (
              <div className="kv-row" key={i}>
                <input
                  type="text"
                  value={k}
                  placeholder="key"
                  onChange={(e) => setExtraRows((r) => r.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}
                />
                <input
                  type="text"
                  value={v}
                  placeholder="value"
                  onChange={(e) => setExtraRows((r) => r.map((x, j) => (j === i ? [x[0], e.target.value] : x)))}
                />
                <button className="small danger" onClick={() => setExtraRows((r) => r.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            className="small"
            onClick={() => setExtraRows((r) => [...r, [`extra${Date.now().toString(36)}`, ""]])}
          >
            + field
          </button>
        </div>
        <div className="mod-sect">
          <h4>Duplicate / extra assets</h4>
          <div style={{ color: "var(--dim)", fontSize: 11.5, marginBottom: 6 }}>
            Files copied into the mod on export (tracked for safe overwrite).
          </div>
          <div id="assetList">
            {!assets || assets.length === 0 ? (
              <div style={{ color: "var(--dim)", fontSize: 12 }}>None</div>
            ) : (
              assets.map((a) => (
                <div key={a.dest} className="asset-item">
                  <span title={a.src}>→ {a.dest}</span>
                  <button
                    className="small danger"
                    onClick={async () => {
                      setBusy("Saving…");
                      try {
                        await api.assetsRemove(a.dest);
                        await loadAssets();
                      } catch (e: any) {
                        toast(e.message, "error");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              className="small"
              onClick={async () => {
                setBusy("Saving…");
                try {
                  await api.assetsAddFile();
                  await loadAssets();
                } catch (e: any) {
                  toast(e.message, "error");
                } finally {
                  setBusy(null);
                }
              }}
            >
              + file(s)
            </button>
            <button
              className="small"
              onClick={async () => {
                setBusy("Saving…");
                try {
                  await api.assetsAddDir();
                  await loadAssets();
                } catch (e: any) {
                  toast(e.message, "error");
                } finally {
                  setBusy(null);
                }
              }}
            >
              + folder
            </button>
          </div>
        </div>
        <div className="mod-sect">
          <h4>AssetRegistry.json (new assets)</h4>
          <div style={{ color: "var(--dim)", fontSize: 11.5, marginBottom: 6 }}>
            Array of asset entries merged by the Mod Manager. Leave <b>[]</b> when the mod adds no new assets.
          </div>
          <textarea rows={4} spellCheck={false} value={regText ?? ""} onChange={(e) => setRegText(e.target.value)} />
          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
            <button
              className="small primary"
              onClick={async () => {
                setBusy("Saving…");
                try {
                  const d = await api.registrySave(regText ?? "[]");
                  setRegCount(`${d.count} row(s)`);
                  toast("AssetRegistry saved", "success");
                } catch (e: any) {
                  toast(e.message, "error");
                } finally {
                  setBusy(null);
                }
              }}
            >
              Save
            </button>
            <span style={{ color: "var(--dim)", fontSize: 12 }}>{regCount}</span>
          </div>
        </div>
        <div className="mod-sect">
          <h4>Export preview</h4>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button className="small" onClick={refreshPreview}>
              Refresh
            </button>
          </div>
          <div style={{ color: "var(--dim)", fontSize: 12 }}>
            {!preview ? (
              "—"
            ) : (
              <>
                <div>
                  {preview.files.length} file(s) → <b>{preview.folder}</b>/
                </div>
                {preview.warnings.map((w: string, i: number) => (
                  <div key={i} className="warn">
                    {w}
                  </div>
                ))}
                <div className="file-list" style={{ maxHeight: 180, marginTop: 6 }}>
                  {preview.files.map((f: string) => (
                    <div key={f}>{f}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mfoot">
          <button className="primary" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ---------------- export confirm / patch result ----------------

function ExportConfirmModal() {
  const modalProps = useUi((s) => s.modalProps);
  const closeModal = useUi((s) => s.closeModal);
  const prev = modalProps?.preview;
  const config = useProject((s) => s.config);
  if (!prev) return null;
  const bk = prev.bake || {};
  return (
    <Overlay wide>
      <h2>Export to Mods folder</h2>
      <div className="mrow">
        <label>Target</label>
        <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
          {config?.modsDir || "(no Mods folder configured — Settings)"}/{prev.folder}
        </div>
      </div>
      <div className="mrow">
        <label>manifest.json</label>
        <div style={{ fontSize: 12 }}>Always written (title, description, version, priority, icon + extras).</div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <b>{prev.stats.tables}</b>tables
        </div>
        <div className="stat">
          <b>{prev.stats.rows}</b>rows
        </div>
        <div className="stat">
          <b>{prev.stats.params}</b>params
        </div>
        <div className="stat">
          <b>{prev.stats.assets}</b>assets
        </div>
      </div>
      {bk.attempted && (
        <div className="mrow">
          <label>Binary-baked parameter assets</label>
          {(bk.baked || []).length ? (
            bk.baked.map((b: any, i: number) => (
              <div key={i}>
                baked {b.short}.json into {b.asset} (+{b.added} new, {b.replaced || 0} replaced)
              </div>
            ))
          ) : (
            <div style={{ color: "var(--dim)" }}>None (no new parameter rows)</div>
          )}
          {bk.skippedReason && <div className="warn">bake skipped: {bk.skippedReason}</div>}
        </div>
      )}
      {!!prev.warnings.length && (
        <div className="mrow">
          <label>Warnings</label>
          {prev.warnings.map((w: string, i: number) => (
            <div key={i} className="warn">
              {w}
            </div>
          ))}
        </div>
      )}
      <div className="mrow">
        <label>Files ({prev.files.length}) — only these are written; unrelated files are never touched</label>
        <div className="file-list">
          {prev.files.map((f: string) => (
            <div key={f}>{f}</div>
          ))}
        </div>
      </div>
      <div className="mfoot">
        <button onClick={closeModal}>Cancel</button>
        <button
          className="primary"
          onClick={() => {
            closeModal();
            void confirmExportFolder();
          }}
        >
          Export
        </button>
      </div>
    </Overlay>
  );
}

function PatchResultModal() {
  const modalProps = useUi((s) => s.modalProps);
  const closeModal = useUi((s) => s.closeModal);
  const res = modalProps?.result;
  if (!res) return null;
  const dt = res.datatables;
  const bkr = res.bake || {};
  return (
    <Overlay>
      <h2>Test patch</h2>
      <div className="mrow">
        <label>Datatables{dt ? ` — ${dt.mode}` : ""}</label>
        {dt && <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>out: {dt.out}</div>}
        <div className="mrow">
          {!dt ? (
            <div style={{ color: "var(--dim)" }}>No datatable changes.</div>
          ) : dt.results ? (
            dt.results.map((r: any, i: number) => (
              <div key={i}>
                {r.ok ? "OK" : "FAIL"} {r.table}
                {r.ok ? "" : ` — ${r.error}`}
              </div>
            ))
          ) : (
            <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
              {JSON.stringify(dt.summary, null, 1).slice(0, 2000)}
            </div>
          )}
        </div>
      </div>
      <div className="mrow">
        <label>Parameter bake</label>
        {(bkr.baked || []).map((b: any, i: number) => (
          <div key={i}>
            baked {b.short}.json into {b.asset} (+{b.added} new, {b.replaced || 0} replaced)
          </div>
        ))}
        {bkr.skippedReason && <div className="warn">bake skipped: {bkr.skippedReason}</div>}
        {(bkr.newShorts || []).length === 0 && (bkr.baked || []).length === 0 && (
          <div style={{ color: "var(--dim)" }}>No new parameter rows.</div>
        )}
      </div>
      {!!(res.buildWarnings || []).length && (
        <div className="mrow">
          {res.buildWarnings.map((w: string, i: number) => (
            <div key={i} className="warn">
              {w}
            </div>
          ))}
        </div>
      )}
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

// ---------------- search results / text tools ----------------

function SearchResultsModal() {
  const modalProps = useUi((s) => s.modalProps);
  const closeModal = useUi((s) => s.closeModal);
  const q = modalProps?.q || "";
  const results: any[] = modalProps?.results || [];
  return (
    <Overlay wide>
      <h2>Search: {q}</h2>
      <div className="mrow">
        <label>{results.length} match(es)</label>
        {results.length ? (
          results.map((r, i) => (
            <div key={i} className="diff-row">
              <div className="dh">
                <span style={{ flex: 1 }}>
                  {r.file} :: {r.rowId}
                  {r.field && <span style={{ color: "var(--dim)" }}> {r.field}</span>}
                </span>
                {r.source === "project" && <span className="badge edited">PRJ</span>}
                <button
                  className="small"
                  onClick={() => {
                    closeModal();
                    void jumpToRow(r.file, r.rowId, r.field && !r.field.includes(".") ? r.field : null);
                  }}
                >
                  Open
                </button>
              </div>
              {r.snippet && r.field && <div className="df">{r.snippet}</div>}
            </div>
          ))
        ) : (
          <div className="empty-note">No matches.</div>
        )}
      </div>
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

function TextToolsModal() {
  const active = useTabs((s) => s.active());
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const boxRef = useRef<HTMLDivElement>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [count, setCount] = useState<string>("");

  const fam =
    active && active.kind === "table" && active.file
      ? active.file.replace(/\.json$/i, "").replace(/\d+$/, "")
      : "";
  const scopeOf = (): any => {
    const box = boxRef.current;
    const v = box ? (box.querySelector("#ttScope") as HTMLSelectElement).value : "all";
    if (v === "file" && active && active.kind === "table") return { file: active.file };
    if (v === "family") return { family: fam };
    return null;
  };

  return (
    <Overlay wide>
      <div ref={boxRef}>
        <h2>Text find / replace</h2>
        <div className="mrow">
          <label>Scope</label>
          <select id="ttScope" defaultValue={fam ? "family" : "all"}>
            <option value="all">All tables</option>
            {fam && (
              <option value="family">
                Family: {fam}
              </option>
            )}
            {active && active.kind === "table" && <option value="file">This file: {active.file}</option>}
          </select>
        </div>
        <div className="mrow">
          <label>Find</label>
          <input id="ttFind" type="text" />
        </div>
        <div className="mrow">
          <label>Replace with</label>
          <input id="ttReplace" type="text" />
        </div>
        <div className="mrow">
          <button
            className="small"
            onClick={async () => {
              const box = boxRef.current;
              if (!box) return;
              const q = (box.querySelector("#ttFind") as HTMLInputElement).value;
              if (!q) {
                toast("Find text is empty", "error");
                return;
              }
              setBusy("Searching text…");
              try {
                const d = await api.i18nFind(q, scopeOf());
                setMatches(d.matches || []);
                setCount(`${(d.matches || []).length} match(es)`);
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(null);
              }
            }}
          >
            Search
          </button>{" "}
          <span style={{ color: "var(--dim)" }}>{count}</span>
        </div>
        <div className="mrow">
          <div className="file-list" style={{ maxHeight: 240 }}>
            {matches.length === 0 ? (
              "—"
            ) : (
              matches.map((m, i) => (
                <label key={i} style={{ display: "block", padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                  <input type="checkbox" data-tt={i} defaultChecked /> <b>{m.file}</b> :: {m.rowId} :: {m.field}
                  <br />
                  <span style={{ color: "var(--dim)" }}>{m.value}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="mfoot">
          <button onClick={closeModal}>Close</button>
          <button
            className="primary"
            onClick={async () => {
              const box = boxRef.current;
              if (!box) return;
              const checked = Array.from(box.querySelectorAll<HTMLInputElement>("[data-tt]"))
                .filter((el) => el.checked)
                .map((el) => matches[Number(el.dataset.tt)])
                .filter(Boolean);
              if (!checked.length) {
                toast("Nothing checked", "error");
                return;
              }
              const find = (box.querySelector("#ttFind") as HTMLInputElement).value;
              const replace = (box.querySelector("#ttReplace") as HTMLInputElement).value;
              setBusy("Replacing…");
              try {
                const res = await api.i18nReplace(checked, find, replace);
                closeModal();
                useProject.getState().setChanged(res.changed || useProject.getState().changed);
                await client.invalidateQueries();
                toast(`Replaced in ${res.applied} field(s)`, "success");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(null);
              }
            }}
          >
            Replace checked
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ---------------- snapshots ----------------

function SnapshotsModal() {
  const currentProject = useProject((s) => s.currentProject);
  const config = useProject((s) => s.config);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [label, setLabel] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const l = await api.snapshotsList();
        if (live) setSnaps(l || []);
      } catch (e: any) {
        toast(e.message, "error");
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentProject) return null;

  const renderList = (list: any[]) =>
    list.length ? (
      list.map((s) => (
        <div key={s.file} className="diff-row">
          <div className="dh">
            <span className={`badge ${s.kind === "auto" ? "global" : "new"}`}>{s.kind}</span>
            <span style={{ flex: 1 }}>
              {new Date(s.ts).toLocaleString()}
              {s.label ? ` — ${s.label}` : ""}
            </span>
            <button
              className="small"
              onClick={async () => {
                setBusy("Restoring…");
                try {
                  const d = await api.snapshotsRestore(s.file);
                  closeModal();
                  await refreshAfterHistory(d);
                  toast("Snapshot restored (undoable)", "success");
                } catch (e: any) {
                  toast(e.message, "error");
                } finally {
                  setBusy(null);
                }
              }}
            >
              Restore
            </button>{" "}
            <button
              className="small danger"
              onClick={async () => {
                setBusy("Saving…");
                try {
                  const l = await api.snapshotsDelete(s.file);
                  setSnaps(l || []);
                } catch (e: any) {
                  toast(e.message, "error");
                } finally {
                  setBusy(null);
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))
    ) : (
      <div className="empty-note">None yet.</div>
    );

  return (
    <Overlay wide>
      <h2>Snapshots — {currentProject}</h2>
      <div className="mrow">
        <label>Manual commit (named restore point)</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="before Gojo rework"
            style={{ flex: 1 }}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            className="small primary"
            onClick={async () => {
              setBusy("Saving…");
              try {
                const d = await api.snapshotsCreate(label);
                setSnaps(d.snapshots || []);
                setLabel("");
                toast("Snapshot committed", "success");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(null);
              }
            }}
          >
            Commit
          </button>
        </div>
      </div>
      <div className="mrow">
        <label>Restore points (autos kept: last {config?.snapshotKeep || 5})</label>
        <div>{renderList(snaps)}</div>
      </div>
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

// ---------------- project changes (+validate +compare) ----------------

function ProjectChangesModal() {
  const currentProject = useProject((s) => s.currentProject);
  const projects = useProject((s) => s.projects);
  const modalProps = useUi((s) => s.modalProps);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const [diff, setDiff] = useState<any>(null);
  const [err, setErr] = useState("");
  const [valHtml, setValHtml] = useState<React.ReactNode>(null);
  const [cmp, setCmp] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const d = await api.diffProject();
        if (!live) return;
        setDiff(d);
        if (modalProps?.autoValidate) void runValidation(d);
      } catch (e: any) {
        if (live) setErr(e.message);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runValidation = async (d?: any) => {
    void d;
    setBusy("Validating…");
    try {
      const v = await api.validateProject();
      useUi.getState().setProblems(v);
      const counts = Object.entries(v.counts || {})
        .map(([k, n]) => `${n} ${k}`)
        .join(" — ");
      const where = (i: any) =>
        `${i.file || (i.short ? `parameters/${i.short}.json` : "")}${i.rowId ? ` :: ${i.rowId}` : ""}${i.field ? ` :: ${i.field}` : ""}`;
      setValHtml(
        <div className="mrow">
          <label>
            Validation — {v.total} issue(s){counts ? ` (${counts})` : ""}
          </label>
          {(v.issues || []).length ? (
            v.issues.slice(0, 150).map((i: any, ix: number) => (
              <div key={ix} className="diff-row">
                <div className="dh">
                  <span className="badge edited">{i.type}</span>
                  <span style={{ flex: 1 }}>{where(i)}</span>
                </div>
                <div className="df">{i.message || ""}</div>
                {i.file && i.rowId && (
                  <div className="df">
                    <button
                      className="small"
                      onClick={() => {
                        closeModal();
                        void jumpToRow(i.file, i.rowId, i.field || null);
                      }}
                    >
                      Open
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-note">Clean — no issues found.</div>
          )}
          {v.issues.length > 150 && <div style={{ color: "var(--dim)" }}>… {v.issues.length - 150} more</div>}
        </div>,
      );
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const runCompare = async (otherName: string) => {
    if (!otherName) return;
    setBusy("Comparing projects…");
    try {
      const c = await api.diffProjects(otherName);
      const tfiles = Object.keys(c.tables || {});
      const pshorts = Object.keys(c.params || {});
      const mark = (rr: any) => (!rr.inA ? "+ " : !rr.inB ? "− " : "!= ");
      setValHtml(
        <div className="mrow">
          <label>
            Compare: {currentProject} vs {otherName} — {tfiles.length} table(s), {pshorts.length} param(s) differ
          </label>
          {tfiles.length === 0 && pshorts.length === 0 && <div className="empty-note">Identical.</div>}
          {tfiles.map((f) => {
            const tt = c.tables[f];
            const rows = Object.keys(tt.rows || {});
            return (
              <div key={f} className="diff-row">
                <div className="dh">
                  <span style={{ flex: 1 }}>{f}</span>
                  <span style={{ color: "var(--dim)", fontSize: 11 }}>
                    {tt.rulesSame ? "" : "rules differ | "}
                    {rows.length} row(s)
                  </span>
                </div>
                <div className="df">
                  {rows.slice(0, 20).map((r) => {
                    const rr = tt.rows[r];
                    const fs = Object.keys(rr.fields || {});
                    return (
                      <div key={r}>
                        {mark(rr)}
                        {r}
                        {fs.length ? <span style={{ color: "var(--dim)" }}> {fs.join(", ")}</span> : null}
                      </div>
                    );
                  })}
                  {rows.length > 20 && <div style={{ color: "var(--dim)" }}>… {rows.length - 20} more</div>}
                </div>
              </div>
            );
          })}
          {pshorts.map((p) => (
            <div key={p} className="diff-row">
              <div className="dh">
                <span style={{ flex: 1 }}>parameters/{p}.json</span>
                <span style={{ color: "var(--dim)", fontSize: 11 }}>{Object.keys(c.params[p] || {}).length} row(s)</span>
              </div>
            </div>
          ))}
        </div>,
      );
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const others = (projects || []).filter((p) => p.name !== currentProject);
  const files = diff ? Object.keys(diff.tables || {}).sort() : [];
  const params = diff ? diff.params || {} : {};

  return (
    <Overlay wide>
      <div ref={boxRef}>
        <h2>Project changes</h2>
        <div className="mrow" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="small" onClick={() => runValidation()}>
            Validate project
          </button>
          {!!others.length && (
            <>
              <select value={cmp} onChange={(e) => setCmp(e.target.value)}>
                {others.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.title || p.name}
                  </option>
                ))}
              </select>
              <button className="small" onClick={() => runCompare(cmp || others[0]?.name)}>
                Compare with…
              </button>
            </>
          )}
        </div>
        <div>{valHtml}</div>
        {err && <div className="err">{err}</div>}
        {diff && (
          <>
            {(diff.errors || []).map((e: string, i: number) => (
              <div key={i} className="err">
                {e}
              </div>
            ))}
            {files.length === 0 && Object.keys(params).length === 0 && <div className="empty-note">No changes yet.</div>}
            {files.map((f: string) => (
              <div key={f} className="diff-row">
                <div className="dh">
                  <span style={{ flex: 1 }}>{f}</span>
                  <span style={{ color: "var(--dim)", fontSize: 11 }}>{Object.keys(diff.tables[f]).sort().length} row(s)</span>
                  <button
                    className="small"
                    onClick={() => {
                      closeModal();
                      selectScope({ kind: "table", file: f });
                      const t = useTabs.getState().findTableTab(f, useProject.getState().charMode || "");
                      if (t) useTabs.getState().patch(t.id, { statusFilter: "edited" });
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
            {Object.keys(params)
              .sort()
              .map((p: string) => (
                <div key={p} className="diff-row">
                  <div className="dh">
                    <span style={{ flex: 1 }}>parameters/{p}.json</span>
                    <span style={{ color: "var(--dim)", fontSize: 11 }}>
                      {((params[p] && params[p].new) || []).length} new / {((params[p] && params[p].modified) || []).length}{" "}
                      vanilla-modified
                    </span>
                  </div>
                </div>
              ))}
          </>
        )}
        <div className="mfoot">
          <button className="primary" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ---------------- conflicts / checklist / moveset ----------------

function ConflictsModal() {
  const currentProject = useProject((s) => s.currentProject);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setBusy("Scanning installed mods…");
      try {
        const d = await api.conflictsScan();
        if (live) setData(d);
      } catch (e: any) {
        toast(e.message, "error");
        closeModal();
      } finally {
        setBusy(null);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentProject || !data) return null;
  const list = data.conflicts || [];
  return (
    <Overlay wide>
      <h2>
        Conflicts — {currentProject} (priority {data.myPriority})
      </h2>
      <div className="mrow">
        <label>
          Same rows touched by this project and {data.modCount} installed mod(s). Higher priority wins at package time.
        </label>
        {list.length ? (
          list.map((c: any, i: number) => (
            <div key={i} className="diff-row">
              <div className="dh">
                <span className={`badge ${c.winner === "you" ? "new" : c.winner === "them" ? "edited" : "global"}`}>
                  {c.winner === "you" ? "YOU WIN" : c.winner === "them" ? "THEY WIN" : "TIE"}
                </span>
                <span style={{ flex: 1 }}>
                  {c.title} (prio {c.priority}) — {c.file} — {c.rowCount} row(s)
                </span>
              </div>
              <div className="df">
                {c.rows.map((r: string) => r).join(", ")}
                {c.rowCount > c.rows.length ? ", …" : ""}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-note">No overlapping rows. Clean.</div>
        )}
      </div>
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

function ChecklistModal() {
  const charMode = useProject((s) => s.charMode);
  const chars = useProject((s) => s.chars);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!charMode) {
        toast("Pick a character first (top bar)", "error");
        closeModal();
        return;
      }
      setBusy("Checking character coverage…");
      try {
        const d = await api.checklistCharacter(charMode);
        if (live) setData(d);
      } catch (e: any) {
        toast(e.message, "error");
        closeModal();
      } finally {
        setBusy(null);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;
  const group = (title: string, items: any[]) => (
    <div className="mrow">
      <label>
        {title} — {items.length - items.filter((i) => i.status === "missing").length}/{items.length} present
      </label>
      {items.map((it, ix) => {
        const firstFile = (it.files && it.files[0] && it.files[0].file) || null;
        return (
          <div key={ix} className="diff-row">
            <div className="dh">
              <span className={`badge ${it.status === "ok" ? "new" : "edited"}`}>
                {it.status === "ok" ? "OK" : "MISSING"}
              </span>
              <span style={{ flex: 1 }}>{it.family}</span>
              <span style={{ color: "var(--dim)", fontSize: 11 }}>
                vanilla {it.vanilla} · project {it.project}
              </span>
              {firstFile && (
                <button
                  className="small"
                  onClick={() => {
                    closeModal();
                    selectScope({ kind: "table", file: firstFile });
                  }}
                >
                  Open
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Overlay wide>
      <h2>
        Checklist — {charMode} ({charLabelOf(chars, charMode || "")})
      </h2>
      {group("Core tables (playable character needs these)", data.core || [])}
      <div className="mrow">
        <label>
          Parameters — {data.params.filter((p: any) => p.status === "ok").length}/{data.params.length} present
        </label>
        {data.params.map((p: any, ix: number) => (
          <div key={ix} className="diff-row">
            <div className="dh">
              <span className={`badge ${p.status === "ok" ? "new" : "edited"}`}>
                {p.status === "ok" ? "OK" : "MISSING"}
              </span>
              <span style={{ flex: 1 }}>parameters/{p.short}.json</span>
              <span style={{ color: "var(--dim)", fontSize: 11 }}>
                vanilla {p.vanilla} · project {p.project}
              </span>
              {p.status === "ok" && (
                <button
                  className="small"
                  onClick={() => {
                    closeModal();
                    useProject.getState().setLeftTab("params");
                    selectScope({ kind: "param", short: p.short });
                  }}
                >
                  Open
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {group("Extended tables (nice to have)", data.extended || [])}
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

function MovesetModal() {
  const charMode = useProject((s) => s.charMode);
  const chars = useProject((s) => s.chars);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!charMode) {
        toast("Pick a character first (top bar)", "error");
        closeModal();
        return;
      }
      setBusy("Rolling up moveset…");
      try {
        const d = await api.movesetCharacter(charMode);
        if (live) setData(d);
      } catch (e: any) {
        toast(e.message, "error");
        closeModal();
      } finally {
        setBusy(null);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;
  if (!data.actionKey) {
    return (
      <Overlay wide>
        <h2>Moveset — {charMode}</h2>
        <div className="empty-note">No Action row for this character.</div>
        <div className="mfoot">
          <button className="primary" onClick={closeModal}>
            Close
          </button>
        </div>
      </Overlay>
    );
  }
  const fld = (obj: any) =>
    Object.entries(obj || {})
      .map(([k, v]) => (
        <div key={k}>
          <span style={{ color: "var(--accent)" }}>{k}</span> = {shortVal(v, 90)}
        </div>
      ));

  return (
    <Overlay wide>
      <h2>
        Moveset — {charMode} ({charLabelOf(chars, charMode || "")})
      </h2>
      <div className="mrow">
        <label>
          Action row: {data.actionKey} · {data.inputs.length} input(s)
        </label>
        {data.inputs.map((inp: any, ix: number) => (
          <div key={ix} className="diff-row">
            <div className="dh">
              <span style={{ flex: 1 }}>{inp.field}</span>
            </div>
            <div className="df">
              {inp.sets.map((st: any, jx: number) => {
                if (st.missing)
                  return (
                    <div key={jx}>
                      Set {st.set} — <span className="err">missing row</span>
                    </div>
                  );
                return (
                  <div key={jx} style={{ marginBottom: 6 }}>
                    Set <b>{st.set}</b>{" "}
                    <button className="small" onClick={() => jumpToSet(st.set)}>
                      Open
                    </button>
                    <br />
                    {st.hits.length ? (
                      st.hits.map((hh: any, kx: number) => (
                        <div key={kx} style={{ margin: "4px 0 4px 12px" }}>
                          Hit <b>{hh.id}</b>{" "}
                          <button className="small" onClick={() => jumpToAttack(hh.id)}>
                            Open
                          </button>
                          <br />
                          {hh.missing ? <span className="err">missing attack row</span> : fld(hh.fields)}
                          {hh.damages.length ? (
                            hh.damages.map((dd: any, dx: number) => (
                              <div key={dx} style={{ margin: "3px 0 3px 12px" }}>
                                Damage <b>{dd.id}</b>{" "}
                                <button className="small" onClick={() => jumpToDamage(dd.id)}>
                                  Open
                                </button>
                                <br />
                                {dd.missing ? <span className="err">missing damage row</span> : fld(dd.fields)}
                              </div>
                            ))
                          ) : (
                            <div style={{ color: "var(--dim)" }}>no damage rows</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "var(--dim)" }}>no hits</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );

  function jumpToSet(set: string) {
    closeModal();
    void jumpToRow("AttackSetDataTable.json", set);
  }
  function jumpToAttack(id: string) {
    closeModal();
    void resolveAndJump("__attack__", id);
  }
  function jumpToDamage(id: string) {
    closeModal();
    void resolveAndJump("__damage__", id);
  }
}

// ---------------- field docs / refs ----------------

function FieldDocsModal() {
  const modalProps = useUi((s) => s.modalProps);
  const toast = useUi((s) => s.toast);
  const setBusy = useUi((s) => s.setBusy);
  const closeModal = useUi((s) => s.closeModal);
  const { tabId, rowId, field } = modalProps || {};
  const tab = useTabs((s) => s.tabs.find((t) => t.id === tabId));
  const { data: schemaData } = useTableSchema(tab?.kind === "table" ? (tab.file as string) : null);
  const { data: rowData } = useRowData(tab?.kind === "table" ? (tab.file as string) : null, tab?.kind === "table" ? rowId : null);

  const fs: any = (() => {
    if (!tab || tab.kind !== "table") return { kind: "any" };
    const top = String(field || "").split(".")[0];
    const sch = (schemaData as any)?.schema;
    return ((sch && sch.fields) || {})[top] || { kind: "any" };
  })();
  const enumName = fs?.enumName || null;
  const base = tab ? docsBaseOf(tab) : "";
  const family = tab ? docsFamilyOf(tab) : "";
  const sample = rowData && !(rowData as any).isNew && !(rowData as any).isParam ? (rowData as any).vanilla?.[field] : (rowData as any)?.effective?.[field];
  const { data: docs } = useDocsField(base || null, family || null, field || null, enumName);
  const [desc, setDesc] = useState<string | null>(null);
  const [enumDescs, setEnumDescs] = useState<Record<string, string> | null>(null);

  const fullDesc = desc ?? docs?.field?.desc ?? "";
  const members: any[] = docs?.enum?.members || [];

  useEffect(() => {
    setDesc(null);
    setEnumDescs(null);
  }, [field, tabId]);

  if (!tab || !field) return null;

  return (
    <Overlay wide>
      <h2>{field}</h2>
      <div className="mrow">
        <label>Type</label>
        <div className="fdoc-full" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
          {fs.enumName ? `${fs.kind} · ${fs.enumName}` : fs.kind}
        </div>
      </div>
      {sample !== undefined && (
        <div className="mrow">
          <label>Vanilla sample</label>
          <div className="fdoc-full" style={{ fontFamily: "var(--mono)", fontSize: 12, wordBreak: "break-all" }}>
            {shortVal(sample, 300)}
          </div>
        </div>
      )}
      <div className="mrow">
        <label>Description</label>
        <textarea rows={4} value={fullDesc} onChange={(e) => setDesc(e.target.value)} />
        <div className="src">source: {docs?.field?.source || "none"} · stored in field-docs.json</div>
        <div style={{ marginTop: 4 }}>
          <button
            className="small primary"
            onClick={async () => {
              setBusy("Saving…");
              try {
                await api.docsSaveField(base, field, fullDesc);
                await client.invalidateQueries({ queryKey: ["docs", base] });
                toast("Description saved to field-docs.json", "success");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(null);
              }
            }}
          >
            Save description
          </button>
        </div>
      </div>
      {!!docs?.enum && (
        <div className="mrow">
          <label>
            Enum members — {docs.enum.name} (what each value means)
          </label>
          {members.map((m: any) => (
            <div key={m.name} className="member-doc">
              <div className="mname">
                {m.name} = {m.value}
              </div>
              <textarea
                value={(enumDescs && enumDescs[m.name]) ?? m.desc ?? ""}
                placeholder="What does this value do?"
                onChange={(e) => setEnumDescs((p) => ({ ...(p || {}), [m.name]: e.target.value }))}
              />
            </div>
          ))}
          <button
            className="small primary"
            style={{ marginTop: 4 }}
            onClick={async () => {
              setBusy("Saving…");
              try {
                const updates = members.map((m: any) => [m.name, (enumDescs && enumDescs[m.name]) ?? m.desc ?? ""] as const);
                for (const [member, d] of updates) await api.docsSaveEnum(docs.enum.name, member, d);
                await client.invalidateQueries({ queryKey: ["docs", base] });
                toast(`Enum notes saved (${docs.enum.name})`, "success");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(null);
              }
            }}
          >
            Save enum notes
          </button>
        </div>
      )}
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

function RefTargetsModal() {
  const modalProps = useUi((s) => s.modalProps);
  const closeModal = useUi((s) => s.closeModal);
  const { rowId, field, entry } = modalProps || {};
  if (!entry) return null;
  return (
    <Overlay wide>
      <h2>
        {rowId} → {field}
      </h2>
      {entry.values.map((v: any, i: number) => (
        <div key={i} className="mrow">
          <label>{shortVal(v.value, 100)}</label>
          {(v.targets || []).length ? (
            v.targets.map((x: any, j: number) => (
              <div key={j} className="diff-row">
                <div className="dh">
                  <span style={{ flex: 1 }}>
                    {x.file} :: {x.rowId}
                  </span>
                  {x.isNew && <span className="badge new">NEW</span>}
                  <button
                    className="small"
                    onClick={() => {
                      closeModal();
                      void jumpToRow(x.file, x.rowId);
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="err">Resolves nowhere (dangling reference)</div>
          )}
        </div>
      ))}
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

function ReferencedByModal() {
  const modalProps = useUi((s) => s.modalProps);
  const closeModal = useUi((s) => s.closeModal);
  const value = modalProps?.value || "";
  const refs: any[] = modalProps?.refs || [];
  const direct = refs.filter((r) => !r.sameId);
  const same = refs.filter((r) => r.sameId);
  const refRow = (r: any, i: number) => (
    <div key={i} className="diff-row">
      <div className="dh">
        <span style={{ flex: 1 }}>
          {r.file} :: {r.rowId} <span style={{ color: "var(--dim)" }}>{r.field}</span>
        </span>
        {r.isNew && <span className="badge new">NEW</span>}
        {r.sameId && <span className="badge">SAME ID</span>}
        <button
          className="small"
          onClick={() => {
            closeModal();
            void jumpToRow(r.file, r.rowId);
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
  return (
    <Overlay wide>
      <h2>Referenced by {value}</h2>
      <div className="mrow">
        <label>
          {direct.length} reference(s){same.length ? ` + ${same.length} same-ID match(es)` : ""} across all tables
        </label>
        {direct.length ? (
          <>
            {direct.slice(0, 200).map(refRow)}
            {direct.length > 200 && <div style={{ color: "var(--dim)" }}>… {direct.length - 200} more</div>}
          </>
        ) : (
          <div className="empty-note">Nothing references this row via Id_ fields.</div>
        )}
        {!!same.length && (
          <div className="mrow" style={{ marginTop: 8 }}>
            <label>Same row ID in other tables (shared-key counterparts, e.g. Attack ↔ Damage)</label>
            {same.slice(0, 50).map(refRow)}
            {same.length > 50 && <div style={{ color: "var(--dim)" }}>… {same.length - 50} more</div>}
          </div>
        )}
      </div>
      <div className="mfoot">
        <button className="primary" onClick={closeModal}>
          Close
        </button>
      </div>
    </Overlay>
  );
}

// ---------------- root ----------------

export function Modals() {
  const modal = useUi((s) => s.modal);
  if (!modal) return null;
  return (
    <div id="modalRoot">
      {modal === "openProject" && <OpenProjectModal />}
      {modal === "characters" && <CharactersModal />}
      {modal === "settings" && <SettingsModal />}
      {modal === "about" && <AboutModal />}
      {modal === "mod" && <ModModal />}
      {modal === "exportConfirm" && <ExportConfirmModal />}
      {modal === "patchResult" && <PatchResultModal />}
      {modal === "searchResults" && <SearchResultsModal />}
      {modal === "textTools" && <TextToolsModal />}
      {modal === "snapshots" && <SnapshotsModal />}
      {modal === "projectChanges" && <ProjectChangesModal />}
      {modal === "conflicts" && <ConflictsModal />}
      {modal === "checklist" && <ChecklistModal />}
      {modal === "moveset" && <MovesetModal />}
      {modal === "fieldDocs" && <FieldDocsModal />}
      {modal === "refTargets" && <RefTargetsModal />}
      {modal === "referencedBy" && <ReferencedByModal />}
    </div>
  );
}
