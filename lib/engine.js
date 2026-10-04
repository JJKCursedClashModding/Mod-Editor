// Rules engine: global rules (set / math + optional if-condition), per-row
// overrides, new rows. Computes effective values, provenance, and sparse diffs.
const schema = require("./schema");

const RULE_OPS = [
  { id: "set", label: "Set to", needsValue: true },
  { id: "add", label: "+ Add", needsValue: true },
  { id: "sub", label: "− Subtract", needsValue: true },
  { id: "mul", label: "× Multiply by", needsValue: true },
  { id: "div", label: "÷ Divide by", needsValue: true },
  { id: "map", label: "⇄ Map values", needsValue: true },
];

const COND_OPS = [
  { id: "==", label: "is" },
  { id: "!=", label: "is not" },
  { id: ">", label: ">" },
  { id: ">=", label: "≥" },
  { id: "<", label: "<" },
  { id: "<=", label: "≤" },
  { id: "contains", label: "contains" },
  { id: "!contains", label: "does not contain" },
];

function isObj(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b))
    return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

function getPath(row, p) {
  if (!p) return undefined;
  const segs = String(p).split(".");
  let cur = row;
  for (const s of segs) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      if (!/^\d+$/.test(s)) return undefined;
      cur = cur[Number(s)];
    } else if (typeof cur === "object") {
      cur = cur[s];
    } else {
      return undefined;
    }
  }
  return cur;
}

function setPath(row, p, v) {
  const segs = String(p).split(".");
  let cur = row;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    const next = segs[i + 1];
    const wantArray = /^\d+$/.test(next);
    if (Array.isArray(cur)) {
      const idx = Number(s);
      if (!/^\d+$/.test(s)) throw new Error(`Bad array index in path: ${p}`);
      if (cur[idx] === null || typeof cur[idx] !== "object") cur[idx] = wantArray ? [] : {};
      cur = cur[idx];
    } else {
      if (cur[s] === null || typeof cur[s] !== "object") cur[s] = wantArray ? [] : {};
      cur = cur[s];
    }
  }
  const last = segs[segs.length - 1];
  if (Array.isArray(cur)) {
    if (!/^\d+$/.test(last)) throw new Error(`Bad array index in path: ${p}`);
    cur[Number(last)] = v;
  } else {
    cur[last] = v;
  }
}

function resolveEnumNumber(str, enums) {
  const i = String(str).indexOf("::");
  if (i < 0) return null;
  const t = String(str).slice(0, i);
  const m = String(str).slice(i + 2);
  const e = enums.map[t];
  if (e && e.valueByMember[m] !== undefined && e.valueByMember[m] !== null)
    return e.valueByMember[m];
  return null;
}

function memberForValue(enumName, num, enums) {
  const e = enums.map[enumName];
  if (!e) return null;
  const mem = e.memberByValue[num];
  return mem !== undefined ? `${enumName}::${mem}` : null;
}

function toComparable(v, enums) {
  if (typeof v === "string" && schema.UE_ENUM_RE.test(v)) {
    const n = resolveEnumNumber(v, enums);
    return n === null ? v : n;
  }
  return v;
}

function testCondition(cellVal, op, target, enums) {
  const a = toComparable(cellVal, enums);
  const b = toComparable(target, enums);
  switch (op) {
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    case ">":
      return typeof a === "number" && typeof b === "number" && a > b;
    case ">=":
      return typeof a === "number" && typeof b === "number" && a >= b;
    case "<":
      return typeof a === "number" && typeof b === "number" && a < b;
    case "<=":
      return typeof a === "number" && typeof b === "number" && a <= b;
    case "contains":
      if (Array.isArray(cellVal)) return cellVal.some((x) => toComparable(x, enums) === b);
      return String(a ?? "").includes(String(target ?? ""));
    case "!contains":
      if (Array.isArray(cellVal)) return !cellVal.some((x) => toComparable(x, enums) === b);
      return !String(a ?? "").includes(String(target ?? ""));
    default:
      return false;
  }
}

// Resolve any enum-shaped value (member name, "Type::Member" or number)
// to its numeric value. Returns null when it cannot be resolved.
function toEnumNumber(value, enumName, enums) {
  const e = enums.map[enumName];
  if (!e) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (value.includes("::")) return resolveEnumNumber(value, enums);
    if (e.valueByMember[value] !== undefined) return e.valueByMember[value];
  }
  return null;
}

