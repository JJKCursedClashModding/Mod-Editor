/**
 * Row shape for input_json/EffectColorCorrectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_EffectColorCorrect'
 */
export type EffectColorCorrectDataTableRow = {
  bCheckCameraLocation: boolean;
  bCheckCharacterLocation: boolean;
  bCheckLowerOnly: boolean;
  bCheckUpperOnly: boolean;
  bColorCorrectEnabled: boolean;
  bCullingEnabled: boolean;
  bUseAttackCollisionEnabled: boolean;
  ContrastRate: {
  W: number;
  X: number;
  Y: number;
  Z: number;
};
  CrossFadeTime: number;
  Culling_ScaleRate: number;
  DelayCorrectTime: number;
  FadeInTime: number;
  FadeOutTime: number;
  ForceCorrectTime: number;
  GainRate: {
  W: number;
  X: number;
  Y: number;
  Z: number;
};
  Height: number;
  ID: string;
  Id_RemoveEffectColorCorrect: readonly string[];
  NiagaraParameterName: string;
  PostProcessMaterial_Name: string;
  PostProcessMaterial_Time: number;
  PostProcessMaterial_Weight: number;
  Radius: number;
  SaturationRate: {
  W: number;
  X: number;
  Y: number;
  Z: number;
};
};

/** input_json/EffectColorCorrectDataTable.json — map of row key → row. */
export type EffectColorCorrectDataTableRowsMap = Readonly<Record<string, EffectColorCorrectDataTableRow>>;
