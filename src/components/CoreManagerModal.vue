<template>
  <Transition name="modal-fade">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center overflow-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')"></div>
      
      <!-- Modal content -->
      <div class="relative bg-[#1E1E1E] rounded-xl shadow-xl p-6 w-[900px] max-w-[90vw] max-h-[90vh] overflow-auto z-10" style="background-color: #1E1E1E !important;">
        <!-- Header with close button -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center">
            <h2 class="text-xl font-semibold">Board Manager</h2>
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

        <!-- Arduino AVR Setup Status -->
        <div v-if="showArduinoSetupStatus" class="mb-6 bg-[#1A1A1A] border border-[#333] rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <Loader2 v-if="isArduinoSetupInProgress" class="h-5 w-5 animate-spin text-blue-400" />
                <CheckCircle2 v-else-if="arduinoSetupStatus?.status === 'completed'" class="h-5 w-5 text-green-400" />
                <AlertCircle v-else-if="arduinoSetupStatus?.status === 'error'" class="h-5 w-5 text-red-400" />
                <div v-else class="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <span class="text-xs text-white font-bold">A</span>
                </div>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-medium text-white/90">Arduino Core Setup</h3>
                  <span class="px-2 py-0.5 rounded text-xs" :class="setupStatusBadgeClasses">
                    {{ setupStatusText }}
                  </span>
                </div>
                <p class="text-xs text-white/60 mt-1">{{ setupStatusMessage }}</p>
              </div>
            </div>
            <!-- Close button - only show for completed/error states -->
            <button 
              v-if="!isArduinoSetupInProgress"
              @click="dismissArduinoSetupStatus" 
              class="rounded-full p-1.5 hover:bg-white/10 transition-colors ml-2 shrink-0"
              aria-label="Dismiss Arduino setup status"
              title="Dismiss"
            >
              <X class="h-4 w-4 text-white/60 hover:text-white/90" />
            </button>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="mb-6">
          <nav class="inline-flex p-0.5 bg-[#1A1A1A] rounded-lg w-full" aria-label="Board Manager tabs" style="background-color: #1A1A1A !important;">
            <button
              @click="activeTab = 'installed'"
              :class="[
                'relative flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-out whitespace-nowrap',
                activeTab === 'installed' 
                  ? 'active-tab bg-[#1E1E1E] text-white shadow-lg border border-[#333]' 
                  : 'text-white/60 hover:text-white/80 hover:bg-[#1E1E1E]/50'
              ]"
            >
              Installed & Search
            </button>
            <button
              @click="activeTab = 'custom'"
              :class="[
                'relative flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-out ml-0.5 whitespace-nowrap',
                activeTab === 'custom' 
                  ? 'active-tab bg-[#1E1E1E] text-white shadow-lg border border-[#333]' 
                  : 'text-white/60 hover:text-white/80 hover:bg-[#1E1E1E]/50'
              ]"
            >
              Custom URLs
            </button>
          </nav>
        </div>

        <!-- Board Manager Content -->
        <div class="board-manager space-y-6">
          <!-- Installed & Search Tab -->
          <div v-if="activeTab === 'installed'">
            <!-- Control Bar - Search and Update -->
            <div class="flex flex-wrap items-center justify-between gap-4 bg-[#252525] rounded-lg p-4 border border-[#333] mb-4" style="background-color: #252525 !important; border-color: #333 !important;">
              <div class="flex items-center gap-3">
                <Button @click="updateIndex" :disabled="isUpdating || isCheckingUpdates || isUpdatingAll" variant="outline" size="sm" class="whitespace-nowrap h-9 border-[#444] hover:border-[#666] hover:bg-[#333]">
                  <template v-if="isUpdating">
                    <span class="mr-1.5 h-3.5 w-3.5 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                    Updating Index...
                  </template>
                  <template v-else-if="updateIndexDone">
                    <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Done!
                  </template>
                  <template v-else>
                    <RefreshCcw class="h-3.5 w-3.5 mr-1.5" />
                    Update Index
                  </template>
                </Button>
                
                <Button @click="checkForUpdates" :disabled="isUpdating || isCheckingUpdates || isUpdatingAll" variant="outline" size="sm" class="whitespace-nowrap h-9 border-[#444] hover:border-[#666] hover:bg-[#333]">
                  <template v-if="isCheckingUpdates">
                    <span class="mr-1.5 h-3.5 w-3.5 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                    Checking Updates...
                  </template>
                  <template v-else-if="checkUpdatesDone">
                    <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Done!
                  </template>
                  <template v-else>
                    <ArrowUpCircle class="h-3.5 w-3.5 mr-1.5" />
                    Check Updates
                  </template>
                </Button>
                
                <Button 
                  v-if="availableUpdates.cores && availableUpdates.cores.length > 0" 
                  @click="updateAllCores" 
                  :disabled="isUpdating || isCheckingUpdates || isUpdatingAll || installingCores.size > 0 || upgradingCores.size > 0 || uninstallingCores.size > 0" 
                  variant="default" 
                  size="sm" 
                  class="whitespace-nowrap h-9"
                >
                  <ArrowUpCircle v-if="isUpdatingAll" class="h-4 w-4 animate-spin mr-2" />
                  <ArrowUpCircle v-else class="h-4 w-4 mr-2" />
                  Update All ({{ availableUpdates.cores.length }})
                </Button>
              </div>
              
              <div class="relative flex-1 max-w-md">
                <div class="relative flex items-center">
                  <SearchIcon class="absolute left-3 h-4 w-4 text-white/40" />
                  <input
                    v-model="searchQuery"
                    @keydown.enter="searchCores"
                    type="text"
                    placeholder="Search board packages..."
                    class="pl-9 pr-3 py-2 rounded-lg bg-[#1E1E1E] border border-[#333] text-sm text-white/90 w-full focus:outline-none focus:ring-1 focus:ring-white/20"
                    style="background-color: #1E1E1E !important; border-color: #333 !important;"
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

            <!-- Status Messages (filtered to exclude Update Index and Check Updates operations) -->
            <div v-if="statusMessage && !isUpdateIndexOrCheckUpdatesMessage" 
                 :class="['p-4 rounded-lg text-sm mb-4', 
                         statusType === 'error' ? 'bg-red-900/30 text-red-300 border border-red-500/50' : 
                         statusType === 'success' ? 'bg-green-900/30 text-green-300 border border-green-500/50' : 
                         'bg-blue-900/30 text-blue-300 border border-blue-500/50']">
              {{ statusMessage }}
            </div>

            <!-- Loading Indicator -->
            <div v-if="isLoading && !searchResults.length && !installedCores.length" class="flex justify-center items-center py-12 mb-4">
              <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/30"></div>
            </div>

            <!-- Progress for installation -->
            <div v-if="showProgress" class="bg-[#1E1E1E] border border-[#333] rounded-lg p-4 mb-4" style="background-color: #1E1E1E !important; border-color: #333 !important;">
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
              <div v-if="progressLog.length" class="mt-2 bg-black/30 rounded p-2 max-h-32 overflow-y-auto text-xs font-mono">
                <div v-for="(log, index) in progressLog" :key="index" :class="{
                  'text-red-400': log.type === 'stderr' || log.type === 'error',
                  'text-green-400': log.type === 'stdout' || log.type === 'success',
                  'text-blue-400': log.type === 'info',
                  'text-yellow-400': log.type === 'retry'
                }">
                  {{ log.data }}
                </div>
              </div>
            </div>

            <!-- Search Results -->
            <div v-if="searchResults.length > 0" class="space-y-4 mb-4">
              <div class="flex justify-between items-center">
                <h3 class="text-lg font-medium flex items-center">
                  Search Results
                  <span class="ml-2 px-2 py-0.5 bg-[#333] rounded-full text-xs text-white/60">{{ searchResults.length }}</span>
                </h3>
                <Button @click="clearSearch" variant="outline" size="sm">Clear</Button>
              </div>
              
              <div class="bg-[#1E1E1E] border border-[#333] rounded-lg overflow-hidden" style="background-color: #1E1E1E !important; border-color: #333 !important;">
                <div class="max-h-72 overflow-y-auto">
                  <div v-for="platform in searchResults" :key="platform.id" class="p-4 border-b border-[#333] last:border-b-0 hover:bg-[#252525] transition-colors" style="border-color: #333 !important;">
                    <div class="flex flex-wrap justify-between items-start gap-4">
                      <div class="flex-1 min-w-[200px]">
                        <h4 class="font-semibold text-white text-left">{{ platform.name }}</h4>
                        <div class="text-sm text-white/60 mt-1 text-left">{{ platform.id }}</div>
                        <div class="flex flex-wrap gap-2 mt-2 text-left">
                          <span class="bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded text-xs">{{ platform.maintainer }}</span>
                          <span class="bg-orange-900/20 text-orange-400 px-2 py-0.5 rounded text-xs">{{ platform.boardCount }} {{ platform.boardCount === 1 ? 'board' : 'boards' }}</span>
                          <span v-if="platform.types && platform.types.length" class="bg-purple-900/20 text-purple-400 px-2 py-0.5 rounded text-xs">{{ platform.types.join(', ') }}</span>
                          <span v-if="platform.requiresUrl" class="bg-yellow-900/20 text-yellow-400 px-2 py-0.5 rounded text-xs">⚠️ Requires URL</span>
                        </div>
                        <div v-if="platform.sampleBoards && platform.sampleBoards.length" class="text-xs text-white/50 mt-1 text-left">
                          Boards: {{ platform.sampleBoards.join(', ') }}{{ platform.boardCount > platform.sampleBoards.length ? '...' : '' }}
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

            <!-- Installed Board Packages -->
            <div v-if="installedCores.length > 0" class="space-y-4 mb-4">
              <h3 class="text-lg font-medium flex items-center">
                Installed Board Packages
                <span class="ml-2 px-2 py-0.5 bg-[#333] rounded-full text-xs text-white/60">{{ installedCores.length }}</span>
              </h3>
              
              <div class="bg-[#1E1E1E] border border-[#333] rounded-lg overflow-hidden" style="background-color: #1E1E1E !important; border-color: #333 !important;">
                <div class="max-h-72 overflow-y-auto">
                  <div v-for="platform in installedCores" :key="platform.id" class="p-4 border-b border-[#333] last:border-b-0 hover:bg-[#252525] transition-colors" style="border-color: #333 !important;">
                    <div class="flex flex-wrap justify-between items-start gap-4">
                      <div class="flex-1 min-w-[200px]">
                        <h4 class="font-semibold text-white text-left">{{ platform.name }}</h4>
                        <div class="text-sm text-white/60 mt-1 text-left">{{ platform.id }}</div>
                        <div class="flex flex-wrap gap-2 mt-2 text-left">
                          <span class="bg-green-900/20 text-green-400 px-2 py-0.5 rounded text-xs">v{{ platform.installed }}</span>
                          <span v-if="platform.maintainer && platform.maintainer !== 'Unknown'" class="bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded text-xs">{{ platform.maintainer }}</span>
                          <span v-if="platform.boardCount" class="bg-orange-900/20 text-orange-400 px-2 py-0.5 rounded text-xs">{{ platform.boardCount }} {{ platform.boardCount === 1 ? 'board' : 'boards' }}</span>
                          <span v-if="platform.types && platform.types.length" class="bg-purple-900/20 text-purple-400 px-2 py-0.5 rounded text-xs">{{ platform.types.join(', ') }}</span>
                          <span v-if="platform.latest && platform.installed !== platform.latest" class="bg-yellow-900/20 text-yellow-400 px-2 py-0.5 rounded text-xs">
                            Update Available (v{{ platform.latest }})
                          </span>
                        </div>
                        <div v-if="platform.sampleBoards && platform.sampleBoards.length" class="text-xs text-white/50 mt-1 text-left">
                          Boards: {{ platform.sampleBoards.join(', ') }}{{ platform.boardCount > platform.sampleBoards.length ? '...' : '' }}
                        </div>
                      </div>
                      <div class="flex gap-2 shrink-0">
                        <Button 
                          v-if="platform.latest && platform.installed !== platform.latest"
                          @click="upgradeCore(platform.id)"
                          :disabled="installingCores.size > 0 || upgradingCores.size > 0 || uninstallingCores.size > 0"
                          variant="outline" 
                          size="sm"
                          class="border-[#444] hover:border-[#666] hover:bg-[#333] text-yellow-400 hover:text-yellow-300"
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
                          class="border-[#444] hover:border-[#666] hover:bg-[#333] text-red-400 hover:text-red-300"
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
              <p class="text-white/70 text-lg">No board packages installed yet</p>
              <p class="text-white/50 text-sm mt-2 max-w-md mx-auto">Search for board packages using the search box above and install them to get started with different Arduino-compatible boards.</p>
            </div>
          </div>

          <!-- Custom URLs Tab -->
          <div v-if="activeTab === 'custom'" class="space-y-6">
            <!-- Header Section -->
            <div class="text-left">
              <div class="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <h3 class="text-lg font-semibold text-white/90">Custom Board Package URLs</h3>
              </div>
              <p class="text-sm text-white/60 max-w-2xl">
                Add custom board package index URLs to access additional Arduino-compatible boards from third-party providers like ESP32, STM32, Adafruit, and SparkFun.
              </p>
            </div>

            <!-- Add URL Section -->
            <div class="bg-[#252525] rounded-lg p-4 border border-[#333]" style="background-color: #252525 !important; border-color: #333 !important;">
              <div class="space-y-4">
                <div class="text-left">
                  <label class="block text-sm font-medium text-white/90 mb-3">Add New URL</label>
                  <div class="flex gap-3">
                    <input
                      v-model="newCustomUrl"
                      type="text"
                      placeholder="https://example.com/package_index.json"
                      class="flex-1 px-3 py-2 rounded-md bg-[#1E1E1E] border border-[#444] text-sm text-white/90 placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      style="background-color: #1E1E1E !important; border-color: #444 !important;"
                      @keydown.enter="addCustomUrl"
                    />
                    <Button 
                      @click="addCustomUrl" 
                      :disabled="!newCustomUrl.trim() || isAddingUrl"
                      variant="default" 
                      size="sm"
                      class="px-4 whitespace-nowrap"
                    >
                      <Loader2 v-if="isAddingUrl" class="h-4 w-4 mr-2 animate-spin" />
                      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 5v14m7-7H5"/>
                      </svg>
                      {{ isAddingUrl ? 'Adding...' : 'Add URL' }}
                    </Button>
                  </div>
                  <p class="text-xs text-white/50 mt-2">Enter a board package index URL (must end with .json)</p>
                </div>
              </div>
            </div>

            <!-- Current URLs Section -->
            <div v-if="customUrls.length > 0" class="space-y-4">
              <div class="text-left">
                <h4 class="text-md font-medium text-white/90 flex items-center gap-2">
                  Configured URLs
                  <span class="px-2 py-0.5 bg-[#333] rounded-full text-xs text-white/60">{{ customUrls.length }}</span>
                </h4>
              </div>
              
              <div class="space-y-2">
                <div v-for="(url, index) in customUrls" :key="index" 
                     class="bg-[#1E1E1E] border border-[#333] rounded-lg p-4 hover:bg-[#252525] transition-colors" 
                     style="background-color: #1E1E1E !important; border-color: #333 !important;">
                  <div class="flex items-center justify-between gap-4">
                    <div class="flex-1 min-w-0 text-left">
                      <div class="flex items-center gap-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M9 12l2 2 4-4"></path>
                        </svg>
                        <span class="text-sm font-medium text-white/90">{{ getUrlDisplayName(url) }}</span>
                      </div>
                      <p class="text-xs text-white/50 font-mono break-all">{{ url }}</p>
                    </div>
                    <Button 
                      @click="removeCustomUrl(url)"
                      :disabled="isRemovingUrl === url"
                      variant="outline" 
                      size="sm"
                      class="border-[#444] hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex-shrink-0"
                    >
                      <Loader2 v-if="isRemovingUrl === url" class="h-4 w-4 mr-2 animate-spin" />
                      <Trash2 v-else class="h-4 w-4 mr-2" />
                      {{ isRemovingUrl === url ? 'Removing...' : 'Remove' }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Popular URLs Section -->
            <div class="space-y-4">
              <div class="text-left">
                <h4 class="text-md font-medium text-white/90 mb-2">Popular Board Packages</h4>
                <p class="text-sm text-white/60">Quick access to commonly used board package URLs</p>
              </div>
              
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div v-for="suggestion in popularUrls" :key="suggestion.name" 
                     class="bg-[#252525] rounded-lg p-4 border border-[#333] hover:border-[#444] transition-all cursor-pointer group"
                     style="background-color: #252525 !important; border-color: #333 !important;"
                     @click="addSuggestedUrl(suggestion.url)">
                  <div class="text-left">
                    <div class="flex items-center justify-between mb-3">
                      <h5 class="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">{{ suggestion.name }}</h5>
                      <Button 
                        v-if="!customUrls.includes(suggestion.url)"
                        @click.stop="addSuggestedUrl(suggestion.url)"
                        :disabled="isAddingUrl"
                        variant="outline" 
                        size="sm"
                        class="border-[#444] hover:border-blue-500 hover:bg-blue-500/10 text-blue-400 hover:text-blue-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 5v14m7-7H5"/>
                        </svg>
                        Add
                      </Button>
                      <div v-else class="bg-green-900/20 text-green-400 px-3 py-1 rounded-md text-xs flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Added
                      </div>
                    </div>
                    <p class="text-xs text-white/60 mb-2">{{ suggestion.description }}</p>
                    <p class="text-xs text-white/40 font-mono break-all">{{ suggestion.url }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="!isLoadingUrls && customUrls.length === 0" class="text-center py-12">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-white/20 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <h3 class="text-lg font-medium text-white/70 mb-2">No Custom URLs Added</h3>
              <p class="text-white/50 text-sm max-w-md mx-auto">
                Add custom board package URLs above or choose from the popular options to access additional Arduino-compatible boards.
              </p>
            </div>

            <!-- Loading State -->
            <div v-if="isLoadingUrls" class="text-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p class="text-white/60 text-sm">Loading custom URLs...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { 
  RefreshCcw, 
  SearchIcon, 
  DownloadIcon, 
  Trash2, 
  ArrowUpCircle, 
  Loader2,
  PackageIcon,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'core-installed', 'core-uninstalled', 'core-upgraded']);

