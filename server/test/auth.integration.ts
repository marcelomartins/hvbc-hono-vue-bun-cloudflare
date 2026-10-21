import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createUser } from "../src/auth/repository";
import { apiRequest, registerUser, sessionCookie, TEST_PASSWORD } from "./helpers";

describe("authentication", () => {
  it("registers a user and exposes only public identifiers", async () => {
    const email = "user-one@example.com";
    const { cookie, user } = await registerUser(email, "User One");
    expect(user).toMatchObject({ name: "User One", email, version: 1 });
    expect(typeof user.uuid).toBe("string");
    expect(user).not.toHaveProperty("id");
    expect(user).not.toHaveProperty("password_hash");

    const me = await apiRequest("/api/v1/me", { cookie });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ name: "User One", email });

    const rows = await env.DB
      .prepare("SELECT id, uuid FROM users WHERE normalized_email = ?")
      .bind(email)
      .all();
    expect(rows.results).toHaveLength(1);
    expect(typeof rows.results[0]?.id).toBe("number");
  });

  it("rejects duplicate registrations by normalized email", async () => {
    await registerUser("duplicate@example.com");
    const response = await apiRequest("/auth/register", {
      body: { name: "Another", email: "  Duplicate@Example.com ", password: TEST_PASSWORD }
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "EMAIL_ALREADY_REGISTERED" } });
  });

  it("keeps the email as typed while matching it case-insensitively", async () => {
    const { user } = await registerUser("Mixed.Case@Example.com");
    expect(user).toMatchObject({ email: "Mixed.Case@Example.com" });
    const login = await apiRequest("/auth/login", {
      body: { email: "mixed.case@example.com", password: TEST_PASSWORD }
    });
    expect(login.status).toBe(204);
  });

  it("does not insert a second user for a registered normalized email", async () => {
    const email = "insert-race@example.com";
    await registerUser(email);
    const duplicate = await createUser(env.DB, {
      name: "Racer",
      email,
      normalizedEmail: email,
      passwordHash: "unused"
    });
    expect(duplicate).toBeNull();
  });

  it("resolves concurrent registrations without a server error", async () => {
    const body = { name: "Racer", email: "concurrent@example.com", password: TEST_PASSWORD };
    const responses = await Promise.all([
      apiRequest("/auth/register", { body }),
      apiRequest("/auth/register", { body })
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it("logs in with valid credentials and rejects invalid ones", async () => {
    const email = "login-user@example.com";
    await registerUser(email);

    const wrongPassword = await apiRequest("/auth/login", {
      body: { email, password: "wrong password" }
    });
    expect(wrongPassword.status).toBe(401);
    expect(await wrongPassword.json()).toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });

    const unknownUser = await apiRequest("/auth/login", {
      body: { email: "missing@example.com", password: TEST_PASSWORD }
    });
    expect(unknownUser.status).toBe(401);

    const login = await apiRequest("/auth/login", { body: { email, password: TEST_PASSWORD } });
    expect(login.status).toBe(204);
    const cookie = sessionCookie(login);
    expect(cookie.startsWith("__Host-hvbc-session=")).toBe(true);

    const me = await apiRequest("/api/v1/me", { cookie });
    expect(me.status).toBe(200);
  });

  it("requires authentication for the API and clears the cookie on logout", async () => {
    expect((await apiRequest("/api/v1/me")).status).toBe(401);

    const { cookie } = await registerUser("logout-user@example.com");
    const logout = await apiRequest("/auth/logout", { method: "POST", cookie });
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects unsafe requests without a matching origin", async () => {
    const response = await apiRequest("/auth/login", {
      body: { email: "a@b.io", password: "irrelevant" }
    });
    expect(response.status).not.toBe(403);

    const crossOrigin = await fetchWithOrigin("https://evil.example");
    expect(crossOrigin.status).toBe(403);
    expect(await crossOrigin.json()).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
  });

  it("reports Turnstile as disabled while it is not configured", async () => {
    const response = await apiRequest("/auth/config");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ turnstileSiteKey: null });
  });

  it("validates request bodies and reports field details", async () => {
    const response = await apiRequest("/auth/register", {
      body: { name: "X", email: "not-an-email", password: "short" }
    });
    expect(response.status).toBe(400);
    const body = await response.json<{ error: { code: string; details?: Record<string, string[]> } }>();
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.details).toBeDefined();
  });

  it("rejects bodies that are not JSON", async () => {
    const wrongType = await postLogin("text/plain", JSON.stringify({ email: "a@b.io", password: "irrelevant" }));
    expect(wrongType.status).toBe(400);
    expect(await wrongType.json()).toMatchObject({ error: { code: "JSON_REQUIRED" } });

    const malformed = await postLogin("application/json", "{");
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: { code: "INVALID_JSON" } });
  });

  it("rejects an oversized body that declares no Content-Length", async () => {
    const chunk = new TextEncoder().encode(" ".repeat(1024));
    let sent = 0;
    // A stream of unknown length is sent chunked, so the size is only known while reading.
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 64) return controller.close();
        sent += 1;
        controller.enqueue(chunk);
      }
    });
    const response = await postLogin("application/json", body);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "BODY_TOO_LARGE" } });
  });
});

async function postLogin(contentType: string, body: BodyInit): Promise<Response> {
  const { SELF } = await import("cloudflare:test");
  return SELF.fetch("http://localhost/auth/login", {
    method: "POST",
    headers: { "content-type": contentType, origin: "http://localhost" },
    body
  });
}

async function fetchWithOrigin(origin: string): Promise<Response> {
  const { SELF } = await import("cloudflare:test");
  return SELF.fetch("http://localhost/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: "a@b.io", password: "irrelevant" })
  });
}
