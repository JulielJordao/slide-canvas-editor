<template>
  <div>
    <div class="panel-section">
      <div class="panel-label">Fonte</div>
      <FontPicker @select="onFontSelect" />
    </div>

    <div class="panel-section">
      <div class="row">
        <div class="field-group flex1">
          <div class="field-label">Tamanho</div>
          <input type="number" :value="fontSize" @change="onFontSize" min="6" max="800" step="1" class="number-input" />
        </div>
        <div class="field-group" style="margin-left: 8px">
          <div class="field-label">Espaç. Letras</div>
          <input type="number" :value="charSpacing" @change="onCharSpacing" min="-200" max="1000" step="10" class="number-input" />
        </div>
      </div>
    </div>

    <div class="panel-section">
      <div class="panel-label">Cor</div>
      <ColorPicker :model-value="fillColor" @update:model-value="onFill" />
    </div>

    <div class="panel-section">
      <div class="panel-label">Estilo</div>
      <div class="style-btns">
        <button class="icon-btn" :class="{ active: fontWeight === 'bold' }" @click="toggleBold" title="Bold">
          <strong style="font-size: 14px">B</strong>
        </button>
        <button class="icon-btn" :class="{ active: fontStyle === 'italic' }" @click="toggleItalic" title="Itálico">
          <em style="font-size: 14px">I</em>
        </button>
        <button class="icon-btn" :class="{ active: underline }" @click="toggleUnderline" title="Sublinhado">
          <span style="text-decoration: underline; font-size: 14px">U</span>
        </button>
      </div>
      <div class="align-btns" style="margin-top: 6px">
        <button class="icon-btn" :class="{ active: textAlign === 'left' }" @click="setAlign('left')" title="Esq.">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
          </svg>
        </button>
        <button class="icon-btn" :class="{ active: textAlign === 'center' }" @click="setAlign('center')" title="Centro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
        </button>
        <button class="icon-btn" :class="{ active: textAlign === 'right' }" @click="setAlign('right')" title="Dir.">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Stroke (Contorno) -->
    <div class="panel-section">
      <div class="row-between">
        <div class="panel-label">Contorno</div>
        <label class="toggle">
          <input type="checkbox" :checked="strokeEnabled" @change="toggleStroke" />
          <span class="toggle-track"></span>
        </label>
      </div>
      <template v-if="strokeEnabled">
        <div class="row" style="gap: 8px; margin-top: 8px">
          <div class="field-group flex1">
            <div class="field-label">Cor</div>
            <ColorPicker :model-value="strokeColor" @update:model-value="onStrokeColor" />
          </div>
        </div>
        <div class="row" style="gap: 8px; margin-top: 8px">
          <div class="field-group flex1">
            <div class="field-label">Espessura: {{ strokeWidth }}</div>
            <input type="range" min="1" max="20" :value="strokeWidth" @input="onStrokeWidth" class="range-input" />
          </div>
        </div>
      </template>
    </div>

    <!-- Shadow -->
    <div class="panel-section">
      <div class="row-between">
        <div class="panel-label">Sombra</div>
        <label class="toggle">
          <input type="checkbox" :checked="shadowEnabled" @change="toggleShadow" />
          <span class="toggle-track"></span>
        </label>
      </div>
      <template v-if="shadowEnabled">
        <div class="row" style="gap: 8px; margin-top: 8px">
          <div class="field-group flex1">
            <div class="field-label">Cor</div>
            <ColorPicker :model-value="shadowColor" @update:model-value="onShadowColor" />
          </div>
        </div>
        <div class="row" style="gap: 8px; margin-top: 8px">
          <div class="field-group flex1">
            <div class="field-label">Desfoque: {{ shadowBlur }}</div>
            <input type="range" min="0" max="40" :value="shadowBlur" @input="onShadowBlur" class="range-input" />
          </div>
        </div>
        <div class="row" style="gap: 8px; margin-top: 8px">
          <div class="field-group flex1">
            <div class="field-label">X: {{ shadowOffsetX }}</div>
            <input type="range" min="-40" max="40" :value="shadowOffsetX" @input="onShadowOffsetX" class="range-input" />
          </div>
          <div class="field-group flex1">
            <div class="field-label">Y: {{ shadowOffsetY }}</div>
            <input type="range" min="-40" max="40" :value="shadowOffsetY" @input="onShadowOffsetY" class="range-input" />
          </div>
        </div>
      </template>
    </div>

    <div class="panel-section">
      <div class="panel-label">Opacidade: {{ Math.round(opacity * 100) }}%</div>
      <input type="range" min="0" max="100" :value="Math.round(opacity * 100)" @input="onOpacity" class="range-input" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import * as fabric from 'fabric';
import FontPicker from '@/components/shared/FontPicker.vue';
import ColorPicker from '@/components/shared/ColorPicker.vue';
import { loadGoogleFont } from '@/utils/fontLoader';
import { useSettingsStore } from '@/stores/settings';
import { useCanvasStore } from '@/stores/canvas';

const props = defineProps<{ canvasGetter: () => fabric.Canvas | null }>();
const settings = useSettingsStore();
const canvasStore = useCanvasStore();

// Fabric objects are not Vue-reactive, so mutating one via obj.set() triggers
// no re-evaluation of the computeds below. `rev` is a manual reactivity trigger:
// getObj() touches it (and the store selection), so every computed that calls
// getObj() re-evaluates after rerender() bumps `rev` or the selection changes.
const rev = ref(0);

function getObj(): any {
  void rev.value;
  void canvasStore.selectedObjectIds;
  return props.canvasGetter()?.getActiveObject() ?? null;
}
function rerender() {
  rev.value++;
  const canvas = props.canvasGetter();
  if (!canvas) return;
  canvas.requestRenderAll();
  // Fire object:modified so the change is captured by history / slide JSON —
  // obj.set() alone is silent and would otherwise never be persisted.
  const obj = canvas.getActiveObject();
  if (obj) canvas.fire('object:modified', { target: obj });
}

