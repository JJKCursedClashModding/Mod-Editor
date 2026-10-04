/**
 * Row shape for input_json/GlobalDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Global'
 */

import type { EGameEasingType } from "../enums.js";

export type GlobalDataTableRow = {
  ArcadeResultFallWaitTime: number;
  ArcadeResultIdleWaitTime: number;
  ArcadeResultSpecialAttackWaitTime: number;
  ArcadeResultWaitTime: number;
  Battle_Chat_CoolTime: number;
  Battle_Chat_Limit_CoolTime: number;
  Battle_Chat_Limit_Count: number;
  Battle_Chat_Limit_Time: number;
  Battle_Chat_Type_CoolTime: number;
  BattleResult_Chat_CoolTime: number;
  BlowImpactRate_Down: number;
  BlowImpactRate_Knockback: number;
  BlowImpactTime_Down: number;
  BlowImpactTime_Knockback: number;
  BlowSpin_DamageGravity: number;
  Chase_CursedEnergyGaugeRecoverRate_End: number;
  Chase_CursedEnergyGaugeRecoverRate_Start: number;
  Chase_DashGaugeConsumeRate: number;
  Chase_Forward_Angle: number;
  Chase_Time: number;
  Chase_Time_Max: number;
  DamageGravity: number;
  DamageSpeed_Blend_Exp: number;
  DamageSpeed_EasingType: EGameEasingType;
  DamageSpeed_End: number;
  DamageSpeed_InterpolateTime: number;
  DamageSpeed_Start: number;
  DashAirFall_Speed_Max: number;
  Dead_Time: number;
  Down_Time_Max: number;
  Down_Time_Min: number;
  DownFall_Speed_Max: number;
  DownValue_Recover_Time: number;
  Escape_Back_Angle: number;
  Escape_CursedEnergyGaugeRecoverRate_End: number;
  Escape_CursedEnergyGaugeRecoverRate_Start: number;
  Escape_DashGaugeConsumeRate: number;
  Escape_Time: number;
  Escape_Time_Max: number;
  FixedPhrase_CoolTime: number;
  GroundBoundSlowRate: number;
  GroundBoundSlowStartTime: number;
  GroundBoundSlowTime: number;
  GroundBoundSpeedDecTime: number;
  GroundBoundSpeedRate: number;
  ID: string;
  Invincible_Dead_Time: number;
  Invincible_Getup_Time: number;
  JumpFall_Speed_Max: number;
  JustGuard_HitSlow_Attacker: number;
  JustGuard_HitSlow_Receiver: number;
  JustGuard_HitSlow_Time_Attacker: number;
  JustGuard_HitSlow_Time_Receiver: number;
  JustGuard_Time: number;
  LargeCharacterDamageDirection_Pitch: number;
  LargeCharacterDamageGravity: number;
  LargeCharacterDamageSpeed_Blend_Exp: number;
  LargeCharacterDamageSpeed_EasingType: EGameEasingType;
  LargeCharacterDamageSpeed_End: number;
  LargeCharacterDamageSpeed_InterpolateTime: number;
  LargeCharacterDamageSpeed_Start: number;
  LinkCombo_CoolTime: number;
  LinkCombo_CursedEnergyExp_Add: number;
  PvECostHealNum: number;
  PvECostHealPoint: number;
  PvELargeHPHealPoint: number;
  PvELargeHPHealRate: number;
  PvESmallHPHealPoint: number;
  PvESmallHPHealRate: number;
  ReceiveComboCount_Recover_Time: number;
  ShopLotteryPrice: number;
  TagComboDamageInvincibleTime: number;
  TagComboDamageSlowRate: number;
  TagComboDamageSlowTime: number;
  TimeLimit: readonly number[];
  UnlimitedVoidReceive_Time: number;
  VisualLobby_FixedPhrase_DisplayTime: number;
  WallBoundSlowRate: number;
  WallBoundSlowStartTime: number;
  WallBoundSlowTime: number;
  WallBoundSpeedDecTime: number;
  WallBoundSpeedRate: number;
};

/** input_json/GlobalDataTable.json — map of row key → row. */
export type GlobalDataTableRowsMap = Readonly<Record<string, GlobalDataTableRow>>;
