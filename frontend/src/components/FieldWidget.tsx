// Field editors — one widget per schema kind.
// Mirrors renderWidget()/arrayListWidget()/readWidgetValue() in renderer/app.js.
//
// Commit contract (matches the vanilla tabContent change/blur delegation):
// selects + checkboxes commit on change; text/number/textarea commit on blur
// (Enter blurs single-line inputs). Validation failures toast and abort.
import { useRef, useState } from "react";
import type { FieldSchema } from "../api/types";
import { useUi } from "../stores/ui";

export function isIdField(field: string): boolean {
  return /^Id_/.test(field) && field !== "ID";
}

export function parseLooseValue(text: string, fs: FieldSchema): any {
  const s = String(text ?? "").trim();
  if (s === "") return null;
  if (fs.kind === "number") {
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error(`Not a number: ${s}`);
    return n;
  }
  if (fs.kind === "boolean") {
    if (s === "true") return true;
    if (s === "false") return false;
    throw new Error(`Not true/false: ${s}`);
  }
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      return JSON.parse(s);
    } catch (e: any) {
      throw new Error(`Bad JSON: ${e.message}`);
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(s) && fs.kind !== "string") return Number(s);
  if (/^(true|false)$/.test(s) && fs.kind !== "string") return s === "true";
  return s;
}

function blurOnEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") (e.target as HTMLElement).blur();
}

