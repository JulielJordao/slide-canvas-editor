<template>
  <div class="crop-root" v-if="imgBounds">
    <!-- Dark overlay: 4 strips around the crop frame -->
    <div class="overlay-strip top" :style="topStyle" />
    <div class="overlay-strip bottom" :style="bottomStyle" />
    <div class="overlay-strip left" :style="leftStyle" />
    <div class="overlay-strip right" :style="rightStyle" />

    <!-- Crop frame border -->
    <div class="crop-frame" :style="frameStyle">
      <!-- Rule of thirds grid lines -->
      <div class="grid-line h" style="top:33.333%" />
      <div class="grid-line h" style="top:66.666%" />
      <div class="grid-line v" style="left:33.333%" />
      <div class="grid-line v" style="left:66.666%" />

      <!-- 8 resize handles -->
      <div v-for="h in handles" :key="h.cursor"
        class="handle"
        :style="h.style"
        :data-cursor="h.cursor"
        @mousedown.stop="startResize($event, h.dirs)"
      />
    </div>

    <!-- Toolbar at bottom of canvas -->
    <div class="crop-toolbar" :style="toolbarStyle">
      <button class="btn btn-secondary btn-sm" @click="cancel">Cancelar</button>
      <button class="btn btn-primary btn-sm" @click="apply">Aplicar Corte</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/stores/canvas';

const props = defineProps<{ canvasGetter: () => fabric.Canvas | null; canvasW: number; canvasH: number }>();

const canvasStore = useCanvasStore();

// Crop rect in canvas space
const cropRect = ref({ x: 0, y: 0, w: 0, h: 0 });

// Natural image bounds in canvas space (position + displayed size without crop)
const imgBounds = ref<{ x: number; y: number; w: number; h: number } | null>(null);

function getImage(): fabric.Image | null {
  const canvas = props.canvasGetter();
  const obj = canvas?.getActiveObject();
  if (!obj || obj.type !== 'image') return null;
  return obj as fabric.Image;
}

function initBounds() {
  const img = getImage();
  if (!img) return;

  const scaleX = img.scaleX ?? 1;
  const scaleY = img.scaleY ?? 1;
  const el = (img as any)._element as HTMLImageElement | HTMLVideoElement | null;
  const naturalW = el?.naturalWidth ?? (el as HTMLVideoElement)?.videoWidth ?? (img.width ?? 100);
  const naturalH = el?.naturalHeight ?? (el as HTMLVideoElement)?.videoHeight ?? (img.height ?? 100);

  // Current crop offset in natural pixels
  const cx = img.cropX ?? 0;
  const cy = img.cropY ?? 0;
  // Current crop size in natural pixels
  const cw = img.width ?? naturalW;
  const ch = img.height ?? naturalH;

  // Position of top-left of the FULL image in canvas space
  const imgLeft = (img.left ?? 0) - cx * scaleX;
  const imgTop = (img.top ?? 0) - cy * scaleY;

  imgBounds.value = {
    x: imgLeft,
    y: imgTop,
    w: naturalW * scaleX,
    h: naturalH * scaleY,
  };

  // Initial crop frame = current visible area
  cropRect.value = {
    x: img.left ?? 0,
    y: img.top ?? 0,
    w: cw * scaleX,
    h: ch * scaleY,
  };
}

onMounted(() => {
  initBounds();
  const canvas = props.canvasGetter();
  if (canvas) {
    canvas.selection = false;
    canvas.getObjects().forEach(o => { o.selectable = false; o.evented = false; });
  }
});

onUnmounted(() => {
  const canvas = props.canvasGetter();
  if (canvas) {
    canvas.selection = true;
    canvas.getObjects().forEach(o => { o.selectable = true; o.evented = true; });
  }
});

// ── Styles ─────────────────────────────────────────────────────────────────

function px(n: number) { return `${n}px`; }

const topStyle = computed(() => ({
  left: '0', right: '0', top: '0',
  height: px(cropRect.value.y),
}));
const bottomStyle = computed(() => ({
  left: '0', right: '0',
  top: px(cropRect.value.y + cropRect.value.h),
  bottom: '0',
}));
const leftStyle = computed(() => ({
  top: px(cropRect.value.y),
  left: '0',
  width: px(cropRect.value.x),
  height: px(cropRect.value.h),
}));
const rightStyle = computed(() => ({
  top: px(cropRect.value.y),
  left: px(cropRect.value.x + cropRect.value.w),
  right: '0',
  height: px(cropRect.value.h),
}));
const frameStyle = computed(() => ({
  left: px(cropRect.value.x),
  top: px(cropRect.value.y),
  width: px(cropRect.value.w),
  height: px(cropRect.value.h),
}));
const toolbarStyle = computed(() => ({
  left: px(cropRect.value.x),
  top: px(cropRect.value.y + cropRect.value.h + 8),
}));

