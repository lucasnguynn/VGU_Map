<!-- pages/buildings.vue
     Dashboard "Toà nhà" — phỏng theo bố cục tham chiếu (sidebar danh sách khối +
     khu vực minh hoạ khối 3D bên phải, mỗi khối là 1 thẻ nổi "VÀO TOÀ NHÀ →").
     Khác với ảnh tham chiếu (dữ liệu minh hoạ, tên phòng ban hư cấu), trang này
     dùng ĐÚNG dữ liệu thật của campus:
       - Danh sách + số tầng: public/data/floors-config.json (giống HologramMap.vue)
       - Vị trí tương đối giữa các khối: centroid thật từ public/campus-buildings.json
         (đã chuẩn hoá về hệ 0..100% để vẽ khối, KHÔNG phải toạ độ pixel cố định)
       - Số phòng / số phòng lab: useVguData().getBuildingStats() (đếm thật từ
         content/Rooms/*.md), KHÔNG bịa số như "LABS: 4 / UNITS: 5" trong ảnh mẫu.
     Bấm vào thẻ (sidebar hoặc khối nổi) -> điều hướng về "/" kèm ?building=ID,
     pages/index.vue sẽ đợi bản đồ sẵn sàng rồi gọi HologramMap.selectBuilding(). -->
<template>
  <div class="buildings-page">
    <header class="page-head">
      <p class="eyebrow">[ CƠ SỞ DỮ LIỆU KHUÔN VIÊN ]</p>
      <h1>Toàn bộ toà nhà</h1>
      <p class="sub">Bấm vào một toà (trong danh sách hoặc trên sơ đồ khối) để mở bản đồ tương tác và bay thẳng vào toà đó.</p>
    </header>

    <div class="gallery-body">
      <!-- ================= Sidebar danh sách toà ================= -->
      <aside class="building-sidebar">
        <h2 class="sidebar-title">VGU Campus Buildings</h2>
        <p class="sidebar-hint">Bấm vào một toà nhà bên dưới hoặc chọn khối tương ứng trên sơ đồ để khám phá các tầng và phòng.</p>

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
                <path d="M3 21h18" /><path d="M5 21V6a1 1 0 0 1 1-1h5v16" /><path d="M15 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11" />
                <path d="M9 8h.01" /><path d="M9 12h.01" /><path d="M9 16h.01" /><path d="M18 13h.01" /><path d="M18 17h.01" />
              </svg>
            </span>

            <span class="card-main">
              <span class="card-eyebrow">
                <span class="pulse-dot" aria-hidden="true"></span>
                TOÀ {{ b.id }} · TRÊN BẢN ĐỒ
              </span>
              <span class="card-title">Cụm {{ b.id }}</span>
            </span>

            <span class="card-stats">
              <span class="stat"><b>{{ b.roomCount }}</b> phòng</span>
              <span class="stat"><b>{{ b.labCount }}</b> lab</span>
              <span class="stat"><b>{{ b.floors.length }}</b> tầng</span>
            </span>
          </button>
        </div>
      </aside>

      <!-- ================= Sơ đồ khối (vị trí tương đối thật) ================= -->
      <section class="building-board" :class="{ 'is-compact': !isDesktop }">
        <div class="board-hud">
          <span class="pulse-dot" aria-hidden="true"></span>
          FOCUS: TOÀN CẢNH KHUÔN VIÊN VGU
          <span class="board-hud-hint">BẤM VÀO 1 KHỐI ĐỂ VÀO TOÀ</span>
        </div>

        <div v-if="isDesktop" class="board-canvas">
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

            <button class="board-card" :class="{ hover: hoveredId === b.id }" @click="enterBuilding(b.id)">
              <span class="board-card-title">TOÀ {{ b.id }}</span>
              <span class="board-card-sub">{{ b.floors.length }} tầng · {{ b.roomCount }} phòng</span>
              <span class="board-card-cta">VÀO TOÀ NHÀ →</span>
            </button>
          </div>
        </div>

        <!-- Màn hẹp: sơ đồ khối tuyệt đối rất khó bấm chính xác, ẩn đi và chỉ
             dùng sidebar list (đã full-width ở @media bên dưới) làm nguồn tương
             tác duy nhất — nhất quán với cách FloorPanel/RoomDetailPanel co lại
             trên mobile (xem composables/useDeviceTier.js). -->
        <div v-else class="board-fallback">
          Sơ đồ khối được ẩn trên màn hẹp — dùng danh sách bên trên để chọn toà.
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDeviceTier } from '~/composables/useDeviceTier'

const router = useRouter()
const { isDesktop } = useDeviceTier()
const { getBuildingStats } = useVguData()

const config = useRuntimeConfig()
const base = config.app.baseURL

useSeoMeta({
  title: 'Toà nhà | VGU Map',
  description: 'Danh sách toàn bộ toà nhà trên khuôn viên VGU và số phòng/lab theo từng toà.'
})

const isLoading = ref(true)
const buildings = ref([])
const hoveredId = ref(null)

function enterBuilding(id) {
  router.push({ path: '/', query: { building: id } })
}

onMounted(async () => {
  try {
    const [floorsRes, campusRes, stats] = await Promise.all([
      fetch(`${base}data/floors-config.json`).then(r => r.json()),
      fetch(`${base}campus-buildings.json`).then(r => r.json()),
      getBuildingStats()
    ])

    // Centroid thật (lon/lat) của từng toà, dùng để giữ ĐÚNG bố cục tương đối
    // ngoài đời (vd B1/B2/B3 xếp cột dọc, B5/B6 xếp cột dọc, AD ở trên) thay vì
    // đặt vị trí bừa. Chuẩn hoá về % trong khung board-canvas.
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
    // Chừa lề 14% mỗi bên để thẻ nổi (board-card) không bị tràn ra ngoài khung.
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
        // lat tăng dần về phía Bắc = lên trên màn hình -> đảo trục Y.
        x: c ? norm(c[0], lonMin, lonMax) : 50,
        y: c ? 100 - norm(c[1], latMin, latMax) : 50,
        // Khối cao hơn 1 chút cho toà nhiều tầng — chỉ mang tính minh hoạ.
        blockHeight: 56 + floors.length * 7
      }
    }).sort((a, b) => a.id.localeCompare(b.id))
  } catch (error) {
    console.error('[buildings] Không tải được dữ liệu toà nhà:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.buildings-page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  background: #070A12;
  color: #fff;
  font-family: 'Be Vietnam Pro', sans-serif;
  padding: calc(var(--header-h, 64px) + 24px) 32px 48px;
}
@media (max-width: 640px) {
  .buildings-page { padding: calc(var(--header-h-mobile, 54px) + 16px) 16px 32px; }
}

.page-head { margin-bottom: 24px; }
.eyebrow {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #00ffcc;
  margin: 0 0 6px;
}
.page-head h1 { margin: 0 0 6px; font-size: 26px; }
.page-head .sub { margin: 0; color: #9aa5b1; font-size: 13px; max-width: 640px; }

.gallery-body {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
@media (max-width: 1024px) {
  .gallery-body { flex-direction: column; }
}

/* ================= Sidebar ================= */
.building-sidebar {
  width: 340px;
  flex-shrink: 0;
}
@media (max-width: 1024px) {
  .building-sidebar { width: 100%; }
}

.sidebar-title {
  margin: 0 0 8px;
  font-size: 18px;
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
  font-size: 13px;
  padding: 24px 0;
}

.building-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.building-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 255, 204, 0.14);
  border-radius: 10px;
  padding: 12px 14px;
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
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(239, 90, 36, 0.14);
  color: #F58220;
}

