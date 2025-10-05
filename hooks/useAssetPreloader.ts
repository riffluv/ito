import { useEffect } from "react";

const loadedAssets = new Set<string>();

export function useAssetPreloader(
  assets: readonly string[] | undefined,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled || !assets || assets.length === 0) return;
    if (typeof window === "undefined") return;

    const pending = assets.filter((asset) => {
      const href = asset.trim();
      if (!href) return false;
      if (loadedAssets.has(href)) return false;
      loadedAssets.add(href);
      return true;
    });

    if (pending.length === 0) return;

    const images: HTMLImageElement[] = [];

    pending.forEach((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      images.push(img);
    });

    return () => {
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [assets, enabled]);
}