// ---------- struct editors (Vector XYZ / Rotator / color / generic flat objects) ----------
// Schema structs come from types/*.ts with member kinds; unknown shapes fall back
// to value inference. Anything nested stays on the raw-JSON path.
function isPlainObject(v: any): boolean {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function isScalarLeaf(v: any): boolean {
  return v === null || v === undefined || typeof v === "number" || typeof v === "string" || typeof v === "boolean";
}
function isFlatStructObject(v: any): boolean {
  return isPlainObject(v) && Object.keys(v).every((k) => isScalarLeaf(v[k]));
}

interface StructMember {
  name: string;
  kind: string;
}

function structKeys(fs: FieldSchema, value: any): StructMember[] {
  const out: StructMember[] = [];
  const seen = new Set<string>();
  const schemaFields = (fs as any)?.structFields;
  if (Array.isArray(schemaFields)) {
    for (const m of schemaFields) {
      if (m && typeof m.name === "string" && !seen.has(m.name)) {
        seen.add(m.name);
        out.push({ name: m.name, kind: m.kind || "any" });
      }
    }
  }
  if (isPlainObject(value)) {
    for (const k of Object.keys(value)) {
      if (seen.has(k)) continue;
      seen.add(k);
      const v = value[k];
      out.push({
        name: k,
        kind: typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : typeof v === "string" ? "string" : "any",
      });
    }
  }
  return out;
}

function cssFromHex(hex: string): string | null {
  const h = String(hex ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h.toLowerCase()}`;
  return null;
}

function StructEditor({ field, fs, value, onCommit, bare }: {
  field: string;
  fs: FieldSchema;
  value: any;
  onCommit: (v: any) => void;
  /** nested in a struct-array row: no raw-JSON toggle of its own */
  bare?: boolean;
}) {
  const [raw, setRaw] = useState(false);
  const rawRef = useRef<HTMLTextAreaElement | null>(null);
  const keys = structKeys(fs, value);
  const cur = isPlainObject(value) ? value : {};
  const toast = (msg: string) => useUi.getState().toast(msg, "error");

  if (raw) {
    const txt = value === undefined ? "" : JSON.stringify(value, null, 1);
    // Toggling back auto-applies valid JSON; invalid JSON stays put with a toast.
    const applyRawAndBack = () => {
      const t = (rawRef.current ? rawRef.current.value : txt).trim();
      if (t === txt.trim()) {
        setRaw(false);
        return;
      }
      if (!t) {
        onCommit(null);
        setRaw(false);
        return;
      }
      try {
        const parsed = JSON.parse(t);
        if (parsed !== null && !isPlainObject(parsed)) {
          toast(`${field}: expected a JSON object`);
          return;
        }
        onCommit(parsed);
        setRaw(false);
      } catch (err: any) {
        toast(`${field}: invalid JSON (${err.message})`);
      }
    };
    return (
      <div className="struct-raw">
        <textarea
          rows={4}
          spellCheck={false}
          defaultValue={txt}
          key={txt}
          ref={rawRef}
          onBlur={(e) => {
            const t = e.target.value.trim();
            if (!t) return onCommit(null);
            if (t === txt.trim()) return;
            try {
              onCommit(JSON.parse(t));
            } catch (err: any) {
              toast(`${field}: invalid JSON (${err.message})`);
            }
          }}
        />
        {!bare && (
          <button className="small linklike" title="Apply JSON and back to per-field inputs" onClick={applyRawAndBack}>
            form
          </button>
        )}
      </div>
    );
  }

  const commitSub = (name: string, kind: string, text: string, checked?: boolean) => {
    if (kind === "boolean") {
      if (!!cur[name] !== !!checked) onCommit({ ...cur, [name]: !!checked });
      return;
    }
    if (kind === "number") {
      const t = String(text ?? "").trim();
      if (t === "") {
        if (cur[name] !== undefined) toast(`${field}.${name}: empty value is not a number`);
        return;
      }
      const n = Number(t);
      if (!Number.isFinite(n)) {
        toast(`${field}.${name}: "${text}" is not a number`);
        return;
      }
      if (cur[name] !== n) onCommit({ ...cur, [name]: n });
      return;
    }
    if (kind === "any" && (isPlainObject(cur[name]) || Array.isArray(cur[name]))) {
      // Nested value inside a supposedly flat struct: keep it valid JSON.
      const t = String(text ?? "").trim();
      const prevTxt = JSON.stringify(cur[name]);
      if (t === prevTxt.trim()) return;
      try {
        onCommit({ ...cur, [name]: t === "" ? null : JSON.parse(t) });
      } catch (e: any) {
        toast(`${field}.${name}: invalid JSON (${e.message})`);
      }
      return;
    }
    if (String(text ?? "") !== String(cur[name] ?? "")) onCommit({ ...cur, [name]: String(text ?? "") });
  };

  const subText = (name: string) => {
    const sub = cur[name];
    if (sub !== null && typeof sub === "object") {
      try {
        return JSON.stringify(sub);
      } catch {
        return String(sub);
      }
    }
    return sub === undefined || sub === null ? "" : String(sub);
  };

  return (
    <div className="struct-wrap">
      <div className="struct-grid">
        {keys.map((m) => {
          const sub = cur[m.name];
          const subTxt = subText(m.name);
          if (m.kind === "boolean") {
            return (
              <label key={m.name} className="struct-cell struct-bool" title={`${field}.${m.name}`}>
                <span className="struct-key">{m.name}</span>
                <input
                  type="checkbox"
                  checked={!!sub}
                  onChange={(e) => commitSub(m.name, m.kind, "", e.target.checked)}
                />
              </label>
            );
          }
          if (m.kind === "number") {
            return (
              <label key={m.name} className="struct-cell" title={`${field}.${m.name}`}>
                <span className="struct-key">{m.name}</span>
                <input
                  type="number"
                  step="any"
                  defaultValue={subTxt}
                  key={`${m.name}:${subTxt}`}
                  onBlur={(e) => commitSub(m.name, m.kind, e.target.value)}
                  onKeyDown={blurOnEnter}
                />
              </label>
            );
          }
          if (m.name === "Hex") {
            const css = typeof sub === "string" ? cssFromHex(sub) : null;
            return (
              <label key={m.name} className="struct-cell struct-hex" title={`${field}.${m.name}`}>
                <span className="struct-key">{m.name}</span>
                <input
                  type="text"
                  defaultValue={subTxt}
                  key={`${m.name}:${subTxt}`}
                  spellCheck={false}
                  placeholder="RRGGBB"
                  onBlur={(e) => commitSub(m.name, "string", e.target.value.toUpperCase())}
                  onKeyDown={blurOnEnter}
                />
                <input
                  type="color"
                  value={css || "#000000"}
                  title={css ? `#${String(sub).replace(/^#/, "").toUpperCase()}` : "Pick a color"}
                  onChange={(e) => onCommit({ ...cur, [m.name]: e.target.value.replace(/^#/, "").toUpperCase() })}
                />
              </label>
            );
          }
          return (
            <label key={m.name} className="struct-cell" title={`${field}.${m.name}`}>
              <span className="struct-key">{m.name}</span>
              <input
                type="text"
                defaultValue={subTxt}
                key={`${m.name}:${subTxt}`}
                spellCheck={false}
                onBlur={(e) => commitSub(m.name, m.kind, e.target.value)}
                onKeyDown={blurOnEnter}
              />
            </label>
          );
        })}
      </div>
      {!bare && (
        <button className="small linklike struct-toggle" title="Edit raw JSON" onClick={() => setRaw(true)}>
          {"{}"}
        </button>
      )}
    </div>
  );
}