// Convert a rule/override value for export. Enum-typed fields ALWAYS export
// as numbers (even when the vanilla row stores "Type::Member" strings) —
// the UI keeps showing member names. Untouched values pass through as-is.
function matchRepr(value, current, fieldSchema, enums) {
  if (value === null || value === undefined) return value;
  const enumName = fieldSchema && fieldSchema.enumName;
  if (enumName && enums.map[enumName]) {
    if (Array.isArray(value)) {
      return value.map((el) => {
        const n = toEnumNumber(el, enumName, enums);
        return n === null ? clone(el) : n;
      });
    }
    const n = toEnumNumber(value, enumName, enums);
    return n === null ? value : n;
  }
  if (typeof current === "string" && schema.UE_ENUM_RE.test(current)) {
    return value;
  }
  if (typeof current === "number" && typeof value === "string" && schema.UE_ENUM_RE.test(value)) {
    const n = resolveEnumNumber(value, enums);
    return n === null ? value : n;
  }
  return value;
}

function applyMath(cur, op, amount) {
  const a = Number(cur);
  const b = Number(amount);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`Math op needs numbers (got ${JSON.stringify(cur)} and ${JSON.stringify(amount)})`);
  }
  switch (op) {
    case "add":
      return a + b;
    case "sub":
      return a - b;
    case "mul":
      return a * b;
    case "div":
      if (b === 0) throw new Error("Division by zero");
      return a / b;
    default:
      throw new Error(`Unknown op: ${op}`);
  }
}

function fieldSchemaFor(tableSchema, fieldPath) {
  if (!tableSchema || !fieldPath) return null;
  const top = String(fieldPath).split(".")[0];
  return (tableSchema.fields && tableSchema.fields[top]) || null;
}

// Enum-aware equality used by the map op + conditions.
function valuesMatch(a, b, enums) {
  if (deepEqual(a, b)) return true;
  try {
    return toComparable(a, enums) === toComparable(b, enums);
  } catch {
    return false;
  }
}

// Normalize a map-op value into { pairs:[{from,to}], defaultValue, hasDefault }.
// Accepts the current shape {pairs, default} as well as a legacy bare array.
function normalizeMapValue(value) {
  if (Array.isArray(value)) return { pairs: value, defaultValue: undefined, hasDefault: false };
  const v = value && typeof value === "object" ? value : {};
  const pairs = Array.isArray(v.pairs) ? v.pairs : [];
  const hasDefault = v.default !== undefined && v.default !== null;
  return { pairs, defaultValue: v.default, hasDefault };
}

function applyMapOp(cur, mapValue, fieldSchema, enums) {
  const { pairs, defaultValue, hasDefault } = normalizeMapValue(mapValue);
  for (const p of pairs) {
    if (!p || typeof p !== "object") continue;
    if (valuesMatch(cur, p.from, enums)) return matchRepr(clone(p.to), cur, fieldSchema, enums);
  }
  if (hasDefault) return matchRepr(clone(defaultValue), cur, fieldSchema, enums);
  return cur;
}

function applyRulesToRow(row, rules, tableSchema, enums) {
  const fired = {}; // fieldPath -> [ruleId]
  const firedRules = [];
  for (const rule of rules || []) {
    if (!rule || rule.disabled) continue;
    if (!rule.field || !rule.op) continue;
    if (rule.cond && rule.cond.field && rule.cond.op !== undefined) {
      let ok = false;
      try {
        ok = testCondition(getPath(row, rule.cond.field), rule.cond.op, rule.cond.value, enums);
      } catch {
        ok = false;
      }
      if (!ok) continue;
    }
    const fs = fieldSchemaFor(tableSchema, rule.field);
    try {
      if (rule.op === "set") {
        setPath(row, rule.field, matchRepr(clone(rule.value), getPath(row, rule.field), fs, enums));
      } else if (rule.op === "map") {
        const cur = getPath(row, rule.field);
        if (cur === undefined) continue; // map on missing field: skip
        setPath(row, rule.field, applyMapOp(cur, rule.value, fs, enums));
      } else {
        const cur = getPath(row, rule.field);
        if (cur === undefined) continue; // math on missing field: skip
        setPath(row, rule.field, matchRepr(applyMath(cur, rule.op, rule.value), cur, fs, enums));
      }
      (fired[rule.field] = fired[rule.field] || []).push(rule.id);
      firedRules.push(rule.id);
    } catch (err) {
      throw new Error(`Rule "${rule.name || rule.id}" on ${rule.field}: ${err.message}`);
    }
  }
  return { fired, firedRules };
}

// Effective row for a vanilla row + table state.
function applyTableStateToRow(vanillaRow, tableState, tableSchema, enums) {
  const st = tableState || { globalRules: [], overrides: {} };
  const row = clone(vanillaRow) || {};
  const { fired } = applyRulesToRow(row, st.globalRules, tableSchema, enums);
  const prov = {};
  for (const f of Object.keys(fired)) prov[f] = "global";
  const overrides = (st.overrides) || {};
  for (const [f, v] of Object.entries(overrides)) {
    const fs = fieldSchemaFor(tableSchema, f);
    setPath(row, f, matchRepr(clone(v), getPath(row, f), fs, enums));
    prov[f] = "override";
  }
  return { row, prov, fired };
}

