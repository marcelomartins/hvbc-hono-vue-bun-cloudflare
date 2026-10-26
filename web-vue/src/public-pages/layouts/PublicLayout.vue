<template>
  <div class="public-shell">
    <SiteHeader />
    <main class="shell">
      <RouterView />
    </main>
    <footer class="shell public-footer">
      <p>HVBC - Hono and Vue, on Bun or Cloudflare.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import SiteHeader from "../components/SiteHeader.vue";
</script>

<style scoped>
.public-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.public-shell > main {
  flex: 1;
}

.public-footer {
  margin-top: 64px;
  padding: 20px 0 28px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.public-footer p {
  margin: 0;
}
</style>
