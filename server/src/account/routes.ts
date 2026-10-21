import { passwordChangeSchema, profileUpdateSchema } from "@hvbc/contracts/auth";
import { Hono } from "hono";

import { changePassword, toUserDto, updateProfile } from "../auth/service";
import { SECURITY } from "../config";
import { readJson } from "../http/json";
import type { AppBindings } from "../http/types";
import { sessionCookie } from "../security/session";

export const accountRoutes = new Hono<AppBindings>();

accountRoutes.get("/me", (context) => {
  return context.json(toUserDto(context.get("authenticated").user));
});

accountRoutes.put("/me", async (context) => {
  const input = await readJson(context, profileUpdateSchema, SECURITY.apiBodyBytes);
  const user = await updateProfile(
    context.env,
    context.get("authenticated").user,
    input,
    context.get("requestId")
  );
  return context.json(user);
});

accountRoutes.put("/me/password", async (context) => {
  const input = await readJson(context, passwordChangeSchema, SECURITY.apiBodyBytes);
  const token = await changePassword(
    context.env,
    context.get("authenticated").user,
    input,
    context.get("requestId")
  );
  context.header("Set-Cookie", sessionCookie(context.env, token));
  return context.body(null, 204);
});
