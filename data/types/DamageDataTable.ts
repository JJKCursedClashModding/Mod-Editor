/**
 * Merged row shape for split DataTables: DamageDataTable1.json, DamageDataTable2.json, DamageDataTable3.json, DamageDataTable4.json, DamageDataTable5.json.
 * Row keys are unique across all parts (same schema).
 * UE row struct: Class'GameDataTableRow_Damage'
 */

import type { EGameAttackType, EGameCharacterDamageVoiceType, EGameCharacterSpecialDamageVoiceType, EGameDamageAdaptType, EGameDamageDirectionType, EGameDamageKind, EGameDamageType, EGameEasingType, EGameHitEffectDirection, EGameHitEffectLocationType, EGameHitTargetType } from "../enums.js";

export type DamageDataTableRow = {
  Ally_DamageRate: number;
  Armor_Damage: number;
  AttackType: EGameAttackType;
  bAutoHomingZDisabled: boolean;
  bBoundEnabled: boolean;
  bCancelCasualDamageActionCorrect: boolean;
  bCasualDamageActionCorrectEnabled: boolean;
  bGuardBuffDebuffAddEnabled: boolean;
  bHitOnce: boolean;
  bIgnoreComboCorrect: boolean;
  bIgnoreDamageActionCorrect: boolean;
  bIgnoreDamageDirectionPitch: boolean;
  bIgnoreGuard: boolean;
  bIgnoreHyperArmor: boolean;
  bIgnoreSuperArmor: boolean;
  bNullifiesCursedTechniquesEnabled: boolean;
  bUnkillable: boolean;
  CN_240_DamageRate: number;
  CursedEnergy_Add_Attacker: number;
  CursedEnergyExp_Add_Attacker: number;
  CursedEnergyExp_Add_Receiver: number;
  Damage: number;
  DamageAdaptType: EGameDamageAdaptType;
  DamageDirectionAdjustPitch: number;
  DamageDirectionAdjustYaw: number;
  DamageDirectionType: EGameDamageDirectionType;
  DamageGravity: number;
  DamageKind: EGameDamageKind;
  DamageSpeed_Blend_Exp: number;
  DamageSpeed_EasingType: EGameEasingType;
  DamageSpeed_End: number;
  DamageSpeed_InterpolateTime: number;
  DamageSpeed_Start: number;
  DamageType: EGameDamageType;
  DamageVoiceType: EGameCharacterDamageVoiceType;
  Destructible_Attack: number;
  Down_Damage: number;
  GroundBoundDecalScale: number;
  GroundBoundEffectScale: number;
  Guard_Rigidity_Time: number;
  GuardDirectionAdjustYaw: number;
  GuardDurability_Damage: number;
  GuardLookAtDirectionAdjustYaw: number;
  HitEffectDirection: EGameHitEffectDirection;
  HitEffectLocationType: EGameHitEffectLocationType;
  HitEffectRotation: {
  Pitch: number;
  Roll: number;
  Yaw: number;
};
  HitInterval: number;
  HitMax: number;
  HitSlow_Attacker: number;
  HitSlow_Guard_Attacker: number;
  HitSlow_Guard_Receiver: number;
  HitSlow_Receiver: number;
  HitSlow_Time_Attacker: number;
  HitSlow_Time_Guard_Attacker: number;
  HitSlow_Time_Guard_Receiver: number;
  HitSlow_Time_Receiver: number;
  HitTargetType: EGameHitTargetType;
  ID: string;
  Id_BuffDebuff_Add: readonly string[];
  Id_BuffDebuff_Remove: readonly string[];
  Id_CameraShake_Attacker: readonly string[];
  Id_CameraShake_Receiver: readonly string[];
  Id_CollisionModify: string;
  Id_Effect_Destructible_Hit: string;
  Id_Effect_Hit: string;
  Id_ForceFeedback_Attacker: string;
  Id_ForceFeedback_Receiver: string;
  Id_GroundBoundDecal: string;
  Id_SoundEffect: string;
  Knockback_Damage: number;
  Knockback_Damage_Time: number;
  Knockback_Guard: number;
  Knockback_Guard_Time: number;
  RestraintTime: number;
  SoundEffectPitchOffset: number;
  SpecialDamageVoiceType: EGameCharacterSpecialDamageVoiceType;
  TensionGauge_Add_Attacker: number;
};

/** Merged DamageDataTable1.json, DamageDataTable2.json, DamageDataTable3.json, DamageDataTable4.json, DamageDataTable5.json — map of row key → row. */
export type DamageDataTableRowsMap = Readonly<Record<string, DamageDataTableRow>>;