.card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.card-eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.8px;
  color: #00ffcc;
}
.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.card-stats {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: #9aa5b1;
}
.card-stats .stat b { color: #fff; font-size: 11px; }

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

/* ================= Board (sơ đồ khối) ================= */
.building-board {
  flex: 1;
  min-width: 0;
  min-height: 560px;
  position: relative;
  background:
    radial-gradient(circle at 30% 20%, rgba(0, 255, 204, 0.05), transparent 60%),
    #0a0f1a;
  border: 1px solid rgba(0, 255, 204, 0.12);
  border-radius: 12px;
  overflow: hidden;
}
@media (max-width: 1024px) {
  .building-board { min-height: 320px; }
}

.board-hud {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(15, 30, 54, 0.75);
  border: 1px solid rgba(0, 255, 204, 0.25);
  border-radius: 4px;
  backdrop-filter: blur(8px);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: #00ffcc;
}
.board-hud-hint { color: #64748b; margin-left: 4px; }
@media (max-width: 640px) {
  .board-hud-hint { display: none; }
}

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
  width: 70px;
  background: linear-gradient(160deg, #16345e 0%, #0C2B5C 100%);
  border: 1px solid rgba(239, 90, 36, 0.5);
  clip-path: polygon(18% 0%, 100% 0%, 82% 100%, 0% 100%);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.45);
  transition: filter 0.2s ease, border-color 0.2s ease;
}
.board-block.hover {
  filter: brightness(1.25);
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
  width: 148px;
  text-align: left;
  background: rgba(15, 30, 54, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.35);
  border-radius: 6px;
  padding: 8px 10px;
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
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #EF5A24;
}
.board-card-sub {
  font-size: 10px;
  color: #9aa5b1;
}
.board-card-cta {
  margin-top: 2px;
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.5px;
  color: #00ffcc;
}

.board-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
}
</style>
