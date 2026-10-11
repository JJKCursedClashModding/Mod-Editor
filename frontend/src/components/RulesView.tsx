// Global-rules editor tab.
// Mirrors renderRulesTab()/ruleCard()/actionBlockHtml()/ruleValueWidget()/
// mapValueWidget()/readRuleCard() in renderer/app.js: live DOM semantics
// (Apply always enabled, Test match counter, per-action move/clone tools,
// enum-aware map pairs).
import { useEffect, useState } from "react";
import { api } from "../api/ipc";
import { useRules, useTableSchema } from "../api/queries";
import { useEnumMembers } from "../api/enums";
import { afterRulesMutated } from "../app/flows";
import { parseLooseValue } from "../components/FieldWidget";
import { useProject } from "../stores/project";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import type { Rule, Tab } from "../api/types";

function fsFor(schema: any, field: string): any {
  const top = String(field || "").split(".")[0];
  return ((schema && schema.fields) || {})[top] || { kind: "any" };
}

function condOpsFor(allOps: any[], fs: any): any[] {
  const ops = allOps || [];
  const numeric = fs && fs.kind === "number";
  const keep = numeric ? ["==", "!=", ">", ">=", "<", "<="] : ["==", "!=", "contains", "!contains"];
  const out = ops.filter((o) => keep.includes(o.id));
  return out.length ? out : ops;
}

function strOf(v: any): string {
  if (v === null || v === undefined) return "";
  return typeof v === "object" ? JSON.stringify(v, null, 1) : String(v);
}

function mapPairsOf(value: any): { pairs: Array<{ from: any; to: any }>; def: any } {
  if (Array.isArray(value)) return { pairs: value, def: undefined };
  if (value && typeof value === "object")
    return { pairs: Array.isArray(value.pairs) ? value.pairs : [], def: value.default };
  return { pairs: [], def: undefined };
}

interface ActionDraft {
  field: string;
  op: string;
  scalar: string;
  boolVal: boolean | null;
  pairs: Array<{ from: string; to: string }>;
  mapDef: string;
}

function actionFromRule(a: { field: string; op: string; value: any }): ActionDraft {
  const op = a.op || "set";
  if (op === "map") {
    const { pairs, def } = mapPairsOf(a.value);
    return {
      field: a.field || "",
      op,
      scalar: "",
      boolVal: null,
      pairs: pairs.map((p) => ({ from: strOf(p.from), to: strOf(p.to) })),
      mapDef: def === undefined ? "" : strOf(def),
    };
  }
  if (typeof a.value === "boolean") {
    return { field: a.field || "", op, scalar: "", boolVal: a.value, pairs: [], mapDef: "" };
  }
  return { field: a.field || "", op, scalar: strOf(a.value), boolVal: null, pairs: [], mapDef: "" };
}

function actionToPatch(d: ActionDraft, fs: any): { field: string; op: string; value: any } {
  const field = d.field;
  const op = d.op || "set";
  if (op === "map") {
    const pairs: Array<{ from: any; to: any }> = [];
    for (const p of d.pairs) {
      if (String(p.from).trim() === "" && String(p.to).trim() === "") continue;
      pairs.push({ from: parseLooseValue(p.from, fs), to: parseLooseValue(p.to, fs) });
    }
    const value: any = { pairs };
    if (String(d.mapDef).trim() !== "") value.default = parseLooseValue(d.mapDef, fs);
    return { field, op, value };
  }
  if (fs && fs.kind === "boolean") return { field, op, value: d.boolVal === null ? true : d.boolVal };
  return { field, op, value: parseLooseValue(d.scalar, fs) };
}

