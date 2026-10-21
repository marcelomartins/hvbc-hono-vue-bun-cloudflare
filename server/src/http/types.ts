import type { AuthenticatedUser } from "../auth/middleware";
import type { AppEnv } from "../config";

interface AppVariables {
  requestId: string;
  clientIp: string | null;
  authenticated: AuthenticatedUser;
}

export interface AppBindings {
  Bindings: AppEnv;
  Variables: AppVariables;
}
