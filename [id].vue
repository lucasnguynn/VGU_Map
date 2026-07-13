<template>
  <div v-if="item" class="w-full h-full bg-[#070A12]">
    <EquipmentDetail 
      :item="item" 
      @close="goBack" 
    />
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAsyncData } from '#app'

const route = useRoute()
const router = useRouter()

const { data: item } = await useAsyncData(`equipment-details-${route.params.id}`, () => {
  return queryCollection('equipment').all().then(items => {
    return items.find(item => {
      const baseId = item.id.split('/').pop().replace(/\.md$/, '')
      return baseId === route.params.id
    })
  })
})

useSeoMeta({
  title: () => item.value ? `${item.value.title} | VGU MSI Laboratories` : 'Equipment Detail',
  description: () => item.value ? item.value.optional_information?.physics?.primary_mechanism || `Technical specification and details of ${item.value.title} at VGU MSI.` : 'Explore VGU MSI Equipment Specs.',
  ogTitle: () => item.value ? `${item.value.title} | VGU MSI Laboratories` : 'Equipment Detail',
  ogDescription: () => item.value ? item.value.optional_information?.physics?.primary_mechanism || `Technical specification and details of ${item.value.title} at VGU MSI.` : 'Explore VGU MSI Equipment Specs.',
  ogImage: () => {
    if (!item.value || !item.value.media || !item.value.media.images) return null
    const hl = item.value.media.images.find(img => typeof img === 'object' && img !== null && img.highlighted)
    const first = hl || item.value.media.images[0]
    if (typeof first === 'object' && first !== null) {
      return first.src || first.url || first.path || null
    }
    return first
  }
})

function goBack() {
  const backState = window.history.state && window.history.state.back
  if (backState && backState.startsWith('/')) {
    router.back()
  } else {
    router.push('/equipment')
  }
}
</script>
