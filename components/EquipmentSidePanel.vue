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
          <img
            v-if="viewMode === 'photo' && selectedMachine.photos[activePhotoIndex]"
            :src="selectedMachine.photos[activePhotoIndex]"
            :alt="selectedMachine.title"
            class="photo-viewer-el"
          />

          <!--
            [FIX-3] v-else-if now guards on a non-empty modelUrl AND modelFailed=false.
            activeModelSrc is the single source of truth for the <src> attribute;
            it starts as modelUrl and is swapped to the fallback path on first error.
            The :key forces a full remount when the user switches to a different machine
            so stale error/load state from the previous model cannot bleed through.
          -->
          <model-viewer
            v-else-if="selectedMachine.modelUrl && !modelFailed"
            :key="selectedMachine.id + '-' + activeModelSrc"
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

        <!-- Dải thumbnail: ô đầu để quay lại xem model 3D, các ô sau là ảnh
             thực tế của thiết bị (nếu có). Chỉ hiện khi có ít nhất 1 trong 2
             (model hoặc ảnh) để tránh 1 dải rỗng vô nghĩa. -->
        <div
          v-if="(selectedMachine.modelUrl && !modelFailed) || selectedMachine.photos.length > 0"
          class="media-thumbstrip"
        >
          <button
            v-if="selectedMachine.modelUrl && !modelFailed"
            class="thumb-btn"
            :class="{ active: viewMode === 'model' }"
            title="Xem model 3D"
            @click="selectModelView"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>3D</span>
          </button>

          <button
            v-for="(photo, idx) in selectedMachine.photos"
            :key="idx"
            class="thumb-btn thumb-photo"
            :class="{ active: viewMode === 'photo' && activePhotoIndex === idx }"
            title="Xem ảnh thực tế"
            @click="selectPhoto(idx)"
          >
            <img :src="photo" :alt="`${selectedMachine.title} ảnh ${idx + 1}`" />
          </button>
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
const { sheetStyle, onDragStart: onSheetDragStart } = useBottomSheet({ peek: 0.7, full: 0.94, onDismiss: () => handleClose() })

const props = defineProps({
  roomId: { type: String, default: null },
  buildingId: { type: String, default: null },
  roomName: { type: String, default: '' },
  instruments: { type: Array, default: () => [] },
  initialEquipment: { type: Object, default: null }
})

const emit = defineEmits(['close'])

const config = useRuntimeConfig()

// ---------------------------------------------------------------------------
// [FIX-1] Robust base-URL helper.
// useRuntimeConfig().app.baseURL is '/VGU_Map/' in production, but could be
// '/' in dev or missing a trailing slash in edge cases. Always normalise to
// have exactly one trailing slash so path concatenation is safe everywhere.
// ---------------------------------------------------------------------------
const base = computed(() => {
  const raw = config.app.baseURL || '/'
  return raw.endsWith('/') ? raw : raw + '/'
})

// ---------------------------------------------------------------------------
// [FIX-2] Model URL builder using the normalised base.
// Using withBase from #app would work too, but base.value is simpler here
// since the value is stable after hydration.
// ---------------------------------------------------------------------------
const resolveModel = (glbCode) => {
  if (!glbCode) return ''
  return `${base.value}models/${glbCode}.glb`
}

const { getEquipmentListByRoom, getEquipmentInfo } = useVguData()

const isLoadingList = ref(false)
const machines = ref([])
const selectedMachine = ref(null)

const modelFailed = ref(false)
const triedFallback = ref(false)
const statusText = ref('Đang tải mô hình 3D…')
const activeModelSrc = ref('')
const viewMode = ref('model')
const activePhotoIndex = ref(0)
const selectPhoto = (index) => { viewMode.value = 'photo'; activePhotoIndex.value = index }
const selectModelView = () => { viewMode.value = 'model' }
let modelTimeoutId = null
const MODEL_LOAD_TIMEOUT_MS = 12000

