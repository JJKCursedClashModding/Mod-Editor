/**
 * Row shape for input_json/PvEGrowthDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PvEGrowth'
 */
export type PvEGrowthDataTableRow = {
  CursedEnergyExpAddRate: number;
  CursedEnergyRecoverRate: number;
  DamageRate: number;
  DashGaugeMaxRate: number;
  EquipmentSlotNumber: number;
  ExperienceThreshold: number;
  GuardDurabilityMaxRate: number;
  HealPointNumber: number;
  HitPointMaxRate: number;
  ID: string;
};

/** input_json/PvEGrowthDataTable.json — map of row key → row. */
export type PvEGrowthDataTableRowsMap = Readonly<Record<string, PvEGrowthDataTableRow>>;
