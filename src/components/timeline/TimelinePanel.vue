<template>
  <div class="timeline-panel">
    <!-- Resize handle — drag to change panel height -->
    <div
      class="resize-handle"
      :class="{ active: isResizing }"
      @mousedown.stop.prevent="startResize"
      title="Arrastar para redimensionar a timeline"
    />

    <!-- Controls bar -->
    <div class="timeline-controls">
      <div class="controls-left">
        <button class="icon-btn" title="Voltar ao início" @click="animStore.stop()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
          </svg>
        </button>
        <button class="icon-btn play-btn" @click="togglePlay">
          <svg v-if="!animStore.isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <span class="time-display">{{ formatMs(animStore.currentTimeMs) }} / {{ formatMs(animStore.totalDurationMs) }}</span>
      </div>

      <div class="controls-center">
        <!-- Mode toggle -->
        <button
          class="mode-btn"
          :class="{ active: animStore.timelineMode === 'slide-based' }"
          @click="animStore.timelineMode = 'slide-based'"
          title="Modo Slide (cada slide tem sua própria timeline)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" y1="4" x2="8" y2="20"/>
          </svg>
          Por Slide
        </button>
        <button
          class="mode-btn"
          :class="{ active: animStore.timelineMode === 'continuous' }"
          @click="animStore.timelineMode = 'continuous'"
          title="Modo Contínuo (um vídeo longo com todos os slides)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="2" y1="12" x2="22" y2="12"/><polyline points="18 8 22 12 18 16"/>
          </svg>
          Contínuo
        </button>
      </div>

      <div class="controls-right">
        <div class="duration-field">
          <span class="field-label">Duração (s):</span>
          <input
            type="number" min="0.5" max="60" step="0.5"
            :value="(animStore.totalDurationMs / 1000).toFixed(1)"
            @change="onDurationChange"
            class="duration-input"
          />
        </div>
        <div class="zoom-btns">
          <button class="icon-btn" @click="zoomBy(-20)" title="Zoom out (Ctrl+Scroll)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <span
            class="zoom-label"
            @dblclick="animStore.setTimelineZoom(100)"
            title="Duplo clique para resetar o zoom"
          >{{ animStore.timelineZoom }}%</span>
          <button class="icon-btn" @click="zoomBy(20)" title="Zoom in (Ctrl+Scroll)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Timeline ruler + tracks -->
    <div class="timeline-body" ref="bodyRef">
      <div class="timeline-left-col" ref="leftColRef">
        <div class="ruler-spacer" />
        <div
          v-for="track in tracks"
          :key="track.id"
          class="track-label"
          :class="{ active: track.id === animStore.selectedEffectObjectId }"
          @click="animStore.selectedEffectObjectId = track.id"
        >
          <div class="track-type-icon">
            <svg v-if="track.type === 'text'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
            </svg>
            <svg v-else-if="track.type === 'image'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </div>
          <span class="track-name">{{ track.label }}</span>
        </div>
        <!-- Background transition row -->
        <div class="track-label transition-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 12h20"/><path d="M12 2v20"/>
          </svg>
          <span class="track-name">Transição</span>
        </div>
      </div>

      <div class="timeline-scroll-area" ref="scrollRef" @scroll="onScrollAreaScroll" @wheel="onScrollAreaWheel">
        <!-- Ruler -->
        <div class="ruler" :style="rulerStyle">
          <div
            v-for="mark in rulerMarks"
            :key="mark.ms"
            class="ruler-mark"
            :style="{ left: `${msToX(mark.ms)}px` }"
          >
            <span class="ruler-label">{{ formatMs(mark.ms) }}</span>
          </div>
          <!-- Playhead -->
          <div
            class="playhead"
            :style="{ left: `${msToX(animStore.currentTimeMs)}px` }"
            @mousedown="startDragPlayhead"
          />
        </div>

        <!-- Tracks -->
        <div
          v-for="track in tracks"
          :key="track.id"
          class="track-row"
          :class="{ active: track.id === animStore.selectedEffectObjectId }"
          :style="{ width: `${timelineWidth}px` }"
          @click="onTrackClick($event, track.id)"
        >
          <!-- Effect bars -->
          <!-- NOTE: @mousemove does NOT use .stop — stopPropagation would
               prevent the window-level onEffectGlobalMouseMove from firing
               while the cursor is over the bar (and the bar follows the
               cursor during drag), so drag updates would never run. -->
          <div
            v-for="effect in track.effects"
            :key="effect.id"
            class="effect-bar"
            :style="effectBarStyle(effect)"
            :title="`${getEffectLabel(effect.type)} (${(effect.startMs/1000).toFixed(1)}s – ${((effect.startMs+effect.durationMs)/1000).toFixed(1)}s)`"
            @mousedown.stop="startDragEffect($event, effect)"
            @mousemove="onEffectHover($event, effect)"
            @mouseleave="onEffectLeave"
            @click.stop
          >
            <div class="effect-handle left" @mousedown.stop="startResizeEffect($event, effect, 'left')" title="Arrastar para redimensionar" />
            <span class="effect-label">{{ getEffectLabel(effect.type) }}</span>
            <button class="effect-remove" @click.stop="removeEffect(effect.id)">×</button>
            <div class="effect-handle right" @mousedown.stop="startResizeEffect($event, effect, 'right')" title="Arrastar para redimensionar" />
          </div>
        </div>

        <!-- Background transition row -->
        <div class="track-row transition-row" :style="{ width: `${timelineWidth}px` }">
          <div
            v-if="slideAnimation?.outTransition && slideAnimation.outTransition.type !== 'none'"
            class="transition-bar"
            :style="transitionBarStyle"
          >{{ slideAnimation.outTransition.type }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useAnimationStore } from '@/stores/animation';