// ---------------------------------------------------------------------------
// [FIX-3] Fallback model path: swap models/{code}.glb → models/models/{code}.glb.
// Only computed from the active primary modelUrl, not from `base` again, so
// it can't produce a double-base prefix.
// ---------------------------------------------------------------------------
const fallbackModelSrc = computed(() => {
  const primary = selectedMachine.value?.modelUrl
  if (!primary) return ''
  // Replace the last occurrence of "models/{file}.glb" with "models/models/{file}.glb"
  return primary.replace(/models\/([^/]+\.glb)$/, 'models/models/$1')
})

const clearModelTimeout = () => {
  if (modelTimeoutId) { clearTimeout(modelTimeoutId); modelTimeoutId = null }
}

const onModelError = () => {
  if (!triedFallback.value && fallbackModelSrc.value && fallbackModelSrc.value !== activeModelSrc.value) {
    console.warn('[EquipmentSidePanel] Primary path failed, trying fallback:',
      selectedMachine.value?.modelUrl, '->', fallbackModelSrc.value)
    triedFallback.value = true
    statusText.value = 'Đang thử lại đường dẫn phụ…'
    activeModelSrc.value = fallbackModelSrc.value
    armModelTimeout()
    return
  }
  console.warn('[EquipmentSidePanel] Both model paths failed:',
    selectedMachine.value?.modelUrl, '|', fallbackModelSrc.value)
  clearModelTimeout()
  modelFailed.value = true
}

const onModelLoad = () => { clearModelTimeout() }

const armModelTimeout = () => {
  clearModelTimeout()
  modelTimeoutId = setTimeout(() => {
    console.warn('[EquipmentSidePanel] Model load timed out:', activeModelSrc.value)
    onModelError()
  }, MODEL_LOAD_TIMEOUT_MS)
}

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
  const map = { operational: 'Đang hoạt động', maintenance: 'Đang bảo trì', offline: 'Ngưng hoạt động' }
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

// ---------------------------------------------------------------------------
// [FIX-4] normalizeMachine: handle the { equipmentId, roomId, properties:{} }
// wrapper shape emitted by HologramMap when the user clicks an equipment polygon.
//
// ROOT CAUSE of the original bug:
//   HologramMap emits: { equipmentId, roomId, properties: { equipment_id, model_code, ... } }
//   RoomDetailPanel stores that object verbatim in initialEquipment.
//   EquipmentSidePanel calls normalizeMachine(props.initialEquipment).
//   normalizeMachine reads raw.model_code — which is UNDEFINED because the real
//   data is nested one level deeper inside raw.properties.
//   → glbCode = undefined → modelUrl = '' → v-else-if condition is falsy
//   → "Chưa có mô hình 3D" fallback shown immediately for EVERY equipment,
//     even those that have a valid .glb file on the server.
//
// FIX: if the incoming raw object has a `.properties` sub-object but is missing
// the flat equipment fields (equipment_id / model_code), merge properties UP into
// raw so every downstream lookup finds the right values at the top level.
// ---------------------------------------------------------------------------
const normalizeMachine = (raw) => {
  if (!raw) return null

  // Unwrap GeoJSON feature-properties wrapper: { equipmentId, roomId, properties: {...} }
  // Guard: only flatten when properties has the equipment shape AND the flat
  // fields are absent, so we never overwrite a legitimately flat object that
  // happens to also carry a `properties` key for some other reason.
  if (
    raw.properties &&
    typeof raw.properties === 'object' &&
    !raw.equipment_id &&
    !raw.model_code &&
    !raw.id
  ) {
    raw = { ...raw, ...raw.properties }
  }

  const id = raw.id || raw.equipment_id || raw.slug || raw.name

  // model_code is the short identifier that matches the .glb filename (e.g. "E16").
  // equipment_id is the fully-qualified id (e.g. "B5-105_E16") — do NOT use as filename.
  const glbCode = raw.model_code || raw.modelCode || raw.model || id

  return {
    id,
    title: raw.title || raw.name || raw.model_code || raw.equipment_id || id,
    model: raw.model || raw.model_code || '',
    manufacturer: raw.manufacturer || '',
    departments: Array.isArray(raw.departments) ? raw.departments.join(', ') : (raw.departments || ''),
    category: raw.category || '',
    status: raw.status || '',
    story: raw.story || raw.description || '',
    thumbnail: raw.media?.images?.[0] || raw.thumbnail || '',
    photos: raw.media?.images || raw.photos || (raw.thumbnail ? [raw.thumbnail] : (raw.image ? [raw.image] : [])),
    buildingId: raw.location?.building_id || raw.buildingId || raw.building_id || props.buildingId,
    floor: raw.location?.floor ?? raw.floor ?? null,
    roomId: raw.location?.room_id || raw.roomId || raw.room_id || props.roomId,
    stationId: raw.location?.station_id || raw.stationId || '',
    // [FIX-2] Use resolveModel() so the URL is always built against the correct
    // GitHub Pages base path. raw.modelUrl is respected if already absolute
    // (e.g. from a Nuxt Content markdown file that stores the full URL).
    modelUrl: raw.modelUrl || resolveModel(glbCode),
    // has3DModel: true when a model_code exists (indicating a .glb is intended).
    // The viewer + error/timeout flow handles missing files gracefully.
    has3DModel: !!(raw.modelUrl || raw.has3DModel || glbCode)
  }
}

