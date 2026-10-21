import { describe, expect, test } from "bun:test";

import { hashPassword, isAcceptablePassword, verifyPassword } from "./password";

describe("password hashing", () => {
  test("hashes and verifies a password", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded.startsWith("pbkdf2-sha256$v=1$i=100000$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", encoded)).toBe(true);
    expect(await verifyPassword("wrong password", encoded)).toBe(false);
  });

  test("produces a different salt on every hash", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).not.toBe(second);
  });

  test("rejects missing or malformed stored hashes", async () => {
    expect(await verifyPassword("any password", null)).toBe(false);
    expect(await verifyPassword("any password", "plaintext")).toBe(false);
    expect(await verifyPassword("any password", "pbkdf2-sha256$v=1$i=1$s=ab$h=cd")).toBe(false);
  });

  test("enforces the password policy bounds", () => {
    expect(isAcceptablePassword("short")).toBe(false);
    expect(isAcceptablePassword("long enough password")).toBe(true);
    expect(isAcceptablePassword("x".repeat(129))).toBe(false);
  });
});
