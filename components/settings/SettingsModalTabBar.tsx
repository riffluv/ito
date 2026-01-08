"use client";

import { UI_TOKENS } from "@/theme/layout";
import {
  SETTINGS_TABS,
  type SettingsTab,
} from "@/components/settings/settingsModalModel";
import { Box, HStack } from "@chakra-ui/react";

export type SettingsModalTabBarProps = {
  activeTab: SettingsTab;
  onTabChange: (next: SettingsTab) => void;
};

export function SettingsModalTabBar(props: SettingsModalTabBarProps) {
  const { activeTab, onTabChange } = props;
  return (
    <HStack gap={3} justify="center" mt={3} mb={3}>
      {SETTINGS_TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Box
            key={tab.key}
            as="button"
            onClick={() => onTabChange(tab.key)}
            px={4}
            py={2}
            borderRadius="0"
            border="2px solid"
            borderColor={isActive ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.whiteAlpha30}
            bg={isActive ? UI_TOKENS.COLORS.whiteAlpha10 : UI_TOKENS.COLORS.panelBg}
            color="white"
            fontFamily="monospace"
            fontWeight="bold"
            transition={`background-color 117ms cubic-bezier(.2,1,.3,1), color 117ms cubic-bezier(.2,1,.3,1), border-color 117ms cubic-bezier(.2,1,.3,1)`}
          >
            {tab.label}
          </Box>
        );
      })}
    </HStack>
  );
}

