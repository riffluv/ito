import { SOUND_LIBRARY } from "@/lib/audio/registry";
import { resolvePreferredVariantUrl } from "@/lib/audio/paths.server";

export const AUDIO_PRELOAD_LIMIT = 6;

export function buildAudioPreloadHrefs(
  limit: number = AUDIO_PRELOAD_LIMIT
): string[] {
  const seen = new Set<string>();
  const hrefs: string[] = [];

  for (const definition of SOUND_LIBRARY) {
    if (!definition.preload?.link) continue;
    for (const variant of definition.variants) {
      const href = resolvePreferredVariantUrl(variant.src);
      if (!href || seen.has(href)) continue;
      seen.add(href);
      hrefs.push(href);
      if (hrefs.length >= limit) {
        return hrefs;
      }
      break; // 同一効果音の別バリアントは後回しにし、第一候補だけを先行プリロード
    }
  }

  return hrefs;
}
