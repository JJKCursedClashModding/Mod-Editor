/**
 * Row shape for input_json/ArcadeMissionDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ArcadeMission'
 */
export type ArcadeMissionDataTableRow = {
  ID: string;
  Id_Map: string;
  Id_MissionWave: readonly string[];
  ResultEvaluationScoreRate: number;
};

/** input_json/ArcadeMissionDataTable.json — map of row key → row. */
export type ArcadeMissionDataTableRowsMap = Readonly<Record<string, ArcadeMissionDataTableRow>>;
