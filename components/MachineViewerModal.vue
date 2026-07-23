<template>
  <div class="machine-overlay" @click.self="handleBackdropClick">
    <div class="machine-modal">
      <!-- Nút đóng -->
      <button class="close-btn" @click="handleClose">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- ============ VIEW 1: DANH SÁCH THIẾT BỊ TRONG PHÒNG ============ -->
      <template v-if="!selectedMachine">
        <div class="list-header">
          <span class="eyebrow">{{ roomLabel }}</span>
          <h2>ALL MACHINES IN THIS ROOM</h2>
        </div>

        <div class="list-body">
          <div v-if="isLoadingList" class="state-msg">Đang tải danh sách thiết bị…</div>

          <div v-else-if="machines.length === 0" class="empty-state">
            <p>Chưa có thiết bị nào được ghi nhận cho phòng này.</p>
          </div>

          <div v-else class="machine-grid">
            <button
              v-for="m in machines"
              :key="m.id"
              class="machine-card"
              @click="selectMachine(m)"
            >
              <div class="machine-thumb">
                <img v-if="m.thumbnail" :src="m.thumbnail" :alt="m.title" />
                <div v-else class="thumb-placeholder">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <span v-if="m.has3DModel" class="badge-3d">3D</span>
              </div>
              <div class="machine-meta">
                <span class="machine-name">{{ m.title }}</span>
                <span class="machine-model" v-if="m.model">{{ m.model }}</span>
              </div>
            </button>
          </div>
        </div>
      </template>

      <!-- ============ VIEW 2: CHI TIẾT 3D CỦA 1 THIẾT BỊ ============ -->
      <template v-else>
        <div class="detail-layout">
          <!-- Cột trái: Viewer 3D -->
          <div class="viewer-pane">
            <button class="back-btn" @click="selectedMachine = null">
              ← QUAY LẠI DANH SÁCH
            </button>

            <div class="viewer-frame">
              <model-viewer
                v-if="selectedMachine.modelUrl"
                :key="selectedMachine.id"
                :src="selectedMachine.modelUrl"
                camera-controls
                auto-rotate
                shadow-intensity="1"
                exposure="1"
                touch-action="pan-y"
                interaction-prompt="none"
                :style="{ '--poster-color': 'transparent' }"
                class="model-viewer-el"
              >
                <div slot="progress-bar" class="model-progress"></div>
                <div slot="poster" class="model-loading">Đang tải mô hình 3D…</div>
              </model-viewer>

              <div v-else class="no-model-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                <p>Chưa có mô hình 3D cho thiết bị này.</p>
                <span>Sẽ cập nhật mô hình 3D tại đây.</span>
              </div>
            </div>
          </div>

          <!-- Cột phải: Thông tin thiết bị -->
          <div class="info-pane">
            <span class="eyebrow" v-if="selectedMachine.departments">
              {{ selectedMachine.departments }}
            </span>
            <h2 class="machine-title">{{ selectedMachine.title }}</h2>
            <p class="machine-sub" v-if="selectedMachine.model || selectedMachine.manufacturer">
              {{ selectedMachine.model }}<template v-if="selectedMachine.model && selectedMachine.manufacturer"> · </template>{{ selectedMachine.manufacturer }}
            </p>

            <div class="status-row" v-if="selectedMachine.status">
              <span class="status-dot" :class="selectedMachine.status"></span>
              <span class="status-text">{{ statusLabel(selectedMachine.status) }}</span>
            </div>

            <div class="info-block">
              <h4>MÔ TẢ</h4>
              <p v-if="selectedMachine.story">{{ selectedMachine.story }}</p>
              <p v-else class="placeholder-text">Thông tin chi tiết sẽ được cập nhật sau.</p>
            </div>

            <div class="info-block" v-if="selectedMachine.category">
              <h4>PHÂN LOẠI</h4>
              <p>{{ selectedMachine.category }}</p>
            </div>

            <div class="info-block">
              <h4>VỊ TRÍ</h4>
              <p>{{ locationLabel(selectedMachine) }}</p>
            </div>

            <div class="placeholder-note">
              Các thông tin kỹ thuật khác (thông số, quy trình, bảo trì…) sẽ được cập nhật sau.
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  roomId: { type: String, default: null },
  buildingId: { type: String, default: null },
  roomName: { type: String, default: '' },
  // Danh sách thiết bị đã có sẵn (nếu RoomDetailPanel truyền vào), dùng làm fallback
  // trong lúc chưa fetch được danh sách đầy đủ từ nguồn dữ liệu thiết bị.
  instruments: { type: Array, default: () => [] }
})

