/**
 * Row shape for input_json/UniqueVoicePairDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_UniqueVoicePair'
 */

import type { EGameSequencerUniquePairType } from "../enums.js";

export type UniqueVoicePairDataTableRow = {
  ID: string;
  Id_Character: readonly string[];
  Id_Voice: readonly string[];
  SeuqnecerType: EGameSequencerUniquePairType;
};

/** input_json/UniqueVoicePairDataTable.json — map of row key → row. */
export type UniqueVoicePairDataTableRowsMap = Readonly<Record<string, UniqueVoicePairDataTableRow>>;
