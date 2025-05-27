<template>
  <div ref="editorContainer" class="editorContainer h-full w-full"></div>
  <div v-if="showError" ref="errorTooltip" class="editor-error-tooltip">
    <span>{{ errorMessage }}</span>
    <button @click="dismissErrorTooltip" class="error-tooltip-close-btn">&times;</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as monaco from 'monaco-editor';
import { registerCompletion } from 'monacopilot';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  completionInvoker: {
    type: Function,
    required: true
  }
});
const emit = defineEmits(['update:modelValue']);

const editorContainer = ref(null);
let editorInstance = null;
let currentModel = null;
let errorDecorations = [];

const showError = ref(false);
const errorMessage = ref('');
const errorTooltip = ref(null);
let errorTimeout = null;

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

onMounted(async () => {
  if (editorContainer.value) {
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
        strings: true
      },
      suggestOnTriggerCharacters: true
    });

    currentModel.onDidChangeContent(() => {
      emit('update:modelValue', currentModel.getValue());
    });

    // Log the model URI before registering completion
    if (editorInstance && editorInstance.getModel()) {
      // console.log('[MonacoEditor] Model URI before registerCompletion:', editorInstance.getModel().uri.toString());
    } else {
      console.warn('[MonacoEditor] Editor instance or model not available before registerCompletion');
    }

    // Determine the correct endpoint based on the environment
    // Note: Vite uses import.meta.env.DEV for development check in client-side code
    const isDevelopment = import.meta.env.DEV;
    const completionEndpoint = isDevelopment
      ? 'http://127.0.0.1:5001/emdedr-822d0/us-central1/monacopilotProxy'
      : 'https://us-central1-emdedr-822d0.cloudfunctions.net/monacopilotProxy';
    
    // console.log(`[MonacoEditor] Using completion endpoint: ${completionEndpoint}`);

    try {
      // Possible compatibility issue with monaco-editor v0.52.2 and monacopilot
      // See: https://github.com/microsoft/monaco-editor/issues/4702
      
      // Track completion requests to handle race conditions
      let lastRequestId = 0;
      let pendingRequests = {};
      
      registerCompletion(monaco, editorInstance, {
        language: 'cpp',
        filename: 'current_sketch.cpp',
        triggerCharacters: [".", ">", ":", "(", " ", "\\n", ";", "{", "}"],
        triggerMode: 'onChange',
        completionProvider: 'ghost-text',
        docFormat: 'plaintext',
        requestHandler: async ({ body }) => {
          // console.log('[MonacoEditor] requestHandler received body:', JSON.stringify(body, null, 2));
          
          try {
            if (typeof props.completionInvoker !== 'function') {
              console.error('[MonacoEditor] props.completionInvoker is not a function.');
              displayErrorTooltip('Internal error: Completion service invoker not configured.');
              return { completion: null };
            }

            const requestId = ++lastRequestId;
            pendingRequests[requestId] = true;
            
            const result = await props.completionInvoker(body);
            
            if (lastRequestId !== requestId) {
              // console.log(`[MonacoEditor] Ignoring completion from request ${requestId} as newer request ${lastRequestId} exists.`);
              delete pendingRequests[requestId];
              return { completion: null };
            }
            
            delete pendingRequests[requestId];
            
            if (result.error) {
              console.error('[MonacoEditor] Completion API returned an error via invoker:', result.error);
              displayErrorTooltip(result.error); 
              return { completion: null, error: result.error }; 
            }
            
            let finalCompletion = result.completion;
            // console.log("[MonacoEditor] DIAGNOSTIC - Raw completion from backend:", JSON.stringify(finalCompletion));

            if (typeof finalCompletion !== 'string') {
              finalCompletion = null;
              // console.log("[MonacoEditor] DIAGNOSTIC - Completion was not a string, set to null");
            } else {
              if (finalCompletion.length === 0) {
                // console.log("[MonacoEditor] DIAGNOSTIC - Completion is an empty string");
              }
            }

            const successResponse = { completion: finalCompletion };
            // console.log('[MonacoEditor] requestHandler returning to Monacopilot (on success):', successResponse);
            return successResponse;

          } catch (error) {
            console.error('[MonacoEditor] Error invoking completion invoker:', error);
            const message = error instanceof Error ? error.message : 'Unknown error during completion request.';
            displayErrorTooltip(`Failed to get code completion: ${message}`);
            // console.log('[MonacoEditor] requestHandler returning to Monacopilot (on catch):', { completion: null, error: message });
            return { completion: null, error: message };
          }
        },
        onError: (error) => {
          console.error('[MonacoEditor] Monacopilot onError CALLED. Error object:', error);
          const errorMessageText = error && error.message ? error.message : (typeof error === 'string' ? error : 'An error occurred with code completion.');
          displayErrorTooltip(errorMessageText);
        }
      });
      // console.log('[MonacoEditor] Monacopilot registered, using injected invoker for requests.');
    } catch (error) {
      console.error('[MonacoEditor] Failed to register Monacopilot:', error);
      displayErrorTooltip('Autocompletion service failed to initialize.');
    }
  }
});

onBeforeUnmount(() => {
  if (errorTimeout) clearTimeout(errorTimeout);
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
      // console.log('[MonacoEditor] Layout triggered');
    }
  },
  setErrorLines,
  showErrorTooltip: displayErrorTooltip
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
</style>

<style>
.editor-error-line {
  background: #ff2d2d !important;
  border-radius: 3px;
  opacity: 0.35;
}
</style> 