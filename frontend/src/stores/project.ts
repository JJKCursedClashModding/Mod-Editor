// Project-level state: config, project list, current project, vendor tables,
// changed-counts, character map, param assets, rule/cond ops, char mode.
// Row-level server data lives in TanStack Query (see api/queries.ts).
import { create } from "zustand";
import { api, type InitData } from "../api/ipc";
import type { ChangedCounts, ParamAsset, TableEntry } from "../api/types";
import { useUi } from "./ui";

export function charLabelOf(chars: Record<string, string>, prefix: string): string {
  return (chars && chars[prefix]) || prefix;
}

interface ProjectState {
  ready: boolean;
  error: string | null;
  config: any;
  projects: InitData["projects"];
  currentProject: string | null;
  project: any | null;
  tables: TableEntry[];
  tableByFile: Record<string, TableEntry>;
  changed: ChangedCounts;
  chars: Record<string, string>;
  paramAssets: ParamAsset[];
  ruleOps: any[];
  condOps: any[];
  charMode: string;
  leftTab: "tables" | "params";
  history: { canUndo: boolean; canRedo: boolean };
  prefixIndex: Record<string, Record<string, number>> | null;
  paramVanillaIds: Record<string, string[]>;

  init: () => Promise<void>;
  setChanged: (c: ChangedCounts) => void;
  setLeftTab: (t: "tables" | "params") => void;
  setCharModeLocal: (prefix: string) => void;
  setProjectData: (p: {
    projects?: InitData["projects"];
    currentProject?: string | null;
    project?: any;
    changed?: ChangedCounts;
    config?: any;
    chars?: Record<string, string>;
  }) => void;
  setTablesData: (tables: TableEntry[], tableByFile: Record<string, TableEntry>, changed?: ChangedCounts) => void;
  reloadAfterHistory: (project: any, changed: ChangedCounts) => void;
  refreshHistory: () => Promise<void>;
  ensureCharData: () => Promise<void>;
}

export const useProject = create<ProjectState>((set, get) => ({
  ready: false,
  error: null,
  config: null,
  projects: [],
  currentProject: null,
  project: null,
  tables: [],
  tableByFile: {},
  changed: {},
  chars: {},
  paramAssets: [],
  ruleOps: [],
  condOps: [],
  charMode: "",
  leftTab: "tables",
  history: { canUndo: false, canRedo: false },
  prefixIndex: null,
  paramVanillaIds: {},

  init: async () => {
    try {
      const d = await api.init();
      const tableByFile: Record<string, TableEntry> = {};
      for (const t of d.tables || []) tableByFile[t.file] = t;
      set({
        ready: true,
        error: null,
        config: d.config,
        projects: d.projects,
        currentProject: d.currentProject,
        project: d.project,
        tables: d.tables || [],
        tableByFile,
        changed: d.changed || {},
        chars: d.chars || {},
        paramAssets: d.paramAssets || [],
        ruleOps: d.ruleOps || [],
        condOps: d.condOps || [],
        charMode: d.config?.charMode || "",
      });
      if (d.tablesError) useUi.getState().toast(`Input tables: ${d.tablesError}`, "warn");
      void get().refreshHistory();
    } catch (e: any) {
      set({ ready: true, error: e?.message || String(e) });
    }
  },

  setChanged: (c) => set({ changed: c || {} }),
  setLeftTab: (t) => set({ leftTab: t }),
  setCharModeLocal: (prefix) => set({ charMode: prefix || "" }),
  setProjectData: (p) => set((s) => ({ ...s, ...p })),
  setTablesData: (tables, tableByFile, changed) =>
    set((s) => ({ tables, tableByFile, changed: changed === undefined ? s.changed : changed })),

  reloadAfterHistory: (project, changed) => set({ project, changed: changed || {} }),

  refreshHistory: async () => {
    try {
      if (!get().currentProject) return;
      const h = await api.historyState();
      set({ history: { canUndo: h.canUndo, canRedo: h.canRedo } });
    } catch {
      /* ignore */
    }
  },

  // One-time character index (table prefix counts + param vanilla ids).
  ensureCharData: async () => {
    const s = get();
    if (s.prefixIndex && Object.keys(s.paramVanillaIds).length > 0) return;
    const d = await api.prefixIndex();
    const all: Record<string, string[]> = {};
    try {
      for (const a of s.paramAssets) {
        const v = await api.paramVanilla(a.shortName);
        all[a.shortName] = v.ids || [];
      }
    } catch {
      /* vanilla unavailable */
    }
    set({ prefixIndex: d.index || {}, paramVanillaIds: all });
  },
}));
