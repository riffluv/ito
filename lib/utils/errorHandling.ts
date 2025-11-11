/**
 * 統一エラーハンドリングユーティリティ
 * プロジェクト全体で一貫したエラー処理とユーザー通知を提供
 */
import { notify } from "@/components/ui/notify";
import { logError } from "@/lib/utils/log";

export type ErrorSeverity = "error" | "warning" | "info";

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
 * Firebase関連のエラーメッセージを日本語化
 */
export function getFirebaseErrorMessage(error: unknown): string {
  const firebaseError = error as { code?: string; message?: string };
  const code = firebaseError?.code;

  switch (code) {
    case "permission-denied":
      return "権限がありません。再度ログインしてお試しください。";
    case "not-found":
      return "データが見つかりません。";
    case "already-exists":
      return "既に存在しています。";
    case "resource-exhausted":
      return "🚨 Firebase読み取り制限に達しました。24時間後に制限がリセットされます。";
    case "unauthenticated":
      return "認証が必要です。ログインしてください。";
    case "unavailable":
      return "サービスが一時的に利用できません。";
    default:
      return firebaseError?.message ?? "予期せぬエラーが発生しました。";
  }
}

/**
 * 統一されたエラーハンドリング関数
 */
export function handleError(
  error: unknown,
  context: string,
  showNotification: boolean = true
): AppError {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Error) {
    const userMessage = getFirebaseErrorMessage(error);
    appError = new AppError(error.message, {
      userMessage,
      technicalDetails: { originalError: error },
    });
  } else {
    appError = new AppError("Unknown error", {
      userMessage: "予期せぬエラーが発生しました。",
      technicalDetails: { originalError: error },
    });
  }

  // コンソールログ
  logError(context, appError.message, {
    code: appError.code,
    severity: appError.severity,
    technicalDetails: appError.technicalDetails,
  });

  // ユーザー通知
  if (showNotification && appError.userMessage) {
    notify({
      title: `${context}でエラーが発生しました`,
      description: appError.userMessage,
      type: appError.severity,
    });
  }

  return appError;
}

/**
 * 非同期処理のエラーハンドリングヘルパー
 */
export async function withErrorHandling<T>(
  asyncFn: () => Promise<T>,
  context: string,
  showNotification: boolean = true
): Promise<T | null> {
  try {
    return await asyncFn();
  } catch (error) {
    handleError(error, context, showNotification);
    return null;
  }
}

/**
 * ゲーム固有のエラー処理
 */
export function handleGameError(
  error: unknown,
  action: string,
  showNotification: boolean = true
): void {
  const context = `ゲーム操作: ${action}`;
  handleError(error, context, showNotification);
}

/**
 * バリデーションエラー作成ヘルパー
 */
export function createValidationError(
  field: string,
  message: string
): AppError {
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

/**
 * Firebase制限エラー検知関数
 */
export function isFirebaseQuotaExceeded(error: unknown): boolean {
  const firebaseError = error as { code?: string; message?: string };
  return Boolean(
    firebaseError?.code === "resource-exhausted" ||
      firebaseError?.message?.includes("429") ||
      firebaseError?.message?.includes("quota")
  );
}

/**
 * Firebase制限エラー専用処理
 */
export function handleFirebaseQuotaError(context: string = ""): void {
  notify({
    title: "🚨 Firebase読み取り制限",
    description: "読み取り制限に達しました。日本時間4時頃にリセットされます。",
    type: "error",
  });

  logError("firebase-quota", `Read quota exceeded: ${context}`);
}
