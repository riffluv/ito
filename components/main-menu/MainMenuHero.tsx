"use client";

import { KnightCharacter } from "@/components/main-menu/KnightCharacter";
import { AppButton } from "@/components/ui/AppButton";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { logError } from "@/lib/utils/log";
import { Box, Container, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { BookOpen, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTransition } from "@/components/ui/TransitionProvider";

type MainMenuHeroProps = {
  displayName: string | null | undefined;
  onCreateRoom: () => void;
  onOpenPlayerSettings: () => void;
};

export function MainMenuHero(props: MainMenuHeroProps) {
  const { displayName, onCreateRoom, onOpenPlayerSettings } = props;
  const router = useRouter();
  const transition = useTransition();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let mounted = true;

    const target = titleRef.current;
    if (target) {
      const run = async () => {
        try {
          const mod = await import("gsap");
          if (!mounted) return;
          mod.gsap.fromTo(
            target,
            {
              opacity: 0,
              y: 20,
              scale: 0.95,
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.87,
              ease: "back.out(1.17)",
              delay: 0.23,
            }
          );
        } catch {
          // ignore animation failure in production; keeps main menu usable
        }
      };

      void run();
    }

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box
      position="relative"
      zIndex={1}
      overflow="hidden"
      pt={{
        base: scaleForDpi("5.7rem"),
        md: scaleForDpi("7.3rem"),
        lg: scaleForDpi("9.1rem"),
      }}
      pb={{
        base: scaleForDpi("2.3rem"),
        md: scaleForDpi("3.1rem"),
        lg: scaleForDpi("4.3rem"),
      }}
      css={{
        // グラスモーフィズム: 魔法の結晶風vignette（Pixi背景を透かす）
        background:
          "radial-gradient(ellipse 76% 58% at center 32%, transparent 0%, rgba(8,12,18,0.12) 42%, rgba(6,9,15,0.35) 78%, rgba(4,6,11,0.48) 100%)",
        containerType: "inline-size",
        "@container (max-width: 600px)": {
          paddingTop: scaleForDpi("5.1rem"),
          paddingBottom: scaleForDpi("2.1rem"),
        },
        "@container (min-width: 600px) and (max-width: 900px)": {
          paddingTop: scaleForDpi("6.4rem"),
          paddingBottom: scaleForDpi("2.8rem"),
        },
        "@container (min-width: 900px)": {
          paddingTop: scaleForDpi("8.2rem"),
          paddingBottom: scaleForDpi("3.7rem"),
        },
      }}
    >
      <Container
        maxW="var(--ui-menu-max-w)"
        px="var(--ui-main-pad)"
        position="relative"
        zIndex={1}
      >
        <VStack gap={{ base: "47px", lg: "61px" }} align="center">
          <VStack gap="19px" align="center" textAlign="center" maxW="4xl">
            <Box>
              {/* 騎士とタイトルのメインビジュアル */}
              <HStack
                justify="center"
                align="flex-end"
                gap={{ base: "11px", md: "17px" }}
                mb="13px"
                flexWrap={{ base: "wrap", md: "nowrap" }}
              >
                <Box transform="translateY(1.5px) translateX(-2px)">
                  <KnightCharacter />
                </Box>
                <Heading
                  ref={titleRef}
                  fontSize={{
                    base: scaleForDpi("2.3rem"),
                    md: scaleForDpi("3.7rem"),
                    lg: scaleForDpi("4.6rem"),
                  }}
                  fontWeight={900}
                  lineHeight="0.87"
                  letterSpacing="0.051em"
                  color="fgEmphasized"
                  textShadow="0 3px 8px rgba(0,0,0,0.62), 0 1px 2px rgba(0,0,0,0.8)"
                  fontFamily="'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', YuGothic, 'Meiryo UI', Meiryo, 'MS PGothic', sans-serif"
                  css={{
                    WebkitTextStroke: "0.4px rgba(255,255,255,0.15)",
                    textTransform: "none",
                    filter: "drop-shadow(0 4px 9px rgba(0,0,0,0.52))",
                    "@container (max-width: 600px)": {
                      fontSize: scaleForDpi("2.1rem"),
                    },
                    "@container (min-width: 600px) and (max-width: 900px)": {
                      fontSize: scaleForDpi("3.3rem"),
                    },
                    "@container (min-width: 900px)": {
                      fontSize: scaleForDpi("4.3rem"),
                    },
                  }}
                >
                  序の紋章III
                </Heading>
              </HStack>
              <Box mt="4px" mb="11px">
                <Box
                  h="1px"
                  bg="rgba(255,215,0,0.22)"
                  boxShadow="0 0 3px rgba(255,215,0,0.15)"
                />
                <Box
                  h="1px"
                  bg="rgba(0,0,0,0.65)"
                  transform="translateY(-1px)"
                />
              </Box>
              <Text
                fontSize={{
                  base: scaleForDpi("1.17rem"),
                  md: scaleForDpi("1.43rem"),
                  lg: scaleForDpi("1.71rem"),
                }}
                color="rgba(255,255,255,0.87)"
                fontWeight={500}
                lineHeight="1.42"
                letterSpacing="0.021em"
                maxW="3xl"
                mx="auto"
                textShadow="0 2px 5px rgba(0,0,0,0.58)"
                css={{
                  "@container (max-width: 600px)": {
                    fontSize: scaleForDpi("1.09rem"),
                    lineHeight: "1.52",
                  },
                  "@container (min-width: 600px) and (max-width: 900px)": {
                    fontSize: scaleForDpi("1.31rem"),
                    lineHeight: "1.47",
                  },
                  "@container (min-width: 900px)": {
                    fontSize: scaleForDpi("1.63rem"),
                    lineHeight: "1.43",
                  },
                }}
              >
                数字カードゲーム
                <Box
                  as="span"
                  display={{ base: "block", md: "inline" }}
                  color="rgba(255,255,255,0.93)"
                  fontWeight={600}
                  ml={{ md: scaleForDpi("0.4rem") }}
                  letterSpacing="0.015em"
                >
                  協力して正しい順に並べよう
                </Box>
              </Text>
            </Box>

            {/* ドラクエ風コマンドメニュー */}
            <VStack gap="17px" align="center" w="100%" mt="38px">
              {/* メインCTA: 新しい部屋を作成 */}
              <AppButton
                size="lg"
                visual="solid"
                palette="brand"
                onClick={onCreateRoom}
                css={{
                  position: "relative",
                  minWidth: "260px",
                  maxWidth: "280px",
                  width: "auto",
                  px: scaleForDpi("32px"),
                  py: scaleForDpi("16px"),
                  fontSize: scaleForDpi("1.15rem"),
                  fontWeight: "700",
                  fontFamily: "monospace",
                  letterSpacing: "0.5px",
                  borderRadius: "0",
                  border: "3px solid rgba(255,255,255,0.9)",
                  background:
                    "linear-gradient(to bottom, rgba(255,128,45,0.95), rgba(235,110,30,0.92))",
                  boxShadow:
                    "0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,0.62), 4px 5px 0 rgba(0,0,0,0.48), 2px 3px 0 rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.25)",
                  textShadow: "2px 2px 0px rgba(0,0,0,0.85)",
                  transitionProperty:
                    "transform, box-shadow, background, border-color",
                  transitionDuration: "183ms",
                  transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                  willChange: "transform",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    background:
                      "linear-gradient(to bottom, rgba(255,145,65,0.98), rgba(255,128,45,0.95))",
                    borderColor: "rgba(255,255,255,0.95)",
                    boxShadow:
                      "0 0 0 2px rgba(235,110,35,0.85), 6px 8px 0 rgba(0,0,0,0.68), 5px 7px 0 rgba(0,0,0,0.54), 3px 5px 0 rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.3)",
                  },
                  "&:active": {
                    transform: "translateY(1px)",
                    boxShadow:
                      "0 0 0 2px rgba(200,85,20,0.82), 2px 3px 0 rgba(0,0,0,0.62), 1px 2px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.15)",
                  },
                }}
              >
                <Plus size={20} style={{ marginRight: "10px" }} />
                新しい部屋を作成
              </AppButton>

              {/* サブメニュー: 横並び（ドラクエ風） */}
              <HStack gap="15px" justify="center" flexWrap="wrap">
                <AppButton
                  size="md"
                  visual="outline"
                  palette="gray"
                  css={{
                    minWidth: "130px",
                    px: scaleForDpi("20px"),
                    py: scaleForDpi("11px"),
                    fontSize: scaleForDpi("0.95rem"),
                    fontWeight: "600",
                    fontFamily: "monospace",
                    letterSpacing: "0.5px",
                    borderRadius: "0",
                    border: "2px solid rgba(255,255,255,0.7)",
                    background: "rgba(28,32,42,0.85)",
                    boxShadow:
                      "2px 3px 0 rgba(0,0,0,0.68), 1px 2px 0 rgba(0,0,0,0.52), inset 1px 1px 0 rgba(255,255,255,0.1)",
                    textShadow: "1px 1px 0px rgba(0,0,0,0.8)",
                    transitionProperty:
                      "transform, box-shadow, background, border-color",
                    transitionDuration: "173ms",
                    transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                    willChange: "transform",
                    "&:hover": {
                      background: "rgba(38,42,52,0.95)",
                      borderColor: "rgba(255,255,255,0.85)",
                      transform: "translateY(-1px)",
                      boxShadow:
                        "3px 4px 0 rgba(0,0,0,0.72), 2px 3px 0 rgba(0,0,0,0.58), inset 1px 1px 0 rgba(255,255,255,0.15)",
                    },
                    "&:active": {
                      transform: "translateY(1px)",
                      boxShadow:
                        "1px 2px 0 rgba(0,0,0,0.72), inset 1px 1px 0 rgba(255,255,255,0.08)",
                    },
                  }}
                  onClick={async () => {
                    try {
                      await transition.navigateWithTransition("/rules", {
                        direction: "fade",
                        duration: 0.8,
                        showLoading: true,
                        loadingSteps: [
                          {
                            id: "loading",
                            message: "よみこみ中...",
                            duration: 620,
                          },
                          {
                            id: "ready",
                            message: "かんりょう！",
                            duration: 280,
                          },
                        ],
                      });
                    } catch (error) {
                      logError("main-menu", "rules-navigation", error);
                      router.push("/rules");
                    }
                  }}
                  onMouseEnter={() => router.prefetch("/rules")}
                >
                  <BookOpen size={16} style={{ marginRight: "6px" }} />
                  ルール
                </AppButton>
                <AppButton
                  size="md"
                  visual="outline"
                  palette="gray"
                  onClick={onOpenPlayerSettings}
                  css={{
                    minWidth: "130px",
                    px: scaleForDpi("20px"),
                    py: scaleForDpi("11px"),
                    fontSize: scaleForDpi("0.95rem"),
                    fontWeight: "600",
                    fontFamily: "monospace",
                    letterSpacing: "0.5px",
                    borderRadius: "0",
                    border: displayName
                      ? "2px solid rgba(255,255,255,0.7)"
                      : "2px solid rgba(255,215,0,0.8)",
                    background: displayName
                      ? "rgba(28,32,42,0.85)"
                      : "rgba(255,215,0,0.15)",
                    boxShadow: displayName
                      ? "2px 2px 0 rgba(0,0,0,0.7), inset 1px 1px 0 rgba(255,255,255,0.1)"
                      : "2px 2px 0 rgba(0,0,0,0.7), inset 1px 1px 0 rgba(255,255,255,0.15), 0 0 8px rgba(255,215,0,0.3)",
                    textShadow: "1px 1px 0px rgba(0,0,0,0.8)",
                    color: displayName
                      ? "rgba(255,255,255,0.92)"
                      : "rgba(255,235,205,0.98)",
                    transitionProperty:
                      "transform, box-shadow, background, border-color",
                    transitionDuration: "170ms",
                    transitionTimingFunction: "cubic-bezier(.2,1,.3,1)",
                    willChange: "transform",
                    "&:hover": {
                      background: displayName
                        ? "rgba(38,42,52,0.95)"
                        : "rgba(255,215,0,0.22)",
                      borderColor: displayName
                        ? "rgba(255,255,255,0.85)"
                        : "rgba(255,215,0,0.95)",
                      transform: "translateY(-1px)",
                      boxShadow: displayName
                        ? "3px 3px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.15)"
                        : "3px 3px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.2), 0 0 12px rgba(255,215,0,0.4)",
                    },
                    "&:active": {
                      transform: "translateY(1px)",
                      boxShadow:
                        "1px 1px 0 rgba(0,0,0,0.75), inset 1px 1px 0 rgba(255,255,255,0.08)",
                    },
                  }}
                >
                  <User size={16} style={{ marginRight: "6px" }} />
                  プレイヤー設定
                </AppButton>
              </HStack>
            </VStack>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}

