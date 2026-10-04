/**
 * Row shape for input_json/GlobalCorrectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_GlobalCorrect'
 */
export type GlobalCorrectDataTableRow = {
  Combo_Base: number;
  Combo_Blow: number;
  Combo_BlowLarge: number;
  Combo_BlowSmall: number;
  Combo_Casual: number;
  Combo_Damage: number;
  Combo_Down: number;
  Combo_Min: number;
  Combo_TagCombo: number;
  ComboDown_Casual: number;
  CursedEnergyExp_Base: number;
  CursedEnergyExp_Level: number;
  CursedEnergyExp_Max: number;
  CursedEnergyExp_Min: number;
  HyperArmor_Damage: number;
  ID: string;
  Rigidity_DashAirBegin: readonly number[];
  Rigidity_DashAirEnd: readonly number[];
  Rigidity_DashBegin: readonly number[];
  Rigidity_DashEnd: readonly number[];
  Rigidity_DashJumpBegin: readonly number[];
  Rigidity_JumpAirBegin: readonly number[];
  Rigidity_JumpBegin: readonly number[];
  Rigidity_Landing: readonly number[];
  Rigidity_RunJumpBegin: readonly number[];
  SuperArmor_Damage: number;
  TagCombo_DownDamage: number;
};

/** input_json/GlobalCorrectDataTable.json — map of row key → row. */
export type GlobalCorrectDataTableRowsMap = Readonly<Record<string, GlobalCorrectDataTableRow>>;
