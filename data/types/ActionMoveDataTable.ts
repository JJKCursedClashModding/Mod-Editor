/**
 * Row shape for input_json/ActionMoveDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ActionMove'
 */

import type { EGameActionRigidityType, EGameEasingType } from "../enums.js";

export type ActionMoveDataTableRow = {
  Foreground_Angle: number;
  Foreground_Speed_Rate: number;
  Guard_Inertia_Rate: number;
  Guard_Inertia_RateZ: number;
  GuardAir_Blend_Exp: number;
  GuardAir_EasingType: EGameEasingType;
  GuardAir_Inertia_Rate: number;
  GuardAir_Inertia_RateZ: number;
  GuardAir_InterpolateTime: number;
  GuardAir_Speed_End: number;
  GuardAir_Speed_Start: number;
  ID: string;
  Landing_Inertia_Rate: number;
  Landing_Inertia_RateZ: number;
  ParallelAttack_Speed_Rate: number;
  Rigidity_Landing: EGameActionRigidityType;
  Run_Blend_Exp: number;
  Run_EasingType: EGameEasingType;
  Run_Inertia_Rate: number;
  Run_Inertia_Time: number;
  Run_InterpolateTime: number;
  Run_Lean_Max: number;
  Run_Lean_Rate: number;
  Run_Rotation_Rate: number;
  Run_Rotation_Time: number;
  Run_Speed_End: number;
  Run_Speed_Start: number;
  Target_Speed_Distance: number;
  Target_Speed_Rate: number;
};

/** input_json/ActionMoveDataTable.json — map of row key → row. */
export type ActionMoveDataTableRowsMap = Readonly<Record<string, ActionMoveDataTableRow>>;
