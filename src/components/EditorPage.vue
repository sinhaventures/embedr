<template>
  <div class="fixed inset-0 flex flex-col bg-background">
    <!-- Top Bar -->
    <div class="h-16 border-b bg-card flex items-center px-6 gap-4 shadow-sm flex-shrink-0">
      <button 
        class="h-10 px-3 py-2 text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-medium transition-colors border border-border rounded-md bg-background hover:bg-accent hover:text-accent-foreground"
        @click="handleBack"
      >
        ← Back
      </button>
      <!-- Board, Port, AND Options Selection -->
      <div class="flex items-center gap-3">
        <!-- Board Select -->
        <Select v-model="selectedBoard">
          <SelectTrigger class="w-[250px] h-10 bg-background border-border">
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
          <SelectTrigger class="w-[180px] h-10 bg-background border-border">
            <SelectValue placeholder="Select Port" />
          </SelectTrigger>
          <SelectContent>
            <template v-if="ports.length > 0">
              <SelectItem v-for="port in ports" :key="port.value" :value="port.value">{{ port.label }}</SelectItem>
            </template>
            <template v-else>
              <div class="px-4 py-2 text-sm text-muted-foreground text-center">No serial ports available</div>
            </template>
          </SelectContent>
        </Select>

        <!-- Board Options Button -->
        <Button
          v-if="Object.keys(boardConfigOptions).length > 0"
          variant="outline"
          class="h-10 px-3 py-2 border-border bg-background hover:bg-accent hover:text-accent-foreground"
          @click="showBoardOptionsModal = true"
        >
          Board Options
        </Button>
      </div>
      <!-- Action Buttons -->
      <div class="ml-auto flex items-center gap-2">
        <!-- Library Manager Icon Button -->
        <Button 
          variant="outline" 
          size="icon" 
          class="h-10 w-10 relative group border-border bg-background hover:bg-accent hover:text-accent-foreground" 
          @click="openLibraryModal" 
          :aria-label="'Manage Libraries'"
          title="Manage Libraries"
        >
          <Book class="w-4 h-4" />
          <span class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">Manage Libraries</span>
        </Button>
        <Button 
          variant="outline" 
          class="h-10 px-3 py-2 border-border bg-background hover:bg-accent hover:text-accent-foreground relative group" 
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
          class="h-10 px-3 py-2 relative group"
          @click="handleUpload" 
          :disabled="compiling || uploading || !currentInoPath || !selectedBoard || !selectedPort"
          aria-label="Upload"
        >
          <span v-if="uploading" class="animate-spin mr-2 w-4 h-4 inline-block border-2 border-t-transparent border-current rounded-full"></span>
          Upload
          <span class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">
            {{ isMac ? 'Cmd' : 'Ctrl' }}+U
          </span>
        </Button>
        <Button 
          variant="secondary" 
          class="h-10 px-3 py-2 relative group"
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
          variant="outline" 
          size="icon" 
          class="h-10 w-10 relative group border-border bg-background hover:bg-accent hover:text-accent-foreground" 
          @click="handleHistoryClick" 
          :disabled="!currentInoPath || versionsLoading"
          :aria-label="'Version History'"
          title="Version History"
        >
          <div v-if="versionsLoading" class="absolute inset-0 flex items-center justify-center">
            <div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
          <History class="w-4 h-4" :class="{ 'opacity-0': versionsLoading }" />
          <span class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">Version History</span>
        </Button>
      </div>
    </div>
    <!-- Library Manager Modal -->
    <LibraryManagerModal 
      :open="showLibraryModal" 
      @update:open="showLibraryModal = $event"
    />
    <!-- Version History Modal -->
    <VersionHistoryModal 
      :open="showHistoryModal" 
      :current-ino-path="currentInoPath"
      @update:open="showHistoryModal = $event"
      @restore-version="handleRestoredVersionFromModal"
    />
    <!-- Board Options Modal -->
    <Dialog :open="showBoardOptionsModal" @update:open="showBoardOptionsModal = $event">
      <DialogContent class="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col bg-[#1E1E1E]" style="background-color: #1E1E1E !important;">
        <DialogHeader class="px-6 pt-6 pb-4 border-b border-[#333]">
          <DialogTitle class="flex items-center text-white/90">
            <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Board Configuration
          </DialogTitle>
          <DialogDescription class="text-white/60">
            Adjust configuration options for {{ selectedBoardName || 'selected board' }}
          </DialogDescription>
        </DialogHeader>
        
        <div class="flex-1 overflow-y-auto pb-2 px-6 pt-4 space-y-4 custom-scrollbar">
          <div v-if="Object.keys(boardConfigOptions).length === 0" class="py-12 text-center text-white/60">
            <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-white/20 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <h3 class="text-lg font-medium text-white/70 mb-2">No Configuration Options</h3>
            <p class="text-sm text-white/50 max-w-md mx-auto">This board uses default settings and doesn't require additional configuration.</p>
          </div>

          <div v-else class="space-y-4">
            <div v-for="(options, key) in boardConfigOptions" :key="key" class="border border-[#333] bg-[#252525] rounded-lg overflow-hidden" style="background-color: #252525 !important; border-color: #333 !important;">
              <div class="px-4 py-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex flex-col">
                    <h4 class="font-medium text-sm text-white/90">{{ getOptionLabel(key) }}</h4>
                    <span class="text-xs text-white/50 mt-0.5">{{ key }}</span>
                  </div>
                  <span class="text-xs text-white/50 bg-[#1E1E1E] px-2 py-1 rounded border border-[#333]">
                    {{ options?.length || 0 }} option{{ (options?.length || 0) !== 1 ? 's' : '' }}
                  </span>
                </div>
                <Select 
                  v-model="selectedBoardOptions[key]"
                  :disabled="!options || options.length === 0"
                >
                  <SelectTrigger class="w-full h-10 bg-[#1E1E1E] border-[#333] focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 text-white/90" style="background-color: #1E1E1E !important; border-color: #333 !important;">
                    <SelectValue :placeholder="`Select ${getOptionLabel(key)}`" />
                  </SelectTrigger>
                  <SelectContent class="bg-[#252525] border-[#333]" style="background-color: #252525 !important; border-color: #333 !important;">
                    <SelectItem 
                      v-for="option in options" 
                      :key="option.value" 
                      :value="option.value"
                      class="text-white/90 hover:bg-[#1E1E1E] focus:bg-[#1E1E1E]"
                    >
                      <div class="flex flex-col py-1">
                        <span class="text-sm font-medium leading-tight">{{ option.label }}</span>
                        <span v-if="option.value !== option.label" class="text-xs text-white/50 mt-0.5">{{ option.value }}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <!-- Info Section -->
            <div class="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg text-sm text-blue-400">
              <div class="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 16v-4"></path>
                  <path d="M12 8h.01"></path>
                </svg>
                <div class="space-y-2">
                  <p class="font-medium text-blue-300">Configuration Notes:</p>
                  <ul class="space-y-1 text-xs text-blue-400/90">
                    <li>• These settings affect compilation and upload behavior</li>
                    <li>• Changes are saved automatically and persist across sessions</li>
                    <li>• Some options may require specific hardware variants</li>
                    <li>• Incorrect settings may prevent successful uploads</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="px-6 py-4 mt-auto border-t border-[#333] flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            @click="showBoardOptionsModal = false" 
            class="h-10 px-4 py-2 border-[#444] hover:border-[#666] hover:bg-[#333] text-white/80 hover:text-white/90"
          >
            Cancel
          </Button>
          <Button 
            @click="handleBoardOptionsSubmit"
            class="h-10 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm"
          >
            Save Configuration
          </Button>
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
                :completion-invoker="invokeMonacoPilotLogic" 
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
                              <nav class="inline-flex p-0.5 bg-[#1A1A1A] rounded-lg" aria-label="Tabs" style="min-width: 220px; background-color: #1A1A1A !important;">
                <button
                  @click="activeTab = 'serial'"
                  :class="[
                    'relative flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ease-out',
                    activeTab === 'serial' 
                      ? 'active-tab bg-background text-foreground shadow-lg border border-border' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  ]"
                >
                  Serial Monitor
                </button>
                <button
                  @click="activeTab = 'output'"
                  :class="[
                    'relative flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ease-out flex items-center justify-center gap-1 ml-0.5 whitespace-nowrap',
                    activeTab === 'output' 
                      ? 'active-tab bg-background text-foreground shadow-lg border border-border' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  ]"
                >
                  Output
                </button>
              </nav>
              </div>
              <!-- Tab Content -->
              <div
                class="flex flex-col h-full bg-[#1E1E1E] text-sm min-h-0" 
                v-show="activeTab === 'output'"
              >
                <!-- Log Display Area -->
                <div 
                  class="flex-1 overflow-y-auto p-4 text-left"
                  ref="outputContainerRef" 
                >
                  <!-- Empty state -->
                  <div v-if="!buildOutput.trim()" class="h-full flex flex-col items-center justify-center text-center text-gray-400">
                    <svg class="w-12 h-12 mb-4 opacity-30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <p class="text-base">Build output will appear here</p>
                    <p class="text-sm mt-2">Click Compile or Upload to get started</p>
                  </div>
                  
                  <!-- Output content -->
                  <div v-else class="text-sm"> 
                    <!-- Status banners REMOVED from here -->
                    
                    <!-- Main output content -->
                    <div class="px-2">
                      <pre class="text-gray-300 whitespace-pre-wrap pl-2">{{ buildOutput }}</pre>
                    </div>
                  </div>
                </div>
                <!-- Bottom Button Panel -->
                <div class="flex-shrink-0 p-2 border-t border-gray-700 flex items-center justify-between gap-2 bg-[#1E1E1E]">
                  <!-- Status Tag (Left Aligned) -->
                  <div 
                    v-if="compileStatus"
                    :class="[
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium',
                      compileStatus === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                    ]"
                  >
                    <svg v-if="compileStatus === 'success'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    <svg v-if="compileStatus === 'error'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    <span>Status: {{ compileStatus === 'success' ? 'Success' : 'Error' }}</span>
                  </div>
                  <div v-else class="flex-1"></div> <!-- Spacer to push right buttons to the right -->

                  <!-- Buttons (Right Aligned) -->
                  <div class="flex items-center gap-2 ml-auto">
                    <!-- "Ask Embedr to Fix" Button (NEW) -->
                    <Button
                      v-if="compileStatus === 'error'"
                      @click="handleAskEmbedrToFixError"
                      size="sm"
                      variant="outline"
                      class="h-7 px-2 text-xs border-yellow-500/50 text-yellow-400 hover:bg-yellow-700/30 hover:text-yellow-300"
                      title="Ask Embedr to help fix this error"
                    >
                      <Sparkles class="w-3.5 h-3.5 mr-1" />
                      Fix with AI
                    </Button>
                    <Button @click="toggleAutoScroll" size="sm" variant="outline" class="h-7 px-2 text-xs">
                      {{ isAutoScrollEnabled ? 'Disable Auto-scroll' : 'Enable Auto-scroll' }}
                    </Button>
                    <Button @click="copyBuildOutput" size="sm" variant="outline" class="h-7 px-2 text-xs">Copy</Button>
                    <Button @click="clearBuildOutput" size="sm" variant="outline" class="h-7 px-2 text-xs">Clear</Button>
                  </div>
                </div>
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
        <!-- Fallback when CopilotChat is not rendered -->
        <div v-if="!currentProject || !currentProject.dir" class="h-full flex items-center justify-center p-4 text-muted-foreground bg-[#1a1a1a]">
          <div class="text-center">
            <p class="text-lg mb-2">AI Copilot</p>
            <p class="text-sm">Open a project to start chatting with the AI assistant</p>
          </div>
        </div>
        
        <CopilotChat 
          ref="copilotChatRef"
          v-if="currentProject && currentProject.dir"
          :project-path="currentProject.dir" 
          :selected-board-fqbn="selectedBoard" 
          :selected-port-path="selectedPort" 
          :thread-id="threadId"
          :homepage-query="homepageQuery"
          :homepage-image-data-url="homepageImageDataUrl"
          :homepage-selected-model="homepageSelectedModel"
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
import { Book, History, Sparkles } from 'lucide-vue-next' // Added Sparkles
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
import VersionHistoryModal from './VersionHistoryModal.vue'
import LibraryManagerModal from './LibraryManagerModal.vue'

