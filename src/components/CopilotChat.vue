<template>
  <div 
    class="flex h-full flex-col bg-[#0d1117] border border-transparent transition-colors duration-200 ease-in-out"
    :class="{ 'border-blue-500/50 bg-blue-900/10': isDraggingOver }" 
    @dragover.prevent="handleDragOver" 
    @dragleave.prevent="handleDragLeave" 
    @drop.prevent="handleFileDrop"
    style="user-select: text;"
  >
    <!-- Chat Header -->
    <div class="flex items-center justify-between border-b border-[#1e1e1e] px-4 py-2">
      <Select 
        v-model="currentThreadId" 
        @update:modelValue="handleSelectChat"
        :disabled="isLoadingThreads || availableThreads.length === 0"
      >
        <SelectTrigger class="w-[200px] bg-[#1e1e1e] border-0 hover:bg-[#2e2e2e]">
          <SelectValue>
            <span v-if="currentThreadId" class="flex items-center gap-2">
              <span v-if="isGeneratingName" class="inline-flex items-center gap-1">
                <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span class="text-xs text-muted-foreground">Naming...</span>
              </span>
              <span v-else>
                {{ currentThreadName || `Chat ${currentThreadId.substring(0, 8)}...` }}
              </span>
            </span>
            <span v-else class="text-muted-foreground">Select a chat</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem 
            v-for="thread in availableThreads" 
            :key="thread.id" 
            :value="thread.id"
          >
            <span class="flex items-center gap-2">
              <span v-if="isGeneratingName && thread.id === currentThreadId" class="inline-flex items-center gap-1">
                <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span class="text-xs">Naming...</span>
              </span>
              <span v-else>
                {{ thread.name || `Chat ${thread.id.substring(0, 8)}...` }}
              </span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="flex items-center gap-2">
        <Button 
          @click="handleNewChat" 
          :disabled="isLoadingThreads"
          variant="ghost"
          size="sm"
          class="bg-[#1e1e1e] hover:bg-[#2e2e2e]"
        >
          New Chat
        </Button>
        <Button 
          @click="handleDeleteChat" 
          :disabled="!currentThreadId || isLoadingThreads || isLoading"
          variant="ghost"
          size="icon"
          class="h-8 w-8 bg-[#1e1e1e] hover:bg-red-900/50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
        </Button>
      </div>
    </div>

    <!-- Messages Area -->
    <div 
      ref="messagesAreaRef"
      class="flex-1 overflow-y-auto space-y-4 px-4 py-4 pb-2"
    >
      <!-- No thread selected state -->
      <div v-if="!currentThreadId" class="flex flex-col items-center justify-center h-full space-y-4 text-muted-foreground">
        <div class="text-center">
          <p class="text-lg mb-2">No chat selected</p>
          <p class="text-sm">Start a new chat to begin the conversation</p>
        </div>
        <Button 
          @click="handleNewChat"
          variant="ghost"
          size="lg"
          class="bg-[#1e1e1e] hover:bg-[#2e2e2e]"
        >
          Start a new chat
        </Button>
      </div>

      <div v-else v-for="(message, index) in displayMessages" 
        :key="index" 
        class="flex flex-col gap-4 group"
      >
        <!-- Message content -->
        <div v-if="message.role === 'user' || message.role === 'assistant'" class="flex-1">
          <div 
            class="rounded-lg p-4 text-xs prose-invert max-w-none text-left relative group"
            :class="message.role === 'user' ? 'bg-gray-900/40 border border-gray-100/10 shadow-lg' : ''"
          >
            <!-- Image Thumbnail (if applicable) -->
            <div 
              v-if="getImageUrl(message.content)" 
              @click="toggleImageExpansion(index)" 
              class="cursor-pointer mb-2 inline-block relative" 
              :title="expandedImages[index] ? 'Collapse Image' : 'Expand Image'"
            >
              <img 
                :src="getImageUrl(message.content)" 
                alt="Attached Image Thumbnail" 
                class="h-16 w-16 object-cover rounded-md border border-white/10 hover:opacity-80 transition-opacity"
              />
              <!-- Expand/Collapse Icon Overlay -->
              <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-md">
                <svg v-if="!expandedImages[index]" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M9 3h6v6" /><path d="M15 21h6v-6" /><path d="M3 9V3h6" /><path d="M21 15v6h-6" /><path d="M3 14l7-7" /><path d="M21 10l-7 7" /></svg>
              </div>
            </div>

            <!-- Expanded Image (if applicable and expanded) -->
            <img 
              v-if="expandedImages[index] && getImageUrl(message.content)" 
              :src="getImageUrl(message.content)" 
              alt="Attached Image Expanded" 
              class="mt-2 mb-2 max-w-md max-h-80 rounded-md object-contain border border-white/10" 
            />

            <!-- Text Content -->
            <div v-html="formatMessage(message.content)" :class="{ 'mt-1': getImageUrl(message.content) }"></div>

            <!-- Copy button -->
            <Button
              @click="copyMessageToClipboard(message.content, index)"
              variant="ghost"
              size="xs"
              class="absolute top-2 right-2 text-xs text-muted-foreground hover:text-foreground hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              {{ lastCopiedIndex === index ? 'Copied' : 'Copy' }}
            </Button>
          </div>

          <!-- Checkpoint button for user messages -->
          <div v-if="message.role === 'user' && message.checkpointPath && message.checkpointPath !== latestProjectCheckpointPath" class="flex justify-end mt-2">
            <Button
              @click="handleRestoreCheckpoint(message.checkpointPath)"
              variant="ghost"
              size="xs"
              class="text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
              :title="`This message was sent when the project version was ${message.checkpointPath.substring(message.checkpointPath.lastIndexOf('/') + 1)}. Current latest is ${latestProjectCheckpointPath ? latestProjectCheckpointPath.substring(latestProjectCheckpointPath.lastIndexOf('/') + 1) : 'N/A'}. Click to restore to this message's version.`"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
              Restore checkpoint
            </Button>
          </div>
        </div>
        <!-- Tool Message Display -->
        <div v-else-if="message.role === 'tool' && message.toolId" class="flex-1 my-2">
          <ToolExecution
            v-if="toolExecutions.get(message.toolId)"
            v-bind="toolExecutions.get(message.toolId)"
          />
        </div>
      </div>

      <div 
        v-if="isLoading && messages.length > 0" 
        class="flex items-start"
      >
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>

    <!-- Chat Error Display -->
    <div v-if="chatError" class="px-4 pt-2">
      <div class="rounded-lg border border-red-500/50 bg-red-900/20 p-4 text-sm text-white relative overflow-hidden shadow-lg text-left">
        <!-- Error Icon -->
        <div class="absolute left-4 top-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        
        <!-- Error Content with padding for icon -->
        <div class="pl-8">
          <h3 class="text-sm font-medium text-red-400 text-left">Error</h3>
          
          <!-- Special handling for rate limit errors -->
          <div v-if="(chatError.includes('429') || chatError.includes('Too Many Requests') || chatError.includes('monthly limit reached')) && !isProUser" class="mt-2 text-left">
            <p class="font-semibold">Free Tier Monthly Limit Reached</p>
            <p class="mt-1 text-gray-300">You've reached your monthly request limit on the free plan.</p>
            
            <div class="mt-3 text-xs text-gray-300">
              <p>Options:</p>
              <ul class="list-disc ml-5 mt-1 space-y-1">
                <li>Wait until your limit resets next month.</li>
                <li>Upgrade to Pro for significantly higher limits and more features.</li>
              </ul>
            </div>
            <div class="mt-4 flex gap-2">
              <Button
                @click="authRedirect.redirectToSubscriptionPortal"
                variant="default"
                size="sm"
                :disabled="authRedirect.isLoading.value"
                class="bg-white/20 hover:bg-white/30 text-white"
              >
                <span v-if="authRedirect.isLoading.value" class="animate-spin mr-2 w-4 h-4 inline-block border-2 border-t-transparent border-white rounded-full"></span>
                Upgrade to Pro
              </Button>
            </div>
          </div>
          <div v-else-if="(chatError.includes('429') || chatError.includes('Too Many Requests') || chatError.includes('monthly limit reached')) && isProUser" class="mt-2 text-left">
            <p class="font-semibold">Pro Tier Monthly Limit Reached</p>
            <p class="mt-1 text-gray-300">You've reached your monthly request limit on the Pro plan.</p>
            <div class="mt-3 text-xs text-gray-300">
              <p>Your limit will reset next month. If you consistently require more, please contact support to discuss higher tier options.</p>
            </div>
          </div>
          <!-- NEW: Handling for chat context too long -->
          <div v-else-if="chatError.includes('CHAT_CONTEXT_TOO_LONG') || chatError.includes('413')" class="mt-2 text-left">
            <p class="font-semibold">Chat Too Long</p>
            <p class="mt-1 text-gray-300">This chat has become too long to continue effectively. Please start a new chat to continue your conversation.</p>
            <div class="mt-4 flex gap-2">
              <Button
                @click="handleNewChat" 
                variant="default"
                size="sm"
                class="bg-white/20 hover:bg-white/30 text-white"
              >
                Start a New Chat
              </Button>
            </div>
          </div>
          <!-- NEW: Handling for connection errors -->
          <div v-else-if="chatError.includes('Connection error')" class="mt-2 text-left">
            <p class="font-semibold">Connection Error</p>
            <p class="mt-1 text-gray-300">Unable to connect to the server. Please check your internet connection and try again.</p>
            <div class="mt-4 flex gap-2">
              <Button
                @click="handleRetryLastMessage" 
                variant="default"
                size="sm"
                class="bg-white/20 hover:bg-white/30 text-white"
                :disabled="isLoading || !canRetry"
              >
                <span v-if="isLoading" class="animate-spin mr-2 w-4 h-4 inline-block border-2 border-t-transparent border-white rounded-full"></span>
                Retry
              </Button>
            </div>
          </div>
          <div v-else class="mt-2 text-left">
            <p class="text-gray-300">{{ chatError }}</p>
          </div>
        
        </div>
      </div>
    </div>

    <!-- Input Area Wrapper (Floating Card) -->
    <div class="sticky bottom-0 left-0 right-0 p-4">
      <div class="bg-black/30 backdrop-blur-md rounded-xl shadow-lg border border-white/10">
        <!-- Input Area -->
        <div class="border-t border-[#1e1e1e]/50">
          <!-- Top Controls -->
          <div class="flex items-center gap-2 px-4 py-2 border-b border-[#1e1e1e]/50">
            <Button
              @click="triggerFileInput"
              variant="ghost"
              size="icon"
              class="h-8 w-8 rounded-full bg-[#1e1e1e] hover:bg-[#2e2e2e] text-muted-foreground hover:text-foreground"
              title="Attach Image"
              :disabled="isLoading || !currentThreadId"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </Button>
            <!-- Image Preview Area -->
            <div v-if="attachedImage.dataUrl" class="flex-1 flex items-center gap-2 overflow-hidden">
              <img 
                :src="attachedImage.dataUrl" 
                :alt="attachedImage.name" 
                class="h-8 w-8 object-cover rounded-md border border-white/10 shrink-0"
              />
              <span class="text-xs text-muted-foreground truncate flex-1">{{ attachedImage.name }}</span>
              <Button 
                @click="removeAttachedImage" 
                variant="ghost" 
                size="xs"
                class="text-red-400 hover:text-red-600 hover:bg-red-900/20 shrink-0"
              >
                Remove
              </Button>
            </div>
            <div v-else class="flex-1 h-8 flex items-center">
              <!-- Character counter when approaching limit -->
              <span 
                v-if="userInput.length > 8000" 
                class="text-xs text-muted-foreground ml-2"
                :class="{ 'text-yellow-400': userInput.length > 9000, 'text-red-400': userInput.length > 9500 }"
              >
                {{ userInput.length }}/10,000
              </span>
            </div>
          </div>

          <!-- Text Input -->
          <div class="p-4">
            <!-- Hidden File Input -->
            <input 
              type="file" 
              ref="fileInputRef" 
              @change="handleFileSelected" 
              accept="image/*" 
              class="hidden" 
            />
            <!-- Textarea Container with relative positioning -->
            <div class="relative">
              <textarea
                v-model="userInput"
                rows="1"
                placeholder="Ask Embedr for help..."
                class="w-full resize-none bg-[#1e1e1e] text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none min-h-[44px] max-h-[160px] py-3 px-4 pr-12 rounded-md overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
                :disabled="isLoading || !currentThreadId"
                @keydown="handleKeyDown"
                @input="debouncedAutoGrow"
                ref="textareaRef"
              ></textarea>
              <!-- Conditional Send/Cancel Button - positioned absolutely -->
              <div class="absolute bottom-3 right-3">
                <Button
                  v-if="!isLoading"
                  @click="handleSendMessage"
                  :disabled="!showSendButton"
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7 hover:bg-[#2e2e2e] rounded-md transition-colors flex items-center justify-center"
                  title="Send Message"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="none"
                    class="size-4"
                  >
                    <path
                      d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"
                      fill="currentColor"
                    ></path>
                  </svg>
                </Button>
                <Button
                  v-else 
                  @click="cancelStream"
                  size="icon"
                  variant="destructive"
                  class="h-7 w-7 bg-red-800/50 hover:bg-red-700/70 rounded-md animate-pulse flex items-center justify-center"
                  title="Cancel Generation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="15"/><line x1="15" x2="9" y1="9" y2="15"/></svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted, onUnmounted, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { useToast } from "@/components/ui/toast/use-toast";
import ToolExecution from './ToolExecution.vue';
import { useSubscription } from '../composables/useSubscription';
import { useAuthRedirect } from '../composables/useAuthRedirect';

const props = defineProps({
  projectPath: {
    type: String,
    required: true
  },
  selectedBoardFqbn: {
    type: String,
    default: null
  },
  selectedPortPath: {
    type: String,
    default: null
  },
  threadId: {
    type: String,
    default: null
  },
  homepageQuery: {
    type: String,
    default: null
  },
  homepageImageDataUrl: {
    type: String, // Data URL
    default: null
  },
  homepageSelectedModel: {
    type: String,
    default: null
  }
});

const messages = ref([]);
const userInput = ref('');
const isLoading = ref(false);
const currentThreadId = ref(null);
const availableThreads = ref([]);
const isLoadingThreads = ref(false);
const chatError = ref('');
const isGeneratingName = ref(false);
const messagesAreaRef = ref(null);
const textareaRef = ref(null);
const fileInputRef = ref(null); // Ref for hidden file input
const attachedImage = ref({ name: null, type: null, dataUrl: null }); // Ref for attached image
const latestProjectCheckpointPath = ref(null); // NEW: To store the current latest checkpoint path of the project

// Setup auth redirect composable
const authRedirect = useAuthRedirect();

// New refs for agent type and model selection
const agentType = ref('ask');

// Add new refs for tracking tool executions
const toolExecutions = ref(new Map()); // Map to track tool execution states

const { subscription, isLoadingSubscription } = useSubscription();

const isProUser = computed(() => {
  const planId = subscription.value?.planId;
  const status = subscription.value?.status;
  const isProPlan = planId === 'pro_monthly' || planId === 'pro_yearly' || planId === 'pro'; // Include legacy 'pro' for compatibility
  const isValidStatus = status === 'active' || status === 'authenticated'; // Based on your subscription guide
  return isProPlan && isValidStatus;
});

// Computed property to check if we can retry (last message was from user)
const canRetry = computed(() => {
  if (messages.value.length === 0) return false;
  const lastMessage = messages.value[messages.value.length - 1];
  return lastMessage.role === 'user';
});

// Computed property for current thread name to ensure reactivity
const currentThreadName = computed(() => {
  if (!currentThreadId.value) return null;
  const thread = availableThreads.value.find(t => t.id === currentThreadId.value);
  return thread?.name || null;
});

const LAST_SEEN_CHAT_KEY = (projectPath) => `embedr-last-seen-chat:${projectPath}`;
const THREAD_NAMES_KEY = (projectPath) => `embedr-thread-names:${projectPath}`;

const { toast } = useToast();

const lastCopiedIndex = ref(null);
let copyTimeout = null;

// Helper to get/set last used timestamps for threads in localStorage
const THREAD_LAST_USED_KEY = (projectPath) => `embedr-thread-last-used:${projectPath}`;

// Helper to get/set thread names in localStorage
function getThreadNamesMap(projectPath) {
  try {
    return JSON.parse(localStorage.getItem(THREAD_NAMES_KEY(projectPath)) || '{}');
  } catch {
    return {};
  }
}
function setThreadName(projectPath, threadId, name) {
  const map = getThreadNamesMap(projectPath);
  map[threadId] = name;
  localStorage.setItem(THREAD_NAMES_KEY(projectPath), JSON.stringify(map));
}

function getThreadLastUsedMap(projectPath) {
  try {
    return JSON.parse(localStorage.getItem(THREAD_LAST_USED_KEY(projectPath)) || '{}');
  } catch {
    return {};
  }
}
function setThreadLastUsed(projectPath, threadId) {
  const map = getThreadLastUsedMap(projectPath);
  map[threadId] = Date.now();
  localStorage.setItem(THREAD_LAST_USED_KEY(projectPath), JSON.stringify(map));
}

// NEW: Computed property to check if textarea should show send button
const showSendButton = computed(() => {
  return !isLoading.value && currentThreadId.value && (userInput.value.trim() || attachedImage.value.dataUrl);
});

// NEW: Debounced autogrow for better performance
let autoGrowTimeout = null;
const debouncedAutoGrow = () => {
  if (autoGrowTimeout) {
    clearTimeout(autoGrowTimeout);
  }
  autoGrowTimeout = setTimeout(autoGrow, 16); // ~60fps
};

// Enhanced auto-grow function with performance improvements
const autoGrow = () => {
  if (!textareaRef.value) return;
  
  // Use requestAnimationFrame for smooth animations
  requestAnimationFrame(() => {
    // Reset height to get accurate scrollHeight
    textareaRef.value.style.height = 'auto';
    
    // Define maximum height (equivalent to about 8 lines of text)
    const maxHeight = 160; // pixels
    const minHeight = 44; // pixels (matches min-h-[44px])
    
    // Calculate the required height
    const scrollHeight = textareaRef.value.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    
    // Set the height
    textareaRef.value.style.height = newHeight + 'px';
    
    // Enable/disable scrolling based on whether we've hit the max height
    if (scrollHeight > maxHeight) {
      textareaRef.value.style.overflowY = 'auto';
    } else {
      textareaRef.value.style.overflowY = 'hidden';
    }
  });
};

// NEW: Enhanced focus function with better error handling and timing
const focusInput = async () => {
  try {
    // Wait for multiple ticks to ensure DOM is ready
    await nextTick();
    await nextTick();
    
    if (textareaRef.value && !textareaRef.value.disabled && currentThreadId.value) {
      // Use requestAnimationFrame to ensure the element is visible
      requestAnimationFrame(() => {
        try {
          textareaRef.value.focus();
          // Position cursor at the end if there's text
          if (userInput.value) {
            const length = userInput.value.length;
            textareaRef.value.setSelectionRange(length, length);
          }
        } catch (error) {
          console.debug('Could not focus input (RAF):', error);
        }
      });
    }
  } catch (error) {
    // Silently fail if focus is not possible (e.g., element not ready)
    console.debug('Could not focus input:', error);
  }
};

// NEW: Function to clear input and reset state
const clearInput = () => {
  userInput.value = '';
  removeAttachedImage();
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = '44px';
  }
};

