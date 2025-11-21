"use client";

// Backward-compat wrapper: ThreeBackground now proxies to PixiBackground.
// (The background rendererは実体としてPixiを使用しています)
export { PixiBackground as ThreeBackground } from "./PixiBackground";
export { PixiBackground as default } from "./PixiBackground";
