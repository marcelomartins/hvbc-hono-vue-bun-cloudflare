<script setup lang="ts">
import { useCurrentUser } from "../../shared/user";

const { user } = useCurrentUser();
</script>

<template>
  <section class="app-page">
    <header class="page-header">
      <p class="kicker">Workspace</p>
      <h1 class="title">Overview</h1>
      <p class="lead">
        This route is only served after the server validates the session. Replace this content
        with your product's home.
      </p>
    </header>

    <dl v-if="user" class="summary">
      <div class="card"><dt>Name</dt><dd>{{ user.name }}</dd></div>
      <div class="card"><dt>Email</dt><dd>{{ user.email }}</dd></div>
      <div class="card"><dt>Member since</dt><dd>{{ new Date(user.createdAt).toLocaleDateString() }}</dd></div>
    </dl>
  </section>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 0;
}

.summary .card {
  min-width: 0;
  padding: 14px 16px;
}

.summary dt {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.summary dd {
  margin: 4px 0 0;
  overflow: hidden;
  font-size: 1.0625rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