// Auto-scroll to bottom when messages change
watch(messages, async () => {
  await nextTick();
  scrollToBottom(true);
}, { deep: true });

// Load available threads for the current project
const loadAvailableThreads = async () => {
  console.log('loadAvailableThreads called, projectPath:', props.projectPath);
  if (!props.projectPath) return;
  isLoadingThreads.value = true;
  chatError.value = '';
  try {
    const result = await window.electronAPI.listProjectChats(props.projectPath);
    console.log('listProjectChats result:', result);
    if (result.success) {
      // Deduplicate threads by ID and add names
      const seen = new Set();
      const threadNamesMap = getThreadNamesMap(props.projectPath);
      let threads = result.threads
        .map(id => ({ 
          id,
          name: threadNamesMap[id] || null
        }))
        .filter(thread => {
          if (seen.has(thread.id)) return false;
          seen.add(thread.id);
          return true;
        });
      // Sort threads by last used (most recent first)
      const lastUsedMap = getThreadLastUsedMap(props.projectPath);
      threads.sort((a, b) => (lastUsedMap[b.id] || 0) - (lastUsedMap[a.id] || 0));
      availableThreads.value = threads;
      
      // Try to restore last seen chat for this project
      const lastSeen = localStorage.getItem(LAST_SEEN_CHAT_KEY(props.projectPath));
      const found = availableThreads.value.find(t => t.id === lastSeen);
      if (found) {
        currentThreadId.value = found.id;
        setThreadLastUsed(props.projectPath, found.id);
        await loadChatMessages(found.id);
      } else if (availableThreads.value.length > 0) {
        currentThreadId.value = availableThreads.value[0].id;
        setThreadLastUsed(props.projectPath, availableThreads.value[0].id);
        await loadChatMessages(currentThreadId.value);
      } else {
        // No threads exist, just clear the state
        currentThreadId.value = null;
        messages.value = [];
      }
    } else {
      throw new Error(result.error || 'Failed to list chats.');
    }
  } catch (error) {
    console.error('Error loading threads:', error);
    chatError.value = `Error loading chat list: ${error.message}`;
    availableThreads.value = [];
    currentThreadId.value = null;
    messages.value = [];
  } finally {
    isLoadingThreads.value = false;
  }
};

