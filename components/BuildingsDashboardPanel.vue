<!-- components/BuildingsDashboardPanel.vue
     Panel danh sách toà nhà — cố định bên trái bản đồ, mở mặc định khi vào trang.
     Khi chọn toà: emit 'select-building' -> HologramMap.selectBuilding() + FloorPanel xuất hiện.
     Panel tự thu gọn (toggle bằng nút tab) để nhường chỗ cho FloorPanel khi đang xem phòng.
     Không dùng Teleport / backdrop — panel là một phần cố định của layout bản đồ. -->
<template>
  <transition name="buildings-slide">
    <div
      v-if="modelValue"
      class="buildings-panel"
      :class="{ collapsed: isCollapsed }"
      role="complementary"
      aria-label="Danh sách toà nhà"
    >
      <!-- Nút toggle thu gọn / mở rộng (tab bám cạnh phải) -->
      <button
        class="toggle-btn"
        @click="isCollapsed = !isCollapsed"
        :title="isCollapsed ? 'Mở danh sách toà nhà' : 'Thu gọn'"
        :aria-label="isCollapsed ? 'Mở danh sách toà nhà' : 'Thu gọn'"
      >
        <svg v-if="!isCollapsed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>

      <!-- Nội dung panel (ẩn khi thu gọn) -->
      <div class="panel-inner">
        <!-- Header -->
        <div class="panel-head">
          <p class="eyebrow">[ CƠ SỞ DỮ LIỆU KHUÔN VIÊN ]</p>
          <h2 class="panel-title">Toàn bộ toà nhà</h2>
          <p class="panel-sub">Bấm vào một toà để bay thẳng vào trên bản đồ tương tác.</p>
        </div>

        <!-- Divider -->
        <div class="panel-divider"></div>

        <!-- Tiêu đề sidebar -->
        <div class="sidebar-meta">
          <h3 class="sidebar-title">VGU Campus Buildings</h3>
          <p class="sidebar-hint">Bấm vào một toà nhà để mở tầng &amp; phòng ngay trên bản đồ.</p>
        </div>

        <!-- Danh sách -->
        <div v-if="isLoading" class="state-msg">Đang tải dữ liệu toà nhà…</div>

        <div v-else class="building-list">
          <button
            v-for="b in buildings"
            :key="b.id"
            class="building-card"
            :class="{ active: selectedId === b.id }"
            @click="enterBuilding(b.id)"
          >
            <span class="card-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18" /><path d="M5 21V6a1 1 0 0 1 1-1h5v16" />
                <path d="M15 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11" />
                <path d="M9 8h.01" /><path d="M9 12h.01" /><path d="M9 16h.01" />
                <path d="M18 13h.01" /><path d="M18 17h.01" />
              </svg>
            </span>

            <span class="card-main">
              <span class="card-eyebrow">
                <span class="pulse-dot" aria-hidden="true"></span>
                TOÀ {{ b.id }} · TRÊN BẢN ĐỒ
              </span>
              <span class="card-title-text">Cụm {{ b.id }}</span>
            </span>

            <span class="card-stats">
              <span class="stat"><b>{{ b.roomCount }}</b> phòng</span>
              <span class="stat"><b>{{ b.labCount }}</b> lab</span>
              <span class="stat"><b>{{ b.floors.length }}</b> tầng</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  selectedBuildingId: { type: String, default: null }
})

const emit = defineEmits(['update:modelValue', 'select-building'])

const { getBuildingStats } = useVguData()
const config = useRuntimeConfig()
const base = config.app.baseURL

const isLoading = ref(true)
const buildings = ref([])
const isCollapsed = ref(false)
const selectedId = ref(null)

function enterBuilding(id) {
  selectedId.value = id
  emit('select-building', id)
}

