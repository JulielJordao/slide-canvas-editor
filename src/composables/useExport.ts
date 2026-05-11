import { ref } from 'vue';
import * as fabric from 'fabric';
import { useSettingsStore } from '@/stores/settings';
import { useSlidesStore } from '@/stores/slides';
import { loadFontsFromJSON } from '@/utils/fontLoader';
import type { BackgroundConfig } from '@/types';
import { useCanvasBackground } from './useCanvasBackground';

const isExporting = ref(false);

export function useExport(getCanvas: () => fabric.Canvas | null) {
  const settings = useSettingsStore();
  const slidesStore = useSlidesStore();

  async function exportCurrentSlide(format: 'png' | 'jpeg', path: string): Promise<void> {
    const canvas = getCanvas();
    if (!canvas) return;
    isExporting.value = true;
    try {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      const dataURL = canvas.toDataURL({
        format,
        quality: settings.exportQuality,
        multiplier: 1,
      });
      const base64 = dataURL.split(',')[1];
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_image', { path, data: base64 });
    } finally {
      isExporting.value = false;
    }
  }

  async function exportAllSlides(format: 'png' | 'jpeg', dir: string): Promise<void> {
    isExporting.value = true;
    try {
      const { width, height } = slidesStore.aspectRatio;
      for (let i = 0; i < slidesStore.slides.length; i++) {
        const slide = slidesStore.slides[i];
        const offscreen = new fabric.StaticCanvas(undefined, { width, height });
        const bgComposable = useCanvasBackground(() => offscreen as unknown as fabric.Canvas);
        await bgComposable.applyBackground(slide.background);
        await loadFontsFromJSON(slide.fabricJSON);
        await offscreen.loadFromJSON(JSON.parse(slide.fabricJSON));
        offscreen.requestRenderAll();
        const dataURL = offscreen.toDataURL({ format, quality: settings.exportQuality, multiplier: 1 });
        const base64 = dataURL.split(',')[1];
        const { invoke } = await import('@tauri-apps/api/core');
        const filename = `slide_${String(i + 1).padStart(3, '0')}.${format}`;
        await invoke('save_image', { path: `${dir}/${filename}`, data: base64 });
        offscreen.dispose();
      }
    } finally {
      isExporting.value = false;
    }
  }

  return { isExporting, exportCurrentSlide, exportAllSlides };
}
