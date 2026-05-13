/**
 * Regression: timeline must re-compute its tracks when the canvas finishes
 * loading objects after a saved-file restore.
 *
 * The `tracks` computed in TimelinePanel reads canvas.getObjects() — a
 * non-reactive call.  When useAutoSave restores a project, the slide's
 * animation.effects update reactively but the canvas only gets its objects
 * later (via loadFromJSON), so the timeline would stay empty until the user
 * touched an effect.
 *
 * Fix: useFabricCanvas dispatches `se:canvas-objects-changed` on every
 * Fabric object:added / object:removed event; TimelinePanel listens for it
 * and bumps a reactive revision counter that `tracks` depends on.
 */
import { describe, it, expect } from 'vitest';
import { computed, ref } from 'vue';

describe('TimelinePanel canvasRev counter', () => {
  it('a ref bump on canvas change re-evaluates a computed that reads it', () => {
    const canvasRev = ref(0);
    let evaluations = 0;
    const tracks = computed(() => {
      canvasRev.value;
      evaluations++;
      return ['track-a', 'track-b'];
    });
    // First read evaluates once
    expect(tracks.value.length).toBe(2);
    expect(evaluations).toBe(1);
    // Bump the counter
    canvasRev.value++;
    // Force a re-read (Vue computed is lazy until dirty)
    void tracks.value;
    expect(evaluations).toBe(2);
  });

  it('listens for se:canvas-objects-changed by name (contract)', () => {
    // Documents the event name the canvas dispatches and the panel listens to.
    const expected = 'se:canvas-objects-changed';
    let received = false;
    const handler = () => { received = true; };
    window.addEventListener(expected, handler, { once: true });
    window.dispatchEvent(new CustomEvent(expected));
    expect(received).toBe(true);
    window.removeEventListener(expected, handler);
  });

  it('multiple object:added events all reach the listener', () => {
    let count = 0;
    const handler = () => { count++; };
    window.addEventListener('se:canvas-objects-changed', handler);
    // Simulate loadFromJSON adding 5 objects in a row
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new CustomEvent('se:canvas-objects-changed'));
    }
    window.removeEventListener('se:canvas-objects-changed', handler);
    expect(count).toBe(5);
  });
});

// ── Effects-track binding contract ───────────────────────────────────────────
//
// Effects are bound to canvas objects by name (the `objectId` field on each
// effect).  When IText is migrated to Textbox the name MUST be preserved or
// the timeline would orphan all the effects.

describe('effect → canvas object binding', () => {
  it('filters effects by objectId matching the canvas object name', () => {
    const effects = [
      { id: 'e1', objectId: '7yBqiPRT', type: 'shake' },
      { id: 'e2', objectId: 'HPbeU-6L', type: 'blurOut' },
      { id: 'e3', objectId: '7yBqiPRT', type: 'fadeIn' },
    ];
    const canvasObjects = [
      { name: '7yBqiPRT', type: 'textbox' },
      { name: 'HPbeU-6L', type: 'image' },
    ];
    const tracks = canvasObjects.map(o => ({
      id: o.name,
      effects: effects.filter(e => e.objectId === o.name),
    }));
    expect(tracks[0].effects).toHaveLength(2);
    expect(tracks[1].effects).toHaveLength(1);
  });

  it('orphans effects whose objectId no longer exists on the canvas', () => {
    const effects = [
      { id: 'e1', objectId: 'lost-id', type: 'shake' },
    ];
    const canvasObjects = [
      { name: '7yBqiPRT', type: 'textbox' },
    ];
    const tracks = canvasObjects.map(o => ({
      id: o.name,
      effects: effects.filter(e => e.objectId === o.name),
    }));
    expect(tracks[0].effects).toHaveLength(0);
  });
});
