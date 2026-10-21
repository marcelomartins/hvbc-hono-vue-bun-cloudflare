<script setup lang="ts">
import { PROTECTED_HOME_ROUTE, returnPathFromQuery } from "@hvbc/contracts/routes";
import { ref, useTemplateRef } from "vue";
import { apiFetch } from "../api/client";
import { authErrorText, navigate } from "./auth-feedback";
import TurnstileWidget from "./components/TurnstileWidget.vue";
import { usePublicHead } from "./head";

usePublicHead({
  title: "Sign in — HVBC",
  description: "Sign in to your HVBC account."
});

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
    await apiFetch<void>("/auth/login", {
      body: {
        email: email.value,
        password: password.value,
        ...(turnstileToken.value === null ? {} : { turnstileToken: turnstileToken.value })
      },
      authenticated: false
    });
    navigate(returnPathFromQuery(window.location.search, PROTECTED_HOME_ROUTE));
  } catch (error) {
    feedback.value = authErrorText(error);
    turnstile.value?.reset();
    pending.value = false;
  }
}
</script>

<template>
  <section class="auth-card card">
    <h1 class="title">Sign in</h1>
    <p class="lead">Access the protected area with your account.</p>

    <form class="form" @submit.prevent="submit">
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
          autocomplete="current-password"
          required
        />
      </label>

      <TurnstileWidget ref="turnstile" action="login" @token="turnstileToken = $event" />

      <p v-if="feedback" class="form-error" role="alert">{{ feedback }}</p>

      <button class="button primary" type="submit" :disabled="pending">
        {{ pending ? "Signing in…" : "Sign in" }}
      </button>
    </form>

    <p class="auth-switch">
      Don't have an account yet?
      <RouterLink to="/register">Create account</RouterLink>
    </p>
  </section>
</template>
