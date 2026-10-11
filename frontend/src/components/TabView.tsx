// Center column: tab strip + scope header + unified rows + filter panel +
// FAB actions. Mirrors renderTabStrip()/renderScopeHeader()/
// renderUnifiedRows()/renderFilterPanel() in renderer/app.js.
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/ipc";
import { useParamRows, useTableRows, useTableSchema, useParamRow } from "../api/queries";
import { charLabelOf, useProject } from "../stores/project";
import { useTabs, tabTitle, tabTooltip } from "../stores/tabs";
import type { Tab } from "../api/types";
import { useUi } from "../stores/ui";
import { doCloneRow, doNewRow, openOriginalJson, openProjectJson, projectParamRows, showSearch } from "../app/flows";
import { ScopeMenu } from "./Explorer";
import { ParamRowCard, TableRowCard } from "./RowCard";
import RulesView from "./RulesView";

export function TabStrip() {
  const tabs = useTabs((s) => s.tabs);
  const activeTabId = useTabs((s) => s.activeTabId);
  const changed = useProject((s) => s.changed);
  const project = useProject((s) => s.project);
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: Array<{ label: string; run: () => void }> } | null>(null);

  const dirty = (t: Tab) => {
    if ((t.kind === "table" || t.kind === "rules") && t.file) return !!changed[t.file];
    if (t.kind === "param" && t.short) {
      const rows = project?.parameters?.[t.short]?.rows || {};
      return Object.keys(rows).filter((k) => k.charAt(0) !== "$").length > 0;
    }
    return false;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Middle-click closes a tab. preventDefault stops Chromium autoscroll.
    const onMouse = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        const tb = (e.target as HTMLElement).closest("[data-tab]");
        if (tb) useTabs.getState().close((tb as HTMLElement).dataset.tab!);
      }
    };
    // Vertical wheel scrolls an overflowing strip horizontally.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth > el.clientWidth + 1) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("mousedown", onMouse);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("mousedown", onMouse);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const tabMenuItems = (t: Tab): Array<{ label: string; run: () => void }> => {
    if ((t.kind === "table" || t.kind === "rules") && t.file) {
      const file = t.file;
      return [
        { label: "Open original JSON", run: () => void openOriginalJson(file) },
        ...(changed[file] ? [{ label: "Open project JSON", run: () => void openProjectJson() }] : []),
      ];
    }
    if (t.kind === "param" && t.short) {
      // Parameters have no vanilla JSON file (values come from cooked
      // uassets), so only the project file can be opened — and only when
      // this file actually has project rows.
      return projectParamRows(t.short).length > 0
        ? [{ label: "Open project JSON", run: () => void openProjectJson() }]
        : [];
    }
    return [];
  };

  return (
    <div
      id="tabStrip"
      ref={ref}
      role="tablist"
      aria-label="Open tables"
      onContextMenu={(e) => {
        const tb = (e.target as HTMLElement).closest("[data-tab]");
        if (!tb) return;
        const t = useTabs.getState().tabs.find((x) => x.id === (tb as HTMLElement).dataset.tab);
        if (!t) return;
        const items = tabMenuItems(t);
        if (!items.length) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, items });
      }}
    >
      {tabs.map((t) => {
        const isDirty = dirty(t);
        return (
          <div
            key={t.id}
            className={`tab${t.id === activeTabId ? " active" : ""}${isDirty ? " dirty" : ""}`}
            role="tab"
            data-tab={t.id}
            title={tabTooltip(t)}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("[data-closetab]")) return;
              useTabs.getState().activate(t.id);
            }}
          >
            {isDirty && <span className="dot-dirty" title="Edited" />}
            {t.kind === "rules" ? (
              <span className="tk rules">RULES</span>
            ) : t.kind === "param" ? (
              <span className="tk">PARAM</span>
            ) : null}
            <span className="tt">{tabTitle(t)}</span>
            {t.charPrefix && <span className="char-tag">{t.charPrefix}</span>}
            <button
              className="tx"
              data-closetab={t.id}
              title="Close tab"
              onClick={() => useTabs.getState().close(t.id)}
            >
              ×
            </button>
          </div>
        );
      })}
      {menu && <ScopeMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

function statusOptions(kind: Tab["kind"]): Array<[string, string]> {
  if (kind === "param")
    return [
      ["all", "All rows"],
      ["edited", "In mod"],
      ["vanilla", "Vanilla only"],
    ];
  return [
    ["all", "All rows"],
    ["edited", "Edited"],
    ["new", "New"],
    ["vanilla", "Vanilla (unchanged)"],
  ];
}

function fieldOrderForPanel(schemaOrder: string[], paramOrder: string[]): string[] {
  return schemaOrder.length ? schemaOrder : paramOrder;
}

function FilterPanel({ tab }: { tab: Tab }) {
  const show = useUi((s) => s.showFilterPanel);
  const [draft, setDraft] = useState(tab.search);
  const { data: schemaData } = useTableSchema(tab.kind === "table" ? tab.file : null);
  const { data: firstRow } = useParamRow(
    tab.kind === "param" ? tab.short : null,
    tab.kind === "param" ? tab.expanded[0] ?? null : null,
  );
  const schemaOrder = tab.kind === "table" ? schemaData?.schema.fieldOrder || [] : [];
  const paramOrder = tab.kind === "param" && (firstRow as any)?.schema?.fieldOrder ? (firstRow as any).schema.fieldOrder : [];
  const order = fieldOrderForPanel(schemaOrder, paramOrder);
  const sel = new Set(tab.visibleFields || order);
  const shownCount = tab.visibleFields ? tab.visibleFields.length : order.length;

  // Draft is per-tab (component is keyed by tab id, like app.js innerHTML).

  // Debounced server-side name filter (250ms like app.js).
  useEffect(() => {
    if (draft === tab.search) return;
    const t = setTimeout(() => useTabs.getState().patch(tab.id, { search: draft }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  if (tab.kind === "rules") return null;

  const applyFields = (checked: string[]) => {
    useTabs.getState().patch(tab.id, { visibleFields: checked.length === order.length ? null : checked });
  };

  return (
    <aside id="filterPanel" className={show ? "" : "hidden"}>
      <div className="fp-sect">
        <h4>Filters</h4>
        <label>Status</label>
        <select value={tab.statusFilter} onChange={(e) => useTabs.getState().patch(tab.id, { statusFilter: e.target.value })}>
          {statusOptions(tab.kind).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label>Filter by name</label>
        <input type="text" placeholder="Filter by name..." value={draft} autoComplete="off" onChange={(e) => setDraft(e.target.value)} />
      </div>
      <div className="fp-sect">
        <h4>
          Fields <span id="fpCount">{shownCount} / {order.length}</span>
        </h4>
        <div className="fp-btns">
          <button
            className="small"
            onClick={() => {
              document.querySelectorAll<HTMLInputElement>("#filterPanel [data-fpfield]").forEach((el) => (el.checked = true));
              applyFields([...order]);
            }}
          >
            Select all
          </button>
          <button
            className="small"
            onClick={() => {
              document.querySelectorAll<HTMLInputElement>("#filterPanel [data-fpfield]").forEach((el) => (el.checked = false));
              applyFields([]);
            }}
          >
            Unselect all
          </button>
        </div>
        {order.length ? (
          <div className="field-checks fp-checks">
            {order.map((f) => (
              <label key={f}>
                <input
                  type="checkbox"
                  data-fpfield={f}
                  defaultChecked={sel.has(f)}
                  onChange={() => {
                    const checked = Array.from(
                      document.querySelectorAll<HTMLInputElement>("#filterPanel [data-fpfield]:checked"),
                    ).map((el) => el.dataset.fpfield!);
                    applyFields(checked);
                  }}
                />
                {f}
              </label>
            ))}
          </div>
        ) : (
          <div className="empty-note" style={{ padding: 12 }}>
            Expand a row to load the field list.
          </div>
        )}
      </div>
    </aside>
  );
}

function FabStack({ tab, orderLen }: { tab: Tab; orderLen: number }) {
  const showPanel = useUi((s) => s.showFilterPanel);
  const { data: firstParamRow } = useParamRow(
    tab.kind === "param" ? tab.short : null,
    tab.kind === "param" ? tab.expanded[0] ?? null : null,
  );
  if (tab.kind === "rules") return null;
  const order = tab.kind === "param" ? ((firstParamRow as any)?.schema?.fieldOrder?.length || 0) : orderLen;
  const filtersActive = (tab.statusFilter && tab.statusFilter !== "all") || !!tab.search;
  const fieldsActive = !!tab.visibleFields && order > 0 && tab.visibleFields.length < order;
  const glow = filtersActive || fieldsActive;
  return (
    <div id="fabStack">
      <button id="fabNewRow" className="fab-mini" title="New row" onClick={() => doNewRow()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button id="fabCloneRow" className="fab-mini" title="New row from existing row" onClick={() => doCloneRow()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </button>
      <button
        id="fabFilters"
        className={`fab-mini${glow ? " glow" : ""}`}
        title="Filters & fields"
        onClick={() => toggleFilterPanel(!showPanel)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
        </svg>
      </button>
    </div>
  );
}

function toggleFilterPanel(v: boolean) {
  useUi.getState().setFilterPanel(v);
}

function ScopeHeader({ tab }: { tab: Tab }) {
  const { data: schemaData } = useTableSchema(tab.kind === "table" ? tab.file : null);
  const paramAssets = useProject((s) => s.paramAssets);
  if (tab.kind === "rules") return null;
  let desc = "";
  if (tab.kind === "param") {
    const a = paramAssets.find((x) => x.shortName === tab.short);
    desc = (a && (a as any).desc) || "";
  } else {
    desc = (schemaData as any)?.docs?.tableDesc || "";
  }
  if (!desc.trim()) return null;
  return (
    <div id="scopeHeader">
      <div className="desc">{desc}</div>
    </div>
  );
}

function TableBody({ tab }: { tab: Tab }) {
  const { data, isLoading, error } = useTableRows(tab.file, tab.charPrefix, tab.search);
  const { data: schemaData } = useTableSchema(tab.file);
  const schema = (schemaData as any)?.schema || null;

  const list = useMemo(() => {
    let rows = data?.rows || [];
    const f = tab.statusFilter || "all";
    if (f === "edited") rows = rows.filter((r) => r.status === "edited");
    else if (f === "new") rows = rows.filter((r) => r.status === "new");
    else if (f === "vanilla") rows = rows.filter((r) => r.status !== "edited" && r.status !== "new");
    return rows;
  }, [data, tab.statusFilter]);

  // A lone row opens itself (guarded so deliberate collapses stick).
  useEffect(() => {
    if (list.length !== 1) {
      if (tab.autoId) useTabs.getState().patch(tab.id, { autoId: null });
      return;
    }
    const id = list[0].id;
    if (!tab.expanded.includes(id) && tab.autoId !== id) {
      useTabs.getState().patch(tab.id, { autoId: id });
      useTabs.getState().setExpanded(tab.id, id, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.map((r) => r.id).join(","), tab.expanded.join(",")]);

  if (isLoading) {
    return (
      <div id="centerMain">
        <div id="centerBody">
          <div className="unified-wrap">
            <div className="empty-note">Loading…</div>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div id="centerMain">
        <div id="centerBody">
          <div className="unified-wrap">
            <div className="empty-note err">{(error as Error).message}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="centerMain">
      <ScopeHeader tab={tab} />
      <div id="centerBody">
        <div className="unified-wrap">
          {list.length === 0 && <div className="empty-note">No rows match. Adjust the filters.</div>}
          {list.map((r) => (
            <TableRowCard key={r.id} tab={tab} summary={r} schema={schema} />
          ))}
        </div>
      </div>
      <FabStack tab={tab} orderLen={schema?.fieldOrder?.length || 0} />
    </div>
  );
}

function ParamBody({ tab }: { tab: Tab }) {
  const { data, isLoading, error } = useParamRows(tab.short, tab.search, tab.charPrefix);
  const toast = useUi((s) => s.toast);

  const rows = useMemo(() => {
    const edited = (data?.rows || []).map((id) => ({ id, status: "edited" as const }));
    let vanilla = (data?.vanillaIds || []).map((id) => ({ id, status: "vanilla" as const }));
    if (tab.statusFilter === "edited") vanilla = [];
    else if (tab.statusFilter === "vanilla") return vanilla;
    return [...edited, ...vanilla];
  }, [data, tab.statusFilter]);

  useEffect(() => {
    if (rows.length !== 1) {
      if (tab.autoId) useTabs.getState().patch(tab.id, { autoId: null });
      return;
    }
    const id = rows[0].id;
    if (!tab.expanded.includes(id) && tab.autoId !== id) {
      useTabs.getState().patch(tab.id, { autoId: id });
      useTabs.getState().setExpanded(tab.id, id, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.id).join(","), tab.expanded.join(",")]);

  useEffect(() => {
    if (data?.vanillaError && !tab.search) toast(`Vanilla params unavailable: ${data.vanillaError}`, "warn");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(data as any)?.vanillaError]);

  if (isLoading) {
    return (
      <div id="centerMain">
        <div id="centerBody">
          <div className="unified-wrap">
            <div className="empty-note">Loading…</div>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div id="centerMain">
        <div id="centerBody">
          <div className="unified-wrap">
            <div className="empty-note err">{(error as Error).message}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="centerMain">
      <ScopeHeader tab={tab} />
      <div id="centerBody">
        <div className="unified-wrap">
          {rows.length === 0 && <div className="empty-note">No rows match. Adjust the filters.</div>}
          {rows.map((r) => (
            <ParamRowCard key={r.id} tab={tab} rowId={r.id} status={r.status} />
          ))}
        </div>
      </div>
      <FabStack tab={tab} orderLen={0} />
    </div>
  );
}

// Id_ autocomplete: debounced refs:complete into the card's datalist.
function useIdAutocomplete(tab: Tab | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldRef = useRef<string | null>(null);
  useEffect(() => {
    const root = document.getElementById("tabContent");
    if (!root) return;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (!el || !(el as any).dataset || !(el as any).dataset.idfield) return;
      const t = useTabs.getState().active();
      if (!t || t.kind !== "table") return;
      const f = (el as any).dataset.f as string;
      fieldRef.current = `${t.id}:${f}`;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (fieldRef.current !== `${t.id}:${f}`) return;
        try {
          const d = await api.refsComplete(f, ((el as HTMLInputElement).value || "").slice(0, 24));
          if (fieldRef.current !== `${t.id}:${f}`) return;
          const card = (el as HTMLElement).closest("[data-card]");
          const dl = (card ? card.querySelector("datalist") : document.getElementById("idcomplete")) as HTMLDataListElement | null;
          if (dl) dl.innerHTML = (d.suggestions || []).map((s) => `<option value="${s.value}">${s.source}</option>`).join("");
        } catch {
          /* autocomplete best-effort */
        }
      }, 150);
    };
    root.addEventListener("focusin", onFocus as any);
    return () => {
      root.removeEventListener("focusin", onFocus as any);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tab?.id]);
}

export function CenterView() {
  const active = useTabs((s) => s.active());
  useIdAutocomplete(active);

  if (!active) {
    return (
      <>
        <div id="tabContent" style={{ display: "none" }} />
        <div id="emptyTabs">
          <div className="empty-ide">
            <h1>JJK Mod Editor</h1>
            <p>Pick a table or parameter file on the left to start editing.</p>
            <div className="empty-actions">
              <button id="btnEmptyOpen" onClick={() => useUi.getState().paletteOpen("files")}>
                Quick open… <kbd>Ctrl+P</kbd>
              </button>
              <button id="btnEmptySearch" onClick={() => showSearch()}>
                Global search… <kbd>Ctrl+F</kbd>
              </button>
              <button id="btnEmptyProject" onClick={() => useUi.getState().openModal("openProject")}>
                Open project… <kbd>Ctrl+O</kbd>
              </button>
            </div>
            <div className="empty-hints">
              Palette <kbd>Ctrl+Shift+P</kbd> · Sidebar <kbd>Ctrl+B</kbd> · Problems <kbd>Ctrl+J</kbd>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div id="tabContent">
      {active.kind === "table" && <TableBody key={active.id} tab={active} />}
      {active.kind === "param" && <ParamBody key={active.id} tab={active} />}
      {active.kind === "rules" && (
        <div id="centerMain">
          <div id="centerBody">
            <RulesView key={active.id} tab={active} />
          </div>
        </div>
      )}
      <FilterPanel key={active.id} tab={active} />
    </div>
  );
}
