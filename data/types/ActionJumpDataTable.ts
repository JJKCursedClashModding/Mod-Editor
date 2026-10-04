/**
 * Merged row shape for split DataTables: ActionJumpDataTable1.json, ActionJumpDataTable2.json, ActionJumpDataTable3.json, ActionJumpDataTable4.json, ActionJumpDataTable5.json.
 * Row keys are unique across all parts (same schema).
 * UE row struct: Class'GameDataTableRow_ActionJump'
 */

import type { EGameActionRigidityType, EGameEasingType } from "../enums.js";

export type ActionJumpDataTableRow = {
  BounceUp_Blend_Exp: number;
  BounceUp_EasingType: EGameEasingType;
  BounceUp_Inertia_Rate: number;
  BounceUp_Inertia_Time: number;
  BounceUp_InterpolateTime: number;
  BounceUp_Speed_Start: number;
  BounceUp_XY_Speed_End: number;
  BounceUp_XY_Speed_Start: number;
  DashJump_Blend_Exp: number;
  DashJump_Inertia_Rate: number;
  DashJump_Inertia_Time: number;
  DashJump_Inherit_Inertia_Rate: number;
  DashJump_Inherit_Inertia_RateZ: number;
  DashJump_InterpolateTime: number;
  DashJump_Overtime: number;
  DashJump_Rotation_Speed: number;
  DashJump_Speed_End: number;
  DashJump_Speed_Start: number;
  DashJump_XY_Speed: number;
  Fall_Gravity: number;
  Fall_Rotation_Speed: number;
  Fall_Speed_Start: number;
  Fall_XY_Speed: number;
  ID: string;
  Jump_Blend_Exp: number;
  Jump_Inertia_Rate: number;
  Jump_Inertia_Time: number;
  Jump_Inherit_Inertia_Rate: number;
  Jump_Inherit_Inertia_RateZ: number;
  Jump_InterpolateTime: number;
  Jump_Minimum_Time: number;
  Jump_Overtime: number;
  Jump_Rotation_Rate: number;
  Jump_Speed_End: number;
  Jump_Speed_Start: number;
  Jump_XY_Speed: number;
  JumpAir_Blend_Exp: number;
  JumpAir_CancelInput_Time_Min: number;
  JumpAir_Inertia_Rate: number;
  JumpAir_Inertia_Time: number;
  JumpAir_Inherit_Inertia_Rate: number;
  JumpAir_Inherit_Inertia_RateZ: number;
  JumpAir_InterpolateTime: number;
  JumpAir_Overtime: number;
  JumpAir_Rotation_Rate: number;
  JumpAir_Speed_End: number;
  JumpAir_Speed_Start: number;
  JumpAir_XY_Speed: number;
  Rigidity_DashJumpBegin: EGameActionRigidityType;
  Rigidity_JumpAirBegin: EGameActionRigidityType;
  Rigidity_JumpBegin: EGameActionRigidityType;
  Rigidity_RunJumpBegin: EGameActionRigidityType;
  RunJump_Blend_Exp: number;
  RunJump_Inertia_Rate: number;
  RunJump_Inertia_Time: number;
  RunJump_Inherit_Inertia_Rate: number;
  RunJump_Inherit_Inertia_RateZ: number;
  RunJump_InterpolateTime: number;
  RunJump_Overtime: number;
  RunJump_Rotation_Speed: number;
  RunJump_Speed_End: number;
  RunJump_Speed_Start: number;
  RunJump_XY_Speed: number;
  RunJumpAir_Blend_Exp: number;
  RunJumpAir_Inertia_Rate: number;
  RunJumpAir_Inertia_Time: number;
  RunJumpAir_Inherit_Inertia_Rate: number;
  RunJumpAir_Inherit_Inertia_RateZ: number;
  RunJumpAir_InterpolateTime: number;
  RunJumpAir_Overtime: number;
  RunJumpAir_Rotation_Speed: number;
  RunJumpAir_Speed_End: number;
  RunJumpAir_Speed_Start: number;
  RunJumpAir_XY_Speed: number;
};

/** Merged ActionJumpDataTable1.json, ActionJumpDataTable2.json, ActionJumpDataTable3.json, ActionJumpDataTable4.json, ActionJumpDataTable5.json — map of row key → row. */
export type ActionJumpDataTableRowsMap = Readonly<Record<string, ActionJumpDataTableRow>>;
