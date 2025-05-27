<template>
  <Transition name="modal-fade">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center overflow-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')"></div>
      
      <!-- Modal content -->
      <div class="relative bg-[#2D2D2D] rounded-xl shadow-xl p-6 w-[900px] max-w-[90vw] max-h-[90vh] overflow-auto z-10">
        <!-- Header with close button -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center">
            <h2 class="text-xl font-semibold">Arduino Core Manager</h2>
            <span class="ml-2 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded text-xs">Beta</span>
          </div>
          <button 
            @click="$emit('close')" 
            class="rounded-full p-1.5 hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X class="h-5 w-5 text-white/60 hover:text-white/90" />
          </button>
        </div>

        <!-- Core Manager Content -->
        <div class="core-manager space-y-6">
          <!-- Control Bar - Search and Update -->
          <div class="flex flex-wrap items-center justify-between gap-4 bg-[#222222] rounded-lg p-3">
            <div class="flex items-center gap-3">
              <Button @click="updateIndex" :disabled="isUpdating" variant="outline" size="sm" class="whitespace-nowrap h-9">
                <RefreshCcw v-if="isUpdating" class="h-4 w-4 animate-spin mr-2" />
                <RefreshCcw v-else class="h-4 w-4 mr-2" />
                Update Index
              </Button>
            </div>
            
            <div class="relative flex-1 max-w-md">
              <div class="relative flex items-center">
                <SearchIcon class="absolute left-3 h-4 w-4 text-white/40" />
                <input
                  v-model="searchQuery"
                  @keydown.enter="searchCores"
                  type="text"
                  placeholder="Search cores..."
                  class="pl-9 pr-3 py-2 rounded-lg bg-[#1A1A1A] border border-white/10 text-sm text-white/90 w-full focus:outline-none focus:ring-1 focus:ring-white/20"
                />
                <Button 
                  @click="searchCores" 
                  size="sm"
                  class="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 px-3"
                >
                  Search
                </Button>
              </div>
            </div>
          </div>

          <!-- Status Messages -->
          <div v-if="statusMessage" 
               :class="['p-4 rounded-lg text-sm', 
                       statusType === 'error' ? 'bg-red-900/30 text-red-300 border border-red-500/50' : 
                       statusType === 'success' ? 'bg-green-900/30 text-green-300 border border-green-500/50' : 
                       'bg-blue-900/30 text-blue-300 border border-blue-500/50']">
            {{ statusMessage }}
          </div>

          <!-- Loading Indicator -->
          <div v-if="isLoading && !searchResults.length && !installedCores.length" class="flex justify-center items-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/30"></div>
          </div>

          <!-- Progress for installation -->
          <div v-if="showProgress" class="bg-[#1A1A1A] border border-white/10 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <Loader2 class="h-5 w-5 animate-spin text-blue-400" />
                <span class="font-medium">{{ progressStatus }}</span>
              </div>
              <span v-if="downloadProgress > 0" class="text-sm text-blue-400">{{ downloadProgress }}%</span>
            </div>
            
            <!-- Progress Bar -->
            <div v-if="downloadProgress > 0" class="w-full bg-[#111] h-2 rounded-full mb-3">
              <div 
                class="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                :style="{ width: `${downloadProgress}%` }"
              ></div>
            </div>
            
            <!-- Progress Log -->
            <div v-if="progressLog.length" class="mt-2 bg-black/30 rounded p-2 max-h-28 overflow-y-auto text-xs font-mono">
              <div v-for="(log, index) in progressLog" :key="index" :class="log.type === 'stderr' ? 'text-red-400' : 'text-green-400'">
                {{ log.data }}
              </div>
            </div>
          </div>

          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="space-y-3">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-medium flex items-center">
                Search Results
                <span class="ml-2 px-2 py-0.5 bg-[#333333] rounded-full text-xs text-white/60">{{ searchResults.length }}</span>
              </h3>
              <Button @click="clearSearch" variant="outline" size="sm">Clear</Button>
            </div>
            
            <div class="bg-[#1A1A1A] border border-white/10 rounded-lg overflow-hidden">
              <div class="max-h-72 overflow-y-auto">
                <div v-for="platform in searchResults" :key="platform.id" class="p-4 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
                  <div class="flex flex-wrap justify-between items-start gap-4">
                    <div class="flex-1 min-w-[200px]">
                      <h4 class="font-semibold text-white text-left">{{ platform.name }}</h4>
                      <div class="text-sm text-white/60 mt-1 text-left">{{ platform.id }}</div>
                      <div class="flex flex-wrap gap-2 mt-1 text-left">
                        <span v-if="platform.description" class="text-white/50 text-xs line-clamp-1">{{ platform.description }}</span>
                      </div>
                    </div>
                    <Button 
                      v-if="!isAlreadyInstalled(platform.id)"
                      @click="installCore(platform.id)"
                      :disabled="installingCores.size > 0"
                      variant="default" 
                      size="sm"
                      class="shrink-0"
                    >
                      <DownloadIcon v-if="!installingCores.has(platform.id)" class="h-4 w-4 mr-1.5" />
                      <Loader2 v-else class="h-4 w-4 mr-1.5 animate-spin" />
                      {{ installingCores.has(platform.id) ? 'Installing...' : 'Install' }}
                    </Button>
                    <div v-else class="bg-green-900/20 text-green-400 px-3 py-1 rounded text-xs flex items-center shrink-0">
                      <span class="mr-1">✓</span> Already Installed
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Installed Cores -->
          <div v-if="installedCores.length > 0" class="space-y-3">
            <h3 class="text-lg font-medium flex items-center">
              Installed Cores
              <span class="ml-2 px-2 py-0.5 bg-[#333333] rounded-full text-xs text-white/60">{{ installedCores.length }}</span>
            </h3>
            
            <div class="bg-[#1A1A1A] border border-white/10 rounded-lg overflow-hidden">
              <div class="max-h-72 overflow-y-auto">
                <div v-for="platform in installedCores" :key="platform.id" class="p-4 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
                  <div class="flex flex-wrap justify-between items-start gap-4">
                    <div class="flex-1 min-w-[200px]">
                      <h4 class="font-semibold text-white text-left">{{ platform.name }}</h4>
                      <div class="text-sm text-white/60 mt-1 text-left">{{ platform.id }}</div>
                      <div class="flex flex-wrap gap-2 mt-2 text-left">
                        <span class="bg-green-900/20 text-green-400 px-2 py-0.5 rounded text-xs">Installed: {{ platform.installed }}</span>
                        <span v-if="platform.latest && platform.installed !== platform.latest" class="bg-yellow-900/20 text-yellow-400 px-2 py-0.5 rounded text-xs">
                          Update Available
                        </span>
                      </div>
                    </div>
                    <div class="flex gap-2 shrink-0">
                      <Button 
                        v-if="platform.latest && platform.installed !== platform.latest"
                        @click="upgradeCore(platform.id)"
                        :disabled="installingCores.size > 0 || upgradingCores.size > 0 || uninstallingCores.size > 0"
                        variant="outline" 
                        size="sm"
                        class="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                      >
                        <ArrowUpCircle v-if="!upgradingCores.has(platform.id)" class="h-4 w-4 mr-1.5" />
                        <Loader2 v-else class="h-4 w-4 mr-1.5 animate-spin" />
                        {{ upgradingCores.has(platform.id) ? 'Upgrading...' : 'Upgrade' }}
                      </Button>
                      <Button 
                        @click="uninstallCore(platform.id)"
                        :disabled="installingCores.size > 0 || upgradingCores.size > 0 || uninstallingCores.size > 0"
                        variant="outline" 
                        size="sm"
                        class="border-red-500/50 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 v-if="!uninstallingCores.has(platform.id)" class="h-4 w-4 mr-1.5" />
                        <Loader2 v-else class="h-4 w-4 mr-1.5 animate-spin" />
                        {{ uninstallingCores.has(platform.id) ? 'Uninstalling...' : 'Uninstall' }}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="!isLoading && installedCores.length === 0 && searchResults.length === 0" class="py-16 text-center">
            <PackageIcon class="h-16 w-16 mx-auto text-white/30 mb-6" />
            <p class="text-white/70 text-lg">No cores installed yet</p>
            <p class="text-white/50 text-sm mt-2 max-w-md mx-auto">Search for Arduino cores using the search box above and install them to get started.</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { 
  RefreshCcw, 
  SearchIcon, 
  DownloadIcon, 
  Trash2, 
  ArrowUpCircle, 
  Loader2,
  PackageIcon,
  X
} from 'lucide-vue-next';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

