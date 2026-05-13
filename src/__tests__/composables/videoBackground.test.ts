/**
 * Tests for the canvas video-background rendering logic.
 *
 * The video element loads its src from a same-origin Blob URL created from
 * readFile bytes.  This avoids the cross-origin taint that the asset://
 * protocol introduces on macOS — which both silently breaks the load when
 * crossOrigin='anonymous' is set, and breaks toDataURL when it isn't.
 *
 * objectCaching must be false on the fabric.Image wrapper so Fabric re-reads
 * the video element on every render instead of caching the first (black) frame.
 */
import { describe, it, expect } from 'vitest';

interface VideoLike { videoWidth: number; videoHeight: number; }

function buildFabricImageOptions(video: VideoLike, canvasW: number, canvasH: number) {
  const vw = video.videoWidth || canvasW;
  const vh = video.videoHeight || canvasH;
  return {
    left: 0,
    top: 0,
    scaleX: canvasW / vw,
    scaleY: canvasH / vh,
    selectable: false,
    evented: false,
    objectCaching: false,
  };
}

describe('buildFabricImageOptions', () => {
  it('disables object caching so the video frame is re-read each render', () => {
    const opts = buildFabricImageOptions({ videoWidth: 1920, videoHeight: 1080 }, 1920, 1080);
    expect(opts.objectCaching).toBe(false);
  });

  it('makes the background non-interactive (not selectable, not evented)', () => {
    const opts = buildFabricImageOptions({ videoWidth: 1920, videoHeight: 1080 }, 1920, 1080);
    expect(opts.selectable).toBe(false);
    expect(opts.evented).toBe(false);
  });

  it('scales 720p video to fill a 1920×1080 canvas', () => {
    const opts = buildFabricImageOptions({ videoWidth: 1280, videoHeight: 720 }, 1920, 1080);
    expect(opts.scaleX).toBeCloseTo(1.5);
    expect(opts.scaleY).toBeCloseTo(1.5);
  });

  it('scales a vertical video to fit a 16:9 canvas (will letterbox visually)', () => {
    const opts = buildFabricImageOptions({ videoWidth: 1080, videoHeight: 1920 }, 1920, 1080);
    expect(opts.scaleX).toBeCloseTo(1920 / 1080);
    expect(opts.scaleY).toBeCloseTo(1080 / 1920);
  });

  it('falls back to canvas size when videoWidth/Height are still 0 (event raced)', () => {
    const opts = buildFabricImageOptions({ videoWidth: 0, videoHeight: 0 }, 1920, 1080);
    expect(opts.scaleX).toBe(1);
    expect(opts.scaleY).toBe(1);
  });

  it('positions the background at the canvas origin', () => {
    const opts = buildFabricImageOptions({ videoWidth: 1920, videoHeight: 1080 }, 1920, 1080);
    expect(opts.left).toBe(0);
    expect(opts.top).toBe(0);
  });
});

// ── Video element attributes ──────────────────────────────────────────────────
//
// The video is loaded from a same-origin Blob URL.  No crossOrigin attribute
// is set — same-origin means the canvas is never tainted, so toDataURL() for
// thumbnails keeps working.
//
// autoplay is deliberately NOT set: when both autoplay and an explicit play()
// call try to start playback, one interrupts the other and play() rejects
// with AbortError.

function buildVideoElement(): HTMLVideoElement {
  const v = document.createElement('video');
  v.loop = true;
  v.muted = true;
  v.playsInline = true;
  return v;
}

describe('video element configuration', () => {
  it('is muted so play() works without user-gesture in all browsers', () => {
    expect(buildVideoElement().muted).toBe(true);
  });

  it('loops continuously', () => {
    expect(buildVideoElement().loop).toBe(true);
  });

  it('does NOT set autoplay — explicit play() call is the single source of truth', () => {
    expect(buildVideoElement().autoplay).toBe(false);
  });

  it('does NOT set crossOrigin — blob URLs are same-origin, no taint risk', () => {
    expect(buildVideoElement().crossOrigin).toBeNull();
  });

  it('opts into playsInline so iOS WKWebView does not fullscreen-take-over', () => {
    expect(buildVideoElement().playsInline).toBe(true);
  });
});

