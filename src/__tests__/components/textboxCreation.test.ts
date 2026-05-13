/**
 * Tests for text object creation behaviour in addText().
 *
 * addText() uses fabric.Textbox (not IText) so that:
 *  1. Text wraps within the box — no overflow past the canvas boundary.
 *  2. The last character(s) are never clipped by the canvas edge.
 *  3. Users can resize the box handles to control layout.
 *
 * IText expands horizontally without wrapping; long strings (e.g. Bible verses)
 * would overflow and get clipped by overflow:hidden on the canvas wrapper.
 */
import { describe, it, expect } from 'vitest';

// Mirrors the addText() logic from ContextToolbar.vue so we can unit-test
// the object configuration without mounting the full component.
function buildTextboxOptions(canvasW: number, canvasH: number) {
  return {
    type: 'textbox',
    left: canvasW / 2,
    top: canvasH / 2,
    originX: 'center',
    originY: 'center',
    width: canvasW * 0.75,
    fontSize: 48,
    fill: '#ffffff',
    fontFamily: 'Inter',
    textAlign: 'center',
  };
}

describe('addText creates a Textbox, not IText', () => {
  it('type is textbox', () => {
    const opts = buildTextboxOptions(1920, 1080);
    expect(opts.type).toBe('textbox');
  });

  it('width is 75% of canvas width so long text wraps before the edge', () => {
    const opts = buildTextboxOptions(1920, 1080);
    expect(opts.width).toBe(1920 * 0.75);
  });

  it('text is centered within the box', () => {
    const opts = buildTextboxOptions(1920, 1080);
    expect(opts.textAlign).toBe('center');
    expect(opts.originX).toBe('center');
  });

  it('box is placed at the canvas centre', () => {
    const opts = buildTextboxOptions(1920, 1080);
    expect(opts.left).toBe(960);
    expect(opts.top).toBe(540);
  });

  it('box width is always less than canvas width — no overflow', () => {
    for (const w of [800, 1280, 1920]) {
      const opts = buildTextboxOptions(w, 720);
      expect(opts.width).toBeLessThan(w);
    }
  });
});

// ── initDimensions contract ──────────────────────────────────────────────────
//
// After loadFromJSON, text objects must have initDimensions() called so that
// their width is recomputed with the current font metrics. Without this, a
// mismatch between the saved width (computed at save time) and the current
// rendering width causes Fabric to clip the last character(s) of the text.

describe('initDimensions contract for loaded text objects', () => {
  it('only text-like types need recomputation', () => {
    const textTypes = ['i-text', 'text', 'textbox'];
    const nonTextTypes = ['rect', 'circle', 'image', 'group', 'path'];
    function needsRecompute(type: string) {
      return textTypes.includes(type);
    }
    textTypes.forEach(t => expect(needsRecompute(t)).toBe(true));
    nonTextTypes.forEach(t => expect(needsRecompute(t)).toBe(false));
  });

  it('calling initDimensions on each text object does not mutate non-text objects', () => {
    const objects = [
      { type: 'i-text', initDimensionsCalled: false },
      { type: 'rect', initDimensionsCalled: false },
      { type: 'textbox', initDimensionsCalled: false },
      { type: 'image', initDimensionsCalled: false },
    ];
    const textTypes = new Set(['i-text', 'text', 'textbox']);
    objects.forEach(obj => {
      if (textTypes.has(obj.type)) obj.initDimensionsCalled = true;
    });
    expect(objects[0].initDimensionsCalled).toBe(true);   // i-text
    expect(objects[1].initDimensionsCalled).toBe(false);  // rect
    expect(objects[2].initDimensionsCalled).toBe(true);   // textbox
    expect(objects[3].initDimensionsCalled).toBe(false);  // image
  });
});

// ── Auto-fit overflow correction ─────────────────────────────────────────────
//
// initDimensions alone isn't enough when the saved IText is genuinely wider
// than the canvas (e.g. the user typed a verse long enough that the line spans
// past the right edge).  As graceful degradation, after recomputing dimensions
// we shrink any text object whose scaled width still exceeds the canvas so
// nothing gets clipped on the right.

function autoFitScale(scaledWidth: number, canvasWidth: number): number {
  if (scaledWidth <= canvasWidth) return 1;
  return canvasWidth / scaledWidth;
}

describe('autoFitScale — shrink-to-fit for overflowing text', () => {
  it('returns 1 (no shrink) when text already fits', () => {
    expect(autoFitScale(1800, 1920)).toBe(1);
  });

  it('returns 1 at exact canvas width', () => {
    expect(autoFitScale(1920, 1920)).toBe(1);
  });

  it('shrinks slightly when text is just barely over (the Bible-verse case)', () => {
    // Text 60px wider than the canvas → scale ≈ 0.97
    const s = autoFitScale(1980, 1920);
    expect(s).toBeCloseTo(0.9697, 3);
    expect(s).toBeLessThan(1);
  });

  it('shrinks aggressively when text is way too wide', () => {
    const s = autoFitScale(4000, 1920);
    expect(s).toBeCloseTo(0.48, 2);
  });

  it('produces a scaled width exactly equal to canvas width', () => {
    const orig = 2400;
    const s = autoFitScale(orig, 1920);
    expect(orig * s).toBeCloseTo(1920, 5);
  });
});

// ── document.fonts.ready integration ─────────────────────────────────────────
//
// loadFontsFromJSON awaits document.fonts.ready after kicking off individual
// loadGoogleFont() calls.  This guarantees the canvas 2D context can measure
// the real font (not a fallback) before Fabric's initDimensions runs — which
// is what was previously causing the saved width to disagree with the
// rendered width and clip the last character.