// Load messages for a specific thread
const loadChatMessages = async (threadIdToLoad) => {
  if (!props.projectPath || !threadIdToLoad) return;
  isLoading.value = true;
  chatError.value = '';
  try {
    const result = await window.electronAPI.getFullChatHistory(props.projectPath, threadIdToLoad);
    if (result.success) {
      const loadedMessages = result.messages || [];
      console.log(`[CopilotChat Load] Loaded ${loadedMessages.length} messages from ${threadIdToLoad}.full.json`);

      // Fetch latest project checkpoint path when loading messages for context
      await fetchLatestProjectCheckpointPath();

      toolExecutions.value = new Map();
      const toolStarts = loadedMessages.filter(m => m.role === 'tool' && m.toolPhase === 'start');
      console.log(`[CopilotChat Load] Found ${toolStarts.length} tool start messages.`);
      
      // Check if this chat needs a name after loading messages
      setTimeout(() => {
        checkAndGenerateChatName();
      }, 200); // Small delay to ensure all state is updated

      for (const startMsg of toolStarts) {
        const originalToolId = startMsg.toolId || startMsg.tool_call_id;
        const toolId = originalToolId || `${startMsg.toolName}-restored-${Math.random().toString(36).slice(2, 8)}`;
        console.log(`[CopilotChat Load] Processing startMsg for tool: ${startMsg.toolName}, originalId: ${originalToolId}, finalId: ${toolId}`);

        // Patch startMsg
        startMsg.toolId = toolId;
        startMsg.tool_call_id = toolId;
        startMsg.type = 'tool';

        const endMsg = loadedMessages.find(m => 
          m.role === 'tool' && 
          m.toolPhase === 'end' && 
          (m.toolId === toolId || m.tool_call_id === toolId)
        );
        
        if (endMsg) {
            console.log(`[CopilotChat Load]   Found corresponding endMsg.`);
            // Patch endMsg
            endMsg.toolId = toolId;
            endMsg.tool_call_id = toolId;
            endMsg.type = 'tool';
        } else {
            console.log(`[CopilotChat Load]   No corresponding endMsg found.`);
        }

        // Parse input/output
        let input = undefined;
        try { input = startMsg.toolInput ? JSON.parse(startMsg.toolInput) : undefined; } catch { input = startMsg.toolInput; }
        let output = endMsg && endMsg.toolOutput !== undefined ? endMsg.toolOutput : undefined;
        if (typeof output === 'string') {
          try { output = JSON.parse(output); } catch { /* leave as string */ }
        }
        
        const executionState = {
          name: startMsg.toolName || 'unknown_tool',
          loading: !endMsg,
          success: !!endMsg && !endMsg.error,
          error: !!endMsg && !!endMsg.error,
          input,
          output
        };
        console.log(`[CopilotChat Load]   Setting toolExecution map entry for ${toolId}:`, JSON.stringify(executionState));
        toolExecutions.value.set(toolId, executionState);
      }
      console.log(`[CopilotChat Load] Finished processing tools. Final toolExecutions map size: ${toolExecutions.value.size}`);
      messages.value = loadedMessages; // Assign loaded messages AFTER processing
    } else {
      throw new Error(result.error || 'Failed to load chat history.');
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    chatError.value = `Error loading chat: ${error.message}`;
    messages.value = [];
    toolExecutions.value = new Map();
  } finally {
    isLoading.value = false;
  }
};

// Handle creating a new chat
const handleNewChat = async () => {
  console.log('handleNewChat called');
  const newId = uuidv4();
  expandedImages.value = {}; // Reset expansion state for new chat
  // Prevent duplicate threads
  if (!availableThreads.value.some(t => t.id === newId)) {
    availableThreads.value.unshift({ id: newId, name: null });
  }
  currentThreadId.value = newId;
  setThreadLastUsed(props.projectPath, newId);
  // Sort threads after adding new
  availableThreads.value.sort((a, b) => {
    const lastUsedMap = getThreadLastUsedMap(props.projectPath);
    return (lastUsedMap[b.id] || 0) - (lastUsedMap[a.id] || 0);
  });
  messages.value = [];
  chatError.value = '';
  console.log('Created new chat with ID:', newId);
  
  // Focus the input after creating new chat
  await focusInput();
};

// Handle selecting a different chat from the dropdown
const handleSelectChat = async () => {
  console.log('handleSelectChat called, currentThreadId:', currentThreadId.value);
  if (currentThreadId.value) {
    setThreadLastUsed(props.projectPath, currentThreadId.value);
    // Sort threads after selection
    availableThreads.value.sort((a, b) => {
      const lastUsedMap = getThreadLastUsedMap(props.projectPath);
      return (lastUsedMap[b.id] || 0) - (lastUsedMap[a.id] || 0);
    });
    await loadChatMessages(currentThreadId.value);
    
    // Check if the selected chat needs a name
    setTimeout(() => {
      checkAndGenerateChatName();
    }, 300);
    
    // Focus the input after selecting chat
    await focusInput();
  }
};

// Handle deleting the current chat
const handleDeleteChat = async () => {
  if (!currentThreadId.value || !props.projectPath) return;
  const threadToDelete = currentThreadId.value;
  const confirmed = window.confirm(`Are you sure you want to delete chat ${threadToDelete.substring(0, 8)}...?`);
  if (!confirmed) return;

  // Before deleting, fetch the latest checkpoint path if no threads will remain
  // (though this state might be more relevant when a new chat is made or another is selected)
  if (availableThreads.value.length === 1) { // This is the last thread
    // No specific action needed here for latestProjectCheckpointPath as it's tied to project, not thread
  }

  isLoading.value = true;
  chatError.value = '';
  try {
    const result = await window.electronAPI.deleteProjectChat(props.projectPath, threadToDelete);
    if (result.success) {
      availableThreads.value = availableThreads.value.filter(t => t.id !== threadToDelete);
      if (availableThreads.value.length > 0) {
        currentThreadId.value = availableThreads.value[0].id;
        await loadChatMessages(currentThreadId.value);
        // Focus the input after switching to new chat
        await focusInput();
      } else {
        currentThreadId.value = null;
        messages.value = [];
        // No threads remain, do not auto-create a new chat
      }
      toast({ title: 'Chat Deleted', description: `Chat ${threadToDelete.substring(0, 8)}... was deleted.` });
    } else {
      throw new Error(result.error || 'Failed to delete chat.');
    }
  } catch (error) {
    chatError.value = `Error deleting chat: ${error.message}`;
    toast({ title: 'Error', description: `Failed to delete chat: ${error.message}`, variant: 'destructive' });
  } finally {
    isLoading.value = false;
  }
};

// --- File Handling ---
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

const handleFileSelected = (event) => {
  const file = event.target.files?.[0];
  if (!file || !file.type.startsWith('image/')) {
    toast({ title: 'Invalid File', description: 'Please select an image file.', variant: 'destructive' });
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
    toast({ title: 'Error Reading File', description: 'Could not read the selected image.', variant: 'destructive' });
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
// --- End File Handling ---

// Send message to backend
const handleSendMessage = async () => {
  // Validate message before sending
  const validation = validateMessage();
  if (!validation.valid) {
    toast({
      title: 'Cannot Send Message',
      description: validation.message,
      variant: 'destructive',
      duration: 3000,
    });
    return;
  }

  if (!props.projectPath) {
    console.log('Cannot send: Missing projectPath');
    return;
  }

  const userText = userInput.value.trim();
  const imageDataUrl = attachedImage.value.dataUrl;

  console.log('handleSendMessage called', { 
    userInput: userText,
    hasImage: !!imageDataUrl,
    threadId: currentThreadId.value,
    projectPath: props.projectPath
  });

  // --- Construct user message content ---
  let userMessageContent;
  if (imageDataUrl) {
    userMessageContent = [
      { type: 'text', text: userText || "" }, // Include empty text if only image is sent
      { type: 'image_url', image_url: { url: imageDataUrl } }
    ];
  } else {
    userMessageContent = userText;
  }
  
  // NEW: Fetch the latest checkpoint path *before* creating the message
  await fetchLatestProjectCheckpointPath();
  const messageCheckpointPath = latestProjectCheckpointPath.value; // Store the version ID at the time of sending

  messages.value.push({ 
    role: 'user', 
    content: userMessageContent,
    checkpointPath: messageCheckpointPath // Store the then-current latest checkpoint path
  });
  
  // Clear input and reset state
  clearInput();
  
  isLoading.value = true;
  chatError.value = '';

  // Start streaming
  window.electronAPI.sendCopilotMessageStream(
    userText, // Send only the text part as the first argument for now
    currentThreadId.value,
    props.projectPath,
    props.selectedBoardFqbn,
    props.selectedPortPath,
    'gemini-2.5-flash-preview-05-20', // HARDCODED MODEL
    imageDataUrl // Pass image data URL as the new last argument
  );
};

// --- NEW: Cancel Stream Function ---
const cancelStream = () => {
  console.log('[CopilotChat] cancelStream called.');
  window.electronAPI.cancelCopilotStream();
  // Optionally update UI state immediately, or wait for the 'cancelled' event
  // isLoading.value = false; 
};

// --- NEW: Retry Last Message Function ---
const handleRetryLastMessage = async () => {
  if (!canRetry.value || !currentThreadId.value || !props.projectPath) {
    console.log('[CopilotChat] Cannot retry - conditions not met');
    return;
  }

  const lastMessage = messages.value[messages.value.length - 1];
  if (lastMessage.role !== 'user') {
    console.log('[CopilotChat] Cannot retry - last message was not from user');
    return;
  }

  console.log('[CopilotChat] Retrying last message');
  
  // Clear the error
  chatError.value = '';
  isLoading.value = true;

  // Extract text content and image from the last message
  let userText = '';
  let imageDataUrl = null;

  if (Array.isArray(lastMessage.content)) {
    const textPart = lastMessage.content.find(part => part.type === 'text');
    const imagePart = lastMessage.content.find(part => part.type === 'image_url');
    userText = textPart?.text || '';
    imageDataUrl = imagePart?.image_url?.url || null;
  } else if (typeof lastMessage.content === 'string') {
    userText = lastMessage.content;
  }

  // Retry the stream request
  window.electronAPI.sendCopilotMessageStream(
    userText,
    currentThreadId.value,
    props.projectPath,
    props.selectedBoardFqbn,
    props.selectedPortPath,
    'gemini-2.5-flash-preview-05-20', // HARDCODED MODEL
    imageDataUrl
  );
};

// Load threads when component mounts or projectPath changes
onMounted(async () => {
  // If threadId is provided and not present, create/select it before loading threads
  let usedThreadId = null;

  // Initial fetch of latest project checkpoint path
  await fetchLatestProjectCheckpointPath();

  if (props.threadId) {
    // Load threads first to check existence
    await loadAvailableThreads();
    const found = availableThreads.value.find(t => t.id === props.threadId);
    if (!found) {
      // Create the thread
      availableThreads.value.unshift({ id: props.threadId, name: null });
    }
    currentThreadId.value = props.threadId;
    usedThreadId = props.threadId;
    setThreadLastUsed(props.projectPath, props.threadId);
    await loadChatMessages(props.threadId);
  } else {
    await loadAvailableThreads();
    usedThreadId = currentThreadId.value;
  }

  // --- Construct user message content for initial homepage query ---
  if ((props.homepageQuery || props.homepageImageDataUrl) && usedThreadId && messages.value.length === 0) {
    console.log('[CopilotChat] Handling initial homepage query...');
    console.log('  Received homepageQuery:', props.homepageQuery);
    console.log('  Received homepageImageDataUrl:', props.homepageImageDataUrl ? props.homepageImageDataUrl.substring(0, 50) + '...' : null);
    console.log('  Received homepageSelectedModel:', props.homepageSelectedModel);
    
    let initialMessageContent;
    if (props.homepageImageDataUrl) {
      initialMessageContent = [
        { type: 'text', text: props.homepageQuery || "" }, 
        { type: 'image_url', image_url: { url: props.homepageImageDataUrl } }
      ];
      console.log('  Constructed initial message with image.');
    } else {
      initialMessageContent = props.homepageQuery;
      console.log('  Constructed initial message without image.');
    }
    
    // Push the message and set loading state
    console.log('  Pushing initial message to messages.value:', JSON.stringify(initialMessageContent));
    messages.value.push({ role: 'user', content: initialMessageContent });
    isLoading.value = true;
    chatError.value = '';
    
    // Send the message via stream
    console.log('  Calling sendCopilotMessageStream...');
    window.electronAPI.sendCopilotMessageStream(
      props.homepageQuery || "", // Still send text part first for API
      currentThreadId.value,
      props.projectPath,
      props.selectedBoardFqbn,
      props.selectedPortPath,
      'gemini-2.5-flash-preview-05-20', // HARDCODED MODEL
      props.homepageImageDataUrl // Pass image data URL
    );

          // Clear localStorage key after sending
      console.log('  Removing embedr-pending-ai-query from localStorage.');
      localStorage.removeItem('embedr-pending-ai-query');
    } else {
      // Focus input if no initial query but thread is ready
      await focusInput();
    }

  window.electronAPI.onCopilotChatStream((data) => {
    if (data.type === 'chunk_delta') {
      if (data.delta) {
        if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'assistant') {
          messages.value[messages.value.length - 1].content += data.delta;
        } else {
          messages.value.push({ role: 'assistant', content: data.delta });
        }
      }
    } else if (data.type === 'tool_start') {
      // Use the toolId from backend if provided, otherwise generate one
      const toolId = data.toolId || `${data.name}-${Date.now()}`;
      toolExecutions.value.set(toolId, {
        name: data.name,
        loading: true,
        success: false,
        error: false,
        input: data.input
      });
      
      // Only add the initial tool message
      messages.value.push({ 
        role: 'tool', 
        toolId,
        toolName: data.name,
        toolPhase: 'start'
      });
      
      isLoading.value = true;
    } else if (data.type === 'tool_end') {
      // First try to find by exact toolId if provided
      let toolEntry = null;
      if (data.toolId && toolExecutions.value.has(data.toolId)) {
        const execution = toolExecutions.value.get(data.toolId);
        toolEntry = [data.toolId, execution];
      } else {
        // Fallback to finding by name and loading state (for backward compatibility)
        toolEntry = Array.from(toolExecutions.value.entries())
          .find(([_, exec]) => exec.name === data.name && exec.loading);
      }
      
      if (toolEntry) {
        const [toolId, execution] = toolEntry;
        execution.loading = false;
        execution.success = true;
        execution.output = data.output;
        toolExecutions.value.set(toolId, execution);
        
        // Update the existing tool message instead of adding a new one
        const existingToolMessage = messages.value.find(m => m.toolId === toolId);
        if (existingToolMessage) {
          existingToolMessage.toolPhase = 'end';
        }
      }
      
      isLoading.value = true;
    } else if (data.type === 'tool_error') {
      // First try to find by exact toolId if provided
      let toolEntry = null;
      if (data.toolId && toolExecutions.value.has(data.toolId)) {
        const execution = toolExecutions.value.get(data.toolId);
        toolEntry = [data.toolId, execution];
      } else {
        // Fallback to finding by name and loading state (for backward compatibility)
        toolEntry = Array.from(toolExecutions.value.entries())
          .find(([_, exec]) => exec.name === data.name && exec.loading);
      }
      
      if (toolEntry) {
        const [toolId, execution] = toolEntry;
        // Update tool execution state
        execution.loading = false;
        execution.error = true;
        execution.output = data.error;
        toolExecutions.value.set(toolId, execution);
      }
      
      isLoading.value = true;
    } else if (data.type === 'done') {
      // Ensure any remaining loading tools are marked as complete
      toolExecutions.value.forEach((execution, toolId) => {
        if (execution.loading) {
          execution.loading = false;
          execution.success = true;
          toolExecutions.value.set(toolId, execution);
        }
      });
      
      if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'assistant') {
        messages.value[messages.value.length - 1].content = data.content || messages.value[messages.value.length - 1].content;
      } else if (data.content) {
        messages.value.push({ role: 'assistant', content: data.content });
      }
      isLoading.value = false;
      
      // Generate chat name if this is the first conversation in a chat
      if (currentThreadId.value) {
        // Use a small delay to ensure all message state is updated
        setTimeout(() => {
          checkAndGenerateChatName();
        }, 100);
      }
    } else if (data.type === 'error') {
      // Mark any loading tools as errored
      toolExecutions.value.forEach((execution, toolId) => {
        if (execution.loading) {
          execution.loading = false;
          execution.error = true;
          execution.output = 'Tool execution interrupted by error';
          toolExecutions.value.set(toolId, execution);
        }
      });
      
      chatError.value = data.error;
      isLoading.value = false;
    } else if (data.type === 'cancelled') {
      console.log('[CopilotChat] Received stream cancelled event.');
      // Ensure loading state is false and potentially update UI to reflect cancellation
      isLoading.value = false;
      // You might want to add a system message here if not already done in main.js
      // messages.value.push({ role: 'system', content: 'Stream cancelled.' });
      toast({ title: 'Cancelled', description: 'AI response generation stopped.', duration: 2000 });
    }
    // After any stream event that might indicate a project change (e.g., tool_end for a file edit tool)
    // or 'done', it might be good to re-fetch the latest checkpoint path.
    if (data.type === 'tool_end' || data.type === 'done' || data.type === 'error' || data.type === 'cancelled') {
      fetchLatestProjectCheckpointPath();
    }
  });
  
  // Focus the input after initial setup (unless we're actively loading)
  if (!isLoading.value) {
    await focusInput();
  }
});

onUnmounted(() => {
  window.electronAPI.clearCopilotChatStream();
});

watch(() => props.projectPath, (newPath, oldPath) => {
  if (newPath !== oldPath) {
    currentThreadId.value = null;
    messages.value = [];
    loadAvailableThreads(); // This will also trigger fetchLatestProjectCheckpointPath via loadChatMessages or initial mount logic
    if (newPath) { // If there's a new valid project path
      fetchLatestProjectCheckpointPath();
    } else {
      latestProjectCheckpointPath.value = null; // Clear if project path is removed
    }
  }
});

// Configure marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
  headerIds: true, // Add IDs to headers
  mangle: false, // Don't escape HTML
  sanitize: false, // Allow HTML in source
  smartLists: true, // Use smarter list behavior
  smartypants: true, // Use smart punctuation
  xhtml: true, // Use XHTML style tags
  highlight: function(code, lang) {
    return code; // You could add syntax highlighting here if desired
  }
});

