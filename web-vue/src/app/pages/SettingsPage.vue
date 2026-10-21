<script setup lang="ts">
import { ref } from "vue";
import { apiFetch } from "../../api/client";
import { ApiError } from "../../api/errors";
import { errorMessage } from "../../i18n/messages";

const currentPassword = ref("");
const newPassword = ref("");
const feedback = ref("");
const success = ref(false);
const pending = ref(false);

async function submit(): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  feedback.value = "";
  success.value = false;
  try {
    await apiFetch<void>("/api/v1/me/password", {
      method: "PUT",
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value }
    });
    currentPassword.value = "";
    newPassword.value = "";
    success.value = true;
  } catch (error) {
    feedback.value =
      error instanceof ApiError
        ? errorMessage(error.code, error.requestId)
        : errorMessage("INTERNAL_ERROR");
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <section class="app-page">
    <header class="page-header">
      <p class="kicker">Workspace</p>
      <h1 class="title">Settings</h1>
      <p class="lead">
        Changing your password ends the sessions open on other devices. This session stays active.
      </p>
    </header>

    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span>Current password</span>
        <input
          v-model="currentPassword"
          type="password"
          name="currentPassword"
          autocomplete="current-password"
          required
        />
      </label>

      <label class="field">
        <span>New password</span>
        <input
          v-model="newPassword"
          type="password"
          name="newPassword"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>

      <p v-if="feedback" class="form-error" role="alert">{{ feedback }}</p>
      <p v-else-if="success" class="form-success" role="status">Password changed.</p>

      <button class="button primary" type="submit" :disabled="pending">
        {{ pending ? "Changing…" : "Change password" }}
      </button>
    </form>
  </section>
</template>
