/**
 * Row shape for input_json/CharacterCursedEnergyDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterCursedEnergy'
 */
export type CharacterCursedEnergyDataTableRow = {
  Add_Rate_Solo: number;
  ID: string;
  LevelThreshold: readonly number[];
  Recover_Speed: number;
  Recover_Speed_Rate_Solo: number;
  Recover_Wait: number;
  Recover_Wait_Rate_Solo: number;
};

/** input_json/CharacterCursedEnergyDataTable.json — map of row key → row. */
export type CharacterCursedEnergyDataTableRowsMap = Readonly<Record<string, CharacterCursedEnergyDataTableRow>>;
