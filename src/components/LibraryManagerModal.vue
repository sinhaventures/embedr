<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col bg-[#1E1E1E]">
      <DialogHeader class="px-6 pt-6 pb-4 border-b border-[#333]">
        <DialogTitle class="flex items-center text-white/90">
          <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          Library Manager
        </DialogTitle>
        <DialogDescription class="text-white/60">
          Search, install, and manage Arduino libraries
        </DialogDescription>
      </DialogHeader>
      
      <!-- Tabs Navigation -->
      <div class="px-6 pt-4 flex-shrink-0">
        <nav class="inline-flex p-1 bg-[#252525] rounded-lg tab_switching_bar w-full" aria-label="Library Manager tabs">
          <button
            @click="activeLibraryTab = 'search'"
            :class="[
              'relative flex-1 px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-out',
              activeLibraryTab === 'search' 
                ? 'bg-[#333] text-white/90 shadow-sm' 
                : 'text-white/60 hover:text-white/80'
            ]"
          >
            Search & Install
          </button>
          <button
            @click="activeLibraryTab = 'installed'"
            :class="[
              'relative flex-1 px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-out',
              activeLibraryTab === 'installed' 
                ? 'bg-[#333] text-white/90 shadow-sm' 
                : 'text-white/60 hover:text-white/80'
            ]"
          >
            Installed Libraries
          </button>
        </nav>
      </div>

      <div class="flex-1 overflow-y-auto pb-2 px-6 pt-4 space-y-4 custom-scrollbar">
        <!-- Search & Install Tab -->
        <div v-if="activeLibraryTab === 'search'" class="space-y-4">
          <div class="flex gap-2 items-center">
            <input 
              v-model="librarySearch" 
              @keyup.enter="handleLibrarySearch" 
              placeholder="Search libraries (e.g., Adafruit NeoPixel)" 
              class="flex-1 h-9 rounded-md bg-[#252525] px-3 text-sm text-white/90 placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-[#5B8EFF] border border-[#333]"
            />
            <Button size="sm" @click="handleLibrarySearch" :disabled="searchLoading" variant="outline" class="h-9 px-4 border-[#444] hover:border-[#666] bg-[#252525] hover:bg-[#333]">
              <span v-if="searchLoading" class="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
              Search
            </Button>
          </div>

          <div v-if="searchLoading" class="py-8 text-center">
            <div class="inline-block w-5 h-5 border-2 border-t-transparent border-white/30 rounded-full animate-spin"></div>
            <p class="mt-2 text-xs text-white/60">Searching libraries...</p>
          </div>
          
          <div v-if="searchError" class="p-3 bg-red-900/20 border border-red-700/50 rounded-md text-sm text-red-400">
            Error: {{ searchError }}
          </div>

          <div v-if="!searchLoading && searchResults.length > 0" class="space-y-3">
            <div v-for="lib in searchResults" :key="lib.name" class="border border-[#333] bg-[#252525] rounded-md overflow-hidden">
              <div class="px-4 py-3 flex items-center justify-between gap-3">
                <div class="flex-1 space-y-0.5">
                  <h4 class="font-medium text-sm text-white/90">{{ lib.name }}</h4>
                  <p class="text-xs text-white/60 leading-snug">{{ lib.version ? lib.version + ' — ' : '' }}{{ lib.sentence }}</p>
                </div>
                <div class="flex-shrink-0">
                  <template v-if="installedLibraries.some(inst => inst.name === lib.name)">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      @click="handleUninstallLibrary(installedLibraries.find(inst => inst.name === lib.name))" 
                      :disabled="uninstalling === lib.name"
                      class="h-8 px-3 border-[#444] hover:border-[#666] bg-[#333] hover:bg-[#404040] text-red-400 hover:text-red-300"
                    >
                      <template v-if="uninstalling === lib.name">
                        <span class="mr-1.5 h-3 w-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                        Uninstalling
                      </template>
                      <template v-else>
                        <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        Uninstall
                      </template>
                    </Button>
                  </template>
                  <template v-else>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      @click="handleInstallLibrary(lib)" 
                      :disabled="installing === lib.name"
                      class="h-8 px-3 border-[#444] hover:border-[#666] bg-[#333] hover:bg-[#404040]"
                    >
                      <template v-if="installing === lib.name">
                        <span class="mr-1.5 h-3 w-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                        Installing
                      </template>
                      <template v-else>
                        <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Install
                      </template>
                    </Button>
                  </template>
                </div>
              </div>
            </div>
            <p v-if="installError" class="text-red-400 text-xs mt-2 pl-1">{{ installError }}</p>
          </div>
          
          <div v-if="!searchLoading && !searchError && searchResults.length === 0 && librarySearch" class="py-8 text-center text-white/60">
            <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10 text-white/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <p class="text-sm">No libraries found matching "{{ librarySearch }}"</p>
            <p class="text-xs text-white/50 mt-1">Try a different search term.</p>
          </div>
        </div>

        <!-- Installed Libraries Tab -->
        <div v-if="activeLibraryTab === 'installed'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="font-medium text-sm text-white/90">Manage Installed Libraries</h4>
            <Button 
              size="sm" 
              variant="outline" 
              @click="handleUpdateIndex" 
              :disabled="updatingIndex || fetchInProgress"
              class="h-8 px-3 border-[#444] hover:border-[#666] bg-[#252525] hover:bg-[#333]"
            >
              <template v-if="updatingIndex">
                <span class="mr-1.5 h-3 w-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                Updating
              </template>
              <template v-else>
                <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                </svg>
                Update Index
              </template>
            </Button>
          </div>

          <div v-if="updateError" class="p-3 bg-red-900/20 border border-red-700/50 rounded-md text-sm text-red-400">
            Error updating index: {{ updateError }}
          </div>

          <div v-if="fetchInProgress && installedLibraries.length === 0" class="py-8 text-center">
            <div class="inline-block w-5 h-5 border-2 border-t-transparent border-white/30 rounded-full animate-spin"></div>
            <p class="mt-2 text-xs text-white/60">Loading installed libraries...</p>
          </div>

          <div v-else-if="!fetchInProgress && installedLibraries.length === 0" class="py-8 text-center text-white/60">
            <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10 text-white/30 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v6M9 13h6" />
            </svg>
            <p class="text-sm">No installed libraries found</p>
            <p class="text-xs text-white/50 mt-1">Use the "Search & Install" tab to find and add libraries.</p>
          </div>

          <div v-else class="space-y-3">
            <div v-for="lib in installedLibraries" :key="lib.name" class="border border-[#333] bg-[#252525] rounded-md overflow-hidden">
              <div class="px-4 py-3 flex items-center justify-between gap-3">
                <div class="flex-1 space-y-0.5">
                  <h4 class="font-medium text-sm text-white/90">{{ lib.name }}</h4>
                  <p class="text-xs text-white/60 leading-snug">{{ lib.version }} &mdash; {{ lib.sentence }}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  @click="handleUninstallLibrary(lib)" 
                  :disabled="uninstalling === lib.name"
                  class="h-8 px-3 border-[#444] hover:border-[#666] bg-[#333] hover:bg-[#404040] text-red-400 hover:text-red-300"
                >
                  <template v-if="uninstalling === lib.name">
                    <span class="mr-1.5 h-3 w-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                    Uninstalling
                  </template>
                  <template v-else>
                     <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    Uninstall
                  </template>
                </Button>
              </div>
            </div>
            <p v-if="uninstallError" class="text-red-400 text-xs mt-2 pl-1">{{ uninstallError }}</p>
          </div>
        </div>
      </div>

      <DialogFooter class="px-6 py-4 mt-auto border-t border-[#333]">
        <Button variant="secondary" @click="$emit('update:open', false)" class="bg-[#333] hover:bg-[#404040] text-white/80 border-[#444] hover:border-[#666]">
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
  // DialogClose // Not explicitly used with asChild here
} from '@/components/ui/dialog'

