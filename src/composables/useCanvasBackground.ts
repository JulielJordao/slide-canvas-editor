import { watch } from 'vue';
import * as fabric from 'fabric';
import type { BackgroundConfig } from '@/types';
import { filePathToDataUrl } from '@/utils/fileToDataUrl';
import { readFile } from '@tauri-apps/plugin-fs';

let videoEl: HTMLVideoElement | null = null;
let videoBlobUrl: string | null = null;
let rafId: number | null = null;

function stopVideoBackground() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (videoBlobUrl) {
    URL.revokeObjectURL(videoBlobUrl);
    videoBlobUrl = null;
  }
  if (videoEl) {
    videoEl.pause();
    videoEl.removeAttribute('src');
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

      const localVideo = document.createElement('video');
      videoEl = localVideo;
      // Do NOT set autoplay — letting both autoplay AND play() race produces
      // an AbortError when one interrupts the other.  We rely solely on the
      // explicit play() call below.
      localVideo.loop = true;
      localVideo.muted = true;
      localVideo.playsInline = true;
      // No crossOrigin — the Blob URL below is same-origin, so the canvas
      // is never tainted and toDataURL (used for thumbnails) keeps working.
      localVideo.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(localVideo);

      const startRendering = () => {
        // A newer applyBackground may have re-assigned the module-level
        // videoEl before this callback runs — bail out if so.
        if (videoEl !== localVideo || !canvas) return;
        if (rafId !== null) return;
        const vw = localVideo.videoWidth || w;
        const vh = localVideo.videoHeight || h;
        const fabricImg = new fabric.Image(localVideo, {
          left: 0,
          top: 0,
          scaleX: w / vw,
          scaleY: h / vh,
          selectable: false,
          evented: false,
          // objectCaching MUST be false — Fabric otherwise caches the first
          // frame and the background appears frozen (or, on some platforms,
          // entirely black because the cache was captured before the video
          // produced any frame at all).
          objectCaching: false,
        });
        canvas.set('backgroundImage', fabricImg);

        const render = () => {
          if (videoEl !== localVideo || !canvas) return;
          canvas.requestRenderAll();
          rafId = requestAnimationFrame(render);
        };
        rafId = requestAnimationFrame(render);
      };

      // Listeners MUST be attached before `src=` — once the Blob is assigned,
      // the video can fire loadeddata/canplay synchronously enough that a
      // late subscription misses it, and the render loop never starts.
      localVideo.addEventListener('error', () => {
        console.error('[CanvasBackground] failed to load video:', config.src, localVideo.error);
      });
      localVideo.addEventListener('loadeddata', startRendering);
      localVideo.addEventListener('canplay', startRendering);
      localVideo.addEventListener('playing', startRendering);

      // Read the file as a same-origin Blob URL.  This avoids the cross-origin
      // taint that the asset:// protocol introduces on macOS (which silently
      // breaks the load when crossOrigin='anonymous' is set, and breaks
      // toDataURL when it isn't).
      try {
        const ext = config.src.split('.').pop()?.toLowerCase() ?? 'mp4';
        const mime =
          ext === 'webm' ? 'video/webm' :
          ext === 'ogv'  ? 'video/ogg' :
          ext === 'mov'  ? 'video/quicktime' :
                           'video/mp4';
        const bytes = await readFile(config.src);
        videoBlobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        // Abort if a newer applyBackground has already superseded this one
        // (the await on readFile gives ample time for that to happen).
        if (videoEl !== localVideo) {
          URL.revokeObjectURL(videoBlobUrl);
          videoBlobUrl = null;
          return;
        }
        localVideo.src = videoBlobUrl;
      } catch (e) {
        console.error('[CanvasBackground] failed to read video file:', e);
        return;
      }

      try {
        await localVideo.play();
        // Safety net: if every loadeddata/canplay/playing event fired before
        // we got here (or was missed), kick off rendering now.
        startRendering();
      } catch (e) {
        // AbortError fires when stopVideoBackground tears down this element
        // because a fresher applyBackground call took over — that's expected
        // and not user-visible, so swallow it silently.
        const err = e as DOMException;
        if (err?.name !== 'AbortError') {
          console.warn('[CanvasBackground] video.play() rejected:', e);
        }
      }
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
