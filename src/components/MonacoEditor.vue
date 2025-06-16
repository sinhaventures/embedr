<template>
  <div ref="editorContainer" class="editorContainer h-full w-full"></div>
  <div v-if="showError" ref="errorTooltip" class="editor-error-tooltip">
    <span>{{ errorMessage }}</span>
    <button @click="dismissErrorTooltip" class="error-tooltip-close-btn">&times;</button>
  </div>
  <div v-if="showDebugInfo" class="debug-info">
    <div>Pending Requests: {{ pendingRequestCount }}</div>
    <div>Cache Size: {{ cacheSize }}</div>
    <div>Last Completion: {{ lastCompletionTime }}ms</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as monaco from 'monaco-editor';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  completionInvoker: {
    type: Function,
    required: true
  },
  enableDebug: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['update:modelValue']);

const editorContainer = ref(null);
let editorInstance = null;
let currentModel = null;
let errorDecorations = [];
let completionProvider = null;

// Error handling
const showError = ref(false);
const errorMessage = ref('');
const errorTooltip = ref(null);
let errorTimeout = null;

// Debug info
const showDebugInfo = ref(props.enableDebug);
const pendingRequestCount = ref(0);
const cacheSize = ref(0);
const lastCompletionTime = ref(0);

// Advanced completion management
class CompletionManager {
  constructor(completionInvoker) {
    this.completionInvoker = completionInvoker;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.completionCache = new Map();
    this.debounceTimer = null;
    this.lastRequestTime = 0;
    this.isEnabled = true;
    
    // Configuration
    this.config = {
      debounceMs: 150,
      minRequestInterval: 50,
      maxCacheSize: 100,
      cacheExpiryMs: 300000, // 5 minutes
      maxPendingRequests: 3,
      requestTimeoutMs: 10000, // 10 seconds
      retryAttempts: 2,
      retryDelayMs: 1000,
    };
    
    // Cleanup cache periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Every minute
  }

  generateCacheKey(textBeforeCursor, textAfterCursor, language) {
    // Create a more intelligent cache key that considers context
    const before = textBeforeCursor.slice(-200); // Last 200 chars
    const after = textAfterCursor.slice(0, 50); // First 50 chars
    return `${language}:${before}|${after}`;
  }

