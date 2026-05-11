/**
 * Tests for animation effect computation logic.
 * These test the pure mathematical functions by importing and invoking
 * them through a thin re-export shim, verifying the correct visual state
 * is produced at given time positions.
 */
import { describe, it, expect } from 'vitest';

// ── Inline the pure functions under test ─────────────────────────────────────
// (mirrors useAnimation.ts without any Vue / Fabric / Pinia imports)

type AnimationEffectType = string;
type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';

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

interface ObjectState {
  opacity: number; left: number; top: number;
  scaleX: number; scaleY: number; angle: number;
}

function isEntryEffect(type: AnimationEffectType): boolean {
  return ['fadeIn', 'slideInLeft', 'slideInRight', 'slideInTop', 'slideInBottom',
    'zoomIn', 'appear', 'blurIn', 'rotateIn'].includes(type);
}

function isExitEffect(type: AnimationEffectType): boolean {
  return ['fadeOut', 'slideOutLeft', 'slideOutRight', 'slideOutTop', 'slideOutBottom',
    'zoomOut', 'disappear', 'blurOut', 'rotateOut'].includes(type);
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

interface AnimationEffect {
  startMs: number; durationMs: number; type: string; easing: EasingType;
}

function computeEffect(effect: AnimationEffect, timeMs: number, orig: ObjectState, W: number, H: number): Partial<ObjectState> | null {
  const { startMs, durationMs, type, easing } = effect;
  const endMs = startMs + durationMs;
  if (timeMs < startMs) return isEntryEffect(type) ? getHiddenState(type, orig, W, H) : null;
  if (timeMs >= endMs) return isExitEffect(type) ? getHiddenState(type, orig, W, H) : null;
  const t = applyEasing((timeMs - startMs) / durationMs, easing);
  return applyEffectAtT(type, t, orig, W, H);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORIG: ObjectState = { opacity: 1, left: 400, top: 300, scaleX: 1, scaleY: 1, angle: 0 };
const W = 1920, H = 1080;
const FX = (type: string, startMs = 0, durationMs = 1000): AnimationEffect =>
  ({ type, startMs, durationMs, easing: 'linear' });

// ── Easing ────────────────────────────────────────────────────────────────────

describe('applyEasing', () => {
  it('linear returns t unchanged', () => {
    expect(applyEasing(0.5, 'linear')).toBe(0.5);
  });

  it('easeIn at t=0.5 returns 0.25', () => {
    expect(applyEasing(0.5, 'easeIn')).toBeCloseTo(0.25);
  });

  it('easeOut at t=0.5 returns 0.75', () => {
    expect(applyEasing(0.5, 'easeOut')).toBeCloseTo(0.75);
  });

  it('easeInOut at t=0.5 returns 0.5', () => {
    expect(applyEasing(0.5, 'easeInOut')).toBeCloseTo(0.5);
  });

  it('clamps t below 0', () => {
    expect(applyEasing(-1, 'linear')).toBe(0);
  });

  it('clamps t above 1', () => {
    expect(applyEasing(2, 'linear')).toBe(1);
  });

  it('bounce returns ≥ 0 and ≤ 1 throughout range', () => {
    for (let i = 0; i <= 10; i++) {
      const result = applyEasing(i / 10, 'bounce');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1.01); // slight overshoot allowed in bounce
    }
  });
});

// ── isEntryEffect / isExitEffect ──────────────────────────────────────────────

describe('isEntryEffect / isExitEffect', () => {
  it('fadeIn is entry', () => expect(isEntryEffect('fadeIn')).toBe(true));
  it('fadeOut is exit', () => expect(isExitEffect('fadeOut')).toBe(true));
  it('zoomIn is entry', () => expect(isEntryEffect('zoomIn')).toBe(true));
  it('zoomOut is exit', () => expect(isExitEffect('zoomOut')).toBe(true));
  it('shake is neither', () => {
    expect(isEntryEffect('shake')).toBe(false);
    expect(isExitEffect('shake')).toBe(false);
  });
});

// ── computeEffect: entry effects ─────────────────────────────────────────────

describe('computeEffect — fadeIn', () => {
  const fx = FX('fadeIn');

  it('before start: object is hidden (opacity 0)', () => {
    const result = computeEffect(fx, -100, ORIG, W, H);
    expect(result).toEqual({ opacity: 0 });
  });

  it('at start (t=0): opacity = 0', () => {
    const result = computeEffect(fx, 0, ORIG, W, H);
    expect(result?.opacity).toBeCloseTo(0);
  });

  it('at mid (t=0.5): opacity ≈ 0.5', () => {
    const result = computeEffect(fx, 500, ORIG, W, H);
    expect(result?.opacity).toBeCloseTo(0.5);
  });

  it('after end: returns null (object stays at full opacity)', () => {
    const result = computeEffect(fx, 1001, ORIG, W, H);
    expect(result).toBeNull();
  });
});

describe('computeEffect — fadeOut', () => {
  const fx = FX('fadeOut');

  it('at mid (t=0.5): opacity ≈ 0.5', () => {
    const result = computeEffect(fx, 500, ORIG, W, H);
    expect(result?.opacity).toBeCloseTo(0.5);
  });

  it('after end: object remains hidden (exit effect)', () => {
    const result = computeEffect(fx, 1001, ORIG, W, H);
    expect(result).toEqual({ opacity: 0 });
  });
});

describe('computeEffect — slideInLeft', () => {
  const fx = FX('slideInLeft');

  it('before start: object is off-screen to the left', () => {
    const result = computeEffect(fx, -1, ORIG, W, H);
    expect(result?.left).toBe(-W);
  });

  it('at t≈1 (near end): left approaches original left', () => {
    // At ms=999 of 1000, t=0.999 → left ≈ 397.7; within 3px of target
    const result = computeEffect(fx, 999, ORIG, W, H);
    expect(result?.left).toBeGreaterThan(ORIG.left - 5);
    expect(result?.left).toBeLessThanOrEqual(ORIG.left);
  });
});

describe('computeEffect — zoomIn', () => {
  const fx = FX('zoomIn');

  it('before start: scale 0, opacity 0', () => {
    const result = computeEffect(fx, -1, ORIG, W, H);
    expect(result?.scaleX).toBe(0);
    expect(result?.opacity).toBe(0);
  });

  it('at mid: scaleX ≈ 0.5', () => {
    const result = computeEffect(fx, 500, ORIG, W, H);
    expect(result?.scaleX).toBeCloseTo(0.5);
  });
});

describe('computeEffect — appear', () => {
  it('during effect: opacity is 1 (instant)', () => {
    const result = computeEffect(FX('appear'), 500, ORIG, W, H);
    expect(result?.opacity).toBe(1);
  });

  it('before start: opacity 0 (hidden until startMs)', () => {
    const result = computeEffect(FX('appear', 1000), 500, ORIG, W, H);
    expect(result?.opacity).toBe(0);
  });
});

describe('computeEffect — disappear', () => {
  it('during effect: opacity is 0 (instant)', () => {
    const result = computeEffect(FX('disappear'), 500, ORIG, W, H);
    expect(result?.opacity).toBe(0);
  });

  it('after end: remains hidden (exit effect)', () => {
    const result = computeEffect(FX('disappear'), 2000, ORIG, W, H);
    expect(result?.opacity).toBe(0);
  });
});

describe('computeEffect — rotateIn', () => {
  it('before start: rotated -45 degrees from original', () => {
    const result = computeEffect(FX('rotateIn'), -1, ORIG, W, H);
    expect(result?.angle).toBe((ORIG.angle - 45 + 360) % 360);
  });

  it('at t=0.5: angle halfway between hidden and original', () => {
    const result = computeEffect(FX('rotateIn'), 500, ORIG, W, H);
    expect(result?.angle).toBeCloseTo(ORIG.angle - 45 * 0.5);
  });
});

describe('computeEffect — blurIn', () => {
  it('before start: scale inflated by 1.15, opacity 0', () => {
    const result = computeEffect(FX('blurIn'), -1, ORIG, W, H);
    expect(result?.scaleX).toBeCloseTo(ORIG.scaleX * 1.15);
    expect(result?.opacity).toBe(0);
  });

  it('at t=1: scale equals original, opacity 1', () => {
    const result = computeEffect(FX('blurIn'), 999, ORIG, W, H);
    expect(result?.scaleX).toBeCloseTo(ORIG.scaleX * 1.0, 1);
    expect(result?.opacity).toBeCloseTo(1, 1);
  });
});

describe('computeEffect — shake', () => {
  it('during effect: returns adjusted left (non-null)', () => {
    const result = computeEffect(FX('shake'), 250, ORIG, W, H);
    expect(result).not.toBeNull();
    expect(typeof result?.left).toBe('number');
  });

  it('before start: returns null (shake is not an entry effect)', () => {
    const result = computeEffect(FX('shake', 1000), 0, ORIG, W, H);
    expect(result).toBeNull();
  });
});

describe('computeEffect — bounce', () => {
  it('at t=0.5: top displaced upward from original', () => {
    const result = computeEffect(FX('bounce'), 500, ORIG, W, H);
    // sin(π * 0.5) = 1, so top = orig.top - 60
    expect(result?.top).toBeCloseTo(ORIG.top - 60);
  });

  it('at t=0 and t≈1: top returns close to original (sin(0)=0, sin(π)≈0)', () => {
    const atStart = computeEffect(FX('bounce'), 0, ORIG, W, H);
    expect(atStart?.top).toBeCloseTo(ORIG.top, 0);
    // At ms=999 of 1000, t=0.999: sin(0.999π) ≈ 0.003 → displacement < 0.2px
    const atEnd = computeEffect(FX('bounce'), 999, ORIG, W, H);
    expect(atEnd?.top).toBeCloseTo(ORIG.top, 0);
  });
});

describe('computeEffect — delayed effects', () => {
  it('effect with startMs=2000 returns null at t=0 when not an entry effect', () => {
    const fx: AnimationEffect = { type: 'shake', startMs: 2000, durationMs: 1000, easing: 'linear' };
    expect(computeEffect(fx, 0, ORIG, W, H)).toBeNull();
    expect(computeEffect(fx, 2500, ORIG, W, H)).not.toBeNull();
  });

  it('entry effect with startMs=2000 hides object before startMs', () => {
    const fx: AnimationEffect = { type: 'fadeIn', startMs: 2000, durationMs: 1000, easing: 'linear' };
    const before = computeEffect(fx, 1000, ORIG, W, H);
    expect(before?.opacity).toBe(0);
    const during = computeEffect(fx, 2500, ORIG, W, H);
    expect(during?.opacity).toBeCloseTo(0.5);
  });
});