// Format message with markdown and sanitize HTML
const formatMessage = (content) => {
  if (!content) return '';
  
  let textContent = '';
  let originalUserQuery = ''; // Store the part after USER QUERY:
  const queryMarker = 'USER QUERY:\n';

  if (Array.isArray(content)) {
    // Find the text part in the array
    const textPart = content.find(part => part.type === 'text');
    textContent = textPart?.text || '';
  } else if (typeof content === 'string') {
    textContent = content;
  } else {
    // Handle potential non-string/non-array content gracefully
    try {
      textContent = JSON.stringify(content);
    } catch {
      textContent = String(content);
    }
  }

  // Check if the text content includes the context marker
  const markerIndex = textContent.indexOf(queryMarker);
  if (markerIndex !== -1) {
    // Extract only the text after the marker for display
    originalUserQuery = textContent.substring(markerIndex + queryMarker.length);
  } else {
    // If no marker, display the whole text content
    originalUserQuery = textContent;
  }
  
  // Parse markdown and sanitize the resulting HTML
  return DOMPurify.sanitize(marked(originalUserQuery), {
    ALLOWED_TAGS: [
      // Block elements
      'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code', 'hr',
      // Inline elements
      'strong', 'em', 'del', 'span', 'a', 'br',
      // Lists
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      // Tables
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      // Other
      'details', 'summary', 'kbd', 'sup', 'sub',
      // Forms (for task lists)
      'input'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'id', 'class', 'type', 'checked', 'disabled',
      'title', 'colspan', 'rowspan', 'style', 'data-*'
    ],
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['target'], // Add target="_blank" to links
    FORBID_TAGS: ['style', 'script'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    ALLOW_ARIA_ATTR: true,
    USE_PROFILES: {
      html: true,
      svg: false,
      svgFilters: false,
      mathMl: false
    }
  });
};

// Whenever the user switches chats, store the last seen chat for this project
watch(currentThreadId, (newId) => {
  if (props.projectPath && newId) {
    localStorage.setItem(LAST_SEEN_CHAT_KEY(props.projectPath), newId);
  }
  // When currentThreadId changes, also refresh the latest project checkpoint path
  // as the user is actively engaging with the chat interface.
  if (newId) {
    fetchLatestProjectCheckpointPath();
  }
});

// === NEW: Handle Restore Checkpoint ===
const handleRestoreCheckpoint = async (checkpointPath) => {
  if (!props.projectPath || !checkpointPath) {
    console.error('Restore failed: Missing projectPath or checkpointPath');
    toast({ title: 'Error', description: 'Cannot restore checkpoint. Missing required info.', variant: 'destructive' });
    return;
  }

  console.log('handleRestoreCheckpoint called', { projectPath: props.projectPath, checkpointPath });

  // Optional: Add confirmation
  toast({
    title: 'Confirm Restore',
    description: 'Are you sure you want to restore the code editor content to this checkpoint? Unsaved changes will be lost.',
    action: {
      label: 'Restore',
      onClick: async () => {
        isLoading.value = true; // Indicate loading during restore
        chatError.value = '';
        try {
          const result = await window.electronAPI.restoreCheckpoint(props.projectPath, checkpointPath);
          if (result.success) {
            console.log('Checkpoint restored successfully');
            toast({
              title: 'Checkpoint Restored',
              description: 'Code editor content has been updated.',
            });
            // NOTE: Assuming the editor page watches the file and updates automatically.
            // If not, an event emit or direct editor update call might be needed here.
          } else {
            throw new Error(result.error || 'Failed to restore checkpoint.');
          }
        } catch (error) {
          console.error('Error restoring checkpoint:', error);
          chatError.value = `Restore failed: ${error.message}`;
          toast({ title: 'Error', description: `Failed to restore checkpoint: ${error.message}`, variant: 'destructive' });
        } finally {
          isLoading.value = false;
        }
      }
    }
  });
};

// Add the copyMessageToClipboard function in the script section
const copyMessageToClipboard = async (content, index) => {
  try {
    await navigator.clipboard.writeText(content);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard",
      duration: 2000,
    });
    lastCopiedIndex.value = index;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      lastCopiedIndex.value = null;
    }, 1000);
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to copy message",
      variant: "destructive",
      duration: 2000,
    });
  }
};

