<script setup lang="ts">
import { useHead } from "@unhead/vue";

useHead({
  htmlAttrs: { lang: "en" },
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1.0" }]
});
</script>

<template>
  <RouterView />
</template>
