<template>
  <div v-if="room" class="fixed inset-0 z-50 bg-[#070A12] text-white flex flex-col font-sans select-none">
    <!-- Visual Cyber Scan Overlays -->
    <div v-if="viewMode !== '3d'" class="absolute inset-0 pointer-events-none z-45 scanline laser-scan"></div>

    <!-- Fixed Cyber Header -->
    <header class="fixed top-0 left-0 right-0 h-16 landscape:h-11 border-b border-[#EF5A24]/20 bg-[#0F1E36]/90 backdrop-blur-md px-6 flex items-center justify-between z-50">
      <div class="flex items-center gap-3">
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
          {{ (room.building_id || '').toUpperCase() }} // FLOOR {{ room.floor || 1 }} // CELL {{ (room.room_id || '').replace('lab-', '').replace('room-', '').toUpperCase() }}
        </span>
        <UBadge color="warning" variant="subtle" class="font-technical uppercase text-[9px] tracking-widest px-2.5 py-1">
          CELL STATE: {{ room.status }}
        </UBadge>
      </div>
    </header>

    <!-- Visual Scroll Progress Tracker -->
    <div v-if="viewMode !== '3d'" class="fixed top-16 landscape:top-11 left-0 right-0 h-[3px] bg-white/5 z-50">
      <div 
        class="h-full bg-gradient-to-r from-[#EF5A24] to-[#06B6D4] transition-all duration-75 shadow-[0_0_8px_#06B6D4]"
        :style="{ width: `${scrollPercent}%` }"
      ></div>
    </div>

    <!-- 1. Pure 3D VR Panorama Room Viewer Mode — fills entire viewport below header -->
    <div v-if="viewMode === '3d'" class="absolute inset-0 pt-16 bg-black z-30">
      <VguRoomVrViewer
        :room="room"
        :panorama-url="panoramaUrl"
      />

      <!-- Toggle back to photo mode (inside the 3D pane, bottom right) -->
      <button
        @click="toggleViewMode"
        class="absolute bottom-6 left-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-black/50 text-white/60 hover:text-white font-mono text-[10px] tracking-widest uppercase transition-all hover:bg-black/70 cursor-pointer backdrop-blur-md pointer-events-auto"
        title="Switch to Photo Mode"
      >
        <UIcon name="i-lucide-image" class="w-3.5 h-3.5 shrink-0" />
        <span>Photo Mode</span>
      </button>
    </div>

    <!-- 2. Standard Interactive Lab Tour presentation -->
    <div 
      v-else
      ref="scrollContainer"
      @scroll="handleScroll"
      class="flex-grow snap-y snap-mandatory overflow-y-auto w-full h-full overscroll-y-none"
      style="-webkit-overflow-scrolling: touch;"
    >
      <!-- Slide 0: Lab Overview / Introduction -->
      <section class="h-auto lg:h-screen w-full snap-none lg:snap-start shrink-0 relative flex flex-col landscape:flex-row lg:flex-row lg:pt-16 landscape:pt-11 bg-[#070A12]">
        <!-- Left Column: Intimidating Widescreen Lab Image & Reticle HUD -->
        <div 
          ref="slide0Image"
          class="w-full landscape:w-1/2 lg:w-3/5 relative h-screen landscape:h-full lg:h-full snap-start shrink-0 overflow-hidden border-b lg:border-b-0 landscape:border-b-0 lg:border-r landscape:border-r border-white/10 bg-black flex items-center justify-center pt-16 landscape:pt-11 lg:pt-0"
        >
          <!-- Standard Photo Mode -->
          <NuxtImg 
            :src="labImages[0]" 
            format="avif"
            class="w-full h-full object-cover filter brightness-[0.85] contrast-[1.10]" 
            style="view-transition-name: room-image"
            alt="Laboratory Widescreen Interior"
          />

          <!-- Scanning Crosshair overlay -->
          <div 
            ref="reticleContainer"
            class="absolute inset-0 z-30 cursor-crosshair pointer-events-auto"
            @mousemove="handleMouseMove"
            @mouseleave="handleMouseLeave"
          >
            <div 
              v-if="isHovering" 
              class="absolute w-24 h-24 border border-[#06B6D4]/30 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center"
              :style="{ left: `${mouseX}%`, top: `${mouseY}%` }"
            >
              <div class="w-1.5 h-1.5 bg-[#EF5A24] rounded-full"></div>
              <span class="absolute w-3 h-[1px] bg-[#06B6D4] -top-1"></span>
              <span class="absolute w-3 h-[1px] bg-[#06B6D4] -bottom-1"></span>
              <span class="absolute w-[1px] h-3 bg-[#06B6D4] -left-1"></span>
              <span class="absolute w-[1px] h-3 bg-[#06B6D4] -right-1"></span>
              <span class="absolute -bottom-6 font-technical text-[8px] text-[#06B6D4] font-bold bg-[#070A12]/80 px-1 rounded whitespace-nowrap uppercase tracking-widest">
                HUD LOCK: EXPLORE_CELL
              </span>
            </div>
          </div>

          <!-- Floating 3D VR Mode Toggle Button (Only if room has a panorama) -->
          <button 
            v-if="panoramaUrl"
            @click="toggleViewMode" 
            class="absolute top-20 landscape:top-14 right-4 z-45 cyber-3d-btn px-3 py-2 rounded-lg pointer-events-auto cursor-pointer"
            title="Switch to 3D Room"
          >
            <UIcon name="i-lucide-box" class="w-4 h-4 shrink-0" />
            <span class="cyber-3d-btn-text">3D Room</span>
          </button>

          <!-- Bottom HUD Panel -->
          <div class="absolute bottom-4 left-4 right-4 z-45 bg-[#0F1E36]/90 border border-[#06B6D4]/20 p-3.5 rounded-lg backdrop-blur-sm pointer-events-none flex justify-between items-center text-[10px] font-technical text-white/80">
            <div class="flex items-center gap-4">
              <div><span class="text-[#EF5A24] font-bold">ATMOSPHERE:</span> NOMINAL</div>
              <div class="hidden sm:block"><span class="text-[#06B6D4] font-bold">TEMP:</span> 21.8°C</div>
              <div class="hidden sm:block"><span class="text-[#06B6D4] font-bold">HUMIDITY:</span> 42%</div>
            </div>
            <div>
              <span class="text-[#EF5A24] font-bold">GRID CALIBRATION:</span> ACTIVE
            </div>
          </div>
          <!-- Mobile Navigation Button -->
          <div class="lg:hidden landscape:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-45">
            <button 
              @click="scrollToSlide0Details" 
              class="px-5 py-2.5 rounded-lg border border-[#EF5A24] bg-[#EF5A24]/20 hover:bg-[#EF5A24]/30 text-[10px] font-technical uppercase font-bold tracking-widest text-white flex items-center gap-2 shadow-[0_0_15px_rgba(239,90,36,0.3)] active:scale-95 transition-all"
            >
              <span>Read Lab Details</span>
              <UIcon name="i-lucide-arrow-down" class="w-4 h-4 text-[#EF5A24] animate-bounce" />
            </button>
          </div>
        </div>

        <!-- Right Column: Lab Profile Specs & Safe Instructions -->
        <div 
          ref="slide0Details"
          class="w-full landscape:w-1/2 lg:w-2/5 relative h-screen landscape:h-full lg:h-full p-6 md:p-8 pt-20 landscape:pt-11 lg:pt-8 flex flex-col gap-4 bg-[#0F1E36]/90 backdrop-blur-md snap-start shrink-0 overflow-y-auto"
          style="view-transition-name: room-drawer"
        >
          <!-- Back to image button for mobile -->
          <div class="lg:hidden landscape:hidden shrink-0 mb-1">
            <button 
              @click="scrollToSlide0Image" 
              class="px-4 py-2 rounded-lg border border-[#EF5A24]/30 bg-[#EF5A24]/5 hover:bg-[#EF5A24]/10 text-[9px] font-technical uppercase font-bold tracking-widest text-[#EF5A24] flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <UIcon name="i-lucide-arrow-up" class="w-3.5 h-3.5" />
              <span>Back to Lab Image</span>
            </button>
          </div>
          <div class="flex flex-col gap-1 shrink-0">
            <span class="text-[#EF5A24] text-xs font-technical uppercase font-extrabold tracking-widest">LAB MANDATE</span>
            <h2 class="text-xl md:text-2xl landscape:text-base font-extrabold text-white leading-snug" style="view-transition-name: room-title">{{ room.name }}</h2>
            <div class="flex gap-2 flex-wrap mt-2">
              <UBadge v-for="dept in room.departments" :key="dept" variant="outline" color="info" class="font-technical text-[9px] uppercase tracking-wider">
                {{ dept }}
              </UBadge>
            </div>
          </div>

          <!-- Internally Scrollable Details Area -->
          <div class="flex-grow overflow-y-auto pr-1 flex flex-col gap-4 my-2 pb-4 pt-4">
            <!-- Leadership Card -->
            <UCard class="bg-[#0F1E36]/40 border border-[#06B6D4]/20 shrink-0">
              <template #header>
                <div class="text-[#06B6D4] text-[10px] font-technical uppercase font-bold tracking-wider">Laboratory Leadership</div>
              </template>
              <div class="flex items-center gap-4 text-xs">
                <div class="w-10 h-10 rounded-lg bg-[#0C2B5C] border border-[#06B6D4]/30 flex items-center justify-center text-[#06B6D4] font-bold text-base">
                  {{ room.head_of_lab?.name?.split(' ').pop().charAt(0) || '?' }}
                </div>
                <div>
                  <div class="font-bold text-white leading-tight">{{ room.head_of_lab?.name }}</div>
                  <div class="text-white/50 text-[11px] mt-0.5">Coordinator // Office: {{ room.head_of_lab?.office }}</div>
                  <div class="text-[#06B6D4] font-technical text-[10px] mt-0.5">{{ room.head_of_lab?.email }}</div>
                </div>
              </div>
            </UCard>

            <!-- Narrative Overview -->
            <div class="text-xs text-white/80 leading-relaxed bg-[#0F1E36]/20 p-5 rounded-lg border border-white/5 select-text shrink-0">
              <h3 class="text-xs font-technical uppercase font-bold text-[#EF5A24] tracking-widest mb-2">Research Spectrum</h3>
              <ContentRenderer :value="room" />
            </div>

            <!-- Safety checklist -->
            <UCard class="bg-[#0F1E36]/20 border border-white/10 text-xs shrink-0">
              <template #header>
                <div class="text-white/40 font-technical uppercase font-bold text-[9px] tracking-wider">Personal Protective Equipment Rules</div>
              </template>
              <ul class="flex flex-col gap-2.5 list-disc pl-4 text-white/70">
                <li>Safety shields and heat protective mitts mandatory when running high-temperature furnaces.</li>
                <li>Fume suction cabinets must remain fully operational for compound evaporation.</li>
                <li>Keep log ledger populated with correct entry/exit parameters.</li>
              </ul>
            </UCard>
          </div>

          <!-- Action Buttons at bottom of intro -->
          <div class="pt-4 flex flex-col gap-2 shrink-0 border-t border-white/10 mt-auto">
            <!-- 3D Panorama Button (if room has a panorama URL) -->
            <button
              v-if="panoramaUrl"
              @click="toggleViewMode"
              class="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-[#06B6D4]/40 bg-[#06B6D4]/10 text-[#06B6D4] hover:bg-[#06B6D4]/20 hover:text-white font-technical text-[10px] font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer group"
              title="View 3D Panorama"
            >
              <UIcon name="i-lucide-box" class="w-3.5 h-3.5 shrink-0" />
              <span>VIEW 360° PANORAMA</span>
              <span class="text-[8px] font-mono text-white/30 group-hover:text-[#06B6D4]/60 ml-auto">3D</span>
            </button>

            <UButton 
              v-if="equipment.length"
              @click="scrollToNext(1)"
              icon="i-lucide-arrow-down"
              color="primary"
              variant="outline"
              class="font-technical text-xs uppercase tracking-widest border-[#EF5A24]/40 text-[#EF5A24] hover:bg-[#EF5A24]/10 hover:text-white w-full justify-center"
            >
              SCROLL TO INSTRUMENTS ({{ equipment.length }})
            </UButton>
          </div>
        </div>
      </section>

      <!-- Slide 1+: Fullscreen Equipment Tour Sheets -->
      <section 
        v-for="(mach, idx) in equipment" 
        :key="mach.id"
        class="h-screen w-full snap-start shrink-0 relative flex flex-col justify-center items-center lg:items-start p-6 lg:p-16 pt-20 landscape:pt-11 landscape:p-2 bg-black overflow-hidden"
      >
        <!-- Widescreen Background Equipment Image -->
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-black overflow-hidden">
          <NuxtImg 
            v-if="mach.media?.images?.length"
            :src="getFirstImage(mach)" 
            format="avif"
            class="w-full h-full object-cover filter brightness-[0.35] contrast-[1.15] transition-transform duration-[8000ms] ease-out" 
            :class="currentSlideIndex === (isMobileView ? idx + 2 : idx + 1) ? 'scale-105' : 'scale-100'"
            :alt="mach.title"
          />
          <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/80"></div>
          <div class="absolute inset-0 opacity-15 cyber-grid pointer-events-none"></div>
        </div>

        <div 
          class="z-30 max-w-xl w-full lg:w-auto mx-auto lg:mx-0 lg:ml-16 shrink-0 my-auto transition-all duration-[800ms] delay-100 ease-out"
          :class="currentSlideIndex === (isMobileView ? idx + 2 : idx + 1) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'"
        >
          <div class="vgu-panel p-5 landscape:p-3.5 border border-[#EF5A24]/30 shadow-2xl rounded-xl bg-[#0F1E36]/90 backdrop-blur-md flex flex-col gap-3.5 landscape:gap-2 w-[92vw] sm:w-[500px] landscape:w-[480px] h-[440px] md:h-[480px] landscape:h-[calc(100vh-56px)]">
            <div>
              <div class="text-[#EF5A24] text-[10px] font-technical uppercase font-bold tracking-widest leading-none">
                INSTRUMENT PROFILE // {{ idx + 1 }} OF {{ equipment.length }}
              </div>
              <h3 class="text-lg md:text-xl font-extrabold text-white mt-1.5 md:mt-2 leading-tight tracking-tight line-clamp-2 h-12 md:h-14 flex items-center">{{ mach.title }}</h3>
              <div class="text-[10px] font-technical text-[#06B6D4] uppercase font-bold tracking-wider mt-1">
                {{ mach.manufacturer }} // {{ mach.model }}
              </div>
            </div>

            <!-- Custom Cyber Tab Switcher -->
            <div class="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none flex-nowrap shrink-0 select-none">
              <button
                v-for="tab in getDynamicTabsForMachine(mach)"
                :key="tab.key"
                @click="setActiveTab(mach.id, tab.key)"
                class="px-2.5 py-1 rounded-md text-[9px] font-technical uppercase font-bold tracking-wider transition-all duration-300 flex items-center gap-1.5 border cursor-pointer shrink-0 select-none"
                :class="getActiveTab(mach.id) === tab.key 
                  ? 'bg-[#EF5A24]/10 border-[#EF5A24] text-white shadow-[0_0_8px_rgba(239,90,36,0.25)]' 
                  : 'bg-[#0F1E36]/40 border-white/5 text-white/50 hover:text-white hover:bg-[#0F1E36]/70 hover:border-white/10'"
              >
                <span 
                  class="w-1 h-1 rounded-full"
                  :class="getActiveTab(mach.id) === tab.key ? 'bg-[#EF5A24] shadow-[0_0_4px_#EF5A24]' : 'bg-white/20'"
                ></span>
                <UIcon :name="tab.icon" class="w-3 h-3" />
                <span>{{ tab.label }}</span>
              </button>
            </div>

            <!-- Tab Content Area (Scrollable flexbox-grown height) -->
            <div class="flex-grow min-h-0 flex flex-col justify-start overflow-y-auto pr-1">
              <Transition name="fade" mode="out-in">
                <div :key="getActiveTab(mach.id)">
                  <!-- 1. Overview Tab -->
                  <div v-if="getActiveTab(mach.id) === 'overview'" class="text-xs text-white/80 leading-relaxed prose prose-invert select-text">
                    <ContentRenderer :value="mach" />
                  </div>

                  <!-- 2. Dynamic Frontmatter Tabs -->
                  <div v-else-if="mach.optional_information?.[getActiveTab(mach.id)]" class="text-xs text-white/80 select-text">
                    <!-- Case A: Links -->
                    <div v-if="getActiveTab(mach.id) === 'links' || (Array.isArray(mach.optional_information[getActiveTab(mach.id)]) && mach.optional_information[getActiveTab(mach.id)].length && typeof mach.optional_information[getActiveTab(mach.id)][0] === 'object' && mach.optional_information[getActiveTab(mach.id)][0].url)" class="flex flex-col gap-2">
                      <a 
                        v-for="link in mach.optional_information[getActiveTab(mach.id)]" 
                        :key="link.url"
                        :href="link.url"
                        target="_blank"
                        rel="noopener"
                        class="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5 hover:border-[#EF5A24]/40 hover:bg-[#EF5A24]/5 text-xs text-white/80 hover:text-white transition-all duration-300 pointer-events-auto"
                      >
                        <span class="truncate font-sans font-medium">{{ link.title }}</span>
                        <span class="text-[#EF5A24] font-technical font-bold text-[9px] shrink-0">LAUNCH →</span>
                      </a>
                    </div>

                    <!-- Case B: Physics -->
                    <div v-else-if="getActiveTab(mach.id) === 'physics'" class="flex flex-col gap-3">
                      <div class="bg-black/50 p-2.5 rounded-lg border border-white/5 flex flex-col gap-1.5">
                        <div class="flex flex-col">
                          <span class="text-white/40 text-[8px] font-technical uppercase leading-none">PRIMARY MECHANISM</span>
                          <span class="text-white font-medium text-xs mt-1">{{ mach.optional_information.physics?.primary_mechanism }}</span>
                        </div>
                        <span class="text-white/50 text-[9px] mt-0.5">Model: {{ mach.optional_information.physics?.mathematical_model }}</span>
                        <div v-if="mach.optional_information.physics?.equation" class="mt-2 text-center p-2.5 bg-black/70 rounded border border-white/5">
                          <code class="text-[#EF5A24] font-technical text-sm font-bold">{{ mach.optional_information.physics?.equation }}</code>
                        </div>
                      </div>
                    </div>

                    <!-- Case C: Flat Record / Specifications -->
                    <div v-else-if="typeof mach.optional_information[getActiveTab(mach.id)] === 'object' && !Array.isArray(mach.optional_information[getActiveTab(mach.id)])" class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/5 pt-1.5 text-[10px]">
                      <template v-for="(val, key) in mach.optional_information[getActiveTab(mach.id)]" :key="key">
                        <span class="text-white/40 font-technical uppercase truncate py-0.5 border-b border-white/5">{{ key.replace(/_/g, ' ') }}</span>
                        <span class="text-white font-semibold text-right truncate py-0.5 border-b border-white/5">{{ val }}</span>
                      </template>
                    </div>

                    <!-- Case D: Array of Strings -->
                    <div v-else-if="Array.isArray(mach.optional_information[getActiveTab(mach.id)]) && typeof mach.optional_information[getActiveTab(mach.id)][0] === 'string'" class="flex flex-col gap-2">
                      <div 
                        v-for="(step, sIdx) in mach.optional_information[getActiveTab(mach.id)]" 
                        :key="sIdx"
                        class="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-b-0 text-[11px] leading-relaxed"
                      >
                        <span class="text-[#EF5A24] font-technical font-bold">[{{ sIdx + 1 }}]</span>
                        <span>{{ step }}</span>
                      </div>
                    </div>

                    <!-- Case E: Fallback -->
                    <div v-else class="leading-relaxed bg-black/20 p-3.5 rounded border border-white/5 select-text">
                      {{ mach.optional_information[getActiveTab(mach.id)] }}
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Bottom controls inside the HUD panel -->
            <div class="flex items-center justify-between border-t border-white/10 pt-4 mt-2">
              <span class="flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span class="text-[8px] font-technical text-white/50 uppercase tracking-widest">{{ mach.status }}</span>
              </span>

              <UButton
                @click="emit('select-equipment', mach)"
                color="primary"
                variant="solid"
                size="sm"
                class="font-technical text-[10px] uppercase font-bold tracking-wider px-3.5 bg-[#EF5A24] hover:bg-[#EF5A24]/90 text-white cursor-pointer select-none"
              >
                OPEN PROFILE CODES →
              </UButton>
            </div>
          </div>
        </div>

      </section>
    </div>

    <!-- Fixed Navigation controls on mobile/desktop -->
    <div 
      v-if="currentSlideIndex > 0 && equipment.length" 
      class="fixed bottom-6 right-6 z-45 flex items-center gap-3"
    >
      <UButton 
        v-if="currentSlideIndex < (isMobileView ? equipment.length + 1 : equipment.length)"
        @click="scrollToNext(currentSlideIndex + 1)"
        icon="i-lucide-arrow-down"
        color="neutral"
        variant="solid"
        class="font-technical text-[10px] uppercase tracking-widest text-white/80 hover:text-white bg-[#0F1E36]/95 hover:bg-[#EF5A24]/10 border border-[#EF5A24]/30 hover:border-[#EF5A24] px-3.5 py-2 rounded-lg shadow-xl backdrop-blur-md transition-all duration-300 pointer-events-auto"
      >
        NEXT MACHINE ↓
      </UButton>
      <UButton 
        v-else
        @click="scrollToTop"
        icon="i-lucide-arrow-up"
        color="neutral"
        variant="solid"
        class="font-technical text-[10px] uppercase tracking-widest text-white/80 hover:text-white bg-[#0F1E36]/95 hover:bg-[#EF5A24]/10 border border-[#EF5A24]/30 hover:border-[#EF5A24] px-3.5 py-2 rounded-lg shadow-xl backdrop-blur-md transition-all duration-300 pointer-events-auto"
      >
        BACK TO TOP ↑
      </UButton>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const isMobileView = useMediaQuery('(max-width: 1023px)')

