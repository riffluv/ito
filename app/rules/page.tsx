"use client";

import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, Container, VStack } from "@chakra-ui/react";
import { useCallback } from "react";
import { RulesFooterSection } from "./_components/RulesFooterSection";
import { RulesFlowSection } from "./_components/RulesFlowSection";
import { RulesHeroSection } from "./_components/RulesHeroSection";
import { RulesOnlineFeaturesSection } from "./_components/RulesOnlineFeaturesSection";
import { RulesTipsSection } from "./_components/RulesTipsSection";
import { useRouter } from "next/navigation";
import { useTransition } from "@/components/ui/TransitionProvider";

export default function RulesPage() {
  const router = useRouter();
  const transition = useTransition();

  const handleBackToMenu = useCallback(async () => {
    try {
      await transition.navigateWithTransition(
        "/",
        {
          direction: "fade",
          duration: 0.83,
          showLoading: true,
          loadingSteps: [
            { id: "return", message: "メインメニューに もどっています...", duration: 1000 },
          ],
        }
      );
    } catch (error) {
      console.error("Main menu navigation failed:", error);
      router.push("/");
    }
  }, [router, transition]);

  return (
    <Box
      minH="100dvh"
      bg="richBlack.900" // ドラクエ風リッチブラック背景
      position="relative"
    >
      <Container
        maxW="4xl"
        py={{ base: scaleForDpi("5.3rem"), md: scaleForDpi("6.1rem") }}
        position="relative"
      >
        <RulesHeroSection onBackToMenu={handleBackToMenu} />

        <VStack
          gap={{ base: scaleForDpi("2.7rem"), md: scaleForDpi("3.2rem") }}
          align="stretch"
        >
          {/* ゲームの流れ */}
          <RulesFlowSection />

          {/* 判定方法（モード） */}
          <RulesOnlineFeaturesSection />

          {/* ルール要点・コツ・例 */}
          <RulesTipsSection />
        </VStack>

        <RulesFooterSection onBackToMenu={handleBackToMenu} />
      </Container>
    </Box>
  );
}
