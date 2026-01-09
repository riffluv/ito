import type { ErrorSeverity } from "./types";

export class AppError extends Error {
  code?: string;
  severity?: ErrorSeverity;
  userMessage?: string;
  technicalDetails?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code?: string;
      severity?: ErrorSeverity;
      userMessage?: string;
      technicalDetails?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = "AppError";
    this.code = options.code;
    this.severity = options.severity ?? "error";
    this.userMessage = options.userMessage;
    this.technicalDetails = options.technicalDetails;
  }
}

/**
 * バリデーションエラー作成ヘルパー
 */
export function createValidationError(field: string, message: string): AppError {
  return new AppError(`Validation failed for ${field}`, {
    code: "VALIDATION_ERROR",
    severity: "warning",
    userMessage: message,
    technicalDetails: { field },
  });
}

/**
 * ネットワークエラー作成ヘルパー
 */
export function createNetworkError(originalError: unknown): AppError {
  return new AppError("Network error occurred", {
    code: "NETWORK_ERROR",
    severity: "error",
    userMessage: "ネットワークエラーが発生しました。接続を確認してください。",
    technicalDetails: { originalError },
  });
}

