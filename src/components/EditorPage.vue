<template>
  <div class="fixed inset-0 flex flex-col bg-background">
    <!-- Top Bar -->
    <div class="h-16 border-b bg-card flex items-center px-6 gap-4 shadow-sm flex-shrink-0">
      <button 
        class="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-medium transition-colors"
        @click="handleBack"
      >
        ← Back
      </button>
      <!-- Board, Port, AND Options Selection -->
      <div class="flex items-center gap-3">
        <!-- Board Select -->
        <Select v-model="selectedBoard">
          <SelectTrigger class="w-[250px] bg-background">
            <SelectValue :placeholder="'Select Board'">
              {{ selectedBoardName || 'Select Board' }} 
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <div class="p-2 sticky top-0 bg-popover z-10">
              <input
                v-model="boardSearch"
                type="text"
                placeholder="Search boards..."
                class="w-full px-3 py-1.5 rounded-md bg-background border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                @keydown.stop
              />
            </div>
            <div class="max-h-[300px] overflow-y-auto">
              <template v-if="filteredBoards.length > 0">
                <SelectItem 
                  v-for="board in filteredBoards" 
                  :key="board.value" 
                  :value="board.value"
                  class="items-start"
                >
                  <div class="flex flex-col py-1">
                    <span class="text-sm font-medium leading-tight">{{ getBoardNameFromLabel(board.label) }}</span>
                    <span class="text-xs text-muted-foreground mt-0.5">{{ board.value }}</span>
                  </div>
                </SelectItem>
              </template>
              <template v-else>
                <div class="px-4 py-2 text-sm text-muted-foreground text-center">No matching boards found</div>
              </template>
            </div>
          </SelectContent>
        </Select>
        
        <!-- Port Select -->
        <Select v-model="selectedPort" @update:open="handlePortDropdownToggle">
          <SelectTrigger class="w-[180px] bg-background">
            <SelectValue placeholder="Select Port" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="port in ports" :key="port.value" :value="port.value">{{ port.label }}</SelectItem>
          </SelectContent>
        </Select>

        <!-- Board Options Button -->
        <Button
          v-if="Object.keys(boardConfigOptions).length > 0"
          variant="outline"
          size="sm"
          class="h-10"
          @click="showBoardOptionsModal = true"
        >
          Board Options
        </Button>
      </div>
      <!-- Action Buttons -->
      <div class="ml-auto flex items-center gap-2">
        <!-- Library Manager Icon Button -->
        <Button 
          variant="ghost" 
          size="icon" 
          class="relative group" 
          @click="openLibraryModal" 
          :aria-label="'Manage Libraries'"
          title="Manage Libraries"
        >
          <Book class="w-5 h-5" />
          <span class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">Manage Libraries</span>
        </Button>
        <Button 
          variant="outline" 
          class="bg-background hover:bg-secondary/80 relative group" 
          @click="handleCompile" 
          :disabled="compiling || !currentInoPath || !selectedBoard"
          aria-label="Compile"
        >
          <span v-if="compiling" class="animate-spin mr-2 w-4 h-4 inline-block border-2 border-t-transparent border-current rounded-full"></span>
          Compile
          <span class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">
            {{ isMac ? 'Cmd' : 'Ctrl' }}+R
          </span>
        </Button>
        <Button 
          variant="default" 
          class="relative group"
          @click="handleUpload" 
          :disabled="compiling || !currentInoPath || !selectedBoard || !selectedPort"
          aria-label="Upload"
        >
          Upload
          <span class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">
            {{ isMac ? 'Cmd' : 'Ctrl' }}+U
          </span>
        </Button>
        <Button 
          variant="secondary" 
          class="relative group"
          :disabled="!isDirty" 
          @click="saveCurrentCode"
          aria-label="Save"
        >
          Save <span v-if="isDirty" class="ml-1 text-red-500">●</span>
          <span class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">
            Save ({{ isMac ? 'Cmd' : 'Ctrl' }}+S)
          </span>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          class="relative group" 
          @click="handleHistoryClick" 
          :disabled="!currentInoPath || versionsLoading"
          :aria-label="'Version History'"
          title="Version History"
        >
          <div v-if="versionsLoading" class="absolute inset-0 flex items-center justify-center">
            <div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
          <History class="w-5 h-5" :class="{ 'opacity-0': versionsLoading }" />
          <span class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">Version History</span>
        </Button>
      </div>
    </div>
    <!-- Library Manager Modal -->
    <Dialog v-model:open="showLibraryModal">
      <DialogContent class="sm:max-w-[800px] h-[80vh] flex flex-col bg-[#1E1E1E]">
        <DialogHeader class="px-6 py-4">
          <DialogTitle class="text-white/90">Library Manager</DialogTitle>
          <DialogDescription class="text-white/60">
            Search, install, and manage Arduino libraries
          </DialogDescription>
        </DialogHeader>
        
        <!-- Tabs Navigation -->
        <div class="px-6 flex-shrink-0">
          <nav class="inline-flex p-1 bg-muted rounded-lg tab_switching_bar w-full" aria-label="Library Manager tabs" style="min-width: 300px">
            <button
              @click="activeLibraryTab = 'search'"
              :class="[
                'relative flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ease-out',
                activeLibraryTab === 'search' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              Search & Install
            </button>
            <button
              @click="activeLibraryTab = 'installed'"
              :class="[
                'relative flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ease-out',
                activeLibraryTab === 'installed' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              Installed Libraries
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-hidden mt-4">
          <!-- Search & Install Tab -->
          <div v-if="activeLibraryTab === 'search'" class="h-full flex flex-col px-6">
            <div class="space-y-2 mb-4">
              <div class="flex gap-2 items-center">
                <input 
                  v-model="librarySearch" 
                  @keyup.enter="handleLibrarySearch" 
                  placeholder="Search libraries..." 
                  class="flex-1 h-10 rounded-md bg-[#252525] px-3 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#5B8EFF] border border-transparent"
                />
                <Button size="sm" @click="handleLibrarySearch" :disabled="searchLoading" variant="outline" class="h-10 px-5 border-white/10">
                  Search
                </Button>
              </div>

              <div v-if="searchLoading" class="text-sm text-white/60">
                Searching...
              </div>
              
              <div v-if="searchError" class="text-sm text-red-500">
                {{ searchError }}
              </div>
            </div>

            <div v-if="searchResults.length > 0" class="flex-1 overflow-hidden">
              <div class="h-full overflow-y-auto pr-2">
                <div v-for="lib in searchResults" :key="lib.name" class="bg-[#252525] rounded mb-2 p-3">
                  <div class="flex items-start justify-between gap-4">
                    <div class="space-y-1">
                      <h4 class="font-medium text-sm text-white/90">{{ lib.name }}</h4>
                      <p class="text-xs text-white/60">{{ lib.version ? lib.version + ' — ' : '' }}{{ lib.sentence }}</p>
                    </div>
                    <div>
                      <template v-if="installedLibraries.some(inst => inst.name === lib.name)">
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          @click="handleUninstallLibrary(installedLibraries.find(inst => inst.name === lib.name))" 
                          :disabled="uninstalling === lib.name"
                        >
                          <span v-if="uninstalling === lib.name" class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                          <span v-if="uninstalling === lib.name">Uninstalling...</span>
                          <span v-else>Uninstall</span>
                        </Button>
                      </template>
                      <template v-else>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          @click="handleInstallLibrary(lib)" 
                          :disabled="installing === lib.name"
                        >
                          <span v-if="installing === lib.name" class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                          <span v-if="installing === lib.name">Installing...</span>
                          <span v-else>Install</span>
                        </Button>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
              <p v-if="installError" class="text-xs text-red-500 mt-2">{{ installError }}</p>
            </div>
          </div>

          <!-- Installed Libraries Tab -->
          <div v-if="activeLibraryTab === 'installed'" class="h-full flex flex-col px-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="font-medium text-sm text-white/90">Installed Libraries</h4>
              <Button 
                size="sm" 
                variant="outline" 
                @click="handleUpdateIndex" 
                :disabled="updatingIndex"
                class="border-white/10"
              >
                <span v-if="updatingIndex" class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                Update Index
              </Button>
            </div>

            <div v-if="updateError" class="text-sm text-red-500 mb-2">
              {{ updateError }}
            </div>

            <div class="flex-1 overflow-hidden">
              <div class="h-full overflow-y-auto pr-2">
                <div v-for="lib in installedLibraries" :key="lib.name" class="bg-[#252525] rounded mb-2 p-3">
                  <div class="flex items-start justify-between gap-4">
                    <div class="space-y-1">
                      <h4 class="font-medium text-sm text-white/90">{{ lib.name }}</h4>
                      <p class="text-xs text-white/60">{{ lib.version }} &mdash; {{ lib.sentence }}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      @click="handleUninstallLibrary(lib)" 
                      :disabled="uninstalling === lib.name"
                    >
                      <span v-if="uninstalling === lib.name" class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                      Uninstall
                    </Button>
                  </div>
                </div>
              </div>
              <p v-if="uninstallError" class="text-xs text-red-500 mt-2">{{ uninstallError }}</p>
            </div>
          </div>
        </div>

        <DialogFooter class="px-6 py-4 mt-4">
          <DialogClose asChild>
            <Button variant="secondary" class="bg-[#252525] text-white/90 hover:bg-[#2A2A2A] border-white/10">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <!-- Version History Modal -->
    <Dialog v-model:open="showHistoryModal">
      <DialogContent class="sm:max-w-[800px] h-[80vh] flex flex-col bg-[#1E1E1E]">
        <DialogHeader class="px-6 py-4">
          <DialogTitle class="text-white/90">Version History</DialogTitle>
          <DialogDescription class="text-white/60">
            View and restore previous versions of your sketch
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-hidden px-6">
          <div v-if="versionsLoading" class="h-full flex flex-col items-center justify-center gap-3">
            <div class="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full"></div>
            <div class="text-white/60">Loading version history...</div>
          </div>
          <div v-else-if="versionsError" class="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div class="text-red-400">{{ versionsError }}</div>
            <Button size="sm" variant="outline" @click="retryLoadVersions" class="border-white/10">
              Retry Loading
            </Button>
          </div>
          <div v-else-if="versions.length === 0" class="h-full flex items-center justify-center text-white/60">
            No version history available
          </div>
          <div v-else class="h-full overflow-y-auto">
            <div v-if="diffVersion" class="mb-4">
              <div class="flex items-center justify-between mb-2">
                <div class="text-white/90">
                  Comparing with {{ formatVersionRelative(diffVersion.timestamp) }}
                </div>
                <Button size="sm" variant="ghost" @click="closeDiff">
                  Close Diff
                </Button>
              </div>
              <CodeDiffViewer :oldCode="diffVersion.content" :newCode="code" />
            </div>
            <div v-else-if="previewVersion" class="mb-4">
              <div class="flex items-center justify-between mb-2">
                <div class="text-white/90">
                  Preview of {{ formatVersionRelative(previewVersion.timestamp) }}
                </div>
                <Button size="sm" variant="ghost" @click="closePreview">
                  Close Preview
                </Button>
              </div>
              <div class="bg-[#252525] rounded p-3 max-h-[300px] overflow-y-auto">
                <pre class="text-sm text-white/90 whitespace-pre-wrap">{{ previewVersion.content }}</pre>
              </div>
            </div>
            <ul class="space-y-2">
              <li v-for="version in versions" :key="version.path" class="bg-[#252525] rounded p-3">
                <div class="flex items-center justify-between">
                  <div class="text-white/90">
                    <span class="text-xs text-muted-foreground mr-2">v{{ version.version }}</span>
                    {{ formatVersionRelative(version.timestamp) }}
                  </div>
                  <div class="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      class="border-white/10"
                      :disabled="diffLoading === version.path"
                      @click="handleDiff(version)"
                    >
                      <span v-if="diffLoading === version.path" class="mr-1 w-3 h-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                      Compare
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      class="border-white/10"
                      :disabled="restoreLoading === version.path"
                      @click="handleRestore(version)"
                    >
                      <span v-if="restoreLoading === version.path" class="mr-1 w-3 h-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                      Restore
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      class="border-white/10 hover:bg-red-900/20 hover:text-red-400"
                      :disabled="deleteLoading === version.path"
                      @click="handleDelete(version)"
                    >
                      <span v-if="deleteLoading === version.path" class="mr-1 w-3 h-3 inline-block border-2 border-t-transparent border-current rounded-full animate-spin"></span>
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter class="px-6 py-4 mt-4">
          <DialogClose asChild>
            <Button variant="secondary" class="bg-[#252525] text-white/90 hover:bg-[#2A2A2A] border-white/10">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <!-- Board Options Modal -->
    <Dialog :open="showBoardOptionsModal" @update:open="showBoardOptionsModal = $event">
      <DialogContent class="sm:max-w-[500px] h-[85vh] flex flex-col bg-[#1C1C1E]/90 backdrop-blur-xl border-[#323234] shadow-2xl">
        <DialogHeader class="flex-shrink-0 px-6 pt-6">
          <DialogTitle class="text-2xl font-medium tracking-tight">Board Configuration</DialogTitle>
          <DialogDescription class="text-[#86868B] mt-2">
            Adjust options for {{ selectedBoardName || 'selected board' }}.
          </DialogDescription>
        </DialogHeader>
        
        <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
          <div v-for="(options, key) in boardConfigOptions" :key="key" class="space-y-2">
            <label class="text-sm font-medium text-[#86868B]">
              {{ getOptionLabel(key) }}
            </label>
            <Select 
              v-model="selectedBoardOptions[key]"
              :disabled="!options || options.length === 0"
            >
              <SelectTrigger class="w-full bg-[#2C2C2E] border-[#323234] focus:ring-[#0A84FF] focus:ring-offset-0">
                <SelectValue :placeholder="`Select ${getOptionLabel(key)}`" />
              </SelectTrigger>
              <SelectContent class="bg-[#2C2C2E] border-[#323234]">
                <SelectItem 
                  v-for="option in options" 
                  :key="option.value" 
                  :value="option.value"
                  class="text-[#FAFAFA] hover:bg-[#3A3A3C] focus:bg-[#3A3A3C]"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter class="flex-shrink-0 sm:justify-between border-t border-[#323234] px-6 py-4">
          <DialogClose asChild>
            <Button variant="secondary" class="bg-[#2C2C2E] hover:bg-[#3A3A3C] border-[#323234] text-[#FAFAFA]">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button 
              type="submit" 
              class="bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white border-none"
              @click="handleBoardOptionsSubmit"
            >
              Save Changes
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <!-- Main Content using vue-resizable-panels -->
    <PanelGroup direction="horizontal" class="flex-1 min-h-0">
      <Panel :defaultSize="65" :minSize="30">
        <PanelGroup direction="vertical" class="h-full">
          <Panel :defaultSize="60" :minSize="30" class="flex flex-col min-h-0">
            <!-- Editor -->
            <div class="flex-1 min-h-0 bg-[#1E1E1E]">
              <MonacoEditor 
                ref="monacoEditorRef" 
                :model-value="code" 
                @update:model-value="handleCodeChange" 
                class="h-full w-full"
              />
            </div>
          </Panel>
          <PanelResizeHandle class="vrp-handle-horizontal" />
          <Panel :defaultSize="40" :minSize="20" :maxSize="85" class="flex flex-col min-h-0">
            <!-- Bottom Panel -->
            <div class="bg-card flex flex-col h-full shadow-inner">
              <!-- Tabs -->
              <div class="flex px-4 pt-1.5 pb-1.5 flex-shrink-0">
                <nav class="inline-flex p-0.5 bg-muted rounded-lg tab_switching_bar" aria-label="Tabs" style="min-width: 180px">
                  <button
                    @click="activeTab = 'serial'"
                    :class="[
                      'relative flex-1 px-2 py-0.5 text-xs font-medium rounded-md transition-all duration-200 ease-out',
                      activeTab === 'serial' 
                        ? 'bg-background text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    ]"
                  >
                    Serial Monitor
                  </button>
                  <button
                    @click="activeTab = 'output'"
                    :class="[
                      'relative flex-1 px-2 py-0.5 text-xs font-medium rounded-md transition-all duration-200 ease-out flex items-center justify-center gap-1',
                      activeTab === 'output' 
                        ? (compileStatus === 'success'
                            ? 'bg-green-600 text-white shadow-sm'
                            : compileStatus === 'error'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-background text-foreground shadow-sm')
                        : (compileStatus === 'success'
                            ? 'bg-transparent text-green-600'
                            : compileStatus === 'error'
                              ? 'bg-transparent text-red-600'
                              : 'bg-transparent text-muted-foreground hover:text-foreground')
                    ]"
                  >
                    <template v-if="compileStatus === 'success'">
                      <span class="inline-flex items-center justify-center rounded-full bg-green-500/90 w-3.5 h-3.5">
                        <svg class="w-2 h-2" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </span>
                    </template>
                    <template v-else-if="compileStatus === 'error'">
                      <span class="inline-flex items-center justify-center rounded-full bg-red-500/90 w-3.5 h-3.5">
                        <svg class="w-2 h-2" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </span>
                    </template>
                    Output
                  </button>
                </nav>
              </div>
              <!-- Tab Content -->
              <div
                class="relative flex-1 bg-background font-mono text-sm min-h-0 px-4 pt-10 pb-3"
                v-show="activeTab === 'output'"
              >
                <!-- Copy/Clear Buttons for Output (Now sticky relative to the container above) -->
                <div v-if="buildOutput && buildOutput.trim() !== ''" class="absolute top-2 right-4 flex gap-1 z-10"> 
                  <Button @click="copyBuildOutput" size="sm" variant="outline" class="h-6 px-2 text-xs">Copy</Button>
                  <Button @click="clearBuildOutput" size="sm" variant="outline" class="h-6 px-2 text-xs">Clear</Button>
                </div>
                <!-- Make the pre tag scrollable -->
                <pre 
                  class="whitespace-pre-wrap text-left h-full overflow-y-auto"
                  ref="outputContainerRef" 
                >{{ buildOutput }}</pre>
              </div>
              <!-- Use SerialMonitor component for the serial tab -->
              <div class="flex-1 min-h-0" v-show="activeTab === 'serial'">
                <SerialMonitor :selected-port-path="selectedPort" />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle class="vrp-handle-vertical" />
      <Panel :defaultSize="35" :minSize="20" :maxSize="70">
        <!-- Co-pilot Section (Right) -->
        <CopilotChat 
          v-if="currentProject && currentProject.dir"
          :project-path="currentProject.dir" 
          :selected-board-fqbn="selectedBoard" 
          :selected-port-path="selectedPort" 
          :thread-id="threadId"
          :homepage-query="homepageQuery"
          :homepage-image-data-url="homepageImageDataUrl"
        />
      </Panel>
    </PanelGroup>
  </div>