import { useSlidesStore } from '@/stores/slides';
import { useObjectUtils } from '@/composables/useAnimation';
import { ANIMATION_EFFECT_LABELS, type AnimationEffect, type AnimationEffectType } from '@/types';
import * as fabric from 'fabric';
import { nanoid } from 'nanoid';

const animStore = useAnimationStore();
const slidesStore = useSlidesStore();

function getCanvas(): fabric.Canvas | null {
  return (window as any).__slideEditorCanvas ?? null;
}

const { getObjectList, ensureObjectIds } = useObjectUtils(getCanvas);

const bodyRef = ref<HTMLElement | null>(null);
const scrollRef = ref<HTMLElement | null>(null);
const leftColRef = ref<HTMLElement | null>(null);

// ── Vertical scroll sync ────────────────────────────────────────────────────
// The track list (right pane) and label list (left col) must stay aligned when
// there are more tracks than fit.  The right pane owns the scroll; the left
// col mirrors its scrollTop.
function onScrollAreaScroll() {
  if (!scrollRef.value || !leftColRef.value) return;
  leftColRef.value.scrollTop = scrollRef.value.scrollTop;
}

// ── Resize handle ──────────────────────────────────────────────────────────
const isResizing = ref(false);
let resizeStartY = 0;
let resizeStartHeight = 0;

function startResize(e: MouseEvent) {
  isResizing.value = true;
  resizeStartY = e.clientY;
  resizeStartHeight = animStore.timelineHeight;
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
}

function onResizeMove(e: MouseEvent) {
  if (!isResizing.value) return;
  // Dragging UP shrinks the canvas above and GROWS the timeline.
  const dy = resizeStartY - e.clientY;
  animStore.setTimelineHeight(resizeStartHeight + dy);
}

function onResizeUp() {
  if (!isResizing.value) return;
  isResizing.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

const slideAnimation = computed(() => slidesStore.activeSlide?.animation);

const timelineWidth = computed(() =>
  Math.max(600, Math.ceil(animStore.totalDurationMs / 1000) * animStore.timelineZoom + 80)
);

function msToX(ms: number): number {
  return (ms / animStore.totalDurationMs) * (timelineWidth.value - 40) + 20;
}

function xToMs(x: number): number {
  return Math.max(0, Math.min(animStore.totalDurationMs, ((x - 20) / (timelineWidth.value - 40)) * animStore.totalDurationMs));
}

const rulerStyle = computed(() => ({ width: `${timelineWidth.value}px` }));

const rulerMarks = computed(() => {
  const totalPx = timelineWidth.value - 40;
  const pxPerMs = totalPx / animStore.totalDurationMs;
  // Target ~70px between marks; pick the smallest nice step that achieves it.
  const targetGapPx = 70;
  const rawMs = targetGapPx / pxPerMs;
  const niceSteps = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000];
  const step = niceSteps.find(s => s >= rawMs) ?? niceSteps[niceSteps.length - 1];
  const marks = [];
  for (let ms = 0; ms <= animStore.totalDurationMs; ms += step) {
    marks.push({ ms });
  }
  return marks;
});

