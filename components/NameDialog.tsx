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
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
        }}
      />
      <Dialog.Positioner>
        <Dialog.Content
          css={{
            background: '{colors.surfaceRaised}',
            border: '1px solid {colors.borderStrong}',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            maxWidth: '420px',
            width: '90vw',
            padding: 0,
            overflow: 'hidden'
          }}
        >
          <Dialog.CloseTrigger 
            css={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              zIndex: 10,
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px',
              border: 'none',
              color: '{colors.fgMuted}',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
                color: '{colors.fgDefault}'
              }
            }}
          />
          
          {/* Premium Header */}
          <Box 
            p={6} 
            pb={4}
            css={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.05) 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <HStack gap={3} align="center">
              <Box 
                w={10} h={10}
                bg="linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)"
                borderRadius="12px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                boxShadow="0 4px 12px rgba(99,102,241,0.3)"
              >
                <Box 
                  w="50%" h="50%"
                  bg="white"
                  borderRadius="6px"
                />
              </Box>
              <Box>
                <Dialog.Title 
                  css={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '{colors.fgDefault}',
                    margin: 0,
                    letterSpacing: '-0.025em'
                  }}
                >
                  プレイヤー名を入力
                </Dialog.Title>
                <Text 
                  fontSize="sm" 
                  color="{colors.fgMuted}" 
                  mt={1}
                >
                  ゲーム中に表示される名前を設定してください
                </Text>
              </Box>
            </HStack>
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
                placeholder="例: たろう"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                css={{
                  height: '48px',
                  background: '{colors.surfaceSubtle}',
                  border: '2px solid {colors.borderDefault}',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  padding: '0 16px',
                  color: '{colors.fgDefault}',
                  transition: 'all 0.2s ease',
                  '&:focus': {
                    borderColor: '{colors.borderAccent}',
                    boxShadow: '0 0 0 3px rgba(99,102,241,0.1)',
                    background: '{colors.surfaceRaised}'
                  },
                  '&::placeholder': {
                    color: '{colors.fgSubtle}'
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
              background: 'rgba(255,255,255,0.02)',
              borderTop: '1px solid rgba(255,255,255,0.08)'
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
