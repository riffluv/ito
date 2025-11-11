import * as PIXIRuntime from "pixi.js";
import { applyTexturePoolPatch } from "./texturePoolPatch";

type PIXIExports = typeof import("pixi.js");

applyTexturePoolPatch(PIXIRuntime as PIXIExports);

export default PIXIRuntime;
export * from "pixi.js";
