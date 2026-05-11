<template>
  <div class="effects-panel">
    <div class="panel-section">
      <div class="panel-label">Objeto Alvo</div>
      <select v-model="selectedObjectId" class="select-input">
        <option value="">— Selecionar objeto —</option>
        <option v-for="obj in objectList" :key="obj.id" :value="obj.id">
          {{ obj.label }} ({{ obj.type }})
        </option>
      </select>
    </div>

    <template v-if="selectedObjectId">
      <div class="panel-section">
        <div class="panel-label">Velocidade</div>
        <div class="speed-row">
          <button
            v-for="s in speeds"
            :key="s.value"
            class="speed-btn"
            :class="{ active: addSpeed === s.value }"
            @click="addSpeed = s.value"
          >{{ s.label }}</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="panel-section tab-section">
        <div class="tab-row">
          <button class="tab-btn" :class="{ active: activeTab === 'add' }" @click="activeTab = 'add'">
            Adicionar
          </button>
          <button class="tab-btn" :class="{ active: activeTab === 'active' }" @click="activeTab = 'active'">
            Ativos <span v-if="currentEffects.length" class="tab-badge">{{ currentEffects.length }}</span>
          </button>
        </div>
      </div>

      <!-- Aba: Adicionar efeito -->
      <div v-if="activeTab === 'add'" class="panel-section">
        <div class="effects-grid">
          <button
            v-for="(label, type) in ANIMATION_EFFECT_LABELS"
            :key="type"
            class="effect-chip"
            @click="addEffect(type as AnimationEffectType)"
          >
            {{ label }}
          </button>
        </div>
      </div>

      <!-- Aba: Efeitos ativos -->
      <div v-else-if="activeTab === 'active'" class="panel-section">
        <div v-if="currentEffects.length === 0" class="empty-msg">
          Nenhum efeito adicionado
        </div>
        <div v-else class="effect-list">
          <div v-for="effect in currentEffects" :key="effect.id" class="effect-item">
            <div class="effect-header">
              <span class="effect-name">{{ ANIMATION_EFFECT_LABELS[effect.type] }}</span>
              <button class="icon-btn tiny danger" @click="removeEffect(effect.id)">×</button>
            </div>
            <div class="effect-props">
              <div class="prop-row">
                <span class="prop-label">Velocidade</span>
                <div class="speed-row speed-row-sm">
                  <button v-for="s in speeds" :key="s.value" class="speed-btn"
                    :class="{ active: getSpeedFromMs(effect.durationMs) === s.value }"
                    @click="updateEffect(effect.id, 'durationMs', speedDurationMs[s.value])">
                    {{ s.label }}
                  </button>
                </div>
              </div>
              <div class="prop-row">
                <span class="prop-label">Início (s)</span>
                <input type="number" :value="(effect.startMs / 1000).toFixed(2)" min="0" step="0.1"
                  @change="updateEffect(effect.id, 'startMs', Math.round(Number(($event.target as HTMLInputElement).value) * 1000))"
                  class="prop-input" />
              </div>
              <div class="prop-row">
                <span class="prop-label">Duração (s)</span>
                <input type="number" :value="(effect.durationMs / 1000).toFixed(2)" min="0.1" step="0.1"
                  @change="updateEffect(effect.id, 'durationMs', Math.max(100, Math.round(Number(($event.target as HTMLInputElement).value) * 1000)))"
                  class="prop-input" />
              </div>
              <div class="prop-row">
                <span class="prop-label">Easing</span>
                <select :value="effect.easing"
                  @change="updateEffect(effect.id, 'easing', ($event.target as HTMLSelectElement).value)"
                  class="prop-select">
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In/Out</option>
                  <option value="bounce">Bounce</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="panel-section">
      <div class="panel-label">Transição de Saída</div>
      <select
        :value="slideAnimation?.outTransition?.type ?? 'none'"
        @change="onTransitionType"
        class="select-input"
      >
        <option v-for="(label, type) in BG_TRANSITION_LABELS" :key="type" :value="type">{{ label }}</option>
      </select>
      <div class="prop-row" style="margin-top: 8px">
        <span class="prop-label">Duração (s)</span>
        <input type="number"
          :value="((slideAnimation?.outTransition?.durationMs ?? 500) / 1000).toFixed(2)"
          min="0.1" max="5" step="0.1"
          @change="onTransitionDuration"
          class="prop-input" />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import * as fabric from 'fabric';
import { nanoid } from 'nanoid';
import { useAnimationStore } from '@/stores/animation';
import { useSlidesStore } from '@/stores/slides';
import { useObjectUtils } from '@/composables/useAnimation';
import {
  ANIMATION_EFFECT_LABELS, BG_TRANSITION_LABELS,
  type AnimationEffectType, type EasingType, type BackgroundTransitionType,
} from '@/types';

const animStore = useAnimationStore();
const slidesStore = useSlidesStore();

function getCanvas(): fabric.Canvas | null {
  return (window as any).__slideEditorCanvas ?? null;
}

