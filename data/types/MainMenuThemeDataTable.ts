/**
 * Row shape for input_json/MainMenuThemeDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MainMenuTheme'
 */
export type MainMenuThemeDataTableRow = {
  ArcadeMovieFileName: string;
  CollectionMovieFileName: string;
  FreeBattleMovieFileName: string;
  ID: string;
  Id_Bgm: string;
  Id_Text: string;
  LobbyMovieFileName: string;
  ShopMovieFileName: string;
  SmallThumbnailTextureName: string;
  StoryMovieFileName: string;
  ThumbnailTextureName: string;
  UserProgressFlag: readonly number[];
  VsEnemyMovieFileName: string;
  VsPlayerMovieFileName: string;
};

/** input_json/MainMenuThemeDataTable.json — map of row key → row. */
export type MainMenuThemeDataTableRowsMap = Readonly<Record<string, MainMenuThemeDataTableRow>>;
