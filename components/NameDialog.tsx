"use client";
import React from "react";
import { Dialog, Field, Input, Stack, Box, Text, HStack } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

export function NameDialog({
  isOpen,
  defaultValue = "",
  onCancel,
  onSubmit,
  submitting = false,
  mode = "create", // "create" | "edit"
}: {
  isOpen: boolean;
  defaultValue?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  submitting?: boolean;
  mode?: "create" | "edit";
}) {
  const [value, setValue] = React.useState(defaultValue);
  React.useEffect(() => setValue(defaultValue), [defaultValue]);
  
  return (
    <Dialog.Root open={isOpen} onOpenChange={(d) => !d.open && onCancel()}>
      <Dialog.Backdrop 
        css={{
          background: 'overlayStrong',
          backdropFilter: 'blur(12px) saturate(1.2)', // ルーム作成と同じ高品質バックドロップ
        }}
      />
      <Dialog.Positioner>
        <Dialog.Content
          css={{
            background: 'rgba(8,9,15,0.95)', // ルーム作成と同じリッチブラック
            border: '3px solid rgba(255,255,255,0.9)', // ドラクエ風統一ボーダー
            borderRadius: 0, // 製品レベルの角ばり
            boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.4), 0 12px 24px rgba(0,0,0,0.5)', // 製品レベル立体感
            maxWidth: '420px',
            width: '90vw',
            padding: 0,
            overflow: 'hidden'
          }}
        >
          <Dialog.CloseTrigger 
            css={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 10,
              background: 'rgba(8,9,15,0.8)', // 背景を見えるように
              borderRadius: 0, // ドラクエ風角ばり
              padding: '0',
              border: '2px solid rgba(255,255,255,0.9)',
              color: 'white',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.15s ease',
              '&:hover': {
                background: 'white',
                color: 'rgba(8,9,15,0.9)'
              }
            }}
          >
            ✕
          </Dialog.CloseTrigger>
          
          {/* Premium Header */}
          <Box 
            p={6} 
            pb={4}
            css={{
              background: 'transparent', // 背景をクリアに
              borderBottom: '2px solid rgba(255,255,255,0.3)', // ドラクエ風区切り
            }}
          >
            <Box width="100%">
                <Dialog.Title 
                  css={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: 'white',
                    margin: 0,
                    fontFamily: 'monospace', // ドラクエフォント
                    textShadow: '1px 1px 0px #000', // 立体感
                    textAlign: 'center',
                  }}
                >
                  {mode === "edit" ? "なまえを へんこう" : "プレイヤーの なまえ"}
                </Dialog.Title>
                <Text 
                  fontSize="sm" 
                  color="rgba(255,255,255,0.7)" 
                  mt={1}
                  css={{
                    textAlign: 'center',
                  }}
                >
                  ゲーム中に表示される名前を設定してください
                </Text>
            </Box>
          </Box>
          
          <Box p={6}>
            <Field.Root>
              <Field.Label
                css={{
                  fontSize: "1rem",
                  fontWeight: "bold",
                  color: "white",
                  marginBottom: "8px",
                  fontFamily: "monospace",
                  textShadow: "1px 1px 0px #000",
                }}
              >
                ▼ プレイヤーの なまえ
              </Field.Label>
              <Input
                placeholder="れい: コーヒーやめます"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
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
                    boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.2)",
                    background: "#f8f8f8",
                    outline: "none",
                  },
                  _hover: {
                    background: "#f8f8f8",
                  },
                }}
              />
            </Field.Root>
          </Box>
          
          {/* Premium Footer */}
          <Box 
            p={6} 
            pt={4}
            css={{
              background: 'transparent', // 背景をクリアに
              borderTop: '2px solid rgba(255,255,255,0.3)', // ドラクエ風区切り
            }}
          >
            <HStack justify="space-between" gap={3}>
              <button
                onClick={onCancel}
                style={{
                  minWidth: "120px",
                  height: "40px",
                  borderRadius: 0,
                  fontWeight: "bold",
                  fontSize: "1rem",
                  fontFamily: "monospace",
                  border: "borders.retrogameThin",
                  background: "transparent",
                  color: "white",
                  cursor: "pointer",
                  textShadow: "1px 1px 0px #000",
                  transition: "all 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.color = "var(--colors-richBlack-800)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "white";
                }}
              >
                やめる
              </button>

              <button
                onClick={() => onSubmit(value.trim())}
                disabled={submitting || !value.trim()}
                style={{
                  minWidth: "140px",
                  height: "40px",
                  borderRadius: 0,
                  fontWeight: "bold",
                  fontSize: "1rem",
                  fontFamily: "monospace",
                  border: "borders.retrogameThin",
                  background: submitting || !value.trim() ? "#666" : "var(--colors-richBlack-600)",
                  color: "white",
                  cursor: submitting || !value.trim() ? "not-allowed" : "pointer",
                  textShadow: "1px 1px 0px #000",
                  transition: "all 0.1s ease",
                  opacity: submitting || !value.trim() ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!submitting && value.trim()) {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "var(--colors-richBlack-800)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting && value.trim()) {
                    e.currentTarget.style.background = "var(--colors-richBlack-600)";
                    e.currentTarget.style.color = "white";
                  }
                }}
              >
                {submitting ? (mode === "edit" ? "へんこうちゅう..." : "せっていちゅう...") : (mode === "edit" ? "へんこう" : "きめる")}
              </button>
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default NameDialog;
