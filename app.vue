<template>
  <!-- Vỏ tối giản: chỉ điều phối route qua <NuxtPage/>.
       Trang chủ "/" -> pages/index.vue (bản đồ). "/equipment-<id>" -> trang thiết bị.
       Trước đây app.vue render thẳng bản đồ và KHÔNG có <NuxtPage/>, nên mọi route
       trong pages/ (kể cả equipment-[id]) đều không truy cập được. -->
  <div class="app-root">
    <NuxtPage />
  </div>
</template>

<script setup>
// Không cần logic ở đây nữa — state dùng chung nằm ở Pinia store,
// dữ liệu nằm ở composable/Content. Giữ vỏ này thật mỏng.
</script>

<style>
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
</style>
