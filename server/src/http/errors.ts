import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    readonly details?: Record<string, string[]>
  ) {
    super(code);
    this.name = "AppError";
  }
}

export function badRequest(code = "INVALID_REQUEST", details?: Record<string, string[]>): AppError {
  return details === undefined ? new AppError(400, code) : new AppError(400, code, details);
}

export function unauthorized(code = "AUTHENTICATION_REQUIRED"): AppError {
  return new AppError(401, code);
}

export function forbidden(code = "FORBIDDEN"): AppError {
  return new AppError(403, code);
}

export function conflict(code = "CONFLICT"): AppError {
  return new AppError(409, code);
}

export function bodyTooLarge(): AppError {
  return new AppError(413, "BODY_TOO_LARGE");
}
