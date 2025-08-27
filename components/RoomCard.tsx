"use client";
import { AppCard } from "@/components/ui/AppCard";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

export function RoomCard({
  name,
  status,
  count,
  onJoin,
}: {
  name: string;
  status: string;
  count: number;
  onJoin: () => void;
}) {
  const statusLabel = status === "waiting" ? "待機中" : "ゲーム中";
  const isWaiting = status === "waiting";
  
  return (
    <AppCard 
      role="group" 
      interactive 
      className="animate-fadeInUp" 
      minH={{ base: 36, md: 40 }}
      position="relative"
      border="1px solid #e2e8f0" // --slate-200 (ゲーム画面と統一)
      _hover={{
        borderColor: "#cbd5e1", // --slate-300
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)", // cardElevated
      }}
    >
      {/* シンプルなステータス表示 */}
      <Box
        position="absolute"
        top="0.875rem" // 14px - 微妙にずらす
        right="0.875rem" // 14px - 微妙にずらす
        w="8px" // より控えめ
        h="8px"
        borderRadius="full"
        bg={isWaiting ? "#16a34a" : "#ea580c"} // green-600 : orange-600 より深い色
      />
      
      <Stack gap={4}>
        {/* ルーム名 - ゲーム画面スタイル */}
        <Box>
          <Text
            fontWeight={700}
            fontSize={{ base: "lg", md: "xl" }}
            color="#0f172a" // --slate-900
            fontFamily="Inter, 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, sans-serif"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            letterSpacing="tight"
            mb="2"
          >
            {name}
          </Text>
          <Text
            fontSize="sm"
            color="#6b7280" // より自然なグレー
            fontWeight={400} // より軽く
          >
            {statusLabel}
          </Text>
        </Box>

        {/* シンプルな統計表示 */}
        <Box
          bg="#f9fafb" // より控えめな背景
          borderRadius="6px" // 少し角を立てる
          padding="0.625rem" // 微妙に小さく
        >
          <HStack justify="space-between" align="center">
            <Box>
              <Text
                fontSize="xs"
                color="#9ca3af" // より薄いグレー
                fontWeight={400}
                mb="1px"
              >
                参加者数
              </Text>
              <Text
                fontSize="lg" // 少し小さく
                fontWeight={600}
                color="#111827"
              >
                {count}人
              </Text>
            </Box>
            <Box textAlign="right">
              <Text
                fontSize="xs"
                color="#9ca3af"
                fontWeight={400}
                mb="1px"
              >
                状態
              </Text>
              <Text
                fontSize="sm"
                fontWeight={500}
                color={isWaiting ? "#059669" : "#dc2626"} // red-600 でよりわかりやすく
              >
                {isWaiting ? "募集中" : "開始済"}
              </Text>
            </Box>
          </HStack>
        </Box>

        {/* 自然なアクションボタン */}
        <AppButton
          colorPalette={isWaiting ? "orange" : "gray"}
          visual="soft"
          size="md"
          minW="100%"
          height="2.5rem" // 少し低く
          onClick={onJoin}
          aria-label={`${name}に参加`}
          disabled={!isWaiting}
          fontWeight={500} // 軽く
          _hover={{
            opacity: isWaiting ? 0.85 : 1,
          }}
          transition="opacity 0.1s ease"
        >
          {isWaiting ? "参加する" : "開始済み"}
        </AppButton>
      </Stack>
    </AppCard>
  );
}
