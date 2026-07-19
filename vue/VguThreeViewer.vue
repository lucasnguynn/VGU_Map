<template>
  <div ref="containerRef" class="relative w-full h-full overflow-hidden bg-[#070A12]">
    <!-- WebGL Canvas -->
    <canvas ref="canvasRef" class="w-full h-full select-none outline-none block"></canvas>

    <!-- Cyber loading overlay -->
    <div v-if="loading" class="absolute inset-0 bg-[#070A12] flex flex-col items-center justify-center z-30">
      <div class="absolute inset-0 opacity-5 cyber-grid"></div>
      <div class="flex flex-col items-center gap-4 max-w-xs w-full px-6">
        <span class="text-[10px] font-technical text-[#06B6D4] font-extrabold tracking-widest uppercase">
          SYS_LOAD: INITIALIZING_3D_VIEWPORT
        </span>
        <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/10 relative">
          <div 
            class="h-full bg-gradient-to-r from-[#EF5A24] to-[#06B6D4] transition-all duration-300" 
            :style="{ width: `${loadingProgress}%` }"
          ></div>
        </div>
        <span class="text-[9px] font-technical text-white/50 tracking-wider">
          TELEMETRY_STREAM: {{ loadingProgress }}%
        </span>
      </div>
    </div>

    <!-- Error message display -->
    <div v-if="error" class="absolute inset-0 bg-[#070A12] flex flex-col items-center justify-center z-30 px-6 text-center">
      <UIcon name="i-lucide-alert-triangle" class="w-8 h-8 text-[#EF5A24] mb-3" />
      <span class="text-[10px] font-technical text-[#EF5A24] font-extrabold tracking-widest uppercase">
        LOAD_ERROR: INTERACTIVE_3D_FAULT
      </span>
      <p class="text-xs text-white/60 mt-2 max-w-sm font-sans">{{ error }}</p>
    </div>

    <!-- Cyber HUD Overlays -->
    <div 
      v-if="!loading && !error && show3dHud" 
      class="absolute top-3 left-3 z-20 flex flex-col gap-0.5 text-[8px] font-technical text-[#06B6D4]/70 bg-[#070A12]/92 px-2 py-1.5 rounded border border-[#06B6D4]/30 backdrop-blur-md pointer-events-auto select-none"
    >
      <div class="flex items-center justify-between gap-4 w-full border-b border-[#06B6D4]/20 pb-0.5 mb-0.5">
        <span class="text-[7px] text-[#EF5A24] font-bold">3D TELEMETRY</span>
        <button @click="show3dHud = false" class="text-white/40 hover:text-white cursor-pointer select-none pointer-events-auto">✕</button>
      </div>
      <div>SYS_STATUS: ONLINE</div>
      <div>RENDER_ENGINE: WEBGL_2</div>
      <div>MODEL_MESHES: {{ meshCount }}</div>
      <div>ACTIVE_SHADING: {{ renderMode === 'hologram' ? 'WIREFRAME_MATRIX' : 'PBR_METALLIC' }}</div>
      <div>ROTATION: {{ autoRotate ? '0.15_RAD_S' : 'STATIC' }}</div>
    </div>

    <!-- Small Floating Toggle Button if HUD is hidden -->
    <button 
      v-if="!loading && !error && !show3dHud"
      @click="show3dHud = true"
      class="absolute top-3 left-3 z-20 p-1.5 rounded bg-black/60 hover:bg-black border border-white/10 hover:border-[#06B6D4]/50 text-[#06B6D4] cursor-pointer pointer-events-auto flex items-center justify-center transition-all duration-200"
      title="Show Telemetry HUD"
    >
      <UIcon name="i-lucide-terminal" class="w-3.5 h-3.5" />
    </button>

    <!-- Controls Bar -->
    <div 
      v-if="!loading && !error && show3dHud" 
      class="absolute bottom-3 left-3 right-3 landscape:bottom-2 landscape:left-2 landscape:right-2 z-20 flex justify-between items-end gap-4 pointer-events-none select-none"
    >
      <div class="flex gap-2 pointer-events-auto">
        <!-- Shading Mode Button -->
        <button 
          @click="toggleRenderMode"
          class="px-3 py-1.5 landscape:px-2 landscape:py-1 rounded border font-technical text-[9px] font-bold tracking-widest uppercase transition-all backdrop-blur-md select-none cursor-pointer"
          :class="renderMode === 'hologram' 
            ? 'bg-[#06B6D4]/10 border-[#06B6D4] text-[#06B6D4] shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
            : 'bg-[#070A12]/85 border-white/10 text-white/70 hover:border-white/30 hover:text-white'"
        >
          MODE: {{ renderMode }}
        </button>

        <!-- Rotation Toggle Button -->
        <button 
          @click="toggleAutoRotate"
          class="px-3 py-1.5 landscape:px-2 landscape:py-1 rounded border font-technical text-[9px] font-bold tracking-widest uppercase transition-all backdrop-blur-md select-none cursor-pointer"
          :class="autoRotate 
            ? 'bg-[#EF5A24]/10 border-[#EF5A24] text-[#EF5A24] shadow-[0_0_10px_rgba(239,90,36,0.3)]' 
            : 'bg-[#070A12]/85 border-white/10 text-white/70 hover:border-white/30 hover:text-white'"
        >
          ROTATION: {{ autoRotate ? 'ON' : 'OFF' }}
        </button>
      </div>

      <!-- Drag Hint -->
      <div class="bg-black/85 px-3 py-1 landscape:px-2 landscape:py-0.5 rounded text-[9px] landscape:text-[8px] font-technical text-[#06B6D4] border border-[#06B6D4]/30 backdrop-blur-sm pointer-events-none">
        DRAG TO ROTATE 3D MODEL
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  initialRenderMode: {
    type: String,
    default: 'realistic',
    validator: (val) => ['realistic', 'hologram'].includes(val)
  },
  initialAutoRotate: {
    type: Boolean,
    default: true
  }
})

