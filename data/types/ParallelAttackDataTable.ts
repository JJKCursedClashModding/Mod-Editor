/**
 * Row shape for input_json/ParallelAttackDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ParallelAttack'
 */
export type ParallelAttackDataTableRow = {
  CharacterAnimation: string;
  CharacterAnimation_Lower: string;
  ID: string;
};

/** input_json/ParallelAttackDataTable.json — map of row key → row. */
export type ParallelAttackDataTableRowsMap = Readonly<Record<string, ParallelAttackDataTableRow>>;
