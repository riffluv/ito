import { useEffect } from "react";

type Params = {
  isOpen: boolean;
  onRequestClose: () => void;
};

export function useMvpLedgerEscClose({ isOpen, onRequestClose }: Params) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onRequestClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onRequestClose]);
}

