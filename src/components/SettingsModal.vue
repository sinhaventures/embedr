<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-[#232323] rounded-xl shadow-xl p-8 w-[400px] relative">
      <button @click="$emit('close')" class="absolute top-4 right-4 text-white hover:text-white flex items-center justify-center h-8 w-8 rounded-full hover:bg-white/10 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      
      <h2 class="text-xl font-semibold mb-6 text-left">Settings</h2>
      
      <div class="space-y-6 text-left">
        <!-- User Profile Section -->
        <form @submit.prevent="updateName" class="space-y-4">
          <input v-model="firstName" type="text" placeholder="First Name" class="w-full px-4 py-2 bg-[#1A1A1A] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-white/90" />
          <button type="submit" class="w-full py-2.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-sm">
            Save Changes
          </button>
        </form>
        
        <!-- Account Management Section -->
        <div class="pt-4 border-t border-white/10">
          <h3 class="text-md font-medium mb-3">Account Management</h3>
          <button 
             @click="$emit('manage-subscription')"
             :disabled="isManageSubscriptionLoading"
             class="flex items-center justify-between w-full px-4 py-2.5 mb-3 rounded-lg bg-[#323232] hover:bg-[#383838] active:bg-[#2a2a2a] transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-2 text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>{{ isManageSubscriptionLoading ? 'Opening Portal...' : 'Manage Subscription & Usage' }}</span>
            </div>
            <svg v-if="!isManageSubscriptionLoading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-white"><path d="M7 17l9.2-9.2M17 17V7H7"></path></svg>
            <!-- Optional: Add a spinner for loading state -->
            <svg v-if="isManageSubscriptionLoading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </button>
        </div>
        
        <!-- Logout Section -->
        <div class="pt-4 border-t border-white/10">
          <button @click="logout" class="w-full py-2.5 rounded-lg bg-red-600/20 text-red-400 font-medium hover:bg-red-600/30 active:bg-red-600/40 transition-colors">
            Logout
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
</style> 