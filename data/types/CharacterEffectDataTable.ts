/**
 * Row shape for input_json/CharacterEffectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterEffect'
 */
export type CharacterEffectDataTableRow = {
  BuffDebuffEffectScale: {
  X: number;
  Y: number;
  Z: number;
};
  bUseAuraEffectEnabled: boolean;
  CentipedeRestraintEffectOffset: {
  X: number;
  Y: number;
  Z: number;
};
  CrimsonBindEffectOffset: {
  X: number;
  Y: number;
  Z: number;
};
  CrimsonBindEffectScale: {
  X: number;
  Y: number;
  Z: number;
};
  CursedEnergy_AuraColor: {
  A: number;
  B: number;
  G: number;
  Hex: string;
  R: number;
};
  CursedEnergy_BrightAuraColor: {
  A: number;
  B: number;
  G: number;
  Hex: string;
  R: number;
};
  Disappear_FogColor: {
  A: number;
  B: number;
  G: number;
  Hex: string;
  R: number;
};
  Disappear_GlowColor: {
  A: number;
  B: number;
  G: number;
  Hex: string;
  R: number;
};
  FileName_BP: readonly string[];
  FreezingRestraintEffectOffset: {
  X: number;
  Y: number;
  Z: number;
};
  FreezingRestraintEffectScale: {
  X: number;
  Y: number;
  Z: number;
};
  ID: string;
  Id_Effect_CursedEnergy_Aura_2: string;
  Id_Effect_CursedEnergy_Aura_3: string;
  Id_Effect_CursedEnergy_LevelUp: string;
  Id_Effect_Tension_Aura_2: string;
  Id_Effect_Tension_Aura_3: string;
  Id_Effect_Tension_LevelUp: string;
  MapGroundEffectScale: {
  X: number;
  Y: number;
  Z: number;
};
  ProjectionSorceryEffectOffset: {
  X: number;
  Y: number;
  Z: number;
};
  ProjectionSorceryEffectScale: {
  X: number;
  Y: number;
  Z: number;
};
  ProjectionSorceryWeaponLocation: {
  X: number;
  Y: number;
  Z: number;
};
  ProjectionSorceryWeaponRotation: {
  Pitch: number;
  Roll: number;
  Yaw: number;
};
  SimpleDomainCounterEffectScale: {
  X: number;
  Y: number;
  Z: number;
};
};

/** input_json/CharacterEffectDataTable.json — map of row key → row. */
export type CharacterEffectDataTableRowsMap = Readonly<Record<string, CharacterEffectDataTableRow>>;
