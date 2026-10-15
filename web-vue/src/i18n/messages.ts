const messages: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "Your session has expired. Please sign in again.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  EMAIL_ALREADY_REGISTERED: "This email is already registered.",
  CONFLICT: "Your account was changed by another request. Reload the page and try again.",
  CURRENT_PASSWORD_INVALID: "The current password is incorrect.",
  TURNSTILE_FAILED: "We could not confirm that you are not a robot. Please try again.",
  RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  INVALID_REQUEST: "Check the information you entered and try again.",
  INVALID_JSON: "We could not send your data. Please try again.",
  JSON_REQUIRED: "We could not send your data. Please try again.",
  BODY_TOO_LARGE: "The data you sent exceeds the allowed limit.",
  NOT_FOUND: "The requested resource does not exist.",
  INVALID_HOST: "Invalid address for this application.",
  INVALID_ORIGIN: "The request was blocked for security reasons. Please reload the page.",
  INVALID_RESPONSE: "The server returned an unexpected response. Please try again.",
  UNEXPECTED_RESPONSE: "The server returned an unexpected response. Please try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again in a moment."
};

export function errorMessage(code: string, requestId?: string | null): string {
  const message = messages[code];
  if (message !== undefined) return message;
  if (requestId !== undefined && requestId !== null) {
    return `Something went wrong. Please give support the code ${requestId}.`;
  }
  return messages.INTERNAL_ERROR ?? "Something went wrong.";
}
