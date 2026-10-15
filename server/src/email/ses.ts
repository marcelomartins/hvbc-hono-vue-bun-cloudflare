import { SECURITY, type AppEnv } from "../config";
import { hmacBytes, sha256Hex } from "../security/crypto";
import { bytesToHex, utf8 } from "../security/encoding";
import type { EmailMessage } from "./sender";

const SERVICE = "ses";
const PATH = "/v2/email/outbound-emails";

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
  from: string;
  accessKeyId: string;
  secretAccessKey: string;
  message: EmailMessage;
  now?: Date;
}

export async function createSesRequest(input: SesRequestInput): Promise<Request> {
  const host = `email.${input.region}.amazonaws.com`;
  const body = JSON.stringify({
    FromEmailAddress: input.from,
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
  const request = await createSesRequest({
    region: env.SES_REGION,
    from: env.SES_FROM,
    accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
    message
  });
  const response = await fetch(request, {
    signal: AbortSignal.timeout(SECURITY.outboundRequestTimeoutMs)
  });
  if (!response.ok) throw new Error(`SES request failed with status ${response.status}`);
}
