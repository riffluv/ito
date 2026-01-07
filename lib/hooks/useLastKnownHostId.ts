import { useEffect, useState } from "react";

type UseLastKnownHostIdParams = {
  creatorId: string | null;
  stableHostId: string;
};

export function useLastKnownHostId(params: UseLastKnownHostIdParams) {
  const { creatorId, stableHostId } = params;
  const [lastKnownHostId, setLastKnownHostId] = useState<string | null>(null);

  useEffect(() => {
    if (lastKnownHostId || !creatorId) return;
    const trimmedCreator = creatorId.trim();
    if (trimmedCreator) {
      setLastKnownHostId(trimmedCreator);
    }
  }, [creatorId, lastKnownHostId]);

  useEffect(() => {
    if (stableHostId) {
      setLastKnownHostId(stableHostId);
    }
  }, [stableHostId]);

  return lastKnownHostId;
}

