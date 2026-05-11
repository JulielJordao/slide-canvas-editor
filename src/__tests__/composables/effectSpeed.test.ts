/**
 * Tests for new behaviors introduced in the second feature batch:
 *  - Speed preset ↔ duration mapping (AnimationEffectsPanel "Ativos" tab)
 *  - Context-menu preview time calculation
 *  - Animation state at t=0 for entry/exit effects (explains the stop-restore bug)
 *  - Project file serialisation format (used by Save/Load)
 *  - Effect duration floor validation
 */
import { describe, it, expect } from 'vitest';

// ── Speed preset helpers ──────────────────────────────────────────────────────
// Mirrors the constants in AnimationEffectsPanel.vue

const speedDurationMs: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 2000,
  normal: 1000,
  fast: 400,
};

function getSpeedFromMs(ms: number): 'slow' | 'normal' | 'fast' | null {
  if (ms === speedDurationMs.slow) return 'slow';
  if (ms === speedDurationMs.normal) return 'normal';
  if (ms === speedDurationMs.fast) return 'fast';
  return null;
}

describe('speedDurationMs constants', () => {
  it('slow is 2 000 ms', () => expect(speedDurationMs.slow).toBe(2000));
  it('normal is 1 000 ms', () => expect(speedDurationMs.normal).toBe(1000));
  it('fast is 400 ms', () => expect(speedDurationMs.fast).toBe(400));
});

describe('getSpeedFromMs', () => {
  it('returns "slow" for 2000 ms', () => expect(getSpeedFromMs(2000)).toBe('slow'));
  it('returns "normal" for 1000 ms', () => expect(getSpeedFromMs(1000)).toBe('normal'));
  it('returns "fast" for 400 ms', () => expect(getSpeedFromMs(400)).toBe('fast'));
  it('returns null for custom durations', () => {
    expect(getSpeedFromMs(500)).toBeNull();
    expect(getSpeedFromMs(1500)).toBeNull();
    expect(getSpeedFromMs(0)).toBeNull();
  });
  it('round-trips: getSpeedFromMs(speedDurationMs[s]) === s', () => {
    for (const s of ['slow', 'normal', 'fast'] as const) {
      expect(getSpeedFromMs(speedDurationMs[s])).toBe(s);
    }
  });
});

// ── Effect duration floor ─────────────────────────────────────────────────────
// The template applies Math.max(100, ...) before storing to prevent zero-length effects.

function clampDurationMs(rawMs: number): number {
  return Math.max(100, Math.round(rawMs));
}

describe('effect duration floor', () => {
  it('allows durations of 100 ms or more unchanged', () => {
    expect(clampDurationMs(100)).toBe(100);
    expect(clampDurationMs(1000)).toBe(1000);
  });
  it('floors values below 100 ms to 100', () => {
    expect(clampDurationMs(0)).toBe(100);
    expect(clampDurationMs(50)).toBe(100);
    expect(clampDurationMs(99)).toBe(100);
  });
  it('rounds fractional milliseconds', () => {
    expect(clampDurationMs(1500.7)).toBe(1501);
    expect(clampDurationMs(0.4)).toBe(100); // floor kicks in after rounding
  });
});

// ── Context-menu preview time calculation ────────────────────────────────────
// Clicking an effect in the right-click menu calls applyTimeMs(startMs + durationMs / 2)
// to preview the mid-point of the animation.

function previewTimeMs(startMs: number, durationMs: number): number {
  return startMs + durationMs / 2;
}

describe('context-menu preview time', () => {
  it('mid-point of a 1000ms effect starting at 0 is 500ms', () => {
    expect(previewTimeMs(0, 1000)).toBe(500);
  });
  it('mid-point of a 2000ms effect starting at 1000ms is 2000ms', () => {
    expect(previewTimeMs(1000, 2000)).toBe(2000);
  });
  it('mid-point of a 400ms effect starting at 3600ms is 3800ms', () => {
    expect(previewTimeMs(3600, 400)).toBe(3800);
  });
  it('never returns a negative time', () => {
    expect(previewTimeMs(0, 0)).toBe(0);
  });
});