// Add a helper function to deduplicate tool messages
const deduplicateToolMessages = (messages) => {
  const seenToolIds = new Set();
  return messages.filter(msg => {
    if (msg.role !== 'tool' || !msg.toolId) return true;
    if (seenToolIds.has(msg.toolId)) return false;
    seenToolIds.add(msg.toolId);
    return true;
  });
};

// Computed property for filtered messages
const displayMessages = computed(() => deduplicateToolMessages(messages.value));

// --- Image Expansion ---
const expandedImages = ref({}); // Track expanded state by message index

const toggleImageExpansion = (index) => {
  expandedImages.value[index] = !expandedImages.value[index];
};

// Helper to get image URL from message content
const getImageUrl = (content) => {
  if (Array.isArray(content)) {
    const imagePart = content.find(part => part.type === 'image_url' && part.image_url?.url);
    return imagePart?.image_url.url || null;
  }
  return null;
};
// --- End Image Expansion ---

// --- Drag and Drop Handlers ---
const isDraggingOver = ref(false); // State for drag-over visual feedback

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
  if (isLoading.value || !currentThreadId.value) return; // Don't allow drop if busy or no chat

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    return;
  }

  const file = files[0]; // Handle only the first dropped file for now
  if (!file.type.startsWith('image/')) {
    toast({ title: 'Invalid File Type', description: 'Only image files can be dropped.', variant: 'destructive' });
    return;
  }

  // Use the existing file selection logic
  // We need to pass a similar structure as the file input change event
  handleFileSelected({ target: { files: [file] } }); 
};
// --- End Drag and Drop Handlers ---

