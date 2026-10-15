<script setup lang="ts">
import type { UserDto } from "@hvbc/contracts/api";
import { ref, watchEffect } from "vue";
import { apiFetch } from "../../api/client";
import { ApiError } from "../../api/errors";
import { errorMessage } from "../../i18n/messages";
import { useCurrentUser } from "../../shared/user";

const { user, setUser } = useCurrentUser();
const name = ref("");
const feedback = ref("");
const success = ref(false);
const pending = ref(false);

watchEffect(() => {
  if (user.value !== null && name.value === "") name.value = user.value.name;
});

async function submit(): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  feedback.value = "";
  success.value = false;
  try {
    setUser(await apiFetch<UserDto>("/api/v1/me", { method: "PUT", body: { name: name.value } }));
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
  <section class="page card">
    <h1 class="section-title">Account</h1>
    <p class="section-copy">Data for the authenticated account, returned by <code>/api/v1/me</code>.</p>

    <dl v-if="user" class="account-data">
      <div><dt>Email</dt><dd>{{ user.email }}</dd></div>
      <div><dt>Identifier</dt><dd><code>{{ user.uuid }}</code></dd></div>
      <div><dt>Created at</dt><dd>{{ new Date(user.createdAt).toLocaleString() }}</dd></div>
    </dl>

    <form class="account-form" @submit.prevent="submit">
      <label class="field">
        <span>Name</span>
        <input v-model="name" type="text" name="name" required minlength="2" maxlength="120" />
      </label>

      <p v-if="feedback" class="form-error" role="alert">{{ feedback }}</p>
      <p v-else-if="success" class="form-success" role="status">Name updated.</p>

      <button class="button primary" type="submit" :disabled="pending">
        {{ pending ? "Saving…" : "Save" }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: clamp(28px, 6vw, 48px);
}

.account-data {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.account-data div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.account-data dt {
  min-width: 120px;
  color: var(--text-soft);
}

.account-data dd {
  margin: 0;
}

.account-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 420px;
  align-items: flex-start;
}

.account-form .field {
  width: 100%;
}
</style>
