/**
 * Merged row shape for split DataTables: AttackDataTable1.json, AttackDataTable2.json, AttackDataTable3.json, AttackDataTable4.json, AttackDataTable5.json.
 * Row keys are unique across all parts (same schema).
 * UE row struct: Class'GameDataTableRow_Attack'
 */

import type { EGameAttackActionType, EGameAttackAvoidType, EGameAttackTransitionKind, EGameAttackTransitionType, EGameCharacterAttackVoiceType, EGameCharacterFacial, EGameCursedEnergyCalcType, EGameSimpleDomainCounterReceiveType, EGameTargetChangeType } from "../enums.js";

export type AttackDataTableRow = {
  AttackActionType: EGameAttackActionType;
  AttackAvoidType: EGameAttackAvoidType;
  AttackTiming: number;
  AttackTransitionKind: readonly EGameAttackTransitionKind[];
  AttackTransitionType: EGameAttackTransitionType;
  AutoComboFixedCursedEnergyLevel: number;
  AutoTransitionKind: EGameAttackTransitionKind;
  AutoTransitionKind_CursedEnergy: EGameAttackTransitionKind;
  bChangeLastHitNotTargetEnabled: boolean;
  bHyperArmorEnabled: boolean;
  BlendInTime_Fall: number;
  BlendInTime_Idle: number;
  bSuperArmorEnabled: boolean;
  bTargetOnlyHitAttackTransitionEnabled: boolean;
  bUpdateHomingLocation: boolean;
  CharacterAnimation: string;
  CharacterFacial: EGameCharacterFacial;
  ContinuousUseAttackVoiceType: EGameCharacterAttackVoiceType;
  CursedEnergy_Add: number;
  CursedEnergyCalcType: EGameCursedEnergyCalcType;
  DistanceDelayAttackTiming: number;
  ID: string;
  Id_ActionHoming: string;
  Id_CancelAttackActionHoming: string;
  Id_ParallelAttack: string;
  SimpleDomainCounterReceiveDelayTime: number;
  SimpleDomainCounterReceiveType: EGameSimpleDomainCounterReceiveType;
  TargetChangeType: EGameTargetChangeType;
  WeaponAnimation: string;
};

/** Merged AttackDataTable1.json, AttackDataTable2.json, AttackDataTable3.json, AttackDataTable4.json, AttackDataTable5.json — map of row key → row. */
export type AttackDataTableRowsMap = Readonly<Record<string, AttackDataTableRow>>;
