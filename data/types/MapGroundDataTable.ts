/**
 * Row shape for input_json/MapGroundDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MapGround'
 */
export type MapGroundDataTableRow = {
  EffectAttribute: number;
  EffectColor: {
  X: number;
  Y: number;
  Z: number;
};
  ID: string;
  Id_Effect_Bound: string;
  Id_Effect_DashBegin: string;
  Id_Effect_Down: string;
  Id_Effect_Footstep: readonly string[];
  Id_Effect_Ground: readonly string[];
  Id_Effect_JumpBegin: string;
  Id_Effect_Landing: string;
  Id_SoundEffect_Bound: string;
  Id_SoundEffect_DashBegin: string;
  Id_SoundEffect_DashEnd: string;
  Id_SoundEffect_Down: string;
  Id_SoundEffect_Footstep: readonly string[];
  Id_SoundEffect_Ground: readonly string[];
  Id_SoundEffect_JumpBegin: string;
  Id_SoundEffect_Landing: string;
};

/** input_json/MapGroundDataTable.json — map of row key → row. */
export type MapGroundDataTableRowsMap = Readonly<Record<string, MapGroundDataTableRow>>;
