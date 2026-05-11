import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue';
import * as fabric from 'fabric';
import { filePathToDataUrl } from '@/utils/fileToDataUrl';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov']);

function getExt(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? '';
}

// ── Multi-zone drop registry ─────────────────────────────────────────────────
//
// The old behaviour was a single fullscreen overlay that always routed dropped
// files to the canvas, regardless of where the user actually released the
// mouse.  This module now keeps a global registry of zones; the Tauri
// drag-drop event uses the cursor position to pick exactly one zone and call
// its handler with local coordinates.  Each zone exposes its own reactive
// `isOver` so it can highlight independently.

type ZoneHandler = (paths: string[], localX: number, localY: number) => void | Promise<void>;

interface RegisteredZone {
  el: HTMLElement;
  onDrop: ZoneHandler;
}

const isDragging = ref(false);
const dragPos = ref({ x: 0, y: 0 });
const zones: RegisteredZone[] = [];

let setupPromise: Promise<void> | null = null;

async function setupTauriListeners(): Promise<void> {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event');

      await listen<{ paths: string[]; position: { x: number; y: number } }>(
        'tauri://drag-enter',
        (event) => {
          isDragging.value = true;
          if (event.payload.position) dragPos.value = event.payload.position;
        },
      );

      await listen<{ paths: string[]; position: { x: number; y: number } }>(
        'tauri://drag-over',
        (event) => {
          if (event.payload.position) dragPos.value = event.payload.position;
        },
      );

      await listen('tauri://drag-leave', () => {
        isDragging.value = false;
      });

      await listen<{ paths: string[]; position: { x: number; y: number } }>(
        'tauri://drag-drop',
        (event) => {
          isDragging.value = false;
          const { paths, position } = event.payload;
          if (!position) return;
          const zone = findZoneAt(position.x, position.y);
          if (!zone) return;
          const r = zone.el.getBoundingClientRect();
          zone.onDrop(paths, position.x - r.left, position.y - r.top);
        },
      );
    } catch {
      // Not in Tauri — browser drag-drop is handled per-component
    }
  })();
  return setupPromise;
}

function findZoneAt(x: number, y: number): RegisteredZone | null {
  // Iterate in reverse registration order so deeper/topmost zones win when
  // two zones happen to overlap.
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    const r = z.el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z;
  }
  return null;
}

/**
 * Register a drop zone.  The component owns the lifecycle: as long as it stays
 * mounted, drops over its element will invoke `onDrop` with coordinates local
 * to the element.  Returns a reactive `isOver` flag that's true whenever a
 * drag is in progress AND the cursor is currently over this zone.
 */
export function useDropZone(
  elementRef: Ref<HTMLElement | null>,
  onDrop: ZoneHandler,
): { isOver: ComputedRef<boolean>; isDragging: Ref<boolean> } {
  let registered: RegisteredZone | null = null;

  onMounted(() => {
    setupTauriListeners();
    if (elementRef.value) {
      registered = { el: elementRef.value, onDrop };
      zones.push(registered);
    }
  });

  onUnmounted(() => {
    if (registered) {
      const idx = zones.indexOf(registered);
      if (idx !== -1) zones.splice(idx, 1);
      registered = null;
    }
  });

  const isOver = computed(() => {
    if (!isDragging.value || !elementRef.value) return false;
    const r = elementRef.value.getBoundingClientRect();
    return dragPos.value.x >= r.left && dragPos.value.x <= r.right
        && dragPos.value.y >= r.top && dragPos.value.y <= r.bottom;
  });

  return { isOver, isDragging };
}

// ── Legacy export: still used by SlideCanvas for image-adding helpers ───────

export function useDragDrop(getCanvas: () => fabric.Canvas | null) {
  async function addImageToCanvas(src: string, x?: number, y?: number) {
    const canvas = getCanvas();
    if (!canvas) return;
    try {
      const img = await fabric.Image.fromURL(src, { crossOrigin: 'anonymous' });
      const maxW = canvas.getWidth() * 0.5;
      if (img.width! > maxW) img.scaleToWidth(maxW);
      img.set({
        left: x ?? canvas.getWidth() / 2 - (img.getScaledWidth() / 2),
        top:  y ?? canvas.getHeight() / 2 - (img.getScaledHeight() / 2),
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    } catch (e) {
      console.error('Failed to load image', e);
    }
  }

  async function handleFilePaths(paths: string[], dropX?: number, dropY?: number) {
    const canvas = getCanvas();
    if (!canvas) return;

    let xOff = dropX ?? canvas.getWidth() / 2;
    let yOff = dropY ?? canvas.getHeight() / 2;

    for (const path of paths) {
      const ext = getExt(path);
      if (IMAGE_EXTS.has(ext)) {
        const url = await filePathToDataUrl(path);
        await addImageToCanvas(url, xOff, yOff);
        xOff += 20;
        yOff += 20;
      } else if (VIDEO_EXTS.has(ext)) {
        window.dispatchEvent(new CustomEvent('se:drop-video', { detail: { path } }));
      }
    }
  }

  return { handleFilePaths, addImageToCanvas };
}

// Helper used by ImagesPanel to add a path to the "recent images" list
// without touching the canvas.
export function addPathToRecent(path: string) {
  window.dispatchEvent(new CustomEvent('se:add-image-recent', { detail: { path } }));
}

export { IMAGE_EXTS, VIDEO_EXTS, getExt };
