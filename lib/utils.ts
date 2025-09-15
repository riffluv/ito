export function randomAvatar(name: string): string {
  const avatars = [
    "/avatars/knight1.webp",
    "/avatars/knightwomen1.webp",
    "/avatars/kenja.webp",
    "/avatars/kenshi.webp",
    "/avatars/mahou.webp",
    "/avatars/siifu.webp",
    "/avatars/arrow.webp",
    "/avatars/arrow2.webp",
    "/avatars/guitar.webp"
  ];
  const idx = Math.abs(hashCode(name)) % avatars.length;
  return avatars[idx];
}

export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function range(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }

