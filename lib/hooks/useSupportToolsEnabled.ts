import { useEffect, useState } from "react";

const STORAGE_KEY = "ito-support-tools";

export function useSupportToolsEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => {
    return process.env.NEXT_PUBLIC_ENABLE_SUPPORT_TOOLS === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const envEnabled = process.env.NEXT_PUBLIC_ENABLE_SUPPORT_TOOLS === "1";
      const params = new URLSearchParams(window.location.search);
      const param = params.get("support");

      const stored = window.localStorage.getItem(STORAGE_KEY) === "1";
      if (param === "1") {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } else if (param === "0") {
        window.localStorage.removeItem(STORAGE_KEY);
      }

      const storedAfter =
        param === "1" ? true : param === "0" ? false : stored;
      setEnabled(envEnabled || storedAfter || param === "1");
    } catch {
      setEnabled(process.env.NEXT_PUBLIC_ENABLE_SUPPORT_TOOLS === "1");
    }
  }, []);

  return enabled;
}

