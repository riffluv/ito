import { z } from "zod";
import { sanitizePlainText } from "@/lib/utils/sanitize";

const createTextSchema = (max: number) =>
  z
    .string()
    .transform((value) => sanitizePlainText(value))
    .refine((value) => value.length > 0, {
      message: "テキストを入力してください",
    })
    .refine((value) => value.length <= max, {
      message: `${max}文字以内で入力してください`,
    });

const displayNameSchema = createTextSchema(20);
const roomNameSchema = createTextSchema(48);
const chatMessageSchema = createTextSchema(500);
const clueSchema = createTextSchema(120);

export function validateDisplayName(value: string): string {
  return displayNameSchema.parse(value);
}

export function validateRoomName(value: string): string {
  return roomNameSchema.parse(value);
}

export function validateChatMessage(value: string): string {
  return chatMessageSchema.parse(value);
}

export function validateClue(value: string): string {
  return clueSchema.parse(value);
}
