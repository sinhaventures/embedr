<template>
  <div class="min-h-screen bg-[#1E1E1E] text-white/90">
    <router-view v-if="!isLoading" />
    <div v-else class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/90"></div>
    </div>
  </div>
</template>

<script setup>
import { useAuth } from './composables/useAuth'
import { useRouter, useRoute } from 'vue-router'
import { watch } from 'vue'

const { isLoading, user } = useAuth()
const router = useRouter()
const route = useRoute()

watch([isLoading, user, route], ([loading, currentUser, currentRoute]) => {
  console.log('App.vue state:', { loading, currentUser, currentRoute: currentRoute.fullPath })
  if (!loading && !currentUser) {
    router.push('/auth')
  }
})
</script>

<style scoped>
.vrp-handle-vertical {
  width: 6px;
  background-color: rgba(120, 120, 120, 0.1);
  transition: background-color 0.15s;
}
.vrp-handle-vertical:hover, .vrp-handle-vertical[data-active="true"] {
  background-color: rgba(120, 120, 120, 0.2);
}

.vrp-handle-horizontal {
  height: 6px;
  background-color: rgba(120, 120, 120, 0.1);
  transition: background-color 0.15s;
}
.vrp-handle-horizontal:hover, .vrp-handle-horizontal[data-active="true"] {
  background-color: rgba(120, 120, 120, 0.2);
}

.vrp-panel > div {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.vrp-panel .bg-\[\#1E1E1E\] {
  display: flex;
  flex: 1;
}
.vrp-panel .bg-\[\#1E1E1E\] > * {
  flex: 1;
}
</style>
