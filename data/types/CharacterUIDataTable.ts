/**
 * Row shape for input_json/CharacterUIDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterUI'
 */

import type { EGameCharacterEnergyType, EGameCursedEnergyGaugeType } from "../enums.js";

export type CharacterUIDataTableRow = {
  CharacterEnergyType: EGameCharacterEnergyType;
  CursedEnergyGaugeType: EGameCursedEnergyGaugeType;
  ID: string;
  TargetCursorHeightRate: number;
};

/** input_json/CharacterUIDataTable.json — map of row key → row. */
export type CharacterUIDataTableRowsMap = Readonly<Record<string, CharacterUIDataTableRow>>;
