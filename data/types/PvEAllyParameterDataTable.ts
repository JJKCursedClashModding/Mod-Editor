/**
 * Row shape for input_json/PvEAllyParameterDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PvEAllyParameter'
 */
export type PvEAllyParameterDataTableRow = {
  CursedEnergyExpAddRate: number;
  CursedEnergyRecoverRate: number;
  DamageRate: number;
  DashGaugeMaxRate: number;
  GuardDurabilityMaxRate: number;
  HitPointMaxRate: number;
  ID: string;
  Id_GlobalThreshold: string;
};

/** input_json/PvEAllyParameterDataTable.json — map of row key → row. */
export type PvEAllyParameterDataTableRowsMap = Readonly<Record<string, PvEAllyParameterDataTableRow>>;
