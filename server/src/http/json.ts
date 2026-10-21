import type { Context } from "hono";
import type { z } from "zod";

import { badRequest, bodyTooLarge } from "./errors";

function zodDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.length === 0 ? "$" : issue.path.join(".");
    (details[field] ??= []).push(issue.code);
  }
  return details;
}

// Content-Length is optional and set by the client, so the limit is enforced on the
// bytes actually received and the stream is cancelled as soon as it is exceeded.
async function readBodyWithinLimit(request: Request, maximumBytes: number): Promise<Uint8Array> {
  if (request.body === null) return new Uint8Array();
  const reader = (request.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maximumBytes) {
      // The request is rejected either way, so a failed cancel must not turn the 413 into a 500.
      await reader.cancel().catch(() => undefined);
      throw bodyTooLarge();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJson<T extends z.ZodType>(
  context: Context,
  schema: T,
  maximumBytes: number
): Promise<z.output<T>> {
  const contentType = context.req.header("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw badRequest("JSON_REQUIRED");

  const declaredLength = Number(context.req.header("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw bodyTooLarge();
  }

  const bytes = await readBodyWithinLimit(context.req.raw, maximumBytes);

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw badRequest("INVALID_JSON");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw badRequest("INVALID_REQUEST", zodDetails(parsed.error));
  return parsed.data;
}
