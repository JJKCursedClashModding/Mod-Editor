// Center column: tab strip + active tab body (table / param / rules)
// + filter panel + FAB actions.
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/ipc";
import { keys, useParamRows, useTableRows, useTableSchema } from "../api/queries";
import { useProject } from "../stores/project";
import { useTabs, tabTitle } from "../stores/tabs";
import type { Tab } from "../api/types";
import { useUi } from "../stores/ui";
import { ParamRowCard, TableRowCard } from "./RowCard";
import RulesView from "./RulesView";

export function TabStrip() {
  const tabs = useTabs((s) => s.tabs);
  const activeTabId = useTabs((s) => s.activeTabId);
  const activate = useTabs((s) => s.activate);
  const close = useTabs((s) => s.close);
  const closeOthers = useTabs((s) => s.closeOthers);
  const changed = useProject((s) => s.changed);
  const project = useProject((s) => s.project);

  const dirty = (t: (typeof tabs)[number]) => {
    if (t.kind === "table" && t.file) return !!changed[t.file];
    if (t.kind === "param" && t.short)
      return Object.keys(project?.parameters?.[t.short]?.rows || {}).filter((k) => k.charAt(0) !== "$").length > 0;
    if (t.kind === "rules" && t.file) return !!changed[t.file];
    return false;
  };

  return (
    <div id="tabStrip" role="tablist" aria-label="Open tables">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab${t.id === activeTabId ? " active" : ""}${dirty(t) ? " dirty" : ""}`}
          role="tab"
          title={tabTitle(t)}
          onClick={() => activate(t.id)}
          onMouseDown={(e) => {
            if (e.button === 1) close(t.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            closeOthers(t.id);
          }}
        >
          {dirty(t) && <span className="dot-dirty" title="Edited" />}
          {t.kind === "rules" ? <span className="tk rules">RULES</span> : t.kind === "param" ? <span className="tk">PARAM</span> : null}
          <span className="tt">{tabTitle(t)}</span>
          {t.charPrefix && <span className="char-tag">{t.charPrefix}</span>}
          <button
            className="tx"
            title="Close tab"
            onClick={(e) => {
              e.stopPropagation();
              close(t.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function statusOptions(kind: Tab["kind"]): Array<[string, string]> {
  if (kind === "param")
    return [["all", "All rows"], ["edited", "In mod"], ["vanilla", "Vanilla only"]];
  return [["all", "All rows"], ["edited", "Edited"], ["new", "New"], ["vanilla", "Vanilla (unchanged)"]];
}

function FilterPanel({ tab }: { tab: Tab }) {
  const patch = useTabs((s) => s.patch);
  const { data: schemaData } = useTableSchema(tab.kind === "table" ? tab.file : null);
  const order = useMemo(() => {
    if (tab.kind === "table") return schemaData?.schema.fieldOrder || [];
    return [];
  }, [tab.kind, schemaData]);

  const sel = new Set(tab.visibleFields || order);
  return (
    <div className="fp-sect">
      <h4>Filters</h4>
      <label>Status</label>
      <select value={tab.statusFilter} onChange={(e) => patch(tab.id, { statusFilter: e.target.value })}>
        {statusOptions(tab.kind).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <label>Filter by name</label>
      <input
        type="text"
        placeholder="Filter by name..."
        value={tab.search}
        autoComplete="off"
        onChange={(e) => patch(tab.id, { search: e.target.value })}
      />
    </div>
  );
}

function TableBody({ tab }: { tab: Tab }) {
  const patch = useTabs((s) => s.patch);
  const { data, isLoading, error } = useTableRows(tab.file, tab.charPrefix, "");
  const [showFilters, setShowFilters] = useState(false);
  const toast = useUi((s) => s.toast);
  const qc = useQueryClient();
  const openRules = useTabs((s) => s.openRules);

  const list = useMemo(() => {
    let rows = data?.rows || [];
    const q = tab.search.toLowerCase();
    if (q) rows = rows.filter((r) => r.id.toLowerCase().includes(q));
    const f = tab.statusFilter;
    if (f === "edited") rows = rows.filter((r) => r.status === "edited");
    else if (f === "new") rows = rows.filter((r) => r.status === "new");
    else if (f === "vanilla") rows = rows.filter((r) => r.status !== "edited" && r.status !== "new");
    return rows;
  }, [data, tab.search, tab.statusFilter]);

  const newRow = async () => {
    const id = prompt("New row ID:");
    if (!id) return;
    try {
      const d = await api.rowCreate(tab.file!, id.trim());
      useProject.getState().setChanged(d.changed);
      qc.invalidateQueries({ queryKey: ["tableRows", tab.file!] });
      qc.invalidateQueries({ queryKey: keys.diff });
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  if (isLoading) return <div className="unified-wrap"><div className="empty-note">Loading…</div></div>;
  if (error) return <div className="unified-wrap"><div className="empty-note err">{(error as Error).message}</div></div>;

  return (
    <>
      <div id="centerMain">
        <div className="filter-row">
          <input
            placeholder="Filter by name..."
            value={tab.search}
            autoComplete="off"
            onChange={(e) => patch(tab.id, { search: e.target.value })}
            style={{ maxWidth: 260 }}
          />
          <select value={tab.statusFilter} onChange={(e) => patch(tab.id, { statusFilter: e.target.value })}>
            {statusOptions(tab.kind).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="small" onClick={() => openRules(tab.file!)}>Rules</button>
          <span style={{ flex: 1 }} />
          <span style={{ color: "var(--dim)", fontSize: 12 }}>{list.length} / {data?.total ?? 0} rows</span>
        </div>
        <div className="unified-wrap">
          {list.length === 0 && <div className="empty-note">No rows match. Adjust the filters.</div>}
          {list.map((r) => <TableRowCard key={r.id} tab={tab} summary={r} />)}
        </div>
        <div id="fabStack">
          <button className="fab-mini" title="New row" onClick={newRow}>+</button>
          <button className="fab-mini" title="Filters & fields" onClick={() => setShowFilters((v) => !v)}>☰</button>
        </div>
      </div>
      {showFilters && <aside id="filterPanel"><FilterPanel tab={tab} /></aside>}
    </>
  );
}

function ParamBody({ tab }: { tab: Tab }) {
  const patch = useTabs((s) => s.patch);
  const { data, isLoading, error } = useParamRows(tab.short, tab.search, tab.charPrefix);
  const toast = useUi((s) => s.toast);
  const qc = useQueryClient();

  const rows = useMemo(() => {
    const edited = (data?.rows || []).map((id) => ({ id, status: "edited" as const }));
    let vanilla = (data?.vanillaIds || []).map((id) => ({ id, status: "vanilla" as const }));
    if (tab.statusFilter === "edited") vanilla = [];
    else if (tab.statusFilter === "vanilla") return vanilla;
    return [...edited, ...vanilla];
  }, [data, tab.statusFilter]);

  if (isLoading) return <div className="unified-wrap"><div className="empty-note">Loading…</div></div>;
  if (error) return <div className="unified-wrap"><div className="empty-note err">{(error as Error).message}</div></div>;

  return (
    <div id="centerMain">
      <div className="filter-row">
        <input
          placeholder="Filter by name..."
          value={tab.search}
          autoComplete="off"
          onChange={(e) => patch(tab.id, { search: e.target.value })}
          style={{ maxWidth: 260 }}
        />
        <select value={tab.statusFilter} onChange={(e) => patch(tab.id, { statusFilter: e.target.value })}>
          {statusOptions(tab.kind).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button
          className="small"
          onClick={async () => {
            const id = prompt("New param row ID:");
            if (!id) return;
            try {
              await api.paramCreate(tab.short!, id.trim());
              qc.invalidateQueries({ queryKey: ["paramRows", tab.short!] });
            } catch (e: any) {
              toast(e.message, "error");
            }
          }}
        >
          + New row
        </button>
      </div>
      {data?.vanillaError && <div className="warn">Vanilla unavailable: {data.vanillaError}</div>}
      <div className="unified-wrap">
        {rows.length === 0 && <div className="empty-note">No rows match.</div>}
        {rows.map((r) => <ParamRowCard key={r.id} tab={tab} rowId={r.id} status={r.status} />)}
      </div>
    </div>
  );
}

export function CenterView() {
  const active = useTabs((s) => s.active());
  const tabs = useTabs((s) => s.tabs);

  if (!active) {
    return (
      <div id="emptyTabs">
        <div className="empty-ide">
          <div className="empty-logo">JJK</div>
          <h1>JJK Mod Editor</h1>
          <p>Pick a table or parameter file on the left to start editing.</p>
        </div>
      </div>
    );
  }

  void tabs;
  return (
    <div id="tabContent">
      {active.kind === "table" && <TableBody key={active.id} tab={active} />}
      {active.kind === "param" && <ParamBody key={active.id} tab={active} />}
      {active.kind === "rules" && <div id="centerMain"><RulesView key={active.id} tab={active} /></div>}
    </div>
  );
}
