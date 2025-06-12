<template>
  <div class="tool-execution" :class="{ 
    'loading': loading, 
    'success': success && !isOperationFailed, 
    'error': error || isOperationFailed 
  }">
    <!-- Tool Header -->
    <div class="tool-header">
      <div class="tool-icon">
        <svg v-if="loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <svg v-else-if="success && !isOperationFailed" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </div>
      <div class="tool-name">{{ toolDisplayText }}</div>
    </div>

    <!-- Tool Content -->
    <div v-if="!loading && (success || error)" class="tool-content align-left">
      <!-- Input (if available) -->
      <div v-if="formattedInput" class="tool-input">
        <div class="tool-section-header pb-1">
          <div class="tool-section-label">Input:</div>
          <button 
            @click="toggleInput" 
            class="toggle-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path v-if="isInputExpanded" d="M18 15l-6-6-6 6"/>
              <path v-else d="M6 9l6 6 6-6"/>
            </svg>
            {{ isInputExpanded ? 'Hide' : 'Show' }}
          </button>
        </div>
        <pre v-if="isInputExpanded">{{ formattedInput }}</pre>
      </div>

      <!-- Output (if available) -->
      <div v-if="output" class="tool-output">
        <div class="tool-section-header pb-1">
          <div class="tool-section-label">Output:</div>
          <button 
            @click="copyToClipboard" 
            class="copy-button"
            :class="{ 'copied': isCopied }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            {{ isCopied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <pre>{{ isExpanded ? formattedOutput : truncatedOutput }}</pre>
        <button 
          v-if="shouldShowToggle" 
          @click="toggleExpand" 
          class="expand-toggle"
        >
          {{ isExpanded ? 'Show less' : 'Show more' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  success: {
    type: Boolean,
    default: false
  },
  error: {
    type: Boolean,
    default: false
  },
  input: {
    type: [String, Object],
    default: null
  },
  output: {
    type: [String, Object],
    default: null
  }
});

const CHAR_LIMIT = 200;
const isExpanded = ref(false);
const isInputExpanded = ref(false);
const isCopied = ref(false);

const formatData = (data) => {
  if (typeof data === 'string') return data;
  
  // If data is already an object (not a string)
  if (typeof data === 'object' && data !== null) {
    // Check for lc_kwargs.content
    if (data.lc_kwargs && data.lc_kwargs.content) {
      return data.lc_kwargs.content;
    }
    // Fallback to stringifying the object
    return JSON.stringify(data, null, 2);
  }

  // Try parsing if it's a JSON string
  try {
    const parsed = JSON.parse(data);
    if (parsed.lc_kwargs && parsed.lc_kwargs.content) {
      return parsed.lc_kwargs.content;
    }
    return JSON.stringify(parsed, null, 2);
  } catch (err) {
    console.error('Error parsing data:', err);
    return String(data);
  }
};

const formattedInput = computed(() => {
  if (!props.input) return null;
  return formatData(props.input);
});

const formattedOutput = computed(() => formatData(props.output));

const isCompileFailed = computed(() => {
  const output = formattedOutput.value;
  return output.includes('Compile failed.');
});

const isUploadFailed = computed(() => {
  const output = formattedOutput.value;
  return output.includes('Upload failed.');
});

const isOperationFailed = computed(() => {
  return isCompileFailed.value || isUploadFailed.value;
});

const truncatedOutput = computed(() => {
  const formatted = formattedOutput.value;
  if (formatted.length <= CHAR_LIMIT) return formatted;
  return formatted.slice(0, CHAR_LIMIT) + '...';
});

const shouldShowToggle = computed(() => {
  return formattedOutput.value.length > CHAR_LIMIT;
});

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const toggleInput = () => {
  isInputExpanded.value = !isInputExpanded.value;
};

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(formattedOutput.value);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

// Add computed property for dynamic tool text
const toolDisplayText = computed(() => {
  if (!props.loading) return props.name;
  
  switch (props.name) {
    case 'compileSketch':
      return 'Compiling sketch...';
    case 'uploadSketch':
      return 'Uploading sketch...';
    case 'listBoards':
      return 'Listing boards...';
    case 'listSerialPorts':
      return 'Listing serial ports...';
    case 'connectSerialMonitor':
      return 'Connecting to serial port...';
    case 'disconnectSerialMonitor':
      return 'Disconnecting from serial port...';
    case 'sendSerialData':
      return 'Sending data...';
    case 'getSerialMonitorStatus':
      return 'Getting serial status...';
    case 'modifySketch':
      return 'Modifying sketch...';
    case 'getSketchContent':
      return 'Reading sketch content...';
    default:
      return `${props.name}...`;
  }
});
</script>

<style scoped>
.tool-execution {
  @apply flex flex-col gap-2 p-3 rounded-lg bg-[#1e1e1e] border border-[#2e2e2e] transition-colors duration-200;
}

.tool-execution.loading {
  @apply border-blue-500/30 bg-blue-500/5;
}

.tool-execution.success {
  @apply border-green-500/30 bg-green-500/5;
}

.tool-execution.error {
  @apply border-red-500/30 bg-red-500/5;
}

.tool-header {
  @apply flex items-center gap-2;
}

.tool-icon {
  @apply flex items-center justify-center w-6 h-6 rounded-full bg-[#2e2e2e];
}

.loading .tool-icon {
  @apply text-blue-400;
}

.success .tool-icon {
  @apply text-green-400;
}

.error .tool-icon {
  @apply text-red-400;
}

.tool-name {
  @apply text-sm font-medium text-muted-foreground;
}

.tool-content {
  @apply mt-2 space-y-2 text-left;
}

.tool-section-header {
  @apply flex items-center justify-between mb-1;
}

.tool-section-label {
  @apply text-xs text-muted-foreground text-left;
}

.copy-button, .toggle-button {
  @apply flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200;
  background: none;
  border: none;
  padding: 0;
}

.copy-button.copied {
  @apply text-green-400;
}

.toggle-button:hover {
  @apply text-blue-400;
}

.expand-toggle {
  @apply text-xs text-blue-400 hover:text-blue-300 mt-2 cursor-pointer;
  background: none;
  border: none;
  padding: 0;
}

.tool-output, .tool-input {
  @apply relative;
}

.tool-output pre, .tool-input pre {
  @apply text-xs bg-black/20 p-2 rounded overflow-x-auto text-left;
  text-align: left;
  max-height: v-bind('isExpanded ? "none" : "300px"');
  overflow-y: auto;
}

.tool-output pre {
  @apply text-green-300;
}

.tool-input pre {
  @apply text-blue-300;
}

.error .tool-output pre {
  @apply text-red-300;
}
</style> 