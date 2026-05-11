/**
 * Tests for the Google Fonts composable (useGoogleFonts).
 *
 * The composable has two testable concerns that need no real network:
 *   1. `search()` — pure in-memory filter over a font list.
 *   2. Metadata API response parsing — the XSSI prefix must be stripped and
 *      the familyMetadataList must be mapped to FontInfo objects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FontInfo } from '@/types';

// ── search() helper (mirrors useGoogleFonts.search) ──────────────────────────

function makeFontList(): FontInfo[] {
  return [
    { family: 'Roboto', category: 'sans-serif', variants: ['regular', '700'] },
    { family: 'Roboto Mono', category: 'monospace', variants: ['regular'] },
    { family: 'Playfair Display', category: 'serif', variants: ['regular', '700'] },
    { family: 'Pacifico', category: 'handwriting', variants: ['regular'] },
    { family: 'Bebas Neue', category: 'display', variants: ['regular'] },
  ];
}

function search(list: FontInfo[], query: string): FontInfo[] {
  if (!query.trim()) return list.slice(0, 100);
  const q = query.toLowerCase();
  return list.filter(f => f.family.toLowerCase().includes(q)).slice(0, 100);
}

describe('search — empty query', () => {
  it('returns up to 100 fonts when query is empty string', () => {
    const list = makeFontList();
    expect(search(list, '')).toHaveLength(list.length);
  });

  it('returns up to 100 fonts when query is whitespace-only', () => {
    const list = makeFontList();
    expect(search(list, '   ')).toHaveLength(list.length);
  });
});

describe('search — basic matching', () => {
  it('matches by exact family name (case-insensitive)', () => {
    const list = makeFontList();
    const result = search(list, 'roboto');
    expect(result.map(f => f.family)).toContain('Roboto');
    expect(result.map(f => f.family)).toContain('Roboto Mono');
  });

  it('matches partial substring', () => {
    const result = search(makeFontList(), 'play');
    expect(result.map(f => f.family)).toContain('Playfair Display');
  });

  it('is case-insensitive', () => {
    expect(search(makeFontList(), 'ROBOTO')).toHaveLength(2);
    expect(search(makeFontList(), 'Roboto')).toHaveLength(2);
    expect(search(makeFontList(), 'roboto')).toHaveLength(2);
  });

  it('returns empty array when no font matches', () => {
    expect(search(makeFontList(), 'zzznomatch')).toHaveLength(0);
  });

  it('matches "mono" in Roboto Mono but not in Roboto', () => {
    const result = search(makeFontList(), 'mono');
    expect(result).toHaveLength(1);
    expect(result[0].family).toBe('Roboto Mono');
  });
});

describe('search — result cap at 100', () => {
  it('returns at most 100 results even with 200 matching fonts', () => {
    const big: FontInfo[] = Array.from({ length: 200 }, (_, i) => ({
      family: `Font ${i}`,
      category: 'sans-serif',
      variants: ['regular'],
    }));
    expect(search(big, 'font')).toHaveLength(100);
  });
});

// ── Metadata API response parsing ────────────────────────────────────────────
//
// fonts.google.com/metadata/fonts prepends )]}'\n (XSSI prefix) before JSON.
// The fetchFontList function must strip it before parsing.

function parseMetadataResponse(rawText: string): FontInfo[] {
  const json = rawText.replace(/^\)\]\}'\s*/, '');
  const data = JSON.parse(json);
  return (data.familyMetadataList ?? []).map((item: any) => ({
    family: item.family,
    category: (item.category ?? '').toLowerCase().replace(/\s+/g, '-'),
    variants: Object.keys(item.fonts ?? {}),
  }));
}

const SAMPLE_METADATA = `)]}'\n` + JSON.stringify({
  familyMetadataList: [
    {
      family: 'Roboto',
      category: 'Sans Serif',
      fonts: { '100': {}, 'regular': {}, '700': {} },
    },
    {
      family: 'Lora',
      category: 'Serif',
      fonts: { 'regular': {}, '700': {} },
    },
    {
      family: 'Fira Code',
      category: 'Monospace',
      fonts: { 'regular': {}, '500': {}, '700': {} },
    },
  ],
});

describe('parseMetadataResponse — XSSI prefix stripping', () => {
  it('parses correctly after stripping XSSI prefix', () => {
    const fonts = parseMetadataResponse(SAMPLE_METADATA);
    expect(fonts).toHaveLength(3);
  });

  it('also parses plain JSON without XSSI prefix', () => {
    const plain = JSON.stringify({
      familyMetadataList: [{ family: 'Inter', category: 'Sans Serif', fonts: { regular: {} } }],
    });
    expect(parseMetadataResponse(plain)).toHaveLength(1);
  });
});

describe('parseMetadataResponse — field mapping', () => {
  it('maps family name correctly', () => {
    const fonts = parseMetadataResponse(SAMPLE_METADATA);
    expect(fonts[0].family).toBe('Roboto');
  });

  it('lowercases and hyphenates category ("Sans Serif" → "sans-serif")', () => {
    const fonts = parseMetadataResponse(SAMPLE_METADATA);
    expect(fonts[0].category).toBe('sans-serif');
    expect(fonts[1].category).toBe('serif');
    expect(fonts[2].category).toBe('monospace');
  });

  it('extracts variants from font weight keys', () => {
    const fonts = parseMetadataResponse(SAMPLE_METADATA);
    expect(fonts[0].variants).toEqual(expect.arrayContaining(['100', 'regular', '700']));
    expect(fonts[0].variants).toHaveLength(3);
  });

  it('handles a font with no fonts object (graceful fallback)', () => {
    const raw = `)]}'\n` + JSON.stringify({
      familyMetadataList: [{ family: 'Broken', category: 'Display' }],
    });
    const fonts = parseMetadataResponse(raw);
    expect(fonts[0].variants).toEqual([]);
  });

  it('returns empty array when familyMetadataList is missing', () => {
    const raw = `)]}'\n` + JSON.stringify({ something: 'else' });
    expect(parseMetadataResponse(raw)).toEqual([]);
  });
});
