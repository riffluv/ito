"use client";

import { Box, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { ItoMetrics, metricsKey, readMetrics, subscribeMetrics } from "@/lib/utils/metrics";
import { initMetricsExport } from "@/lib/utils/metricsExport";

const ENABLED = process.env.NEXT_PUBLIC_DEBUG_METRICS === "1";

const REFRESH_INTERVAL = 1200;

const formatEntries = (metrics: ItoMetrics) => {
  const entries: Array<{ scope: string; key: string; value: number | string | null | undefined }> = [];
  for (const scope of Object.keys(metrics)) {
    const bucket = metrics[scope];
    if (!bucket) continue;
    for (const key of Object.keys(bucket)) {
      entries.push({ scope, key, value: bucket[key] });
    }
  }
  return entries.sort((a, b) => (a.scope === b.scope ? a.key.localeCompare(b.key) : a.scope.localeCompare(b.scope)));
};

export function DebugMetricsHUD() {
  const [metrics, setMetrics] = useState<ItoMetrics>({});

  useEffect(() => {
    if (!ENABLED) return;
    initMetricsExport();
    setMetrics(readMetrics());
    const unsubscribe = subscribeMetrics((snapshot) => setMetrics(snapshot));
    return () => {
      unsubscribe();
    };
  }, []);

  if (!ENABLED) {
    return null;
  }

  const entries = formatEntries(metrics);
  if (entries.length === 0) {
    return null;
  }

  return (
    <Box
      position="fixed"
      bottom="16px"
      left="16px"
      zIndex={1000}
      padding="10px 12px"
      background="rgba(4, 6, 12, 0.85)"
      color="rgba(255,255,255,0.9)"
      fontFamily="'Courier New', monospace"
      fontSize="12px"
      lineHeight="1.4"
      border="1px solid rgba(255,255,255,0.18)"
      borderRadius="4px"
      maxHeight="30vh"
      overflowY="auto"
      pointerEvents="none"
    >
      <Text fontWeight="bold" marginBottom="4px">
        metrics ({metricsKey})
      </Text>
      {entries.map(({ scope, key, value }) => (
        <Box key={`${scope}:${key}`}>
          <Text as="span" color="rgba(255,255,255,0.6)">
            {scope}.
          </Text>
          <Text as="span" color="rgba(255,255,255,0.85)" marginRight="4px">
            {key}
          </Text>
          <Text as="span" color="rgba(148, 191, 255, 0.95)">
            {typeof value === "number" ? value.toFixed(2).replace(/\.00$/, "") : String(value ?? "—")}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
