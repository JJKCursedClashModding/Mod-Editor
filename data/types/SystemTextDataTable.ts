/**
 * Row shape for input_json/SystemTextDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_SystemText'
 */
export type SystemTextDataTableRow = {
  Ar: string;
  De: string;
  En: string;
  Es: string;
  Es_LA: string;
  Fr: string;
  ID: string;
  Ind: string;
  It: string;
  Ja: string;
  Ko: string;
  Pl: string;
  Pt: string;
  Ru: string;
  Th: string;
  Zh_Hans: string;
  Zh_Hant: string;
};

/** input_json/SystemTextDataTable.json — map of row key → row. */
export type SystemTextDataTableRowsMap = Readonly<Record<string, SystemTextDataTableRow>>;