function ScalarValueInput({ draft, fs, onChange }: { draft: ActionDraft; fs: any; onChange: (d: ActionDraft) => void }) {
  if (fs.kind === "boolean") {
    const shown = draft.boolVal === null ? "" : String(draft.boolVal);
    return (
      <select value={shown} onChange={(e) => onChange({ ...draft, boolVal: e.target.value === "true" })}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (fs.kind === "number") {
    return (
      <input
        type="number"
        step="any"
        value={draft.scalar}
        onChange={(e) => onChange({ ...draft, scalar: e.target.value })}
        spellCheck={false}
        autoComplete="off"
      />
    );
  }
  if (fs.kind === "enum" && fs.enumName) {
    return <EnumRuleSelect fs={fs} raw={draft.scalar} onPick={(v) => onChange({ ...draft, scalar: v })} />;
  }
  const txt = draft.scalar;
  return txt.length > 80 || txt.includes("\n") ? (
    <textarea rows={3} value={txt} spellCheck={false} onChange={(e) => onChange({ ...draft, scalar: e.target.value })} />
  ) : (
    <input type="text" value={txt} spellCheck={false} autoComplete="off" onChange={(e) => onChange({ ...draft, scalar: e.target.value })} />
  );
}

function EnumRuleSelect({ fs, raw, onPick }: { fs: any; raw: string; onPick: (v: string) => void }) {
  const members = useEnumMembers(fs.enumName);
  if (!members.length) {
    return <input type="text" value={raw} spellCheck={false} autoComplete="off" onChange={(e) => onPick(e.target.value)} />;
  }
  const numeric = /^-?\d+$/.test(raw) && raw !== "";
  const optVal = (m: { name: string; value: number }) => (numeric ? String(m.value) : `${fs.enumName}::${m.name}`);
  const inList = raw !== "" && members.some((m) => optVal(m) === raw);
  return (
    <select value={inList ? raw : ""} data-enum={fs.enumName} onChange={(e) => onPick(e.target.value)}>
      {!inList && <option value="">{raw === "" ? "— pick —" : raw}</option>}
      {members.map((m) => (
        <option key={m.name} value={optVal(m)}>
          {m.name}
          {numeric ? ` (${m.value})` : ""}
        </option>
      ))}
    </select>
  );
}

function MapSideInput({ side, fs, value, onChange }: { side: "from" | "to"; fs: any; value: string; onChange: (v: string) => void }) {
  const members = useEnumMembers(fs?.enumName);
  if (fs?.enumName && members.length) {
    const numeric = /^-?\d+$/.test(value) && value !== "";
    const optVal = (m: { name: string; value: number }) => (numeric ? String(m.value) : `${fs.enumName}::${m.name}`);
    const inList = value !== "" && members.some((m) => optVal(m) === value);
    return (
      <select value={inList ? value : ""} data-enum={fs.enumName} onChange={(e) => onChange(e.target.value)}>
        {!inList && <option value="">{value === "" ? (side === "from" ? "current value" : "new value") : value}</option>}
        {members.map((m) => (
          <option key={m.name} value={optVal(m)}>
            {m.name}
            {numeric ? ` (${m.value})` : ""}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value}
      placeholder={side === "from" ? "current value" : "new value"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function MapEditor({ draft, fs, onChange }: { draft: ActionDraft; fs: any; onChange: (d: ActionDraft) => void }) {
  return (
    <>
      <div className="map-pairs">
        {draft.pairs.map((p, i) => (
          <div className="map-pair" key={i}>
            <MapSideInput
              side="from"
              fs={fs}
              value={p.from}
              onChange={(v) => onChange({ ...draft, pairs: draft.pairs.map((x, j) => (j === i ? { ...x, from: v } : x)) })}
            />
            <span className="arrow">→</span>
            <MapSideInput
              side="to"
              fs={fs}
              value={p.to}
              onChange={(v) => onChange({ ...draft, pairs: draft.pairs.map((x, j) => (j === i ? { ...x, to: v } : x)) })}
            />
            <button className="small danger" onClick={() => onChange({ ...draft, pairs: draft.pairs.filter((_, j) => j !== i) })}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="map-foot">
        <button className="small" onClick={() => onChange({ ...draft, pairs: [...draft.pairs, { from: "", to: "" }] })}>
          + pair
        </button>
        <label style={{ color: "var(--dim)", fontSize: 11 }}>
          Default (unmapped values):{" "}
          <input
            type="text"
            value={draft.mapDef}
            placeholder="leave unchanged"
            style={{ width: 140 }}
            onChange={(e) => onChange({ ...draft, mapDef: e.target.value })}
          />
        </label>
      </div>
      <div style={{ color: "var(--dim)", fontSize: 11, marginTop: 4 }}>
        Maps the field's current value to another. Enum fields offer member dropdowns on both sides.
      </div>
    </>
  );
}

function ActionEditor({ draft, schema, ruleOps, onChange, onDelete, onMove, onAddBelow }: {
  draft: ActionDraft;
  schema: any;
  ruleOps: any[];
  onChange: (d: ActionDraft) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
  onAddBelow: () => void;
}) {
  const fs = fsFor(schema, draft.field);
  const isMap = (draft.op || "set") === "map";

  const setField = (field: string) => {
    // Changing the field clears the value widget (matches app.js).
    onChange({ ...draft, field, scalar: "", boolVal: null, pairs: [], mapDef: "" });
  };
  const setOp = (op: string) => {
    if (op === "map" && draft.op !== "map") onChange({ ...draft, op, scalar: "", boolVal: null, pairs: [], mapDef: "" });
    else if (op !== "map") onChange({ ...draft, op, pairs: [], mapDef: "" });
    else onChange({ ...draft, op });
  };

  return (
    <div className="s-act" data-action>
      <select value={draft.op || "set"} title="Action" onChange={(e) => setOp(e.target.value)}>
        {(ruleOps.length ? ruleOps : [{ id: "set", label: "Set" }]).map((o: any) => (
          <option key={o.id} value={o.id}>
            {o.label || o.id}
          </option>
        ))}
      </select>
      <input
        list="fieldList"
        value={draft.field}
        placeholder="field"
        title="Field"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setField(e.target.value)}
      />
      <span className="s-val">
        {isMap ? (
          <MapEditor draft={draft} fs={fs} onChange={onChange} />
        ) : (
          <ScalarValueInput draft={draft} fs={fs} onChange={onChange} />
        )}
      </span>
      <span className="s-tools">
        <button className="small" title="Move up" onClick={() => onMove("up")}>
          ↑
        </button>
        <button className="small" title="Move down" onClick={() => onMove("down")}>
          ↓
        </button>
        <button className="small" title="Insert action below" onClick={onAddBelow}>
          +
        </button>
        <button className="small danger" title="Delete action" onClick={onDelete}>
          ×
        </button>
      </span>
    </div>
  );
}

function moveIn<T>(arr: T[], i: number, dir: "up" | "down"): T[] {
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function RuleCard({ tab, rule, index, total, schema }: { tab: Tab; rule: Rule; index: number; total: number; schema: any }) {
  const file = tab.file!;
  const toast = useUi((s) => s.toast);
  const condOps = useProject((s) => s.condOps);
  const ruleOps = useProject((s) => s.ruleOps);
  const [saving, setSaving] = useState(false);
  const [matchMsg, setMatchMsg] = useState("");

  const fromRule = (r: Rule) => ({
    name: r.name || "",
    disabled: !!r.disabled,
    cfield: r.cond?.field || "",
    cop: r.cond?.op || "==",
    cvalue:
      r.cond?.value === undefined || r.cond?.value === null
        ? ""
        : typeof r.cond.value === "object"
          ? JSON.stringify(r.cond.value)
          : String(r.cond.value),
    then: (Array.isArray(r.then) ? r.then : []).map(actionFromRule),
    else: (Array.isArray(r.else) ? r.else : []).map(actionFromRule),
  });

  const sig = JSON.stringify(rule);
  const [draft, setDraft] = useState(() => fromRule(rule));
  // Server is truth after every mutation (matches innerHTML re-render).
  useEffect(() => {
    setDraft(fromRule(rule));
    setMatchMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const cops = condOpsFor(condOps, fsFor(schema, draft.cfield));

  const setCfield = (cfield: string) => {
    const list = condOpsFor(condOps, fsFor(schema, cfield));
    setDraft((d) => ({ ...d, cfield, cop: list.some((o) => o.id === d.cop) ? d.cop : list[0]?.id || d.cop }));
  };

  const mutate = async (fn: () => Promise<{ changed?: any; affected: string[] }>, after?: () => void) => {
    try {
      const d = await fn();
      if (d.changed) useProject.getState().setChanged(d.changed);
      after?.();
      await afterRulesMutated(tab, d.affected);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const save = async () => {
    let patch: any;
    try {
      patch = {
        name: draft.name,
        cond: draft.cfield.trim()
          ? { field: draft.cfield.trim(), op: draft.cop, value: parseLooseValue(draft.cvalue, fsFor(schema, draft.cfield)) }
          : null,
        then: draft.then.map((a) => actionToPatch(a, fsFor(schema, a.field))),
        else: draft.else.map((a) => actionToPatch(a, fsFor(schema, a.field))),
        disabled: draft.disabled,
      };
    } catch (e: any) {
      toast(e.message, "error");
      return;
    }
    setSaving(true);
    try {
      await mutate(() => api.rulesUpdate(file, rule.id, patch));
      toast("Rule applied", "success");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    let cond: any = null;
    try {
      cond = draft.cfield.trim()
        ? { field: draft.cfield.trim(), op: draft.cop, value: parseLooseValue(draft.cvalue, fsFor(schema, draft.cfield)) }
        : null;
    } catch (e: any) {
      toast(e.message, "error");
      return;
    }
    try {
      const d = await api.rulesMatchCount(file, cond);
      setMatchMsg(d.error ? `error: ${d.error}` : `matches ${d.match} / ${d.total} rows`);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const stack = (
    which: "then" | "else",
    list: ActionDraft[],
  ) => (
    <div className="s-stack" data-stack={which}>
      {list.length === 0 && <div className="s-empty">no actions — nothing happens here</div>}
      {list.map((a, i) => (
        <ActionEditor
          key={i}
          draft={a}
          schema={schema}
          ruleOps={ruleOps}
          onChange={(na) => setDraft((d) => ({ ...d, [which]: d[which].map((x, j) => (j === i ? na : x)) }))}
          onDelete={() => setDraft((d) => ({ ...d, [which]: d[which].filter((_, j) => j !== i) }))}
          onMove={(dir) => setDraft((d) => ({ ...d, [which]: moveIn(d[which], i, dir) }))}
          onAddBelow={() =>
            setDraft((d) => {
              const next = [...d[which]];
              next.splice(i + 1, 0, { field: "", op: "set", scalar: "", boolVal: null, pairs: [], mapDef: "" });
              return { ...d, [which]: next };
            })
          }
        />
      ))}
      <button
        className="small s-add"
        title="Append action"
        onClick={() =>
          setDraft((d) => ({
            ...d,
            [which]: [...d[which], { field: "", op: "set", scalar: "", boolVal: null, pairs: [], mapDef: "" }],
          }))
        }
      >
        + action
      </button>
    </div>
  );

  return (
    <div className={`rule-card${draft.disabled ? " disabled" : ""}`} data-rule={rule.id}>
      <div className="rule-top">
        <input
          type="checkbox"
          checked={!draft.disabled}
          title="Enabled"
          onChange={(e) => setDraft((d) => ({ ...d, disabled: !e.target.checked }))}
        />
        <input
          className="rname"
          type="text"
          placeholder="Rule name (optional)"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <span style={{ color: "var(--dim)", fontSize: 12 }}>#{index + 1}</span>
        <span style={{ flex: 0 }} />
        <button className="small" disabled={index === 0} onClick={() => mutate(() => api.rulesMove(file, rule.id, "up"))}>
          ↑
        </button>
        <button
          className="small"
          disabled={index === total - 1}
          onClick={() => mutate(() => api.rulesMove(file, rule.id, "down"))}
        >
          ↓
        </button>
        <button className="small danger" onClick={() => mutate(() => api.rulesDelete(file, rule.id))}>
          Delete
        </button>
      </div>
      <div className="s-if">
        <div className="s-ifhead">
          <span className="s-kw">if</span>
          <input
            list="fieldList"
            value={draft.cfield}
            placeholder="field — empty = always"
            title="Test field (empty = always)"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setCfield(e.target.value)}
          />
          <select value={draft.cop} title="Comparison" onChange={(e) => setDraft((d) => ({ ...d, cop: e.target.value }))}>
            {cops.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={draft.cvalue}
            placeholder="value"
            title="Compared to"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setDraft((d) => ({ ...d, cvalue: e.target.value }))}
          />
          <button className="small" onClick={test}>
            Test
          </button>
          <span>{matchMsg}</span>
        </div>
        {stack("then", draft.then)}
        <div className="s-elsehead">
          <span className="s-kw">else</span>
        </div>
        {stack("else", draft.else)}
      </div>
      <div className="rule-foot">
        <button className="small primary" disabled={saving} onClick={save}>
          {saving ? "Applying…" : "Apply"}
        </button>
      </div>
    </div>
  );
}

export default function RulesView({ tab }: { tab: Tab }) {
  const { data, isLoading, error } = useRules(tab.file);
  const toast = useUi((s) => s.toast);
  const { data: schemaData } = useTableSchema(tab.file);
  const schema = (schemaData as any)?.schema || { fields: {} };
  const fields: string[] = schema.fieldOrder || Object.keys(schema.fields || {});

  // Track the shared family for the tab title (mirrors tab.familyInfo).
  useEffect(() => {
    if (data?.family?.key) useTabs.getState().patch(tab.id, { familyKey: data.family.key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.family?.key]);

  if (isLoading)
    return (
      <div className="unified-wrap">
        <div className="empty-note">Loading rules…</div>
      </div>
    );
  if (error)
    return (
      <div className="unified-wrap">
        <div className="empty-note err">{(error as Error).message}</div>
      </div>
    );

  const family = data?.family;
  const members = family?.members || [];
  const short = (m: string) => String(m || "").replace(/\.json$/i, "");

  return (
    <div className="unified-wrap">
      {!!family && members.length >= 2 && (
        <div className="fam-note" title={`Shared across: ${members.join(", ")}`}>
          <span className="fam-title">Shared rules</span>
          <span className="fam-desc">
            <b>{family.key}</b> · {members.length} tables:
          </span>
          {members.slice(0, 5).map((m) => (
            <span key={m} className="fam-chip" title={m}>
              {short(m)}
            </span>
          ))}
          {members.length > 5 && (
            <span className="fam-chip" title={members.slice(5).join(", ")}>
              +{members.length - 5} more
            </span>
          )}
        </div>
      )}
      <div id="ruleCards">
        {(data?.rules || []).map((r, i, arr) => (
          <RuleCard key={r.id} tab={tab} rule={r} index={i} total={arr.length} schema={schema} />
        ))}
      </div>
      <button
        className="small s-add"
        id="btnAddRule"
        style={{ margin: "2px 0 12px" }}
        onClick={async () => {
          try {
            const d = await api.rulesAdd(tab.file!, {});
            if (d.changed) useProject.getState().setChanged(d.changed);
            await afterRulesMutated(tab, d.affected);
          } catch (e: any) {
            toast(e.message, "error");
          }
        }}
      >
        + Add rule
      </button>
      <datalist id="fieldList">
        {fields.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  );
}
