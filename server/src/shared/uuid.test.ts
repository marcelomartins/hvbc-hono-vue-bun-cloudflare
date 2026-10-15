import { isUuidV7 } from "@hvbc/contracts/uuid";
import { describe, expect, test } from "bun:test";

import { uuidV7 } from "./uuid";

describe("uuidV7", () => {
  test("generates canonical UUID v7 values", () => {
    for (let index = 0; index < 100; index += 1) {
      expect(isUuidV7(uuidV7())).toBe(true);
    }
  });

  test("orders values by timestamp", () => {
    const earlier = uuidV7(1_000_000_000_000);
    const later = uuidV7(2_000_000_000_000);
    expect(earlier < later).toBe(true);
  });

  test("rejects timestamps outside 48 bits", () => {
    expect(() => uuidV7(-1)).toThrow(RangeError);
    expect(() => uuidV7(2 ** 48)).toThrow(RangeError);
  });
});
