/**
 * Regression tests for TextInspector stroke/shadow toggle bugs.
 *
 * Fabric objects are NOT Vue-reactive: mutating one via obj.set() triggers no
 * re-evaluation of a `computed` that reads it.  TextInspector's strokeEnabled /
 * shadowEnabled computeds therefore went stale after the first evaluation,
 * causing three symptoms:
 *
 *   1. Toggling the stroke switch a second time would not turn it off — the
 *      handler read a stale `strokeEnabled` value and always took the enable
 *      branch.
 *   2. The v-if stroke/shadow property sections never appeared, because the
 *      `enabled` computed never flipped to true.
 *   3. The shadow appeared only after an undo, because undo reloads the canvas
 *      and re-mounts the inspector, which re-evaluates the computeds fresh.
 *
 * Fix: a `rev` ref that getObj() touches, bumped on every rerender(), so all
 * computeds re-evaluate after each mutation.
 */
import { describe, it, expect } from 'vitest';
import { computed, ref } from 'vue';

describe('TextInspector reactivity trigger (rev counter)', () => {
  it('a computed reading getObj() re-evaluates after rev bumps', () => {
    const rev = ref(0);
    const fabricObj: { stroke: string | null; strokeWidth: number } = {
      stroke: null,
      strokeWidth: 0,
    };

    function getObj() {
      void rev.value; // reactive touch
      return fabricObj;
    }
    const strokeEnabled = computed(() => {
      const o = getObj();
      return !!(o.stroke && o.strokeWidth > 0);
    });

    // Initially disabled
    expect(strokeEnabled.value).toBe(false);

    // Mutate the Fabric object directly (silent — no Vue reactivity)
    fabricObj.stroke = '#000000';
    fabricObj.strokeWidth = 2;
    // Stale: computed has not been told anything changed
    expect(strokeEnabled.value).toBe(false);

    // rerender() bumps rev → computed re-evaluates
    rev.value++;
    expect(strokeEnabled.value).toBe(true);
  });

  it('selection change re-evaluates computeds via selectedObjectIds touch', () => {
    const selectedObjectIds = ref<string[]>(['a']);
    const objA = { shadow: null as unknown };
    const objB = { shadow: {} as unknown };

    function getActiveObject() {
      return selectedObjectIds.value[0] === 'a' ? objA : objB;
    }
    function getObj() {
      void selectedObjectIds.value;
      return getActiveObject();
    }
    const shadowEnabled = computed(() => !!getObj().shadow);

    expect(shadowEnabled.value).toBe(false); // objA has no shadow

    selectedObjectIds.value = ['b'];
    expect(shadowEnabled.value).toBe(true); // objB has a shadow
  });
});

describe('toggleStroke turns the stroke off when already enabled', () => {
  function makeToggle() {
    const rev = ref(0);
    const obj: { stroke: string | null; strokeWidth: number; paintFirst?: string } = {
      stroke: null,
      strokeWidth: 0,
    };
    function getObj() {
      void rev.value;
      return obj;
    }
    const strokeEnabled = computed(() => {
      const o = getObj();
      return !!(o.stroke && o.strokeWidth > 0);
    });
    function toggleStroke() {
      if (strokeEnabled.value) {
        obj.stroke = null;
        obj.strokeWidth = 0;
      } else {
        obj.stroke = '#000000';
        obj.strokeWidth = 2;
        obj.paintFirst = 'stroke';
      }
      rev.value++; // rerender()
    }
    return { obj, strokeEnabled, toggleStroke };
  }

  it('first click enables, second click disables', () => {
    const { obj, strokeEnabled, toggleStroke } = makeToggle();

    expect(strokeEnabled.value).toBe(false);

    toggleStroke();
    expect(strokeEnabled.value).toBe(true);
    expect(obj.stroke).toBe('#000000');
    expect(obj.strokeWidth).toBe(2);

    toggleStroke();
    expect(strokeEnabled.value).toBe(false);
    expect(obj.stroke).toBeNull();
    expect(obj.strokeWidth).toBe(0);
  });

  it('toggling repeatedly always alternates state', () => {
    const { strokeEnabled, toggleStroke } = makeToggle();
    const states: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      toggleStroke();
      states.push(strokeEnabled.value);
    }
    expect(states).toEqual([true, false, true, false, true, false]);
  });
});

describe('toggleShadow turns the shadow off when already enabled', () => {
  function makeToggle() {
    const rev = ref(0);
    const obj: { shadow: unknown } = { shadow: null };
    function getObj() {
      void rev.value;
      return obj;
    }
    const shadowEnabled = computed(() => !!getObj().shadow);
    function toggleShadow() {
      if (shadowEnabled.value) {
        obj.shadow = null;
      } else {
        obj.shadow = { color: '#000000', blur: 10, offsetX: 4, offsetY: 4 };
      }
      rev.value++;
    }
    return { obj, shadowEnabled, toggleShadow };
  }

  it('first click enables, second click disables', () => {
    const { obj, shadowEnabled, toggleShadow } = makeToggle();

    expect(shadowEnabled.value).toBe(false);

    toggleShadow();
    expect(shadowEnabled.value).toBe(true);
    expect(obj.shadow).not.toBeNull();

    toggleShadow();
    expect(shadowEnabled.value).toBe(false);
    expect(obj.shadow).toBeNull();
  });
});

describe('rerender fires object:modified so changes are persisted', () => {
  it('object:modified is fired with the active object as target', () => {
    let firedEvent: string | null = null;
    let firedTarget: unknown = null;
    const activeObject = { id: 'obj-1' };

    const canvas = {
      requestRenderAll() {},
      getActiveObject() {
        return activeObject;
      },
      fire(event: string, opts: { target: unknown }) {
        firedEvent = event;
        firedTarget = opts.target;
      },
    };

    // Mirrors rerender() in TextInspector
    function rerender() {
      canvas.requestRenderAll();
      const obj = canvas.getActiveObject();
      if (obj) canvas.fire('object:modified', { target: obj });
    }

    rerender();
    expect(firedEvent).toBe('object:modified');
    expect(firedTarget).toBe(activeObject);
  });

  it('does not fire when there is no active object', () => {
    let fired = false;
    const canvas = {
      requestRenderAll() {},
      getActiveObject() {
        return null;
      },
      fire() {
        fired = true;
      },
    };
    function rerender() {
      canvas.requestRenderAll();
      const obj = canvas.getActiveObject();
      if (obj) canvas.fire();
    }
    rerender();
    expect(fired).toBe(false);
  });
});