// State variables
const isLoading = ref(true);
const isUpdating = ref(false);
const isCheckingUpdates = ref(false);
const isUpdatingAll = ref(false);
const updateIndexDone = ref(false);
const checkUpdatesDone = ref(false);
const installingCores = ref(new Set()); // Track which cores are being installed
const uninstallingCores = ref(new Set()); // Track which cores are being uninstalled
const upgradingCores = ref(new Set()); // Track which cores are being upgraded
const searchQuery = ref('');
const searchResults = ref([]);
const installedCores = ref([]);
const availableUpdates = ref({ cores: [], libraries: [] }); // Track available updates
const statusMessage = ref('');
const statusType = ref('info'); // 'info', 'success', 'error'
const showProgress = ref(false);
const progressStatus = ref('');
const progressLog = ref([]);
const downloadProgress = ref(0); // Track download progress percentage
const currentInstallingCore = ref(''); // Track which core is currently being installed
const activeTab = ref('installed'); // Track active tab
const newCustomUrl = ref('');
const customUrls = ref([]);
const isAddingUrl = ref(false);
const isRemovingUrl = ref(null);
const isLoadingUrls = ref(false);
const popularUrls = ref([
  { name: 'ESP32', description: 'ESP32 board package', url: 'https://dl.espressif.com/dl/package_esp32_index.json' },
  { name: 'STM32', description: 'STM32 board package', url: 'https://github.com/stm32duino/BoardManagerFiles/raw/main/package_stm32duino_index.json' },
  { name: 'Adafruit', description: 'Adafruit board package', url: 'https://adafruit.github.io/arduino-board-index/package_adafruit_index.json' },
  { name: 'SparkFun', description: 'SparkFun board package', url: 'https://raw.githubusercontent.com/sparkfun/Arduino_Boards/master/package_sparkfun_index.json' }
]);

