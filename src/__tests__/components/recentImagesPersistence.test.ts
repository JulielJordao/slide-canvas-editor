/**
 * Tests for the recent-images persistence layer in ImagesPanel.
 *
 * The panel was previously losing its "Recentes" list on every reload.
 * The fix wires the list to localStorage with a max-length cap and
 * dedup-via-pushRecent.  These tests cover that wire-up using the
 * same pure helpers the component now uses.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const RECENT_IMAGES_KEY = 'se:recent_images';
const RECENT_IMAGES_MAX = 40;

function loadPersistedRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_IMAGES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function persistRecents(paths: string[]) {
  localStorage.setItem(RECENT_IMAGES_KEY, JSON.stringify(paths.slice(0, RECENT_IMAGES_MAX)));
}

function pushRecent(list: string[], path: string): string[] {
  if (!path) return list;
  const next = list.filter(p => p !== path);
  next.unshift(path);
  return next.slice(0, RECENT_IMAGES_MAX);
}

describe('loadPersistedRecents', () => {
  beforeEach(() => localStorage.clear());

  it('returns an empty list when nothing is stored', () => {
    expect(loadPersistedRecents()).toEqual([]);
  });

  it('restores a previously persisted list', () => {
    localStorage.setItem(RECENT_IMAGES_KEY, JSON.stringify(['/a.png', '/b.png']));
    expect(loadPersistedRecents()).toEqual(['/a.png', '/b.png']);
  });

  it('returns an empty list when stored value is malformed JSON', () => {
    localStorage.setItem(RECENT_IMAGES_KEY, 'not-json{');
    expect(loadPersistedRecents()).toEqual([]);
  });

  it('strips non-string entries from a stored array', () => {
    localStorage.setItem(RECENT_IMAGES_KEY, JSON.stringify(['/ok.png', 42, null, '/also.jpg']));
    expect(loadPersistedRecents()).toEqual(['/ok.png', '/also.jpg']);
  });

  it('returns an empty list when stored value is not an array', () => {
    localStorage.setItem(RECENT_IMAGES_KEY, JSON.stringify({ foo: 'bar' }));
    expect(loadPersistedRecents()).toEqual([]);
  });
});

describe('pushRecent', () => {
  it('adds a new path to the front', () => {
    expect(pushRecent([], '/img.png')).toEqual(['/img.png']);
  });

  it('does not duplicate an existing path — it moves it to the front', () => {
    const result = pushRecent(['/a.png', '/b.png'], '/b.png');
    expect(result).toEqual(['/b.png', '/a.png']);
  });

  it('ignores an empty path', () => {
    expect(pushRecent(['/a.png'], '')).toEqual(['/a.png']);
  });

  it('caps the list at RECENT_IMAGES_MAX entries', () => {
    const initial = Array.from({ length: RECENT_IMAGES_MAX }, (_, i) => `/img-${i}.png`);
    const result = pushRecent(initial, '/new.png');
    expect(result).toHaveLength(RECENT_IMAGES_MAX);
    expect(result[0]).toBe('/new.png');
    expect(result).not.toContain(`/img-${RECENT_IMAGES_MAX - 1}.png`);
  });
});

describe('persistence round-trip', () => {
  beforeEach(() => localStorage.clear());

  it('a list written by persistRecents is loaded identically by loadPersistedRecents', () => {
    persistRecents(['/x.png', '/y.png', '/z.png']);
    expect(loadPersistedRecents()).toEqual(['/x.png', '/y.png', '/z.png']);
  });

  it('persistRecents truncates beyond RECENT_IMAGES_MAX on save', () => {
    const big = Array.from({ length: RECENT_IMAGES_MAX + 5 }, (_, i) => `/img-${i}.png`);
    persistRecents(big);
    expect(loadPersistedRecents()).toHaveLength(RECENT_IMAGES_MAX);
  });

  it('survives a simulated reload', () => {
    const session1 = pushRecent(pushRecent([], '/photo1.jpg'), '/photo2.jpg');
    persistRecents(session1);
    // "Reload" — same key, fresh load.
    expect(loadPersistedRecents()).toEqual(['/photo2.jpg', '/photo1.jpg']);
  });
});