const containerRef = ref(null)
const canvasRef = ref(null)

const loading = ref(true)
const loadingProgress = ref(0)
const error = ref(null)
const meshCount = ref(0)

const renderMode = ref(props.initialRenderMode)
const autoRotate = ref(props.initialAutoRotate)
const show3dHud = ref(typeof window !== 'undefined' ? (window.innerWidth > 768 && window.innerHeight > 500) : true)

let THREE = null
let OrbitControls = null
let GLTFLoader = null

// Three.js instances
let scene = null
let camera = null
let renderer = null
let controls = null
let currentModel = null
let animationFrameId = null
let resizeObserver = null

// Cyberpunk elements
let gridHelper = null
let scanLine = null
let scanDirection = 1
let scanYMin = -1
let scanYMax = 1

function toggleRenderMode() {
  renderMode.value = renderMode.value === 'hologram' ? 'realistic' : 'hologram'
}

function toggleAutoRotate() {
  autoRotate.value = !autoRotate.value
}

// Watchers to update rendering states dynamically
watch(renderMode, (newMode) => {
  applyRenderMode(newMode)
})

watch(autoRotate, (newRotate) => {
  if (controls) {
    controls.autoRotate = newRotate
  }
})

// Deep material replacement for Hologram wireframe matrix
function applyRenderMode(mode) {
  if (!currentModel || !THREE) return

  currentModel.traverse((child) => {
    if (child.isMesh) {
      if (mode === 'hologram') {
        // Backup original material
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material
        }
        
        // Apply wireframe glowing material
        child.material = new THREE.MeshBasicMaterial({
          color: 0x06B6D4,
          wireframe: true,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      } else {
        // Restore original material
        if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial
        }
      }
    }
  })

  // Show/Hide grid floor and scanline based on mode
  if (gridHelper) {
    gridHelper.material.opacity = mode === 'hologram' ? 0.6 : 0.15
  }
  if (scanLine) {
    scanLine.visible = mode === 'hologram'
  }
}

