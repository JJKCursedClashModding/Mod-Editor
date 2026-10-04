/**
 * Row shape for input_json/BannerDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Banner'
 */
export type BannerDataTableRow = {
  BannerTextureName: string;
  ID: string;
  Id_BannerMessage: string;
  SmallBannerTextureName: string;
  UserProgressFlag: number;
};

/** input_json/BannerDataTable.json — map of row key → row. */
export type BannerDataTableRowsMap = Readonly<Record<string, BannerDataTableRow>>;
