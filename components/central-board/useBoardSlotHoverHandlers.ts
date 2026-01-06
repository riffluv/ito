import { useCallback, type Dispatch, type SetStateAction } from "react";

export function useBoardSlotHoverHandlers(params: {
  isOver: boolean;
  setIsOver: Dispatch<SetStateAction<boolean>>;
}): { onSlotEnter: (index: number) => void; onSlotLeave: () => void } {
  const { isOver, setIsOver } = params;

  const onSlotEnter = useCallback(
    (_index: number) => {
      if (!isOver) {
        setIsOver(true);
      }
    },
    [isOver, setIsOver]
  );

  const onSlotLeave = useCallback(() => {
    setIsOver(false);
  }, [setIsOver]);

  return { onSlotEnter, onSlotLeave };
}

