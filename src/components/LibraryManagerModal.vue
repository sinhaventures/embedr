<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col bg-[#1E1E1E]" style="background-color: #1E1E1E !important;">
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
        <nav class="inline-flex p-0.5 bg-[#1A1A1A] rounded-lg w-full" aria-label="Library Manager tabs" style="background-color: #1A1A1A !important;">
          <button
            @click="activeLibraryTab = 'search'"
            :class="[
              'relative flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-out whitespace-nowrap',
              activeLibraryTab === 'search' 
                ? 'bg-[#1E1E1E] text-white shadow-lg border border-[#333]' 
                : 'text-white/60 hover:text-white/80 hover:bg-[#1E1E1E]/50'
            ]"
            style="box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
          >
            Search & Install
          </button>
          <button
            @click="activeLibraryTab = 'installed'"
            :class="[
              'relative flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-out ml-0.5 whitespace-nowrap',
              activeLibraryTab === 'installed' 
                ? 'bg-[#1E1E1E] text-white shadow-lg border border-[#333]' 
                : 'text-white/60 hover:text-white/80 hover:bg-[#1E1E1E]/50'
            ]"
            style="box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
          >
            Installed Libraries
          </button>
          <button
            @click="activeLibraryTab = 'custom'"
            :class="[
              'relative flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-out ml-0.5 whitespace-nowrap',
              activeLibraryTab === 'custom' 
                ? 'bg-[#1E1E1E] text-white shadow-lg border border-[#333]' 
                : 'text-white/60 hover:text-white/80 hover:bg-[#1E1E1E]/50'
            ]"
            style="box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
          >
            Custom Libraries
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
              style="background-color: #252525 !important; border-color: #333 !important;"
            />
            <Button size="sm" @click="handleLibrarySearch" :disabled="searchLoading" variant="outline" class="h-9 px-4 border-[#444] hover:border-[#666] hover:bg-[#333]">
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
            <div v-for="lib in searchResults" :key="lib.name" class="border border-[#333] bg-[#252525] rounded-md overflow-hidden" style="background-color: #252525 !important; border-color: #333 !important;">
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
                      class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333] text-red-400 hover:text-red-300"
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
                      class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333]"
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
            <div class="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                @click="handleCheckUpdates" 
                :disabled="updatingIndex || fetchInProgress || checkingUpdates || updatingAll"
                class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333]"
              >
                <template v-if="checkingUpdates">
                  <span class="mr-1.5 h-3 w-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                  Checking
                </template>
                <template v-else>
                  <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Check Updates
                </template>
              </Button>
              
              <Button 
                v-if="libraryUpdates.length > 0"
                size="sm" 
                variant="default" 
                @click="handleUpdateAllLibraries" 
                :disabled="updatingIndex || fetchInProgress || checkingUpdates || updatingAll"
                class="h-8 px-3"
              >
                <template v-if="updatingAll">
                  <span class="mr-1.5 h-3 w-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                  Updating All
                </template>
                <template v-else>
                  <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Update All ({{ libraryUpdates.length }})
                </template>
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                @click="handleUpdateIndex" 
                :disabled="updatingIndex || fetchInProgress || checkingUpdates || updatingAll"
                class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333]"
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
            <div v-for="lib in installedLibraries" :key="lib.name" class="border border-[#333] bg-[#252525] rounded-md overflow-hidden" style="background-color: #252525 !important; border-color: #333 !important;">
              <div class="px-4 py-3 flex items-center justify-between gap-3">
                <div class="flex-1 space-y-0.5">
                  <h4 class="font-medium text-sm text-white/90">{{ lib.name }}</h4>
                  <p class="text-xs text-white/60 leading-snug">{{ lib.version }} &mdash; {{ lib.sentence }}</p>
                </div>
                <div class="flex gap-2">
                  <Button 
                    v-if="isLibraryOutdated(lib.name)"
                    size="sm" 
                    variant="outline" 
                    @click="handleUpgradeLibrary(lib)" 
                    :disabled="upgrading === lib.name || updatingAll"
                    class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333] text-yellow-400 hover:text-yellow-300"
                  >
                    <template v-if="upgrading === lib.name">
                      <span class="mr-1.5 h-3 w-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                      Updating
                    </template>
                    <template v-else>
                       <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                         <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                       </svg>
                      Update
                    </template>
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    @click="handleUninstallLibrary(lib)" 
                    :disabled="uninstalling === lib.name || updatingAll"
                    class="h-8 px-3 border-[#444] hover:border-[#666] hover:bg-[#333] text-red-400 hover:text-red-300"
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
            </div>
            <p v-if="uninstallError" class="text-red-400 text-xs mt-2 pl-1">{{ uninstallError }}</p>
            <p v-if="upgradeError" class="text-red-400 text-xs mt-2 pl-1">{{ upgradeError }}</p>
          </div>
        </div>

        <!-- Custom Libraries Tab -->
        <div v-if="activeLibraryTab === 'custom'" class="space-y-4">
          <div class="space-y-6">
            <!-- Git Repository Installation -->
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
                <h4 class="font-medium text-sm text-white/90">Install from Git Repository</h4>
              </div>
              <p class="text-xs text-white/60">Install libraries directly from GitHub or other Git repositories.</p>
              
              <div class="space-y-3">
                <div class="flex gap-2">
                  <input 
                    v-model="gitUrl" 
                    placeholder="https://github.com/user/library.git" 
                    class="flex-1 h-9 rounded-md bg-[#252525] px-3 text-sm text-white/90 placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-[#5B8EFF] border border-[#333]"
                    style="background-color: #252525 !important; border-color: #333 !important;"
                  />
                  <input 
                    v-model="gitVersion" 
                    placeholder="version/tag (optional)" 
                    class="w-32 h-9 rounded-md bg-[#252525] px-3 text-sm text-white/90 placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-[#5B8EFF] border border-[#333]"
                    style="background-color: #252525 !important; border-color: #333 !important;"
                  />
                  <Button 
                    size="sm" 
                    @click="handleInstallGitLibrary" 
                    :disabled="installingGit || !gitUrl.trim()"
                    variant="outline" 
                    class="h-9 px-4 border-[#444] hover:border-[#666] hover:bg-[#333]"
                  >
                    <template v-if="installingGit">
                      <span class="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                      Installing
                    </template>
                    <template v-else>
                      <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Install
                    </template>
                  </Button>
                </div>
                <p v-if="gitInstallError" class="text-red-400 text-xs pl-1">{{ gitInstallError }}</p>
                <p v-if="gitInstallSuccess" class="text-green-400 text-xs pl-1">{{ gitInstallSuccess }}</p>
              </div>
            </div>

            <!-- Separator -->
            <div class="border-t border-[#333]"></div>

            <!-- Zip File Installation -->
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 22h2a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3"></path>
                  <polyline points="14 2v6h6"></polyline>
                  <circle cx="10" cy="20" r="2"></circle>
                  <path d="M10 7v6"></path>
                  <path d="M10 22v-2"></path>
                </svg>
                <h4 class="font-medium text-sm text-white/90">Install from Zip File</h4>
              </div>
              <p class="text-xs text-white/60">Install libraries from local zip files.</p>
              
              <div class="space-y-3">
                <div class="flex gap-2">
                  <input 
                    v-model="zipPath" 
                    placeholder="Select a library zip file..." 
                    readonly
                    class="flex-1 h-9 rounded-md bg-[#252525] px-3 text-sm text-white/90 placeholder:text-white/50 focus:outline-none cursor-pointer border border-[#333]"
                    style="background-color: #252525 !important; border-color: #333 !important;"
                    @click="selectZipFile"
                  />
                  <Button 
                    size="sm" 
                    @click="selectZipFile" 
                    variant="outline" 
                    class="h-9 px-4 border-[#444] hover:border-[#666] hover:bg-[#333]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Browse
                  </Button>
                  <Button 
                    size="sm" 
                    @click="handleInstallZipLibrary" 
                    :disabled="installingZip || !zipPath.trim()"
                    variant="outline" 
                    class="h-9 px-4 border-[#444] hover:border-[#666] hover:bg-[#333]"
                  >
                    <template v-if="installingZip">
                      <span class="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                      Installing
                    </template>
                    <template v-else>
                      <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Install
                    </template>
                  </Button>
                </div>
                <p v-if="zipInstallError" class="text-red-400 text-xs pl-1">{{ zipInstallError }}</p>
                <p v-if="zipInstallSuccess" class="text-green-400 text-xs pl-1">{{ zipInstallSuccess }}</p>
              </div>
            </div>

            <!-- Info Section -->
            <div class="p-3 bg-blue-900/20 border border-blue-700/50 rounded-md text-sm text-blue-400">
              <div class="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 16v-4"></path>
                  <path d="M12 8h.01"></path>
                </svg>
                <div class="space-y-1">
                  <p class="font-medium">Installation Notes:</p>
                  <ul class="space-y-1 text-xs">
                    <li>• Git installations can include a specific version/tag (e.g., v1.2.0)</li>
                    <li>• Zip files should contain a valid Arduino library structure</li>
                    <li>• Custom libraries are installed globally for all sketches</li>
                    <li>• These installation methods bypass Arduino Library Manager validation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="px-6 py-4 mt-auto border-t border-[#333]">
        <Button variant="secondary" @click="$emit('update:open', false)" class="border-[#444] hover:border-[#666] hover:bg-[#333] text-white/80">
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
const upgrading = ref('') // Track which library is being upgraded
const updatingIndex = ref(false)
const checkingUpdates = ref(false)
const updatingAll = ref(false)
const searchLoading = ref(false)
const fetchInProgress = ref(false) // For loading installed libraries
const searchError = ref('')
const installError = ref('')
const uninstallError = ref('')
const updateError = ref('')
const upgradeError = ref('')
const activeLibraryTab = ref('search')
const libraryUpdates = ref([]) // Track outdated libraries
const gitUrl = ref('')
const gitVersion = ref('')
const installingGit = ref(false)
const gitInstallError = ref('')
const gitInstallSuccess = ref('')
const zipPath = ref('')
const installingZip = ref(false)
const zipInstallError = ref('')
const zipInstallSuccess = ref('')

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

