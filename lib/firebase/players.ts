import {
  apiUpdatePlayerProfile,
  apiResetPlayerState,
  apiReady,
  apiSubmitClue,
} from "@/lib/services/roomApiClient";
import { sanitizePlainText } from "@/lib/utils/sanitize";

export async function updateClue1(roomId: string, playerId: string, value: string) {
  const clean = sanitizePlainText(value).slice(0, 120);
  await apiSubmitClue(roomId, clean);
}

export async function setReady(roomId: string, playerId: string, ready: boolean) {
  await apiReady(roomId, ready);
}

export async function resetPlayerState(roomId: string, playerId: string) {
  await apiResetPlayerState({ roomId, playerId });
}

export async function setPlayerNameAvatar(roomId: string, playerId: string, name: string, avatar: string) {
  const cleanName = sanitizePlainText(name).slice(0, 24);
  await apiUpdatePlayerProfile({ roomId, playerId, name: cleanName, avatar });
}

export async function setPlayerName(roomId: string, playerId: string, name: string) {
  const cleanName = sanitizePlainText(name).slice(0, 24);
  await apiUpdatePlayerProfile({ roomId, playerId, name: cleanName });
}
