/**
 * Row shape for input_json/RankingRecordDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_RankingRecord'
 */

import type { EGameRankingRecord } from "../enums.js";

export type RankingRecordDataTableRow = {
  ID: string;
  Priority: number;
  PrizeThreshold: number;
  RankingRecord: EGameRankingRecord;
};

/** input_json/RankingRecordDataTable.json — map of row key → row. */
export type RankingRecordDataTableRowsMap = Readonly<Record<string, RankingRecordDataTableRow>>;
