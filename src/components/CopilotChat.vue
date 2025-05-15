<template>
  <div 
    class="flex h-full flex-col bg-[#0d1117] border border-transparent transition-colors duration-200 ease-in-out"
    :class="{ 'border-blue-500/50 bg-blue-900/10': isDraggingOver }" 
    @dragover.prevent="handleDragOver" 
    @dragleave.prevent="handleDragLeave" 
    @drop.prevent="handleFileDrop"
  >
    <!-- Chat Header -->
    <div class="flex items-center justify-between border-b border-[#1e1e1e] px-4 py-2">
      <Select 
        v-model="currentThreadId" 
        @update:modelValue="handleSelectChat"
        :disabled="isLoadingThreads || availableThreads.length === 0"
      >
        <SelectTrigger class="w-[200px] bg-[#1e1e1e] border-0 hover:bg-[#2e2e2e]">
          <SelectValue :placeholder="currentThreadId ? `Chat ${currentThreadId.substring(0, 8)}...` : 'Select a chat'" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem 
            v-for="thread in availableThreads" 
            :key="thread.id" 
            :value="thread.id"
          >
            {{ thread.name || `Chat ${thread.id.substring(0, 8)}...` }}
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
            class="rounded-lg p-4 text-sm prose-invert max-w-none text-left relative group"
            :class="message.role === 'user' ? 'bg-gray-900/70' : ''"
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
          <div v-if="message.role === 'user' && message.checkpointPath" class="flex justify-end mt-2">
            <Button
              @click="handleRestoreCheckpoint(message.checkpointPath)"
              variant="ghost"
              size="xs"
              class="text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
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
    <div v-if="chatError" class="px-4 pb-2">
      <div class="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
        {{ chatError }}
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
            <div v-else class="flex-1 h-8"></div> <!-- Placeholder to keep height consistent -->
          </div>

          <!-- Text Input -->
          <div class="flex gap-2 p-4">
            <!-- Hidden File Input -->
            <input 
              type="file" 
              ref="fileInputRef" 
              @change="handleFileSelected" 
              accept="image/*" 
              class="hidden" 
            />
            <textarea
              v-model="userInput"
              rows="1"
              placeholder="Ask Embedr for help..."
              class="flex-1 resize-none bg-[#1e1e1e] text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none min-h-[44px] py-3 px-4 rounded-md"
              :disabled="isLoading || !currentThreadId"
              @keydown.enter.exact.prevent="handleSendMessage"
              @input="autoGrow"
              ref="textareaRef"
            ></textarea>
            <!-- Conditional Send/Cancel Button -->
            <Button
              v-if="!isLoading"
              @click="handleSendMessage"
              :disabled="isLoading || !currentThreadId || (!userInput.trim() && !attachedImage.dataUrl)"
              size="icon"
              variant="ghost"
              class="shrink-0 h-[44px] w-[44px] hover:bg-[#2e2e2e] rounded-md transition-colors"
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
              class="shrink-0 h-[44px] w-[44px] bg-red-800/50 hover:bg-red-700/70 rounded-md animate-pulse"
              title="Cancel Generation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="15"/><line x1="15" x2="9" y1="9" y2="15"/></svg>
            </Button>
            <!-- End Conditional Send/Cancel Button -->
          </div>
        </div>

        <!-- Bottom Controls -->
        <div class="flex items-center gap-2 px-4 py-2 border-t border-[#1e1e1e]/50">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Model</span>
          </div>

          <Select
            v-model="selectedModel"
            :disabled="isLoading"
          >
            <SelectTrigger class="h-8 w-[200px] bg-[#0d1117] border-0 hover:bg-[#2e2e2e] text-sm">
              <SelectValue :placeholder="selectedModel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
              <SelectItem value="o4-mini">o4-mini</SelectItem>
              <SelectItem value="claude-3-5-sonnet-latest">claude-3.5-sonnet</SelectItem>
              <SelectItem value="claude-3-7-sonnet-latest">claude-3.7-sonnet</SelectItem>
              <SelectItem value="gemini-2.5-pro-exp-03-25">gemini-2.5-pro</SelectItem>
              <SelectItem value="deepseek-r1-distill-llama-70b">deepseek-r1-distill-llama-70b</SelectItem>
              <SelectItem disabled value="llama3-8b-8192">llama3-8b-8192</SelectItem>
              <SelectItem disabled value="meta-llama/llama-4-maverick-17b-128e-instruct">llama-4-maverick-17b-128e-instruct</SelectItem>
              <SelectItem disabled value="qwen-qwq-32b">qwen-qwq-32b</SelectItem>
            </SelectContent>
          </Select>
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
  }
});

const messages = ref([]);
const userInput = ref('');
const isLoading = ref(false);
const currentThreadId = ref(null);
const availableThreads = ref([]);
const isLoadingThreads = ref(false);
const chatError = ref('');
const messagesAreaRef = ref(null);
const textareaRef = ref(null);
const fileInputRef = ref(null); // Ref for hidden file input
const attachedImage = ref({ name: null, type: null, dataUrl: null }); // Ref for attached image

