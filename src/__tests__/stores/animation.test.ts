import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAnimationStore } from '@/stores/animation';

describe('useAnimationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts in design mode', () => {
    const store = useAnimationStore();
    expect(store.appMode).toBe('design');
    expect(store.isAnimationMode).toBe(false);
  });

  it('toggleMode switches between design and animation', () => {
    const store = useAnimationStore();
    store.toggleMode();
    expect(store.appMode).toBe('animation');
    expect(store.isAnimationMode).toBe(true);
    store.toggleMode();
    expect(store.appMode).toBe('design');
  });

  it('setMode sets the mode directly', () => {
    const store = useAnimationStore();
    store.setMode('animation');
    expect(store.appMode).toBe('animation');
    store.setMode('design');
    expect(store.appMode).toBe('design');
  });

  it('play sets isPlaying to true', () => {
    const store = useAnimationStore();
    store.play();
    expect(store.isPlaying).toBe(true);
  });

  it('pause sets isPlaying to false without resetting time', () => {
    const store = useAnimationStore();
    store.seekTo(2000);
    store.play();
    store.pause();
    expect(store.isPlaying).toBe(false);
    expect(store.currentTimeMs).toBe(2000);
  });

  it('stop sets isPlaying to false and resets time to 0', () => {
    const store = useAnimationStore();
    store.seekTo(3000);
    store.play();
    store.stop();
    expect(store.isPlaying).toBe(false);
    expect(store.currentTimeMs).toBe(0);
  });

  it('seekTo clamps to [0, totalDurationMs]', () => {
    const store = useAnimationStore();
    store.setTotalDuration(5000);
    store.seekTo(-100);
    expect(store.currentTimeMs).toBe(0);
    store.seekTo(9999);
    expect(store.currentTimeMs).toBe(5000);
    store.seekTo(2500);
    expect(store.currentTimeMs).toBe(2500);
  });

  it('setTotalDuration updates totalDurationMs', () => {
    const store = useAnimationStore();
    store.setTotalDuration(8000);
    expect(store.totalDurationMs).toBe(8000);
  });

  it('setTimelineZoom clamps to [20, 500]', () => {
    const store = useAnimationStore();
    store.setTimelineZoom(5);
    expect(store.timelineZoom).toBe(20);
    store.setTimelineZoom(600);
    expect(store.timelineZoom).toBe(500);
    store.setTimelineZoom(150);
    expect(store.timelineZoom).toBe(150);
  });

  it('selectedEffectObjectId can be set', () => {
    const store = useAnimationStore();
    store.selectedEffectObjectId = 'obj-abc';
    expect(store.selectedEffectObjectId).toBe('obj-abc');
  });
});
