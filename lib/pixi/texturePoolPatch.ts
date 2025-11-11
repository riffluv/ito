import type * as PIXI from "pixi.js";
import { safeDestroy } from "./safeDestroy";

const isDev = process.env.NODE_ENV !== "production";

let patched = false;

type TexturePoolLike = {
  returnTexture: (
    texture: PIXI.RenderTexture | PIXI.Texture,
    resetStyle?: boolean
  ) => void;
  _poolKeyHash?: Record<number, string>;
  _texturePool?: Record<string, Array<PIXI.RenderTexture | PIXI.Texture>>;
};

export function applyTexturePoolPatch(pixi: typeof PIXI) {
  if (patched) {
    return;
  }

  const texturePool = pixi.TexturePool as unknown as
    | TexturePoolLike
    | undefined;

  if (!texturePool || typeof texturePool.returnTexture !== "function") {
    if (isDev) {
      console.warn("[pixi:TexturePoolPatch] TexturePool not found.");
    }
    patched = true;
    return;
  }

  const originalReturnTexture = texturePool.returnTexture;

  texturePool.returnTexture = function patchedReturnTexture(
    renderTexture: PIXI.RenderTexture | PIXI.Texture,
    resetStyle = false
  ) {
    if (!renderTexture) {
      if (isDev) {
        console.warn("[pixi:TexturePoolPatch] renderTexture is falsy.");
      }
      return;
    }

    const instance = this as TexturePoolLike | undefined;
    if (instance && !instance._texturePool) {
      instance._texturePool = {};
    }
    const poolKeyHash = instance?._poolKeyHash ?? {};
    const texturePoolStore = instance?._texturePool ?? {};
    const key = poolKeyHash?.[renderTexture.uid];

    if (key === undefined || key === null) {
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
      originalReturnTexture.call(instance, renderTexture, resetStyle);
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
