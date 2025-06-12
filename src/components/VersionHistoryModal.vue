<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18" />
            <path d="M18.4 8.64L13.93 3.5" />
            <path d="M20.94 14.15L13.13 20.68" />
            <path d="M7.17 4.48L14.9 12.92" />
          </svg>
          Version History
        </DialogTitle>
        <DialogDescription>
          View and restore previous versions of your sketch
        </DialogDescription>
      </DialogHeader>

      <div class="overflow-y-auto flex-1 -mx-6 px-6">
        <!-- Diff Viewer Section -->
        <div v-if="diffVersion" class="mb-6 bg-[#1E1E1E] rounded-md overflow-hidden border border-[#333]">
          <div class="bg-[#252525] px-4 py-2 flex items-center justify-between">
            <div class="text-white/90 flex items-center">
              <span class="text-sm font-medium">
                Displaying changes for v{{ diffVersion.targetVersionInfo.version }} ({{ formatVersionRelative(diffVersion.targetVersionInfo.timestamp) }})
              </span>
            </div>
            <Button size="sm" variant="ghost" @click="closeDiff" class="h-8 px-3">
              Close Diff
            </Button>
          </div>
          <CodeDiffViewer :oldCode="diffVersion.oldContentForDiff" :newCode="diffVersion.newContentForDiff" />
        </div>
        
        <!-- Preview Section -->
        <div v-else-if="previewVersion" class="mb-6 bg-[#1E1E1E] rounded-md overflow-hidden border border-[#333]">
          <div class="bg-[#252525] px-4 py-2 flex items-center justify-between">
            <div class="text-white/90">
              <span class="text-sm font-medium">
                Preview of v{{ previewVersion.version }} ({{ formatVersionRelative(previewVersion.timestamp) }})
              </span>
            </div>
            <Button size="sm" variant="ghost" @click="closePreview" class="h-8 px-3">
              Close Preview
            </Button>
          </div>
          <pre class="text-sm p-4 overflow-x-auto whitespace-pre">{{ previewVersion.content }}</pre>
        </div>
        
        <!-- Versions List and States -->
        <!-- Loading State -->
        <div v-if="versionsLoading" class="py-8 text-center">
          <div class="inline-block w-6 h-6 border-2 border-t-transparent border-white/30 rounded-full animate-spin"></div>
          <p class="mt-2 text-sm text-white/60">Loading version history...</p>
        </div>
        
        <!-- Error State -->
        <div v-else-if="versionsError" class="py-6 text-center">
          <p class="text-red-400 mb-4">{{ versionsError }}</p>
          <Button variant="secondary" size="sm" @click="retryLoadVersions">
            Retry
          </Button>
        </div>
        
        <!-- Empty State -->
        <div v-else-if="versions.length === 0" class="py-8 text-center text-white/60">
          <p>No version history found</p>
        </div>
        
        <!-- Versions List -->
        <div v-else class="space-y-4">
          <div v-for="(version, index) in versions" :key="version.path" class="border border-[#333] rounded-md overflow-hidden">
            <div class="bg-[#252525] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="text-white/90">
                <span class="inline-flex items-center justify-center bg-[#1c3144] text-[#58a6ff] text-xs px-2 py-0.5 rounded-full mr-2 font-medium">v{{ version.version }}</span>
                <span class="text-sm">{{ formatVersionRelative(version.timestamp) }}</span>
              </div>
              <div class="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  :disabled="diffLoading === version.path"
                  @click="handleDiff(version, index)"
                  class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333]"
                >
                  <template v-if="diffLoading === version.path">
                    <span class="mr-1 w-3 h-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                  </template>
                  <template v-else>
                    <svg xmlns="http://www.w3.org/2000/svg" class="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 17l-5-5 5-5" />
                      <path d="M18 17l-5-5 5-5" />
                    </svg>
                  </template>
                  Compare
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  :disabled="restoreLoading === version.path"
                  @click="handleRestore(version)"
                  class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333]"
                >
                  <template v-if="restoreLoading === version.path">
                    <span class="mr-1 w-3 h-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                  </template>
                  <template v-else>
                    <svg xmlns="http://www.w3.org/2000/svg" class="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </template>
                  Restore
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  :disabled="deleteLoading === version.path"
                  @click="handleDelete(version)"
                  class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333] text-red-400 hover:text-red-300"
                >
                  <template v-if="deleteLoading === version.path">
                    <span class="mr-1 w-3 h-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                  </template>
                  <template v-else>
                    <svg xmlns="http://www.w3.org/2000/svg" class="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </template>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="mt-4 border-t border-[#333] pt-4">
        <Button variant="secondary" @click="$emit('update:open', false)">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import CodeDiffViewer from './CodeDiffViewer.vue' // Assuming this is in the same directory

const props = defineProps({
  open: Boolean,
  currentInoPath: String,
  // code: String, // No longer needed directly, restore emits new code
})

const emit = defineEmits(['update:open', 'restore-version'])

const versions = ref([])
const versionsLoading = ref(false)
const versionsError = ref(null)
const previewVersion = ref(null)
// const previewLoading = ref(null) // Not used in template
const restoreLoading = ref(null)
const diffVersion = ref(null)
const diffLoading = ref(null)
const deleteLoading = ref(null)

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

async function loadVersions() {
  if (!props.currentInoPath) return
  
  versionsLoading.value = true
  versionsError.value = null
  
  try {
    const res = await window.electronAPI.listVersions(props.currentInoPath)
    if (res.success) {
      versions.value = res.versions || []
    } else {
      throw new Error(res.error || 'Failed to load versions')
    }
  } catch (e) {
    console.error('Error loading versions:', e)
    versionsError.value = 'Failed to load version history. Please try again.'
    versions.value = []
  } finally {
    versionsLoading.value = false
  }
}

async function handleRestore(version) {
  if (restoreLoading.value === version.path) return
  if (!confirm('Are you sure you want to restore this version? Any unsaved changes will be lost.')) return
  
  restoreLoading.value = version.path
  try {
    const res = await window.electronAPI.readVersion(version.path)
    const newCode = res && typeof res.content === 'string' ? res.content : ''
    emit('restore-version', newCode)
    isOpen.value = false // Close modal after restoring
  } catch (e) {
    console.error('Error restoring version:', e)
    alert('Failed to restore version. Please try again.')
  } finally {
    restoreLoading.value = null
  }
}

function closePreview() {
  previewVersion.value = null
}

async function retryLoadVersions() {
  await loadVersions()
}

watch(() => props.open, (newValue) => {
  if (newValue) {
    loadVersions()
  } else {
    // Reset states when modal is closed
    previewVersion.value = null
    // previewLoading.value = null; // Not used
    restoreLoading.value = null
    versionsError.value = null
    diffVersion.value = null
    diffLoading.value = null
    deleteLoading.value = null
    versions.value = []
  }
})

async function handleDiff(selectedVersionToViewChangesFor, index) {
  if (diffLoading.value === selectedVersionToViewChangesFor.path) return;
  
  previewVersion.value = null; // Close preview if open
  diffLoading.value = selectedVersionToViewChangesFor.path;

  try {
    const newSideRes = await window.electronAPI.readVersion(selectedVersionToViewChangesFor.path);
    const newSideContent = newSideRes && typeof newSideRes.content === 'string' ? newSideRes.content : '';

    let oldSideContent = '';
    const previousVersionIndex = index + 1; 

    if (previousVersionIndex < versions.value.length) {
      const previousVersion = versions.value[previousVersionIndex];
      const oldSideRes = await window.electronAPI.readVersion(previousVersion.path);
      oldSideContent = oldSideRes && typeof oldSideRes.content === 'string' ? oldSideRes.content : '';
    } else {
      oldSideContent = '';
    }

    diffVersion.value = {
      oldContentForDiff: oldSideContent,
      newContentForDiff: newSideContent,
      targetVersionInfo: selectedVersionToViewChangesFor 
    };

  } catch (e) {
    console.error('Error loading diff:', e);
    alert('Failed to load comparison. Please try again.'); 
    diffVersion.value = null; 
  } finally {
    diffLoading.value = null;
  }
}

function closeDiff() {
  diffVersion.value = null
}

async function handleDelete(version) {
  if (deleteLoading.value === version.path) return
  
  if (!confirm('Are you sure you want to delete this version? This action cannot be undone.')) return
  
  deleteLoading.value = version.path
  try {
    const res = await window.electronAPI.deleteVersion(version.path)
    if (res.success) {
      if (previewVersion.value?.path === version.path) {
        previewVersion.value = null
      }
      if (diffVersion.value?.targetVersionInfo.path === version.path) { // Check targetVersionInfo
        diffVersion.value = null
      }
      await loadVersions()
    } else {
      throw new Error(res.error || 'Failed to delete version')
    }
  } catch (e) {
    console.error('Error deleting version:', e)
    alert('Failed to delete version. Please try again.')
  } finally {
    deleteLoading.value = null
  }
}

function formatVersionRelative(ts) {
  if (!ts) return 'Invalid Date'
  let isoString = ts;
  if (isoString.endsWith('Z')) {
    const parts = isoString.slice(0, -1).split('T'); 
    if (parts.length === 2) {
      const datePart = parts[0]; 
      const timeAndMsPart = parts[1]; 
      const timeMsSegments = timeAndMsPart.split('-');
      if (timeMsSegments.length === 4) { 
        const HH = timeMsSegments[0];
        const mm = timeMsSegments[1];
        const ss = timeMsSegments[2];
        const sss = timeMsSegments[3];
        isoString = `${datePart}T${HH}:${mm}:${ss}.${sss}Z`;
      } else {
        let hasZ = ts.endsWith('Z');
        let tempTs = ts;
        if (hasZ) tempTs = tempTs.slice(0, -1);
        let match = tempTs.match(/^([0-9-]+)T([0-9-]+)-([0-9]+)$/);
        if (match) {
          isoString = match[1] + 'T' + match[2].replace(/-/g, ':') + '.' + match[3];
          if (hasZ) isoString += 'Z';
        } else {
          isoString = 'invalid'; 
        }
      }
    } else {
       isoString = 'invalid'; 
    }
  } else {
    let tempTs = ts;
    let match = tempTs.match(/^([0-9-]+)T([0-9-]+)-([0-9]+)$/);
    if (match) {
      isoString = match[1] + 'T' + match[2].replace(/-/g, ':') + '.' + match[3];
    } else {
      isoString = 'invalid';
    }
  }
  
  if (isoString === 'invalid') return 'Invalid Date';

  const d = new Date(isoString)
  if (isNaN(d)) return 'Invalid Date'
  const now = new Date()
  const diff = (now - d) / 1000 
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}hr ago`
  if (diff < 172800) return '1 day ago'
  return d.toLocaleString('en-US', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
  })
}

// Expose methods for parent to call if needed (though loadVersions is called internally on open)
defineExpose({
  loadVersions
});

</script>

<style scoped>
/* Styles can be copied or refactored from EditorPage.vue if specific to this modal */
</style> 