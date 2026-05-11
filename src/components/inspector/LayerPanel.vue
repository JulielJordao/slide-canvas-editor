<template>
  <div class="layer-panel">
    <div class="panel-section">
      <div class="row-between">
        <div class="panel-label">Camadas</div>
        <span class="layer-count">{{ layers.length }}</span>
      </div>

      <div v-if="layers.length === 0" class="empty-layers">
        Nenhum objeto no canvas.
      </div>

      <div
        class="layer-list"
        v-else
        @dragover.prevent
        @drop.prevent
      >
        <div
          v-for="(layer, displayIdx) in layers"
          :key="layer.id"
          class="layer-item"
          :class="{
            active: selectedIds.includes(layer.id),
            dragging: dragFromIndex === displayIdx,
            'drag-over': dragOverIndex === displayIdx && dragFromIndex !== displayIdx,
          }"
          draggable="true"
          @dragstart="onDragStart(displayIdx, $event)"
          @dragover.prevent="onDragOver(displayIdx)"
          @drop.prevent="onDrop(displayIdx)"
          @dragend="onDragEnd"
          @click="selectObject(layer.id)"
        >
          <div class="drag-handle" @mousedown.stop>
            <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
              <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
              <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
              <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
            </svg>
          </div>
          <div class="layer-icon">
            <svg v-if="layer.type === 'text' || layer.type === 'i-text' || layer.type === 'textbox'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
            </svg>
            <svg v-else-if="layer.type === 'image'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </div>
          <span class="layer-name">{{ layer.label }}</span>
          <div class="layer-actions">
            <button class="icon-btn tiny" title="Para frente" @click.stop="bringForward(layer.id)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
            <button class="icon-btn tiny" title="Para trás" @click.stop="sendBackward(layer.id)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <button class="icon-btn tiny" title="Topo" @click.stop="bringToFront(layer.id)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="3" x2="19" y2="3"/><polyline points="18 9 12 3 6 9"/>
              </svg>
            </button>
            <button class="icon-btn tiny" title="Fundo" @click.stop="sendToBack(layer.id)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="21" x2="19" y2="21"/><polyline points="6 15 12 21 18 15"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/stores/canvas';

const canvasStore = useCanvasStore();
const tick = ref(0);
const dragFromIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function getCanvas(): fabric.Canvas | null {
  return (window as any).__slideEditorCanvas ?? null;
}

const layers = computed(() => {
  void tick.value;
  const canvas = getCanvas();
  if (!canvas) return [];
  return [...canvas.getObjects()].reverse().map(o => ({
    id: (o as any).name ?? (o as any).id ?? '',
    label: getLabelForObject(o),
    type: o.type ?? '',
  }));
});

const selectedIds = computed(() => canvasStore.selectedObjectIds);

function getLabelForObject(o: fabric.Object): string {
  if ((o as any).text) return `"${(o as any).text.slice(0, 18)}"`;
  if (o.type === 'image') return 'Imagem';
  return o.type ?? 'Objeto';
}

function getObjectById(id: string): fabric.Object | undefined {
  const canvas = getCanvas();
  return canvas?.getObjects().find(o => (o as any).name === id || (o as any).id === id);
}

function selectObject(id: string) {
  const canvas = getCanvas();
  const obj = getObjectById(id);
  if (canvas && obj) {
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
  }
}

function bringForward(id: string) {
  const canvas = getCanvas();
  const obj = getObjectById(id);
  if (canvas && obj) { canvas.bringObjectForward(obj); canvas.requestRenderAll(); triggerUpdate(); }
}

function sendBackward(id: string) {
  const canvas = getCanvas();
  const obj = getObjectById(id);
  if (canvas && obj) { canvas.sendObjectBackwards(obj); canvas.requestRenderAll(); triggerUpdate(); }
}

function bringToFront(id: string) {
  const canvas = getCanvas();
  const obj = getObjectById(id);
  if (canvas && obj) { canvas.bringObjectToFront(obj); canvas.requestRenderAll(); triggerUpdate(); }
}

function sendToBack(id: string) {
  const canvas = getCanvas();
  const obj = getObjectById(id);
  if (canvas && obj) { canvas.sendObjectToBack(obj); canvas.requestRenderAll(); triggerUpdate(); }
}

