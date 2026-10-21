import { describe, expect, it } from "vitest";

import { apiRequest } from "./helpers";

describe("health checks", () => {
  it("reports liveness without exposing deployment details", async () => {
    const response = await apiRequest("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "hvbc" });
  });

  it("reports readiness once the migrations are applied", async () => {
    const response = await apiRequest("/health/ready");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });
});
