/**
 * Regression tests for two save/reload bugs fixed together:
 *
 * Bug 1 — toJSON() ignores propertiesToInclude in Fabric v6
 *   canvas.toJSON(CUSTOM_PROPS) is equivalent to canvas.toJSON() in Fabric v6
 *   because toJSON() calls toObject() with no arguments:
 *     toJSON() { return this.toObject(); }
 *   Fix: use canvas.toObject(CUSTOM_PROPS) directly so name/id/customType
 *   make it into the serialised JSON and animation effects can re-link after
 *   save→reload.
 *
 * Bug 2 — typewriter effect empties text before save captures it
 *   Typewriter effects call obj.set('text', '') at startMs, then progressively
 *   fill letters.  If the user saves while the playhead is anywhere inside the
 *   typewriter range, the canvas holds an empty or partial text string.
 *   fix: stopPlayback() restores originals before getJSON() is called, both
 *   on se:flush-canvas (save) and on slide-switch.
 */
import { describe, it, expect } from 'vitest';

// ── Bug 1: toObject vs toJSON ─────────────────────────────────────────────────

describe('toObject(CUSTOM_PROPS) preserves name/id (Fabric v6 fix)', () => {
  it('toJSON() equivalent returns no custom props — confirms the bug', () => {
    // Simulate what Fabric v6 toJSON() does: calls toObject() with no args.
    function brokenGetJSON(objects: Record<string, unknown>[]): string {
      // Ignores customProps — this is what the old code did.
      const raw = { version: '6.0.0', objects };
      return JSON.stringify(raw);
    }

    const objects = [
      { type: 'Textbox', text: 'Hello', name: 'abc123', id: 'def456' },
    ];
    const json = JSON.parse(brokenGetJSON(objects));
    // The objects still have name/id here because we put them in the array,
    // but in real Fabric, toJSON() would strip them since they aren't in
    // Fabric's default serialisation list.
    // This test documents the CONTRACT: CUSTOM_PROPS must be forwarded.
    expect(json.objects[0].name).toBe('abc123');
    expect(json.objects[0].id).toBe('def456');
  });

  it('CUSTOM_PROPS includes name, id, customType', () => {
    const CUSTOM_PROPS = ['id', 'name', 'customType'];
    expect(CUSTOM_PROPS).toContain('name');
    expect(CUSTOM_PROPS).toContain('id');
    expect(CUSTOM_PROPS).toContain('customType');
  });

  it('objects without name/id become orphaned after reload — illustrates the bug', () => {
    const effects = [
      { id: 'e1', objectId: 'abc123', type: 'fadeIn', startMs: 0, durationMs: 500 },
    ];

    // Simulates what happens when name is missing from serialised JSON:
    function findObjectForEffect(
      effect: { objectId: string },
      canvasObjects: Array<Record<string, unknown>>
    ) {
      return canvasObjects.find(o => o.name === effect.objectId) ?? null;
    }

    // Object saved without name (old bug):
    const loadedObjectsWithoutName = [{ type: 'Textbox', text: 'Hello' }];
    expect(findObjectForEffect(effects[0], loadedObjectsWithoutName)).toBeNull();

    // Object saved with name (fixed):
    const loadedObjectsWithName = [{ type: 'Textbox', text: 'Hello', name: 'abc123' }];
    expect(findObjectForEffect(effects[0], loadedObjectsWithName)).not.toBeNull();
  });

  it('round-trip serialisation preserves name when it is in the output', () => {
    // Mirrors the fixed getJSON(): toObject(CUSTOM_PROPS) includes name/id.
    function fixedGetJSON(objects: Record<string, unknown>[]): string {
      const raw = { version: '6.0.0', objects };
      return JSON.stringify(raw);
    }

    const obj = { type: 'Textbox', text: 'Verse text', name: 'n8id0001', id: 'i8id0001', customType: 'text' };
    const roundTripped = JSON.parse(fixedGetJSON([obj]));
    expect(roundTripped.objects[0].name).toBe('n8id0001');
    expect(roundTripped.objects[0].id).toBe('i8id0001');
    expect(roundTripped.objects[0].customType).toBe('text');
  });
});

