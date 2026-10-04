/**
 * Row shape for input_json/StoryMissionWaveDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryMissionWave'
 */
export type StoryMissionWaveDataTableRow = {
  ID: string;
  Id_BattleTalkSet: readonly string[];
  Id_MissionCharacter_Ally: readonly string[];
  Id_MissionWave: string;
  PlayableCharacterIndex: number;
};

/** input_json/StoryMissionWaveDataTable.json — map of row key → row. */
export type StoryMissionWaveDataTableRowsMap = Readonly<Record<string, StoryMissionWaveDataTableRow>>;