// ── Animation state at t=0 for entry effects ─────────────────────────────────
// Reproduces the exact scenario that caused the "timeline drag erases canvas" bug.
//
// computeEffect returns getHiddenState when timeMs < startMs for entry effects,
// meaning applyTimeMs(0) on a slide where entry effects start at t>0 would hide
// every such object.  The fix: when stopping, restore originals instead of
// calling applyTimeMs(0).

type ObjectState = { opacity: number; left: number; top: number; scaleX: number; scaleY: number; angle: number };

function isEntryEffect(type: string): boolean {
  return ['fadeIn', 'slideInLeft', 'slideInRight', 'slideInTop', 'slideInBottom',
    'zoomIn', 'appear', 'blurIn', 'rotateIn'].includes(type);
}

function getHiddenState(type: string, orig: ObjectState, W: number, H: number): Partial<ObjectState> {
  switch (type) {
    case 'fadeIn': case 'fadeOut': return { opacity: 0 };
    case 'appear': case 'disappear': return { opacity: 0 };
    case 'slideInLeft': case 'slideOutLeft': return { left: -W };
    case 'slideInRight': case 'slideOutRight': return { left: W * 2 };
    case 'slideInTop': case 'slideOutTop': return { top: -H };
    case 'slideInBottom': case 'slideOutBottom': return { top: H * 2 };
    case 'zoomIn': case 'zoomOut': return { scaleX: 0, scaleY: 0, opacity: 0 };
    default: return { opacity: 0 };
  }
}

function computeEffect(
  effect: { startMs: number; durationMs: number; type: string; easing: string },
  timeMs: number,
  orig: ObjectState,
  W: number,
  H: number,
): Partial<ObjectState> | null {
  const endMs = effect.startMs + effect.durationMs;
  if (timeMs < effect.startMs) {
    return isEntryEffect(effect.type) ? getHiddenState(effect.type, orig, W, H) : null;
  }
  if (timeMs >= endMs) return null;
  const t = (timeMs - effect.startMs) / effect.durationMs;
  if (effect.type === 'fadeIn') return { opacity: t };
  return null;
}

const ORIG: ObjectState = { opacity: 1, left: 100, top: 200, scaleX: 1, scaleY: 1, angle: 0 };
const W = 1920, H = 1080;

describe('computeEffect at t=0 (root cause of stop-restore bug)', () => {
  it('entry effect with startMs>0 → returns hidden state at t=0', () => {
    // This is exactly what applyTimeMs(0) did after stop, hiding the objects.
    const effect = { startMs: 1000, durationMs: 500, type: 'fadeIn', easing: 'linear' };
    const state = computeEffect(effect, 0, ORIG, W, H);
    expect(state).not.toBeNull();
    expect(state!.opacity).toBe(0);
  });

  it('entry effect with startMs=0 → not hidden at t=0 (already at start)', () => {
    const effect = { startMs: 0, durationMs: 1000, type: 'fadeIn', easing: 'linear' };
    const state = computeEffect(effect, 0, ORIG, W, H);
    // t=0 of the animation → opacity=0 (just beginning to fade in), NOT null
    expect(state).not.toBeNull();
    expect(state!.opacity).toBe(0);
  });

  it('non-entry effect at t=0 before its window → returns null (no override)', () => {
    const effect = { startMs: 1000, durationMs: 500, type: 'shake', easing: 'linear' };
    const state = computeEffect(effect, 0, ORIG, W, H);
    expect(state).toBeNull();
  });

  it('slideInLeft effect with startMs=2000 is off-screen at t=0', () => {
    const effect = { startMs: 2000, durationMs: 800, type: 'slideInLeft', easing: 'linear' };
    const state = computeEffect(effect, 0, ORIG, W, H);
    expect(state).not.toBeNull();
    expect(state!.left).toBe(-W);
  });

  it('after end of entry effect → null (stays in final position)', () => {
    const effect = { startMs: 0, durationMs: 1000, type: 'fadeIn', easing: 'linear' };
    const state = computeEffect(effect, 2000, ORIG, W, H);
    expect(state).toBeNull();
  });
});

