// Open-tabs model. Each tab keeps its own char filter snapshot, status
// filter, search and expanded rows (mirrors app.js multi-tab model).
// Row *contents* are cached by TanStack Query; this store only tracks
// which rows are expanded.
import { create } from "zustand";
import type { Tab } from "../api/types";

let seq = 1;
function newTabSeq() {
  return seq++;
}

interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
  active: () => Tab | null;
  openTable: (file: string, charPrefix: string) => Tab;
  openParam: (short: string, charPrefix: string) => Tab;
  openRules: (file: string) => Tab;
  activate: (id: string) => void;
  close: (id: string) => void;
  closeOthers: (id: string) => void;
  patch: (id: string, p: Partial<Tab>) => void;
  toggleExpanded: (id: string, rowId: string) => void;
  reset: () => void;
  serialize: () => { openTabs: any[]; activeTab: string | null };
}

function mkTab(kind: Tab["kind"], key: string, charPrefix: string): Tab {
  return {
    id: `tab${newTabSeq()}_${Date.now().toString(36)}`,
    kind,
    file: kind === "param" ? null : key,
    short: kind === "param" ? key : null,
    charPrefix: kind === "rules" ? "" : charPrefix || "",
    statusFilter: "all",
    search: "",
    visibleFields: null,
    expanded: [],
  };
}

export function tabTitle(t: Tab): string {
  if (t.kind === "table" && t.file) return t.file.replace(/\.json$/i, "");
  if (t.kind === "param") return t.short ?? "?";
  if (t.kind === "rules") return `${t.file?.replace(/\.json$/i, "")} — Rules`;
  return "?";
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  active: () => get().tabs.find((t) => t.id === get().activeTabId) || null,

  openTable: (file, charPrefix) => {
    let t = get().tabs.find((x) => x.kind === "table" && x.file === file && (x.charPrefix || "") === (charPrefix || ""));
    if (!t) {
      t = mkTab("table", file, charPrefix);
      set((s) => ({ tabs: [...s.tabs, t!] }));
    }
    set({ activeTabId: t.id });
    return t;
  },

  openParam: (short, charPrefix) => {
    let t = get().tabs.find((x) => x.kind === "param" && x.short === short && (x.charPrefix || "") === (charPrefix || ""));
    if (!t) {
      t = mkTab("param", short, charPrefix);
      set((s) => ({ tabs: [...s.tabs, t!] }));
    }
    set({ activeTabId: t.id });
    return t;
  },

  openRules: (file) => {
    let t = get().tabs.find((x) => x.kind === "rules" && x.file === file);
    if (!t) {
      t = mkTab("rules", file, "");
      set((s) => ({ tabs: [...s.tabs, t!] }));
    }
    set({ activeTabId: t.id });
    return t;
  },

  activate: (id) => {
    if (get().tabs.some((t) => t.id === id)) set({ activeTabId: id });
  },

  close: (id) => {
    const tabs = get().tabs.filter((t) => t.id !== id);
    let activeTabId = get().activeTabId;
    if (activeTabId === id) {
      const i = get().tabs.findIndex((t) => t.id === id);
      const next = tabs[Math.min(i, tabs.length - 1)];
      activeTabId = next ? next.id : null;
    }
    set({ tabs, activeTabId });
  },

  closeOthers: (id) => set((s) => ({ tabs: s.tabs.filter((t) => t.id === id), activeTabId: id })),

  patch: (id, p) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...p } : t)) })),

  toggleExpanded: (id, rowId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t;
        const has = t.expanded.includes(rowId);
        return { ...t, expanded: has ? t.expanded.filter((x) => x !== rowId) : [...t.expanded, rowId] };
      }),
    })),

  reset: () => set({ tabs: [], activeTabId: null }),

  serialize: () => ({
    openTabs: get().tabs.map((t) => ({ kind: t.kind, file: t.file, short: t.short, charPrefix: t.charPrefix })),
    activeTab: get().activeTabId,
  }),
}));
