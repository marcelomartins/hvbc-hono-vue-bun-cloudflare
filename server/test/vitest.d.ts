import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare module "vitest" {
  export interface ProvidedContext {
    d1Migrations: D1Migration[];
  }
}