const fontSize = computed(() => getObj()?.fontSize ?? 24);
const fillColor = computed(() => getObj()?.fill ?? '#ffffff');
const fontWeight = computed(() => getObj()?.fontWeight ?? 'normal');
const fontStyle = computed(() => getObj()?.fontStyle ?? 'normal');
const underline = computed(() => !!(getObj()?.underline));
const textAlign = computed(() => getObj()?.textAlign ?? 'left');
const charSpacing = computed(() => getObj()?.charSpacing ?? 0);
const opacity = computed(() => getObj()?.opacity ?? 1);

// Stroke
const strokeEnabled = computed(() => !!(getObj()?.stroke && getObj()?.strokeWidth > 0));
const strokeColor = computed(() => getObj()?.stroke ?? '#000000');
const strokeWidth = computed(() => getObj()?.strokeWidth ?? 2);

function toggleStroke() {
  const obj = getObj();
  if (!obj) return;
  if (strokeEnabled.value) {
    obj.set({ stroke: null, strokeWidth: 0 });
  } else {
    obj.set({ stroke: '#000000', strokeWidth: 2, paintFirst: 'stroke' });
  }
  rerender();
}
function onStrokeColor(color: string) { getObj()?.set({ stroke: color, paintFirst: 'stroke' }); rerender(); }
function onStrokeWidth(e: Event) { getObj()?.set({ strokeWidth: Number((e.target as HTMLInputElement).value), paintFirst: 'stroke' }); rerender(); }

// Shadow
const shadowEnabled = computed(() => !!getObj()?.shadow);
const shadowColor = computed(() => {
  const s = getObj()?.shadow;
  return typeof s === 'string' ? '#000000' : (s?.color ?? '#000000');
});
const shadowBlur = computed(() => {
  const s = getObj()?.shadow;
  return typeof s === 'object' && s ? s.blur ?? 10 : 10;
});
const shadowOffsetX = computed(() => {
  const s = getObj()?.shadow;
  return typeof s === 'object' && s ? s.offsetX ?? 4 : 4;
});
const shadowOffsetY = computed(() => {
  const s = getObj()?.shadow;
  return typeof s === 'object' && s ? s.offsetY ?? 4 : 4;
});

function getShadowOrDefault() {
  const s = getObj()?.shadow;
  if (typeof s === 'object' && s) return s;
  return { color: '#000000', blur: 10, offsetX: 4, offsetY: 4 };
}

function applyShadow(patch: Partial<{ color: string; blur: number; offsetX: number; offsetY: number }>) {
  const obj = getObj();
  if (!obj) return;
  const current = getShadowOrDefault();
  const next = { ...current, ...patch };
  obj.set('shadow', new fabric.Shadow(next));
  rerender();
}

function toggleShadow() {
  const obj = getObj();
  if (!obj) return;
  if (shadowEnabled.value) {
    obj.set('shadow', null);
  } else {
    obj.set('shadow', new fabric.Shadow({ color: '#000000', blur: 10, offsetX: 4, offsetY: 4 }));
  }
  rerender();
}

function onShadowColor(color: string) { applyShadow({ color }); }
function onShadowBlur(e: Event) { applyShadow({ blur: Number((e.target as HTMLInputElement).value) }); }
function onShadowOffsetX(e: Event) { applyShadow({ offsetX: Number((e.target as HTMLInputElement).value) }); }
function onShadowOffsetY(e: Event) { applyShadow({ offsetY: Number((e.target as HTMLInputElement).value) }); }

async function onFontSelect(family: string) {
  await loadGoogleFont(family);
  settings.addRecentFont(family);
  getObj()?.set('fontFamily', family);
  rerender();
}

function onFontSize(e: Event) {
  getObj()?.set('fontSize', Number((e.target as HTMLInputElement).value));
  rerender();
}

function onCharSpacing(e: Event) {
  getObj()?.set('charSpacing', Number((e.target as HTMLInputElement).value));
  rerender();
}

function onFill(color: string) { getObj()?.set('fill', color); rerender(); }

function toggleBold() {
  const obj = getObj();
  if (!obj) return;
  obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
  rerender();
}

function toggleItalic() {
  const obj = getObj();
  if (!obj) return;
  obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
  rerender();
}

function toggleUnderline() {
  const obj = getObj();
  if (!obj) return;
  obj.set('underline', !obj.underline);
  rerender();
}

function setAlign(align: string) {
  getObj()?.set('textAlign', align);
  rerender();
}

function onOpacity(e: Event) {
  getObj()?.set('opacity', Number((e.target as HTMLInputElement).value) / 100);
  rerender();
}
</script>

<style scoped>
.row { display: flex; align-items: center; }
.row-between { display: flex; align-items: center; justify-content: space-between; }
.flex1 { flex: 1; }
.number-input { width: 100%; text-align: center; }
.range-input { width: 100%; accent-color: var(--accent); }
.field-group { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 11px; color: var(--text-muted); }
.style-btns, .align-btns { display: flex; gap: 4px; }

/* Toggle switch */
.toggle { display: flex; align-items: center; cursor: pointer; }
.toggle input { display: none; }
.toggle-track {
  width: 32px; height: 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 9px;
  position: relative;
  transition: background 0.2s, border-color 0.2s;
}
.toggle-track::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 12px; height: 12px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}
.toggle input:checked ~ .toggle-track {
  background: var(--accent);
  border-color: var(--accent);
}
.toggle input:checked ~ .toggle-track::after {
  transform: translateX(14px);
  background: white;
}
</style>
