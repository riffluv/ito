export type ResetRoomKeepIds = string[] | null | undefined;
export type ResetRoomOptions = { notifyChat?: boolean; recallSpectators?: boolean };

export type StartGameOptions = {
  allowFromFinished?: boolean;
  allowFromClue?: boolean;
  autoDeal?: boolean;
  topicType?: string | null;
  customTopic?: string | null;
  sessionId?: string | null;
};

