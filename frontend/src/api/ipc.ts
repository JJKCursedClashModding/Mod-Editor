// Typed IPC bridge covering every channel in preload.js CHANNELS.
// Every call unwraps {ok, data/error} like the old `call(ch, ...args)`
// helper in renderer/app.js.
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
  pickDir: (key?: string) => ipc<string | null>("dialog:pick-dir", key),
  pickFile: (opts?: any) => ipc<string | null>("dialog:pick-file", opts),

  // projects
  projectList: () => ipc<InitData["projects"]>("project:list"),
  projectOpen: (name: string) => ipc<{ project: any; changed: ChangedCounts }>("project:open", name),
  projectCreate: (name: string) => ipc<{ project: any; projects: InitData["projects"] }>("project:create", name),
  projectDuplicate: (name: string, newName: string) =>
    ipc<{ project: any; projects: InitData["projects"] }>("project:duplicate", name, newName),
  projectRename: (name: string, newName: string) =>
    ipc<{ project: any; projects: InitData["projects"] }>("project:rename", name, newName),
  projectDelete: (name: string) =>
    ipc<{ projects: InitData["projects"]; currentProject: string | null }>("project:delete", name),
  projectReveal: () => ipc("project:reveal"),
  fileOpenOriginal: (file: string) => ipc<{ path: string }>("file:open-original", file),
  fileOpenProject: () => ipc<{ path: string }>("file:open-project"),
  projectSaveUi: (name: string, ui: { openTabs: any[]; activeTab: any | null }) =>
    ipc("project:save-ui", name, ui),

  // tables / rows
  tablesList: () => ipc<{ tables: TableEntry[]; changed: ChangedCounts; tablesError?: string }>("tables:list"),
  tableSchema: (file: string) =>
    ipc<{ schema: TableSchema; docs: { tableDesc?: string; docCount: number } }>("table:schema", file),
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
  rulesList: (file: string) =>
    ipc<{ rules: Rule[]; family: { key: string; members: string[] } }>("rules:list", file),
  rulesAdd: (file: string, rule: Partial<Rule>) =>
    ipc<{ rules: Rule[]; changed: ChangedCounts; affected: string[] }>("rules:add", file, rule),
  rulesUpdate: (file: string, ruleId: string, patch: Partial<Rule>) =>
    ipc<{ rules: Rule[]; changed: ChangedCounts; affected: string[] }>("rules:update", file, ruleId, patch),
  rulesDelete: (file: string, ruleId: string) =>
    ipc<{ rules: Rule[]; changed: ChangedCounts; affected: string[] }>("rules:delete", file, ruleId),
  rulesMove: (file: string, ruleId: string, dir: "up" | "down") =>
    ipc<{ rules: Rule[]; changed?: ChangedCounts; affected: string[] }>("rules:move", file, ruleId, dir),
  rulesMatchCount: (file: string, cond: any) =>
    ipc<{ match: number; total: number; error?: string }>("rules:match-count", file, cond),

  // params
  paramsRows: (short: string) =>
    ipc<{ rows: string[]; vanillaIds: string[]; comment: string; count: number; vanillaError?: string | null }>(
      "params:rows",
      short,
    ),
  paramVanilla: (short: string) =>
    ipc<{ ids: string[]; count: number; asset: string; valueKind: string }>("param:vanilla", short),
  paramGet: (short: string, rowId: string) => ipc<any>("param:get", short, rowId),
  paramClone: (short: string, rowId: string, newId: string) => ipc("param:clone", short, rowId, newId),
  paramSet: (short: string, rowId: string, value: any) => ipc("param:set", short, rowId, value),
  paramCreate: (short: string, rowId: string, baseId?: string, value?: any) =>
    ipc("param:create", short, rowId, baseId, value),
  paramDelete: (short: string, rowId: string) => ipc("param:delete", short, rowId),

  // characters
  charsList: () => ipc<{ chars: Array<{ prefix: string; name: string; source: string; tables?: number }> }>("chars:list"),
  charsSet: (id: string, name: string) => ipc<{ chars: Record<string, string> }>("chars:set", id, name),
  charsDelete: (id: string) => ipc<{ chars: Record<string, string> }>("chars:delete", id),

  // refs
  refsTargets: (file: string, rowId: string) => ipc<{ refs: any[] }>("refs:targets", file, rowId),
  refsReferencedBy: (value: string) => ipc<{ refs: any[] }>("refs:referenced-by", value),
  refsComplete: (field: string, prefix: string) => ipc<{ suggestions: Array<{ value: string; source: string }> }>("refs:complete", field, prefix),

  // docs
  docsField: (base: string, family: string, field: string, enumName?: string | null) =>
    ipc<any>("docs:field", base, family, field, enumName),
  docsSaveField: (base: string, field: string, desc: string) => ipc("docs:save-field", base, field, desc),
  docsSaveEnum: (enumName: string, member: string, desc: string) => ipc("docs:save-enum", enumName, member, desc),

  // search / text
  globalSearch: (q: string, limit = 300) => ipc<{ results: GlobalSearchHit[] }>("search:global", q, limit),
  i18nFind: (q: string, scope?: any) => ipc<{ matches: any[] }>("i18n:find", q, scope),
  i18nReplace: (targets: any[], find: string, replace: string) =>
    ipc<{ applied: number; changed: ChangedCounts }>("i18n:replace", targets, find, replace),
  i18nPropagateEn: (file: string, rowId: string) =>
    ipc<{ copied: number; srcFile: string; changed: ChangedCounts }>("i18n:propagate-en", file, rowId),

  // project tools
  diffProject: () => ipc<ProjectDiff>("diff:project"),
  diffProjects: (otherName: string) => ipc<{ tables: any; params: any }>("diff:projects", otherName),
  validateProject: () => ipc<{ total: number; counts: Record<string, number>; issues: any[] }>("validate:project"),
  historyState: () => ipc<{ canUndo: boolean; canRedo: boolean; undoDepth: number }>("history:state"),
  historyUndo: () => ipc<{ project: any; changed: ChangedCounts; history: any }>("history:undo"),
  historyRedo: () => ipc<{ project: any; changed: ChangedCounts; history: any }>("history:redo"),
  snapshotsList: () => ipc<any[]>("snapshots:list"),
  snapshotsCreate: (label: string) => ipc<{ snapshots: any[] }>("snapshots:create", label),
  snapshotsRestore: (file: string) => ipc<{ project: any; changed: ChangedCounts }>("snapshots:restore", file),
  snapshotsDelete: (file: string) => ipc<any[]>("snapshots:delete", file),
  conflictsScan: () => ipc<{ conflicts: any[]; modCount: number; myPriority: number }>("conflicts:scan"),
  checklistCharacter: (prefix: string) => ipc<{ core: any[]; extended: any[]; params: any[] }>("checklist:character", prefix),
  movesetCharacter: (prefix: string) => ipc<any>("moveset:character", prefix),

  // manifest / assets / registry
  manifestSave: (m: any) => ipc("manifest:save", m),
  assetsList: () => ipc<Array<{ src: string; dest: string }>>("assets:list"),
  assetsAddFile: () => ipc("assets:add-file"),
  assetsAddDir: () => ipc("assets:add-dir"),
  assetsRemove: (dest: string) => ipc("assets:remove", dest),
  registryGet: () => ipc<any[]>("registry:get"),
  registrySave: (text: string) => ipc<{ count: number }>("registry:save", text),

  // export / import / patch
  exportFolder: () => ipc<{ files: string[]; path: string; removed?: number; warnings: string[] }>("export:folder"),
  exportJjkmod: () => ipc<{ path?: string; cancelled?: boolean }>("export:jjkmod"),
  exportPreview: () =>
    ipc<{ folder: string; files: string[]; warnings: string[]; stats: any; bake: any }>("export:preview"),
  importFolder: () => ipc<{ cancelled?: boolean; projects: InitData["projects"]; project: any; warnings: string[] }>("import:folder"),
  patcherTest: () => ipc<any>("patcher:test"),

  prefixIndex: () => ipc<{ index: Record<string, Record<string, number>> }>("tables:prefix-index"),
};

/** Escape hatch for channels without a typed wrapper. */
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

export function onAutoExport(cb: (p: any) => void) {
  try {
    const api = window.jjkApi as any;
    return api?.onAutoExport(cb) ?? (() => {});
  } catch {
    return () => {};
  }
}
