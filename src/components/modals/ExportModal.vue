<template>
  <div class="modal-backdrop" @click.self="uiStore.closeModal()">
    <div class="modal">
      <div class="modal-title">Exportar</div>

      <!-- Image export (design mode) -->
      <template v-if="!animStore.isAnimationMode">
        <div class="field-group">
          <div class="panel-label">Formato</div>
          <div class="format-btns">
            <button
              v-for="fmt in formats"
              :key="fmt.id"
              class="format-btn"
              :class="{ active: format === fmt.id }"
              @click="format = fmt.id as 'png' | 'jpeg'"
            >{{ fmt.label }}</button>
          </div>
        </div>

        <div v-if="format === 'jpeg'" class="field-group">
          <div class="panel-label">Qualidade: {{ Math.round(settings.exportQuality * 100) }}%</div>
          <input
            type="range" min="10" max="100"
            :value="Math.round(settings.exportQuality * 100)"
            @input="settings.exportQuality = Number(($event.target as HTMLInputElement).value) / 100"
            class="range-input"
          />
        </div>

        <div class="field-group">
          <div class="panel-label">Escopo</div>
          <div class="scope-btns">
            <button class="scope-btn" :class="{ active: scope === 'current' }" @click="scope = 'current'">
              Slide atual
            </button>
            <button class="scope-btn" :class="{ active: scope === 'all' }" @click="scope = 'all'">
              Todos os slides
            </button>
          </div>
        </div>
      </template>

      <!-- Video export (animation mode) -->
      <template v-else>
        <div class="field-group">
          <div class="panel-label">Exportar animação como vídeo</div>
          <p class="export-info">
            Grava o canvas em tempo real durante a reprodução da animação
            ({{ (animStore.totalDurationMs / 1000).toFixed(1) }}s).
          </p>
        </div>
        <div class="field-group">
          <div class="panel-label">Duração do slide (s)</div>
          <input
            type="number" min="0.5" max="120" step="0.5"
            :value="(animStore.totalDurationMs / 1000).toFixed(1)"
            @change="onDurationChange"
            class="number-input"
            style="width: 80px"
          />
        </div>
      </template>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      <div v-if="successMsg" class="success-msg">{{ successMsg }}</div>

      <div class="modal-actions">
        <button class="btn btn-ghost" @click="uiStore.closeModal()">Cancelar</button>
        <button
          class="btn btn-primary"
          :disabled="isWorking"
          @click="animStore.isAnimationMode ? doExportVideo() : doExportImage()"
        >
          <span v-if="isWorking" class="spinner" />
          <template v-else>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {{ animStore.isAnimationMode ? 'Exportar .mp4' : 'Exportar' }}
          </template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { useAnimationStore } from '@/stores/animation';
import { useSlidesStore } from '@/stores/slides';
import { useExport } from '@/composables/useExport';
import * as fabric from 'fabric';

const uiStore = useUiStore();
const settings = useSettingsStore();
const animStore = useAnimationStore();
const slidesStore = useSlidesStore();

function canvasGetter(): fabric.Canvas | null {
  return (window as any).__slideEditorCanvas ?? null;
}

const exporter = useExport(canvasGetter);

const format = ref<'png' | 'jpeg'>('png');
const scope = ref<'current' | 'all'>('current');
const errorMsg = ref('');
const successMsg = ref('');
const isVideoExporting = ref(false);

const isWorking = computed(() => exporter.isExporting.value || isVideoExporting.value);

const formats = [
  { id: 'png', label: 'PNG' },
  { id: 'jpeg', label: 'JPG' },
];

function onDurationChange(e: Event) {
  const secs = Number((e.target as HTMLInputElement).value);
  slidesStore.setSlideDuration(slidesStore.activeSlide.id, Math.round(secs * 1000));
}

// ── Image export ─────────────────────────────────────────────────────────────

