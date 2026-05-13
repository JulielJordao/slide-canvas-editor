<template>
  <div
    class="canvas-area"
    ref="containerRef"
    :class="{ 'drop-active': isDropOver }"
    @dragover.prevent
    @drop.prevent="handleDrop"
  >
    <div
      class="canvas-wrapper"
      :style="wrapperStyle"
    >
      <canvas ref="canvasEl" />
      <CropOverlay
        v-if="canvasStore.cropMode"
        :canvas-getter="getCanvas"
        :canvas-w="slidesStore.aspectRatio.width"
        :canvas-h="slidesStore.aspectRatio.height"
      />
    </div>

    <!-- Per-zone drop overlay -->
    <Transition name="fade">
      <div v-if="isDropOver" class="zone-drop-overlay">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span>Soltar no canvas</span>
      </div>
    </Transition>

    <!-- Floating context toolbar (always visible unless crop mode) -->
    <ContextToolbar v-if="!canvasStore.cropMode" :canvas-getter="getCanvas" />

    <!-- Right-click effect preview menu -->
    <div v-if="contextMenu" class="ctx-preview"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @mouseleave="contextMenu = null">
      <div class="ctx-title">{{ contextMenu.label }}</div>
      <div v-if="!contextMenu.effects.length" class="ctx-empty">Sem efeitos</div>
      <button v-for="eff in contextMenu.effects" :key="eff.id"
        class="ctx-effect" @click="previewEffect(eff)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        {{ ANIMATION_EFFECT_LABELS[eff.type] }}
        <span class="ctx-dur">{{ (eff.durationMs / 1000).toFixed(1) }}s</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as fabric from 'fabric';
import { filePathToDataUrl } from '@/utils/fileToDataUrl';
import { useFabricCanvas } from '@/composables/useFabricCanvas';
import { useCanvasBackground } from '@/composables/useCanvasBackground';
import { useDragDrop, useDropZone } from '@/composables/useDragDrop';
import { useCanvasStore } from '@/stores/canvas';
import { useSlidesStore } from '@/stores/slides';
import { useHistoryStore } from '@/stores/history';
import { computeScaleFit } from '@/utils/aspectRatio';
import { loadFontsFromJSON } from '@/utils/fontLoader';
import { useAnimation } from '@/composables/useAnimation';
import { useAnimationStore } from '@/stores/animation';
import { nanoid } from 'nanoid';
import { ANIMATION_EFFECT_LABELS, type AnimationEffect } from '@/types';
import { getSelectionColors } from '@/utils/selectionColor';
import ContextToolbar from './ContextToolbar.vue';
import CropOverlay from './CropOverlay.vue';

const containerRef = ref<HTMLDivElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const canvasStore = useCanvasStore();
const slidesStore = useSlidesStore();
const historyStore = useHistoryStore();
const animStore = useAnimationStore();

const {
  initCanvas, getCanvas, getJSON, loadJSON,
  getSnapshot, loadSnapshot,
  pushHistoryNow, scheduleHistoryPush,
  isHistorySuppressed, isDragSuppressed, setInteractiveDrag,
  CUSTOM_PROPS,
} = useFabricCanvas();
const bgComposable = useCanvasBackground(getCanvas);
const { handleFilePaths, addImageToCanvas } = useDragDrop(getCanvas);

// Register the canvas area as a drop zone.  Drops that land inside its
// bounding rect are routed here and added to the Fabric canvas at the
// drop position (mapped from window coords → canvas coords below).
const { isOver: isDropOver } = useDropZone(
  containerRef,
  async (paths) => {
    // Tauri positions are window-local; the canvas math uses its own
    // unscaled coordinate space, so pass undefined and let handleFilePaths
    // center the image (it would be confusing to drop at the exact window
    // pixel since the canvas is scaled).
    await handleFilePaths(paths);
  },
);
const { onCanvasReady, applyTimeMs } = useAnimation(getCanvas);

const scale = ref(1);

function applySelectionColors() {
  const canvas = getCanvas();
  if (!canvas) return;
  const bg = slidesStore.activeSlide?.background;
  if (!bg) return;
  const { borderColor, cornerColor, cornerStrokeColor } = getSelectionColors(bg);
  fabric.Object.prototype.set({
    borderColor,
    cornerColor,
    cornerStrokeColor,
  } as Partial<fabric.Object>);
  canvas.requestRenderAll();
}

interface ContextMenu {
  x: number; y: number;
  label: string;
  effects: AnimationEffect[];
}
const contextMenu = ref<ContextMenu | null>(null);