const props = defineProps({
  open: Boolean
})

const emit = defineEmits(['update:open'])

const librarySearch = ref('')
const searchResults = ref([])
const installedLibraries = ref([])
const installing = ref('') // Track by name for specific spinner
const uninstalling = ref('') // Track by name
const updatingIndex = ref(false)
const searchLoading = ref(false)
const fetchInProgress = ref(false) // For loading installed libraries
const searchError = ref('')
const installError = ref('')
const uninstallError = ref('')
const updateError = ref('')
const activeLibraryTab = ref('search')

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

async function fetchInstalledLibraries() {
  fetchInProgress.value = true;
  uninstallError.value = ''; // Clear previous errors
  try {
    const res = await window.electronAPI.listLibraries()
    const libs = Array.isArray(res.libraries?.installed_libraries)
      ? res.libraries.installed_libraries.map(item => item.library)
      : [];
    if (res.success) {
      installedLibraries.value = libs.map(lib => ({
        name: lib.name,
        version: lib.version || 'N/A',
        sentence: lib.paragraph || lib.sentence || 'No description available.'
      })).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    } else {
      installedLibraries.value = []
      uninstallError.value = res.error || 'Failed to load installed libraries.';
    }
  } catch (e) {
    console.error('Error fetching installed libraries:', e)
    installedLibraries.value = []
    uninstallError.value = e.message;
  } finally {
    fetchInProgress.value = false;
  }
}

