<template>
  <div class="modal-backdrop" @click.self="uiStore.closeModal()">
    <div class="modal">
      <div class="modal-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="flex-shrink:0">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        Configurar Gemini API
      </div>

      <p class="description">
        Para usar recursos de IA (edição de imagens, geração de conteúdo), você precisa de uma chave de API do Google Gemini.
        <a href="#" @click.prevent>Obtenha uma chave gratuita</a>
      </p>

      <div class="field-group">
        <label class="field-label">Chave de API</label>
        <div class="key-input-row">
          <input
            :type="showKey ? 'text' : 'password'"
            v-model="apiKey"
            placeholder="AIza..."
            class="key-input"
          />
          <button class="icon-btn" @click="showKey = !showKey" :title="showKey ? 'Ocultar' : 'Mostrar'">
            <svg v-if="showKey" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" @click="uiStore.closeModal()">Cancelar</button>
        <button class="btn btn-primary" @click="saveKey" :disabled="!apiKey.trim()">
          Salvar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';

const uiStore = useUiStore();
const settings = useSettingsStore();

const apiKey = ref(settings.geminiApiKey);
const showKey = ref(false);

function saveKey() {
  settings.geminiApiKey = apiKey.value.trim();
  uiStore.closeModal();
}
</script>

<style scoped>
.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.description {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 20px;
}

.description a {
  color: var(--accent);
  text-decoration: underline;
}

.field-group {
  margin-bottom: 20px;
}

.field-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
  font-weight: 500;
}

.key-input-row {
  display: flex;
  gap: 6px;
}

.key-input {
  flex: 1;
  font-family: monospace;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
