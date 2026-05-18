<template>
  <div class="color-picker" :class="{ compact }" ref="rootRef">
    <div class="color-row">
      <div class="color-preview" :style="{ background: modelValue }" @click="togglePicker" />
      <template v-if="!compact">
        <input
          type="text"
          :value="hexInput"
          @input="onHexInput"
          @blur="onHexBlur"
          class="hex-input"
          maxlength="7"
          spellcheck="false"
        />
        <button class="eyedrop-btn" title="Conta-gotas: clicar no canvas" @click.stop="startEyedrop">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21l2-2 9.5-9.5-2-2L3 21z"/>
            <path d="M15.5 5.5l2-2a2 2 0 0 1 2.83 2.83l-2 2-2.83-2.83z"/>
            <path d="M12.5 8.5l3 3"/>
          </svg>
        </button>
      </template>
    </div>

    <div v-if="showPicker" class="picker-popup">
      <!-- Compact: hex + eyedrop live inside the popup to keep the closed
           control down to a single swatch. -->
      <div v-if="compact" class="color-row popup-hex-row">
        <input
          type="text"
          :value="hexInput"
          @input="onHexInput"
          @blur="onHexBlur"
          class="hex-input"
          maxlength="7"
          spellcheck="false"
        />
        <button class="eyedrop-btn" title="Conta-gotas: clicar no canvas" @click.stop="startEyedrop">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21l2-2 9.5-9.5-2-2L3 21z"/>
            <path d="M15.5 5.5l2-2a2 2 0 0 1 2.83 2.83l-2 2-2.83-2.83z"/>
            <path d="M12.5 8.5l3 3"/>
          </svg>
        </button>
      </div>

      <!-- SV gradient area -->
      <div
        class="sv-area"
        :style="{ background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, hsl(${hue},100%,50%))` }"
        ref="svRef"
        @mousedown="startSVDrag"
      >
        <div
          class="sv-cursor"
          :style="{ left: `${sat * 100}%`, top: `${(1 - bri) * 100}%` }"
        />
      </div>

      <!-- Hue slider -->
      <div class="hue-row">
        <input
          type="range"
          class="hue-slider"
          min="0"
          max="360"
          step="1"
          :value="hue"
          @input="onHue"
        />
      </div>

      <!-- Swatches -->
      <div class="swatches">
        <button
          v-for="swatch in swatches"
          :key="swatch"
          class="swatch"
          :style="{ background: swatch }"
          :title="swatch"
          @click="pickSwatch(swatch)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { isValidHex, hexToHsv, hsvToHex } from '@/utils/colorUtils';

const props = defineProps<{ modelValue: string; compact?: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const showPicker = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const svRef = ref<HTMLElement | null>(null);

const hexInput = ref(props.modelValue);
const hue = ref(0);
const sat = ref(1);
const bri = ref(1); // brightness (HSV value)

function syncFromProp(hex: string) {
  hexInput.value = hex;
  if (isValidHex(hex)) {
    const [h, s, v] = hexToHsv(hex);
    hue.value = h;
    sat.value = s;
    bri.value = v;
  }
}

watch(() => props.modelValue, syncFromProp, { immediate: true });

function togglePicker() {
  showPicker.value = !showPicker.value;
}

function startEyedrop() {
  showPicker.value = false;
  window.dispatchEvent(new CustomEvent('se:eyedrop-start', {
    detail: {
      callback: (hex: string) => {
        emit('update:modelValue', hex);
        syncFromProp(hex);
      },
    },
  }));
}

function emitColor() {
  const hex = hsvToHex(hue.value, sat.value, bri.value);
  hexInput.value = hex;
  emit('update:modelValue', hex);
}

function onHue(e: Event) {
  hue.value = Number((e.target as HTMLInputElement).value);
  emitColor();
}

function onHexInput(e: Event) {
  const hex = (e.target as HTMLInputElement).value;
  hexInput.value = hex;
  if (isValidHex(hex)) {
    emit('update:modelValue', hex);
    const [h, s, v] = hexToHsv(hex);
    hue.value = h;
    sat.value = s;
    bri.value = v;
  }
}

function onHexBlur(e: Event) {
  if (!isValidHex(hexInput.value)) {
    hexInput.value = props.modelValue;
  }
}

function pickSwatch(color: string) {
  emit('update:modelValue', color);
  showPicker.value = false;
}

// SV drag
let svDragging = false;

function startSVDrag(e: MouseEvent) {
  svDragging = true;
  updateSV(e);
}

function updateSV(e: MouseEvent) {
  const el = svRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  sat.value = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  bri.value = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
  emitColor();
}

function onMouseMove(e: MouseEvent) {
  if (svDragging) updateSV(e);
}

function onMouseUp() {
  svDragging = false;
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    showPicker.value = false;
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousedown', onClickOutside, true);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('mousedown', onClickOutside, true);
});

const swatches = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6366f1', '#a855f7', '#14b8a6', '#f59e0b', '#64748b',
];
</script>

<style scoped>
.color-picker {
  position: relative;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-preview {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border);
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s;
}
.color-preview:hover { border-color: var(--border-focus); }

.eyedrop-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.eyedrop-btn:hover { color: var(--accent); border-color: var(--accent); }

.hex-input {
  flex: 1;
  font-family: monospace;
  font-size: 13px;
}

.picker-popup {
  margin-top: 8px;
  padding: 10px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  z-index: 100;
}

/* Compact mode: the closed control is just the swatch, and the popup floats
   absolutely so opening it does not grow the control's box — which would
   otherwise vertically recentre every sibling in the floating toolbar. */
.color-picker.compact .picker-popup {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  margin-top: 0;
  width: 200px;
}

.popup-hex-row {
  margin-bottom: 8px;
}

/* SV gradient */
.sv-area {
  width: 100%;
  height: 140px;
  border-radius: var(--radius-sm);
  position: relative;
  cursor: crosshair;
  margin-bottom: 8px;
  border: 1px solid var(--border);
}

.sv-cursor {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* Hue slider */
.hue-row {
  margin-bottom: 8px;
}

.hue-slider {
  width: 100%;
  height: 12px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 6px;
  background: linear-gradient(to right,
    hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
    hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
    hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
    hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
    hsl(360,100%,50%));
  cursor: pointer;
}

.hue-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  border: 2px solid rgba(0,0,0,0.3);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  cursor: pointer;
}

/* Swatches */
.swatches {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.swatch {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.15s;
}
.swatch:hover {
  transform: scale(1.15);
  border-color: var(--text-primary);
}
</style>
