/**
 * Merged row shape for split DataTables: ActionHomingDataTable1.json, ActionHomingDataTable2.json, ActionHomingDataTable3.json, ActionHomingDataTable4.json, ActionHomingDataTable5.json.
 * Row keys are unique across all parts (same schema).
 * UE row struct: Class'GameDataTableRow_ActionHoming'
 */

import type { EGameActionHomingType, EGameEasingType, EGameWarpAdjustTargetSimulateType } from "../enums.js";

export type ActionHomingDataTableRow = {
  ActionHomingType: EGameActionHomingType;
  AngleZ: number;
  bExternalForceEnabled: boolean;
  bFollowGroundEnabled: boolean;
  bHyperArmorEnabled: boolean;
  bIgnoreHomingRange: boolean;
  bSuperArmorEnabled: boolean;
  CharacterAnimation: string;
  CharacterAnimation_Failure: string;
  Distance_Correct: number;
  ExternalForceGravityCorrect: number;
  ExternalForceRange: number;
  ExternalForceStrength_Blend_Exp: number;
  ExternalForceStrength_EasingType: EGameEasingType;
  ExternalForceStrength_End: number;
  ExternalForceStrength_InterpolateTime: number;
  ExternalForceStrength_Start: number;
  FollowGroundCheckDistance: number;
  FollowGroundFallGravity: number;
  FollowGroundIgnoreStepDistance: number;
  Homing_Delay_Time: number;
  Homing_Time_Max: number;
  Homing_Time_Min: number;
  HomingDistance: number;
  ID: string;
  Inertia_Rate: number;
  Inertia_Time: number;
  RangeZ_Lower: number;
  RangeZ_Upper: number;
  Rotation_Angle_Limit: number;
  Rotation_Speed_Blend_Exp: number;
  Rotation_Speed_EasingType: EGameEasingType;
  Rotation_Speed_End: number;
  Rotation_Speed_InterpolateTime: number;
  Rotation_Speed_Start: number;
  Rotation_Time: number;
  Rotation_Yaw: number;
  Speed_Blend_Exp: number;
  Speed_EasingType: EGameEasingType;
  Speed_End: number;
  Speed_InterpolateTime: number;
  Speed_Start: number;
  WarpAdjustTargetSimulateType: EGameWarpAdjustTargetSimulateType;
  WarpDirectionAdjustPitch: number;
  WarpDirectionAdjustYaw: number;
  WarpDistance: number;
  WarpTargetDistance: number;
  WeaponAnimation: string;
};

/** Merged ActionHomingDataTable1.json, ActionHomingDataTable2.json, ActionHomingDataTable3.json, ActionHomingDataTable4.json, ActionHomingDataTable5.json — map of row key → row. */
export type ActionHomingDataTableRowsMap = Readonly<Record<string, ActionHomingDataTableRow>>;
