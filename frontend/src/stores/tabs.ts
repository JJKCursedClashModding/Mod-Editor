// Open-tabs model. Each tab keeps its own char filter snapshot, status
// filter, search, visible-field set and expanded rows.
// Mirrors the multi-tab model in renderer/app.js.
// Row *contents* are cached by TanStack Query; this store only tracks
// which rows are expanded.
import { create } from "zustand";
import type { Tab } from "../api/types";

let seq = 1;
function newTabSeq() {
  return seq++;
}

// Family stem for rules-tab titles (mirrors backend share key): numbered
// splits collapse to the family, locales stay separate.
export function shareKeyOf(file: string | null | undefined): string {
  const stem = String(file || "").replace(/\.json$/i, "");
  const m = stem.match(/_((?:Es_LA)|(?:Zh_Han[st])|De|En|Es|Fr|It|Ja|Ko|Pt)$/);
  let locale: string | null = null;
  let base = stem;
  if (m) {
    locale = m[1];
    base = stem.slice(0, -(locale.length + 1));
  }
  const family = base.replace(/\d+$/, "") || base;
  return locale ? `${family}_${locale}` : family;
}

interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
  active: () => Tab | null;
  findTableTab: (file: string, charPrefix: string) => Tab | null;
  findParamTab: (short: string, charPrefix: string) => Tab | null;
  findRulesTab: (file: string) => Tab | null;
  openTable: (file: string, charPrefix: string) => Tab;
  openParam: (short: string, charPrefix: string) => Tab;
  openRules: (file: string) => Tab;
  openSpecificTable: (file: string, charPrefix: string) => Tab;
  activate: (id: string) => void;
  close: (id: string) => void;
  closeOthers: (id: string) => void;
  patch: (id: string, p: Partial<Tab>) => void;
  toggleExpanded: (id: string, rowId: string) => void;
  setExpanded: (id: string, rowId: string, open: boolean) => void;
  reset: () => void;
  replaceAll: (tabs: Tab[], activeTabId: string | null) => void;
  serialize: () => { openTabs: any[]; activeTab: any | null };
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
    autoId: null,
    flash: null,
  };
}

function specKey(s: { kind?: string; file?: string | null; short?: string | null; charPrefix?: string }): string {
  return `${s.kind || ""}:${s.kind === "param" ? s.short || "" : s.file || ""}:${s.charPrefix || ""}`;
}

export function tabTitle(t: Tab): string {
  if (t.kind === "table" && t.file) return t.file.replace(/\.json$/i, "");
  if (t.kind === "param") return t.short ?? "?";
  if (t.kind === "rules") return `${t.familyKey || shareKeyOf(t.file)} — Rules`;
  return "?";
}

export function tabTooltip(t: Tab): string {
  const base = tabTitle(t);
  return t.charPrefix ? `${base} · filter ${t.charPrefix}` : base;
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  active: () => get().tabs.find((t) => t.id === get().activeTabId) || null,

  findTableTab: (file, charPrefix) =>
    get().tabs.find((x) => x.kind === "table" && x.file === file && (x.charPrefix || "") === (charPrefix || "")) || null,

  findParamTab: (short, charPrefix) =>
    get().tabs.find((x) => x.kind === "param" && x.short === short && (x.charPrefix || "") === (charPrefix || "")) || null,

  findRulesTab: (file) => get().tabs.find((x) => x.kind === "rules" && x.file === file) || null,

  openTable: (file, charPrefix) => {
    let t = get().findTableTab(file, charPrefix);
    if (!t) {
      t = mkTab("table", file, charPrefix);
      set((s) => ({ tabs: [...s.tabs, t!] }));
    }
    set({ activeTabId: t.id });
    return t;
  },

  openParam: (short, charPrefix) => {
    let t = get().findParamTab(short, charPrefix);
    if (!t) {
      t = mkTab("param", short, charPrefix);
      set((s) => ({ tabs: [...s.tabs, t!] }));
    }
    set({ activeTabId: t.id });
    return t;
  },

  openRules: (file) => {
    let t = get().findRulesTab(file);
    if (!t) {
      t = mkTab("rules", file, "");
      set((s) => ({ tabs: [...s.tabs, t!] }));
    }
    t.charPrefix = "";
    set({ activeTabId: t.id });
    return t;
  },

  // Jump targets: a fresh tab scoped to the row's own prefix when no
  // existing tab can show it.
  openSpecificTable: (file, charPrefix) => {
    const t = mkTab("table", file, charPrefix);
    set((s) => ({ tabs: [...s.tabs, t], activeTabId: t.id }));
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

  setExpanded: (id, rowId, open) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t;
        const has = t.expanded.includes(rowId);
        if (open === has) return t;
        return { ...t, expanded: open ? [...t.expanded, rowId] : t.expanded.filter((x) => x !== rowId) };
      }),
    })),

  reset: () => set({ tabs: [], activeTabId: null }),

  replaceAll: (tabs, activeTabId) => set({ tabs, activeTabId }),

  serialize: () => {
    const tabs = get().tabs;
    const active = tabs.find((t) => t.id === get().activeTabId) || null;
    return {
      openTabs: tabs.map((t) => ({
        kind: t.kind,
        file: t.file,
        short: t.short,
        charPrefix: t.charPrefix || "",
        statusFilter: t.statusFilter || "all",
        search: t.search || "",
        visibleFields: Array.isArray(t.visibleFields) ? t.visibleFields : null,
      })),
      activeTab: active
        ? { kind: active.kind, file: active.file, short: active.short, charPrefix: active.charPrefix || "" }
        : null,
    };
  },
}));

export function tabSpecKey(s: { kind?: string; file?: string | null; short?: string | null; charPrefix?: string }): string {
  return specKey(s);
}

export function makeRestoredTab(s: {
  kind: Tab["kind"];
  file?: string | null;
  short?: string | null;
  charPrefix?: string;
  statusFilter?: string;
  search?: string;
  visibleFields?: string[] | null;
}): Tab {
  const t = mkTab(s.kind, s.kind === "param" ? s.short || "" : s.file || "", s.kind === "rules" ? "" : s.charPrefix || "");
  t.statusFilter = s.statusFilter || "all";
  t.search = s.search || "";
  t.visibleFields = Array.isArray(s.visibleFields) ? s.visibleFields : null;
  return t;
}
