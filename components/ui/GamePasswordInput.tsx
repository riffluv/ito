"use client";

import { UI_TOKENS } from "@/theme/layout";
import { HStack } from "@chakra-ui/react";
import {
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";

interface GamePasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function GamePasswordInput({ value, onChange, disabled = false, error = false }: GamePasswordInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digitsRef = useRef<string[]>(["", "", "", ""]);

  const sanitizeValue = useCallback((nextValue: string | number | undefined | null) => {
    return String(nextValue ?? "").replace(/[^0-9]/g, "").slice(0, 4);
  }, []);

  const digits = useMemo(() => {
    const sanitized = sanitizeValue(value);
    const nextDigits = Array.from({ length: 4 }, (_, index) => sanitized[index] ?? "");
    return nextDigits;
  }, [value, sanitizeValue]);

  useEffect(() => {
    digitsRef.current = digits;
  }, [digits]);

  const focusAt = useCallback((index: number) => {
    if (index < 0 || index > 3) return;
    const target = inputRefs.current[index];
    if (!target) return;
    requestAnimationFrame(() => target.focus());
  }, []);

  const commitDigits = useCallback((nextDigits: string[]) => {
    digitsRef.current = nextDigits;
    onChange(nextDigits.join(""));
  }, [onChange]);

  const handleDigitChange = useCallback((index: number, raw: string) => {
    if (disabled) return;

    const numeric = raw.replace(/[^0-9]/g, "");
    const digit = numeric.slice(-1);
    const nextDigits = [...digitsRef.current];
    nextDigits[index] = digit;
    commitDigits(nextDigits);

    if (digit && index < 3) {
      focusAt(index + 1);
    }
  }, [commitDigits, disabled, focusAt]);

  const handleKeyDown = useCallback((index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "Backspace" && !digitsRef.current[index]) {
      event.preventDefault();
      if (index > 0) {
        const nextDigits = [...digitsRef.current];
        nextDigits[index - 1] = "";
        commitDigits(nextDigits);
        focusAt(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (index > 0) focusAt(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (index < 3) focusAt(index + 1);
    }
  }, [commitDigits, disabled, focusAt]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    event.preventDefault();
    const pasted = sanitizeValue(event.clipboardData.getData("text"));
    const nextDigits = Array.from({ length: 4 }, (_, index) => pasted[index] ?? "");
    commitDigits(nextDigits);

    const nextFocusIndex = Math.min(pasted.length, 3);
    focusAt(nextFocusIndex);
  }, [commitDigits, disabled, focusAt, sanitizeValue]);

  return (
    <HStack gap={3} justify="center">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          value={digit}
          onChange={(e) => handleDigitChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          maxLength={1}
          disabled={disabled}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="next"
          autoComplete="one-time-code"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={error || undefined}
          data-lpignore="true"
          data-1p-ignore="true"
          style={{
            width: "60px",
            height: "60px",
            fontSize: "2rem",
            fontWeight: "bold",
            fontFamily: "monospace",
            color: "black",
            background: disabled ? UI_TOKENS.COLORS.whiteAlpha60 : "white",
            border: error
              ? "3px solid #EF4444"
              : `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
            borderRadius: 0,
            textAlign: "center",
            boxShadow: "2px 2px 0 rgba(0,0,0,0.8)",
            outline: "none",
            transition: "all 0.15s ease",
          }}
          aria-label={`パスワード${index + 1}桁目`}
        />
      ))}
    </HStack>
  );
}
