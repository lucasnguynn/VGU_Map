<template>
  <div v-if="item" class="fixed inset-0 z-[60] bg-[#070A12] text-white flex flex-col font-sans select-none">
    <!-- Visual Cyber Scan Overlays -->
    <div class="absolute inset-0 pointer-events-none z-45 scanline laser-scan"></div>

    <!-- Cyber Navbar Header -->
    <header class="h-16 landscape:h-11 border-b border-[#EF5A24]/20 bg-[#0F1E36]/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-50">
      <div class="flex items-center gap-3">
        <!-- Back Button -->
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          @click="emit('close')"
          class="text-white/60 hover:text-white font-technical text-xs font-bold uppercase tracking-wider hover:bg-white/5"
        >
          Back to Map
        </UButton>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-xs font-technical text-[#EF5A24] uppercase font-bold tracking-widest hidden sm:block">
          {{ item.manufacturer }} // {{ item.model }}
        </span>
        <UBadge color="warning" variant="subtle" class="font-technical uppercase text-[9px] tracking-widest px-2.5 py-1">
          {{ item.status }}
        </UBadge>
      </div>
    </header>

    <!-- Main Container split into left (media 2/5) and right (content 3/5) -->
    <div class="flex-grow h-[calc(100vh-4rem)] landscape:h-[calc(100vh-2.75rem)] lg:h-auto overflow-y-auto lg:overflow-hidden snap-y snap-mandatory scroll-smooth flex flex-col landscape:flex-row lg:flex-row">
      <!-- Left side: Stacked Media Panels (3D Model, 2D X-Ray Scanner, Photo Gallery) -->
      <div 
        ref="mediaPanel"
        class="w-full landscape:w-2/5 lg:w-2/5 h-[calc(100vh-4rem)] landscape:h-full lg:h-full snap-start shrink-0 p-6 md:p-8 landscape:p-3 flex flex-col gap-6 landscape:gap-2.5 border-b lg:border-b-0 landscape:border-b-0 lg:border-r landscape:border-r border-white/10 overflow-y-auto lg:shrink"
      >
        <div class="flex flex-col gap-1">
          <div class="text-[#EF5A24] text-xs font-technical uppercase font-extrabold tracking-widest">
            {{ item.manufacturer }}
          </div>
          <h2 class="text-2xl md:text-3xl landscape:text-lg font-extrabold text-white tracking-tight leading-tight">
            {{ item.title }}
          </h2>
          <div class="flex gap-2 flex-wrap mt-2">
            <UBadge 
              v-for="dept in item.departments" 
              :key="dept" 
              variant="outline"
              color="info"
              class="font-technical text-[9px] uppercase tracking-wider"
            >
              {{ dept }}
            </UBadge>
          </div>
        </div>

        <!-- Unified Media Viewer Container -->
        <div class="flex flex-col gap-4 flex-grow">
          <!-- Active Media Display Panel -->
          <div v-if="activeMedia" class="flex flex-col gap-2">
            <!-- Media Title (Customizable or default) -->
            <span class="text-[10px] font-technical text-[#EF5A24] uppercase font-bold tracking-widest leading-none">
              {{ activeMedia.title }}
            </span>
            
            <!-- Large Media Frame -->
            <div class="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-[#070A12] flex items-center justify-center">
              
              <!-- 1. 3D Model Viewer -->
              <ClientOnly v-if="activeMedia.type === 'model_3d'">
                <VguThreeViewer
                  :src="activeMedia.src"
                  :initial-render-mode="activeMedia.renderMode"
                  :initial-auto-rotate="activeMedia.autoRotate"
                  class="w-full h-full"
                  style="width: 100%; height: 100%; border: none;"
                />
              </ClientOnly>
              
              <!-- 2. Interactive X-Ray Depth Scanner -->
              <div v-else-if="activeMedia.type === 'internal_blueprint'" class="relative w-full h-full bg-black group">
                <!-- Image A: Exterior -->
                <div class="absolute inset-0 bg-[#070A12] flex items-center justify-center">
                  <NuxtImg 
                    v-if="activeMedia.target_image || firstImageSrc"
                    :src="activeMedia.target_image || firstImageSrc" 
                    format="avif"
                    class="w-full h-full object-cover" 
                    alt="Equipment Exterior"
                  />
                  <div v-else class="text-white/30 text-xs font-technical">PHOTO DATA PENDING</div>
                </div>

                <!-- Image B: Internal Blueprint (Revealed via Clip Path) -->
                <div 
                  class="absolute inset-0 bg-gradient-to-br from-[#0F1E36] to-[#070A12] pointer-events-none transition-all duration-75 z-20"
                  :style="maskStyle"
                >
                  <!-- Blueprint Content -->
                  <div class="w-full h-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#06B6D4]/30 bg-[#070A12]/92">
                    <div class="absolute inset-0 opacity-10 cyber-grid"></div>
                    <!-- Hologram graphics or SVG schematic file -->
                    <NuxtImg 
                      v-if="activeMedia.src"
                      :src="activeMedia.src" 
                      class="w-full h-full object-contain drop-shadow-[0_0_10px_#06B6D4]" 
                      alt="Internal Blueprint"
                    />
                    <svg v-else class="w-4/5 h-4/5 text-[#06B6D4]/60 drop-shadow-[0_0_10px_#06B6D4]" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="0.5" stroke-dasharray="2,2" />
                      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="0.75" />
                      <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" stroke-width="0.5" />
                      <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" stroke-width="0.5" />
                      <path d="M 30,50 L 50,30 L 70,50 L 50,70 Z" fill="none" stroke="#EF5A24" stroke-width="1" />
                      <text x="52" y="24" class="text-[4px] font-technical font-bold fill-[#06B6D4]">VACUUM CHAMBER</text>
                      <text x="52" y="78" class="text-[4px] font-technical font-bold fill-[#EF5A24]">LASER BEAM PATH</text>
                    </svg>
                  </div>
                </div>

                <!-- Interactive Visualizer HUD Frame Overlay -->
                <div class="absolute inset-0 pointer-events-none z-25 border border-[#06B6D4]/20">
                  <span class="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[#06B6D4]/40"></span>
                  <span class="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[#06B6D4]/40"></span>
                  <span class="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[#06B6D4]/40"></span>
                  <span class="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[#06B6D4]/40"></span>
                  
                  <!-- HUD Panel (Collapsible) -->
                  <div 
                    v-if="showXrayHud" 
                    class="absolute top-3 right-3 flex flex-col items-end gap-0.5 text-[8px] font-technical text-[#06B6D4]/70 bg-black/85 px-2 py-1.5 rounded border border-[#06B6D4]/30 backdrop-blur-sm pointer-events-auto"
                  >
                    <div class="flex items-center justify-between gap-4 w-full border-b border-[#06B6D4]/20 pb-0.5 mb-0.5">
                      <span class="text-[7px] text-[#EF5A24] font-bold">X-RAY DIAGNOSTICS</span>
                      <button @click="showXrayHud = false" class="text-white/40 hover:text-white cursor-pointer select-none">✕</button>
                    </div>
                    <div>SYS_LINK: ONLINE</div>
                    <div>X-RAY SCAN: ACTIVE</div>
                    <div>RESOL: 0.12 NM</div>
                    <div>WAVELENGTH: 532 NM</div>
                  </div>

                  <!-- Floating Toggle Button when HUD is hidden -->
                  <button 
                    v-else
                    @click="showXrayHud = true"
                    class="absolute top-3 right-3 z-30 p-1.5 rounded bg-black/60 hover:bg-black border border-white/10 hover:border-[#06B6D4]/50 text-[#06B6D4] cursor-pointer pointer-events-auto flex items-center justify-center transition-all duration-200"
                    title="Show Diagnostics HUD"
                  >
                    <UIcon name="i-lucide-terminal" class="w-3.5 h-3.5" />
                  </button>
                </div>

                <!-- Interactive Interaction Overlay -->
                <div 
                  ref="revealContainer"
                  class="absolute inset-0 z-30 cursor-crosshair pointer-events-auto"
                  @mousemove="handleMouseMove"
                  @mouseleave="handleMouseLeave"
                ></div>

                <!-- Hint -->
                <div v-if="showXrayHud" class="absolute bottom-3 right-3 landscape:bottom-2 landscape:right-2 z-40 bg-black/85 px-3 py-1 landscape:px-2 landscape:py-0.5 rounded text-[9px] landscape:text-[8px] font-technical text-[#06B6D4] border border-[#06B6D4]/30 backdrop-blur-sm pointer-events-none">
                  {{ isMobile ? 'TILT DEVICE TO X-RAY' : 'HOVER CURSOR TO X-RAY' }}
                </div>
              </div>
              
              <!-- 3. Video Player -->
              <video
                v-else-if="activeMedia.type === 'video'"
                :src="activeMedia.src"
                class="w-full h-full object-cover"
                autoplay
                loop
                muted
                playsinline
                controls
              ></video>
              
              <!-- 4. NuxtImg Graphic -->
              <NuxtImg
                v-else-if="activeMedia.type === 'image'"
                :src="activeMedia.src"
                format="avif"
                class="w-full h-full object-cover"
                alt="Equipment Gallery Photo"
              />
              
              <div v-else class="text-white/30 text-xs font-technical">PHOTO DATA PENDING</div>
              
              <!-- Help text overlay moved inside VguThreeViewer -->
            </div>
          </div>
          
          <div v-else class="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl aspect-video text-white/30 text-xs font-technical">
            NO DIAGNOSTIC MEDIA AVAILABLE
          </div>

          <!-- Unified Thumbnails Carousel -->
          <div v-if="mediaList.length > 0" class="flex flex-col gap-1.5">
            <span class="text-[9px] font-technical text-white/40 uppercase font-bold tracking-widest leading-none">DIAGNOSTIC ARCHIVE</span>
            <div class="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none select-none">
              <button 
                v-for="(med, idx) in mediaList" 
                :key="idx"
                @click="activeMediaIndex = idx"
                :class="[
                  'relative w-24 landscape:w-16 aspect-video rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 bg-slate-900',
                  activeMediaIndex === idx ? 'border-[#EF5A24] shadow-[0_0_8px_rgba(239,90,36,0.3)]' : 'border-white/10 hover:border-white/30'
                ]"
              >
                <!-- Thumbnail Image Previews -->
                <NuxtImg 
                  v-if="med.type === 'image'" 
                  :src="med.src" 
                  format="avif" 
                  class="w-full h-full object-cover opacity-80" 
                />
                <NuxtImg 
                  v-else-if="firstImageSrc" 
                  :src="firstImageSrc" 
                  format="avif" 
                  class="w-full h-full object-cover opacity-50" 
                />
                <div v-else class="w-full h-full flex items-center justify-center opacity-40 bg-gradient-to-br from-[#0F1E36] to-[#070A12] border border-white/5">
                  <div class="absolute inset-0 opacity-10 cyber-grid"></div>
                </div>

                <!-- Overlay Icon showing media type -->
                <div class="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div class="w-7 h-7 rounded-full bg-[#0F1E36]/90 border border-white/20 flex items-center justify-center text-white/80 shadow-md">
                    <UIcon 
                      :name="
                        med.type === 'model_3d' ? 'i-lucide-box' :
                        med.type === 'internal_blueprint' ? 'i-lucide-scan' :
                        med.type === 'video' ? 'i-lucide-play' : 'i-lucide-image'
                      "
                      class="w-4 h-4"
                    />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
        <!-- Mobile Navigation Footer -->
        <div class="lg:hidden landscape:hidden mt-auto pt-4 flex justify-center shrink-0">
          <button 
            @click="scrollToTabs" 
            class="px-5 py-2.5 rounded-lg border border-[#EF5A24] bg-[#EF5A24]/10 hover:bg-[#EF5A24]/20 text-[10px] font-technical uppercase font-bold tracking-widest text-white flex items-center gap-2 shadow-[0_0_15px_rgba(239,90,36,0.2)] active:scale-95 transition-all"
          >
            <span>Details & Specifications</span>
            <UIcon name="i-lucide-arrow-down" class="w-4 h-4 text-[#EF5A24] animate-bounce" />
          </button>
        </div>
      </div>

      <!-- Right side: Dynamic Content Tabs (Scrollable, Wider lg:w-3/5 layout) -->
      <div 
        ref="tabsPanel"
        class="w-full landscape:w-3/5 lg:w-3/5 h-[calc(100vh-4rem)] landscape:h-full lg:h-full snap-start shrink-0 p-6 md:p-8 landscape:p-3 overflow-y-auto flex flex-col gap-6 landscape:gap-2.5 bg-[#0F1E36]/10 select-text"
      >
        <!-- Back to diagnostics button for mobile -->
        <div class="lg:hidden landscape:hidden shrink-0 mb-1">
          <button 
            @click="scrollToMedia" 
            class="px-4 py-2 rounded-lg border border-[#EF5A24]/30 bg-[#EF5A24]/5 hover:bg-[#EF5A24]/10 text-[9px] font-technical uppercase font-bold tracking-widest text-[#EF5A24] flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <UIcon name="i-lucide-arrow-up" class="w-3.5 h-3.5" />
            <span>Back to Media Viewer</span>
          </button>
        </div>
        <!-- Interactive Cyber Switcher tabs -->
        <div class="flex flex-nowrap gap-2.5 border-b border-white/10 pb-4 overflow-x-auto scrollbar-none select-none">
          <button
            v-for="tab in dynamicTabs"
            :key="tab.key"
            @click="activeTab = tab.key"
            class="relative px-4 py-2 rounded-lg text-[10px] font-technical uppercase font-bold tracking-widest transition-all duration-300 flex items-center gap-2 border cursor-pointer select-none shrink-0"
            :class="activeTab === tab.key 
              ? 'bg-[#EF5A24]/10 border-[#EF5A24] text-white shadow-[0_0_15px_rgba(239,90,36,0.3)]' 
              : 'bg-[#0F1E36]/40 border-white/5 text-white/50 hover:text-white hover:bg-[#0F1E36]/70 hover:border-white/15'"
          >
            <!-- Glowing LED indicator dot -->
            <span 
              class="w-1.5 h-1.5 rounded-full transition-all duration-300"
              :class="activeTab === tab.key 
                ? 'bg-[#EF5A24] shadow-[0_0_8px_#EF5A24] animate-pulse' 
                : 'bg-white/20'"
            ></span>
            <UIcon :name="tab.icon" class="w-4 h-4" />
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <!-- Dynamic Tab Panel Render Area -->
        <div class="flex-grow flex flex-col justify-start">
          <Transition name="fade" mode="out-in">
            <div :key="activeTab" class="w-full">
              <!-- A. Overview / Markdown Body Tab -->
              <div v-if="activeTab === 'overview'" class="prose prose-invert max-w-none text-xs text-white/80 leading-relaxed bg-[#0F1E36]/20 p-6 rounded-xl border border-white/5">
                <ContentRenderer :value="item" />
              </div>

              <!-- B. Dynamic Frontmatter Field Tabs -->
              <div v-else-if="item.optional_information?.[activeTab]" class="flex flex-col gap-6">
                <!-- Case 1: Physics Tab -->
                <div v-if="activeTab === 'physics'" class="flex flex-col gap-5">
                  <UCard class="bg-[#0F1E36]/40 border border-[#06B6D4]/30 shadow-lg">
                    <template #header>
                      <div class="text-[#06B6D4] text-xs font-technical uppercase font-extrabold tracking-wider">
                        Physics & Primary Mechanism
                      </div>
                    </template>
                    <div class="text-sm font-semibold text-white/95">{{ item.optional_information.physics?.primary_mechanism }}</div>
                    <div class="text-xs text-white/60 mt-1">Mathematical Model: {{ item.optional_information.physics?.mathematical_model }}</div>
                    <div v-if="item.optional_information.physics?.equation" class="mt-4 text-center p-4 bg-black/50 rounded-lg border border-white/10">
                      <code class="text-[#EF5A24] font-technical text-lg font-bold">{{ item.optional_information.physics?.equation }}</code>
                    </div>
                  </UCard>
                  
                  <UCard v-if="item.optional_information.physics?.target_materials?.length" class="bg-[#0F1E36]/20 border border-white/10 shadow-sm">
                    <template #header>
                      <div class="text-white/40 text-xs font-technical uppercase font-bold tracking-wider">Target Materials & Systems</div>
                    </template>
                    <div class="flex flex-wrap gap-2">
                      <span 
                        v-for="mat in item.optional_information.physics.target_materials" 
                        :key="mat" 
                        class="text-[10px] bg-[#EF5A24]/10 text-[#EF5A24] px-2.5 py-1 rounded font-technical font-bold border border-[#EF5A24]/20 shadow-xs"
                      >
                        {{ mat }}
                      </span>
                    </div>
                  </UCard>
                </div>

                <!-- Case 2: Link Resources Tab -->
                <div v-else-if="activeTab === 'links' || (Array.isArray(item.optional_information[activeTab]) && item.optional_information[activeTab].length && typeof item.optional_information[activeTab][0] === 'object' && item.optional_information[activeTab][0].url)" class="flex flex-col gap-3">
                  <span class="text-white/40 text-[10px] font-technical uppercase font-bold tracking-wider mb-1">Interactive Diagnostic Portals</span>
                  <a 
                    v-for="link in item.optional_information[activeTab]" 
                    :key="link.url"
                    :href="link.url"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center justify-between p-4 rounded-xl bg-[#0F1E36]/50 border border-white/5 hover:border-[#EF5A24]/40 hover:bg-[#EF5A24]/5 text-xs text-white/80 hover:text-white transition-all duration-300 pointer-events-auto shadow-sm group"
                  >
                    <span class="font-sans font-medium">{{ link.title }}</span>
                    <span class="text-[#EF5A24] font-technical font-bold text-[10px] flex items-center gap-1 group-hover:underline">
                      LAUNCH_URI <UIcon name="i-lucide-external-link" class="w-3.5 h-3.5" />
                    </span>
                  </a>
                </div>

                <!-- Case 3: Flat Record / Specifications Tab -->
                <div v-else-if="typeof item.optional_information[activeTab] === 'object' && !Array.isArray(item.optional_information[activeTab])" class="flex flex-col gap-4">
                  <UCard class="bg-[#0F1E36]/30 border border-white/10 shadow-md">
                    <template #header>
                      <div class="text-white/40 text-xs font-technical uppercase font-bold tracking-wider">
                        Technical specifications
                      </div>
                    </template>
                    <div class="grid grid-cols-2 gap-x-8 gap-y-4 text-xs">
                      <template v-for="(val, key) in item.optional_information[activeTab]" :key="key">
                        <div class="text-white/50 font-technical py-1.5 border-b border-white/5 capitalize">{{ key.replace(/_/g, ' ') }}</div>
                        <div class="text-white font-semibold py-1.5 border-b border-white/5 text-right">{{ val }}</div>
                      </template>
                    </div>
                  </UCard>
                </div>

                <!-- Case 4: Array of Strings / Checklist Tab -->
                <div v-else-if="Array.isArray(item.optional_information[activeTab]) && typeof item.optional_information[activeTab][0] === 'string'" class="flex flex-col gap-4">
                  <UCard class="bg-[#0F1E36]/30 border border-white/10 shadow-md">
                    <template #header>
                      <div class="text-white/40 text-xs font-technical uppercase font-bold tracking-wider">
                        Operational Checklist / Instructions
                      </div>
                    </template>
                    <div class="flex flex-col gap-3.5 text-xs text-white/80">
                      <div 
                        v-for="(step, sIdx) in item.optional_information[activeTab]" 
                        :key="sIdx" 
                        class="flex items-start gap-3.5 py-2.5 border-b border-white/5 last:border-b-0"
                      >
                        <span class="text-[#EF5A24] font-technical font-bold text-[11px] bg-[#EF5A24]/10 px-2 py-0.5 rounded border border-[#EF5A24]/20 shadow-xs">
                          {{ String(sIdx + 1).padStart(2, '0') }}
                        </span>
                        <span class="mt-0.5">{{ step }}</span>
                      </div>
                    </div>
                  </UCard>
                </div>

                <!-- Case 5: Fallback Single String/Text Tab -->
                <div v-else class="text-xs text-white/80 leading-relaxed bg-[#0F1E36]/20 p-6 rounded-xl border border-white/5 select-text shadow-sm">
                  {{ item.optional_information[activeTab] }}
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useDeviceOrientation } from '@vueuse/core'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const activeMediaIndex = ref(0)
const revealContainer = ref(null)
const activeTab = ref('overview')
const showXrayHud = ref(typeof window !== 'undefined' ? (window.innerWidth > 768 && window.innerHeight > 500) : true)

const mediaPanel = ref(null)
const tabsPanel = ref(null)

function scrollToTabs() {
  tabsPanel.value?.scrollIntoView({ behavior: 'smooth' })
}

function scrollToMedia() {
  mediaPanel.value?.scrollIntoView({ behavior: 'smooth' })
}

// Computed list of available media items for unified diagnostics
const mediaList = computed(() => {
  const list = []
  if (!props.item || !props.item.media) return list
  const m = props.item.media

  // 1. 3D Model
  if (m.model_3d) {
    const isObj = typeof m.model_3d === 'object' && m.model_3d !== null
    const src = isObj ? m.model_3d.src || m.model_3d.url || m.model_3d.path : m.model_3d
    const title = (isObj && m.model_3d.title) ? m.model_3d.title : 'Diagnostic: 3D Hull Projection'
    const position = (isObj && typeof m.model_3d.position === 'number') ? m.model_3d.position : 10
    
    // Parse render mode
    let renderMode = 'realistic'
    if (isObj) {
      const mode = m.model_3d.render_mode || m.model_3d.renderMode
      if (mode && ['realistic', 'hologram'].includes(mode.toLowerCase())) {
        renderMode = mode.toLowerCase()
      }
    }

    // Parse auto rotate
    let autoRotate = true
    if (isObj) {
      const rot = m.model_3d.auto_rotate ?? m.model_3d.autoRotate
      if (typeof rot === 'boolean') {
        autoRotate = rot
      }
    }

    if (src) {
      list.push({ type: 'model_3d', src, title, position, renderMode, autoRotate })
    }
  }

  // 2. Internal Blueprint / Depth Scan
  if (m.internal_blueprint) {
    const isObj = typeof m.internal_blueprint === 'object' && m.internal_blueprint !== null
    const src = isObj ? m.internal_blueprint.src || m.internal_blueprint.url || m.internal_blueprint.path : m.internal_blueprint
    const title = (isObj && m.internal_blueprint.title) ? m.internal_blueprint.title : 'Diagnostic: Depth Scan & Blueprint'
    const position = (isObj && typeof m.internal_blueprint.position === 'number') ? m.internal_blueprint.position : 20
    const target_image = isObj ? m.internal_blueprint.target_image || m.internal_blueprint.targetImage || m.internal_blueprint.cover : null
    if (src) {
      list.push({ type: 'internal_blueprint', src, title, position, target_image })
    }
  }

  // 3. Video
  if (m.video) {
    const isObj = typeof m.video === 'object' && m.video !== null
    const src = isObj ? m.video.src || m.video.url || m.video.path : m.video
    const title = (isObj && m.video.title) ? m.video.title : 'Diagnostic: Video Demonstration'
    const position = (isObj && typeof m.video.position === 'number') ? m.video.position : 30
    if (src) {
      list.push({ type: 'video', src, title, position })
    }
  }

  // 4. Photos/Images
  if (m.images && Array.isArray(m.images)) {
    m.images.forEach((img, index) => {
      const isObj = typeof img === 'object' && img !== null
      const src = isObj ? img.src || img.url || img.path : img
      const title = (isObj && img.title) ? img.title : `Diagnostic: Photographic Data ${index + 1}`
      const position = (isObj && typeof img.position === 'number') ? img.position : 40 + index
      const highlighted = isObj ? img.highlighted : false
      if (src) {
        list.push({ type: 'image', src, title, position, highlighted })
      }
    })
  }

  return list.sort((a, b) => a.position - b.position)
})

const firstImageSrc = computed(() => {
  const imgItems = mediaList.value.filter(m => m.type === 'image')
  if (imgItems.length === 0) return null
  const highlighted = imgItems.find(img => img.highlighted)
  return highlighted ? highlighted.src : imgItems[0].src
})

const activeMedia = computed(() => {
  if (mediaList.value.length === 0) return null
  return mediaList.value[activeMediaIndex.value] || mediaList.value[0]
})

// System properties that do not map to dynamic tabs
const systemKeys = [
  'id', 'title', 'model', 'manufacturer', 'departments', 
  'location', 'media', 'status', 'body', 'meta', 'excerpt', 
  'type', 'source', 'stem', 'extension', '_id', '_path', 
  '_dir', '_draft', '_type', '_locale'
]

// Dynamic computed tabs generator
const dynamicTabs = computed(() => {
  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'i-lucide-book-open' }
  ]
  
  if (!props.item || !props.item.optional_information) return tabs
  
  // Extract custom or optional keys from optional_information
  const infoKeys = Object.keys(props.item.optional_information).filter(key => {
    return !key.startsWith('_')
  })
  
  // Specialized icon mappings
  const iconMap = {
    physics: 'i-lucide-atom',
    specifications: 'i-lucide-settings',
    links: 'i-lucide-link',
    safety: 'i-lucide-shield-alert',
    procedures: 'i-lucide-list-todo',
    maintenance: 'i-lucide-wrench',
    calibration: 'i-lucide-gauge'
  }
  
  infoKeys.forEach(key => {
    const label = key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      
    tabs.push({
      key,
      label,
      icon: iconMap[key.toLowerCase()] || 'i-lucide-info'
    })
  })
  
  return tabs
})

