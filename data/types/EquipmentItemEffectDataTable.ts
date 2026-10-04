/**
 * Row shape for input_json/EquipmentItemEffectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_EquipmentItemEffect'
 */

import type { EGameEquipmentItemEffectType } from "../enums.js";

export type EquipmentItemEffectDataTableRow = {
  EffectType: EGameEquipmentItemEffectType;
  EffectValue: readonly number[];
  ID: string;
  Id_BattleText: string;
  Id_BuffDebuff: string;
};

/** input_json/EquipmentItemEffectDataTable.json — map of row key → row. */
export type EquipmentItemEffectDataTableRowsMap = Readonly<Record<string, EquipmentItemEffectDataTableRow>>;
