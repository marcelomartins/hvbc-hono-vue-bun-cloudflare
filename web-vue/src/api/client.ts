import { loginPath } from "@hvbc/contracts/routes";

import { ApiError, isApiErrorBody } from "./errors";

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  authenticated?: boolean;
}

function isJson(contentType: string | null): boolean {
  return contentType?.toLowerCase().split(";", 1)[0]?.trim() === "application/json";
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  if (!isJson(response.headers.get("content-type"))) throw new ApiError(response.status, "INVALID_RESPONSE");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(response.status, "INVALID_RESPONSE");
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const request: RequestInit = {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    credentials: "same-origin"
  };
  if (options.body !== undefined) {
    request.headers = { "content-type": "application/json" };
    request.body = JSON.stringify(options.body);
  }
  if (options.signal !== undefined) request.signal = options.signal;
  const response = await fetch(path, request);
  const body = await readBody(response);
  if (!response.ok) {
    if (response.status === 401 && options.authenticated !== false && typeof window !== "undefined") {
      window.location.assign(loginPath(`${window.location.pathname}${window.location.search}`));
    }
    if (isApiErrorBody(body)) {
      throw new ApiError(response.status, body.error.code, body.error.requestId, body.error.details ?? null);
    }
    throw new ApiError(response.status, "UNEXPECTED_RESPONSE");
  }
  return body as T;
}
