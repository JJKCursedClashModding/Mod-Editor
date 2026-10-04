/**
 * Row shape for input_json/BindingVowsLotteryDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_BindingVowsLottery'
 */
export type BindingVowsLotteryDataTableRow = {
  ID: string;
  Id_BindingVows: readonly string[];
};

/** input_json/BindingVowsLotteryDataTable.json — map of row key → row. */
export type BindingVowsLotteryDataTableRowsMap = Readonly<Record<string, BindingVowsLotteryDataTableRow>>;