// NEW: Method to fetch the latest checkpoint path for the project
const fetchLatestProjectCheckpointPath = async () => {
  if (!props.projectPath) return;
  try {
    // Assume a new Electron API that returns the path/ID of the latest version
    // for the main sketch or project.
    // This API would need to be implemented in your main process.
    const result = await window.electronAPI.getLatestCheckpointPathForProject(props.projectPath);
    if (result && result.success) {
      latestProjectCheckpointPath.value = result.latestCheckpointPath;
      console.log('[CopilotChat] Updated latestProjectCheckpointPath:', latestProjectCheckpointPath.value);
    } else {
      latestProjectCheckpointPath.value = null; // Reset if not found or error
      console.warn('[CopilotChat] Could not fetch latest project checkpoint path:', result?.error);
    }
  } catch (error) {
    latestProjectCheckpointPath.value = null;
    console.error('[CopilotChat] Error fetching latest project checkpoint path:', error);
  }
};

// Check if current chat needs a name and generate it if needed
const checkAndGenerateChatName = () => {
  if (!currentThreadId.value || !props.projectPath) return;
  
  const currentThread = availableThreads.value.find(t => t.id === currentThreadId.value);
  const userMessages = messages.value.filter(m => m.role === 'user');
  const assistantMessages = messages.value.filter(m => m.role === 'assistant');
  
  console.log('[CopilotChat] Checking chat name generation need:', {
    threadId: currentThreadId.value,
    hasName: !!currentThread?.name,
    messageCount: messages.value.length,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    isGeneratingName: isGeneratingName.value
  });
  
  // Only generate if no name exists, we have at least one complete conversation, and we're not already generating
  if (!currentThread?.name && !isGeneratingName.value && userMessages.length >= 1 && assistantMessages.length >= 1) {
    const firstUserMessage = userMessages[0];
    const firstAssistantMessage = assistantMessages[0];
    
    console.log('[CopilotChat] Triggering chat name generation with first conversation');
    generateChatName(firstUserMessage.content, firstAssistantMessage.content).catch(console.error);
  }
};

