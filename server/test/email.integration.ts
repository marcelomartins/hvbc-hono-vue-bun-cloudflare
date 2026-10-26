import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { AppEnv } from "../src/config";
import { sendEmail } from "../src/email/sender";
import type { EmailBinding } from "../src/runtime/types";

describe("Cloudflare email binding", () => {
  it("accepts a message from the email layer in local development", async () => {
    // vitest.config.ts declares the binding; workerd keeps the message locally instead of sending it.
    const binding = (env as unknown as { EMAIL: EmailBinding }).EMAIL;
    const cloudflare = { EMAIL_DRIVER: "cloudflare", EMAIL_FROM: "App <noreply@example.com>", EMAIL: binding } as AppEnv;
    const message = { to: "user@example.com", subject: "Confirm your address", text: "Confirm", html: "<p>Confirm</p>" };
    await expect(sendEmail(cloudflare, message)).resolves.toBeUndefined();
  });
});
