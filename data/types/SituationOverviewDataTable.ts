/**
 * Row shape for input_json/SituationOverviewDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_SituationOverview'
 */
export type SituationOverviewDataTableRow = {
  ID: string;
  Id_SituationOverviewPose: readonly string[];
};

/** input_json/SituationOverviewDataTable.json — map of row key → row. */
export type SituationOverviewDataTableRowsMap = Readonly<Record<string, SituationOverviewDataTableRow>>;
