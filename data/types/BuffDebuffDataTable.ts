/**
 * Row shape for input_json/BuffDebuffDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_BuffDebuff'
 */

import type { EGameBuffDebuff } from "../enums.js";

export type BuffDebuffDataTableRow = {
  bEffectEnabled: boolean;
  BuffDebuff: EGameBuffDebuff;
  FloatValue: readonly number[];
  ID: string;
};

/** input_json/BuffDebuffDataTable.json — map of row key → row. */
export type BuffDebuffDataTableRowsMap = Readonly<Record<string, BuffDebuffDataTableRow>>;
