import { z } from "zod";

import {
  PASSWORD_MAX_CODE_POINTS,
  PASSWORD_MIN_CODE_POINTS,
  PERSON_NAME_MAX_CODE_POINTS,
  PERSON_NAME_MIN_CODE_POINTS
} from "./limits";

const codePointLength = (value: string): number => Array.from(value).length;

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("und");
}

export const personNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z.string().refine(
      (value) =>
        codePointLength(value) >= PERSON_NAME_MIN_CODE_POINTS &&
        codePointLength(value) <= PERSON_NAME_MAX_CODE_POINTS,
      "name_length"
    )
  );

const emailAddress = z.email().min(3).max(254).refine(
  (value) => (value.split("@", 1)[0]?.length ?? 65) <= 64,
  "email_local_part"
);

/** The address as the user typed it, kept for display; never use it as a lookup key. */
export const emailSchema = z.string().transform((value) => value.trim()).pipe(emailAddress);

export const normalizedEmailSchema = z.string().transform(normalizeEmail).pipe(emailAddress);

const password = z.string().refine(
  (value) =>
    codePointLength(value) >= PASSWORD_MIN_CODE_POINTS &&
    codePointLength(value) <= PASSWORD_MAX_CODE_POINTS,
  "password_length"
);

export const existingPasswordSchema = z.string().refine(
  (value) => codePointLength(value) >= 1 && codePointLength(value) <= PASSWORD_MAX_CODE_POINTS,
  "password_length"
);

// Present only when Turnstile is enabled; the server decides whether it is required.
const turnstileToken = z.string().min(1).max(4096).optional();

export const registerSchema = z
  .object({
    name: personNameSchema,
    email: emailSchema,
    password,
    turnstileToken
  })
  .strict();

export const loginSchema = z
  .object({
    email: normalizedEmailSchema,
    password: existingPasswordSchema,
    turnstileToken
  })
  .strict();

// The version the client edited, so a save from a stale form is rejected.
export const profileUpdateSchema = z
  .object({ name: personNameSchema, version: z.number().int().positive() })
  .strict();

export const passwordChangeSchema = z
  .object({ currentPassword: existingPasswordSchema, newPassword: password })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "password_reuse"
  });

export type Register = z.output<typeof registerSchema>;
export type Login = z.output<typeof loginSchema>;
export type ProfileUpdate = z.output<typeof profileUpdateSchema>;
export type PasswordChange = z.output<typeof passwordChangeSchema>;
