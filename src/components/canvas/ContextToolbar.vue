<template>
  <div class="ctx-bar">

    <!-- === NO SELECTION: background + add-text shortcut === -->
    <template v-if="selType === 'none'">
      <span class="ctx-label">Fundo</span>
      <ColorPicker v-if="isSolidBg" :model-value="bgColor" @update:model-value="onBgColor" />
      <span v-else class="ctx-badge" :title="`Fundo: ${bgTypeLabel}`">{{ bgTypeLabel }}</span>
      <div class="sep" />
      <button class="ctx-pill" @click="addText" title="Adicionar caixa de texto (T)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Texto
      </button>
      <button class="ctx-pill" @click="addRect" title="Adicionar retângulo">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Forma
      </button>
    </template>

    <!-- === TEXT === -->
    <template v-else-if="selType === 'text'">
      <select class="ctx-font" :value="textFont" @change="onFont" title="Fonte">
        <option v-for="f in fontOpts" :key="f" :value="f">{{ f }}</option>
      </select>
      <input type="number" class="ctx-num" min="6" max="800" step="1" :value="textSize" @change="onSize" title="Tamanho da fonte" />
      <ColorPicker :model-value="textColor" @update:model-value="onTextColor" />
      <div class="sep" />
      <button class="icon-btn" :class="{ active: isBold }" @click="toggleBold" title="Negrito">
        <strong>B</strong>
      </button>
      <button class="icon-btn" :class="{ active: isItalic }" @click="toggleItalic" title="Itálico">
        <em>I</em>
      </button>
      <button class="icon-btn" :class="{ active: hasUnderline }" @click="toggleUnderline" title="Sublinhado">
        <span style="text-decoration:underline">U</span>
      </button>
      <div class="sep" />
      <button class="icon-btn" :class="{ active: textAlign === 'left' }" @click="setAlign('left')" title="Esquerda">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
        </svg>
      </button>
      <button class="icon-btn" :class="{ active: textAlign === 'center' }" @click="setAlign('center')" title="Centro">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
        </svg>
      </button>
      <button class="icon-btn" :class="{ active: textAlign === 'right' }" @click="setAlign('right')" title="Direita">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    </template>

    <!-- === IMAGE === -->
    <template v-else-if="selType === 'image'">
      <span class="ctx-label">Opacidade</span>
      <input type="range" min="0" max="100" :value="Math.round(opacity * 100)" @input="onOpacity" class="ctx-range" title="Opacidade da imagem" />
      <span class="ctx-val">{{ Math.round(opacity * 100) }}%</span>
      <div class="sep" />
      <button class="ctx-pill" @click="enterCrop" title="Recortar imagem (modo crop)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 2 6 18 22 18"/><polyline points="2 6 18 6 18 22"/>
        </svg>
        Recortar
      </button>
    </template>

    <!-- === SHAPE === -->
    <template v-else-if="selType === 'shape'">
      <span class="ctx-label">Cor</span>
      <ColorPicker :model-value="fillColor" @update:model-value="onFillColor" />
      <div class="sep" />
      <span class="ctx-label">Opacidade</span>
      <input type="range" min="0" max="100" :value="Math.round(opacity * 100)" @input="onOpacity" class="ctx-range" title="Opacidade da forma" />
      <span class="ctx-val">{{ Math.round(opacity * 100) }}%</span>
    </template>

    <!-- === GROUP === -->
    <template v-else-if="selType === 'group'">
      <span class="ctx-label">{{ selCount }} objetos</span>
      <div class="sep" />
      <span class="ctx-label">Opacidade</span>
      <input type="range" min="0" max="100" :value="Math.round(opacity * 100)" @input="onOpacity" class="ctx-range" title="Opacidade do grupo" />
      <span class="ctx-val">{{ Math.round(opacity * 100) }}%</span>
    </template>

    <!-- === COMMON: layer order + delete === -->
    <template v-if="selType !== 'none'">
      <div class="sep" />
      <button class="icon-btn" @click="bringToFront" title="Trazer ao frente">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>
        </svg>
      </button>
      <button class="icon-btn" @click="bringForward" title="Avançar um nível">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
      <button class="icon-btn" @click="sendBackward" title="Recuar um nível">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <button class="icon-btn" @click="sendToBack" title="Enviar ao fundo">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" opacity="0.3"/><rect x="8" y="8" width="12" height="12" rx="2"/>
        </svg>
      </button>
      <div class="sep" />
      <button class="icon-btn" style="color: var(--danger)" @click="deleteSelected" title="Deletar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </template>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import * as fabric from 'fabric';
