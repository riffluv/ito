import { leaveRoomServer } from "@/lib/server/roomActions";
import { traceAction } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { isUidMismatch } from "@/lib/server/roomCommandsLeaveRoom/helpers";

type WithAuth = { token: string };

export type LeaveRoomParams = WithAuth & {
  roomId: string;
  uid: string;
  displayName?: string | null;
};

export async function leaveRoom(params: LeaveRoomParams) {
  const uid = await verifyViewerIdentity(params.token);
  if (isUidMismatch({ uidFromToken: uid, uidFromPayload: params.uid })) {
    throw codedError("forbidden", "forbidden", "uid_mismatch");
  }

  await leaveRoomServer(params.roomId, uid, params.displayName ?? null);
  traceAction("room.leave.server", { roomId: params.roomId, uid });
}
