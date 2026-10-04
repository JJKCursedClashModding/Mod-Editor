/**
 * Row shape for input_json/CharacterVoiceGroupSetDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterVoiceGroupSet'
 */
export type CharacterVoiceGroupSetDataTableRow = {
  ID: string;
  Id_CharacterVoiceGroup_Attack: string;
  Id_CharacterVoiceGroup_CursedEnergyAttack1_1: string;
  Id_CharacterVoiceGroup_CursedEnergyAttack1_2: string;
  Id_CharacterVoiceGroup_CursedEnergyAttack1_3: string;
  Id_CharacterVoiceGroup_CursedEnergyAttack2_1: string;
  Id_CharacterVoiceGroup_CursedEnergyAttack2_2: string;
  Id_CharacterVoiceGroup_CursedEnergyAttack2_3: string;
  Id_CharacterVoiceGroup_Damage1: string;
  Id_CharacterVoiceGroup_DefaultAction: string;
  Id_CharacterVoiceGroup_Down: string;
  Id_CharacterVoiceGroup_ExtraAttack1: string;
  Id_CharacterVoiceGroup_ExtraAttack2: string;
  Id_CharacterVoiceGroup_Guard: string;
  Id_CharacterVoiceGroup_NormalAttack1: string;
  Id_CharacterVoiceGroup_NormalAttack1_1: string;
  Id_CharacterVoiceGroup_NormalAttack2: string;
  Id_CharacterVoiceGroup_NormalAttack2_1: string;
  Id_CharacterVoiceGroup_NormalAttack3: string;
  Id_CharacterVoiceGroup_NormalAttack3_1: string;
  Id_CharacterVoiceGroup_SituationAttack: string;
  Id_CharacterVoiceGroup_SpecialDamage: string;
  Id_CharacterVoiceGroup_SuperCursedEnergyAttack: string;
  Id_CharacterVoiceGroup_System: string;
  Id_CharacterVoiceGroup_Unique: string;
};

/** input_json/CharacterVoiceGroupSetDataTable.json — map of row key → row. */
export type CharacterVoiceGroupSetDataTableRowsMap = Readonly<Record<string, CharacterVoiceGroupSetDataTableRow>>;