const wrapperStyle = computed(() => {
  const { width, height } = slidesStore.aspectRatio;
  const s = scale.value * canvasStore.zoom;
  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `scale(${s})`,
    transformOrigin: 'center center',
    position: 'absolute' as const,
    boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
    borderRadius: '4px',
    overflow: 'hidden',
  };
});

let resizeObserver: ResizeObserver | null = null;

function updateScale() {
  if (!containerRef.value) return;
  const { width: cw, height: ch } = containerRef.value.getBoundingClientRect();
  const { width: rw, height: rh } = slidesStore.aspectRatio;
  scale.value = computeScaleFit(cw, ch, rw, rh);
  canvasStore.setContainerSize(cw, ch);
}

async function handleDrop(e: DragEvent) {
  const files = Array.from(e.dataTransfer?.files ?? []);
  if (!files.length) {
    // In-app drag from sidebar (carries text/x-file-path custom data)
    const path = e.dataTransfer?.getData('text/x-file-path');
    if (path) {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      if (['png','jpg','jpeg','webp','gif'].includes(ext)) {
        await addImageToCanvas(await filePathToDataUrl(path));
      }
    }
    return;
  }
  // Browser-only (non-Tauri) file objects — read as data URLs.
  // In Tauri the native tauri://drag-drop event already handles OS filesystem
  // drops via useDragDrop; processing them here a second time causes duplicates.
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if ((file as any).path?.startsWith('/')) continue; // skip OS paths handled by Tauri
    const reader = new FileReader();
    reader.onload = async (ev) => {
      if (ev.target?.result) await addImageToCanvas(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  }
}

async function initializeCanvas() {
  if (!canvasEl.value) return;
  const { width, height } = slidesStore.aspectRatio;
  const canvas = initCanvas(canvasEl.value, width, height, slidesStore.activeSlide.id);

  // Expose canvas globally for components that need direct access
  (window as any).__slideEditorCanvas = canvas;
  // Expose the animation time-application so external flows (video export)
  // can put the canvas into its t=0 state (objects with entry effects hidden)
  // BEFORE recording begins — otherwise the first captured frame shows
  // everything as visible.
  (window as any).__slideEditorApplyTime = applyTimeMs;

  // Load slide JSON first — loadFromJSON resets canvas state, so background
  // must be applied AFTER to avoid being overwritten by whatever was serialised.
  const json = slidesStore.activeSlide.fabricJSON;
  if (json && json !== JSON.stringify({ version: '6.0.0', objects: [] })) {
    await loadFontsFromJSON(json);
    await loadJSON(json);
  }

  // Apply background after loading objects — also ensures video/image
  // backgroundImage is always driven by slide.background (not the JSON).
  await bgComposable.applyBackground(slidesStore.activeSlide.background);

  // Init history for this slide — snapshot includes canvas + animation
  historyStore.initSlide(slidesStore.activeSlide.id, getSnapshot());

  // Register animation cache invalidation on object modify
  onCanvasReady();

  // Apply handle colours that contrast with the current background
  applySelectionColors();

  // Ensure every new object has a name (needed for animation tracking) and
  // sync canvas selection → animation panel.  These listeners must be
  // re-attached on every canvas re-init (e.g. project open / slide switch)
  // because initCanvas disposes the previous instance.
  canvas.on('object:added', (e: any) => {
    const obj = e.target;
    if (obj && !(obj as any).name) (obj as any).name = nanoid(8);
  });
  const syncToTimeline = () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    if (!(obj as any).name) (obj as any).name = nanoid(8);
    animStore.selectedEffectObjectId = (obj as any).name;
  };
  canvas.on('selection:created', syncToTimeline);
  canvas.on('selection:updated', syncToTimeline);
  canvas.on('selection:cleared', () => { animStore.selectedEffectObjectId = ''; });

  // Right-click context menu for effect preview
  const wrapperEl = (canvas as any).wrapperEl as HTMLElement | undefined;
  wrapperEl?.addEventListener('contextmenu', handleCanvasContextMenu);

  // Scroll-reset safety net: CSS in style.css (.canvas-container textarea)
  // is the primary fix (position:fixed!important prevents WKWebView from panning).
  // This resets any residual scroll on entry and exit as a belt-and-suspenders.
  const resetScroll = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  };
  canvas.on('text:editing:entered', resetScroll);
  canvas.on('text:editing:exited', resetScroll);
}