</template>

<script setup>
import MonacoEditor from './MonacoEditor.vue'
import { ref, onMounted, watch, computed, nextTick, watchEffect, onBeforeUnmount, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PanelGroup, Panel, PanelResizeHandle } from 'vue-resizable-panels'
import { useRoute } from 'vue-router'
import { Book, History } from 'lucide-vue-next'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog'
import CodeDiffViewer from './CodeDiffViewer.vue'
import SerialMonitor from './SerialMonitor.vue'
import CopilotChat from './CopilotChat.vue'

// Firebase Auth imports (NEW)
import { getAuth, onIdTokenChanged } from 'firebase/auth';

const code = ref('')
const activeTab = ref('serial') // 'serial' or 'output'
const selectedBoard = ref(null)
const selectedPort = ref(null)
const boardConfigOptions = ref({}); // { key: [{value, label}, ...], ... }
const selectedBoardOptions = ref({}); // { key: value, ... }
const buildOutput = ref('')
const currentProject = ref(null)
const currentInoPath = ref('')
const isDirty = ref(false)
const compiling = ref(false)
const boards = ref([])
const ports = ref([])
const boardSearch = ref('')
const filteredBoards = computed(() => {
  if (!boardSearch.value) return boards.value;
  const search = boardSearch.value.toLowerCase();
  return boards.value.filter(board => 
    board.label.toLowerCase().includes(search)
  );
})

