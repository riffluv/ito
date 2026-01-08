"use client";

import { MODAL_BODY_PADDING } from "@/components/create-room-modal/constants";
import { DisplayModeSelector } from "@/components/create-room-modal/DisplayModeSelector";
import { GamePasswordInput } from "@/components/ui/GamePasswordInput";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Field, HStack, Input, Switch, Text, VStack } from "@chakra-ui/react";

export function CreateRoomFormBody(params: {
  hasUser: boolean;
  name: string;
  setName: (value: string) => void;
  enablePassword: boolean;
  setEnablePassword: (value: boolean) => void;
  password: string;
  setPassword: (value: string) => void;
  passwordError: string | null;
  displayMode: "full" | "minimal";
  setDisplayMode: (value: "full" | "minimal") => void;
}) {
  const {
    hasUser,
    name,
    setName,
    enablePassword,
    setEnablePassword,
    password,
    setPassword,
    passwordError,
    displayMode,
    setDisplayMode,
  } = params;

  return (
    <Box p={MODAL_BODY_PADDING} position="relative" zIndex={20}>
      <form
        autoComplete="off"
        onSubmit={(event) => event.preventDefault()}
        style={{ display: "contents" }}
      >
        <VStack gap={4} align="stretch">
          {!hasUser && (
            <Box p={4} bg="richBlack.700" border="2px solid white" borderRadius={0}>
              <VStack align="start" gap={2}>
                <Text
                  fontSize="sm"
                  color="rgba(255,255,255,0.95)"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textShadow="0 2px 4px rgba(0,0,0,0.8)"
                >
                  ⚠ おしらせ
                </Text>
                <Text
                  fontSize="sm"
                  color="white"
                  fontFamily="monospace"
                  lineHeight={1.6}
                  textShadow="1px 1px 0px #000"
                >
                  なまえが みとうろく です。 先に とうろく を おねがいします。
                </Text>
              </VStack>
            </Box>
          )}

          <Field.Root>
            <Field.Label
              css={{
                fontSize: "0.95rem",
                fontWeight: "bold",
                color: "rgba(255,255,255,0.95)",
                marginBottom: "8px",
                fontFamily: "monospace",
                textShadow: "0 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              へやの なまえ
            </Field.Label>
            <Input
              placeholder="れい: 友達とあそぶ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              css={{
                height: "48px",
                background: "white",
                border: "borders.retrogameInput",
                borderRadius: 0,
                fontSize: "1rem",
                padding: "0 16px",
                color: "black",
                fontWeight: "normal",
                fontFamily: "monospace",
                transition: "none",
                _placeholder: {
                  color: "#666",
                  fontFamily: "monospace",
                },
                _focus: {
                  borderColor: "black",
                  boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                  background: "#f8f8f8",
                  outline: "none",
                },
                _hover: {
                  background: "#f8f8f8",
                },
              }}
            />
          </Field.Root>

          <Field.Root>
            <Field.Label
              css={{
                fontSize: "0.95rem",
                fontWeight: "bold",
                color: "rgba(255,255,255,0.95)",
                marginBottom: "9px",
                fontFamily: "monospace",
                textShadow: "0 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              パスワードを設定
            </Field.Label>
            <HStack gap={3} align="center">
              <Switch.Root
                checked={enablePassword}
                onCheckedChange={(d) => setEnablePassword(d.checked)}
                css={{
                  display: "flex",
                  alignItems: "center",
                  userSelect: "none",
                  width: "42px",
                  height: "22px",
                  borderRadius: 0,
                  background: enablePassword ? "#16A34A" : "#4B5563",
                  border: "2px solid rgba(255,255,255,0.6)",
                  boxShadow: "0 4px 0px 0px #000000",
                  position: "relative",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  "&:hover": {
                    background: enablePassword ? "#16A34A" : "#4B5563",
                    boxShadow: "0 2px 0px 0px #000000",
                    transform: "translateY(2px)",
                  },
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: "2px",
                    left: enablePassword ? "22px" : "2px",
                    width: "16px",
                    height: "16px",
                    background: "white",
                    border: "2px solid rgba(0,0,0,0.3)",
                    borderRadius: 0,
                    transition: "left 0.2s ease",
                    boxShadow: "1px 1px 0px 0px #000000",
                  },
                }}
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
              <Text fontSize="sm" color="whiteAlpha.80" fontFamily="monospace">
                パスワードを設定すると入室時に入力が必要になります
              </Text>
            </HStack>
          </Field.Root>

          {enablePassword && (
            <VStack align="stretch" gap={4}>
              <VStack gap={2}>
                <Text
                  fontSize="sm"
                  color="rgba(255,255,255,0.95)"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textShadow="0 2px 4px rgba(0,0,0,0.8)"
                  textAlign="center"
                >
                  4けたの ひみつ ばんごう
                </Text>
                <GamePasswordInput value={password} onChange={setPassword} error={!!passwordError} />
              </VStack>

              {passwordError ? (
                <Text
                  fontSize="xs"
                  color="dangerSolid"
                  fontFamily="monospace"
                  textAlign="center"
                  textShadow="1px 1px 0px #000"
                >
                  {passwordError}
                </Text>
              ) : (
                <Text
                  fontSize="xs"
                  color="whiteAlpha.70"
                  fontFamily="monospace"
                  textAlign="center"
                  textShadow="1px 1px 0px #000"
                >
                  ※ 4桁の数字で設定されます
                </Text>
              )}
            </VStack>
          )}

          <Field.Root>
            <Field.Label
              css={{
                fontSize: "0.95rem",
                fontWeight: "bold",
                color: "rgba(255,255,255,0.95)",
                marginBottom: "9px",
                fontFamily: "monospace",
                textShadow: "0 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              待機エリア 表示設定
            </Field.Label>
            <Text
              fontSize="xs"
              color="rgba(255,255,255,0.7)"
              mb={2}
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
            >
              待機中のプレイヤーカードをどう表示するか
            </Text>
            <DisplayModeSelector value={displayMode} onChange={setDisplayMode} />
          </Field.Root>
        </VStack>
      </form>
    </Box>
  );
}

