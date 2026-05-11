<template>
  <header class="top-toolbar">
    <div class="toolbar-left">
      <div class="app-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="3" width="20" height="14" rx="2" fill="#6366f1"/>
          <rect x="8" y="19" width="8" height="2" rx="1" fill="#6366f1"/>
          <rect x="9" y="6" width="6" height="4" rx="1" fill="white" opacity="0.9"/>
        </svg>
        <span class="app-name">Slide Editor</span>
      </div>

      <div class="divider-v" />

      <button class="icon-btn" title="Desfazer (Ctrl+Z)" :disabled="!canUndoNow" @click="handleUndo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
        </svg>
      </button>
      <button class="icon-btn" title="Refazer (Ctrl+Y)" :disabled="!canRedoNow" @click="handleRedo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
        </svg>
      </button>
    </div>

    <div class="toolbar-center">
      <!-- Mode toggle -->
      <div class="mode-toggle">
        <button
          class="mode-btn"
          :class="{ active: !animStore.isAnimationMode }"
          @click="animStore.setMode('design')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" y1="4" x2="8" y2="20"/>
          </svg>
          Design
        </button>
        <button
          class="mode-btn"
          :class="{ active: animStore.isAnimationMode }"
          @click="animStore.setMode('animation')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
          </svg>
          Animação
        </button>
      </div>

      <div class="divider-v" v-if="!animStore.isAnimationMode" />

      <template v-if="!animStore.isAnimationMode">
        <button class="aspect-btn" @click="uiStore.openModal('aspectRatio')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
          </svg>
          {{ aspectRatio.label }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div class="zoom-control">
          <button class="icon-btn" @click="decreaseZoom">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <span class="zoom-value">{{ Math.round(canvasStore.zoom * 100) }}%</span>
          <button class="icon-btn" @click="increaseZoom">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </template>
    </div>

    <div class="toolbar-right">
      <button class="icon-btn" title="Abrir projeto (.sedp)" @click="openFromFile">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <button class="icon-btn" title="Salvar projeto (.sedp)" :disabled="isSavingFile" @click="saveToFile">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      </button>
      <div class="divider-v" />
      <button class="btn btn-secondary" @click="uiStore.openModal('geminiKey')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
        Gemini
      </button>
      <button class="btn btn-primary" @click="uiStore.openModal('export')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Exportar
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCanvasStore } from '@/stores/canvas';
import { useUiStore } from '@/stores/ui';
import { useSlidesStore } from '@/stores/slides';
import { useHistoryStore } from '@/stores/history';
import { useAnimationStore } from '@/stores/animation';
import { save as dialogSave, open as dialogOpen } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

const canvasStore = useCanvasStore();
const uiStore = useUiStore();
const slidesStore = useSlidesStore();
const historyStore = useHistoryStore();
const animStore = useAnimationStore();

const aspectRatio = computed(() => slidesStore.aspectRatio);
const canUndoNow = computed(() => historyStore.canUndo(slidesStore.activeSlide?.id ?? ''));
const canRedoNow = computed(() => historyStore.canRedo(slidesStore.activeSlide?.id ?? ''));

const isSavingFile = ref(false);

function handleUndo() { window.dispatchEvent(new CustomEvent('se:undo')); }
function handleRedo() { window.dispatchEvent(new CustomEvent('se:redo')); }
function increaseZoom() { canvasStore.setZoom(canvasStore.zoom + 0.1); }
function decreaseZoom() { canvasStore.setZoom(canvasStore.zoom - 0.1); }

async function saveToFile() {
  isSavingFile.value = true;
  try {
    const path = await dialogSave({
      title: 'Salvar projeto',
      defaultPath: 'projeto.sedp',
      filters: [{ name: 'Slide Editor Project', extensions: ['sedp'] }],
    });
    if (!path) return;
    // Flush current canvas state before saving
    window.dispatchEvent(new CustomEvent('se:flush-canvas'));
    await new Promise(r => setTimeout(r, 350)); // wait for flush debounce
    const data = JSON.stringify({
      version: 1,
      slides: slidesStore.slides,
      aspectRatio: slidesStore.aspectRatio,
    }, null, 0);
    await writeTextFile(path, data);
  } catch (e) {
    console.error('[SaveFile]', e);
  } finally {
    isSavingFile.value = false;
  }
}

async function openFromFile() {
  try {
    const selected = await dialogOpen({
      title: 'Abrir projeto',
      multiple: false,
      filters: [{ name: 'Slide Editor Project', extensions: ['sedp'] }],
    });
    if (!selected) return;
    const path = typeof selected === 'string' ? selected : selected[0];
    const raw = await readTextFile(path);
    const parsed = JSON.parse(raw);
    if (!parsed.slides?.length) return;
    slidesStore.$patch((state) => {
      state.slides = parsed.slides;
      if (parsed.aspectRatio) state.aspectRatio = parsed.aspectRatio;
      state.activeSlideIndex = 0;
    });
    await new Promise(r => setTimeout(r, 50));
    window.dispatchEvent(new CustomEvent('se:reload-canvas'));
  } catch (e) {
    console.error('[OpenFile]', e);
  }
}
</script>

<style scoped>
.top-toolbar {
  height: 52px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  flex-shrink: 0;
  z-index: 100;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.toolbar-right { justify-content: flex-end; gap: 8px; }

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-logo { display: flex; align-items: center; gap: 8px; padding: 4px 8px; }
.app-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.divider-v { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }

/* Mode toggle */
.mode-toggle {
  display: flex;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px;
  gap: 2px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.mode-btn.active { background: var(--accent); color: white; }
.mode-btn:hover:not(.active) { color: var(--text-primary); background: var(--bg-surface); }

.aspect-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.aspect-btn:hover { background: var(--bg-surface); }

.zoom-control {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.zoom-value {
  font-size: 13px;
  font-weight: 500;
  min-width: 46px;
  text-align: center;
  color: var(--text-primary);
}
</style>