onMounted(async () => {
  try {
    const [floorsRes, stats] = await Promise.all([
      fetch(`${base}data/floors-config.json`).then(r => r.json()),
      getBuildingStats()
    ])

    const ids = Object.keys(floorsRes)
    buildings.value = ids.map(id => {
      const floors = floorsRes[id] || []
      const s = stats[id] || { roomCount: 0, labCount: 0 }
      return { id, floors, roomCount: s.roomCount, labCount: s.labCount }
    }).sort((a, b) => a.id.localeCompare(b.id))
  } catch (error) {
    console.error('[BuildingsDashboardPanel] Không tải được dữ liệu:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
/* ===== Panel chính ===== */
.buildings-panel {
  position: absolute;
  top: var(--header-h, 64px);
  left: 0;
  bottom: 0;
  z-index: 85; /* Dưới FloorPanel (90) */
  width: 300px;
  background: #070A12;
  border-right: 1px solid rgba(0, 255, 204, 0.12);
  display: flex;
  flex-direction: row;
  overflow: visible;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.buildings-panel.collapsed {
  width: 0;
}

/* ===== Nút toggle tab bám cạnh phải ===== */
.toggle-btn {
  position: absolute;
  top: 16px;
  right: -36px;
  width: 36px;
  height: 80px;
  background: #0F1E36;
  border: 1px solid rgba(0, 255, 204, 0.2);
  border-left: none;
  border-radius: 0 8px 8px 0;
  color: #9aa5b1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.toggle-btn:hover {
  color: #fff;
  background: #1a2f4e;
  border-color: rgba(0, 255, 204, 0.45);
}
.toggle-btn:focus-visible {
  outline: 2px solid #00ffcc;
  outline-offset: 2px;
}

/* ===== Panel inner (nội dung, ẩn khi collapsed) ===== */
.panel-inner {
  flex: 1;
  min-width: 0;
  width: 300px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.buildings-panel.collapsed .panel-inner {
  opacity: 0;
  pointer-events: none;
}

/* ===== Header ===== */
.panel-head {
  padding: 20px 20px 16px 20px;
  flex-shrink: 0;
}
.eyebrow {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1.5px;
  color: #00ffcc;
  margin: 0 0 6px;
}
.panel-title {
  margin: 0 0 5px;
  font-family: 'Be Vietnam Pro', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}
.panel-sub {
  margin: 0;
  font-size: 11px;
  color: #9aa5b1;
  line-height: 1.5;
}

.panel-divider {
  height: 1px;
  background: rgba(0, 255, 204, 0.1);
  margin: 0 20px;
  flex-shrink: 0;
}

/* ===== Sidebar meta ===== */
.sidebar-meta {
  padding: 14px 20px 10px;
  flex-shrink: 0;
}
.sidebar-title {
  margin: 0 0 5px;
  font-size: 13px;
  font-weight: 700;
  color: #F58220;
}
.sidebar-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: #9aa5b1;
}

/* ===== State msg ===== */
.state-msg {
  color: #8aa;
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  padding: 20px;
}

/* ===== Danh sách toà ===== */
.building-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.building-list::-webkit-scrollbar { width: 4px; }
.building-list::-webkit-scrollbar-thumb { background: #1f2d40; border-radius: 4px; }

/* ===== Card toà nhà ===== */
.building-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 255, 204, 0.1);
  border-radius: 10px;
  padding: 10px 11px;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
  transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
}
.building-card:hover {
  border-color: #EF5A24;
  background: rgba(239, 90, 36, 0.08);
  transform: translateX(2px);
}
.building-card.active {
  border-color: #EF5A24;
  background: rgba(239, 90, 36, 0.12);
}
.building-card:focus-visible { outline: 2px solid #00ffcc; outline-offset: 2px; }

.card-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: rgba(239, 90, 36, 0.12);
  color: #F58220;
}

.card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.card-eyebrow {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.6px;
  color: #00ffcc;
}
.card-title-text {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

.card-stats {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  color: #9aa5b1;
}
.card-stats .stat b { color: #fff; font-size: 10px; }

/* ===== Pulse dot ===== */
.pulse-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #00ffcc;
  box-shadow: 0 0 5px #00ffcc;
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

/* ===== Transition slide vào từ trái ===== */
.buildings-slide-enter-active,
.buildings-slide-leave-active {
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease;
}
.buildings-slide-enter-from,
.buildings-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* ===== Tablet ===== */
@media (max-width: 1024px) {
  .buildings-panel {
    width: min(280px, 85vw);
  }
  .panel-inner {
    width: min(280px, 85vw);
  }
}

/* ===== Mobile: panel trở thành bottom sheet thu gọn được ===== */
@media (max-width: 640px) {
  .buildings-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100% !important;
    height: auto;
    max-height: 55vh;
    border-right: none;
    border-top: 1px solid rgba(0, 255, 204, 0.15);
    flex-direction: column;
  }
  .buildings-panel.collapsed {
    width: 100% !important;
    max-height: 48px;
  }
  .toggle-btn {
    position: static;
    width: 100%;
    height: 36px;
    border-radius: 0;
    border: none;
    border-bottom: 1px solid rgba(0, 255, 204, 0.1);
    flex-direction: row;
    gap: 6px;
    order: -1;
  }
  .panel-inner {
    width: 100%;
    overflow-y: auto;
  }
  .building-list {
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 8px;
    padding: 8px 12px 12px;
  }
  .building-card {
    flex-direction: column;
    align-items: flex-start;
    min-width: 150px;
    flex-shrink: 0;
  }
  .card-stats {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
}
</style>
