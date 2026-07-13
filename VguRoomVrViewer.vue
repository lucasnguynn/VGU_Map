<template>
  <div ref="containerRef" class="relative w-full h-full overflow-hidden bg-[#060A14] select-none">
    <!-- WebGL Canvas -->
    <canvas
      ref="canvasRef"
      class="w-full h-full outline-none block"
      :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
    ></canvas>

    <!-- Loading Screen -->
    <Transition name="fade-loading">
      <div v-if="loading" class="absolute inset-0 bg-[#060A14] flex flex-col items-center justify-center z-30">
        <div class="flex flex-col items-center gap-5 max-w-xs w-full px-8">
          <!-- Animated ring -->
          <div class="relative w-16 h-16">
            <div class="absolute inset-0 rounded-full border-2 border-white/5"></div>
            <div class="absolute inset-0 rounded-full border-2 border-t-[#06B6D4] border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            <div class="absolute inset-2 rounded-full border border-[#EF5A24]/30 animate-pulse"></div>
          </div>

          <!-- Label -->
          <div class="flex flex-col items-center gap-2 w-full">
            <span class="text-[10px] font-mono text-[#06B6D4] font-bold tracking-widest uppercase">
              LOADING 360° VIEW
            </span>

            <!-- Progress Bar -->
            <div class="w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-[#EF5A24] to-[#06B6D4] transition-all duration-200 rounded-full"
                :style="{ width: `${loadProgress}%` }"
              ></div>
            </div>
            <span class="text-[9px] font-mono text-white/30 tracking-wider">{{ loadProgress }}%</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Error Screen -->
    <div v-if="loadError" class="absolute inset-0 bg-[#060A14] flex flex-col items-center justify-center z-30 gap-4 p-8">
      <UIcon name="i-lucide-image-off" class="w-10 h-10 text-red-400/60" />
      <div class="text-center">
        <div class="text-sm font-bold text-white/70">Panorama Unavailable</div>
        <div class="text-xs text-white/30 mt-1">{{ loadError }}</div>
      </div>
    </div>

    <!-- Minimal HUD — top left -->
    <div
      v-if="!loading && !loadError"
      class="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-2 rounded-lg border border-white/5"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-[#EF5A24] animate-ping shrink-0"></span>
      <span class="text-[9px] font-mono text-[#06B6D4]/90 font-bold tracking-widest uppercase">
        360° PANORAMA — {{ roomLabel }}
      </span>
    </div>

    <!-- Drag hint — fades out after first interaction -->
    <Transition name="fade-hint">
      <div
        v-if="showHint && !loading && !loadError"
        class="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5"
      >
        <div class="flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <UIcon name="i-lucide-move" class="w-3.5 h-3.5 text-white/50" />
          <span class="text-[10px] font-mono text-white/50 tracking-wider">Drag to look around</span>
        </div>
      </div>
    </Transition>

    <!-- VR Button (only if WebXR available) -->
    <button
      v-if="!loading && !loadError && vrSupported"
      @click="enterVR"
      class="absolute bottom-6 right-6 z-20 flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#EF5A24]/40 bg-[#EF5A24]/10 text-[#EF5A24] font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[#EF5A24]/25 transition-all cursor-pointer backdrop-blur-md"
    >
      <UIcon name="i-lucide-glasses" class="w-3.5 h-3.5" />
      <span>VR Mode</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  room: {
    type: Object,
    required: true
  },
  panoramaUrl: {
    type: String,
    required: true
  }
})

// ─── Refs ────────────────────────────────────────────────────────────────────
const containerRef = ref(null)
const canvasRef = ref(null)
const loading = ref(true)
const loadProgress = ref(0)
const loadError = ref(null)
const isDragging = ref(false)
const vrSupported = ref(false)
const showHint = ref(true)

// ─── Computed ─────────────────────────────────────────────────────────────────
const roomLabel = computed(() => {
  if (!props.room) return ''
  return (props.room.room_id || props.room.name || '').toUpperCase()
})

// ─── Three.js state (non-reactive raw vars) ──────────────────────────────────
let THREE = null
let OrbitControls = null

let scene = null
let camera = null
let renderer = null
let controls = null
let animFrameId = null
let resizeObserver = null

// ─── Core Functions ───────────────────────────────────────────────────────────