async function handleLibrarySearch() {
  if (!librarySearch.value.trim()) {
    searchResults.value = []
    searchError.value = ''
    return
  }
  searchLoading.value = true
  searchError.value = ''
  installError.value = ''
  searchResults.value = []
  try {
    const res = await window.electronAPI.searchLibrary(librarySearch.value.trim())
    if (res.success && Array.isArray(res.results?.libraries)) {
      searchResults.value = res.results.libraries.map(lib => ({
        name: lib.name,
        version: lib.version || 'Latest',
        sentence: lib.sentence || 'No description available.',
        author: lib.author || '',
      }))
    } else {
      searchError.value = res.error || 'Search failed or no results.'
    }
  } catch (e) {
    searchError.value = e.message
  } finally {
    searchLoading.value = false
  }
}

async function handleInstallLibrary(lib) {
  installing.value = lib.name 
  installError.value = ''
  searchError.value = ''
  try {
    const res = await window.electronAPI.installLibrary(lib.name)
    if (!res.success || (res.output && res.output.toLowerCase().includes('error'))) {
      installError.value = res.error || res.output || 'Installation failed.'
    } else {
      // Success, refresh installed list
      await fetchInstalledLibraries()
    }
  } catch (e) {
    installError.value = e.message
  } finally {
    installing.value = '' 
  }
}

async function handleUninstallLibrary(lib) {
  uninstalling.value = lib.name
  uninstallError.value = ''
  try {
    const res = await window.electronAPI.uninstallLibrary(lib.name)
    if (!res.success || (res.output && res.output.toLowerCase().includes('error'))) {
      uninstallError.value = res.error || res.output || 'Uninstallation failed.'
    } else {
       await fetchInstalledLibraries() 
    }
  } catch (e) {
    uninstallError.value = e.message
  } finally {
    uninstalling.value = '' 
  }
}

async function handleUpdateIndex() {
  updatingIndex.value = true
  updateError.value = ''
  searchError.value = '' // Clear search errors as well
  installError.value = '' // Clear install errors
  try {
    const res = await window.electronAPI.updateLibraryIndex()
    if (!res.success || (res.output && res.output.toLowerCase().includes('error'))) {
      updateError.value = res.error || res.output || 'Index update failed.'
    } else {
      // Optionally notify success, though the list refreshing is main feedback
      // alert('Library index updated successfully!');
      await fetchInstalledLibraries() 
    }
  } catch (e) {
    updateError.value = e.message
  } finally {
    updatingIndex.value = false
  }
}

watch(() => props.open, (newValue) => {
  if (newValue) {
    librarySearch.value = ''
    searchResults.value = []
    activeLibraryTab.value = 'search' // Default to search tab
    searchError.value = ''
    installError.value = ''
    uninstallError.value = ''
    updateError.value = ''
    fetchInstalledLibraries() // Fetch current installed list when modal opens
  }
});

// Expose methods if needed
// defineExpose({
//   fetchInstalledLibraries,
//   openModal: () => {
//     isOpen.value = true;
//   }
// });

</script>

<style scoped>
.tab_switching_bar button:focus-visible {
  outline: 2px solid var(--ring) !important;
  outline-offset: 2px !important;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #1E1E1E; /* Match modal background */
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333; /* Darker thumb for better contrast with #252525 items */
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #404040;
}
</style> 