const monacoEditorRef = ref(null) // Ref for MonacoEditor component
const route = useRoute()

const LOCALSTORAGE_BOARD_KEY = 'embedr-selected-board';
const LOCALSTORAGE_PORT_KEY = 'embedr-selected-port';
const LOCALSTORAGE_BOARD_OPTIONS_KEY = 'embedr-board-options';

const showLibraryModal = ref(false)
const librarySearch = ref('')
const searchResults = ref([])
const installedLibraries = ref([])
const installing = ref(false)
const uninstalling = ref('')
const updatingIndex = ref(false)
const searchLoading = ref(false)
const searchError = ref('')
const installError = ref('')
const uninstallError = ref('')
const updateError = ref('')
const searchQuery = ref('')
const activeLibraryTab = ref('search')
const compileStatus = ref(null) // 'success' | 'error' | null

const outputContainerRef = ref(null)
const versions = ref([])
const versionsLoading = ref(false)
const showHistoryModal = ref(false)
const previewVersion = ref(null)
const previewLoading = ref(null)
const restoreLoading = ref(null)
const versionsError = ref(null)
const diffVersion = ref(null)
const diffLoading = ref(null)
const deleteLoading = ref(null)
const diffEditorRef = ref(null)

const originalContent = ref('')

const isMac = computed(() => navigator.platform.toUpperCase().indexOf('MAC') >= 0);

const threadId = computed(() => route.query.threadId || null);
const homepageQuery = computed(() => {
  try {
    const pending = localStorage.getItem('embedr-pending-ai-query');
    if (pending) {
      const { prompt } = JSON.parse(pending);
      return prompt || null;
    }
  } catch {}
  return null;
});

const homepageImageDataUrl = computed(() => {
  try {
    const pending = localStorage.getItem('embedr-pending-ai-query');
    if (pending) {
      const { imageDataUrl } = JSON.parse(pending);
      console.log('[EditorPage] Read imageDataUrl from localStorage:', imageDataUrl ? imageDataUrl.substring(0, 50) + '...' : null); // Log the read value
      return imageDataUrl || null;
    }
  } catch {}
  console.log('[EditorPage] No image data found in localStorage.'); // Log if not found
  return null;
});

const isRefreshingPorts = ref(false); // Prevent concurrent refreshes

// Computed property to get only the name of the selected board
const selectedBoardName = computed(() => {
  if (!selectedBoard.value || !boards.value) return null;
  const board = boards.value.find(b => b.value === selectedBoard.value);
  return board ? getBoardNameFromLabel(board.label) : null;
});

// Helper function to make option keys more readable
function getOptionLabel(key) {
  switch (key) {
    case 'cpu': return 'Processor';
    // Add more cases as needed for other common keys like 'baud', 'partition', etc.
    default: return key.charAt(0).toUpperCase() + key.slice(1); // Capitalize first letter
  }
}

