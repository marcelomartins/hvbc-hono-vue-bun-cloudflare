<script setup lang="ts">
import { usePublicHead } from "./head";

usePublicHead({
  title: "Pricing - HVBC",
  description: "Example pricing page of HVBC, prerendered at build time."
});
</script>

<template>
  <section class="page">
    <h1 class="display">Pricing</h1>
    <p class="lead">
      Example public page, prerendered with SSG. Replace this content with your product's
      pricing.
    </p>
  </section>
</template>
