<template>
  <div class="fixed inset-0 flex items-center justify-center bg-[#121212] bg-gradient-to-br from-orange-500/5 via-purple-500/5 to-blue-500/5">
    <div class="w-full max-w-2xl p-12 bg-[#1E1E1E] rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
      <!-- Glow effects -->
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
      
      <!-- Content -->
      <div class="relative">
        <!-- Logo -->
        <div class="flex justify-center mb-8">
          <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-purple-500 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <!-- Welcome Text -->
        <h1 class="text-2xl font-semibold text-white mb-3 text-center">Welcome to Embedr</h1>
        <p class="text-white/60 text-center mb-8">
          A complete embedded development environment, designed to make it faster and easier to build, upload, and manage Arduino projects from the comfort of your desktop.
        </p>

        <!-- Terms and Conditions -->
        <div class="space-y-4 mb-8">
          <label class="flex items-start gap-3 text-sm cursor-pointer group">
            <input 
              type="checkbox" 
              v-model="terms" 
              class="mt-1 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/20"
            >
            <span class="text-white/80 group-hover:text-white/90">
              I accept the terms and conditions for Embedr Services
            </span>
          </label>

          <label class="flex items-start gap-3 text-sm cursor-pointer group">
            <input 
              type="checkbox" 
              v-model="updates" 
              class="mt-1 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/20"
            >
            <span class="text-white/80 group-hover:text-white/90">
              I want to receive email updates about Embedr news and features
            </span>
          </label>

          <label class="flex items-start gap-3 text-sm cursor-pointer group">
            <input 
              type="checkbox" 
              v-model="research" 
              class="mt-1 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/20"
            >
            <span class="text-white/80 group-hover:text-white/90">
              I'm interested in participating in research studies to improve Embedr
            </span>
          </label>
        </div>

        <!-- Confirm Button -->
        <div class="flex justify-end">
          <button 
            @click="handleConfirm"
            :disabled="!terms"
            :class="[
              'px-6 py-2 rounded-lg text-sm font-medium transition-all',
              terms 
                ? 'bg-purple-500 hover:bg-purple-600 text-white cursor-pointer' 
                : 'bg-white/5 text-white/40 cursor-not-allowed'
            ]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const terms = ref(false)
const updates = ref(false)
const research = ref(false)

const emit = defineEmits(['confirmed'])

function handleConfirm() {
  if (!terms.value) return
  
  // Store preferences in localStorage
  localStorage.setItem('embedr-welcomed', 'true')
  localStorage.setItem('embedr-preferences', JSON.stringify({
    updates: updates.value,
    research: research.value
  }))
  
  emit('confirmed')
}
</script> 