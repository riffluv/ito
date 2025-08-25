"use client";
import { useThemePresets } from "@/context/ThemePresetContext";
import { HStack, Text } from "@chakra-ui/react";

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
    <select
      value={activeName}
      onChange={(e: any) => setActiveByName(e.target.value)}
      style={{
        fontSize: props.compact ? "0.75rem" : "0.875rem",
        padding: "2px 8px",
        borderWidth: "1px",
        borderColor: "var(--chakra-colors-border-default)",
        borderRadius: "0.375rem",
        backgroundColor: "var(--chakra-colors-panel-bg)",
        color: "var(--chakra-colors-fg-default)",
      }}
    >
      {names.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
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
