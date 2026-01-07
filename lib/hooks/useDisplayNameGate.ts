import { useCallback } from "react";

type UseDisplayNameGateParams = {
  displayName: string | null | undefined;
  setDisplayName: (displayName: string) => void;
};

export function useDisplayNameGate(params: UseDisplayNameGateParams) {
  const { displayName, setDisplayName } = params;
  const needName = !displayName || !String(displayName).trim();

  const handleSubmitName = useCallback(
    async (name: string) => {
      setDisplayName(name);
    },
    [setDisplayName]
  );

  return { needName, handleSubmitName } as const;
}

