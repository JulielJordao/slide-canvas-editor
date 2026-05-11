<template>
  <div>
    <div class="panel-section">
      <div class="panel-label">Opacidade: {{ Math.round(opacity * 100) }}%</div>
      <input type="range" min="0" max="100" :value="Math.round(opacity * 100)" @input="onOpacity" class="range-input" />
    </div>

    <!-- Rounded corners -->
    <div class="panel-section">
      <div class="panel-label">Cantos Arredondados: {{ cornerRadius }}px</div>
      <input type="range" min="0" max="500" :value="cornerRadius" @input="onCornerRadius" class="range-input" />
    </div>

    <!-- Crop -->
    <div class="panel-section">
      <div class="panel-label">Recorte</div>
      <button class="btn btn-secondary w-full" @click="enterCropMode">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 2 6 18 22 18"/><polyline points="2 6 18 6 18 22"/>
        </svg>
        Modo de Corte
      </button>
      <button class="btn btn-ghost w-full" style="margin-top:6px; font-size:12px" @click="resetCrop">
        Resetar Recorte
      </button>
    </div>

    <div class="panel-section">
      <div class="panel-label">Dimensões</div>
      <div class="dims-grid">
        <div class="dim-field">
          <span class="dim-label">L</span>
          <input type="number" :value="Math.round(scaledW)" @change="onWidth" class="number-input" min="1" />
        </div>
        <div class="dim-field">
          <span class="dim-label">A</span>
          <input type="number" :value="Math.round(scaledH)" @change="onHeight" class="number-input" min="1" />
        </div>
      </div>
    </div>

    <div class="panel-section">
      <div class="panel-label">Posição</div>
      <div class="dims-grid">
        <div class="dim-field">
          <span class="dim-label">X</span>
          <input type="number" :value="Math.round(posX)" @change="onPosX" class="number-input" />
        </div>
        <div class="dim-field">
          <span class="dim-label">Y</span>
          <input type="number" :value="Math.round(posY)" @change="onPosY" class="number-input" />
        </div>
      </div>
    </div>

    <div class="panel-section">
      <button class="btn btn-secondary w-full" @click="openAIPanel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
        </svg>
        Editar com IA
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import * as fabric from 'fabric';
import { useUiStore } from '@/stores/ui';
import { useCanvasStore } from '@/stores/canvas';

const props = defineProps<{ canvasGetter: () => fabric.Canvas | null }>();
const uiStore = useUiStore();
const canvasStore = useCanvasStore();

function enterCropMode() {
  canvasStore.cropMode = true;
}

function getObj(): fabric.Image | null {
  return props.canvasGetter()?.getActiveObject() as fabric.Image ?? null;
}
function rerender() { props.canvasGetter()?.requestRenderAll(); }

const opacity = computed(() => getObj()?.opacity ?? 1);
const scaledW = computed(() => getObj()?.getScaledWidth() ?? 100);
const scaledH = computed(() => getObj()?.getScaledHeight() ?? 100);
const posX = computed(() => getObj()?.left ?? 0);
const posY = computed(() => getObj()?.top ?? 0);
const cropX = computed(() => (getObj() as any)?.cropX ?? 0);
const cropY = computed(() => (getObj() as any)?.cropY ?? 0);
const cropWidth = computed(() => (getObj() as any)?.width ?? 0);
const cropHeight = computed(() => (getObj() as any)?.height ?? 0);

const cornerRadius = computed(() => {
  const clip = (getObj() as any)?.clipPath;
  if (!clip || clip.type !== 'rect') return 0;
  return clip.rx ?? 0;
});

function updateClipPath(rx: number) {
  const obj = getObj();
  if (!obj) return;
  const w = (obj as any).width ?? obj.getScaledWidth();
  const h = (obj as any).height ?? obj.getScaledHeight();
  if (rx === 0) {
    (obj as any).set('clipPath', undefined);
  } else {
    const clip = new fabric.Rect({
      width: w,
      height: h,
      rx,
      ry: rx,
      originX: 'center',
      originY: 'center',
    } as Partial<fabric.Rect>);
    (obj as any).set('clipPath', clip);
  }
  rerender();
}

function onCornerRadius(e: Event) {
  updateClipPath(Number((e.target as HTMLInputElement).value));
}

function onOpacity(e: Event) {
  getObj()?.set('opacity', Number((e.target as HTMLInputElement).value) / 100);
  rerender();
}

function onWidth(e: Event) {
  const obj = getObj();
  if (!obj) return;
  obj.scaleToWidth(Number((e.target as HTMLInputElement).value));
  rerender();
}

function onHeight(e: Event) {
  const obj = getObj();
  if (!obj) return;
  obj.scaleToHeight(Number((e.target as HTMLInputElement).value));
  rerender();
}

function onPosX(e: Event) { getObj()?.set('left', Number((e.target as HTMLInputElement).value)); rerender(); }
function onPosY(e: Event) { getObj()?.set('top', Number((e.target as HTMLInputElement).value)); rerender(); }

function onCropX(e: Event) {
  (getObj() as any)?.set('cropX', Number((e.target as HTMLInputElement).value));
  rerender();
}
function onCropY(e: Event) {
  (getObj() as any)?.set('cropY', Number((e.target as HTMLInputElement).value));
  rerender();
}
function onCropWidth(e: Event) {
  (getObj() as any)?.set('width', Number((e.target as HTMLInputElement).value));
  rerender();
}
function onCropHeight(e: Event) {
  (getObj() as any)?.set('height', Number((e.target as HTMLInputElement).value));
  rerender();
}

function resetCrop() {
  const obj = getObj() as any;
  if (!obj) return;
  const el = obj.getElement?.();
  if (el) {
    obj.set({ cropX: 0, cropY: 0, width: el.naturalWidth ?? el.width, height: el.naturalHeight ?? el.height });
    rerender();
  }
}

function openAIPanel() { uiStore.setSidebarTab('ai'); }
</script>

<style scoped>
.range-input { width: 100%; accent-color: var(--accent); }
.w-full { width: 100%; }

.dims-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.dim-field { display: flex; align-items: center; gap: 4px; }
.dim-label { font-size: 11px; color: var(--text-muted); width: 12px; }
.number-input { flex: 1; text-align: center; font-size: 12px; }
</style>
