<template>
  <div class="flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
    <!-- Terminal Content -->
    <div ref="serialOutputContainer" class="flex-1 p-4 font-mono text-sm text-white overflow-auto">
      <!-- Connection Status Message -->
      <div 
        v-if="connectionStatusMessage"
        :class="[
          'whitespace-pre-wrap text-left mb-2 px-2 py-1 rounded text-xs',
          connectionStatusType === 'error' ? 'bg-red-700/50 text-red-300 border border-red-500/60' : 
          connectionStatusType === 'info' ? 'bg-blue-700/50 text-blue-300 border border-blue-500/60' : 
          'bg-gray-700/50 text-gray-300 border border-gray-500/60'
        ]"
      >
        {{ connectionStatusMessage }}
      </div>
      <div class="space-y-1">
        <div v-for="(line, index) in serialOutput" :key="index" class="whitespace-pre-wrap text-left">{{ line }}</div>
      </div>
    </div>

    <!-- Bottom Controls -->
    <div class="flex items-center gap-2 p-2 bg-[#2d2d2d] border-t border-[#3d3d3d]">
      <Select
        v-model="baudRate"
        :disabled="isConnected || isConnectionBusy"
      >
        <SelectTrigger class="h-7 w-[120px] bg-[#1e1e1e] border-[#3d3d3d] text-xs">
          <SelectValue placeholder="Baud Rate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="rate in baudRates" :key="rate" :value="rate">{{ rate }}</SelectItem>
        </SelectContent>
      </Select>

      <Button
        @click="toggleConnection"
        size="sm"
        :variant="isConnected ? 'destructive' : 'default'"
        class="h-7 text-xs"
        :disabled="isConnectionBusy || (!isConnected && !props.selectedPortPath)"
      >
        {{ isConnected ? 'Disconnect' : 'Connect' }}
      </Button>

      <div class="flex-1"></div>

      <!-- Add conditional container for buttons -->
      <div v-if="serialOutput.length > 0" class="flex items-center gap-1">
        <Button
          @click="toggleAutoScroll"
          size="sm"
          variant="ghost"
          class="h-7 text-xs"
        >
          {{ autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll' }}
        </Button>
        <Button
          @click="copyOutput"
          size="sm"
          variant="ghost"
          class="h-7 text-xs"
        >
          Copy
        </Button>
        <Button
          @click="clearOutput"
          size="sm"
          variant="ghost"
          class="h-7 text-xs"
        >
          Clear
        </Button>
      </div>
    </div>

    <!-- Input Area -->
    <div class="flex gap-2 p-2 bg-[#2d2d2d] border-t border-[#3d3d3d]">
      <input
        v-model="inputCommand"
        type="text"
        placeholder="Send data..."
        class="flex-1 h-7 px-2 text-xs bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white placeholder:text-[#8f8f8f] focus:outline-none focus:border-[#4d4d4d]"
        @keydown.enter="sendCommand"
        :disabled="!isConnected || isConnectionBusy"
      />
      <Button
        @click="sendCommand"
        size="sm"
        :disabled="!isConnected || isConnectionBusy"
        class="h-7 text-xs"
      >
        Send
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const props = defineProps({
  selectedPortPath: {
    type: String,
    default: ''
  }
});

const activeTab = ref('monitor');
const baudRate = ref(9600);
const isConnected = ref(false);
const inputCommand = ref('');
const serialOutput = ref([]);
const programOutput = ref([]);
const connectionStatusMessage = ref('');
const connectionStatusType = ref('info'); // 'info', 'error', 'success'
const autoScroll = ref(true);
const serialOutputContainer = ref(null);
const isConnectionBusy = ref(false);

const baudRates = [
  300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200
];

const toggleConnection = async () => {
  if (isConnected.value) {
    await handleSerialDisconnect();
  } else {
    await handleSerialConnect();
  }
};

const handleSerialConnect = async () => {
  if (!props.selectedPortPath) {
    connectionStatusMessage.value = 'Select a port first.';
    connectionStatusType.value = 'error';
    return;
  }
  isConnectionBusy.value = true;
  connectionStatusMessage.value = `Connecting to ${props.selectedPortPath}...`;
  connectionStatusType.value = 'info';
  serialOutput.value = []; // Clear previous output
  try {
    const result = await window.electronAPI.connectSerial(props.selectedPortPath, baudRate.value);
    if (!result.success) {
      // Error is handled by onSerialStatus, but set a generic message here if specific error isn't caught by listener
      connectionStatusMessage.value = `Error: ${result.error || 'Failed to connect'}`;
      connectionStatusType.value = 'error';
      isConnected.value = false; // Ensure isConnected is false if electronAPI.connectSerial itself fails
    }
    // Success is handled by onSerialStatus
  } catch (err) {
    console.error('[SerialMonitor] Connect error:', err);
    connectionStatusMessage.value = `Error: ${err.message}`;
    connectionStatusType.value = 'error';
    isConnected.value = false;
  } finally {
    isConnectionBusy.value = false;
  }
};

const handleSerialDisconnect = async () => {
  isConnectionBusy.value = true;
  connectionStatusMessage.value = 'Disconnecting...';
  connectionStatusType.value = 'info';
  try {
    await window.electronAPI.disconnectSerial();
    // Status update will come from onSerialStatus
  } catch (err) {
    console.error('[SerialMonitor] Disconnect error:', err);
    connectionStatusMessage.value = `Error: ${err.message}`;
    connectionStatusType.value = 'error';
  } finally {
    isConnectionBusy.value = false;
    // isConnected will be set by onSerialStatus
  }
};

const sendCommand = () => {
  if (!inputCommand.value.trim() || !isConnected.value) return;
  // Ensure serialOutput is treated as an array of lines for sending
  // serialOutput.value.push(`> ${inputCommand.value}`); 
  // Send via IPC
  window.electronAPI?.sendSerialData(inputCommand.value);
  inputCommand.value = '';
};

const copyOutput = () => {
  const textToCopy = serialOutput.value.join('\n');
  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      // Optional: Add feedback to the user, e.g., temporarily change button text
      console.log('[SerialMonitor] Output copied to clipboard');
    })
    .catch(err => {
      console.error('[SerialMonitor] Failed to copy output:', err);
    });
};

