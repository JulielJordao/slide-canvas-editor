/**
 * Tests for the "Carregar Imagem" single-add guarantee.
 *
 * Root-cause that was fixed:
 *   1. `multiple: true` in the Tauri file dialog allowed selecting N files,
 *      dispatching N `se:add-image` events and adding N images to canvas.
 *   2. The `se:add-image` listener inside <script setup> was registered outside
 *      lifecycle hooks, so it accumulated on every v-else-if re-mount without
 *      ever being removed.  After switching away and back 3 times, 1 dispatch
 *      would fire 4 handler instances.
 *
 * These tests verify the pure transformation logic that now enforces 1 image
 * per picker interaction, independently of Tauri and Fabric.js.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Path extraction (mirrors the fixed openFilePicker logic) ─────────────────

/**
 * Given the raw value returned by the Tauri dialog `open()` call,
 * return exactly one path (or null if the user cancelled).
 */
function extractSinglePath(selected: string | string[] | null): string | null {
  if (!selected) return null;
  return Array.isArray(selected) ? (selected[0] ?? null) : selected;
}

describe('extractSinglePath', () => {
  it('returns null when user cancelled (null)', () => {
    expect(extractSinglePath(null)).toBeNull();
  });

  it('returns the path when dialog returns a string', () => {
    expect(extractSinglePath('/Users/me/photo.jpg')).toBe('/Users/me/photo.jpg');
  });

  it('returns only the first path when dialog returns an array', () => {
    const result = extractSinglePath(['/a.png', '/b.png', '/c.png']);
    expect(result).toBe('/a.png');
  });

  it('returns null for an empty array', () => {
    expect(extractSinglePath([])).toBeNull();
  });

  it('returns the single element when array has exactly 1 item', () => {
    expect(extractSinglePath(['/single.jpg'])).toBe('/single.jpg');
  });
});

// ── Dispatch count (the core invariant) ──────────────────────────────────────

/**
 * Simulates the fixed openFilePicker dispatch logic and counts how many
 * se:add-image events are emitted.
 */
function simulateOpenFilePicker(
  dialogResult: string | string[] | null,
  dispatch: (path: string) => void,
): void {
  if (!dialogResult) return;
  const path = Array.isArray(dialogResult) ? dialogResult[0] : dialogResult;
  if (!path) return;
  dispatch(path);
}

describe('openFilePicker dispatches exactly 1 event per call', () => {
  it('dispatches 0 times when user cancels', () => {
    const dispatch = vi.fn();
    simulateOpenFilePicker(null, dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches 1 time when 1 file is selected (string)', () => {
    const dispatch = vi.fn();
    simulateOpenFilePicker('/img.png', dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('/img.png');
  });

  it('dispatches exactly 1 time even when the dialog returns an array of 3 paths', () => {
    const dispatch = vi.fn();
    simulateOpenFilePicker(['/a.png', '/b.png', '/c.png'], dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('/a.png');
  });

  it('dispatches 0 times for an empty array', () => {
    const dispatch = vi.fn();
    simulateOpenFilePicker([], dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ── Listener accumulation guard ───────────────────────────────────────────────
//
// Before the fix, the se:add-image listener was registered outside lifecycle
// hooks.  Switching tabs N times caused N extra listeners to accumulate, so
// 1 dispatch would call the handler N+1 times.
//
// The fix: register in onMounted, remove in onUnmounted.
// This test models that lifecycle contract using the raw window event API.

describe('se:add-image listener does not accumulate across re-mounts', () => {
  const recorded: string[] = [];

  function makeListener() {
    return (e: Event) => {
      const path = (e as CustomEvent).detail?.path as string;
      if (path) recorded.push(path);
    };
  }

  beforeEach(() => recorded.splice(0));

  it('handler called once when registered once', () => {
    const fn = makeListener();
    window.addEventListener('se:add-image', fn);
    window.dispatchEvent(new CustomEvent('se:add-image', { detail: { path: '/img.png' } }));
    window.removeEventListener('se:add-image', fn);
    expect(recorded).toHaveLength(1);
  });

  it('handler called twice if registered twice (bug reproduction)', () => {
    const fn1 = makeListener();
    const fn2 = makeListener();
    window.addEventListener('se:add-image', fn1);
    window.addEventListener('se:add-image', fn2);
    window.dispatchEvent(new CustomEvent('se:add-image', { detail: { path: '/img.png' } }));
    window.removeEventListener('se:add-image', fn1);
    window.removeEventListener('se:add-image', fn2);
    // Both fire — this is what was happening before the fix
    expect(recorded).toHaveLength(2);
  });

  it('removing listener before re-registering keeps count at 1 (fixed behaviour)', () => {
    // Simulates mount → unmount → remount lifecycle
    let fn = makeListener();

    // First mount
    window.addEventListener('se:add-image', fn);
    // Unmount removes the listener
    window.removeEventListener('se:add-image', fn);

    // Remount registers a fresh one
    fn = makeListener();
    window.addEventListener('se:add-image', fn);

    window.dispatchEvent(new CustomEvent('se:add-image', { detail: { path: '/img.png' } }));
    window.removeEventListener('se:add-image', fn);

    // Only 1 handler active, so only 1 call
    expect(recorded).toHaveLength(1);
  });

  it('even after 5 simulated remounts, only 1 handler fires', () => {
    const listeners: EventListener[] = [];

    // Simulate 5 mount/unmount cycles with proper cleanup
    for (let i = 0; i < 5; i++) {
      const fn = makeListener() as EventListener;
      window.addEventListener('se:add-image', fn);
      listeners.push(fn);
      // Correct lifecycle: remove immediately on "unmount"
      window.removeEventListener('se:add-image', fn);
      listeners.pop();
    }

    // Final "mounted" instance
    const active = makeListener() as EventListener;
    window.addEventListener('se:add-image', active);

    window.dispatchEvent(new CustomEvent('se:add-image', { detail: { path: '/img.png' } }));
    window.removeEventListener('se:add-image', active);

    expect(recorded).toHaveLength(1);
  });
});

// ── recentImages deduplication ────────────────────────────────────────────────

function addToRecent(recentImages: string[], path: string): void {
  if (!recentImages.includes(path)) recentImages.unshift(path);
}

describe('recentImages deduplication', () => {
  it('adds a new path to the front', () => {
    const recent: string[] = [];
    addToRecent(recent, '/img.png');
    expect(recent).toEqual(['/img.png']);
  });

  it('does not add a path already in the list', () => {
    const recent = ['/img.png'];
    addToRecent(recent, '/img.png');
    expect(recent).toHaveLength(1);
  });

  it('most recent image appears first', () => {
    const recent: string[] = [];
    addToRecent(recent, '/old.png');
    addToRecent(recent, '/new.png');
    expect(recent[0]).toBe('/new.png');
  });

  it('triggering se:add-image twice with the same path still adds only one entry', () => {
    const recent: string[] = [];
    // Simulates what the listener does
    const handleEvent = (path: string) => addToRecent(recent, path);
    handleEvent('/img.png');
    handleEvent('/img.png');
    expect(recent).toHaveLength(1);
  });
});
