<template>
  <aside class="inspector">
    <!-- Tab header -->
    <div class="inspector-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >{{ tab.label }}</button>
    </div>

    <!-- Properties tab -->
    <div class="inspector-body" v-if="activeTab === 'properties'">
      <template v-if="canvasStore.selectedObjectType === 'text'">
        <TextInspector :canvas-getter="canvasGetter" />
      </template>
      <template v-else-if="canvasStore.selectedObjectType === 'image'">
        <ImageInspector :canvas-getter="canvasGetter" />
      </template>
      <template v-else-if="canvasStore.selectedObjectType === 'shape'">
        <ShapeInspector :canvas-getter="canvasGetter" />
      </template>
      <template v-else>
        <div class="no-selection">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
            <path d="M5 3l14 9-7 2-2 7L5 3z"/>
          </svg>
          <p>Selecione um objeto<br>para ver propriedades</p>
        </div>
      </template>
    </div>

    <!-- Layers tab -->
    <div class="inspector-body" v-else-if="activeTab === 'layers'">
      <LayerPanel />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/stores/canvas';
import TextInspector from './TextInspector.vue';
import ImageInspector from './ImageInspector.vue';
import ShapeInspector from './ShapeInspector.vue';
import LayerPanel from './LayerPanel.vue';

const canvasStore = useCanvasStore();
const activeTab = ref<'properties' | 'layers'>('properties');

const tabs = [
  { id: 'properties', label: 'Propriedades' },
  { id: 'layers', label: 'Camadas' },
];

function canvasGetter(): fabric.Canvas | null {
  return (window as any).__slideEditorCanvas ?? null;
}
</script>

<style scoped>
.inspector {
  width: 240px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.inspector-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 9px 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.tab-btn:hover { color: var(--text-primary); background: var(--bg-elevated); }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }

.inspector-body {
  flex: 1;
  overflow-y: auto;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 160px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  line-height: 1.6;
}
</style>
