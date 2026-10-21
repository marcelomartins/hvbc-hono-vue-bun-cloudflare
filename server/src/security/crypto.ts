import { bytesToHex, utf8 } from "./encoding";

export async function hmacBytes(
  key: Uint8Array<ArrayBuffer>,
  value: string
): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, utf8(value)));
}

export function hmacSha256(secret: string, value: string): Promise<Uint8Array<ArrayBuffer>> {
  return hmacBytes(utf8(secret), value);
}

export async function sha256Hex(value: string): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(value))));
}
