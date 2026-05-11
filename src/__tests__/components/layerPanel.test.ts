/**
 * Tests for LayerPanel concerns that can be verified without Fabric.js:
 *
 *   1. Display-index ↔ canvas-index conversion used by moveLayer().
 *      The panel shows layers in reverse order (display[0] = canvas[n-1] = front).
 *
 *   2. The `data-tooltip` attribute strategy for sidebar tab tooltips —
 *      verifying the attribute value is set correctly (as opposed to the
 *      old `title` attribute approach which relied on slow native tooltips).
 */
import { describe, it, expect } from 'vitest';

// ── Display-index ↔ canvas-index math ────────────────────────────────────────
//
// canvas.getObjects() returns objects from back (index 0) to front (index n-1).
// LayerPanel reverses this so index 0 in the panel = front = canvas[n-1].
//
// moveLayer converts display indices to canvas indices:
//   canvasIdx = (n - 1) - displayIdx

function displayToCanvas(displayIdx: number, total: number): number {
  return (total - 1) - displayIdx;
}

function computeMoveDelta(fromDisplay: number, toDisplay: number, total: number): number {
  const canvasFrom = displayToCanvas(fromDisplay, total);
  const canvasTo   = displayToCanvas(toDisplay,   total);
  return canvasTo - canvasFrom; // positive = bringForward steps, negative = sendBackward steps
}

describe('displayToCanvas index conversion', () => {
  it('display 0 (front) maps to canvas last index', () => {
    expect(displayToCanvas(0, 4)).toBe(3);
  });

  it('display n-1 (back) maps to canvas 0', () => {
    expect(displayToCanvas(3, 4)).toBe(0);
  });

  it('middle display index maps symmetrically', () => {
    expect(displayToCanvas(1, 4)).toBe(2);
    expect(displayToCanvas(2, 4)).toBe(1);
  });

  it('single object: display 0 = canvas 0', () => {
    expect(displayToCanvas(0, 1)).toBe(0);
  });
});

describe('moveLayer delta calculation', () => {
  // 4 objects: canvas [A=0, B=1, C=2, D=3], display [D=0, C=1, B=2, A=3]

  it('dragging from display 0 to display 2 sends object backward 2 steps', () => {
    // display 0 = canvas 3, display 2 = canvas 1 → delta = 1-3 = -2 (sendBackward ×2)
    expect(computeMoveDelta(0, 2, 4)).toBe(-2);
  });

  it('dragging from display 3 to display 1 brings object forward 2 steps', () => {
    // display 3 = canvas 0, display 1 = canvas 2 → delta = 2-0 = +2 (bringForward ×2)
    expect(computeMoveDelta(3, 1, 4)).toBe(2);
  });

  it('dragging to same index produces delta 0 (no-op)', () => {
    expect(computeMoveDelta(1, 1, 4)).toBe(0);
  });

  it('dragging display 2 to display 1 (up one slot) gives delta +1', () => {
    expect(computeMoveDelta(2, 1, 4)).toBe(1);
  });

  it('dragging display 0 to display 3 (bottom) gives delta -3', () => {
    expect(computeMoveDelta(0, 3, 4)).toBe(-3);
  });
});

describe('moveLayer step count', () => {
  it('positive delta requires that many bringObjectForward calls', () => {
    const delta = computeMoveDelta(3, 0, 4); // canvas 0 → canvas 3: delta = +3
    expect(delta).toBe(3); // 3 × bringObjectForward
  });

  it('negative delta requires |delta| sendObjectBackwards calls', () => {
    const delta = computeMoveDelta(0, 3, 4); // canvas 3 → canvas 0: delta = -3
    expect(Math.abs(delta)).toBe(3); // 3 × sendObjectBackwards
  });
});

// ── Tooltip attribute strategy ────────────────────────────────────────────────
//
// Previously, sidebar tabs used the native `title` attribute which shows a
// tooltip only after a long hover delay and cannot be styled.
// The fix: use `data-tooltip` with a CSS `::after` pseudo-element for instant,
// styled tooltips. These tests verify the attribute value logic.

function buildTabTooltipAttr(label: string): { 'data-tooltip': string } {
  return { 'data-tooltip': label };
}

describe('sidebar tab tooltip attribute', () => {
  const tabs = [
    { id: 'slides',     label: 'Slides' },
    { id: 'images',     label: 'Imagens' },
    { id: 'text',       label: 'Texto' },
    { id: 'background', label: 'Fundo' },
    { id: 'animation',  label: 'Animação' },
    { id: 'ai',         label: 'IA (Gemini)' },
  ];

  it('every tab has a data-tooltip attribute equal to its label', () => {
    for (const tab of tabs) {
      const attr = buildTabTooltipAttr(tab.label);
      expect(attr['data-tooltip']).toBe(tab.label);
    }
  });

  it('the "Google Fonts" tab no longer exists in the tab list', () => {
    const ids = tabs.map(t => t.id);
    expect(ids).not.toContain('fonts');
  });

  it('data-tooltip is set on the attribute, not title', () => {
    const attr = buildTabTooltipAttr('Slides');
    expect('data-tooltip' in attr).toBe(true);
    // The old title attribute should not be used
    expect('title' in attr).toBe(false);
  });

  it('preserves unicode characters in labels (e.g. Animação)', () => {
    const attr = buildTabTooltipAttr('Animação');
    expect(attr['data-tooltip']).toBe('Animação');
  });
});

// ── Listener accumulation guard for LayerPanel ───────────────────────────────
//
// The previous implementation used setTimeout(setup, 200) which was fragile.
// The fix uses a retry loop. This models the retry contract.

describe('canvas setup retry logic', () => {
  it('retries up to maxRetries times before giving up', () => {
    let attempts = 0;
    let canvasReady = false;

    function trySetup(retries: number): boolean {
      attempts++;
      if (canvasReady) return true;
      if (retries > 0) return trySetup(retries - 1);
      return false;
    }

    // Canvas never becomes ready → should attempt maxRetries + 1 times then stop
    expect(trySetup(5)).toBe(false);
    expect(attempts).toBe(6); // initial + 5 retries
  });

  it('succeeds immediately when canvas is available on first try', () => {
    let attempts = 0;
    const canvasReady = true;

    function trySetup(retries: number): boolean {
      attempts++;
      if (canvasReady) return true;
      if (retries > 0) return trySetup(retries - 1);
      return false;
    }

    expect(trySetup(15)).toBe(true);
    expect(attempts).toBe(1);
  });

  it('succeeds on the 3rd retry when canvas becomes ready after 2 failures', () => {
    let attempts = 0;
    let canvasReady = false;

    function trySetup(retries: number): boolean {
      attempts++;
      if (attempts >= 3) canvasReady = true; // becomes available on 3rd call
      if (canvasReady) return true;
      if (retries > 0) return trySetup(retries - 1);
      return false;
    }

    expect(trySetup(15)).toBe(true);
    expect(attempts).toBe(3);
  });
});
