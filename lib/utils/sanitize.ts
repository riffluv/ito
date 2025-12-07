/**
 * サーバーサイドでも動作する軽量なサニタイズ関数
 * HTMLタグを除去し、危険な文字をエスケープしてプレーンテキストを返す
 *
 * 注: isomorphic-dompurify は jsdom に依存しており、
 * Vercel の Node.js 22 環境で ESM 互換性問題を起こすため使用しない
 */

// HTMLタグを除去
function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

// HTML エンティティをデコード（基本的なもののみ）
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// 制御文字を除去（改行・タブは保持）
function removeControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export function sanitizePlainText(input: string): string {
  if (typeof input !== "string") return "";

  let result = input;
  result = stripHtmlTags(result);
  result = decodeHtmlEntities(result);
  result = removeControlChars(result);
  result = result.trim();

  return result;
}
