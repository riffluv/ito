import type * as PIXI from "pixi.js";
import { applyTexturePoolPatch } from "./texturePoolPatch";

let pixiPromise: Promise<typeof PIXI> | null = null;

export function loadPixi(): Promise<typeof PIXI> {
  if (!pixiPromise) {
    pixiPromise = import("pixi.js").then((module) => {
      const pixi = module as unknown as typeof PIXI;
      applyTexturePoolPatch(pixi);
      return pixi;
    });
  }

  return pixiPromise;
}
