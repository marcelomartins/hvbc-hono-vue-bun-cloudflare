import type { AppEnv } from "../config";
import { structuredLog } from "../observability/log";
import { sendWithCloudflare } from "./cloudflare";
import { sendWithSes } from "./ses";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * The framework sends no email itself: a project calls this for the messages it adds,
 * and EMAIL_DRIVER decides how they leave. Callers decide whether a failure is fatal.
 */
export async function sendEmail(env: AppEnv, message: EmailMessage): Promise<void> {
  switch (env.EMAIL_DRIVER) {
    case "none":
      structuredLog("info", { event: "email_skipped", driver: "none" });
      return;
    case "console":
      // Only reachable locally; assertRuntimeConfiguration rejects this driver elsewhere.
      console.info(`\n--- email ---\nto: ${message.to}\nsubject: ${message.subject}\n\n${message.text}\n-------------\n`);
      return;
    case "cloudflare":
      await sendWithCloudflare(env, message);
      break;
    case "ses":
      await sendWithSes(env, message);
      break;
  }
  structuredLog("info", { event: "email_sent", driver: env.EMAIL_DRIVER });
}