import ColorPicker from '@/components/shared/ColorPicker.vue';
import { useCanvasStore } from '@/stores/canvas';
import { useSlidesStore } from '@/stores/slides';
import { useSettingsStore } from '@/stores/settings';
import { useCanvasBackground } from '@/composables/useCanvasBackground';
import { loadGoogleFont } from '@/utils/fontLoader';

const props = defineProps<{ canvasGetter: () => fabric.Canvas | null }>();

const canvasStore = useCanvasStore();
const slidesStore = useSlidesStore();
const settingsStore = useSettingsStore();
const bgComposable = useCanvasBackground(props.canvasGetter);

const POPULAR_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Nunito', 'Oswald', 'Raleway', 'Merriweather', 'Playfair Display',
  'Bebas Neue', 'Dancing Script', 'Pacifico', 'Lobster',
  'Arial', 'Georgia', 'Verdana', 'Courier New',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const selType = computed(() => canvasStore.selectedObjectType);

function getCanvas() { return props.canvasGetter(); }
function getActive() { return getCanvas()?.getActiveObject() ?? null; }
function rerender() { getCanvas()?.requestRenderAll(); }

// ── Background (no-selection state) ─────────────────────────────────────────

const bgConfig = computed(() => slidesStore.activeSlide?.background);
const isSolidBg = computed(() => bgConfig.value?.type === 'solid');
const bgColor = computed(() => bgConfig.value?.color ?? '#000000');
const bgTypeLabel = computed(() => {
  const t = bgConfig.value?.type;
  if (t === 'linear-gradient') return 'Gradiente Linear';
  if (t === 'radial-gradient') return 'Gradiente Radial';
  if (t === 'image') return 'Imagem';
  if (t === 'video') return 'Vídeo';
  return t ?? '';
});

function onBgColor(color: string) {
  slidesStore.setBackground({ type: 'solid', color });
}

function addText() {
  const canvas = getCanvas();
  if (!canvas) return;
  const text = new fabric.IText('Texto', {
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    originX: 'center',
    originY: 'center',
    fontSize: 48,
    fill: '#ffffff',
    fontFamily: 'Inter',
  } as any);
  canvas.add(text);
  canvas.setActiveObject(text);
  rerender();
}

function addRect() {
  const canvas = getCanvas();
  if (!canvas) return;
  const rect = new fabric.Rect({
    left: canvas.getWidth() / 2 - 100,
    top: canvas.getHeight() / 2 - 60,
    width: 200,
    height: 120,
    fill: '#6366f1',
    rx: 8,
    ry: 8,
  } as any);
  canvas.add(rect);
  canvas.setActiveObject(rect);
  rerender();
}

// ── Text ─────────────────────────────────────────────────────────────────────

const fontOpts = computed(() => {
  const current = (getActive() as any)?.fontFamily ?? '';
  const recent = settingsStore.recentFonts;
  return [...new Set([current, ...recent, ...POPULAR_FONTS])].filter(Boolean).slice(0, 25) as string[];
});

const textFont = computed(() => (getActive() as any)?.fontFamily ?? 'Inter');
const textSize = computed(() => (getActive() as any)?.fontSize ?? 24);
const textColor = computed(() => (getActive() as any)?.fill ?? '#ffffff');
const isBold = computed(() => (getActive() as any)?.fontWeight === 'bold');
const isItalic = computed(() => (getActive() as any)?.fontStyle === 'italic');
const hasUnderline = computed(() => !!(getActive() as any)?.underline);
const textAlign = computed(() => (getActive() as any)?.textAlign ?? 'left');

