/**
 * Row shape for input_json/StoryChapterDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryChapter'
 */
export type StoryChapterDataTableRow = {
  BackgroundMovieFileName: string;
  ChapterIndex: number;
  ID: string;
  Id_Bgm: string;
  Id_PlayVoice_OnOpenMissionSelect: string;
  Id_PlayVoice_OnSelectMission: string;
  Id_PlayVoice_StartDialog: string;
  Id_StoryChapterTitle: string;
  Id_StoryDemo: readonly string[];
  SmallThumbnailFileName: string;
  ThumbnailFileName: string;
  UserProgressFlag: readonly number[];
};

/** input_json/StoryChapterDataTable.json — map of row key → row. */
export type StoryChapterDataTableRowsMap = Readonly<Record<string, StoryChapterDataTableRow>>;
