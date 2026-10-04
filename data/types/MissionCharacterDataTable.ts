/**
 * Row shape for input_json/MissionCharacterDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MissionCharacter'
 */

import type { EGameCharacterOperation, EGameCharacterSpecialTagComboLimit } from "../enums.js";

export type MissionCharacterDataTableRow = {
  AILevel: number;
  Armor_Damage_Rate: number;
  AutoCombo_Damage_Rate: number;
  bDamageMaterialEnabled: boolean;
  bResetCursedEnergyLevelEnabled: boolean;
  bSpecialTagComboSoloEnabled: boolean;
  CharacterSpecialTagComboLimit: EGameCharacterSpecialTagComboLimit;
  Cost: number;
  CursedEnergyExp_Add_Attacker_Rate: number;
  CursedEnergyExp_Add_Receiver_Rate: number;
  CursedEnergyLevel: number;
  Damage_Rate: number;
  Destructible_Attack_Rate: number;
  Down_Damage_Rate: number;
  GuardDurability_Damage_Rate: number;
  HitPoint: number;
  ID: string;
  Id_Action: string;
  Id_ActionDash: string;
  Id_ActionStep: string;
  Id_Character: string;
  Id_CharacterAnimationSet: string;
  Id_CharacterBaseParameter: string;
  Id_CharacterCursedEnergy: string;
  Id_CharacterSound: string;
  Id_CharacterSpecialAttack: string;
  MaterialPattern: number;
  Operation: EGameCharacterOperation;
  PassionGauge: number;
  PassionGauge_Add_Attacker_Rate: number;
  PoseIndex: number;
  TensionGauge_Add_Attacker_Rate: number;
  TensionLevel: number;
  UniqueMode: number;
  VariationIndex: number;
};

/** input_json/MissionCharacterDataTable.json — map of row key → row. */
export type MissionCharacterDataTableRowsMap = Readonly<Record<string, MissionCharacterDataTableRow>>;
