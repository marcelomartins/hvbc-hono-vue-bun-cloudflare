import type { Database } from "../runtime/types";
import { nowIso } from "../shared/dates";
import { uuidV7 } from "../shared/uuid";

export interface UserRow {
  id: number;
  uuid: string;
  name: string;
  email: string;
  normalized_email: string;
  password_hash: string;
  session_version: number;
  version: number;
  created_at: string;
}

const USER_COLUMNS = `id, uuid, name, email, normalized_email, password_hash,
    session_version, version, created_at`;

const USER_SELECT = `
  SELECT ${USER_COLUMNS}
  FROM users`;

export function findUserByEmail(database: Database, normalizedEmail: string): Promise<UserRow | null> {
  return database
    .prepare(`${USER_SELECT} WHERE normalized_email = ? LIMIT 1`)
    .bind(normalizedEmail)
    .first<UserRow>();
}

export function findUserByUuid(database: Database, uuid: string): Promise<UserRow | null> {
  return database
    .prepare(`${USER_SELECT} WHERE uuid = ? LIMIT 1`)
    .bind(uuid)
    .first<UserRow>();
}

/** Returns null when the normalized email is already registered. */
export function createUser(
  database: Database,
  input: { name: string; email: string; normalizedEmail: string; passwordHash: string }
): Promise<UserRow | null> {
  const timestamp = nowIso();
  return database
    .prepare(
      `INSERT INTO users (
         uuid, name, email, normalized_email, password_hash,
         session_version, version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
       ON CONFLICT (normalized_email) DO NOTHING
       RETURNING ${USER_COLUMNS}`
    )
    .bind(uuidV7(), input.name, input.email, input.normalizedEmail, input.passwordHash, timestamp, timestamp)
    .first<UserRow>();
}

/** Invalidates every session token already issued for the user. */
export async function bumpSessionVersion(database: Database, user: UserRow): Promise<void> {
  await database
    .prepare(
      `UPDATE users SET session_version = session_version + 1, updated_at = ?
       WHERE id = ?`
    )
    .bind(nowIso(), user.id)
    .run();
}

/** Returns null when another write changed the user after it was read. */
export function updateUserName(
  database: Database,
  user: UserRow,
  name: string
): Promise<UserRow | null> {
  return database
    .prepare(
      `UPDATE users SET name = ?, version = version + 1, updated_at = ?
       WHERE id = ? AND version = ?
       RETURNING ${USER_COLUMNS}`
    )
    .bind(name, nowIso(), user.id, user.version)
    .first<UserRow>();
}

/**
 * Conditioned on the password hash instead of the row version, so a concurrent
 * profile update can neither cancel nor block a password change. Returns null
 * when another password change won the race.
 */
export function updateUserPassword(
  database: Database,
  user: UserRow,
  passwordHash: string
): Promise<UserRow | null> {
  return database
    .prepare(
      `UPDATE users SET password_hash = ?,
         session_version = session_version + 1,
         version = version + 1, updated_at = ?
       WHERE id = ? AND password_hash = ?
       RETURNING ${USER_COLUMNS}`
    )
    .bind(passwordHash, nowIso(), user.id, user.password_hash)
    .first<UserRow>();
}
