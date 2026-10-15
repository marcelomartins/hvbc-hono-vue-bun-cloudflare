import { describe, expect, it } from "vitest";

import { apiRequest, registerUser } from "./helpers";

describe("SPA shell gate", () => {
  it("sends anonymous visitors to the login page with the path to return to", async () => {
    for (const path of ["/app", "/app/account", "/app/settings", "/app/settings/nested", "/app/settings?tab=security"]) {
      const response = await apiRequest(path);
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`/login?${new URLSearchParams({ next: path })}`);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });

  it("lets authenticated visitors through to the shell asset", async () => {
    const { cookie } = await registerUser("shell-user@example.com");
    // The asset layer is empty during tests, so the shell resolves to 404 unless a
    // frontend build is present. Either way, passing the gate means no redirect.
    const response = await apiRequest("/app", { cookie });
    expect(response.status).not.toBe(302);
    expect([200, 404]).toContain(response.status);
  });

  it("never serves the private shell to direct requests", async () => {
    const { cookie } = await registerUser("shell-direct@example.com");
    for (const path of ["/index-spa", "/index-spa.html", "/index-spa/anything"]) {
      expect((await apiRequest(path)).status).toBe(404);
      expect((await apiRequest(path, { cookie })).status).toBe(404);
    }
  });

  it("redirects authenticated visitors from the home page to the protected area", async () => {
    const { cookie } = await registerUser("shell-home@example.com");
    const response = await apiRequest("/", { cookie });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app");
  });

  it("keeps backend namespaces out of the asset fallback", async () => {
    const { cookie } = await registerUser("shell-backend@example.com");
    // The API namespace authenticates before routing, so anonymous requests are 401.
    expect((await apiRequest("/api/v1/unknown")).status).toBe(401);
    for (const response of [
      await apiRequest("/auth/unknown"),
      await apiRequest("/health/unknown"),
      await apiRequest("/api/v1/unknown", { cookie })
    ]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
    }
  });
});
