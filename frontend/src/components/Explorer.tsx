// Left sidebar: Explorer (tables/parameters), Search, Changes.
// Mirrors renderScopeList()/runGSearch()/renderChangesView() in renderer/app.js.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "../api/queries";
import { api } from "../api/ipc";
import { charLabelOf, useProject } from "../stores/project";
import { paramMatchesChar, projectParamRows } from "../app/flows";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { jumpToRow, openOriginalJson, openProjectJson, openRulesTab, selectScope, setCharMode, validateIntoPanel } from "../app/flows";

function charTableCount(prefixIndex: Record<string, Record<string, number>> | null, tables: any[], prefix: string): number | null {
  if (!prefixIndex) return null;
  let n = 0;
  for (const t of tables) {
    if (prefixIndex[t.file] && prefixIndex[t.file][prefix]) n++;
  }
  return n;
}

export function CharPicker() {
  const anchor = useUi((s) => s.charPickerAnchor);
  const chars = useProject((s) => s.chars);
  const charMode = useProject((s) => s.charMode);
  const prefixIndex = useProject((s) => s.prefixIndex);
  const tables = useProject((s) => s.tables);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const opts = useMemo(() => {
    let prefixes = Object.keys(chars || {}).sort();
    if (prefixIndex) {
      const found = new Set<string>();
      for (const counts of Object.values(prefixIndex)) {
        for (const p of Object.keys(counts)) found.add(p);
      }
      prefixes = [...found].sort();
    }
    const ql = q.toLowerCase();
    return prefixes
      .filter((p) => !ql || p.toLowerCase().includes(ql) || (chars[p] || "").toLowerCase().includes(ql))
      .map((p) => ({ value: p, label: `${p} — ${charLabelOf(chars, p)}`, count: charTableCount(prefixIndex, tables, p) }));
  }, [chars, prefixIndex, tables, q]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const above = !!anchor.closest?.("#statusBar");
    el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 272))}px`;
    el.style.top = above
      ? `${Math.max(8, r.top - 336)}px`
      : `${Math.min(r.bottom + 4, window.innerHeight - 240)}px`;
    const search = el.querySelector("input");
    search?.focus();
    const onDown = (e: MouseEvent) => {
      if (el && !el.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("#btnCharFilter") && !(e.target as HTMLElement).closest?.("#stChar")) {
        useUi.getState().setCharPicker(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUi.getState().setCharPicker(null);
    };
    setTimeout(() => {
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor]);

  if (!anchor) return null;

  return (
    <div id="charPicker" ref={ref}>
      <input placeholder="Filter characters…" value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      <div className="cp-list" id="charPickerList">
        <div className={`cp-item${!charMode ? " sel" : ""}`} onClick={() => pick("")}>
          All characters
        </div>
        {opts.map((o) => (
          <div key={o.value} className={`cp-item${charMode === o.value ? " sel" : ""}`} onClick={() => pick(o.value)}>
            <span>{o.label}</span>
            {o.count !== null && o.count !== undefined && <span className="ct">{o.count}t</span>}
          </div>
        ))}
        {opts.length === 0 && (
          <div className="empty-note" style={{ padding: 12 }}>
            No matches
          </div>
        )}
      </div>
    </div>
  );

  function pick(v: string) {
    useUi.getState().setCharPicker(null);
    void setCharMode(v).catch((e: any) => useUi.getState().toast(e?.message || String(e), "error"));
  }
}

// Right-click context menu on scope items (Open / Global Rules / JSON files).
export function ScopeMenu({ x, y, items, onClose }: { x: number; y: number; items: Array<{ label: string; run: () => void }>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8))}px`;
      el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8))}px`;
    }
    const onDown = (e: MouseEvent) => {
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(() => {
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div id="ctxMenu" ref={ref}>
      {items.map((it, i) => (
        <div
          key={i}
          className="ctx-item"
          onClick={() => {
            onClose();
            it.run();
          }}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}

export function Explorer() {
  const tables = useProject((s) => s.tables);
  const changed = useProject((s) => s.changed);
  const leftTab = useProject((s) => s.leftTab);
  const charMode = useProject((s) => s.charMode);
  const chars = useProject((s) => s.chars);
  const prefixIndex = useProject((s) => s.prefixIndex);
  const paramAssets = useProject((s) => s.paramAssets);
  const project = useProject((s) => s.project);
  const active = useTabs((s) => s.active());
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; items: Array<{ label: string; run: () => void }> } | null>(null);

  // Debounced scope filter (200ms like app.js).
  useEffect(() => {
    const t = setTimeout(() => setQ(input), 200);
    return () => clearTimeout(t);
  }, [input]);

  const activeKey = active ? (active.kind === "param" ? `param:${active.short}` : `table:${active.file}`) : "";

  const groups = useMemo(() => {
    const ql = q.toLowerCase();
    const g: Record<string, typeof tables> = {};
    const mode = charMode;
    const idxReady = !mode || (prefixIndex && Object.keys(prefixIndex).length > 0);
    for (const t of tables) {
      if (ql && !t.file.toLowerCase().includes(ql)) continue;
      let matchCount: number | null = null;
      if (mode && idxReady) {
        matchCount = (prefixIndex![t.file] && prefixIndex![t.file][mode]) || 0;
        if (!matchCount) continue;
      }
      (t as any)._matchCount = matchCount;
      (g[t.groupLabel] = g[t.groupLabel] || []).push(t);
    }
    return Object.keys(g)
      .sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
      .map((k) => [k, g[k]] as const);
  }, [tables, q, charMode, prefixIndex]);

  const paramRows = (short: string) => projectParamRows(short).length;

  const sideHidden = useUi((s) => s.sideView !== "explorer" || !s.sidebarOpen);
  const params = useMemo(() => {
    const ql = q.toLowerCase();
    return paramAssets
      .filter((a) => !ql || a.shortName.toLowerCase().includes(ql) || a.assetName.toLowerCase().includes(ql))
      .filter((a) => paramMatchesChar(a.shortName, projectParamRows(a.shortName)));
  }, [paramAssets, q, charMode, project]);

  return (
    <div className={`side-view${sideHidden ? " hidden" : ""}`} id="sideExplorer">
      <div className="side-title">Explorer</div>
      <div className="pane-tabs" id="leftTabs">
        <button
          data-ltab="tables"
          className={leftTab === "tables" ? "active" : ""}
          onClick={() => {
            useProject.getState().setLeftTab("tables");
            setInput("");
            setQ("");
          }}
        >
          Tables
        </button>
        <button
          data-ltab="params"
          className={leftTab === "params" ? "active" : ""}
          onClick={() => {
            useProject.getState().setLeftTab("params");
            setInput("");
            setQ("");
          }}
        >
          Parameters
        </button>
      </div>
      <div id="sideSearchRow">
        <input id="scopeSearch" placeholder="Filter…" value={input} autoComplete="off" onChange={(e) => setInput(e.target.value)} />
        <button
          id="btnCharFilter"
          className={charMode ? "on" : ""}
          title={
            charMode
              ? `Character filter: ${charMode} — ${charLabelOf(chars, charMode)} (click to change)`
              : "Character filter: all (click to change)"
          }
          onClick={(e) => {
            const st = useUi.getState();
            st.setCharPicker(st.charPickerAnchor ? null : e.currentTarget);
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
          </svg>
        </button>
      </div>
      <div
        id="scopeList"
        onContextMenu={(e) => {
          const tf = (e.target as HTMLElement).closest("[data-tfile]");
          if (tf) {
            e.preventDefault();
            const file = (tf as HTMLElement).dataset.tfile!;
            setMenu({
              x: e.clientX,
              y: e.clientY,
              items: [
                { label: "Open", run: () => selectScope({ kind: "table", file }) },
                { label: "Global Rules", run: () => openRulesTab(file) },
                { label: "Open original JSON", run: () => void openOriginalJson(file) },
                ...(changed[file]
                  ? [{ label: "Open project JSON", run: () => void openProjectJson() }]
                  : []),
              ],
            });
            return;
          }
          const ps = (e.target as HTMLElement).closest("[data-pshort]");
          if (ps) {
            e.preventDefault();
            const short = (ps as HTMLElement).dataset.pshort!;
            setMenu({
              x: e.clientX,
              y: e.clientY,
              items: [
                { label: "Open", run: () => selectScope({ kind: "param", short }) },
                // Parameters have no vanilla JSON file (values come from cooked
                // uassets), so only the project file can be opened — and only
                // when this file actually has project rows.
                ...(projectParamRows(short).length > 0
                  ? [{ label: "Open project JSON", run: () => void openProjectJson() }]
                  : []),
              ],
            });
          }
        }}
      >
        {charMode && (
          <div className="group-h">
            Filtered to {charMode} — {charLabelOf(chars, charMode)}
          </div>
        )}
        {leftTab === "params" ? (
          params.length === 0 ? (
            <div className="empty-note">{charMode ? `No parameter files contain ${charMode} rows.` : "No parameters"}</div>
          ) : (
            params.map((a) => {
              const n = paramRows(a.shortName);
              const isActive = activeKey === `param:${a.shortName}`;
              return (
                <div
                  key={a.shortName}
                  className={`scope-item${isActive ? " active" : ""}`}
                  data-pshort={a.shortName}
                  onClick={() => selectScope({ kind: "param", short: a.shortName })}
                >
                  <span className={`dot ${n ? "changed" : "none"}`} />
                  <span className="nm" title={`${a.assetName} (${a.shortName}.json)`}>
                    {a.shortName}
                  </span>
                  <span className="ct">{n}</span>
                </div>
              );
            })
          )
        ) : groups.length === 0 ? (
          <div className="empty-note">
            {charMode ? (
              <>No tables contain {charMode} rows.</>
            ) : (
              <>No tables found. Run npm run vendor-input-json, then restart.</>
            )}
          </div>
        ) : (
          groups.map(([g, list]) => (
            <div key={g}>
              <div className="group-h">{g}</div>
              {list.map((tbl) => {
                const c = changed[tbl.file];
                const isActive = activeKey === `table:${tbl.file}`;
                const match = (tbl as any)._matchCount;
                return (
                  <div
                    key={tbl.file}
                    className={`scope-item${isActive ? " active" : ""}`}
                    data-tfile={tbl.file}
                    onClick={() => selectScope({ kind: "table", file: tbl.file })}
                  >
                    <span className={`dot ${c ? "changed" : "none"}`} />
                    <span className="nm" title={tbl.file}>
                      {tbl.file.replace(/\.json$/i, "")}
                    </span>
                    {c ? (
                      <span className="ct">{(c.rules || 0) + (c.overrides || 0) + (c.newRows || 0)}</span>
                    ) : match !== null && match !== undefined ? (
                      <span className="ct">{match}</span>
                    ) : (
                      <span className="ct">{tbl.rows}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
      {menu && <ScopeMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

export function SearchView() {
  const sideHidden = useUi((s) => s.sideView !== "search" || !s.sidebarOpen);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const toast = useUi((s) => s.toast);

  const run = async () => {
    const query = q.trim();
    if (!query) return;
    try {
      const d = await api.globalSearch(query, 100);
      setResults(d.results || []);
      setSearched(true);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <div className={`side-view${sideHidden ? " hidden" : ""}`} id="sideSearch">
      <div className="side-title">Search</div>
      <div id="sideSearchRow2">
        <input
          id="gSearchInput"
          placeholder="Row ID or value text…"
          value={q}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setSearched(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
        />
      </div>
      <div className="side-btns">
        <button className="small primary" id="btnGSearch" onClick={() => void run()}>
          Search all tables
        </button>
      </div>
      <div id="gSearchResults">
        {!searched && results.length === 0 && <div className="empty-note">Type above and hit Search.</div>}
        {searched && results.length > 0 && <div className="group-h">{results.length} match(es)</div>}
        {results.map((r, i) => (
          <div
            key={i}
            className="g-hit"
            onClick={() => {
              void jumpToRow(r.file, r.rowId, r.field && !r.field.includes(".") ? r.field : null);
            }}
          >
            <div className="gf">
              {r.file}
              {r.field && <span style={{ color: "var(--dim)" }}> · {r.field}</span>}
            </div>
            <div className="gr">
              {r.rowId}
              {r.source === "project" && <span className="badge edited">PRJ</span>}
            </div>
            {r.snippet && <div className="gs">{r.snippet}</div>}
          </div>
        ))}
        {searched && results.length === 0 && <div className="empty-note">No matches.</div>}
      </div>
    </div>
  );
}

export function ChangesView() {
  const sideHidden = useUi((s) => s.sideView !== "changes" || !s.sidebarOpen);
  const qc = useQueryClient();
  const { data, isFetching, error } = useChangesQuery();

  const openFile = (f: string) => {
    selectScope({ kind: "table", file: f });
    const t = useTabs.getState().findTableTab(f, useProject.getState().charMode || "");
    if (t) useTabs.getState().patch(t.id, { statusFilter: "edited" });
  };

  return (
    <div className={`side-view${sideHidden ? " hidden" : ""}`} id="sideChanges">
      <div className="side-title">Changes</div>
      <div className="side-btns">
        <button
          className="small"
          id="btnChRefresh"
          title="Refresh"
          onClick={() => {
            void qc.invalidateQueries({ queryKey: keys.diff });
          }}
        >
          Refresh
        </button>
        <button className="small" id="btnChValidate" title="Validate project into Problems panel" onClick={() => validateIntoPanel()}>
          Validate
        </button>
        <button className="small" id="btnChSnap" title="Snapshots" onClick={() => useUi.getState().openModal("snapshots")}>
          Snapshots
        </button>
      </div>
      <div id="changesList">
        {isFetching && <div className="empty-note">Loading…</div>}
        {error && <div className="empty-note err">{(error as Error).message}</div>}
        {!isFetching && !error && data && <ChangesListBody data={data} onFile={openFile} />}
      </div>
    </div>
  );
}

function ChangesListBody({ data, onFile }: { data: any; onFile: (f: string) => void }) {
  const files = Object.keys(data.tables || {}).sort();
  const pkeys = Object.keys(data.params || {}).sort();
  if (!files.length && !pkeys.length) {
    return (
      <div className="empty-note">
        No changes yet.
        <br />
        Edits appear here as you work.
      </div>
    );
  }
  return (
    <>
      {!!files.length && <div className="group-h">Tables · {files.length}</div>}
      {files.map((f) => (
        <div key={f} className="ch-file" data-chgoto={f} title="Open with Edited filter" onClick={() => onFile(f)}>
          <span className="dot changed" />
          <span className="nm">{f}</span>
          <span className="ct">{Object.keys(data.tables[f]).length}</span>
        </div>
      ))}
      {!!pkeys.length && <div className="group-h">Parameters · {pkeys.length}</div>}
      {pkeys.map((p) => {
        const n = ((data.params[p] && data.params[p].new) || []).length + ((data.params[p] && data.params[p].modified) || []).length;
        return (
          <div
            key={p}
            className="ch-file"
            data-chparam={p}
            title="Open parameter file"
            onClick={() => {
              useProject.getState().setLeftTab("params");
              selectScope({ kind: "param", short: p });
            }}
          >
            <span className="dot changed" />
            <span className="nm">{p}.json</span>
            <span className="ct">{n}</span>
          </div>
        );
      })}
    </>
  );
}

function useChangesQuery() {
  return useQuery({ queryKey: keys.diff, queryFn: () => api.diffProject(), staleTime: 10_000 });
}
