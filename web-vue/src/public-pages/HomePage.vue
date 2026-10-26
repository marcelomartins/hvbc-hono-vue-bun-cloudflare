<script setup lang="ts">
import { usePublicHead } from "./head";

usePublicHead({
  title: "HVBC",
  description:
    "HVBC: Hono + Vue to build, Bun or Cloudflare to run. A full-stack TypeScript framework with auth, SSG, and an API in one app."
});
</script>

<template>
  <section class="hero">
    <p class="eyebrow">Full-stack TypeScript framework</p>
    <h1 class="display">
      Build your product,<br />
      <span class="display-muted">not the plumbing.</span>
    </h1>
    <p class="lead">
      Prerendered public pages, a protected app area, and TypeScript contracts shared between
      frontend and backend from day one.
    </p>
    <div class="hero-actions">
      <RouterLink class="button primary" to="/register">Get started</RouterLink>
      <RouterLink class="button secondary" to="/login">Sign in</RouterLink>
    </div>
  </section>

  <section class="features" aria-label="Features">
    <div class="feature">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7z" /></svg>
      <h2>Prerendered pages</h2>
      <p>Public pages are built ahead of time and served as static files.</p>
    </div>
    <div class="feature">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
      <h2>Protected app</h2>
      <p>The server checks the session before the app is served.</p>
    </div>
    <div class="feature">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" /></svg>
      <h2>Shared contracts</h2>
      <p>One route registry and one set of API types for client and server.</p>
    </div>
  </section>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: clamp(40px, 8vw, 96px) 0 clamp(48px, 8vw, 88px);
}

.display-muted {
  color: var(--text-muted);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  border-top: 1px solid var(--border);
}

.feature {
  padding: 24px 24px 8px 0;
}

.feature svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.feature h2 {
  margin: 12px 0 4px;
  font-size: 0.9375rem;
  font-weight: 600;
}

.feature p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
