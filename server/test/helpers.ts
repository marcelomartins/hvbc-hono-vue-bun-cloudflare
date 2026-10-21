import { SELF } from "cloudflare:test";

export const TEST_PASSWORD = "correct horse battery staple";

export async function apiRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
  } = {}
): Promise<Response> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers = new Headers();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    headers.set("origin", "http://localhost");
  }
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie !== undefined) headers.set("cookie", options.cookie);
  return SELF.fetch(`http://localhost${path}`, {
    method,
    headers,
    // Redirects are part of what the tests assert, so they must not be followed.
    redirect: "manual",
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
}

export function sessionCookie(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (header === null) throw new Error("session cookie was not set");
  return header.split(";", 1)[0] ?? "";
}

export async function registerUser(
  email: string,
  name = "Test User",
  password = TEST_PASSWORD
): Promise<{ cookie: string; user: Record<string, unknown> }> {
  const response = await apiRequest("/auth/register", { body: { name, email, password } });
  if (response.status !== 201) throw new Error(`registration failed: ${response.status}`);
  return { cookie: sessionCookie(response), user: await response.json<Record<string, unknown>>() };
}
