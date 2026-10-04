/**
 * Row shape for input_json/PvEMissionLotteryDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PvEMissionLottery'
 */
export type PvEMissionLotteryDataTableRow = {
  ID: string;
  Id_GlobalThreshold: string;
  Id_PvEMission: readonly string[];
  MissionWeights: readonly number[];
  Weights: number;
};

/** input_json/PvEMissionLotteryDataTable.json — map of row key → row. */
export type PvEMissionLotteryDataTableRowsMap = Readonly<Record<string, PvEMissionLotteryDataTableRow>>;
