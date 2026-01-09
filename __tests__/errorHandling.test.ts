/**
 * エラーハンドリングユーティリティのテスト
 */
import {
  AppError,
  createNetworkError,
  createValidationError,
  getFirebaseErrorMessage,
  handleFirebaseQuotaError,
  handleError,
  isFirebaseQuotaExceeded,
  withErrorHandling,
} from "@/lib/utils/errorHandling";
import { notify } from "@/components/ui/notify";

// notify関数をモック化
jest.mock("@/components/ui/notify", () => ({
  notify: jest.fn(),
}));

describe("errorHandling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // console.errorをモック化してテスト出力をクリーンに保つ
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("AppError", () => {
    it("should create an AppError with default severity", () => {
      const error = new AppError("Test error");
      expect(error.name).toBe("AppError");
      expect(error.message).toBe("Test error");
      expect(error.severity).toBe("error");
    });

    it("should create an AppError with custom options", () => {
      const error = new AppError("Test error", {
        code: "TEST_ERROR",
        severity: "warning",
        userMessage: "ユーザー向けメッセージ",
        technicalDetails: { foo: "bar" },
      });

      expect(error.code).toBe("TEST_ERROR");
      expect(error.severity).toBe("warning");
      expect(error.userMessage).toBe("ユーザー向けメッセージ");
      expect(error.technicalDetails).toEqual({ foo: "bar" });
    });
  });

  describe("getFirebaseErrorMessage", () => {
    it("should return Japanese message for known Firebase error codes", () => {
      const testCases = [
        {
          error: { code: "permission-denied" },
          expected: "権限がありません。再度ログインしてお試しください。",
        },
        {
          error: { code: "not-found" },
          expected: "データが見つかりません。",
        },
        {
          error: { code: "unauthenticated" },
          expected: "認証が必要です。ログインしてください。",
        },
      ];

      testCases.forEach(({ error, expected }) => {
        expect(getFirebaseErrorMessage(error)).toBe(expected);
      });
    });

    it("should return original message for unknown error codes", () => {
      const error = { code: "unknown-error", message: "Original message" };
      expect(getFirebaseErrorMessage(error)).toBe("Original message");
    });

    it("should return default message for errors without message", () => {
      const error = { code: "unknown-error" };
      expect(getFirebaseErrorMessage(error)).toBe(
        "予期せぬエラーが発生しました。"
      );
    });
  });

  describe("handleError", () => {
    it("should handle AppError instances", () => {
      const originalError = new AppError("Test error", {
        severity: "warning",
        userMessage: "テストエラー",
      });

      const result = handleError(originalError, "テストコンテキスト");

      expect(result).toBe(originalError);
      expect(console.error).toHaveBeenCalledWith(
        "[テストコンテキスト] Test error",
        expect.objectContaining({
          severity: "warning",
        })
      );
    });

    it("should handle regular Error instances", () => {
      const originalError = new Error("Regular error");
      const result = handleError(originalError, "テストコンテキスト");

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("Regular error");
      expect(result.technicalDetails?.originalError).toBe(originalError);
    });

    it("should handle unknown error types", () => {
      const originalError = "String error";
      const result = handleError(originalError, "テストコンテキスト");

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("Unknown error");
      expect(result.userMessage).toBe("予期せぬエラーが発生しました。");
    });
  });

  describe("withErrorHandling", () => {
    it("should return result when async function succeeds", async () => {
      const successFn = jest.fn().mockResolvedValue("success");
      const result = await withErrorHandling(successFn, "テストコンテキスト");

      expect(result).toBe("success");
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it("should return null when async function throws", async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error("Test error"));
      const result = await withErrorHandling(errorFn, "テストコンテキスト");

      expect(result).toBeNull();
      expect(errorFn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("createValidationError", () => {
    it("should create validation error with correct properties", () => {
      const error = createValidationError("email", "メールアドレスが必要です");

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.severity).toBe("warning");
      expect(error.userMessage).toBe("メールアドレスが必要です");
      expect(error.technicalDetails?.field).toBe("email");
    });
  });

  describe("createNetworkError", () => {
    it("should create network error with correct properties", () => {
      const originalError = new Error("Network timeout");
      const error = createNetworkError(originalError);

      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.severity).toBe("error");
      expect(error.userMessage).toBe(
        "ネットワークエラーが発生しました。接続を確認してください。"
      );
      expect(error.technicalDetails?.originalError).toBe(originalError);
    });
  });

  describe("isFirebaseQuotaExceeded", () => {
    it("should detect quota errors by code and message", () => {
      expect(isFirebaseQuotaExceeded({ code: "resource-exhausted" })).toBe(true);
      expect(isFirebaseQuotaExceeded({ message: "429 too many requests" })).toBe(true);
      expect(isFirebaseQuotaExceeded({ message: "quota exceeded" })).toBe(true);
      expect(isFirebaseQuotaExceeded({ code: "permission-denied" })).toBe(false);
      expect(isFirebaseQuotaExceeded(null)).toBe(false);
    });
  });

  describe("handleFirebaseQuotaError", () => {
    it("should notify user and log an error", () => {
      handleFirebaseQuotaError("テスト");

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "🚨 Firebase読み取り制限",
          type: "error",
        })
      );

      expect(console.error).toHaveBeenCalledWith(
        "[firebase-quota] Read quota exceeded: テスト"
      );
    });
  });
});
