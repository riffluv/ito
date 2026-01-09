import { notify } from "@/components/ui/notify";
import { logError } from "@/lib/utils/log";
import { AppError } from "./errors";
import { getFirebaseErrorMessage } from "./firebase";

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