async function handleCheckUpdates() {
  checkingUpdates.value = true
  updateError.value = ''
  upgradeError.value = ''
  try {
    const res = await window.electronAPI.outdated()
    if (res.success && res.outdated) {
      // Handle case where outdated is an empty object {} or has libraries array
      const libraries = res.outdated.libraries || []
      
      if (Array.isArray(libraries)) {
        libraryUpdates.value = libraries.map(item => ({
          name: item.library.name,
          currentVersion: item.library.version,
          latestVersion: item.release.version
        }))
        
        if (libraryUpdates.value.length === 0) {
          updateError.value = 'All libraries are up to date'
        }
      } else {
        libraryUpdates.value = []
        updateError.value = 'All libraries are up to date'
      }
    } else {
      updateError.value = res.error || 'Failed to check for updates'
    }
  } catch (e) {
    updateError.value = e.message
  } finally {
    checkingUpdates.value = false
  }
}

async function handleUpgradeLibrary(lib) {
  upgrading.value = lib.name
  upgradeError.value = ''
  try {
    const res = await window.electronAPI.libUpgrade(lib.name)
    if (!res.success || (res.output && res.output.toLowerCase && res.output.toLowerCase().includes('error'))) {
      upgradeError.value = res.error || res.output || 'Upgrade failed.'
    } else {
      // Success, refresh installed list and remove from updates
      await fetchInstalledLibraries()
      libraryUpdates.value = libraryUpdates.value.filter(update => update.name !== lib.name)
    }
  } catch (e) {
    upgradeError.value = e.message
  } finally {
    upgrading.value = ''
  }
}