// Generate chat name for first conversation (user query + LLM response)
const generateChatName = async (userMessage, assistantResponse) => {
  if (!props.projectPath || !currentThreadId.value) {
    console.log('[CopilotChat] Cannot generate chat name - missing projectPath or currentThreadId');
    return;
  }
  
  // Check if we're already generating or if thread already has a name
  if (isGeneratingName.value) {
    console.log('[CopilotChat] Already generating name, skipping...');
    return;
  }
  
  const currentThread = availableThreads.value.find(t => t.id === currentThreadId.value);
  if (currentThread?.name) {
    console.log('[CopilotChat] Thread already has name:', currentThread.name);
    return;
  }
  
  try {
    isGeneratingName.value = true;
    console.log('[CopilotChat] Starting chat name generation...');
    
    // Extract text content from user message (handle both string and multimodal content)
    let userText = '';
    if (Array.isArray(userMessage)) {
      const textPart = userMessage.find(part => part.type === 'text');
      userText = textPart?.text || '';
    } else if (typeof userMessage === 'string') {
      userText = userMessage;
    }
    
    // Fallback if no user text found
    if (!userText) {
      console.log('[CopilotChat] No user text found for name generation');
      return;
    }
    
    // Clean and limit the text for API
    const cleanUserText = userText.trim().substring(0, 500);
    console.log('[CopilotChat] Generating name for text:', cleanUserText.substring(0, 100) + '...');
    
    const result = await window.electronAPI.invokeFirebaseFunction('generateChatName', {
      message: cleanUserText
    });
    
    if (result.success && result.data && result.data.chatName) {
      const chatName = result.data.chatName.trim();
      console.log('[CopilotChat] Generated chat name:', chatName);
      
      // Validate the generated name
      if (!chatName || chatName.length < 2) {
        console.warn('[CopilotChat] Generated name too short, using fallback');
        const fallbackName = `Chat ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        await applyChatName(fallbackName);
      } else {
        await applyChatName(chatName);
      }
    } else {
      console.warn('[CopilotChat] Failed to generate chat name:', result.error || 'Unknown error');
      // Use fallback name
      const fallbackName = `Chat ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      await applyChatName(fallbackName);
    }
  } catch (error) {
    console.error('[CopilotChat] Error generating chat name:', error);
    // Use fallback name on error
    const fallbackName = `Chat ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    await applyChatName(fallbackName);
  } finally {
    isGeneratingName.value = false;
  }
};

// Helper function to apply the chat name with proper reactivity
const applyChatName = async (chatName) => {
  if (!chatName || !currentThreadId.value || !props.projectPath) return;
  
  console.log('[CopilotChat] Applying chat name:', chatName);
  
  // Store the name in localStorage
  setThreadName(props.projectPath, currentThreadId.value, chatName);
  
  // Update the current thread in availableThreads with better reactivity
  const threadIndex = availableThreads.value.findIndex(t => t.id === currentThreadId.value);
  if (threadIndex !== -1) {
    console.log('[CopilotChat] Updating thread name at index', threadIndex, 'to:', chatName);
    
    // Use Vue's reactivity helper to ensure the change is detected
    availableThreads.value[threadIndex] = {
      ...availableThreads.value[threadIndex],
      name: chatName
    };
    
    // Force reactivity update
    await nextTick();
    console.log('[CopilotChat] Thread name updated successfully');
    
    toast({
      title: 'Chat Named',
      description: `"${chatName}"`,
      duration: 2000,
    });
  } else {
    console.warn('[CopilotChat] Could not find thread index for ID:', currentThreadId.value);
  }
};

// Expose the method for EditorPage to call
defineExpose({
  sendMessageFromEditor
});

// --- NEW: Method to send message from EditorPage ---
async function sendMessageFromEditor(errorMessage) {
  chatError.value = ''; // Clear any existing chat error

  if (!props.projectPath) {
    console.error('[sendMessageFromEditor] Project path is not available.');
    chatError.value = 'Cannot send message: Project context is missing.';
    return;
  }

  let targetThreadId = currentThreadId.value;

  if (!targetThreadId) {
    console.log('[sendMessageFromEditor] No current thread, creating a new one.');
    await handleNewChat(); // This sets currentThreadId and saves it
    targetThreadId = currentThreadId.value;
    if (!targetThreadId) {
        console.error('[sendMessageFromEditor] Failed to create a new chat thread.');
        chatError.value = 'Failed to initiate a new chat for the error.';
        return;
    }
  } else {
    // Ensure the current chat is loaded if it wasn't already active
    // or if messages are empty (e.g., after deleting a thread and one auto-selects)
    if (messages.value.length === 0) {
      await loadChatMessages(targetThreadId);
    }
  }
  
  await fetchLatestProjectCheckpointPath();
  const messageCheckpointPath = latestProjectCheckpointPath.value;

  messages.value.push({
    role: 'user',
    content: errorMessage,
    checkpointPath: messageCheckpointPath
  });

  isLoading.value = true;

  // Ensure image is not sent with this automated message
  const imageToSend = null; 

  window.electronAPI.sendCopilotMessageStream(
    errorMessage, // The full error message is the primary user input
    targetThreadId,
    props.projectPath,
    props.selectedBoardFqbn,
    props.selectedPortPath,
    'gemini-2.5-flash-preview-05-20', // HARDCODED MODEL
    imageToSend
  );
}

// NEW: Handle keyboard shortcuts
const handleKeyDown = (event) => {
  // Cmd/Ctrl + Enter to send message
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    handleSendMessage();
    return;
  }
  
  // Escape to clear input
  if (event.key === 'Escape' && userInput.value.trim()) {
    event.preventDefault();
    clearInput();
    return;
  }
  
  // Enter without shift to send (only if not disabled)
  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    handleSendMessage();
    return;
  }
};

// NEW: Enhanced error handling with user-friendly messages
const getErrorMessage = (error) => {
  if (typeof error === 'string') {
    if (error.includes('429') || error.includes('Too Many Requests')) {
      return 'Rate limit exceeded. Please wait a moment before trying again.';
    }
    if (error.includes('Connection error') || error.includes('Network')) {
      return 'Network connection error. Please check your internet connection.';
    }
    if (error.includes('CHAT_CONTEXT_TOO_LONG') || error.includes('413')) {
      return 'This conversation has become too long. Please start a new chat.';
    }
    return error;
  }
  return 'An unexpected error occurred. Please try again.';
};

// NEW: Function to handle scroll to bottom with smooth behavior
const scrollToBottom = (smooth = true) => {
  if (messagesAreaRef.value) {
    messagesAreaRef.value.scrollTo({
      top: messagesAreaRef.value.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
};

// NEW: Enhanced message validation
const validateMessage = () => {
  const hasText = userInput.value.trim().length > 0;
  const hasImage = attachedImage.value.dataUrl;
  const isReady = currentThreadId.value && !isLoading.value;
  
  if (!isReady) {
    return { valid: false, message: 'Please select or create a chat first.' };
  }
  
  if (!hasText && !hasImage) {
    return { valid: false, message: 'Please enter a message or attach an image.' };
  }
  
  if (userInput.value.length > 10000) {
    return { valid: false, message: 'Message is too long. Please keep it under 10,000 characters.' };
  }
  
  return { valid: true };
};
</script>

<style scoped>
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 8px;
}

.typing-indicator span {
  width: 4px;
  height: 4px;
  background: #4B5563;
  border-radius: 50%;
  animation: typing 1.4s infinite;
  opacity: 0.3;
}

.typing-indicator span:nth-child(1) {
  animation-delay: 0s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.3;
  }
  50% {
    transform: translateY(-2px);
    opacity: 0.8;
  }
}

/* === Font overrides for macOS only === */
@media screen and (platform: macos), screen and (platform: mac) {
  .flex.h-full.flex-col {
    font-family: 'SF Pro Text', 'San Francisco', 'system-ui', 'Segoe UI', 'Arial', sans-serif;
  }
  :deep(.prose-invert code),
  :deep(.prose-invert pre),
  :deep(.prose-invert pre code) {
    font-family: 'SF Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace !important;
  }
}

/* === Font overrides for Windows only === */
@media screen and (platform: windows), screen and (platform: win32) {
  .flex.h-full.flex-col {
    font-family: 'Segoe UI', 'system-ui', 'Arial', sans-serif;
  }
  :deep(.prose-invert code),
  :deep(.prose-invert pre),
  :deep(.prose-invert pre code) {
    font-family: 'Cascadia Code', 'Consolas', 'Menlo', 'Monaco', 'Liberation Mono', monospace !important;
  }
}

/* Fallback for all platforms */
.flex.h-full.flex-col {
  font-family: system-ui, 'Segoe UI', 'Arial', sans-serif;
}
:deep(.prose-invert code),
:deep(.prose-invert pre),
:deep(.prose-invert pre code) {
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
}

/* Add markdown styling */
:deep(.prose-invert) {
  color: inherit;
  line-height: 1.6;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-size: 0.95rem;
}

:deep(.prose-invert strong) {
  color: #fff;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.1em 0.3em;
  border-radius: 3px;
}

:deep(.prose-invert em) {
  color: #93c5fd;
  font-style: italic;
}

:deep(.prose-invert code) {
  color: #e5e7eb;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.875em;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
}

:deep(.prose-invert pre) {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem 1.2rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.prose-invert pre code) {
  color: #e5e7eb;
  background: none;
  padding: 0;
  border: none;
  font-size: 0.9em;
}

:deep(.prose-invert ul),
:deep(.prose-invert ol) {
  padding-left: 1.5rem;
  margin: 1rem 0;
}

:deep(.prose-invert ul) {
  list-style-type: none;
}

:deep(.prose-invert ul li) {
  position: relative;
  margin: 0.5rem 0;
}

:deep(.prose-invert ul li::before) {
  content: "•";
  color: #60a5fa;
  font-weight: bold;
  position: absolute;
  left: -1.2rem;
}

:deep(.prose-invert ol) {
  counter-reset: list-counter;
  list-style-type: none;
}

:deep(.prose-invert ol li) {
  counter-increment: list-counter;
  position: relative;
  margin: 0.5rem 0;
}

:deep(.prose-invert ol li::before) {
  content: counter(list-counter) ".";
  color: #60a5fa;
  font-weight: bold;
  position: absolute;
  left: -1.5rem;
}

:deep(.prose-invert blockquote) {
  border-left: 3px solid #60a5fa;
  padding: 0.5rem 0 0.5rem 1.5rem;
  margin: 1rem 0;
  color: #93c5fd;
  background: rgba(96, 165, 250, 0.1);
  border-radius: 0 6px 6px 0;
}

:deep(.prose-invert a) {
  color: #60a5fa;
  text-decoration: none;
  border-bottom: 1px dashed rgba(96, 165, 250, 0.4);
  transition: all 0.2s ease;
}

:deep(.prose-invert a:hover) {
  color: #93c5fd;
  border-bottom-style: solid;
}

:deep(.prose-invert h1),
:deep(.prose-invert h2),
:deep(.prose-invert h3),
:deep(.prose-invert h4),
:deep(.prose-invert h5),
:deep(.prose-invert h6) {
  color: #fff;
  font-weight: 600;
  margin: 1.5rem 0 1rem 0;
  line-height: 1.3;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.5rem;
}

:deep(.prose-invert h1) { font-size: 1.8rem; }
:deep(.prose-invert h2) { font-size: 1.5rem; }
:deep(.prose-invert h3) { font-size: 1.3rem; }
:deep(.prose-invert h4) { font-size: 1.1rem; }
:deep(.prose-invert h5) { font-size: 1rem; }
:deep(.prose-invert h6) { font-size: 0.9rem; }

:deep(.prose-invert table) {
  width: 100%;
  margin: 1rem 0;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.prose-invert th) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: 600;
  text-align: left;
  padding: 0.75rem 1rem;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

:deep(.prose-invert td) {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

:deep(.prose-invert tr:last-child td) {
  border-bottom: none;
}

:deep(.prose-invert td code) {
  background: rgba(0, 0, 0, 0.4);
}

:deep(.prose-invert p) {
  margin: 0.75rem 0;
  line-height: 1.7;
}

:deep(.prose-invert hr) {
  border: none;
  border-top: 2px solid rgba(255, 255, 255, 0.1);
  margin: 2rem 0;
}

:deep(.prose-invert p:first-child) {
  margin-top: 0;
}

:deep(.prose-invert p:last-child) {
  margin-bottom: 0;
}

/* Nested lists */
:deep(.prose-invert ul ul),
:deep(.prose-invert ul ol),
:deep(.prose-invert ol ul),
:deep(.prose-invert ol ol) {
  margin: 0.5rem 0 0.5rem 1.5rem;
}

/* Definition lists */
:deep(.prose-invert dl) {
  margin: 1rem 0;
}

:deep(.prose-invert dt) {
  font-weight: 600;
  color: #93c5fd;
  margin-top: 1rem;
}

:deep(.prose-invert dd) {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
}

/* Keyboard shortcuts */
:deep(.prose-invert kbd) {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 0.1em 0.4em;
  font-size: 0.9em;
  font-family: var(--font-mono);
}

/* Inline code blocks with syntax highlighting hints */
:deep(.prose-invert code[class*="language-"]) {
  color: #e5e7eb;
}

/* Details/summary elements */
:deep(.prose-invert details) {
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.prose-invert summary) {
  cursor: pointer;
  color: #93c5fd;
  font-weight: 600;
}

:deep(.prose-invert summary:hover) {
  color: #60a5fa;
}

/* Task lists */
:deep(.prose-invert input[type="checkbox"]) {
  margin-right: 0.5rem;
}

:deep(.prose-invert li.task-list-item) {
  list-style-type: none;
  margin-left: -1.5rem;
}

/* Footnotes */
:deep(.prose-invert .footnotes) {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.9em;
}

:deep(.prose-invert .footnote-ref) {
  font-size: 0.8em;
  vertical-align: super;
}

:deep(.prose-invert .footnote-backref) {
  font-size: 0.8em;
  margin-left: 0.3em;
}

/* Scrollbar styling for textarea */
textarea::-webkit-scrollbar {
  width: 6px;
}

textarea::-webkit-scrollbar-track {
  background: transparent;
}

textarea::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 3px;
}

textarea::-webkit-scrollbar-thumb:hover {
  background-color: #6b7280;
}

/* Firefox scrollbar styling */
textarea {
  scrollbar-width: thin;
  scrollbar-color: #4b5563 transparent;
}

/* Additional textarea styling for better large text handling */
textarea {
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
  transition: height 0.1s ease;
}

.bottom-3 {
  bottom: 0.85rem;
}

/* Send button hover effects and positioning */
.absolute.bottom-3.right-3 button {
  backdrop-filter: blur(8px);
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.absolute.bottom-3.right-3 button:hover {
  background: rgba(46, 46, 46, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.absolute.bottom-3.right-3 button:disabled {
  opacity: 0.5;
  transform: none;
  background: rgba(30, 30, 30, 0.5);
}

/* Better focus states */
textarea:focus {
  outline: 2px solid rgba(96, 165, 250, 0.5);
  outline-offset: -2px;
}

/* Smooth transitions for all interactive elements */
button, textarea {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
</style> 