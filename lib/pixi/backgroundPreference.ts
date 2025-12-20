"use client";

export type BackgroundTheme = "css" | "pixi-simple" | "pixi-dq" | "pixi-inferno";

export const DEFAULT_BACKGROUND_THEME: BackgroundTheme = "pixi-dq"; // 山はいいよね。（夜）

export const BACKGROUND_STORAGE_KEY = "ito:backgroundTheme";
const LEGACY_BACKGROUND_STORAGE_KEY = "backgroundType"; // 旧キー互換用

export const BACKGROUND_EVENT_NAME = "backgroundTypeChanged"; // 既存イベント名を維持（将来ホスト強制時も流用予定）

export const normalizeBackgroundTheme = (
  value: string | null
): BackgroundTheme => {
  if (value === "pixi-simple" || value === "pixi-lite") return "pixi-simple";
  if (value === "pixi-dq" || value === "pixi" || value === "pixijs")
    return "pixi-dq";
  if (value === "pixi-inferno" || value === "inferno") return "pixi-inferno";
  return "css";
};

const readRaw = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(BACKGROUND_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_BACKGROUND_STORAGE_KEY)
    );
  } catch {
    return null;
  }
};

export const readStoredBackgroundTheme = (): BackgroundTheme => {
  const raw = readRaw();
  if (!raw) {
    return DEFAULT_BACKGROUND_THEME;
  }
  return normalizeBackgroundTheme(raw);
};

export const persistBackgroundTheme = (
  theme: BackgroundTheme,
  { emit = true }: { emit?: boolean } = {}
): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BACKGROUND_STORAGE_KEY, theme);
    // レガシーキーも書いておく: 既存コードの互換を確保
    window.localStorage.setItem(LEGACY_BACKGROUND_STORAGE_KEY, theme);
    if (emit) {
      window.dispatchEvent(
        new CustomEvent(BACKGROUND_EVENT_NAME, {
          detail: { backgroundType: theme, theme },
        })
      );
    }
  } catch {
    // noop
  }
};

/**
 * 初期ロード時に好みの背景テーマを取得する。
 * - SSR対策で window 未定義時はデフォルトを返すだけ。
 * - ストレージ未保存ならデフォルトを書き込んでおく（2回目以降で即反映されるように）。
 */
export const bootstrapBackgroundTheme = (): BackgroundTheme => {
  const theme = readStoredBackgroundTheme();
  if (typeof window !== "undefined") {
    try {
      const hasStored =
        window.localStorage.getItem(BACKGROUND_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_BACKGROUND_STORAGE_KEY);
      if (!hasStored) {
        window.localStorage.setItem(BACKGROUND_STORAGE_KEY, theme);
        window.localStorage.setItem(LEGACY_BACKGROUND_STORAGE_KEY, theme);
      }
    } catch {
      // noop
    }
  }
  return theme;
};

/**
 * 将来の拡張メモ:
 * - ホスト指定の room.backgroundTheme が届いたらここで優先順位を決める。
 *   例: hostTheme ?? storedTheme ?? DEFAULT_BACKGROUND_THEME
 */
type BackgroundCapability = {
  supportsPixi: boolean;
  allowHighQuality: boolean;
};

const findFamilyStandard = (
  family: "scenery" | "simple" | "css"
): BackgroundTheme => {
  if (family === "scenery") return "pixi-dq";
  if (family === "simple") return "pixi-simple";
  return "css";
};

/**
 * 背景の最終決定を一元管理するヘルパー。
 * - 将来「ホスト指定」や「高品質版」を追加してもここを変えるだけで済む想定。
 */
export const resolveEffectiveBackground = ({
  hostTheme,
  localTheme,
  capability,
}: {
  hostTheme?: BackgroundTheme | null;
  localTheme?: BackgroundTheme | null;
  capability: BackgroundCapability;
}): BackgroundTheme => {
  const preferred = normalizeBackgroundTheme(hostTheme ?? localTheme ?? null);

  // Pixiを使えない環境なら強制CSS
  if (!capability.supportsPixi) {
    return "css";
  }

  // いまは HQ 版が存在しないが、将来 tier を分ける前提で hook を残す
  const highTierIds: BackgroundTheme[] = ["pixi-inferno"];
  if (
    !capability.allowHighQuality &&
    highTierIds.includes(preferred)
  ) {
    // 低スペック時は軽量テーマへフォールバック
    return findFamilyStandard("simple");
  }

  return preferred;
};
