import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TimelineMode, AppMode } from '@/types';

export const useAnimationStore = defineStore('animation', () => {
  const appMode = ref<AppMode>('design');
  const timelineMode = ref<TimelineMode>('slide-based');
  const isPlaying = ref(false);
  const currentTimeMs = ref(0);
  const totalDurationMs = ref(5000);

  // Selected object ID for adding effects
  const selectedEffectObjectId = ref<string | null>(null);

  // Timeline zoom (px per second)
  const timelineZoom = ref(100);

  const isAnimationMode = computed(() => appMode.value === 'animation');

  function toggleMode() {
    appMode.value = appMode.value === 'design' ? 'animation' : 'design';
  }

  function setMode(mode: AppMode) {
    appMode.value = mode;
  }

  function play() { isPlaying.value = true; }
  function pause() { isPlaying.value = false; }
  function stop() { isPlaying.value = false; currentTimeMs.value = 0; }

  function seekTo(ms: number) {
    currentTimeMs.value = Math.max(0, Math.min(ms, totalDurationMs.value));
  }

  function setTotalDuration(ms: number) {
    totalDurationMs.value = ms;
  }

  function setTimelineZoom(zoom: number) {
    timelineZoom.value = Math.max(20, Math.min(500, zoom));
  }

  return {
    appMode, timelineMode, isPlaying, currentTimeMs, totalDurationMs,
    selectedEffectObjectId, timelineZoom, isAnimationMode,
    toggleMode, setMode, play, pause, stop, seekTo, setTotalDuration, setTimelineZoom,
  };
});
