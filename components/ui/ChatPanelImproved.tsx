"use client";
import { AppButton } from "@/components/ui/AppButton";
import ScrollableArea from "@/components/ui/ScrollableArea";
import { useAuth } from "@/context/AuthContext";
import { sendMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import { Badge, Box, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { useEffect, useRef, useState } from "react";

/**
 * ドラクエ風チャットパネル (改良版)
 *
 * 特徴:
 * - ドラクエ風デザイン統一 (リッチブラック、白枠、角ばったデザイン)
 * - CSS ellipsisによる名前の自動省略でコロン位置完全統一
 * - monospaceフォント + textShadowでレトロゲーム感
 * - 名前部分は100px固定幅、メッセージは100文字制限
 * - ホバーでフルネーム表示、8文字でトランケート
 *
 * 改善履歴:
 * - 2025-09: 吹き出し削除 → シンプル一行形式
 * - 2025-09: 手動省略 → CSS ellipsis (ベストプラクティス)
 * - 2025-09: right-align → left-align (コロン位置統一)
 */
export interface ChatPanelProps {
  roomId: string;
  readOnly?: boolean;
}

export function ChatPanel({ roomId, readOnly = false }: ChatPanelProps) {
  const { user, displayName } = useAuth() as any;
  const [messages, setMessages] = useState<(ChatDoc & { id: string })[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSentAt = useRef<number>(0);

  useEffect(() => {
    const q = query(
      collection(db!, "rooms", roomId, "chat"),
      orderBy("createdAt", "asc"),
      limitToLast(100)
    );

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      try { unsubRef.current?.(); } catch {}
      unsubRef.current = null;
    };

    const maybeStart = () => {
      if (unsubRef.current) return;
      const now = Date.now();
      if (now < backoffUntilRef.current) return;
      unsubRef.current = onSnapshot(
        q,
        (snap) => {
          const list: (ChatDoc & { id: string })[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...(d.data() as ChatDoc) }));
          setMessages(list);
          setTimeout(
            () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
            0
          );
        },
        (err) => {
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("チャット購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000;
            stop();
            if (backoffTimer) {
              try { clearTimeout(backoffTimer); } catch {}
              backoffTimer = null;
            }
            const resume = () => {
              if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0) backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              else maybeStart();
            };
            resume();
          }
        }
      );
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      maybeStart();
    }
    const onVis = () => {
      if (document.visibilityState === "visible") maybeStart();
      else stop();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      if (backoffTimer) {
        try { clearTimeout(backoffTimer); } catch {}
      }
      stop();
    };
  }, [roomId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (readOnly) return;
    const now = Date.now();
    if (now - lastSentAt.current < 600) return; // ローカルクールダウン
    lastSentAt.current = now;
    const clipped = t.slice(0, 100);
    if (!user?.uid) return;
    await sendMessage(roomId, user.uid, displayName || "匿名", clipped);
    setText("");
  };

  return (
    <Box
      h="100%"
      display="grid"
      gridTemplateRows="minmax(0,1fr) auto"
      overflow="hidden"
      minH={0}
      css={{}}
    >
      {/* メッセージエリア: 1fr行で安定スクロール、ドラクエ風一行チャット */}
      <Box overflow="hidden" minH={0}>
        <ScrollableArea
          label="チャットメッセージ"
          withPadding={true}
          padding={0}
        >
          <Stack
            gap={3}
            px={4}
            py={3}
            css={{
              "@layer dpi-responsive": {
                // DPI 125%対応：統一定数活用
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  gap: UNIFIED_LAYOUT.DPI_125.SPACING?.FORM_GAP || "0.4rem",
                  padding: UNIFIED_LAYOUT.DPI_125.SPACING?.COMPONENT_PADDING || "0.5rem 0.8rem",
                },
                // DPI 150%対応：統一定数活用
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  gap: UNIFIED_LAYOUT.DPI_150.SPACING.FORM_GAP,
                  padding: UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING,
                },
              }
            }}
          >
            {messages.map((m) => {
              const isSystem = m.sender === "system";
              const isMe = m.sender === (displayName || "匿名");
              return (
                <Box key={m.id}>
                  {isSystem ? (
                    <Box w="100%">
                      <HStack 
                        gap={2} 
                        align="flex-start" 
                        flexWrap="nowrap"
                        opacity={0.8}
                        css={{
                          "@layer dpi-responsive": {
                            // DPI 125%対応：統一定数活用
                            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                              gap: UNIFIED_LAYOUT.DPI_125.SPACING.FORM_GAP,
                            },
                            // DPI 150%対応：統一定数活用
                            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                              gap: UNIFIED_LAYOUT.DPI_150.SPACING.FORM_GAP,
                            },
                          }
                        }}
                      >
                        <Badge 
                          variant="subtle" 
                          colorPalette="gray" 
                          size="xs"
                          minW="100px"
                          maxW="100px" // ユーザー名と同じ幅で統一
                          textAlign="center"
                          flexShrink={0}
                          css={{
                            // DPI 125%対応：バッジサイズ調整
                            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                              {
                                fontSize: "0.65rem !important",
                                minWidth: "80px !important",
                                maxWidth: "80px !important",
                              },
                            // DPI 150%対応：さらに小さく
                            "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                              {
                                fontSize: "0.6rem !important",
                                minWidth: "70px !important",
                                maxWidth: "70px !important",
                              },
                          }}
                        >
                          system
                        </Badge>
                        <Text 
                          fontSize="sm" 
                          color="fgMuted"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px #000"
                          lineHeight={1.4}
                          flex={1}
                          wordBreak="break-word"
                          css={{
                            // DPI 125%対応：メッセージテキストサイズ調整
                            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                              {
                                fontSize: "0.75rem !important",
                                lineHeight: "1.3 !important",
                              },
                            // DPI 150%対応：さらに小さく
                            "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                              {
                                fontSize: "0.65rem !important",
                                lineHeight: "1.2 !important",
                              },
                          }}
                        >
                          : {m.text}
                        </Text>
                      </HStack>
                    </Box>
                  ) : (
                    <Box
                      w="100%" // 全幅を使用してバランスを取る
                    >
                      <HStack 
                        gap={2} 
                        align="flex-start" 
                        flexWrap="nowrap"
                        css={{
                          // DPI 125%対応：要素間隔調整
                          "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                            {
                              gap: "0.3rem !important", // 要素間を狭く
                            },
                          // DPI 150%対応：さらに狭く
                          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                            {
                              gap: "0.25rem !important", // より狭く
                            },
                        }}
                      >
                        <Text
                          fontSize="sm"
                          color={
                            isMe
                              ? "rgba(255,223,0,0.9)"
                              : "rgba(135,206,250,0.9)"
                          } // 自分=ゴールド、他人=ブルー
                          fontFamily="monospace"
                          fontWeight="bold"
                          textShadow="1px 1px 0px #000" // ドラクエ風くっきり文字
                          minW="100px"
                          maxW="100px" // 固定幅でコロン位置統一
                          textAlign="left"
                          flexShrink={0}
                          title={m.sender} // ホバーでフルネーム表示
                          whiteSpace="nowrap"
                          overflow="hidden"
                          css={{
                            textOverflow: "ellipsis", // CSS自動省略 (ベストプラクティス)
                            // DPI 125%対応：テキストサイズ調整
                            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                              {
                                fontSize: "0.75rem !important", // 少し小さく
                                minWidth: "80px !important", // 名前幅も縮小
                                maxWidth: "80px !important",
                              },
                            // DPI 150%対応：さらに小さく
                            "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                              {
                                fontSize: "0.65rem !important", // さらに小さく
                                minWidth: "70px !important", // 名前幅をより縮小
                                maxWidth: "70px !important",
                              },
                          }}
                        >
                          ▼ {m.sender}
                        </Text>
                        <Text
                          fontSize="sm"
                          color="white"
                          fontFamily="monospace"
                          textShadow="1px 1px 0px #000"
                          lineHeight={1.4}
                          flex={1}
                          wordBreak="break-word"
                          css={{
                            // DPI 125%対応：メッセージテキストサイズ調整
                            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                              {
                                fontSize: "0.75rem !important", // 少し小さく
                                lineHeight: "1.3 !important", // 行間も少し詰める
                              },
                            // DPI 150%対応：さらに小さく
                            "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                              {
                                fontSize: "0.65rem !important", // さらに小さく
                                lineHeight: "1.2 !important", // 行間をより詰める
                              },
                          }}
                        >
                          : {m.text}
                        </Text>
                      </HStack>
                    </Box>
                  )}
                </Box>
              );
            })}
            <div ref={bottomRef} />
          </Stack>
        </ScrollableArea>
      </Box>

      {/* 入力フォーム: 固定行、ドラクエ風統一デザイン */}
      <Box
        p={4}
        bg="gray.800"
        borderTop="1px solid"
        borderColor="gray.700"
        css={{
          // DPI 150%対応：入力エリアのコンパクト化
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              padding: "0.6rem !important", // パディングを更に小さく
            },
        }}
      >
        <HStack 
          gap={3}
          css={{
            // DPI 125%以上：入力欄をコンパクト化
            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
              {
                gap: "0.5rem !important", // ギャップを縮小
              },
          }}
        >
          <Input
            placeholder={
              readOnly ? "観戦中は投稿できません" : "メッセージを入力..."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            disabled={readOnly}
            size="md"
            bg="rgba(8,9,15,0.85)" // ドラクエ風リッチブラック
            color="white"
            border="2px solid rgba(255,255,255,0.6)" // 統一された太い白枠
            borderRadius={6} // 軽く角ばったドラクエ風
            boxShadow="inset 0 2px 0 rgba(0,0,0,0.4), inset 0 -2px 0 rgba(255,255,255,0.1), 0 2px 0 rgba(0,0,0,0.2)" // 立体感
            _placeholder={{ color: "rgba(255,255,255,0.5)" }}
            _focus={{
              borderColor: "#4a9eff", // ドラクエブルー
              boxShadow:
                "inset 0 2px 0 rgba(0,0,0,0.4), inset 0 -2px 0 rgba(74,158,255,0.2), 0 0 0 2px rgba(74,158,255,0.3)",
              bg: "rgba(8,9,15,0.9)",
            }}
            _hover={{
              borderColor: "rgba(255,255,255,0.8)",
              bg: "rgba(8,9,15,0.9)",
            }}
            transition="all 0.15s ease"
            px={4}
            py={3}
            css={{
              // DPI 125%以上：入力フィールドのコンパクト化
              "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                {
                  fontSize: "0.8rem !important", // フォントサイズを小さく
                  padding: "0.4rem 0.7rem !important", // パディングを小さく
                },
              "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                {
                  fontSize: "0.75rem !important", // さらに小さく
                  padding: "0.3rem 0.6rem !important", // より小さく
                },
            }}
          />
          <AppButton
            onClick={send}
            disabled={readOnly || !text.trim()}
            size="md"
            bg="rgba(8,9,15,0.9)" // ドラクエ風リッチブラック
            color="white"
            border="2px solid rgba(255,255,255,0.9)" // 統一された白枠
            borderRadius={0} // 完全角ばったドラクエ風
            px={6}
            py={3}
            fontWeight="700"
            fontFamily="monospace" // ドラクエ風フォント統一
            textShadow="1px 1px 0px #000" // くっきり文字
            css={{
              // DPI 125%以上：送信ボタンのコンパクト化
              "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
                {
                  fontSize: "0.8rem !important", // フォントサイズを小さく
                  padding: "0.4rem 1rem !important", // パディングを小さく
                },
              "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                {
                  fontSize: "0.75rem !important", // さらに小さく
                  padding: "0.3rem 0.8rem !important", // より小さく
                },
            }}
            boxShadow="inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.4)" // 立体感
            _hover={{
              bg: "white", // ドラクエ王道の白背景反転
              color: "rgba(8,9,15,0.9)",
              textShadow: "none",
            }}
            _active={{
              bg: "rgba(220,220,220,0.9)",
              color: "rgba(8,9,15,0.9)",
              boxShadow: "inset 0 3px 0 rgba(0,0,0,0.2)",
            }}
            _disabled={{
              bg: "rgba(60,60,60,0.9)",
              color: "rgba(255,255,255,0.4)",
              cursor: "not-allowed",
              textShadow: "1px 1px 0px #000",
            }}
            transition="all 0.15s ease"
          >
            送信
          </AppButton>
        </HStack>
      </Box>
    </Box>
  );
}

export default ChatPanel;
