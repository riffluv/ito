"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
// ColorPalette 型は内部構造が厳密なためサンプル用途では緩める
type ColorPaletteLoose = any;

export type ThemePreset = {
  name: string;
  description?: string;
  colorPalette?: ColorPaletteLoose; // Chakra v3 colorPalette (DOM subtree switching)
  tokens?: Record<string, any>; // ad-hoc override map (semanticTokens.colors.* など)
};

interface ThemePresetContextValue {
  active: ThemePreset | null;
  presets: ThemePreset[];
  setActiveByName: (name: string) => void;
  registerPreset: (preset: ThemePreset) => void;
}

const ThemePresetContext = createContext<ThemePresetContextValue | undefined>(
  undefined
);

const initialPresets: ThemePreset[] = [
  {
    name: "default",
    description: "既定デザイン (brand / orange パレット)",
  },
  {
    name: "warm",
    description: "暖色寄り試験配色",
    colorPalette: {
      brand: {
        50: { value: "#FFF8F2" },
        100: { value: "#FFE1CC" },
        200: { value: "#FFC199" },
        300: { value: "#FFA066" },
        400: { value: "#FF7F33" },
        500: { value: "#F45F05" },
        600: { value: "#D14F00" },
        700: { value: "#A53E00" },
        800: { value: "#732C00" },
        900: { value: "#401800" },
      },
    },
  },
];

export function ThemePresetProvider({ children }: { children: ReactNode }) {
  const [presets, setPresets] = useState<ThemePreset[]>(initialPresets);
  const [active, setActive] = useState<ThemePreset | null>(initialPresets[0]);

  const setActiveByName = useCallback(
    (name: string) => {
      setActive(presets.find((p) => p.name === name) || null);
    },
    [presets]
  );

  const registerPreset = useCallback((preset: ThemePreset) => {
    setPresets((prev) =>
      prev.some((p) => p.name === preset.name) ? prev : [...prev, preset]
    );
  }, []);

  return (
    <ThemePresetContext.Provider
      value={{ active, presets, setActiveByName, registerPreset }}
    >
      <div data-theme-preset={active?.name || "default"}>{children}</div>
    </ThemePresetContext.Provider>
  );
}

export function useThemePresets() {
  const ctx = useContext(ThemePresetContext);
  if (!ctx)
    throw new Error("useThemePresets must be used within ThemePresetProvider");
  return ctx;
}
