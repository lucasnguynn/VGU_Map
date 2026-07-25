// composables/useBottomSheet.js
//
// Logic kéo-thả + snap cho panel dạng "bottom sheet" — chỉ dùng ở tier
// 'mobile' (xem useDeviceTier.js). Component chỉ cần:
//   1. Gắn @pointerdown="onDragStart" vào 1 tay cầm (drag handle) trên đỉnh sheet
//   2. Bind :style="sheetStyle" vào phần tử panel gốc (điều khiển chiều cao)
// Chạm nhẹ (không kéo) trên tay cầm = coi như "tap" -> toggle giữa 2 trạng
// thái peek (hé mở) / full (mở rộng). Kéo xuống quá đà = gọi onDismiss (nếu có).
import { ref, computed } from 'vue'

export function useBottomSheet({ peek = 0.42, full = 0.9, onDismiss } = {}) {
  const state = ref('peek') // 'peek' | 'full'
  const dragOffsetPx = ref(0)
  const isDragging = ref(false)

  let startY = 0
  let startHeightPx = 0

  const snapPx = (fraction) => (import.meta.client ? window.innerHeight : 800) * fraction

  const baseHeightPx = computed(() => snapPx(state.value === 'full' ? full : peek))

  const heightPx = computed(() => {
    const h = baseHeightPx.value - dragOffsetPx.value
    return Math.max(80, Math.min(h, snapPx(0.96)))
  })

  const sheetStyle = computed(() => ({
    height: heightPx.value + 'px',
    transition: isDragging.value ? 'none' : 'height 0.28s cubic-bezier(0.32, 0.72, 0, 1)'
  }))

  function onDragMove(e) {
    if (!isDragging.value) return
    dragOffsetPx.value = e.clientY - startY
  }

  function onDragEnd() {
    isDragging.value = false
    const finalHeight = Math.max(0, startHeightPx - dragOffsetPx.value)
    const movedPx = Math.abs(dragOffsetPx.value)
    dragOffsetPx.value = 0
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)

    // Di chuyển quá nhỏ -> coi là bấm (tap), không phải kéo thả.
    if (movedPx < 6) { toggle(); return }

    const peekPx = snapPx(peek)
    const fullPx = snapPx(full)
    if (finalHeight < peekPx * 0.55) {
      onDismiss && onDismiss()
      return
    }
    state.value = finalHeight > (peekPx + fullPx) / 2 ? 'full' : 'peek'
  }

  function onDragStart(e) {
    isDragging.value = true
    startY = e.clientY
    startHeightPx = heightPx.value
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }

  function toggle() {
    state.value = state.value === 'peek' ? 'full' : 'peek'
  }
  function setFull() { state.value = 'full' }
  function reset() { state.value = 'peek' }

  return { state, isDragging, sheetStyle, onDragStart, toggle, setFull, reset }
}
