"use client";

import { setMetric } from "@/lib/utils/metrics";
import { useEffect, useMemo } from "react";

type UseRoomSelfOnlineMetricParams = {
  uid: string | null;
  onlineUids: string[] | null | undefined;
};

export function useRoomSelfOnlineMetric(params: UseRoomSelfOnlineMetricParams) {
  const { uid, onlineUids } = params;
  const isSelfOnline = useMemo(() => {
    if (!uid) return false;
    return Array.isArray(onlineUids) && onlineUids.includes(uid);
  }, [onlineUids, uid]);

  useEffect(() => {
    setMetric("room", "selfOnline", isSelfOnline ? 1 : 0);
  }, [isSelfOnline]);

  return isSelfOnline;
}

