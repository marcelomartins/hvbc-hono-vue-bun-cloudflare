import type { UserDto } from "@hvbc/contracts/api";
import { normalizeEmail, type Login, type PasswordChange, type ProfileUpdate, type Register } from "@hvbc/contracts/auth";

import type { AppEnv } from "../config";
import { conflict, unauthorized } from "../http/errors";
import { structuredLog } from "../observability/log";
import { consumePasswordWork, hashPassword, verifyPassword } from "../security/password";
import { createSessionToken } from "../security/session";
import {
  bumpSessionVersion,
  createUser,
  findUserByEmail,
  updateUserName,
  updateUserPassword,
  type UserRow
} from "./repository";

export function toUserDto(user: UserRow): UserDto {
  return {
    uuid: user.uuid,
    name: user.name,
    email: user.email,
    version: user.version,
    createdAt: user.created_at
  };
}

export async function register(
  env: AppEnv,
  input: Register,
  requestId: string
): Promise<{ token: string; user: UserDto }> {
  const normalizedEmail = normalizeEmail(input.email);
  // The lookup only skips the hashing work; a concurrent registration can still
  // reach the insert first, and createUser reports that as null.
  const existing = await findUserByEmail(env.DB, normalizedEmail);
  if (existing !== null) throw conflict("EMAIL_ALREADY_REGISTERED");
  const passwordHash = await hashPassword(input.password);
  const user = await createUser(env.DB, {
    name: input.name,
    email: input.email,
    normalizedEmail,
    passwordHash
  });
  if (user === null) throw conflict("EMAIL_ALREADY_REGISTERED");
  structuredLog("info", { event: "auth_register", requestId, userUuid: user.uuid });
  return { token: await createSessionToken(env, user.uuid, user.session_version), user: toUserDto(user) };
}

export async function login(env: AppEnv, input: Login, requestId: string): Promise<string> {
  const user = await findUserByEmail(env.DB, input.email);
  if (user === null) {
    await consumePasswordWork(input.password);
    structuredLog("warn", { event: "auth_login_failed", requestId });
    throw unauthorized("INVALID_CREDENTIALS");
  }
  if (!(await verifyPassword(input.password, user.password_hash))) {
    structuredLog("warn", { event: "auth_login_failed", requestId, userUuid: user.uuid });
    throw unauthorized("INVALID_CREDENTIALS");
  }
  structuredLog("info", { event: "auth_login", requestId, userUuid: user.uuid });
  return createSessionToken(env, user.uuid, user.session_version);
}

/** Logging out revokes every session of the user, not only the current device. */
export async function logout(env: AppEnv, user: UserRow, requestId: string): Promise<void> {
  await bumpSessionVersion(env.DB, user);
  structuredLog("info", { event: "auth_logout", requestId, userUuid: user.uuid });
}

export async function updateProfile(
  env: AppEnv,
  user: UserRow,
  input: ProfileUpdate,
  requestId: string
): Promise<UserDto> {
  const updated = await updateUserName(env.DB, user, input.name, input.version);
  if (updated === null) throw conflict();
  structuredLog("info", { event: "profile_updated", requestId, userUuid: user.uuid });
  return toUserDto(updated);
}

/**
 * Changing the password revokes the sessions of every other device. The caller
 * receives a fresh token so the current session survives.
 */
export async function changePassword(
  env: AppEnv,
  user: UserRow,
  input: PasswordChange,
  requestId: string
): Promise<string> {
  if (!(await verifyPassword(input.currentPassword, user.password_hash))) {
    structuredLog("warn", { event: "password_change_failed", requestId, userUuid: user.uuid });
    throw unauthorized("CURRENT_PASSWORD_INVALID");
  }
  const updated = await updateUserPassword(env.DB, user, await hashPassword(input.newPassword));
  if (updated === null) throw conflict();
  structuredLog("info", { event: "password_changed", requestId, userUuid: user.uuid });
  return createSessionToken(env, updated.uuid, updated.session_version);
}
