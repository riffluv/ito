import type { Renderer } from "pixi.js";

const TEXTURE_UPLOAD_CHUNK = 6;
const MIN_TEXTURE_UPLOAD_CHUNK = 4;
const MAX_TEXTURE_UPLOAD_CHUNK = 24;

type ManagedTextureRenderer = Renderer & {
  texture?: {
    managedTextures?: unknown[];
    bind?: (source: unknown, location?: number) => void;
  };
};

export type BatchCapableRenderer = {
  batch?: {
    setMaxTextures?: (count: number) => void;
  };
};

const computeTextureChunkSize = () => {
  const base = TEXTURE_UPLOAD_CHUNK;
  const cores =
    typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency
      : null;
  if (!cores || !Number.isFinite(cores)) return base;
  const scaled = Math.round(
    base * (cores >= 12 ? 2.1 : cores >= 8 ? 1.6 : cores >= 6 ? 1.3 : cores >= 4 ? 1.05 : 0.8)
  );
  return Math.min(MAX_TEXTURE_UPLOAD_CHUNK, Math.max(MIN_TEXTURE_UPLOAD_CHUNK, scaled));
};

const classifyTexturePriority = (source: unknown) => {
  const accessor = (key: string) => {
    try {
      const value = (source as Record<string, unknown> | null)?.[key];
      return typeof value === "string" ? value.toLowerCase() : undefined;
    } catch {
      return undefined;
    }
  };
  const label = accessor("label") || accessor("name") || accessor("type");
  const resourceSrc = (() => {
    try {
      const res = (source as { resource?: { src?: string } } | null)?.resource;
      if (res && typeof res.src === "string") return res.src.toLowerCase();
    } catch {}
    return undefined;
  })();
  const text = [label, resourceSrc].filter(Boolean).join(" ");
  if (text.length) {
    const criticalKeywords = ["ui", "hud", "icon", "button", "btn", "card", "font", "atlas"];
    const decorativeKeywords = ["bg", "background", "grad", "fx", "effect", "glow", "shadow"];
    if (criticalKeywords.some((kw) => text.includes(kw))) return 0;
    if (decorativeKeywords.some((kw) => text.includes(kw))) return 2;
  }
  return 1; // default priority
};

const sortTexturesForRecovery = (managed: unknown[]) => {
  return managed
    .map((tex, index) => ({ tex, index, priority: classifyTexturePriority(tex) }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map((entry) => entry.tex);
};

export const uploadTexturesInChunks = (
  renderer: Renderer,
  options?: { chunkSize?: number; prioritize?: boolean }
) =>
  new Promise<void>((resolve) => {
    const textureSystem = (renderer as ManagedTextureRenderer).texture;
    const rawManaged = Array.isArray(textureSystem?.managedTextures)
      ? textureSystem.managedTextures ?? []
      : [];
    const managed = options?.prioritize === false ? rawManaged : sortTexturesForRecovery(rawManaged);
    const chunkSize = Math.max(
      MIN_TEXTURE_UPLOAD_CHUNK,
      Math.min(MAX_TEXTURE_UPLOAD_CHUNK, options?.chunkSize ?? computeTextureChunkSize())
    );
    if (!managed.length) {
      resolve();
      return;
    }
    let index = 0;
    const total = managed.length;

    const uploadNext = () => {
      const end = Math.min(index + chunkSize, total);
      for (; index < end; index += 1) {
        const textureSource = managed[index];
        if (!textureSource) continue;
        try {
          textureSystem?.bind?.(textureSource, 0);
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.warn("[PixiHudStage] texture bind failed during recovery", error);
          }
        }
      }
      if (index < total) {
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(uploadNext);
        } else {
          setTimeout(uploadNext, 16);
        }
      } else {
        resolve();
      }
    };

    uploadNext();
  });

