// @vitest-environment node
/**
 * Gemini API integration tests.
 *
 * These tests make real HTTP calls to the Google Gemini API and are
 * SKIPPED automatically when VITE_GEMINI_API_KEY is absent.
 *
 * To run them locally:
 *   1. Copy .env.example to .env
 *   2. Add your Gemini API key
 *   3. Run: bun run test
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_GEN_MODEL = 'gemini-2.5-flash-image';
const ANALYSIS_MODEL = 'gemini-2.0-flash-lite';

// In vitest node environment, loadEnv() puts vars into process.env.
// In jsdom environment, import.meta.env also works.
const API_KEY: string | undefined =
  process.env.VITE_GEMINI_API_KEY ||
  (import.meta as any).env?.VITE_GEMINI_API_KEY;
const SKIP = !API_KEY;

class QuotaError extends Error {
  constructor(msg: string) { super(msg); this.name = 'QuotaError'; }
}

async function callGemini(model: string, body: object): Promise<any> {
  const res = await fetch(`${API_BASE}/${model}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
      throw new QuotaError(msg);
    }
    throw new Error(msg);
  }
  return res.json();
}

function skipOnQuota(fn: () => Promise<void>) {
  return async () => {
    try {
      await fn();
    } catch (err: any) {
      if (err instanceof QuotaError) {
        console.warn(`[quota-limited] ${err.message.slice(0, 120)}`);
        return; // soft-pass: quota is an infrastructure limit, not a code bug
      }
      throw err;
    }
  };
}

// A tiny 1×1 solid red PNG encoded as base64 — used as a minimal test image.
const RED_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';

describe.skipIf(SKIP)('Gemini API — image generation', () => {
  it('generates an image from a simple text prompt', skipOnQuota(async () => {
    const data = await callGemini(IMAGE_GEN_MODEL, {
      contents: [{ parts: [{ text: 'A small solid red circle on a white background, minimal' }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    });

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    expect(imagePart, 'API should return an image part').toBeTruthy();
    expect(typeof imagePart.inlineData.data).toBe('string');
    expect(imagePart.inlineData.data.length).toBeGreaterThan(100);
  }), 30_000);
});

describe.skipIf(SKIP)('Gemini API — image editing', () => {
  it('edits an existing image with a text instruction', skipOnQuota(async () => {
    const data = await callGemini(IMAGE_GEN_MODEL, {
      contents: [{
        parts: [
          { inline_data: { mime_type: 'image/png', data: RED_PIXEL_PNG } },
          { text: 'Add the word "TEST" in large black letters on a white background' },
        ],
      }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    expect(imagePart, 'API should return an edited image part').toBeTruthy();
    expect(typeof imagePart.inlineData.data).toBe('string');
    expect(imagePart.inlineData.data.length).toBeGreaterThan(100);
  }), 30_000);
});

describe.skipIf(SKIP)('Gemini API — image description', () => {
  it('describes an image with a text prompt', skipOnQuota(async () => {
    const data = await callGemini(ANALYSIS_MODEL, {
      contents: [{
        parts: [
          { inline_data: { mime_type: 'image/png', data: RED_PIXEL_PNG } },
          { text: 'What color is this image? Answer in one word.' },
        ],
      }],
    });

    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toMatch(/red|unknown|color/i);
  }), 30_000);
});

describe('Gemini API — skipped notice', () => {
  it('documents how to enable integration tests', () => {
    if (SKIP) {
      console.info(
        '\n[Gemini tests] SKIPPED — set VITE_GEMINI_API_KEY in .env to run integration tests.\n' +
        'See .env.example for instructions.',
      );
    }
    expect(true).toBe(true);
  });
});
