'use client';

import { useEffect, useState } from "react";

export type PointerProfile = {
  /** メインポインタがcoarse（指やスタイラス）かどうか */
  isCoarsePointer: boolean;
  /** メインポインタがfine（マウス等）かどうか */
  isFinePointer: boolean;
  /** hover操作が可能か（Apple Pencil/トラックパッド等） */
  supportsHover: boolean;
  /** タッチ専用デバイスか（coarse かつ hover不可） */
  isTouchOnly: boolean;
};

const COARSE_QUERY = "(pointer: coarse)";
const FINE_QUERY = "(pointer: fine)";
const HOVER_QUERY = "(hover: hover)";

/**
 * ポインタのプロファイルをリアルタイムに検出するフック。
 * Safari系の addListener/removeListener にもフォールバックする。
 */
export function usePointerProfile(): PointerProfile {
  const [profile, setProfile] = useState<PointerProfile>(() => ({
    isCoarsePointer: false,
    isFinePointer: false,
    supportsHover: false,
    isTouchOnly: false,
  }));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const coarse = window.matchMedia(COARSE_QUERY);
    const fine = window.matchMedia(FINE_QUERY);
    const hover = window.matchMedia(HOVER_QUERY);

    const update = () => {
      const maxTouchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0;
      const coarseActive = coarse.matches || maxTouchPoints > 0;
      const fineActive = !coarse.matches && fine.matches;
      const anyHover = hover.matches || (typeof window !== "undefined" && window.matchMedia('(any-hover: hover)').matches);

      setProfile({
        isCoarsePointer: coarseActive,
        isFinePointer: !coarseActive && fineActive,
        supportsHover: anyHover,
        isTouchOnly: coarseActive && !anyHover && maxTouchPoints > 0,
      });
    };

    update();

    const add = (media: MediaQueryList) => {
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", update);
      } else {
        media.addListener(update);
      }
    };

    const remove = (media: MediaQueryList) => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", update);
      } else {
        media.removeListener(update);
      }
    };

    add(coarse);
    add(fine);
    add(hover);

    return () => {
      remove(coarse);
      remove(fine);
      remove(hover);
    };
  }, []);

  return profile;
}

