import type { RoomDoc } from "@/lib/types";

export type RoomSyncPatchSource = "api" | "rtdb";

export type RoomSyncPatchCommand = "start" | "reset" | "next-round" | "unknown";

export type RoomSyncPatchRoom = {
  status?: RoomDoc["status"];
  statusVersion?: never;
  topic?: string | null;
  topicBox?: RoomDoc["topicBox"] | null;
  round?: number | null;
  ui?: {
    roundPreparing?: boolean;
    recallOpen?: boolean;
    revealPending?: boolean;
  };
};

export type RoomSyncPatchMeta = {
  source: RoomSyncPatchSource;
  command?: RoomSyncPatchCommand;
  requestId?: string | null;
  ts?: number;
};

export type RoomSyncPatch = {
  roomId: string;
  statusVersion: number;
  room: RoomSyncPatchRoom;
  meta: RoomSyncPatchMeta;
};

const readString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readBool = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const isRoomStatus = (value: unknown): value is RoomDoc["status"] =>
  value === "waiting" || value === "clue" || value === "reveal" || value === "finished";

const isTopicBox = (value: unknown): value is NonNullable<RoomDoc["topicBox"]> =>
  value === "通常版" || value === "レインボー版" || value === "クラシック版" || value === "カスタム";

const isSource = (value: unknown): value is RoomSyncPatchSource =>
  value === "api" || value === "rtdb";

const isCommand = (value: unknown): value is RoomSyncPatchCommand =>
  value === "start" || value === "reset" || value === "next-round" || value === "unknown";

export function parseRoomSyncPatch(value: unknown): RoomSyncPatch | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  const roomId = readString(root.roomId);
  const statusVersion = readNumber(root.statusVersion);
  const roomRaw = root.room;
  const metaRaw = root.meta;
  if (!roomId || statusVersion === null) return null;
  if (!roomRaw || typeof roomRaw !== "object") return null;
  if (!metaRaw || typeof metaRaw !== "object") return null;

  const roomObj = roomRaw as Record<string, unknown>;
  const metaObj = metaRaw as Record<string, unknown>;

  const source = metaObj.source;
  if (!isSource(source)) return null;
  const commandRaw = metaObj.command;
  const command = isCommand(commandRaw) ? commandRaw : undefined;
  const requestId = readString(metaObj.requestId) ?? null;
  const ts = readNumber(metaObj.ts) ?? undefined;

  const statusRaw = roomObj.status;
  const status = isRoomStatus(statusRaw) ? statusRaw : undefined;
  const topicRaw = roomObj.topic;
  const topic =
    topicRaw === null ? null : typeof topicRaw === "string" ? topicRaw : undefined;
  const topicBoxRaw = roomObj.topicBox;
  const topicBox =
    topicBoxRaw === null
      ? null
      : isTopicBox(topicBoxRaw)
        ? topicBoxRaw
        : undefined;
  const roundRaw = roomObj.round;
  const round =
    roundRaw === null ? null : typeof roundRaw === "number" && Number.isFinite(roundRaw) ? roundRaw : undefined;

  let ui: RoomSyncPatchRoom["ui"] | undefined;
  const uiRaw = roomObj.ui;
  if (uiRaw && typeof uiRaw === "object") {
    const uiObj = uiRaw as Record<string, unknown>;
    const roundPreparing = readBool(uiObj.roundPreparing) ?? undefined;
    const recallOpen = readBool(uiObj.recallOpen) ?? undefined;
    const revealPending = readBool(uiObj.revealPending) ?? undefined;
    if (
      roundPreparing !== undefined ||
      recallOpen !== undefined ||
      revealPending !== undefined
    ) {
      ui = { roundPreparing, recallOpen, revealPending };
    }
  }

  return {
    roomId,
    statusVersion,
    room: { status, topic, topicBox, round, ui },
    meta: { source, command, requestId, ts },
  };
}
