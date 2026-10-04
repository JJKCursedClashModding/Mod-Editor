// Expandable row card shared by table tabs and param tabs.
import { useQueryClient } from "@tanstack/react-query";
import FieldWidget from "./FieldWidget";
import { api } from "../api/ipc";
import { useEnumMembers } from "../api/enums";
import { keys, useParamRow, useParamSet, useRowData, useSetField } from "../api/queries";
import { useProject } from "../stores/project";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import type { RowSummary, Tab } from "../api/types";

function shortVal(v: any, max = 160): string {
  let s: string;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (s === undefined) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function fieldOrderOf(data: any, schemaFields: any): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const push = (k: string) => {
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  };
  if (data?.isParam) {
    if (data.schema?.fieldOrder) data.schema.fieldOrder.forEach(push);
    if (data.value && typeof data.value === "object") Object.keys(data.value).forEach(push);
    if (data.vanilla && typeof data.vanilla === "object") Object.keys(data.vanilla).forEach(push);
    return order.filter((k) => k !== "(value)");
  }
  if (data?.isNew) {
    if (schemaFields) Object.keys(schemaFields).forEach(push);
    if (data.effective) Object.keys(data.effective).forEach(push);
    return order;
  }
  if (data?.effective) Object.keys(data.effective).forEach(push);
  if (data?.vanilla) Object.keys(data.vanilla).forEach(push);
  return order;
}

function Badges({ r }: { r: RowSummary }) {
  if (r.status === "new") return <span className="badge new">NEW</span>;
  if (r.status === "edited")
    return (
      <>
        {r.global && <span className="badge global" title="Changed by global rule">G</span>}
        {!!r.overrides && <span className="badge ov" title="Per-row override(s)">O{r.overrides}</span>}
      </>
    );
  return <span className="badge vanilla">VANILLA</span>;
}

function TableField({ field, fs, vanilla, eff, prov, fired, isNew, onCommit, onReset }: {
  field: string;
  fs: any;
  vanilla: any;
  eff: any;
  prov: string;
  fired: string[];
  isNew: boolean;
  onCommit: (value: any) => void;
  onReset: () => void;
}) {
  const members = useEnumMembers(fs?.enumName);
  return (
    <div className={`field ${prov === "override" ? "changed-override" : prov === "global" ? "changed-global" : prov === "new" ? "is-new" : ""}`}>
      <div className="frow">
        <span className={`prov ${prov}`} title={`provenance: ${prov}`} />
        <span className="fname" title={field}>
          {field}
          {fired.length > 0 && <span className="badge global" title={`Global rule(s): ${fired.join(", ")}`}>G</span>}
          {prov === "override" && <span className="badge ov">O</span>}
        </span>
        <div className="fwidget">
          <FieldWidget field={field} fs={fs} value={eff} enumMembers={members.length ? members : undefined} onCommit={onCommit} />
        </div>
        <span className="fact">
          {prov === "override" && (
            <button className="icon-btn" title="Reset to global/vanilla value" onClick={onReset}>↩</button>
          )}
        </span>
      </div>
      {!isNew && prov !== "default" && vanilla !== undefined && (
        <div className="was">vanilla: {shortVal(vanilla)}</div>
      )}
    </div>
  );
}

