<template>
  <div class="fonts-panel">
    <div class="panel-section">
      <input
        v-model="query"
        class="search-input"
        placeholder="Buscar fontes..."
        @focus="init"
      />
    </div>

    <div v-if="isLoading" class="loading-state">
      <span class="spinner-sm" /> Carregando fontes...
    </div>

    <div class="font-list" v-else>
      <div
        v-for="font in displayedFonts"
        :key="font.family"
        class="font-row"
        :class="{ expanded: expanded === font.family }"
        @click="toggleExpand(font.family)"
      >
        <div class="font-header">
          <span class="font-name" :style="fontStyle(font.family)">{{ font.family }}</span>
          <span class="font-cat">{{ font.category }}</span>
        </div>
        <div v-if="expanded === font.family" class="font-actions" @click.stop>
          <div class="font-preview" :style="{ fontFamily: `'${font.family}', sans-serif`, fontSize: '22px' }">
            Abc 0123
          </div>
          <div class="action-row">
            <button class="btn btn-secondary btn-sm" @click="useFont(font.family)">
              Usar no Texto
            </button>
            <button
              class="btn btn-primary btn-sm"
              :disabled="downloading === font.family"
              @click="downloadFont(font)"
            >
              {{ downloading === font.family ? 'Baixando...' : 'Baixar .ttf' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="displayedFonts.length === 0" class="empty-state">
        Nenhuma fonte encontrada.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGoogleFonts } from '@/composables/useGoogleFonts';
import { loadGoogleFont } from '@/utils/fontLoader';
import { invoke } from '@tauri-apps/api/core';
import type { FontInfo } from '@/types';

const { isLoading, fetchFontList, search } = useGoogleFonts();
const query = ref('');
const expanded = ref<string | null>(null);
const downloading = ref<string | null>(null);
const loadedInView = new Set<string>();

const displayedFonts = computed(() => {
  const list = search(query.value);
  list.slice(0, 20).forEach(f => {
    if (!loadedInView.has(f.family)) {
      loadedInView.add(f.family);
      loadGoogleFont(f.family).catch(() => {});
    }
  });
  return list;
});

async function init() {
  await fetchFontList();
}

function fontStyle(family: string) {
  return loadedInView.has(family) ? { fontFamily: `"${family}", sans-serif` } : {};
}

function toggleExpand(family: string) {
  expanded.value = expanded.value === family ? null : family;
  if (expanded.value) {
    loadedInView.add(family);
    loadGoogleFont(family).catch(() => {});
  }
}

function useFont(family: string) {
  window.dispatchEvent(new CustomEvent('se:use-font', { detail: { family } }));
}

async function downloadFont(font: FontInfo) {
  const fileUrl = font.files?.['regular'] ?? Object.values(font.files ?? {})[0];
  if (!fileUrl) { alert('URL do arquivo não disponível.'); return; }

  downloading.value = font.family;
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error('Download falhou');
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const { save } = await import('@tauri-apps/plugin-dialog');
    const savePath = await save({
      defaultPath: `${font.family.replace(/\s+/g, '_')}-Regular.ttf`,
      filters: [{ name: 'Font', extensions: ['ttf'] }],
    });

    if (savePath) {
      await invoke('save_image', { path: savePath, data: base64 });
    }
  } catch (e: any) {
    alert('Erro ao baixar fonte: ' + e.message);
  } finally {
    downloading.value = null;
  }
}
</script>

<style scoped>
.fonts-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.search-input {
  width: 100%;
  font-size: 13px;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  padding: 16px;
}

.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.font-list {
  flex: 1;
  overflow-y: auto;
}

.font-row {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.1s;
}
.font-row:hover { background: var(--bg-elevated); }
.font-row.expanded { background: var(--bg-elevated); }

.font-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.font-name { font-size: 14px; color: var(--text-primary); }
.font-cat { font-size: 10px; color: var(--text-muted); text-transform: capitalize; }

.font-actions {
  padding: 0 12px 12px;
  border-top: 1px solid var(--border);
}

.font-preview {
  padding: 10px 0;
  color: var(--text-primary);
}

.action-row {
  display: flex;
  gap: 6px;
}

.btn-sm {
  font-size: 11px;
  padding: 4px 10px;
  flex: 1;
}

.empty-state {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
