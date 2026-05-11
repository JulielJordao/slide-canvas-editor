import { ref } from 'vue';
import type { FontInfo } from '@/types';
import { loadGoogleFont } from '@/utils/fontLoader';

const FALLBACK_FONTS: FontInfo[] = [
  { family: 'Inter', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Roboto', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Open Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Lato', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Montserrat', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Poppins', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Nunito', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Raleway', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Oswald', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Merriweather', category: 'serif', variants: ['regular', '700'] },
  { family: 'Playfair Display', category: 'serif', variants: ['regular', '700'] },
  { family: 'Lora', category: 'serif', variants: ['regular', '700'] },
  { family: 'PT Serif', category: 'serif', variants: ['regular', '700'] },
  { family: 'Source Serif 4', category: 'serif', variants: ['regular', '700'] },
  { family: 'Source Code Pro', category: 'monospace', variants: ['regular', '700'] },
  { family: 'Fira Code', category: 'monospace', variants: ['regular', '700'] },
  { family: 'JetBrains Mono', category: 'monospace', variants: ['regular', '700'] },
  { family: 'Pacifico', category: 'handwriting', variants: ['regular'] },
  { family: 'Dancing Script', category: 'handwriting', variants: ['regular', '700'] },
  { family: 'Caveat', category: 'handwriting', variants: ['regular', '700'] },
  { family: 'Satisfy', category: 'handwriting', variants: ['regular'] },
  { family: 'Great Vibes', category: 'handwriting', variants: ['regular'] },
  { family: 'Lobster', category: 'display', variants: ['regular'] },
  { family: 'Bebas Neue', category: 'display', variants: ['regular'] },
  { family: 'Righteous', category: 'display', variants: ['regular'] },
  { family: 'Titan One', category: 'display', variants: ['regular'] },
  { family: 'Alfa Slab One', category: 'display', variants: ['regular'] },
  { family: 'Anton', category: 'sans-serif', variants: ['regular'] },
  { family: 'Ubuntu', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Noto Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'PT Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Rubik', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Work Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'DM Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Barlow', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Manrope', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Figtree', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Plus Jakarta Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Space Grotesk', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Syne', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Outfit', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Nunito Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Mulish', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Quicksand', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Comfortaa', category: 'display', variants: ['regular', '700'] },
  { family: 'Exo 2', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Josefin Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Karla', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Cabin', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Overpass', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Spectral', category: 'serif', variants: ['regular', '700'] },
  { family: 'Cormorant Garamond', category: 'serif', variants: ['regular', '700'] },
  { family: 'EB Garamond', category: 'serif', variants: ['regular', '700'] },
];

const fontList = ref<FontInfo[]>([]);
const isLoading = ref(false);
let loaded = false;

export function useGoogleFonts() {
  async function fetchFontList() {
    // Start with fallback so UI is immediately usable
    if (!fontList.value.length) fontList.value = FALLBACK_FONTS;
    if (loaded || isLoading.value) return;
    isLoading.value = true;
    try {
      const res = await fetch('https://fonts.google.com/metadata/fonts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Strip XSSI prefix )]}'\n that Google prepends to prevent JSON hijacking
      const json = text.replace(/^\)\]\}'\s*/, '');
      const data = JSON.parse(json);
      const list = (data.familyMetadataList ?? []).map((item: any) => ({
        family: item.family,
        category: (item.category ?? '').toLowerCase().replace(/\s+/g, '-'),
        variants: Object.keys(item.fonts ?? {}),
      }));
      if (list.length > 0) {
        fontList.value = list;
        loaded = true;
      }
    } catch (err) {
      console.warn('[GoogleFonts] metadata API unavailable, using built-in list:', err);
    } finally {
      isLoading.value = false;
    }
  }

  function search(query: string): FontInfo[] {
    if (!query.trim()) return fontList.value.slice(0, 100);
    const q = query.toLowerCase();
    return fontList.value.filter(f => f.family.toLowerCase().includes(q)).slice(0, 100);
  }

  return { fontList, isLoading, fetchFontList, search, loadGoogleFont };
}
