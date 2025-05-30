<template>
  <div v-if="visible" class="fixed bottom-4 left-4 z-[1000] p-4 rounded-lg shadow-xl bg-zinc-800/90 text-white backdrop-blur-md border border-zinc-700 w-80 transition-all duration-300 ease-out" :class="visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'">
    <div class="flex justify-between items-center mb-2">
      <h3 class="text-sm font-semibold">New Update Available!</h3>
      <button @click="dismiss" aria-label="Dismiss update notification" class="text-zinc-400 hover:text-white transition-colors p-1 rounded-full hover:bg-zinc-700">
        <XIcon class="w-4 h-4" />
      </button>
    </div>
    <p class="text-xs text-zinc-300 mb-1">Version {{ version }} is ready.</p>
    <p v-if="releaseNotes && releaseNotes !== `Version ${version} is available.` && releaseNotes !== `Version ${version} has been downloaded.`" class="text-xs text-zinc-400 mb-3 max-h-20 overflow-y-auto custom-scrollbar">{{ releaseNotes }}</p>
    <div class="flex space-x-2 mt-2">
      <Button @click="installOrDownload" size="sm" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
        {{ (platform === 'darwin' && isManualDownload) ? 'Download Update' : 'Install & Restart' }}
      </Button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
// Assuming Button component is from Shadcn/Vue setup
// Adjust the import path if your Button component is located elsewhere.
// If you don't have a pre-styled Button, you might need to create one or use a standard HTML button with Tailwind.
import { Button } from '@/components/ui/button/index';
import { XIcon } from 'lucide-vue-next';

defineProps({
  visible: Boolean,
  version: String,
  releaseNotes: String,
  isManualDownload: Boolean,
  platform: String,
});

const emit = defineEmits(['install', 'dismiss']);

const installOrDownload = () => {
  emit('install'); // App.vue will handle the logic based on platform
};

const dismiss = () => {
  emit('dismiss');
};
</script>

<style scoped>
/* Basic transition for enter/leave - can be enhanced */
.fixed {
  /* High z-index to ensure it's on top of most content */
  z-index: 1000; 
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #777;
}
</style> 