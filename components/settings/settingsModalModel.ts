import type { BackgroundTheme } from "@/lib/pixi/backgroundPreference";

export type BackgroundOption = BackgroundTheme;
export type SceneryVariant = "night" | "inferno";
export type SettingsTab = "game" | "graphics" | "sound";
export type GraphicsTab = "background" | "animation";
export type AnimationModeOption = "auto" | "3d" | "simple";
export type CardAnimationOption = Exclude<AnimationModeOption, "auto">;

export const SETTINGS_TABS: ReadonlyArray<{ key: SettingsTab; label: string }> = [
  { key: "game", label: "Game Settings" },
  { key: "graphics", label: "Graphics Settings" },
  { key: "sound", label: "Sound Settings" },
];

export const GRAPHICS_TABS: ReadonlyArray<{ key: GraphicsTab; label: string }> = [
  { key: "background", label: "背景" },
  { key: "animation", label: "アニメ" },
];

export const CARD_ANIMATION_OPTIONS: ReadonlyArray<{
  value: CardAnimationOption;
  title: string;
  description: string;
}> = [
  {
    value: "3d",
    title: "3D回転",
    description: "カードが立体的に回転します（おすすめ）",
  },
  {
    value: "simple",
    title: "シンプル",
    description: "回転を省いて軽量表示にします",
  },
];

export const getVariantFromBackground = (
  bg: BackgroundOption
): SceneryVariant | null => {
  if (bg === "pixi-dq") return "night";
  if (bg === "pixi-inferno") return "inferno";
  return null;
};

export const getBackgroundFromVariant = (variant: SceneryVariant): BackgroundOption => {
  if (variant === "night") return "pixi-dq";
  if (variant === "inferno") return "pixi-inferno";
  return "pixi-dq";
};

export const SOUND_FEATURE_LOCKED = false as const;
export const SOUND_LOCK_MESSAGE =
  "サウンド素材を制作中です。準備ができ次第ここで設定できます。";

export const BACKGROUND_LABEL_MAP: Record<BackgroundOption, string> = {
  css: "CSS はいけい",
  "pixi-simple": "Pixi ライト",
  "pixi-dq": "山はいいよね（夜）",
  "pixi-inferno": "山はいいよね（煉獄）",
};

export const BACKGROUND_OPTIONS: ReadonlyArray<{
  value: BackgroundOption | "scenery";
  title: string;
  description: string;
  hasVariants?: boolean;
}> = [
  {
    value: "css",
    title: "CSS はいけい",
    description: "けいりょうな CSS グラデーション。すべての環境で安定。",
  },
  {
    value: "pixi-simple",
    title: "Pixi はいけい",
    description: "黒ベースの PixiJS 背景。",
  },
  {
    value: "scenery",
    title: "山はいいよね。 pixiJS",
    description: "和みそうな、景色 PixiJS 背景。",
    hasVariants: true,
  },
];

export const SCENERY_VARIANTS: ReadonlyArray<{
  value: SceneryVariant;
  label: string;
  description: string;
}> = [
  {
    value: "night",
    label: "夜",
    description: "星空と山々の夜景",
  },
  {
    value: "inferno",
    label: "煉獄",
    description: "地獄の炎と溶岩",
  },
];

export const MODE_OPTIONS: ReadonlyArray<{
  value: string;
  title: string;
  description: string;
}> = [
  {
    value: "sort-submit",
    title: "みんなで ならべる",
    description: "ぜんいん カードを ならべてから はんてい",
  },
];

export const TOPIC_TYPE_OPTIONS: ReadonlyArray<{
  value: string;
  title: string;
  description: string;
}> = [
  {
    value: "通常版",
    title: "通常版",
    description: "バランスの取れた定番のお題",
  },
  {
    value: "レインボー版",
    title: "レインボー版",
    description: "カラフルで創造的なお題",
  },
  {
    value: "クラシック版",
    title: "クラシック版",
    description: "シンプルで分かりやすいお題",
  },
  {
    value: "カスタム",
    title: "カスタム",
    description: "じぶんたちで お題を入力して あそぶ",
  },
];
