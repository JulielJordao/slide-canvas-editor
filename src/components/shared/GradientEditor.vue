<template>
  <div class="gradient-editor">
    <!-- Preview -->
    <div class="gradient-preview" :style="{ background: previewStyle }" />

    <!-- Angle (only for linear) -->
    <div v-if="showAngle" class="field">
      <label class="field-label">Ângulo: {{ localAngle }}°</label>
      <input type="range" min="0" max="360" :value="localAngle" @input="onAngle" class="range-input" />
    </div>

    <!-- Stops -->
    <div class="stops-section">
      <div class="stops-header">
        <span class="field-label">Paradas de Cor</span>
        <button class="icon-btn" @click="addStop" title="Adicionar parada">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
      <div class="stops-list">
        <div v-for="(stop, i) in localStops" :key="i" class="stop-row">
          <div class="stop-color" :style="{ background: stop.color }" />
          <input type="color" :value="stop.color" @input="onStopColor(i, $event)" class="stop-color-input" />
          <input type="range" min="0" max="100" :value="Math.round(stop.offset * 100)" @input="onStopOffset(i, $event)" class="range-input flex1" />
          <span class="stop-pct">{{ Math.round(stop.offset * 100) }}%</span>
          <button class="icon-btn" @click="removeStop(i)" :disabled="localStops.length <= 2" title="Remover">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { GradientStop } from '@/types';
import { buildLinearGradient } from '@/utils/colorUtils';

const props = defineProps<{
  stops: GradientStop[];
  angle: number;
  showAngle?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update', val: { stops: GradientStop[]; angle: number }): void
}>();

const localStops = ref<GradientStop[]>([...props.stops]);
const localAngle = ref(props.angle);

watch(() => props.stops, (v) => { localStops.value = [...v]; });
watch(() => props.angle, (v) => { localAngle.value = v; });

const showAngle = computed(() => props.showAngle !== false);

const previewStyle = computed(() =>
  buildLinearGradient(localStops.value, localAngle.value)
);

function emit_() {
  emit('update', { stops: [...localStops.value], angle: localAngle.value });
}

function onAngle(e: Event) {
  localAngle.value = Number((e.target as HTMLInputElement).value);
  emit_();
}

function onStopColor(i: number, e: Event) {
  localStops.value[i] = { ...localStops.value[i], color: (e.target as HTMLInputElement).value };
  emit_();
}

function onStopOffset(i: number, e: Event) {
  localStops.value[i] = { ...localStops.value[i], offset: Number((e.target as HTMLInputElement).value) / 100 };
  emit_();
}

function addStop() {
  localStops.value.push({ offset: 0.5, color: '#ffffff' });
  emit_();
}

function removeStop(i: number) {
  if (localStops.value.length <= 2) return;
  localStops.value.splice(i, 1);
  emit_();
}
</script>

<style scoped>
.gradient-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gradient-preview {
  height: 40px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.range-input {
  width: 100%;
  accent-color: var(--accent);
}

.flex1 { flex: 1; }

.stops-section { display: flex; flex-direction: column; gap: 6px; }

.stops-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stops-list { display: flex; flex-direction: column; gap: 6px; }

.stop-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stop-color {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1px solid var(--border);
  flex-shrink: 0;
  cursor: pointer;
}

.stop-color-input {
  width: 0;
  height: 0;
  opacity: 0;
  position: absolute;
}

.stop-pct {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 30px;
  text-align: right;
}
</style>
