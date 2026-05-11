import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { TimelineMode, AppMode } from '@/types';

const TIMELINE_HEIGHT_KEY = 'se:timelineHeight';
const TIMELINE_HEIGHT_DEFAULT = 220;
const TIMELINE_HEIGHT_MIN = 140;
const TIMELINE_HEIGHT_MAX = 600;

function readPersistedHeight(): number {
  try {
    const raw = localStorage.getItem(TIMELINE_HEIGHT_KEY);
    if (!raw) return TIMELINE_HEIGHT_DEFAULT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return TIMELINE_HEIGHT_DEFAULT;
    return Math.max(TIMELINE_HEIGHT_MIN, Math.min(TIMELINE_HEIGHT_MAX, n));
  } catch {
    return TIMELINE_HEIGHT_DEFAULT;
  }
}

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

  // Resizable timeline panel height — persisted in localStorage.
  const timelineHeight = ref<number>(readPersistedHeight());
  watch(timelineHeight, (h) => {
    try { localStorage.setItem(TIMELINE_HEIGHT_KEY, String(h)); } catch {}
  });

  function setTimelineHeight(px: number) {
    timelineHeight.value = Math.max(TIMELINE_HEIGHT_MIN, Math.min(TIMELINE_HEIGHT_MAX, px));
  }

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
    selectedEffectObjectId, timelineZoom, timelineHeight, isAnimationMode,
    toggleMode, setMode, play, pause, stop, seekTo, setTotalDuration,
    setTimelineZoom, setTimelineHeight,
  };
});
