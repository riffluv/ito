import type { BackgroundQuality } from "@/lib/pixi/simpleBackground";
import type { PixiBackgroundProfile } from "@/lib/pixi/backgroundTypes";

export type PixiSceneKey = "pixi-simple" | "pixi-dq" | "pixi-inferno";

export type SceneFactory<TOptions, TResult> = (
  options: TOptions
) => Promise<TResult> | TResult;

export type SceneRegistry<TOptions, TResult> = {
  registerScene: (key: PixiSceneKey, factory: SceneFactory<TOptions, TResult>) => void;
  createScene: (key: PixiSceneKey, options: TOptions) => Promise<TResult | null>;
  getRegisteredKeys: () => PixiSceneKey[];
};

export type SceneOptionsBase = {
  key: PixiSceneKey;
  quality: BackgroundQuality;
  profile?: PixiBackgroundProfile;
};

export function createSceneRegistry<TOptions, TResult>(): SceneRegistry<
  TOptions,
  TResult
> {
  const registry = new Map<PixiSceneKey, SceneFactory<TOptions, TResult>>();

  const registerScene = (
    key: PixiSceneKey,
    factory: SceneFactory<TOptions, TResult>
  ) => {
    registry.set(key, factory);
  };

  const createScene = async (
    key: PixiSceneKey,
    options: TOptions
  ): Promise<TResult | null> => {
    const factory = registry.get(key);
    if (!factory) return null;
    return factory(options);
  };

  const getRegisteredKeys = () => Array.from(registry.keys());

  return { registerScene, createScene, getRegisteredKeys };
}
