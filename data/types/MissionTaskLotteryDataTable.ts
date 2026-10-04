/**
 * Row shape for input_json/MissionTaskLotteryDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MissionTaskLottery'
 */
export type MissionTaskLotteryDataTableRow = {
  ID: string;
  Id_MissionTask: readonly string[];
  Weights: readonly number[];
};

/** input_json/MissionTaskLotteryDataTable.json — map of row key → row. */
export type MissionTaskLotteryDataTableRowsMap = Readonly<Record<string, MissionTaskLotteryDataTableRow>>;
