import type * as PIXI from "pixi.js";
import * as PIXIRuntime from "pixi.js";
import { applyTexturePoolPatch } from "./texturePoolPatch";

applyTexturePoolPatch(PIXIRuntime as typeof PIXI);

export default PIXIRuntime;
export * from "pixi.js";