// State variables
const isLoading = ref(true);
const isUpdating = ref(false);
const installingCores = ref(new Set()); // Track which cores are being installed
const uninstallingCores = ref(new Set()); // Track which cores are being uninstalled
const upgradingCores = ref(new Set()); // Track which cores are being upgraded
const searchQuery = ref('');
const searchResults = ref([]);
const installedCores = ref([]);
const statusMessage = ref('');
const statusType = ref('info'); // 'info', 'success', 'error'
const showProgress = ref(false);
const progressStatus = ref('');
const progressLog = ref([]);
const downloadProgress = ref(0); // Track download progress percentage
const currentInstallingCore = ref(''); // Track which core is currently being installed

// Watch for modal visibility to load data when shown
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadInstalledCores();
    // Register progress event listener
    window.electronAPI.onCoreInstallProgress(handleInstallProgress);
  } else {
    // Clean up when modal is closed
    window.electronAPI.clearCoreInstallProgressListener();
  }
});

// Load installed cores on component mount if modal is visible
onMounted(async () => {
  if (props.show) {
    clearStatus();
    await loadInstalledCores();
    // Register progress event listener
    window.electronAPI.onCoreInstallProgress(handleInstallProgress);
  }
});

// Clean up event listeners on component unmount
onUnmounted(() => {
  window.electronAPI.clearCoreInstallProgressListener();
});

