/**
 * Row shape for input_json/StoryMissionDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryMission'
 */
export type StoryMissionDataTableRow = {
  bAppearanceDisabled: boolean;
  bResultDisabled: boolean;
  ID: string;
  Id_Map: string;
  Id_StoryMissionWave: readonly string[];
  ResultEvaluationScoreRate: number;
};

/** input_json/StoryMissionDataTable.json — map of row key → row. */
export type StoryMissionDataTableRowsMap = Readonly<Record<string, StoryMissionDataTableRow>>;
