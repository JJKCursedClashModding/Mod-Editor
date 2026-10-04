/**
 * Row shape for input_json/StoryDemoDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryDemo'
 */
export type StoryDemoDataTableRow = {
  ID: string;
  Id_Character_Pair_Release_1: readonly string[];
  Id_Character_Pair_Release_2: readonly string[];
  Id_Character_Release: readonly string[];
  Id_ItemSet: readonly string[];
  Id_Script_PostBattle: string;
  Id_Script_PreBattle: string;
  Id_StoryCharaRelateChange: readonly string[];
  Id_StoryDemo: readonly string[];
  Id_StoryMission: string;
  Id_StoryMissionDetail: string;
  Id_StoryMissionTitle: string;
  Id_StoryRoomCondition: string;
  MissionIndex: number;
  SmallThumbnailFileName: string;
  ThumbnailFileName: string;
};

/** input_json/StoryDemoDataTable.json — map of row key → row. */
export type StoryDemoDataTableRowsMap = Readonly<Record<string, StoryDemoDataTableRow>>;