async function handleUpdateAllLibraries() {
  updatingAll.value = true
  upgradeError.value = ''
  try {
    const res = await window.electronAPI.libUpgradeAll()
    if (!res.success || (res.output && res.output.toLowerCase && res.output.toLowerCase().includes('error'))) {
      upgradeError.value = res.error || res.output || 'Update all failed.'
    } else {
      // Success, refresh installed list and clear updates
      await fetchInstalledLibraries()
      libraryUpdates.value = []
    }
  } catch (e) {
    upgradeError.value = e.message
  } finally {
    updatingAll.value = false
  }
}

// Custom library installation handlers
async function handleInstallGitLibrary() {
  installingGit.value = true
  gitInstallError.value = ''
  gitInstallSuccess.value = ''
  
  try {
    const res = await window.electronAPI.installLibraryGit(gitUrl.value.trim(), gitVersion.value.trim())
    if (!res.success) {
      // Parse and extract meaningful error message
      let errorMessage = 'Git installation failed.'
      
      if (res.error) {
        if (typeof res.error === 'string') {
          // If error is already a string, use it directly
          errorMessage = res.error
        } else if (res.error.error) {
          // If error is an object with an error field, extract it
          errorMessage = res.error.error
        }
      }
      
      // Clean up the error message
      errorMessage = errorMessage
        .replace('Error installing Git Library: ', '')
        .replace('Library install failed: ', '')
      
      // Handle specific error cases with more user-friendly messages
      if (errorMessage.includes('invalid git url')) {
        errorMessage = 'Invalid Git URL. Please check the repository URL and try again.'
      } else if (errorMessage.includes('repository not found')) {
        errorMessage = 'Repository not found. Please verify the URL is correct and accessible.'
      } else if (errorMessage.includes('permission denied')) {
        errorMessage = 'Permission denied. The repository may be private or require authentication.'
      } else if (errorMessage.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.'
      }
      
      gitInstallError.value = errorMessage
    } else {
      gitInstallSuccess.value = 'Library installed successfully from Git repository!'
      // Clear inputs after successful installation
      gitUrl.value = ''
      gitVersion.value = ''
      // Refresh the installed libraries list
      await fetchInstalledLibraries()
      // Clear success message after 3 seconds
      setTimeout(() => {
        gitInstallSuccess.value = ''
      }, 3000)
    }
  } catch (e) {
    gitInstallError.value = 'An unexpected error occurred during Git installation. Please try again.'
    console.error('Git installation error:', e)
  } finally {
    installingGit.value = false
  }
}

