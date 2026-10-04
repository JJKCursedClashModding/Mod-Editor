/**
 * Row shape for input_json/SituationOverviewPoseDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_SituationOverviewPose'
 */
export type SituationOverviewPoseDataTableRow = {
  bVariationWeapon_Ally: readonly boolean[];
  bVariationWeapon_Enemy: readonly boolean[];
  ID: string;
  Id_AnimationWeapon_Ally: readonly string[];
  Id_AnimationWeapon_Enemy: readonly string[];
  Id_CharacterAnimation_Ally: string;
  Id_CharacterAnimation_Enemy: string;
  Id_CustomizeLabelText: string;
  Id_ShikigamiCharacterAnimation_Ally: string;
  Id_ShikigamiCharacterAnimation_Enemy: string;
  ImageFileName: string;
  ThumbnailImageFileName: string;
  WeaponAnimationName_Ally: readonly string[];
  WeaponAnimationName_Enemy: readonly string[];
  WeaponSocketName_Ally: readonly string[];
  WeaponSocketName_Enemy: readonly string[];
};

/** input_json/SituationOverviewPoseDataTable.json — map of row key → row. */
export type SituationOverviewPoseDataTableRowsMap = Readonly<Record<string, SituationOverviewPoseDataTableRow>>;
