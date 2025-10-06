import { AUDIO_EXTENSIONS, SFX_BASE_PATH } from "./registry";

const ensureLeadingSlash = (filePath: string) =>
  filePath.startsWith("/") ? filePath : `/${filePath}`;

export const buildCandidateUrls = (src: string) => {
  const base = src.startsWith("/")
    ? src
    : `${SFX_BASE_PATH.replace(/\/$/, "")}/${src.replace(/^\//, "")}`;
  if (/\.[a-zA-Z0-9]+$/.test(base)) {
    return [ensureLeadingSlash(base)];
  }
  return AUDIO_EXTENSIONS.map((extension) =>
    ensureLeadingSlash(`${base}.${extension}`)
  );
};