// Arduino setup status tracking
const arduinoSetupStatus = ref(null);
const arduinoSetupDismissed = ref(false);

const showArduinoSetupStatus = computed(() => {
  // Don't show if user has dismissed it
  if (arduinoSetupDismissed.value) return false;
  
  // Don't show if no status available
  if (!arduinoSetupStatus.value) return false;
  
  const status = arduinoSetupStatus.value.status;
  
  // Always show during active operations
  if (status === 'checking' || status === 'installing' || status === 'updating-index') {
    return true;
  }
  
  // Show errors until dismissed
  if (status === 'error') {
    return true;
  }
  
  // Show completed status briefly (will be auto-hidden or user can dismiss)
  if (status === 'completed') {
    return true;
  }
  
  // Don't show for already-installed status (this was the main issue)
  return false;
});
const isArduinoSetupInProgress = computed(() => {
  const status = arduinoSetupStatus.value?.status;
  return status === 'checking' || status === 'installing' || status === 'updating-index';
});
const setupStatusText = computed(() => {
  const status = arduinoSetupStatus.value?.status;
  switch (status) {
    case 'checking': return 'Checking';
    case 'installing': return 'Installing';
    case 'updating-index': return 'Updating';
    case 'completed': return 'Ready';
    case 'already-installed': return 'Ready';
    case 'error': return 'Error';
    case 'skipped': return 'Skipped';
    default: return 'Unknown';
  }
});
const setupStatusBadgeClasses = computed(() => {
  const status = arduinoSetupStatus.value?.status;
  switch (status) {
    case 'checking':
    case 'installing':
    case 'updating-index':
      return 'bg-blue-900/20 text-blue-400 border border-blue-500/30';
    case 'completed':
    case 'already-installed':
      return 'bg-green-900/20 text-green-400 border border-green-500/30';
    case 'error':
      return 'bg-red-900/20 text-red-400 border border-red-500/30';
    case 'skipped':
      return 'bg-yellow-900/20 text-yellow-400 border border-yellow-500/30';
    default:
      return 'bg-gray-900/20 text-gray-400 border border-gray-500/30';
  }
});
const setupStatusMessage = computed(() => {
  const status = arduinoSetupStatus.value?.status;
  const message = arduinoSetupStatus.value?.message;
  switch (status) {
    case 'checking': return 'Checking for Arduino core...';
    case 'installing': return 'Installing Arduino core for basic board support...';
    case 'updating-index': return 'Updating board package index...';
    case 'completed': return 'Arduino core installed successfully. Basic boards are now available.';
    case 'already-installed': return 'Arduino core is already installed and ready to use.';
    case 'error': return `Setup failed: ${message || 'Unknown error'}`;
    case 'skipped': return 'Setup was skipped (previously uninstalled by user).';
    default: return message || 'Arduino core setup status unknown.';
  }
});

