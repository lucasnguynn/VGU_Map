<template>
  <!-- ── Backdrop: tablet/mobile only — click outside to close ── -->
  <div
    v-if="tier !== 'desktop'"
    class="adaptive-backdrop"
    style="z-index: 109"
    @click="handleClose"
  ></div>

  <!-- ── Root panel ── -->
  <div
    class="esp"
    :class="`tier-${tier}`"
    :style="tier === 'mobile' ? sheetStyle : null"
  >
    <!-- Mobile drag handle -->
    <div
      v-if="tier === 'mobile'"
      class="adaptive-sheet-handle"
      @pointerdown="onSheetDragStart"
    ></div>

    <!-- ================================================================
         VIEW 1 — EQUIPMENT LIST
         ================================================================ -->
    <template v-if="!selectedMachine">
      <!-- Header row: breadcrumb + close -->
      <header class="esp-header">
        <div class="esp-header__breadcrumb">
          <span class="esp-header__eyebrow">{{ roomLabel }}</span>
          <h2 class="esp-header__title">Thiết bị phòng học</h2>
        </div>
        <button class="esp-icon-btn" aria-label="Đóng" @click="handleClose">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <!-- List body -->
      <div class="esp-list-body">
        <!-- Loading -->
        <div v-if="isLoadingList" class="esp-state">
          <span class="esp-state__spinner"></span>
          <p>Đang tải danh sách thiết bị…</p>
        </div>

        <!-- Empty -->
        <div v-else-if="machines.length === 0" class="esp-state esp-state--empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <p>Chưa có thiết bị nào được ghi nhận cho phòng này.</p>
        </div>

        <!-- Machine cards -->
        <ul v-else class="esp-machine-list">
          <li v-for="m in machines" :key="m.id">
            <button class="esp-machine-card" @click="selectMachine(m)">
              <div class="esp-machine-card__thumb">
                <img v-if="m.thumbnail" :src="m.thumbnail" :alt="m.title" />
                <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.4">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
                <span v-if="m.has3DModel" class="esp-badge-3d">3D</span>
              </div>
              <div class="esp-machine-card__meta">
                <span class="esp-machine-card__name">{{ m.title }}</span>
                <span v-if="m.model" class="esp-machine-card__model">{{ m.model }}</span>
              </div>
              <svg class="esp-machine-card__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </li>
        </ul>
      </div>
    </template>

    <!-- ================================================================
         VIEW 2 — EQUIPMENT DETAIL
         ================================================================ -->
    <template v-else>
      <!-- Detail header: back + close — ONE combined header, no double buttons -->
      <header class="esp-header esp-header--detail">
        <button class="esp-back-btn" @click="selectedMachine = null">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span>Quay lại</span>
        </button>
        <button class="esp-icon-btn" aria-label="Đóng" @click="handleClose">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <!-- Scrollable detail content -->
      <div class="esp-detail-scroll">

        <!-- ── Media Viewer ── -->
        <div class="esp-viewer-wrap">
          <img
            v-if="viewMode === 'photo' && selectedMachine.photos[activePhotoIndex]"
            :src="selectedMachine.photos[activePhotoIndex]"
            :alt="selectedMachine.title"
            class="esp-viewer-img"
          />

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
            class="esp-viewer-model"
            @error="onModelError"
            @load="onModelLoad"
          >
            <div slot="progress-bar" class="esp-model-progress"></div>
            <div slot="poster" class="esp-model-loading">
              <span class="esp-state__spinner esp-state__spinner--sm"></span>
              <span>{{ statusText }}</span>
            </div>
          </model-viewer>

          <!-- Compact no-model state — not a dark void -->
          <div v-else class="esp-viewer-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.3">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <span>Chưa có mô hình 3D</span>
          </div>

          <div class="esp-viewer-gradient"></div>
        </div>

        <!-- ── Thumbnail strip ── -->
        <div
          v-if="(selectedMachine.modelUrl && !modelFailed) || selectedMachine.photos.length > 0"
          class="esp-thumbstrip"
        >
          <button
            v-if="selectedMachine.modelUrl && !modelFailed"
            class="esp-thumb"
            :class="{ 'esp-thumb--active': viewMode === 'model' }"
            title="Xem model 3D"
            @click="selectModelView"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <span>3D</span>
          </button>

          <button
            v-for="(photo, idx) in selectedMachine.photos"
            :key="idx"
            class="esp-thumb esp-thumb--photo"
            :class="{ 'esp-thumb--active': viewMode === 'photo' && activePhotoIndex === idx }"
            :title="`Ảnh ${idx + 1}`"
            @click="selectPhoto(idx)"
          >
            <img :src="photo" :alt="`${selectedMachine.title} ảnh ${idx + 1}`" />
          </button>
        </div>

        <!-- ── Info pane ── -->
        <div class="esp-info">
          <div class="esp-info__identity">
            <span v-if="selectedMachine.departments" class="esp-info__dept">{{ selectedMachine.departments }}</span>
            <h2 class="esp-info__name">{{ selectedMachine.title }}</h2>
            <p v-if="selectedMachine.model || selectedMachine.manufacturer" class="esp-info__sub">
              {{ selectedMachine.model }}<template v-if="selectedMachine.model && selectedMachine.manufacturer"> · </template>{{ selectedMachine.manufacturer }}
            </p>
            <div v-if="selectedMachine.status" class="esp-status" :class="`esp-status--${selectedMachine.status}`">
              <span class="esp-status__dot"></span>
              <span class="esp-status__label">{{ statusLabel(selectedMachine.status) }}</span>
            </div>
          </div>

          <dl class="esp-meta">
            <div class="esp-meta__row">
              <dt>MÔ TẢ</dt>
              <dd v-if="selectedMachine.story">{{ selectedMachine.story }}</dd>
              <dd v-else class="esp-meta__placeholder">Thông tin chi tiết sẽ được cập nhật sau.</dd>
            </div>
            <div v-if="selectedMachine.category" class="esp-meta__row">
              <dt>PHÂN LOẠI</dt>
              <dd>{{ selectedMachine.category }}</dd>
            </div>
            <div class="esp-meta__row">
              <dt>VỊ TRÍ</dt>
              <dd>{{ locationLabel(selectedMachine) }}</dd>
            </div>
          </dl>

          <p class="esp-footer-note">
            Thông số kỹ thuật, quy trình vận hành và lịch bảo trì sẽ được cập nhật trong phiên bản tiếp theo.
          </p>
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


