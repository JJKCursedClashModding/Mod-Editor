// Global-rules editor tab.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/ipc";
import { useRules, useRulesMutations, useTableSchema } from "../api/queries";
import { useEnumMembers } from "../api/enums";
import { useProject } from "../stores/project";
import { useUi } from "../stores/ui";
import type { Rule, Tab } from "../api/types";

function parseVal(text: string): any {
  const s = text.trim();
  if (s === "") return null;
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      return JSON.parse(s);
    } catch {
      return text;
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === "true") return true;
  if (s === "false") return false;
  return text;
}

function fsFor(schema: any, field: string): any {
  const top = String(field || "").split(".")[0];
  return ((schema && schema.fields) || {})[top] || { kind: "any" };
}

// Enum-aware value input: member dropdown when the field is an enum with
// known members (baked snapshot or IPC probe), free text otherwise.
function EnumValueInput({ fs, value, onChange }: { fs: any; value: any; onChange: (v: any) => void }) {
  const members = useEnumMembers(fs?.enumName);
  const txt = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (!members.length || typeof value === "object") {
    return (
      <input value={txt} placeholder="value" spellCheck={false} autoComplete="off"
        onChange={(e) => onChange(parseVal(e.target.value))} />
    );
  }
  const numeric = typeof value === "number";
  const optVal = (m: { name: string; value: number }) => (numeric ? String(m.value) : `${fs.enumName}::${m.name}`);
  const inList = members.some((m) => optVal(m) === txt);
  return (
    <select value={inList ? txt : ""} onChange={(e) => onChange(e.target.value === "" ? null : numeric ? Number(e.target.value) : e.target.value)}>
      {!inList && <option value="">{txt === "" ? "— pick —" : `custom: ${txt}`}</option>}
      {members.map((m) => (
        <option key={m.name} value={optVal(m)}>{m.name}{numeric ? ` (${m.value})` : ""}</option>
      ))}
    </select>
  );
}

function ActionEditor({ a, fs, onChange, onDelete }: {
  a: { field: string; op: string; value: any };
  fs: any;
  onChange: (a: any) => void;
  onDelete: () => void;
}) {
  const ruleOps = useProject((s) => s.ruleOps);
  const valText = a.value === null || a.value === undefined ? "" : typeof a.value === "object" ? JSON.stringify(a.value) : String(a.value);
  const isMap = (a.op || "set") === "map";
  return (
    <div className="s-act">
      <select value={a.op || "set"} onChange={(e) => onChange({ ...a, op: e.target.value })}>
        {(ruleOps.length ? ruleOps : [{ id: "set", label: "Set" }]).map((o: any) => (
          <option key={o.id} value={o.id}>{o.label || o.id}</option>
        ))}
      </select>
      <input list="fieldList" value={a.field || ""} placeholder="field" spellCheck={false} autoComplete="off"
        onChange={(e) => onChange({ ...a, field: e.target.value })} />
      <span className="s-val">
        {isMap ? (
          <textarea rows={2} value={valText} placeholder='{"pairs": [{from, to}], "default": …}' spellCheck={false}
            onChange={(e) => onChange({ ...a, value: parseVal(e.target.value) })} />
        ) : (
          <EnumValueInput fs={fs} value={a.value} onChange={(v) => onChange({ ...a, value: v })} />
        )}
      </span>
      <button className="small danger" onClick={onDelete}>×</button>
    </div>
  );
}

