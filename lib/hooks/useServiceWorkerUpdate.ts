import { useCallback, useEffect, useState } from "react";
import {
  applyServiceWorkerUpdate,
  getWaitingServiceWorker,
  subscribeToServiceWorkerUpdates,
} from "@/lib/serviceWorker/updateChannel";

type UpdateState = {
  isUpdateReady: boolean;
  isApplying: boolean;
  applyUpdate: () => void;
};

export function useServiceWorkerUpdate(): UpdateState {
  const [isApplying, setIsApplying] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(() =>
    typeof window === "undefined" ? null : getWaitingServiceWorker()
  );

  useEffect(() => {
    return subscribeToServiceWorkerUpdates((registration) => {
      setWaiting(registration);
      setIsApplying(false);
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) {
      return;
    }
    setIsApplying(true);
    const ok = applyServiceWorkerUpdate({ reason: "manual" });
    if (!ok) {
      setIsApplying(false);
    }
  }, [waiting]);

  return {
    isUpdateReady: !!waiting,
    isApplying,
    applyUpdate,
  };
}
