/**
 * Row shape for input_json/CharacterImageDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterImage'
 */
export type CharacterImageDataTableRow = {
  BattleCharacterIconAttackFileName: string;
  BattleCharacterIconCursedEnergyMaxFileName: string;
  BattleCharacterIconDamageFileName: string;
  BattleCharacterIconNormalFileName: string;
  BattleCharacterIconPinchFileName: string;
  BattleTalkImageFileName: string;
  CharacterSelectIconFileName: string;
  CharacterSelectVerticalIconFileName: string;
  CommandListIconFileName: string;
  CornerCutInImageChanceFileName: string;
  CornerCutInImagePinchFileName: string;
  CutInImageFileName: string;
  ID: string;
  OutGameBackgroundImageFileName: string;
  OutGameFaceIconFileName: string;
  OutGameImageFileName: string;
  RankingFilterIconFileName: string;
};

/** input_json/CharacterImageDataTable.json — map of row key → row. */
export type CharacterImageDataTableRowsMap = Readonly<Record<string, CharacterImageDataTableRow>>;
