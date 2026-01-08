"use client";
import { notify } from "@/components/ui/notify";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { useSoundManager, useSoundSettings } from "@/lib/audio/SoundProvider";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { useSupportToolsEnabled } from "@/lib/hooks/useSupportToolsEnabled";
import { updateRoomOptions } from "@/lib/services/roomService";
import type { RoomDoc } from "@/lib/types";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Dialog, Text } from "@chakra-ui/react";
import { useEffect, useState as useLocalState, useState, useRef, useCallback } from "react";
import {
  bootstrapBackgroundTheme,
  DEFAULT_BACKGROUND_THEME,
  persistBackgroundTheme,
} from "@/lib/pixi/backgroundPreference";
import { usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import PIXI from "@/lib/pixi/instance";
import { drawSettingsModalBackground } from "@/lib/pixi/settingsModalBackground";
import { MODAL_FRAME_STYLES } from "@/components/ui/modalFrameStyles";
import {
  SettingsModalGameTab,
  SettingsModalGraphicsTab,
  SettingsModalSoundTab,
} from "@/components/settings/SettingsModalTabs";
import {
  getBackgroundFromVariant,
  type BackgroundOption,
  type GraphicsTab,
  type SceneryVariant,
  type SettingsTab,
} from "@/components/settings/settingsModalModel";
import { SettingsModalFooter } from "@/components/settings/SettingsModalFooter";
import { SettingsModalTabBar } from "@/components/settings/SettingsModalTabBar";

export type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentOptions: RoomDoc["options"];
  isHost: boolean;
  roomStatus: string;
};

