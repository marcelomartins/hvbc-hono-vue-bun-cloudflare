import { SECURITY } from "../config";
import { base64UrlDecode, base64UrlEncode, randomBytes, timingSafeEqual, utf8 } from "./encoding";

const FORMAT = /^pbkdf2-sha256\$v=1\$i=(\d+)\$s=([A-Za-z0-9_-]+)\$h=([A-Za-z0-9_-]+)$/u;

function passwordLength(value: string): number {
  return Array.from(value).length;
}

export function isAcceptablePassword(value: string): boolean {
  const length = passwordLength(value);
  return length >= SECURITY.passwordMinCodePoints && length <= SECURITY.passwordMaxCodePoints;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key,
      SECURITY.passwordHashBytes * 8
    )
  );
}

export async function hashPassword(password: string): Promise<string> {
  if (!isAcceptablePassword(password)) throw new RangeError("password policy violation");
  const salt = randomBytes(SECURITY.passwordSaltBytes);
  const hash = await derive(password, salt, SECURITY.passwordIterations);
  return `pbkdf2-sha256$v=1$i=${SECURITY.passwordIterations}$s=${base64UrlEncode(salt)}$h=${base64UrlEncode(hash)}`;
}

export async function consumePasswordWork(password: string): Promise<void> {
  await derive(password, randomBytes(SECURITY.passwordSaltBytes), SECURITY.passwordIterations);
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (encoded === null) return false;
  const match = FORMAT.exec(encoded);
  if (!match) return false;
  const iterations = Number(match[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) return false;
  try {
    const expected = base64UrlDecode(match[3] ?? "");
    const actual = await derive(password, base64UrlDecode(match[2] ?? ""), iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
