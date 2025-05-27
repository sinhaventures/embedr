<template>
  <div class="fixed inset-0 flex items-center justify-center bg-[#1A1A1A] bg-opacity-95 backdrop-blur-xl">
    <div class="w-full max-w-xl p-10 bg-[#2A2A2A]/80 backdrop-blur-md rounded-2xl border border-[#3A3A3C] shadow-xl relative overflow-hidden">
      <!-- Subtle glow effects -->
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-[#FF453A]/10 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-[#0A84FF]/10 rounded-full blur-3xl"></div>
      
      <!-- Content -->
      <div class="relative">
        <!-- Logo -->
        <div class="flex justify-center mb-8">
          <div class="w-16 h-16 bg-[#323234] rounded-2xl flex items-center justify-center shadow-sm">
            <img src="../assets/logo-small.png" alt="Embedr Logo" class="w-10 h-10">
          </div>
        </div>

        <!-- Welcome Text -->
        <h1 class="text-xl font-medium tracking-tight text-[#EBEBF5] mb-3 text-center">Welcome to Embedr</h1>
        <p class="text-[#EBEBF5]/60 text-sm text-center mb-8">
          A complete embedded development environment, designed to make it faster and easier to build, upload, and manage Arduino projects from the comfort of your desktop.
        </p>

        <!-- Terms and Conditions -->
        <div class="space-y-4 mb-8">
          <label class="flex items-start gap-3 text-xs cursor-pointer group">
            <input 
              type="checkbox" 
              v-model="terms" 
              class="mt-0.5 rounded border-[#3A3A3C] bg-[#323234] text-[#0A84FF] focus:ring-[#0A84FF]/20"
            >
            <span class="text-[#EBEBF5]/80 group-hover:text-[#EBEBF5] transition-colors">
              I accept the terms and conditions for Embedr Services
            </span>
          </label>
        </div>

        <!-- Confirm Button -->
        <div class="flex justify-end">
          <button 
            @click="handleConfirm"
            :disabled="!terms"
            :class="[
              'px-6 py-2.5 rounded-lg text-sm font-medium transition-all',
              terms 
                ? 'bg-rose-500 hover:bg-rose-600 text-white cursor-pointer' 
                : 'bg-gray-500 text-[#EBEBF5]/40 cursor-not-allowed'
            ]"
          >
            Continue
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

<style scoped>
input[type="checkbox"] {
  transition: all 0.2s ease;
  border-width: 1px;
}
</style> 