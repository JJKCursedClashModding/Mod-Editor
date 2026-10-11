// TanStack Query hooks + shared fetchers (flows.ts prefetches with these).
// Server state lives here; client UI state lives in zustand stores.
import { useQuery } from "@tanstack/react-query";
import { api } from "./ipc";

export const keys = {
  init: ["init"],
  schema: (file: string) => ["schema", file],
  tableRows: (file: string, charPrefix: string, search: string) => ["tableRows", file, charPrefix, search],
  row: (file: string, rowId: string) => ["row", file, rowId],
  rules: (file: string) => ["rules", file],
  paramRows: (short: string, search: string, charPrefix: string) => ["paramRows", short, search, charPrefix],
  paramRow: (short: string, rowId: string) => ["paramRow", short, rowId],
  diff: ["diffProject"],
  search: (q: string) => ["globalSearch", q],
  docs: (base: string, field: string) => ["docs", base, field],
};

export async function fetchTableSchema(file: string) {
  return api.tableSchema(file);
}

// All rows for a table tab (backend pages 2000 at a time; loop like app.js did).
export async function fetchTableRowsAll(file: string, charPrefix: string, search: string) {
  const all: any[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const d = await api.tableRows(file, { charPrefix, search, offset, limit: 2000 });
    total = d.total;
    all.push(...(d.rows || []));
    offset += (d.rows || []).length;
    if (offset >= total || !(d.rows || []).length) break;
  }
  return { total, rows: all };
}

export async function fetchParamRowsFiltered(short: string, search: string, charPrefix: string) {
  const d = await api.paramsRows(short);
  const q = (search || "").toLowerCase();
  let ids = d.rows || [];
  let vanillaIds = d.vanillaIds || [];
  if (charPrefix) {
    ids = ids.filter((id) => id.startsWith(charPrefix));
    vanillaIds = vanillaIds.filter((id) => id.startsWith(charPrefix));
  }
  if (q) {
    ids = ids.filter((id) => id.toLowerCase().includes(q));
    vanillaIds = vanillaIds.filter((id) => id.toLowerCase().includes(q));
  }
  return { ...d, rows: ids, vanillaIds };
}

export function useTableSchema(file: string | null) {
  return useQuery({
    queryKey: file ? keys.schema(file) : ["schema", "none"],
    queryFn: () => fetchTableSchema(file!),
    enabled: !!file,
    staleTime: 5 * 60_000,
  });
}

export function useTableRows(file: string | null, charPrefix: string, search: string) {
  return useQuery({
    queryKey: file ? keys.tableRows(file, charPrefix || "", search || "") : ["tableRows", "none"],
    queryFn: () => fetchTableRowsAll(file!, charPrefix || "", search || ""),
    enabled: !!file,
    staleTime: 10_000,
  });
}

export function useRowData(file: string | null, rowId: string | null) {
  return useQuery({
    queryKey: file && rowId ? keys.row(file, rowId) : ["row", "none"],
    queryFn: () => api.rowGet(file!, rowId!),
    enabled: !!(file && rowId),
    staleTime: 10_000,
  });
}

export function useRules(file: string | null) {
  return useQuery({
    queryKey: file ? keys.rules(file) : ["rules", "none"],
    queryFn: () => api.rulesList(file!),
    enabled: !!file,
    staleTime: 10_000,
  });
}

export function useParamRows(short: string | null, search: string, charPrefix: string) {
  return useQuery({
    queryKey: short ? keys.paramRows(short, search || "", charPrefix || "") : ["paramRows", "none"],
    queryFn: () => fetchParamRowsFiltered(short!, search || "", charPrefix || ""),
    enabled: !!short,
    staleTime: 10_000,
  });
}

export function useParamRow(short: string | null, rowId: string | null) {
  return useQuery({
    queryKey: short && rowId ? keys.paramRow(short, rowId) : ["paramRow", "none"],
    queryFn: () => api.paramGet(short!, rowId!),
    enabled: !!(short && rowId),
    staleTime: 10_000,
  });
}

// Field documentation probe (inline info-button tooltips + docs modal).
// Cached forever — mirrors S.docsCache in renderer/app.js.
export function useDocsField(
  base: string | null,
  family: string | null,
  field: string | null,
  enumName?: string | null,
) {
  return useQuery({
    queryKey: base && field ? keys.docs(base, `${field}::${enumName || ""}`) : ["docs", "none"],
    queryFn: () => api.docsField(base!, family!, field!, enumName || null),
    enabled: !!(base && field),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
