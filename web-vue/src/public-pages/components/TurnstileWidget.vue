<script setup lang="ts">
import type { AuthConfigDto } from "@hvbc/contracts/api";
import { onMounted, ref, useTemplateRef } from "vue";
import { apiFetch } from "../../api/client";

const props = defineProps<{ action: string }>();
const emit = defineEmits<{ token: [string | null] }>();

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const container = useTemplateRef<HTMLDivElement>("container");
const enabled = ref(false);
let widgetId: string | null = null;

function loadScript(): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
  if (existing !== null) {
    return window.turnstile === undefined
      ? new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("turnstile script failed")));
        })
      : Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("turnstile script failed")));
    document.head.append(script);
  });
}

/** Called by the parent form so a rejected submission can request a new token. */
function reset(): void {
  if (widgetId !== null && window.turnstile !== undefined) {
    window.turnstile.reset(widgetId);
    emit("token", null);
  }
}

defineExpose({ reset });

onMounted(async () => {
  const config = await apiFetch<AuthConfigDto>("/auth/config", { authenticated: false });
  if (config.turnstileSiteKey === null) return;
  enabled.value = true;
  await loadScript();
  if (window.turnstile === undefined || container.value === null) return;
  widgetId = window.turnstile.render(container.value, {
    sitekey: config.turnstileSiteKey,
    action: props.action,
    callback: (token) => emit("token", token),
    "expired-callback": () => emit("token", null),
    "error-callback": () => emit("token", null)
  });
});
</script>

<template>
  <div v-show="enabled" ref="container" class="turnstile-widget" />
</template>

<style scoped>
.turnstile-widget {
  min-height: 65px;
}
</style>
