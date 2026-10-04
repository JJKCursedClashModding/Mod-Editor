/**
 * Row shape for input_json/TrapDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Trap'
 */

import type { EGameTrapActionType } from "../enums.js";

export type TrapDataTableRow = {
  ActionType: EGameTrapActionType;
  FileName_BP: string;
  ID: string;
};

/** input_json/TrapDataTable.json — map of row key → row. */
export type TrapDataTableRowsMap = Readonly<Record<string, TrapDataTableRow>>;