// Helper function to extract Board Name from the combined label
function getBoardNameFromLabel(label) {
  if (!label) return '';
  // Matches text up to the last opening parenthesis, trimming whitespace
  const match = label.match(/^(.*?)\s+\(/); 
  return match ? match[1].trim() : label; // Fallback to full label if format unknown
}

// Function to load saved board options
function loadSavedBoardOptions(fqbn) {
  if (!fqbn) return {};
  
  try {
    const savedOptions = localStorage.getItem(LOCALSTORAGE_BOARD_OPTIONS_KEY);
    if (savedOptions) {
      const allBoardOptions = JSON.parse(savedOptions);
      const options = allBoardOptions[fqbn] || {};
      console.log(`[loadSavedBoardOptions] Loaded options for ${fqbn}:`, options);
      return options;
    }
  } catch (error) {
    console.error('[loadSavedBoardOptions] Error loading saved board options:', error);
  }
  console.log(`[loadSavedBoardOptions] No saved options found for ${fqbn}`);
  return {};
}

// Function to save board options
function saveBoardOptions(fqbn, options) {
  if (!fqbn) {
    console.warn('[saveBoardOptions] Cannot save options: No board FQBN provided');
    return;
  }
  
  try {
    const savedOptions = localStorage.getItem(LOCALSTORAGE_BOARD_OPTIONS_KEY);
    const allBoardOptions = savedOptions ? JSON.parse(savedOptions) : {};
    
    // Store a copy to avoid any reactivity issues
    allBoardOptions[fqbn] = JSON.parse(JSON.stringify(options || {}));
    
    localStorage.setItem(LOCALSTORAGE_BOARD_OPTIONS_KEY, JSON.stringify(allBoardOptions));
    console.log(`[saveBoardOptions] Saved options for ${fqbn}:`, options);
  } catch (error) {
    console.error('[saveBoardOptions] Error saving board options:', error);
  }
}

// --- IPC Event Listeners ---
let unsubscribeBoardSelected = null;
let unsubscribePortSelected = null;
let unsubscribeAgentCliOutput = null;

const setupIPCListeners = () => {
  console.log('[EditorPage] Attempting to set up IPC listeners...');
  
  if (window.electronAPI && typeof window.electronAPI.onBoardSelectedByAgent === 'function') {
    console.log('[EditorPage] electronAPI.onBoardSelectedByAgent found. Registering listener...');
    try {
      unsubscribeBoardSelected = window.electronAPI.onBoardSelectedByAgent((fqbn) => {
        console.log(`[Listener] EditorPage received board-selected-by-agent with FQBN: "${fqbn}" (Type: ${typeof fqbn})`);
        const currentVal = selectedBoard.value;
        console.log(`[Listener] Current selectedBoard ref value: "${currentVal}" (Type: ${typeof currentVal})`);
        
        // Check if the received FQBN exists in the boards list
        const boardExists = boards.value.some(b => b.value === fqbn);
        console.log(`[Listener] Does FQBN "${fqbn}" exist in boards.value? ${boardExists}`);

        if (currentVal !== fqbn) {
          console.log(`[Listener] Values differ. Attempting to update selectedBoard ref to: "${fqbn}"`);
          selectedBoard.value = fqbn; // Update local state
          // Log value *after* assignment to confirm
          console.log(`[Listener] Value *after* assignment: "${selectedBoard.value}"`); 
        } else {
          console.log('[Listener] Values are the same. No update needed.');
        }
      });
      console.log(`[EditorPage] Listener registered. Unsubscribe function type: ${typeof unsubscribeBoardSelected}`);
    } catch (error) {
      console.error('[EditorPage] Error registering onBoardSelectedByAgent listener:', error);
    }
  } else {
    console.error('[EditorPage] window.electronAPI or window.electronAPI.onBoardSelectedByAgent NOT found!');
  }

  // Add similar logging for onPortSelectedByAgent
  if (window.electronAPI && typeof window.electronAPI.onPortSelectedByAgent === 'function') {
    console.log('[EditorPage] electronAPI.onPortSelectedByAgent found. Registering listener...');
     try {
      unsubscribePortSelected = window.electronAPI.onPortSelectedByAgent((portPath) => {
        console.log('EditorPage received port-selected-by-agent:', portPath);
        if (selectedPort.value !== portPath) {
          console.log(`Updating selectedPort from ${selectedPort.value} to ${portPath}`);
          selectedPort.value = portPath; // Update local state, watcher will NOT notify main again
        }
      });
      console.log(`[EditorPage] Listener registered. Unsubscribe function type: ${typeof unsubscribePortSelected}`);
    } catch (error) {
      console.error('[EditorPage] Error registering onPortSelectedByAgent listener:', error);
    }
  } else {
    console.error('[EditorPage] window.electronAPI or window.electronAPI.onPortSelectedByAgent NOT found!');
  }

  // Setup listener for agent CLI output
  if (window.electronAPI && typeof window.electronAPI.onShowAgentCliOutput === 'function') {
    console.log('[EditorPage] electronAPI.onShowAgentCliOutput found. Registering listener...');
    try {
        unsubscribeAgentCliOutput = window.electronAPI.onShowAgentCliOutput((output) => {
        console.log(`[Listener] EditorPage received show-agent-cli-output with data length: ${output?.length}`);
        if (output && typeof output === 'string') {
          // Replace the entire output instead of appending
          buildOutput.value = "--- Agent Action Output ---\n" + output + "\n--- End Agent Action Output ---\n"; 
          activeTab.value = 'output'; // Switch to output tab
          // Scroll to bottom
          nextTick(() => {
             if (outputContainerRef.value) {
               outputContainerRef.value.scrollTop = outputContainerRef.value.scrollHeight;
             }
          });
        }
      });
      console.log(`[EditorPage] Listener registered for agent CLI output. Unsubscribe function type: ${typeof unsubscribeAgentCliOutput}`);
    } catch (error) {
      console.error('[EditorPage] Error registering onShowAgentCliOutput listener:', error);
    }
  } else {
    console.error('[EditorPage] window.electronAPI or window.electronAPI.onShowAgentCliOutput NOT found!');
  }
};

const cleanupIPCListeners = () => {
  console.log('Cleaning up IPC listeners...');
  if (unsubscribeBoardSelected) unsubscribeBoardSelected();
  if (unsubscribePortSelected) unsubscribePortSelected();
  if (unsubscribeAgentCliOutput) unsubscribeAgentCliOutput();
};

function handleBack() {
  // Use router to go back to home
  window.$router ? window.$router.push('/home') : window.history.back()
}

async function openProject(project) {
  // If only ino is provided, derive dir
  let dir = project.dir;
  if (!dir && project.ino) {
    dir = project.ino.substring(0, project.ino.lastIndexOf('/'));
  }
  currentProject.value = { ...project, dir };
  currentInoPath.value = project.ino;
  // Reset version-related states
  versions.value = [];
  versionsError.value = null;
  versionsLoading.value = false;
  
  // Load .ino file
  if (window.electronAPI?.readFile) {
    try {
      const content = await window.electronAPI.readFile(project.ino)
      code.value = content
      originalContent.value = content
      isDirty.value = false
      // Load versions in the background
      loadVersions()
    } catch (e) {
      console.error('Error opening project:', e)
    }
  }
}

async function saveCurrentCode() {
  if (!currentInoPath.value) {
    console.log('[saveCurrentCode] currentInoPath is not set:', currentInoPath.value)
    return
  }
  console.log('[saveCurrentCode] Saving version for:', currentInoPath.value)
  if (window.electronAPI?.saveVersion) {
    const res = await window.electronAPI.saveVersion(currentInoPath.value)
    console.log('[saveCurrentCode] saveVersion result:', res)
  }
  if (window.electronAPI?.writeFile) {
    await window.electronAPI.writeFile(currentInoPath.value, code.value)
    originalContent.value = code.value
    isDirty.value = false
    await loadVersions()
  }
}

function handleCodeChange(newValue) {
  code.value = newValue
  isDirty.value = newValue !== originalContent.value
}

function restoreBoardPortFromLocalStorage() {
  console.log('[EditorPage] Attempting to restore board/port from localStorage...');
  const savedBoard = localStorage.getItem(LOCALSTORAGE_BOARD_KEY);
  const savedPort = localStorage.getItem(LOCALSTORAGE_PORT_KEY);
  console.log(`[EditorPage] Found in localStorage: Board=${savedBoard}, Port=${savedPort}`);
  
  // Check if the saved board exists in the populated list
  if (savedBoard && boards.value.some(b => b.value === savedBoard)) {
    console.log(`[EditorPage] Restoring board: ${savedBoard}`);
    selectedBoard.value = savedBoard;
  } else if (savedBoard) {
    console.warn(`[EditorPage] Saved board ${savedBoard} not found in current board list.`);
  } else if (boards.value.length > 0) {
      // Default to first board if nothing saved/restored
      // selectedBoard.value = boards.value[0].value;
      // console.log(`[EditorPage] No saved board, defaulting to first: ${selectedBoard.value}`);
       console.log(`[EditorPage] No saved board found.`);
  }

  // Check if the saved port exists in the populated list
  if (savedPort && ports.value.some(p => p.value === savedPort)) {
    console.log(`[EditorPage] Restoring port: ${savedPort}`);
    selectedPort.value = savedPort;
  } else if (savedPort) {
    console.warn(`[EditorPage] Saved port ${savedPort} not found in current port list.`);
  } else if (ports.value.length > 0) {
    // Default to first port if nothing saved/restored
    // selectedPort.value = ports.value[0].value;
    // console.log(`[EditorPage] No saved port, defaulting to first: ${selectedPort.value}`);
    console.log(`[EditorPage] No saved port found.`);
  }
}

watch(selectedBoard, async (newBaseFqbn, oldBaseFqbn) => {
  // Only proceed if the FQBN actually changed
  if (newBaseFqbn === oldBaseFqbn || !newBaseFqbn) {
    console.log(`[selectedBoard watcher] FQBN unchanged or null (${newBaseFqbn}), skipping option fetch/update.`);
    return;
  }
  
  console.log(`Watcher triggered for selectedBoard (Base FQBN changed): ${oldBaseFqbn} -> ${newBaseFqbn}`);
  localStorage.setItem(LOCALSTORAGE_BOARD_KEY, newBaseFqbn || '');

  // Clear UI options first
  boardConfigOptions.value = {};
  
  // Fetch options for the new board
  if (window.electronAPI?.getBoardOptions) {
    try {
      console.log(`[EditorPage] Fetching options for board: ${newBaseFqbn}`);
      const res = await window.electronAPI.getBoardOptions(newBaseFqbn);
      console.log(`[EditorPage] getBoardOptions response for ${newBaseFqbn}:`, res);
      if (res.success && res.options && Object.keys(res.options).length > 0) {
        // Set available options first
        boardConfigOptions.value = res.options;
        
        // Load saved options for this board AFTER board options are loaded
        const savedOptions = loadSavedBoardOptions(newBaseFqbn);
        console.log(`[EditorPage] Loaded saved options for ${newBaseFqbn}:`, savedOptions);
        
        // For each option, use saved value or default
        const newSelectedOptions = {};
        for (const key in res.options) {
          if (res.options[key] && res.options[key].length > 0) {
            // Map of valid values for this option
            const validValues = res.options[key].map(opt => opt.value);
            
            // Check if we have a saved value that's still valid
            if (savedOptions[key] && validValues.includes(savedOptions[key])) {
              newSelectedOptions[key] = savedOptions[key];
              console.log(`[EditorPage] Using saved option for ${key}: ${savedOptions[key]}`);
            } else {
              // Fall back to default (first value)
              newSelectedOptions[key] = res.options[key][0].value;
              console.log(`[EditorPage] Using default option for ${key}: ${newSelectedOptions[key]}`);
            }
          }
        }
        
        // Set all options at once to prevent multiple watch triggers
        selectedBoardOptions.value = newSelectedOptions;
        console.log('[EditorPage] Set final board options:', newSelectedOptions);
        
        // Notify main process with a small delay to ensure Vue has updated
        setTimeout(() => {
          if (window.electronAPI?.setSelectedBoardOptions) {
            console.log('[selectedBoard watcher] Notifying main process of options.');
            const plainOptionsToSend = JSON.parse(JSON.stringify(selectedBoardOptions.value || {}));
            window.electronAPI.setSelectedBoardOptions(plainOptionsToSend);
          }
        }, 100);
      } else {
        console.log(`[EditorPage] No configurable options found for ${newBaseFqbn} or failed to fetch.`);
        // Clear selected options
        selectedBoardOptions.value = {};
      }
    } catch (error) {
      console.error(`[EditorPage] Error fetching board options for ${newBaseFqbn}:`, error);
      // Clear selected options on error
      selectedBoardOptions.value = {};
    }
  }

  // Notify main process about the base board change
  if (window.electronAPI?.setSelectedBoard) {
    console.log('[selectedBoard watcher] Notifying main process of base board change.');
    window.electronAPI.setSelectedBoard(newBaseFqbn);
  }
}, { immediate: false });

watch(selectedPort, (newVal) => {
  console.log(`Watcher triggered for selectedPort: ${newVal}`);
  localStorage.setItem(LOCALSTORAGE_PORT_KEY, newVal || '');
   // Notify main process (ensure no loops if triggered by agent)
  if (window.electronAPI && typeof window.electronAPI.setSelectedPort === 'function') {
    window.electronAPI.setSelectedPort(newVal);
  }
});

// Change the watcher to avoid triggering during initial board load
watch(selectedBoardOptions, (newOptions, oldOptions) => {
  // Skip the watcher during initial setup
  if (!selectedBoard.value || !Object.keys(boardConfigOptions.value).length) {
    console.log('[selectedBoardOptions watcher] Skipping during initial setup');
    return;
  }
  
  // Check if this is actually a user change (has different values)
  const newJson = JSON.stringify(newOptions);
  const oldJson = JSON.stringify(oldOptions);
  if (newJson === oldJson) {
    console.log('[selectedBoardOptions watcher] No actual change, skipping');
    return;
  }
  
  console.log(`[selectedBoardOptions watcher] Saving options for board ${selectedBoard.value}`);
  saveBoardOptions(selectedBoard.value, newOptions);
  
  // Notify main process of options change
  if (window.electronAPI?.setSelectedBoardOptions) {
    const plainOptionsToSend = JSON.parse(JSON.stringify(newOptions || {}));
    window.electronAPI.setSelectedBoardOptions(plainOptionsToSend);
  }
}, { deep: true });

async function refreshPorts() {
  if (isRefreshingPorts.value) return;
  console.log('[Frontend] Refreshing ports...');
  isRefreshingPorts.value = true;
  let currentSelection = selectedPort.value; // Store current selection
  try {
    if (window.electronAPI?.listSerialPorts) {
        const res = await window.electronAPI.listSerialPorts();
        console.log('[Frontend] listSerialPorts response (refresh):', res);
        let newPorts = [];
        if (res.success && Array.isArray(res.ports)) {
            newPorts = res.ports.map(p => ({
                value: p.path,
                label: p.friendlyName || p.path
            }));
        } else {
            console.error('[Frontend] Failed to refresh serial ports:', res);
        }
        ports.value = newPorts; // Update the ports list

        // Check if the previously selected port is still valid
        if (currentSelection && !ports.value.some(p => p.value === currentSelection)) {
            console.log(`[Frontend] Previously selected port ${currentSelection} no longer available after refresh. Resetting.`);
            selectedPort.value = null; // Reset selection if invalid
        } else if (currentSelection && ports.value.some(p => p.value === currentSelection)) {
             // If the selection is still valid, ensure it remains selected
             // This might be needed if the v-model update timing is off after list change
             selectedPort.value = currentSelection; 
        }
    } else {
        console.error('[Frontend] listSerialPorts not available in electronAPI');
        ports.value = []; // Clear ports if API is not available
        selectedPort.value = null; // Reset selection
    }
  } catch (error) {
      console.error('[Frontend] Error during port refresh:', error);
      ports.value = []; // Clear ports on error
      selectedPort.value = null; // Reset selection
  } finally {
      isRefreshingPorts.value = false;
  }
}

function handlePortDropdownToggle(isOpen) {
  if (isOpen) {
    // Call refreshPorts when the dropdown is opened
    refreshPorts();
  }
}

// Modify fetchBoardsAndPorts to use refreshPorts for initial load
async function fetchBoardsAndPorts() {
  // Fetch ports using the refresh function
  const fetchPortsPromise = refreshPorts(); // Call refreshPorts for initial load too

  // Fetch boards logic (remains the same)
  const fetchBoardsPromise = window.electronAPI?.listAllBoards()
    .then(res => {
      console.log('[Frontend] listAllBoards response:', res);
      if (res.success && res.boards) {
        const mappedBoards = res.boards.map(b => ({
          value: b.fqbn,
          label: `${b.name} (${b.fqbn})`
        }));
        console.log('[Frontend] Setting boards array with length:', mappedBoards.length);
        boards.value = mappedBoards;
      } else {
        console.error('[Frontend] Failed to get boards:', res);
        boards.value = [];
      }
    })
    .catch(err => {
       console.error('[Frontend] Error fetching boards:', err);
       boards.value = [];
    });

  // Wait for both fetches to complete before restoring
  try {
    await Promise.all([fetchPortsPromise, fetchBoardsPromise]); // Await the initial refresh too
    console.log('[Frontend] Boards and Ports initial fetches completed.');
    restoreBoardPortFromLocalStorage();
  } catch (error) {
      console.error('[Frontend] Error awaiting initial fetches:', error);
      restoreBoardPortFromLocalStorage();
  }
}

onMounted(async () => {
  console.log('[EditorPage] onMounted hook started.');
  // Log the electronAPI object *before* trying to use it
  console.log('[EditorPage] Checking window.electronAPI:', window.electronAPI);
  if (window.electronAPI) {
    console.log('[EditorPage] electronAPI keys:', Object.keys(window.electronAPI));
  }

  console.log('[Frontend] EditorPage mounted, initiating non-blocking boards/ports fetch...');
  // Fetch boards and ports *without* await
  fetchBoardsAndPorts(); 

  // Load project details if ino param exists
  const params = new URLSearchParams(window.location.search);
  const ino = params.get('ino');
  if (ino) {
    console.log('Loading file from URL param:', ino);
    try {
      const contentFromIno = await window.electronAPI.readFile(ino);
      if (contentFromIno) {
        code.value = contentFromIno;
        originalContent.value = contentFromIno;
        currentInoPath.value = ino;
        // Extract the project object from the path
        const dir = ino.substring(0, ino.lastIndexOf('/'));
        const name = dir.substring(dir.lastIndexOf('/') + 1);
        currentProject.value = {
          name,
          dir,
          ino,
          created: ''
        };
        // Set window title to "{project-name} - Embedr"
        if (window.electronAPI && typeof window.electronAPI.setWindowTitle === 'function') {
          window.electronAPI.setWindowTitle(`${name} - Embedr`);
        }
      }
    } catch (error) {
      console.error('Error loading file from URL param:', error);
    }
  }

  // Load projects
  try {
    const projects = await window.electronAPI.listProjects();
    console.log('Projects loaded:', projects.length);
    // FIX: Comment out line causing ReferenceError
    // if (Array.isArray(projects)) {
    //   recentProjects.value = projects.filter(Boolean).map(p => ({
    //     name: p.name,
    //     dir: p.dir,
    //     ino: p.ino,
    //     created: p.created
    //   }));
    // }
  } catch (error) {
    console.error('Error loading projects:', error);
  }

  window.addEventListener('keydown', handleKeyDown); // Use named function

  // Setup file change listener
  if (window.electronAPI && window.electronAPI.onFileChanged) {
    window.electronAPI.onFileChanged(async (data) => {
      console.log("[EditorPage] File changed event received:", data);
      if (data.filePath && currentInoPath.value === data.filePath) {
        console.log("[EditorPage] Reloading file content due to external change");
        try {
          const content = await window.electronAPI.readFile(data.filePath);
          if (content) {
            console.log("[EditorPage] Setting updated content from file-changed event");
            code.value = content;
            // Also update the originalContent to prevent dirty state after reload
            originalContent.value = content;
          }
        } catch (err) {
          console.error("[EditorPage] Error loading updated file:", err);
        }
      }
    });
  } else {
    console.warn("[EditorPage] electronAPI.onFileChanged not available");
  }
  
  // Setup listeners for agent selection
  setupIPCListeners();
  
  // Load code (if not already loaded)
  // await loadCode(); 

  // --- Firebase Auth Token Listener Setup (NEW) ---
  const auth = getAuth();

  // Listen for ID token changes (login, logout, refresh)
  unsubscribeTokenListener = onIdTokenChanged(auth, async (user) => {
    if (user) {
      console.log('[Renderer:EditorPage] User token changed/available.');
      await sendTokenToMain(user);
    } else {
      console.log('[Renderer:EditorPage] User logged out or token unavailable.');
      // Optionally, clear the token in main by sending null
      if (window.electronAPI?.setFirebaseAuthToken) {
        await window.electronAPI.setFirebaseAuthToken(null, null);
      }
    }
  });

  // Listen for requests from main process to provide a token
  if (window.electronAPI?.onRequestAuthToken) {
    unsubscribeRequestAuthToken = window.electronAPI.onRequestAuthToken(async () => {
      console.log('[Renderer:EditorPage] Received request-auth-token from main.');
      const currentUser = auth.currentUser;
      if (currentUser) {
        await sendTokenToMain(currentUser);
      } else {
        console.warn('[Renderer:EditorPage] Token requested by main, but no user is signed in.');
      }
    });
  }
  // --- END Firebase Auth Token Listener Setup ---
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  
  // Clear file change listener
  if (window.electronAPI && window.electronAPI.clearFileChangeListener) {
    window.electronAPI.clearFileChangeListener();
  }

  // Reset window title to "Embedr" when project is closed
  if (window.electronAPI && typeof window.electronAPI.setWindowTitle === 'function') {
    window.electronAPI.setWindowTitle('Embedr');
  }

  // --- Firebase Auth Token Listener Cleanup (NEW) ---
  if (unsubscribeTokenListener) {
    unsubscribeTokenListener();
  }
  if (unsubscribeRequestAuthToken) {
    unsubscribeRequestAuthToken();
  }
  // --- END Firebase Auth Token Listener Cleanup ---
})

// Make sure handleKeyDown is defined if used in listener
const handleKeyDown = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentCode();
    }
    // Compile shortcut: Cmd/Ctrl+R
    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      handleCompile();
    }
    // Upload shortcut: Cmd/Ctrl+U
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault();
      handleUpload();
    }
};

