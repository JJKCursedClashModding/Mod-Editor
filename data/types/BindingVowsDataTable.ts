/**
 * Row shape for input_json/BindingVowsDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_BindingVows'
 */

import type { EGameBindingVowsDifficulty } from "../enums.js";

export type BindingVowsDataTableRow = {
  Difficulty: EGameBindingVowsDifficulty;
  ID: string;
  Id_BindingVowsEffect: readonly string[];
};

/** input_json/BindingVowsDataTable.json — map of row key → row. */
export type BindingVowsDataTableRowsMap = Readonly<Record<string, BindingVowsDataTableRow>>;
