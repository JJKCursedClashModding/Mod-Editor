/**
 * Row shape for input_json/MapDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Map'
 */
export type MapDataTableRow = {
  BloodColor: {
  X: number;
  Y: number;
  Z: number;
};
  CharacterContrast: number;
  CharacterLevelsBlack: number;
  CharacterLevelsMiddle: number;
  CharacterLevelsWhite: number;
  CharacterLightColor: {
  X: number;
  Y: number;
  Z: number;
};
  CharacterOverlayColor: {
  X: number;
  Y: number;
  Z: number;
};
  CharacterSaturation: number;
  CharacterShadowColor: {
  X: number;
  Y: number;
  Z: number;
};
  DecalColor: {
  X: number;
  Y: number;
  Z: number;
};
  EffectColor: {
  X: number;
  Y: number;
  Z: number;
};
  Filename: readonly string[];
  ID: string;
  Id_MapDecal: string;
  Id_MapEffect: string;
  Id_MapText: string;
  Id_MissionLayout: readonly string[];
  Id_SoundEffect: string;
  MapSelectIconFileName: string;
  MapSelectPlacementIndex: number;
  MiniMapFileName: string;
  ReverbRate: number;
  SequencerBloomIntensityOffset: number;
};

/** input_json/MapDataTable.json — map of row key → row. */
export type MapDataTableRowsMap = Readonly<Record<string, MapDataTableRow>>;
