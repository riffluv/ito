import type { Application } from "@/lib/pixi/instance";

export function destroyPixiApp(app: Application) {
  try {
    const rendererOpts = { removeView: true };
    const stageOpts = { children: true, texture: true, textureSource: true };
    // v8 destroy signature accepts (rendererOptions, stageOptions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app.destroy as any)(rendererOpts, stageOpts);
  } catch {
    try {
      app.destroy(true);
    } catch {
      /* ignore */
    }
  }
}

