<template>
  <div class="font-picker">
    <input
      v-model="searchQuery"
      type="text"
      class="search-input"
      placeholder="Buscar fontes..."
      @focus="fetchFonts"
    />

    <div v-if="isLoading" class="loading-state">
      <span class="spinner-sm" />
      Carregando fontes...
    </div>

    <div class="font-list" ref="listRef" v-else>
      <div
        v-for="font in filteredFonts"
        :key="font.family"
        class="font-item"
        :class="{ selected: selected === font.family }"
        @click="selectFont(font.family)"
      >
        <span class="font-name" :style="fontStyle(font.family)">{{ font.family }}</span>
        <span class="font-category">{{ font.category }}</span>
      </div>

      <div v-if="filteredFonts.length === 0 && !isLoading" class="empty-fonts">
        Nenhuma fonte encontrada.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGoogleFonts } from '@/composables/useGoogleFonts';
import { loadGoogleFont } from '@/utils/fontLoader';

const emit = defineEmits<{ (e: 'select', family: string): void }>();

const { fontList, isLoading, fetchFontList, search } = useGoogleFonts();
const searchQuery = ref('');
const selected = ref('');
const loadedInView = new Set<string>();

const filteredFonts = computed(() => search(searchQuery.value));

// Lazy-load fonts as they appear in the list
watch(filteredFonts, (fonts) => {
  fonts.slice(0, 30).forEach(f => {
    if (!loadedInView.has(f.family)) {
      loadedInView.add(f.family);
      loadGoogleFont(f.family).catch(() => {});
    }
  });
}, { immediate: true });

async function fetchFonts() {
  await fetchFontList();
}

function fontStyle(family: string) {
  return loadedInView.has(family) ? { fontFamily: `"${family}", sans-serif` } : {};
}

function selectFont(family: string) {
  selected.value = family;
  emit('select', family);
}
</script>

<style scoped>
.font-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  padding: 12px 0;
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.font-list {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
}

.font-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.font-item:last-child { border-bottom: none; }
.font-item:hover { background: var(--bg-surface); }
.font-item.selected { background: var(--accent-light); }

.font-name {
  font-size: 14px;
  color: var(--text-primary);
}

.font-category {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: capitalize;
}

.empty-fonts {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
