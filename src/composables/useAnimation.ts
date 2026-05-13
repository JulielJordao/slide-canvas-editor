import { watch, onUnmounted } from 'vue';
import * as fabric from 'fabric';
import { useAnimationStore } from '@/stores/animation';
import { useSlidesStore } from '@/stores/slides';
import type { AnimationEffect, AnimationEffectType, EasingType } from '@/types';
import { nanoid } from 'nanoid';

// ─── Easing ──────────────────────────────────────────────────────────────────
function applyEasing(t: number, easing: EasingType): number {
  t = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'easeIn': return t * t;
    case 'easeOut': return t * (2 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'bounce': {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
    default: return t;
  }
}

interface ObjectState { opacity: number; left: number; top: number; scaleX: number; scaleY: number; angle: number; text?: string }

function isEntryEffect(type: AnimationEffectType): boolean {
  return ['fadeIn', 'slideInLeft', 'slideInRight', 'slideInTop', 'slideInBottom', 'zoomIn', 'appear', 'blurIn', 'rotateIn'].includes(type);
}
function isExitEffect(type: AnimationEffectType): boolean {
  return ['fadeOut', 'slideOutLeft', 'slideOutRight', 'slideOutTop', 'slideOutBottom', 'zoomOut', 'disappear', 'blurOut', 'rotateOut'].includes(type);
}

function getHiddenState(type: AnimationEffectType, orig: ObjectState, W: number, H: number): Partial<ObjectState> {
  switch (type) {
    case 'fadeIn': case 'fadeOut': return { opacity: 0 };
    case 'appear': case 'disappear': return { opacity: 0 };
    case 'slideInLeft': case 'slideOutLeft': return { left: -W };
    case 'slideInRight': case 'slideOutRight': return { left: W * 2 };
    case 'slideInTop': case 'slideOutTop': return { top: -H };
    case 'slideInBottom': case 'slideOutBottom': return { top: H * 2 };
    case 'zoomIn': case 'zoomOut': return { scaleX: 0, scaleY: 0, opacity: 0 };
    case 'blurIn': return { scaleX: orig.scaleX * 1.15, scaleY: orig.scaleY * 1.15, opacity: 0 };
    case 'blurOut': return { scaleX: orig.scaleX * 1.15, scaleY: orig.scaleY * 1.15, opacity: 0 };
    case 'rotateIn': return { angle: (orig.angle - 45 + 360) % 360, opacity: 0 };
    case 'rotateOut': return { angle: (orig.angle + 45) % 360, opacity: 0 };
    default: return { opacity: 0 };
  }
}

function applyEffectAtT(type: AnimationEffectType, t: number, orig: ObjectState, W: number, H: number): Partial<ObjectState> {
  switch (type) {
    case 'fadeIn': return { opacity: t };
    case 'fadeOut': return { opacity: 1 - t };
    case 'appear': return { opacity: 1 };
    case 'disappear': return { opacity: 0 };
    case 'slideInLeft': return { left: -W + (orig.left + W) * t };
    case 'slideInRight': return { left: W * 2 - (W * 2 - orig.left) * t };
    case 'slideInTop': return { top: -H + (orig.top + H) * t };
    case 'slideInBottom': return { top: H * 2 - (H * 2 - orig.top) * t };
    case 'slideOutLeft': return { left: orig.left + (-orig.left - W) * t };
    case 'slideOutRight': return { left: orig.left + (W * 2 - orig.left) * t };
    case 'slideOutTop': return { top: orig.top + (-orig.top - H) * t };
    case 'slideOutBottom': return { top: orig.top + (H * 2 - orig.top) * t };
    case 'zoomIn': return { scaleX: orig.scaleX * t, scaleY: orig.scaleY * t, opacity: t };
    case 'zoomOut': return { scaleX: orig.scaleX * (1 - t), scaleY: orig.scaleY * (1 - t), opacity: 1 - t };
    case 'blurIn': return { scaleX: orig.scaleX * (1.15 - 0.15 * t), scaleY: orig.scaleY * (1.15 - 0.15 * t), opacity: t };
    case 'blurOut': return { scaleX: orig.scaleX * (1 + 0.15 * t), scaleY: orig.scaleY * (1 + 0.15 * t), opacity: 1 - t };
    case 'rotateIn': return { angle: orig.angle - 45 * (1 - t), opacity: t };
    case 'rotateOut': return { angle: orig.angle + 45 * t, opacity: 1 - t };
    case 'shake': return { left: orig.left + Math.sin(t * Math.PI * 10) * 12 * (1 - t * 0.5) };
    case 'bounce': return { top: orig.top - Math.sin(t * Math.PI) * 60 };
    case 'pulse': return { scaleX: orig.scaleX * (1 + Math.sin(t * Math.PI * 4) * 0.08), scaleY: orig.scaleY * (1 + Math.sin(t * Math.PI * 4) * 0.08) };
    default: return {};
  }
}

function computeEffect(effect: AnimationEffect, timeMs: number, orig: ObjectState, W: number, H: number): Partial<ObjectState> | null {
  const { startMs, durationMs, type, easing } = effect;
  const endMs = startMs + durationMs;

  if (timeMs < startMs) {
    return isEntryEffect(type) ? getHiddenState(type, orig, W, H) : null;
  }
  if (timeMs >= endMs) {
    return isExitEffect(type) ? getHiddenState(type, orig, W, H) : null;
  }

  const t = applyEasing((timeMs - startMs) / durationMs, easing);
  return applyEffectAtT(type, t, orig, W, H);
}

// ─── Original state cache (WeakMap — no memory leaks) ─────────────────────────
const originalStateCache = new WeakMap<object, ObjectState>();

function cacheOriginalState(obj: fabric.Object): ObjectState {
  if (!originalStateCache.has(obj)) {
    const state: ObjectState = {
      opacity: obj.opacity ?? 1, left: obj.left ?? 0, top: obj.top ?? 0,
      scaleX: obj.scaleX ?? 1, scaleY: obj.scaleY ?? 1, angle: obj.angle ?? 0,
    };
    if ((obj as any).text) {
      state.text = (obj as any).text;
      (obj as any).__originalText = (obj as any).text;
    }
    originalStateCache.set(obj, state);
  }
  return originalStateCache.get(obj)!;
}

function restoreOriginalState(obj: fabric.Object) {
  const orig = originalStateCache.get(obj);
  if (!orig) return;
  obj.set({ opacity: orig.opacity, left: orig.left, top: orig.top, scaleX: orig.scaleX, scaleY: orig.scaleY, angle: orig.angle } as Partial<fabric.Object>);
  if (orig.text !== undefined) (obj as any).set('text', orig.text);
}

// ─── Utility functions (can be used without the watcher loop) ────────────────
export function useObjectUtils(getCanvas: () => fabric.Canvas | null) {
  function ensureObjectIds() {
    const canvas = getCanvas();
    if (!canvas) return;
    canvas.getObjects().forEach(o => {
      if (!(o as any).name) (o as any).name = nanoid(8);
    });
  }

  function getObjectList(): Array<{ id: string; label: string; type: string }> {
    const canvas = getCanvas();
    if (!canvas) return [];
    return canvas.getObjects().map(o => ({
      id: (o as any).name ?? (o as any).id ?? '',
      label: getLabelForObject(o),
      type: o.type ?? 'shape',
    }));
  }

  function getLabelForObject(o: fabric.Object): string {
    if ((o as any).text) return `"${(o as any).text.slice(0, 18)}"`;
    // Fabric v6 uses PascalCase types ('Image'); normalize for comparison.
    if ((o.type ?? '').toLowerCase() === 'image') return 'Imagem';
    if ((o as any).name) return (o as any).name;
    return o.type ?? 'Objeto';
  }

  return { ensureObjectIds, getObjectList };
}

// ─── Full animation composable (use ONLY in SlideCanvas) ─────────────────────
export function useAnimation(getCanvas: () => fabric.Canvas | null) {
  const animStore = useAnimationStore();
  const slidesStore = useSlidesStore();

  let rafId: number | null = null;
  let lastTimestamp: number | null = null;

  const utils = useObjectUtils(getCanvas);

  function applyTimeMs(timeMs: number) {
    const canvas = getCanvas();
    if (!canvas) return;
    const slide = slidesStore.activeSlide;
    if (!slide) return;
    const W = canvas.getWidth();
    const H = canvas.getHeight();

    for (const obj of canvas.getObjects()) {
      const orig = cacheOriginalState(obj);
      restoreOriginalState(obj);

      const objId = (obj as any).name ?? (obj as any).id ?? '';
      const effects = slide.animation.effects.filter(e => e.objectId === objId);

      for (const effect of effects) {
        if (effect.type === 'typewriter') {
          const fullText = (obj as any).__originalText ?? (obj as any).text ?? '';
          const rawT = Math.max(0, Math.min(1, (timeMs - effect.startMs) / effect.durationMs));
          if (timeMs < effect.startMs) {
            (obj as any).set('text', '');
          } else if (timeMs < effect.startMs + effect.durationMs) {
            (obj as any).set('text', fullText.slice(0, Math.floor(rawT * fullText.length)));
          }
        } else {
          const state = computeEffect(effect, timeMs, orig, W, H);
          if (state !== null) obj.set(state as Partial<fabric.Object>);
        }
      }
    }
    canvas.requestRenderAll();
  }

  function tick(timestamp: number) {
    if (!animStore.isPlaying) return;
    if (lastTimestamp !== null) {
      animStore.seekTo(animStore.currentTimeMs + (timestamp - lastTimestamp));
      if (animStore.currentTimeMs >= animStore.totalDurationMs) {
        animStore.stop();
        return;
      }
    }
    lastTimestamp = timestamp;
    applyTimeMs(animStore.currentTimeMs);
    rafId = requestAnimationFrame(tick);
  }

  function startPlayback() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    lastTimestamp = null;
    rafId = requestAnimationFrame(tick);
  }

  function stopPlayback() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    lastTimestamp = null;
    const canvas = getCanvas();
    if (canvas) {
      canvas.getObjects().forEach(obj => {
        restoreOriginalState(obj);
        // Clear cache so next playback re-captures current position as baseline
        originalStateCache.delete(obj);
      });
      canvas.requestRenderAll();
    }
  }

  watch(() => animStore.isPlaying, (playing) => {
    if (playing) startPlayback(); else stopPlayback();
  });

  watch(() => animStore.currentTimeMs, (ms) => {
    if (!animStore.isPlaying) {
      if (ms === 0) {
        // Time reset to 0 (e.g. after stop) — restore everything to its original
        // position instead of running the animation at t=0, which would hide
        // objects whose entry effects only start later.
        const canvas = getCanvas();
        if (canvas) {
          canvas.getObjects().forEach(obj => {
            restoreOriginalState(obj);
            originalStateCache.delete(obj);
          });
          canvas.requestRenderAll();
        }
      } else {
        applyTimeMs(ms);
      }
    }
  });

  watch(() => slidesStore.activeSlide?.animation?.durationMs, (ms) => {
    if (ms !== undefined) animStore.setTotalDuration(ms);
  }, { immediate: true });

  // Call once the canvas is initialised so object:modified invalidates the cache
  function onCanvasReady() {
    const canvas = getCanvas();
    if (!canvas) return;
    canvas.on('object:modified', (e: any) => {
      if (!animStore.isPlaying && e.target) {
        originalStateCache.delete(e.target);
      }
    });
  }

  onUnmounted(stopPlayback);

  return { ...utils, applyTimeMs, startPlayback, stopPlayback, onCanvasReady };
}