// Watch slide switch
watch(
  () => slidesStore.activeSlideIndex,
  async (newIdx, oldIdx) => {
    const canvas = getCanvas();
    if (!canvas) return;

    // Save current canvas state
    const prevSlide = slidesStore.slides[oldIdx ?? 0];
    if (prevSlide) {
      slidesStore.updateActiveSlideJSON(getJSON());
    }

    // Load new slide
    const newSlide = slidesStore.slides[newIdx];
    if (!newSlide) return;

    await loadFontsFromJSON(newSlide.fabricJSON);
    await loadJSON(newSlide.fabricJSON);
    await bgComposable.applyBackground(newSlide.background);
    applySelectionColors();

    if (!historyStore.canUndo(newSlide.id) && !historyStore.canRedo(newSlide.id)) {
      historyStore.initSlide(newSlide.id, getJSON());
    }
  }
);

// Watch aspect ratio change → reinitialize canvas size
watch(
  () => slidesStore.aspectRatio,
  async () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const { width, height } = slidesStore.aspectRatio;
    canvas.setWidth(width);
    canvas.setHeight(height);
    await bgComposable.applyBackground(slidesStore.activeSlide.background);
    canvas.requestRenderAll();
    updateScale();
  }
);

// Watch background changes — re-apply background and update handle colours
watch(
  () => slidesStore.activeSlide?.background,
  async (bg) => {
    if (bg) {
      await bgComposable.applyBackground(bg);
      applySelectionColors();
    }
  },
  { deep: true }
);

// Undo/redo via events from TopToolbar.
// Uses loadSnapshot so both canvas state AND timeline (animation effects) are
// restored.  Inside loadSnapshot, an isApplyingHistory flag is set so that the
// object:added/removed events fired by Fabric during loadFromJSON do NOT call
// scheduleHistoryPush — which would otherwise clear the future stack and
// permanently break redo.
async function handleUndo() {
  const canvas = getCanvas();
  if (!canvas) return;
  const slideId = slidesStore.activeSlide.id;
  const snapshot = historyStore.undo(slideId);
  if (snapshot) {
    await loadSnapshot(snapshot);
    // Background is stripped from snapshots so it must be re-applied after restore.
    await bgComposable.applyBackground(slidesStore.activeSlide.background);
  }
}

async function handleRedo() {
  const canvas = getCanvas();
  if (!canvas) return;
  const slideId = slidesStore.activeSlide.id;
  const snapshot = historyStore.redo(slideId);
  if (snapshot) {
    await loadSnapshot(snapshot);
    await bgComposable.applyBackground(slidesStore.activeSlide.background);
  }
}

// History for animation changes is pushed explicitly via se:commit-history
// dispatched at the action site (AnimationEffectsPanel, TimelinePanel).
// Drag operations use se:drag-start / se:drag-end to collapse mousemove
// mutations into a single checkpoint on mouse-up.

function handleCommitHistory() {
  if (isHistorySuppressed()) return;
  pushHistoryNow();
}

function handleInteractiveDragStart() {
  setInteractiveDrag(true);
}

function handleInteractiveDragEnd() {
  setInteractiveDrag(false);
  if (!isHistorySuppressed()) pushHistoryNow();
}

// Global keyboard shortcuts
function handleKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

  const canvas = getCanvas();
  if (!canvas) return;

  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    handleUndo();
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    handleRedo();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace')) {
    const active = canvas.getActiveObject();
    if (active && !(active as any).isEditing) {
      if (active.type === 'activeselection') {
        (active as fabric.ActiveSelection).getObjects().forEach(o => canvas.remove(o));
        canvas.discardActiveObject();
      } else {
        canvas.remove(active);
      }
      canvas.requestRenderAll();
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
    e.preventDefault();
    const active = canvas.getActiveObject();
    if (active) {
      active.clone().then((cloned: fabric.Object) => {
        cloned.set({ left: (active.left ?? 0) + 20, top: (active.top ?? 0) + 20 });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
      });
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    e.preventDefault();
    canvas.setActiveObject(new fabric.ActiveSelection(canvas.getObjects(), { canvas }));
    canvas.requestRenderAll();
  }
}

function handleCanvasContextMenu(evt: MouseEvent) {
  evt.preventDefault();
  const canvas = getCanvas();
  if (!canvas) return;
  const el = canvas.lowerCanvasEl as HTMLCanvasElement;
  const rect = el.getBoundingClientRect();
  const sx = canvas.getWidth() / rect.width;
  const sy = canvas.getHeight() / rect.height;
  const cx = (evt.clientX - rect.left) * sx;
  const cy = (evt.clientY - rect.top) * sy;
  const point = new fabric.Point(cx, cy);

  const objs = canvas.getObjects();
  let target: fabric.Object | null = null;
  for (let i = objs.length - 1; i >= 0; i--) {
    if (objs[i].containsPoint(point)) { target = objs[i]; break; }
  }
  if (!target) { contextMenu.value = null; return; }

  const objectId = (target as any).name;
  if (!objectId) return;

  const effects = slidesStore.activeSlide?.animation.effects.filter(e => e.objectId === objectId) ?? [];
  const label = (target as any).text
    ? `"${(target as any).text.slice(0, 20)}"`
    : target.type === 'image' ? 'Imagem' : (target as any).name ?? 'Objeto';

  contextMenu.value = { x: evt.clientX, y: evt.clientY, label, effects };
}