function blankStruct(keys: StructMember[]): any {
  const o: any = {};
  for (const m of keys) {
    o[m.name] = m.kind === "number" ? 0 : m.kind === "boolean" ? false : m.name === "Hex" ? "FFFFFF" : "";
  }
  return o;
}

function StructArrayEditor({ field, fs, value, onCommit }: {
  field: string;
  fs: FieldSchema;
  value: any;
  onCommit: (v: any[]) => void;
}) {
  const [raw, setRaw] = useState(false);
  const rawRef = useRef<HTMLTextAreaElement | null>(null);
  const arr = Array.isArray(value) ? value : [];
  // Union of schema keys + every element's keys for the blank-row template.
  const keys = (() => {
    const seen = new Set<string>();
    const out: StructMember[] = [];
    for (const src of [arr.find(isPlainObject), ...arr]) {
      for (const m of structKeys(fs, src)) {
        if (seen.has(m.name)) continue;
        seen.add(m.name);
        out.push(m);
      }
    }
    return out;
  })();
  const toast = (msg: string) => useUi.getState().toast(msg, "error");

  if (raw) {
    const txt = value === undefined ? "" : JSON.stringify(value, null, 1);
    // Toggling back auto-applies valid JSON; invalid JSON stays put with a toast.
    const applyRawAndBack = () => {
      const t = (rawRef.current ? rawRef.current.value : txt).trim();
      if (t === txt.trim()) {
        setRaw(false);
        return;
      }
      if (!t) {
        onCommit([]);
        setRaw(false);
        return;
      }
      try {
        const parsed = JSON.parse(t);
        if (!Array.isArray(parsed)) {
          toast(`${field}: expected a JSON array`);
          return;
        }
        onCommit(parsed);
        setRaw(false);
      } catch (err: any) {
        toast(`${field}: invalid JSON (${err.message})`);
      }
    };
    return (
      <div className="struct-raw">
        <textarea
          rows={4}
          spellCheck={false}
          defaultValue={txt}
          key={txt}
          ref={rawRef}
          onBlur={(e) => {
            const t = e.target.value.trim();
            if (!t) return onCommit([]);
            if (t === txt.trim()) return;
            try {
              const parsed = JSON.parse(t);
              if (!Array.isArray(parsed)) throw new Error("expected a JSON array");
              onCommit(parsed);
            } catch (err: any) {
              toast(`${field}: invalid JSON (${err.message})`);
            }
          }}
        />
        <button className="small linklike" title="Apply JSON and back to per-row inputs" onClick={applyRawAndBack}>
          form
        </button>
      </div>
    );
  }

  return (
    <div className="struct-list">
      {arr.map((el: any, i: number) => (
        <div className="struct-row" key={i}>
          <span className="struct-idx" title={`Element ${i}`}>
            {i}
          </span>
          {isFlatStructObject(el) || el === null || el === undefined ? (
            <StructEditor
              field={`${field}[${i}]`}
              fs={fs}
              value={el}
              bare
              onCommit={(nv) => {
                const next = [...arr];
                next[i] = nv;
                onCommit(next);
              }}
            />
          ) : (
            <span className="struct-nonscalar" title="Non-scalar element — edit as raw JSON with the {} toggle">
              {JSON.stringify(el)}
            </span>
          )}
          <button
            className="small danger"
            title="Remove"
            onClick={() => onCommit(arr.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <div className="struct-list-foot">
        <button className="small" onClick={() => onCommit([...arr, keys.length ? blankStruct(keys) : {}])}>
          + add
        </button>
        <button className="small linklike struct-toggle" title="Edit raw JSON" onClick={() => setRaw(true)}>
          {"{}"}
        </button>
      </div>
    </div>
  );
}

interface Props {
  field: string;
  fs: FieldSchema;
  value: any;
  enumMembers?: Array<{ name: string; value: number }>;
  onCommit: (value: any) => void;
}

function ArrayEditor({ field, value, numeric, onCommit }: {
  field: string;
  value: any;
  numeric: boolean;
  onCommit: (v: any[]) => void;
}) {
  const base: string[] = Array.isArray(value) ? value.map((v) => (v === null || v === undefined ? "" : String(v))) : [];
  const [draft, setDraft] = useState<string[] | null>(null);
  const cur = draft ?? base;
  const idAttrs = !numeric && isIdField(field) ? { list: "idcomplete" as const, "data-idfield": "1" } : {};

  const sameAsBase = (list: string[]) => list.length === base.length && list.every((x, i) => x === base[i]);
  const commitList = (list: string[]) => {
    if (sameAsBase(list)) {
      setDraft(null);
      return;
    }
    if (numeric) {
      const vals: number[] = [];
      for (const item of list) {
        if (item === "" || item === null) {
          useUi.getState().toast(`${field}: empty value is not a number`, "error");
          return;
        }
        const n = Number(item);
        if (!Number.isFinite(n)) {
          useUi.getState().toast(`${field}: "${item}" is not a number`, "error");
          return;
        }
        vals.push(n);
      }
      onCommit(vals);
    } else {
      onCommit([...list]);
    }
  };

  return (
    <div className="arr-list">
      {cur.map((v, i) => (
        <div className="arr-row" key={i}>
          <input
            type={numeric ? "number" : "text"}
            step="any"
            value={v}
            {...idAttrs}
            onChange={(e) => {
              const next = [...cur];
              next[i] = e.target.value;
              setDraft(next);
            }}
            onBlur={() => {
              if (draft) commitList(draft);
            }}
            onKeyDown={blurOnEnter}
          />
          <button
            className="small danger"
            title="Remove"
            onClick={() => {
              const next = cur.filter((_, j) => j !== i);
              setDraft(next);
              commitList(next);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="small"
        onClick={() => setDraft([...cur, numeric ? "0" : ""])}
      >
        + add
      </button>
    </div>
  );
}

export default function FieldWidget({ field, fs, value, enumMembers, onCommit }: Props) {
  const kind = fs.kind || "any";
  const members = enumMembers || [];
  const toast = (msg: string) => useUi.getState().toast(msg, "error");

  if (kind === "boolean") {
    return <input type="checkbox" checked={!!value} onChange={(e) => onCommit(e.target.checked)} />;
  }

  if (kind === "number") {
    const txt = value === undefined || value === null ? "" : String(value);
    return (
      <input
        type="number"
        step="any"
        defaultValue={txt}
        key={txt}
        onBlur={(e) => {
          if (e.target.value === "" || e.target.value === null) {
            if (value !== null && value !== undefined) onCommit(null);
            return;
          }
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return toast(`${field}: not a number`);
          if (e.target.value !== txt) onCommit(n);
        }}
        onKeyDown={blurOnEnter}
      />
    );
  }

  if (kind === "enum" && fs.enumName && members.length) {
    const asNumber = typeof value === "number";
    const sel = value === undefined ? "" : String(value);
    return (
      <select
        key={sel}
        data-enum={fs.enumName}
        defaultValue={sel}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onCommit(undefined);
          onCommit(asNumber && /^-?\d+$/.test(v) ? Number(v) : v);
        }}
      >
        {value === undefined && <option value="">— pick —</option>}
        {members.map((m) => {
          const opt = asNumber ? String(m.value) : `${fs.enumName}::${m.name}`;
          return (
            <option key={m.name} value={opt}>
              {m.name}{asNumber ? ` (${m.value})` : ""}
            </option>
          );
        })}
      </select>
    );
  }

  if (kind === "enum[]" && fs.enumName && members.length) {
    const cur = Array.isArray(value) ? value.map(String) : [];
    const asNumber = cur.length > 0 && cur.every((x) => /^-?\d+$/.test(x));
    return (
      <div className="enum-checks">
        {members.map((m) => {
          const opt = asNumber ? String(m.value) : `${fs.enumName}::${m.name}`;
          return (
            <label key={m.name} title={`${fs.enumName}::${m.name} = ${m.value}`}>
              <input
                type="checkbox"
                value={opt}
                checked={cur.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked ? [...cur, opt] : cur.filter((x) => x !== opt);
                  const num = next.length > 0 && next.every((x) => /^-?\d+$/.test(x));
                  onCommit(num ? next.map(Number) : next);
                }}
              />
              {m.name}
            </label>
          );
        })}
      </div>
    );
  }

  if (kind === "boolean[]") {
    const cur = Array.isArray(value) ? value : [];
    return (
      <div className="enum-checks">
        {cur.map((v: any, i: number) => (
          <label key={i}>
            <input
              type="checkbox"
              checked={!!v}
              onChange={(e) => {
                const next = [...cur];
                next[i] = e.target.checked;
                onCommit(next);
              }}
            />
            {i}
          </label>
        ))}
      </div>
    );
  }

  if (kind === "string[]" || kind === "number[]") {
    return (
      <ArrayEditor
        key={JSON.stringify(value ?? null)}
        field={field}
        value={value}
        numeric={kind === "number[]"}
        onCommit={onCommit}
      />
    );
  }

  // Flat objects (Vector X/Y/Z, Rotator, color R/G/B/A/Hex, …): per-key inputs.
  // Schema-less `any` values use the same form when they look like flat structs.
  const schemaStructFields = (fs as any)?.structFields;
  const hasSchemaStruct = Array.isArray(schemaStructFields) && schemaStructFields.length > 0;
  // Non-object garbage in a struct field stays on the JSON path so it can be seen/fixed.
  const structValueOk = value === undefined || value === null || isPlainObject(value);
  if ((kind === "struct" || ((kind === "any" || hasSchemaStruct) && isFlatStructObject(value))) && structValueOk) {
    const keys = structKeys(fs, value);
    if (keys.length > 0) {
      return (
        <StructEditor
          key={JSON.stringify(value ?? null)}
          field={field}
          fs={fs}
          value={value}
          onCommit={onCommit}
        />
      );
    }
  }

  // Arrays of flat objects (e.g. MissionLayout Location/Rotation): one struct
  // row per element with add/remove. Non-flat elements render as compact
  // spans with a raw-JSON toggle inside.
  if (kind === "struct[]") {
    return (
      <StructArrayEditor
        key={JSON.stringify(value ?? null)}
        field={field}
        fs={fs}
        value={value}
        onCommit={onCommit}
      />
    );
  }
  if (kind === "any[]" && Array.isArray(value) && value.some(isPlainObject)) {
    const list = Array.isArray(value) ? value : [];
    const flat = list.every((el) => !isPlainObject(el) || isFlatStructObject(el));
    if (flat) {
      return (
        <StructArrayEditor
          key={JSON.stringify(value ?? null)}
          field={field}
          fs={fs}
          value={value}
          onCommit={onCommit}
        />
      );
    }
  }

  if (kind.endsWith("[]") || kind === "struct" || kind === "any") {
    const txt = value === undefined ? "" : JSON.stringify(value, null, 1);
    return (
      <textarea
        rows={kind === "struct" ? 4 : 2}
        spellCheck={false}
        defaultValue={txt}
        key={txt}
        onBlur={(e) => {
          const t = e.target.value.trim();
          if (!t) return onCommit(null);
          if (t === txt.trim()) return;
          try {
            onCommit(JSON.parse(t));
          } catch (e: any) {
            toast(`${field}: invalid JSON (${e.message})`);
          }
        }}
      />
    );
  }

  // string fallback (textarea for long text)
  const txt = value === undefined || value === null ? "" : String(value);
  const idProps = isIdField(field) ? { list: "idcomplete", "data-idfield": "1" } : {};
  if (txt.length > 120 && !isIdField(field)) {
    return (
      <textarea
        rows={2}
        defaultValue={txt}
        key={txt}
        onBlur={(e) => {
          if (e.target.value !== txt) onCommit(e.target.value);
        }}
      />
    );
  }
  return (
    <input
      type="text"
      defaultValue={txt}
      key={txt}
      {...idProps}
      onBlur={(e) => {
        if (e.target.value !== txt) onCommit(e.target.value);
      }}
      onKeyDown={blurOnEnter}
    />
  );
}
