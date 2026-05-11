import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ToolMode, ObjectType } from '@/types';

export const useCanvasStore = defineStore('canvas', () => {
  const selectedObjectIds = ref<string[]>([]);
  const selectedObjectType = ref<ObjectType>('none');
  const zoom = ref(1.0);
  const toolMode = ref<ToolMode>('select');
  const isDraggingOver = ref(false);
  const containerSize = ref({ w: 0, h: 0 });
  const cropMode = ref(false);

  const hasSelection = computed(() => selectedObjectIds.value.length > 0);

  function setSelection(ids: string[], type: ObjectType) {
    selectedObjectIds.value = ids;
    selectedObjectType.value = type;
  }

  function clearSelection() {
    selectedObjectIds.value = [];
    selectedObjectType.value = 'none';
  }

  function setZoom(z: number) {
    zoom.value = Math.max(0.1, Math.min(3, z));
  }

  function setToolMode(mode: ToolMode) {
    toolMode.value = mode;
  }

  function setContainerSize(w: number, h: number) {
    containerSize.value = { w, h };
  }

  return {
    selectedObjectIds,
    selectedObjectType,
    zoom,
    toolMode,
    isDraggingOver,
    containerSize,
    cropMode,
    hasSelection,
    setSelection,
    clearSelection,
    setZoom,
    setToolMode,
    setContainerSize,
  };
});