const emit = defineEmits(['close'])

const config = useRuntimeConfig()
const base = config.app.baseURL

// getEquipmentListByRoom / getEquipmentInfo được kỳ vọng đến từ cùng composable
// useVguData() đang dùng ở RoomDetailPanel.vue. Nếu composable chưa có các hàm
// này, phần fallback bên dưới vẫn hiển thị được danh sách cơ bản từ `instruments`.
const { getEquipmentListByRoom, getEquipmentInfo } = useVguData()

const isLoadingList = ref(false)
const machines = ref([])
const selectedMachine = ref(null)

const roomLabel = computed(() => {
  const parts = [props.buildingId, props.roomName || props.roomId].filter(Boolean)
  return parts.join(' // ')
})

const statusLabel = (status) => {
  const map = {
    operational: 'Đang hoạt động',
    maintenance: 'Đang bảo trì',
    offline: 'Ngưng hoạt động'
  }
  return map[status] || status
}

const locationLabel = (m) => {
  const parts = [
    m.buildingId,
    m.floor != null ? `Tầng ${m.floor}` : null,
    m.roomId,
    m.stationId
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : 'N/A'
}

// Chuẩn hoá 1 bản ghi thiết bị (dù đến từ frontmatter markdown như spectrometer-01.md
// hay từ object rút gọn trong danh sách "instruments" của phòng).
const normalizeMachine = (raw) => {
  if (!raw) return null
  const id = raw.id || raw.equipment_id || raw.slug || raw.name
  const loc = raw.location || {}
  return {
    id,
    title: raw.title || raw.name || id,
    model: raw.model || '',
    manufacturer: raw.manufacturer || '',
    departments: Array.isArray(raw.departments) ? raw.departments.join(', ') : (raw.departments || ''),
    category: raw.category || '',
    status: raw.status || '',
    story: raw.story || raw.description || '',
    thumbnail: raw.media?.images?.[0] || raw.thumbnail || '',
    buildingId: loc.building_id || raw.buildingId || props.buildingId,
    floor: loc.floor ?? raw.floor ?? null,
    roomId: loc.room_id || raw.roomId || props.roomId,
    stationId: loc.station_id || raw.stationId || '',
    // Quy ước đặt tên file model: /models/{id}.glb — điều chỉnh nếu nguồn dữ liệu
    // thực tế đặt tên khác (vd theo station_id như "AD-431").
    modelUrl: raw.modelUrl || (id ? `${base}models/${id}.glb` : ''),
    has3DModel: !!(raw.modelUrl || raw.has3DModel || id)
  }
}

const loadMachineList = async () => {
  if (!props.roomId) return
  isLoadingList.value = true
  try {
    let list = []
    if (typeof getEquipmentListByRoom === 'function') {
      list = await getEquipmentListByRoom(props.roomId)
    }
    if ((!list || list.length === 0) && props.instruments.length > 0) {
      list = props.instruments
    }
    machines.value = (list || []).map(normalizeMachine).filter(Boolean)
  } catch (err) {
    console.error('[MachineViewerModal] Không thể tải danh sách thiết bị của phòng:', err)
    machines.value = props.instruments.map(normalizeMachine).filter(Boolean)
  } finally {
    isLoadingList.value = false
  }
}

const selectMachine = async (m) => {
  // Nếu có hàm lấy chi tiết đầy đủ (vd đọc lại file markdown thiết bị), gọi thêm
  // để bổ sung các trường chưa có trong danh sách rút gọn.
  if (typeof getEquipmentInfo === 'function' && m.id) {
    try {
      const full = await getEquipmentInfo(m.id)
      if (full) {
        selectedMachine.value = normalizeMachine({ ...full, id: m.id })
        return
      }
    } catch (err) {
      console.warn('[MachineViewerModal] Không lấy được chi tiết thiết bị, dùng dữ liệu rút gọn:', err)
    }
  }
  selectedMachine.value = m
}

const handleClose = () => {
  selectedMachine.value = null
  emit('close')
}

const handleBackdropClick = () => {
  handleClose()
}

onMounted(() => {
  loadMachineList()
  // Nạp web component <model-viewer> của Google khi cần (chỉ nạp 1 lần).
  if (typeof window !== 'undefined' && !customElements.get('model-viewer')) {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js'
    document.head.appendChild(script)
  }
})

watch(() => props.roomId, loadMachineList)
</script>

<style scoped>
.machine-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 15, 0.75);
  backdrop-filter: blur(3px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}
