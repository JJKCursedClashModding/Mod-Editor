/**
 * Row shape for input_json/MissionOrderDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MissionOrder'
 */

import type { EGameBindingVowsEffectType, EGameMissionOrderType } from "../enums.js";

export type MissionOrderDataTableRow = {
  ExcludeBindingVowsEffectType: readonly EGameBindingVowsEffectType[];
  ID: string;
  Id_BattleText_OrderDetail: string;
  Id_BattleText_OrderName: string;
  OrderType: EGameMissionOrderType;
  Value: readonly number[];
};

/** input_json/MissionOrderDataTable.json — map of row key → row. */
export type MissionOrderDataTableRowsMap = Readonly<Record<string, MissionOrderDataTableRow>>;
