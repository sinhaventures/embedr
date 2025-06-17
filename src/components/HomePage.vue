<template>
  <WelcomeScreen v-if="!welcomed" @confirmed="welcomed = true" />

  <div v-else class="fixed inset-0 flex flex-col items-center bg-[#1E1E1E] text-white/90 overflow-auto">
    <div class="w-full max-w-3xl p-8 flex flex-col items-center">
      <!-- Logo and Header -->
      <div class="flex items-center gap-3 mb-12">
        <div class="w-12 h-12 bg-[#2A2A2A] rounded-lg flex items-center justify-center">
          <img src="../assets/logo-small.png" alt="Embedr Logo" class="w-8 h-8">
        </div>
        <div>
          <h1 class="text-2xl font-semibold text-left">Embedr</h1>
          <div class="flex items-center gap-2 text-sm text-white/60">
            <span :class="{ 'text-gray-400': displayedPlanName === 'Pro', 'text-gray-400': displayedPlanName === 'Free' }">{{ displayedPlanName }}</span>
            <span>•</span>
            <a href="#" @click.prevent="showSettings = true"
              class="text-red-300 hover:text-red-400 transition-colors">Settings</a>
          </div>
        </div>
      </div>

      <!-- AI Project Creation Section -->
      <div class="w-full mb-12">
        <h2
          class="text-3xl font-semibold mb-3 bg-gradient-to-r from-red-400 via-red-500 to-rose-600 text-transparent bg-clip-text">
          Hello, {{ username }}
        </h2>
        <h3 class="text-2xl text-gray-400 mb-8">What do you want to build?</h3>

        <!-- Project Description Input -->
        <div class="relative mb-6 transition-colors duration-200 ease-in-out"
          :class="{ 'bg-blue-900/10 border border-blue-500/50 rounded-2xl': isDraggingOver }"
          @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave" @drop.prevent="handleFileDrop">
          <!-- New Design - Based on screenshot -->
          <div class="flex flex-col relative">
            <!-- Input area with bottom icons -->
            <div class="bg-[#262626] rounded-2xl border border-[#444444] overflow-hidden shadow-lg flex flex-col">
              <!-- Image Preview Area -->
              <div v-if="attachedImage.dataUrl" class="flex items-center gap-2 px-3 py-2 border-b border-[#444444]">
                <img :src="attachedImage.dataUrl" :alt="attachedImage.name"
                  class="h-8 w-8 object-cover rounded-md border border-white/10 shrink-0" />
                <span class="text-xs text-muted-foreground truncate flex-1">{{ attachedImage.name }}</span>
                <button @click="removeAttachedImage"
                  class="text-xs text-red-400 hover:text-red-600 shrink-0 p-1 rounded hover:bg-red-900/20">
                  Remove
                </button>
              </div>
              <!-- Textarea Wrapper -->
              <div class="flex-grow overflow-hidden">
                <textarea v-model="aiPrompt" placeholder="Describe your Arduino project (e.g. Blink an LED)"
                  class="w-full px-4 py-3 bg-transparent border-none focus:outline-none focus:ring-0 text-base text-white/90 placeholder-gray-500 resize-none min-h-[60px] max-h-[200px]"
                  @keydown.tab.prevent="handleTabComplete" @keydown.enter="handleEnterKey" @input="autoResizeTextarea"
                  ref="promptTextarea" rows="1"></textarea>
              </div>

              <!-- Action bar -->
              <div class="flex items-center px-3 py-2 justify-between border-t border-[#444444]">
                <!-- Left side icons: Attach + Hint -->
                <div class="flex items-center gap-2">
                  <button @click="handleAttach" type="button"
                    class="text-gray-400 hover:text-white transition-colors p-1" title="Attach Image"
                    :disabled="!!attachedImage.dataUrl">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21.4 11.6L12.4 20.6C11.5 21.5 10.3 22 9 22C7.7 22 6.5 21.5 5.6 20.6C4.7 19.7 4.2 18.5 4.2 17.2C4.2 15.9 4.7 14.7 5.6 13.8L15.8 3.6C16.3 3.1 17 2.8 17.7 2.8C18.4 2.8 19.1 3.1 19.6 3.6C20.1 4.1 20.4 4.8 20.4 5.5C20.4 6.2 20.1 6.9 19.6 7.4L9.9 17.1C9.7 17.3 9.3 17.5 9 17.5C8.6 17.5 8.3 17.3 8.1 17.1C7.9 16.9 7.7 16.5 7.7 16.2C7.7 15.9 7.9 15.5 8.1 15.3L16.5 6.9"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>

                  <!-- Model Selection Dropdown -->
                  <!-- REMOVED MODEL SELECTION
                  <Select v-model="selectedModel" class="mr-2">
                    <SelectTrigger class="h-7 text-xs bg-[#1A1A1A] border-0 hover:bg-[#2e2e2e] w-[150px]">
                      <SelectValue :placeholder="selectedModel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="model in availableModels" :key="model.value" :value="model.value"
                        :disabled="model.disabled">
                        {{ model.label }}
                        <span v-if="model.value === 'gemini-2.5-flash-preview-05-20' && !isProUser"
                          class="text-xs text-green-400 ml-1">(Free)</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  -->

                  <!-- Board Selection Dropdown -->
                  <Select v-model="selectedBoard" class="ml-2">
                    <SelectTrigger class="h-7 text-xs bg-[#1A1A1A] border-0 hover:bg-[#2e2e2e] w-[180px]">
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
                      <div class="max-h-[200px] overflow-y-auto">
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
                          <div class="px-4 py-2 text-sm text-muted-foreground text-center">No boards found</div>
                        </template>
                      </div>
                    </SelectContent>
                  </Select>

                  <!-- Keyboard shortcut hint -->
                  <div class="text-xs text-gray-500 ml-2">
                    <span>Shift+Enter for new line • Enter to submit</span>
                  </div>
                </div>

                <!-- Right side icons -->
                <div class="flex gap-2">
                  <button @click="handleCreateAI" type="button"
                    class="text-gray-400 hover:text-white transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send" :disabled="!aiPrompt.trim() && !attachedImage.dataUrl">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round" />
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Hidden File Input -->
            <input type="file" ref="fileInputRef" @change="handleFileSelected" accept="image/*" class="hidden" />

            <!-- Text suggestion overlay (pointer-events-none so it doesn't interfere) -->
            <span v-if="suggestion && suggestion !== aiPrompt && suggestion.startsWith(aiPrompt)"
              class="absolute left-[16px] top-[12px] text-base text-gray-600 pointer-events-none z-10">
              <span class="opacity-0">{{ aiPrompt }}</span>{{ suggestion.substring(aiPrompt.length) }}
            </span>
          </div>
        </div>

        <!-- Suggestions -->
        <div class="flex flex-wrap gap-2 mb-4 items-center">
          <button v-for="(suggestion, idx) in showAllIdeas ? suggestions : suggestions.slice(0, 3)"
            :key="suggestion.name" @click="selectSuggestion(suggestion.prompt)"
            class="px-4 py-2 rounded-lg bg-[#1A1A1A] border border-white/10 text-sm text-gray-400 hover:bg-[#252525] transition-colors text-left max-w-xs whitespace-normal">
            {{ suggestion.name }}
          </button>
          <button v-if="suggestions.length > 3" @click="showAllIdeas = !showAllIdeas"
            class="ml-2 px-3 py-2 rounded-lg bg-[#232323] border border-white/10 text-sm text-red-300 hover:text-red-400 hover:bg-[#252525] transition-colors">
            {{ showAllIdeas ? 'Show Less' : 'More Ideas' }}
          </button>
        </div>

        <!-- Create Blank Project Button -->
        <div class="flex items-center gap-3 text-sm text-gray-400">
          <div class="flex-1 border-t border-white/10"></div>
          <button @click="showCreateModal = true"
            class="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#1A1A1A] transition-colors group">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="group-hover:text-gray-300 transition-colors">Create Blank Project</span>
          </button>
          <button @click="openCoreManagerModal"
            class="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] rounded-lg border hover:bg-[#252525] transition-colors cursor-pointer"
            :class="{ 'cursor-wait': isArduinoSetupInProgress }"
            type="button">
            <svg v-if="isArduinoSetupInProgress" class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span>{{ isArduinoSetupInProgress ? arduinoSetupStatusText : 'Manage Arduino Boards' }}</span>
          </button>
          <div class="flex-1 border-t border-white/10"></div>
        </div>
      </div>

      <!-- Recent Projects -->
      <div v-if="recentProjects.length" class="w-full"
        :class="showAllProjects ? 'max-h-[400px] overflow-y-auto projects-list-scrollable' : ''">
        <div class="flex justify-between items-center mb-4 gap-4">
          <h2 class="text-sm font-medium text-white/60">Recent projects</h2>
          <div class="flex items-center gap-3">
            <div class="relative">
              <select v-model="projectSortBy"
                class="bg-[#1A1A1A] border border-white/10 rounded-lg text-sm text-white/90 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none pr-8">
                <option value="lastOpened">Last opened</option>
                <option value="created">Recently created</option>
              </select>
              <!-- Custom dropdown arrow indicator -->
              <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                  opacity="0.5" aria-hidden="true">
                  <path d="M7 10l5 5 5-5z" fill="white" />
                </svg>
              </div>
            </div>
            <button v-if="recentProjects.length > 5" @click="showAllProjects = !showAllProjects"
              class="text-sm text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-400/30 hover:border-blue-400/50 transition-colors">
              {{ showAllProjects ? 'View less' : `View all (${recentProjects.length})` }}
            </button>
          </div>
        </div>
        <ul class="space-y-1">
          <li v-for="project in sortedProjects" :key="project.dir">
            <div
              class="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm cursor-pointer group"
              @click="() => openProject(project)">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <span class="font-medium">{{ project.name }}</span>
                <span class="text-white/40 truncate">{{ project.dir }}</span>
              </div>
              <div class="flex items-center gap-2 ml-4 shrink-0">
                <span class="text-white/40">{{ new Date(project.created).toLocaleDateString() }}</span>
                <button @click.stop="() => handleEditProject(project)" 
                  class="p-1 text-blue-300 hover:text-blue-400 rounded transition-colors"
                  title="Rename project">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click.stop="() => handleDeleteProject(project)" 
                  class="p-1 text-red-300 hover:text-red-400 rounded transition-colors"
                  title="Delete project">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m6-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Create Project Modal -->
      <div v-if="showCreateModal"
        class="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
        tabindex="-1"
        @keydown.esc="closeCreateModal">
        <div class="bg-[#2D2D2D] rounded-xl shadow-xl p-6 w-[400px]">
          <h3 class="text-lg font-semibold mb-4">Create New Project</h3>
          <div class="relative">
            <input v-model="newProjectName" placeholder="Project name"
              class="w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
              @keydown="handleCreateModalKeydown"
              ref="newProjectNameInput" 
              :disabled="isGeneratingProjectName" />
            <div v-if="isGeneratingProjectName" class="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg class="animate-spin h-4 w-4 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <Button @click="createBlankProject" 
              class="flex-1 bg-white/10 hover:bg-white/20 text-white border-none"
              :disabled="isGeneratingProjectName">
              {{ isGeneratingProjectName ? 'Generating Name...' : 'Create Project' }}
            </Button>
            <Button @click="closeCreateModal" variant="outline"
              class="flex-1 border-white/10 text-white/90 hover:bg-white/5"
              :disabled="isGeneratingProjectName">
              Cancel
            </Button>
          </div>
          <div v-if="createError" class="mt-3 text-sm text-red-400">{{ createError }}</div>
        </div>
      </div>

      <!-- Edit Project Modal -->
      <div v-if="showEditProjectModal"
        class="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
        <div class="bg-[#2D2D2D] rounded-xl shadow-xl p-6 w-[400px]">
          <h3 class="text-lg font-semibold mb-4">Rename Project</h3>
          <input v-model="editProjectName" placeholder="Project name"
            class="w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
            @keydown.enter="updateProjectName" ref="editProjectNameInput" />
          <div class="flex gap-3 mt-6">
            <Button @click="updateProjectName" class="flex-1 bg-white/10 hover:bg-white/20 text-white border-none">
              Update Name
            </Button>
            <Button @click="showEditProjectModal = false" variant="outline"
              class="flex-1 border-white/10 text-white/90 hover:bg-white/5">
              Cancel
            </Button>
          </div>
          <div v-if="editProjectError" class="mt-3 text-sm text-red-400">
            {{ editProjectError }}
            <span v-if="editProjectError.includes('not available')" class="block mt-1 text-xs text-red-300">
              Project name update is not available.
            </span>
          </div>
        </div>
      </div>

      <SettingsModal 
        :show="showSettings" 
        :initialName="user?.displayName || ''" 
        @close="showSettings = false"
        @name-updated="handleNameUpdated" 
        @logged-out="handleLogout"
        @manage-subscription="authRedirect.redirectToSubscriptionPortal" 
        :is-manage-subscription-loading="authRedirect.isLoading.value"
      />

      <!-- Board Manager Modal -->
      <CoreManagerModal 
        :show="showCoreManagerModal" 
        @close="showCoreManagerModal = false"
        @core-installed="handleCoreInstalled"
        @core-uninstalled="handleCoreUninstalled"
        @core-upgraded="handleCoreUpgraded"
      />

      <!-- Update Available Dialog -->
      <div v-if="updateDialog.show || updateDialog.minimized" 
        class="fixed bottom-4 left-4 z-50"
        :class="{ 'w-80': updateDialog.show, 'w-auto': updateDialog.minimized }">
        
        <!-- Minimized state - just the update button -->
        <div v-if="updateDialog.minimized && !updateDialog.show" 
          class="bg-gradient-to-r from-rose-600 to-red-600 rounded-lg p-2 shadow-lg border border-rose-500/50 hover:from-rose-500 hover:to-red-500 transition-all duration-200 cursor-pointer"
          @click="updateDialog.show = true">
          <div class="flex items-center gap-2 text-white text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v10l3-3m-6 0l3 3"/>
              <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9"/>
            </svg>
            <span>Update Available</span>
          </div>
        </div>

        <!-- Expanded dialog -->
        <div v-if="updateDialog.show" 
          class="bg-[#1A1A1A] rounded-lg border border-rose-500/50 shadow-xl max-w-sm">
          
          <!-- Header -->
          <div class="flex items-center justify-between p-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v10l3-3m-6 0l3 3"/>
                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9"/>
                </svg>
              </div>
              <div class="text-left">
                <h3 class="text-sm font-semibold text-white">Update Available</h3>
                <p class="text-xs text-gray-400">v{{ updateDialog.latestVersion }} is ready</p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button @click="minimizeUpdateDialog" 
                class="p-1 text-gray-400 hover:text-white rounded transition-colors" 
                title="Minimize">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 19v-3h12v3"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="p-3 space-y-3 text-left">
            <div class="text-xs text-gray-300">
              <p>A new version of Embedr is available with improvements and new features.</p>
            </div>

            <!-- Version info -->
            <div class="flex justify-between text-xs">
              <span class="text-gray-400">Current:</span>
              <span class="text-white">v{{ updateDialog.currentVersion }}</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-gray-400">Latest:</span>
              <span class="text-rose-400 font-medium">v{{ updateDialog.latestVersion }}</span>
            </div>

            <!-- Release notes preview -->
            <div v-if="updateDialog.releaseNotes" class="space-y-2">
              <h4 class="text-xs font-medium text-gray-300">What's New:</h4>
              <div class="text-xs text-gray-400 bg-[#111111] rounded p-2 max-h-20 overflow-y-auto text-left">
                <p>{{ truncatedReleaseNotes }}</p>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2 pt-2">
              <button @click="downloadUpdate" 
                class="flex-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-medium py-2 px-3 rounded transition-all duration-200">
                Download Update
              </button>
              <button @click="viewReleaseNotes" 
                class="px-3 py-2 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded transition-colors">
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import WelcomeScreen from './WelcomeScreen.vue'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import SettingsModal from './SettingsModal.vue'
import { getAuth, updateProfile } from 'firebase/auth'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import CoreManagerModal from './CoreManagerModal.vue'
import { useSubscription } from '../composables/useSubscription'
import { useAuthRedirect } from '../composables/useAuthRedirect'

const emit = defineEmits(['create-blank'])

const { user, isAuthenticated, isEmailVerified } = useAuth()
const router = useRouter()
const { subscription, isLoadingSubscription } = useSubscription()
const authRedirect = useAuthRedirect()

// Board Selection Refs
const LOCALSTORAGE_BOARD_KEY_HOME = 'embedr-selected-board';
const selectedBoard = ref(localStorage.getItem(LOCALSTORAGE_BOARD_KEY_HOME) || null);
const boards = ref([]);
const boardSearch = ref('');

const displayedPlanName = computed(() => {
  if (isLoadingSubscription.value) return '...'; // Or some loading indicator
  const planId = subscription.value?.planId;
  const status = subscription.value?.status;
  const isProPlan = planId === 'pro_monthly' || planId === 'pro_yearly' || planId === 'pro'; // Include legacy 'pro' for compatibility
  const isValidStatus = status === 'active' || status === 'authenticated'; // Based on your subscription guide
  if (isProPlan && isValidStatus) {
    return 'Pro';
  }
  return 'Free';
});

const welcomed = ref(localStorage.getItem('embedr-welcomed') === 'true')
const username = computed(() => {
  if (user.value?.displayName && user.value.displayName.trim()) {
    return user.value.displayName.trim()
  }
  // fallback to email prefix
  if (user.value?.email) {
    return user.value.email.split('@')[0]
  }
  return 'User'
})
const aiPrompt = ref('')
const promptTextarea = ref(null)
const recentProjects = ref([])
const showCreateModal = ref(false)
const showSettings = ref(false)
const showEditProjectModal = ref(false)
const editingProject = ref(null)
const editProjectName = ref('')
const editProjectError = ref('')
const newProjectName = ref('')
const createError = ref('')
const pendingAIPrompt = ref(null); // Store AI prompt object (text + image)
const showAllProjects = ref(false);
const showAllIdeas = ref(false);
const projectSortBy = ref('lastOpened')
const newProjectNameInput = ref(null)
const editProjectNameInput = ref(null)
const fileInputRef = ref(null) // Ref for hidden file input
const attachedImage = ref({ name: null, type: null, dataUrl: null }); // Ref for attached image
const isDraggingOver = ref(false); // State for drag-over visual feedback
const showCoreManagerModal = ref(false);
const isGeneratingProjectName = ref(false);
const hasGeneratedNameForCurrentSession = ref(false);

// Arduino setup status tracking
const arduinoSetupStatus = ref(null);
const isArduinoSetupInProgress = computed(() => {
  const status = arduinoSetupStatus.value?.status;
  return status === 'checking' || status === 'installing' || status === 'updating-index';
});
const arduinoSetupStatusText = computed(() => {
  const status = arduinoSetupStatus.value?.status;
  switch (status) {
    case 'checking':
      return 'Checking boards...';
    case 'installing':
      return 'Setting up boards...';
    case 'updating-index':
      return 'Updating boards...';
    case 'completed':
      return 'Boards ready';
    case 'already-installed':
      return 'Boards ready';
    case 'error':
      return 'Board setup failed';
    case 'skipped':
      return 'Board setup skipped';
    default:
      return 'Setting up boards...';
  }
});

const isProUser = computed(() => {
  const planId = subscription.value?.planId;
  const status = subscription.value?.status;
  const isProPlan = planId === 'pro_monthly' || planId === 'pro_yearly' || planId === 'pro'; // Include legacy 'pro' for compatibility
  const isValidStatus = status === 'active' || status === 'authenticated'; // Based on your subscription guide
  return isProPlan && isValidStatus;
});

// Update Dialog State
const updateDialog = ref({
  show: false,
  minimized: false,
  currentVersion: '',
  latestVersion: '',
  releaseNotes: '',
  releaseUrl: '',
  downloadUrl: ''
});

// Computed property for truncated release notes
const truncatedReleaseNotes = computed(() => {
  const notes = updateDialog.value.releaseNotes;
  if (!notes) return '';
  
  // Remove markdown formatting and truncate
  const plainText = notes
    .replace(/[#*`]/g, '') // Remove basic markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to plain text
    .trim();
  
  if (plainText.length <= 150) return plainText;
  return plainText.substring(0, 147) + '...';
});

// Helper function to extract Board Name from the combined label (copied from EditorPage)
function getBoardNameFromLabel(label) {
  if (!label) return '';
  // Matches text up to the last opening parenthesis, trimming whitespace
  const match = label.match(/^(.*?)\s+\(/);
  return match ? match[1].trim() : label; // Fallback to full label if format unknown
}

const selectedBoardName = computed(() => {
  if (!selectedBoard.value || !boards.value.length) return null;
  const board = boards.value.find(b => b.value === selectedBoard.value);
  return board ? getBoardNameFromLabel(board.label) : null;
});

const filteredBoards = computed(() => {
  if (!boardSearch.value) return boards.value;
  const search = boardSearch.value.toLowerCase();
  return boards.value.filter(board =>
    board.label.toLowerCase().includes(search)
  );
});

async function fetchBoards() {
  if (window.electronAPI?.listAllBoards) {
    try {
      const res = await window.electronAPI.listAllBoards();
      if (res.success && res.boards) {
        boards.value = res.boards.map(b => ({
          value: b.fqbn,
          label: `${b.name} (${b.fqbn})`
        }));
        // Restore selection if valid
        const savedBoard = localStorage.getItem(LOCALSTORAGE_BOARD_KEY_HOME);
        if (savedBoard && boards.value.some(b => b.value === savedBoard)) {
          selectedBoard.value = savedBoard;
        } else if (boards.value.length > 0 && !selectedBoard.value) {
          // Optionally default to the first board if no valid selection
          // selectedBoard.value = boards.value[0].value;
        }
        
        // If boards are loaded successfully and Arduino setup is complete, clear the status
        // to prevent the "Boards ready" text from persisting indefinitely
        if (boards.value.length > 0 && 
            arduinoSetupStatus.value && 
            (arduinoSetupStatus.value.status === 'completed' || arduinoSetupStatus.value.status === 'already-installed')) {
          setTimeout(() => {
            arduinoSetupStatus.value = null;
          }, 2000); // Clear after 2 seconds to give user time to see "Boards ready"
        }
      } else {
        console.error('[HomePage] Failed to get boards:', res);
      }
    } catch (error) {
      console.error('[HomePage] Error fetching boards:', error);
    }
  } else {
    console.warn('[HomePage] listAllBoards API not available');
  }
}

// Watch for selected board changes to save to localStorage
watch(selectedBoard, (newValue) => {
  localStorage.setItem(LOCALSTORAGE_BOARD_KEY_HOME, newValue || '');
});

// Function to open core manager modal
function openCoreManagerModal() {
  console.log('[HomePage] Opening Core Manager Modal...', showCoreManagerModal.value);
  showCoreManagerModal.value = true;
  console.log('[HomePage] Core Manager Modal opened:', showCoreManagerModal.value);
}

// Handle core installation/uninstallation events from CoreManagerModal
function handleCoreInstalled(platformId) {
  console.log(`[HomePage] Core installed: ${platformId}, refreshing board list...`);
  // Refresh board list after a short delay to ensure core is fully installed
  setTimeout(() => {
    fetchBoards();
  }, 1000);
  // Dispatch global event to notify other components
  window.dispatchEvent(new CustomEvent('core-installed', { detail: platformId }));
}

function handleCoreUninstalled(platformId) {
  console.log(`[HomePage] Core uninstalled: ${platformId}, refreshing board list...`);
  // Refresh board list after a short delay
  setTimeout(() => {
    fetchBoards();
  }, 1000);
  // Dispatch global event to notify other components
  window.dispatchEvent(new CustomEvent('core-uninstalled', { detail: platformId }));
}

function handleCoreUpgraded(platformId) {
  console.log(`[HomePage] Core upgraded: ${platformId}, refreshing board list...`);
  // Refresh board list after a short delay
  setTimeout(() => {
    fetchBoards();
  }, 1000);
  // Dispatch global event to notify other components
  window.dispatchEvent(new CustomEvent('core-upgraded', { detail: platformId }));
}

// === Update Checking Functions ===

async function checkForUpdates() {
  console.log('[HomePage] Checking for app updates...');
  
  try {
    if (window.electronAPI?.checkAppUpdate) {
      const result = await window.electronAPI.checkAppUpdate();
      console.log('[HomePage] Update check result:', result);
      
      if (result.success && result.updateAvailable) {
        // Check if this version was previously minimized
        const storedUpdateData = localStorage.getItem('embedr-minimized-update-data');
        let shouldShowMinimized = false;
        
        if (storedUpdateData) {
          try {
            const updateData = JSON.parse(storedUpdateData);
            shouldShowMinimized = updateData.latestVersion === result.latestVersion;
          } catch (error) {
            console.error('[HomePage] Error parsing stored update data:', error);
            localStorage.removeItem('embedr-minimized-update-data');
          }
        }
        
        updateDialog.value = {
          ...updateDialog.value,
          show: !shouldShowMinimized, // Show full dialog only if not previously minimized
          minimized: shouldShowMinimized, // Minimize if it was minimized before
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          releaseNotes: result.releaseNotes,
          releaseUrl: result.releaseUrl,
          downloadUrl: result.downloadUrl
        };
        
        if (shouldShowMinimized) {
          console.log('[HomePage] Update dialog minimized for previously seen version:', result.latestVersion);
        } else {
          console.log('[HomePage] Update dialog shown for new version:', result.latestVersion);
        }
      } else if (result.success) {
        console.log('[HomePage] No update available');
        // Clear any stored minimized version if we're up to date
        localStorage.removeItem('embedr-minimized-update-data');
      } else {
        console.warn('[HomePage] Update check failed:', result.error);
      }
    } else {
      console.warn('[HomePage] checkAppUpdate API not available');
    }
  } catch (error) {
    console.error('[HomePage] Error checking for updates:', error);
  }
}

function minimizeUpdateDialog() {
  // Store the complete update data in localStorage
  const updateData = {
    latestVersion: updateDialog.value.latestVersion,
    currentVersion: updateDialog.value.currentVersion,
    releaseNotes: updateDialog.value.releaseNotes,
    releaseUrl: updateDialog.value.releaseUrl,
    downloadUrl: updateDialog.value.downloadUrl
  };
  
  localStorage.setItem('embedr-minimized-update-data', JSON.stringify(updateData));
  
  updateDialog.value.show = false;
  updateDialog.value.minimized = true;
  
  console.log('[HomePage] Update dialog minimized and complete data saved for version:', updateDialog.value.latestVersion);
}

async function downloadUpdate() {
  console.log('[HomePage] Opening download URL:', updateDialog.value.downloadUrl);
  
  try {
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(updateDialog.value.downloadUrl);
    } else {
      // Fallback to window.open
      window.open(updateDialog.value.downloadUrl, '_blank');
    }
  } catch (error) {
    console.error('[HomePage] Error opening download URL:', error);
  }
}

async function viewReleaseNotes() {
  console.log('[HomePage] Opening release notes URL:', updateDialog.value.releaseUrl);
  
  try {
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(updateDialog.value.releaseUrl);
    } else {
      // Fallback to window.open
      window.open(updateDialog.value.releaseUrl, '_blank');
    }
  } catch (error) {
    console.error('[HomePage] Error opening release notes URL:', error);
  }
}

// === End Update Checking Functions ===

// Global app initialization - should only run once when app starts
function initializeApp() {
  console.log('[HomePage] Initializing app...');
  
  // Check if app has already been initialized in this session
  if (window.embedrAppInitialized) {
    console.log('[HomePage] App already initialized, skipping...');
    
    // Still restore minimized update dialog if it exists
    const storedUpdateData = localStorage.getItem('embedr-minimized-update-data');
    if (storedUpdateData) {
      try {
        const updateData = JSON.parse(storedUpdateData);
        updateDialog.value = {
          show: false,
          minimized: true,
          currentVersion: updateData.currentVersion,
          latestVersion: updateData.latestVersion,
          releaseNotes: updateData.releaseNotes,
          releaseUrl: updateData.releaseUrl,
          downloadUrl: updateData.downloadUrl
        };
      } catch (error) {
        console.error('[HomePage] Error parsing stored update data:', error);
        localStorage.removeItem('embedr-minimized-update-data');
      }
    }
    return;
  }
  
  // Mark app as initialized
  window.embedrAppInitialized = true;
  
  // Check for updates after a short delay to avoid blocking initial UI
  setTimeout(() => {
    checkForUpdates();
  }, 2000);
}

// Function to auto-resize textarea based on content
function autoResizeTextarea() {
  const textarea = promptTextarea.value;
  if (!textarea) return;

  // Reset height to auto to get the correct scrollHeight
  textarea.style.height = 'auto';

  // Set the height based on scrollHeight (with a small buffer)
  const newHeight = Math.min(textarea.scrollHeight, 200); // Max height constraint
  textarea.style.height = `${newHeight}px`;
}

// Predefined suggestions with short name and detailed prompt
const suggestions = [
  {
    name: 'Weather Station',
    prompt: 'Build a weather station that displays temperature and humidity on an LCD screen using a temperature and humidity sensor.'
  },
  {
    name: 'Smart Plant Watering',
    prompt: 'Create a smart plant watering system that automatically waters a plant when soil moisture is low, with notifications.'
  },
  {
    name: 'Home Security System',
    prompt: 'Design a home security system with a motion sensor, buzzer alarm, and notifications.'
  },
  {
    name: 'Bluetooth Robot Car',
    prompt: 'Develop a Bluetooth-controlled robot car with motor control.'
  },
  {
    name: 'Digital Thermometer',
    prompt: 'Make a digital thermometer with a temperature sensor and display the temperature on a 7-segment display.'
  },
  {
    name: 'RFID Door Lock',
    prompt: 'Implement a simple RFID-based door lock system with access control.'
  },
  {
    name: 'Sound-Activated LED Show',
    prompt: 'Build a sound-activated LED light show using a microphone sensor and addressable RGB LEDs.'
  },
  {
    name: 'Data Logger',
    prompt: 'Create a data logger that records sensor data to an SD card.'
  },
  {
    name: 'Remote IoT Monitor',
    prompt: 'Construct a remote monitoring station that uploads sensor data to the cloud via WiFi.'
  }
]

// Dynamic suggestion based on input
const suggestion = computed(() => {
  if (!aiPrompt.value) return ''
  return suggestions.find(s =>
    s.prompt.toLowerCase().startsWith(aiPrompt.value.toLowerCase()) &&
    s.prompt.toLowerCase() !== aiPrompt.value.toLowerCase()
  )?.prompt || ''
})

function handleTabComplete() {
  if (suggestion.value) {
    aiPrompt.value = suggestion.value
  }
}

function handleEnterKey(event) {
  // If Shift+Enter, allow new line
  if (event.shiftKey) {
    // Allow default behavior (new line)
    return;
  }

  // For regular Enter, prevent default and handle submission
  event.preventDefault();
  handleCreateAI();
}

function handleCreateAI() {
  const textPrompt = aiPrompt.value.trim();
  const imageData = attachedImage.value.dataUrl;

  // Require either text or an image
  if (!textPrompt && !imageData) return;

  // Store the prompt data for later use
  pendingAIPrompt.value = {
    prompt: textPrompt,
    imageDataUrl: imageData
  };
  console.log('[HomePage] Stored pendingAIPrompt:', JSON.stringify(pendingAIPrompt.value));

  // Reset session flag and show the modal immediately
  hasGeneratedNameForCurrentSession.value = false;
  newProjectName.value = ''; // Start with empty name
  showCreateModal.value = true;
  
  // Generate project name in background only once per session
  generateProjectName(textPrompt, imageData);
}

// Generate project name using AI
async function generateProjectName(prompt, imageDataUrl) {
  if (!prompt && !imageDataUrl) return;
  
  // Only generate once per modal session
  if (hasGeneratedNameForCurrentSession.value || isGeneratingProjectName.value) {
    console.log('[HomePage] Name already generated for this session or currently generating, skipping...');
    return;
  }
  
  try {
    // Set flags immediately to prevent duplicate calls
    hasGeneratedNameForCurrentSession.value = true;
    isGeneratingProjectName.value = true;
    console.log('[HomePage] Generating project name...');
    
    // Extract text from prompt for name generation
    let promptText = prompt || '';
    if (imageDataUrl) {
      promptText = promptText || 'Project with attached image';
    }
    
    const result = await window.electronAPI.invokeFirebaseFunction('generateProjectName', {
      prompt: promptText.substring(0, 200), // Limit length for API efficiency
      context: 'Arduino project creation'
    });
    
    if (result.success && result.data && result.data.projectName) {
      let generatedName = result.data.projectName;
      console.log('[HomePage] Generated project name:', generatedName);
      
      // Ensure name follows rules: no spaces, special characters, uppercase
      generatedName = generatedName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      // Ensure it's not empty and has a reasonable length
      if (!generatedName || generatedName.length < 3) {
        generatedName = 'arduino_project';
      }
      
      // Only set the name if we haven't closed the modal in the meantime
      if (showCreateModal.value) {
        newProjectName.value = generatedName;
        
        // Auto-focus and select the generated name after a short delay
        nextTick(() => {
          setTimeout(() => {
            if (newProjectNameInput.value && showCreateModal.value) {
              newProjectNameInput.value.focus();
              newProjectNameInput.value.select();
            }
          }, 100);
        });
      }
    } else {
      console.warn('[HomePage] Failed to generate project name:', result.error || 'Unknown error');
      // Leave blank on error as requested
      if (showCreateModal.value) {
        newProjectName.value = '';
      }
    }
  } catch (error) {
    console.error('[HomePage] Error generating project name:', error);
    // Leave blank on error as requested
    if (showCreateModal.value) {
      newProjectName.value = '';
    }
  } finally {
    isGeneratingProjectName.value = false;
  }
}

function openProject(project) {
  if (!project) return
  console.log('Opening project:', project)
  // Update last opened time before navigating
  if (window.electronAPI?.updateProjectLastOpened) {
    window.electronAPI.updateProjectLastOpened(project.dir)
      .then(res => {
        if (!res.success) console.warn('Failed to update last opened time:', res.error);
      })
      .catch(err => console.error('Error calling updateProjectLastOpened:', err));
  }
  router.push({ path: '/editor', query: { ino: project.ino || `${project.dir}/sketch.ino` } })
}

async function loadProjects() {
  try {
    if (window.electronAPI?.listProjects) {
      console.log('Fetching projects...')
      const projects = await window.electronAPI.listProjects()
      console.log('Fetched projects:', projects)
      recentProjects.value = projects || []
    } else {
      console.warn('listProjects API not available')
    }
  } catch (error) {
    console.error('Error loading projects:', error)
  }
}

function closeCreateModal() {
  showCreateModal.value = false;
  newProjectName.value = '';
  createError.value = '';
  hasGeneratedNameForCurrentSession.value = false;
  pendingAIPrompt.value = null;
}

function handleCreateModalKeydown(event) {
  // Prevent any action if currently generating a name
  if (isGeneratingProjectName.value) {
    event.preventDefault();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    createBlankProject();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeCreateModal();
  }
}

async function createBlankProject() {
  // Prevent creation if currently generating a name
  if (isGeneratingProjectName.value) {
    console.log('[HomePage] Cannot create project while generating name');
    return;
  }

  createError.value = ''
  if (!newProjectName.value.trim()) {
    createError.value = 'Project name is required.'
    return
  }

  try {
    if (window.electronAPI?.createProject) {
      console.log('Creating project:', newProjectName.value)
      const res = await window.electronAPI.createProject(newProjectName.value.trim())
      console.log('Create project response:', res)

      if (res.success) {
        // Clean up state immediately to prevent any interference
        const pendingPrompt = pendingAIPrompt.value;
        const selectedBoardValue = selectedBoard.value;
        
        showCreateModal.value = false
        newProjectName.value = ''
        hasGeneratedNameForCurrentSession.value = false;
        isGeneratingProjectName.value = false; // Ensure generation flag is reset
        
        await loadProjects()
        if (res.project) {
          if (pendingPrompt) {
            const threadId = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);
            const dataToStore = {
              prompt: pendingPrompt.prompt,
              imageDataUrl: pendingPrompt.imageDataUrl,
              threadId,
              projectDir: res.project.dir,
              selectedModel: 'gemini-2.5-flash-preview-05-20', // Store the selected model - NOW HARDCODED
              selectedBoard: selectedBoardValue // Store the selected board
            };
            console.log('[HomePage] Saving to localStorage:', JSON.stringify(dataToStore)); // Log what's being saved
            localStorage.setItem('embedr-pending-ai-query', JSON.stringify(dataToStore));
            router.push({ path: '/editor', query: { ino: res.project.ino || `${res.project.dir}/sketch.ino`, threadId } });
            pendingAIPrompt.value = null;
            return;
          }
          router.push({ path: '/editor', query: { ino: res.project.ino || `${res.project.dir}/sketch.ino` } })
        }
      } else {
        createError.value = res.error || 'Failed to create project.'
      }
    } else {
      console.warn('createProject API not available')
      createError.value = 'Project creation is not available.'
    }
  } catch (error) {
    console.error('Error creating project:', error)
    createError.value = error.message || 'An unexpected error occurred.'
  }
}

async function handleNameUpdated(newName) {
  // Force reload of user from Firebase to update UI
  const auth = getAuth()
  await auth.currentUser.reload()
  user.value = { ...auth.currentUser } // update the ref so Vue reactivity triggers
  showSettings.value = false
}

function handleLogout() {
  showSettings.value = false
  router.push('/auth')
}

async function handleDeleteProject(project) {
  if (!project) return;
  const confirmed = window.confirm(`Are you sure you want to delete the project '${project.name}'? This action cannot be undone.`);
  if (!confirmed) return;
  try {
    if (window.electronAPI?.deleteProject) {
      const res = await window.electronAPI.deleteProject(project.dir);
      if (res.success) {
        await loadProjects();
      } else {
        alert(res.error || 'Failed to delete project.');
      }
    } else {
      alert('Project deletion is not available.');
    }
  } catch (error) {
    alert(error.message || 'An unexpected error occurred while deleting the project.');
  }
}

function handleEditProject(project) {
  editingProject.value = project;
  editProjectName.value = project.name;
  editProjectError.value = '';
  showEditProjectModal.value = true;
}

async function updateProjectName() {
  editProjectError.value = '';
  if (!editProjectName.value.trim()) {
    editProjectError.value = 'Project name is required.';
    return;
  }

  try {
    if (window.electronAPI?.updateProjectName) {
      const res = await window.electronAPI.updateProjectName(
        editingProject.value.dir, 
        editProjectName.value.trim()
      );
      
      if (res.success) {
        showEditProjectModal.value = false;
        editingProject.value = null;
        editProjectName.value = '';
        await loadProjects();
      } else {
        editProjectError.value = res.error || 'Failed to update project name.';
      }
    } else {
      editProjectError.value = 'Project name update is not available.';
    }
  } catch (error) {
    editProjectError.value = error.message || 'An unexpected error occurred.';
  }
}

// --- File Handling Functions (similar to CopilotChat) ---
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

const handleAttach = () => {
  triggerFileInput();
};

const handleFileSelected = (event) => {
  const file = event.target.files?.[0];
  if (!file || !file.type.startsWith('image/')) {
    // Optionally show a toast or message here
    console.warn('Invalid file type selected');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    attachedImage.value = {
      name: file.name,
      type: file.type,
      dataUrl: e.target?.result
    };
  };
  reader.onerror = (e) => {
    console.error("FileReader error:", e);
    // Optionally show a toast or message here
    attachedImage.value = { name: null, type: null, dataUrl: null };
  };
  reader.readAsDataURL(file);

  // Reset file input value to allow selecting the same file again
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const removeAttachedImage = () => {
  attachedImage.value = { name: null, type: null, dataUrl: null };
};

// --- Drag and Drop Handlers ---
const handleDragOver = (event) => {
  // Only show feedback if dragging files
  if (event.dataTransfer.types.includes('Files')) {
    isDraggingOver.value = true;
  }
};

const handleDragLeave = () => {
  isDraggingOver.value = false;
};

const handleFileDrop = (event) => {
  isDraggingOver.value = false; // Reset visual state on drop

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    return;
  }

  const file = files[0]; // Handle only the first dropped file for now
  if (!file.type.startsWith('image/')) {
    // Optionally show a toast or message here
    console.warn('Invalid file type dropped');
    return;
  }

  // Use the existing file selection logic
  handleFileSelected({ target: { files: [file] } });
};
// --- End File Handling ---

// Function to select a suggestion, set the prompt text, and focus the textarea
function selectSuggestion(prompt) {
  aiPrompt.value = prompt;

  // Focus the textarea after state update
  nextTick(() => {
    if (promptTextarea.value) {
      promptTextarea.value.focus();

      // Place cursor at the end of the text
      const textLength = promptTextarea.value.value.length;
      promptTextarea.value.selectionStart = textLength;
      promptTextarea.value.selectionEnd = textLength;

      // Trigger auto-resize to adjust height
      autoResizeTextarea();
    }
  });
}

// Add computed property for sorted projects
const sortedProjects = computed(() => {
  const projects = showAllProjects.value ? recentProjects.value : recentProjects.value.slice(0, 5)
  return [...projects].sort((a, b) => {
    if (projectSortBy.value === 'lastOpened') {
      // Sort by last opened date (mtimeMs from fs.statSync)
      const aDate = a.mtimeMs || a.birthtimeMs || 0 // Use mtimeMs, fallback to birthtimeMs, then 0
      const bDate = b.mtimeMs || b.birthtimeMs || 0 // Use mtimeMs, fallback to birthtimeMs, then 0
      // return new Date(bDate) - new Date(aDate)
      return bDate - aDate // Direct timestamp comparison
    } else { // 'created'
      // Sort by creation date (birthtimeMs from fs.statSync)
      const aDate = a.birthtimeMs || 0 // Use birthtimeMs, fallback to 0
      const bDate = b.birthtimeMs || 0 // Use birthtimeMs, fallback to 0
      // return new Date(b.created) - new Date(a.created)
      return bDate - aDate // Direct timestamp comparison
    }
  })
})

watch(showCreateModal, async (val) => {
  if (val) {
    // Wait for the modal to be fully rendered
    await nextTick();
    await nextTick();
    
    // Only focus if no name generation is happening (it will focus itself)
    if (!isGeneratingProjectName.value) {
      setTimeout(() => {
        if (newProjectNameInput.value && showCreateModal.value) {
          newProjectNameInput.value.focus();
          if (newProjectName.value) {
            newProjectNameInput.value.select();
          }
        }
      }, 100);
    }
  }
})

watch(showEditProjectModal, (val) => {
  if (val) {
    nextTick(() => {
      if (editProjectNameInput.value) {
        editProjectNameInput.value.focus()
        editProjectNameInput.value.select() // Select all text for easy editing
      }
    })
  }
})

// Watch for changes to aiPrompt to resize textarea when value changes programmatically
watch(aiPrompt, () => {
  nextTick(() => {
    autoResizeTextarea();
  });
})

onMounted(async () => {
  loadProjects()
  fetchBoards() // Fetch boards on mount
  if (!isAuthenticated()) {
    router.push('/auth')
    return
  }
  if (!isEmailVerified()) {
    router.push({
      name: 'auth',
      query: { message: 'verify-email' }
    })
    return
  }

  // Initialize textarea height if needed
  nextTick(() => {
    if (promptTextarea.value) {
      autoResizeTextarea();
    }
  });

  // Listen for arduino setup status updates
  if (window.electronAPI?.onArduinoAvrSetupStatus) {
    window.electronAPI.onArduinoAvrSetupStatus((data) => {
      console.log('[HomePage] Arduino setup status:', data);
      arduinoSetupStatus.value = data;
    });
  }

  // Listen for board list refresh events
  if (window.electronAPI?.onRefreshBoardList) {
    window.electronAPI.onRefreshBoardList((data) => {
      console.log('[HomePage] Received refresh-board-list event:', data);
      // Refresh board list with a slight delay to ensure core installation is complete
      setTimeout(() => {
        fetchBoards();
      }, 500);
    });
  }

  // Get current Arduino setup status in case it happened before component mounted
  if (window.electronAPI?.getArduinoSetupStatus) {
    const currentStatus = await window.electronAPI.getArduinoSetupStatus();
    if (currentStatus) {
      console.log('[HomePage] Current Arduino setup status:', currentStatus);
      arduinoSetupStatus.value = currentStatus;
    }
  }

  // Initialize app (includes update checking) - only runs once per app session
  initializeApp();
})

onUnmounted(() => {
  // Clean up arduino setup status listener
  if (window.electronAPI?.clearArduinoAvrSetupStatusListener) {
    window.electronAPI.clearArduinoAvrSetupStatusListener();
  }
  // Clean up board refresh listener
  if (window.electronAPI?.clearRefreshBoardListListener) {
    window.electronAPI.clearRefreshBoardListListener();
  }
});
</script>

<style scoped>
/* Make the outermost container scrollable */
.fixed.inset-0 {
  overflow: auto;
}

.bg-clip-text {
  -webkit-background-clip: text;
}

/* Smooth textarea transitions */
textarea {
  transition: height 0.15s ease;
  line-height: 1.5;
  overflow-y: auto;
  /* Change from hidden to auto to allow scrolling */
  scrollbar-width: none;
  /* Hide scrollbar for Firefox */
  -ms-overflow-style: none;
  /* Hide scrollbar for IE and Edge */
}

/* Hide scrollbar for Chrome, Safari and Opera */
textarea::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* Add custom styles for the projects list */
.projects-list-scrollable {
  overflow-y: auto;
  scrollbar-width: none;
  /* Firefox */
  -ms-overflow-style: none;
  /* IE and Edge */
}

.projects-list-scrollable::-webkit-scrollbar {
  display: none;
  /* Chrome, Safari, Opera */
  width: 0;
  height: 0;
}
</style>