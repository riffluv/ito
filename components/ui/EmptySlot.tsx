import { Box, Text } from "@chakra-ui/react";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * 空のカードスロットコンポーネント
 * sort-submitモードで使用する配置予定スロット
 */
interface EmptySlotProps {
  index: number; // 1-based表示用のインデックス
  totalSlots?: number; // 全スロット数（LOW/HIGH判定用）
}

export function EmptySlot({ index, totalSlots = 5 }: EmptySlotProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const diamondLeftRef = useRef<HTMLDivElement>(null);
  const diamondRightRef = useRef<HTMLDivElement>(null);

  // LOW/HIGH判定（左端がLOW、右端がHIGH）
  const isLowSlot = index === 1;
  const isHighSlot = index === totalSlots;
  const label = isLowSlot ? "LOW" : isHighSlot ? "HIGH" : null;
  const subLabel = isLowSlot ? "(小)" : isHighSlot ? "(大)" : null;

  // Octopath風の脈打つアニメーション
  useEffect(() => {
    if (!boxRef.current || !diamondLeftRef.current || !diamondRightRef.current) return;

    // 枠の脈打ちアニメ（非定型値）
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(boxRef.current, {
      borderColor: "rgba(255, 255, 255, 0.72)",
      duration: 0.87,
      ease: "sine.inOut",
    })
    .to(boxRef.current, {
      borderColor: "rgba(255, 255, 255, 0.28)",
      duration: 0.93,
      ease: "sine.inOut",
    });

    // ダイヤモンド装飾の回転アニメ（左右非対称）
    gsap.to(diamondLeftRef.current, {
      rotation: 359,
      duration: 4.2,
      repeat: -1,
      ease: "none",
    });

    gsap.to(diamondRightRef.current, {
      rotation: -362,
      duration: 3.8,
      repeat: -1,
      ease: "none",
    });

    return () => {
      tl.kill();
      gsap.killTweensOf([boxRef.current, diamondLeftRef.current, diamondRightRef.current]);
    };
  }, []);

  return (
    <Box
      ref={boxRef}
      data-slot
      css={{
        aspectRatio: "5 / 7",
        width: UNIFIED_LAYOUT.CARD.WIDTH,
        placeSelf: "start",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "9px",
        background: "transparent",
        border: "2.5px dashed rgba(255, 255, 255, 0.3)",
        borderRadius: 0,
        cursor: "pointer",
        position: "relative",
        transition: `color 0.17s ${UI_TOKENS.EASING.standard}, transform 0.13s ${UI_TOKENS.EASING.standard}`,

        "&:hover": {
          color: "rgba(255, 255, 255, 0.95)",
          transform: "scale(1.03)",
          boxShadow: "inset 0 0 11px rgba(255, 255, 255, 0.14)",
        },

        "&::before": {
          content: '""',
          position: "absolute",
          top: "7px",
          left: "9px",
          right: "7px",
          bottom: "9px",
          border: "1px dotted rgba(255, 255, 255, 0.18)",
          borderRadius: 0,
        },
      }}
    >
      {/* 上部のダイヤモンド装飾（LOW/HIGHの時のみ） */}
      {label && (
        <Box
          ref={diamondLeftRef}
          position="absolute"
          top="-8px"
          left="50%"
          transform="translateX(-50%) rotate(45deg)"
          w="13px"
          h="13px"
          bg="rgba(255,255,255,0.88)"
          border="2px solid rgba(255,255,255,0.95)"
          boxShadow="0 0 9px rgba(255,255,255,0.7), inset -1px -1px 2px rgba(0,0,0,0.3)"
        />
      )}

      {/* LOW/HIGHラベル */}
      {label && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap="3px"
          mt="19px"
        >
          <Text
            fontSize="1.1rem"
            fontWeight="800"
            fontFamily="monospace"
            color="rgba(255,255,255,0.92)"
            letterSpacing="0.083em"
            textShadow="0 0 8px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.9), 1px 1px 0px #000"
          >
            {label}
          </Text>
          <Text
            fontSize="0.7rem"
            fontWeight="600"
            fontFamily="monospace"
            color="rgba(255,255,255,0.58)"
            letterSpacing="0.021em"
            textShadow="1px 1px 0px #000"
          >
            {subLabel}
          </Text>
        </Box>
      )}

      {/* 番号表示（真ん中のスロットのみ） */}
      {!label && (
        <Text
          fontSize="1.5rem"
          fontWeight="bold"
          fontFamily="monospace"
          color="rgba(255, 255, 255, 0.6)"
          textShadow="1px 1px 0px #000"
          letterSpacing="0.93px"
        >
          {index}
        </Text>
      )}

      {/* 下部のダイヤモンド装飾（LOW/HIGHの時のみ） */}
      {label && (
        <Box
          ref={diamondRightRef}
          position="absolute"
          bottom="-7px"
          left="50%"
          transform="translateX(-50%) rotate(45deg)"
          w="11px"
          h="11px"
          bg="rgba(255,255,255,0.85)"
          border="2px solid rgba(255,255,255,0.92)"
          boxShadow="0 0 7px rgba(255,255,255,0.65), inset -1px -1px 2px rgba(0,0,0,0.28)"
        />
      )}
    </Box>
  );
}

export default EmptySlot;
