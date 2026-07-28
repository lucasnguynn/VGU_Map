<!-- components/EquipmentSidePanel.vue
     Trước đây là components/MachineViewerModal.vue: overlay cố định che kín toàn màn
     hình (position:fixed, backdrop mờ, z-index:200) mỗi khi bấm "VIEW ALL MACHINES IN
     THIS ROOM" từ RoomDetailPanel.vue -> mất hết ngữ cảnh phòng đang xem, giống "văng"
     sang trang khác. Đổi tên + đổi cách hiển thị: giờ đây là 1 panel DOCK ngay bên
     trái RoomDetailPanel (right: 400px = đúng bề rộng RoomDetailPanel), cả 2 cùng hiện
     song song — người dùng vẫn thấy thông tin phòng trong lúc xem danh sách/chi tiết
     thiết bị. Logic tải dữ liệu (2 view: danh sách <-> chi tiết 1 thiết bị) giữ nguyên,
     chỉ đổi phần khung/CSS bao ngoài.
     Bố cục chi tiết máy đổi từ 2 cột (viewer trái, thông tin phải — cần màn rộng) sang
     xếp DỌC (ảnh/3D trên, thông tin cuộn bên dưới) vì panel chỉ rộng ~420px. -->
<template>
  <!-- Tablet/mobile: panel này che RoomDetailPanel (không dock cạnh nữa vì
       không đủ chỗ) nên cần backdrop riêng, đậm hơn 1 chút vì đang là lớp
       trên cùng. Bấm ra ngoài = đóng, quay lại panel phòng phía sau. -->
  <div
    v-if="tier !== 'desktop'"
    class="adaptive-backdrop"
    style="z-index: 109"
    @click="handleClose"
  ></div>

  <div
    class="side-panel"
    :class="`tier-${tier}`"
    :style="tier === 'mobile' ? sheetStyle : null"
  >
    <!-- Mobile: tay cầm kéo/tap (bottom sheet) -->
    <div
      v-if="tier === 'mobile'"
      class="adaptive-sheet-handle"
      @pointerdown="onSheetDragStart"
    ></div>

    <!-- Nút đóng -->
    <button class="close-btn" @click="handleClose">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <!-- ============ VIEW 1: DANH SÁCH THIẾT BỊ TRONG PHÒNG ============ -->
    <template v-if="!selectedMachine">
      <div class="list-header">
        <span class="eyebrow">{{ roomLabel }}</span>
        <h2>TẤT CẢ THIẾT BỊ TRONG PHÒNG</h2>
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
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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

    <!-- ============ VIEW 2: CHI TIẾT 1 THIẾT BỊ (xếp dọc: ảnh/3D trên, info dưới) ============ -->
    <template v-else>
      <button class="back-btn" @click="selectedMachine = null">
        ← QUAY LẠI DANH SÁCH
      </button>

      <div class="detail-scroll">
        <div class="viewer-frame">
          <model-viewer
            v-if="selectedMachine.modelUrl && !modelFailed"
            :key="selectedMachine.id"
            :src="activeModelSrc"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="1"
            touch-action="pan-y"
            interaction-prompt="none"
            :style="{ '--poster-color': 'transparent' }"
            class="model-viewer-el"
            @error="onModelError"
            @load="onModelLoad"
          >
            <div slot="progress-bar" class="model-progress"></div>
            <div slot="poster" class="model-loading">{{ statusText }}</div>
          </model-viewer>

          <div v-else class="no-model-placeholder">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <p>Chưa có mô hình 3D cho thiết bị này.</p>
          </div>
        </div>

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
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDeviceTier } from '~/composables/useDeviceTier'
import { useBottomSheet } from '~/composables/useBottomSheet'

const { tier } = useDeviceTier()
// Mobile: mở gần full-screen ngay từ đầu (peek cao) vì đây là panel "con" người
// dùng chủ động mở từ RoomDetailPanel, ít lý do để chỉ hé mở như FloorPanel.
const { sheetStyle, onDragStart: onSheetDragStart } = useBottomSheet({ peek: 0.7, full: 0.94, onDismiss: () => handleClose() })

