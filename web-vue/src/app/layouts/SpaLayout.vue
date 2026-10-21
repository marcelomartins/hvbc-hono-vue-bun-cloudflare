<script setup lang="ts">
import type { UserDto } from "@hvbc/contracts/api";
import { computed, onMounted, ref } from "vue";
import { apiFetch } from "../../api/client";
import { ApiError } from "../../api/errors";
import { errorMessage } from "../../i18n/messages";
import { provideCurrentUser } from "../../shared/user";

const { user, setUser } = provideCurrentUser();
const feedback = ref("");
const signingOut = ref(false);

const initials = computed(() => {
  const words = user.value?.name.trim().split(/\s+/u) ?? [];
  const letters = words.length > 1 ? [words[0], words.at(-1)] : words;
  return letters.map((word) => word?.charAt(0) ?? "").join("").toUpperCase();
});

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
    <aside class="sidebar">
      <RouterLink class="brand sidebar-brand" :to="{ name: 'overview' }">
        <span class="brand-mark" aria-hidden="true" />HVBC
      </RouterLink>

      <nav class="sidebar-nav" aria-label="Main navigation">
        <p class="sidebar-label">Workspace</p>
        <RouterLink class="nav-item" exact-active-class="active" :to="{ name: 'overview' }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
          Overview
        </RouterLink>
        <RouterLink class="nav-item" exact-active-class="active" :to="{ name: 'account' }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></svg>
          Account
        </RouterLink>
        <RouterLink class="nav-item" exact-active-class="active" :to="{ name: 'settings' }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2" /><circle cx="14" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></svg>
          Settings
        </RouterLink>
      </nav>

      <div class="sidebar-user">
        <span class="avatar" aria-hidden="true">{{ initials }}</span>
        <div class="sidebar-user-text">
          <span class="sidebar-user-name">{{ user?.name ?? "Loading…" }}</span>
          <button class="text-button" type="button" :disabled="signingOut" @click="logout">
            {{ signingOut ? "Signing out…" : "Sign out" }}
          </button>
        </div>
      </div>
    </aside>

    <main class="app-main">
      <p v-if="feedback" class="form-error" role="alert">{{ feedback }}</p>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100vh;
  padding: 20px 12px;
  border-right: 1px solid var(--border);
  background: var(--surface);
}

.sidebar-brand {
  padding: 0 8px 8px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-label {
  margin: 12px 8px 6px;
  color: var(--text-muted);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.nav-item:hover {
  color: var(--text);
}

.nav-item.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 500;
  box-shadow: 0 0 0 1px var(--border);
}

.nav-item svg {
  width: 16px;
  height: 16px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding: 8px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 50%;
  background: var(--border);
  font-size: 0.75rem;
  font-weight: 500;
}

.sidebar-user-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  font-size: 0.8125rem;
  line-height: 1.35;
}

.sidebar-user-name {
  max-width: 100%;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: clamp(24px, 4vw, 40px);
}

@media (max-width: 720px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }

  .sidebar {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    height: auto;
    padding: 12px 16px;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-brand {
    padding: 0;
  }

  .sidebar-nav {
    flex-direction: row;
    order: 3;
    width: 100%;
  }

  .sidebar-label {
    display: none;
  }

  .sidebar-user {
    margin: 0 0 0 auto;
    padding: 0;
  }
}
</style>
