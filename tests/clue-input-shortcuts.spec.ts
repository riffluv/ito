import { test, expect } from "@playwright/test";
import { shouldFocusClueInput, shouldSubmitClue } from "../lib/hooks/useClueInput";
import { KEYBOARD_KEYS } from "../components/ui/hints/constants";

const createTarget = (tagName: string, editable = false) =>
  ({
    tagName,
    isContentEditable: editable,
  }) as unknown as HTMLElement;

test("space focuses clue input when appropriate", () => {
  const event = { key: KEYBOARD_KEYS.SPACE, target: createTarget("DIV") } as KeyboardEvent;
  expect(shouldFocusClueInput(event, true)).toBe(true);

  const inputEvent = { key: KEYBOARD_KEYS.SPACE, target: createTarget("input") } as KeyboardEvent;
  expect(shouldFocusClueInput(inputEvent, true)).toBe(false);

  const contentEditableEvent = {
    key: KEYBOARD_KEYS.SPACE,
    target: createTarget("DIV", true),
  } as KeyboardEvent;
  expect(shouldFocusClueInput(contentEditableEvent, true)).toBe(false);

  const disabledEvent = { key: KEYBOARD_KEYS.SPACE, target: createTarget("DIV") } as KeyboardEvent;
  expect(shouldFocusClueInput(disabledEvent, false)).toBe(false);
});

test("enter submits clue only when allowed", () => {
  expect(shouldSubmitClue(KEYBOARD_KEYS.ENTER, true)).toBe(true);
  expect(shouldSubmitClue(KEYBOARD_KEYS.ENTER, false)).toBe(false);
  expect(shouldSubmitClue("Escape", true)).toBe(false);
});

