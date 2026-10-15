<template>
  <div class="public-shell">
    <SiteHeader />
    <main class="shell">
      <RouterView />
    </main>
    <footer class="shell public-footer">
      <p>HVBC — Bun, Hono, Vue, and Cloudflare.</p>
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
  gap: 24px;
}

.public-shell > main {
  flex: 1;
}

.public-footer {
  padding: 24px 0 32px;
  color: var(--text-soft);
  font-size: 0.9rem;
}
</style>
