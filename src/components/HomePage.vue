<template>
  <WelcomeScreen v-if="!welcomed" @confirmed="welcomed = true" />
  
  <div v-else class="fixed inset-0 flex flex-col items-center bg-[#1E1E1E] text-white/90 overflow-auto">
    <div class="w-full max-w-3xl p-8 flex flex-col items-center">
      <!-- Logo and Header -->
      <div class="flex items-center gap-3 mb-12">
        <div class="w-12 h-12 bg-[#2A2A2A] rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 class="text-2xl font-semibold text-left">Embedr</h1>
          <div class="flex items-center gap-2 text-sm text-white/60">
            <span>Pro</span>
            <span>•</span>
            <a href="#" @click.prevent="showSettings = true" class="text-[#5B8EFF] hover:text-[#5B8EFF]/90 transition-colors">Settings</a>
          </div>
        </div>
      </div>

      <!-- AI Project Creation Section -->
      <div class="w-full mb-12">
        <h2 class="text-3xl font-semibold mb-3 bg-gradient-to-r from-red-400 via-red-500 to-rose-600 text-transparent bg-clip-text">
          Hello, {{ username }}
        </h2>
        <h3 class="text-2xl text-gray-400 mb-8">What do you want to build?</h3>
        
        <!-- Project Description Input -->
        <div 
          class="relative mb-6 transition-colors duration-200 ease-in-out"
          :class="{ 'bg-blue-900/10 border border-blue-500/50 rounded-2xl': isDraggingOver }" 
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleFileDrop"
        >
          <!-- New Design - Based on screenshot -->
          <div class="flex flex-col relative">
            <!-- Input area with bottom icons -->
            <div class="bg-[#262626] rounded-2xl border border-[#444444] overflow-hidden shadow-lg flex flex-col">
              <!-- Image Preview Area -->
              <div v-if="attachedImage.dataUrl" class="flex items-center gap-2 px-3 py-2 border-b border-[#444444]">
                <img 
                  :src="attachedImage.dataUrl" 
                  :alt="attachedImage.name" 
                  class="h-8 w-8 object-cover rounded-md border border-white/10 shrink-0"
                />
                <span class="text-xs text-muted-foreground truncate flex-1">{{ attachedImage.name }}</span>
                <button 
                  @click="removeAttachedImage" 
                  class="text-xs text-red-400 hover:text-red-600 shrink-0 p-1 rounded hover:bg-red-900/20"
                >
                  Remove
                </button>
              </div>
              <!-- Textarea Wrapper -->
              <div class="flex-grow overflow-hidden">
                <textarea
                  v-model="aiPrompt"
                  placeholder="Describe your Arduino project (e.g. Blink an LED)"
                  class="w-full px-4 py-3 bg-transparent border-none focus:outline-none focus:ring-0 text-base text-white/90 placeholder-gray-500 resize-none min-h-[60px] max-h-[200px]"
                  @keydown.tab.prevent="handleTabComplete"
                  @keydown.enter="handleEnterKey"
                  @input="autoResizeTextarea"
                  ref="promptTextarea"
                  rows="1"
                ></textarea>
              </div>
              
              <!-- Action bar -->
              <div class="flex items-center px-3 py-2 justify-between border-t border-[#444444]">
                <!-- Left side icons: Attach + Hint -->
                <div class="flex items-center gap-2">
                  <button 
                    @click="handleAttach" 
                    type="button" 
                    class="text-gray-400 hover:text-white transition-colors p-1"
                    title="Attach Image"
                    :disabled="!!attachedImage.dataUrl" 
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M21.4 11.6L12.4 20.6C11.5 21.5 10.3 22 9 22C7.7 22 6.5 21.5 5.6 20.6C4.7 19.7 4.2 18.5 4.2 17.2C4.2 15.9 4.7 14.7 5.6 13.8L15.8 3.6C16.3 3.1 17 2.8 17.7 2.8C18.4 2.8 19.1 3.1 19.6 3.6C20.1 4.1 20.4 4.8 20.4 5.5C20.4 6.2 20.1 6.9 19.6 7.4L9.9 17.1C9.7 17.3 9.3 17.5 9 17.5C8.6 17.5 8.3 17.3 8.1 17.1C7.9 16.9 7.7 16.5 7.7 16.2C7.7 15.9 7.9 15.5 8.1 15.3L16.5 6.9" 
                      stroke="currentColor" 
                      stroke-width="2" 
                      stroke-linecap="round" 
                      stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <!-- Keyboard shortcut hint -->
                  <div class="text-xs text-gray-500">
                    <span>Shift+Enter for new line • Enter to submit</span>
                  </div>
                </div>
                
                <!-- Right side icons -->
                <div class="flex gap-2">
                  <button 
                    @click="handleCreateAI" 
                    type="button" 
                    class="text-gray-400 hover:text-white transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send"
                    :disabled="!aiPrompt.trim() && !attachedImage.dataUrl"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Hidden File Input -->
            <input 
              type="file" 
              ref="fileInputRef" 
              @change="handleFileSelected" 
              accept="image/*" 
              class="hidden" 
            />
            
            <!-- Text suggestion overlay (pointer-events-none so it doesn't interfere) -->
            <span v-if="suggestion && suggestion !== aiPrompt && suggestion.startsWith(aiPrompt)" 
                  class="absolute left-[16px] top-[12px] text-base text-gray-600 pointer-events-none z-10">
              <span class="opacity-0">{{ aiPrompt }}</span>{{ suggestion.substring(aiPrompt.length) }}
            </span>
          </div>
        </div>

        <!-- Suggestions -->
        <div class="flex flex-wrap gap-2 mb-4 items-center">
          <button
            v-for="(suggestion, idx) in showAllIdeas ? suggestions : suggestions.slice(0, 3)"
            :key="suggestion.name"
            @click="selectSuggestion(suggestion.prompt)"
            class="px-4 py-2 rounded-lg bg-[#1A1A1A] border border-white/10 text-sm text-gray-400 hover:bg-[#252525] transition-colors text-left max-w-xs whitespace-normal">
            {{ suggestion.name }}
          </button>
          <button v-if="suggestions.length > 3" @click="showAllIdeas = !showAllIdeas" class="ml-2 px-3 py-2 rounded-lg bg-[#232323] border border-white/10 text-sm text-blue-400 hover:bg-[#252525] transition-colors">
            {{ showAllIdeas ? 'Show Less' : 'More Ideas' }}
          </button>
        </div>

        <!-- Create Blank Project Button -->
        <div class="flex items-center gap-3 text-sm text-gray-400">
          <div class="flex-1 border-t border-white/10"></div>
          <button 
            @click="showCreateModal = true"
            class="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#1A1A1A] transition-colors group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="group-hover:text-gray-300 transition-colors">Create Blank Project</span>
          </button>
          <div class="flex-1 border-t border-white/10"></div>
        </div>
      </div>

      <!-- Recent Projects -->
      <div v-if="recentProjects.length" class="w-full mt-12" :class="showAllProjects ? 'max-h-[400px] overflow-y-auto projects-list-scrollable' : ''">
        <div class="flex justify-between items-center mb-4 gap-4">
          <h2 class="text-sm font-medium text-white/60">Recent projects</h2>
          <div class="flex items-center gap-3">
            <div class="relative">
              <select 
                v-model="projectSortBy" 
                class="bg-[#1A1A1A] border border-white/10 rounded-lg text-sm text-white/90 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none pr-8"
              >
                <option value="lastOpened">Last opened</option>
                <option value="created">Recently created</option>
              </select>
              <!-- Custom dropdown arrow indicator -->
              <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" opacity="0.5" aria-hidden="true">
                  <path d="M7 10l5 5 5-5z" fill="white" />
                </svg>
              </div>
            </div>
            <button 
              v-if="recentProjects.length > 5" 
              @click="showAllProjects = !showAllProjects" 
              class="text-sm text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-400/30 hover:border-blue-400/50 transition-colors"
            >
              {{ showAllProjects ? 'View less' : `View all (${recentProjects.length})` }}
            </button>
          </div>
        </div>
        <ul class="space-y-1">
          <li v-for="project in sortedProjects" :key="project.dir">
            <div class="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm cursor-pointer" @click="() => openProject(project)">
              <div class="flex items-center gap-3">
                <span class="font-medium">{{ project.name }}</span>
                <span class="text-white/40">{{ project.dir }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-white/40">{{ new Date(project.created).toLocaleDateString() }}</span>
                <button @click.stop="() => handleDeleteProject(project)" class="ml-2 text-red-400 hover:text-red-600" title="Delete project">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m6-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Create Project Modal -->
      <div v-if="showCreateModal" 
           class="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
        <div class="bg-[#2D2D2D] rounded-xl shadow-xl p-6 w-[400px]">
          <h3 class="text-lg font-semibold mb-4">Create New Project</h3>
          <input v-model="newProjectName" 
                 placeholder="Project name" 
                 class="w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
                 @keydown.enter="createBlankProject"
                 ref="newProjectNameInput"
          />
          <div class="flex gap-3 mt-6">
            <Button @click="createBlankProject" 
                    class="flex-1 bg-white/10 hover:bg-white/20 text-white border-none">
              Create Project
            </Button>
            <Button @click="showCreateModal = false" 
                    variant="outline" 
                    class="flex-1 border-white/10 text-white/90 hover:bg-white/5">
              Cancel
            </Button>
          </div>
          <div v-if="createError" class="mt-3 text-sm text-red-400">{{ createError }}</div>
        </div>
      </div>

      <SettingsModal 
        :show="showSettings" 
        :initialName="user?.displayName || ''" 
        @close="showSettings = false" 
        @name-updated="handleNameUpdated"
        @logged-out="handleLogout"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import WelcomeScreen from './WelcomeScreen.vue'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import SettingsModal from './SettingsModal.vue'
import { getAuth, updateProfile } from 'firebase/auth'

const emit = defineEmits(['create-blank'])

const { user, isAuthenticated, isEmailVerified } = useAuth()
const router = useRouter()

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
const newProjectName = ref('')
const createError = ref('')
const pendingAIPrompt = ref(null); // Store AI prompt object (text + image)
const showAllProjects = ref(false);
const showAllIdeas = ref(false);
const projectSortBy = ref('lastOpened')
const newProjectNameInput = ref(null)
const fileInputRef = ref(null) // Ref for hidden file input
const attachedImage = ref({ name: null, type: null, dataUrl: null }); // Ref for attached image
const isDraggingOver = ref(false); // State for drag-over visual feedback

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
    prompt: 'Build a weather station that displays temperature and humidity on an LCD screen using a DHT22 sensor and Arduino Uno.'
  },
  {
    name: 'Smart Plant Watering',
    prompt: 'Create a smart plant watering system that automatically waters a plant when soil moisture is low, and sends notifications via an ESP8266.'
  },
  {
    name: 'Home Security System',
    prompt: 'Design a home security system with a PIR motion sensor, buzzer alarm, and SMS alerts using Arduino and a GSM module.'
  },
  {
    name: 'Bluetooth Robot Car',
    prompt: 'Develop a Bluetooth-controlled robot car using Arduino and an L298N motor driver.'
  },
  {
    name: 'Digital Thermometer',
    prompt: 'Make a digital thermometer with a DS18B20 sensor and display the temperature on a 7-segment display.'
  },
  {
    name: 'RFID Door Lock',
    prompt: 'Implement a simple RFID-based door lock system using Arduino and an RC522 RFID reader.'
  },
  {
    name: 'Sound-Activated LED Show',
    prompt: 'Build a sound-activated LED light show using a microphone sensor and addressable RGB LEDs (WS2812).'
  },
  {
    name: 'Data Logger',
    prompt: 'Create a data logger that records light and temperature to an SD card using Arduino and sensors.'
  },
  {
    name: 'Remote Weather Monitor',
    prompt: 'Construct a remote weather monitoring station that uploads sensor data to the cloud using Arduino and WiFi.'
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

  // Show the create project modal and store the prompt data
  pendingAIPrompt.value = {
    prompt: textPrompt,
    imageDataUrl: imageData
  };
  console.log('[HomePage] Stored pendingAIPrompt:', JSON.stringify(pendingAIPrompt.value)); // Log the stored value
  showCreateModal.value = true;
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

async function createBlankProject() {
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
        showCreateModal.value = false
        newProjectName.value = ''
        await loadProjects()
        if (res.project) {
          if (pendingAIPrompt.value) {
            const threadId = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);
            const dataToStore = {
              prompt: pendingAIPrompt.value.prompt,
              imageDataUrl: pendingAIPrompt.value.imageDataUrl,
              threadId,
              projectDir: res.project.dir
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

watch(showCreateModal, (val) => {
  if (val) {
    nextTick(() => {
      if (newProjectNameInput.value) {
        newProjectNameInput.value.focus()
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

onMounted(() => {
  loadProjects()
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
})
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
  overflow-y: auto; /* Change from hidden to auto to allow scrolling */
  scrollbar-width: none; /* Hide scrollbar for Firefox */
  -ms-overflow-style: none; /* Hide scrollbar for IE and Edge */
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
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.projects-list-scrollable::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
  width: 0;
  height: 0;
}
</style> 