async function onFont(e: Event) {
  const family = (e.target as HTMLSelectElement).value;
  await loadGoogleFont(family);
  settingsStore.addRecentFont(family);
  (getActive() as any)?.set('fontFamily', family);
  rerender();
}

function onSize(e: Event) {
  (getActive() as any)?.set('fontSize', Number((e.target as HTMLInputElement).value));
  rerender();
}

function onTextColor(color: string) { (getActive() as any)?.set('fill', color); rerender(); }

function toggleBold() {
  const obj = getActive() as any;
  if (!obj) return;
  obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
  rerender();
}

function toggleItalic() {
  const obj = getActive() as any;
  if (!obj) return;
  obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
  rerender();
}

function toggleUnderline() {
  const obj = getActive() as any;
  if (!obj) return;
  obj.set('underline', !obj.underline);
  rerender();
}

function setAlign(align: string) { (getActive() as any)?.set('textAlign', align); rerender(); }

// ── Image / Shape ────────────────────────────────────────────────────────────

const opacity = computed(() => getActive()?.opacity ?? 1);
const fillColor = computed(() => (getActive() as any)?.fill ?? '#6366f1');

function onOpacity(e: Event) {
  getActive()?.set('opacity', Number((e.target as HTMLInputElement).value) / 100);
  rerender();
}

function onFillColor(color: string) { (getActive() as any)?.set('fill', color); rerender(); }

function enterCrop() { useCanvasStore().cropMode = true; }

// ── Group ────────────────────────────────────────────────────────────────────

const selCount = computed(() => {
  const obj = getActive();
  if (obj?.type === 'activeselection') {
    return (obj as fabric.ActiveSelection).getObjects().length;
  }
  return 0;
});

// ── Layer order ──────────────────────────────────────────────────────────────

function bringToFront() {
  const canvas = getCanvas(); const obj = getActive();
  if (canvas && obj) { canvas.bringObjectToFront(obj); rerender(); }
}

function bringForward() {
  const canvas = getCanvas(); const obj = getActive();
  if (canvas && obj) { canvas.bringObjectForward(obj); rerender(); }
}

function sendBackward() {
  const canvas = getCanvas(); const obj = getActive();
  if (canvas && obj) { canvas.sendObjectBackwards(obj); rerender(); }
}

function sendToBack() {
  const canvas = getCanvas(); const obj = getActive();
  if (canvas && obj) { canvas.sendObjectToBack(obj); rerender(); }
}

function deleteSelected() {
  const canvas = getCanvas(); const obj = getActive();
  if (!canvas || !obj) return;
  if (obj.type === 'activeselection') {
    (obj as fabric.ActiveSelection).getObjects().forEach(o => canvas.remove(o));
    canvas.discardActiveObject();
  } else {
    canvas.remove(obj);
  }
  rerender();
}
</script>

<style scoped>
.ctx-bar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 5px 10px;
  display: flex;
  align-items: center;
  gap: 3px;
  box-shadow: var(--shadow);
  z-index: 50;
  white-space: nowrap;
}

.ctx-label {
  font-size: 11px;
  color: var(--text-muted);
  padding: 0 3px;
  white-space: nowrap;
}

.ctx-val {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 30px;
  text-align: right;
}

.ctx-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
}

.ctx-font {
  font-size: 12px;
  padding: 4px 6px;
  width: 130px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.ctx-num {
  width: 52px;
  font-size: 12px;
  text-align: center;
  padding: 4px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.ctx-range {
  width: 72px;
  accent-color: var(--accent);
}

.ctx-pill {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  transition: all 0.15s;
}
.ctx-pill:hover { color: var(--accent); border-color: var(--accent); }

.sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 3px;
  flex-shrink: 0;
}
</style>
