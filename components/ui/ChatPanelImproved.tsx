"use client";
import { AppButton } from "@/components/ui/AppButton";
import ScrollableArea from "@/components/ui/ScrollableArea";
import { useAuth } from "@/context/AuthContext";
import { sendMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import type { ChatDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Badge, Box, HStack, Input, Stack, Text } from "@chakra-ui/react";
import {
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

/**
 * ドラクエ風チャットパネル (改良版)
 * 
 * 特徴:
 * - ドラクエ風デザイン統一 (リッチブラック、白枠、角ばったデザイン)
 * - CSS ellipsisによる名前の自動省略でコロン位置完全統一
 * - monospaceフォント + textShadowでレトロゲーム感
 * - 名前部分は100px固定幅、メッセージは500文字制限
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
    const unsub = onSnapshot(q, (snap) => {
      const list: (ChatDoc & { id: string })[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as ChatDoc) }));
      setMessages(list);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        0
      );
    });
    return () => unsub();
  }, [roomId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (readOnly) return;
    const now = Date.now();
    if (now - lastSentAt.current < 600) return; // ローカルクールダウン
    lastSentAt.current = now;
    const clipped = t.slice(0, 500);
    if (!user?.uid) return;
    await sendMessage(roomId, user.uid, displayName || "匿名", clipped);
    setText("");
  };

  return (
    <Box h="100%" display="grid" gridTemplateRows="1fr auto" overflow="hidden">
      {/* メッセージエリア: 1fr行で安定スクロール、ドラクエ風一行チャット */}
      <Box overflow="hidden">
        <ScrollableArea
          label="チャットメッセージ"
          withPadding={true}
          padding={0}
        >
          <Stack gap={3} px={4} py={3}>
            {messages.map((m) => {
              const isSystem = m.sender === "system";
              const isMe = m.sender === (displayName || "匿名");
              return (
                <Box key={m.id}>
                    {isSystem ? (
                      <HStack opacity={0.8} justify="center">
                        <Badge variant="subtle" colorPalette="gray" size="xs">
                          system
                        </Badge>
                        <Text fontSize="sm" color="fgMuted">
                          {m.text}
                        </Text>
                      </HStack>
                    ) : (
                      <Box 
                        w="100%" // 全幅を使用してバランスを取る
                      >
                        <HStack gap={2} align="flex-start" flexWrap="nowrap">
                          <Text 
                            fontSize="sm" 
                            color={isMe ? "rgba(255,223,0,0.9)" : "rgba(135,206,250,0.9)"} // 自分=ゴールド、他人=ブルー
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
                              textOverflow: "ellipsis" // CSS自動省略 (ベストプラクティス)
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
      <Box p={4} bg="gray.800" borderTop="1px solid" borderColor="gray.700">
        <HStack gap={3}>
          <Input
            placeholder={
              readOnly ? "観戦中は投稿できません" : "メッセージを入力..."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
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
              boxShadow: "inset 0 2px 0 rgba(0,0,0,0.4), inset 0 -2px 0 rgba(74,158,255,0.2), 0 0 0 2px rgba(74,158,255,0.3)",
              bg: "rgba(8,9,15,0.9)",
            }}
            _hover={{ 
              borderColor: "rgba(255,255,255,0.8)",
              bg: "rgba(8,9,15,0.9)" 
            }}
            transition="all 0.15s ease"
            px={4}
            py={3}
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
            boxShadow="inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.4)" // 立体感
            _hover={{ 
              bg: "white", // ドラクエ王道の白背景反転
              color: "rgba(8,9,15,0.9)",
              textShadow: "none"
            }}
            _active={{ 
              bg: "rgba(220,220,220,0.9)",
              color: "rgba(8,9,15,0.9)",
              boxShadow: "inset 0 3px 0 rgba(0,0,0,0.2)"
            }}
            _disabled={{ 
              bg: "rgba(60,60,60,0.9)", 
              color: "rgba(255,255,255,0.4)",
              cursor: "not-allowed",
              textShadow: "1px 1px 0px #000"
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
