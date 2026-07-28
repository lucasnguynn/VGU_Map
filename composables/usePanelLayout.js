// composables/usePanelLayout.js
//
// Nguồn sự thật DUY NHẤT cho toàn bộ layout panel bên trái.
// Tính toán tổng độ rộng đang chiếm của cột trái (BuildingsPanel + FloorPanel)
// và set vào CSS custom property --panels-left-width trên :root.
// Tất cả element cần biết "bao nhiêu không gian đã bị chiếm bên trái"
// (HUD bar, camera padding của MapLibre...) đều đọc từ var này thay vì
// tự tính riêng -> animation đồng bộ hoàn toàn, không bao giờ lệch.
//
// Sử dụng:
//   const { setPanelState } = usePanelLayout()
//   setPanelState({ buildingsVisible: true, buildingsCollapsed: false, floorVisible: true })

import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

// Kích thước panel — phải khớp với CSS trong từng component.
const BUILDINGS_WIDTH = 300   // desktop
const BUILDINGS_WIDTH_TAB = 280  // tablet (max-width: 1024px)
const BUILDINGS_TAB_BTN = 36  // nút toggle tab bám cạnh
const FLOOR_WIDTH = 280       // desktop
const FLOOR_WIDTH_TAB = 280   // tablet

// Singleton state — dùng chung giữa tất cả component
const _buildingsVisible = ref(true)
const _buildingsCollapsed = ref(false)
const _floorVisible = ref(false)

export function usePanelLayout() {
  function _recalc(windowWidth) {
    const isTablet = windowWidth <= 1024
    const isMobile = windowWidth <= 640

    if (isMobile) {
      // Mobile: panels là bottom sheet, không chiếm cột trái
      document.documentElement.style.setProperty('--panels-left-width', '0px')
      return
    }

    const bW = isTablet ? BUILDINGS_WIDTH_TAB : BUILDINGS_WIDTH
    const tabW = BUILDINGS_TAB_BTN

    let total = 0

    if (_buildingsVisible.value) {
      if (_buildingsCollapsed.value) {
        total = tabW  // chỉ còn cái tab nhỏ
      } else {
        total = bW + tabW
      }
    }

    if (_floorVisible.value && !_buildingsCollapsed.value) {
      const fW = isTablet ? FLOOR_WIDTH_TAB : FLOOR_WIDTH
      total += fW
    }

    document.documentElement.style.setProperty('--panels-left-width', total + 'px')
  }

  function setPanelState({ buildingsVisible, buildingsCollapsed, floorVisible }) {
    if (buildingsVisible !== undefined) _buildingsVisible.value = buildingsVisible
    if (buildingsCollapsed !== undefined) _buildingsCollapsed.value = buildingsCollapsed
    if (floorVisible !== undefined) _floorVisible.value = floorVisible
    if (typeof window !== 'undefined') _recalc(window.innerWidth)
  }

  onMounted(() => {
    _recalc(window.innerWidth)
    const onResize = () => _recalc(window.innerWidth)
    window.addEventListener('resize', onResize, { passive: true })
    onBeforeUnmount(() => window.removeEventListener('resize', onResize))
  })

  return {
    setPanelState,
    buildingsVisible: _buildingsVisible,
    buildingsCollapsed: _buildingsCollapsed,
    floorVisible: _floorVisible,
  }
}