const props = defineProps({
  room: {
    type: Object,
    required: true
  },
  equipment: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'select-equipment'])

const scrollContainer = ref(null)
const scrollPercent = ref(0)
const currentSlideIndex = ref(0)
const viewMode = ref('photo')

function toggleViewMode() {
  viewMode.value = viewMode.value === '3d' ? 'photo' : '3d'
  const query = { ...route.query }
  if (viewMode.value === '3d') {
    query.view = '3d'
  } else {
    delete query.view
  }
  router.replace({ query })
}

watch(() => route.query.view, (newVal) => {
  if (newVal === '3d') {
    viewMode.value = '3d'
  } else {
    viewMode.value = 'photo'
  }
})

const slide0Image = ref(null)
const slide0Details = ref(null)

function scrollToSlide0Details() {
  slide0Details.value?.scrollIntoView({ behavior: 'smooth' })
}

function scrollToSlide0Image() {
  slide0Image.value?.scrollIntoView({ behavior: 'smooth' })
}

const activeImageIndex = ref(0)
const isHovering = ref(false)
const mouseX = ref(50)
const mouseY = ref(50)

function getFirstImage(mach) {
  if (!mach || !mach.media) return null
  const images = mach.media.images
  if (!images || !images.length) return null
  const hl = images.find(img => typeof img === 'object' && img !== null && img.highlighted)
  const first = hl || images[0]
  if (typeof first === 'object' && first !== null) {
    return first.src || first.url || first.path || null
  }
  return first
}

