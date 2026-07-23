<style scoped>
.floor-layout {
  background: var(--surface-root);
  color: var(--ink-strong);
  font-family: var(--type-main);
}

.floor-tab.is-active {
  background: var(--brand-accent);
  color: var(--ink-strong);
}

.floor-card {
  background: var(--surface-panel);
  border: 1px solid var(--line-soft);
}

.floor-card:hover,
.floor-card.is-selected {
  border-color: var(--brand-accent);
  box-shadow: 0 0 0 1px rgba(245, 130, 32, 0.40);
}

.floor-crumb {
  color: var(--ink-soft);
}

.room-badge--ok {
  background: rgba(0, 179, 136, 0.15);
  color: #00B388;
}

.room-badge--warn {
  background: rgba(245, 130, 32, 0.14);
  color: var(--brand-accent);
}
</style>