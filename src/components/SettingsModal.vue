<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-[#1E1E1E] rounded-xl shadow-xl p-6 w-[400px] border border-white/10 relative">
      <!-- Close Button with better visibility -->
      <button 
        @click="$emit('close')" 
        class="absolute top-4 right-4 text-white/60 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10 z-10"
        aria-label="Close Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      <h2 class="text-xl font-semibold mb-6 text-left bg-gradient-to-r from-rose-400 via-rose-500 to-pink-600 text-transparent bg-clip-text">Settings</h2>
      
      <div class="space-y-6 text-left">
        <!-- User Profile Section -->
        <div class="space-y-4">
          <div class="pb-3 border-b border-white/10">
            <h3 class="text-sm font-medium text-white/90 mb-3">Profile</h3>
            <form @submit.prevent="updateName" class="space-y-4">
              <input 
                v-model="firstName" 
                type="text" 
                placeholder="First Name" 
                class="w-full px-4 py-2.5 bg-[#252525] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 text-white/90 placeholder-white/40 transition-all" 
              />
              <button 
                type="submit" 
                class="w-full py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 active:from-rose-700 active:to-pink-800 transition-all duration-200 shadow-sm"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
        
        <!-- Account Management Section -->
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-white/90 mb-3">Account Management</h3>
          <button 
             @click="$emit('manage-subscription')"
             :disabled="isManageSubscriptionLoading"
             class="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-[#252525] hover:bg-[#2A2A2A] active:bg-[#222] transition-all duration-200 text-white disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 hover:border-white/10 group"
          >
            <div class="flex items-center">
              <div class="p-1.5 rounded-md bg-blue-500/10 mr-3 group-hover:bg-blue-500/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <span class="text-sm font-medium">
                {{ isManageSubscriptionLoading ? 'Opening Portal...' : 'Manage Subscription & Usage' }}
              </span>
            </div>
            <div class="flex items-center">
              <svg v-if="!isManageSubscriptionLoading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-white/40 group-hover:text-white/60 transition-colors">
                <path d="M7 17l9.2-9.2M17 17V7H7"></path>
              </svg>
              <!-- Loading Spinner -->
              <svg v-if="isManageSubscriptionLoading" class="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </button>
        </div>
        
        <!-- Logout Section -->
        <div class="pt-4 border-t border-white/10">
          <button 
            @click="logout" 
            class="w-full py-2.5 rounded-lg bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 hover:text-red-300 active:bg-red-500/30 transition-all duration-200 border border-red-500/20 hover:border-red-500/30"
          >
            <div class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { auth } from '../firebase/config'
import { updateProfile, signOut } from 'firebase/auth'

const props = defineProps({
  show: Boolean,
  initialName: String,
  isManageSubscriptionLoading: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['close', 'name-updated', 'logged-out', 'manage-subscription'])

const firstName = ref(props.initialName || '')

watch(() => props.initialName, (val) => {
  firstName.value = val || ''
})

async function updateName() {
  if (!firstName.value.trim()) return
  try {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: firstName.value.trim() })
      emit('name-updated', firstName.value.trim())
    }
  } catch (e) {
    // handle error (show notification, etc.)
    console.error('Failed to update name:', e)
  }
}

async function logout() {
  await signOut(auth)
  emit('logged-out')
}
</script>

<style scoped>
.bg-clip-text {
  -webkit-background-clip: text;
}

/* Smooth transitions for all interactive elements */
input, button {
  transition: all 0.2s ease;
}

/* Custom focus styles */
input:focus {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(244, 63, 94, 0.15);
}

button:not(:disabled):hover {
  transform: translateY(-1px);
}

button:not(:disabled):active {
  transform: translateY(0);
}

/* Placeholder styling */
input::placeholder {
  transition: color 0.2s ease;
}

input:focus::placeholder {
  color: rgba(255, 255, 255, 0.3);
}
</style> 