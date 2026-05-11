import type { AspectRatio } from '@/types';

export function computeScale(containerW: number, containerH: number, canvasW: number, canvasH: number): number {
  const scaleX = containerW / canvasW;
  const scaleY = containerH / canvasH;
  return Math.min(scaleX, scaleY, 1);
}

export function computeScaleFit(containerW: number, containerH: number, canvasW: number, canvasH: number): number {
  const padding = 48;
  const scaleX = (containerW - padding) / canvasW;
  const scaleY = (containerH - padding) / canvasH;
  return Math.min(scaleX, scaleY);
}

export function canvasDimensions(ratio: AspectRatio): { width: number; height: number } {
  return { width: ratio.width, height: ratio.height };
}