// Reactive revision counter bumped on every canvas object add/remove (see
// useFabricCanvas).  Without it, `tracks` would not recompute when a saved
// file is loaded: slideAnimation.value updates reactively but
// canvas.getObjects() is a non-reactive call, so the timeline would stay
// empty until the user touched an effect.
const canvasRev = ref(0);
function bumpCanvasRev() { canvasRev.value++; }

const tracks = computed(() => {
  // Touch the revision counter so canvas object add/remove triggers recompute.
  canvasRev.value;
  if (!slideAnimation.value) return [];
  const objectList = getObjectList();
  return objectList.map(obj => ({
    ...obj,
    effects: slideAnimation.value!.effects.filter(e => e.objectId === obj.id),
  }));
});

function getEffectLabel(type: AnimationEffectType): string {
  return ANIMATION_EFFECT_LABELS[type] ?? type;
}

function effectBarStyle(effect: AnimationEffect): Record<string, string> {
  const left = msToX(effect.startMs);
  const width = Math.max(20, (effect.durationMs / animStore.totalDurationMs) * (timelineWidth.value - 40));
  return {
    left: `${left}px`,
    width: `${width}px`,
  };
}

const transitionBarStyle = computed(() => {
  const trans = slideAnimation.value?.outTransition;
  if (!trans) return {};
  const durationMs = trans.durationMs;
  const right = 20;
  const width = (durationMs / animStore.totalDurationMs) * (timelineWidth.value - 40);
  return { right: `${right}px`, width: `${Math.max(20, width)}px` };
});

function formatMs(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return m > 0 ? `${m}:${sec.padStart(4, '0')}` : `${sec}s`;
}

function togglePlay() {
  if (animStore.isPlaying) animStore.pause();
  else {
    ensureObjectIds();
    animStore.play();
  }
}

function onDurationChange(e: Event) {
  const secs = Number((e.target as HTMLInputElement).value);
  if (secs > 0) {
    const ms = Math.round(secs * 1000);
    animStore.setTotalDuration(ms);
    slidesStore.setSlideDuration(slidesStore.activeSlide.id, ms);
    window.dispatchEvent(new CustomEvent('se:commit-history'));
  }
}

// ── Zoom ──────────────────────────────────────────────────────────────────────

function zoomBy(delta: number) {
  animStore.setTimelineZoom(animStore.timelineZoom + delta);
}

// Ctrl+Scroll: zoom centred on the cursor position so the point under the
// mouse stays stationary after the zoom.
async function onScrollAreaWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  if (!scrollRef.value) return;

  const rect = scrollRef.value.getBoundingClientRect();
  const cursorX = e.clientX - rect.left;
  const msAtCursor = xToMs(cursorX + scrollRef.value.scrollLeft);

  // Finer steps at high zoom, coarser at low zoom.
  const step = animStore.timelineZoom >= 200 ? 25 : animStore.timelineZoom >= 80 ? 15 : 8;
  const delta = e.deltaY < 0 ? step : -step;
  animStore.setTimelineZoom(animStore.timelineZoom + delta);

  // Wait for Vue to recompute timelineWidth and repaint the wider/narrower
  // content before we adjust scrollLeft, otherwise it gets clamped.
  await nextTick();
  if (scrollRef.value) {
    scrollRef.value.scrollLeft = Math.max(0, msToX(msAtCursor) - cursorX);
  }
}

// Playhead drag
let isDraggingPlayhead = false;

function startDragPlayhead(e: MouseEvent) {
  isDraggingPlayhead = true;
  e.preventDefault();
}

function onMouseMove(e: MouseEvent) {
  if (!isDraggingPlayhead || !scrollRef.value) return;
  const rect = scrollRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left + (scrollRef.value.scrollLeft ?? 0);
  animStore.seekTo(xToMs(x));
}

function onMouseUp() {
  isDraggingPlayhead = false;
}

function onTrackClick(e: MouseEvent, _objectId: string) {
  if (!scrollRef.value) return;
  const rect = scrollRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left + (scrollRef.value.scrollLeft ?? 0);
  animStore.seekTo(xToMs(x));
}

// ── Effect drag / resize ──────────────────────────────────────────────────────

