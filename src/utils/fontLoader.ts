// Fonts bundled via @fontsource — these have @font-face declared by the bundle,
// but the browser only fetches the actual font file lazily (on first measure /
// paint).  We still need to force-load them via document.fonts.load() so that
// Fabric's canvas-2D measureText() sees the real font instead of the fallback.
const BUNDLED_FONTS = new Set([
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Nunito', 'Oswald', 'Raleway', 'Merriweather', 'Playfair Display',
  'Bebas Neue', 'Dancing Script', 'Pacifico', 'Lobster',
]);

// Tracks fonts already force-loaded in this session so we don't re-await.
const loadedFonts = new Set<string>();

export async function loadGoogleFont(family: string): Promise<void> {
  if (loadedFonts.has(family)) return;

  // For non-bundled fonts, inject the Google Fonts <link> so the @font-face
  // declarations exist before document.fonts.load() can resolve them.
  if (!BUNDLED_FONTS.has(family)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }

  // Force the browser to actually fetch and parse the font.  Without this,
  // the @font-face declaration exists but the font file is only fetched on
  // first measure/paint — which means Fabric's first measureText() uses
  // fallback metrics, producing a width too narrow for the real glyphs and
  // clipping the last character on the right after a save→reload cycle.
  try {
    await Promise.all([
      document.fonts.load(`16px "${family}"`),
      document.fonts.load(`bold 16px "${family}"`),
    ]);
    loadedFonts.add(family);
  } catch {
    loadedFonts.add(family);
  }
}

export async function loadFontsFromJSON(json: string): Promise<void> {
  try {
    const data = JSON.parse(json);
    const families = new Set<string>();
    for (const obj of data.objects ?? []) {
      if (obj.fontFamily) families.add(obj.fontFamily);
    }
    await Promise.all([...families].map(f => loadGoogleFont(f)));
    // Belt-and-suspenders: wait until ALL pending font faces have actually
    // resolved.  Without this, Fabric's text-width measurement may run with
    // fallback metrics (because the canvas 2D context can't see the font
    // yet), producing a slightly-too-narrow width that clips the last
    // character on the right when the text is restored.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    // ignore parse errors
  }
}