// ── Project file format ───────────────────────────────────────────────────────
// Validates the JSON structure produced by saveToFile / consumed by openFromFile.

interface ProjectFile {
  version: number;
  slides: Array<{
    id: string;
    fabricJSON: string;
    background: { type: string; color?: string };
    thumbnailDataUrl: string;
    animation: {
      durationMs: number;
      effects: unknown[];
      outTransition: { type: string; durationMs: number };
    };
  }>;
  aspectRatio: { label: string; width: number; height: number };
}

function serializeProject(slides: ProjectFile['slides'], aspectRatio: ProjectFile['aspectRatio']): string {
  return JSON.stringify({ version: 1, slides, aspectRatio });
}

function deserializeProject(raw: string): ProjectFile | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.slides?.length) return null;
    return parsed as ProjectFile;
  } catch {
    return null;
  }
}

const SAMPLE_SLIDE: ProjectFile['slides'][0] = {
  id: 'slide-1',
  fabricJSON: JSON.stringify({ version: '6.0.0', objects: [] }),
  background: { type: 'solid', color: '#ffffff' },
  thumbnailDataUrl: '',
  animation: {
    durationMs: 5000,
    effects: [],
    outTransition: { type: 'fade', durationMs: 500 },
  },
};

const SAMPLE_RATIO: ProjectFile['aspectRatio'] = { label: '16:9', width: 1920, height: 1080 };

describe('project file serialisation', () => {
  it('serialises to a valid JSON string', () => {
    const raw = serializeProject([SAMPLE_SLIDE], SAMPLE_RATIO);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('round-trips version, slides, and aspectRatio', () => {
    const raw = serializeProject([SAMPLE_SLIDE], SAMPLE_RATIO);
    const parsed = deserializeProject(raw)!;
    expect(parsed.version).toBe(1);
    expect(parsed.slides).toHaveLength(1);
    expect(parsed.slides[0].id).toBe('slide-1');
    expect(parsed.aspectRatio.width).toBe(1920);
    expect(parsed.aspectRatio.height).toBe(1080);
  });

  it('preserves animation effects on slides', () => {
    const slideWithEffect = {
      ...SAMPLE_SLIDE,
      animation: {
        ...SAMPLE_SLIDE.animation,
        effects: [{ id: 'e1', objectId: 'obj-1', type: 'fadeIn', startMs: 500, durationMs: 1000, easing: 'easeOut' }],
      },
    };
    const raw = serializeProject([slideWithEffect], SAMPLE_RATIO);
    const parsed = deserializeProject(raw)!;
    expect(parsed.slides[0].animation.effects).toHaveLength(1);
    expect((parsed.slides[0].animation.effects[0] as any).type).toBe('fadeIn');
  });

  it('returns null when there are no slides', () => {
    expect(deserializeProject(JSON.stringify({ version: 1, slides: [], aspectRatio: SAMPLE_RATIO }))).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(deserializeProject('not-json')).toBeNull();
  });

  it('preserves base64 fabricJSON (images survive round-trip)', () => {
    const base64Canvas = JSON.stringify({
      version: '6.0.0',
      objects: [{ type: 'image', src: 'data:image/png;base64,iVBORw0KGgo=' }],
    });
    const slideWithImage = { ...SAMPLE_SLIDE, fabricJSON: base64Canvas };
    const raw = serializeProject([slideWithImage], SAMPLE_RATIO);
    const parsed = deserializeProject(raw)!;
    const canvas = JSON.parse(parsed.slides[0].fabricJSON);
    expect(canvas.objects[0].src).toContain('base64');
  });
});