const clearOutput = () => {
  if (activeTab.value === 'monitor') {
    serialOutput.value = [];
  } else {
    programOutput.value = [];
  }
};

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value;
  if (autoScroll.value) {
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (serialOutputContainer.value) {
      serialOutputContainer.value.scrollTop = serialOutputContainer.value.scrollHeight;
    }
  });
};

function handleSerialData(data) {
  serialOutput.value.push(data);
  if (autoScroll.value) {
    scrollToBottom();
  }
}

function handleSerialStatus(status) {
  isConnected.value = status.connected;
  
  if (status.connected) {
    connectionStatusMessage.value = `Connected to ${status.port}`;
    connectionStatusType.value = 'success'; // Or 'info' if preferred for less emphasis
  } else {
    if (status.error) {
      connectionStatusMessage.value = `Error: ${status.error}`;
      connectionStatusType.value = 'error';
    } else if (status.message) {
      connectionStatusMessage.value = status.message;
      connectionStatusType.value = 'info'; // Assume general messages are info
    } else {
      connectionStatusMessage.value = 'Disconnected';
      connectionStatusType.value = 'info';
    }
  }
}

onMounted(() => {
  console.log('[SerialMonitor] Mounted');
  window.electronAPI.onSerialData(handleSerialData);
  window.electronAPI.onSerialStatus(handleSerialStatus);
  if (autoScroll.value) {
    scrollToBottom();
  }
});

onUnmounted(() => {
  console.log('[SerialMonitor] Unmounted');
  window.electronAPI.clearSerialListeners();
  if (isConnected.value) {
    window.electronAPI.disconnectSerial();
  }
});

watch(() => props.selectedPortPath, (newPath, oldPath) => {
  if (isConnected.value && newPath !== oldPath) {
    console.log(`[SerialMonitor] Port changed (${oldPath} -> ${newPath}) while connected. Disconnecting.`);
    handleSerialDisconnect();
  }
  serialOutput.value = []; // Clear output when port changes
  connectionStatusMessage.value = ''; // Clear status message when port changes
  connectionStatusType.value = 'info';
  if (autoScroll.value) {
    scrollToBottom();
  }
});

