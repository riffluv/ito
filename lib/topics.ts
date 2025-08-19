export const defaultTopics = [
  "食べ物",
  "動物",
  "色",
  "スポーツ",
  "都道府県",
  "映画",
  "職業",
  "季節",
  "学校",
  "楽器",
  "飲み物",
  "ゲーム",
  "漫画",
  "音楽",
  "ファッション",
  "旅行先",
  "家電",
  "フルーツ",
  "野菜",
  "乗り物",
];

export function pickTwo<T>(list: T[], seed?: string): T[] {
  if (!list || list.length === 0) return [];
  if (list.length === 1) return [list[0]];
  // 乱数は軽量なハッシュベースで決定可能に（seedがあれば再現性）
  let a = seed ? hashString(seed) : Math.floor(Math.random() * 2 ** 31);
  const rnd = mulberry32(a);
  const i = Math.floor(rnd() * list.length);
  let j = Math.floor(rnd() * (list.length - 1));
  if (j >= i) j += 1;
  return [list[i], list[j]];
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

