<script setup lang="ts">
import { usePublicHead } from "./head";

usePublicHead({
  title: "HVBC",
  description:
    "Full-stack starter with Bun, Hono, Vue, and Cloudflare: prerendered public pages and a SPA protected by the Worker."
});
</script>

<template>
  <section class="hero card">
    <p class="pill">HVBC framework</p>
    <h1 class="section-title">A simple starter kit with Bun, Hono, Vue, and Cloudflare.</h1>
    <p class="section-copy">
      Public pages prerendered with SSG, protected routes served by the Worker after
      authentication, and TypeScript contracts shared between frontend and backend.
    </p>
    <div class="hero-actions">
      <RouterLink class="button primary" to="/register">Create an account</RouterLink>
      <RouterLink class="button ghost" to="/login">I already have an account</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
  padding: clamp(28px, 6vw, 64px);
  margin-top: 12px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
