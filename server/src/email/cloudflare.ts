import { emailSender, type AppEnv } from "../config";
import type { EmailMessage } from "./sender";

/** Sends through the Cloudflare Email Service binding, which only Workers provides. */
export async function sendWithCloudflare(env: AppEnv, message: EmailMessage): Promise<void> {
  const sender = emailSender(env);
  // assertRuntimeConfiguration already rejects both; failing here keeps the driver closed regardless.
  if (env.EMAIL === undefined || sender === null) throw new Error("EMAIL_DRIVER=cloudflare is not configured");
  await env.EMAIL.send({
    ...message,
    from: sender.name === undefined ? sender.email : { email: sender.email, name: sender.name }
  });
}
