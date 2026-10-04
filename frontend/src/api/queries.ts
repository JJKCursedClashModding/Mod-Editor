// TanStack Query hooks: all *server* state lives here.
// Client UI state (open tabs, filters, sidebar) lives in zustand stores.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./ipc";
import { useProject } from "../stores/project";
import { useTabs } from "../stores/tabs";

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
};

// Table schema + doc summary
export function useTableSchema(file: string | null) {
  return useQuery({
    queryKey: file ? keys.schema(file) : ["schema", "none"],
    queryFn: () => api.tableSchema(file!),
    enabled: !!file,
    staleTime: 5 * 60_000,
  });
}

// All rows for a table tab (backend pages 2000 at a time; loop like app.js did).
export function useTableRows(file: string | null, charPrefix: string, search: string) {
  return useQuery({
    queryKey: file ? keys.tableRows(file, charPrefix, search) : ["tableRows", "none"],
    queryFn: async () => {
      const all: any[] = [];
      let offset = 0;
      let total = 0;
      for (;;) {
        const d = await api.tableRows(file!, { charPrefix, search, offset, limit: 2000 });
        total = d.total;
        all.push(...(d.rows || []));
        offset += (d.rows || []).length;
        if (offset >= total || !(d.rows || []).length) break;
      }
      return { total, rows: all };
    },
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
    queryKey: short ? keys.paramRows(short, search, charPrefix) : ["paramRows", "none"],
    queryFn: async () => {
      const d = await api.paramsRows(short!);
      const q = search.toLowerCase();
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
    },
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

// --- mutations (invalidate affected queries + sync changed-counts) ---

function useInvalidateTab(file?: string | null) {
  const qc = useQueryClient();
  return (f?: string | null) => {
    const target = f ?? file;
    if (target) {
      qc.invalidateQueries({ queryKey: keys.tableRows(target, "", "") });
      // Simplest correct: invalidate all row-list/row-detail queries for file.
      qc.invalidateQueries({ queryKey: ["tableRows", target] });
      qc.invalidateQueries({ queryKey: ["row", target] });
      qc.invalidateQueries({ queryKey: keys.rules(target) });
    }
    qc.invalidateQueries({ queryKey: keys.diff });
  };
}

export function useSetField(file: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateTab(file);
  const setChanged = useProject((s) => s.setChanged);
  return useMutation({
    mutationFn: ({ rowId, field, value }: { rowId: string; field: string; value: any }) =>
      api.rowSetField(file, rowId, field, value),
    onSuccess: (d, v) => {
      if (d.changed) setChanged(d.changed);
      qc.invalidateQueries({ queryKey: keys.row(file, v.rowId) });
      invalidate(file);
    },
  });
}

export function useRulesMutations(file: string) {
  const qc = useQueryClient();
  const setChanged = useProject((s) => s.setChanged);
  const sync = (d: { changed?: any }) => {
    if (d.changed) setChanged(d.changed);
    qc.invalidateQueries({ queryKey: keys.rules(file) });
    qc.invalidateQueries({ queryKey: ["tableRows", file] });
    qc.invalidateQueries({ queryKey: ["row", file] });
    qc.invalidateQueries({ queryKey: keys.diff });
    // Family members share rules — refresh their row lists too.
    qc.invalidateQueries({ queryKey: ["tableRows"] });
  };
  return {
    add: useMutation({ mutationFn: (rule: any) => api.rulesAdd(file, rule), onSuccess: sync }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: any }) => api.rulesUpdate(file, id, patch),
      onSuccess: sync,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.rulesDelete(file, id), onSuccess: sync }),
    move: useMutation({
      mutationFn: ({ id, dir }: { id: string; dir: "up" | "down" }) => api.rulesMove(file, id, dir),
      onSuccess: sync,
    }),
  };
}

export function useParamSet(short: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, value }: { rowId: string; value: any }) => api.paramSet(short, rowId, value),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: keys.paramRow(short, v.rowId) });
      qc.invalidateQueries({ queryKey: ["paramRows", short] });
      qc.invalidateQueries({ queryKey: keys.diff });
    },
  });
}

/** After undo/redo/restore: reload project + nuke row caches. */
export function useRefreshAll() {
  const qc = useQueryClient();
  const loadProject = useProject((s) => s.reloadAfterHistory);
  return async (project: any, changed: any) => {
    loadProject(project, changed);
    await qc.invalidateQueries();
  };
}

export function useActiveTabInvalidator() {
  const qc = useQueryClient();
  const active = useTabs((s) => s.active());
  return () => {
    if (active?.kind === "table" && active.file) {
      qc.invalidateQueries({ queryKey: ["tableRows", active.file] });
      qc.invalidateQueries({ queryKey: ["row", active.file] });
    }
    if (active?.kind === "param" && active.short) {
      qc.invalidateQueries({ queryKey: ["paramRows", active.short] });
    }
    qc.invalidateQueries({ queryKey: keys.diff });
  };
}