type DragType = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  type: DragType;
  effect: AnimationEffect;
  startX: number;
  originalStartMs: number;
  originalDurationMs: number;
}

let dragState: DragState | null = null;

function startDragEffect(e: MouseEvent, effect: AnimationEffect) {
  dragState = {
    type: 'move',
    effect,
    startX: e.clientX,
    originalStartMs: effect.startMs,
    originalDurationMs: effect.durationMs,
  };
  // Tell SlideCanvas to suppress per-mutation history pushes for the
  // duration of this drag — see the animation watcher in SlideCanvas.vue.
  window.dispatchEvent(new CustomEvent('se:drag-start'));
  e.preventDefault();
}

function startResizeEffect(e: MouseEvent, effect: AnimationEffect, side: 'left' | 'right') {
  dragState = {
    type: side === 'left' ? 'resize-left' : 'resize-right',
    effect,
    startX: e.clientX,
    originalStartMs: effect.startMs,
    originalDurationMs: effect.durationMs,
  };
  window.dispatchEvent(new CustomEvent('se:drag-start'));
  e.preventDefault();
}

function onEffectGlobalMouseMove(e: MouseEvent) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const totalPx = timelineWidth.value - 40;
  const dms = (dx / totalPx) * animStore.totalDurationMs;
  const id = dragState.effect.id;
  const slideId = slidesStore.activeSlide.id;

  if (dragState.type === 'move') {
    const newStart = Math.max(0, Math.min(
      animStore.totalDurationMs - dragState.originalDurationMs,
      dragState.originalStartMs + dms,
    ));
    slidesStore.updateAnimationEffect(slideId, id, { startMs: Math.round(newStart) });
  } else if (dragState.type === 'resize-left') {
    const endMs = dragState.originalStartMs + dragState.originalDurationMs;
    const newStart = Math.max(0, Math.min(endMs - 100, dragState.originalStartMs + dms));
    slidesStore.updateAnimationEffect(slideId, id, {
      startMs: Math.round(newStart),
      durationMs: Math.round(endMs - newStart),
    });
  } else {
    const maxDuration = animStore.totalDurationMs - dragState.originalStartMs;
    const newDuration = Math.max(100, Math.min(maxDuration, dragState.originalDurationMs + dms));
    slidesStore.updateAnimationEffect(slideId, id, { durationMs: Math.round(newDuration) });
  }
}

function onEffectGlobalMouseUp() {
  if (!dragState) return;
  dragState = null;
  window.dispatchEvent(new CustomEvent('se:drag-end'));
}

function removeEffect(effectId: string) {
  slidesStore.removeAnimationEffect(slidesStore.activeSlide.id, effectId);
  window.dispatchEvent(new CustomEvent('se:commit-history'));
}

// ── Hover preview ─────────────────────────────────────────────────────────────

function onEffectHover(e: MouseEvent, effect: AnimationEffect) {
  if (animStore.isPlaying || dragState) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const ms = effect.startMs + t * effect.durationMs;
  window.dispatchEvent(new CustomEvent('se:preview-time', { detail: { ms } }));
}

function onEffectLeave() {
  if (animStore.isPlaying || dragState) return;
  window.dispatchEvent(new CustomEvent('se:preview-time', { detail: { ms: animStore.currentTimeMs } }));
}

// ─────────────────────────────────────────────────────────────────────────────

// Safety reset: if the user releases the mouse outside the window (blur),
// clear any in-flight drag so the suppression flag doesn't stay stuck.
function onWindowBlur() {
  if (dragState) {
    dragState = null;
    window.dispatchEvent(new CustomEvent('se:drag-end'));
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onEffectGlobalMouseMove);
  window.addEventListener('mouseup', onEffectGlobalMouseUp);
  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup', onResizeUp);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('se:canvas-objects-changed', bumpCanvasRev);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('mousemove', onEffectGlobalMouseMove);
  window.removeEventListener('mouseup', onEffectGlobalMouseUp);
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeUp);
  window.removeEventListener('blur', onWindowBlur);
  window.removeEventListener('se:canvas-objects-changed', bumpCanvasRev);
});
</script>

<style scoped>
.timeline-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border);
  position: relative;
}

/* Resize handle — sits at the very top edge of the panel */
.resize-handle {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  z-index: 30;
  background: transparent;
  transition: background 0.15s;
}
.resize-handle:hover,
.resize-handle.active {
  background: var(--accent);
  opacity: 0.6;
}

