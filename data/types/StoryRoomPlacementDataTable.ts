/**
 * Row shape for input_json/StoryRoomPlacementDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryRoomPlacement'
 */
export type StoryRoomPlacementDataTableRow = {
  CameraName: string;
  CharacterAnimation: readonly string[];
  ID: string;
  Id_Character: readonly string[];
  Id_Map: string;
  LevelDesignName: string;
  MaterialPattern: readonly number[];
  PlacementName: readonly string[];
  VariationIndex: readonly number[];
};

/** input_json/StoryRoomPlacementDataTable.json — map of row key → row. */
export type StoryRoomPlacementDataTableRowsMap = Readonly<Record<string, StoryRoomPlacementDataTableRow>>;
