const DEFAULT_PLAYER_NAME = "名もなき冒険者";
const MAX_NAME_LENGTH = 16;

function removeControlCharacters(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if ((code >= 0 && code <= 31) || code === 127) {
      result += " ";
    } else {
      result += text[i];
    }
  }
  return result;
}

function sanitizeText(raw: string): string {
  return removeControlCharacters(raw)
    .replace(/[\u2028\u2029]/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = sanitizeText(raw);
  const normalized = cleaned.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_NAME_LENGTH) {
    return normalized.slice(0, MAX_NAME_LENGTH) + "…";
  }
  return normalized;
}

export function resolveSystemPlayerName(
  raw: string | null | undefined
): string | null {
  return normalizeName(raw);
}

function ensureDisplayName(raw: string | null | undefined): string {
  return normalizeName(raw) ?? DEFAULT_PLAYER_NAME;
}

export function systemMessagePlayerJoined(
  rawName: string | null | undefined
): string {
  const name = ensureDisplayName(rawName);
  return "✨ " + name + " がパーティに参加した！";
}

export function systemMessagePlayerLeft(
  rawName: string | null | undefined
): string {
  const name = ensureDisplayName(rawName);
  return "👣 " + name + " がパーティから離脱しました。";
}

export function systemMessageHostTransferred(
  rawName: string | null | undefined
): string {
  const name = ensureDisplayName(rawName);
  return "👑 " + name + " さんがホストになりました！";
}

export function systemMessageRoomBecameEmpty(): string {
  return "🌙 だれもいなくなったので部屋を初期化しました。";
}
