import { ref } from 'vue';
import { useSettingsStore } from '@/stores/settings';

// Image generation/editing model (supports image output)
const IMAGE_GEN_MODEL = 'gemini-2.5-flash-image';
// Analysis-only model (stable, multimodal input, text output)
const ANALYSIS_MODEL = 'gemini-2.0-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const isProcessing = ref(false);
export const lastError = ref('');

export function useGeminiAI() {
  const settings = useSettingsStore();

  async function callGemini(model: string, body: object): Promise<any> {
    const apiKey = settings.geminiApiKey;
    if (!apiKey) throw new Error('Chave de API não configurada. Clique em "Gemini" na toolbar para configurar.');

    const response = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(msg);
    }

    return response.json();
  }

  /** Edit an image using Gemini with image output. Returns base64 PNG. */
  async function editImage(imageBase64: string, prompt: string): Promise<string> {
    isProcessing.value = true;
    lastError.value = '';
    try {
      const data = await callGemini(IMAGE_GEN_MODEL, {
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/png', data: imageBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

      if (!imagePart) {
        // Fallback: try to get text description at least
        const textPart = parts.find((p: any) => p.text);
        if (textPart) {
          throw new Error(`Gemini retornou uma descrição mas não uma imagem: "${textPart.text.slice(0, 120)}...". Tente reformular o prompt.`);
        }
        throw new Error('Gemini não retornou uma imagem. Reformule o prompt.');
      }

      return imagePart.inlineData.data;
    } finally {
      isProcessing.value = false;
    }
  }

  /** Describe an image using Gemini (text output only). */
  async function describeImage(imageBase64: string, prompt: string): Promise<string> {
    isProcessing.value = true;
    lastError.value = '';
    try {
      const data = await callGemini(ANALYSIS_MODEL, {
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/png', data: imageBase64 } },
            { text: prompt },
          ],
        }],
      });
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } finally {
      isProcessing.value = false;
    }
  }

  /** Generate an image from a text prompt. Returns base64 PNG. */
  async function generateImage(prompt: string): Promise<string> {
    isProcessing.value = true;
    lastError.value = '';
    try {
      const data = await callGemini(IMAGE_GEN_MODEL, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      });

      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
      if (!imagePart) throw new Error('Gemini não retornou uma imagem. Tente um prompt mais descritivo.');
      return imagePart.inlineData.data;
    } finally {
      isProcessing.value = false;
    }
  }

  return { isProcessing, lastError, editImage, describeImage, generateImage };
}
