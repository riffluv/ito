"use client";

import { Box, Stack } from "@chakra-ui/react";
import {
  type AnimationModeOption,
  type BackgroundOption,
  type CardAnimationOption,
  type GraphicsTab,
  type SceneryVariant,
} from "@/components/settings/settingsModalModel";
import { SettingsModalGraphicsAnimationModeSection } from "@/components/settings/graphics/SettingsModalGraphicsAnimationModeSection";
import { SettingsModalGraphicsAnimationPreferenceSection } from "@/components/settings/graphics/SettingsModalGraphicsAnimationPreferenceSection";
import { SettingsModalGraphicsBackgroundSection } from "@/components/settings/graphics/SettingsModalGraphicsBackgroundSection";
import { SettingsModalGraphicsTabNav } from "@/components/settings/graphics/SettingsModalGraphicsTabNav";

export function SettingsModalGraphicsTab(props: {
  graphicsTab: GraphicsTab;
  onGraphicsTabChange: (next: GraphicsTab) => void;
  backgroundType: BackgroundOption;
  onBackgroundChange: (next: BackgroundOption) => void;
  onVariantChange: (variant: SceneryVariant) => void;
  gpuCapability?: "high" | "low";
  supports3D?: boolean;
  animationMode: AnimationModeOption;
  effectiveMode: CardAnimationOption;
  force3DTransforms: boolean;
  onForce3DTransformsChange: (next: boolean) => void;
  onAnimationModeChange: (next: AnimationModeOption) => void;
  forceAnimations: boolean;
  osReduced: boolean;
  onForceAnimationsChange: (next: boolean) => void;
}) {
  const {
    graphicsTab,
    onGraphicsTabChange,
    backgroundType,
    onBackgroundChange,
    onVariantChange,
    gpuCapability,
    supports3D,
    animationMode,
    effectiveMode,
    force3DTransforms,
    onForce3DTransformsChange,
    onAnimationModeChange,
    forceAnimations,
    osReduced,
    onForceAnimationsChange,
  } = props;

  return (
    <Stack gap={6} mt={4}>
      <SettingsModalGraphicsTabNav
        graphicsTab={graphicsTab}
        onGraphicsTabChange={onGraphicsTabChange}
      />

      <Box hidden={graphicsTab !== "background"}>
        <SettingsModalGraphicsBackgroundSection
          backgroundType={backgroundType}
          onBackgroundChange={onBackgroundChange}
          onVariantChange={onVariantChange}
        />
      </Box>

      <Box hidden={graphicsTab !== "animation"}>
        <SettingsModalGraphicsAnimationModeSection
          gpuCapability={gpuCapability}
          supports3D={supports3D}
          animationMode={animationMode}
          effectiveMode={effectiveMode}
          force3DTransforms={force3DTransforms}
          onForce3DTransformsChange={onForce3DTransformsChange}
          onAnimationModeChange={onAnimationModeChange}
        />
      </Box>

      <Box hidden={graphicsTab !== "animation"}>
        <SettingsModalGraphicsAnimationPreferenceSection
          forceAnimations={forceAnimations}
          osReduced={osReduced}
          onForceAnimationsChange={onForceAnimationsChange}
        />
      </Box>
    </Stack>
  );
}
