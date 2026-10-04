/**
 * Row shape for input_json/BindingVowsEffectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_BindingVowsEffect'
 */

import type { EGameBindingVowsEffectType } from "../enums.js";

export type BindingVowsEffectDataTableRow = {
  EffectType: EGameBindingVowsEffectType;
  EffectValue: readonly number[];
  ID: string;
  Id_BattleText: string;
};

/** input_json/BindingVowsEffectDataTable.json — map of row key → row. */
export type BindingVowsEffectDataTableRowsMap = Readonly<Record<string, BindingVowsEffectDataTableRow>>;
