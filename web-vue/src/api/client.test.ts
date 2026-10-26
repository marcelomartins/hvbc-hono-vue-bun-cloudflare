import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import { errorMessage } from "../i18n/messages";
import { apiFetch } from "./client";
import { isApiErrorBody } from "./errors";

describe("apiFetch", () => {
  const assign = mock((_url: string) => undefined);

  beforeEach(() => {
    assign.mockClear();
    globalThis.window = {
      location: { assign, pathname: "/app/settings", search: "" }
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    spyOn(globalThis, "fetch").mockRestore();
  });

  function respondWith(status: number, code: string): void {
    spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: { code, requestId: "req-1" } }, { status })
    );
  }

  test("sends the visitor to the login page when the session is gone", async () => {
    respondWith(401, "AUTHENTICATION_REQUIRED");
    await expect(apiFetch("/api/v1/me")).rejects.toMatchObject({ status: 401, code: "AUTHENTICATION_REQUIRED" });
    expect(assign).toHaveBeenCalledWith("/login?next=%2Fapp%2Fsettings");
  });

  test("keeps the visitor on the page for any other 401 answer", async () => {
    respondWith(401, "CURRENT_PASSWORD_INVALID");
    await expect(apiFetch("/api/v1/me/password", { method: "PUT", body: {} })).rejects.toMatchObject({
      status: 401,
      code: "CURRENT_PASSWORD_INVALID"
    });
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("isApiErrorBody", () => {
  test("accepts the server error contract", () => {
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
