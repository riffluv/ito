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
}: {
  isOpen: boolean;
  defaultValue?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  submitting?: boolean;
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
                  プレイヤー名を入力
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
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '{colors.fgDefault}',
                  marginBottom: '8px'
                }}
              >
                名前
              </Field.Label>
              <Input
                placeholder="例: コーヒーやめます"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                css={{
                  height: '48px',
                  background: 'glassBg05',
                  border: '2px solid',
                  borderColor: 'glassBorder',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  padding: '0 16px',
                  color: 'text',
                  transition: 'all 0.2s ease',
                  '&:focus': {
                    borderColor: 'primary',
                    boxShadow: '0 0 0 4px var(--colors-brandRing)',
                    background: 'glassBg08'
                  },
                  '&::placeholder': {
                    color: 'textSubtle'
                  }
                }}
              />
            </Field.Root>
          </Box>
          
          {/* Premium Footer */}
          <Box 
            p={6} 
            pt={4}
            css={{
              background: 'glassBg03',
              borderTop: '1px solid',
              borderColor: 'glassBorderWeak'
            }}
          >
            <HStack justify="flex-end" gap={3}>
              <AppButton 
                visual="ghost" 
                onClick={onCancel} 
                size="lg"
                css={{
                  minWidth: '80px',
                  height: '44px',
                  borderRadius: '12px',
                  fontWeight: 500
                }}
              >
                キャンセル
              </AppButton>
              <AppButton
                visual="solid"
                palette="brand"
                size="lg"
                loading={submitting}
                onClick={() => onSubmit(value.trim())}
                disabled={!value.trim() || submitting}
                css={{
                  minWidth: '100px',
                  height: '44px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  background: !submitting && value.trim() ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' : undefined,
                  boxShadow: !submitting && value.trim() ? '0 4px 16px rgba(99,102,241,0.4)' : undefined
                }}
              >
                {submitting ? '設定中...' : '決定'}
              </AppButton>
            </HStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default NameDialog;
