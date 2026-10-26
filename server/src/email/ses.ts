import { SECURITY, emailSender, type AppEnv, type EmailSender } from "../config";
import { hmacBytes, sha256Hex } from "../security/crypto";
import { base64Encode, bytesToHex, utf8 } from "../security/encoding";
import type { EmailMessage } from "./sender";

const SERVICE = "ses";
const PATH = "/v2/email/outbound-emails";

// SES takes an ASCII display name as a quoted string, and any other one only as an
// RFC 2047 encoded word.
function sesAddress(sender: EmailSender): string {
  if (sender.name === undefined) return sender.email;
  const name = /^[\x20-\x7e]*$/u.test(sender.name)
    ? `"${sender.name.replaceAll("\\", "\\\\")}"`
    : `=?UTF-8?B?${base64Encode(utf8(sender.name))}?=`;
  return `${name} <${sender.email}>`;
}

async function signingKey(
  secret: string,
  date: string,
  region: string
): Promise<Uint8Array<ArrayBuffer>> {
  const dateKey = await hmacBytes(utf8(`AWS4${secret}`), date);
  const regionKey = await hmacBytes(dateKey, region);
  const serviceKey = await hmacBytes(regionKey, SERVICE);
  return hmacBytes(serviceKey, "aws4_request");
}

export interface SesRequestInput {
  region: string;
  from: EmailSender;
  accessKeyId: string;
  secretAccessKey: string;
  message: EmailMessage;
  now?: Date;
}

export async function createSesRequest(input: SesRequestInput): Promise<Request> {
  const host = `email.${input.region}.amazonaws.com`;
  const body = JSON.stringify({
    FromEmailAddress: sesAddress(input.from),
    Destination: { ToAddresses: [input.message.to] },
    Content: {
      Simple: {
        Subject: { Data: input.message.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: input.message.text, Charset: "UTF-8" },
          Html: { Data: input.message.html, Charset: "UTF-8" }
        }
      }
    }
  });
  const amzDate = (input.now ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/gu, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `POST\n${PATH}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/${input.region}/${SERVICE}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`;
  const signature = bytesToHex(
    await hmacBytes(await signingKey(input.secretAccessKey, date, input.region), stringToSign)
  );
  return new Request(`https://${host}${PATH}`, {
    method: "POST",
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "content-type": "application/json",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate
    },
    body
  });
}

export async function sendWithSes(env: AppEnv, message: EmailMessage): Promise<void> {
  const sender = emailSender(env);
  // assertRuntimeConfiguration already rejects this; failing here keeps the driver closed regardless.
  if (sender === null) throw new Error("EMAIL_DRIVER=ses is not configured");
  const request = await createSesRequest({
    region: env.SES_REGION,
    from: sender,
    accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
    message
  });
  const response = await fetch(request, {
    signal: AbortSignal.timeout(SECURITY.outboundRequestTimeoutMs)
  });
  if (!response.ok) {
    // The error type, such as MessageRejected, names the cause without any address.
    const errorType = response.headers.get("x-amzn-errortype")?.split(":", 1)[0];
    throw new Error(`SES request failed with status ${response.status}${errorType ? ` (${errorType})` : ""}`);
  }
}
