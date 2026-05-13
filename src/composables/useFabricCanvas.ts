import { ref, onUnmounted } from 'vue';
import * as fabric from 'fabric';
import { nanoid } from 'nanoid';
import { useCanvasStore } from '@/stores/canvas';
import { useHistoryStore } from '@/stores/history';
import { useSlidesStore } from '@/stores/slides';

const CUSTOM_PROPS = ['id', 'name', 'customType'];

// Fabric v6 serializes types as PascalCase ('IText', 'Image', 'Textbox') while
// v5 and earlier used lowercase-hyphenated ('i-text', 'image', 'textbox').
// Normalize before comparing so migration and detection work with both.
function normalizeType(type: string | undefined): string {
  return (type ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

// Replace legacy IText / Text objects with Textbox.  Two reasons:
//
//  1. IText doesn't word-wrap.  A long line saved when the font was fully
//     loaded measures narrower than the same line rendered later (font
//     metrics drift slightly between save and load), so the right edge gets
//     clipped by the canvas.  Textbox wraps within an explicit `width`, so
//     visible width = configured width — no measurement-vs-render mismatch.
//
//  2. IText's `textAlign` aligns lines within the IText's auto-computed
//     bounding box (= max line width).  When all lines are similar length,
//     changing textAlign has no visible effect — which is the "alignment
//     button does nothing" bug.  Textbox aligns within its explicit width,
//     so center / right always produces a visible change.
//
// Identity-bearing props (name, id) are preserved so animation effects keep
// referencing the same object.
function migrateITextToTextbox(canvas: fabric.Canvas) {
  const canvasW = canvas.getWidth();
  const objects = [...canvas.getObjects()];
  for (const obj of objects) {
    const t = normalizeType(obj.type);
    if (t !== 'itext' && t !== 'text') continue;
    try {
      migrateOne(canvas, obj, canvasW);
    } catch (e) {
      // Per-object failure must not abort the rest of the load — the
      // un-migrated IText will at least still render (just with the legacy
      // overflow/textAlign quirks).
      console.warn('[migrateITextToTextbox] skipped one object:', e);
    }
  }
}

function migrateOne(canvas: fabric.Canvas, obj: fabric.Object, canvasW: number) {
  const iText = obj as any;
  iText.initDimensions?.();
  // Pick a Textbox width that won't introduce surprise wrapping when the
  // text already fit, and that clamps to the canvas when it didn't.
  const measured = iText.width ?? canvasW;
  const widthBudget = canvasW * 0.95;
  const fitWidth = measured <= widthBudget ? measured : widthBudget;
  // Explicitly enumerate copied props.  Spreading `toObject()` here would
  // include `type: 'i-text'` which the Textbox constructor tries to assign
  // — but `type` is readonly on Fabric v6 prototypes, throwing "Attempted
  // to assign to readonly property" and aborting the entire JSON load.
  const textbox = new fabric.Textbox(iText.text ?? '', {
    left: iText.left,
    top: iText.top,
    originX: iText.originX,
    originY: iText.originY,
    angle: iText.angle,
    scaleX: iText.scaleX,
    scaleY: iText.scaleY,
    flipX: iText.flipX,
    flipY: iText.flipY,
    opacity: iText.opacity,
    visible: iText.visible,
    selectable: iText.selectable,
    evented: iText.evented,
    shadow: iText.shadow,
    fill: iText.fill,
    stroke: iText.stroke,
    strokeWidth: iText.strokeWidth,
    fontFamily: iText.fontFamily,
    fontSize: iText.fontSize,
    fontWeight: iText.fontWeight,
    fontStyle: iText.fontStyle,
    textAlign: iText.textAlign,
    lineHeight: iText.lineHeight,
    charSpacing: iText.charSpacing,
    underline: iText.underline,
    overline: iText.overline,
    linethrough: iText.linethrough,
    backgroundColor: iText.backgroundColor,
    textBackgroundColor: iText.textBackgroundColor,
    styles: iText.styles,
    width: fitWidth,
  } as Partial<fabric.Textbox>);
  (textbox as any).name = iText.name;
  (textbox as any).id = iText.id;
  (textbox as any).customType = iText.customType;
  const idx = canvas.getObjects().indexOf(obj);
  canvas.remove(obj);
  canvas.insertAt(idx, textbox);
}

// After migration, run initDimensions on every Textbox and shrink any object
// whose bounding rect still spills outside the canvas.  getBoundingRect()
// includes the actual rendered extent (stroke, padding, post-scale), so it
// catches the few-pixel font-metric drift that getScaledWidth() misses.
function autoFitTextObjects(canvas: fabric.Canvas) {
  const canvasW = canvas.getWidth();
  const canvasH = canvas.getHeight();
  canvas.getObjects().forEach(obj => {
    const t = normalizeType(obj.type);
    if (t === 'textbox' || t === 'itext' || t === 'text') {
      (obj as any).initDimensions?.();
      obj.setCoords();
    }
    const r = obj.getBoundingRect();
    const overflowR = Math.max(0, r.left + r.width - canvasW);
    const overflowL = Math.max(0, -r.left);
    const overflowB = Math.max(0, r.top + r.height - canvasH);
    const overflowT = Math.max(0, -r.top);
    const overflowW = Math.max(overflowR, overflowL);
    const overflowH = Math.max(overflowB, overflowT);
    if (overflowW <= 0 && overflowH <= 0) return;
    const fitW = r.width > 0 ? (r.width - overflowW * 2) / r.width : 1;
    const fitH = r.height > 0 ? (r.height - overflowH * 2) / r.height : 1;
    const fit = Math.min(fitW, fitH);
    if (fit > 0 && fit < 1) {
      obj.set({
        scaleX: (obj.scaleX ?? 1) * fit,
        scaleY: (obj.scaleY ?? 1) * fit,
      });
      obj.setCoords();
    }
  });
}

let canvasInstance: fabric.Canvas | null = null;
let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
// While true, scheduleHistoryPush is a no-op. Used during undo/redo so that
// the object:added events fired by loadFromJSON don't write a new history
// entry (which would also CLEAR the future stack, breaking redo).
let isApplyingHistory = false;
// While true, the animation deep-watcher in SlideCanvas suppresses its
// per-mutation history push.  TimelinePanel sets this on effect drag/resize
// start so that the dozens of mousemove-driven mutations don't each become
// their own history entry; on mouseup it clears the flag and explicitly
// calls pushHistoryNow() so the drag results in exactly ONE checkpoint.
let isInteractiveDrag = false;

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

    // Ensure every canvas object has a stable name immediately on add.
    // Names are used as objectId by animation effects; without this, objects
    // added in one session get names only during ensureObjectIds() (called on
    // play), so a save before first play produces a fabricJSON with no names
    // — and effects become orphaned after reload.
    canvas.on('object:added', (e: any) => {
      if (e.target && !(e.target as any).name) {
        (e.target as any).name = nanoid(8);
      }
    });

    // Bump a window-scoped event for components (TimelinePanel) whose tracks
    // depend on canvas.getObjects() — a non-reactive call.  Without this
    // bridge, opening a saved file restores the slide's animation.effects
    // and the canvas objects, but the timeline never re-computes tracks
    // because nothing reactive ever changed from its point of view.
    const notifyObjectsChanged = () => {
      window.dispatchEvent(new CustomEvent('se:canvas-objects-changed'));
    };
    canvas.on('object:added', notifyObjectsChanged);
    canvas.on('object:removed', notifyObjectsChanged);

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
    const t = normalizeType(obj.type);
    if (t === 'itext' || t === 'textbox' || t === 'text') return 'text';
    if (t === 'image') return 'image';
    if (t === 'activeselection' || t === 'group') return 'group';
    if (['rect', 'circle', 'triangle', 'polygon', 'path', 'ellipse', 'line'].includes(t)) return 'shape';
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
      const json = getJSON();
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
    const json = getJSON();
    historyStore.push(currentSlideId.value, makeSnapshot(json));
    slidesStore.updateActiveSlideJSON(json);
  }

  function getJSON(): string {
    if (!canvasInstance) return JSON.stringify({ version: '6.0.0', objects: [] });
    const raw = (canvasInstance as any).toJSON(CUSTOM_PROPS) as Record<string, unknown>;
    // Strip background properties — these are managed by slide.background / applyBackground.
    // Keeping them in the snapshot causes loadFromJSON to restore stale video/image
    // backgroundImage references (which fail to load), blocking object restoration.
    delete raw.backgroundImage;
    delete raw.background;
    return JSON.stringify(raw);
  }

  function getSnapshot(): string {
    return makeSnapshot(getJSON());
  }

  async function loadJSON(json: string): Promise<void> {
    if (!canvasInstance) return;
    isApplyingHistory = true;
    // Cancel any pending debounced push scheduled by a previous edit.
    if (historyDebounceTimer) {
      clearTimeout(historyDebounceTimer);
      historyDebounceTimer = null;
    }
    try {
      await canvasInstance.loadFromJSON(JSON.parse(json));
      // Migrate legacy IText/Text objects to Textbox so wrapping works and
      // textAlign is actually visible (see migrateITextToTextbox for details).
      migrateITextToTextbox(canvasInstance);
      autoFitTextObjects(canvasInstance);
    } catch (e) {
      console.error('[useFabricCanvas] loadFromJSON failed:', e);
    } finally {
      canvasInstance.requestRenderAll();
      // Keep suppression long enough to cover any debounced animation-watcher
      // timer (350ms) — otherwise that timer fires after the flag clears and
      // pushes a duplicate which wipes the future stack, breaking redo.
      setTimeout(() => { isApplyingHistory = false; }, 600);
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
    if (historyDebounceTimer) {
      clearTimeout(historyDebounceTimer);
      historyDebounceTimer = null;
    }
    try {
      await canvasInstance.loadFromJSON(JSON.parse(fabricJSON));
      migrateITextToTextbox(canvasInstance);
      autoFitTextObjects(canvasInstance);
      if (animation && slidesStore.activeSlide) {
        slidesStore.activeSlide.animation = animation;
      }
    } catch (e) {
      console.error('[useFabricCanvas] loadSnapshot failed:', e);
    } finally {
      canvasInstance.requestRenderAll();
      // 600ms covers the 350ms animation-watcher debounce — see loadJSON.
      setTimeout(() => { isApplyingHistory = false; }, 600);
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

  // Expose the suppression flag as a getter so external watchers (e.g. the
  // animation deep watch in SlideCanvas) can skip scheduling pushes during
  // programmatic loads.  Without this, undo would trigger a watcher fire that
  // re-pushes the just-restored state and clears the future stack.
  function isHistorySuppressed(): boolean {
    return isApplyingHistory;
  }

  function isDragSuppressed(): boolean {
    return isInteractiveDrag;
  }

  function setInteractiveDrag(active: boolean) {
    isInteractiveDrag = active;
  }

  return {
    canvasRef,
    getCanvas,
    initCanvas,
    getJSON,
    getSnapshot,
    loadJSON,
    loadSnapshot,
    pushHistoryNow,
    scheduleHistoryPush,
    isHistorySuppressed,
    isDragSuppressed,
    setInteractiveDrag,
    disposeCanvas,
    CUSTOM_PROPS,
  };
}
