import type { AuthConfigDto } from "@hvbc/contracts/api";
import { loginSchema, registerSchema } from "@hvbc/contracts/auth";
import { Hono } from "hono";

import { SECURITY } from "../config";
import { forbidden } from "../http/errors";
import { readJson } from "../http/json";
import type { AppBindings } from "../http/types";
import { clientIpSubject, enforceAuthRateLimit } from "../security/rate-limit";
import { clearedSessionCookie, sessionCookie } from "../security/session";
import { verifyTurnstile } from "../security/turnstile";
import { requireAuthentication } from "./middleware";
import * as service from "./service";

export const authRoutes = new Hono<AppBindings>();

authRoutes.get("/config", (context) => {
  const body: AuthConfigDto = {
    turnstileSiteKey: context.env.TURNSTILE_SITE_KEY.trim() === "" ? null : context.env.TURNSTILE_SITE_KEY
  };
  return context.json(body);
});

authRoutes.post("/register", async (context) => {
  const input = await readJson(context, registerSchema, SECURITY.authBodyBytes);
  await enforceAuthRateLimit(context, "register", [clientIpSubject(context)]);
  const requestId = context.get("requestId");
  const passed = await verifyTurnstile(
    context.env,
    input.turnstileToken,
    context.get("clientIp"),
    "register",
    requestId
  );
  if (!passed) throw forbidden("TURNSTILE_FAILED");
  const result = await service.register(context.env, input, requestId);
  context.header("Set-Cookie", sessionCookie(context.env, result.token));
  return context.json(result.user, 201);
});

authRoutes.post("/login", async (context) => {
  const input = await readJson(context, loginSchema, SECURITY.authBodyBytes);
  await enforceAuthRateLimit(context, "login", [clientIpSubject(context), `email:${input.email}`]);
  const requestId = context.get("requestId");
  const passed = await verifyTurnstile(
    context.env,
    input.turnstileToken,
    context.get("clientIp"),
    "login",
    requestId
  );
  if (!passed) throw forbidden("TURNSTILE_FAILED");
  const token = await service.login(context.env, input, requestId);
  context.header("Set-Cookie", sessionCookie(context.env, token));
  return context.body(null, 204);
});

authRoutes.post("/logout", requireAuthentication, async (context) => {
  await service.logout(context.env, context.get("authenticated").user, context.get("requestId"));
  context.header("Set-Cookie", clearedSessionCookie(context.env));
  return context.body(null, 204);
});
