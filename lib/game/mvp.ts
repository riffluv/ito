import { apiCastMvpVote } from "@/lib/services/roomApiClient";

export async function castMvpVote(
  roomId: string,
  voterId: string,
  targetId: string | null
) {
  if (!roomId || !voterId) return;

  await apiCastMvpVote(roomId, targetId);
}
