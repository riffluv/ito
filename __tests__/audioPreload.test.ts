import { buildAudioPreloadHrefs } from "@/lib/audio/preload";
import { SOUND_LIBRARY } from "@/lib/audio/registry";

jest.mock("@/lib/audio/registry", () => {
  const base = [
    {
      preload: { link: true },
      variants: [{ src: "a.ogg" }, { src: "a.mp3" }],
    },
    {
      preload: { link: true },
      variants: [{ src: "b.ogg" }],
    },
    {
      preload: { link: true },
      variants: [{ src: "c.ogg" }],
    },
  ];
  return { SOUND_LIBRARY: base };
});

jest.mock("@/lib/audio/paths.server", () => ({
  resolvePreferredVariantUrl: (src: string) => `/audio/${src}`,
}));

describe("buildAudioPreloadHrefs", () => {
  it("deduplicates and respects limit", () => {
    const hrefs = buildAudioPreloadHrefs(2);
    expect(hrefs).toEqual(["/audio/a.ogg", "/audio/b.ogg"]);
  });

  it("returns all available when under limit", () => {
    const hrefs = buildAudioPreloadHrefs(10);
    expect(hrefs).toEqual(["/audio/a.ogg", "/audio/b.ogg", "/audio/c.ogg"]);
  });
});
