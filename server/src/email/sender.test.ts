import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { AppEnv } from "../config";
import { sendEmail, type EmailMessage } from "./sender";

const message: EmailMessage = {
  to: "user@example.com",
  subject: "Confirm your address",
  text: "Confirm",
  html: "<p>Confirm</p>"
};

const off = { EMAIL_DRIVER: "none", EMAIL_FROM: "" } as AppEnv;

afterEach(() => {
  spyOn(globalThis, "fetch").mockRestore();
  spyOn(console, "info").mockRestore();
});

describe("sendEmail", () => {
  test("drops the message while delivery is off, logging no address", async () => {
    const info = spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = spyOn(globalThis, "fetch");
    await sendEmail(off, message);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(info.mock.calls)).not.toContain(message.to);
  });

  test("hands the message to the Cloudflare binding with the configured sender", async () => {
    spyOn(console, "info").mockImplementation(() => undefined);
    const send = mock(async (_message: unknown) => undefined);
    const env = { ...off, EMAIL_DRIVER: "cloudflare", EMAIL: { send } } as AppEnv;

    await sendEmail({ ...env, EMAIL_FROM: "App <noreply@app.example>" }, message);
    await sendEmail({ ...env, EMAIL_FROM: "noreply@app.example" }, message);

    expect(send.mock.calls).toEqual([
      [{ ...message, from: { email: "noreply@app.example", name: "App" } }],
      [{ ...message, from: "noreply@app.example" }]
    ]);
  });

  test("names the SES error type when SES rejects the message", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 400, headers: { "x-amzn-errortype": "MessageRejected:http://internal.amazon.com/" } })
    );
    const env = {
      ...off,
      EMAIL_DRIVER: "ses",
      EMAIL_FROM: "noreply@app.example",
      SES_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
      AWS_SECRET_ACCESS_KEY: "secret"
    } as AppEnv;

    await expect(sendEmail(env, message)).rejects.toThrow("SES request failed with status 400 (MessageRejected)");
  });
});
