import * as fabric from 'fabric';
import type { BackgroundConfig } from '@/types';
import { loadFontsFromJSON } from '@/utils/fontLoader';
import { useCanvasBackground } from './useCanvasBackground';

const THUMB_W = 160;
const THUMB_H = 90;

export async function generateThumbnail(
  slideJSON: string,
  background: BackgroundConfig,
  aspectW: number,
  aspectH: number
): Promise<string> {
  const scale = THUMB_W / aspectW;
  const h = Math.round(aspectH * scale);

  const offscreen = new fabric.StaticCanvas(undefined, { width: THUMB_W, height: h });
  offscreen.setZoom(scale);

  try {
    const bgComposable = useCanvasBackground(() => offscreen as unknown as fabric.Canvas);
    await bgComposable.applyBackground(background);
    await loadFontsFromJSON(slideJSON);
    await offscreen.loadFromJSON(JSON.parse(slideJSON));
    offscreen.requestRenderAll();
    const dataUrl = offscreen.toDataURL({ format: 'jpeg', quality: 0.6, multiplier: 1 });
    return dataUrl;
  } finally {
    offscreen.dispose();
  }
}
