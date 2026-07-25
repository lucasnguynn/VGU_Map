<template>
  <!-- Vỏ tối giản: chỉ điều phối route qua <NuxtPage/>, bọc trong <NuxtLayout/> để
       mọi trang (map + equipment-[id]) đều đi qua layouts/default.vue -> có Header
       nhất quán. Trước đây pages/index.vue tự vẽ header riêng, còn equipment-[id]
       không có header/nav nào -> người dùng vào trang thiết bị bị "kẹt". -->
  <div class="app-root">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
// Không cần logic ở đây nữa — state dùng chung nằm ở Pinia store,
// dữ liệu nằm ở composable/Content. Giữ vỏ này thật mỏng.
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

:root {
  --brand-accent: #F58220;
  --brand-accent-soft: #F7A14C;
  --brand-accent-muted: #FAC08F;

  --brand-deep: #002554;
  --brand-deep-2: #001A3A;
  --brand-deep-3: #002040;
  --brand-deep-4: #002D5C;

  --ink-strong: #FFFFFF;
  --ink-soft: #B3BFCD;
  --ink-dim: #6B7FA0;

  --line-soft: rgba(255, 255, 255, 0.10);
  --line-accent: rgba(245, 130, 32, 0.45);

  --surface-root: var(--brand-deep-2);
  --surface-panel: var(--brand-deep-3);
  --surface-elevated: var(--brand-deep-4);
  --type-main: 'Be Vietnam Pro', sans-serif;
  --type-alt: 'Space Mono', monospace;
}

html,
body {
  background: var(--surface-root);
  color: var(--ink-soft);
  font-family: var(--type-main);
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}

a,
button,
input,
select,
textarea {
  font-family: var(--type-main);
}

.app-loader {
  background: linear-gradient(180deg, #001A3A 0%, #002554 100%);
}

.app-loader__ring {
  border-top-color: var(--brand-accent);
}

/* ===== Global reset & nền dùng chung toàn app ===== */
* { box-sizing: border-box; }

html, body, #__nuxt {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

body {
  background: #05080d;
  color: #e0e0e0;
  font-family: 'Space Mono', monospace;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

.app-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* Overlay dùng khi ClientOnly đang chờ (fallback-class="loading-overlay") */
.loading-overlay {
  position: absolute; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  background: #05080d; color: #00ffcc;
  font-family: 'Space Mono', monospace; letter-spacing: 1px;
}

/* ===== Hệ thống Adaptive dùng chung: backdrop (tier tablet) + tay cầm kéo
   (tier mobile, xem composables/useDeviceTier.js + useBottomSheet.js).
   Đặt ở đây (không scoped) để FloorPanel/RoomDetailPanel/EquipmentSidePanel
   dùng chung 1 định nghĩa thay vì mỗi component tự viết lại. z-index do từng
   nơi gọi tự set qua style inline vì còn phụ thuộc panel đang đứng ở lớp nào. */
.adaptive-backdrop {
  position: fixed;
  top: var(--header-h, 64px);
  left: 0; right: 0; bottom: 0;
  background: rgba(5, 8, 13, 0.6);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: adaptive-backdrop-in 0.2s ease;
}
@keyframes adaptive-backdrop-in { from { opacity: 0; } to { opacity: 1; } }

.adaptive-sheet-handle {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 10px 0 8px;
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
  background: inherit;
}
.adaptive-sheet-handle::before {
  content: '';
  width: 40px; height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
}
.adaptive-sheet-handle:active { cursor: grabbing; }

@media (prefers-reduced-motion: reduce) {
  .adaptive-backdrop { animation: none; }
}
</style>
