<template>
  <div class="ai-panel">
    <div class="panel-section">
      <div class="ai-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <span>Gemini AI</span>
      </div>

      <div v-if="!hasApiKey" class="api-key-notice">
        <p>Configure sua chave de API do Gemini para usar recursos de IA.</p>
        <button class="btn btn-primary" style="width: 100%; margin-top: 8px" @click="uiStore.openModal('geminiKey')">
          Configurar chave
        </button>
      </div>

      <template v-else>
        <!-- Edit selected image -->
        <div class="ai-section">
          <div class="panel-label">Editar Imagem Selecionada</div>
          <textarea
            v-model="editPrompt"
            class="prompt-input"
            placeholder="Ex: Remova o fundo desta imagem, torne-a mais vibrante, adicione efeito vintage..."
            rows="3"
          />
          <button
            class="btn btn-primary w-full"
            :disabled="!canEditImage || gemini.isProcessing.value"
            @click="editSelectedImage"
          >
            <span v-if="gemini.isProcessing.value" class="spinner" />
            <template v-else>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar com Gemini
            </template>
          </button>
        </div>

        <div class="divider" />

        <!-- Generate image -->
        <div class="ai-section">
          <div class="panel-label">Gerar Imagem</div>
          <textarea
            v-model="generatePrompt"
            class="prompt-input"
            placeholder="Descreva a imagem que deseja gerar..."
            rows="3"
          />
          <button
            class="btn btn-secondary w-full"
            :disabled="!generatePrompt.trim() || gemini.isProcessing.value"
            @click="generateImage"
          >
            <span v-if="gemini.isProcessing.value" class="spinner" />
            <template v-else>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Gerar Imagem
            </template>
          </button>
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/stores/canvas';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useGeminiAI } from '@/composables/useGeminiAI';

const canvasStore = useCanvasStore();
const settings = useSettingsStore();
const uiStore = useUiStore();
const gemini = useGeminiAI();

const editPrompt = ref('');
const generatePrompt = ref('');
const errorMsg = ref('');

const hasApiKey = computed(() => !!settings.geminiApiKey);
const canEditImage = computed(() =>
  canvasStore.selectedObjectType === 'image' && editPrompt.value.trim().length > 0
);

function getCanvas(): fabric.Canvas | null {
  return (window as any).__slideEditorCanvas ?? null;
}

async function editSelectedImage() {
  const canvas = getCanvas();
  if (!canvas) return;
  const active = canvas.getActiveObject() as fabric.Image;
  if (!active || active.type !== 'image') return;

  errorMsg.value = '';
  try {
    const base64 = active.toDataURL({ format: 'png' }).split(',')[1];
    const result = await gemini.editImage(base64, editPrompt.value);

    const newImg = await fabric.Image.fromURL(`data:image/png;base64,${result}`);
    newImg.set({
      left: active.left,
      top: active.top,
      scaleX: active.scaleX,
      scaleY: active.scaleY,
      angle: active.angle,
    } as Partial<fabric.Image>);
    canvas.remove(active);
    canvas.add(newImg);
    canvas.setActiveObject(newImg);
    canvas.requestRenderAll();
    editPrompt.value = '';
  } catch (e: any) {
    errorMsg.value = e.message ?? 'Erro ao processar com Gemini';
  }
}

async function generateImage() {
  const canvas = getCanvas();
  if (!canvas) return;

  errorMsg.value = '';
  try {
    const result = await gemini.generateImage(generatePrompt.value);
    const img = await fabric.Image.fromURL(`data:image/png;base64,${result}`);
    const maxW = canvas.getWidth() * 0.5;
    if (img.width! > maxW) img.scaleToWidth(maxW);
    img.set({
      left: canvas.getWidth() / 2 - img.getScaledWidth() / 2,
      top: canvas.getHeight() / 2 - img.getScaledHeight() / 2,
    } as Partial<fabric.Image>);
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
    generatePrompt.value = '';
  } catch (e: any) {
    errorMsg.value = e.message ?? 'Erro ao gerar imagem';
  }
}
</script>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.w-full { width: 100%; }

.ai-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.api-key-notice p {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.ai-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-input {
  width: 100%;
  resize: vertical;
  min-height: 70px;
  font-size: 13px;
  line-height: 1.5;
  padding: 8px 10px;
}

.error-msg {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--danger);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
