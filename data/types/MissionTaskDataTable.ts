/**
 * Row shape for input_json/MissionTaskDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MissionTask'
 */

import type { EGameBattleLogConditionType, EGameBattleLogPassiveType, EGameBattleLogTargetType, EGameBattleLogValueType, EGameBindingVowsEffectType } from "../enums.js";

export type MissionTaskDataTableRow = {
  ConditionType: readonly EGameBattleLogConditionType[];
  ExcludeBindingVowsEffectType: readonly EGameBindingVowsEffectType[];
  ID: string;
  Id_BattleText_TaskDetail: readonly string[];
  PassiveType: readonly EGameBattleLogPassiveType[];
  TargetType: readonly EGameBattleLogTargetType[];
  Value: readonly number[];
  ValueType: readonly EGameBattleLogValueType[];
};

/** input_json/MissionTaskDataTable.json — map of row key → row. */
export type MissionTaskDataTableRowsMap = Readonly<Record<string, MissionTaskDataTableRow>>;
