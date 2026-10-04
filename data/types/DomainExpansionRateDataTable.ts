/**
 * Row shape for input_json/DomainExpansionRateDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_DomainExpansionRate'
 */
export type DomainExpansionRateDataTableRow = {
  Damage_Rate: number;
  Dash_Cancel_Time_Rate: number;
  Dash_GaugeConsume_Rate: number;
  Dash_GaugeConsumeBegin_Rate: number;
  Dash_Speed_E_Rate: number;
  Dash_Speed_M_Rate: number;
  Dash_Speed_S_Rate: number;
  DashAir_GaugeConsume_Rate: number;
  DashAir_GaugeConsumeBegin_Rate: number;
  DashAir_Speed_E_Rate: number;
  DashAir_Speed_M_Rate: number;
  DashAir_Speed_S_Rate: number;
  Down_Damage_Rate: number;
  DownTime_Max_Add: number;
  DownTime_Min_Add: number;
  GuardDurability_Damage_Rate: number;
  HomingDashAir_GaugeConsume_Rate: number;
  HomingDashAir_GaugeConsumeBegin_Rate: number;
  HomingDashAir_Speed_E_Rate: number;
  HomingDashAir_Speed_M_Rate: number;
  HomingDashAir_Speed_S_Rate: number;
  ID: string;
  Run_Speed_End_Rate: number;
};

/** input_json/DomainExpansionRateDataTable.json — map of row key → row. */
export type DomainExpansionRateDataTableRowsMap = Readonly<Record<string, DomainExpansionRateDataTableRow>>;
