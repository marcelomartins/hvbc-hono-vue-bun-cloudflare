import { expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";

import { AppError } from "./errors";
import { readJson } from "./json";

test("stops reading a body without Content-Length as soon as it exceeds the limit", async () => {
  const app = new Hono();
  app.post("/", async (context) => context.json(await readJson(context, z.object({}), 1024)));
  app.onError((error, context) =>
    context.json({ code: error instanceof AppError ? error.code : "UNEXPECTED" }, error instanceof AppError ? error.status : 500)
  );

  // The stream never ends, so buffering the whole body before checking its size would hang.
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(256));
    },
    cancel() {
      cancelled = true;
    }
  });

  const response = await app.request("/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body
  });
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ code: "BODY_TOO_LARGE" });
  expect(cancelled).toBe(true);
});
