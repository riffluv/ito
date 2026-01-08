import type { HostClaimStatus } from "@/lib/hooks/useHostClaim";

export function deriveHostClaimMessage(hostClaimStatus: HostClaimStatus | undefined): string {
  switch (hostClaimStatus) {
    case "requesting":
      return "ホスト権限を申請中...";
    case "confirming":
      return "ホスト権限の確定を待機しています...";
    case "pending":
      return "ホスト権限を準備中...";
    default:
      return "ホスト権限を準備中...";
  }
}

