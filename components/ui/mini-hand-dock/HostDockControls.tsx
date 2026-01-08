"use client";

import OctopathDockButton from "@/components/ui/OctopathDockButton";
import Tooltip from "@/components/ui/Tooltip";
import { topicControls } from "@/lib/game/service";
import { isTopicType, type TopicType } from "@/lib/topics";
import Image from "next/image";
import React from "react";
import { FiEdit2 } from "react-icons/fi";

type HostPanelIconProps = {
  src: string;
  alt: string;
};

const HostPanelIcon = ({ src, alt }: HostPanelIconProps) => (
  <Image
    src={src}
    alt={alt}
    width={64}
    height={64}
    sizes="20px"
    style={{ width: "100%", height: "100%", objectFit: "contain" }}
    priority={false}
  />
);

type HostDockControlsProps = {
  roomId: string;
  effectiveDefaultTopicType: string | null | undefined;
  isGameFinished: boolean;
  isResetting: boolean;
  interactionDisabled: boolean;
  onOpenCustomTopic: () => void;
  onResetGame: () => Promise<unknown>;
  playCardDeal: () => void;
  playTopicShuffle: () => void;
};

export function HostDockControls(props: HostDockControlsProps) {
  const {
    roomId,
    effectiveDefaultTopicType,
    isGameFinished,
    isResetting,
    interactionDisabled,
    onOpenCustomTopic,
    onResetGame,
    playCardDeal,
    playTopicShuffle,
  } = props;

  const [topicActionLoading, setTopicActionLoading] = React.useState(false);
  const [dealActionLoading, setDealActionLoading] = React.useState(false);

  return (
    <>
      <Tooltip
        content={
          effectiveDefaultTopicType === "カスタム"
            ? "カスタムお題を設定"
            : "お題をシャッフル"
        }
        showArrow
        openDelay={220}
      >
        <OctopathDockButton
          compact
          iconBoxSize={26}
          icon={
            effectiveDefaultTopicType === "カスタム" ? (
              <FiEdit2 />
            ) : (
              <HostPanelIcon src="/images/ui/shuffle.webp" alt="Shuffle topic" />
            )
          }
          isLoading={topicActionLoading}
          disabled={
            topicActionLoading ||
            (isGameFinished && effectiveDefaultTopicType !== "カスタム") ||
            interactionDisabled
          }
          onClick={async () => {
            if (topicActionLoading) return;
            if (interactionDisabled) return;
            const mode: string | null = effectiveDefaultTopicType ?? null;

            if (mode === "カスタム") {
              onOpenCustomTopic();
              return;
            }

            if (isGameFinished) return;
            setTopicActionLoading(true);
            try {
              playTopicShuffle();
              const topicMode: TopicType = isTopicType(mode) ? mode : "通常版";
              await topicControls.shuffleTopic(roomId, topicMode);
            } finally {
              setTopicActionLoading(false);
            }
          }}
        />
      </Tooltip>

      <Tooltip content="数字を配り直す" showArrow openDelay={220}>
        <OctopathDockButton
          compact
          iconBoxSize={26}
          icon={<HostPanelIcon src="/images/ui/deal.webp" alt="Deal numbers" />}
          isLoading={dealActionLoading}
          disabled={dealActionLoading || isGameFinished || interactionDisabled}
          onClick={async () => {
            if (dealActionLoading || isGameFinished) return;
            if (interactionDisabled) return;
            setDealActionLoading(true);
            try {
              playCardDeal();
              await topicControls.dealNumbers(roomId);
            } finally {
              setDealActionLoading(false);
            }
          }}
        />
      </Tooltip>

      <Tooltip content="ゲームをリセット" showArrow openDelay={220}>
        <OctopathDockButton
          compact
          iconBoxSize={26}
          icon={<HostPanelIcon src="/images/ui/reset.webp" alt="Reset game" />}
          isLoading={isResetting}
          disabled={isResetting || interactionDisabled}
          onClick={async () => {
            if (isResetting) return;
            if (interactionDisabled) return;
            await onResetGame();
          }}
        />
      </Tooltip>
    </>
  );
}
