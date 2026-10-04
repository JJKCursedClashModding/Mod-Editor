/**
 * Row shape for input_json/ActionStepDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ActionStep'
 */

import type { EGameEasingType } from "../enums.js";

export type ActionStepDataTableRow = {
  CoolTime: number;
  ID: string;
  Step_Blend_Exp: number;
  Step_EasingType: EGameEasingType;
  Step_HomingInvalidateDistance: number;
  Step_Inertia_Rate: number;
  Step_Inertia_Time: number;
  Step_InterpolateTime: number;
  Step_Speed_End: number;
  Step_Speed_Start: number;
  Step_Time: number;
  StepAir_Blend_Exp: number;
  StepAir_EasingType: EGameEasingType;
  StepAir_HomingInvalidateDistance: number;
  StepAir_Inertia_Rate: number;
  StepAir_Inertia_Time: number;
  StepAir_InterpolateTime: number;
  StepAir_Speed_End: number;
  StepAir_Speed_Start: number;
  StepAir_Time: number;
  StepAirEnd_PlayRate: number;
  StepEnd_PlayRate: number;
};

/** input_json/ActionStepDataTable.json — map of row key → row. */
export type ActionStepDataTableRowsMap = Readonly<Record<string, ActionStepDataTableRow>>;
