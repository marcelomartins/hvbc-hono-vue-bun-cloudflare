import { describe, expect, test } from "bun:test";

import { loginSchema, normalizeEmail, passwordChangeSchema, registerSchema } from "./auth";

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});

describe("registerSchema", () => {
  test("accepts a valid payload and keeps the email as typed, trimmed", () => {
    const parsed = registerSchema.parse({
      name: "  Ada Lovelace ",
      email: " Ada@Example.com ",
      password: "correct horse battery"
    });
    expect(parsed).toEqual({
      name: "Ada Lovelace",
      email: "Ada@Example.com",
      password: "correct horse battery"
    });
  });

  test("accepts an optional Turnstile token", () => {
    const parsed = registerSchema.parse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct horse battery",
      turnstileToken: "widget-token"
    });
    expect(parsed.turnstileToken).toBe("widget-token");
  });

  test("rejects short passwords, short names and unknown fields", () => {
    expect(registerSchema.safeParse({ name: "Ada", email: "a@b.io", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "a@b.io", password: "long enough" }).success).toBe(false);
    expect(
      registerSchema.safeParse({ name: "Ada", email: "a@b.io", password: "long enough", extra: 1 }).success
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  test("rejects empty passwords but accepts legacy short ones", () => {
    expect(loginSchema.safeParse({ email: "a@b.io", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.io", password: "x" }).success).toBe(true);
  });
});

describe("passwordChangeSchema", () => {
  test("accepts a different new password", () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "old one", newPassword: "a new password" }).success
    ).toBe(true);
  });

  test("rejects reusing the current password and weak new passwords", () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "same password", newPassword: "same password" }).success
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "old one", newPassword: "short" }).success
    ).toBe(false);
  });
});
