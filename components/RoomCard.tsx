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
      border="1px solid"
      borderColor="borderDefault"
      _hover={{
        borderColor: "gray.300",
        boxShadow: "var(--shadows-cardElevated)",
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
        bg={isWaiting ? "green.600" : "orange.600"}
      />
      
      <Stack gap={4}>
        {/* ルーム名 - ゲーム画面スタイル */}
        <Box>
          <Text
            fontWeight={700}
            fontSize={{ base: "lg", md: "xl" }}
            color="fgDefault"
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
            color="fgMuted"
            fontWeight={400} // より軽く
          >
            {statusLabel}
          </Text>
        </Box>

        {/* シンプルな統計表示 */}
        <Box bg="gray.50" borderRadius="6px" padding="0.625rem">
          <HStack justify="space-between" align="center">
            <Box>
              <Text fontSize="xs" color="gray.400" fontWeight={400} mb="1px">
                参加者数
              </Text>
              <Text fontSize="lg" fontWeight={600} color="gray.900">
                {count}人
              </Text>
            </Box>
            <Box textAlign="right">
              <Text fontSize="xs" color="gray.400" fontWeight={400} mb="1px">
                状態
              </Text>
              <Text fontSize="sm" fontWeight={500} color={isWaiting ? "green.600" : "red.600"}>
                {isWaiting ? "募集中" : "開始済"}
              </Text>
            </Box>
          </HStack>
        </Box>

        {/* 自然なアクションボタン */}
        <AppButton
          colorPalette={isWaiting ? "orange" : "gray"}
          visual="subtle"
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
