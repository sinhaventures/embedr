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
import { watch, onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { getAuth, onIdTokenChanged } from 'firebase/auth'

const { isLoading, user } = useAuth()
const router = useRouter()
const route = useRoute()

let unsubscribeTokenListener = null
let unsubscribeRequestAuthToken = null

async function sendTokenToMain(currentUser) {
  if (currentUser && window.electronAPI?.setFirebaseAuthToken) {
    try {
      const token = await currentUser.getIdToken()
      const idTokenResult = await currentUser.getIdTokenResult()
      const claims = idTokenResult.claims
      const expiryTime = claims.exp * 1000
      
      console.log('[Renderer:App.vue] Sending token to main. Expiry:', new Date(expiryTime))
      await window.electronAPI.setFirebaseAuthToken(token, expiryTime)
    } catch (error) {
      console.error('[Renderer:App.vue] Error sending token to main:', error)
    }
  }
}

onMounted(() => {
  const auth = getAuth()

  unsubscribeTokenListener = onIdTokenChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      console.log('[Renderer:App.vue] User token changed/available.')
      await sendTokenToMain(firebaseUser)
    } else {
      console.log('[Renderer:App.vue] User logged out or token unavailable.')
      if (window.electronAPI?.setFirebaseAuthToken) {
        await window.electronAPI.setFirebaseAuthToken(null, null)
      }
    }
  })

  if (window.electronAPI?.onRequestAuthToken) {
    unsubscribeRequestAuthToken = window.electronAPI.onRequestAuthToken(async () => {
      console.log('[Renderer:App.vue] Received request-auth-token from main.')
      const currentAuthUser = auth.currentUser
      if (currentAuthUser) {
        await sendTokenToMain(currentAuthUser)
      } else {
        console.warn('[Renderer:App.vue] Token requested by main, but no user is signed in.')
      }
    })
  }


})

onBeforeUnmount(() => {
  if (unsubscribeTokenListener) unsubscribeTokenListener();
  if (unsubscribeRequestAuthToken) unsubscribeRequestAuthToken();
})

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
