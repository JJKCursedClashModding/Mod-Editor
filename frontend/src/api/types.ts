// Shared types mirroring the Electron backend (main.js + lib/*).
// Keep in sync with preload.js CHANNELS and renderer/app.js shapes.

export interface TableEntry {
  file: string;
  base: string;
  family: string;
  groupLabel: string;
  rows: number;
  locale?: string | null;
}

export interface ChangedCounts {
  [file: string]: { rules: number; overrides: number; newRows: number };
}

export interface ParamAsset {
  shortName: string;
  assetName: string;
  desc?: string;
}

export interface RowSummary {
  id: string;
  status: "default" | "edited" | "new" | "vanilla";
  changeCount: number;
  global: boolean;
  overrides: number;
  base?: string | null;
}

export interface FieldSchema {
  kind: string;
  enumName?: string | null;
}

export interface TableSchema {
  fields: Record<string, FieldSchema>;
  fieldOrder: string[];
}

export type TabKind = "table" | "param" | "rules";

export interface Tab {
  id: string;
  kind: TabKind;
  /** table/rules: vendor file; param: null */
  file: string | null;
  /** param: shortName; else null */
  short: string | null;
  /** snapshot of the global char filter at open time ("" = all) */
  charPrefix: string;
  statusFilter: string;
  search: string;
  visibleFields: string[] | null;
  /** expanded row ids, in open order */
  expanded: string[];
  familyKey?: string;
}

export interface RowData {
  isNew?: boolean;
  isParam?: boolean;
  base?: string | null;
  vanilla: any;
  effective?: any;
  value?: any;
  prov: Record<string, string>;
  fired?: Record<string, string[]>;
  rules?: any[];
  overrides?: Record<string, any>;
  schema?: TableSchema;
  enumDocs?: Record<string, any>;
  exists?: boolean;
  error?: string | null;
  vanillaError?: string | null;
}

export interface Rule {
  id: string;
  name?: string;
  disabled?: boolean;
  cond?: { field: string; op: string; value: any } | null;
  then: Array<{ field: string; op: string; value: any }>;
  else: Array<{ field: string; op: string; value: any }>;
}

export interface ProjectDiff {
  tables: Record<string, Record<string, any>>;
  params: Record<string, { new: string[]; modified: string[] }>;
  errors: string[];
}

export interface GlobalSearchHit {
  file: string;
  rowId: string;
  field?: string;
  snippet?: string;
  source?: string;
}
