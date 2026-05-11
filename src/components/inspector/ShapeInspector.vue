<template>
  <div>
    <div class="panel-section">
      <div class="panel-label">Preenchimento</div>
      <ColorPicker :model-value="fillColor" @update:model-value="onFill" />
    </div>

    <div class="panel-section">
      <div class="panel-label">Borda</div>
      <ColorPicker :model-value="strokeColor" @update:model-value="onStroke" />
      <div class="row" style="margin-top: 8px">
        <span class="field-label">Largura</span>
        <input type="number" :value="strokeWidth" @change="onStrokeWidth" min="0" max="50" class="number-input" />
      </div>
    </div>

    <div class="panel-section">
      <div class="panel-label">Opacidade: {{ Math.round(opacity * 100) }}%</div>
      <input type="range" min="0" max="100" :value="Math.round(opacity * 100)" @input="onOpacity" class="range-input" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import * as fabric from 'fabric';
import ColorPicker from '@/components/shared/ColorPicker.vue';

const props = defineProps<{ canvasGetter: () => fabric.Canvas | null }>();

function getObj(): any { return props.canvasGetter()?.getActiveObject() ?? null; }
function rerender() { props.canvasGetter()?.requestRenderAll(); }

const fillColor = computed(() => getObj()?.fill ?? '#6366f1');
const strokeColor = computed(() => getObj()?.stroke ?? '#000000');
const strokeWidth = computed(() => getObj()?.strokeWidth ?? 0);
const opacity = computed(() => getObj()?.opacity ?? 1);

function onFill(c: string) { getObj()?.set('fill', c); rerender(); }
function onStroke(c: string) { getObj()?.set('stroke', c); rerender(); }
function onStrokeWidth(e: Event) { getObj()?.set('strokeWidth', Number((e.target as HTMLInputElement).value)); rerender(); }
function onOpacity(e: Event) { getObj()?.set('opacity', Number((e.target as HTMLInputElement).value) / 100); rerender(); }
</script>

<style scoped>
.range-input { width: 100%; accent-color: var(--accent); }
.row { display: flex; align-items: center; gap: 8px; }
.field-label { font-size: 12px; color: var(--text-muted); }
.number-input { width: 60px; text-align: center; }
</style>
