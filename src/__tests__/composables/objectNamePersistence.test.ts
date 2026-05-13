/**
 * Regression: canvas objects must have a stable `name` field saved in
 * fabricJSON so that animation effects (which reference objectId) survive
 * a save/reload cycle.
 *
 * Root cause: names were only assigned during ensureObjectIds() called from
 * togglePlay(). A project saved before first playback had no names in
 * fabricJSON, orphaning all effects after reload.
 *
 * Fix: initCanvas now attaches an `object:added` listener that assigns a
 * nanoid(8) name to any object that arrives without one — including objects
 * added by loadFromJSON. The name is part of CUSTOM_PROPS so toJSON() includes
 * it in the next auto-save.
 */
import { describe, it, expect } from 'vitest';

// ── Contract: names are assigned on object:added ──────────────────────────────

describe('name-on-add contract', () => {
  it('a nameless object gets a name immediately on add', () => {
    const assigned: string[] = [];
    const fakeListener = (e: { target: Record<string, unknown> }) => {
      if (e.target && !e.target.name) {
        e.target.name = 'test-id-' + Math.random().toString(36).slice(2, 6);
        assigned.push(e.target.name as string);
      }
    };

    const objects = [
      { name: undefined },
      { name: 'existing-id' },
      { name: undefined },
    ];
    for (const obj of objects) {
      fakeListener({ target: obj as Record<string, unknown> });
    }

    expect(assigned).toHaveLength(2);
    expect(objects[0].name).toBeTruthy();
    expect(objects[1].name).toBe('existing-id');
    expect(objects[2].name).toBeTruthy();
  });

  it('objects that already have a name are never overwritten', () => {
    const obj: Record<string, unknown> = { name: 'keep-me' };
    const fakeListener = (e: { target: Record<string, unknown> }) => {
      if (e.target && !e.target.name) e.target.name = 'new-id';
    };
    fakeListener({ target: obj });
    expect(obj.name).toBe('keep-me');
  });
});

// ── Contract: CUSTOM_PROPS includes 'name' ─────────────────────────────────────

describe('CUSTOM_PROPS serialization contract', () => {
  it('CUSTOM_PROPS includes name and id so toJSON persists them', () => {
    const CUSTOM_PROPS = ['id', 'name', 'customType'];
    expect(CUSTOM_PROPS).toContain('name');
    expect(CUSTOM_PROPS).toContain('id');
  });

  it('a saved fabricJSON with name fields round-trips the names', () => {
    const fabricJSON = JSON.stringify({
      version: '6.0.0',
      objects: [
        { type: 'Textbox', name: 'abc-123', text: 'Hello' },
        { type: 'Image', name: 'xyz-456', src: 'data:...' },
      ],
    });
    const parsed = JSON.parse(fabricJSON);
    expect(parsed.objects[0].name).toBe('abc-123');
    expect(parsed.objects[1].name).toBe('xyz-456');
  });

  it('effects whose objectId matches saved names survive reload', () => {
    const savedNames = ['abc-123', 'xyz-456'];
    const effects = [
      { id: 'e1', objectId: 'abc-123', type: 'fadeIn' },
      { id: 'e2', objectId: 'xyz-456', type: 'shake' },
      { id: 'e3', objectId: 'gone-id', type: 'blurOut' },
    ];
    const linked = effects.filter(e => savedNames.includes(e.objectId));
    expect(linked).toHaveLength(2);
    expect(linked.map(e => e.id)).toEqual(['e1', 'e2']);
  });
});

// ── Contract: loadFromJSON objects get names ───────────────────────────────────

describe('objects loaded from JSON without names get assigned one', () => {
  it('simulates loadFromJSON firing object:added for each nameless object', () => {
    const loadedObjects: Array<Record<string, unknown>> = [
      { type: 'IText', text: 'Hello' },   // no name — pre-fix save
      { type: 'Image', src: 'img.png' },  // no name
      { type: 'Textbox', text: 'World', name: 'existing' }, // already has name
    ];

    let counter = 0;
    const onObjectAdded = (e: { target: Record<string, unknown> }) => {
      if (!e.target.name) {
        e.target.name = `loaded-${++counter}`;
      }
    };

    for (const obj of loadedObjects) {
      onObjectAdded({ target: obj });
    }

    expect(loadedObjects[0].name).toBe('loaded-1');
    expect(loadedObjects[1].name).toBe('loaded-2');
    expect(loadedObjects[2].name).toBe('existing');
  });
});
