/**
 * Row shape for input_json/RankPointDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_RankPoint'
 */

import type { EGameRankPointClass, EGameRankPointGrade } from "../enums.js";

export type RankPointDataTableRow = {
  ID: string;
  Id_GlobalThreshold: string;
  LoseLowerLimit: number;
  RankPointClass: EGameRankPointClass;
  RankPointGrade: EGameRankPointGrade;
};

/** input_json/RankPointDataTable.json — map of row key → row. */
export type RankPointDataTableRowsMap = Readonly<Record<string, RankPointDataTableRow>>;
