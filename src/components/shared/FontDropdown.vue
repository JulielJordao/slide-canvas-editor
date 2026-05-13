<template>
  <div class="font-dropdown" ref="rootRef">
    <button
      type="button"
      class="font-trigger"
      :title="modelValue || 'Selecionar fonte'"
      @click="toggleOpen"
    >
      <span class="font-trigger-name" :style="triggerFontStyle">
        {{ modelValue || 'Fonte' }}
      </span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <Transition name="fade">
      <div v-if="open" class="font-popover" :style="popoverStyle">
        <FontPicker @select="onSelect" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import FontPicker from './FontPicker.vue';
import { loadGoogleFont } from '@/utils/fontLoader';

const props = defineProps<{
  modelValue: string;
  /**
   * Where the popover should anchor relative to the trigger.
   * 'below' (default): drops down beneath the trigger.
   * 'auto': flips to 'above' if there isn't room below the viewport.
   */
  placement?: 'below' | 'auto';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select', value: string): void;
}>();

const rootRef = ref<HTMLDivElement | null>(null);
const open = ref(false);
const popoverAbove = ref(false);

// Try to preview the currently-selected font in the trigger itself.  Falls
// back to inherit if the font isn't loaded yet (it's still loading async).
const triggerFontStyle = computed(() => {
  if (!props.modelValue) return {};
  return { fontFamily: `"${props.modelValue}", sans-serif` };
});

const popoverStyle = computed(() => popoverAbove.value
  ? { bottom: '100%', marginBottom: '4px', top: 'auto' }
  : { top: '100%', marginTop: '4px', bottom: 'auto' },
);

function toggleOpen() {
  open.value = !open.value;
}

function close() { open.value = false; }

function onSelect(family: string) {
  emit('update:modelValue', family);
  emit('select', family);
  close();
}

function onDocClick(e: MouseEvent) {
  if (!rootRef.value) return;
  if (!rootRef.value.contains(e.target as Node)) close();
}

watch(open, async (isOpen) => {
  if (!isOpen) return;
  // Decide placement *after* the popover renders, so we have its real size.
  if (props.placement === 'auto' && rootRef.value) {
    await new Promise(r => requestAnimationFrame(r));
    const rect = rootRef.value.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    popoverAbove.value = spaceBelow < 280; // popover ~260px tall
  }
});

// Eagerly load the currently selected font so the trigger label can preview it.
watch(() => props.modelValue, (family) => {
  if (family) loadGoogleFont(family).catch(() => {});
}, { immediate: true });

onMounted(() => document.addEventListener('mousedown', onDocClick));
onUnmounted(() => document.removeEventListener('mousedown', onDocClick));
</script>

<style scoped>
.font-dropdown {
  position: relative;
  display: inline-block;
}

.font-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  min-width: 130px;
  max-width: 180px;
  height: 28px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  transition: border-color 0.15s;
}
.font-trigger:hover { border-color: var(--accent); }

.font-trigger-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.font-popover {
  position: absolute;
  left: 0;
  z-index: 60;
  width: 260px;
  max-width: 80vw;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px;
  box-shadow: var(--shadow);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.12s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
