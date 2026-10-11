// Ephemeral UI state: sidebar/panel/palette/toasts/modals/prompt.
// Nothing here is persisted except via project:save-ui (handled in App).
import { create } from "zustand";

export type SideView = "explorer" | "search" | "changes";
export type ModalKind =
  | null
  | "openProject"
  | "newProject"
  | "newRow"
  | "cloneRow"
  | "mod"
  | "searchResults"
  | "textTools"
  | "snapshots"
  | "characters"
  | "settings"
  | "about"
  | "projectChanges"
  | "fieldDocs"
  | "refTargets"
  | "referencedBy"
  | "conflicts"
  | "checklist"
  | "moveset"
  | "exportConfirm"
  | "patchResult";

export interface PaletteItem {
  kind: "table" | "param" | "cmd";
  label: string;
  sub?: string;
  hint?: string;
  run: () => void;
}

interface Toast {
  id: number;
  msg: string;
  kind: "" | "error" | "success" | "warn";
}

export interface PromptField {
  label: string;
  value?: string;
  placeholder?: string;
  type?: "text" | "select";
  options?: Array<{ value: string; label: string }>;
}

interface PromptRequest {
  title: string;
  fields: PromptField[];
  okLabel: string;
  resolve: (v: string | string[] | null) => void;
}

export interface ValidationResult {
  total: number;
  counts: Record<string, number>;
  issues: any[];
}

interface UiState {
  sideView: SideView;
  sidebarOpen: boolean;
  showFilterPanel: boolean;
  charPickerAnchor: HTMLElement | null;
  panelOpen: boolean;
  panelView: string;
  problems: ValidationResult | null;
  busy: string | null;
  toasts: Toast[];
  modal: ModalKind;
  modalProps: any;
  promptReq: PromptRequest | null;
  palette: { open: boolean; mode: "files" | "cmd"; cmdLock: boolean; sel: number; items: PaletteItem[] };

  setSideView: (v: SideView) => void;
  toggleSidebar: () => void;
  setFilterPanel: (v: boolean) => void;
  setCharPicker: (el: HTMLElement | null) => void;
  setPanelOpen: (open: boolean, view?: string) => void;
  setProblems: (v: ValidationResult | null) => void;
  setBusy: (msg: string | null) => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  openModal: (m: ModalKind, props?: any) => void;
  closeModal: () => void;
  prompt: (title: string, fields: PromptField[], okLabel?: string) => Promise<string | string[] | null>;
  resolvePrompt: (v: string | string[] | null) => void;
  paletteOpen: (mode: "files" | "cmd", cmdLock?: boolean) => void;
  paletteClose: () => void;
  paletteSet: (p: Partial<UiState["palette"]>) => void;
}

let toastSeq = 1;

export const useUi = create<UiState>((set, get) => ({
  sideView: "explorer",
  sidebarOpen: true,
  showFilterPanel: false,
  charPickerAnchor: null,
  panelOpen: false,
  panelView: "problems",
  problems: null,
  busy: null,
  toasts: [],
  modal: null,
  modalProps: null,
  promptReq: null,
  palette: { open: false, mode: "files", cmdLock: false, sel: 0, items: [] },

  setSideView: (v) => set(() => ({ sideView: v, sidebarOpen: true })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setFilterPanel: (v: boolean) => set({ showFilterPanel: v }),
  setCharPicker: (el: HTMLElement | null) => set({ charPickerAnchor: el }),
  setPanelOpen: (open, view) => set((s) => ({ panelOpen: open, panelView: view || s.panelView })),
  setProblems: (v) => set({ problems: v }),
  setBusy: (msg) => set({ busy: msg }),
  toast: (msg, kind = "") => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, msg, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "error" ? 8000 : 4500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openModal: (m, props = null) => set({ modal: m, modalProps: props }),
  closeModal: () => set({ modal: null, modalProps: null }),
  prompt: (title, fields, okLabel = "OK") =>
    new Promise((resolve) => set({ promptReq: { title, fields, okLabel, resolve } })),
  resolvePrompt: (v) => {
    const r = get().promptReq;
    set({ promptReq: null });
    if (r) r.resolve(v);
  },
  paletteOpen: (mode, cmdLock = false) =>
    set({ palette: { open: true, mode, cmdLock: mode === "cmd" ? true : cmdLock, sel: 0, items: [] } }),
  paletteClose: () => set((s) => ({ palette: { ...s.palette, open: false } })),
  paletteSet: (p) => set((s) => ({ palette: { ...s.palette, ...p } })),
}));