function RuleCard({ tab, rule, index, total, schema }: { tab: Tab; rule: Rule; index: number; total: number; schema: any }) {
  const file = tab.file!;
  const muts = useRulesMutations(file);
  const toast = useUi((s) => s.toast);
  const condOps = useProject((s) => s.condOps);
  const [draft, setDraft] = useState({
    name: rule.name || "",
    disabled: !!rule.disabled,
    cfield: rule.cond?.field || "",
    cop: rule.cond?.op || "==",
    cvalue: rule.cond?.value === undefined || rule.cond?.value === null ? "" : typeof rule.cond.value === "object" ? JSON.stringify(rule.cond.value) : String(rule.cond.value),
    then: rule.then || [],
    else: rule.else || [],
    dirty: false,
  });

  const save = () => {
    const patch = {
      name: draft.name,
      disabled: draft.disabled,
      cond: draft.cfield.trim() ? { field: draft.cfield.trim(), op: draft.cop, value: parseVal(draft.cvalue) } : null,
      then: draft.then.filter((a: any) => a.field),
      else: draft.else.filter((a: any) => a.field),
    };
    muts.update.mutate({ id: rule.id, patch }, {
      onSuccess: () => setDraft((d) => ({ ...d, dirty: false })),
      onError: (e: any) => toast(e.message, "error"),
    });
  };

  return (
    <div className={`rule-card${draft.disabled ? " disabled" : ""}`}>
      <div className="rule-top">
        <input type="checkbox" checked={!draft.disabled} title="Enabled"
          onChange={(e) => setDraft((d) => ({ ...d, disabled: !e.target.checked, dirty: true }))} />
        <input className="rname" type="text" placeholder="Rule name (optional)" value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, dirty: true }))} />
        <span style={{ color: "var(--dim)", fontSize: 12 }}>#{index + 1}</span>
        <button className="small" disabled={index === 0} onClick={() => muts.move.mutate({ id: rule.id, dir: "up" })}>↑</button>
        <button className="small" disabled={index === total - 1} onClick={() => muts.move.mutate({ id: rule.id, dir: "down" })}>↓</button>
        <button className="small danger" onClick={() => muts.remove.mutate(rule.id)}>Delete</button>
      </div>
      <div className="s-if">
        <div className="s-ifhead">
          <span className="s-kw">if</span>
          <input list="fieldList" value={draft.cfield} placeholder="field — empty = always" spellCheck={false} autoComplete="off"
            onChange={(e) => setDraft((d) => ({ ...d, cfield: e.target.value, dirty: true }))} />
          <select value={draft.cop} onChange={(e) => setDraft((d) => ({ ...d, cop: e.target.value, dirty: true }))}>
            {(condOps.length ? condOps : [{ id: "==", label: "==" }]).map((o: any) => (
              <option key={o.id} value={o.id}>{o.label || o.id}</option>
            ))}
          </select>
          <input value={draft.cvalue} placeholder="value" spellCheck={false} autoComplete="off"
            onChange={(e) => setDraft((d) => ({ ...d, cvalue: e.target.value, dirty: true }))} />
        </div>
        <div className="s-stack">
          {draft.then.map((a: any, i: number) => (
            <ActionEditor key={i} a={a} fs={fsFor(schema, a.field)}
              onChange={(na) => setDraft((d) => ({ ...d, then: d.then.map((x: any, j: number) => (j === i ? na : x)), dirty: true }))}
              onDelete={() => setDraft((d) => ({ ...d, then: d.then.filter((_: any, j: number) => j !== i), dirty: true }))} />
          ))}
          <button className="small s-add" onClick={() => setDraft((d) => ({ ...d, then: [...d.then, { field: "", op: "set", value: null }], dirty: true }))}>+ action</button>
        </div>
        <div className="s-elsehead"><span className="s-kw">else</span></div>
        <div className="s-stack">
          {draft.else.map((a: any, i: number) => (
            <ActionEditor key={i} a={a} fs={fsFor(schema, a.field)}
              onChange={(na) => setDraft((d) => ({ ...d, else: d.else.map((x: any, j: number) => (j === i ? na : x)), dirty: true }))}
              onDelete={() => setDraft((d) => ({ ...d, else: d.else.filter((_: any, j: number) => j !== i), dirty: true }))} />
          ))}
          <button className="small s-add" onClick={() => setDraft((d) => ({ ...d, else: [...d.else, { field: "", op: "set", value: null }], dirty: true }))}>+ action</button>
        </div>
      </div>
      <div className="rule-foot">
        <button className="small primary" disabled={!draft.dirty || muts.update.isPending} onClick={save}>
          {muts.update.isPending ? "Applying…" : "Apply"}
        </button>
      </div>
    </div>
  );
}

export default function RulesView({ tab }: { tab: Tab }) {
  const { data, isLoading, error } = useRules(tab.file);
  const muts = useRulesMutations(tab.file!);
  const toast = useUi((s) => s.toast);
  const { data: schemaData } = useRulesSchemaFields(tab.file);
  const fields = schemaData || [];
  const { data: fullSchema } = useTableSchema(tab.file);

  if (isLoading) return <div className="unified-wrap"><div className="empty-note">Loading rules…</div></div>;
  if (error) return <div className="unified-wrap"><div className="empty-note err">{(error as Error).message}</div></div>;

  return (
    <div className="unified-wrap">
      {data?.family && data.family.members.length > 1 && (
        <div className="fam-note">
          <span className="fam-title">Shared rules</span>
          <span className="fam-desc"><b>{data.family.key}</b> · {data.family.members.length} tables</span>
        </div>
      )}
      <div id="ruleCards">
        {(data?.rules || []).map((r, i, arr) => (
          <RuleCard key={r.id} tab={tab} rule={r} index={i} total={arr.length} schema={fullSchema?.schema} />
        ))}
      </div>
      <button
        className="small s-add"
        style={{ margin: "2px 0 12px" }}
        onClick={() => muts.add.mutate({ name: "New rule" }, { onError: (e: any) => toast(e.message, "error") })}
      >
        + Add rule
      </button>
      <datalist id="fieldList">{fields.map((f) => <option key={f} value={f} />)}</datalist>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
function useRulesSchemaFields(file: string | null) {
  return useQuery({
    queryKey: ["schemaFields", file],
    queryFn: async () => {
      if (!file) return [];
      const d = await api.tableSchema(file);
      return d.schema.fieldOrder || Object.keys(d.schema.fields || {});
    },
    enabled: !!file,
    staleTime: 5 * 60_000,
  });
}
