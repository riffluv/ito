"use client";

import React from "react";

type DefaultTopicTypeChangeEvent = CustomEvent<{ defaultTopicType?: string }>;
const noopCleanup = () => {};

export function useDefaultTopicTypeOverride(
  defaultTopicType: string | undefined
) {
  const [override, setOverride] = React.useState<string | undefined>(
    defaultTopicType
  );

  React.useEffect(() => {
    setOverride(defaultTopicType);
  }, [defaultTopicType]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return noopCleanup;
    }

    const handleDefaultTopicChange: EventListener = (event) => {
      const detail = (event as DefaultTopicTypeChangeEvent).detail;
      const nextType = detail?.defaultTopicType;
      if (typeof nextType === "string") {
        setOverride(nextType);
      }
    };

    window.addEventListener("defaultTopicTypeChanged", handleDefaultTopicChange);
    try {
      const stored = window.localStorage.getItem("defaultTopicType");
      if (stored) setOverride(stored);
    } catch {
      // ignore storage failure
    }

    return () => {
      window.removeEventListener(
        "defaultTopicTypeChanged",
        handleDefaultTopicChange
      );
    };
  }, []);

  return override ?? defaultTopicType ?? "通常版";
}
