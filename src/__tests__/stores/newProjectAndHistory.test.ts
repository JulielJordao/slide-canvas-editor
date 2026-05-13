import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSlidesStore } from '@/stores/slides';
import { useHistoryStore } from '@/stores/history';

beforeEach(() => {
  setActivePinia(createPinia());
});

// ── resetProject ─────────────────────────────────────────────────────────────

describe('useSlidesStore.resetProject', () => {
  it('resets to exactly one blank slide', () => {
    const store = useSlidesStore();
    store.addSlide();
    store.addSlide();
    expect(store.slides.length).toBe(3);

    store.resetProject();
    expect(store.slides.length).toBe(1);
  });

  it('resets activeSlideIndex to 0', () => {
    const store = useSlidesStore();
    store.addSlide();
    store.addSlide();
    store.activeSlideIndex = 2;

    store.resetProject();
    expect(store.activeSlideIndex).toBe(0);
  });

  it('new slide has a white solid background', () => {
    const store = useSlidesStore();
    store.setBackground({ type: 'solid', color: '#ff0000' });
    store.resetProject();
    expect(store.activeSlide?.background).toEqual({ type: 'solid', color: '#ffffff' });
  });

  it('new slide gets a fresh id (not the old one)', () => {
    const store = useSlidesStore();
    const oldId = store.slides[0].id;
    store.resetProject();
    expect(store.slides[0].id).not.toBe(oldId);
  });

  it('new slide has empty fabricJSON objects array', () => {
    const store = useSlidesStore();
    store.updateActiveSlideJSON(JSON.stringify({ version: '6.0.0', objects: [{ type: 'rect' }] }));
    store.resetProject();
    const parsed = JSON.parse(store.slides[0].fabricJSON);
    expect(parsed.objects).toEqual([]);
  });
});

// ── useHistoryStore.resetAll ──────────────────────────────────────────────────

describe('useHistoryStore.resetAll', () => {
  it('clears all past stacks', () => {
    const store = useHistoryStore();
    store.push('slide-1', 'snap1');
    store.push('slide-1', 'snap2');
    store.push('slide-2', 'snapA');

    store.resetAll();
    expect(store.canUndo('slide-1')).toBe(false);
    expect(store.canUndo('slide-2')).toBe(false);
  });

  it('clears all future stacks', () => {
    const store = useHistoryStore();
    store.push('slide-1', 'snap1');
    store.push('slide-1', 'snap2');
    store.undo('slide-1');
    expect(store.canRedo('slide-1')).toBe(true);

    store.resetAll();
    expect(store.canRedo('slide-1')).toBe(false);
  });

  it('allows reinitialising a slide after reset', () => {
    const store = useHistoryStore();
    store.push('slide-1', 'snap1');
    store.resetAll();

    store.initSlide('slide-1', 'initial');
    store.push('slide-1', 'snap2');
    expect(store.canUndo('slide-1')).toBe(true);
  });
});

// ── History stack contract ────────────────────────────────────────────────────

describe('useHistoryStore undo/redo contract', () => {
  it('requires at least 2 entries to undo', () => {
    const store = useHistoryStore();
    store.push('s', 'only-one');
    expect(store.undo('s')).toBeNull();
  });

  it('undo restores previous snapshot and moves current to future', () => {
    const store = useHistoryStore();
    store.push('s', 'v1');
    store.push('s', 'v2');
    const restored = store.undo('s');
    expect(restored).toBe('v1');
    expect(store.canRedo('s')).toBe(true);
  });

  it('redo re-applies the undone snapshot', () => {
    const store = useHistoryStore();
    store.push('s', 'v1');
    store.push('s', 'v2');
    store.undo('s');
    const reapplied = store.redo('s');
    expect(reapplied).toBe('v2');
    expect(store.canRedo('s')).toBe(false);
  });

  it('push after undo clears the future stack', () => {
    const store = useHistoryStore();
    store.push('s', 'v1');
    store.push('s', 'v2');
    store.undo('s');
    store.push('s', 'v3');
    expect(store.canRedo('s')).toBe(false);
  });

  it('respects MAX_HISTORY cap of 50', () => {
    const store = useHistoryStore();
    for (let i = 0; i < 60; i++) store.push('s', `v${i}`);
    // Only 50 entries kept; canUndo requires >=2
    let count = 0;
    while (store.canUndo('s')) { store.undo('s'); count++; }
    expect(count).toBeLessThanOrEqual(49);
  });
});