// Moves an object from display-index `from` to display-index `to`.
// Display index 0 = top/front (canvas getObjects() last). Display index n-1 = bottom/back.
function moveLayer(fromDisplayIdx: number, toDisplayIdx: number) {
  const canvas = getCanvas();
  if (!canvas || fromDisplayIdx === toDisplayIdx) return;
  const objects = canvas.getObjects();
  const n = objects.length;
  const canvasFrom = n - 1 - fromDisplayIdx;
  const canvasTo = n - 1 - toDisplayIdx;
  const obj = objects[canvasFrom];
  if (!obj) return;
  const delta = canvasTo - canvasFrom;
  if (delta > 0) {
    for (let i = 0; i < delta; i++) canvas.bringObjectForward(obj);
  } else {
    for (let i = 0; i < -delta; i++) canvas.sendObjectBackwards(obj);
  }
  canvas.requestRenderAll();
  triggerUpdate();
}

function onDragStart(idx: number, e: DragEvent) {
  dragFromIndex.value = idx;
  e.dataTransfer?.setData('text/plain', String(idx));
}

function onDragOver(idx: number) {
  dragOverIndex.value = idx;
}

function onDrop(toIdx: number) {
  if (dragFromIndex.value !== null) {
    moveLayer(dragFromIndex.value, toIdx);
  }
  dragFromIndex.value = null;
  dragOverIndex.value = null;
}

function onDragEnd() {
  dragFromIndex.value = null;
  dragOverIndex.value = null;
}

function triggerUpdate() { tick.value++; }

let canvasListenersSetup = false;

function setupCanvasListeners() {
  const canvas = getCanvas();
  if (!canvas || canvasListenersSetup) return;
  canvas.on('object:added', triggerUpdate);
  canvas.on('object:removed', triggerUpdate);
  canvas.on('object:modified', triggerUpdate);
  canvasListenersSetup = true;
  triggerUpdate();
}

function teardownCanvasListeners() {
  const canvas = getCanvas();
  if (!canvas) return;
  canvas.off('object:added', triggerUpdate);
  canvas.off('object:removed', triggerUpdate);
  canvas.off('object:modified', triggerUpdate);
  canvasListenersSetup = false;
}

function trySetupCanvasListeners(retries = 15) {
  if (canvasListenersSetup) return;
  if (getCanvas()) {
    setupCanvasListeners();
    return;
  }
  if (retries > 0) setTimeout(() => trySetupCanvasListeners(retries - 1), 100);
}

function handleReloadCanvas() {
  teardownCanvasListeners();
  trySetupCanvasListeners();
}

onMounted(() => {
  trySetupCanvasListeners();
  window.addEventListener('se:reload-canvas', handleReloadCanvas);
});

onUnmounted(() => {
  teardownCanvasListeners();
  window.removeEventListener('se:reload-canvas', handleReloadCanvas);
});
</script>

<style scoped>
.layer-panel { display: flex; flex-direction: column; }
.row-between { display: flex; align-items: center; justify-content: space-between; }

.layer-count {
  font-size: 11px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  padding: 1px 6px;
  border-radius: 10px;
}

.empty-layers {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 0;
  text-align: center;
}

.layer-list { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }

.layer-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.1s;
  font-size: 12px;
  user-select: none;
}
.layer-item:hover { background: var(--bg-elevated); }
.layer-item.active { background: var(--accent-light); border-color: var(--accent); }
.layer-item.dragging { opacity: 0.4; }
.layer-item.drag-over {
  border-color: var(--accent);
  background: var(--accent-light);
}

.drag-handle {
  color: var(--text-muted);
  flex-shrink: 0;
  cursor: grab;
  padding: 2px;
  opacity: 0;
  transition: opacity 0.1s;
}
.layer-item:hover .drag-handle { opacity: 1; }

.layer-icon { color: var(--text-muted); flex-shrink: 0; }
.layer-name { flex: 1; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.layer-actions { display: flex; gap: 1px; opacity: 0; transition: opacity 0.1s; }
.layer-item:hover .layer-actions { opacity: 1; }

.icon-btn.tiny { width: 22px; height: 22px; border-radius: 3px; }
</style>