// Keep track of active tabs for each equipment machine locally
const activeTabsMap = ref({})

function getActiveTab(machId) {
  return activeTabsMap.value[machId] || 'overview'
}

function setActiveTab(machId, tabKey) {
  activeTabsMap.value[machId] = tabKey
}

const systemKeys = [
  'id', 'title', 'model', 'manufacturer', 'departments', 
  'location', 'media', 'status', 'body', 'meta', 'excerpt', 
  'type', 'source', 'stem', 'extension', '_id', '_path', 
  '_dir', '_draft', '_type', '_locale'
]

// Generate dynamic tabs list per machine
function getDynamicTabsForMachine(mach) {
  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'i-lucide-book-open' }
  ]
  if (!mach || !mach.optional_information) return tabs
  
  const infoKeys = Object.keys(mach.optional_information).filter(key => {
    return !key.startsWith('_')
  })
  
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
}

// Lab Images selection based on room department
const labImages = computed(() => {
  if (!props.room || !props.room.departments || !Array.isArray(props.room.departments)) {
    return ['/images/labs/materials_science_lab.png', '/images/labs/electrical_engineering_lab.png']
  }
  const isEE = props.room.departments.some(d => 
    d && typeof d === 'string' && (
      d.toLowerCase().includes('electrical') || 
      d.toLowerCase().includes('computer') || 
      d.toLowerCase().includes('it')
    )
  )
  if (isEE) {
    return [
      '/images/labs/electrical_engineering_lab.png',
      '/images/labs/materials_science_lab.png'
    ]
  } else {
    return [
      '/images/labs/materials_science_lab.png',
      '/images/labs/electrical_engineering_lab.png'
    ]
  }
})