.timeline-controls {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  gap: 12px;
  flex-shrink: 0;
  height: 44px;
}

.controls-left, .controls-center, .controls-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.controls-center { flex: 1; justify-content: center; }
.controls-right { justify-content: flex-end; }

.play-btn { color: var(--accent); }

.time-display {
  font-size: 12px;
  font-family: monospace;
  color: var(--text-secondary);
  min-width: 90px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.mode-btn.active { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }
.mode-btn:hover:not(.active) { color: var(--text-primary); }

.duration-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.duration-input {
  width: 56px;
  text-align: center;
  font-size: 12px;
  padding: 3px 6px;
}

.zoom-btns {
  display: flex;
  align-items: center;
  gap: 2px;
}

.zoom-label {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-muted);
  min-width: 36px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  padding: 0 2px;
  border-radius: var(--radius-sm);
  transition: color 0.1s, background 0.1s;
}
.zoom-label:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

/* Timeline body */
.timeline-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.timeline-left-col {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  /* Hide overflow but allow programmatic scrollTop sync with the right pane.
     We hide the scrollbar entirely so only the right side shows one. */
  overflow: hidden;
}

.ruler-spacer { height: 24px; border-bottom: 1px solid var(--border); }

.track-label {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  font-size: 11px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.1s;
  overflow: hidden;
}
.track-label:hover { background: var(--bg-elevated); }
.track-label.active { background: var(--accent-light); color: var(--accent); }
.track-label.transition-label { color: var(--text-muted); font-style: italic; }

.track-type-icon { flex-shrink: 0; }
.track-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.timeline-scroll-area {
  flex: 1;
  overflow-x: scroll; /* always-visible horizontal bar — the primary navigation axis */
  overflow-y: auto;
  position: relative;
}

/* Always-visible, consistently styled scrollbar for the timeline (WebKit/Blink).
   On macOS/Tauri, overlay scrollbars disappear when not in use — using
   ::-webkit-scrollbar forces a persistent track so the user can always grab it. */
.timeline-scroll-area::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}
.timeline-scroll-area::-webkit-scrollbar-track {
  background: var(--bg-elevated);
}
.timeline-scroll-area::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}
.timeline-scroll-area::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.ruler {
  height: 24px;
  background: var(--bg-app);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.ruler-mark {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.ruler-mark::before {
  content: '';
  width: 1px;
  height: 8px;
  background: var(--border);
  margin-top: 4px;
}

.ruler-label {
  font-size: 9px;
  color: var(--text-muted);
  font-family: monospace;
  margin-top: 2px;
  transform: translateX(-50%);
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--danger);
  cursor: ew-resize;
  z-index: 20;
  transform: translateX(-1px);
}

.playhead::after {
  content: '';
  position: absolute;
  top: 0;
  left: -5px;
  width: 12px;
  height: 12px;
  background: var(--danger);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}

.track-row {
  height: 32px;
  border-bottom: 1px solid var(--border);
  position: relative;
  background: var(--bg-panel);
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}
.track-row:nth-child(odd) { background: var(--bg-app); }
.track-row.active {
  background: var(--accent-light) !important;
  box-shadow: inset 3px 0 0 var(--accent);
}
.transition-row { background: var(--bg-elevated) !important; }

.effect-bar {
  position: absolute;
  top: 4px;
  height: 24px;
  background: var(--accent);
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  cursor: grab;
  overflow: visible;
  user-select: none;
  transition: filter 0.1s;
  min-width: 24px;
}
.effect-bar:hover { filter: brightness(1.2); }
.effect-bar:active { cursor: grabbing; }

.effect-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: rgba(255,255,255,0.25);
  border-radius: 2px;
  flex-shrink: 0;
  z-index: 2;
  transition: background 0.1s;
}
.effect-handle:hover { background: rgba(255,255,255,0.55); }
.effect-handle.left { left: 0; border-radius: 4px 0 0 4px; }
.effect-handle.right { right: 0; border-radius: 0 4px 4px 0; }

.effect-label {
  font-size: 10px;
  font-weight: 500;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.effect-remove {
  font-size: 14px;
  line-height: 1;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0 2px;
}
.effect-remove:hover { color: white; }

.transition-bar {
  position: absolute;
  top: 4px;
  height: 24px;
  background: var(--warning);
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 500;
  color: #000;
}
</style>
