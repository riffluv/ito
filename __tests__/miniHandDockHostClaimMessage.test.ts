import { deriveHostClaimMessage } from "@/components/ui/mini-hand-dock/deriveHostClaimMessage";

describe("deriveHostClaimMessage", () => {
  it("returns expected message for requesting", () => {
    expect(deriveHostClaimMessage("requesting")).toBe("ホスト権限を申請中...");
  });

  it("returns expected message for confirming", () => {
    expect(deriveHostClaimMessage("confirming")).toBe(
      "ホスト権限の確定を待機しています..."
    );
  });

  it("falls back to default message", () => {
    expect(deriveHostClaimMessage(undefined)).toBe("ホスト権限を準備中...");
  });
});