// Panorama URL — resolves from room.vr_panorama field in the content DB
const panoramaUrl = computed(() => {
  // Primary: use the room's own vr_panorama field from content
  if (props.room?.vr_panorama) return props.room.vr_panorama
  // Fallback: known rooms with panoramas (in case content DB cache hasn't propagated)
  const knownPanoramas = {
    'b1-103': '/images/labs/panoramas/b1-103_panorama.jpg'
  }
  return knownPanoramas[props.room?.room_id] || null
})

// Helper to get clean machine ID matching path
function getCleanId(mach) {
  if (!mach || !mach.id) return ''
  return mach.id.split('/').pop().replace(/\.md$/, '')
}

// Scroll position listener
function handleScroll() {
  if (!scrollContainer.value) return
  const el = scrollContainer.value
  const maxScroll = el.scrollHeight - el.clientHeight
  if (maxScroll <= 0) {
    scrollPercent.value = 0
    currentSlideIndex.value = 0
    return
  }
  scrollPercent.value = (el.scrollTop / maxScroll) * 100
  
  // Calculate current active slide index
  const slideHeight = el.clientHeight
  if (slideHeight > 0) {
    currentSlideIndex.value = Math.round(el.scrollTop / slideHeight)
  }
}

let debounceTimeout = null

// Watch currentSlideIndex and sync to URL query parameter with 300ms debounce
watch(currentSlideIndex, (idx) => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    const query = { ...route.query }
    const offset = isMobileView.value ? 2 : 1
    if (idx < offset) {
      delete query.mach
    } else {
      const mach = props.equipment[idx - offset]
      if (mach) {
        query.mach = getCleanId(mach)
      }
    }
    
    if (route.query.mach !== query.mach) {
      router.replace({ query })
    }
  }, 300)
})

