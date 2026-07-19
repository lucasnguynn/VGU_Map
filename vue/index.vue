<template>
  <div class="relative w-screen h-screen bg-[#070A12] text-white flex flex-col overflow-hidden font-sans">
    <!-- Navbar / Cyber HUD Bar -->
    <header class="h-16 landscape:h-11 border-b border-[#EF5A24]/20 bg-[#0F1E36]/80 backdrop-blur-md px-6 flex items-center justify-between z-30 shrink-0 transition-all duration-300">
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
          @click="goToMap" 
          class="px-2.5 py-1 sm:px-4 sm:py-1.5 landscape:py-0.5 landscape:px-2 rounded-lg text-[10px] sm:text-xs landscape:text-[9px] font-technical border border-white/15 text-white/60 hover:text-white transition-all duration-300 cursor-pointer"
        >
          INTERACTIVE MAP
        </button>
        <button 
          class="px-2.5 py-1 sm:px-4 sm:py-1.5 landscape:py-0.5 landscape:px-2 rounded-lg text-[10px] sm:text-xs landscape:text-[9px] font-technical border bg-[#EF5A24]/10 border-[#EF5A24] text-[#EF5A24] transition-all duration-300"
        >
          ALL INSTRUMENTS
        </button>
      </div>
    </header>

    <!-- Main View Content -->
    <main class="flex-grow relative overflow-hidden bg-[#070A12]">
      <AllQueriesView 
        v-if="equipmentList.length"
        :items="equipmentList" 
        @back-to-map="goToMap" 
        @select-item="openEquipmentDetail"
      />
      <div v-else class="h-full flex items-center justify-center text-white/30 text-xs font-technical">
        LOADING REPOSITORY DATA...
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAsyncData } from '#app'

const router = useRouter()

// Fetch data collections from Nuxt Content v3
const { data: equipment } = await useAsyncData('equipment', () => queryCollection('equipment').all())

const equipmentList = computed(() => {
  return (equipment.value || []).filter(item => {
    const id = item.id || item._path || ''
    const baseId = id.split('/').pop().replace(/\.md$/, '')
    return baseId !== 'schema-guide' && !id.includes('schema-guide')
  })
})

useSeoMeta({
  title: 'Equipment Search | VGU MSI Laboratories',
  description: 'Search and filter across all VGU Materials Science laboratories and equipment.',
  ogTitle: 'Equipment Search | VGU MSI Laboratories',
  ogDescription: 'Search and filter across all VGU Materials Science laboratories and equipment.'
})

function goToMap() {
  router.push('/')
}

function getCleanId(mach) {
  if (!mach || !mach.id) return ''
  return mach.id.split('/').pop().replace(/\.md$/, '')
}

function openEquipmentDetail(mach) {
  router.push(`/equipment/${getCleanId(mach)}`)
}
</script>
