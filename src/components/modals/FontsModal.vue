<template>
  <div class="modal-backdrop" @click.self="uiStore.closeModal()">
    <div class="fonts-modal">
      <div class="modal-header">
        <div class="modal-title">Adicionar Fonte</div>
        <button class="close-btn" @click="uiStore.closeModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-search">
        <input
          v-model="query"
          class="search-input"
          placeholder="Buscar fontes Google..."
          @focus="init"
          ref="searchInput"
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
            <div class="font-preview" :style="{ fontFamily: `'${font.family}', sans-serif`, fontSize: '24px' }">
              Abc 0123 Texto exemplo
            </div>
            <div class="action-row">
              <button class="btn btn-primary btn-sm" @click="useFont(font.family)">
                Usar no Texto Selecionado
              </button>
            </div>
          </div>
        </div>

        <div v-if="displayedFonts.length === 0" class="empty-state">
          Nenhuma fonte encontrada.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGoogleFonts } from '@/composables/useGoogleFonts';
import { loadGoogleFont } from '@/utils/fontLoader';

const uiStore = useUiStore();
const { isLoading, fetchFontList, search } = useGoogleFonts();
const query = ref('');
const expanded = ref<string | null>(null);
const loadedInView = new Set<string>();
const searchInput = ref<HTMLInputElement | null>(null);

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
  uiStore.closeModal();
}

onMounted(async () => {
  searchInput.value?.focus();
  await fetchFontList();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.fonts-modal {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 480px;
  max-width: 94vw;
  height: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s;
}
.close-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }

.modal-search {
  padding: 12px 16px;
  flex-shrink: 0;
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
  padding: 20px 16px;
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
  padding: 9px 16px;
}

.font-name { font-size: 14px; color: var(--text-primary); }
.font-cat { font-size: 10px; color: var(--text-muted); text-transform: capitalize; }

.font-actions {
  padding: 0 16px 12px;
  border-top: 1px solid var(--border);
}

.font-preview {
  padding: 12px 0;
  color: var(--text-primary);
  line-height: 1.4;
}

.action-row {
  display: flex;
  gap: 6px;
}

.btn-sm {
  font-size: 12px;
  padding: 6px 14px;
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
