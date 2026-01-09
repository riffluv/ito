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

