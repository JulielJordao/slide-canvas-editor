<template>
  <div class="text-panel">
    <div class="panel-section">
      <div class="panel-label">Adicionar Texto</div>
      <div class="text-presets">
        <button class="text-preset" @click="addText('Título', 64, '700')" style="font-size: 22px; font-weight: 700">
          Título
        </button>
        <button class="text-preset" @click="addText('Subtítulo', 36, '600')" style="font-size: 16px; font-weight: 600">
          Subtítulo
        </button>
        <button class="text-preset" @click="addText('Corpo do texto', 24, '400')" style="font-size: 13px">
          Corpo do texto
        </button>
      </div>
    </div>

    <div class="panel-section">
      <div class="section-header-row">
        <div class="panel-label">Fonte</div>
        <button class="btn-add-font" @click="uiStore.openModal('fontsModal')" title="Adicionar Fonte">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Adicionar Fonte
        </button>
      </div>
      <FontPicker @select="onFontSelect" />
    </div>
  </div>
</template>

<script setup lang="ts">
import * as fabric from 'fabric';
import FontPicker from '@/components/shared/FontPicker.vue';
import { loadGoogleFont } from '@/utils/fontLoader';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';

const uiStore = useUiStore();

const settings = useSettingsStore();

function getCanvas(): fabric.Canvas | null {
  // Access the global canvas instance via a custom event
  return (window as any).__slideEditorCanvas ?? null;
}

async function addText(text: string, fontSize: number, fontWeight: string) {
  const canvas = getCanvas();
  if (!canvas) return;

  const fontFamily = settings.recentFonts[0] ?? 'Inter';
  await loadGoogleFont(fontFamily);

  const textbox = new fabric.Textbox(text, {
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    originX: 'center',
    originY: 'center',
    width: canvas.getWidth() * 0.75,
    fontFamily,
    fontSize,
    fontWeight,
    fill: '#ffffff',
    textAlign: 'center',
  } as Partial<fabric.Textbox>);

  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.requestRenderAll();
}

async function onFontSelect(family: string) {
  const canvas = getCanvas();
  if (!canvas) return;
  await loadGoogleFont(family);
  settings.addRecentFont(family);
  const active = canvas.getActiveObject() as any;
  if (active && (active.type === 'i-text' || active.type === 'textbox')) {
    active.set('fontFamily', family);
    canvas.requestRenderAll();
  }
}
</script>

<style scoped>
.text-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.section-header-row .panel-label {
  margin-bottom: 0;
}

.btn-add-font {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}
.btn-add-font:hover { background: var(--accent-light); }

.text-presets {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.text-preset {
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-family: inherit;
}

.text-preset:hover {
  background: var(--bg-surface);
  border-color: var(--accent);
}
</style>
