import { describe, expect, test } from "bun:test";

import { errorMessage } from "../i18n/messages";
import { isApiErrorBody } from "./errors";

describe("isApiErrorBody", () => {
  test("accepts the Worker error contract", () => {
    expect(
      isApiErrorBody({ error: { code: "INVALID_REQUEST", requestId: "01890a5d-ac96-774b-bcce-b302099a8057" } })
    ).toBe(true);
  });

  test("rejects other shapes", () => {
    expect(isApiErrorBody(null)).toBe(false);
    expect(isApiErrorBody({})).toBe(false);
    expect(isApiErrorBody({ error: { code: "X" } })).toBe(false);
    expect(isApiErrorBody({ error: "boom" })).toBe(false);
  });
});

describe("errorMessage", () => {
  test("maps known codes to messages", () => {
    expect(errorMessage("INVALID_CREDENTIALS")).toBe("Invalid email or password.");
  });

  test("falls back to the request id for unknown codes", () => {
    expect(errorMessage("SOMETHING_NEW", "req-1")).toContain("req-1");
    expect(errorMessage("SOMETHING_NEW")).toBe(errorMessage("INTERNAL_ERROR"));
  });
});
