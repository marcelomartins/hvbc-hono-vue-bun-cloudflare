import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { findUserByEmail, updateUserName, type UserRow } from "../src/auth/repository";
import { changePassword } from "../src/auth/service";
import type { AppEnv, RuntimeSecrets } from "../src/config";
import { apiRequest, registerUser, sessionCookie, TEST_PASSWORD } from "./helpers";

// The bindings in vitest.config.ts provide the secrets that the generated Env omits.
const appEnv = (env as Env & RuntimeSecrets) as AppEnv;

async function storedUser(email: string): Promise<UserRow> {
  const user = await findUserByEmail(env.DB, email);
  if (user === null) throw new Error(`user ${email} not found`);
  return user;
}

describe("account management", () => {
  it("updates the profile name and bumps the version", async () => {
    const { cookie } = await registerUser("profile-user@example.com", "Original Name");
    const response = await apiRequest("/api/v1/me", {
      method: "PUT",
      cookie,
      body: { name: "  Updated Name ", version: 1 }
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: "Updated Name", version: 2 });
    expect(await (await apiRequest("/api/v1/me", { cookie })).json()).toMatchObject({
      name: "Updated Name"
    });
  });

  it("revokes every session on logout", async () => {
    const email = "revoke-user@example.com";
    await registerUser(email);
    const first = sessionCookie(await apiRequest("/auth/login", { body: { email, password: TEST_PASSWORD } }));
    const second = sessionCookie(await apiRequest("/auth/login", { body: { email, password: TEST_PASSWORD } }));
    expect((await apiRequest("/api/v1/me", { cookie: first })).status).toBe(200);
    expect((await apiRequest("/api/v1/me", { cookie: second })).status).toBe(200);

    expect((await apiRequest("/auth/logout", { method: "POST", cookie: second })).status).toBe(204);

    // Logging out is a full revocation: the other device is signed out too.
    expect((await apiRequest("/api/v1/me", { cookie: first })).status).toBe(401);
    expect((await apiRequest("/api/v1/me", { cookie: second })).status).toBe(401);
  });

  it("changes the password, keeps the current session and revokes the others", async () => {
    const email = "password-user@example.com";
    const { cookie: original } = await registerUser(email);
    const other = sessionCookie(await apiRequest("/auth/login", { body: { email, password: TEST_PASSWORD } }));

    const wrongCurrent = await apiRequest("/api/v1/me/password", {
      method: "PUT",
      cookie: original,
      body: { currentPassword: "not the password", newPassword: "a brand new password" }
    });
    expect(wrongCurrent.status).toBe(401);
    expect(await wrongCurrent.json()).toMatchObject({ error: { code: "CURRENT_PASSWORD_INVALID" } });

    const changed = await apiRequest("/api/v1/me/password", {
      method: "PUT",
      cookie: original,
      body: { currentPassword: TEST_PASSWORD, newPassword: "a brand new password" }
    });
    expect(changed.status).toBe(204);
    const refreshed = sessionCookie(changed);

    const afterChange = await apiRequest("/api/v1/me", { cookie: refreshed });
    expect(afterChange.status).toBe(200);
    expect(await afterChange.json()).toMatchObject({ version: 1 });
    expect((await apiRequest("/api/v1/me", { cookie: original })).status).toBe(401);
    expect((await apiRequest("/api/v1/me", { cookie: other })).status).toBe(401);

    expect(
      (await apiRequest("/auth/login", { body: { email, password: TEST_PASSWORD } })).status
    ).toBe(401);
    expect(
      (await apiRequest("/auth/login", { body: { email, password: "a brand new password" } })).status
    ).toBe(204);
  });

  it("rejects reusing the current password", async () => {
    const { cookie } = await registerUser("reuse-user@example.com");
    const response = await apiRequest("/api/v1/me/password", {
      method: "PUT",
      cookie,
      body: { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD }
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });

  it("rejects a profile update from a form edited at an older version", async () => {
    const { cookie } = await registerUser("stale-profile@example.com", "Original Name");
    const first = await apiRequest("/api/v1/me", { method: "PUT", cookie, body: { name: "First Tab", version: 1 } });
    expect(first.status).toBe(200);

    const second = await apiRequest("/api/v1/me", { method: "PUT", cookie, body: { name: "Second Tab", version: 1 } });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: { code: "CONFLICT" } });
    expect(await (await apiRequest("/api/v1/me", { cookie })).json()).toMatchObject({ name: "First Tab", version: 2 });
  });

  it("keeps a password change when the profile changed after the session was read", async () => {
    const email = "renamed-meanwhile@example.com";
    const { cookie } = await registerUser(email);
    const stale = await storedUser(email);
    await updateUserName(env.DB, stale, "Renamed Meanwhile", stale.version);

    await changePassword(
      appEnv,
      stale,
      { currentPassword: TEST_PASSWORD, newPassword: "a brand new password" },
      "test"
    );

    expect((await apiRequest("/api/v1/me", { cookie })).status).toBe(401);
    expect(
      (await apiRequest("/auth/login", { body: { email, password: "a brand new password" } })).status
    ).toBe(204);
  });

  it("rejects a password change that lost the race to another one", async () => {
    const email = "password-race@example.com";
    await registerUser(email);
    const stale = await storedUser(email);
    await changePassword(appEnv, stale, { currentPassword: TEST_PASSWORD, newPassword: "first new password" }, "test");

    await expect(
      changePassword(appEnv, stale, { currentPassword: TEST_PASSWORD, newPassword: "second new password" }, "test")
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(
      (await apiRequest("/auth/login", { body: { email, password: "first new password" } })).status
    ).toBe(204);
  });

  it("requires authentication for every account endpoint", async () => {
    expect((await apiRequest("/api/v1/me", { method: "PUT", body: { name: "Anonymous" } })).status).toBe(401);
    expect(
      (
        await apiRequest("/api/v1/me/password", {
          method: "PUT",
          body: { currentPassword: "a", newPassword: "another password" }
        })
      ).status
    ).toBe(401);
  });
});
