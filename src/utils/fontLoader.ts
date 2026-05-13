// Fonts bundled via @fontsource — no network request needed
const BUNDLED_FONTS = new Set([
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Nunito', 'Oswald', 'Raleway', 'Merriweather', 'Playfair Display',
  'Bebas Neue', 'Dancing Script', 'Pacifico', 'Lobster',
]);

const loadedFonts = new Set<string>([...BUNDLED_FONTS]);

export async function loadGoogleFont(family: string): Promise<void> {
  if (loadedFonts.has(family)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);

  try {
    await document.fonts.load(`16px "${family}"`);
    loadedFonts.add(family);
  } catch {
    // Font may still be available even if load() times out
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
