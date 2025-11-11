"use client";
import Image, { ImageProps } from "next/image";
import React from "react";

type ResponsiveImageProps = Omit<ImageProps, "placeholder"> & {
  /** レイアウト幅に応じた `sizes`。未指定時は100vw想定 */
  sizes?: string;
  /** 高DPI向けに `quality` を少し上げる（既定85） */
  quality?: number;
};

/**
 * Next/Image の安全な薄いラッパ。
 * - 既定: lazy, decoding="async", referrerPolicy="no-referrer"
 * - sizes 未指定時: "100vw"
 * - quality 既定: 85
 */
export function ResponsiveImage({ sizes = "100vw", quality = 85, loading = "lazy", decoding = "async", alt, ...rest }: ResponsiveImageProps) {
  return (
    <Image
      alt={alt}
      sizes={sizes}
      quality={quality}
      loading={loading}
      decoding={decoding}
      referrerPolicy="no-referrer"
      {...rest}
    />
  );
}

export default ResponsiveImage;
