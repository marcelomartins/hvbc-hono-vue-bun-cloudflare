import { ApiError } from "../api/errors";
import { errorMessage } from "../i18n/messages";

export function authErrorText(error: unknown): string {
  if (error instanceof ApiError) return errorMessage(error.code, error.requestId);
  return errorMessage("INTERNAL_ERROR");
}

export function navigate(path: string): void {
  if (typeof window !== "undefined") window.location.assign(path);
}
