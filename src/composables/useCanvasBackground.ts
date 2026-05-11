import { watch } from 'vue';
import * as fabric from 'fabric';
import type { BackgroundConfig } from '@/types';
import { filePathToDataUrl } from '@/utils/fileToDataUrl';
import { convertFileSrc } from '@tauri-apps/api/core';

let videoEl: HTMLVideoElement | null = null;
let rafId: number | null = null;

function stopVideoBackground() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (videoEl) {
    videoEl.pause();
    videoEl.src = '';
    if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
    videoEl = null;
  }
}

export function useCanvasBackground(getCanvas: () => fabric.Canvas | null) {
  async function applyBackground(config: BackgroundConfig) {
    const canvas = getCanvas();
    if (!canvas) return;

    stopVideoBackground();

    const w = canvas.getWidth();
    const h = canvas.getHeight();

    if (config.type === 'solid') {
      canvas.set('backgroundImage', undefined);
      canvas.backgroundColor = config.color ?? '#ffffff';
      canvas.requestRenderAll();
      return;
    }

    if (config.type === 'linear-gradient' && config.stops && config.stops.length >= 2) {
      canvas.set('backgroundImage', undefined);
      const angle = (config.angle ?? 90) * (Math.PI / 180);
      const gradient = new fabric.Gradient({
        type: 'linear',
        gradientUnits: 'pixels',
        coords: {
          x1: w / 2 - Math.cos(angle) * w / 2,
          y1: h / 2 - Math.sin(angle) * h / 2,
          x2: w / 2 + Math.cos(angle) * w / 2,
          y2: h / 2 + Math.sin(angle) * h / 2,
        },
        colorStops: config.stops.map(s => ({ offset: s.offset, color: s.color })),
      });
      canvas.backgroundColor = gradient as unknown as string;
      canvas.requestRenderAll();
      return;
    }

    if (config.type === 'radial-gradient' && config.stops && config.stops.length >= 2) {
      canvas.set('backgroundImage', undefined);
      const r = Math.min(w, h) / 2;
      const gradient = new fabric.Gradient({
        type: 'radial',
        gradientUnits: 'pixels',
        coords: { x1: w / 2, y1: h / 2, r1: 0, x2: w / 2, y2: h / 2, r2: r },
        colorStops: config.stops.map(s => ({ offset: s.offset, color: s.color })),
      });
      canvas.backgroundColor = gradient as unknown as string;
      canvas.requestRenderAll();
      return;
    }

    if (config.type === 'image' && config.src) {
      canvas.backgroundColor = '#000000';
      try {
        const url = await filePathToDataUrl(config.src);
        const img = await fabric.Image.fromURL(url, { crossOrigin: 'anonymous' });
        img.scaleToWidth(w);
        if (img.getScaledHeight() < h) img.scaleToHeight(h);
        img.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
        canvas.set('backgroundImage', img);
        canvas.requestRenderAll();
      } catch (e) {
        console.error('Failed to load background image', e);
      }
      return;
    }

    if (config.type === 'video' && config.src) {
      canvas.backgroundColor = '#000000';
      const url = convertFileSrc(config.src);

      videoEl = document.createElement('video');
      videoEl.src = url;
      videoEl.autoplay = true;
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(videoEl);

      videoEl.addEventListener('playing', () => {
        if (!videoEl || !canvas) return;
        const fabricImg = new fabric.Image(videoEl, {
          left: 0,
          top: 0,
          scaleX: w / videoEl.videoWidth,
          scaleY: h / videoEl.videoHeight,
          selectable: false,
          evented: false,
        });
        canvas.set('backgroundImage', fabricImg);

        const render = () => {
          if (!videoEl || !canvas) return;
          canvas.requestRenderAll();
          rafId = requestAnimationFrame(render);
        };
        rafId = requestAnimationFrame(render);
      }, { once: true });

      await videoEl.play().catch(() => {});
      return;
    }

    // Fallback: white
    canvas.backgroundColor = '#ffffff';
    canvas.requestRenderAll();
  }

  function watchBackground(backgroundRef: { value: BackgroundConfig }) {
    watch(
      () => backgroundRef.value,
      (config) => applyBackground(config),
      { deep: true, immediate: false }
    );
  }

  return { applyBackground, watchBackground, stopVideoBackground };
}