const props = defineProps({
  roomId: { type: String, default: null },
  buildingId: { type: String, default: null },
  roomName: { type: String, default: '' },
  // Danh sách thiết bị đã có sẵn (nếu RoomDetailPanel truyền vào), dùng làm fallback
  // trong lúc chưa fetch được danh sách đầy đủ từ nguồn dữ liệu thiết bị.
  instruments: { type: Array, default: () => [] },
  // Bấm thẳng vào 1 khối thiết bị trên bản đồ (layer vgu-equipment-fill) ->
  // properties của feature đó (equipment_id, model_code, room_id…) được truyền
  // vào đây để mở thẳng view chi tiết, bỏ qua bước danh sách.
  initialEquipment: { type: Object, default: null }
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

// Trước đây khi file .glb không tồn tại (404) hoặc lỗi, <model-viewer> không
// tự báo gì -> khung "Đang tải mô hình 3D…" bị treo mãi mãi (giống như đang
// tải rất lâu, dù thực ra là lỗi). Bắt sự kiện @error + đặt timeout dự phòng
// để tự chuyển sang khung "Chưa có mô hình 3D" thay vì treo vô thời hạn.
//
// [FIX] Thêm cơ chế THỬ LẠI 1 lần với đường dẫn phụ trước khi báo lỗi hẳn:
// models/ đôi khi lệch quy ước đặt tên/thư mục giữa các môi trường deploy —
// thay vì báo lỗi ngay ở lần thử đầu, thử thêm 1 đường dẫn phụ (models/models/)
// trước, chỉ khi CẢ HAI đều thất bại mới coi là thực sự không có model.
const modelFailed = ref(false)
const triedFallback = ref(false)
const statusText = ref('Đang tải mô hình 3D…')
const activeModelSrc = ref('')
let modelTimeoutId = null
const MODEL_LOAD_TIMEOUT_MS = 12000

// Đường dẫn phụ: thử models/models/{code}.glb (đề phòng cấu trúc thư mục
// lệch trên 1 số môi trường deploy). Chỉ tính khi có modelUrl gốc.
const fallbackModelSrc = computed(() => {
  const primary = selectedMachine.value?.modelUrl
  if (!primary) return ''
  return primary.replace(/models\/([^/]+\.glb)$/, 'models/models/$1')
})

const clearModelTimeout = () => {
  if (modelTimeoutId) { clearTimeout(modelTimeoutId); modelTimeoutId = null }
}

const onModelError = () => {
  if (!triedFallback.value && fallbackModelSrc.value) {
    console.warn('[EquipmentSidePanel] Đường dẫn chính lỗi, thử đường dẫn phụ:', selectedMachine.value?.modelUrl, '->', fallbackModelSrc.value)
    triedFallback.value = true
    statusText.value = 'Đang thử lại đường dẫn phụ…'
    activeModelSrc.value = fallbackModelSrc.value
    armModelTimeout() // hẹn giờ lại cho lượt thử thứ 2
    return
  }
  console.warn('[EquipmentSidePanel] Không tải được model 3D (cả 2 đường dẫn đều lỗi):', selectedMachine.value?.modelUrl, fallbackModelSrc.value)
  clearModelTimeout()
  modelFailed.value = true
}
const onModelLoad = () => {
  clearModelTimeout()
}
const armModelTimeout = () => {
  clearModelTimeout()
  modelTimeoutId = setTimeout(() => {
    console.warn('[EquipmentSidePanel] Model 3D tải quá lâu, coi như lỗi:', activeModelSrc.value)
    onModelError()
  }, MODEL_LOAD_TIMEOUT_MS)
}
// Mỗi lần đổi sang 1 thiết bị khác (modelUrl đổi) -> reset lại toàn bộ trạng
// thái thử/lỗi và bắt đầu lại từ đường dẫn chính.
watch(() => selectedMachine.value?.modelUrl, (url) => {
  clearModelTimeout()
  modelFailed.value = false
  triedFallback.value = false
  statusText.value = 'Đang tải mô hình 3D…'
  activeModelSrc.value = url || ''
  if (url) armModelTimeout()
}, { immediate: true })
onUnmounted(() => clearModelTimeout())

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
  // Quy ước đặt tên file model: thiết bị lấy từ khối vẽ trên bản đồ (geojson
  // public/data/equipment/{roomId}.geojson) có model_code là mã ngắn khớp
  // đúng tên file .glb trong models/ (vd "E16" -> models/E16.glb). equipment_id
  // đầy đủ (vd "B5-105_E16") chỉ dùng để hiển thị/định danh, KHÔNG dùng làm
  // tên file vì models/ không đặt tên theo tiền tố phòng.
  const glbCode = raw.model_code || raw.modelCode || raw.model || id
  return {
    id,
    title: raw.title || raw.name || raw.model_code || id,
    model: raw.model || raw.model_code || '',
    manufacturer: raw.manufacturer || '',
    departments: Array.isArray(raw.departments) ? raw.departments.join(', ') : (raw.departments || ''),
    category: raw.category || '',
    status: raw.status || '',
    story: raw.story || raw.description || '',
    thumbnail: raw.media?.images?.[0] || raw.thumbnail || '',
    buildingId: loc.building_id || raw.buildingId || raw.building_id || props.buildingId,
    floor: loc.floor ?? raw.floor ?? null,
    roomId: loc.room_id || raw.roomId || raw.room_id || props.roomId,
    stationId: loc.station_id || raw.stationId || '',
    modelUrl: raw.modelUrl || (glbCode ? `${base}models/${glbCode}.glb` : ''),
    has3DModel: !!(raw.modelUrl || raw.has3DModel || glbCode)
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
    console.error('[EquipmentSidePanel] Không thể tải danh sách thiết bị của phòng:', err)
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
      console.warn('[EquipmentSidePanel] Không lấy được chi tiết thiết bị, dùng dữ liệu rút gọn:', err)
    }
  }
  selectedMachine.value = m
}

