// Project-level (mostly static) state: config, project list, current project,
// vendor tables, changed-counts, character map, param assets, rule/cond ops.
// Row-level server data lives in TanStack Query (see api/queries.ts).
import { create } from "zustand";
import { api, type InitData } from "../api/ipc";
import { useTabs } from "./tabs";
import type { ChangedCounts, ParamAsset, TableEntry } from "../api/types";

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

  init: () => Promise<void>;
  setChanged: (c: ChangedCounts) => void;
  setLeftTab: (t: "tables" | "params") => void;
  setCharMode: (prefix: string) => Promise<void>;
  openProject: (name: string) => Promise<void>;
  reloadAfterHistory: (project: any, changed: ChangedCounts) => void;
  refreshHistory: () => Promise<void>;
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
      if (d.tablesError) get().config && console.warn(d.tablesError);
      void get().refreshHistory();
    } catch (e: any) {
      set({ ready: true, error: e?.message || String(e) });
    }
  },

  setChanged: (c) => set({ changed: c || {} }),
  setLeftTab: (t) => set({ leftTab: t }),

  setCharMode: async (prefix) => {
    set({ charMode: prefix || "" });
    try {
      const cfg = await api.saveSettings({ charMode: prefix || "" });
      set({ config: cfg });
    } catch {
      /* non-fatal */
    }
  },

  openProject: async (name) => {
    const d = await api.projectOpen(name);
    // Tabs belong to a project — clear them.
    useTabs.getState().reset();
    set({ currentProject: name, project: d.project, changed: d.changed || {} });
    void get().refreshHistory();
  },

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
}));
