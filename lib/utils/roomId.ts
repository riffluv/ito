const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_ID_LENGTH = 6;

function getRandomInt(max: number): number {
  if (max <= 0) return 0;
  const cryptoObj =
    typeof globalThis !== "undefined" && (globalThis as any).crypto?.getRandomValues
      ? (globalThis as any).crypto
      : null;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const array = new Uint32Array(1);
    cryptoObj.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function generateRoomId(): string {
  let result = "";
  for (let i = 0; i < ROOM_ID_LENGTH; i += 1) {
    const index = getRandomInt(ROOM_ID_ALPHABET.length);
    result += ROOM_ID_ALPHABET[index];
  }
  return result;
}

export function isShortRoomId(id: string): boolean {
  if (typeof id !== "string" || id.length !== ROOM_ID_LENGTH) return false;
  return [...id].every((ch) => ROOM_ID_ALPHABET.includes(ch));
}
