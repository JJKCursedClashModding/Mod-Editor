// Field editors — one widget per schema kind.
// Mirrors renderWidget()/arrayListWidget() in renderer/app.js.
import { useState } from "react";
import type { FieldSchema } from "../api/types";

export function parseLoose(text: string, fs: FieldSchema): any {
  const s = (text ?? "").trim();
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
  if ((s.startsWith("{") || s.startsWith("[")) && fs.kind !== "string") {
    try {
      return JSON.parse(s);
    } catch (e: any) {
      throw new Error(`Bad JSON: ${e.message}`);
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(s) && fs.kind !== "string") return Number(s);
  if (/^(true|false)$/.test(s) && fs.kind !== "string") return s === "true";
  return text;
}

interface Props {
  field: string;
  fs: FieldSchema;
  value: any;
  enumMembers?: Array<{ name: string; value: number }>;
  onCommit: (value: any) => void;
}

export default function FieldWidget({ field, fs, value, enumMembers, onCommit }: Props) {
  const kind = fs.kind || "any";
  const [draft, setDraft] = useState<string | null>(null);

  const commitText = (text: string) => {
    try {
      onCommit(parseLoose(text, fs));
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (kind === "boolean") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onCommit(e.target.checked)}
      />
    );
  }

  if (kind === "number") {
    return (
      <input
        type="number"
        step="any"
        defaultValue={value ?? ""}
        key={String(value ?? "")}
        onBlur={(e) => {
          if (e.target.value === "") onCommit(null);
          else {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onCommit(n);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    );
  }

  if ((kind === "enum" || kind === "enum[]") && enumMembers && enumMembers.length) {
    if (kind === "enum") {
      const asNumber = typeof value === "number";
      return (
        <select
          value={value === undefined ? "" : String(asNumber ? value : value)}
          onChange={(e) => {
            const v = e.target.value;
            onCommit(v === "" ? null : /^-?\d+$/.test(v) && asNumber ? Number(v) : v);
          }}
        >
          <option value="">— pick —</option>
          {enumMembers.map((m) => {
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
    const cur = Array.isArray(value) ? value.map(String) : [];
    const asNum = cur.length > 0 && cur.every((x) => /^-?\d+$/.test(x));
    return (
      <div className="enum-checks">
        {enumMembers.map((m) => {
          const opt = asNum ? String(m.value) : `${fs.enumName}::${m.name}`;
          return (
            <label key={m.name} title={`${fs.enumName}::${m.name} = ${m.value}`}>
              <input
                type="checkbox"
                checked={cur.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked ? [...cur, opt] : cur.filter((x) => x !== opt);
                  onCommit(asNum || next.every((x) => /^-?\d+$/.test(x)) ? next.map(Number).filter((_, i) => next[i] !== "") : next);
                }}
              />
              {m.name}
            </label>
          );
        })}
      </div>
    );
  }

  if (kind === "string[]" || kind === "number[]") {
    const arr: any[] = Array.isArray(value) ? value : [];
    const numeric = kind === "number[]";
    return (
      <div className="arr-list">
        {arr.map((v, i) => (
          <div className="arr-row" key={i}>
            <input
              type={numeric ? "number" : "text"}
              step="any"
              defaultValue={v ?? ""}
              key={`${i}:${String(v ?? "")}`}
              onBlur={(e) => {
                const next = [...arr];
                next[i] = numeric ? Number(e.target.value) : e.target.value;
                onCommit(next);
              }}
            />
            <button className="small danger" onClick={() => onCommit(arr.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button className="small" onClick={() => onCommit([...arr, numeric ? 0 : ""])}>+ add</button>
      </div>
    );
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
          try {
            onCommit(JSON.parse(t));
          } catch (err: any) {
            alert(`${field}: invalid JSON (${err.message})`);
          }
        }}
      />
    );
  }

  // string fallback (textarea for long text)
  const txt = value === null || value === undefined ? "" : String(value);
  if (txt.length > 120) {
    return (
      <textarea
        rows={2}
        defaultValue={draft ?? txt}
        key={txt}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          setDraft(null);
          if (e.target.value !== txt) onCommit(e.target.value);
        }}
      />
    );
  }
  return (
    <input
      type="text"
      defaultValue={draft ?? txt}
      key={txt}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        setDraft(null);
        if (e.target.value !== txt) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
