import { ref, onUnmounted } from 'vue';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/stores/canvas';
import { useHistoryStore } from '@/stores/history';
import { useSlidesStore } from '@/stores/slides';

const CUSTOM_PROPS = ['id', 'name', 'customType'];

let canvasInstance: fabric.Canvas | null = null;
let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
// While true, scheduleHistoryPush is a no-op. Used during undo/redo so that
// the object:added events fired by loadFromJSON don't write a new history
// entry (which would also CLEAR the future stack, breaking redo).
let isApplyingHistory = false;

export function useFabricCanvas() {
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const canvasStore = useCanvasStore();
  const historyStore = useHistoryStore();
  const slidesStore = useSlidesStore();
  const currentSlideId = ref('');

  function getCanvas(): fabric.Canvas | null {
    return canvasInstance;
  }

  function initCanvas(el: HTMLCanvasElement, width: number, height: number, slideId: string): fabric.Canvas {
    if (canvasInstance) {
      canvasInstance.dispose();
    }

    currentSlideId.value = slideId;

    const canvas = new fabric.Canvas(el, {
      width,
      height,
      preserveObjectStacking: true,
      selectionBorderColor: '#6366f1',
      selectionColor: 'rgba(99,102,241,0.1)',
      selectionLineWidth: 1,
    });

    // Customize default object controls appearance
    fabric.Object.prototype.set({
      cornerColor: '#6366f1',
      cornerSize: 8,
      cornerStyle: 'circle',
      transparentCorners: false,
      borderColor: '#6366f1',
      borderScaleFactor: 1.5,
      padding: 4,
    } as Partial<fabric.Object>);

    // Selection events
    canvas.on('selection:created', updateSelection);
    canvas.on('selection:updated', updateSelection);
    canvas.on('selection:cleared', () => canvasStore.clearSelection());

    // History events
    canvas.on('object:modified', scheduleHistoryPush);
    canvas.on('object:added', scheduleHistoryPush);
    canvas.on('object:removed', scheduleHistoryPush);

    canvasInstance = canvas;
    return canvas;
  }

  function updateSelection() {
    if (!canvasInstance) return;
    const active = canvasInstance.getActiveObject();
    if (!active) {
      canvasStore.clearSelection();
      return;
    }
    const objects = active.type === 'activeselection'
      ? (active as fabric.ActiveSelection).getObjects()
      : [active];
    const ids = objects.map(o => (o as any).id ?? '').filter(Boolean);
    const type = detectObjectType(active);
    canvasStore.setSelection(ids, type);
  }

  function detectObjectType(obj: fabric.Object): import('@/types').ObjectType {
    if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') return 'text';
    if (obj.type === 'image') return 'image';
    if (obj.type === 'activeselection' || obj.type === 'group') return 'group';
    if (['rect', 'circle', 'triangle', 'polygon', 'path', 'ellipse', 'line'].includes(obj.type ?? '')) return 'shape';
    return 'none';
  }

  // A snapshot captures BOTH the Fabric canvas state and the slide's animation
  // state, so undo/redo can revert timeline edits (effect drag/resize/add/remove)
  // in addition to canvas-object changes.
  function makeSnapshot(fabricJSON: string): string {
    const slide = slidesStore.activeSlide;
    return JSON.stringify({
      fabricJSON,
      animation: slide ? JSON.parse(JSON.stringify(slide.animation)) : null,
    });
  }

  function scheduleHistoryPush() {
    if (isApplyingHistory) return;
    if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
    historyDebounceTimer = setTimeout(() => {
      if (!canvasInstance || !currentSlideId.value) return;
      const json = JSON.stringify((canvasInstance as any).toJSON(CUSTOM_PROPS));
      historyStore.push(currentSlideId.value, makeSnapshot(json));
      slidesStore.updateActiveSlideJSON(json);
    }, 300);
  }

  // Public API: lets external code (e.g. timeline drag end) request a history
  // push that includes the latest animation state.
  function pushHistoryNow() {
    if (isApplyingHistory) return;
    if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
    if (!canvasInstance || !currentSlideId.value) return;
    const json = JSON.stringify((canvasInstance as any).toJSON(CUSTOM_PROPS));
    historyStore.push(currentSlideId.value, makeSnapshot(json));
    slidesStore.updateActiveSlideJSON(json);
  }

  function getJSON(): string {
    if (!canvasInstance) return JSON.stringify({ version: '6.0.0', objects: [] });
    return JSON.stringify((canvasInstance as any).toJSON(CUSTOM_PROPS));
  }

  function getSnapshot(): string {
    return makeSnapshot(getJSON());
  }

  async function loadJSON(json: string): Promise<void> {
    if (!canvasInstance) return;
    isApplyingHistory = true;
    try {
      await canvasInstance.loadFromJSON(JSON.parse(json));
      canvasInstance.requestRenderAll();
    } finally {
      // Defer release until Fabric's object:added events have settled
      setTimeout(() => { isApplyingHistory = false; }, 100);
    }
  }

  // Restore from a combined snapshot (canvas + animation).
  // Falls back gracefully to raw Fabric JSON for backwards-compat snapshots.
  async function loadSnapshot(snapshot: string): Promise<void> {
    if (!canvasInstance) return;
    let fabricJSON: string;
    let animation: any = null;
    try {
      const parsed = JSON.parse(snapshot);
      if (typeof parsed === 'object' && parsed.fabricJSON) {
        fabricJSON = parsed.fabricJSON;
        animation = parsed.animation;
      } else {
        fabricJSON = snapshot;
      }
    } catch {
      fabricJSON = snapshot;
    }

    isApplyingHistory = true;
    try {
      await canvasInstance.loadFromJSON(JSON.parse(fabricJSON));
      canvasInstance.requestRenderAll();
      // Restore animation state if the snapshot carried it
      if (animation && slidesStore.activeSlide) {
        slidesStore.activeSlide.animation = animation;
      }
    } finally {
      setTimeout(() => { isApplyingHistory = false; }, 100);
    }
  }

  function disposeCanvas() {
    if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
    if (canvasInstance) {
      canvasInstance.dispose();
      canvasInstance = null;
    }
  }

  onUnmounted(disposeCanvas);

  return {
    canvasRef,
    getCanvas,
    initCanvas,
    getJSON,
    getSnapshot,
    loadJSON,
    loadSnapshot,
    pushHistoryNow,
    disposeCanvas,
    CUSTOM_PROPS,
  };
}
