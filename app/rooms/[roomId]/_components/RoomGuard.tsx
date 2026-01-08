"use client";

// V3: 遅延表示は不要になったため削除

// HUD は初期表示の軽量化を優先し、必要になるまで読み込まない。
// import { Hud } from "@/components/Hud";

// 中央領域はモニター・ボード・手札に絞り、それ以外の UI は周辺に配置。
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import { RoomLayout } from "./RoomLayout";
import {
  RoomStateProvider,
  useRoomStateContext,
} from "./RoomStateProvider";
import {
  useRoomComponentPrefetch,
  useRoomCoreAssetPreload,
  useRoomGuardMetricsBootstrap,
  useRoomWaitingServiceWorkerResync,
  useRoomWarmup,
} from "./roomGuardBoot";

import { AppButton } from "@/components/ui/AppButton";
import { useTransition } from "@/components/ui/TransitionProvider";
import { useAuth } from "@/context/AuthContext";
import { firebaseEnabled } from "@/lib/firebase/client";
import { ensureAuthSession } from "@/lib/firebase/authSession";
import { applyServiceWorkerUpdate, resyncWaitingServiceWorker } from "@/lib/serviceWorker/updateChannel";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Spinner, Text, HStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import {
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSoundManager } from "@/lib/audio/SoundProvider";

type AuthContextValue = ReturnType<typeof useAuth>;

type RoomGuardProps = {
  roomId: string;
};

type RoomGuardContentProps = {
  roomId: string;
  router: ReturnType<typeof useRouter>;
  transition: ReturnType<typeof useTransition> | null;
  auth: AuthContextValue;
  uid: string | null;
  authLoading: boolean;
  setPasswordVerified: Dispatch<SetStateAction<boolean>>;
};

