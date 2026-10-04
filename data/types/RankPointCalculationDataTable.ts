/**
 * Row shape for input_json/RankPointCalculationDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_RankPointCalculation'
 */
export type RankPointCalculationDataTableRow = {
  Evaluation_A: number;
  Evaluation_B: number;
  Evaluation_C: number;
  Evaluation_S: number;
  ForceGaugeRate: number;
  ID: string;
  RankGapRate: number;
  RankGapThreshold: number;
  Result_Draw: number;
  Result_Lose: number;
  Result_Win: number;
};

/** input_json/RankPointCalculationDataTable.json — map of row key → row. */
export type RankPointCalculationDataTableRowsMap = Readonly<Record<string, RankPointCalculationDataTableRow>>;
