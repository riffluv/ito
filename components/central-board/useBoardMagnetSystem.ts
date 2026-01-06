import { useMagnetController } from "@/components/hooks/useMagnetController";
import type { PointerProfile } from "@/lib/hooks/usePointerProfile";
import { useBoardMagnetConfig } from "./useBoardMagnetConfig";
import { useBoardReleaseMagnet } from "./useBoardReleaseMagnet";

export function useBoardMagnetSystem(params: {
  pointerProfile: PointerProfile;
  prefersReducedMotion: boolean;
}): {
  magnetController: ReturnType<typeof useMagnetController>;
  enqueueMagnetUpdate: ReturnType<typeof useMagnetController>["enqueueMagnetUpdate"];
  resetMagnet: ReturnType<typeof useMagnetController>["resetMagnet"];
  scheduleMagnetTarget: ReturnType<typeof useMagnetController>["scheduleMagnetTarget"];
  getProjectedMagnetState: ReturnType<typeof useMagnetController>["getProjectedMagnetState"];
  magnetConfigRef: ReturnType<typeof useMagnetController>["magnetConfigRef"];
  releaseMagnet: ReturnType<typeof useBoardReleaseMagnet>["releaseMagnet"];
} {
  const { pointerProfile, prefersReducedMotion } = params;

  const magnetConfig = useBoardMagnetConfig({
    pointerProfile,
    prefersReducedMotion,
  });
  const magnetController = useMagnetController(magnetConfig, {
    prefersReducedMotion,
  });
  const {
    enqueueMagnetUpdate,
    resetMagnet,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    magnetConfigRef,
  } = magnetController;

  const { releaseMagnet } = useBoardReleaseMagnet({
    scheduleMagnetTarget,
    getProjectedMagnetState,
    enqueueMagnetUpdate,
  });

  return {
    magnetController,
    enqueueMagnetUpdate,
    resetMagnet,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    magnetConfigRef,
    releaseMagnet,
  };
}