async function initScene() {
  try {
    const width = containerRef.value.clientWidth || 300
    const height = containerRef.value.clientHeight || 300

    // 1. Create Scene
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070a12)
    // Add light fog to soften edge distances
    scene.fog = new THREE.FogExp2(0x070a12, 0.04)

    // 2. Setup Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 0, 5)

    // 3. Setup Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0

    // 4. Ambient & Dual Neon Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
    keyLight.position.set(5, 8, 5)
    scene.add(keyLight)

    // Rim point lights (Cyan / Orange)
    const cyanLight = new THREE.PointLight(0x06b6d4, 1.5, 15)
    cyanLight.position.set(-4, 2, -4)
    scene.add(cyanLight)

    const orangeLight = new THREE.PointLight(0xef5a24, 1.8, 15)
    orangeLight.position.set(4, -2, 4)
    scene.add(orangeLight)

    // 5. Controls
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2 + 0.1 // Prevent looking fully upside down
    controls.minDistance = 1
    controls.maxDistance = 15
    controls.autoRotate = autoRotate.value
    controls.autoRotateSpeed = 1.2

    // 6. Base grid helper (Floor matrix)
    gridHelper = new THREE.GridHelper(10, 24, 0xef5a24, 0x06b6d4)
    gridHelper.position.y = -1.2
    gridHelper.material.transparent = true
    gridHelper.material.opacity = renderMode.value === 'hologram' ? 0.6 : 0.15
    scene.add(gridHelper)

    // 7. Load GLB Model
    const loader = new GLTFLoader()
    loader.load(
      props.src,
      (gltf) => {
        const model = gltf.scene
        currentModel = model

        // Center & Auto-scale model relative to container aspect ratios
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        // Calculate fitting scale factor
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 2.0 / maxDim
        model.scale.set(scale, scale, scale)

        // Center offset pivot
        model.position.x = -center.x * scale
        model.position.y = -center.y * scale
        model.position.z = -center.z * scale

        scene.add(model)

        // Count meshes and cache initial materials
        let meshes = 0
        model.traverse((child) => {
          if (child.isMesh) {
            meshes++
            child.castShadow = true
            child.receiveShadow = true
            
            // Adjust materials slightly for dual tone wrap reflections
            if (child.material) {
              child.material.roughness = Math.min(child.material.roughness, 0.6)
              child.material.metalness = Math.max(child.material.metalness, 0.4)
            }
          }
        })
        meshCount.value = meshes

        // Setup moving Scanline helper bounding values
        const scaleBox = new THREE.Box3().setFromObject(model)
        const scaleSize = scaleBox.getSize(new THREE.Vector3())
        const scaleCenter = scaleBox.getCenter(new THREE.Vector3())

        scanYMin = scaleCenter.y - scaleSize.y / 2
        scanYMax = scaleCenter.y + scaleSize.y / 2

        // Create horizontal ring scanner line
        const scanRingGeom = new THREE.CylinderGeometry(
          Math.max(scaleSize.x, scaleSize.z) * 0.7,
          Math.max(scaleSize.x, scaleSize.z) * 0.7,
          0.02,
          32,
          1,
          true
        )
        const scanRingMat = new THREE.MeshBasicMaterial({
          color: 0xef5a24,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        })
        scanLine = new THREE.Mesh(scanRingGeom, scanRingMat)
        scanLine.position.y = scaleCenter.y
        scanLine.visible = renderMode.value === 'hologram'
        scene.add(scanLine)

        // Apply starting render mode shaders
        applyRenderMode(renderMode.value)

        loading.value = false
        animate()
      },
      (xhr) => {
        if (xhr.total) {
          loadingProgress.value = Math.round((xhr.loaded / xhr.total) * 100)
        } else {
          // Fallback loader counter
          if (loadingProgress.value < 95) {
            loadingProgress.value += 5
          }
        }
      },
      (err) => {
        console.error('Failed to load GLB model:', err)
        error.value = 'Invalid 3D model asset pathway or connection timeout. Verify CORS and cloud URL definitions.'
        loading.value = false
      }
    )

    // 8. Handle Resize Observer
    resizeObserver = new ResizeObserver((entries) => {
      if (!containerRef.value) return
      const w = containerRef.value.clientWidth
      const h = containerRef.value.clientHeight
      if (renderer && camera) {
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    })
    resizeObserver.observe(containerRef.value)

  } catch (err) {
    console.error('WebGL Context crash:', err)
    error.value = 'Failed to compile WebGL context. Verify GPU hardware rendering overrides in your browser.'
    loading.value = false
  }
}

// Tick update loop
function animate() {
  animationFrameId = requestAnimationFrame(animate)

  // Rotate camera controls
  if (controls) {
    controls.update()
  }

  // Animate laser scanner ring
  if (scanLine && renderMode.value === 'hologram') {
    scanLine.position.y += 0.008 * scanDirection
    if (scanLine.position.y >= scanYMax) {
      scanDirection = -1
    } else if (scanLine.position.y <= scanYMin) {
      scanDirection = 1
    }
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// Memory cleanups on destroy
function disposeScene() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }

  if (currentModel) {
    currentModel.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
        if (child.userData.originalMaterial) {
          child.userData.originalMaterial.dispose()
        }
      }
    })
  }

  if (gridHelper) {
    gridHelper.geometry.dispose()
    gridHelper.material.dispose()
  }

  if (scanLine) {
    scanLine.geometry.dispose()
    scanLine.material.dispose()
  }

  if (renderer) {
    renderer.dispose()
  }
}

onMounted(async () => {
  try {
    // Dynamic import Three JS libraries for SSR safety
    const threeModule = await import('three')
    THREE = threeModule
    
    const gltfModule = await import('three/examples/jsm/loaders/GLTFLoader.js')
    GLTFLoader = gltfModule.GLTFLoader

    const controlsModule = await import('three/examples/jsm/controls/OrbitControls.js')
    OrbitControls = controlsModule.OrbitControls

    initScene()
  } catch (err) {
    console.error('Failed to load ES modules dynamically:', err)
    error.value = 'Module dependency error. Verify three.js bundle structure.'
    loading.value = false
  }
})

onUnmounted(() => {
  disposeScene()
})
</script>