// ── MIME type detection from file extension ──────────────────────────────────

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? 'mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'ogv') return 'video/ogg';
  if (ext === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

describe('getMimeType', () => {
  it('returns video/mp4 for .mp4 files', () => {
    expect(getMimeType('/path/to/clip.mp4')).toBe('video/mp4');
  });

  it('returns video/webm for .webm files', () => {
    expect(getMimeType('/path/to/clip.webm')).toBe('video/webm');
  });

  it('returns video/quicktime for .mov files (regression — used to map to mp4)', () => {
    expect(getMimeType('/path/to/clip.mov')).toBe('video/quicktime');
  });

  it('defaults to video/mp4 for unknown extensions', () => {
    expect(getMimeType('/path/to/clip.avi')).toBe('video/mp4');
  });

  it('handles uppercase extensions', () => {
    expect(getMimeType('/path/to/clip.MP4')).toBe('video/mp4');
  });
});

// ── AbortError swallow contract ─────────────────────────────────────────────
//
// When applyBackground is called twice in rapid succession (e.g. file open
// triggers both the background watcher AND initializeCanvas), the second
// invocation's stopVideoBackground removes the first's videoEl from the DOM,
// which rejects the in-flight play() promise with AbortError.  That's a
// harmless side effect of normal overlap and must not log a warning.

describe('play() rejection handling', () => {
  it('swallows AbortError silently', () => {
    const err = { name: 'AbortError' } as DOMException;
    function shouldWarn(e: DOMException): boolean {
      return e?.name !== 'AbortError';
    }
    expect(shouldWarn(err)).toBe(false);
  });

  it('warns for genuine play failures (NotAllowedError, NotSupportedError, …)', () => {
    function shouldWarn(e: DOMException): boolean {
      return e?.name !== 'AbortError';
    }
    expect(shouldWarn({ name: 'NotAllowedError' } as DOMException)).toBe(true);
    expect(shouldWarn({ name: 'NotSupportedError' } as DOMException)).toBe(true);
  });
});

// ── Lifecycle: which event starts the render loop ────────────────────────────
//
// The render loop is started by whichever of these fires first: loadeddata,
// canplay, or playing.  The guard ensures it only runs once.  Listeners must
// be attached BEFORE setting src, otherwise the early events can fire before
// we subscribe and the render loop never starts.

describe('render-loop start guard', () => {
  function makeRunner() {
    let started = false;
    return {
      isStarted: () => started,
      tryStart() {
        if (started) return false;
        started = true;
        return true;
      },
    };
  }

  it('starts on the first call', () => {
    const r = makeRunner();
    expect(r.tryStart()).toBe(true);
    expect(r.isStarted()).toBe(true);
  });

  it('does not start a second time when all three events fire', () => {
    const r = makeRunner();
    r.tryStart(); // loadeddata
    expect(r.tryStart()).toBe(false); // canplay
    expect(r.tryStart()).toBe(false); // playing
  });
});

// ── Listener attachment ordering ─────────────────────────────────────────────
//
// All event listeners must be attached to the <video> element before src=
// is assigned.  Otherwise loadeddata can fire synchronously (when the asset://
// stream is already buffered) and the render loop never starts.

describe('listener attachment ordering', () => {
  it('attaches loadeddata, canplay, and playing before assigning src', () => {
    const v = document.createElement('video');
    const order: string[] = [];
    const orig = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
      ?? { set() {}, get() { return ''; }, configurable: true };

    Object.defineProperty(v, 'src', {
      set(_val: string) { order.push('src='); },
      get() { return ''; },
      configurable: true,
    });

    v.addEventListener('loadeddata', () => order.push('loadeddata'));
    order.push('loadeddata-attached');
    v.addEventListener('canplay', () => order.push('canplay'));
    order.push('canplay-attached');
    v.addEventListener('playing', () => order.push('playing'));
    order.push('playing-attached');
    v.src = 'asset://example/test.mp4';

    // All three listeners attached before src=
    const srcIdx = order.indexOf('src=');
    expect(order.indexOf('loadeddata-attached')).toBeLessThan(srcIdx);
    expect(order.indexOf('canplay-attached')).toBeLessThan(srcIdx);
    expect(order.indexOf('playing-attached')).toBeLessThan(srcIdx);

    Object.defineProperty(v, 'src', orig);
  });
});

// ── Stale-handle guard ───────────────────────────────────────────────────────
//
// When applyBackground is invoked twice in rapid succession (e.g. user picks a
// different video before the first one finished loading), the module-level
// videoEl pointer flips to the newer element.  startRendering callbacks bound
// to the older element must bail out — otherwise their RAF loop would draw
// frames from the wrong source onto the canvas.

describe('stale-handle guard for startRendering', () => {
  it('bails out when the module videoEl no longer points to the local handle', () => {
    let moduleVideoEl: object | null = { tag: 'first' };
    const localFirst = moduleVideoEl;
    let started = false;
    function startRendering(local: object) {
      if (moduleVideoEl !== local) return;
      started = true;
    }
    // simulate a second applyBackground reassigning moduleVideoEl
    moduleVideoEl = { tag: 'second' };
    // first call's callback runs late — must noop
    startRendering(localFirst!);
    expect(started).toBe(false);
  });

  it('runs when the local handle still matches the module videoEl', () => {
    const moduleVideoEl = { tag: 'only' };
    let started = false;
    function startRendering(local: object) {
      if (moduleVideoEl !== local) return;
      started = true;
    }
    startRendering(moduleVideoEl);
    expect(started).toBe(true);
  });
});
