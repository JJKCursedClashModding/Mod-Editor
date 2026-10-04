/**
 * Row shape for input_json/TutorialWidgetDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_TutorialWidget'
 */

import type { EGameTutorialWidgetType } from "../enums.js";

export type TutorialWidgetDataTableRow = {
  bSwitchPlatformTutorialTexture: readonly boolean[];
  ID: string;
  Id_TutorialLabel: string;
  Id_TutorialMessage: string;
  TutorialTextureName: readonly string[];
  TutorialWidgetType: EGameTutorialWidgetType;
};

/** input_json/TutorialWidgetDataTable.json — map of row key → row. */
export type TutorialWidgetDataTableRowsMap = Readonly<Record<string, TutorialWidgetDataTableRow>>;