  getCachedCompletion(cacheKey) {
    const cached = this.completionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheExpiryMs) {
      console.log('[CompletionManager] Cache hit for key:', cacheKey.slice(0, 50) + '...');
      return cached.completion;
    }
    if (cached) {
      this.completionCache.delete(cacheKey);
    }
    return null;
  }

  setCachedCompletion(cacheKey, completion) {
    if (this.completionCache.size >= this.config.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.completionCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < 10; i++) {
        this.completionCache.delete(entries[i][0]);
      }
    }
    
    this.completionCache.set(cacheKey, {
      completion,
      timestamp: Date.now()
    });
    cacheSize.value = this.completionCache.size;
  }

  cleanupCache() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, value] of this.completionCache.entries()) {
      if (now - value.timestamp > this.config.cacheExpiryMs) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.completionCache.delete(key));
    cacheSize.value = this.completionCache.size;
    
    if (toDelete.length > 0) {
      console.log(`[CompletionManager] Cleaned up ${toDelete.length} expired cache entries`);
    }
  }

  async requestCompletion(position, textModel, language = 'cpp') {
    if (!this.isEnabled) {
      return null;
    }

    const currentTime = Date.now();
    
    // Rate limiting
    if (currentTime - this.lastRequestTime < this.config.minRequestInterval) {
      console.log('[CompletionManager] Rate limited, skipping request');
      return null;
    }

    // Get context around cursor
    const textBeforeCursor = textModel.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    });

    const textAfterCursor = textModel.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: textModel.getLineCount(),
      endColumn: textModel.getLineMaxColumn(textModel.getLineCount())
    });

    // Check cache first
    const cacheKey = this.generateCacheKey(textBeforeCursor, textAfterCursor, language);
    const cachedResult = this.getCachedCompletion(cacheKey);
    if (cachedResult !== null) {
      return cachedResult;
    }

    // Prevent too many concurrent requests
    if (this.pendingRequests.size >= this.config.maxPendingRequests) {
      console.log('[CompletionManager] Too many pending requests, skipping');
      return null;
    }

    const requestId = ++this.requestId;
    this.lastRequestTime = currentTime;
    
    console.log(`[CompletionManager] Starting completion request ${requestId}`);
    
    const requestPromise = this.makeCompletionRequest(
      requestId,
      textBeforeCursor,
      textAfterCursor,
      language,
      cacheKey
    );
    
    this.pendingRequests.set(requestId, requestPromise);
    pendingRequestCount.value = this.pendingRequests.size;
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(requestId);
      pendingRequestCount.value = this.pendingRequests.size;
    }
  }

  async makeCompletionRequest(requestId, textBeforeCursor, textAfterCursor, language, cacheKey) {
    const startTime = Date.now();
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.config.requestTimeoutMs)
        );

        const body = {
          completionMetadata: {
            textBeforeCursor,
            textAfterCursor,
            language,
            requestId,
            attempt: attempt + 1
          }
        };

        const completionPromise = this.completionInvoker(body);
        const result = await Promise.race([completionPromise, timeoutPromise]);
        
        lastCompletionTime.value = Date.now() - startTime;
        
        if (result && result.error) {
          throw new Error(result.error);
        }

        const completion = result?.completion;
        
        if (typeof completion === 'string' && completion.length > 0) {
          // Process and clean the completion
          const processedCompletion = this.processCompletion(completion, textBeforeCursor);
          
          // Cache successful result
          this.setCachedCompletion(cacheKey, processedCompletion);
          
          console.log(`[CompletionManager] Request ${requestId} completed successfully in ${Date.now() - startTime}ms`);
          return processedCompletion;
        }
        
        console.log(`[CompletionManager] Request ${requestId} returned empty completion`);
        return null;
        
      } catch (error) {
        console.warn(`[CompletionManager] Request ${requestId} attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === this.config.retryAttempts) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * (attempt + 1)));
      }
    }
  }

  processCompletion(completion, textBeforeCursor) {
    // Remove common prefixes/suffixes that might be duplicated
    let processed = completion;
    
    // Remove leading/trailing whitespace that might conflict with editor state
    processed = processed.trim();
    
    // Handle common cases where LLM might repeat the context
    const lastLine = textBeforeCursor.split('\n').pop() || '';
    const lastWord = lastLine.trim().split(/\s+/).pop() || '';
    
    if (lastWord && processed.startsWith(lastWord)) {
      processed = processed.slice(lastWord.length);
    }
    
    // Remove any trailing semicolons if the context already ends with one
    if (textBeforeCursor.trim().endsWith(';') && processed.endsWith(';')) {
      processed = processed.slice(0, -1);
    }
    
    return processed;
  }

  disable() {
    this.isEnabled = false;
    // Cancel all pending requests
    this.pendingRequests.clear();
    pendingRequestCount.value = 0;
  }

  enable() {
    this.isEnabled = true;
  }

  destroy() {
    this.disable();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.completionCache.clear();
    cacheSize.value = 0;
  }
}

let completionManager = null;

function displayErrorTooltip(message) {
  errorMessage.value = message;
  showError.value = true;
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => {
    showError.value = false;
  }, 8000);
}

function dismissErrorTooltip() {
  showError.value = false;
  if (errorTimeout) clearTimeout(errorTimeout);
}

function createCustomCompletionProvider() {
  return {
    triggerCharacters: ['.', '>', ':', '(', ' ', ';', '{', '}', '\n'],
    
    provideCompletionItems: async (model, position, context, token) => {
      if (!completionManager || token.isCancellationRequested) {
        return { suggestions: [] };
      }

      try {
        // Skip completion for certain contexts
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforePosition = lineContent.substring(0, position.column - 1);
        
        // Skip if we're in a comment
        if (textBeforePosition.includes('//') || 
            (textBeforePosition.includes('/*') && !textBeforePosition.includes('*/'))) {
          return { suggestions: [] };
        }
        
        // Skip if we're in a string literal
        const stringMatches = textBeforePosition.match(/"/g);
        if (stringMatches && stringMatches.length % 2 === 1) {
          return { suggestions: [] };
        }

        const completion = await completionManager.requestCompletion(position, model, 'cpp');
        
        if (token.isCancellationRequested || !completion) {
          return { suggestions: [] };
        }

        // Create Monaco suggestion
        const suggestion = {
          label: completion.slice(0, 50) + (completion.length > 50 ? '...' : ''),
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: completion,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.None,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column,
            endColumn: position.column
          },
          detail: 'AI Completion',
          documentation: 'AI-generated code completion',
          sortText: '0000', // High priority
          filterText: completion
        };

        return {
          suggestions: [suggestion],
          incomplete: false
        };
        
      } catch (error) {
        console.error('[CustomCompletionProvider] Error providing completions:', error);
        // Don't show network/API errors to users, only log them
        // displayErrorTooltip(`Code completion error: ${error.message}`);
        return { suggestions: [] };
      }
    }
  };
}

onMounted(async () => {
  if (editorContainer.value) {
    // Initialize completion manager
    completionManager = new CompletionManager(props.completionInvoker);
    
    currentModel = monaco.editor.createModel(
      props.modelValue,
      'cpp',
      monaco.Uri.file('current_sketch.cpp')
    );

    editorInstance = monaco.editor.create(editorContainer.value, {
      model: currentModel,
      language: 'cpp',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: {
        enabled: false
      },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      roundedSelection: true,
      selectOnLineNumbers: true,
      wordWrap: 'on',
      renderWhitespace: 'none',
      renderControlCharacters: false,
      renderIndentGuides: false,
      renderValidationDecorations: 'on',
      acceptSuggestionOnEnter: 'smart',
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false
      },
      suggestOnTriggerCharacters: true,
      wordBasedSuggestions: 'off', // Disable built-in word-based suggestions for better AI completion
      suggest: {
        showWords: false,
        showSnippets: true,
        showFunctions: true,
        showKeywords: true,
        showMethods: true,
        showProperties: true,
        showClasses: true,
        showInterfaces: true,
        showModules: true,
        showReferences: true,
        insertMode: 'replace',
        filterGraceful: true,
        localityBonus: true,
        shareSuggestSelections: false
      }
    });

    currentModel.onDidChangeContent(() => {
      emit('update:modelValue', currentModel.getValue());
    });

    // Register custom completion provider
    try {
      completionProvider = monaco.languages.registerCompletionItemProvider('cpp', createCustomCompletionProvider());
      console.log('[MonacoEditor] Custom completion provider registered successfully');
    } catch (error) {
      console.error('[MonacoEditor] Failed to register completion provider:', error);
      // Don't show initialization errors to users, only log them
      // displayErrorTooltip('Failed to initialize AI code completion');
    }

    // Additional editor event handlers for better UX
    editorInstance.onDidChangeCursorPosition(() => {
      // Clear error decorations when cursor moves
      if (errorDecorations.length > 0) {
        const newDecorations = errorDecorations.filter(decoration => {
          const range = editorInstance.getModel().getDecorationRange(decoration);
          const currentPosition = editorInstance.getPosition();
          return range && (
            currentPosition.lineNumber < range.startLineNumber ||
            currentPosition.lineNumber > range.endLineNumber
          );
        });
        
        if (newDecorations.length !== errorDecorations.length) {
          errorDecorations = editorInstance.deltaDecorations(errorDecorations, []);
        }
      }
    });

    console.log('[MonacoEditor] Robust completion system initialized');
  }
});

onBeforeUnmount(() => {
  if (errorTimeout) clearTimeout(errorTimeout);
  
  if (completionManager) {
    completionManager.destroy();
    completionManager = null;
  }
  
  if (completionProvider) {
    completionProvider.dispose();
    completionProvider = null;
  }
  
  if (editorInstance) {
    editorInstance.dispose();
  }
  
  if (currentModel) {
    currentModel.dispose();
  }
});

watch(() => props.modelValue, (newValue) => {
  if (currentModel && currentModel.getValue() !== newValue) {
    currentModel.setValue(newValue);
  }
});

function setErrorLines(lines = []) {
  if (!editorInstance) return;
  if (!currentModel) return;
  
  const markers = lines.map(line => ({
    startLineNumber: line,
    endLineNumber: line,
    startColumn: 1,
    endColumn: currentModel.getLineMaxColumn(line),
    message: 'Error',
    severity: monaco.MarkerSeverity.Error
  }));
  
  monaco.editor.setModelMarkers(currentModel, 'owner', markers);
  
  if (errorDecorations.length > 0) {
    errorDecorations = editorInstance.deltaDecorations(errorDecorations, []);
  }
  
  if (lines.length > 0) {
    errorDecorations = editorInstance.deltaDecorations([], lines.map(line => ({
      range: new monaco.Range(line, 1, line, currentModel.getLineMaxColumn(line)),
      options: {
        isWholeLine: true,
        className: 'editor-error-line',
        inlineClassName: '',
        glyphMarginClassName: '',
      }
    })));
  }
}

defineExpose({ 
  triggerLayout: () => {
    if (editorInstance) {
      editorInstance.layout();
      console.log('[MonacoEditor] Layout triggered');
    }
  },
  setErrorLines,
  showErrorTooltip: displayErrorTooltip,
  toggleDebugInfo: () => {
    showDebugInfo.value = !showDebugInfo.value;
  },
  getCompletionStats: () => ({
    pendingRequests: pendingRequestCount.value,
    cacheSize: cacheSize.value,
    lastCompletionTime: lastCompletionTime.value
  }),
  enableCompletion: () => {
    if (completionManager) completionManager.enable();
  },
  disableCompletion: () => {
    if (completionManager) completionManager.disable();
  }
});
</script>

<style scoped>
.editorContainer {
  display: block;
  justify-content: flex-start;
  align-items: flex-start;
  text-align: left;
  position: relative;
}

.editor-error-tooltip {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #424242;
  color: #f0f0f0;
  padding: 10px 15px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 1000;
  font-size: 0.9em;
  max-width: 300px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-tooltip-close-btn {
  background: none;
  border: none;
  color: #f0f0f0;
  font-size: 1.2em;
  margin-left: 10px;
  cursor: pointer;
  padding: 0 5px;
}

.debug-info {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #f0f0f0;
  padding: 10px;
  border-radius: 5px;
  font-family: monospace;
  font-size: 0.8em;
  z-index: 1001;
}

.debug-info div {
  margin: 2px 0;
}
</style>

<style>
.editor-error-line {
  background: #ff2d2d !important;
  border-radius: 3px;
  opacity: 0.35;
}

/* Improve completion suggestion styling */
.monaco-editor .suggest-widget {
  border: 1px solid #454545;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.monaco-editor .suggest-widget .monaco-list .monaco-list-row {
  border-bottom: 1px solid #333;
}

.monaco-editor .suggest-widget .monaco-list .monaco-list-row.focused {
  background-color: #094771;
}
</style> 