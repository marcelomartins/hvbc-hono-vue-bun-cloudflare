import { describe, expect, test } from "bun:test";

import type { AppEnv } from "../config";
import {
  clearedSessionCookie,
  createSessionToken,
  readSessionCookie,
  sessionCookie,
  verifySessionToken
} from "./session";

const env = {
  SESSION_SECRET: "test-session-secret-that-is-at-least-32-bytes"
} as AppEnv;

const otherEnv = {
  SESSION_SECRET: "another-session-secret-that-is-32-bytes!!"
} as AppEnv;

describe("session tokens", () => {
  test("round-trips valid claims", async () => {
    const token = await createSessionToken(env, "01890a5d-ac96-774b-bcce-b302099a8057", 1);
    const claims = await verifySessionToken(env, token);
    expect(claims).toMatchObject({ sub: "01890a5d-ac96-774b-bcce-b302099a8057", version: 1 });
  });

  test("rejects tokens signed with a different secret", async () => {
    const token = await createSessionToken(otherEnv, "01890a5d-ac96-774b-bcce-b302099a8057", 1);
    expect(await verifySessionToken(env, token)).toBeNull();
  });

  test("rejects tampered payloads", async () => {
    const token = await createSessionToken(env, "01890a5d-ac96-774b-bcce-b302099a8057", 1);
    const [payload = "", signature = ""] = token.split(".");
    const tampered = `${payload.slice(0, -2)}aa.${signature}`;
    expect(await verifySessionToken(env, tampered)).toBeNull();
    expect(await verifySessionToken(env, "not-a-token")).toBeNull();
  });

  test("rejects expired tokens", async () => {
    const past = Date.now() - 40 * 86_400_000;
    const token = await createSessionToken(env, "01890a5d-ac96-774b-bcce-b302099a8057", 1, past);
    expect(await verifySessionToken(env, token)).toBeNull();
  });

});

describe("session cookie", () => {
  const httpsEnv = { ENVIRONMENT: "production", APP_ORIGIN: "https://app.example" } as AppEnv;
  const localEnv = { ENVIRONMENT: "local", APP_ORIGIN: "http://localhost" } as AppEnv;
  const insecureHttpEnv = { ENVIRONMENT: "production", APP_ORIGIN: "http://192.168.0.10:3000" } as AppEnv;

  test("keeps the __Host- prefix and Secure on HTTPS and in local development", () => {
    for (const cookieEnv of [httpsEnv, localEnv]) {
      expect(sessionCookie(cookieEnv, "abc.def")).toBe(
        "__Host-hvbc-session=abc.def; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax"
      );
    }
  });

  test("drops Secure and the prefix only for plain HTTP outside local development", () => {
    expect(sessionCookie(insecureHttpEnv, "abc.def")).toBe(
      "hvbc-session=abc.def; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax"
    );
    expect(clearedSessionCookie(insecureHttpEnv)).toBe("hvbc-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  });

  test("reads only the cookie named for the current transport", () => {
    const request = new Request("https://app.example/", {
      headers: { cookie: "other=1; __Host-hvbc-session=abc.def; hvbc-session=ghi.jkl" }
    });
    expect(readSessionCookie(httpsEnv, request)).toBe("abc.def");
    expect(readSessionCookie(insecureHttpEnv, request)).toBe("ghi.jkl");
    expect(readSessionCookie(httpsEnv, new Request("https://app.example/"))).toBeNull();
  });
});
