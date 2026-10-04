/**
 * Row shape for input_json/ActionBreakFallDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ActionBreakFall'
 */
export type ActionBreakFallDataTableRow = {
  Blow_CancelInput_Time: number;
  BlowLarge_CancelInput_Time: number;
  BlowSmall_CancelInput_Time: number;
  Down_CancelInput_Time: number;
  ID: string;
  Invincible_Time: number;
};

/** input_json/ActionBreakFallDataTable.json — map of row key → row. */
export type ActionBreakFallDataTableRowsMap = Readonly<Record<string, ActionBreakFallDataTableRow>>;
