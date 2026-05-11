import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSlidesStore } from '@/stores/slides';
import { DEFAULT_SLIDE_DURATION_MS } from '@/types';

describe('useSlidesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts with one blank slide', () => {
    const store = useSlidesStore();
    expect(store.slides).toHaveLength(1);
    expect(store.activeSlideIndex).toBe(0);
  });

  it('activeSlide returns the current slide', () => {
    const store = useSlidesStore();
    expect(store.activeSlide).toBe(store.slides[0]);
  });

  it('addSlide inserts after the active index and activates it', () => {
    const store = useSlidesStore();
    const firstId = store.slides[0].id;
    store.addSlide();
    expect(store.slides).toHaveLength(2);
    expect(store.activeSlideIndex).toBe(1);
    expect(store.slides[0].id).toBe(firstId);
  });

  it('addSlide copies the background from the preceding slide', () => {
    const store = useSlidesStore();
    store.setBackground({ type: 'solid', color: '#ff0000' });
    store.addSlide();
    expect(store.slides[1].background).toEqual({ type: 'solid', color: '#ff0000' });
  });

  it('removeSlide removes by id and adjusts activeSlideIndex', () => {
    const store = useSlidesStore();
    store.addSlide();
    store.addSlide();
    const idToRemove = store.slides[1].id;
    store.removeSlide(idToRemove);
    expect(store.slides).toHaveLength(2);
    expect(store.slides.find(s => s.id === idToRemove)).toBeUndefined();
  });

  it('removeSlide does nothing when only one slide remains', () => {
    const store = useSlidesStore();
    const id = store.slides[0].id;
    store.removeSlide(id);
    expect(store.slides).toHaveLength(1);
  });

  it('duplicateSlide copies all data with new ids for effects', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, {
      id: 'eff-1',
      objectId: 'obj-1',
      type: 'fadeIn',
      startMs: 0,
      durationMs: 1000,
      easing: 'easeOut',
    });
    store.duplicateSlide(0);
    expect(store.slides).toHaveLength(2);
    const copy = store.slides[1];
    expect(copy.id).not.toBe(slideId);
    expect(copy.animation.effects).toHaveLength(1);
    expect(copy.animation.effects[0].id).not.toBe('eff-1');
    expect(copy.animation.effects[0].type).toBe('fadeIn');
  });

  it('reorderSlides moves a slide and tracks active index', () => {
    const store = useSlidesStore();
    store.addSlide();
    store.addSlide();
    const ids = store.slides.map(s => s.id);
    store.activeSlideIndex = 0;
    store.reorderSlides(0, 2);
    expect(store.slides[2].id).toBe(ids[0]);
    expect(store.activeSlideIndex).toBe(2);
  });

  it('updateActiveSlideJSON updates the fabricJSON of the active slide', () => {
    const store = useSlidesStore();
    const newJson = JSON.stringify({ version: '6.0.0', objects: [{ type: 'rect' }] });
    store.updateActiveSlideJSON(newJson);
    expect(store.activeSlide.fabricJSON).toBe(newJson);
  });

  it('setBackground updates the active slide background', () => {
    const store = useSlidesStore();
    store.setBackground({ type: 'solid', color: '#123456' });
    expect(store.activeSlide.background).toEqual({ type: 'solid', color: '#123456' });
  });

  it('setSlideDuration updates the slide animation duration', () => {
    const store = useSlidesStore();
    const id = store.slides[0].id;
    store.setSlideDuration(id, 8000);
    expect(store.slides[0].animation.durationMs).toBe(8000);
  });

  it('addAnimationEffect adds an effect to the slide', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, {
      id: 'eff-1', objectId: 'obj-x', type: 'zoomIn',
      startMs: 500, durationMs: 1000, easing: 'linear',
    });
    expect(store.slides[0].animation.effects).toHaveLength(1);
    expect(store.slides[0].animation.effects[0].type).toBe('zoomIn');
  });

  it('removeAnimationEffect removes the correct effect', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, { id: 'eff-1', objectId: 'obj-x', type: 'fadeIn', startMs: 0, durationMs: 1000, easing: 'linear' });
    store.addAnimationEffect(slideId, { id: 'eff-2', objectId: 'obj-x', type: 'fadeOut', startMs: 3000, durationMs: 1000, easing: 'linear' });
    store.removeAnimationEffect(slideId, 'eff-1');
    expect(store.slides[0].animation.effects).toHaveLength(1);
    expect(store.slides[0].animation.effects[0].id).toBe('eff-2');
  });

  it('updateAnimationEffect patches the target effect', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, { id: 'eff-1', objectId: 'obj-x', type: 'fadeIn', startMs: 0, durationMs: 1000, easing: 'linear' });
    store.updateAnimationEffect(slideId, 'eff-1', { startMs: 2000, easing: 'easeInOut' });
    const effect = store.slides[0].animation.effects[0];
    expect(effect.startMs).toBe(2000);
    expect(effect.easing).toBe('easeInOut');
    expect(effect.durationMs).toBe(1000);
  });

  it('setSlideOutTransition updates the transition', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.setSlideOutTransition(slideId, { type: 'wipeLeft', durationMs: 750 });
    expect(store.slides[0].animation.outTransition).toEqual({ type: 'wipeLeft', durationMs: 750 });
  });

  it('default slide has expected animation defaults', () => {
    const store = useSlidesStore();
    expect(store.slides[0].animation.durationMs).toBe(DEFAULT_SLIDE_DURATION_MS);
    expect(store.slides[0].animation.effects).toHaveLength(0);
    expect(store.slides[0].animation.outTransition.type).toBe('fade');
  });

  // ── Effect editing: new feature tests ──────────────────────────────────────

  it('updateAnimationEffect can change startMs independently', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, { id: 'e1', objectId: 'o1', type: 'fadeIn', startMs: 0, durationMs: 1000, easing: 'linear' });
    store.updateAnimationEffect(slideId, 'e1', { startMs: 2500 });
    expect(store.slides[0].animation.effects[0].startMs).toBe(2500);
    expect(store.slides[0].animation.effects[0].durationMs).toBe(1000); // unchanged
  });

  it('updateAnimationEffect can change durationMs independently', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, { id: 'e1', objectId: 'o1', type: 'fadeIn', startMs: 500, durationMs: 1000, easing: 'linear' });
    store.updateAnimationEffect(slideId, 'e1', { durationMs: 2000 });
    expect(store.slides[0].animation.effects[0].durationMs).toBe(2000);
    expect(store.slides[0].animation.effects[0].startMs).toBe(500); // unchanged
  });

  it('updateAnimationEffect replaces easing correctly', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, { id: 'e1', objectId: 'o1', type: 'slideInLeft', startMs: 0, durationMs: 1000, easing: 'linear' });
    store.updateAnimationEffect(slideId, 'e1', { easing: 'bounce' });
    expect(store.slides[0].animation.effects[0].easing).toBe('bounce');
  });

  it('updateAnimationEffect does not affect other effects on same object', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, { id: 'e1', objectId: 'o1', type: 'fadeIn', startMs: 0, durationMs: 1000, easing: 'linear' });
    store.addAnimationEffect(slideId, { id: 'e2', objectId: 'o1', type: 'fadeOut', startMs: 4000, durationMs: 500, easing: 'easeIn' });
    store.updateAnimationEffect(slideId, 'e1', { durationMs: 1500 });
    expect(store.slides[0].animation.effects[0].durationMs).toBe(1500);
    expect(store.slides[0].animation.effects[1].durationMs).toBe(500); // untouched
  });

  it('updateAnimationEffect ignores unknown effectId silently', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, { id: 'e1', objectId: 'o1', type: 'fadeIn', startMs: 0, durationMs: 1000, easing: 'linear' });
    expect(() => store.updateAnimationEffect(slideId, 'no-such-id', { startMs: 999 })).not.toThrow();
    expect(store.slides[0].animation.effects[0].startMs).toBe(0); // unchanged
  });

  it('effects can be filtered by objectId (powers "Ativos" tab)', () => {
    const store = useSlidesStore();
    const slideId = store.slides[0].id;
    store.addAnimationEffect(slideId, { id: 'e1', objectId: 'obj-A', type: 'fadeIn',  startMs: 0,    durationMs: 1000, easing: 'linear' });
    store.addAnimationEffect(slideId, { id: 'e2', objectId: 'obj-B', type: 'zoomIn',  startMs: 500,  durationMs: 800,  easing: 'linear' });
    store.addAnimationEffect(slideId, { id: 'e3', objectId: 'obj-A', type: 'fadeOut', startMs: 4000, durationMs: 500,  easing: 'linear' });

    const forA = store.slides[0].animation.effects.filter(e => e.objectId === 'obj-A');
    const forB = store.slides[0].animation.effects.filter(e => e.objectId === 'obj-B');

    expect(forA).toHaveLength(2);
    expect(forB).toHaveLength(1);
    expect(forA.map(e => e.id)).toEqual(['e1', 'e3']);
  });
});
