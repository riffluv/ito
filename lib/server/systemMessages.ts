import { sanitizePlainText } from "@/lib/utils/sanitize";

const DEFAULT_PLAYER_NAME = "名もなき冒険者";
const MAX_NAME_LENGTH = 16;

function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = sanitizePlainText(raw);
  const normalized = cleaned.replace(/s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length > MAX_NAME_LENGTH) {
    return normalized.slice(0, MAX_NAME_LENGTH) + "…";
  }
  return normalized;
}

export function resolveSystemPlayerName(raw: string | null | undefined): string | null {
  return normalizeName(raw);
}

function ensureDisplayName(raw: string | null | undefined): string {
  return normalizeName(raw) ?? DEFAULT_PLAYER_NAME;
}

export function systemMessagePlayerJoined(rawName: string | null | undefined): string {
  const name = ensureDisplayName(rawName);
  return "✨ " + name + " がパーティに参加した！";
}

export function systemMessagePlayerLeft(rawName: string | null | undefined): string {
  const name = ensureDisplayName(rawName);
  return "👣 " + name + " がパーティから離脱しました。";
}

export function systemMessageHostTransferred(rawName: string | null | undefined): string {
  const name = ensureDisplayName(rawName);
  return "👑 ホストが " + name + " に交代しました。";
}

export function systemMessageRoomBecameEmpty(): string {
  return "🌙 だれもいなくなったので部屋を初期化しました。";
}