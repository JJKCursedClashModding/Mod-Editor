// Left sidebar: Explorer (tables/parameters), Search, Changes.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "../api/queries";
import { api as ipc } from "../api/ipc";
import { useProject } from "../stores/project";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";

function usePrefixIndex() {
  const charMode = useProject((s) => s.charMode);
  return useQuery({
    queryKey: ["prefixIndex"],
    queryFn: () => ipc.prefixIndex(),
    enabled: !!charMode,
    staleTime: 5 * 60_000,
  });
}

export function Explorer() {
  const tables = useProject((s) => s.tables);
  const changed = useProject((s) => s.changed);
  const leftTab = useProject((s) => s.leftTab);
  const setLeftTab = useProject((s) => s.setLeftTab);
  const charMode = useProject((s) => s.charMode);
  const paramAssets = useProject((s) => s.paramAssets);
  const project = useProject((s) => s.project);
  const openTable = useTabs((s) => s.openTable);
  const openParam = useTabs((s) => s.openParam);
  const active = useTabs((s) => s.active());
  const [q, setQ] = useState("");
  const [charPicker, setCharPicker] = useState(false);
  const { data: prefixData } = usePrefixIndex();
  const setCharMode = useProject((s) => s.setCharMode);
  const toast = useUi((s) => s.toast);

  const groups = useMemo(() => {
    const ql = q.toLowerCase();
    const g: Record<string, typeof tables> = {};
    for (const t of tables) {
      if (ql && !t.file.toLowerCase().includes(ql)) continue;
      if (charMode && prefixData) {
        const n = prefixData.index?.[t.file]?.[charMode] || 0;
        if (!n) continue;
      }
      (g[t.groupLabel] = g[t.groupLabel] || []).push(t);
    }
    return Object.keys(g)
      .sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
      .map((k) => [k, g[k]] as const);
  }, [tables, q, charMode, prefixData]);

  const paramRows = (short: string) => {
    const p = project?.parameters?.[short];
    return p ? Object.keys(p.rows || {}).filter((k) => k.charAt(0) !== "$").length : 0;
  };

  return (
    <div className="side-view">
      <div className="side-title">Explorer</div>
      <div className="pane-tabs">
        <button className={leftTab === "tables" ? "active" : ""} onClick={() => setLeftTab("tables")}>Tables</button>
        <button className={leftTab === "params" ? "active" : ""} onClick={() => setLeftTab("params")}>Parameters</button>
      </div>
      <div id="sideSearchRow">
        <input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        <button
          id="btnCharFilter"
          className={charMode ? "on" : ""}
          title={charMode ? `Character filter: ${charMode} (click to change)` : "Character filter: all"}
          onClick={() => setCharPicker((v) => !v)}
        >
          ☰
        </button>
      </div>
      {charPicker && (
        <CharPicker
          onPick={(v) => {
            setCharPicker(false);
            void setCharMode(v).catch((e: any) => toast(e.message, "error"));
          }}
        />
      )}
      <div id="scopeList">
        {charMode && <div className="group-h">Filtered to {charMode}</div>}
        {leftTab === "params" ? (
          paramAssets
            .filter((a) => !q || a.shortName.toLowerCase().includes(q.toLowerCase()))
            .map((a) => {
              const n = paramRows(a.shortName);
              const isActive = active?.kind === "param" && active.short === a.shortName;
              return (
                <div
                  key={a.shortName}
                  className={`scope-item${isActive ? " active" : ""}`}
                  onClick={() => openParam(a.shortName, charMode)}
                >
                  <span className={`dot ${n ? "changed" : "none"}`} />
                  <span className="nm" title={`${a.assetName} (${a.shortName}.json)`}>{a.shortName}</span>
                  <span className="ct">{n}</span>
                </div>
              );
            })
        ) : groups.length === 0 ? (
          <div className="empty-note">No tables found.</div>
        ) : (
          groups.map(([g, list]) => (
            <div key={g}>
              <div className="group-h">{g}</div>
              {list.map((t) => {
                const c = changed[t.file];
                const isActive = active?.kind === "table" && active.file === t.file;
                return (
                  <div
                    key={t.file}
                    className={`scope-item${isActive ? " active" : ""}`}
                    onClick={() => openTable(t.file, charMode)}
                  >
                    <span className={`dot ${c ? "changed" : "none"}`} />
                    <span className="nm" title={t.file}>{t.file.replace(/\.json$/i, "")}</span>
                    <span className="ct">{c ? c.rules + c.overrides + c.newRows : t.rows}</span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CharPicker({ onPick }: { onPick: (v: string) => void }) {
  const chars = useProject((s) => s.chars);
  const charMode = useProject((s) => s.charMode);
  const [q, setQ] = useState("");
  const opts = useMemo(() => {
    const ql = q.toLowerCase();
    return Object.keys(chars)
      .sort()
      .filter((p) => !ql || p.toLowerCase().includes(ql) || (chars[p] || "").toLowerCase().includes(ql))
      .slice(0, 200);
  }, [chars, q]);
  return (
    <div id="charPicker" style={{ position: "absolute", zIndex: 50 }}>
      <input placeholder="Filter characters…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      <div className="cp-list">
        <div className={`cp-item${!charMode ? " sel" : ""}`} onClick={() => onPick("")}>All characters</div>
        {opts.map((p) => (
          <div key={p} className={`cp-item${charMode === p ? " sel" : ""}`} onClick={() => onPick(p)}>
            <span>{p} — {chars[p]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchView() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const toast = useUi((s) => s.toast);
  const { data, isFetching } = useQuery({
    queryKey: submitted ? keys.search(submitted) : ["globalSearch", "none"],
    queryFn: () => ipc.globalSearch(submitted, 300),
    enabled: !!submitted,
  });
  const openTable = useTabs((s) => s.openTable);

  return (
    <div className="side-view">
      <div className="side-title">Search</div>
      <div id="sideSearchRow2">
        <input
          placeholder="Row ID or value text…"
          value={q}
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) setSubmitted(q.trim());
          }}
        />
      </div>
      <div className="side-btns">
        <button className="small primary" disabled={isFetching} onClick={() => q.trim() && setSubmitted(q.trim())}>
          {isFetching ? "Searching…" : "Search all tables"}
        </button>
      </div>
      <div id="gSearchResults">
        {(data?.results || []).map((r, i) => (
          <div key={i} className="diff-row">
            <div className="dh">
              <span style={{ flex: 1 }}>{r.file} :: {r.rowId}</span>
              <button className="small" onClick={() => { try { openTable(r.file, ""); } catch (e: any) { toast(String(e?.message || e), "error"); } }}>Open</button>
            </div>
            {r.snippet && <div className="df">{r.snippet}</div>}
          </div>
        ))}
        {submitted && !isFetching && (data?.results || []).length === 0 && (
          <div className="empty-note">No matches.</div>
        )}
      </div>
    </div>
  );
}

export function ChangesView() {
  const { data, isFetching, refetch } = useQuery({ queryKey: keys.diff, queryFn: () => ipc.diffProject() });
  const setPanelOpen = useUi((s) => s.setPanelOpen);
  const openTable = useTabs((s) => s.openTable);
  const toast = useUi((s) => s.toast);

  const runValidate = async () => {
    try {
      await ipc.validateProject();
      setPanelOpen(true);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const files = data ? Object.keys(data.tables) : [];
  const params = data ? Object.keys(data.params) : [];

  return (
    <div className="side-view">
      <div className="side-title">Changes</div>
      <div className="side-btns">
        <button className="small" onClick={() => refetch()}>Refresh</button>
        <button className="small" onClick={runValidate}>Validate</button>
      </div>
      <div id="changesList">
        {isFetching && <div className="empty-note">Loading…</div>}
        {!isFetching && files.length === 0 && params.length === 0 && (
          <div className="empty-note">No changes yet.</div>
        )}
        {files.map((f) => (
          <div key={f} className="diff-row">
            <div className="dh">
              <span style={{ flex: 1 }}>{f} · {Object.keys(data!.tables[f]).length} rows</span>
              <button className="small" onClick={() => openTable(f, "")}>Open</button>
            </div>
          </div>
        ))}
        {params.map((p) => (
          <div key={p} className="diff-row">
            <div className="dh">
              <span style={{ flex: 1 }}>parameters/{p} · {data!.params[p].modified.length + data!.params[p].new.length} rows</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
