// Expandable row cards for table tabs and param tabs.
// Mirrors cardBodyHtml()/renderFieldBlock()/paramBlocksHtml() in renderer/app.js.
import { useEffect } from "react";
import FieldWidget, { isIdField } from "./FieldWidget";
import { useEnumMembers } from "../api/enums";
import { useDocsField, useParamRow, useRowData } from "../api/queries";
import {
  cloneVanillaParam as cloneVanilla,
  commitParamField,
  commitTableField,
  deleteNewTableRow as delNew,
  deleteParamRow as delParam,
  docsBaseOf,
  docsFamilyOf,
  dupParamRow as dupParam,
  flashField,
  propagateEn as copyEn,
  resetTableField,
  revertTableRow as revertRow,
  saveScalarParam as saveScalar,
  showRefTargets as showRefs,
  showReferencedBy as showReferenced,
} from "../app/flows";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import type { RowSummary, Tab, TableSchema } from "../api/types";

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

export function rowFieldOrderFor(rd: any, sch: TableSchema | null | undefined): string[] {
  if (!rd) return [];
  const order: string[] = [];
  const seen = new Set<string>();
  const push = (k: string) => {
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  };
  if (rd.isParam) {
    if (rd.schema && rd.schema.fieldOrder) rd.schema.fieldOrder.forEach(push);
    if (rd.value && typeof rd.value === "object") Object.keys(rd.value).forEach(push);
    if (rd.vanilla && typeof rd.vanilla === "object") Object.keys(rd.vanilla).forEach(push);
    return order.filter((k) => k !== "(value)");
  }
  if (rd.isNew) {
    if (sch && (sch as any).fieldOrder) (sch as any).fieldOrder.forEach(push);
    if (rd.effective) Object.keys(rd.effective).forEach(push);
    return order;
  }
  if (sch && (sch as any).fieldOrder) {
    for (const f of (sch as any).fieldOrder) {
      if (rd.effective && Object.prototype.hasOwnProperty.call(rd.effective, f)) push(f);
    }
  }
  if (rd.effective) Object.keys(rd.effective).forEach(push);
  if (rd.vanilla) Object.keys(rd.vanilla).forEach(push);
  return order;
}

export function visibleFieldOrder(tab: Tab, rd: any, sch: TableSchema | null | undefined): string[] {
  const all = rowFieldOrderFor(rd, sch);
  if (!tab.visibleFields) return all;
  const set = new Set(tab.visibleFields);
  return all.filter((f) => set.has(f));
}

function hasAnyOverride(rd: any): boolean {
  return !!(rd && rd.overrides && Object.keys(rd.overrides).length > 0);
}

function RowBadges({ r }: { r: RowSummary }) {
  if (!r) return null;
  if (r.status === "new") return <span className="badge new">NEW</span>;
  if (r.status === "edited") {
    return (
      <>
        {r.global && (
          <span className="badge global" title="Changed by global rule">
            G
          </span>
        )}
        {!!r.overrides && (
          <span className="badge ov" title="Per-row override(s)">
            O{r.overrides}
          </span>
        )}
      </>
    );
  }
  return <span className="badge vanilla">VANILLA</span>;
}

// Info-button tooltip: type label, extended with the docs description once
// the probe lands. Mirrors fillInlineDocs() in renderer/app.js.
function useInfoTitle(tab: Tab, field: string, fs: any, typeLabel: string): string {
  const base = docsBaseOf(tab);
  const family = docsFamilyOf(tab);
  const { data } = useDocsField(base, family, field, (fs && fs.enumName) || null);
  const desc = (data?.field && data.field.desc) || "";
  if (desc) return `${typeLabel} — ${desc.length > 300 ? desc.slice(0, 300) + "…" : desc}`;
  return typeLabel;
}