const { getObjectList, ensureObjectIds } = useObjectUtils(getCanvas);

const selectedObjectId = ref('');
const addSpeed = ref<'slow' | 'normal' | 'fast'>('normal');
const activeTab = ref<'add' | 'active'>('add');
const objectListVersion = ref(0);

const speeds = [
  { value: 'slow' as const, label: 'Lenta' },
  { value: 'normal' as const, label: 'Normal' },
  { value: 'fast' as const, label: 'Rápida' },
];

const speedDurationMs: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 2000, normal: 1000, fast: 400,
};

// Sync with store selection — also force objectList recompute
watch(() => animStore.selectedEffectObjectId, (id) => {
  if (id) {
    objectListVersion.value++;
    selectedObjectId.value = id;
  }
});

watch(selectedObjectId, (id) => {
  animStore.selectedEffectObjectId = id;
});

// Refresh object list whenever animation mode is entered
watch(() => animStore.isAnimationMode, (on) => {
  if (on) objectListVersion.value++;
});

const slideAnimation = computed(() => slidesStore.activeSlide?.animation);

const objectList = computed(() => {
  objectListVersion.value; // invalidated by selection/mode changes
  ensureObjectIds();
  return getObjectList();
});

const currentEffects = computed(() =>
  slideAnimation.value?.effects.filter(e => e.objectId === selectedObjectId.value) ?? []
);

function addEffect(type: AnimationEffectType) {
  if (!selectedObjectId.value) return;
  slidesStore.addAnimationEffect(slidesStore.activeSlide.id, {
    id: nanoid(),
    objectId: selectedObjectId.value,
    type,
    startMs: 0,
    durationMs: speedDurationMs[addSpeed.value],
    easing: 'easeOut',
  });
}

function getSpeedFromMs(ms: number): 'slow' | 'normal' | 'fast' | null {
  if (ms === speedDurationMs.slow) return 'slow';
  if (ms === speedDurationMs.normal) return 'normal';
  if (ms === speedDurationMs.fast) return 'fast';
  return null;
}

function removeEffect(effectId: string) {
  slidesStore.removeAnimationEffect(slidesStore.activeSlide.id, effectId);
}

function updateEffect(effectId: string, key: string, value: any) {
  slidesStore.updateAnimationEffect(slidesStore.activeSlide.id, effectId, { [key]: value } as any);
}

function onTransitionType(e: Event) {
  const type = (e.target as HTMLSelectElement).value as BackgroundTransitionType;
  const dur = slideAnimation.value?.outTransition?.durationMs ?? 500;
  slidesStore.setSlideOutTransition(slidesStore.activeSlide.id, { type, durationMs: dur });
}

function onTransitionDuration(e: Event) {
  const secs = Number((e.target as HTMLInputElement).value);
  const type = slideAnimation.value?.outTransition?.type ?? 'fade';
  slidesStore.setSlideOutTransition(slidesStore.activeSlide.id, { type, durationMs: Math.round(secs * 1000) });
}

</script>

<style scoped>
.effects-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.select-input {
  width: 100%;
  font-size: 12px;
  padding: 5px 8px;
}

.effects-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.speed-row {
  display: flex;
  gap: 4px;
}

.speed-btn {
  flex: 1;
  padding: 5px 0;
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.speed-btn:hover { border-color: var(--accent); color: var(--accent); }
.speed-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }

.speed-row-sm .speed-btn { font-size: 10px; padding: 3px 0; }

.effect-chip {
  padding: 5px 6px;
  font-size: 10px;
  font-weight: 500;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
  line-height: 1.3;
}
.effect-chip:hover { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }

.effect-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }

.effect-item {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px;
}

.effect-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.effect-name { font-size: 12px; font-weight: 500; color: var(--text-primary); }

.icon-btn.tiny { width: 22px; height: 22px; border-radius: 3px; }
.icon-btn.danger { color: var(--danger); font-size: 16px; }

.effect-props { display: flex; flex-direction: column; gap: 5px; }

.prop-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.prop-label { font-size: 11px; color: var(--text-muted); flex: 1; }

.prop-input {
  width: 60px;
  font-size: 12px;
  text-align: right;
  padding: 3px 6px;
}

.prop-select { font-size: 11px; padding: 3px 4px; flex: 1; }

/* Tabs */
.tab-section { padding-bottom: 0; }

.tab-row {
  display: flex;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.tab-btn {
  flex: 1;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-elevated);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s;
}
.tab-btn + .tab-btn { border-left: 1px solid var(--border); }
.tab-btn.active { background: var(--accent); color: #fff; }
.tab-btn:not(.active):hover { background: var(--bg-panel); color: var(--text-primary); }

.tab-badge {
  background: rgba(255,255,255,0.25);
  border-radius: 8px;
  padding: 0 5px;
  font-size: 10px;
  line-height: 1.4;
}

.empty-msg {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px 0;
}
</style>