export function TableRowCard({ tab, summary }: { tab: Tab; summary: RowSummary }) {
  const open = tab.expanded.includes(summary.id);
  const toggle = useTabs((s) => s.toggleExpanded);
  const toast = useUi((s) => s.toast);
  const { data, isLoading, error } = useRowData(open ? tab.file : null, open ? summary.id : null);
  const setField = useSetField(tab.file!);
  const qc = useQueryClient();

  const commit = (field: string, value: any) => {
    setField.mutate(
      { rowId: summary.id, field, value },
      { onError: (e: any) => toast(e.message, "error"), onSuccess: (d: any) => d?.warning && toast(d.warning, "warn") },
    );
  };

  const resetField = async (field: string) => {
    try {
      const d = await api.rowResetField(tab.file!, summary.id, field);
      useProject.getState().setChanged(d.changed);
      qc.invalidateQueries({ queryKey: keys.row(tab.file!, summary.id) });
      qc.invalidateQueries({ queryKey: ["tableRows", tab.file!] });
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const revertRow = async () => {
    try {
      const d = await api.rowRevert(tab.file!, summary.id);
      useProject.getState().setChanged(d.changed);
      qc.invalidateQueries({ queryKey: keys.row(tab.file!, summary.id) });
      qc.invalidateQueries({ queryKey: ["tableRows", tab.file!] });
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <div className={`row-card${open ? " open" : ""}`}>
      <div className="rh" onClick={() => toggle(tab.id, summary.id)}>
        <span className="chev">{open ? "▾" : "▸"}</span>
        <span className="rid">{summary.id}</span>
        <Badges r={summary} />
        <button
          className="icon-btn"
          title="Show rows that reference this row"
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const d = await api.refsReferencedBy(summary.id);
              const n = (d.refs || []).length;
              toast(n ? `${n} reference(s) — see Search view` : "Nothing references this row", n ? "success" : "warn");
            } catch (err: any) {
              toast(err.message, "error");
            }
          }}
        >
          🔗
        </button>
      </div>
      {open && (
        <div className="rb">
          {isLoading && <div className="loading">Loading…</div>}
          {error && <div className="err">{(error as Error).message}</div>}
          {data && (
            <>
              {data.isNew ? (
                <div className="row-sub">
                  <span>New row{data.base ? ` (cloned from ${data.base})` : " (blank)"}</span>
                </div>
              ) : data.overrides && Object.keys(data.overrides).length > 0 ? (
                <div className="row-sub">
                  <button className="small" onClick={revertRow}>Revert row</button>
                </div>
              ) : null}
              {fieldOrderOf(data, null)
                .filter((f) => !tab.visibleFields || tab.visibleFields.includes(f))
                .map((f) => (
                  <TableField
                    key={f}
                    field={f}
                    fs={data.schema?.fields?.[f] || { kind: "any" }}
                    vanilla={data.vanilla?.[f]}
                    eff={data.effective?.[f]}
                    prov={data.isNew ? "new" : data.prov?.[f] || "default"}
                    fired={data.fired?.[f] || []}
                    isNew={!!data.isNew}
                    onCommit={(v) => commit(f, v)}
                    onReset={() => resetField(f)}
                  />
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ParamRowCard({ tab, rowId, status }: { tab: Tab; rowId: string; status: "edited" | "vanilla" }) {
  const open = tab.expanded.includes(rowId);
  const toggle = useTabs((s) => s.toggleExpanded);
  const toast = useUi((s) => s.toast);
  const qc = useQueryClient();
  const { data, isLoading, error } = useParamRow(open ? tab.short : null, open ? rowId : null);
  const paramSet = useParamSet(tab.short!);

  const saveScalar = (raw: string) => {
    let v: any = raw;
    try {
      if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) v = JSON.parse(raw);
      else if (/^-?\d+(\.\d+)?$/.test(raw.trim())) v = Number(raw);
    } catch {
      /* keep string */
    }
    paramSet.mutate({ rowId, value: v }, { onError: (e: any) => toast(e.message, "error") });
  };

  const commitField = (field: string, value: any) => {
    if (!data || typeof data.value !== "object" || data.value === null) return;
    const next = JSON.parse(JSON.stringify(data.value));
    const segs = field.split(".");
    let cur = next;
    for (let i = 0; i < segs.length - 1; i++) {
      if (cur[segs[i]] === null || typeof cur[segs[i]] !== "object") cur[segs[i]] = {};
      cur = cur[segs[i]];
    }
    cur[segs[segs.length - 1]] = value;
    paramSet.mutate({ rowId, value: next }, { onError: (e: any) => toast(e.message, "error") });
  };

  const del = async () => {
    try {
      await api.paramDelete(tab.short!, rowId);
      qc.invalidateQueries({ queryKey: ["paramRows", tab.short!] });
      qc.invalidateQueries({ queryKey: keys.diff });
      toggle(tab.id, rowId);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <div className={`row-card${open ? " open" : ""}`}>
      <div className="rh" onClick={() => toggle(tab.id, rowId)}>
        <span className="chev">{open ? "▾" : "▸"}</span>
        <span className="rid">{rowId}</span>
        {status === "edited" ? <span className="badge new">IN MOD</span> : <span className="badge vanilla">VANILLA</span>}
      </div>
      {open && (
        <div className="rb">
          {isLoading && <div className="loading">Loading…</div>}
          {error && <div className="err">{(error as Error).message}</div>}
          {data && (
            <>
              {!data.exists ? (
                <>
                  <div className="row-sub">
                    vanilla value from cooked uasset ·{" "}
                    <button
                      className="small"
                      onClick={async () => {
                        const newId = prompt(`New row ID (clone of ${rowId}):`, `${rowId}_mod`);
                        if (!newId) return;
                        try {
                          await api.paramCreate(tab.short!, newId, undefined, data.vanilla);
                          qc.invalidateQueries({ queryKey: ["paramRows", tab.short!] });
                        } catch (e: any) {
                          toast(e.message, "error");
                        }
                      }}
                    >
                      Clone as new row…
                    </button>
                  </div>
                  <div className="field">
                    <div className="fwidget">
                      <textarea rows={10} readOnly spellCheck={false} value={JSON.stringify(data.vanilla, null, 1)} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="row-sub">
                    parameters/{tab.short}.json · <button className="small danger" onClick={del}>Delete row</button>
                  </div>
                  {data.vanillaError && <div className="warn">Vanilla unavailable: {String(data.vanillaError)}</div>}
                  {typeof data.value !== "object" || data.value === null ? (
                    <div className="field">
                      <div className="frow">
                        <span className="fname">(value)</span>
                        <div className="fwidget">
                          <input type="text" defaultValue={String(data.value)} key={String(data.value)} id={`ps-${rowId}`} />
                        </div>
                        <button
                          className="small"
                          onClick={() => {
                            const el = document.getElementById(`ps-${rowId}`) as HTMLInputElement;
                            if (el) saveScalar(el.value);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    Object.keys(data.value)
                      .filter((f) => !tab.visibleFields || tab.visibleFields.includes(f))
                      .map((f) => (
                        <div key={f} className="field">
                          <div className="frow">
                            <span className={`prov ${data.isNew ? "new" : data.prov?.[f] || "default"}`} />
                            <span className="fname">{f}</span>
                            <div className="fwidget">
                              <FieldWidget field={f} fs={{ kind: "any" }} value={data.value[f]} onCommit={(v) => commitField(f, v)} />
                            </div>
                          </div>
                          {data.vanilla?.[f] !== undefined && !data.isNew && (
                            <div className="was">vanilla: {shortVal(data.vanilla[f])}</div>
                          )}
                        </div>
                      ))
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