watch(baudRate, (newBaud, oldBaud) => {
  if (isConnected.value && newBaud !== oldBaud) {
    console.log(`[SerialMonitor] Baud rate changed (${oldBaud} -> ${newBaud}) while connected. Reconnecting.`);
    handleSerialDisconnect().then(() => {
      handleSerialConnect();
    });
  }
});

watch(serialOutput, () => {
  if (autoScroll.value) {
    scrollToBottom();
  }
}, { deep: true });
</script>

<style scoped>
/* Add any specific styles for the Serial Monitor here if needed */
pre {
  font-family: 'Courier New', Courier, monospace;
}

/* Windows 10 and older browser fallbacks for ghost buttons */
.ghost-button-fallback {
  background-color: rgba(45, 45, 45, 0.8) !important;
  border: 1px solid rgba(77, 77, 77, 0.8) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

.ghost-button-fallback:hover {
  background-color: rgba(60, 60, 60, 0.9) !important;
  border-color: rgba(102, 102, 102, 0.9) !important;
  color: white !important;
}

.ghost-button-fallback:disabled {
  background-color: rgba(30, 30, 30, 0.5) !important;
  border-color: rgba(51, 51, 51, 0.5) !important;
  color: rgba(255, 255, 255, 0.3) !important;
  cursor: not-allowed;
}

/* Windows 10 specific adjustments using media queries */
@media screen and (-ms-high-contrast: active), (-ms-high-contrast: none) {
  /* Target IE11/Edge Legacy and Windows 10 Edge */
  button[class*="ghost"] {
    background-color: rgba(45, 45, 45, 0.8) !important;
    border: 1px solid rgba(77, 77, 77, 0.8) !important;
    color: rgba(255, 255, 255, 0.9) !important;
  }
  
  button[class*="ghost"]:hover {
    background-color: rgba(60, 60, 60, 0.9) !important;
    border-color: rgba(102, 102, 102, 0.9) !important;
    color: white !important;
  }
  
  button[class*="ghost"]:disabled {
    background-color: rgba(30, 30, 30, 0.5) !important;
    border-color: rgba(51, 51, 51, 0.5) !important;
    color: rgba(255, 255, 255, 0.3) !important;
  }
}

/* Fallback for browsers that don't support CSS custom properties (var()) */
@supports not (color: var(--bg-background)) {
  button[class*="ghost"] {
    background-color: rgba(45, 45, 45, 0.8) !important;
    border: 1px solid rgba(77, 77, 77, 0.8) !important;
    color: rgba(255, 255, 255, 0.9) !important;
  }
  
  button[class*="ghost"]:hover {
    background-color: rgba(60, 60, 60, 0.9) !important;
    border-color: rgba(102, 102, 102, 0.9) !important;
    color: white !important;
  }
  
  button[class*="ghost"]:disabled {
    background-color: rgba(30, 30, 30, 0.5) !important;
    border-color: rgba(51, 51, 51, 0.5) !important;
    color: rgba(255, 255, 255, 0.3) !important;
  }
}

/* Additional Windows 10 Chrome/Firefox fallbacks */
@media screen and (min-width: 0\0) {
  /* IE9+ */
  button[class*="ghost"] {
    background-color: #2d2d2d !important;
    border: 1px solid #4d4d4d !important;
    color: #e5e5e5 !important;
  }
  
  button[class*="ghost"]:hover {
    background-color: #3c3c3c !important;
    border-color: #666666 !important;
    color: white !important;
  }
}

/* Webkit-specific fallbacks for older Chrome/Safari on Windows */
@media screen and (-webkit-min-device-pixel-ratio: 0) {
  button[class*="ghost"] {
    -webkit-box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    -webkit-transition: all 0.2s ease;
    transition: all 0.2s ease;
  }
  
  button[class*="ghost"]:hover {
    -webkit-transform: translateY(-1px);
    transform: translateY(-1px);
    -webkit-box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
}
</style> 