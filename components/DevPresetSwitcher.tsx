"use client";
import { useThemePresets } from "@/context/ThemePresetContext";
import { Box, HStack, Text } from "@chakra-ui/react";

/**
 * 開発用: デザイナー/開発者が即座にプリセットを切り替えて検証するための軽量スイッチャー。
 * 本番ビルドではツリーシェイキングで除外/ガード可能 (env チェックなど) を想定。
 * CSS統一化により、インラインスタイルをChakra UIプロパティに変換。
 */
export function DevPresetSwitcher(props: { compact?: boolean }) {
  const { active, presets, setActiveByName } = useThemePresets();
  const activeName = active?.name || "";
  const names = presets.map((p) => p.name);
  if (names.length <= 1) return null;

  const select = (
    <Box
      as="select"
      value={activeName}
      onChange={(e: any) => setActiveByName(e.target.value)}
      fontSize={props.compact ? "xs" : "sm"}
      p="2px 8px"
      borderWidth="1px"
      borderColor="borderDefault"
      borderRadius="md"
      bg="panelBg"
      color="fgDefault"
    >
      {names.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </Box>
  );

  if (props.compact) return select;

  return (
    <HStack gap={2} fontSize="sm">
      <Text as="span" opacity={0.7}>
        Preset:
      </Text>
      {select}
    </HStack>
  );
}
