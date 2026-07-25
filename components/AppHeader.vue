<!-- components/AppHeader.vue
     Header dùng chung cho mọi trang (map + equipment detail), render qua layouts/default.vue.
     Trước đây markup này nằm cứng trong pages/index.vue -> equipment-[id].vue không có
     header/nav nào, người dùng vào thẳng trang thiết bị sẽ bị "kẹt" không lối ra.
     - Cụm phải hiện nav thật (NuxtLink, có active-state) thay vì chỉ có logo.
     - `status`/`status-label` cho phép trang con (map) bơm trạng thái HUD riêng vào
       header mà không cần header biết gì về Pinia/HologramMap.
-->
<template>
  <header class="app-header">
    <div class="header-content">
      <NuxtLink to="/" class="header-brand" aria-label="Về trang bản đồ">
        <img src="/VGU-Logo.png" class="header-logo" alt="Logo VGU" />
        <h1 class="header-title">
          <span class="title-accent">VGU</span> MAP
        </h1>
      </NuxtLink>
    </div>

    <nav class="header-nav" aria-label="Điều hướng chính">
      <NuxtLink to="/" class="nav-link" exact-active-class="nav-link--active">
        Bản đồ
      </NuxtLink>
      <!-- "Danh mục thiết bị" (All Instruments): chưa có trang liệt kê thiết bị trong
           codebase hiện tại (chỉ có /equipment-[id] chi tiết, truy cập qua search/room).
           Để disabled + title giải thích, tránh route chết, chờ xác nhận có cần build không. -->
      <span class="nav-link nav-link--disabled" title="Chưa có trang danh mục thiết bị — cần xác nhận trước khi build">
        Thiết bị
      </span>
    </nav>

    <div class="header-status" v-if="statusLabel" role="status" aria-live="polite">
      <span class="pulse-dot" aria-hidden="true"></span>
      <span>{{ statusLabel }}</span>
    </div>
  </header>
</template>

<script setup>
defineProps({
  statusLabel: { type: String, default: '' }
})
</script>

<style scoped>
.app-header {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 30; /* Trên map/floor-bar (20/60), dưới search bar (70) và panel (90/100) */
  height: var(--header-h, 64px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px;
  background: linear-gradient(180deg, rgba(5, 10, 15, 0.9) 0%, rgba(5, 10, 15, 0.4) 70%, rgba(5, 10, 15, 0) 100%);
  pointer-events: none; /* nền không chặn click vào map bên dưới... */
}
/* ...nhưng mọi phần tử tương tác bên trong header phải nhận lại pointer-events */
.header-brand,
.header-nav,
.header-status { pointer-events: auto; }

.header-content { display: flex; align-items: center; gap: 14px; }
.header-brand {
  display: flex; align-items: center; gap: 14px;
  text-decoration: none;
  border-radius: 6px;
}
.header-brand:focus-visible { outline: 2px solid #00ffcc; outline-offset: 4px; }
.header-logo { height: 36px; width: auto; filter: drop-shadow(0 0 6px rgba(0, 255, 204, 0.4)); }
.header-title {
  font-family: 'Be Vietnam Pro', sans-serif;
  font-size: 18px; font-weight: 600; color: #fff; letter-spacing: 0.5px; margin: 0;
}
.title-accent { color: #EF5A24; }

.header-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  margin-left: 32px;
}
.nav-link {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: #B3BFCD;
  text-decoration: none;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.nav-link:hover { color: #fff; border-color: rgba(239, 90, 36, 0.4); }
.nav-link--active {
  color: #fff;
  border-color: rgba(0, 255, 204, 0.4);
  background: rgba(0, 255, 204, 0.08);
}
.nav-link--disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.nav-link--disabled:hover { color: #B3BFCD; border-color: transparent; }

.header-status {
  display: flex; align-items: center; gap: 8px;
  font-family: 'Space Mono', monospace;
  font-size: 11px; letter-spacing: 1px; color: #00ffcc;
  white-space: nowrap;
}
.pulse-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #00ffcc; box-shadow: 0 0 8px #00ffcc;
  animation: pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
@media (prefers-reduced-motion: reduce) {
  .pulse-dot { animation: none; }
}

@media (max-width: 640px) {
  .app-header { padding: 0 14px; height: var(--header-h-mobile, 54px); }
  .header-title { font-size: 15px; }
  .header-nav { margin-left: 16px; gap: 2px; }
  .nav-link { padding: 5px 8px; font-size: 11px; }
  .header-status span:last-child { display: none; } /* chỉ giữ pulse-dot trên mobile, tiết kiệm chỗ */
}
</style>
