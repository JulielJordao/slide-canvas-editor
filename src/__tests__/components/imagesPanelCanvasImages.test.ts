/**
 * Tests for the ImagesPanel "Neste slide" section — the list of images
 * currently placed on the canvas.
 *
 * When a project is opened, loadFromJSON revives each Image object from its
 * stored base64 src and fires se:canvas-objects-changed; ImagesPanel listens
 * and re-runs extractCanvasImages() over canvas.getObjects().  This test
 * covers the pure filtering/extraction logic mirrored from the component.
 */
import { describe, it, expect } from 'vitest';

interface CanvasImage { name: string; src: string; }

// Mirrors extractCanvasImages() in ImagesPanel.vue
function extractCanvasImages(objects: any[]): CanvasImage[] {
  const out: CanvasImage[] = [];
  for (const obj of objects) {
    const t = (obj?.type ?? '').toLowerCase();
    if (!t.includes('image')) continue;
    let src = '';
    try {
      src = obj.getSrc?.() ?? obj._element?.src ?? obj._originalElement?.src ?? '';
    } catch {
      src = '';
    }
    if (!src) continue;
    out.push({ name: obj.name ?? obj.id ?? '', src });
  }
  return out;
}

describe('extractCanvasImages — only Image objects with a source', () => {
  it('keeps Image objects and drops non-image objects', () => {
    const objects = [
      { type: 'Image', name: 'a', getSrc: () => 'data:image/png;base64,AAA' },
      { type: 'Textbox', name: 'b', text: 'hi' },
      { type: 'Rect', name: 'c' },
      { type: 'i-text', name: 'd' },
    ];
    const result = extractCanvasImages(objects);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('a');
  });

  it('handles both Fabric v5 (image) and v6 (Image) type casing', () => {
    const objects = [
      { type: 'image', name: 'v5', getSrc: () => 'data:image/png;base64,V5' },
      { type: 'Image', name: 'v6', getSrc: () => 'data:image/png;base64,V6' },
    ];
    expect(extractCanvasImages(objects)).toHaveLength(2);
  });

  it('extracts the base64 src via getSrc()', () => {
    const objects = [
      { type: 'Image', name: 'a', getSrc: () => 'data:image/jpeg;base64,XYZ' },
    ];
    expect(extractCanvasImages(objects)[0].src).toBe('data:image/jpeg;base64,XYZ');
  });

  it('falls back to _element.src when getSrc is absent', () => {
    const objects = [
      { type: 'Image', name: 'a', _element: { src: 'data:image/png;base64,ELEM' } },
    ];
    expect(extractCanvasImages(objects)[0].src).toBe('data:image/png;base64,ELEM');
  });

  it('falls back to _originalElement.src', () => {
    const objects = [
      { type: 'Image', name: 'a', _originalElement: { src: 'data:image/png;base64,ORIG' } },
    ];
    expect(extractCanvasImages(objects)[0].src).toBe('data:image/png;base64,ORIG');
  });

  it('skips images that have no resolvable source', () => {
    const objects = [
      { type: 'Image', name: 'a', getSrc: () => '' },
      { type: 'Image', name: 'b' },
    ];
    expect(extractCanvasImages(objects)).toHaveLength(0);
  });

  it('does not throw when getSrc itself throws', () => {
    const objects = [
      { type: 'Image', name: 'a', getSrc: () => { throw new Error('boom'); } },
      { type: 'Image', name: 'b', getSrc: () => 'data:image/png;base64,OK' },
    ];
    const result = extractCanvasImages(objects);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('b');
  });

  it('uses name, falling back to id when name is missing', () => {
    const objects = [
      { type: 'Image', id: 'id-only', getSrc: () => 'data:image/png;base64,A' },
      { type: 'Image', name: 'has-name', id: 'ignored', getSrc: () => 'data:image/png;base64,B' },
    ];
    const result = extractCanvasImages(objects);
    expect(result[0].name).toBe('id-only');
    expect(result[1].name).toBe('has-name');
  });

  it('returns empty for an empty canvas', () => {
    expect(extractCanvasImages([])).toEqual([]);
  });

  it('repopulates from base64 after a project is opened (loadFromJSON case)', () => {
    // Simulates the canvas state right after loadFromJSON revives objects.
    const revivedObjects = [
      { type: 'Image', name: 'n1', getSrc: () => 'data:image/png;base64,IMG1' },
      { type: 'Textbox', name: 'n2', text: 'Title' },
      { type: 'Image', name: 'n3', getSrc: () => 'data:image/png;base64,IMG2' },
    ];
    const result = extractCanvasImages(revivedObjects);
    expect(result.map(i => i.name)).toEqual(['n1', 'n3']);
    expect(result.every(i => i.src.startsWith('data:image/'))).toBe(true);
  });
});
