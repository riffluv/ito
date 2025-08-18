export function randomAvatar(name: string): string {
  const emojis = [
    "🦊","🐼","🐸","🐧","🦄","🐨","🐯","🐱","🐶","🐹",
    "🐵","🐰","🐮","🐷","🐔","🦁","🐻","🐙","🐢","🐳"
  ];
  const idx = Math.abs(hashCode(name)) % emojis.length;
  return emojis[idx];
}

export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function range(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }

