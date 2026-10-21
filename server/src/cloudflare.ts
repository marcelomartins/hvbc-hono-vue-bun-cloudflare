import { createApp } from "./app";
import type { RuntimeEnv, RuntimeSecrets } from "./config";

const app = createApp({
  clientIp: (request) => request.headers.get("cf-connecting-ip")
});

// Wrangler generates Env from wrangler.jsonc, so requiring it to satisfy the
// configuration the app reads turns a renamed or removed binding into a compile error.
function runtimeEnv(env: Env & RuntimeSecrets): RuntimeEnv {
  return env;
}

export default {
  fetch(request, env, context) {
    return app.fetch(request, runtimeEnv(env), context);
  }
} satisfies ExportedHandler<Env & RuntimeSecrets>;