// Reset tab selection to 'overview' on equipment change
watch(() => props.item?.id, () => {
  activeTab.value = 'overview'
  activeMediaIndex.value = 0
})

function isVideo(path) {
  if (!path) return false
  return path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.ogg')
}

// Mouse coordinates relative to the container
const mouseX = ref(50)
const mouseY = ref(50)
const isHovering = ref(false)

// Use VueUse for device gyroscopic orientation (Mobile Tilt Reveal)
const { gamma, isSupported: isOrientationSupported } = useDeviceOrientation()
const isMobile = ref(false)

if (import.meta.client) {
  isMobile.value = ('ontouchstart' in window) || navigator.maxTouchPoints > 0
}

function handleMouseMove(e) {
  if (!revealContainer.value) return
  const rect = revealContainer.value.getBoundingClientRect()
  mouseX.value = ((e.clientX - rect.left) / rect.width) * 100
  mouseY.value = ((e.clientY - rect.top) / rect.height) * 100
  isHovering.value = true
}

function handleMouseLeave() {
  isHovering.value = false
}

// Compute dynamic CSS clip-path mask for X-Ray
const maskStyle = computed(() => {
  if (isMobile.value && isOrientationSupported.value && gamma.value !== null) {
    const tiltOffset = Math.max(10, Math.min(90, 50 + (gamma.value * 1.5)))
    return {
      clipPath: `polygon(0 0, ${tiltOffset}% 0, ${tiltOffset - 10}% 100%, 0 100%)`
    }
  } else {
    const radius = isHovering.value ? 100 : 0
    return {
      clipPath: `circle(${radius}px at ${mouseX.value}% ${mouseY.value}%)`,
      webkitClipPath: `circle(${radius}px at ${mouseX.value}% ${mouseY.value}%)`
    }
  }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