// Handle positions
const handles = computed(() => {
  const h = [
    { cursor: 'nw-resize', dirs: { n: true, w: true }, style: { top: '-5px', left: '-5px' } },
    { cursor: 'n-resize',  dirs: { n: true },          style: { top: '-5px', left: 'calc(50% - 5px)' } },
    { cursor: 'ne-resize', dirs: { n: true, e: true }, style: { top: '-5px', right: '-5px' } },
    { cursor: 'w-resize',  dirs: { w: true },          style: { top: 'calc(50% - 5px)', left: '-5px' } },
    { cursor: 'e-resize',  dirs: { e: true },          style: { top: 'calc(50% - 5px)', right: '-5px' } },
    { cursor: 'sw-resize', dirs: { s: true, w: true }, style: { bottom: '-5px', left: '-5px' } },
    { cursor: 's-resize',  dirs: { s: true },          style: { bottom: '-5px', left: 'calc(50% - 5px)' } },
    { cursor: 'se-resize', dirs: { s: true, e: true }, style: { bottom: '-5px', right: '-5px' } },
  ];
  return h.map(hh => ({ ...hh, style: { ...hh.style, cursor: hh.cursor } }));
});

// ── Resize drag ─────────────────────────────────────────────────────────────

let dragging: { dirs: any; startX: number; startY: number; startRect: typeof cropRect.value } | null = null;

function startResize(e: MouseEvent, dirs: Record<string, boolean>) {
  dragging = { dirs, startX: e.clientX, startY: e.clientY, startRect: { ...cropRect.value } };
  e.preventDefault();
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function onMouseMove(e: MouseEvent) {
  if (!dragging || !imgBounds.value) return;
  const { dirs, startX, startY, startRect } = dragging;
  const bounds = imgBounds.value;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  let { x, y, w, h } = startRect;
  const minSize = 20;

  if (dirs.n) {
    const newY = clamp(y + dy, bounds.y, y + h - minSize);
    h = h - (newY - y);
    y = newY;
  }
  if (dirs.s) {
    h = clamp(h + dy, minSize, bounds.y + bounds.h - y);
  }
  if (dirs.w) {
    const newX = clamp(x + dx, bounds.x, x + w - minSize);
    w = w - (newX - x);
    x = newX;
  }
  if (dirs.e) {
    w = clamp(w + dx, minSize, bounds.x + bounds.w - x);
  }

  cropRect.value = { x, y, w, h };
}

function onMouseUp() { dragging = null; }

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
});
onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
});

// ── Apply / Cancel ──────────────────────────────────────────────────────────

function apply() {
  const img = getImage();
  if (!img || !imgBounds.value) { cancel(); return; }

  const scaleX = img.scaleX ?? 1;
  const scaleY = img.scaleY ?? 1;
  const cr = cropRect.value;
  const ib = imgBounds.value;

  // Convert canvas-space crop rect to natural image coordinates
  const newCropX = Math.round((cr.x - ib.x) / scaleX);
  const newCropY = Math.round((cr.y - ib.y) / scaleY);
  const newW = Math.round(cr.w / scaleX);
  const newH = Math.round(cr.h / scaleY);

  img.set({
    cropX: Math.max(0, newCropX),
    cropY: Math.max(0, newCropY),
    width: newW,
    height: newH,
    left: cr.x,
    top: cr.y,
  });

  const canvas = props.canvasGetter();
  canvas?.requestRenderAll();
  canvasStore.cropMode = false;
}

function cancel() {
  canvasStore.cropMode = false;
}
</script>

<style scoped>
.crop-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 50;
}

.overlay-strip {
  position: absolute;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.crop-frame {
  position: absolute;
  border: 2px solid white;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
  pointer-events: all;
  cursor: move;
}

.grid-line {
  position: absolute;
  background: rgba(255,255,255,0.3);
}
.grid-line.h { left: 0; right: 0; height: 1px; }
.grid-line.v { top: 0; bottom: 0; width: 1px; }

.handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: white;
  border: 1px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  pointer-events: all;
}

.crop-toolbar {
  position: absolute;
  display: flex;
  gap: 8px;
  pointer-events: all;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 8px;
  box-shadow: var(--shadow);
}

.btn-sm {
  font-size: 12px;
  padding: 4px 12px;
}
</style>
