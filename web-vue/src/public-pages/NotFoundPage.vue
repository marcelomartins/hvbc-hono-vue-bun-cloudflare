<script setup lang="ts">
import { usePublicHead } from "./head";

usePublicHead({
  title: "Page not found — HVBC",
  description: "The page you requested does not exist or has moved.",
  indexable: false
});
</script>

<template>
  <section class="page">
    <p class="eyebrow">404</p>
    <h1 class="display">Page not found</h1>
    <p class="lead">The address you visited does not exist or has moved.</p>
    <RouterLink class="button primary" to="/">Back to home</RouterLink>
  </section>
</template>
