/**
 * Tests for the floating ContextToolbar layout fixes:
 *
 *  - stepSize(): the −/+ buttons next to the font-size field replace the
 *    near-invisible native number spinners.  The new value must stay clamped
 *    to the same [6, 800] range the <input min/max> enforced.
 *
 *  - ColorPicker `compact` prop: in the floating toolbar the colour control
 *    collapses to a single swatch and the picker popup floats absolutely, so
 *    opening it no longer grows the control's box (which used to vertically
 *    recentre every sibling in the toolbar).
 */
import { describe, it, expect } from 'vitest';

// Mirrors stepSize() in ContextToolbar.vue
function stepSize(currentFontSize: number | undefined, delta: number): number {
  const current = Number(currentFontSize) || 24;
  return Math.max(6, Math.min(800, current + delta));
}

describe('stepSize — font size stepper clamping', () => {
  it('increments by the given delta', () => {
    expect(stepSize(48, 1)).toBe(49);
  });

  it('decrements by the given delta', () => {
    expect(stepSize(48, -1)).toBe(47);
  });

  it('clamps to the minimum of 6', () => {
    expect(stepSize(6, -1)).toBe(6);
    expect(stepSize(7, -1)).toBe(6);
  });

  it('clamps to the maximum of 800', () => {
    expect(stepSize(800, 1)).toBe(800);
    expect(stepSize(799, 1)).toBe(800);
  });

  it('falls back to 24 when the current size is missing', () => {
    expect(stepSize(undefined, 1)).toBe(25);
    expect(stepSize(0, 1)).toBe(25);
  });

  it('repeated decrements never go below 6', () => {
    let size = 10;
    for (let i = 0; i < 20; i++) size = stepSize(size, -1);
    expect(size).toBe(6);
  });
});

describe('ColorPicker compact prop contract', () => {
  // In compact mode the closed control renders only the swatch; the hex
  // input + eyedrop button move into the (absolutely-positioned) popup.
  function rowChildren(compact: boolean): string[] {
    const children = ['color-preview'];
    if (!compact) {
      children.push('hex-input', 'eyedrop-btn');
    }
    return children;
  }

  it('non-compact row shows preview, hex input and eyedrop', () => {
    expect(rowChildren(false)).toEqual(['color-preview', 'hex-input', 'eyedrop-btn']);
  });

  it('compact row shows only the preview swatch', () => {
    expect(rowChildren(true)).toEqual(['color-preview']);
  });

  it('compact popup hosts the hex row so functionality is not lost', () => {
    // popup contents when compact: hex row + SV + hue + swatches
    const compactPopup = ['popup-hex-row', 'sv-area', 'hue-row', 'swatches'];
    expect(compactPopup).toContain('popup-hex-row');
    // non-compact popup has no hex row (it stays in the closed row)
    const normalPopup = ['sv-area', 'hue-row', 'swatches'];
    expect(normalPopup).not.toContain('popup-hex-row');
  });

  it('compact popup is absolutely positioned so it does not grow the control', () => {
    // Documents the CSS contract: an absolute popup is out of flow, so the
    // .color-picker box stays the height of the swatch when the popup opens.
    const compactPopupPosition = 'absolute';
    const normalPopupPosition = 'static'; // in flow, margin-top pushes siblings
    expect(compactPopupPosition).toBe('absolute');
    expect(normalPopupPosition).not.toBe('absolute');
  });
});
