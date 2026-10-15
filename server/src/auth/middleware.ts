import type { Context, MiddlewareHandler } from "hono";

import { unauthorized } from "../http/errors";
import type { AppBindings } from "../http/types";
import { readSessionCookie, verifySessionToken, type SessionClaims } from "../security/session";
import { findUserByUuid, type UserRow } from "./repository";

export interface AuthenticatedUser {
  user: UserRow;
  claims: SessionClaims;
}

export async function resolveAuthenticatedUser(
  context: Context<AppBindings>
): Promise<AuthenticatedUser | null> {
  const token = readSessionCookie(context.env, context.req.raw);
  if (token === null) return null;
  const claims = await verifySessionToken(context.env, token);
  if (claims === null) return null;
  const user = await findUserByUuid(context.env.DB, claims.sub);
  if (user === null || user.session_version !== claims.version) return null;
  return { user, claims };
}

export const requireAuthentication: MiddlewareHandler<AppBindings> = async (context, next) => {
  const authenticated = await resolveAuthenticatedUser(context);
  if (authenticated === null) throw unauthorized();
  context.set("authenticated", authenticated);
  await next();
};
