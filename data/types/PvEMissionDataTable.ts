/**
 * Row shape for input_json/PvEMissionDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PvEMission'
 */
export type PvEMissionDataTableRow = {
  ID: string;
  Id_BindingVowsLottery: readonly string[];
  Id_Map: string;
  Id_PvECalculation_Experience: string;
  Id_PvECalculation_Money: string;
  Id_PvECalculation_RiskValue: string;
  Id_PvEMissionWaveLottery: readonly string[];
  Weights: readonly number[];
};

/** input_json/PvEMissionDataTable.json — map of row key → row. */
export type PvEMissionDataTableRowsMap = Readonly<Record<string, PvEMissionDataTableRow>>;
