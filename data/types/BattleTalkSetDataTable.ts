/**
 * Row shape for input_json/BattleTalkSetDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_BattleTalkSet'
 */

import type { EGameBattleLogConditionType, EGameBattleLogPassiveType, EGameBattleLogTargetType, EGameBattleLogValueType } from "../enums.js";

export type BattleTalkSetDataTableRow = {
  ConditionType: readonly EGameBattleLogConditionType[];
  CueSheetName: readonly string[];
  ID: string;
  Id_BattleTalk: readonly string[];
  PassiveType: readonly EGameBattleLogPassiveType[];
  TargetType: readonly EGameBattleLogTargetType[];
  Value: readonly number[];
  ValueType: readonly EGameBattleLogValueType[];
};

/** input_json/BattleTalkSetDataTable.json — map of row key → row. */
export type BattleTalkSetDataTableRowsMap = Readonly<Record<string, BattleTalkSetDataTableRow>>;
