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
  /* Được usePanelLayout.js cập nhật runtime theo trạng thái panel.
     Giá trị mặc định = BuildingsPanel (300px) + tab (36px). */
  --panels-left-width: 336px;

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

/* MIN-4: The html/body block below (around line 70) is the canonical one —
   it carries all the properties including the text-size-adjust fix.  The
   duplicate partial block that used to live here (background + color +
   font-family + margin/padding + text-size-adjust) has been removed to avoid
   conflicting declarations.  The single * { box-sizing } rule further down
   covers both declarations that were previously scattered in two places. */

a,
button,
input,
select,
textarea {
  font-family: var(--type-main);
}

/* MIN-2: Global keyboard-navigation accessibility.
   :focus-visible fires only when the browser determines the element was reached
   via keyboard (Tab, arrow keys, etc.) — NOT on mouse/touch clicks. This means
   sighted mouse users never see the outline, while keyboard users always get a
   clear, high-contrast indicator that meets WCAG 2.4.7 / 2.4.11.

   Placement: after the font-family reset above so the specificity stays low and
   component-level overrides remain possible. */
:focus-visible {
  outline: 2px solid var(--brand-accent);   /* #F58220 orange — brand-consistent */
  outline-offset: 3px;                      /* small gap so outline doesn't sit flush on element edge */
  border-radius: 3px;                       /* softens corners on rectangular controls */
}

/* Suppress the default browser :focus outline so it doesn't double-render
   alongside our :focus-visible ring.  This is safe because :focus-visible
   still fires for keyboard users — we are not removing focus indicators,
   only replacing the always-on :focus outline with the smarter :focus-visible. */
:focus:not(:focus-visible) {
  outline: none;
}

.app-loader {
  background: linear-gradient(180deg, #001A3A 0%, #002554 100%);
}

.app-loader__ring {
  border-top-color: var(--brand-accent);
}

/* ===== Global reset & nền dùng chung toàn app ===== */
/* MIN-4: Single canonical * { box-sizing } rule.  The duplicate that previously
   appeared earlier in this file (before the font-family reset block) has been
   removed; this one covers the whole document. */
* { box-sizing: border-box; }

/* MIN-4: Merged html/body block.  Previously two separate html,body rules
   existed — one earlier carrying background/color/font-family/margin/padding/
   text-size-adjust, and this one carrying margin/padding/width/height/
   overscroll-behavior.  Conflicting declarations (background, font-family, color)
   have been resolved in favour of the design-system CSS-variable values so the
   app theme is driven by :root tokens, not hardcoded hex literals.

   Font-family resolution: the earlier block set font-family to var(--type-main)
   (Be Vietnam Pro) while this block overrode it with 'Space Mono'. Components
   that explicitly need Space Mono already set it locally.  The canonical body
   font is therefore var(--type-main) — consistent with the font-family reset
   applied to a/button/input/select/textarea above. */
html, body, #__nuxt {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

body {
  background: var(--surface-root);         /* design-system token: #001A3A */
  color: var(--ink-soft);                   /* design-system token: #B3BFCD */
  font-family: var(--type-main);            /* Be Vietnam Pro — canonical body font */
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  /* [FIX-mobile-zoom] Chặn hiệu ứng "bounce" kéo quá đà của Safari (kéo bản đồ/
     panel chạm mép rồi bật lại) — dễ bị hiểu nhầm là app "giật/zoom" ngoài ý muốn. */
  overscroll-behavior: none;
  /* [FIX-mobile-zoom] Chặn Safari/Chrome tự phóng to chữ sau orientation change. */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

/* [FIX-mobile-zoom] Toàn bộ nút bấm/link dùng touch-action: manipulation để
   trình duyệt bỏ qua độ trễ chờ double-tap và KHÔNG hiểu double-tap thành
   "double-tap-to-zoom" — nguyên nhân chính của phản hồi "dễ bị thu phóng bất
   ngờ" khi bấm nhanh vào thẻ phòng/nút tầng/nút tab trên điện thoại. Không áp
   cho input/select vì vẫn cần hành vi chạm mặc định (con trỏ, chọn văn bản)
   cho các ô đó. */
a, button {
  touch-action: manipulation;
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
