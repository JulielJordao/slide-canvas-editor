<template>
  <div class="images-panel" ref="panelRef" :class="{ 'drop-active': isDropOver }">
    <Transition name="fade">
      <div v-if="isDropOver" class="zone-drop-overlay">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>Adicionar às Recentes</span>
      </div>
    </Transition>
    <div class="panel-section">
      <button class="btn btn-secondary w-full" @click="openFilePicker">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Carregar Imagem
      </button>
      <p class="hint">Arraste imagens para o canvas para adicioná-las<br/>ou para este painel para guardar nas Recentes</p>
    </div>

    <div class="panel-section">
      <div class="panel-label">Recentes</div>
      <div v-if="recentImages.length === 0" class="empty-state">
        Nenhuma imagem carregada ainda.
      </div>
      <div class="image-grid" v-else>
        <div
          v-for="img in recentImages"
          :key="img"
          class="image-thumb"
          draggable="true"
          @dragstart="onDragStart($event, img)"
          @click="addImageByPath(img)"
          :title="img.split('/').pop()"
        >
          <img v-if="thumbnailUrls.get(img)" :src="thumbnailUrls.get(img)" :alt="img.split('/').pop()" />
          <div v-else class="thumb-loading" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue';
import { filePathToDataUrl } from '@/utils/fileToDataUrl';
import { useDropZone, IMAGE_EXTS, getExt } from '@/composables/useDragDrop';

const panelRef = ref<HTMLDivElement | null>(null);
const recentImages = ref<string[]>([]);
const thumbnailUrls = reactive(new Map<string, string>());

// Register this panel as a drop zone.  Drops onto the sidebar add the image
// paths to "Recentes" WITHOUT placing them on the canvas — that's the canvas
// zone's job.
const { isOver: isDropOver } = useDropZone(panelRef, (paths) => {
  for (const p of paths) {
    if (!IMAGE_EXTS.has(getExt(p))) continue;
    if (!recentImages.value.includes(p)) recentImages.value.unshift(p);
  }
});

async function loadThumbnail(path: string) {
  if (thumbnailUrls.has(path)) return;
  try {
    const url = await filePathToDataUrl(path);
    thumbnailUrls.set(path, url);
  } catch {
    // ignore failed thumbnails
  }
}

watch(recentImages, (paths) => {
  paths.forEach(loadThumbnail);
}, { immediate: true, deep: true });

async function openFilePicker() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return;
    if (!recentImages.value.includes(path)) recentImages.value.unshift(path);
    window.dispatchEvent(new CustomEvent('se:add-image', { detail: { path } }));
  } catch {
    // Browser mode fallback — single file only
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      window.dispatchEvent(new CustomEvent('se:add-image-url', { detail: { url } }));
    };
    input.click();
  }
}

function onDragStart(e: DragEvent, path: string) {
  e.dataTransfer?.setData('text/x-file-path', path);
}

function addImageByPath(path: string) {
  window.dispatchEvent(new CustomEvent('se:add-image', { detail: { path } }));
}

function onAddImageEvent(e: Event) {
  const path = (e as CustomEvent).detail.path as string;
  if (path && !recentImages.value.includes(path)) recentImages.value.unshift(path);
}

onMounted(() => window.addEventListener('se:add-image', onAddImageEvent));
onUnmounted(() => window.removeEventListener('se:add-image', onAddImageEvent));
</script>

<style scoped>
.images-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  position: relative;
  transition: box-shadow 0.15s;
}
.images-panel.drop-active {
  box-shadow: inset 0 0 0 2px var(--accent);
}

.zone-drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
  z-index: 50;
  text-align: center;
}

.w-full { width: 100%; }

.hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
  text-align: center;
}

.empty-state {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-top: 4px;
}

.image-thumb {
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s;
  background: var(--bg-elevated);
}

.image-thumb:hover { border-color: var(--accent); }

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-loading {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-panel) 50%, var(--bg-elevated) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
