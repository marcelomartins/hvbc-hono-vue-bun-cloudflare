<template>
  <header class="site-header shell">
    <nav class="site-nav" aria-label="Main navigation">
      <RouterLink class="brand" to="/"><span class="brand-mark" aria-hidden="true" />HVBC</RouterLink>
      <RouterLink class="site-link" to="/pricing">Pricing</RouterLink>
      <RouterLink class="site-link" to="/contact">Contact</RouterLink>
    </nav>

    <div class="site-actions">
      <RouterLink class="button secondary" to="/login">Sign in</RouterLink>
      <RouterLink class="button primary" to="/register">Create account</RouterLink>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 0;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 24px;
}

.site-link {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.site-link:hover {
  color: var(--text);
}

.site-actions {
  display: flex;
  gap: 8px;
}
</style>
