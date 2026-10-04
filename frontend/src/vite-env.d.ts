/// <reference types="vite/client" />

// Preload bridge (see /preload.js). In a plain browser (vite dev without
// Electron) window.jjkApi is undefined — ipc.ts falls back to a helpful error.
interface JjkApi {
  [channel: string]: (...args: any[]) => Promise<{ ok: boolean; data?: any; error?: string }>;
  onMenuAction: (cb: (action: string, payload: any) => void) => () => void;
  onAutoExport: (cb: (payload: any) => void) => () => void;
}

declare global {
  interface Window {
    jjkApi?: JjkApi;
  }
}

export {};
