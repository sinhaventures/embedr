<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-[#232323] rounded-xl shadow-xl p-8 w-[350px] relative">
      <button @click="$emit('close')" class="absolute top-4 right-4 text-white/60 hover:text-white/90 text-xl">&times;</button>
      <h2 class="text-xl font-semibold mb-6">Settings</h2>
      <form @submit.prevent="updateName" class="space-y-4">
        <div>
          <label class="block text-sm text-white/60 mb-1">First Name</label>
          <input v-model="firstName" type="text" class="w-full px-4 py-2 bg-[#252525] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B8EFF]/50 text-white/90" />
        </div>
        <button type="submit" class="w-full py-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity">Update</button>
      </form>
      <div class="mt-8 border-t border-white/10 pt-4">
        <button @click="logout" class="w-full py-2 bg-red-600/80 hover:bg-red-700 rounded-lg text-white font-medium transition-colors">Logout</button>
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
  initialName: String
})
const emit = defineEmits(['close', 'name-updated', 'logged-out'])

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