// Load installed cores
async function loadInstalledCores() {
  isLoading.value = true;
  try {
    const result = await window.electronAPI.listCores();
    if (result.success) {
      installedCores.value = result.platforms.map(platform => ({
        id: platform.id,
        name: platform.name || platform.id.split(':')[1] || platform.id,
        installed: platform.installed || 'Unknown',
        latest: platform.latest || null
      }));
    } else {
      showError('Failed to load installed cores');
    }
  } catch (error) {
    console.error('Error loading cores:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isLoading.value = false;
  }
}

// Update core index
async function updateIndex() {
  isUpdating.value = true;
  clearStatus();
  showStatus('Updating core index...', 'info');
  
  try {
    const result = await window.electronAPI.updateCoreIndex();
    if (result.success) {
      showStatus('Core index updated successfully', 'success');
      // Reload installed cores to reflect any changes
      await loadInstalledCores();
    } else {
      showError(`Failed to update core index: ${result.error}`);
    }
  } catch (error) {
    console.error('Error updating core index:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isUpdating.value = false;
  }
}

// Search for cores
async function searchCores() {
  if (!searchQuery.value.trim()) return;
  
  isLoading.value = true;
  clearStatus();
  searchResults.value = [];
  showStatus('Searching cores...', 'info');
  
  try {
    const result = await window.electronAPI.searchCores(searchQuery.value.trim());
    if (result.success) {
      searchResults.value = result.results.map(platform => ({
        id: platform.id,
        name: platform.name || platform.id.split(':')[1] || platform.id,
        description: platform.description || '',
        latest: platform.latest || 'Unknown'
      }));
      
      if (searchResults.value.length === 0) {
        showStatus('No cores found matching your search', 'info');
      } else {
        clearStatus();
      }
    } else {
      showError(`Search failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error searching cores:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isLoading.value = false;
  }
}

// Install a core
async function installCore(platformId) {
  installingCores.value.add(platformId);
  clearStatus();
  showStatus(`Installing ${platformId}...`, 'info');
  showProgress.value = true;
  progressStatus.value = `Installing ${platformId}...`;
  progressLog.value = [];
  downloadProgress.value = 0;
  currentInstallingCore.value = platformId;
  
  try {
    const result = await window.electronAPI.installCore(platformId);
    if (result.success) {
      showStatus(`Successfully installed ${platformId}`, 'success');
      // Reload installed cores to include the newly installed one
      await loadInstalledCores();
    } else {
      showError(`Failed to install core: ${result.error}`);
    }
  } catch (error) {
    console.error('Error installing core:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    installingCores.value.delete(platformId);
    // Keep progress visible for a moment after completion
    setTimeout(() => {
      showProgress.value = false;
    }, 3000);
  }
}

// Uninstall a core
async function uninstallCore(platformId) {
  // Confirmation dialog
  if (!confirm(`Are you sure you want to uninstall ${platformId}?`)) {
    return;
  }
  
  uninstallingCores.value.add(platformId);
  clearStatus();
  showStatus(`Uninstalling ${platformId}...`, 'info');
  
  try {
    const result = await window.electronAPI.uninstallCore(platformId);
    if (result.success) {
      showStatus(`Successfully uninstalled ${platformId}`, 'success');
      // Remove from installed cores list
      installedCores.value = installedCores.value.filter(core => core.id !== platformId);
    } else {
      showError(`Failed to uninstall core: ${result.error}`);
    }
  } catch (error) {
    console.error('Error uninstalling core:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    uninstallingCores.value.delete(platformId);
  }
}

// Upgrade a core
async function upgradeCore(platformId) {
  upgradingCores.value.add(platformId);
  clearStatus();
  showStatus(`Upgrading ${platformId}...`, 'info');
  
  try {
    const result = await window.electronAPI.upgradeCore(platformId);
    if (result.success) {
      showStatus(`Successfully upgraded ${platformId}`, 'success');
      // Reload installed cores to reflect the upgrade
      await loadInstalledCores();
    } else {
      showError(`Failed to upgrade core: ${result.error}`);
    }
  } catch (error) {
    console.error('Error upgrading core:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    upgradingCores.value.delete(platformId);
  }
}

// Clear search results
function clearSearch() {
  searchResults.value = [];
  searchQuery.value = '';
  clearStatus();
}

// Show status message
function showStatus(message, type = 'info') {
  statusMessage.value = message;
  statusType.value = type;
  
  // Auto-clear success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      if (statusMessage.value === message) {
        clearStatus();
      }
    }, 5000);
  }
}

// Show error message
function showError(message) {
  showStatus(message, 'error');
}

// Clear status message
function clearStatus() {
  statusMessage.value = '';
  statusType.value = 'info';
}

// Handle installation progress updates
function handleInstallProgress(data) {
  // Add to log with timestamp
  const timestamp = new Date().toLocaleTimeString();
  progressLog.value.push({
    type: data.type,
    data: `[${timestamp}] ${data.data.trim()}`
  });
  
  // Extract download percentage from log messages
  const logData = data.data.trim();
  
  // Look for download percentage patterns in the log
  const downloadPattern = /(\d+)%/;
  const downloadMatch = logData.match(downloadPattern);
  
  if (downloadMatch && downloadMatch[1]) {
    const percentage = parseInt(downloadMatch[1], 10);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      downloadProgress.value = percentage;
    }
  }
  
  // Check for completion patterns
  if (logData.includes('downloaded') || logData.includes('installed')) {
    // When download completes, ensure the progress bar shows 100%
    if (downloadProgress.value > 0 && downloadProgress.value < 100) {
      downloadProgress.value = 100;
    }
  }
  
  // Auto-scroll the log container
  setTimeout(() => {
    const logContainer = document.querySelector('.modal-content .overflow-y-auto');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }, 50);
}

// Check if a platform is already installed
function isAlreadyInstalled(platformId) {
  return installedCores.value.some(core => core.id === platformId);
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .core-manager,
.modal-fade-leave-to .core-manager {
  transform: translateY(20px);
}
</style> 