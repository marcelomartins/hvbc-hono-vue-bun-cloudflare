<script setup lang="ts">
import { PROTECTED_HOME_ROUTE } from "@hvbc/contracts/routes";
import { ref, useTemplateRef } from "vue";
import { apiFetch } from "../api/client";
import { authErrorText, navigate } from "./auth-feedback";
import TurnstileWidget from "./components/TurnstileWidget.vue";
import { usePublicHead } from "./head";

usePublicHead({
  title: "Create account — HVBC",
  description: "Create your HVBC account to access the protected area."
});

const name = ref("");
const email = ref("");
const password = ref("");
const feedback = ref("");
const pending = ref(false);
const turnstileToken = ref<string | null>(null);
const turnstile = useTemplateRef<InstanceType<typeof TurnstileWidget>>("turnstile");

async function submit(): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  feedback.value = "";
  try {
    await apiFetch("/auth/register", {
      body: {
        name: name.value,
        email: email.value,
        password: password.value,
        ...(turnstileToken.value === null ? {} : { turnstileToken: turnstileToken.value })
      },
      authenticated: false
    });
    navigate(PROTECTED_HOME_ROUTE);
  } catch (error) {
    feedback.value = authErrorText(error);
    turnstile.value?.reset();
    pending.value = false;
  }
}
</script>

<template>
  <section class="auth-card card">
    <h1 class="title">Create account</h1>
    <p class="lead">Sign up to access the protected area.</p>

    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span>Name</span>
        <input v-model="name" type="text" name="name" autocomplete="name" required minlength="2" />
      </label>

      <label class="field">
        <span>Email</span>
        <input v-model="email" type="email" name="email" autocomplete="email" required />
      </label>

      <label class="field">
        <span>Password</span>
        <input
          v-model="password"
          type="password"
          name="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </label>

      <TurnstileWidget ref="turnstile" action="register" @token="turnstileToken = $event" />

      <p v-if="feedback" class="form-error" role="alert">{{ feedback }}</p>

      <button class="button primary" type="submit" :disabled="pending">
        {{ pending ? "Creating account…" : "Create account" }}
      </button>
    </form>

    <p class="auth-switch">
      Already have an account?
      <RouterLink to="/login">Sign in</RouterLink>
    </p>
  </section>
</template>