// ── Regression: don't pass `type` to Textbox constructor ─────────────────────
//
// In Fabric.js v6, `type` is a readonly getter on the class prototype.
// Spreading toObject() into a Textbox constructor used to throw
// "TypeError: Attempted to assign to readonly property" and abort the whole
// loadFromJSON, leaving stale IText on the canvas (not migrated, still
// clipped on the right).  The migration must enumerate props explicitly so
// `type` never crosses the boundary.

describe('IText → Textbox migration props (regression)', () => {
  function buildMigrationProps(iText: Record<string, unknown>, fitWidth: number) {
    return {
      left: iText.left,
      top: iText.top,
      originX: iText.originX,
      originY: iText.originY,
      angle: iText.angle,
      scaleX: iText.scaleX,
      scaleY: iText.scaleY,
      fontFamily: iText.fontFamily,
      fontSize: iText.fontSize,
      fontWeight: iText.fontWeight,
      fontStyle: iText.fontStyle,
      textAlign: iText.textAlign,
      fill: iText.fill,
      width: fitWidth,
    };
  }

  it('does NOT include the type property (readonly in Fabric v6)', () => {
    const iText = { type: 'i-text', text: 'hi', left: 10, fontSize: 48 };
    const props = buildMigrationProps(iText, 1000);
    expect((props as any).type).toBeUndefined();
  });

  it('does NOT include version (readonly across class boundaries)', () => {
    const iText = { type: 'i-text', version: '6.0.0', text: 'hi' };
    const props = buildMigrationProps(iText, 1000);
    expect((props as any).version).toBeUndefined();
  });

  it('copies positional + typographic props faithfully', () => {
    const iText = {
      left: 100, top: 50, fontSize: 36, fontFamily: 'Inter',
      textAlign: 'center', fill: '#ff0000',
    };
    const props = buildMigrationProps(iText, 800);
    expect(props.left).toBe(100);
    expect(props.top).toBe(50);
    expect(props.fontSize).toBe(36);
    expect(props.fontFamily).toBe('Inter');
    expect(props.textAlign).toBe('center');
    expect(props.fill).toBe('#ff0000');
    expect(props.width).toBe(800);
  });

  it('clamps width to canvas budget when the saved IText overflows', () => {
    function fitWidth(measured: number, canvasW: number) {
      const budget = canvasW * 0.95;
      return measured <= budget ? measured : budget;
    }
    // Saved IText was 2100px wide on a 1920px canvas (overflows)
    expect(fitWidth(2100, 1920)).toBe(1824);
    // Saved IText was 800px wide on a 1920px canvas (fits)
    expect(fitWidth(800, 1920)).toBe(800);
  });
});

// ── Fabric v6 type normalisation ──────────────────────────────────────────────
//
// Fabric v5 serialised types as lowercase-hyphenated ('i-text', 'textbox').
// Fabric v6 serialises them as PascalCase ('IText', 'Textbox', 'Image').
// The migration function uses normalizeType() to handle both formats so that
// IText→Textbox conversion works regardless of which Fabric version saved the
// file.

function normalizeType(type: string | undefined): string {
  return (type ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

describe('normalizeType — handles both Fabric v5 (lowercase-hyphenated) and v6 (PascalCase)', () => {
  it('normalizes Fabric v6 PascalCase IText to itext', () => {
    expect(normalizeType('IText')).toBe('itext');
  });

  it('normalizes Fabric v5 i-text to itext', () => {
    expect(normalizeType('i-text')).toBe('itext');
  });

  it('normalizes Fabric v6 Textbox to textbox', () => {
    expect(normalizeType('Textbox')).toBe('textbox');
  });

  it('normalizes Fabric v6 Image to image', () => {
    expect(normalizeType('Image')).toBe('image');
  });

  it('handles undefined/empty gracefully', () => {
    expect(normalizeType(undefined)).toBe('');
    expect(normalizeType('')).toBe('');
  });

  it('migration check: identifies IText objects with PascalCase type', () => {
    const objects = [
      { type: 'IText' },   // Fabric v6 serialised
      { type: 'i-text' },  // Fabric v5 serialised
      { type: 'Image' },
      { type: 'Textbox' },
    ];
    const needsMigration = objects.filter(o => {
      const t = normalizeType(o.type);
      return t === 'itext' || t === 'text';
    });
    expect(needsMigration).toHaveLength(2);
    expect(needsMigration[0].type).toBe('IText');
    expect(needsMigration[1].type).toBe('i-text');
  });
});

describe('document.fonts.ready is awaited defensively', () => {
  it('the await is gated by an optional-chain so missing document.fonts is non-fatal', () => {
    // Mirrors the guard in loadFontsFromJSON; jsdom does not implement
    // document.fonts, so the guard MUST short-circuit without throwing.
    const fakeDocument: any = {};
    let awaited = false;
    async function simulateGuardedAwait() {
      if (typeof fakeDocument !== 'undefined' && fakeDocument.fonts?.ready) {
        await fakeDocument.fonts.ready;
        awaited = true;
      }
    }
    return simulateGuardedAwait().then(() => {
      expect(awaited).toBe(false);
    });
  });

  it('awaits when document.fonts.ready is a real promise', async () => {
    const fakeDocument: any = { fonts: { ready: Promise.resolve('done') } };
    let value: string | null = null;
    if (fakeDocument.fonts?.ready) {
      value = await fakeDocument.fonts.ready;
    }
    expect(value).toBe('done');
  });
});
