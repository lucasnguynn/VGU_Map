// composables/usePanelLayout.js
import { ref, onMounted, onBeforeUnmount } from 'vue'

const BUILDINGS_WIDTH = 300
const BUILDINGS_WIDTH_TAB = 280
const BUILDINGS_TAB_BTN = 36
const FLOOR_WIDTH = 280
const FLOOR_WIDTH_TAB = 280

const _buildingsVisible = ref(true)
const _buildingsCollapsed = ref(false)
const _floorVisible = ref(false)
// NEW: when RoomDetailPanel is open the left-side drawers collapse to icon-only
// so the map is visible between them. --panels-left-width drops to tab-only width.
const _roomDetailVisible = ref(false)

// ─── M-3: Module-scope resize listener with reference-count guard ─────────────
let _listenerRefCount = 0
let _onResize = null

function _attachResizeListener() {
  if (_listenerRefCount === 0) {
    _onResize = () => _recalc(window.innerWidth)
    window.addEventListener('resize', _onResize, { passive: true })
  }
  _listenerRefCount++
}

function _detachResizeListener() {
  _listenerRefCount--
  if (_listenerRefCount === 0 && _onResize) {
    window.removeEventListener('resize', _onResize)
    _onResize = null
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function _recalc(windowWidth) {
  const isTablet = windowWidth <= 1024
  const isMobile = windowWidth <= 640

  if (isMobile) {
    document.documentElement.style.setProperty('--panels-left-width', '0px')
    return
  }

  // When RoomDetailPanel is open, collapse everything left to tab-button only
  // so the 3D map is visible between the left drawers and the right detail panel.
  if (_roomDetailVisible.value) {
    document.documentElement.style.setProperty('--panels-left-width', BUILDINGS_TAB_BTN + 'px')
    return
  }

  const bW = isTablet ? BUILDINGS_WIDTH_TAB : BUILDINGS_WIDTH
  const tabW = BUILDINGS_TAB_BTN

  let total = 0
  if (_buildingsVisible.value) {
    total = _buildingsCollapsed.value ? tabW : bW + tabW
  }
  if (_floorVisible.value && !_buildingsCollapsed.value) {
    total += isTablet ? FLOOR_WIDTH_TAB : FLOOR_WIDTH
  }

  document.documentElement.style.setProperty('--panels-left-width', total + 'px')
}

export function usePanelLayout() {
  function setPanelState({ buildingsVisible, buildingsCollapsed, floorVisible, roomDetailVisible } = {}) {
    if (buildingsVisible !== undefined) _buildingsVisible.value = buildingsVisible
    if (buildingsCollapsed !== undefined) _buildingsCollapsed.value = buildingsCollapsed
    if (floorVisible !== undefined) _floorVisible.value = floorVisible
    if (roomDetailVisible !== undefined) _roomDetailVisible.value = roomDetailVisible
    if (typeof window !== 'undefined') _recalc(window.innerWidth)
  }

  // M-3 FIX: onMounted/onBeforeUnmount are called here in each component's setup(),
  // but the actual listener is only ever created/destroyed once (ref-counted at
  // module scope). N components calling usePanelLayout() = still only 1 listener.
  onMounted(() => {
    _attachResizeListener()
    _recalc(window.innerWidth)
  })
  onBeforeUnmount(() => {
    _detachResizeListener()
  })

  return {
    setPanelState,
    buildingsVisible: _buildingsVisible,
    buildingsCollapsed: _buildingsCollapsed,
    floorVisible: _floorVisible,
    roomDetailVisible: _roomDetailVisible,
  }
}
