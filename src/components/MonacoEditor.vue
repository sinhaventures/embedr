<template>
  <div ref="editorContainer" class="editorContainer h-full w-full"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as monaco from 'monaco-editor';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});
const emit = defineEmits(['update:modelValue']);

const editorContainer = ref(null);
let editorInstance = null;
let model = null;
let errorDecorations = [];

onMounted(() => {
  if (editorContainer.value) {
    editorInstance = monaco.editor.create(editorContainer.value, {
      value: props.modelValue,
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
      wordWrap: 'on'
    });
    editorInstance.onDidChangeModelContent(() => {
      emit('update:modelValue', editorInstance.getValue());
    });
  }
});

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose();
  }
});

watch(() => props.modelValue, (newValue) => {
  if (editorInstance && editorInstance.getValue() !== newValue) {
    editorInstance.setValue(newValue);
  }
});

function setErrorLines(lines = []) {
  if (!editorInstance) return;
  model = editorInstance.getModel();
  if (!model) return;
  // Set error markers (for squiggly underline and gutter)
  const markers = lines.map(line => ({
    startLineNumber: line,
    endLineNumber: line,
    startColumn: 1,
    endColumn: model.getLineMaxColumn(line),
    message: 'Error',
    severity: monaco.MarkerSeverity.Error
  }));
  monaco.editor.setModelMarkers(model, 'owner', markers);
  // Set red background highlight using decorations
  if (errorDecorations.length > 0) {
    errorDecorations = editorInstance.deltaDecorations(errorDecorations, []);
  }
  if (lines.length > 0) {
    errorDecorations = editorInstance.deltaDecorations([], lines.map(line => ({
      range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
      options: {
        isWholeLine: true,
        className: 'editor-error-line',
        inlineClassName: '',
        glyphMarginClassName: '',
      }
    })));
  }
}

// Expose layout and error highlighting
defineExpose({ 
  triggerLayout: () => {
    if (editorInstance) {
      editorInstance.layout();
      console.log('[MonacoEditor] Layout triggered');
    }
  },
  setErrorLines
});
</script>

<style scoped>
.editorContainer {
  display: block !important;
  justify-content: flex-start !important;
  align-items: flex-start !important;
  text-align: left !important;
}
</style>

<style>
.editor-error-line {
  background: #ff2d2d !important;
  border-radius: 3px;
  opacity: 0.35;
}
</style> 