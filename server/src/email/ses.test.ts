import { describe, expect, test } from "bun:test";

import { createSesRequest } from "./ses";

const input = {
  region: "us-east-1",
  from: { email: "login@example.com", name: "App" },
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  message: {
    to: "user@example.com",
    subject: "Welcome - your account is ready",
    text: "Welcome",
    html: "<p>Welcome</p>"
  },
  now: new Date("2026-08-15T12:34:56.000Z")
};

describe("createSesRequest", () => {
  test("targets the regional SES v2 endpoint", async () => {
    const request = await createSesRequest(input);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://email.us-east-1.amazonaws.com/v2/email/outbound-emails");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.get("x-amz-date")).toBe("20260815T123456Z");
  });

  test("signs the request with a deterministic SigV4 signature", async () => {
    const first = await createSesRequest(input);
    const second = await createSesRequest(input);
    const authorization = first.headers.get("authorization") ?? "";
    expect(authorization).toBe(second.headers.get("authorization") ?? "");
    expect(authorization).toContain(
      "Credential=AKIAIOSFODNN7EXAMPLE/20260815/us-east-1/ses/aws4_request"
    );
    expect(authorization).toContain(
      "SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date"
    );
    expect(/Signature=[0-9a-f]{64}$/u.test(authorization)).toBe(true);
  });

  test("changes the signature when the payload changes", async () => {
    const original = await createSesRequest(input);
    const modified = await createSesRequest({
      ...input,
      message: { ...input.message, subject: "Another subject" }
    });
    expect(original.headers.get("authorization")).not.toBe(modified.headers.get("authorization"));
  });

  test("encodes a display name SES only takes as an encoded word", async () => {
    const accented = await createSesRequest({ ...input, from: { email: "login@example.com", name: "Aplicação" } });
    const bare = await createSesRequest({ ...input, from: { email: "login@example.com" } });
    expect(await accented.json()).toMatchObject({ FromEmailAddress: "=?UTF-8?B?QXBsaWNhw6fDo28=?= <login@example.com>" });
    expect(await bare.json()).toMatchObject({ FromEmailAddress: "login@example.com" });
  });

  test("sends the message as a simple SES payload", async () => {
    const request = await createSesRequest(input);
    expect(await request.json()).toMatchObject({
      FromEmailAddress: '"App" <login@example.com>',
      Destination: { ToAddresses: ["user@example.com"] },
      Content: { Simple: { Subject: { Data: "Welcome - your account is ready" } } }
    });
  });
});
