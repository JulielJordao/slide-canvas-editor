import { describe, it, expect } from 'vitest';
import { getSelectionColors } from '@/utils/selectionColor';
import type { BackgroundConfig } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function solid(color: string): BackgroundConfig {
  return { type: 'solid', color };
}

function linearGrad(colors: string[]): BackgroundConfig {
  return {
    type: 'linear-gradient',
    stops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c })),
  };
}

function radialGrad(colors: string[]): BackgroundConfig {
  return {
    type: 'radial-gradient',
    stops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c })),
  };
}

// ── Solid colours — light backgrounds ────────────────────────────────────────

describe('getSelectionColors — light solid backgrounds', () => {
  it('white background → dark handles', () => {
    const c = getSelectionColors(solid('#ffffff'));
    expect(c.borderColor).toBe('#312e81');
    expect(c.cornerColor).toBe('#ffffff');
    expect(c.cornerStrokeColor).toBe('#312e81');
  });

  it('light gray background → dark handles', () => {
    const c = getSelectionColors(solid('#f0f0f0'));
    expect(c.borderColor).toBe('#312e81');
  });

  it('light yellow background → dark handles', () => {
    const c = getSelectionColors(solid('#fffde7'));
    expect(c.borderColor).toBe('#312e81');
  });

  it('pale blue background → dark handles', () => {
    const c = getSelectionColors(solid('#e3f2fd'));
    expect(c.borderColor).toBe('#312e81');
  });
});

// ── Solid colours — dark backgrounds ─────────────────────────────────────────

describe('getSelectionColors — dark solid backgrounds', () => {
  it('black background → light handles', () => {
    const c = getSelectionColors(solid('#000000'));
    expect(c.borderColor).toBe('#ffffff');
    expect(c.cornerColor).toBe('#312e81');
    expect(c.cornerStrokeColor).toBe('#ffffff');
  });

  it('dark navy background → light handles', () => {
    const c = getSelectionColors(solid('#0a0a2e'));
    expect(c.borderColor).toBe('#ffffff');
  });

  it('dark red background → light handles', () => {
    const c = getSelectionColors(solid('#7f0000'));
    expect(c.borderColor).toBe('#ffffff');
  });

  it('dark gray background → light handles', () => {
    const c = getSelectionColors(solid('#222222'));
    expect(c.borderColor).toBe('#ffffff');
  });
});

// ── Luminance threshold ───────────────────────────────────────────────────────

describe('getSelectionColors — mid-tones switch at ≈0.40 luminance', () => {
  // Pure 50% gray (#7f7f7f) has luminance ≈ 0.216 → dark background → light handles
  it('mid gray (#7f7f7f, lum≈0.22) → light handles', () => {
    expect(getSelectionColors(solid('#7f7f7f')).borderColor).toBe('#ffffff');
  });

  // #b0b0b0 has luminance ≈ 0.46 → light background → dark handles
  it('light-mid gray (#b0b0b0, lum≈0.46) → dark handles', () => {
    expect(getSelectionColors(solid('#b0b0b0')).borderColor).toBe('#312e81');
  });
});

// ── Gradient backgrounds ──────────────────────────────────────────────────────

describe('getSelectionColors — gradient backgrounds', () => {
  it('white-to-light-gray gradient → dark handles', () => {
    const c = getSelectionColors(linearGrad(['#ffffff', '#e0e0e0']));
    expect(c.borderColor).toBe('#312e81');
  });

  it('black-to-dark-navy gradient → light handles', () => {
    const c = getSelectionColors(linearGrad(['#000000', '#0d0d3a']));
    expect(c.borderColor).toBe('#ffffff');
  });

  it('white-to-black gradient → light handles (avg RGB = #7f7f7f, WCAG lum ≈ 0.22 < 0.40)', () => {
    // WCAG luminance is non-linear: avg of #ffffff and #000000 in RGB space
    // is #7f7f7f whose WCAG luminance is ≈ 0.216, below the 0.40 threshold.
    const c = getSelectionColors(linearGrad(['#ffffff', '#000000']));
    expect(c.borderColor).toBe('#ffffff');
  });

  it('dark-to-dark gradient → light handles', () => {
    const c = getSelectionColors(linearGrad(['#1a1a2e', '#16213e']));
    expect(c.borderColor).toBe('#ffffff');
  });

  it('works with radial gradients too', () => {
    const light = getSelectionColors(radialGrad(['#ffffff', '#f0f0f0']));
    const dark  = getSelectionColors(radialGrad(['#000000', '#111111']));
    expect(light.borderColor).toBe('#312e81');
    expect(dark.borderColor).toBe('#ffffff');
  });
});

// ── Image / video backgrounds ─────────────────────────────────────────────────

describe('getSelectionColors — image and video backgrounds', () => {
  it('image background → neutral indigo handles', () => {
    const c = getSelectionColors({ type: 'image', src: '/some/image.jpg' });
    expect(c.borderColor).toBe('#6366f1');
    expect(c.cornerColor).toBe('#ffffff');
    expect(c.cornerStrokeColor).toBe('#6366f1');
  });

  it('video background → neutral indigo handles', () => {
    const c = getSelectionColors({ type: 'video', src: '/some/video.mp4' });
    expect(c.borderColor).toBe('#6366f1');
  });
});

// ── Output shape ──────────────────────────────────────────────────────────────

describe('getSelectionColors — output shape', () => {
  it('always returns borderColor, cornerColor, and cornerStrokeColor', () => {
    for (const bg of [
      solid('#ffffff'), solid('#000000'),
      linearGrad(['#fff', '#000']),
      { type: 'image', src: '/img.png' } as BackgroundConfig,
    ]) {
      const c = getSelectionColors(bg);
      expect(typeof c.borderColor).toBe('string');
      expect(typeof c.cornerColor).toBe('string');
      expect(typeof c.cornerStrokeColor).toBe('string');
      expect(c.borderColor.startsWith('#')).toBe(true);
    }
  });

  it('solid type with no color defaults to #ffffff (white), giving dark handles', () => {
    // The utility falls back to #ffffff when color is missing.
    // White has luminance 1.0 → above 0.40 threshold → dark handles.
    const c = getSelectionColors({ type: 'solid' });
    expect(c.borderColor).toBe('#312e81');
  });
});
