<!-- components/BuildingsDashboardPanel.vue
     Dashboard "Toà nhà" dưới dạng panel trượt phủ lên bản đồ tương tác.
     Được gọi từ pages/index.vue thay vì pages/buildings.vue (page riêng).
     Người dùng bấm vào 1 toà → panel đóng lại, HologramMap.selectBuilding()
     được gọi trực tiếp qua emit 'select-building' — không cần điều hướng URL. -->
<template>
  <!-- Backdrop mờ: bấm ra ngoài để đóng panel -->
  <Teleport to="body">
    <transition name="backdrop-fade">
      <div
        v-if="modelValue"
        class="buildings-backdrop"
        @click="$emit('update:modelValue', false)"
      ></div>
    </transition>

    <transition name="panel-slide">
      <div
        v-if="modelValue"
        class="buildings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard toà nhà"
      >
        <!-- Header panel -->
        <div class="panel-head">
          <div class="panel-head-text">
            <p class="eyebrow">[ CƠ SỞ DỮ LIỆU KHUÔN VIÊN ]</p>
            <h2 class="panel-title">Toàn bộ toà nhà</h2>
            <p class="panel-sub">Bấm vào một toà để bay thẳng vào trên bản đồ tương tác.</p>
          </div>
          <button
            class="close-btn"
            @click="$emit('update:modelValue', false)"
            aria-label="Đóng panel toà nhà"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Body: sidebar + board diagram -->
        <div class="panel-body">
          <!-- ===== Sidebar danh sách toà ===== -->
          <aside class="building-sidebar">
            <h3 class="sidebar-title">VGU Campus Buildings</h3>
            <p class="sidebar-hint">
              Bấm vào một toà nhà để mở tầng &amp; phòng ngay trên bản đồ.
            </p>

            <div v-if="isLoading" class="state-msg">Đang tải dữ liệu toà nhà…</div>

            <div v-else class="building-list">
              <button
                v-for="b in buildings"
                :key="b.id"
                class="building-card"
                :class="{ hover: hoveredId === b.id }"
                @mouseenter="hoveredId = b.id"
                @mouseleave="hoveredId = null"
                @click="enterBuilding(b.id)"
              >
                <span class="card-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
          </aside>

          <!-- ===== Sơ đồ khối tương đối ===== -->
          <section class="building-board">
            <div class="board-hud">
              <span class="pulse-dot" aria-hidden="true"></span>
              FOCUS: TOÀN CẢNH KHUÔN VIÊN VGU
              <span class="board-hud-hint">BẤM VÀO 1 KHỐI ĐỂ VÀO TOÀ</span>
            </div>

            <div class="board-canvas">
              <div
                v-for="b in buildings"
                :key="b.id"
                class="board-block-wrap"
                :style="{ left: b.x + '%', top: b.y + '%' }"
                @mouseenter="hoveredId = b.id"
                @mouseleave="hoveredId = null"
              >
                <div
                  class="board-block"
                  :class="{ hover: hoveredId === b.id }"
                  :style="{ height: b.blockHeight + 'px' }"
                ></div>
                <span class="board-dot" :class="{ hover: hoveredId === b.id }"></span>

                <button
                  class="board-card"
                  :class="{ hover: hoveredId === b.id }"
                  @click="enterBuilding(b.id)"
                >
                  <span class="board-card-title">TOÀ {{ b.id }}</span>
                  <span class="board-card-sub">{{ b.floors.length }} tầng · {{ b.roomCount }} phòng</span>
                  <span class="board-card-cta">VÀO TOÀ NHÀ →</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'select-building'])

const { getBuildingStats } = useVguData()
const config = useRuntimeConfig()
const base = config.app.baseURL

const isLoading = ref(true)
const buildings = ref([])
const hoveredId = ref(null)

function enterBuilding(id) {
  emit('select-building', id)
  emit('update:modelValue', false)
}

