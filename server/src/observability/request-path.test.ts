import { describe, expect, test } from "bun:test";

import { sanitizedRequestPath } from "./request-path";

describe("sanitizedRequestPath", () => {
  test("replaces UUID v7 segments and drops the query string", () => {
    const request = new Request(
      "https://app.example/api/v1/items/01890a5d-ac96-774b-bcce-b302099a8057?token=secret"
    );
    expect(sanitizedRequestPath(request)).toBe("/api/v1/items/:uuid");
  });

  test("keeps regular segments untouched", () => {
    expect(sanitizedRequestPath(new Request("https://app.example/auth/login"))).toBe("/auth/login");
  });
});
