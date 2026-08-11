// composables/usePanelLayout.js
//
// Nguồn sự thật DUY NHẤT cho toàn bộ layout panel bên trái.
// Tính toán tổng độ rộng cột trái và set vào CSS custom property --panels-left-width.

// M-3 FIX: import chỉ còn ref — onMounted/onBeforeUnmount đã chuyển ra module scope.
import { ref } from 'vue'

const BUILDINGS_WIDTH = 300
const BUILDINGS_WIDTH_TAB = 280
const BUILDINGS_TAB_BTN = 36
const FLOOR_WIDTH = 280
const FLOOR_WIDTH_TAB = 280

// Singleton reactive state
const _buildingsVisible = ref(true)
const _buildingsCollapsed = ref(false)
const _floorVisible = ref(false)

// ─── M-3: Module-scope resize listener với reference-count guard ──────────────
// Vấn đề cũ: mỗi component gọi usePanelLayout() lại đăng ký 1 listener riêng
// bên trong onMounted() → N component = N listener chạy song song, gây tính
// toán thừa và leak bộ nhớ khi component unmount không đúng thứ tự.
// Fix: 1 listener duy nhất ở module scope, chỉ đăng ký khi ref-count đi từ 0→1
// và chỉ gỡ khi ref-count về 0, bất kể bao nhiêu component dùng composable này.
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
  function setPanelState({ buildingsVisible, buildingsCollapsed, floorVisible } = {}) {
    if (buildingsVisible !== undefined) _buildingsVisible.value = buildingsVisible
    if (buildingsCollapsed !== undefined) _buildingsCollapsed.value = buildingsCollapsed
    if (floorVisible !== undefined) _floorVisible.value = floorVisible
    if (typeof window !== 'undefined') _recalc(window.innerWidth)
  }

  // M-3 FIX: lifecycle hooks hợp lệ (được gọi trong setup() của component),
  // nhưng listener thật chỉ được tạo/huỷ 1 lần ở module scope nhờ ref-count.
  if (typeof window !== 'undefined') {
    // Dùng import động để tránh lỗi SSR (onMounted không tồn tại ngoài component)
    import('vue').then(({ onMounted, onBeforeUnmount }) => {
      onMounted(() => {
        _attachResizeListener()
        _recalc(window.innerWidth)
      })
      onBeforeUnmount(() => {
        _detachResizeListener()
      })
    })
  }

  return {
    setPanelState,
    buildingsVisible: _buildingsVisible,
    buildingsCollapsed: _buildingsCollapsed,
    floorVisible: _floorVisible,
  }
}