// Filter out status messages for Update Index and Check Updates operations
const isUpdateIndexOrCheckUpdatesMessage = computed(() => {
  if (!statusMessage.value) return false;
  const message = statusMessage.value.toLowerCase();
  return message.includes('updating board package index') || 
         message.includes('checking for updates') ||
         message.includes('board package index updated successfully') ||
         message.includes('all packages are up to date') ||
         message.includes('found updates for');
});

// Load Arduino setup dismissal state from localStorage
function loadArduinoSetupDismissalState() {
  try {
    const dismissalData = localStorage.getItem('embedr-arduino-setup-dismissed');
    if (dismissalData) {
      const parsed = JSON.parse(dismissalData);
      // Check if dismissal is still valid (within last 30 days)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const isExpired = Date.now() - parsed.timestamp > thirtyDaysMs;
      
      if (!isExpired && parsed.dismissed) {
        arduinoSetupDismissed.value = true;
        console.log('[CoreManagerModal] Arduino setup status previously dismissed');
      } else if (isExpired) {
        // Clear expired dismissal
        localStorage.removeItem('embedr-arduino-setup-dismissed');
        console.log('[CoreManagerModal] Arduino setup dismissal expired, clearing');
      }
    }
  } catch (error) {
    console.warn('[CoreManagerModal] Error loading Arduino setup dismissal state:', error);
    localStorage.removeItem('embedr-arduino-setup-dismissed');
  }
}