function FieldBlock({ tab, rowId, field, fs, vanilla, eff, prov, fired, isNew, paramCurrent }: {
  tab: Tab;
  rowId: string;
  field: string;
  fs: any;
  vanilla: any;
  eff: any;
  prov: string;
  fired: string[];
  isNew: boolean;
  /** param rows: whole current value object for path commits */
  paramCurrent?: any;
}) {
  const members = useEnumMembers(fs?.enumName);
  const typeLabel = fs?.enumName ? `${fs.kind} · ${fs.enumName}` : fs?.kind || "any";
  const title = useInfoTitle(tab, field, fs, typeLabel);
  const cls = prov === "global" ? "changed-global" : prov === "override" ? "changed-override" : prov === "new" ? "is-new" : "";
  const idField = isIdField(field);

  const onCommit = (v: any) => {
    if (tab.kind === "param") void commitParamField(tab, rowId, field, v, paramCurrent);
    else void commitTableField(tab, rowId, field, v);
  };

  return (
    <div className={`field ${cls}`} data-field={field}>
      <div className="frow">
        <span className={`prov ${prov}`} title={`provenance: ${prov}`} />
        <span className="fname" title={field}>
          {field}
          {fired.length > 0 && (
            <span className="badge global" title={`Global rule(s): ${fired.join(", ")}`}>
              G{fired.length > 1 ? fired.length : ""}
            </span>
          )}
          {prov === "override" && <span className="badge ov">O</span>}
        </span>
        <div className="fwidget">
          <FieldWidget field={field} fs={fs || { kind: "any" }} value={eff} enumMembers={members} onCommit={onCommit} />
        </div>
        <span className="fact">
          <button
            className="icon-btn info-btn"
            title={title}
            onClick={() => useUi.getState().openModal("fieldDocs", { tabId: tab.id, rowId, field })}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <text x="12" y="16.5" textAnchor="middle" fontSize="12" fill="currentColor" stroke="none">
                ?
              </text>
            </svg>
          </button>
          {idField && (
            <button className="icon-btn" title="Jump to referenced row" onClick={() => showRefs(tab, rowId, field)}>
              →
            </button>
          )}
          {prov === "override" && tab.kind === "table" && (
            <button className="icon-btn" title="Reset to global/vanilla value" onClick={() => resetTableField(tab, rowId, field)}>
              ↩
            </button>
          )}
        </span>
      </div>
      {!isNew && prov !== "default" && vanilla !== undefined && <div className="was">vanilla: {shortVal(vanilla)}</div>}
    </div>
  );
}

// Locale suffix of a table file (for the "Copy EN text here" button).
function localeOf(file: string): string | null {
  const m = /_((?:Es_LA)|(?:Zh_Han[st])|De|En|Es|Fr|It|Ja|Ko|Pt)$/.exec(String(file || "").replace(/\.json$/i, ""));
  return m ? m[1] : null;
}

export function TableRowCard({ tab, summary, schema }: { tab: Tab; summary: RowSummary; schema: any }) {
  const open = tab.expanded.includes(summary.id);
  const toggle = useTabs((s) => s.toggleExpanded);
  const { data, isLoading, error } = useRowData(open ? tab.file : null, open ? summary.id : null);

  // Pending jump flash (set by jumpToRow): fire once the data is in.
  useEffect(() => {
    if (open && data && tab.flash && tab.flash.row === summary.id) {
      const f = tab.flash.field;
      useTabs.getState().patch(tab.id, { flash: null });
      // Let the fresh DOM paint before measuring.
      setTimeout(() => flashField(summary.id, f), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, !!data, tab.flash && tab.flash.row, tab.flash && tab.flash.field]);

  return (
    <div className={`row-card${open ? " open" : ""}`} data-card={summary.id}>
      <div
        className="rh"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          toggle(tab.id, summary.id);
        }}
      >
        <span className="chev">{open ? "▾" : "▸"}</span>
        <span className="rid">{summary.id}</span>
        <RowBadges r={summary} />
        <button
          className="icon-btn"
          title="Show rows that reference this row"
          onClick={() => showReferenced(summary.id)}
        >
          🔗
        </button>
      </div>
      {open && (
        <div className="rb">
          {isLoading && <div className="loading">Loading…</div>}
          {error && <div className="err">{(error as Error).message}</div>}
          {data && <TableCardBody tab={tab} rowId={summary.id} rd={data} schema={schema} />}
        </div>
      )}
    </div>
  );
}

