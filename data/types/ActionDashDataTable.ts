/**
 * Merged row shape for split DataTables: ActionDashDataTable1.json, ActionDashDataTable2.json, ActionDashDataTable3.json, ActionDashDataTable4.json, ActionDashDataTable5.json.
 * Row keys are unique across all parts (same schema).
 * UE row struct: Class'GameDataTableRow_ActionDash'
 */

import type { EGameActionRigidityType } from "../enums.js";

export type ActionDashDataTableRow = {
  Dash_GaugeConsumeBegin: number;
  DashAir_GaugeConsumeBegin: number;
  Gauge: number;
  Gauge_Solo: number;
  GaugeRecover: number;
  GaugeRecoverWaitTime: number;
  HomingDashAir_Blend_Exp_E: number;
  HomingDashAir_Blend_Exp_M: number;
  HomingDashAir_CancelInput_Time: number;
  HomingDashAir_GaugeConsume: number;
  HomingDashAir_GaugeConsume_DelayTime: number;
  HomingDashAir_GaugeConsumeBegin: number;
  HomingDashAir_Inertia_Rate: number;
  HomingDashAir_Inertia_Time: number;
  HomingDashAir_InterpolateTime_E: number;
  HomingDashAir_InterpolateTime_M: number;
  HomingDashAir_Minimum_Time: number;
  HomingDashAir_Rotation_Speed: number;
  HomingDashAir_Speed_E: number;
  HomingDashAir_Speed_M: number;
  HomingDashAir_Speed_S: number;
  ID: string;
  NormalDash_Blend_Exp_E: number;
  NormalDash_Blend_Exp_M: number;
  NormalDash_CancelInput_Time: number;
  NormalDash_GaugeConsume: number;
  NormalDash_GaugeConsume_DelayTime: number;
  NormalDash_Inertia_Rate: number;
  NormalDash_Inertia_Time: number;
  NormalDash_InterpolateTime_E: number;
  NormalDash_InterpolateTime_M: number;
  NormalDash_Lean_Max: number;
  NormalDash_Lean_Rate: number;
  NormalDash_Minimum_Time: number;
  NormalDash_Rotation_Speed: number;
  NormalDash_Speed_E: number;
  NormalDash_Speed_M: number;
  NormalDash_Speed_S: number;
  NormalDash_Turn_DelayTime: number;
  NormalDashAir_Blend_Exp_E: number;
  NormalDashAir_Blend_Exp_M: number;
  NormalDashAir_CancelInput_Time: number;
  NormalDashAir_GaugeConsume: number;
  NormalDashAir_GaugeConsume_DelayTime: number;
  NormalDashAir_Gravity: number;
  NormalDashAir_Gravity_Delay_Time: number;
  NormalDashAir_Inertia_Rate: number;
  NormalDashAir_Inertia_Time: number;
  NormalDashAir_InterpolateTime_E: number;
  NormalDashAir_InterpolateTime_M: number;
  NormalDashAir_Minimum_Time: number;
  NormalDashAir_Rotation_Speed: number;
  NormalDashAir_Speed_E: number;
  NormalDashAir_Speed_M: number;
  NormalDashAir_Speed_S: number;
  NormalDashAir_Turn_DelayTime: number;
  Rigidity_DashAirBegin: EGameActionRigidityType;
  Rigidity_DashAirEnd: EGameActionRigidityType;
  Rigidity_DashBegin: EGameActionRigidityType;
  Rigidity_DashEnd: EGameActionRigidityType;
};

/** Merged ActionDashDataTable1.json, ActionDashDataTable2.json, ActionDashDataTable3.json, ActionDashDataTable4.json, ActionDashDataTable5.json — map of row key → row. */
export type ActionDashDataTableRowsMap = Readonly<Record<string, ActionDashDataTableRow>>;
