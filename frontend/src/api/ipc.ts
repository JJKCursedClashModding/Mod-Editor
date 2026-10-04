// Typed IPC bridge. Every call unwraps {ok, data/error} like the old
// `call(ch, ...args)` helper in renderer/app.js, but with channel typings.
import type {
  ChangedCounts,
  ParamAsset,
  ProjectDiff,
  RowData,
  RowSummary,
  Rule,
  TableEntry,
  TableSchema,
  GlobalSearchHit,
} from "./types";

function bridge() {
  const api = window.jjkApi;
  if (!api) throw new Error("Electron bridge unavailable (window.jjkApi). Run inside Electron, not plain vite dev.");
  return api;
}

export async function ipc<T>(channel: string, ...args: any[]): Promise<T> {
  const r = await bridge()[channel](...args);
  if (!r || !r.ok) throw new Error((r && r.error) || `IPC failed: ${channel}`);
  return r.data as T;
}

// ---- init / config ----
export interface InitData {
  config: any;
  projects: Array<{ name: string; title?: string; version?: string; updated?: number }>;
  currentProject: string | null;
  project: any | null;
  tables: TableEntry[];
  tablesError?: string | null;
  changed: ChangedCounts;
  enums: any[];
  chars: Record<string, string>;
  paramAssets: ParamAsset[];
  ruleOps: any[];
  condOps: any[];
}

export const api = {
  init: () => ipc<InitData>("state:init"),
  saveSettings: (patch: any) => ipc<any>("settings:save", patch),
  configGet: () => ipc<any>("config:get"),

  // projects
  projectList: () => ipc<InitData["projects"]>("project:list"),
  projectOpen: (name: string) => ipc<{ project: any; changed: ChangedCounts }>("project:open", name),
  projectCreate: (name: string) => ipc<{ project: any; projects: InitData["projects"] }>("project:create", name),
  projectSaveUi: (name: string, ui: { openTabs: any[]; activeTab: string | null }) =>
    ipc("project:save-ui", name, ui),

  // tables / rows
  tableSchema: (file: string) => ipc<{ schema: TableSchema; docs: { tableDesc?: string; docCount: number } }>("table:schema", file),
  tableRows: (file: string, opts: { charPrefix?: string; search?: string; offset?: number; limit?: number }) =>
    ipc<{ total: number; rows: RowSummary[] }>("table:rows", file, opts),
  rowGet: (file: string, rowId: string) => ipc<RowData>("row:get", file, rowId),
  rowSetField: (file: string, rowId: string, fieldPath: string, value: any) =>
    ipc<{ warning?: string | null; changed: ChangedCounts }>("row:set-field", file, rowId, fieldPath, value),
  rowResetField: (file: string, rowId: string, fieldPath: string) =>
    ipc<{ changed: ChangedCounts }>("row:reset-field", file, rowId, fieldPath),
  rowRevert: (file: string, rowId: string) => ipc<{ changed: ChangedCounts }>("row:revert", file, rowId),
  rowCreate: (file: string, newId: string, baseId?: string | null) =>
    ipc<{ changed: ChangedCounts }>("row:create", file, newId, baseId),
  rowDelete: (file: string, rowId: string) => ipc<{ changed: ChangedCounts }>("row:delete", file, rowId),

  // rules
  rulesList: (file: string) => ipc<{ rules: Rule[]; family: { key: string; members: string[] } }>("rules:list", file),
  rulesAdd: (file: string, rule: Partial<Rule>) =>
    ipc<{ rules: Rule[]; changed: ChangedCounts; affected: string[] }>("rules:add", file, rule),
  rulesUpdate: (file: string, ruleId: string, patch: Partial<Rule>) =>
    ipc<{ rules: Rule[]; changed: ChangedCounts; affected: string[] }>("rules:update", file, ruleId, patch),
  rulesDelete: (file: string, ruleId: string) =>
    ipc<{ rules: Rule[]; changed: ChangedCounts; affected: string[] }>("rules:delete", file, ruleId),
  rulesMove: (file: string, ruleId: string, dir: "up" | "down") =>
    ipc<{ rules: Rule[]; changed?: ChangedCounts; affected: string[] }>("rules:move", file, ruleId, dir),

  // params
  paramsRows: (short: string) =>
    ipc<{ rows: string[]; vanillaIds: string[]; comment: string; count: number; vanillaError?: string | null }>(
      "params:rows",
      short,
    ),
  paramGet: (short: string, rowId: string) => ipc<any>("param:get", short, rowId),
  paramSet: (short: string, rowId: string, value: any) => ipc("param:set", short, rowId, value),
  paramCreate: (short: string, rowId: string, baseId?: string, value?: any) =>
    ipc("param:create", short, rowId, baseId, value),
  paramDelete: (short: string, rowId: string) => ipc("param:delete", short, rowId),

  // misc
  prefixIndex: () => ipc<{ index: Record<string, Record<string, number>> }>("tables:prefix-index"),
  paramVanilla: (short: string) => ipc<{ ids: string[]; count: number; asset: string; valueKind: string }>("param:vanilla", short),
  globalSearch: (q: string, limit = 300) => ipc<{ results: GlobalSearchHit[] }>("search:global", q, limit),
  diffProject: () => ipc<ProjectDiff>("diff:project"),
  validateProject: () => ipc<any>("validate:project"),
  historyState: () => ipc<{ canUndo: boolean; canRedo: boolean; undoDepth: number }>("history:state"),
  historyUndo: () => ipc<{ project: any; changed: ChangedCounts; history: any }>("history:undo"),
  historyRedo: () => ipc<{ project: any; changed: ChangedCounts; history: any }>("history:redo"),
  exportFolder: () => ipc<any>("export:folder"),
  exportJjkmod: () => ipc<any>("export:jjkmod"),
  exportPreview: () =>
    ipc<{ folder: string; files: string[]; warnings: string[]; stats: any; bake: any }>("export:preview"),
  docsField: (base: string, family: string, field: string, enumName?: string | null) =>
    ipc<any>("docs:field", base, family, field, enumName),
  refsReferencedBy: (value: string) => ipc<{ refs: any[] }>("refs:referenced-by", value),
  snapshotsList: () => ipc<any[]>("snapshots:list"),
  snapshotsCreate: (label: string) => ipc<any>("snapshots:create", label),
  snapshotsRestore: (file: string) => ipc<any>("snapshots:restore", file),
};

/** Escape hatch for channels without a typed wrapper (snapshots, manifest, …). */
export function ipcRaw<T = any>(channel: string, ...args: any[]): Promise<T> {
  return ipc<T>(channel, ...args);
}

export function onMenuAction(cb: (action: string, payload: any) => void) {
  try {
    return window.jjkApi?.onMenuAction(cb) ?? (() => {});
  } catch {
    return () => {};
  }
}