function TableCardBody({ tab, rowId, rd, schema }: { tab: Tab; rowId: string; rd: any; schema: any }) {
  if (rd.error) {
    return (
      <>
        <div className="row-title">{rowId}</div>
        <div className="err">Rule error: {rd.error}</div>
      </>
    );
  }
  const acts: React.ReactNode[] = [];
  if (rd.isNew) {
    acts.push(
      <span key="lbl">
        New row{rd.base ? ` (cloned from ${rd.base})` : " (blank)"}
      </span>,
    );
    acts.push(
      <button key="del" className="small danger" onClick={() => delNew(tab, rowId)}>
        Delete row
      </button>,
    );
  } else if (hasAnyOverride(rd)) {
    acts.push(
      <button key="rev" className="small" onClick={() => revertRow(tab, rowId)}>
        Revert row
      </button>,
    );
  }
  if (!rd.isNew && tab.file) {
    const locale = localeOf(tab.file);
    if (locale && locale !== "En") {
      acts.push(
        <button key="en" className="small" title="Copy differing text fields from the English row" onClick={() => copyEn(tab, rowId)}>
          Copy EN text here
        </button>,
      );
    }
  }
  const fields = visibleFieldOrder(tab, rd, schema);
  return (
    <>
      <datalist id="idcomplete" />
      {acts.length > 0 && <div className="row-sub">{acts.reduce<React.ReactNode[]>((acc, a, i) => (i ? [...acc, " · ", a] : [a]), [])}</div>}
      {fields.map((f) => (
        <FieldBlock
          key={f}
          tab={tab}
          rowId={rowId}
          field={f}
          fs={(schema?.fields || {})[f] || { kind: "any" }}
          vanilla={rd.vanilla ? rd.vanilla[f] : undefined}
          eff={rd.effective ? rd.effective[f] : undefined}
          prov={rd.isNew ? "new" : (rd.prov || {})[f] || "default"}
          fired={(rd.fired || {})[f] || []}
          isNew={!!rd.isNew}
        />
      ))}
    </>
  );
}

export function ParamRowCard({ tab, rowId, status }: { tab: Tab; rowId: string; status: "edited" | "vanilla" }) {
  const open = tab.expanded.includes(rowId);
  const toggle = useTabs((s) => s.toggleExpanded);
  const { data, isLoading, error } = useParamRow(open ? tab.short : null, open ? rowId : null);
  void status;

  useEffect(() => {
    if (open && data && tab.flash && tab.flash.row === rowId) {
      const f = tab.flash.field;
      useTabs.getState().patch(tab.id, { flash: null });
      setTimeout(() => flashField(rowId, f), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, !!data, tab.flash && tab.flash.row, tab.flash && tab.flash.field]);

  const summary: RowSummary = {
    id: rowId,
    status: status === "edited" ? "edited" : "vanilla",
    changeCount: 0,
    global: false,
    overrides: 0,
  };

  return (
    <div className={`row-card${open ? " open" : ""}`} data-card={rowId}>
      <div
        className="rh"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          toggle(tab.id, rowId);
        }}
      >
        <span className="chev">{open ? "▾" : "▸"}</span>
        <span className="rid">{rowId}</span>
        <RowBadges r={summary} />
        <button
          className="icon-btn"
          title="Show rows that reference this row"
          onClick={() => showReferenced(rowId)}
        >
          🔗
        </button>
      </div>
      {open && (
        <div className="rb">
          {isLoading && <div className="loading">Loading…</div>}
          {error && <div className="err">{(error as Error).message}</div>}
          {data && <ParamCardBody tab={tab} rowId={rowId} rd={normalizeParam(data)} />}
        </div>
      )}
    </div>
  );
}

function normalizeParam(d: any) {
  return {
    isParam: true,
    value: d.value,
    schema: d.schema,
    vanilla: d.vanilla,
    prov: d.prov || {},
    exists: d.exists,
    isNew: d.isNew,
    vanillaError: d.vanillaError,
  };
}

