/**
 * Row shape for input_json/ResultScoreDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ResultScore'
 */

import type { EGameResultScore } from "../enums.js";

export type ResultScoreDataTableRow = {
  ID: string;
  ResultScore: EGameResultScore;
  Score: number;
  Threshold: number;
  Threshold_Arcade: number;
  Threshold_PvE_Normal: number;
  Threshold_PvE_Survival: number;
  Threshold_Story: number;
  UpperLimit: number;
};

/** input_json/ResultScoreDataTable.json — map of row key → row. */
export type ResultScoreDataTableRowsMap = Readonly<Record<string, ResultScoreDataTableRow>>;