async function init() {
  if (!containerRef.value || !canvasRef.value) return

  const w = containerRef.value.clientWidth || window.innerWidth
  const h = containerRef.value.clientHeight || window.innerHeight

  // --- Scene ---
  scene = new THREE.Scene()

  // --- Camera inside sphere ---
  camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000)
  camera.position.set(0, 0, 0)

  // --- Renderer ---
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // --- WebXR check ---
  if (typeof navigator !== 'undefined' && navigator.xr) {
    try {
      vrSupported.value = await navigator.xr.isSessionSupported('immersive-vr')
      if (vrSupported.value) renderer.xr.enabled = true
    } catch (_) {}
  }

  // --- OrbitControls: look-around-from-center config ---
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.04
  controls.enablePan = false
  controls.enableZoom = false          // pure look-around, no zoom
  controls.rotateSpeed = -0.4          // invert so it feels like you're looking around
  controls.minDistance = 0.01
  controls.maxDistance = 0.01
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.25

  // Stop auto-rotate on first user interaction
  renderer.domElement.addEventListener('mousedown', onInteractionStart, { once: false })
  renderer.domElement.addEventListener('touchstart', onInteractionStart, { passive: true, once: false })

  // --- Load the equirectangular panorama ---
  loadPanorama(props.panoramaUrl)

  // --- Resize observer ---
  resizeObserver = new ResizeObserver(() => onResize())
  resizeObserver.observe(containerRef.value)
}

function loadPanorama(url) {
  loadProgress.value = 0
  loadError.value = null
  loading.value = true

  const loader = new THREE.TextureLoader()
  loader.load(
    url,
    (texture) => {
      // Proper color space
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter

      // Build inside-out sphere — camera sits at origin, sees the inner surface
      const geom = new THREE.SphereGeometry(500, 60, 40)
      geom.scale(-1, 1, 1)   // flip normals inside-out

      const mat = new THREE.MeshBasicMaterial({ map: texture })
      const sphere = new THREE.Mesh(geom, mat)
      scene.add(sphere)

      loadProgress.value = 100
      loading.value = false
      animate()
    },
    (xhr) => {
      if (xhr.total > 0) {
        loadProgress.value = Math.min(Math.floor((xhr.loaded / xhr.total) * 100), 99)
      } else {
        // indeterminate
        loadProgress.value = Math.min(loadProgress.value + 2, 90)
      }
    },
    (err) => {
      console.error('[VguRoomVrViewer] Failed to load panorama:', url, err)
      loadError.value = `Could not load panorama image.`
      loading.value = false
    }
  )
}

function animate() {
  animFrameId = requestAnimationFrame(animate)
  controls?.update()
  renderer?.render(scene, camera)
}

function onResize() {
  if (!containerRef.value || !camera || !renderer) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

let hintTimer = null

function onInteractionStart() {
  // Stop auto-rotation on first touch/click
  if (controls) {
    controls.autoRotate = false
    isDragging.value = true
  }

  // Hide hint
  if (showHint.value) {
    showHint.value = false
    if (hintTimer) clearTimeout(hintTimer)
  }
}

function enterVR() {
  if (!renderer?.xr || !navigator.xr) return
  navigator.xr
    .requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] })
    .then(session => renderer.xr.setSession(session))
    .catch(err => console.warn('[VguRoomVrViewer] WebXR failed:', err))
}

function dispose() {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (resizeObserver) resizeObserver.disconnect()
  if (hintTimer) clearTimeout(hintTimer)

  if (scene) {
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose()
        obj.material.dispose()
      }
    })
  }

  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss?.()
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  // Dynamically import Three.js (SSR-safe)
  const [threeMod, controlsMod] = await Promise.all([
    import('three'),
    import('three/examples/jsm/controls/OrbitControls.js')
  ])
  THREE = threeMod
  OrbitControls = controlsMod.OrbitControls

  await init()

  // Auto-hide hint after 5s
  hintTimer = setTimeout(() => { showHint.value = false }, 5000)
})

onUnmounted(() => {
  dispose()
})

// Reload panorama if URL changes
watch(() => props.panoramaUrl, (newUrl) => {
  if (!THREE || !scene) return
  // Clear existing meshes
  while (scene.children.length > 0) {
    const obj = scene.children[0]
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      if (obj.material.map) obj.material.map.dispose()
      obj.material.dispose()
    }
    scene.remove(obj)
  }
  loadPanorama(newUrl)
})
</script>

<style scoped>
.fade-loading-enter-active,
.fade-loading-leave-active {
  transition: opacity 0.6s ease;
}
.fade-loading-enter-from,
.fade-loading-leave-to {
  opacity: 0;
}

.fade-hint-enter-active,
.fade-hint-leave-active {
  transition: opacity 0.8s ease;
}
.fade-hint-enter-from,
.fade-hint-leave-to {
  opacity: 0;
}
</style>
