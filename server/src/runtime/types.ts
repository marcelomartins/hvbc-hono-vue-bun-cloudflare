// The subset of D1 that repositories may use, so the Bun target can provide it over
// SQLite. A method added here needs a matching one in runtime/bun/database.ts.
export type BindValue = string | number | null;

export interface PreparedStatement {
  bind(...values: BindValue[]): PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface Database {
  prepare(sql: string): PreparedStatement;
}

/** The API of the Cloudflare Rate Limiting binding, which another runtime may implement. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** The part of the Cloudflare send_email binding the email layer uses. */
export interface EmailBinding {
  send(message: {
    to: string;
    from: string | { email: string; name: string };
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

/** What differs between the runtimes that host the app. */
export interface RuntimeHooks {
  clientIp(request: Request): string | null;
}