<style scoped>
/* ============================================================
   EQUIPMENT SIDE PANEL — Premium Dark-Mode "Digital Twin" Styles
   Namespace prefix: .esp  (avoids all collisions with global CSS)
   Z-index layers: desktop 105, tablet/mobile 109
   ============================================================ */

/* ── Scoped design tokens ── */
.esp {
  --esp-bg:         #03111f;
  --esp-surface:    #071828;
  --esp-card:       rgba(255, 255, 255, 0.04);
  --esp-card-hover: rgba(245, 130, 32, 0.07);
  --esp-border:     rgba(255, 255, 255, 0.08);
  --esp-border-acc: rgba(245, 130, 32, 0.40);
  --esp-accent:     #F58220;
  --esp-ink-hi:     #FFFFFF;
  --esp-ink-mid:    #B3BFCD;
  --esp-ink-lo:     #56677F;
  --esp-radius:     12px;
  --esp-font:       'Be Vietnam Pro', sans-serif;
  --esp-mono:       'Space Mono', monospace;
}

/* ── Root panel container ── */
.esp {
  position: absolute;
  top: var(--header-h, 64px);
  right: 0;
  width: 420px;
  height: calc(100vh - var(--header-h, 64px));
  background: var(--esp-bg);
  border-left: 1px solid var(--esp-border);
  box-shadow: -8px 0 40px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  font-family: var(--esp-font);
  color: var(--esp-ink-mid);
  z-index: 105;
  overflow: hidden;
  animation: esp-slide-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes esp-slide-in {
  from { transform: translateX(28px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

/* ── Tier overrides ── */
.esp.tier-tablet {
  position: fixed;
  left: 0;
  width: 100%;
  border-left: none;
  z-index: 109;
}

.esp.tier-mobile {
  position: fixed;
  top: auto;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: auto;
  border-left: none;
  border-top: 1px solid var(--esp-border);
  border-radius: 18px 18px 0 0;
  z-index: 109;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* ============================================================
   SHARED HEADER (one per view, never doubled)
   ============================================================ */
.esp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 16px;
  border-bottom: 1px solid var(--esp-border);
  flex-shrink: 0;
  background: var(--esp-bg);
}

.esp-header--detail {
  padding: 12px 14px;
}

.esp-header__breadcrumb {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.esp-header__eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--esp-accent);
  font-family: var(--esp-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.esp-header__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--esp-ink-hi);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Icon close button (×) ── */
.esp-icon-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: transparent;
  border: 1px solid var(--esp-border);
  border-radius: 8px;
  color: var(--esp-ink-lo);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.esp-icon-btn:hover {
  background: rgba(248, 113, 113, 0.10);
  border-color: rgba(248, 113, 113, 0.35);
  color: #f87171;
}

/* ── Back button (← Quay lại) ── */
.esp-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px 7px 10px;
  background: transparent;
  border: 1px solid var(--esp-border);
  border-radius: 8px;
  color: var(--esp-ink-lo);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--esp-font);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.esp-back-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.20);
  color: var(--esp-ink-mid);
}
.esp-back-btn svg { transition: transform 0.15s; }
.esp-back-btn:hover svg { transform: translateX(-2px); }

/* ============================================================
   SHARED STATE (spinner / empty)
   ============================================================ */
.esp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 56px 24px;
  color: var(--esp-ink-lo);
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
}
.esp-state p { margin: 0; }

