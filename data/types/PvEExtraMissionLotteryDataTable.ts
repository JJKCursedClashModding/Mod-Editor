/**
 * Row shape for input_json/PvEExtraMissionLotteryDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PvEExtraMissionLottery'
 */
export type PvEExtraMissionLotteryDataTableRow = {
  ID: string;
  Id_GlobalThreshold: string;
  Probability: number;
};

/** input_json/PvEExtraMissionLotteryDataTable.json — map of row key → row. */
export type PvEExtraMissionLotteryDataTableRowsMap = Readonly<Record<string, PvEExtraMissionLotteryDataTableRow>>;
