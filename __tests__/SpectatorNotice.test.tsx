import { render, screen } from "@testing-library/react";
import React from "react";
import { ChakraProvider } from "@chakra-ui/react";

import { SpectatorNotice } from "@/components/ui/SpectatorNotice";
import type { SeatRequestViewState } from "@/lib/spectator/v2/useSpectatorController";
import system from "@/theme";

function renderNotice(
  props: Omit<React.ComponentProps<typeof SpectatorNotice>, "onRetryJoin" | "onForceExit">
) {
  return render(
    <ChakraProvider value={system}>
      <SpectatorNotice
        {...props}
        onRetryJoin={() => {}}
        onForceExit={() => {}}
        spectatorUpdateButton={null}
      />
    </ChakraProvider>
  );
}

const baseState: SeatRequestViewState = {
  status: "idle",
  source: null,
  requestedAt: null,
  error: null,
};

describe("SpectatorNotice", () => {
  test("displays pending copy while awaiting host approval", () => {
    renderNotice({
      reason: "waiting-open",
      seatRequestState: { ...baseState, status: "pending", source: "manual" },
      seatRequestPending: true,
      seatRequestAccepted: false,
      seatRequestRejected: false,
      seatRequestTimedOut: false,
      seatRequestButtonDisabled: false,
    });

    expect(screen.getByText("ホストが再開準備中だよ")).toBeInTheDocument();
    expect(screen.getByText("席に戻る申請を送信しました。ホストの承認を待っています…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ロビーへ戻る" })).toBeEnabled();
  });

  test("displays rejection copy after host denial", () => {
    renderNotice({
      reason: "waiting-open",
      seatRequestState: {
        ...baseState,
        status: "rejected",
        source: "manual",
        error: "host-denied",
      },
      seatRequestPending: false,
      seatRequestAccepted: false,
      seatRequestRejected: true,
      seatRequestTimedOut: false,
      seatRequestButtonDisabled: false,
    });

    expect(screen.getByText("席に戻る申請が見送られました。もう少し待ってから再度お試しください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ロビーへ戻る" })).toBeEnabled();
  });

  test("shows timeout guidance when no host response", () => {
    renderNotice({
      reason: "mid-game",
      seatRequestState: baseState,
      seatRequestPending: false,
      seatRequestAccepted: false,
      seatRequestRejected: false,
      seatRequestTimedOut: true,
      seatRequestButtonDisabled: false,
    });

    expect(
      screen.getByText("応答がありませんでした。電波状況を確認してから、ロビーへ戻って入り直してください。")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ロビーへ戻る" })).toBeEnabled();
  });

  test("prompts update when version mismatch", () => {
    renderNotice({
      reason: "version-mismatch",
      seatRequestState: baseState,
      seatRequestPending: false,
      seatRequestAccepted: false,
      seatRequestRejected: false,
      seatRequestTimedOut: false,
      seatRequestButtonDisabled: true,
    });

    expect(screen.getByText("新しいバージョンがあります。アップデートしてください！")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今すぐ更新" })).toBeInTheDocument();
  });
});