// Watch for modal visibility to load data when shown
watch(() => props.show, async (newVal) => {
  if (newVal) {
    // Reset button states when modal opens
    updateIndexDone.value = false;
    checkUpdatesDone.value = false;
    
    loadInstalledCores();
    loadArduinoSetupDismissalState(); // Load dismissal state when modal opens
    if (activeTab.value === 'custom') {
      loadCustomUrls(); // Load custom URLs when modal opens if on custom tab
    }
    // Register progress event listener
    window.electronAPI.onCoreInstallProgress(handleInstallProgress);
    // Register Arduino setup status listener
    if (window.electronAPI?.onArduinoAvrSetupStatus) {
      window.electronAPI.onArduinoAvrSetupStatus((data) => {
        console.log('[CoreManagerModal] Arduino setup status:', data);
        arduinoSetupStatus.value = data;
        
        // Reset dismissal if there's a new active operation
        if (data && (data.status === 'checking' || data.status === 'installing' || data.status === 'updating-index' || data.status === 'error')) {
          arduinoSetupDismissed.value = false;
        }
        
        // Auto-dismiss completed status after 5 seconds
        if (data && data.status === 'completed') {
          setTimeout(() => {
            if (arduinoSetupStatus.value?.status === 'completed') {
              dismissArduinoSetupStatus();
            }
          }, 5000);
        }
      });
    }
    
    // Get current Arduino setup status in case it happened before modal opened
    if (window.electronAPI?.getArduinoSetupStatus) {
      try {
        const currentStatus = await window.electronAPI.getArduinoSetupStatus();
        if (currentStatus) {
          console.log('[CoreManagerModal] Current Arduino setup status (on modal open):', currentStatus);
          arduinoSetupStatus.value = currentStatus;
        }
      } catch (error) {
        console.warn('[CoreManagerModal] Failed to get current Arduino setup status:', error);
      }
    }
  } else {
    // Clean up when modal is closed
    window.electronAPI.clearCoreInstallProgressListener();
    if (window.electronAPI?.clearArduinoAvrSetupStatusListener) {
      window.electronAPI.clearArduinoAvrSetupStatusListener();
    }
  }
});

// Watch for tab changes to load custom URLs when switching to custom tab
watch(activeTab, (newTab) => {
  if (newTab === 'custom') {
    loadCustomUrls();
  }
});

// Load installed board packages on component mount if modal is visible
onMounted(async () => {
  if (props.show) {
    // Reset button states when component mounts
    updateIndexDone.value = false;
    checkUpdatesDone.value = false;
    
    clearStatus();
    await loadInstalledCores();
    loadArduinoSetupDismissalState(); // Load dismissal state on mount
    // Register progress event listener
    window.electronAPI.onCoreInstallProgress(handleInstallProgress);
    // Register Arduino setup status listener
    if (window.electronAPI?.onArduinoAvrSetupStatus) {
      window.electronAPI.onArduinoAvrSetupStatus((data) => {
        console.log('[CoreManagerModal] Arduino setup status:', data);
        arduinoSetupStatus.value = data;
        
        // Reset dismissal if there's a new active operation
        if (data && (data.status === 'checking' || data.status === 'installing' || data.status === 'updating-index' || data.status === 'error')) {
          arduinoSetupDismissed.value = false;
        }
        
        // Auto-dismiss completed status after 5 seconds
        if (data && data.status === 'completed') {
          setTimeout(() => {
            if (arduinoSetupStatus.value?.status === 'completed') {
              dismissArduinoSetupStatus();
            }
          }, 5000);
        }
      });
    }
    
    // Get current Arduino setup status in case it happened before component mounted
    if (window.electronAPI?.getArduinoSetupStatus) {
      try {
        const currentStatus = await window.electronAPI.getArduinoSetupStatus();
        if (currentStatus) {
          console.log('[CoreManagerModal] Current Arduino setup status (on mount):', currentStatus);
          arduinoSetupStatus.value = currentStatus;
        }
      } catch (error) {
        console.warn('[CoreManagerModal] Failed to get current Arduino setup status:', error);
      }
    }
  }
});

// Clean up event listeners on component unmount
onUnmounted(() => {
  window.electronAPI.clearCoreInstallProgressListener();
  if (window.electronAPI?.clearArduinoAvrSetupStatusListener) {
    window.electronAPI.clearArduinoAvrSetupStatusListener();
  }
});

