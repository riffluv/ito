import type * as PIXI from "pixi.js";
import { safeDestroy } from "./safeDestroy";

const isDev = process.env.NODE_ENV !== "production";

let patched = false;

export function applyTexturePoolPatch(pixi: typeof PIXI) {
  if (patched) {
    return;
  }

  const texturePool = (pixi as unknown as {
    TexturePool?: {
      returnTexture: (texture: any, resetStyle?: boolean) => void;
    };
  }).TexturePool;

  if (!texturePool || typeof texturePool.returnTexture !== "function") {
    if (isDev) {
      console.warn("[pixi:TexturePoolPatch] TexturePool not found.");
    }
    patched = true;
    return;
  }

  const originalReturnTexture = texturePool.returnTexture;

  texturePool.returnTexture = function patchedReturnTexture(
    renderTexture: any,
    resetStyle = false
  ) {
    if (!renderTexture) {
      if (isDev) {
        console.warn("[pixi:TexturePoolPatch] renderTexture is falsy.");
      }
      return;
    }

    const poolKeyHash = (this as any)?._poolKeyHash;
    const texturePoolStore = (this as any)?._texturePool;
    const key = poolKeyHash?.[renderTexture.uid];

    if (key == null) {
      if (isDev) {
        console.warn(
          `[pixi:TexturePoolPatch] Missing pool key for texture uid=${renderTexture.uid}. Destroying texture instead of pooling.`
        );
      }
      safeDestroy(renderTexture, "TexturePoolPatch.destroyTexture", true);
      return;
    }

    if (!texturePoolStore[key]) {
      texturePoolStore[key] = [];
    }

    try {
      return originalReturnTexture.call(this, renderTexture, resetStyle);
    } catch (error) {
      if (isDev) {
        console.warn(
          "[pixi:TexturePoolPatch] returnTexture failed, destroying texture.",
          error
        );
      }
      safeDestroy(renderTexture, "TexturePoolPatch.errorDestroy", true);
    }
  };

  patched = true;
}
