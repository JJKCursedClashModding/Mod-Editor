/**
 * Row shape for input_json/ForceFeedbackDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ForceFeedback'
 */

import type { EGameForceFeedbackChannel } from "../enums.js";

export type ForceFeedbackDataTableRow = {
  Duration: number;
  ForceFeedbackChannel: EGameForceFeedbackChannel;
  ID: string;
  Power: number;
};

/** input_json/ForceFeedbackDataTable.json — map of row key → row. */
export type ForceFeedbackDataTableRowsMap = Readonly<Record<string, ForceFeedbackDataTableRow>>;