// ---------------------------------------------------------------------------
// [FIX-5] loadMachineList: add GeoJSON as primary data source.
//
// The original code only queried Nuxt Content (content/equipment/) which has
// almost no entries (only one test markdown file). The actual equipment data
// for rooms like B5-105 lives in public/data/equipment/{roomId}.geojson —
// exactly the same files HologramMap uses to draw the equipment layer on the
// map. Adding a $fetch for that file ensures the machine list in the panel
// matches what the user sees drawn on the floor plan.
// ---------------------------------------------------------------------------
const loadMachineList = async () => {
  if (!props.roomId) return
  isLoadingList.value = true
  try {
    let list = []

    // 1) Nuxt Content: markdown-defined equipment (rich metadata, few entries)
    if (typeof getEquipmentListByRoom === 'function') {
      list = await getEquipmentListByRoom(props.roomId)
    }

    // 2) GeoJSON equipment file: the canonical map-layer source for room equipment
    if (!list || list.length === 0) {
      try {
        const geojson = await $fetch(
          `${base.value}data/equipment/${props.roomId}.geojson`
        )
        if (geojson?.features?.length > 0) {
          // Each feature.properties has: equipment_id, model_code, room_id, building_id, floor
          list = geojson.features.map(f => f.properties || f)
        }
      } catch (_) {
        // No GeoJSON for this room — that is expected for rooms without mapped equipment
      }
    }

    // 3) instruments prop: legacy fallback from room markdown's instruments list
    if ((!list || list.length === 0) && props.instruments.length > 0) {
      list = props.instruments
    }

    machines.value = (list || []).map(normalizeMachine).filter(Boolean)
  } catch (err) {
    console.error('[EquipmentSidePanel] Cannot load equipment list for room:', err)
    machines.value = props.instruments.map(normalizeMachine).filter(Boolean)
  } finally {
    isLoadingList.value = false
  }
}

const selectMachine = async (m) => {
  viewMode.value = 'model'
  activePhotoIndex.value = 0
  // Attempt to enrich from Nuxt Content (e.g. the spectrometer-01.md file)
  if (typeof getEquipmentInfo === 'function' && m.id) {
    try {
      const full = await getEquipmentInfo(m.id)
      if (full) {
        selectedMachine.value = normalizeMachine({ ...full, id: m.id })
        return
      }
    } catch (err) {
      console.warn('[EquipmentSidePanel] Could not fetch full equipment detail, using summary:', err)
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
  if (props.initialEquipment) {
    // normalizeMachine now handles the { equipmentId, roomId, properties:{} } wrapper
    selectMachine(normalizeMachine(props.initialEquipment))
  }
})

watch(() => props.initialEquipment, (val) => {
  if (val) selectMachine(normalizeMachine(val))
})

watch(() => props.roomId, loadMachineList)
</script>
