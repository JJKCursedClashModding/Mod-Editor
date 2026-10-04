/**
 * Row shape for input_json/ActionDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Action'
 */
export type ActionDataTableRow = {
  ID: string;
  Id_ActionBreakFall: string;
  Id_ActionDash: string;
  Id_ActionJump: string;
  Id_ActionMove: string;
  Id_ActionStep: string;
  Id_AttackSet_CursedEnergy_1: readonly string[];
  Id_AttackSet_CursedEnergy_1_Auto: readonly string[];
  Id_AttackSet_CursedEnergy_2: readonly string[];
  Id_AttackSet_CursedEnergy_2_Auto: readonly string[];
  Id_AttackSet_CursedEnergy_Air_1: readonly string[];
  Id_AttackSet_CursedEnergy_Air_1_Auto: readonly string[];
  Id_AttackSet_CursedEnergy_Air_2: readonly string[];
  Id_AttackSet_CursedEnergy_Air_2_Auto: readonly string[];
  Id_AttackSet_Normal_1: string;
  Id_AttackSet_Normal_1_1: string;
  Id_AttackSet_Normal_1_1_Auto: string;
  Id_AttackSet_Normal_1_1_Solo: string;
  Id_AttackSet_Normal_1_1_Solo_Auto: string;
  Id_AttackSet_Normal_1_Auto: string;
  Id_AttackSet_Normal_2: string;
  Id_AttackSet_Normal_2_1: string;
  Id_AttackSet_Normal_2_1_Auto: string;
  Id_AttackSet_Normal_2_Auto: string;
  Id_AttackSet_Normal_3: string;
  Id_AttackSet_Normal_3_1: string;
  Id_AttackSet_Normal_3_1_Auto: string;
  Id_AttackSet_Normal_3_Auto: string;
  Id_AttackSet_Normal_Air_1: string;
  Id_AttackSet_Normal_Air_1_1: string;
  Id_AttackSet_Normal_Air_1_1_Auto: string;
  Id_AttackSet_Normal_Air_1_1_Solo: string;
  Id_AttackSet_Normal_Air_1_1_Solo_Auto: string;
  Id_AttackSet_Normal_Air_1_Auto: string;
  Id_AttackSet_Normal_Air_2: string;
  Id_AttackSet_Normal_Air_2_1: string;
  Id_AttackSet_Normal_Air_2_1_Auto: string;
  Id_AttackSet_Normal_Air_2_Auto: string;
  Id_AttackSet_Normal_Air_3: string;
  Id_AttackSet_Normal_Air_3_1: string;
  Id_AttackSet_Normal_Air_3_1_Auto: string;
  Id_AttackSet_Normal_Air_3_Auto: string;
  Id_AttackSet_SuperCursedEnergy: string;
  Id_AttackSet_SuperCursedEnergy_Air: string;
  Id_ExtraAttack_1: string;
  Id_ExtraAttack_2: string;
};

/** input_json/ActionDataTable.json — map of row key → row. */
export type ActionDataTableRowsMap = Readonly<Record<string, ActionDataTableRow>>;
