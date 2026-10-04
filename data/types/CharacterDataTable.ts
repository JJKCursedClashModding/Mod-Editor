/**
 * Row shape for input_json/CharacterDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Character'
 */

import type { EGameCharacterAIType, EGameCharacterActionControllerType, EGameCharacterActionType, EGameCharacterGroup, EGameCharacterPairGroup } from "../enums.js";

export type CharacterDataTableRow = {
  ActionControllerType: EGameCharacterActionControllerType;
  AIType: EGameCharacterAIType;
  AutoAimLimitAnglePitch: number;
  AutoAimLimitAngleYaw: number;
  AutoAttackDash_Distance: number;
  AutoAttackDash_NextActionType: EGameCharacterActionType;
  CharacterGroup: EGameCharacterGroup;
  CharacterPairGroup: EGameCharacterPairGroup;
  CullingBoundingBoxScale: {
  X: number;
  Y: number;
  Z: number;
};
  DamageRate_AutoCombo: number;
  FootIKLimit: readonly number[];
  ID: string;
  Id_Action: string;
  Id_Character_Transformation: string;
  Id_CharacterAnimationSet: string;
  Id_CharacterArcade: string;
  Id_CharacterBaseParameter: string;
  Id_CharacterCamera: string;
  Id_CharacterCapture: string;
  Id_CharacterChat: string;
  Id_CharacterCursedEnergy: string;
  Id_CharacterDecal: string;
  Id_CharacterEffect: string;
  Id_CharacterOperation: string;
  Id_CharacterSelect: string;
  Id_CharacterShikigami: readonly string[];
  Id_CharacterSpecialAttack: string;
  Id_CharacterTrap: readonly string[];
  Id_CharacterUI: string;
  Id_CharacterUnique: readonly string[];
  Id_CharacterVariation: readonly string[];
  Id_CommandList: string;
  Id_GlossaryText_Name: string;
  Id_GlossaryText_StoryName: string;
  Id_Item: string;
  Id_SituationOverview: string;
  LinkComboCursedEnergyExpRate: number;
  OverrideJustGuard_HitSlow_Attacker: number;
  OverrideJustGuard_HitSlow_Time_Attacker: number;
  PvEAllyWeights: number;
  SituationAttackVoicePlayDistance: number;
  StoryCharaGraphPlacementIndex: number;
};

/** input_json/CharacterDataTable.json — map of row key → row. */
export type CharacterDataTableRowsMap = Readonly<Record<string, CharacterDataTableRow>>;
