<script setup lang="ts">
import type { UserDto } from "@hvbc/contracts/api";
import { onMounted, ref } from "vue";
import { apiFetch } from "../../api/client";
import { ApiError } from "../../api/errors";
import { errorMessage } from "../../i18n/messages";
import { provideCurrentUser } from "../../shared/user";

const { user, setUser } = provideCurrentUser();
const feedback = ref("");
const signingOut = ref(false);

async function logout(): Promise<void> {
  if (signingOut.value) return;
  signingOut.value = true;
  feedback.value = "";
  try {
    await apiFetch<void>("/auth/logout", { method: "POST", authenticated: false });
  } catch (error) {
    // A 401 means the session is already gone, which is what signing out wants.
    if (!(error instanceof ApiError && error.status === 401)) {
      feedback.value =
        error instanceof ApiError
          ? errorMessage(error.code, error.requestId)
          : errorMessage("INTERNAL_ERROR");
      signingOut.value = false;
      return;
    }
  }
  window.location.assign("/");
}

onMounted(async () => {
  try {
    setUser(await apiFetch<UserDto>("/api/v1/me"));
  } catch (error) {
    feedback.value =
      error instanceof ApiError
        ? errorMessage(error.code, error.requestId)
        : errorMessage("INTERNAL_ERROR");
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="shell topbar-content">
        <RouterLink class="brand" to="/dashboard">HVBC</RouterLink>
        <div class="topbar-user">
          <span>{{ user?.name ?? "Loading…" }}</span>
          <button class="text-button" type="button" :disabled="signingOut" @click="logout">
            {{ signingOut ? "Signing out…" : "Sign out" }}
          </button>
        </div>
      </div>
    </header>

    <nav class="app-nav" aria-label="Main navigation">
      <div class="shell">
        <RouterLink to="/dashboard">Overview</RouterLink>
        <RouterLink to="/account">Account</RouterLink>
        <RouterLink to="/settings">Settings</RouterLink>
      </div>
    </nav>

    <p v-if="feedback" class="shell form-error" role="alert">{{ feedback }}</p>

    <main class="shell app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topbar {
  border-bottom: 1px solid var(--border);
  background: var(--surface-strong);
}

.topbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 0;
}

.brand {
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.topbar-user {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--text-soft);
}

.app-nav > div {
  display: flex;
  gap: 18px;
  padding: 14px 0;
  color: var(--text-soft);
}

.app-nav a.router-link-active {
  color: var(--accent-strong);
  font-weight: 600;
}

.app-main {
  flex: 1;
  padding: 24px 0 48px;
}
</style>
