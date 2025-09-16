"use client";
import { Box, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { useBulletin } from "@/lib/hooks/useBulletin";
import { firebaseEnabled } from "@/lib/firebase/client";


export default function DevBoard() {
  const { posts, loading } = useBulletin(true);

  return (
    <Box
      border="2px solid"
      borderColor="border"
      bg="glassBg05"
      // ガラス効果除去
      borderRadius={0}
      p={6}
    >
      <Heading fontSize="16px" color="text" mb={2} fontWeight={700}>
        開発者からのお知らせ
      </Heading>
      <Text fontSize="sm" color="fgMuted" mb={4}>
        デザインや機能の更新情報を掲載します
      </Text>

      <VStack align="stretch" gap={3}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Box key={i} h="64px" borderRadius={0} bg="surfaceRaised" opacity={0.6} />
          ))
        ) : posts.length === 0 ? (
          <Text color="fgMuted">まだ投稿はありません。</Text>
        ) : (
          posts.map((p) => (
            <Box key={p.id} p={3} border="1px solid" borderColor="border" borderRadius={0} bg="glassBg05">
              <HStack justify="space-between" mb={1}>
                <Text fontWeight={700} color="text">
                  {p.title}
                </Text>
                <Text fontSize="xs" color="fgSubtle">
                  {p.createdAt ? new Date(p.createdAt as any).toLocaleString() : "-"}
                </Text>
              </HStack>
              <Text fontSize="sm" color="fgMuted" whiteSpace="pre-wrap">
                {p.body}
              </Text>
            </Box>
          ))
        )}
      </VStack>
    </Box>
  );
}


