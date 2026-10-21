import type { AppEnv } from "../config";
import { structuredLog } from "../observability/log";
import { sendWithSes } from "./ses";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Delivery is intentionally optional: with EMAIL_DRIVER=none the framework runs
 * without any provider. Callers decide whether a failure is fatal.
 */
export async function sendEmail(env: AppEnv, message: EmailMessage): Promise<void> {
  switch (env.EMAIL_DRIVER) {
    case "none":
      structuredLog("info", { event: "email_skipped", driver: "none", subject: message.subject });
      return;
    case "console":
      // Only reachable locally; assertRuntimeConfiguration rejects this driver elsewhere.
      console.info(`\n--- email ---\nto: ${message.to}\nsubject: ${message.subject}\n\n${message.text}\n-------------\n`);
      return;
    case "ses":
      await sendWithSes(env, message);
      structuredLog("info", { event: "email_sent", driver: "ses", subject: message.subject });
  }
}
