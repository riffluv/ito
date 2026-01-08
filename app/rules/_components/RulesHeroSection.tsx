"use client";

import { AppButton } from "@/components/ui/AppButton";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, Flex, Heading, HStack, Image, Text, VStack } from "@chakra-ui/react";
import { ArrowLeft, BookOpen } from "lucide-react";

export function RulesHeroSection(props: {
  onBackToMenu: () => void | Promise<void>;
}) {
  const { onBackToMenu } = props;

  return (
    <VStack
      mb={{ base: scaleForDpi("4.2rem"), md: scaleForDpi("5.3rem") }}
      align="stretch"
      gap={scaleForDpi("3.2rem")}
    >
      <Flex
        justify="space-between"
        align="center"
        wrap="wrap"
        gap={scaleForDpi("1.1rem")}
      >
        <AppButton
          onClick={onBackToMenu}
          visual="solid"
          palette="brand"
          size="lg"
        >
          <ArrowLeft size={20} style={{ marginRight: "8px" }} />
          メインメニューに戻る
        </AppButton>
        <Box
          border="2px solid rgba(255,255,255,0.9)"
          borderRadius={0}
          px={3}
          py={1}
          bg="rgba(12,14,20,0.7)"
          css={{
            boxShadow:
              "1px 1px 0 rgba(0,0,0,0.8), 2px 2px 0 rgba(0,0,0,0.6)",
          }}
        >
          <HStack gap={scaleForDpi("0.4rem")}>
            <BookOpen size={14} color="rgba(255,255,255,0.95)" />
            <Text
              fontSize="sm"
              fontWeight={700}
              color="rgba(255,255,255,0.95)"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
            >
              ゲームルール
            </Text>
          </HStack>
        </Box>
      </Flex>

      <VStack align="start" gap={scaleForDpi("1.6rem")}>
        <Heading
          size="4xl"
          fontWeight="bold"
          color="rgba(255,255,255,0.95)"
          fontFamily="monospace"
          textShadow="0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(255,215,0,0.2)"
          letterSpacing="0.083em"
          textAlign="center"
          mb={scaleForDpi("1.1rem")}
          pb={scaleForDpi("0.8rem")}
          css={{
            borderBottom: "2px solid rgba(255,255,255,0.2)",
          }}
        >
          序の紋章III のきまり
        </Heading>
        <HStack
          align="center"
          gap={scaleForDpi("2.1rem")}
          flexWrap={{ base: "wrap", md: "nowrap" }}
          justify={{ base: "center", md: "center" }}
          w="100%"
        >
          {/* カード画像 */}
          <Box
            flex="0 0 auto"
            display="flex"
            justifyContent="center"
            alignItems="center"
            w={{ base: "120px", md: "150px", lg: "170px" }}
            mx="auto"
          >
            <Image
              src="/images/card3.webp"
              alt="ゲームカード"
              width={{ base: "100px", md: "130px", lg: "150px" }}
              height={{ base: "100px", md: "130px", lg: "150px" }}
              style={{
                imageRendering: "pixelated",
                filter: "drop-shadow(0 8px 25px rgba(0,0,0,0.9))",
                transform: "translateZ(0)",
              }}
            />
          </Box>

          {/* テキストボックス */}
          <Box
            p={scaleForDpi("1.6rem")}
            bg="bgPanel"
            border="borders.retrogame"
            borderColor="whiteAlpha.90"
            borderRadius={0}
            boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
            flex={1}
            minW={{ base: "100%", md: "0" }}
          >
            <Text
              fontSize={{
                base: scaleForDpi("1.05rem"),
                md: scaleForDpi("1.17rem"),
              }}
              color="whiteAlpha.95"
              fontFamily="monospace"
              lineHeight="1.73"
              textAlign="center"
              textShadow="1px 1px 2px rgba(0,0,0,0.8)"
              letterSpacing="0.31px"
            >
              協力型のパーティーゲーム。
              <br />
              各プレイヤーは 1〜100の 数字を持ち、
              <br />
              自分の数字を直接言わずに
              <br />
              「お題」に沿った表現で伝え、
              <br />
              全員でカードを小さい順に
              <br />
              並べることを目指します。
            </Text>
          </Box>
        </HStack>
      </VStack>
    </VStack>
  );
}

