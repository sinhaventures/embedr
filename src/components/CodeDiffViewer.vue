<template>
  <div class="code-diff">
    <div v-for="(part, i) in diffParts" :key="i">
      <template v-for="(line, j) in String(part.value || '').split('\n')" :key="j">
        <div class="diff-row" :class="{
          'line-added': part.added,
          'line-removed': part.removed,
          'line-unchanged': !part.added && !part.removed
        }">
          <span class="gutter old-gutter">
            {{ getOldLineNumber(i, j) }}
          </span>
          <span class="gutter new-gutter">
            {{ getNewLineNumber(i, j) }}
          </span>
          <span class="diff-line">
            <template v-if="line.length > 0">{{ line }}</template>
            <template v-if="j < String(part.value || '').split('\n').length - 1"><br /></template>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watchEffect, computed } from 'vue'
import { diffLines } from 'diff'

const props = defineProps({
  oldCode: { type: String, required: true },
  newCode: { type: String, required: true }
})

const diffParts = ref([])
const oldLineNumbers = ref([])
const newLineNumbers = ref([])

// Computed property to process diff parts for cleaner rendering
const processedDiffParts = computed(() => {
  if (!diffParts.value) return [];
  return diffParts.value.map(part => {
    const all_lines = String(part.value || '').split('\n');
    let lines_to_render;

    // If the part's value ends with a newline, split('\n') creates a trailing empty string.
    // We want to render lines based on content, not this artifact, unless the part is ONLY newlines.
    if (all_lines.length > 1 && all_lines[all_lines.length - 1] === '' && part.value !== '\n') {
      lines_to_render = all_lines.slice(0, -1); 
    } else {
      lines_to_render = all_lines;
    }
    
    // Special case: if a part is truly empty (e.g. an unchanged empty segment), 
    // lines_to_render might be [""] from split. This is correct for rendering one empty line.
    // If part.value was just "" and lines_to_render became [], force it to [""]
    if (part.value === "" && lines_to_render.length === 0) {
      lines_to_render = [""];
    }

    return {
      ...part,
      rendered_lines: lines_to_render
    };
  });
});

watchEffect(() => {
  diffParts.value = diffLines(String(props.oldCode ?? ''), String(props.newCode ?? ''))
  // Build line number arrays for dual gutters
  oldLineNumbers.value = []
  newLineNumbers.value = []
  let oldNum = 1
  let newNum = 1
  for (const part of diffParts.value) {
    const lines = String(part.value || '').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (i === lines.length - 1 && lines[i] === '') continue // skip trailing blank
      if (part.added) {
        oldLineNumbers.value.push('')
        newLineNumbers.value.push(newNum++)
      } else if (part.removed) {
        oldLineNumbers.value.push(oldNum++)
        newLineNumbers.value.push('')
      } else {
        oldLineNumbers.value.push(oldNum++)
        newLineNumbers.value.push(newNum++)
      }
    }
  }
})

function getOldLineNumber(partIdx, lineIdx) {
  // Flattened index
  let idx = 0
  for (let i = 0; i < partIdx; i++) {
    idx += String(diffParts.value[i].value || '').split('\n').filter((l, j, arr) => !(j === arr.length - 1 && l === '')).length
  }
  idx += lineIdx
  return oldLineNumbers.value[idx] || ''
}
function getNewLineNumber(partIdx, lineIdx) {
  let idx = 0
  for (let i = 0; i < partIdx; i++) {
    idx += String(diffParts.value[i].value || '').split('\n').filter((l, j, arr) => !(j === arr.length - 1 && l === '')).length
  }
  idx += lineIdx
  return newLineNumbers.value[idx] || ''
}
</script>

<style scoped>
.code-diff {
  font-family: 'Fira Mono', 'Consolas', monospace;
  background: #1E1E1E; /* Match EditorPage editor background */
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 14px;
}
.diff-row {
  display: flex;
  align-items: flex-start;
}
.gutter {
  width: 3em; /* Adjusted for a bit more space */
  text-align: right;
  padding-right: 1em; /* Space before line content */
  user-select: none;
  color: #858585; /* Match editor line numbers */
}
.old-gutter {
  /* border-right: 1px solid #333; Optional: if border desired */
}
.new-gutter {
  /* border-right: 1px solid #222; Optional: if border desired */
  margin-right: 0.5em; /* Keep a small margin before line content */
}
.diff-line {
  white-space: pre;
  flex: 1;
}
.line-added {
  background: #263927;
  color: #b5f4a5;
}
.line-removed {
  background: #3c1f1e;
  color: #ffb4b4;
}
.line-unchanged {
  background: transparent;
}
</style> 