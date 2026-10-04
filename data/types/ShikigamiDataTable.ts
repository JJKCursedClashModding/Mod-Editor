/**
 * Row shape for input_json/ShikigamiDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Shikigami'
 */

import type { EGameShikigamiActionControllerType } from "../enums.js";

export type ShikigamiDataTableRow = {
  ActionControllerType: EGameShikigamiActionControllerType;
  AutoAttackDistance_Owner: number;
  AutoAttackDistance_Target: number;
  bImmortalityEnabled: boolean;
  bIsInstanceDeathEnabled: boolean;
  DownValue: number;
  FileName_BP: string;
  FootIKLimit: readonly number[];
  HitPoint: number;
  ID: string;
  Id_ActionDash: string;
  Id_ActionJump: string;
  Id_ActionMove: string;
  Id_CharacterEffect: string;
  Id_CharacterSound: string;
  Id_ShikigamiAnimation: readonly string[];
  Id_ShikigamiMaterial: string;
  Id_ShikigamiUnique: readonly string[];
  Id_ShikigamiVoiceGroup_Attack: string;
  Id_ShikigamiVoiceGroup_Damage: string;
  Id_ShikigamiVoiceGroup_DefaultAction: string;
  Id_ShikigamiVoiceGroup_Down: string;
  Id_ShikigamiVoiceGroup_Unique: string;
  OrderCoolTime: number;
  SummonCoolTime: number;
  SummonCursedEnergyLevel: number;
};

/** input_json/ShikigamiDataTable.json — map of row key → row. */
export type ShikigamiDataTableRowsMap = Readonly<Record<string, ShikigamiDataTableRow>>;
