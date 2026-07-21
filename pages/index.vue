<template>
  <div class="relative w-screen h-screen bg-[#070A12] text-white flex flex-col overflow-hidden font-sans">
    <!-- Navbar / Cyber HUD Bar -->
    <header 
      :class="[
        'h-16 landscape:h-11 border-b border-[#EF5A24]/20 bg-[#0F1E36]/80 backdrop-blur-md px-6 flex items-center justify-between z-30 shrink-0 transition-all duration-300',
        isMapFullscreen ? 'hidden md:flex' : 'flex'
      ]"
    >
      <div class="flex items-center gap-3">
        <!-- VGU Branded Badge -->
        <div class="bg-[#EF5A24] text-white px-3 py-1 rounded-md text-sm font-technical font-extrabold uppercase tracking-wider shadow-[0_0_10px_#EF5A24]">
          VGU
        </div>
        <div class="hidden sm:block">
          <h1 class="text-sm font-bold text-white uppercase tracking-wider">LABORATORIES GALLERY</h1>
          <span class="text-[10px] text-[#06B6D4] font-technical tracking-widest uppercase">MSI DIGITAL TWIN v1.0</span>
        </div>
      </div>
      
      <!-- Top Nav controls -->
      <div class="flex items-center gap-2 sm:gap-4">
        <button 
          class="px-2.5 py-1 sm:px-4 sm:py-1.5 landscape:py-0.5 landscape:px-2 rounded-lg text-[10px] sm:text-xs landscape:text-[9px] font-technical border bg-[#EF5A24]/10 border-[#EF5A24] text-[#EF5A24] transition-all duration-300"
        >
          INTERACTIVE MAP
        </button>
        <button 
          @click="goToQueries" 
          class="px-2.5 py-1 sm:px-4 sm:py-1.5 landscape:py-0.5 landscape:px-2 rounded-lg text-[10px] sm:text-xs landscape:text-[9px] font-technical border border-white/15 text-white/60 hover:text-white transition-all duration-300 cursor-pointer"
        >
          ALL INSTRUMENTS
        </button>
      </div>
    </header>

    <!-- Main View Switcher -->
    <main class="flex-grow relative overflow-hidden">
      <!-- 1. Interactive Spatial Map View -->
      <div class="w-full h-full flex flex-col landscape:flex-row md:flex-row relative">
        <!-- Sidebar Navigation (Desktop) -->
        <aside 
          :class="[
            'w-full md:w-80 border-b md:border-b-0 md:border-r border-white/10 bg-[#070A12]/95 z-20 shrink-0 flex flex-col transition-all duration-300',
            isMapFullscreen ? 'h-0 overflow-hidden md:h-full border-b-0' : 'h-1/3 md:h-full landscape:w-72 landscape:h-full landscape:border-r landscape:border-b-0'
          ]"
        >
          <!-- Single Line Header Mode (Fullscreen mobile map) -->
          <div v-if="isMapFullscreen" class="md:hidden flex items-center justify-between px-5 h-12 shrink-0 bg-[#0F1E36]/30 border-b border-white/10">
            <div v-if="selectedBuilding" class="flex items-center gap-2">
              <button @click="resetToCampus" class="text-[#EF5A24] text-xs hover:underline flex items-center gap-1 font-technical">
                ← CAMPUS
              </button>
              <span class="text-white/30 text-xs">/</span>
              <span class="text-xs text-white/60 uppercase font-bold truncate max-w-[160px]">{{ selectedBuilding.replace('-', ' ') }}</span>
            </div>
            <div v-else class="flex items-center">
              <span class="text-xs font-technical font-bold text-[#EF5A24] tracking-widest uppercase">VGU CAMPUS OVERVIEW</span>
            </div>
            <span class="text-[9px] font-technical text-[#06B6D4]/80 font-bold uppercase tracking-wider animate-pulse">MAP EXPANDED</span>
          </div>

          <!-- Standard Sidebar Content -->
          <div :class="['flex-grow flex flex-col overflow-hidden', { 'hidden md:flex': isMapFullscreen }]">
            <div class="p-5 flex flex-col gap-4 overflow-y-auto h-full">
              <Transition name="fade-slide" mode="out-in">
                <!-- State A: Campus Map overview -->
                <div v-if="!selectedBuilding" class="flex flex-col gap-4" key="campus">
                  <h2 class="text-lg font-bold text-[#EF5A24]">VGU Campus Blocks</h2>
                  <p class="text-xs text-white/50 leading-relaxed">
                    Click on the highlighted academic blocks on the interactive map or select below to explore laboratories.
                  </p>
                  <div class="flex flex-col gap-2.5 mt-2">
                    <button 
                      v-for="(tele, bId) in clusterTelemetry"
                      :key="bId"
                      @click="selectedBuilding = bId; selectedFloor = 1"
                      class="relative flex items-center justify-between p-4 rounded-xl bg-[#0F1E36]/30 border border-white/10 hover:border-[#EF5A24] hover:bg-[#EF5A24]/5 hover:shadow-[0_0_15px_rgba(239,90,36,0.15)] text-left transition-all duration-300 group overflow-hidden"
                    >
                      <!-- Cyber corner decorations -->
                      <span class="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-[#EF5A24]/30 group-hover:border-[#EF5A24] transition-colors"></span>
                      <span class="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-[#EF5A24]/30 group-hover:border-[#EF5A24] transition-colors"></span>
                      <span class="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-[#EF5A24]/30 group-hover:border-[#EF5A24] transition-colors"></span>
                      <span class="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-[#EF5A24]/30 group-hover:border-[#EF5A24] transition-colors"></span>

                      <div class="flex items-center gap-3">
                        <div 
                          class="w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-300"
                          :class="[
                            bId === 'cluster-1' || bId === 'cluster-5' 
                              ? 'border-[#EF5A24]/20 group-hover:border-[#EF5A24] text-[#EF5A24] bg-[#EF5A24]/5' 
                              : 'border-[#06B6D4]/20 group-hover:border-[#06B6D4] text-[#06B6D4] bg-[#06B6D4]/5'
                          ]"
                        >
                          <UIcon :name="tele.icon" class="w-5 h-5" />
                        </div>
                        <div>
                          <div class="font-technical text-[10px] font-bold text-white/50 tracking-wider flex items-center gap-1.5">
                            <span>{{ tele.code }}</span>
                            <span class="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                            <span class="text-[8px] font-normal uppercase">ACTIVE</span>
                          </div>
                          <div class="font-extrabold text-sm text-white mt-0.5 group-hover:text-[#EF5A24] transition-colors">{{ tele.label }}</div>
                        </div>
                      </div>
                      
                      <div class="text-right flex flex-col items-end">
                        <span class="text-[10px] font-technical text-white/80 font-bold">LABS: {{ tele.labsCount }}</span>
                        <span class="text-[9px] font-technical text-white/40 mt-0.5">UNITS: {{ tele.equipCount }}</span>
                      </div>
                    </button>
                  </div>
                </div>

                <!-- State B: Building Floor details view -->
                <div v-else class="flex flex-col gap-4" key="building">
                  <div class="flex items-center gap-2">
                    <button @click="resetToCampus" class="text-[#EF5A24] text-xs hover:underline">← CAMPUS</button>
                    <span class="text-white/30 text-xs">/</span>
                    <span class="text-xs text-white/60 uppercase font-bold">{{ buildingDisplayName(selectedBuilding) }}</span>
                  </div>

                  <!-- Floor telemetry header -->
                  <div class="flex items-center justify-between gap-2">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                      <span class="text-[#EF5A24] font-technical">L{{ selectedFloor }}</span>
                      <span>Rooms</span>
                    </h2>
                    <div class="flex items-center gap-1.5 font-technical text-[10px]">
                      <span class="px-2 py-0.5 rounded-full border border-white/10 text-white/60">{{ floorTelemetry.total }} rooms</span>
                      <span class="px-2 py-0.5 rounded-full border border-[#EF5A24]/30 text-[#EF5A24]">{{ floorTelemetry.instruments }} units</span>
                    </div>
                  </div>

                  <TransitionGroup name="list-fade" tag="div" class="flex flex-col gap-2">
                    <button 
                      v-for="room in filteredRooms" 
                      :key="room.room_id"
                      @click="selectRoom(room.room_id)"
                      :class="[
                        'group relative flex flex-col gap-1 p-3 pl-4 rounded-lg border text-left text-xs transition-all duration-300 overflow-hidden',
                        selectedRoomId === room.room_id
                          ? 'bg-[#EF5A24]/10 border-[#EF5A24] shadow-[0_0_12px_rgba(239,90,36,0.15)]'
                          : 'bg-[#0F1E36]/50 border-white/5 hover:border-white/20'
                      ]"
                    >
                      <!-- Active accent bar -->
                      <span 
                        class="absolute left-0 top-0 bottom-0 w-0.5 transition-colors duration-300"
                        :class="selectedRoomId === room.room_id ? 'bg-[#EF5A24]' : 'bg-transparent group-hover:bg-white/20'"
                      ></span>
                      <div class="flex justify-between items-center gap-2">
                        <span class="font-bold font-technical" :class="selectedRoomId === room.room_id ? 'text-[#EF5A24]' : 'text-white'">
                          {{ room.room_id.toUpperCase() }}
                        </span>
                        <span class="flex items-center gap-1 text-[9px] font-technical uppercase" :class="statusMeta(room.status).text">
                          <span class="w-1 h-1 rounded-full" :class="statusMeta(room.status).dot"></span>
                          {{ statusMeta(room.status).label }}
                        </span>
                      </div>
                      <div class="text-[11px] text-white/60 line-clamp-1">{{ room.name }}</div>
                      <div v-if="roomEquipmentCount(room.room_id)" class="flex items-center gap-1 text-[9px] font-technical text-[#06B6D4]/80 mt-0.5">
                        <UIcon name="i-lucide-cpu" class="w-3 h-3" />
                        {{ roomEquipmentCount(room.room_id) }} instrument{{ roomEquipmentCount(room.room_id) > 1 ? 's' : '' }}
                      </div>
                    </button>
                    <div v-if="!filteredRooms.length" key="no-rooms" class="text-xs text-white/40 italic py-6 text-center flex flex-col items-center gap-2 bg-white/5 border border-dashed border-white/10 rounded-lg">
                      <UIcon name="i-lucide-layers" class="w-6 h-6 text-white/20" />
                      No laboratories on this floor yet.
                    </div>
                  </TransitionGroup>
                </div>
              </Transition>
            </div>
          </div>
        </aside>

        <!-- Interactive Map Canvas -->
        <div :class="['flex-grow relative z-10 transition-all duration-300', isMapFullscreen ? 'h-full w-full' : 'h-2/3 md:h-full w-full landscape:h-full landscape:w-auto']">
          <!-- Floating Fullscreen Toggle Button on Mobile -->
          <button 
            @click="isMapFullscreen = !isMapFullscreen" 
            :class="[
              'md:hidden absolute z-30 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0F1E36]/90 hover:bg-[#EF5A24]/10 border border-[#EF5A24]/30 hover:border-[#EF5A24] text-[10px] text-[#EF5A24] hover:text-white transition-all duration-300 font-technical shadow-lg backdrop-blur-md',
              isMapFullscreen ? 'top-4 right-4' : 'top-16 sm:top-20 right-4'
            ]"
          >
            <UIcon :name="isMapFullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'" class="w-3.5 h-3.5" />
            <span>{{ isMapFullscreen ? 'EXIT FULL' : 'FULL MAP' }}</span>
          </button>

          <VguMap 
            :selected-building="selectedBuilding"
            :selected-floor="selectedFloor"
            :selected-room-id="selectedRoomId"
            @select-building="selectBuilding"
            @select-floor="selectFloor"
            @select-room="selectRoom"
            @reset="resetToCampus"
          />
        </div>

        <Transition name="slide-in">
          <div 
            v-if="selectedRoomDetail" 
            class="absolute top-0 right-0 z-30 w-full landscape:w-80 md:w-[420px] h-full bg-[#070A12]/95 border-l border-[#EF5A24]/30 flex flex-col shadow-2xl"
            style="view-transition-name: room-drawer"
          >
            <!-- Drawer Header -->
            <div class="relative p-5 border-b border-white/10 shrink-0 overflow-hidden">
              <!-- Ambient corner glow -->
              <div class="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[#EF5A24]/10 blur-3xl pointer-events-none"></div>

              <div class="relative flex justify-between items-start gap-3">
                <div class="min-w-0">
                  <!-- Breadcrumb eyebrow: building // floor // room code -->
                  <div class="flex items-center gap-1.5 text-[10px] font-technical uppercase font-bold tracking-wider flex-wrap">
                    <span class="text-[#EF5A24]">{{ buildingDisplayName(selectedRoomDetail.building_id) }}</span>
                    <span class="text-white/20">//</span>
                    <span class="text-white/50">Floor {{ selectedRoomDetail.floor ?? '—' }}</span>
                    <span class="text-white/20">//</span>
                    <span class="text-[#06B6D4]">{{ (selectedRoomDetail.room_id || '').toUpperCase() }}</span>
                  </div>
                  <h3 class="text-xl font-bold text-white mt-1.5 leading-tight" style="view-transition-name: room-title">
                    {{ selectedRoomDetail.name }}
                  </h3>
                  <!-- Semantic status pill -->
                  <div 
                    class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-technical font-bold uppercase tracking-wider"
                    :class="statusMeta(selectedRoomDetail.status).ring"
                  >
                    <span class="w-1.5 h-1.5 rounded-full animate-pulse" :class="statusMeta(selectedRoomDetail.status).dot"></span>
                    <span :class="statusMeta(selectedRoomDetail.status).text">{{ statusMeta(selectedRoomDetail.status).label }}</span>
                  </div>
                </div>
                <button 
                  @click="closeRoomDrawer" 
                  class="shrink-0 text-white/40 hover:text-white transition-colors border border-white/10 hover:border-white/30 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5"
                  aria-label="Close room details"
                >
                  <UIcon name="i-lucide-x" class="w-4 h-4" />
                </button>
              </div>

              <!-- Telemetry stat strip -->
              <div class="relative mt-4 grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-white/10 bg-white/10 font-technical">
                <div class="px-3 py-2 bg-[#0F1E36]/60">
                  <div class="text-[9px] text-white/40 uppercase tracking-wider">Floor</div>
                  <div class="text-sm font-bold text-white mt-0.5">L{{ selectedRoomDetail.floor ?? '—' }}</div>
                </div>
                <div class="px-3 py-2 bg-[#0F1E36]/60">
                  <div class="text-[9px] text-white/40 uppercase tracking-wider">Instruments</div>
                  <div class="text-sm font-bold text-[#EF5A24] mt-0.5">{{ roomEquipmentCount(selectedRoomDetail.room_id) }}</div>
                </div>
                <div class="px-3 py-2 bg-[#0F1E36]/60">
                  <div class="text-[9px] text-white/40 uppercase tracking-wider">Depts</div>
                  <div class="text-sm font-bold text-[#06B6D4] mt-0.5">{{ (selectedRoomDetail.departments || []).length }}</div>
                </div>
              </div>
            </div>

            <!-- Drawer Content -->
            <div class="flex-grow overflow-y-auto p-5 flex flex-col gap-5">
              <!-- Room Preview Image with department chips -->
              <div class="relative w-full h-44 landscape:h-28 bg-slate-950 rounded-xl overflow-hidden border border-white/10 shrink-0 select-none scanline">
                <NuxtImg 
                  :src="labImages[0]" 
                  format="avif"
                  class="w-full h-full object-cover filter brightness-[0.85] contrast-[1.10]" 
                  style="view-transition-name: room-image"
                  alt="Laboratory preview"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-[#070A12] via-transparent to-transparent opacity-70"></div>
                <div v-if="(selectedRoomDetail.departments || []).length" class="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
                  <span 
                    v-for="dep in selectedRoomDetail.departments" 
                    :key="dep"
                    class="px-2 py-0.5 rounded bg-[#070A12]/80 border border-[#06B6D4]/30 text-[9px] font-technical text-[#06B6D4] uppercase tracking-wide backdrop-blur-sm"
                  >{{ dep }}</span>
                </div>
              </div>

              <!-- Lab Coordinator info -->
              <div class="vgu-panel p-3.5 rounded-lg border border-white/5 bg-white/5 flex items-center gap-3">
                <div class="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center bg-[#EF5A24]/10 border border-[#EF5A24]/30 text-[#EF5A24] font-technical font-bold text-sm">
                  {{ coordinatorInitials(selectedRoomDetail.head_of_lab?.name) }}
                </div>
                <div class="min-w-0 flex-grow">
                  <div class="text-[9px] text-white/40 font-technical uppercase tracking-wider font-semibold">Laboratory Coordinator</div>
                  <div class="text-white font-bold text-sm truncate">{{ selectedRoomDetail.head_of_lab?.name || 'To be assigned' }}</div>
                  <div v-if="selectedRoomDetail.head_of_lab?.office" class="flex items-center gap-1 text-[10px] text-white/50 font-technical mt-0.5">
                    <UIcon name="i-lucide-map-pin" class="w-3 h-3 shrink-0" />
                    <span class="truncate">{{ selectedRoomDetail.head_of_lab.office }}</span>
                  </div>
                </div>
                <a 
                  v-if="selectedRoomDetail.head_of_lab?.email"
                  :href="`mailto:${selectedRoomDetail.head_of_lab.email}`"
                  class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border border-[#06B6D4]/30 text-[#06B6D4] hover:bg-[#06B6D4]/10 hover:border-[#06B6D4] transition-all"
                  :title="selectedRoomDetail.head_of_lab.email"
                >
                  <UIcon name="i-lucide-mail" class="w-4 h-4" />
                </a>
              </div>

              <!-- Overview & Access (MDC content) -->
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2 text-[#EF5A24] text-[10px] font-technical uppercase font-bold tracking-widest">
                  <UIcon name="i-lucide-file-text" class="w-3.5 h-3.5" />
                  <span>Overview &amp; Access</span>
                </div>
                <div class="text-xs leading-relaxed text-white/80 select-text prose-vgu">
                  <ContentRenderer v-if="selectedRoomDetail.body" :value="selectedRoomDetail" />
                  <p v-else class="text-white/60 italic">{{ selectedRoomDetail.description || 'No description available for this laboratory yet.' }}</p>
                </div>
              </div>

              <!-- Featured Instruments -->
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-[#EF5A24] text-[10px] font-technical uppercase font-bold tracking-widest">
                    <UIcon name="i-lucide-cpu" class="w-3.5 h-3.5" />
                    <span>Featured Instruments</span>
                  </div>
                  <span class="text-[10px] font-technical text-white/40 px-2 py-0.5 rounded-full border border-white/10">{{ highlightedMachines.length }}</span>
                </div>

                <div v-if="highlightedMachines.length" class="flex flex-col gap-2.5">
                  <button 
                    v-for="mach in highlightedMachines" 
                    :key="mach.id"
                    @click="openEquipmentDetail(mach)"
                    class="vgu-panel p-3 rounded-lg border border-white/5 hover:border-[#EF5A24]/50 hover:bg-[#EF5A24]/[0.04] cursor-pointer flex gap-3 group transition-all duration-300 text-left w-full items-center"
                  >
                    <div class="w-16 h-14 bg-slate-950 rounded overflow-hidden shrink-0 border border-white/10 flex items-center justify-center">
                      <NuxtImg v-if="mach.media?.images?.length" :src="getFirstImage(mach)" format="avif" class="w-full h-full object-cover" :alt="mach.title" />
                      <UIcon v-else name="i-lucide-flask-conical" class="w-5 h-5 text-white/20" />
                    </div>
                    <div class="flex-grow min-w-0">
                      <div class="text-[9px] font-technical text-white/40 truncate">{{ mach.manufacturer }} · {{ mach.model }}</div>
                      <div class="text-xs font-bold text-white group-hover:text-[#EF5A24] transition-colors truncate mt-0.5">{{ mach.title }}</div>
                      <div class="flex items-center gap-1.5 mt-1">
                        <span class="w-1 h-1 rounded-full" :class="statusMeta(mach.status).dot"></span>
                        <span class="text-[9px] font-technical uppercase" :class="statusMeta(mach.status).text">{{ statusMeta(mach.status).label }}</span>
                      </div>
                    </div>
                    <UIcon name="i-lucide-arrow-up-right" class="w-4 h-4 text-white/20 group-hover:text-[#EF5A24] transition-colors shrink-0" />
                  </button>
                </div>
                
                <div v-else class="text-xs text-white/30 italic py-5 bg-white/5 border border-dashed border-white/10 rounded-lg text-center flex flex-col items-center gap-2">
                  <UIcon name="i-lucide-package-open" class="w-6 h-6 text-white/20" />
                  No instruments catalogued for this cell yet.
                </div>
              </div>
            </div>

            <!-- Footer actions -->
            <div class="p-4 border-t border-white/10 bg-[#0F1E36]/40 flex gap-2 shrink-0">
              <button 
                @click="openRoomTour(selectedRoomDetail)" 
                class="flex-grow bg-[#EF5A24] hover:bg-[#EF5A24]/90 text-white font-technical font-bold text-xs py-3 rounded-lg text-center shadow-[0_0_15px_rgba(239,90,36,0.3)] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
              >
                <UIcon name="i-lucide-play" class="w-4 h-4" />
                VIEW TOUR
              </button>

              <button 
                v-if="selectedRoomDetail.vr_panorama"
                @click="openRoom3D(selectedRoomDetail)" 
                class="cyber-3d-btn shrink-0 p-3 rounded-lg cursor-pointer"
                title="View Room in 3D"
              >
                <UIcon name="i-lucide-box" class="w-4 h-4 shrink-0 text-[#06B6D4]" />
                <span class="cyber-3d-btn-text">3D Room</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- AllQueriesView has been moved to its own page at /equipment -->

      <!-- Overlays migrated to dedicated /tour and /equipment pages -->
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

import { useRoute, useRouter } from 'vue-router'

const selectedBuilding = ref(null)
const selectedFloor = ref(null)
const selectedRoomId = ref(null)
const isMapFullscreen = ref(false)

const route = useRoute()
const router = useRouter()

// Sync route queries to restore focused campus map states on page load/navigation
watch(() => route.query, (newQuery) => {
  selectedBuilding.value = newQuery.building || null
  selectedFloor.value = newQuery.floor ? parseInt(newQuery.floor) : null
  selectedRoomId.value = newQuery.room || null
}, { immediate: true })

// Watch map selection states and update URL queries accordingly to preserve state transparency
watch([selectedBuilding, selectedFloor, selectedRoomId], ([b, f, r]) => {
  const query = {}
  if (b) query.building = b
  if (f) query.floor = String(f)
  if (r) query.room = r
  
  const currentQuery = route.query
  if (
    currentQuery.building !== query.building ||
    currentQuery.floor !== query.floor ||
    currentQuery.room !== query.room
  ) {
    router.replace({ query })
  }
})

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

// 1. Fetch data collections from Nuxt Content v3
const { data: labs } = await useAsyncData('labs', () => queryCollection('labs').all())
const { data: equipment } = await useAsyncData('equipment', () => queryCollection('equipment').all())

const labsList = computed(() => labs.value || [])
const equipmentList = computed(() => {
  return (equipment.value || []).filter(item => {
    const id = item.id || item._path || ''
    const baseId = id.split('/').pop().replace(/\.md$/, '')
    return baseId !== 'schema-guide' && !id.includes('schema-guide')
  })
})

// ── Display helpers ───────────────────────────────────────────────────────
// Map internal building ids (cluster-1…) to human-readable names.
const BUILDING_NAMES = {
  'cluster-1': 'Academic Cluster 1',
  'cluster-2': 'Academic Cluster 2',
  'cluster-3': 'Academic Cluster 3',
  'cluster-5': 'Academic Cluster 5',
  'cluster-6': 'Academic Cluster 6'
}
function buildingDisplayName(id) {
  if (!id) return 'VGU Campus'
  return BUILDING_NAMES[id] || id.replace(/-/g, ' ').toUpperCase()
}

// Semantic status → { label, dot, text, ring } theme classes.
function statusMeta(status) {
  const key = (status || 'active').toLowerCase()
  const map = {
    active:      { label: 'Operational', dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'border-emerald-400/40 bg-emerald-400/10' },
    operational: { label: 'Operational', dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'border-emerald-400/40 bg-emerald-400/10' },
    maintenance: { label: 'Maintenance', dot: 'bg-amber-400',   text: 'text-amber-400',   ring: 'border-amber-400/40 bg-amber-400/10' },
    offline:     { label: 'Offline',     dot: 'bg-red-500',      text: 'text-red-400',     ring: 'border-red-500/40 bg-red-500/10' },
    restricted:  { label: 'Restricted',  dot: 'bg-[#EF5A24]',    text: 'text-[#EF5A24]',   ring: 'border-[#EF5A24]/40 bg-[#EF5A24]/10' }
  }
  return map[key] || { label: status || 'Active', dot: 'bg-[#06B6D4]', text: 'text-[#06B6D4]', ring: 'border-[#06B6D4]/40 bg-[#06B6D4]/10' }
}

// Instrument count per room across the whole equipment collection (computed once).
const equipmentCountByRoom = computed(() => {
  const counts = {}
  for (const e of equipmentList.value) {
    const rid = e.location?.room_id
    if (rid) counts[rid] = (counts[rid] || 0) + 1
  }
  return counts
})
function roomEquipmentCount(roomId) {
  return equipmentCountByRoom.value[roomId] || 0
}

// Initials for the coordinator avatar (last two name tokens).
function coordinatorInitials(name) {
  if (!name) return '—'
  return name.split(/\s+/).filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase() || '—'
}

// 2. Fetch the floorplan GeoJSON dynamically in the parent to support comprehensive room listing
const currentFloorGeojson = ref(null)

watch([selectedBuilding, selectedFloor], async ([newB, newF]) => {
  if (!newB || !newF) {
    currentFloorGeojson.value = null
    return
  }
  try {
    const res = await fetch(`/data/floorplans/msi-floor${newF}.json`)
    currentFloorGeojson.value = await res.json()
  } catch (err) {
    console.error('Failed to fetch floorplan json', err)
    currentFloorGeojson.value = null
  }
}, { immediate: true })

const config = useRuntimeConfig()
const displayOnlyRoomsWithMachines = computed(() => config.public.displayOnlyRoomsWithMachines)

// 3. Computed filtering operations
const filteredRooms = computed(() => {
  if (!selectedBuilding.value || !selectedFloor.value) return []
  
  // Get all rooms from labs collection on this floor
  const labRooms = labsList.value.filter(
    room => room.building_id === selectedBuilding.value && room.floor === selectedFloor.value
  )
  
  if (displayOnlyRoomsWithMachines.value) {
    return labRooms.map(lr => ({
      room_id: lr.room_id,
      name: lr.name,
      status: lr.status || 'active'
    }))
  }
  
  // Otherwise, get all rooms from floorplan JSON excluding structural items
  if (!currentFloorGeojson.value) return []
  
  return currentFloorGeojson.value.features
    .filter(f => 
      f.properties.building_id === selectedBuilding.value &&
      f.properties.type === 'laboratory'
    )
    .map(f => {
      const matchingLab = labRooms.find(lr => lr.room_id === f.properties.room_id)
      return {
        room_id: f.properties.room_id,
        name: matchingLab ? matchingLab.name : f.properties.name,
        status: matchingLab ? matchingLab.status : 'active'
      }
    })
})

// Aggregate telemetry for the current floor's room list header.
const floorTelemetry = computed(() => {
  const rooms = filteredRooms.value
  const active = rooms.filter(r => (r.status || 'active').toLowerCase() === 'active').length
  const instruments = rooms.reduce((sum, r) => sum + roomEquipmentCount(r.room_id), 0)
  return { total: rooms.length, active, instruments }
})

const selectedRoomDetail = computed(() => {
  if (!selectedRoomId.value) return null
  
  // Find in labs collection first
  const lab = labsList.value.find(room => room.room_id === selectedRoomId.value)
  if (lab) return lab
  
  // Fallback to GeoJSON properties
  if (!currentFloorGeojson.value) return null
  const feature = currentFloorGeojson.value.features.find(f => f.properties.room_id === selectedRoomId.value)
  if (!feature) return null
  
  return {
    room_id: feature.properties.room_id,
    name: feature.properties.name,
    building_id: feature.properties.building_id,
    floor: feature.properties.level,
    departments: [feature.properties.department || 'General Academic'],
    head_of_lab: {
      name: "TBD",
      email: "facilities@vgu.edu.vn",
      office: "Facilities Office"
    },
    status: "active",
    highlighted_equipment: [],
    description: "This laboratory cell is designated for research and study. Full instrumentation and staffing inventories are pending the next phase of the digital twin projection."
  }
})

const highlightedMachines = computed(() => {
  if (!selectedRoomDetail.value || !selectedRoomDetail.value.highlighted_equipment) return []
  const hlIds = selectedRoomDetail.value.highlighted_equipment
  return equipmentList.value.filter(mach => {
    const baseId = mach.id.split('/').pop().replace(/\.md$/, '')
    return hlIds.includes(baseId) || hlIds.includes(mach.id)
  })
})



// 4. Cluster dynamic stats telemetry
const clusterTelemetry = computed(() => {
  const data = {
    'cluster-1': { label: 'Cluster 1', code: 'SEC-A1', icon: 'i-lucide-atom' },
    'cluster-2': { label: 'Cluster 2', code: 'SEC-A2', icon: 'i-lucide-binary' },
    'cluster-3': { label: 'Cluster 3', code: 'SEC-A3', icon: 'i-lucide-settings' },
    'cluster-5': { label: 'Cluster 5', code: 'SEC-B5', icon: 'i-lucide-flask-conical' },
    'cluster-6': { label: 'Cluster 6', code: 'SEC-B6', icon: 'i-lucide-trending-up' }
  }
  
  const stats = {}
  Object.keys(data).forEach(c => {
    const cLabs = labsList.value.filter(l => l.building_id === c)
    const cEquip = equipmentList.value.filter(e => e.location?.building_id === c)
    stats[c] = {
      ...data[c],
      labsCount: cLabs.length,
      equipCount: cEquip.length
    }
  })
  return stats
})

// 3. Selection Handlers
function selectBuilding(buildingId) {
  selectedBuilding.value = buildingId
  selectedFloor.value = 1 // default to floor 1
  selectedRoomId.value = null
}

function selectFloor(floorNum) {
  selectedFloor.value = floorNum
  selectedRoomId.value = null
}

function selectRoom(roomId) {
  selectedRoomId.value = roomId
}

function resetToCampus() {
  selectedBuilding.value = null
  selectedFloor.value = null
  selectedRoomId.value = null
}

function closeRoomDrawer() {
  selectedRoomId.value = null
}

function getCleanId(mach) {
  if (!mach || !mach.id) return ''
  return mach.id.split('/').pop().replace(/\.md$/, '')
}

function openEquipmentDetail(mach) {
  router.push(`/equipment/${getCleanId(mach)}`)
}

function goToQueries() {
  router.push('/equipment')
}

function openRoomTour(room) {
  router.push(`/tour/${room.room_id}`)
}

const labImages = computed(() => {
  if (!selectedRoomDetail.value || !selectedRoomDetail.value.departments || !Array.isArray(selectedRoomDetail.value.departments)) {
    return ['/images/labs/materials_science_lab.png', '/images/labs/electrical_engineering_lab.png']
  }
  const isEE = selectedRoomDetail.value.departments.some(d => 
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

function openRoom3D(room) {
  router.push(`/tour/${room.room_id}?view=3d`)
}
</script>

<style scoped>
.slide-in-enter-active,
.slide-in-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-in-enter-from,
.slide-in-leave-to {
  transform: translateX(100%);
}

/* MDC content styling inside the room drawer (deep, since ContentRenderer
   output is not scoped) — matches the HUD identity without a heavy prose plugin. */
.prose-vgu :deep(h1),
.prose-vgu :deep(h2),
.prose-vgu :deep(h3),
.prose-vgu :deep(h4) {
  font-family: 'Space Mono', 'Fira Code', monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #06B6D4;
  margin: 0.75rem 0 0.4rem;
}
.prose-vgu :deep(h3:first-child),
.prose-vgu :deep(h2:first-child),
.prose-vgu :deep(p:first-child) {
  margin-top: 0;
}
.prose-vgu :deep(p) {
  margin: 0 0 0.6rem;
  color: rgba(255, 255, 255, 0.75);
}
.prose-vgu :deep(ol),
.prose-vgu :deep(ul) {
  margin: 0 0 0.6rem;
  padding-left: 0;
  list-style: none;
  counter-reset: vgu-step;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.prose-vgu :deep(li) {
  position: relative;
  padding-left: 1.6rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}
.prose-vgu :deep(ol > li)::before {
  counter-increment: vgu-step;
  content: counter(vgu-step);
  position: absolute;
  left: 0;
  top: 0.05rem;
  width: 1.1rem;
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
  font-size: 0.6rem;
  font-weight: 700;
  color: #EF5A24;
  background: rgba(239, 90, 36, 0.1);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 4px;
}
.prose-vgu :deep(ul > li)::before {
  content: "";
  position: absolute;
  left: 0.35rem;
  top: 0.5rem;
  width: 5px;
  height: 5px;
  background: #06B6D4;
  border-radius: 50%;
}
.prose-vgu :deep(a) {
  color: #06B6D4;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.prose-vgu :deep(strong) {
  color: #fff;
  font-weight: 700;
}
.prose-vgu :deep(code) {
  font-family: 'Space Mono', monospace;
  font-size: 0.75em;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: rgba(6, 182, 212, 0.1);
  color: #06B6D4;
}
</style>