// Firebase Auth imports (NEW)
import { getAuth } from 'firebase/auth'; // Keep getAuth, remove onIdTokenChanged

// Function to be passed as prop to MonacoEditor
function invokeMonacoPilotLogic(body) {
  if (window.electronAPI && typeof window.electronAPI.invokeMonacopilotCompletion === 'function') {
    return window.electronAPI.invokeMonacopilotCompletion(body);
  } else {
    console.error('[EditorPage] window.electronAPI.invokeMonacopilotCompletion is not available.');
    // Return a promise that resolves to an error structure compatible with what Monacopilot expects
    return Promise.resolve({ error: 'Completion service bridge not found in parent (EditorPage).' });
  }
}

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
const uploading = ref(false)
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
const copilotChatRef = ref(null); // Ref for CopilotChat component
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

const homepageSelectedModel = computed(() => {
  try {
    const pending = localStorage.getItem('embedr-pending-ai-query');
    if (pending) {
      const { selectedModel } = JSON.parse(pending);
      console.log('[EditorPage] Read selectedModel from localStorage:', selectedModel);
      return selectedModel || null;
    }
  } catch {}
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
          buildOutput.value = output; 
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

async function handleBack() {
  if (isDirty.value) {
    if (confirm("You have unsaved changes. Do you want to save them before going back?")) {
      await saveCurrentCode();
      // After saving, proceed to navigate back
      window.$router ? window.$router.push('/home') : window.history.back();
    } else {
      // User chose not to save or to stay, so do nothing
      return;
    }
  } else {
    // No unsaved changes, navigate back directly
    window.$router ? window.$router.push('/home') : window.history.back();
  }
}

async function openProject(project) {
  // If only ino is provided, derive dir
  let dir = project.dir;
  if (!dir && project.ino) {
    // Handle both Windows (\) and Unix (/) path separators
    const lastSeparatorIndex = Math.max(project.ino.lastIndexOf('/'), project.ino.lastIndexOf('\\'));
    dir = project.ino.substring(0, lastSeparatorIndex);
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

  // First, write the current editor content to the main .ino file
  if (window.electronAPI?.writeFile) {
    console.log('[saveCurrentCode] Writing current editor content to file:', currentInoPath.value);
    await window.electronAPI.writeFile(currentInoPath.value, code.value)
    originalContent.value = code.value // Update originalContent to match the new saved state
    isDirty.value = false // Mark as not dirty since it's now saved
  } else {
    console.warn('[saveCurrentCode] writeFile API not available. Cannot save editor content to disk.');
    return; // Cannot proceed to version saving if file write fails or isn't available
  }

  // Second, create a version checkpoint from the file that was just updated
  console.log('[saveCurrentCode] Saving version for:', currentInoPath.value)
  if (window.electronAPI?.saveVersion) {
    const res = await window.electronAPI.saveVersion(currentInoPath.value)
    console.log('[saveCurrentCode] saveVersion result:', res)
    // If a new version was actually created (or an existing one reused), reload the versions list
    if (res && res.success) {
      await loadVersions() // Reload versions to reflect the new checkpoint
    } else {
      console.warn('[saveCurrentCode] saveVersion was not successful or did not return a success status. Versions might not be up to date.');
    }
  } else {
    console.warn('[saveCurrentCode] saveVersion API not available. Cannot create version checkpoint.');
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

// Handle core installation/uninstallation events
function handleCoreInstalled(event) {
  console.log(`[EditorPage] Core installed: ${event.detail}, refreshing board list...`);
  fetchBoardsAndPorts();
}

function handleCoreUninstalled(event) {
  console.log(`[EditorPage] Core uninstalled: ${event.detail}, refreshing board list...`);
  fetchBoardsAndPorts();
}

function handleCoreUpgraded(event) {
  console.log(`[EditorPage] Core upgraded: ${event.detail}, refreshing board list...`);
  fetchBoardsAndPorts();
}

onMounted(async () => {
  console.log('[EditorPage] onMounted hook started.');
  // Log the electronAPI object *before* trying to use it
  console.log('[EditorPage] Checking window.electronAPI:', window.electronAPI);
  if (window.electronAPI) {
    console.log('[EditorPage] electronAPI keys:', Object.keys(window.electronAPI));
  }

  console.log('[Frontend] EditorPage mounted, initiating blocking boards/ports fetch...');
  // Fetch boards and ports *WITH* await
  await fetchBoardsAndPorts(); 

  // Load project details if ino param exists
  // const params = new URLSearchParams(window.location.search);
  // const ino = params.get('ino');
  
  // Correctly parse 'ino' from hash query parameters
  let ino = null;
  const hash = window.location.hash; // #/editor?ino=/path/to/sketch.ino
  const queryParamMatch = hash.match(/\?ino=([^&]+)/);
  if (queryParamMatch && queryParamMatch[1]) {
    ino = decodeURIComponent(queryParamMatch[1]);
  }
  
  if (ino) {
    console.log('Loading file from URL param:', ino);
    try {
      const contentFromIno = await window.electronAPI.readFile(ino);
      if (contentFromIno) {
        code.value = contentFromIno;
        originalContent.value = contentFromIno;
        currentInoPath.value = ino;
        // Extract the project object from the path
        // Handle both Windows (\) and Unix (/) path separators
        const lastSeparatorIndex = Math.max(ino.lastIndexOf('/'), ino.lastIndexOf('\\'));
        const dir = ino.substring(0, lastSeparatorIndex);
        const lastDirSeparatorIndex = Math.max(dir.lastIndexOf('/'), dir.lastIndexOf('\\'));
        const name = dir.substring(lastDirSeparatorIndex + 1);
        currentProject.value = {
          name,
          dir,
          ino,
          created: ''
        };
        console.log('[EditorPage] Set currentProject:', currentProject.value);
        console.log('[EditorPage] currentProject.dir is:', currentProject.value.dir);
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
  
  // Listen for global events that indicate boards should be refreshed
  window.addEventListener('core-installed', handleCoreInstalled);
  window.addEventListener('core-uninstalled', handleCoreUninstalled);
  window.addEventListener('core-upgraded', handleCoreUpgraded);

  // Listen for board list refresh events from main process
  if (window.electronAPI?.onRefreshBoardList) {
    window.electronAPI.onRefreshBoardList((data) => {
      console.log('[EditorPage] Received refresh-board-list event:', data);
      // Refresh board list with a slight delay to ensure core installation is complete
      setTimeout(() => {
        fetchBoardsAndPorts();
      }, 500);
    });
  }
  
  // Load code (if not already loaded)
  // await loadCode(); 

  // --- Firebase Auth Token Listener Setup (REMOVED) ---
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  
  // Clean up global event listeners
  window.removeEventListener('core-installed', handleCoreInstalled);
  window.removeEventListener('core-uninstalled', handleCoreUninstalled);
  window.removeEventListener('core-upgraded', handleCoreUpgraded);
  
  // Clear file change listener
  if (window.electronAPI && window.electronAPI.clearFileChangeListener) {
    window.electronAPI.clearFileChangeListener();
  }
  
  // Clean up board refresh listener
  if (window.electronAPI?.clearRefreshBoardListListener) {
    window.electronAPI.clearRefreshBoardListListener();
  }

  // Reset window title to "Embedr" when project is closed
  if (window.electronAPI && typeof window.electronAPI.setWindowTitle === 'function') {
    window.electronAPI.setWindowTitle('Embedr');
  }

  // --- Firebase Auth Token Listener Cleanup (REMOVED) ---
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
  if (compiling.value) return;
  compiling.value = true;
  buildOutput.value = '\nCompiling sketch...\n';
  activeTab.value = 'output';
  compileStatus.value = null;
  const baseFqbn = selectedBoard.value;
  const options = JSON.parse(JSON.stringify(selectedBoardOptions.value || {}));
  const sketchPath = currentInoPath.value;

  if (!sketchPath || !baseFqbn) {
    buildOutput.value += '\nError: Please select a board and open a project.';
    compiling.value = false;
    compileStatus.value = 'error';
    return;
  }
  await saveCurrentCode();
  try {
    const compileResult = await window.electronAPI.compileSketch(baseFqbn, options, sketchPath);
    
    // Prioritize compileResult.error for line highlighting if it indicates a direct command failure string
    // Otherwise, use compileResult.output (which is likely JSON from arduino-cli)
    const stringToParseForErrorLines = compileResult.error || compileResult.output || '';

    if (monacoEditorRef.value && monacoEditorRef.value.setErrorLines) {
      monacoEditorRef.value.setErrorLines([]);
    }

    if (!compileResult.success) {
      buildOutput.value += '\nCompilation failed!\n';
      compileStatus.value = 'error';
      let errorDisplayed = false;

      if (compileResult.output) { // This is likely the JSON output from arduino-cli
        try {
          const errorJson = JSON.parse(compileResult.output);
          if (errorJson.compiler_err && errorJson.compiler_err.trim() !== '') {
            buildOutput.value += 'Compiler Errors:\n' + errorJson.compiler_err.trim() + '\n';
            errorDisplayed = true;
          } else if (errorJson.builder_result?.diagnostics?.length > 0) {
            buildOutput.value += 'Diagnostics:\n';
            for (const diagnostic of errorJson.builder_result.diagnostics) {
              buildOutput.value += `${diagnostic.severity}: ${diagnostic.message}\n`;
              if (diagnostic.file) {
                buildOutput.value += `  at ${diagnostic.file}:${diagnostic.line}\n`;
              }
            }
            errorDisplayed = true;
          }
        } catch (e) {
          // JSON parsing failed, proceed to other fallbacks
        }
      }

      if (!errorDisplayed && compileResult.error && compileResult.error.trim() !== '') {
        // Display the direct error from exec (e.g., command failed)
        buildOutput.value += 'Error Details:\n' + compileResult.error.trim() + '\n';
        errorDisplayed = true;
      }
      
      if (!errorDisplayed && compileResult.output && compileResult.output.trim() !== '') {
        // Fallback to raw arduino-cli output if no specific error was parsed and it wasn't the exec error
        buildOutput.value += 'Error Details (raw output):\n' + compileResult.output.trim() + '\n';
        errorDisplayed = true;
      }
      
      if (!errorDisplayed) {
        buildOutput.value += 'No specific error message found. Check CLI logs if issue persists.\n';
      }

      // Error line highlighting - uses stringToParseForErrorLines
      let errorLines = [];
      if (stringToParseForErrorLines) {
        const lineRegex = /\.ino:(\d+):\d+: error:/g;
        let match;
        while ((match = lineRegex.exec(stringToParseForErrorLines)) !== null) {
          errorLines.push(Number(match[1]));
        }
        const atLineRegex = /at [^\n]*\.ino:(\d+)/g;
        while ((match = atLineRegex.exec(stringToParseForErrorLines)) !== null) {
          errorLines.push(Number(match[1]));
        }
        if (errorLines.length === 0 && /FATAL:|No such file or directory/i.test(stringToParseForErrorLines)) {
          errorLines.push(1);
        }
        errorLines = [...new Set(errorLines)];
        if (monacoEditorRef.value && monacoEditorRef.value.setErrorLines && errorLines.length > 0) {
          monacoEditorRef.value.setErrorLines(errorLines);
        }
      }
    } else {
      buildOutput.value += '\nCompilation successful!\n';
      compileStatus.value = 'success';
      if (compileResult.output) {
        try {
          const outputJson = JSON.parse(compileResult.output);
          if (outputJson.compiler_out) {
            buildOutput.value += 'Compiler Output:\n' + outputJson.compiler_out.trim() + '\n';
          }
          if (outputJson.builder_result?.diagnostics?.length > 0) {
            buildOutput.value += 'Diagnostics (Warnings):\n';
            for (const diagnostic of outputJson.builder_result.diagnostics) {
              if (diagnostic.severity !== 'ERROR') {
                buildOutput.value += `${diagnostic.severity}: ${diagnostic.message}\n`;
                if (diagnostic.file) {
                  buildOutput.value += `  at ${diagnostic.file}:${diagnostic.line}\n`;
                }
              }
            }
          }
        } catch (e) {
          buildOutput.value += 'Raw output:\n' + compileResult.output.trim() + '\n';
        }
      }
    }
  } catch (e) {
    buildOutput.value += '\nUnexpected error: ' + e.message + '\n';
    compileStatus.value = 'error';
  }
  compiling.value = false;
}

async function handleUpload() {
  if (compiling.value || uploading.value) return;
  uploading.value = true;
  activeTab.value = 'output';
  compileStatus.value = null;
  buildOutput.value = 'Starting build and upload process...\n';

  const baseFqbn = selectedBoard.value;
  const options = JSON.parse(JSON.stringify(selectedBoardOptions.value || {}));
  const port = selectedPort.value;
  const sketchPath = currentInoPath.value;

  if (!sketchPath || !baseFqbn || !port) {
    buildOutput.value += 'Error: Please select a board, port, and open a project.\n';
    compileStatus.value = 'error';
    uploading.value = false;
    return;
  }

  // Warn about potentially problematic ports
  if (port.includes('Bluetooth') || port.includes('bluetooth')) {
    buildOutput.value += 'Warning: Selected port appears to be a Bluetooth port. Please ensure you have selected the correct physical USB port for your Arduino.\n\n';
  }

  await saveCurrentCode();

  // --- Compilation Step ---
  buildOutput.value += '\nCompiling sketch...\n';
  try {
    const compileResult = await window.electronAPI.compileSketch(baseFqbn, options, sketchPath);
    const stringToParseForErrorLines = compileResult.error || compileResult.output || '';

    if (monacoEditorRef.value && monacoEditorRef.value.setErrorLines) {
      monacoEditorRef.value.setErrorLines([]);
    }

    if (!compileResult.success) {
      buildOutput.value += '\nCompilation failed!\n';
      compileStatus.value = 'error';
      let errorDisplayed = false;

      if (compileResult.output) { // This is likely the JSON output from arduino-cli
        try {
          const errorJson = JSON.parse(compileResult.output);
          if (errorJson.compiler_err && errorJson.compiler_err.trim() !== '') {
            buildOutput.value += 'Compiler Errors:\n' + errorJson.compiler_err.trim() + '\n';
            errorDisplayed = true;
          } else if (errorJson.builder_result?.diagnostics?.length > 0) {
            buildOutput.value += 'Diagnostics:\n';
            for (const diagnostic of errorJson.builder_result.diagnostics) {
              buildOutput.value += `${diagnostic.severity}: ${diagnostic.message}\n`;
              if (diagnostic.file) {
                buildOutput.value += `  at ${diagnostic.file}:${diagnostic.line}\n`;
              }
            }
            errorDisplayed = true;
          }
        } catch (e) {
          // JSON parsing failed, proceed to other fallbacks
        }
      }

      if (!errorDisplayed && compileResult.error && compileResult.error.trim() !== '') {
        buildOutput.value += 'Error Details:\n' + compileResult.error.trim() + '\n';
        errorDisplayed = true;
      }
      
      if (!errorDisplayed && compileResult.output && compileResult.output.trim() !== '') {
        buildOutput.value += 'Error Details (raw output):\n' + compileResult.output.trim() + '\n';
        errorDisplayed = true;
      }

      if (!errorDisplayed) {
        buildOutput.value += 'No specific error message found. Check CLI logs if issue persists.\n';
      }

      // Error line highlighting
      let errorLines = [];
      if (stringToParseForErrorLines) {
        const lineRegex = /\.ino:(\d+):\d+: error:/g;
        let match;
        while ((match = lineRegex.exec(stringToParseForErrorLines)) !== null) {
          errorLines.push(Number(match[1]));
        }
        const atLineRegex = /at [^\n]*\.ino:(\d+)/g;
        while ((match = atLineRegex.exec(stringToParseForErrorLines)) !== null) {
          errorLines.push(Number(match[1]));
        }
        if (errorLines.length === 0 && /FATAL:|No such file or directory/i.test(stringToParseForErrorLines)) {
          errorLines.push(1);
        }
        errorLines = [...new Set(errorLines)];
        if (monacoEditorRef.value && monacoEditorRef.value.setErrorLines && errorLines.length > 0) {
          monacoEditorRef.value.setErrorLines(errorLines);
        }
      }
      uploading.value = false;
      return;
    }

    // Compilation was successful
    buildOutput.value += '\nCompilation successful!\n';
    if (compileResult.output) {
      try {
        const outputJson = JSON.parse(compileResult.output);
        if (outputJson.compiler_out) {
          buildOutput.value += 'Compiler Output:\n' + outputJson.compiler_out.trim() + '\n';
        }
        if (outputJson.builder_result?.diagnostics?.length > 0) {
          buildOutput.value += 'Diagnostics (Warnings):\n';
            for (const diagnostic of outputJson.builder_result.diagnostics) {
              if (diagnostic.severity !== 'ERROR') {
                buildOutput.value += `${diagnostic.severity}: ${diagnostic.message}\n`;
                if (diagnostic.file) {
                  buildOutput.value += `  at ${diagnostic.file}:${diagnostic.line}\n`;
                }
              }
            }
        }
      } catch (e) {
        buildOutput.value += 'Raw output:\n' + compileResult.output.trim() + '\n';
      }
    }
    compileStatus.value = 'success';

    // --- Upload Step ---
    buildOutput.value += `\n\nAttempting to upload to ${port} using board ${fullFqbnFromParts(baseFqbn, options)}...\n`;
    
    // Add a progress indicator for long upload operations
    const uploadProgressInterval = setInterval(() => {
      if (uploading.value) {
        buildOutput.value += '.';
        // Auto-scroll to bottom if container exists
        nextTick(() => {
          if (outputContainerRef.value) {
            outputContainerRef.value.scrollTop = outputContainerRef.value.scrollHeight;
          }
        });
      }
    }, 2000); // Add a dot every 2 seconds to show it's working
    
    const uploadResult = await window.electronAPI.uploadSketch(baseFqbn, options, port, sketchPath);
    clearInterval(uploadProgressInterval);
    buildOutput.value += '\n'; // New line after progress dots

    if (uploadResult.details) {
      buildOutput.value += `\n[Uploader Command Executed]\n${uploadResult.details.trim()}\n`;
    }
    buildOutput.value += "\n[Uploader Output Log]\n";

    if (uploadResult.success) {
      if (uploadResult.output) {
        buildOutput.value += uploadResult.output;
      }
      if (uploadResult.output && (uploadResult.output.toLowerCase().includes('verify successful') || uploadResult.output.toLowerCase().includes('avrdude done.  thank you.'))) {
        buildOutput.value += '\n\nUpload successful!\n';
        compileStatus.value = 'success';
      } else if (uploadResult.output) {
        buildOutput.value += '\n\nUpload appears to have completed (check log for details).\n';
        compileStatus.value = 'success';
      } else {
        buildOutput.value += '\n\nUpload successful (no detailed log returned).\n';
        compileStatus.value = 'success';
      }
    } else {
      if (uploadResult.output) {
        buildOutput.value += uploadResult.output;
      }
      buildOutput.value += '\n\nUpload failed!\n';
      if (uploadResult.error) {
        buildOutput.value += 'Error: ' + uploadResult.error.trim() + '\n';
      }
      compileStatus.value = 'error';
    }
  } catch (e) {
    clearInterval(uploadProgressInterval); // Clean up interval on error
    buildOutput.value += '\n\nUnexpected error during operation: ' + e.message + '\n';
    compileStatus.value = 'error';
  } finally {
    uploading.value = false;
  }
}

// Helper to reconstruct FQBN for display purposes, similar to main.js but client-side
function fullFqbnFromParts(baseFqbn, options) {
  if (!baseFqbn) return '';
  let fullFqbn = baseFqbn;
  if (options && typeof options === 'object' && Object.keys(options).length > 0) {
    const optionString = Object.entries(options)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    if (optionString) {
      fullFqbn += `:${optionString}`;
    }
  }
  return fullFqbn;
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
  if (newTab === 'output' && outputContainerRef.value && isAutoScrollEnabled.value) { // Check isAutoScrollEnabled
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
    diffVersion.value = null // This will clear oldContentForDiff, newContentForDiff, and targetVersionInfo
    diffLoading.value = null
    deleteLoading.value = null
  }
})

async function handleDiff(selectedVersionToViewChangesFor, index) {
  if (diffLoading.value === selectedVersionToViewChangesFor.path) return;
  
  previewVersion.value = null; // Close preview if open
  diffLoading.value = selectedVersionToViewChangesFor.path;

  try {
    // Fetch content for the selected version (this is the "NEW" side)
    const newSideRes = await window.electronAPI.readVersion(selectedVersionToViewChangesFor.path);
    const newSideContent = newSideRes && typeof newSideRes.content === 'string' ? newSideRes.content : '';

    let oldSideContent = '';
    const previousVersionIndex = index + 1; // versions array is sorted newest first

    if (previousVersionIndex < versions.value.length) {
      // There is a previous version
      const previousVersion = versions.value[previousVersionIndex];
      console.log(`[handleDiff] Fetching previous version for old side: v${previousVersion.version} (${previousVersion.filename})`);
      const oldSideRes = await window.electronAPI.readVersion(previousVersion.path);
      oldSideContent = oldSideRes && typeof oldSideRes.content === 'string' ? oldSideRes.content : '';
      console.log(`[handleDiff] Comparing: v${previousVersion.version} (old) vs v${selectedVersionToViewChangesFor.version} (new)`);
    } else {
      // This is the oldest version (or the only version), compare it to an empty state.
      console.log(`[handleDiff] Showing oldest version v${selectedVersionToViewChangesFor.version} (${selectedVersionToViewChangesFor.filename}) as all new changes (compared to empty).`);
      oldSideContent = '';
    }

    diffVersion.value = {
      oldContentForDiff: oldSideContent,
      newContentForDiff: newSideContent,
      targetVersionInfo: selectedVersionToViewChangesFor 
    };

  } catch (e) {
    console.error('Error loading diff:', e);
    alert('Failed to load comparison. Please try again.'); // Inform user
    diffVersion.value = null; // Clear diff state on error
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

  // The timestamp 'ts' is expected to be in the format YYYY-MM-DDTHH-mm-ss-sssZ
  // as generated by `new Date().toISOString().replace(/[:.]/g, '-')` in main.js

  let isoString = ts;
  if (isoString.endsWith('Z')) {
    // Separate date, time, and millisecond parts more directly
    const parts = isoString.slice(0, -1).split('T'); // Remove Z and split Date from Time+MS
    if (parts.length === 2) {
      const datePart = parts[0]; // YYYY-MM-DD
      const timeAndMsPart = parts[1]; // HH-mm-ss-sss

      const timeMsSegments = timeAndMsPart.split('-');
      if (timeMsSegments.length === 4) { // HH, mm, ss, sss
        const HH = timeMsSegments[0];
        const mm = timeMsSegments[1];
        const ss = timeMsSegments[2];
        const sss = timeMsSegments[3];
        isoString = `${datePart}T${HH}:${mm}:${ss}.${sss}Z`;
      } else {
        // Fallback if time/ms part is not as expected, try original regex logic
        // This section retains the original regex-based parsing as a fallback
        // if the direct splitting method fails, e.g. due to an unexpected format.
        let hasZ = ts.endsWith('Z');
        let tempTs = ts;
        if (tempTs.endsWith('.ino')) tempTs = tempTs.slice(0, -'.ino'.length); // Handle if .ino was somehow passed
        if (hasZ) tempTs = tempTs.slice(0, -1);

        let match = tempTs.match(/^([0-9-]+)T([0-9-]+)-([0-9]+)$/);
        if (match) {
          isoString = match[1] + 'T' + match[2].replace(/-/g, ':') + '.' + match[3];
          if (hasZ) isoString += 'Z';
        } else {
          // If primary regex also fails, mark as invalid to avoid bad Date object
          console.warn('[formatVersionRelative] Could not parse timestamp with direct split or regex:', ts);
          isoString = 'invalid'; 
        }
      }
    } else {
       console.warn('[formatVersionRelative] Could not split timestamp into Date and Time parts:', ts);
       isoString = 'invalid'; // Mark as invalid
    }
  } else {
    // If 'Z' is not present, it's likely an unexpected format.
    // Attempt original regex logic as a last resort without Z.
    let tempTs = ts;
    if (tempTs.endsWith('.ino')) tempTs = tempTs.slice(0, -'.ino'.length);
    let match = tempTs.match(/^([0-9-]+)T([0-9-]+)-([0-9]+)$/);
    if (match) {
      isoString = match[1] + 'T' + match[2].replace(/-/g, ':') + '.' + match[3];
    } else {
      console.warn('[formatVersionRelative] Timestamp does not end with Z and regex failed:', ts);
      isoString = 'invalid';
    }
  }
  
  console.log('[formatVersionRelative] processed timestamp for Date constructor:', isoString)
  if (isoString === 'invalid') return 'Invalid Date';

  const d = new Date(isoString)
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
  
  // Close the board options dialog after saving
  showBoardOptionsModal.value = false;
}

// --- NEW: Handle asking Embedr to fix error ---
async function handleAskEmbedrToFixError() {
  if (buildOutput.value && copilotChatRef.value) {
    const errorQuery = "Fix this error: \\\\n```text\\\\n" + buildOutput.value + "\\\\n```";
    copilotChatRef.value.sendMessageFromEditor(errorQuery);
    compileStatus.value = null; // Make the button disappear and clear status
    // No need to switch activeTab, CopilotChat is in its own panel
  } else {
    console.warn('[handleAskEmbedrToFixError] buildOutput is empty or copilotChatRef is not available.');
  }
}
// --- End NEW ---

const processedBuildOutput = computed(() => {
  if (!buildOutput.value.trim()) return [];
  
  const lines = buildOutput.value.split('\n');
  const sections = [];
  let currentSection = { type: 'normal', content: '' };
  
  for (const line of lines) {
    // Headers
    if (line.includes('Compiling sketch...') || line.includes('Uploading sketch...')) {
      if (currentSection.content) sections.push(currentSection);
      currentSection = { type: 'header', content: line };
      sections.push(currentSection);
      currentSection = { type: 'normal', content: '' };
      continue;
    }
    
    // Subheaders
    if (line.includes('Compiler Output:') || line.includes('Compilation successful!') || line.includes('Upload successful!')) {
      if (currentSection.content) sections.push(currentSection);
      currentSection = { type: 'subheader', content: line };
      sections.push(currentSection);
      currentSection = { type: 'normal', content: '' };
      continue;
    }
    
    // Error messages
    if (line.includes('Error:') || line.toLowerCase().includes('failed') || line.includes('text section exceeds available space')) {
      if (currentSection.content) sections.push(currentSection);
      currentSection = { type: 'error', content: line };
      sections.push(currentSection);
      currentSection = { type: 'normal', content: '' };
      continue;
    }
    
    // Success messages
    if (line.includes('Compilation successful!') || line.includes('Upload successful!')) {
      if (currentSection.content) sections.push(currentSection);
      currentSection = { type: 'success', content: line };
      sections.push(currentSection);
      currentSection = { type: 'normal', content: '' };
      continue;
    }
    
    // Stats sections (memory usage)
    if (line.includes('bytes') && (line.includes('program storage') || line.includes('dynamic memory'))) {
      if (currentSection.content) sections.push(currentSection);
      currentSection = { type: 'stats', content: line };
      sections.push(currentSection);
      currentSection = { type: 'normal', content: '' };
      continue;
    }
    
    // Append to current section
    if (currentSection.content) {
      currentSection.content += '\n' + line;
    } else {
      currentSection.content = line;
    }
  }
  
  // Add the last section if it has content
  if (currentSection.content) sections.push(currentSection);
  
  return sections;
});

function handleRestoredVersionFromModal(newCode) {
  code.value = newCode;
  originalContent.value = newCode; // Assume restored version becomes the new 'original'
  isDirty.value = false; // Mark as not dirty initially
  // If you want to mark it as dirty to prompt a save, set isDirty.value = true
}

const isAutoScrollEnabled = ref(true);

function toggleAutoScroll() {
  isAutoScrollEnabled.value = !isAutoScrollEnabled.value;
}
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
  scrollbar-color: #333 #1E1E1E;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #1E1E1E;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #404040;
}

/* Tab styling fallbacks for older browsers */
nav[aria-label="Tabs"] button {
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
}

/* Ensure text doesn't wrap on narrow screens */
nav[aria-label="Tabs"] button {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0; /* Allow flex items to shrink */
}

/* Windows 10 and older browser fallbacks for tabs */
nav[aria-label="Tabs"] {
  background-color: #1A1A1A !important;
}

nav[aria-label="Tabs"] button {
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
nav[aria-label="Tabs"] button.active-tab {
  background-color: #1E1E1E !important;
  border-color: #333 !important;
  color: white !important;
  
  /* Fallback shadow for older browsers */
  -webkit-box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  -moz-box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Hover state with fallbacks */
nav[aria-label="Tabs"] button:hover {
  background-color: rgba(30, 30, 30, 0.5) !important;
  color: rgba(255, 255, 255, 0.8) !important;
}

/* Windows 10 and older browser fallbacks for outline buttons */
.outline-button-fallback {
  background-color: rgba(30, 30, 30, 0.8) !important;
  border: 1px solid rgba(68, 68, 68, 0.8) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

.outline-button-fallback:hover {
  background-color: rgba(51, 51, 51, 0.9) !important;
  border-color: rgba(102, 102, 102, 0.9) !important;
  color: white !important;
}

.outline-button-fallback:disabled {
  background-color: rgba(20, 20, 20, 0.5) !important;
  border-color: rgba(51, 51, 51, 0.5) !important;
  color: rgba(255, 255, 255, 0.3) !important;
  cursor: not-allowed;
}

/* Windows 10 specific adjustments */
@media screen and (-ms-high-contrast: active), (-ms-high-contrast: none) {
  nav[aria-label="Tabs"] {
    background-color: #1A1A1A !important;
  }
  
  nav[aria-label="Tabs"] button {
    background-color: transparent !important;
    border: 1px solid transparent !important;
  }
  
  nav[aria-label="Tabs"] button.active-tab {
    background-color: #1E1E1E !important;
    border-color: #333 !important;
  }
  
  nav[aria-label="Tabs"] button:hover {
    background-color: rgba(30, 30, 30, 0.5) !important;
  }
  
  /* Target outline variant buttons */
  button[class*="outline"] {
    background-color: rgba(30, 30, 30, 0.8) !important;
    border: 1px solid rgba(68, 68, 68, 0.8) !important;
    color: rgba(255, 255, 255, 0.9) !important;
  }
  
  button[class*="outline"]:hover {
    background-color: rgba(51, 51, 51, 0.9) !important;
    border-color: rgba(102, 102, 102, 0.9) !important;
    color: white !important;
  }
  
  button[class*="outline"]:disabled {
    background-color: rgba(20, 20, 20, 0.5) !important;
    border-color: rgba(51, 51, 51, 0.5) !important;
    color: rgba(255, 255, 255, 0.3) !important;
  }
}

/* Fallback for browsers that don't support CSS custom properties (var()) */
@supports not (color: var(--bg-background)) {
  button[class*="outline"] {
    background-color: rgba(30, 30, 30, 0.8) !important;
    border: 1px solid rgba(68, 68, 68, 0.8) !important;
    color: rgba(255, 255, 255, 0.9) !important;
  }
  
  button[class*="outline"]:hover {
    background-color: rgba(51, 51, 51, 0.9) !important;
    border-color: rgba(102, 102, 102, 0.9) !important;
    color: white !important;
  }
  
  button[class*="outline"]:disabled {
    background-color: rgba(20, 20, 20, 0.5) !important;
    border-color: rgba(51, 51, 51, 0.5) !important;
    color: rgba(255, 255, 255, 0.3) !important;
  }
}

/* Additional Windows 10 Chrome/Firefox fallbacks for outline buttons */
@media screen and (min-width: 0\0) {
  /* IE9+ */
  button[class*="outline"] {
    background-color: #1e1e1e !important;
    border: 1px solid #444444 !important;
    color: #e5e5e5 !important;
  }
  
  button[class*="outline"]:hover {
    background-color: #333333 !important;
    border-color: #666666 !important;
    color: white !important;
  }
}
</style> 