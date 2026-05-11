import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useSlidesStore } from '@/stores/slides';

const DEBOUNCE_MS = 2000;

export function useAutoSave() {
  const slidesStore = useSlidesStore();
  const isSaving = ref(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, DEBOUNCE_MS);
  }

  async function doSave() {
    try {
      isSaving.value = true;
      const data = JSON.stringify({
        version: 1,
        slides: slidesStore.slides,
        aspectRatio: slidesStore.aspectRatio,
      });
      await invoke('save_project', { data });
    } catch (e) {
      console.warn('[AutoSave] save failed:', e);
    } finally {
      isSaving.value = false;
    }
  }

  async function loadProject(): Promise<boolean> {
    try {
      const raw = await invoke<string | null>('load_project');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed.slides?.length) return false;
      slidesStore.$patch((state) => {
        state.slides = parsed.slides;
        if (parsed.aspectRatio) state.aspectRatio = parsed.aspectRatio;
        state.activeSlideIndex = 0;
      });
      return true;
    } catch (e) {
      console.warn('[AutoSave] load failed:', e);
      return false;
    }
  }

  watch(
    [() => slidesStore.slides, () => slidesStore.aspectRatio],
    scheduleSave,
    { deep: true },
  );

  return { loadProject, doSave, isSaving };
}
