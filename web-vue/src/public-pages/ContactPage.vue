<script setup lang="ts">
import { usePublicHead } from "./head";

usePublicHead({
  title: "Contact - HVBC",
  description: "Example contact page of HVBC, prerendered at build time."
});
</script>

<template>
  <section class="page">
    <h1 class="display">Contact</h1>
    <p class="lead">
      Example public page, prerendered with SSG. Replace this content with your product's
      contact channels.
    </p>
  </section>
</template>