function ParamCardBody({ tab, rowId, rd }: { tab: Tab; rowId: string; rd: any }) {
  const v = rd.value;
  const sch = rd.schema || { fields: {}, fieldOrder: [] };

  if (!rd.exists) {
    return (
      <>
        <div className="row-title">
          {rowId}{" "}
          <span className="badge" style={{ background: "#1a1e2c", color: "var(--dim)", border: "1px solid var(--border)" }}>
            VANILLA
          </span>
        </div>
        <div className="row-sub">
          vanilla value from cooked uasset ·{" "}
          <button className="small" onClick={() => cloneVanilla(tab, rowId)}>
            Clone as new row…
          </button>
        </div>
        {rd.vanillaError && <div className="err">Vanilla unavailable: {rd.vanillaError}</div>}
        <div className="field">
          <div className="fwidget">
            <textarea rows={10} readOnly spellCheck={false} value={JSON.stringify(rd.vanilla, null, 1)} />
          </div>
        </div>
      </>
    );
  }

  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    const prov = (rd.prov && rd.prov["(value)"]) || (rd.isNew ? "new" : "default");
    return (
      <>
        <div className="row-sub">
          parameters/{tab.short}.json ·{" "}
          <button className="small danger" onClick={() => delParam(tab, rowId)}>
            Delete row
          </button>{" "}
          <button className="small" onClick={() => dupParam(tab, rowId)}>
            Duplicate as new…
          </button>
        </div>
        {rd.vanillaError && <div className="warn">Vanilla unavailable: {rd.vanillaError} (no baseline shown)</div>}
        <div className={`field ${prov === "override" ? "changed-override" : prov === "new" ? "is-new" : ""}`}>
          <div className="frow">
            <span className={`prov ${prov}`} />
            <span className="fname">(value)</span>
            <div className="fwidget">
              <ScalarInput key={`${rowId}:${String(v)}`} initial={String(v)} onSave={(nv) => saveScalar(tab, rowId, nv)} />
            </div>
            <span className="fact">
              <button className="small" onClick={() => saveScalarFromDom(rowId, tab)}>Save</button>
            </span>
          </div>
          {rd.vanilla !== null && rd.vanilla !== undefined && !rd.isNew && (
            <div className="was">vanilla: {shortVal(rd.vanilla)}</div>
          )}
        </div>
      </>
    );
  }

  if (v && typeof v === "object") {
    const order = rowFieldOrderFor(rd, null).filter((k) => !tab.visibleFields || tab.visibleFields.includes(k));
    return (
      <>
        <div className="row-sub">
          parameters/{tab.short}.json ·{" "}
          <button className="small danger" onClick={() => delParam(tab, rowId)}>
            Delete row
          </button>{" "}
          <button className="small" onClick={() => dupParam(tab, rowId)}>
            Duplicate as new…
          </button>
        </div>
        {rd.vanillaError && <div className="warn">Vanilla unavailable: {rd.vanillaError} (no baseline shown)</div>}
        {order
          .filter((f) => !(f === "entries" && v.entries && typeof v.entries === "object"))
          .map((f) => {
            const top = f.split(".")[0];
            const fs = (sch.fields || {})[top] || (sch.fields || {})[f] || { kind: "any" };
            const vanilla = rd.vanilla && typeof rd.vanilla === "object" ? rd.vanilla[top] : undefined;
            return (
              <FieldBlock
                key={f}
                tab={tab}
                rowId={rowId}
                field={f}
                fs={fs}
                vanilla={vanilla}
                eff={v[f]}
                prov={rd.isNew ? "new" : (rd.prov || {})[f] || "default"}
                fired={[]}
                isNew={false}
                paramCurrent={v}
              />
            );
          })}
        {v.entries && typeof v.entries === "object" && (
          <>
            <div className="row-sub" style={{ marginTop: 6 }}>
              entries (per image entry offsets)
            </div>
            {Object.keys(v.entries)
              .sort()
              .map((ek) => {
                const p = rd.isNew ? "new" : (rd.prov || {})[`entries.${ek}`] || (rd.prov && rd.prov.entries) || "default";
                const vanilla = rd.vanilla && rd.vanilla.entries ? rd.vanilla.entries[ek] : undefined;
                return (
                  <FieldBlock
                    key={`entries.${ek}`}
                    tab={tab}
                    rowId={rowId}
                    field={`entries.${ek}`}
                    fs={{ kind: "struct" }}
                    vanilla={vanilla}
                    eff={v.entries[ek]}
                    prov={p === "override" || p === "new" ? p : "default"}
                    fired={[]}
                    isNew={false}
                    paramCurrent={v}
                  />
                );
              })}
          </>
        )}
      </>
    );
  }

  return <div className="empty-note">Empty row</div>;
}

function ScalarInput({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  return (
    <input
      type="text"
      data-pscalar
      defaultValue={initial}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      onBlur={(e) => {
        if (e.target.value !== initial) onSave(e.target.value);
      }}
    />
  );
}

function saveScalarFromDom(rowId: string, tab: Tab) {
  try {
    const card = document.querySelector(`#centerBody [data-card="${CSS.escape(rowId)}"]`);
    const input = card?.querySelector("[data-pscalar]") as HTMLInputElement | null;
    if (input) void saveScalar(tab, rowId, input.value);
  } catch {
    /* ignore */
  }
}