.esp-state__spinner {
  display: inline-block;
  width: 22px;
  height: 22px;
  border: 2px solid rgba(245, 130, 32, 0.18);
  border-top-color: var(--esp-accent);
  border-radius: 50%;
  animation: esp-spin 0.75s linear infinite;
  flex-shrink: 0;
}
.esp-state__spinner--sm {
  width: 15px;
  height: 15px;
}
@keyframes esp-spin { to { transform: rotate(360deg); } }

/* ============================================================
   VIEW 1 — EQUIPMENT LIST
   ============================================================ */
.esp-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  overscroll-behavior: contain;
}
.esp-list-body::-webkit-scrollbar { width: 4px; }
.esp-list-body::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.10);
  border-radius: 4px;
}

.esp-machine-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

/* ── Machine card ── */
.esp-machine-card {
  display: flex;
  align-items: center;
  gap: 13px;
  width: 100%;
  padding: 11px 13px;
  background: var(--esp-card);
  border: 1px solid var(--esp-border);
  border-radius: var(--esp-radius);
  color: inherit;
  font-family: var(--esp-font);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.18s,
    transform 0.14s cubic-bezier(0.22, 1, 0.36, 1);
}
.esp-machine-card:hover {
  background: var(--esp-card-hover);
  border-color: var(--esp-border-acc);
  transform: translateX(3px);
}

.esp-machine-card__thumb {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 37, 84, 0.55);
  border: 1px solid var(--esp-border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.esp-machine-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.esp-badge-3d {
  position: absolute;
  bottom: 3px;
  right: 3px;
  font-size: 8px;
  font-weight: 700;
  font-family: var(--esp-mono);
  background: var(--esp-accent);
  color: #fff;
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1.5;
}

.esp-machine-card__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.esp-machine-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--esp-ink-hi);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.esp-machine-card__model {
  font-size: 11px;
  color: var(--esp-ink-lo);
  font-family: var(--esp-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.esp-machine-card__chevron {
  flex-shrink: 0;
  color: var(--esp-ink-lo);
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
}
.esp-machine-card:hover .esp-machine-card__chevron {
  opacity: 1;
  transform: translateX(2px);
}

/* ============================================================
   VIEW 2 — EQUIPMENT DETAIL
   ============================================================ */
.esp-detail-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
}
.esp-detail-scroll::-webkit-scrollbar { width: 4px; }
.esp-detail-scroll::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.10);
  border-radius: 4px;
}