.machine-modal {
  position: relative;
  width: min(1100px, 94vw);
  height: min(640px, 90vh);
  background-color: #0b1120;
  border: 1px solid #1f2d40;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
}
.close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  z-index: 5;
  transition: color 0.2s;
}
.close-btn:hover { color: #f87171; }

/* ---- List view ---- */
.list-header {
  padding: 24px 28px 16px;
  border-bottom: 1px dashed #1f2d40;
}
.eyebrow {
  font-size: 10px;
  font-weight: 700;
  color: #f97316;
  letter-spacing: 1px;
  text-transform: uppercase;
  display: block;
  margin-bottom: 6px;
}
.list-header h2 {
  margin: 0;
  font-size: 20px;
  color: #fff;
}
.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
}
.state-msg, .empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 13px;
}
.machine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}
.machine-card {
  background-color: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition: border-color 0.2s, transform 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.machine-card:hover {
  border-color: #f97316;
  transform: translateY(-2px);
}
.machine-thumb {
  position: relative;
  width: 100%;
  height: 100px;
  background-color: #1e293b;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.machine-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-placeholder { color: #64748b; }
.badge-3d {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #f97316;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.machine-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.machine-name {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}
.machine-model {
  font-size: 11px;
  color: #94a3b8;
}

/* ---- Detail view ---- */
.detail-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  overflow: hidden;
}
.viewer-pane {
  position: relative;
  background: #05070d;
  display: flex;
  flex-direction: column;
}
.back-btn {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 4;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid #1f2d40;
  color: #e2e8f0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.back-btn:hover { border-color: #f97316; color: #f97316; }
.viewer-frame {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.model-viewer-el {
  width: 100%;
  height: 100%;
  --progress-bar-color: #f97316;
}
.model-loading {
  color: #94a3b8;
  font-size: 13px;
}
.no-model-placeholder {
  color: #64748b;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.no-model-placeholder p {
  margin: 0;
  font-weight: 600;
  color: #94a3b8;
  font-size: 14px;
}
.no-model-placeholder span { font-size: 11px; }

.info-pane {
  padding: 24px;
  overflow-y: auto;
  border-left: 1px solid #1f2d40;
}
.machine-title {
  margin: 4px 0 2px;
  font-size: 20px;
  color: #fff;
}
.machine-sub {
  margin: 0 0 12px;
  font-size: 13px;
  color: #94a3b8;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}
.status-dot.operational { background: #22c55e; }
.status-dot.maintenance { background: #eab308; }
.status-dot.offline { background: #ef4444; }
.status-text {
  font-size: 12px;
  color: #cbd5e1;
}
.info-block {
  margin-bottom: 16px;
}
.info-block h4 {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #94a3b8;
  margin: 0 0 6px;
  text-transform: uppercase;
}
.info-block p {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  color: #e2e8f0;
}
.placeholder-text { color: #64748b; font-style: italic; }
.placeholder-note {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
  border-top: 1px dashed #1f2d40;
  padding-top: 12px;
  margin-top: 8px;
}

@media (max-width: 720px) {
  .detail-layout { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .info-pane { border-left: none; border-top: 1px solid #1f2d40; }
}
</style>