function previewEffect(eff: AnimationEffect) {
  if (!animStore.isPlaying) applyTimeMs(eff.startMs + eff.durationMs / 2);
  contextMenu.value = null;
}

onMounted(async () => {
  await nextTick();
  updateScale();

  resizeObserver = new ResizeObserver(updateScale);
  if (containerRef.value) resizeObserver.observe(containerRef.value);

  await initializeCanvas();

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('se:undo', handleUndo);
  window.addEventListener('se:redo', handleRedo);
  window.addEventListener('click', dismissContextMenu);

  // Eyedropper
  window.addEventListener('se:eyedrop-start', (e: Event) => {
    const callback = (e as CustomEvent).detail.callback as (hex: string) => void;
    const canvas = getCanvas();
    if (!canvas) return;

    const el = canvas.lowerCanvasEl as HTMLCanvasElement;
    el.style.cursor = 'crosshair';

    function onPick(evt: MouseEvent) {
      const rect = el.getBoundingClientRect();
      const sx = canvas!.getWidth() / rect.width;
      const sy = canvas!.getHeight() / rect.height;
      const x = Math.round((evt.clientX - rect.left) * sx);
      const y = Math.round((evt.clientY - rect.top) * sy);
      const ctx = el.getContext('2d')!;
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      callback(hex);
      el.style.cursor = '';
      el.removeEventListener('click', onPick);
    }

    el.addEventListener('click', onPick, { once: true });
  });

  // Listen for image add events from sidebar
  window.addEventListener('se:add-image', async (e: Event) => {
    const path = (e as CustomEvent).detail.path as string;
    const url = await filePathToDataUrl(path);
    await addImageToCanvas(url);
  });
  window.addEventListener('se:add-image-url', async (e: Event) => {
    const url = (e as CustomEvent).detail.url as string;
    await addImageToCanvas(url);
  });

  // Auto-save restore: re-initialize canvas with loaded project data
  window.addEventListener('se:reload-canvas', () => initializeCanvas());

  // Flush current canvas JSON to slides store (used before file-save)
  window.addEventListener('se:flush-canvas', () => {
    const canvas = getCanvas();
    if (canvas) slidesStore.updateActiveSlideJSON(getJSON());
  });

  // Timeline hover preview: seek canvas to the given time without moving the playhead
  window.addEventListener('se:preview-time', handlePreviewTime);

  // Explicit history-commit signal from action sites that need a discrete
  // checkpoint (e.g. timeline drag-end).  Also drag start/end pair from
  // TimelinePanel — see comments on the animation watcher above.
  window.addEventListener('se:commit-history', handleCommitHistory);
  window.addEventListener('se:drag-start', handleInteractiveDragStart);
  window.addEventListener('se:drag-end', handleInteractiveDragEnd);
});

function handlePreviewTime(e: Event) {
  if (!animStore.isPlaying) applyTimeMs((e as CustomEvent).detail.ms);
}

function dismissContextMenu() { contextMenu.value = null; }

onUnmounted(() => {
  resizeObserver?.disconnect();
  bgComposable.stopVideoBackground();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('se:undo', handleUndo);
  window.removeEventListener('se:redo', handleRedo);
  window.removeEventListener('se:preview-time', handlePreviewTime);
  window.removeEventListener('se:commit-history', handleCommitHistory);
  window.removeEventListener('se:drag-start', handleInteractiveDragStart);
  window.removeEventListener('se:drag-end', handleInteractiveDragEnd);
  window.removeEventListener('click', dismissContextMenu);
});
</script>

<style scoped>
.canvas-area {
  flex: 1;
  background: var(--bg-canvas-area);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: box-shadow 0.15s;
}
.canvas-area.drop-active {
  box-shadow: inset 0 0 0 3px var(--accent);
}

.zone-drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
  z-index: 400;
}

.canvas-wrapper {
  cursor: default;
}

.ctx-preview {
  position: fixed;
  z-index: 1000;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px;
  min-width: 170px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ctx-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 2px 4px 6px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 2px;
}

.ctx-empty {
  font-size: 11px;
  color: var(--text-muted);
  padding: 4px;
  text-align: center;
}

.ctx-effect {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  font-size: 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.ctx-effect:hover { background: var(--accent-light); color: var(--accent); }

.ctx-dur {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-muted);
}
</style>