async function handleCompile() {
  if (compiling.value) return
  compiling.value = true
  buildOutput.value = '\nCompiling sketch...\n'
  activeTab.value = 'output'
  compileStatus.value = null
  const baseFqbn = selectedBoard.value; 
  // Create a plain copy for IPC
  const options = JSON.parse(JSON.stringify(selectedBoardOptions.value || {})); 
  const sketchPath = currentInoPath.value;

  if (!sketchPath || !baseFqbn) { // Check base FQBN
    buildOutput.value += '\nError: Please select a board and open a project.'
    compiling.value = false
    compileStatus.value = 'error'
    return
  }
  saveCurrentCode()
  try {
    // Pass baseFqbn and options separately
    const result = await window.electronAPI.compileSketch(baseFqbn, options, sketchPath)
    let combinedOutput = ''
    if (result.output) combinedOutput += result.output
    if (result.error) combinedOutput += (combinedOutput ? '\n' : '') + result.error
    // Clear previous error highlights
    if (monacoEditorRef.value && monacoEditorRef.value.setErrorLines) {
      monacoEditorRef.value.setErrorLines([])
    }
    let errorLines = []
    if (!result.success && combinedOutput) {
      // Try to extract error line numbers from GCC/Arduino error output
      // Example: /path/to/file.ino:4:3: error: ...
      const lineRegex = /\.ino:(\d+):\d+: error:/g
      let match
      while ((match = lineRegex.exec(combinedOutput)) !== null) {
        errorLines.push(Number(match[1]))
      }
      // Also match lines like 'at /path/to/file.ino:<line>'
      const atLineRegex = /at [^\n]*\.ino:(\d+)/g
      while ((match = atLineRegex.exec(combinedOutput)) !== null) {
        errorLines.push(Number(match[1]))
      }
      // Fallback: if 'FATAL:' or 'No such file or directory' is present and no line found, highlight line 1
      if (errorLines.length === 0 && /FATAL:|No such file or directory/i.test(combinedOutput)) {
        errorLines.push(1)
      }
      // Remove duplicates
      errorLines = [...new Set(errorLines)]
      if (monacoEditorRef.value && monacoEditorRef.value.setErrorLines && errorLines.length > 0) {
        monacoEditorRef.value.setErrorLines(errorLines)
      }
    }
    if (result.success) {
      buildOutput.value += '\nCompilation successful!\n'
      compileStatus.value = 'success'
      if (combinedOutput) {
        try {
          const outputJson = JSON.parse(combinedOutput)
          if (outputJson.compiler_out) {
            buildOutput.value += '\nCompiler Output:\n' + outputJson.compiler_out
          }
          if (outputJson.compiler_err) {
            buildOutput.value += '\nCompiler Errors:\n' + outputJson.compiler_err
          }
          if (outputJson.builder_result?.diagnostics?.length > 0) {
            buildOutput.value += '\nDiagnostics:\n'
            for (const diagnostic of outputJson.builder_result.diagnostics) {
              buildOutput.value += `${diagnostic.severity}: ${diagnostic.message}\n`
              if (diagnostic.file) {
                buildOutput.value += `  at ${diagnostic.file}:${diagnostic.line}\n`
              }
            }
          }
        } catch (e) {
          buildOutput.value += '\nRaw output:\n' + combinedOutput
        }
      }
    } else {
      buildOutput.value += '\nCompilation failed!\n'
      compileStatus.value = 'error'
      if (combinedOutput) {
        try {
          const errorJson = JSON.parse(combinedOutput)
          if (combinedOutput.includes('text section exceeds available space')) {
            buildOutput.value += '\nError: Sketch is too large for the selected board\'s memory.\n'
            buildOutput.value += 'Try selecting a different partition scheme with more program space.\n'
          } else if (errorJson.compiler_err) {
            buildOutput.value += '\nCompiler Errors:\n' + errorJson.compiler_err
          }
          if (errorJson.builder_result?.diagnostics?.length > 0) {
            buildOutput.value += '\nDiagnostics:\n'
            for (const diagnostic of errorJson.builder_result.diagnostics) {
              buildOutput.value += `${diagnostic.severity}: ${diagnostic.message}\n`
              if (diagnostic.file) {
                buildOutput.value += `  at ${diagnostic.file}:${diagnostic.line}\n`
              }
            }
          }
        } catch (e) {
          if (combinedOutput.includes('text section exceeds available space')) {
            buildOutput.value += '\nError: Sketch is too large for the selected board\'s memory.\n'
            buildOutput.value += 'Try selecting a different partition scheme with more program space.\n'
          } else {
            buildOutput.value += '\nError Details:\n' + combinedOutput
          }
        }
      }
    }
  } catch (e) {
    buildOutput.value += '\nUnexpected error: ' + e.message
    compileStatus.value = 'error'
  }
  compiling.value = false
}

