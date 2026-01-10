import { isNonEmptyNumbersObject } from "@/lib/server/roomCommandsSubmitOrder/helpers";

describe("roomCommandsSubmitOrder helpers", () => {
  test("isNonEmptyNumbersObject returns true only for non-empty objects", () => {
    expect(isNonEmptyNumbersObject(null)).toBe(false);
    expect(isNonEmptyNumbersObject(undefined)).toBe(false);
    expect(isNonEmptyNumbersObject("nope")).toBe(false);
    expect(isNonEmptyNumbersObject({})).toBe(false);
    expect(isNonEmptyNumbersObject({ a: 1 })).toBe(true);
  });
});

