/**
 * Row shape for input_json/PvEMissionWaveLotteryDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PvEMissionWaveLottery'
 */

import type { EGameBattleResultEvaluation } from "../enums.js";

export type PvEMissionWaveLotteryDataTableRow = {
  bBoss: readonly boolean[];
  EvaluationMax: readonly EGameBattleResultEvaluation[];
  EvaluationMin: readonly EGameBattleResultEvaluation[];
  ID: string;
  Id_MissionWave: readonly string[];
  Weights: readonly number[];
};

/** input_json/PvEMissionWaveLotteryDataTable.json — map of row key → row. */
export type PvEMissionWaveLotteryDataTableRowsMap = Readonly<Record<string, PvEMissionWaveLotteryDataTableRow>>;
