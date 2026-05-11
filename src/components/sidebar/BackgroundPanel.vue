<template>
  <div class="bg-panel">
    <!-- Type selector -->
    <div class="panel-section">
      <div class="panel-label">Tipo de Fundo</div>
      <div class="type-tabs">
        <button
          v-for="t in types"
          :key="t.id"
          class="type-tab"
          :class="{ active: bgType === t.id }"
          @click="setType(t.id as BackgroundType)"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- Solid color -->
    <div v-if="bgType === 'solid'" class="panel-section">
      <div class="panel-label">Cor</div>
      <ColorPicker :model-value="bg.color ?? '#ffffff'" @update:model-value="setSolidColor" />
    </div>

    <!-- Linear gradient -->
    <div v-if="bgType === 'linear-gradient'" class="panel-section">
      <div class="panel-label">Gradiente Linear</div>
      <GradientEditor :stops="bg.stops ?? defaultStops" :angle="bg.angle ?? 90" @update="setGradient" />
    </div>

    <!-- Radial gradient -->
    <div v-if="bgType === 'radial-gradient'" class="panel-section">
      <div class="panel-label">Gradiente Radial</div>
      <GradientEditor :stops="bg.stops ?? defaultStops" :angle="90" :show-angle="false" @update="setRadialGradient" />
    </div>

    <!-- Image -->
    <div v-if="bgType === 'image'" class="panel-section">
      <div class="panel-label">Imagem de Fundo</div>
      <button class="btn btn-secondary w-full" @click="pickBgImage">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Selecionar Imagem
      </button>
      <div v-if="bg.src" class="file-preview">
        <img :src="bgPreviewUrl" alt="" />
        <button class="btn-ghost icon-btn remove-btn" @click="clearBgMedia">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Video -->
    <div v-if="bgType === 'video'" class="panel-section">
      <div class="panel-label">Vídeo de Fundo (.mp4)</div>
      <button class="btn btn-secondary w-full" @click="pickBgVideo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
        Selecionar Vídeo
      </button>
      <div v-if="bg.src" class="file-name">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
        </svg>
        {{ bg.src.split('/').pop() }}
        <button class="icon-btn" @click="clearBgMedia">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import ColorPicker from '@/components/shared/ColorPicker.vue';
import GradientEditor from '@/components/shared/GradientEditor.vue';
import { useSlidesStore } from '@/stores/slides';
import type { BackgroundType, GradientStop } from '@/types';

const slidesStore = useSlidesStore();
const bg = computed(() => slidesStore.activeSlide?.background ?? { type: 'solid', color: '#ffffff' });
const bgType = computed(() => bg.value.type);

const bgPreviewUrl = computed(() => bg.value.src ? convertFileSrc(bg.value.src) : '');

const defaultStops: GradientStop[] = [
  { offset: 0, color: '#6366f1' },
  { offset: 1, color: '#a855f7' },
];

const types = [
  { id: 'solid', label: 'Cor' },
  { id: 'linear-gradient', label: 'Linear' },
  { id: 'radial-gradient', label: 'Radial' },
  { id: 'image', label: 'Imagem' },
  { id: 'video', label: 'Vídeo' },
];

function setType(type: BackgroundType) {
  slidesStore.setBackground({ ...bg.value, type });
}

function setSolidColor(color: string) {
  slidesStore.setBackground({ type: 'solid', color });
}

function setGradient({ stops, angle }: { stops: GradientStop[]; angle: number }) {
  slidesStore.setBackground({ type: 'linear-gradient', stops, angle });
}

function setRadialGradient({ stops }: { stops: GradientStop[] }) {
  slidesStore.setBackground({ type: 'radial-gradient', stops });
}

async function pickBgImage() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (selected && typeof selected === 'string') {
      slidesStore.setBackground({ type: 'image', src: selected });
    }
  } catch {
    alert('File picker requires Tauri runtime');
  }
}

async function pickBgVideo() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      filters: [{ name: 'Video', extensions: ['mp4', 'webm', 'mov'] }],
    });
    if (selected && typeof selected === 'string') {
      slidesStore.setBackground({ type: 'video', src: selected });
    }
  } catch {
    alert('File picker requires Tauri runtime');
  }
}

function clearBgMedia() {
  slidesStore.setBackground({ type: 'solid', color: '#ffffff' });
}

// Listen for drag-drop video events
onMounted(() => {
  window.addEventListener('se:drop-video', (e: Event) => {
    const path = (e as CustomEvent).detail.path as string;
    slidesStore.setBackground({ type: 'video', src: path });
  });
});
</script>

<style scoped>
.bg-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.w-full { width: 100%; }

.type-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.type-tab {
  padding: 7px 4px;
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.type-tab:hover { background: var(--bg-surface); }
.type-tab.active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}

.file-preview {
  position: relative;
  margin-top: 8px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  aspect-ratio: 16/9;
  background: var(--bg-elevated);
}

.file-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0,0,0,0.7);
  border-radius: var(--radius-sm);
}

.file-name {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-name .icon-btn {
  margin-left: auto;
  flex-shrink: 0;
}
</style>