function applyNewRow(baseRow, newRowState, tableSchema, enums) {
  const row = clone(baseRow) || {};
  const fields = (newRowState && newRowState.fields) || {};
  for (const [f, v] of Object.entries(fields)) {
    const fs = fieldSchemaFor(tableSchema, f);
    setPath(row, f, matchRepr(clone(v), getPath(row, f), fs, enums));
  }
  return row;
}

function diffFields(vanillaRow, effectiveRow) {
  const out = {};
  const keys = new Set([
    ...Object.keys(vanillaRow || {}),
    ...Object.keys(effectiveRow || {}),
  ]);
  for (const k of keys) {
    const a = vanillaRow ? vanillaRow[k] : undefined;
    const b = effectiveRow ? effectiveRow[k] : undefined;
    if (!deepEqual(a, b)) out[k] = { from: clone(a), to: clone(b) };
  }
  return out;
}

function blankTableState() {
  return { globalRules: [], overrides: {}, newRows: {} };
}

function newRule(field, tableSchema) {
  return {
    id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: "",
    field: field || "",
    op: "set",
    value: null,
    cond: null,
    disabled: false,
  };
}

// Coerce + validate a UI-supplied value against schema before storing.
function coerceValue(raw, fieldSchema, vanillaSample, enums) {
  const kind = (fieldSchema && fieldSchema.kind) || "any";
  const fail = (msg) => ({ error: msg });
  if (raw === null || raw === undefined) return { value: raw };
  if (kind === "boolean") {
    if (typeof raw === "boolean") return { value: raw };
    if (raw === "true" || raw === 1) return { value: true };
    if (raw === "false" || raw === 0) return { value: false };
    return fail("Expected true/false");
  }
  if (kind === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return fail(`Expected a number (got ${JSON.stringify(raw)})`);
    return { value: n };
  }
  if (kind === "enum") {
    const enumName = fieldSchema.enumName;
    const e = enums.map[enumName];
    if (typeof raw === "number") {
      if (e && e.memberByValue[raw] === undefined)
        return { value: raw, warning: `${raw} is not a known ${enumName} member` };
      return { value: raw };
    }
    if (typeof raw === "string") {
      let member = raw;
      let typeName = enumName;
      if (raw.includes("::")) {
        const parts = raw.split("::");
        typeName = parts[0];
        member = parts[1];
      }
      const reg = enums.map[typeName];
      if (!reg) return fail(`Unknown enum type ${typeName}`);
      if (reg.valueByMember[member] === undefined)
        return fail(`Unknown member ${member} in ${typeName}`);
      return { value: `${typeName}::${member}` };
    }
    return fail("Expected an enum member");
  }
  if (kind === "enum[]" || kind === "number[]" || kind === "string[]" || kind === "boolean[]" || kind === "any[]") {
    if (!Array.isArray(raw)) return fail("Expected an array (JSON [...])");
    if (kind === "number[]") {
      const out = [];
      for (const el of raw) {
        const n = Number(el);
        if (!Number.isFinite(n)) return fail(`Array element ${JSON.stringify(el)} is not a number`);
        out.push(n);
      }
      return { value: out };
    }
    if (kind === "boolean[]") {
      if (!raw.every((el) => typeof el === "boolean")) return fail("All elements must be true/false");
      return { value: raw };
    }
    if (kind === "enum[]") {
      const out = [];
      for (const el of raw) {
        const r = coerceValue(el, { kind: "enum", enumName: fieldSchema.enumName }, undefined, enums);
        if (r.error) return r;
        out.push(r.value);
      }
      return { value: out };
    }
    return { value: raw };
  }
  if (kind === "struct") {
    if (!isObj(raw)) return fail("Expected an object (JSON {...})");
    return { value: raw };
  }
  if (kind === "string") {
    if (typeof raw !== "string") return fail("Expected text");
    return { value: raw };
  }
  return { value: raw };
}

module.exports = {
  RULE_OPS,
  COND_OPS,
  clone,
  deepEqual,
  getPath,
  setPath,
  testCondition,
  matchRepr,
  applyRulesToRow,
  applyTableStateToRow,
  applyNewRow,
  diffFields,
  blankTableState,
  newRule,
  coerceValue,
  resolveEnumNumber,
  memberForValue,
  toEnumNumber,
  valuesMatch,
  normalizeMapValue,
  applyMapOp,
};
