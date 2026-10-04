/**
 * Row shape for input_json/CreditDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Credit'
 */

import type { EGameCreditContentType } from "../enums.js";

export type CreditDataTableRow = {
  ContentType: EGameCreditContentType;
  FontSize: number;
  ID: string;
  IsDlc1: boolean;
  IsDlc2: boolean;
  IsMain: boolean;
  IsShort: boolean;
  Justify: string;
  LetterSpacing: number;
  LineHeightPercentage: number;
  LineNumber: number;
  Text: string;
};

/** input_json/CreditDataTable.json — map of row key → row. */
export type CreditDataTableRowsMap = Readonly<Record<string, CreditDataTableRow>>;
