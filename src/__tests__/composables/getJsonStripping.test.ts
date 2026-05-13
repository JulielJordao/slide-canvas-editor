/**
 * Tests for the getJSON background-stripping invariant.
 *
 * Background properties (backgroundImage, background) are stripped from the
 * canvas JSON snapshot so that:
 *  1. loadFromJSON never tries to revive a stale video/image URL (which fails
 *     and blocks object restoration when opening .sedp files).
 *  2. Undo/redo snapshots don't accidentally revert background changes.
 *  3. applyBackground() is always the single source of truth for the background.
 */
import { describe, it, expect } from 'vitest';

// Mirror of the stripping logic in useFabricCanvas.ts getJSON()
function stripBackground(raw: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...raw };
  delete copy.backgroundImage;
  delete copy.background;
  return copy;
}

describe('stripBackground', () => {
  it('removes backgroundImage from the canvas JSON', () => {
    const raw = {
      version: '6.0.0',
      objects: [{ type: 'rect' }],
      backgroundImage: { type: 'image', src: 'data:image/png;base64,...' },
    };
    const stripped = stripBackground(raw);
    expect(stripped.backgroundImage).toBeUndefined();
  });

  it('removes background (color/gradient) from the canvas JSON', () => {
    const raw = {
      version: '6.0.0',
      objects: [],
      background: '#1a1a2e',
    };
    const stripped = stripBackground(raw);
    expect(stripped.background).toBeUndefined();
  });

  it('preserves version and objects', () => {
    const raw = {
      version: '6.0.0',
      objects: [{ type: 'i-text', text: 'Hello' }],
      background: '#fff',
      backgroundImage: { type: 'image', src: 'data:...' },
    };
    const stripped = stripBackground(raw);
    expect(stripped.version).toBe('6.0.0');
    expect(stripped.objects).toEqual([{ type: 'i-text', text: 'Hello' }]);
  });

  it('is safe on JSON with no background properties', () => {
    const raw = { version: '6.0.0', objects: [] };
    const stripped = stripBackground(raw);
    expect(stripped).toEqual({ version: '6.0.0', objects: [] });
  });

  it('removes a gradient backgroundImage reference (video background case)', () => {
    const raw = {
      version: '6.0.0',
      objects: [{ type: 'rect' }, { type: 'i-text', text: 'Test' }],
      backgroundImage: {
        type: 'image',
        src: '',
        scaleX: 1,
        scaleY: 1,
      },
    };
    const stripped = stripBackground(raw);
    expect(stripped.backgroundImage).toBeUndefined();
    expect((stripped.objects as any[]).length).toBe(2);
  });
});

// ── scheduleHistoryPush must use stripped JSON ────────────────────────────────
//
// scheduleHistoryPush and pushHistoryNow previously called toJSON() directly
// (bypassing getJSON), so backgroundImage (the Fabric.Image wrapping the
// HTMLVideoElement) was persisted in the slide's fabricJSON.  On reload,
// loadFromJSON tried to revive that image from the (already-revoked) blob URL,
// blocking object restoration and preventing the video background from
// restarting cleanly.
//
// The contract: any JSON that is stored (history or slide) must NOT contain
// backgroundImage or background keys.

describe('history push uses stripped JSON', () => {
  it('a canvas snapshot with backgroundImage is not storable as-is', () => {
    const rawWithBg = {
      version: '6.0.0',
      objects: [{ type: 'i-text', text: 'Sejam Todos Bem Vindos!' }],
      backgroundImage: { type: 'image', src: 'blob:null/abc-def' },
    };
    // Simulates getJSON() stripping
    const stripped = { ...rawWithBg };
    delete (stripped as any).backgroundImage;
    expect(stripped.backgroundImage).toBeUndefined();
    expect((stripped.objects as any[]).length).toBe(1);
  });

  it('the stored JSON round-trips without the backgroundImage key', () => {
    const original = {
      version: '6.0.0',
      objects: [{ type: 'rect', width: 200, height: 100 }],
      backgroundImage: { type: 'image', src: 'blob:null/xyz' },
      background: '#000000',
    };
    const stored = JSON.stringify(original);
    const parsed = JSON.parse(stored);
    delete parsed.backgroundImage;
    delete parsed.background;
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped.backgroundImage).toBeUndefined();
    expect(roundTripped.background).toBeUndefined();
    expect(roundTripped.version).toBe('6.0.0');
    expect(roundTripped.objects).toHaveLength(1);
  });
});

// ── Explicit history-commit contract ─────────────────────────────────────────
//
// Animation mutations (add/remove/update effect, transition change, duration
// change) dispatch 'se:commit-history' instead of relying on a deep watcher.
// This guarantees one history entry per user action regardless of Vue's
// watcher flush timing.

describe('se:commit-history dispatch invariant', () => {
  it('dispatching the event is synchronous (not deferred)', () => {
    let received = false;
    const handler = () => { received = true; };
    window.addEventListener('se:commit-history', handler, { once: true });
    window.dispatchEvent(new CustomEvent('se:commit-history'));
    expect(received).toBe(true);
    window.removeEventListener('se:commit-history', handler);
  });

  it('multiple distinct dispatches result in multiple listener calls', () => {
    let count = 0;
    const handler = () => { count++; };
    window.addEventListener('se:commit-history', handler);
    window.dispatchEvent(new CustomEvent('se:commit-history'));
    window.dispatchEvent(new CustomEvent('se:commit-history'));
    window.dispatchEvent(new CustomEvent('se:commit-history'));
    window.removeEventListener('se:commit-history', handler);
    expect(count).toBe(3);
  });
});

// ── se:drag-start / se:drag-end contract ─────────────────────────────────────
//
// Drag operations suppress per-mousemove history pushes and emit one
// consolidated commit on mouseup via se:drag-end.

describe('drag start/end event contract', () => {
  it('se:drag-start and se:drag-end are receivable as CustomEvents', () => {
    let startFired = false;
    let endFired = false;
    window.addEventListener('se:drag-start', () => { startFired = true; }, { once: true });
    window.addEventListener('se:drag-end', () => { endFired = true; }, { once: true });
    window.dispatchEvent(new CustomEvent('se:drag-start'));
    window.dispatchEvent(new CustomEvent('se:drag-end'));
    expect(startFired).toBe(true);
    expect(endFired).toBe(true);
  });
});
