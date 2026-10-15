<script setup lang="ts">
import { useCurrentUser } from "../../shared/user";

const { user } = useCurrentUser();
</script>

<template>
  <section class="page card">
    <p class="pill">Protected area</p>
    <h1 class="section-title">Overview</h1>
    <p class="section-copy">
      This route is only served after the Worker validates the session. Replace this content
      with your product's dashboard.
    </p>
    <p v-if="user" class="section-copy">
      Active session for <strong>{{ user.name }}</strong> ({{ user.email }}).
    </p>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding: clamp(28px, 6vw, 48px);
}
</style>