// Load installed board packages
async function loadInstalledCores() {
  isLoading.value = true;
  try {
    const result = await window.electronAPI.listCores();
    if (result.success) {
      installedCores.value = result.platforms.map(platform => {
        // Get the current installed version details
        const installedVersionKey = platform.installed_version || platform.installed;
        const installedVersion = platform.releases && platform.releases[installedVersionKey] 
          ? platform.releases[installedVersionKey] 
          : null;
        
        const boards = installedVersion?.boards || [];
        const boardCount = boards.length;
        const sampleBoards = boards.slice(0, 3).map(board => board.name);
        
        return {
          id: platform.id,
          name: installedVersion?.name || platform.name || platform.id.split(':')[1] || platform.id,
          installed: installedVersionKey || 'Unknown',
          latest: platform.latest_version || platform.latest || null,
          maintainer: platform.maintainer || 'Unknown',
          boardCount,
          sampleBoards,
          types: installedVersion?.types || []
        };
      });
    } else {
      showError('Failed to load installed board packages');
    }
  } catch (error) {
    console.error('Error loading board packages:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isLoading.value = false;
  }
}

// Update board package index
async function updateIndex() {
  isUpdating.value = true;
  updateIndexDone.value = false;
  
  try {
    const result = await window.electronAPI.updateCoreIndex();
    if (result.success) {
      // Reload installed board packages to reflect any changes
      await loadInstalledCores();
      
      // Show "Done!" state briefly
      updateIndexDone.value = true;
      setTimeout(() => {
        updateIndexDone.value = false;
      }, 2000);
    } else {
      showError(`Failed to update board package index: ${result.error}`);
    }
  } catch (error) {
    console.error('Error updating board package index:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isUpdating.value = false;
    // Reset done state on error
    updateIndexDone.value = false;
  }
}

// Search for board packages
async function searchCores() {
  if (!searchQuery.value.trim()) return;
  
  isLoading.value = true;
  clearStatus();
  searchResults.value = [];
  showStatus('Searching board packages...', 'info');
  
  try {
    const result = await window.electronAPI.searchCores(searchQuery.value.trim());
    if (result.success) {
      searchResults.value = result.results.map(platform => {
        // Get the latest version details
        const latestVersionKey = platform.latest_version || platform.latest;
        const latestVersion = platform.releases && latestVersionKey && platform.releases[latestVersionKey] 
          ? platform.releases[latestVersionKey] 
          : null;
        
        const boards = latestVersion?.boards || [];
        const boardCount = boards.length;
        const sampleBoards = boards.slice(0, 3).map(board => board.name);
        
        return {
          id: platform.id,
          name: latestVersion?.name || platform.name || platform.id.split(':')[1] || platform.id,
          latest: latestVersionKey || 'Unknown',
          maintainer: platform.maintainer || 'Unknown',
          boardCount,
          sampleBoards,
          types: latestVersion?.types || [],
          requiresUrl: needsAdditionalUrl(platform.id)
        };
      });
    
      if (searchResults.value.length === 0) {
        const suggestedUrl = getSuggestedUrlForPlatform(searchQuery.value.trim());
        if (suggestedUrl) {
          showStatus(
            `No packages found for "${searchQuery.value}". This might require adding the ${suggestedUrl.name} board manager URL in the Custom URLs tab.`, 
            'info'
          );
        } else {
          showStatus('No board packages found matching your search', 'info');
        }
      } else {
        clearStatus();
      }
    } else {
      showError(`Search failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error searching board packages:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isLoading.value = false;
  }
}

// Check if a platform needs additional URL
function needsAdditionalUrl(platformId) {
  const thirdPartyPlatforms = ['esp32:esp32', 'esp8266:esp8266', 'adafruit:samd', 'SparkFun:avr'];
  return thirdPartyPlatforms.includes(platformId);
}

// Install a board package
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
      showStatus(result.message || `Successfully installed ${platformId}`, 'success');
      // Reload installed board packages to include the newly installed one
      await loadInstalledCores();
      // Reload installed cores to reflect changes
      setTimeout(() => {
        loadInstalledCores();
      }, 1000);
      // Emit event to notify parent components that a new core was installed
      emit('core-installed', platformId);
    } else {
      // Handle missing package URL case
      let errorMessage = result.error;
      if (typeof errorMessage === 'object') {
        errorMessage = errorMessage.error || JSON.stringify(errorMessage);
      }
      
      // Check if the error is due to missing package URL
      if (errorMessage.includes('package not found') || 
          errorMessage.includes('no matching platform') ||
          errorMessage.includes('platform not found')) {
        
        // Suggest adding the appropriate URL
        const suggestedUrl = getSuggestedUrlForPlatform(platformId);
        if (suggestedUrl) {
          const addUrl = confirm(
            `Package ${platformId} not found. This likely requires adding a board manager URL.\n\n` +
            `Suggested URL: ${suggestedUrl.url}\n\n` +
            `Would you like to add this URL and retry the installation?`
          );
          
          if (addUrl) {
            try {
              showStatus('Adding board manager URL...', 'info');
              const addResult = await window.electronAPI.addBoardManagerUrl(suggestedUrl.url);
              if (addResult.success) {
                showStatus('Updating package index...', 'info');
                await updateIndex();
                showStatus('Retrying installation...', 'info');
                // Retry installation after adding URL
                setTimeout(() => installCore(platformId), 1000);
                return;
              } else {
                showError(`Failed to add URL: ${addResult.error}`);
              }
            } catch (urlError) {
              showError(`Failed to add URL: ${urlError.message}`);
            }
          }
        }
      }
      
      showError(`Failed to install board package: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error installing board package:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    installingCores.value.delete(platformId);
    // Keep progress visible for a moment after completion
    setTimeout(() => {
      showProgress.value = false;
    }, 3000);
  }
}

// Get suggested URL for a platform
function getSuggestedUrlForPlatform(platformId) {
  const urlMappings = {
    'esp32:esp32': { 
      name: 'ESP32', 
      url: 'https://dl.espressif.com/dl/package_esp32_index.json' 
    },
    'esp8266:esp8266': { 
      name: 'ESP8266', 
      url: 'https://arduino.esp8266.com/stable/package_esp8266com_index.json' 
    },
    'arduino:samd': { 
      name: 'Arduino SAMD', 
      url: 'https://downloads.arduino.cc/packages/package_index.json' 
    },
    'adafruit:samd': { 
      name: 'Adafruit SAMD', 
      url: 'https://adafruit.github.io/arduino-board-index/package_adafruit_index.json' 
    },
    'SparkFun:avr': { 
      name: 'SparkFun AVR', 
      url: 'https://raw.githubusercontent.com/sparkfun/Arduino_Boards/master/package_sparkfun_index.json' 
    }
  };
  
  return urlMappings[platformId] || null;
}

// Uninstall a board package
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
      // Reload installed cores to reflect changes
      await loadInstalledCores();
      // Emit event to notify parent components that a core was uninstalled
      emit('core-uninstalled', platformId);
    } else {
      showError(`Failed to uninstall board package: ${result.error}`);
    }
  } catch (error) {
    console.error('Error uninstalling board package:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    uninstallingCores.value.delete(platformId);
  }
}

// Upgrade a board package
async function upgradeCore(platformId) {
  upgradingCores.value.add(platformId);
  clearStatus();
  showStatus(`Upgrading ${platformId}...`, 'info');
  
  try {
    const result = await window.electronAPI.upgradeCore(platformId);
    if (result.success) {
      showStatus(`Successfully upgraded ${platformId}`, 'success');
      // Reload installed board packages to reflect the upgrade
      await loadInstalledCores();
      // Emit event to notify parent components that a core was upgraded
      emit('core-upgraded', platformId);
    } else {
      showError(`Failed to upgrade board package: ${result.error}`);
    }
  } catch (error) {
    console.error('Error upgrading board package:', error);
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
  const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  
  // Handle different types of progress updates
  switch (data.type) {
    case 'stdout':
    case 'stderr':
      // Add to log for detailed output
      progressLog.value.push({
        type: data.type,
        data: `[${timestamp}] ${data.data.trim()}`
      });
      
      // Extract download percentage from log messages
      const logData = data.data.trim();
      const downloadPattern = /(\d+)%/;
      const downloadMatch = logData.match(downloadPattern);
      
      if (downloadMatch && downloadMatch[1]) {
        const percentage = parseInt(downloadMatch[1], 10);
        if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
          downloadProgress.value = percentage;
        }
      }
      
      // Update status based on content
      if (logData.includes('Downloading')) {
        progressStatus.value = `Downloading packages...`;
      } else if (logData.includes('Installing')) {
        progressStatus.value = `Installing packages...`;
      } else if (logData.includes('Configuring')) {
        progressStatus.value = `Configuring packages...`;
      }
      break;
      
    case 'status':
      progressLog.value.push({
        type: 'info',
        data: `[${timestamp}] ${data.data}`
      });
      
      if (data.status === 'completed') {
        downloadProgress.value = 100;
        progressStatus.value = 'Installation completed';
      } else if (data.status === 'failed') {
        progressStatus.value = 'Installation failed';
      }
      break;
      
    case 'success':
      progressLog.value.push({
        type: 'success',
        data: `[${timestamp}] ✓ ${data.data}`
      });
      progressStatus.value = data.data;
      downloadProgress.value = 100;
      showStatus(data.data, 'success');
      break;
      
    case 'error':
      progressLog.value.push({
        type: 'error',
        data: `[${timestamp}] ✗ ${data.data}`
      });
      progressStatus.value = `Error: ${data.data}`;
      showError(data.data);
      break;
      
    case 'retry':
      progressLog.value.push({
        type: 'info',
        data: `[${timestamp}] 🔄 ${data.data}`
      });
      progressStatus.value = data.data;
      downloadProgress.value = 0; // Reset progress for retry
      break;
      
    default:
      progressLog.value.push({
        type: data.type || 'info',
        data: `[${timestamp}] ${data.data}`
      });
  }
  
  // Auto-scroll the log container
  setTimeout(() => {
    const logContainer = document.querySelector('.modal-content .overflow-y-auto');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }, 50);
}

// Check for available updates
async function checkForUpdates() {
  isCheckingUpdates.value = true;
  checkUpdatesDone.value = false;
  
  try {
    const result = await window.electronAPI.outdated();
    if (result.success) {
      availableUpdates.value = {
        cores: result.outdated.platforms || [],
        libraries: result.outdated.libraries || []
      };
      
      const coreUpdatesCount = availableUpdates.value.cores.length;
      const libUpdatesCount = availableUpdates.value.libraries.length;
      
      // Show "Done!" state briefly
      checkUpdatesDone.value = true;
      setTimeout(() => {
        checkUpdatesDone.value = false;
      }, 2000);
      
      // Optional: You can still log the results to console for debugging
      if (coreUpdatesCount === 0 && libUpdatesCount === 0) {
        console.log('[CoreManagerModal] All packages are up to date');
      } else {
        const updates = [];
        if (coreUpdatesCount > 0) updates.push(`${coreUpdatesCount} board package${coreUpdatesCount > 1 ? 's' : ''}`);
        if (libUpdatesCount > 0) updates.push(`${libUpdatesCount} librar${libUpdatesCount > 1 ? 'ies' : 'y'}`);
        console.log(`[CoreManagerModal] Found updates for ${updates.join(' and ')}`);
      }
    } else {
      showError(`Failed to check for updates: ${result.error}`);
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isCheckingUpdates.value = false;
    // Reset done state on error
    checkUpdatesDone.value = false;
  }
}

// Update all cores
async function updateAllCores() {
  if (!availableUpdates.value.cores || availableUpdates.value.cores.length === 0) {
    showStatus('No core updates available', 'info');
    return;
  }
  
  isUpdatingAll.value = true;
  clearStatus();
  showStatus('Updating all board packages...', 'info');
  
  try {
    const result = await window.electronAPI.coreUpgradeAll();
    if (result.success) {
      showStatus('Successfully updated all board packages', 'success');
      // Reload installed cores and clear available updates
      await loadInstalledCores();
      availableUpdates.value.cores = [];
      // Emit event to notify parent components that cores were upgraded
      emit('core-upgraded', 'all');
    } else {
      showError(`Failed to update all board packages: ${result.error}`);
    }
  } catch (error) {
    console.error('Error updating all cores:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isUpdatingAll.value = false;
  }
}

// Check if a platform is already installed
function isAlreadyInstalled(platformId) {
  return installedCores.value.some(core => core.id === platformId);
}

// Add a custom URL
async function addCustomUrl() {
  if (!newCustomUrl.value.trim()) return;
  
  isAddingUrl.value = true;
  clearStatus();
  showStatus('Adding custom URL...', 'info');
  
  try {
    const result = await window.electronAPI.addBoardManagerUrl(newCustomUrl.value.trim());
    if (result.success) {
      showStatus('Custom URL added successfully. Updating index...', 'info');
      newCustomUrl.value = '';
      // Reload custom URLs
      await loadCustomUrls();
      // Update index to fetch new board definitions
      await updateIndex();
    } else {
      showError(`Failed to add custom URL: ${result.error}`);
    }
  } catch (error) {
    console.error('Error adding custom URL:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isAddingUrl.value = false;
  }
}

// Remove a custom URL
async function removeCustomUrl(url) {
  if (!confirm(`Are you sure you want to remove this custom URL?\n\n${url}`)) {
    return;
  }
  
  isRemovingUrl.value = url;
  clearStatus();
  showStatus(`Removing custom URL...`, 'info');
  
  try {
    const result = await window.electronAPI.removeBoardManagerUrl(url);
    if (result.success) {
      showStatus(`Successfully removed custom URL`, 'success');
      // Reload custom URLs
      await loadCustomUrls();
      // Update index to reflect changes
      await updateIndex();
    } else {
      showError(`Failed to remove custom URL: ${result.error}`);
    }
  } catch (error) {
    console.error('Error removing custom URL:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
  } finally {
    isRemovingUrl.value = null;
  }
}

// Load custom URLs
async function loadCustomUrls() {
  isLoadingUrls.value = true;
  try {
    const result = await window.electronAPI.getBoardManagerConfig();
    if (result.success) {
      customUrls.value = result.additionalUrls || [];
    } else {
      console.error('Failed to load custom URLs:', result.error);
      customUrls.value = [];
    }
  } catch (error) {
    console.error('Error loading custom URLs:', error);
    customUrls.value = [];
  } finally {
    isLoadingUrls.value = false;
  }
}

// Add a suggested URL
async function addSuggestedUrl(url) {
  if (customUrls.value.includes(url)) return; // Already added
  
  newCustomUrl.value = url;
  await addCustomUrl();
}

// Get URL display name
function getUrlDisplayName(url) {
  // Extract a friendly name from the URL
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Common mappings
    if (hostname.includes('espressif.com')) return 'ESP32 (Espressif)';
    if (hostname.includes('github.com') && url.includes('stm32duino')) return 'STM32 (STMicroelectronics)';
    if (hostname.includes('adafruit.github.io')) return 'Adafruit';
    if (hostname.includes('sparkfun')) return 'SparkFun';
    if (hostname.includes('arduino.esp8266.com')) return 'ESP8266';
    
    // Default to hostname
    return hostname.replace('www.', '');
  } catch (e) {
    // If URL parsing fails, extract from common patterns
    if (url.includes('esp32')) return 'ESP32';
    if (url.includes('esp8266')) return 'ESP8266';
    if (url.includes('stm32')) return 'STM32';
    if (url.includes('adafruit')) return 'Adafruit';
    if (url.includes('sparkfun')) return 'SparkFun';
    
    return 'Custom Board Package';
  }
}

// Dismiss Arduino setup status
function dismissArduinoSetupStatus() {
  console.log('[CoreManagerModal] Dismissing Arduino setup status');
  arduinoSetupDismissed.value = true;
  
  // Store dismissal in localStorage with timestamp
  const dismissalData = {
    dismissed: true,
    timestamp: Date.now(),
    version: arduinoSetupStatus.value?.status || 'unknown'
  };
  localStorage.setItem('embedr-arduino-setup-dismissed', JSON.stringify(dismissalData));
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

.modal-fade-enter-from .board-manager,
.modal-fade-leave-to .board-manager {
  transform: translateY(20px);
}

/* Force background colors */
.board-manager .hover\:bg-\[\#252525\]:hover {
  background-color: #252525 !important;
}

/* Windows 10 and older browser fallbacks for tabs */
nav[aria-label="Board Manager tabs"] {
  background-color: #1A1A1A !important;
}

nav[aria-label="Board Manager tabs"] button {
  background-color: transparent;
  border: 1px solid transparent;
  /* Fallback for rounded corners */
  -webkit-border-radius: 6px;
  -moz-border-radius: 6px;
  border-radius: 6px;
  
  /* Fallback for transitions */
  -webkit-transition: all 0.2s ease-out;
  -moz-transition: all 0.2s ease-out;
  -o-transition: all 0.2s ease-out;
  transition: all 0.2s ease-out;
  
  /* Ensure proper layout */
  display: inline-block;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* Active tab styling with better fallbacks */
nav[aria-label="Board Manager tabs"] button.active-tab {
  background-color: #1E1E1E !important;
  border-color: #333 !important;
  color: white !important;
  
  /* Fallback shadow for older browsers */
  -webkit-box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  -moz-box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Hover state with fallbacks */
nav[aria-label="Board Manager tabs"] button:hover {
  background-color: rgba(30, 30, 30, 0.5) !important;
  color: rgba(255, 255, 255, 0.8) !important;
}

/* Windows 10 specific adjustments */
@media screen and (-ms-high-contrast: active), (-ms-high-contrast: none) {
  nav[aria-label="Board Manager tabs"] {
    background-color: #1A1A1A !important;
  }
  
  nav[aria-label="Board Manager tabs"] button {
    background-color: transparent !important;
    border: 1px solid transparent !important;
  }
  
  nav[aria-label="Board Manager tabs"] button.active-tab {
    background-color: #1E1E1E !important;
    border-color: #333 !important;
  }
  
  nav[aria-label="Board Manager tabs"] button:hover {
    background-color: rgba(30, 30, 30, 0.5) !important;
  }
}
</style> 