import { describe, expect, test } from "bun:test";

import { isUuidV7 } from "./uuid";

describe("isUuidV7", () => {
  test("accepts canonical UUID v7 values", () => {
    expect(isUuidV7("01890a5d-ac96-774b-bcce-b302099a8057")).toBe(true);
  });

  test("rejects other UUID versions and malformed values", () => {
    expect(isUuidV7("d9428888-122b-11e1-b85c-61cd3cbb3210")).toBe(false);
    expect(isUuidV7("01890A5D-AC96-774B-BCCE-B302099A8057")).toBe(false);
    expect(isUuidV7("not-a-uuid")).toBe(false);
    expect(isUuidV7("")).toBe(false);
  });
});
