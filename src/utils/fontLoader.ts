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
  } catch {
    // ignore parse errors
  }
}
