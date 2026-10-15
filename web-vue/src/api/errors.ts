import type { ApiErrorBody } from "@hvbc/contracts/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null = null,
    readonly details: Record<string, string[]> | null = null
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = value.error;
  return typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && "requestId" in error && typeof error.requestId === "string";
}