async function doExportImage() {
  errorMsg.value = '';
  successMsg.value = '';
  try {
    const { save, open } = await import('@tauri-apps/plugin-dialog');
    if (scope.value === 'current') {
      const path = await save({
        filters: [{ name: format.value.toUpperCase(), extensions: [format.value === 'jpeg' ? 'jpg' : 'png'] }],
        defaultPath: `slide.${format.value === 'jpeg' ? 'jpg' : 'png'}`,
      });
      if (path) {
        await exporter.exportCurrentSlide(format.value, path);
        successMsg.value = 'Exportado com sucesso!';
        setTimeout(() => uiStore.closeModal(), 1500);
      }
    } else {
      const dir = await open({ directory: true });
      if (dir && typeof dir === 'string') {
        await exporter.exportAllSlides(format.value, dir);
        successMsg.value = 'Todos os slides exportados!';
        setTimeout(() => uiStore.closeModal(), 1500);
      }
    }
  } catch (e: any) {
    errorMsg.value = e.message ?? 'Erro ao exportar';
  }
}

// ── Video export ──────────────────────────────────────────────────────────────

async function doExportVideo() {
  const canvas = canvasGetter();
  if (!canvas || isWorking.value) return;
  errorMsg.value = '';
  successMsg.value = '';

  const mimeType = MediaRecorder.isTypeSupported('video/mp4')
    ? 'video/mp4'
    : MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? 'video/webm; codecs=vp9'
      : 'video/webm';
  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      defaultPath: `animation.${ext}`,
    });
    if (!path) return;

    isVideoExporting.value = true;

    // Deselect all objects so handles don't appear in the recording.
    canvas.discardActiveObject();

    // Put the canvas in its t=0 state (objects with entry effects hidden)
    // BEFORE the recorder starts.  Otherwise the first captured frame shows
    // every object in its final position even when an entry effect should
    // bring it in later.
    //
    // seekTo(0) triggers a watcher that *restores* original positions when
    // not playing, so we must (a) let that watcher run, then (b) explicitly
    // apply t=0 to re-hide entry-effect objects, then (c) wait a paint
    // frame so captureStream sees the hidden state.
    animStore.seekTo(0);
    await nextTick();
    const applyTime = (window as any).__slideEditorApplyTime as ((ms: number) => void) | undefined;
    if (applyTime) applyTime(0);
    canvas.requestRenderAll();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const stream = (canvas.lowerCanvasEl as HTMLCanvasElement).captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mimeType });
        const buf = await blob.arrayBuffer();
        const { invoke } = await import('@tauri-apps/api/core');
        // Encode in 32KB chunks to avoid "Maximum call stack size exceeded"
        // from String.fromCharCode(...spread) on multi-MB video buffers.
        const bytes = new Uint8Array(buf);
        const CHUNK = 0x8000; // 32KB
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, i + CHUNK) as unknown as number[],
          );
        }
        const base64 = btoa(binary);
        await invoke('save_image', { path, data: base64 });
        successMsg.value = 'Vídeo exportado com sucesso!';
        setTimeout(() => uiStore.closeModal(), 1800);
      } catch (e: any) {
        errorMsg.value = e.message ?? 'Erro ao salvar vídeo';
      } finally {
        isVideoExporting.value = false;
      }
    };

    recorder.start();
    animStore.play();

    setTimeout(() => {
      animStore.stop();
      recorder.stop();
    }, animStore.totalDurationMs + 300);

  } catch (e: any) {
    isVideoExporting.value = false;
    errorMsg.value = e.message ?? 'Erro ao exportar vídeo';
  }
}
</script>

<style scoped>
.field-group {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.format-btns, .scope-btns {
  display: flex;
  gap: 6px;
}

.format-btn, .scope-btn {
  flex: 1;
  padding: 8px;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.format-btn.active, .scope-btn.active {
  border-color: var(--accent);
  background: var(--accent-light);
  color: var(--accent);
}

.export-info {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

.range-input { width: 100%; accent-color: var(--accent); }

.error-msg {
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--danger);
  margin-bottom: 12px;
}

.success-msg {
  padding: 8px 10px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--success);
  margin-bottom: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
