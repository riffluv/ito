// 旧デフォルト（未使用化）：ローカル固定のお題
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

// itoword.md から利用する3つの版（表示候補用）。番号は付さない。
export const topicTypeLabels = ["通常版", "レインボー版", "クラシック版"] as const;
export type TopicType = (typeof topicTypeLabels)[number];

export const isTopicType = (value: unknown): value is TopicType =>
  typeof value === "string" &&
  (topicTypeLabels as readonly string[]).includes(value as TopicType);

export type TopicSections = {
  normal: string[];
  rainbow: string[];
  classic: string[];
};

// クライアントから /itoword.md（public配下）を取得し、3セクションをパース
export async function fetchTopicSections(): Promise<TopicSections> {
  const res = await fetch("/itoword.md", { cache: "no-store" });
  if (!res.ok) throw new Error(`itoword.md の取得に失敗しました (${res.status})`);
  const text = await res.text();
  return parseItoWordMarkdown(text);
}

const TOPIC_CACHE_WINDOW_MS = 5 * 60 * 1000;
let cachedSections: TopicSections | null = null;
let cachedAt = 0;
let inflight: Promise<TopicSections> | null = null;

export async function getTopicSectionsCached(options?: { force?: boolean }): Promise<TopicSections> {
  const force = options?.force ?? false;
  const now = Date.now();

  if (!force && cachedSections && now - cachedAt < TOPIC_CACHE_WINDOW_MS) {
    return cachedSections;
  }

  if (!force && inflight) {
    return inflight;
  }

  const request = fetchTopicSections()
    .then((sections) => {
      cachedSections = sections;
      cachedAt = Date.now();
      inflight = null;
      return sections;
    })
    .catch((error) => {
      inflight = null;
      throw error;
    });

  if (!force) {
    inflight = request;
  }

  return request;
}

export function parseItoWordMarkdown(md: string): TopicSections {
  const lines = md.split(/\r?\n/);
  const normal: string[] = [];
  const rainbow: string[] = [];
  const classic: string[] = [];
  let cur: "none" | "normal" | "rainbow" | "classic" = "none";
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      if (line.includes("通常版")) cur = "normal";
      else if (line.includes("レインボー版")) cur = "rainbow";
      else if (line.includes("クラシック版")) cur = "classic";
      else cur = "none";
      continue;
    }
    // 番号付きリストのみ抽出（例: "12. ～～"）
    const m = line.match(/^\d+\.?\s*(.+)$/);
    if (!m) continue;
    const item = (m[1] || "").trim();
    if (!item) continue;
    if (cur === "normal") normal.push(item);
    else if (cur === "rainbow") rainbow.push(item);
    else if (cur === "classic") classic.push(item);
  }
  return { normal, rainbow, classic };
}

// 3版から指定版の配列を返す
export function getTopicsByType(sections: TopicSections, type: TopicType): string[] {
  switch (type) {
    case "通常版":
      return sections.normal;
    case "レインボー版":
      return sections.rainbow;
    case "クラシック版":
      return sections.classic;
    default:
      return sections.normal;
  }
}

export function pickTwo<T>(list: T[], seed?: string): T[] {
  if (!list || list.length === 0) return [];
  if (list.length === 1) return [list[0]];
  // 乱数は軽量なハッシュベースで決定可能に（seedがあれば再現性）
  const a = seed ? hashString(seed) : Math.floor(Math.random() * 2 ** 31);
  const rnd = mulberry32(a);
  const i = Math.floor(rnd() * list.length);
  let j = Math.floor(rnd() * (list.length - 1));
  if (j >= i) j += 1;
  return [list[i], list[j]];
}

export function pickOne<T>(list: T[], seed?: string): T | null {
  if (!list || list.length === 0) return null;
  const a = seed ? hashString(seed) : Math.floor(Math.random() * 2 ** 31);
  const rnd = mulberry32(a);
  const i = Math.floor(rnd() * list.length);
  return list[i];
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
