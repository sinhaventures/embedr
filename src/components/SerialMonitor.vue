<template>
  <div class="flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
    <!-- Terminal Content -->
    <div class="flex-1 p-4 font-mono text-sm text-white overflow-auto">
      <div class="space-y-1">
        <div v-for="(line, index) in serialOutput" :key="index" class="whitespace-pre-wrap">{{ line }}</div>
      </div>
    </div>

    <!-- Bottom Controls -->
    <div class="flex items-center gap-2 p-2 bg-[#2d2d2d] border-t border-[#3d3d3d]">
      <Select
        v-model="baudRate"
        :disabled="isConnected"
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
      >
        {{ isConnected ? 'Disconnect' : 'Connect' }}
      </Button>

      <div class="flex-1"></div>

      <!-- Add conditional container for buttons -->
      <div v-if="serialOutput.length > 0" class="flex items-center gap-1">
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
        :disabled="!isConnected"
      />
      <Button
        @click="sendCommand"
        size="sm"
        :disabled="!isConnected"
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
    return;
  }
  console.log(`[SerialMonitor] Attempting to connect to ${props.selectedPortPath} at ${baudRate.value}`);
  isConnected.value = true;
  connectionStatusMessage.value = 'Connecting...';
  serialOutput.value = [];
  try {
    const result = await window.electronAPI.connectSerial(props.selectedPortPath, baudRate.value);
    if (!result.success) {
      throw new Error(result.error || 'Failed to connect');
    }
  } catch (err) {
    console.error('[SerialMonitor] Connect error:', err);
    connectionStatusMessage.value = `Error: ${err.message}`;
    isConnected.value = false;
  }
};

const handleSerialDisconnect = async () => {
  console.log('[SerialMonitor] Disconnecting...');
  isConnected.value = true;
  connectionStatusMessage.value = 'Disconnecting...';
  try {
    await window.electronAPI.disconnectSerial();
  } catch (err) {
    console.error('[SerialMonitor] Disconnect error:', err);
    connectionStatusMessage.value = `Error: ${err.message}`;
  } finally {
    isConnected.value = false;
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

function handleSerialData(data) {
  serialOutput.value.push(data);
}

function handleSerialStatus(status) {
  isConnected.value = status.connected;
  
  if (status.connected) {
    connectionStatusMessage.value = `Connected to ${status.port}`;
  } else {
    if (status.error) {
      connectionStatus.value = `Error: ${status.error}`;
    } else if (status.message) {
      connectionStatusMessage.value = status.message;
    } else {
      connectionStatusMessage.value = 'Disconnected';
    }
  }
}

onMounted(() => {
  console.log('[SerialMonitor] Mounted');
  window.electronAPI.onSerialData(handleSerialData);
  window.electronAPI.onSerialStatus(handleSerialStatus);
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
  connectionStatusMessage.value = '';
});

watch(baudRate, (newBaud, oldBaud) => {
  if (isConnected.value && newBaud !== oldBaud) {
    console.log(`[SerialMonitor] Baud rate changed (${oldBaud} -> ${newBaud}) while connected. Reconnecting.`);
    handleSerialDisconnect().then(() => {
      handleSerialConnect();
    });
  }
});
</script>

<style scoped>
/* Add any specific styles for the Serial Monitor here if needed */
pre {
  font-family: 'Courier New', Courier, monospace;
}
</style> 