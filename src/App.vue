<template>
  <div class="min-h-screen bg-[#1E1E1E] text-white/90">
    <router-view v-if="!isLoading" />
    <div v-else class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/90"></div>
    </div>
    <UpdateNotification 
      :visible="updateStore.updateAvailable.value" 
      :version="updateStore.newVersion.value"
      :release-notes="updateStore.releaseNotes.value" 
      :is-manual-download="updateStore.isManualDownload.value"
      :platform="platform"
      @install="handleInstallUpdate"
      @dismiss="handleDismissUpdate"
    />
  </div>
</template>

<script setup>
import { useAuth } from './composables/useAuth'
import { useRouter, useRoute } from 'vue-router'
import { watch, onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { getAuth, onIdTokenChanged } from 'firebase/auth'
import UpdateNotification from './components/UpdateNotification.vue';
import { useUpdateStore } from './composables/useUpdateStore';

const { isLoading, user } = useAuth()
const router = useRouter()
const route = useRoute()
const updateStore = useUpdateStore();
const platform = ref(window.electronAPI?.platform || 'unknown');

let unsubscribeTokenListener = null
let unsubscribeRequestAuthToken = null
let unsubscribeUpdateAvailable = null;
let unsubscribeUpdateDownloaded = null;
let unsubscribeUpdateError = null;

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

  if (window.electronAPI?.onUpdateAvailable) {
    const unsub = window.electronAPI.onUpdateAvailable((updateDetails) => {
      console.log('[App.vue] Received update-available from main:', updateDetails);
      updateStore.showUpdateNotification(updateDetails);
    });
    if (typeof unsub === 'function') unsubscribeUpdateAvailable = unsub;
  }

  if (window.electronAPI?.onUpdateDownloaded) {
    const unsub = window.electronAPI.onUpdateDownloaded((updateDetails) => {
      console.log('[App.vue] Received update-downloaded from main:', updateDetails);
      updateStore.showUpdateNotification(updateDetails);
    });
    if (typeof unsub === 'function') unsubscribeUpdateDownloaded = unsub;
  }
  
  if (window.electronAPI?.onUpdateError) {
    const unsub = window.electronAPI.onUpdateError((errorMsg) => {
      console.error('[App.vue] Received update-error from main:', errorMsg);
      updateStore.hideUpdateNotification();
    });
    if (typeof unsub === 'function') unsubscribeUpdateError = unsub;
  }
})

onBeforeUnmount(() => {
  if (unsubscribeTokenListener) unsubscribeTokenListener();
  if (unsubscribeRequestAuthToken) unsubscribeRequestAuthToken();
  
  if (window.electronAPI?.removeAllUpdateListeners) {
    window.electronAPI.removeAllUpdateListeners();
  } else {
    if (unsubscribeUpdateAvailable) unsubscribeUpdateAvailable();
    if (unsubscribeUpdateDownloaded) unsubscribeUpdateDownloaded();
    if (unsubscribeUpdateError) unsubscribeUpdateError();
  }
})

watch([isLoading, user, route], ([loading, currentUser, currentRoute]) => {
  console.log('App.vue state:', { loading, currentUser, currentRoute: currentRoute.fullPath })
  if (!loading && !currentUser) {
    router.push('/auth')
  }
})

const handleInstallUpdate = () => {
  console.log('[App.vue] User clicked install/download action.');
  if (platform.value === 'darwin' && updateStore.isManualDownload.value) {
    console.log('[App.vue] macOS manual download: Opening external URL.');
    if (window.electronAPI?.openManualDownloadUrl) {
      window.electronAPI.openManualDownloadUrl();
    }
  } else {
    console.log('[App.vue] Non-macOS or auto-download: Triggering quit and install.');
    if (window.electronAPI?.quitAndInstallUpdate) {
      window.electronAPI.quitAndInstallUpdate();
    }
  }
  updateStore.hideUpdateNotification();
};

const handleDismissUpdate = () => {
  console.log('[App.vue] User dismissed update notification.');
  updateStore.hideUpdateNotification();
};

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
