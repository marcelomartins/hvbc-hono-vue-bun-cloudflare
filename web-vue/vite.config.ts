import { fileURLToPath, URL } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

import { appOrigin } from "./scripts/app-origin.ts";
import { forbiddenDependencyChunk } from "./scripts/forbidden-dependencies.ts";
import { removeDuplicateAssetTags } from "./scripts/head-assets.ts";

const rootWranglerPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
const rootStatePath = fileURLToPath(new URL("../.wrangler/state", import.meta.url));

export default defineConfig(({ command, isPreview, isSsrBuild }) => {
  const unifiedCloudflareDev = command === "serve" && isPreview !== true;
  return {
    plugins: [
      ...(unifiedCloudflareDev
        ? [
            cloudflare({
              configPath: rootWranglerPath,
              persistState: { path: rootStatePath },
              config: {
                assets: {
                  // Public SSG files do not exist during development, so let
                  // Vue Router render them through the regular Vite index.
                  not_found_handling: "single-page-application"
                }
              }
            })
          ]
        : []),
      vue()
    ],
    define: { "import.meta.env.APP_ORIGIN": JSON.stringify(appOrigin(rootWranglerPath)) },
    publicDir: fileURLToPath(new URL("./static", import.meta.url)),
    build: {
      outDir: fileURLToPath(new URL("../dist/web-vue", import.meta.url)),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          "index-spa": fileURLToPath(new URL("./index-spa.html", import.meta.url))
        },
        ...(isSsrBuild === true ? {} : { output: { manualChunks: forbiddenDependencyChunk } })
      }
    },
    ssgOptions: {
      // vite-ssg appends preload links without checking the tags Vite already
      // emitted: its duplicate lookup reads attrs.file instead of attrs.href.
      onPageRendered: (_route: string, html: string) => removeDuplicateAssetTags(html)
    }
  };
});
