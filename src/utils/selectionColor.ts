/**
 * Computes Fabric.js object-selection handle colors that are guaranteed to
 * contrast against the canvas background.
 *
 * Strategy:
 *   - Derive a single representative luminance value from the background config.
 *   - Light background  (luminance > 0.40) → dark-indigo border + white corner fill
 *   - Dark  background  (luminance ≤ 0.40) → white border + dark-indigo corner fill
 *   - Image / video bg  → neutral indigo works for both (indigo contrasts white and black)
 *
 * Corners always carry a contrasting fill so they remain visible on top of
 * any object colour as well as the background.
 */

import type { BackgroundConfig } from '@/types';

export interface SelectionColors {
  borderColor: string;
  cornerColor: string;
  cornerStrokeColor: string;
}

// Light background: dark handles, white fill
const DARK_HANDLES: SelectionColors = {
  borderColor: '#312e81',
  cornerColor: '#ffffff',
  cornerStrokeColor: '#312e81',
};

// Dark background: light handles, dark fill
const LIGHT_HANDLES: SelectionColors = {
  borderColor: '#ffffff',
  cornerColor: '#312e81',
  cornerStrokeColor: '#ffffff',
};

// Neutral: indigo border + white fill — readable on mid-range backgrounds
const NEUTRAL_HANDLES: SelectionColors = {
  borderColor: '#6366f1',
  cornerColor: '#ffffff',
  cornerStrokeColor: '#6366f1',
};

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length === 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

function wcagLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function schemeForLuminance(lum: number): SelectionColors {
  return lum > 0.40 ? DARK_HANDLES : LIGHT_HANDLES;
}

export function getSelectionColors(bg: BackgroundConfig): SelectionColors {
  if (bg.type === 'solid') {
    const rgb = parseHex(bg.color ?? '#ffffff');
    if (!rgb) return NEUTRAL_HANDLES;
    return schemeForLuminance(wcagLuminance(...rgb));
  }

  if (
    (bg.type === 'linear-gradient' || bg.type === 'radial-gradient') &&
    bg.stops && bg.stops.length >= 2
  ) {
    // Average the first and last stop colours as a representative luminance
    const a = parseHex(bg.stops[0].color);
    const z = parseHex(bg.stops[bg.stops.length - 1].color);
    if (!a || !z) return NEUTRAL_HANDLES;
    const avg: [number, number, number] = [
      (a[0] + z[0]) / 2,
      (a[1] + z[1]) / 2,
      (a[2] + z[2]) / 2,
    ];
    return schemeForLuminance(wcagLuminance(...avg));
  }

  // image / video: can't know luminance ahead of time; neutral indigo is safest
  return NEUTRAL_HANDLES;
}
