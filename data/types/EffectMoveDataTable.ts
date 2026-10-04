/**
 * Row shape for input_json/EffectMoveDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_EffectMove'
 */

import type { EGameEasingType, EGameEffectMoveType } from "../enums.js";

export type EffectMoveDataTableRow = {
  AlongGroundEffect_Height: number;
  AlongGroundHeight: number;
  bAlongGroundDownEnabled: boolean;
  bAlongGroundEnabled: boolean;
  bHomingEnabled: boolean;
  bIsStoppedOnAir: boolean;
  bTilt: boolean;
  Delay_Time: number;
  EffectMoveType: EGameEffectMoveType;
  Fall_AngularVelocityZ: number;
  Homing_AngularVelocityXY: number;
  Homing_AngularVelocityZ: number;
  Homing_Time: number;
  ID: string;
  Id_Effect_AlongGround: string;
  Limit_AngleXY: number;
  Limit_AngleZ: number;
  MoveDirection: {
  X: number;
  Y: number;
  Z: number;
};
  Speed_Blend_Exp: number;
  Speed_EasingType: EGameEasingType;
  Speed_End: number;
  Speed_InterpolateTime: number;
  Speed_Start: number;
};

/** input_json/EffectMoveDataTable.json — map of row key → row. */
export type EffectMoveDataTableRowsMap = Readonly<Record<string, EffectMoveDataTableRow>>;
