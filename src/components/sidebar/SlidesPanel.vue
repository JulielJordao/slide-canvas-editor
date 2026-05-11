<template>
  <div class="slides-panel">
    <div class="slides-header">
      <span class="panel-label">Slides</span>
      <button class="icon-btn" title="Adicionar slide" @click="addSlide">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <div class="slides-list" ref="listEl">
      <div
        v-for="(slide, index) in slides"
        :key="slide.id"
        class="slide-item"
        :class="{ active: index === activeIndex }"
        @click="switchToSlide(index)"
        @contextmenu.prevent="showContextMenu($event, index)"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover.prevent="onDragOver(index)"
        @drop.prevent="onDrop(index)"
      >
        <span class="slide-number">{{ index + 1 }}</span>
        <div class="slide-thumb">
          <img v-if="slide.thumbnailDataUrl" :src="slide.thumbnailDataUrl" alt="" />
          <div v-else class="thumb-placeholder" :style="thumbBgStyle(slide.background)" />
        </div>
      </div>
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu"
        class="ctx-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click.stop
      >
        <button @click="duplicateSlide(contextMenu.index); contextMenu = null">Duplicar</button>
        <button @click="deleteSlide(contextMenu.index); contextMenu = null" class="danger">Excluir</button>
      </div>
    </Teleport>
    <div v-if="contextMenu" class="ctx-backdrop" @click="contextMenu = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useSlidesStore } from '@/stores/slides';
import { generateThumbnail } from '@/composables/useThumbnails';
import type { BackgroundConfig } from '@/types';
import { buildLinearGradient } from '@/utils/colorUtils';

const slidesStore = useSlidesStore();
const slides = computed(() => slidesStore.slides);
const activeIndex = computed(() => slidesStore.activeSlideIndex);

const listEl = ref<HTMLElement | null>(null);
const dragFromIndex = ref(-1);

interface ContextMenuState { x: number; y: number; index: number }
const contextMenu = ref<ContextMenuState | null>(null);

function addSlide() {
  slidesStore.addSlide();
}

function duplicateSlide(index: number) {
  slidesStore.duplicateSlide(index);
}

function deleteSlide(index: number) {
  if (slidesStore.slides.length > 1) {
    slidesStore.removeSlide(slidesStore.slides[index].id);
  }
}

function switchToSlide(index: number) {
  // Save current canvas state before switching
  window.dispatchEvent(new CustomEvent('se:switch-slide', { detail: { index } }));
}

function showContextMenu(e: MouseEvent, index: number) {
  contextMenu.value = { x: e.clientX, y: e.clientY, index };
}

function onDragStart(index: number) {
  dragFromIndex.value = index;
}

function onDragOver(_index: number) {}

function onDrop(toIndex: number) {
  if (dragFromIndex.value === toIndex || dragFromIndex.value === -1) return;
  slidesStore.reorderSlides(dragFromIndex.value, toIndex);
  dragFromIndex.value = -1;
}

function thumbBgStyle(bg: BackgroundConfig): Record<string, string> {
  if (bg.type === 'solid') return { background: bg.color ?? '#fff' };
  if (bg.type === 'linear-gradient' && bg.stops) {
    return { background: buildLinearGradient(bg.stops, bg.angle ?? 90) };
  }
  if (bg.type === 'radial-gradient' && bg.stops) {
    return { background: `radial-gradient(circle, ${bg.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})` };
  }
  if (bg.type === 'image') return { background: '#222' };
  if (bg.type === 'video') return { background: '#111' };
  return { background: '#fff' };
}

// Generate thumbnails when slide JSON or background changes
watch(
  () => slidesStore.slides.map(s => s.fabricJSON + JSON.stringify(s.background)),
  async (newVals, oldVals) => {
    const { width, height } = slidesStore.aspectRatio;
    for (let i = 0; i < slidesStore.slides.length; i++) {
      if (newVals[i] !== oldVals?.[i]) {
        const slide = slidesStore.slides[i];
        const thumb = await generateThumbnail(slide.fabricJSON, slide.background, width, height);
        slidesStore.updateSlideThumbnail(slide.id, thumb);
      }
    }
  },
  { deep: false }
);

// Listen for slide switch event from SlideCanvas
onMounted(() => {
  window.addEventListener('se:switch-slide', (e: Event) => {
    const index = (e as CustomEvent).detail.index;
    slidesStore.activeSlideIndex = index;
  });
});
</script>

<style scoped>
.slides-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.slides-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.slides-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slide-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 2px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.slide-item:hover { background: var(--bg-elevated); }
.slide-item.active {
  border-color: var(--accent);
  background: var(--accent-light);
}

.slide-number {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 16px;
  text-align: center;
}

.slide-thumb {
  flex: 1;
  aspect-ratio: 16 / 9;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.slide-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
}

.ctx-menu {
  position: fixed;
  z-index: 2000;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow);
  min-width: 140px;
}

.ctx-menu button {
  display: block;
  width: 100%;
  padding: 8px 14px;
  text-align: left;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.1s;
}

.ctx-menu button:hover { background: var(--bg-elevated); }
.ctx-menu button.danger { color: var(--danger); }

.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1999;
}
</style>
