<template>
  <div class="modal-backdrop" @click.self="uiStore.closeModal()">
    <div class="modal">
      <div class="modal-title">Proporção do Canvas</div>

      <div class="presets-grid">
        <button
          v-for="preset in presets"
          :key="preset.label"
          class="preset-btn"
          :class="{ active: isActive(preset) }"
          @click="applyPreset(preset)"
        >
          <div class="preset-icon">
            <div class="preset-rect" :style="presetRectStyle(preset)" />
          </div>
          <span>{{ preset.label }}</span>
          <small>{{ preset.width }} × {{ preset.height }}</small>
        </button>
      </div>

      <div class="divider" />

      <div class="custom-section">
        <div class="panel-label">Dimensões Personalizadas</div>
        <div class="custom-row">
          <div class="field">
            <label>Largura (px)</label>
            <input type="number" v-model.number="customW" min="100" max="8000" step="1" />
          </div>
          <span class="x-sep">×</span>
          <div class="field">
            <label>Altura (px)</label>
            <input type="number" v-model.number="customH" min="100" max="8000" step="1" />
          </div>
        </div>
        <button class="btn btn-secondary" @click="applyCustom">Aplicar</button>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" @click="uiStore.closeModal()">Cancelar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useSlidesStore } from '@/stores/slides';
import { ASPECT_RATIO_PRESETS, type AspectRatio } from '@/types';

const uiStore = useUiStore();
const slidesStore = useSlidesStore();

const presets = ASPECT_RATIO_PRESETS;
const customW = ref(1920);
const customH = ref(1080);

function isActive(preset: AspectRatio) {
  return slidesStore.aspectRatio.width === preset.width && slidesStore.aspectRatio.height === preset.height;
}

function applyPreset(preset: AspectRatio) {
  slidesStore.setAspectRatio(preset);
  uiStore.closeModal();
}

function applyCustom() {
  if (customW.value > 0 && customH.value > 0) {
    slidesStore.setAspectRatio({ label: 'Custom', width: customW.value, height: customH.value });
    uiStore.closeModal();
  }
}

function presetRectStyle(preset: AspectRatio) {
  const ratio = preset.width / preset.height;
  const maxW = 40;
  const maxH = 28;
  let w = maxW;
  let h = maxW / ratio;
  if (h > maxH) { h = maxH; w = maxH * ratio; }
  return { width: `${w}px`, height: `${h}px` };
}
</script>

<style scoped>
.presets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.preset-btn:hover { border-color: var(--accent); }
.preset-btn.active { border-color: var(--accent); background: var(--accent-light); }

.preset-icon {
  width: 44px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preset-rect {
  background: var(--accent);
  border-radius: 2px;
  opacity: 0.7;
}

.preset-btn small {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 400;
}

.custom-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.custom-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.field label {
  font-size: 11px;
  color: var(--text-muted);
}

.field input {
  width: 100%;
}

.x-sep {
  padding-bottom: 8px;
  color: var(--text-muted);
  font-size: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