export function SettingsModal({
  isOpen,
  onClose,
  roomId,
  currentOptions,
  isHost,
  roomStatus,
}: SettingsModalProps) {
  const {
    animationMode,
    setAnimationMode,
    effectiveMode,
    gpuCapability,
    supports3D,
    force3DTransforms,
    setForce3DTransforms,
  } = useAnimationSettings();

  // Pixi HUD レイヤー（モーダル背景用）
  const modalRef = useRef<HTMLDivElement | null>(null);
  const pixiContainer = usePixiHudLayer("settings-modal", {
    zIndex: 105,
  });
  const pixiGraphicsRef = useRef<PIXI.Graphics | null>(null);

  const [resolveMode, setResolveMode] = useState<string>(
    currentOptions?.resolveMode || "sort-submit"
  );
  const [defaultTopicType, setDefaultTopicType] = useState<string>(
    currentOptions?.defaultTopicType || "通常版"
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("game");

  // 背景設定のstate（localStorageから読み込み）
  const [backgroundType, setBackgroundType] = useLocalState<BackgroundOption>(
    typeof window !== "undefined"
      ? bootstrapBackgroundTheme()
      : DEFAULT_BACKGROUND_THEME
  );
  const [graphicsTab, setGraphicsTab] = useState<GraphicsTab>("background");
  const soundManager = useSoundManager();
  const soundSettings = useSoundSettings();
  const playSettingsOpen = useSoundEffect("settings_open");
  const playSettingsClose = useSoundEffect("settings_close");
  const closeOnceRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      closeOnceRef.current = false;
      playSettingsOpen();
    } else {
      closeOnceRef.current = false;
    }
  }, [isOpen, playSettingsOpen]);

  const closeWithSound = useCallback(() => {
    if (closeOnceRef.current) return;
    closeOnceRef.current = true;
    playSettingsClose();
    onClose();
  }, [onClose, playSettingsClose]);

  const [forceAnimations, setForceAnimations] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem("force-animations");
      if (stored === null) {
        window.localStorage.setItem("force-animations", "true");
        return true;
      }
      return stored === "true";
    } catch {
      return true;
    }
  });
  const [osReduced, setOsReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch {
      return false;
    }
  });

  const supportToolsEnabled = useSupportToolsEnabled();
  const [supportCopying, setSupportCopying] = useState(false);

  const handleCopySupportLog = useCallback(async () => {
    if (supportCopying) return;
    setSupportCopying(true);
    try {
      if (typeof window === "undefined") return;
      const dump = window.dumpItoMetricsJson;
      if (typeof dump !== "function") {
        notify({ title: "診断ログを取得できませんでした", type: "error" });
        return;
      }
      const label = roomId ? `support:${roomId}` : "support";
      const payload = dump(label);
      if (!payload) {
        notify({ title: "診断ログが空でした", type: "warning" });
        return;
      }
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        notify({ title: "診断ログをコピーしました", type: "success" });
      } else {
        window.prompt("診断ログをコピーしてください", payload);
        notify({ title: "診断ログを表示しました", type: "info" });
      }
    } catch {
      notify({ title: "診断ログのコピーに失敗しました", type: "error" });
    } finally {
      setSupportCopying(false);
    }
  }, [roomId, supportCopying]);

  // OSのreduce-motion変化を監視
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setOsReduced(mq.matches);
    let cleanup: (() => void) | undefined;
    try {
      mq.addEventListener("change", listener);
      cleanup = () => mq.removeEventListener("change", listener);
    } catch {
      const legacyMq = mq as MediaQueryList & {
        addListener?: (cb: (event: MediaQueryListEvent) => void) => void;
        removeListener?: (cb: (event: MediaQueryListEvent) => void) => void;
      };
      legacyMq.addListener?.(listener);
      cleanup = () => legacyMq.removeListener?.(listener);
    }
    listener();
    return () => {
      cleanup?.();
    };
  }, []);

  // localStorageから背景設定を読み込み
  useEffect(() => {
    const saved = bootstrapBackgroundTheme();
    setBackgroundType(saved);
  }, [setBackgroundType]);

  // 背景設定のリアルタイム更新
  const handleBackgroundChange = (newType: BackgroundOption) => {
    setBackgroundType(newType);
    persistBackgroundTheme(newType);
  };

  // バリエーション変更ハンドラ
  const handleVariantChange = (variant: SceneryVariant) => {
    const newBg = getBackgroundFromVariant(variant);
    handleBackgroundChange(newBg);
  };

  // アニメーション優先トグル（reduced-motion無視）
  const setForceAnimationsPersist = (next: boolean) => {
    setForceAnimations(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "force-animations",
          next ? "true" : "false"
        );
        window.dispatchEvent(new CustomEvent("forceAnimationsChanged"));
      }
    } catch {}
    notify({
      title: next ? "アニメーション優先（強制ON）" : "OS設定を尊重",
      description: next
        ? "reduce-motion を無視して軽量アニメを有効にします"
        : osReduced
          ? "OSが動きを減らす=ONのため、アニメは控えめになります"
          : "OSが動きを減らす=OFFのため、アニメは通常動作します",
      type: "info",
      duration: 1800,
    });
  };

  const handleSave = async () => {
    if (!isHost) {
      notify({ title: "ホストのみ設定を変更できます", type: "warning" });
      return;
    }

    if (roomStatus !== "waiting") {
      notify({
        title: "待機中のみ設定を変更できます",
        type: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      await updateRoomOptions(roomId, {
        resolveMode,
        defaultTopicType,
      });
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("defaultTopicType", defaultTopicType);
          // 背景はローカル専用の好みとして永続化（ホスト強制は今後追加予定）
          persistBackgroundTheme(backgroundType, { emit: false });
          // 🧩 他UIへ即時反映用のカスタムイベント
          window.dispatchEvent(
            new CustomEvent("defaultTopicTypeChanged", {
              detail: { defaultTopicType },
            })
          );
        }
      } catch {}
      notify({ title: "設定を保存しました", type: "success" });
      closeWithSound();
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : String(error);
      notify({
        title: "設定の保存に失敗しました",
        description,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // Pixi背景の描画とDOM同期
  useEffect(() => {
    const destroyGraphics = () => {
      if (pixiGraphicsRef.current) {
        if (pixiGraphicsRef.current.parent) {
          pixiGraphicsRef.current.parent.removeChild(pixiGraphicsRef.current);
        }
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
    };

    if (!isOpen || !pixiContainer) {
      destroyGraphics();
      return destroyGraphics;
    }

    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10; // 最背面に配置
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    return destroyGraphics;
  }, [isOpen, pixiContainer]);

  // DOM要素とPixiコンテナの位置・サイズ同期
  usePixiLayerLayout(modalRef, pixiContainer, {
    disabled: !isOpen || !pixiContainer,
    onUpdate: (layout) => {
      const graphics = pixiGraphicsRef.current;
      if (!graphics || layout.width <= 0 || layout.height <= 0) {
        return;
      }

      graphics.clear();
      graphics.position.set(layout.x, layout.y);
      drawSettingsModalBackground(PIXI, graphics, {
        width: layout.width,
        height: layout.height,
        dpr: layout.dpr,
      });
    },
  });

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) {
          closeWithSound();
        }
      }}
    >
      <Dialog.Backdrop
        css={{
          background: "overlayStrong",
          backdropFilter: "blur(12px) saturate(1.2)",
        }}
      />
      <Dialog.Positioner>
        <Dialog.Content
          ref={modalRef}
          data-pixi-target="settings-modal"
          css={{
            ...MODAL_FRAME_STYLES,
          }}
        >
          {/* Close button - 統一パターン */}
          <Dialog.CloseTrigger
            css={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 30,
              background: UI_TOKENS.COLORS.panelBg,
              borderRadius: "0",
              padding: "0",
              border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
              color: "white",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: "bold",
              transition: `background-color 177ms cubic-bezier(.2,1,.3,1), color 177ms cubic-bezier(.2,1,.3,1), border-color 177ms cubic-bezier(.2,1,.3,1)`,
              "&:hover": {
                background: "white",
                color: UI_TOKENS.COLORS.panelBg,
              },
            }}
          >
            ✕
          </Dialog.CloseTrigger>

          {/* Header - 統一パターン */}
          <Box
            p={6}
            position="relative"
            zIndex={20}
            css={{
              borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
            }}
          >
            <Dialog.Title
              css={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "white",
                margin: 0,
                fontFamily: "monospace",
                textShadow: UI_TOKENS.TEXT_SHADOWS.soft,
                textAlign: "center",
              }}
            >
              せっていを かえる
            </Dialog.Title>
            <Text
              fontSize="sm"
              color={UI_TOKENS.COLORS.textMuted}
              mt={1}
              css={{
                textAlign: "center",
              }}
            >
              あそびかたを きめてください
            </Text>
          </Box>

          <Dialog.Body px={6} pb={4} position="relative" zIndex={20}>
            <SettingsModalTabBar activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "game" && (
              <SettingsModalGameTab
                resolveMode={resolveMode}
                onResolveModeChange={setResolveMode}
                defaultTopicType={defaultTopicType}
                onDefaultTopicTypeChange={setDefaultTopicType}
                isHost={isHost}
                roomStatus={roomStatus}
                supportToolsEnabled={supportToolsEnabled}
                supportCopying={supportCopying}
                onCopySupportLog={handleCopySupportLog}
              />
            )}

            {activeTab === "graphics" && (
              <SettingsModalGraphicsTab
                graphicsTab={graphicsTab}
                onGraphicsTabChange={setGraphicsTab}
                backgroundType={backgroundType}
                onBackgroundChange={handleBackgroundChange}
                onVariantChange={handleVariantChange}
                gpuCapability={gpuCapability}
                supports3D={supports3D}
                animationMode={animationMode}
                effectiveMode={effectiveMode}
                force3DTransforms={force3DTransforms}
                onForce3DTransformsChange={setForce3DTransforms}
                onAnimationModeChange={setAnimationMode}
                forceAnimations={forceAnimations}
                osReduced={osReduced}
                onForceAnimationsChange={setForceAnimationsPersist}
              />
            )}
            {activeTab === "sound" && (
              <SettingsModalSoundTab
                muted={soundSettings.muted}
                masterVolume={soundSettings.masterVolume}
                soundManagerReady={Boolean(soundManager)}
              />
            )}
          </Dialog.Body>

          <SettingsModalFooter
            activeTab={activeTab}
            saving={saving}
            isHost={isHost}
            roomStatus={roomStatus}
            onClose={closeWithSound}
            onSave={handleSave}
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default SettingsModal;
