/**
 * Row shape for input_json/PlayerCardEmblemDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PlayerCardEmblem'
 */

import type { EGameEmblemGradeType } from "../enums.js";

export type PlayerCardEmblemDataTableRow = {
  GradeType: EGameEmblemGradeType;
  ID: string;
  Id_Character: string;
};

/** input_json/PlayerCardEmblemDataTable.json — map of row key → row. */
export type PlayerCardEmblemDataTableRowsMap = Readonly<Record<string, PlayerCardEmblemDataTableRow>>;