// Next slide scroller
function scrollToNext(idx, smooth = true) {
  if (!scrollContainer.value) return
  const behavior = smooth ? 'smooth' : 'auto'
  if (isMobileView.value) {
    if (idx === 0) {
      slide0Image.value?.scrollIntoView({ behavior })
    } else if (idx === 1) {
      slide0Details.value?.scrollIntoView({ behavior })
    } else {
      const machineSections = scrollContainer.value.querySelectorAll('section')
      // machineSections[0] is Slide 0 parent.
      // machineSections[1] is Slide 1 (idx = 2).
      const targetSection = machineSections[idx - 1]
      if (targetSection) {
        targetSection.scrollIntoView({ behavior })
      }
    }
  } else {
    const slides = scrollContainer.value.querySelectorAll('section')
    if (slides[idx]) {
      slides[idx].scrollIntoView({ behavior })
    }
  }
}

function scrollToTop() {
  if (!scrollContainer.value) return
  scrollContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
}

function scrollToActiveMachine() {
  // Only auto-scroll if there's an explicit mach query param (user navigated via URL)
  if (!route.query.mach || !props.equipment.length || !scrollContainer.value) return
  const targetId = route.query.mach
  const targetIdx = props.equipment.findIndex(mach => getCleanId(mach) === targetId)
  if (targetIdx !== -1) {
    const slideIdx = targetIdx + (isMobileView.value ? 2 : 1)
    // Use requestAnimationFrame to ensure layout is fully painted before scrolling
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollToNext(slideIdx, false)
      }, 150)
    })
  }
}

// Scroll on mount
onMounted(() => {
  if (route.query.view === '3d') {
    viewMode.value = '3d'
  }
  // Only scroll to a machine if the URL explicitly specifies one
  if (route.query.mach) {
    scrollToActiveMachine()
  }
})

// Watch equipment changes but only scroll if URL has mach param AND not already at correct slide
watch(() => props.equipment, (newEquip, oldEquip) => {
  // Only trigger if equipment list just loaded for the first time (was empty before)
  if (!oldEquip?.length && newEquip?.length && route.query.mach) {
    scrollToActiveMachine()
  }
}, { deep: true })

// Targeting crosshair coordinate calculations
function handleMouseMove(e) {
  const container = e.currentTarget
  const rect = container.getBoundingClientRect()
  mouseX.value = ((e.clientX - rect.left) / rect.width) * 100
  mouseY.value = ((e.clientY - rect.top) / rect.height) * 100
  isHovering.value = true
}

function handleMouseLeave() {
  isHovering.value = false
}
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