async function handleUpload() {
  buildOutput.value += '\nUploading sketch...\n'
  activeTab.value = 'output'
  const baseFqbn = selectedBoard.value;
  // Create a plain copy for IPC
  const options = JSON.parse(JSON.stringify(selectedBoardOptions.value || {}));
  const port = selectedPort.value; 
  const sketchPath = currentInoPath.value;

  if (!sketchPath || !baseFqbn || !port) { // Check base FQBN
    buildOutput.value += '\nError: Please select a board, port, and open a project.'
    return
  }
  saveCurrentCode()
  try {
    // Pass baseFqbn and options separately
    const result = await window.electronAPI.uploadSketch(baseFqbn, options, port, sketchPath)
    if (result.success) {
      buildOutput.value += '\n' + result.output
    } else {
      buildOutput.value += '\nError: ' + result.error
    }
  } catch (e) {
    buildOutput.value += '\nUnexpected error: ' + e.message
  }
}

watch(boards, (newBoards) => {
  console.log('[Frontend] boards ref changed, new length:', newBoards.length);
}, { deep: true });

watch(selectedBoard, (newValue) => {
  console.log('[Frontend] selectedBoard changed to:', newValue);
});

async function fetchInstalledLibraries() {
  try {
    const res = await window.electronAPI.listLibraries()
    const libs = Array.isArray(res.libraries?.installed_libraries)
      ? res.libraries.installed_libraries.map(item => item.library)
      : [];
    if (res.success && libs.length > 0) {
      installedLibraries.value = libs.map(lib => ({
        name: lib.name,
        version: lib.version || 'Unknown',
        availableVersion: lib.latest || null,
        sentence: lib.paragraph || lib.sentence || ''
      }))
    } else {
      installedLibraries.value = []
    }
  } catch (e) {
    console.error('Error fetching installed libraries:', e)
    installedLibraries.value = []
  }
}

