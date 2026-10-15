// The subset of D1 the app uses, so the Bun target can provide it over SQLite.
export type BindValue = string | number | null;

export interface PreparedStatement {
  bind(...values: BindValue[]): PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface Database {
  prepare(sql: string): PreparedStatement;
}

/** The API of the Cloudflare Rate Limiting binding, which another runtime may implement. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

/** What differs between the runtimes that host the app. */
export interface RuntimeHooks {
  clientIp(request: Request): string | null;
}