const handleClose = () => {
  selectedMachine.value = null
  emit('close')
}

onMounted(() => {
  loadMachineList()
  // Bấm thẳng từ khối thiết bị trên map -> mở luôn view chi tiết, không cần
  // đợi/duyệt qua danh sách.
  if (props.initialEquipment) {
    selectMachine(normalizeMachine(props.initialEquipment))
  }
  // Không cần tự nạp <model-viewer> ở đây nữa — đã đăng ký sẵn lúc app khởi
  // động qua plugins/model-viewer.client.ts (import từ package npm thật,
  // không phụ thuộc CDN ngoài lúc runtime nữa).
})

// Nếu người dùng bấm sang khối thiết bị KHÁC trên map trong khi panel đang mở
// (RoomDetailPanel gọi lại openEquipment() với feature mới), cập nhật thẳng
// view chi tiết theo thiết bị mới đó.
watch(() => props.initialEquipment, (val) => {
  if (val) selectMachine(normalizeMachine(val))
})

watch(() => props.roomId, loadMachineList)
</script>

<style scoped>
/* Panel dock: bám ngay bên trái RoomDetailPanel (right: 400px = đúng bề rộng
   RoomDetailPanel — nếu đổi bề rộng panel phòng thì sửa luôn giá trị này).
   Không còn overlay/backdrop mờ phủ toàn màn hình như bản modal cũ. */
.side-panel {
  position: absolute;
  /* [FIX] top:0 trước đây đè lên AppHeader (z:30) vì z-index:99 cao hơn. */
  top: var(--header-h, 64px);
  right: 400px;
  width: 420px;
  height: calc(100vh - var(--header-h, 64px));
  background-color: #0b1120;
  border-left: 1px solid #1f2d40;
  box-shadow: -4px 0 15px rgba(0, 0, 0, 0.5);
  z-index: 99; /* Ngay dưới RoomDetailPanel (z:100), vẫn trên map/floor-bar */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
}

/* ===== Tier: tablet (641–1024px) =====
   Không đủ chỗ để dock cạnh RoomDetailPanel (vốn đã thu hẹp ở tier này) ->
   phủ lên trên như 1 overlay riêng, có backdrop đậm hơn (render trong template). */
.side-panel.tier-tablet {
  right: 0;
  width: min(400px, 92vw);
  z-index: 110; /* Trên RoomDetailPanel (z:100) vì đang che nó */
}

/* ===== Tier: mobile (<=640px) =====
   Bottom sheet riêng, z-index cao hơn RoomDetailPanel để "chồng" lên trên nó
   (không cần ẩn RoomDetailPanel bên dưới vì sheet có nền đặc, che kín). */
.side-panel.tier-mobile {
  top: auto;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  border-left: none;
  border-top: 1px solid #1f2d40;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
  z-index: 110;
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

/* Backdrop mờ dùng ở tier tablet/mobile (panel che RoomDetailPanel phía sau) */
.adaptive-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 12, 0.6);
  backdrop-filter: blur(2px);
}

/* Tay cầm kéo bottom-sheet trên mobile */
.adaptive-sheet-handle {
  width: 100%;
  padding: 10px 0 6px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
}
.adaptive-sheet-handle::before {
  content: '';
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: #334155;
}

/* ---- List view ---- */
.list-header {
  padding: 22px 24px 14px;
  border-bottom: 1px dashed #1f2d40;
  flex-shrink: 0;
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
  font-size: 17px;
  color: #fff;
}
.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
}
.state-msg, .empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 13px;
}
.machine-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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
  height: 90px;
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
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}
.machine-model {
  font-size: 10px;
  color: #94a3b8;
}

/* ---- Detail view: xếp DỌC (viewer trên, info dưới), toàn bộ panel cuộn chung ---- */
.back-btn {
  flex-shrink: 0;
  margin: 14px 20px 0;
  align-self: flex-start;
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

.detail-scroll {
  flex: 1;
  overflow-y: auto;
}
.viewer-frame {
  position: relative;
  height: 220px;
  margin: 14px 20px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #05070d;
  border: 1px solid #1f2d40;
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
  padding: 0 16px;
}
.no-model-placeholder p {
  margin: 0;
  font-weight: 600;
  color: #94a3b8;
  font-size: 13px;
}

.info-pane {
  padding: 20px;
}
.machine-title {
  margin: 4px 0 2px;
  font-size: 18px;
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

</style>