async function handleLibrarySearch() {
  if (!librarySearch.value.trim()) {
    searchResults.value = []
    return
  }
  searchLoading.value = true
  searchError.value = ''
  try {
    const res = await window.electronAPI.searchLibrary(librarySearch.value.trim())
    if (res.success && Array.isArray(res.results?.libraries)) {
      searchResults.value = res.results.libraries.map(lib => ({
        name: lib.name,
        version: lib.version || '',
        sentence: lib.sentence || '',
        author: lib.author || '',
        dependencies: lib.dependencies || []
      }))
    } else {
      searchError.value = res.error || 'Search failed.'
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
  try {
    const res = await window.electronAPI.installLibrary(lib.name)
    if (!res.success) {
      installError.value = res.error || 'Installation failed.'
    } else {
      // Check if installation was successful by looking for success message
      const output = res.output.toLowerCase()
      if (!output.includes('installed') || output.includes('error')) {
        installError.value = 'Installation failed. Please try again.'
      }
    }
    await fetchInstalledLibraries()
  } catch (e) {
    installError.value = e.message
  } finally {
    installing.value = false
  }
}

async function handleUninstallLibrary(lib) {
  uninstalling.value = lib.name
  uninstallError.value = ''
  try {
    const res = await window.electronAPI.uninstallLibrary(lib.name)
    if (!res.success) {
      uninstallError.value = res.error || 'Uninstallation failed.'
    } else {
      // Check if uninstallation was successful
      const output = res.output.toLowerCase()
      if (!output.includes('uninstalling') || output.includes('error')) {
        uninstallError.value = 'Uninstallation failed. Please try again.'
      }
    }
    await fetchInstalledLibraries()
  } catch (e) {
    uninstallError.value = e.message
  } finally {
    uninstalling.value = ''
  }
}

async function handleUpdateIndex() {
  updatingIndex.value = true
  updateError.value = ''
  try {
    const res = await window.electronAPI.updateLibraryIndex()
    if (!res.success) {
      updateError.value = res.error || 'Update failed.'
    } else {
      // Check if update was successful
      const output = res.output.toLowerCase()
      if (output.includes('error') || output.includes('failed')) {
        updateError.value = 'Index update failed. Please try again.'
      }
    }
    await fetchInstalledLibraries() // Refresh the list after update
  } catch (e) {
    updateError.value = e.message
  } finally {
    updatingIndex.value = false
  }
}

function openLibraryModal() {
  showLibraryModal.value = true
  librarySearch.value = ''
  searchResults.value = []
  fetchInstalledLibraries()
}

watch([buildOutput, activeTab], ([newOutput, newTab]) => {
  if (newTab === 'output' && outputContainerRef.value) {
    nextTick(() => {
      const el = outputContainerRef.value
      el.scrollTop = el.scrollHeight
    })
  }
})

async function loadVersions() {
  if (!currentInoPath.value) return
  
  versionsLoading.value = true
  versionsError.value = null
  
  try {
    const res = await window.electronAPI.listVersions(currentInoPath.value)
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
    code.value = res && typeof res.content === 'string' ? res.content : ''
    isDirty.value = true
    showHistoryModal.value = false
  } catch (e) {
    console.error('Error restoring version:', e)
  } finally {
    restoreLoading.value = null
  }
}

function closePreview() {
  previewVersion.value = null
}

async function handleHistoryClick() {
  showHistoryModal.value = true
  await loadVersions()
}

async function retryLoadVersions() {
  await loadVersions()
}

watch(showHistoryModal, (newValue) => {
  if (!newValue) {
    // Reset all states when modal is closed
    previewVersion.value = null
    previewLoading.value = null
    restoreLoading.value = null
    versionsError.value = null
    diffVersion.value = null
    diffLoading.value = null
    deleteLoading.value = null
  }
})

async function handleDiff(version) {
  if (diffLoading.value === version.path) return
  
  // Close preview if open
  previewVersion.value = null
  
  diffLoading.value = version.path
  try {
    const res = await window.electronAPI.readVersion(version.path)
    console.log('[handleDiff] readVersion result:', res)
    diffVersion.value = {
      ...version,
      content: res && typeof res.content === 'string' ? res.content : ''
    }
  } catch (e) {
    console.error('Error loading diff:', e)
  } finally {
    diffLoading.value = null
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
      // Close preview/diff if showing the deleted version
      if (previewVersion.value?.path === version.path) {
        previewVersion.value = null
      }
      if (diffVersion.value?.path === version.path) {
        diffVersion.value = null
      }
      // Reload versions list
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
  console.log('[formatVersionRelative] raw timestamp:', ts)
  if (!ts) return 'Invalid Date'
  // Remove .ino if present
  ts = ts.replace(/\.ino$/, '')
  // If ends with Z, remove it temporarily
  let hasZ = ts.endsWith('Z')
  if (hasZ) ts = ts.slice(0, -1)
  // Try to match the most common pattern
  let match = ts.match(/^([0-9-]+)T([0-9-]+)-([0-9]+)$/)
  let iso
  if (match) {
    // e.g. 2025-04-21T04-41-46-5677
    iso = match[1] + 'T' + match[2].replace(/-/g, ':') + '.' + match[3]
  } else {
    // fallback: replace last dash with dot in the time part
    iso = ts.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d+)$/, (m, h, m2, s, ms) => `T${h}:${m2}:${s}.${ms}`)
  }
  if (hasZ) iso += 'Z'
  console.log('[formatVersionRelative] processed timestamp:', iso)
  const d = new Date(iso)
  console.log('[formatVersionRelative] Date object:', d, 'isNaN:', isNaN(d))
  if (isNaN(d)) return 'Invalid Date'
  const now = new Date()
  const diff = (now - d) / 1000 // seconds
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}hr ago`
  if (diff < 172800) return '1 day ago'
  return d.toLocaleString('en-US', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
  })
}

watchEffect(() => {
  if (diffVersion.value) {
    console.log('[DiffViewer] oldCode:', diffVersion.value.content, typeof diffVersion.value.content)
    console.log('[DiffViewer] newCode:', code.value, typeof code.value)
  }
})

const copyBuildOutput = () => {
  navigator.clipboard.writeText(buildOutput.value)
    .then(() => {
      console.log('[EditorPage] Build output copied to clipboard');
      // Add visual feedback if desired
    })
    .catch(err => {
      console.error('[EditorPage] Failed to copy build output:', err);
    });
};

const clearBuildOutput = () => {
  buildOutput.value = '';
  compileStatus.value = null; // Also reset the status indicator
};

// --- Board Options Modal State ---
const showBoardOptionsModal = ref(false);

async function handleBoardOptionsSubmit() {
  if (selectedBoard.value) {
    console.log(`[handleBoardOptionsSubmit] Saving options for ${selectedBoard.value}:`, selectedBoardOptions.value);
    saveBoardOptions(selectedBoard.value, selectedBoardOptions.value);
  } else {
    console.warn('[handleBoardOptionsSubmit] No board selected, cannot save options');
  }
  
  if (window.electronAPI?.setSelectedBoardOptions) {
    const plainOptionsToSend = JSON.parse(JSON.stringify(selectedBoardOptions.value || {}));
    await window.electronAPI.setSelectedBoardOptions(plainOptionsToSend);
  }
}

// --- Firebase Auth Token Management (NEW) ---
let unsubscribeTokenListener = null;
let unsubscribeRequestAuthToken = null;

// Function to send token to main process
async function sendTokenToMain(user) {
  if (user && window.electronAPI?.setFirebaseAuthToken) {
    try {
      const token = await user.getIdToken();
      const claims = (await user.getIdTokenResult()).claims;
      const expiryTime = claims.exp * 1000; // Convert seconds to milliseconds
      
      console.log('[Renderer:EditorPage] Sending token to main. Expiry:', new Date(expiryTime));
      await window.electronAPI.setFirebaseAuthToken(token, expiryTime);
    } catch (error) {
      console.error('[Renderer:EditorPage] Error sending token to main:', error);
    }
  }
}
// --- END Firebase Auth Token Management ---
</script>

<style scoped>
/* Remove custom handle styles */
/* .resize-handle-vertical { ... } */
/* .resize-handle-horizontal { ... } */

/* Style the vue-resizable-panels handles minimally */
.vrp-handle-vertical {
  width: 6px;
  background-color: rgba(120, 120, 120, 0.1);
  transition: background-color 0.15s;
}
.vrp-handle-vertical:hover, .vrp-handle-vertical[data-active="true"] {
  background-color: rgba(120, 120, 120, 0.2);
}

.vrp-handle-horizontal {
  height: 6px;
  background-color: rgba(120, 120, 120, 0.1);
  transition: background-color 0.15s;
}
.vrp-handle-horizontal:hover, .vrp-handle-horizontal[data-active="true"] {
  background-color: rgba(120, 120, 120, 0.2);
}

/* Ensure flex containers within panels take up full height/width */
.vrp-panel > div {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column; /* Default, adjust if needed */
}

/* Ensure Monaco editor fills its container */
.vrp-panel .bg-\[\#1E1E1E\] {
  display: flex;
  flex: 1;
}
.vrp-panel .bg-\[\#1E1E1E\] > * { /* Target MonacoEditor component */
  flex: 1;
}

.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #3A3A3C #1C1C1E;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #1C1C1E;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #3A3A3C;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #48484A;
}
</style> 