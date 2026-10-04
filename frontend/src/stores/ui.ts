// Ephemeral UI state: sidebar/panel/palette/toasts/modals.
// Nothing here is persisted except via project:save-ui (handled in App).
import { create } from "zustand";

export type SideView = "explorer" | "search" | "changes";
export type ModalKind =
  | null
  | "newProject"
  | "openProject"
  | "newRow"
  | "cloneRow"
  | "mod"
  | "search"
  | "textTools"
  | "snapshots"
  | "characters"
  | "exportPreview";

interface Toast {
  id: number;
  msg: string;
  kind: "" | "error" | "success" | "warn";
}

interface UiState {
  sideView: SideView;
  sidebarOpen: boolean;
  panelOpen: boolean;
  busy: string | null;
  toasts: Toast[];
  modal: ModalKind;
  modalProps: any;

  setSideView: (v: SideView) => void;
  toggleSidebar: () => void;
  setPanelOpen: (open: boolean) => void;
  setBusy: (msg: string | null) => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  openModal: (m: ModalKind, props?: any) => void;
  closeModal: () => void;
}

let toastSeq = 1;

export const useUi = create<UiState>((set) => ({
  sideView: "explorer",
  sidebarOpen: true,
  panelOpen: false,
  busy: null,
  toasts: [],
  modal: null,
  modalProps: null,

  setSideView: (v) => set({ sideView: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setBusy: (msg) => set({ busy: msg }),
  toast: (msg, kind = "") => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, msg, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "error" ? 8000 : 4500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openModal: (m, props = null) => set({ modal: m, modalProps: props }),
  closeModal: () => set({ modal: null, modalProps: null }),
}));