/* ── Media viewer ── */
.esp-viewer-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #020c16;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 0;          /* flush against header above */
}

.esp-viewer-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.esp-viewer-model {
  width: 100%;
  height: 100%;
  display: block;
  --poster-color: transparent;
}

/* Compact no-model fallback — tight, not a yawning void */
.esp-viewer-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--esp-ink-lo);
  font-size: 11px;
  font-family: var(--esp-mono);
  letter-spacing: 0.6px;
}

/* Bottom gradient bleeds info up over viewer */
.esp-viewer-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: linear-gradient(to bottom, transparent, var(--esp-bg));
  pointer-events: none;
}

.esp-model-progress { display: none; }

.esp-model-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  font-size: 12px;
  font-family: var(--esp-mono);
  color: var(--esp-ink-lo);
}

/* ── Thumbnail strip ── */
.esp-thumbstrip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.30);
  border-bottom: 1px solid var(--esp-border);
  overflow-x: auto;
  flex-shrink: 0;
}
.esp-thumbstrip::-webkit-scrollbar { height: 3px; }
.esp-thumbstrip::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 2px;
}

.esp-thumb {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 2px solid transparent;
  border-radius: 7px;
  background: rgba(255,255,255,0.05);
  color: var(--esp-ink-lo);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
}
.esp-thumb span {
  font-size: 8px;
  font-weight: 700;
  font-family: var(--esp-mono);
  line-height: 1;
}
.esp-thumb--photo { padding: 0; }
.esp-thumb--photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.esp-thumb:hover { border-color: rgba(245,130,32,0.50); }
.esp-thumb--active {
  border-color: var(--esp-accent);
  background: rgba(245,130,32,0.08);
}

/* ── Info pane ── */
.esp-info {
  display: flex;
  flex-direction: column;
  padding: 22px 20px 36px;
}

/* Identity block: name / model / status */
.esp-info__identity {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--esp-border);
  margin-bottom: 0;
}

.esp-info__dept {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--esp-accent);
  font-family: var(--esp-mono);
  margin-bottom: 7px;
}

.esp-info__name {
  margin: 0 0 5px;
  font-size: 19px;
  font-weight: 700;
  color: var(--esp-ink-hi);
  line-height: 1.25;
}

.esp-info__sub {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--esp-ink-lo);
  font-family: var(--esp-mono);
}

/* Status pill */
.esp-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  width: fit-content;
}
.esp-status--operational { background: rgba(34,197,94,0.08);  border-color: rgba(34,197,94,0.25); }
.esp-status--maintenance  { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.25); }
.esp-status--offline      { background: rgba(248,113,113,0.08);border-color: rgba(248,113,113,0.25); }

.esp-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.esp-status--operational .esp-status__dot { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,0.7); }
.esp-status--maintenance  .esp-status__dot { background: #f59e0b; box-shadow: 0 0 5px rgba(245,158,11,0.7); }
.esp-status--offline      .esp-status__dot { background: #f87171; box-shadow: 0 0 5px rgba(248,113,113,0.7); }

.esp-status__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--esp-ink-mid);
}

/* ── Metadata rows (<dl>) ── */
.esp-meta {
  margin: 0;
  display: flex;
  flex-direction: column;
}

.esp-meta__row {
  padding: 16px 0;
  border-bottom: 1px solid var(--esp-border);
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.esp-meta__row:last-child { border-bottom: none; }

.esp-meta__row dt {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--esp-ink-lo);
  font-family: var(--esp-mono);
}

.esp-meta__row dd {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--esp-ink-mid);
}

.esp-meta__placeholder {
  font-style: italic;
  color: var(--esp-ink-lo) !important;
}

/* Footer note */
.esp-footer-note {
  margin: 18px 0 0;
  padding: 11px 13px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.65;
  color: var(--esp-ink-lo);
  font-style: italic;
}

/* ============================================================
   REDUCED MOTION
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  .esp                         { animation: none; }
  .esp-machine-card            { transition: background 0.15s, border-color 0.15s; }
  .esp-back-btn svg            { transition: none; }
  .esp-state__spinner          { animation: none; opacity: 0.5; }
}
</style>