function RoomGuardContent(props: RoomGuardContentProps) {
  const {
    roomId,
    auth,
    router,
    transition,
    uid,
    authLoading,
    setPasswordVerified,
  } = props;
  const soundManager = useSoundManager();
  const safeUpdateFeatureEnabled =
    process.env.NEXT_PUBLIC_FEATURE_SAFE_UPDATE === "1";
  const idleApplyConfiguredMs = safeUpdateFeatureEnabled
    ? Number.parseInt(process.env.NEXT_PUBLIC_FEATURE_IDLE_APPLY_MS ?? "", 10)
    : Number.NaN;
  const idleApplyMs =
    Number.isFinite(idleApplyConfiguredMs) && idleApplyConfiguredMs > 0
      ? idleApplyConfiguredMs
      : 0;
  useRoomGuardMetricsBootstrap();
  useRoomCoreAssetPreload();
  useRoomWarmup(soundManager);
  useRoomComponentPrefetch();
  useRoomWaitingServiceWorkerResync();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogLoading, setPasswordDialogLoading] = useState(false);
  const [passwordDialogError, setPasswordDialogError] = useState<string | null>(
    null
  );
  const roomState = useRoomStateContext();
  const { room: roomData, loading, roomAccessError, roomAccessErrorDetail } = roomState;
  const room = roomData;



  if (!firebaseEnabled) {
    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
      >
        <Text>
          Firebase が無効になっています。.env.local を設定してから再度お試しください。
        </Text>
      </Box>
    );
  }

  if (loading || authLoading) {
    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
      >
        <Spinner />
      </Box>
    );
  }

  if (roomAccessError === "permission-denied") {
    const handleRetry = async () => {
      try {
        await ensureAuthSession("room-access-denied-retry");
      } catch {
        // ignore
      }
      router.refresh();
    };

    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 1,
          showLoading: true,
        });
      } else {
        router.push("/");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "520px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="800"
              fontFamily="monospace"
              letterSpacing="0.1em"
              textShadow="2px 2px 0 rgba(0,0,0,0.8)"
              mb={3}
            >
              ▼ ACCESS DENIED ▼
            </Text>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="700" lineHeight={1.6}>
              認証情報が無効か、部屋へのアクセス権がありません
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              いったん再ログインしてから部屋に入り直すか、ホストに参加権限を確認してください。
            </Text>
          </Box>
          <HStack justify="center" gap={4} pt={1} flexWrap="wrap">
            <AppButton palette="gray" variant="outline" size="md" onClick={handleRetry}>
              再読み込み
            </AppButton>
            <AppButton palette="brand" size="md" onClick={handleBackToLobby}>
              ロビーへ戻る
            </AppButton>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (roomAccessError === "client-update-required") {
    const mismatch = roomAccessErrorDetail?.kind === "version-mismatch" ? roomAccessErrorDetail : null;
    const roomVersion = mismatch?.roomVersion ?? "不明";
    const clientVersion = mismatch?.clientVersion ?? APP_VERSION;

    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 1,
          showLoading: true,
        });
      } else {
        router.push("/");
      }
    };

    const handleHardReload = () => {
      try {
        window.location.reload();
      } catch {}
    };

    const handleApplyUpdate = () => {
      const applied = applyServiceWorkerUpdate({
        reason: "room:client-update-required",
        safeMode: true,
      });
      if (!applied) {
        void resyncWaitingServiceWorker("room:client-update-required");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "560px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="800" lineHeight={1.6}>
              アップデートが必要です
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              この部屋はバージョン {roomVersion} で進行中です。現在のバージョン ({clientVersion}) のままでは参加できません。
              更新を適用してから再度お試しください。
            </Text>
          </Box>
          <HStack justify="center" gap={4} pt={1} flexWrap="wrap">
            <AppButton palette="brand" size="md" onClick={handleApplyUpdate}>
              今すぐ更新
            </AppButton>
            <AppButton palette="gray" variant="outline" size="md" onClick={handleHardReload}>
              ハードリロード
            </AppButton>
            <AppButton palette="gray" variant="outline" size="md" onClick={handleBackToLobby}>
              ロビーへ戻る
            </AppButton>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (roomAccessError === "room-version-mismatch") {
    const mismatch = roomAccessErrorDetail?.kind === "version-mismatch" ? roomAccessErrorDetail : null;
    const roomVersion = mismatch?.roomVersion ?? "不明";
    const clientVersion = mismatch?.clientVersion ?? APP_VERSION;

    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 1,
          showLoading: true,
        });
      } else {
        router.push("/");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "560px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="800" lineHeight={1.6}>
              この部屋は別バージョンです
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              この部屋はバージョン {roomVersion} で進行中です。現在のバージョン ({clientVersion}) からは参加・操作できません。
              更新してもこの部屋には入れないため、新しい部屋を作成するか招待を取り直してください。
            </Text>
          </Box>
          <HStack justify="center" gap={4} pt={1} flexWrap="wrap">
            <AppButton palette="brand" size="md" onClick={handleBackToLobby}>
              ロビーへ戻る
            </AppButton>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (roomAccessError === "room-version-check-failed") {
    const detail = roomAccessErrorDetail?.kind === "version-check-failed" ? roomAccessErrorDetail.detail : null;

    const handleRetry = () => {
      router.refresh();
    };

    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 1,
          showLoading: true,
        });
      } else {
        router.push("/");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "560px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="800" lineHeight={1.6}>
              バージョン確認に失敗しました
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              {detail ? `詳細: ${detail}` : null}
              {detail ? <br /> : null}
              ページを再読み込みしてから、もう一度入室をお試しください。
            </Text>
          </Box>
          <HStack justify="center" gap={4} pt={1} flexWrap="wrap">
            <AppButton palette="gray" variant="outline" size="md" onClick={handleRetry}>
              再読み込み
            </AppButton>
            <AppButton palette="brand" size="md" onClick={handleBackToLobby}>
              ロビーへ戻る
            </AppButton>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (!room) {
    const handleBackToLobby = async () => {
      if (transition) {
        await transition.navigateWithTransition(
          "/",
          {
            direction: "fade",
            duration: 1.0,
            showLoading: true,
            loadingSteps: [
              { id: "disconnect", message: "せつだん中です...", duration: 730 },
              { id: "return", message: "ロビーへ もどります...", duration: 880 },
              { id: "done", message: "かんりょう！", duration: 390 },
            ],
          }
        );
      } else {
        router.push("/");
      }
    };

    return (
      <Box
        h="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        bg="rgba(8,9,15,1)"
      >
        <Box
          position="relative"
          border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0}
          boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
          bg="rgba(8,9,15,0.9)"
          color={UI_TOKENS.COLORS.textBase}
          px={{ base: 6, md: 8 }}
          py={{ base: 6, md: 7 }}
          maxW={{ base: "90%", md: "520px" }}
          _before={{
            content: '""',
            position: "absolute",
            inset: "8px",
            border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            pointerEvents: "none",
          }}
        >
          <Box textAlign="center" mb={5}>
            <Text
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="800"
              fontFamily="monospace"
              letterSpacing="0.1em"
              textShadow="2px 2px 0 rgba(0,0,0,0.8)"
              mb={3}
            >
              ▼ 404 - Not Found ▼
            </Text>
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              fontWeight="700"
              lineHeight={1.6}
              textShadow="1px 1px 0 rgba(0,0,0,0.8)"
            >
              おっと、部屋が見つかりません
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color={UI_TOKENS.COLORS.whiteAlpha80}
              lineHeight={1.7}
              mt={3}
            >
              部屋が削除されたか、URLが間違っているようです
            </Text>
          </Box>
          <Box display="flex" justifyContent="center">
            <AppButton
              onClick={handleBackToLobby}
              palette="brand"
              size="md"
              minW="180px"
            >
              ロビーへ戻る
            </AppButton>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <RoomLayout
      roomId={roomId}
      router={router}
      transition={transition}
      auth={auth}
      uid={uid}
      safeUpdateFeatureEnabled={safeUpdateFeatureEnabled}
      idleApplyMs={idleApplyMs}
      setPasswordVerified={setPasswordVerified}
      passwordDialogOpen={passwordDialogOpen}
      setPasswordDialogOpen={setPasswordDialogOpen}
      passwordDialogLoading={passwordDialogLoading}
      setPasswordDialogLoading={setPasswordDialogLoading}
      passwordDialogError={passwordDialogError}
      setPasswordDialogError={setPasswordDialogError}
      {...roomState}
    />
  );

}

export function RoomGuard({ roomId }: RoomGuardProps) {
  const auth = useAuth();
  const { user, displayName, loading: authLoading } = auth;
  const router = useRouter();
  const transition = useTransition();
  const uid = user?.uid ?? null;
  const [passwordVerified, setPasswordVerified] = useState(false);

  return (
    <RoomStateProvider
      roomId={roomId}
      uid={uid}
      displayName={displayName ?? null}
      passwordVerified={passwordVerified}
    >
      <RoomGuardContent
        roomId={roomId}
        router={router}
        transition={transition}
        auth={auth}
        uid={uid}
        authLoading={authLoading}
        setPasswordVerified={setPasswordVerified}
      />
    </RoomStateProvider>
  );
}
