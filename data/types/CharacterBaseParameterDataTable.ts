/**
 * Row shape for input_json/CharacterBaseParameterDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterBaseParameter'
 */
export type CharacterBaseParameterDataTableRow = {
  AttackRange: number;
  DownValue: number;
  Guard_Minimum_Time: number;
  GuardDurability: number;
  GuardDurability_Recover: number;
  GuardDurability_RecoverWaitTime: number;
  GuardDurability_Solo: number;
  HitPoint: number;
  HitPoint_Solo: number;
  ID: string;
  LargeCharacterDownRecoverTime: number;
};

/** input_json/CharacterBaseParameterDataTable.json — map of row key → row. */
export type CharacterBaseParameterDataTableRowsMap = Readonly<Record<string, CharacterBaseParameterDataTableRow>>;
