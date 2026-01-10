import { promises as fs } from "fs";
import path from "path";

import { sanitizePlainText } from "@/lib/utils/sanitize";
import { traceAction } from "@/lib/utils/trace";
import {
  parseItoWordMarkdown,
  topicTypeLabels,
  type TopicSections,
  type TopicType,
} from "@/lib/topics";

export type CodedError = Error & { code?: string; reason?: string };

export const codedError = (message: string, code: string, reason?: string): CodedError => {
  const err = new Error(message) as CodedError;
  err.code = code;
  if (reason) err.reason = reason;
  return err;
};

export const sanitizeName = (value: string) => sanitizePlainText(value).slice(0, 24);

export const sanitizeClue = (value: string) => sanitizePlainText(value).slice(0, 120);

export const sanitizeTopicText = (value: string) => sanitizePlainText(value).slice(0, 240);

export const safeTraceAction = (name: string, detail?: Record<string, unknown>) => {
  try {
    traceAction(name, detail);
  } catch {
    // swallow tracing failures on the server to avoid impacting API responses
  }
};

export const waitMs = (durationMs: number) => new Promise<void>((resolve) => setTimeout(resolve, durationMs));

let cachedTopicSections: TopicSections | null = null;
let cachedTopicSectionsPromise: Promise<TopicSections> | null = null;

export const loadTopicSectionsFromFs = async (): Promise<TopicSections> => {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && cachedTopicSections) {
    return cachedTopicSections;
  }
  if (isProd && cachedTopicSectionsPromise) {
    return cachedTopicSectionsPromise;
  }

  const filePath = path.join(process.cwd(), "public", "itoword.md");
  const load = fs.readFile(filePath, "utf8").then((text) => parseItoWordMarkdown(text));

  if (!isProd) {
    return load;
  }

  cachedTopicSectionsPromise = load
    .then((sections) => {
      cachedTopicSections = sections;
      return sections;
    })
    .finally(() => {
      cachedTopicSectionsPromise = null;
    });
  return cachedTopicSectionsPromise;
};

export const isTopicTypeValue = (value: string | null | undefined): value is TopicType =>
  typeof value === "string" && (topicTypeLabels as readonly string[]).includes(value as TopicType);

