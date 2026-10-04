/**
 * Row shape for input_json/CommandListDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CommandList'
 */

import type { EGameCommandListAttackPropertyType } from "../enums.js";

export type CommandListDataTableRow = {
  CommandListAttackPropertyType_CursedEnergyAttack_1: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_CursedEnergyAttack_2: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_ExtraAttack_1: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_ExtraAttack_2: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_NormalAttack_1: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_NormalAttack_1_1: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_NormalAttack_2: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_NormalAttack_2_1: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_NormalAttack_3: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_NormalAttack_3_1: readonly EGameCommandListAttackPropertyType[];
  CommandListAttackPropertyType_SuperCursedEnergyAttack: readonly EGameCommandListAttackPropertyType[];
  ID: string;
  Id_CommandListText_CharacterDescription: string;
  Id_CommandListText_CursedEnergyAttack_1_Description: string;
  Id_CommandListText_CursedEnergyAttack_1_Name: string;
  Id_CommandListText_CursedEnergyAttack_2_Description: string;
  Id_CommandListText_CursedEnergyAttack_2_Name: string;
  Id_CommandListText_ExtraAttack_1_Description: string;
  Id_CommandListText_ExtraAttack_1_Name: string;
  Id_CommandListText_ExtraAttack_2_Description: string;
  Id_CommandListText_ExtraAttack_2_Name: string;
  Id_CommandListText_NormalAttack_1_1_Description: string;
  Id_CommandListText_NormalAttack_1_1_Name: string;
  Id_CommandListText_NormalAttack_1_Description: string;
  Id_CommandListText_NormalAttack_1_Name: string;
  Id_CommandListText_NormalAttack_2_1_Description: string;
  Id_CommandListText_NormalAttack_2_1_Name: string;
  Id_CommandListText_NormalAttack_2_Description: string;
  Id_CommandListText_NormalAttack_2_Name: string;
  Id_CommandListText_NormalAttack_3_1_Description: string;
  Id_CommandListText_NormalAttack_3_1_Name: string;
  Id_CommandListText_NormalAttack_3_Description: string;
  Id_CommandListText_NormalAttack_3_Name: string;
  Id_CommandListText_PassiveDescription: readonly string[];
  Id_CommandListText_PassiveName: readonly string[];
  Id_CommandListText_SuperCursedEnergyAttack_Description: string;
  Id_CommandListText_SuperCursedEnergyAttack_Name: string;
  Id_CommandListText_TagComboAttack_Name: string;
};

/** input_json/CommandListDataTable.json — map of row key → row. */
export type CommandListDataTableRowsMap = Readonly<Record<string, CommandListDataTableRow>>;
