<script setup lang="ts">
import { usePublicHead } from "./head";

usePublicHead({
  title: "Contact — HVBC",
  description: "Example contact page of HVBC, prerendered at build time."
});
</script>

<template>
  <section class="page card">
    <h1 class="section-title">Contact</h1>
    <p class="section-copy">
      Example public page, prerendered with SSG. Replace this content with your product's
      contact channels.
    </p>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: clamp(28px, 6vw, 64px);
  margin-top: 12px;
}
</style>