// New refs for agent type and model selection
const agentType = ref('ask');
const LOCALSTORAGE_MODEL_KEY = 'embedr-last-used-model';
const selectedModel = ref(localStorage.getItem(LOCALSTORAGE_MODEL_KEY) || 'gpt-4.1');

// Add new refs for tracking tool executions
const toolExecutions = ref(new Map()); // Map to track tool execution states

const LAST_SEEN_CHAT_KEY = (projectPath) => `embedr-last-seen-chat:${projectPath}`;

const { toast } = useToast();

const lastCopiedIndex = ref(null);
let copyTimeout = null;

// Helper to get/set last used timestamps for threads in localStorage
const THREAD_LAST_USED_KEY = (projectPath) => `embedr-thread-last-used:${projectPath}`;

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

// Auto-grow textarea
const autoGrow = () => {
  if (!textareaRef.value) return;
  textareaRef.value.style.height = 'auto';
  textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px';
};

// Auto-scroll to bottom when messages change
watch(messages, async () => {
  await nextTick();
  if (messagesAreaRef.value) {
    messagesAreaRef.value.scrollTop = messagesAreaRef.value.scrollHeight;
  }
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
      // Deduplicate threads by ID
      const seen = new Set();
      let threads = result.threads
        .map(id => ({ id }))
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

      toolExecutions.value = new Map();
      const toolStarts = loadedMessages.filter(m => m.role === 'tool' && m.toolPhase === 'start');
      console.log(`[CopilotChat Load] Found ${toolStarts.length} tool start messages.`);

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
    availableThreads.value.unshift({ id: newId });
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
  // Optionally, persist the new chat to backend here if needed
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
  }
};

// Handle deleting the current chat
const handleDeleteChat = async () => {
  if (!currentThreadId.value || !props.projectPath) return;
  const threadToDelete = currentThreadId.value;
  const confirmed = window.confirm(`Are you sure you want to delete chat ${threadToDelete.substring(0, 8)}...?`);
  if (!confirmed) return;
  isLoading.value = true;
  chatError.value = '';
  try {
    const result = await window.electronAPI.deleteProjectChat(props.projectPath, threadToDelete);
    if (result.success) {
      availableThreads.value = availableThreads.value.filter(t => t.id !== threadToDelete);
      if (availableThreads.value.length > 0) {
        currentThreadId.value = availableThreads.value[0].id;
        await loadChatMessages(currentThreadId.value);
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
  const userText = userInput.value.trim();
  const imageDataUrl = attachedImage.value.dataUrl;

  // Require either text or an image
  if (!userText && !imageDataUrl) {
    console.log('Cannot send: Missing text or image');
    return;
  }
  if (!currentThreadId.value || !props.projectPath) {
    console.log('Cannot send: Missing threadId or projectPath');
    return;
  }

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
  
  messages.value.push({ role: 'user', content: userMessageContent });
  userInput.value = '';
  removeAttachedImage(); // Clear attached image after adding to message list
  isLoading.value = true;
  chatError.value = '';
  
  // Reset textarea height
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }

  // Start streaming
  window.electronAPI.sendCopilotMessageStream(
    userText, // Send only the text part as the first argument for now
    currentThreadId.value,
    props.projectPath,
    props.selectedBoardFqbn,
    props.selectedPortPath,
    selectedModel.value,
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

// Load threads when component mounts or projectPath changes
onMounted(async () => {
  // If threadId is provided and not present, create/select it before loading threads
  let usedThreadId = null;
  if (props.threadId) {
    // Load threads first to check existence
    await loadAvailableThreads();
    const found = availableThreads.value.find(t => t.id === props.threadId);
    if (!found) {
      // Create the thread
      availableThreads.value.unshift({ id: props.threadId });
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
      selectedModel.value,
      props.homepageImageDataUrl // Pass image data URL
    );

    // Clear localStorage key after sending
    console.log('  Removing embedr-pending-ai-query from localStorage.');
    localStorage.removeItem('embedr-pending-ai-query');
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
      const toolId = `${data.name}-${Date.now()}`;
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
      const toolEntry = Array.from(toolExecutions.value.entries())
        .find(([_, exec]) => exec.name === data.name && exec.loading);
      
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
      // Find the matching tool execution
      const toolEntry = Array.from(toolExecutions.value.entries())
        .find(([_, exec]) => exec.name === data.name && exec.loading);
      
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
  });
});

onUnmounted(() => {
  window.electronAPI.clearCopilotChatStream();
});

watch(() => props.projectPath, (newPath, oldPath) => {
  if (newPath !== oldPath) {
    currentThreadId.value = null;
    messages.value = [];
    loadAvailableThreads();
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

// Persist model selection to localStorage
watch(selectedModel, (newValue) => {
  if (newValue) {
    localStorage.setItem(LOCALSTORAGE_MODEL_KEY, newValue);
  }
});

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
</style> 