async function selectZipFile() {
  try {
    const result = await window.electronAPI.showOpenDialog({
      title: 'Select Library Zip File',
      filters: [
        { name: 'Zip Files', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    if (result.success && !result.canceled && result.filePaths.length > 0) {
      zipPath.value = result.filePaths[0]
      zipInstallError.value = ''
    }
  } catch (e) {
    zipInstallError.value = 'Failed to open file dialog: ' + e.message
  }
}

async function handleInstallZipLibrary() {
  installingZip.value = true
  zipInstallError.value = ''
  zipInstallSuccess.value = ''
  
  try {
    const res = await window.electronAPI.installLibraryZip(zipPath.value)
    if (!res.success) {
      // Parse and extract meaningful error message
      let errorMessage = 'Zip installation failed.'
      
      if (res.error) {
        if (typeof res.error === 'string') {
          // If error is already a string, use it directly
          errorMessage = res.error
        } else if (res.error.error) {
          // If error is an object with an error field, extract it
          errorMessage = res.error.error
        }
      }
      
      // Clean up the error message
      errorMessage = errorMessage
        .replace('Error installing Zip Library: ', '')
        .replace('Library install failed: ', '')
      
      // Handle specific error cases with more user-friendly messages
      if (errorMessage.includes('library not valid')) {
        errorMessage = 'Invalid library structure. The zip file does not contain a valid Arduino library.'
      } else if (errorMessage.includes('moving extracted archive')) {
        errorMessage = 'Failed to install library. The zip file may be corrupted or contain an invalid library structure.'
      } else if (errorMessage.includes('permission denied')) {
        errorMessage = 'Permission denied. Please check file permissions and try again.'
      } else if (errorMessage.includes('file not found') || errorMessage.includes('no such file')) {
        errorMessage = 'Zip file not found. Please select a valid zip file and try again.'
      } else if (errorMessage.includes('archive format')) {
        errorMessage = 'Invalid archive format. Please ensure the file is a valid zip archive.'
      }
      
      zipInstallError.value = errorMessage
    } else {
      zipInstallSuccess.value = 'Library installed successfully from zip file!'
      // Clear inputs after successful installation
      zipPath.value = ''
      // Refresh the installed libraries list
      await fetchInstalledLibraries()
      // Clear success message after 3 seconds
      setTimeout(() => {
        zipInstallSuccess.value = ''
      }, 3000)
    }
  } catch (e) {
    zipInstallError.value = 'An unexpected error occurred during zip installation. Please try again.'
    console.error('Zip installation error:', e)
  } finally {
    installingZip.value = false
  }
}

function isLibraryOutdated(libraryName) {
  return libraryUpdates.value.some(update => update.name === libraryName)
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
    upgradeError.value = ''
    libraryUpdates.value = []
    // Clear custom library state
    gitUrl.value = ''
    gitVersion.value = ''
    gitInstallError.value = ''
    gitInstallSuccess.value = ''
    zipPath.value = ''
    zipInstallError.value = ''
    zipInstallSuccess.value = ''
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

/* Tab styling fallbacks for older browsers */
nav[aria-label="Library Manager tabs"] button {
  /* Fallback for shadow-lg on older browsers */
  -webkit-box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  -moz-box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  
  /* Fallback for rounded corners */
  -webkit-border-radius: 6px;
  -moz-border-radius: 6px;
  border-radius: 6px;
  
  /* Fallback for transitions */
  -webkit-transition: all 0.2s ease-out;
  -moz-transition: all 0.2s ease-out;
  -o-transition: all 0.2s ease-out;
  transition: all 0.2s ease-out;
  
  /* Ensure text doesn't wrap */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0; /* Allow flex items to shrink */
}

/* Windows 10 specific adjustments */
@media screen and (-ms-high-contrast: active), (-ms-high-contrast: none) {
  nav[aria-label="Library Manager tabs"] {
    background-color: #1A1A1A !important;
  }
  
  nav[aria-label="Library Manager tabs"] button {
    background-color: transparent;
    border: 1px solid transparent;
  }
  
  nav[aria-label="Library Manager tabs"] button:hover {
    background-color: rgba(30, 30, 30, 0.5);
  }
}
</style> 