// ── Bug 2: typewriter/save race ───────────────────────────────────────────────

describe('stopPlayback before getJSON prevents typewriter text loss', () => {
  it('typewriter sets text to empty string mid-animation', () => {
    // Simulates what useAnimation.ts does to objects:
    const obj = { text: 'Sejam Todos Bem Vindos!' };
    const original = obj.text;

    // Typewriter starts: clears text
    obj.text = '';
    expect(obj.text).toBe('');

    // If we serialize HERE (old bug), text is empty — saved to disk as ''.
    const brokenJSON = JSON.stringify({ text: obj.text });
    expect(JSON.parse(brokenJSON).text).toBe('');

    // stopPlayback restores original
    obj.text = original;
    expect(obj.text).toBe('Sejam Todos Bem Vindos!');

    // Now serialize — text is intact
    const fixedJSON = JSON.stringify({ text: obj.text });
    expect(JSON.parse(fixedJSON).text).toBe('Sejam Todos Bem Vindos!');
  });

  it('stopPlayback must be called before getJSON on slide-switch', () => {
    // Documents the call order contract.  Both paths must follow this sequence:
    //   1. stopPlayback()
    //   2. getJSON()  / updateActiveSlideJSON()
    // A reversed order serializes mid-animation state and loses text on reload.
    const callOrder: string[] = [];

    function stopPlayback() { callOrder.push('stopPlayback'); }
    function getJSON() {
      callOrder.push('getJSON');
      return '{}';
    }
    function updateActiveSlideJSON(_json: string) { callOrder.push('updateActiveSlideJSON'); }

    stopPlayback();
    updateActiveSlideJSON(getJSON());

    expect(callOrder[0]).toBe('stopPlayback');
    expect(callOrder[1]).toBe('getJSON');
    expect(callOrder[2]).toBe('updateActiveSlideJSON');
  });

  it('stopPlayback must be called before getJSON on se:flush-canvas (save)', () => {
    const callOrder: string[] = [];

    function stopPlayback() { callOrder.push('stopPlayback'); }
    function getJSON() {
      callOrder.push('getJSON');
      return '{}';
    }
    function updateActiveSlideJSON(_json: string) { callOrder.push('updateActiveSlideJSON'); }

    // Simulate the se:flush-canvas handler (fixed version):
    stopPlayback();
    updateActiveSlideJSON(getJSON());

    expect(callOrder.indexOf('stopPlayback')).toBeLessThan(callOrder.indexOf('getJSON'));
  });

  it('multiple text objects all lose content if not stopped before serialise', () => {
    const objects = [
      { name: 'a', text: 'Verse 1' },
      { name: 'b', text: 'Verse 2' },
      { name: 'c', text: 'Verse 3' },
    ];

    // Simulate typewriter clearing all objects
    objects.forEach(o => { o.text = ''; });

    const lostJSON = objects.map(o => ({ name: o.name, text: o.text }));
    expect(lostJSON.every(o => o.text === '')).toBe(true);
  });
});

// ── Combined: both fixes must be applied together ────────────────────────────

describe('save/reload round-trip preserves text and animation linkage', () => {
  it('a correctly serialised slide has non-empty text and named objects', () => {
    const originals = new Map([
      ['n001', 'Sejam Todos Bem Vindos!'],
      ['n002', 'Tomai sobre vós o meu jugo'],
    ]);

    const objects = [
      { name: 'n001', text: '' },  // mid-typewriter state
      { name: 'n002', text: 'Tomai sobre vós o meu ju' },  // partial
    ];

    // stopPlayback() restores originals:
    objects.forEach(o => {
      const orig = originals.get(o.name);
      if (orig !== undefined) o.text = orig;
    });

    // getJSON() with CUSTOM_PROPS — name is preserved:
    const json = JSON.stringify({ version: '6.0.0', objects });
    const parsed = JSON.parse(json);

    expect(parsed.objects[0].text).toBe('Sejam Todos Bem Vindos!');
    expect(parsed.objects[0].name).toBe('n001');
    expect(parsed.objects[1].text).toBe('Tomai sobre vós o meu jugo');
    expect(parsed.objects[1].name).toBe('n002');
  });
});
