<script setup lang="ts">
import { usePublicHead } from "./head";

usePublicHead({
  title: "Page not found — HVBC",
  description: "The page you requested does not exist or has moved.",
  indexable: false
});
</script>

<template>
  <section class="page card">
    <p class="pill">404</p>
    <h1 class="section-title">Page not found</h1>
    <p class="section-copy">The address you visited does not exist or has moved.</p>
    <RouterLink class="button primary" to="/">Back to home</RouterLink>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding: clamp(28px, 6vw, 64px);
  margin-top: 12px;
}
</style>
