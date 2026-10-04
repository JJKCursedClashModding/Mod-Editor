/**
 * Row shape for input_json/EffectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Effect'
 */

import type { EGameEffectGroundCheckTargetType, EGameEffectThroughDestructibleObjectType, EGameEffectType, EGameNullifiesEffectType } from "../enums.js";

export type EffectDataTableRow = {
  bIsEffectExternalForceEnabled: boolean;
  bNotControlDecalEnabled: boolean;
  bThroughBackgroundEnabled: boolean;
  bThroughCharacterEnabled: boolean;
  bThroughCharacterWallEnabled: boolean;
  Collision_Delay_Time: number;
  Collision_Priority: number;
  DecalScale: number;
  Effect_Ground_Height: readonly number[];
  EffectType: EGameEffectType;
  ExternalForce_FixedRange: number;
  ExternalForce_GravityCorrect: number;
  ExternalForce_Range: number;
  ExternalForce_Strength: number;
  ExternalForce_Time: number;
  FileName_BP: string;
  GroundCheckDistance: number;
  GroundCheckTargetType: EGameEffectGroundCheckTargetType;
  ID: string;
  Id_Damage: string;
  Id_Decal: readonly string[];
  Id_Effect_Disappear: readonly string[];
  Id_Effect_Ground: readonly string[];
  Id_EffectColorCorrect: string;
  Id_EffectMove: string;
  Id_SoundEffect: readonly string[];
  Id_SoundEffect_Disappear: readonly string[];
  Id_SoundEffect_Ground: string;
  Id_SoundEffect_Loop: string;
  Id_Trap_Background: readonly string[];
  Life_Distance: number;
  Life_Hit: number;
  Life_Time: number;
  NullifiesEffectType: EGameNullifiesEffectType;
  OffsetRotation: {
  Pitch: number;
  Roll: number;
  Yaw: number;
};
  PoolCount: number;
  PushExternalForce_Height: number;
  PushExternalForce_HeightOffset: number;
  PushExternalForce_Range: number;
  PushExternalForce_Strength: number;
  PushExternalForce_Time: number;
  RandomOffsetLocationMax: {
  X: number;
  Y: number;
  Z: number;
};
  RandomOffsetLocationMin: {
  X: number;
  Y: number;
  Z: number;
};
  RandomOffsetRotationMax: {
  Pitch: number;
  Roll: number;
  Yaw: number;
};
  RandomOffsetRotationMin: {
  Pitch: number;
  Roll: number;
  Yaw: number;
};
  ThroughDestructibleObjectType: EGameEffectThroughDestructibleObjectType;
};

/** input_json/EffectDataTable.json — map of row key → row. */
export type EffectDataTableRowsMap = Readonly<Record<string, EffectDataTableRow>>;
