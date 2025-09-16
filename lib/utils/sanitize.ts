import DOMPurify from "isomorphic-dompurify";

const sanitizer = DOMPurify;

export function sanitizePlainText(input: string): string {
  const cleaned = sanitizer.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return typeof cleaned === "string" ? cleaned.trim() : "";
}