// Tải dữ liệu lần đầu khi component mount
onMounted(async () => {
  try {
    const [floorsRes, campusRes, stats] = await Promise.all([
      fetch(`${base}data/floors-config.json`).then(r => r.json()),
      fetch(`${base}campus-buildings.json`).then(r => r.json()),
      getBuildingStats()
    ])

    const centroids = {}
    for (const f of campusRes.features || []) {
      const id = f.properties?.building_id || f.id
      const coords = f.geometry?.coordinates?.[0] || []
      if (!id || !coords.length) continue
      const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length
      const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length
      centroids[id] = [cx, cy]
    }

    const ids = Object.keys(floorsRes)
    const lons = ids.map(id => centroids[id]?.[0]).filter(v => v != null)
    const lats = ids.map(id => centroids[id]?.[1]).filter(v => v != null)
    const lonMin = Math.min(...lons), lonMax = Math.max(...lons)
    const latMin = Math.min(...lats), latMax = Math.max(...lats)
    const PAD = 14
    const norm = (v, min, max) => {
      if (max === min) return 50
      return PAD + ((v - min) / (max - min)) * (100 - PAD * 2)
    }

    buildings.value = ids.map(id => {
      const c = centroids[id]
      const floors = floorsRes[id] || []
      const s = stats[id] || { roomCount: 0, labCount: 0 }
      return {
        id,
        floors,
        roomCount: s.roomCount,
        labCount: s.labCount,
        x: c ? norm(c[0], lonMin, lonMax) : 50,
        y: c ? 100 - norm(c[1], latMin, latMax) : 50,
        blockHeight: 56 + floors.length * 7
      }
    }).sort((a, b) => a.id.localeCompare(b.id))
  } catch (error) {
    console.error('[BuildingsDashboardPanel] Không tải được dữ liệu toà nhà:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
/* ===== Backdrop ===== */
.buildings-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 110;
  backdrop-filter: blur(2px);
}

/* ===== Panel chính ===== */
.buildings-panel {
  position: fixed;
  top: var(--header-h, 64px);
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 111;
  background: #070A12;
  color: #fff;
  font-family: 'Be Vietnam Pro', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@media (min-width: 1280px) {
  /* Desktop lớn: hiện như drawer bên trái, bản đồ vẫn thấy bên phải */
  .buildings-panel {
    right: auto;
    width: min(880px, 72vw);
    border-right: 1px solid rgba(0, 255, 204, 0.14);
    box-shadow: 4px 0 40px rgba(0, 0, 0, 0.6);
  }
}

/* ===== Header panel ===== */
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px 20px;
  border-bottom: 1px solid rgba(0, 255, 204, 0.1);
  flex-shrink: 0;
}
.eyebrow {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #00ffcc;
  margin: 0 0 5px;
}
.panel-title {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.panel-sub {
  margin: 0;
  font-size: 12px;
  color: #9aa5b1;
  line-height: 1.5;
}

.close-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: transparent;
  color: #9aa5b1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
  margin-top: 2px;
}
.close-btn:hover {
  color: #fff;
  border-color: rgba(239, 90, 36, 0.6);
  background: rgba(239, 90, 36, 0.08);
}
.close-btn:focus-visible { outline: 2px solid #00ffcc; outline-offset: 2px; }

/* ===== Body: sidebar + board ===== */
.panel-body {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
}

/* ===== Sidebar ===== */
.building-sidebar {
  width: 320px;
  flex-shrink: 0;
  padding: 20px 20px 20px 28px;
  border-right: 1px solid rgba(0, 255, 204, 0.08);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.building-sidebar::-webkit-scrollbar { width: 4px; }
.building-sidebar::-webkit-scrollbar-thumb { background: #1f2d40; border-radius: 4px; }

@media (max-width: 900px) {
  .panel-body { flex-direction: column; overflow-y: auto; }
  .building-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid rgba(0, 255, 204, 0.08);
    overflow-y: visible;
    padding: 20px 20px 16px;
  }
}

.sidebar-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  color: #F58220;
}
.sidebar-hint {
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 1.5;
  color: #9aa5b1;
}

.state-msg {
  color: #8aa;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  padding: 24px 0;
}

.building-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.building-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 255, 204, 0.12);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
  transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
}
.building-card:hover, .building-card.hover {
  border-color: #EF5A24;
  background: rgba(239, 90, 36, 0.08);
  transform: translateX(2px);
}
.building-card:focus-visible { outline: 2px solid #00ffcc; outline-offset: 2px; }

.card-icon {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
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
  gap: 6px;
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.8px;
  color: #00ffcc;
}
.card-title-text {
  font-size: 14px;
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

/* ===== Sơ đồ khối ===== */
.building-board {
  flex: 1;
  min-width: 0;
  position: relative;
  background:
    radial-gradient(circle at 30% 20%, rgba(0, 255, 204, 0.04), transparent 60%),
    #0a0f1a;
  overflow: hidden;
}
@media (max-width: 900px) {
  .building-board {
    min-height: 340px;
    flex: none;
  }
}

.board-hud {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  background: rgba(15, 30, 54, 0.8);
  border: 1px solid rgba(0, 255, 204, 0.22);
  border-radius: 4px;
  backdrop-filter: blur(8px);
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  color: #00ffcc;
  white-space: nowrap;
}
.board-hud-hint {
  color: #64748b;
  margin-left: 4px;
}
@media (max-width: 640px) { .board-hud-hint { display: none; } }

.board-canvas {
  position: absolute;
  inset: 0;
}

.board-block-wrap {
  position: absolute;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.board-block {
  width: 64px;
  background: linear-gradient(160deg, #16345e 0%, #0C2B5C 100%);
  border: 1px solid rgba(239, 90, 36, 0.45);
  clip-path: polygon(18% 0%, 100% 0%, 82% 100%, 0% 100%);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.45);
  transition: filter 0.2s ease, border-color 0.2s ease;
}
.board-block.hover {
  filter: brightness(1.3);
  border-color: #EF5A24;
}

.board-dot {
  width: 8px; height: 8px; margin-top: -4px;
  border-radius: 50%;
  background: #EF5A24;
  box-shadow: 0 0 8px #EF5A24;
  transition: transform 0.2s ease;
}
.board-dot.hover { transform: scale(1.3); }

.board-card {
  margin-top: 8px;
  width: 136px;
  text-align: left;
  background: rgba(15, 30, 54, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 6px;
  padding: 7px 9px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  backdrop-filter: blur(6px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  transition: border-color 0.2s ease, transform 0.2s ease;
  font-family: inherit;
  color: inherit;
}
.board-card:hover, .board-card.hover {
  border-color: #EF5A24;
  transform: translateY(-2px);
}
.board-card:focus-visible { outline: 2px solid #00ffcc; outline-offset: 2px; }

.board-card-title {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #EF5A24;
}
.board-card-sub {
  font-size: 9px;
  color: #9aa5b1;
}
.board-card-cta {
  margin-top: 2px;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.5px;
  color: #00ffcc;
}

/* ===== Pulse dot ===== */
.pulse-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #00ffcc; box-shadow: 0 0 6px #00ffcc;
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

/* ===== Transitions ===== */
.backdrop-fade-enter-active, .backdrop-fade-leave-active {
  transition: opacity 0.25s ease;
}
.backdrop-fade-enter-from, .backdrop-fade-leave-to { opacity: 0; }

.panel-slide-enter-active, .panel-slide-leave-active {
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease;
}
.panel-slide-enter-from, .panel-slide-leave-to {
  transform: translateX(-24px);
  opacity: 0;
}

/* Mobile: trượt từ dưới lên */
@media (max-width: 1280px) {
  .panel-slide-enter-from, .panel-slide-leave-to {
    transform: translateY(20px);
    opacity: 0;
  }
}
</style>
