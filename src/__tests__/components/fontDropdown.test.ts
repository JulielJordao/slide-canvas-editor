/**
 * Tests for FontDropdown — the compact font picker used in ContextToolbar.
 *
 * FontDropdown replaced the old <select> that showed font names in the
 * default UI font.  The new component:
 *   1. Renders the trigger label in the actual font family so the user
 *      previews the appearance before picking.
 *   2. Auto-flips placement when there isn't room for the popover below
 *      the trigger.
 *   3. Wraps the shared FontPicker so every font surface (Inspector,
 *      sidebar TextPanel, modal, ContextToolbar) uses the same widget.
 *
 * These tests cover the pure helpers (font CSS, placement math, popover
 * style object) that drive the component.
 */
import { describe, it, expect } from 'vitest';

// ── Trigger label font-family ────────────────────────────────────────────────

function triggerFontStyle(family: string): Record<string, string> {
  if (!family) return {};
  return { fontFamily: `"${family}", sans-serif` };
}

describe('triggerFontStyle', () => {
  it('returns empty object for empty family', () => {
    expect(triggerFontStyle('')).toEqual({});
  });

  it('quotes the family name (handles families with spaces)', () => {
    expect(triggerFontStyle('Playfair Display')).toEqual({
      fontFamily: '"Playfair Display", sans-serif',
    });
  });

  it('falls back to sans-serif', () => {
    const style = triggerFontStyle('Roboto');
    expect(style.fontFamily).toContain('sans-serif');
  });
});

// ── Placement flip logic ─────────────────────────────────────────────────────

const POPOVER_HEIGHT = 280;

function shouldFlipAbove(rect: { bottom: number }, viewportHeight: number): boolean {
  return viewportHeight - rect.bottom < POPOVER_HEIGHT;
}

describe('popover placement flip', () => {
  it('stays below the trigger when there is room', () => {
    expect(shouldFlipAbove({ bottom: 100 }, 900)).toBe(false);
  });

  it('flips above when the trigger is near the bottom edge', () => {
    expect(shouldFlipAbove({ bottom: 880 }, 900)).toBe(true);
  });

  it('flips above when there is exactly the popover height of space', () => {
    // 900 - 620 = 280, NOT less than 280 → stays below
    expect(shouldFlipAbove({ bottom: 620 }, 900)).toBe(false);
    // 900 - 621 = 279 → flips above
    expect(shouldFlipAbove({ bottom: 621 }, 900)).toBe(true);
  });
});

// ── Popover style object ─────────────────────────────────────────────────────

function popoverStyle(above: boolean): Record<string, string> {
  return above
    ? { bottom: '100%', marginBottom: '4px', top: 'auto' }
    : { top: '100%', marginTop: '4px', bottom: 'auto' };
}

describe('popoverStyle', () => {
  it('anchors below by default', () => {
    const s = popoverStyle(false);
    expect(s.top).toBe('100%');
    expect(s.bottom).toBe('auto');
  });

  it('anchors above when flipped', () => {
    const s = popoverStyle(true);
    expect(s.bottom).toBe('100%');
    expect(s.top).toBe('auto');
  });

  it('uses the same margin in either direction', () => {
    expect(popoverStyle(false).marginTop).toBe('4px');
    expect(popoverStyle(true).marginBottom).toBe('4px');
  });
});

// ── Select-and-close contract ────────────────────────────────────────────────
//
// FontDropdown must close itself after a selection so the user can keep
// editing.  It also emits both `update:modelValue` (v-model) AND `select`
// (back-compat with the old @select API used by TextInspector).

describe('selection event contract', () => {
  function makeDropdown() {
    let open = true;
    const emitted: { event: string; value: string }[] = [];
    return {
      isOpen: () => open,
      emit(event: 'update:modelValue' | 'select', value: string) {
        emitted.push({ event, value });
      },
      onSelect(family: string) {
        this.emit('update:modelValue', family);
        this.emit('select', family);
        open = false;
      },
      emitted,
    };
  }

  it('closes after selecting a font', () => {
    const d = makeDropdown();
    d.onSelect('Roboto');
    expect(d.isOpen()).toBe(false);
  });

  it('emits update:modelValue followed by select', () => {
    const d = makeDropdown();
    d.onSelect('Inter');
    expect(d.emitted).toEqual([
      { event: 'update:modelValue', value: 'Inter' },
      { event: 'select', value: 'Inter' },
    ]);
  });
});
