<template>
  <aside class="sidebar-left">
    <!-- Tab icons -->
    <div class="tab-rail">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: uiStore.sidebarTab === tab.id }"
        :data-tooltip="tab.label"
        @click="uiStore.setSidebarTab(tab.id as any)"
      >
        <component :is="tab.icon" />
      </button>
    </div>

    <!-- Panel content -->
    <div class="tab-panel">
      <SlidesPanel v-if="uiStore.sidebarTab === 'slides'" />
      <ImagesPanel v-else-if="uiStore.sidebarTab === 'images'" />
      <TextPanel v-else-if="uiStore.sidebarTab === 'text'" />
      <BackgroundPanel v-else-if="uiStore.sidebarTab === 'background'" />
      <AIPanel v-else-if="uiStore.sidebarTab === 'ai'" />
      <AnimationEffectsPanel v-else-if="uiStore.sidebarTab === 'animation'" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { h, watch } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useAnimationStore } from '@/stores/animation';
import SlidesPanel from './SlidesPanel.vue';
import ImagesPanel from './ImagesPanel.vue';
import TextPanel from './TextPanel.vue';
import BackgroundPanel from './BackgroundPanel.vue';
import AIPanel from './AIPanel.vue';
import AnimationEffectsPanel from '@/components/timeline/AnimationEffectsPanel.vue';

const uiStore = useUiStore();
const animStore = useAnimationStore();

// Auto-switch to animation tab when animation mode is toggled
watch(() => animStore.isAnimationMode, (on) => {
  if (on) uiStore.setSidebarTab('animation');
  else if (uiStore.sidebarTab === 'animation') uiStore.setSidebarTab('slides');
});

// SVG icon components inline
const IconSlides = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('rect', { x: '2', y: '4', width: '20', height: '16', rx: '2' }),
  h('line', { x1: '8', y1: '4', x2: '8', y2: '20' }),
]);

const IconImages = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }),
  h('circle', { cx: '8.5', cy: '8.5', r: '1.5' }),
  h('polyline', { points: '21 15 16 10 5 21' }),
]);

const IconText = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('polyline', { points: '4 7 4 4 20 4 20 7' }),
  h('line', { x1: '9', y1: '20', x2: '15', y2: '20' }),
  h('line', { x1: '12', y1: '4', x2: '12', y2: '20' }),
]);

const IconBackground = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('circle', { cx: '12', cy: '12', r: '10' }),
  h('path', { d: 'M12 2a10 10 0 0 1 0 20' }),
]);

const IconAI = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { d: 'M12 2L2 7l10 5 10-5-10-5z' }),
  h('path', { d: 'M2 17l10 5 10-5' }),
  h('path', { d: 'M2 12l10 5 10-5' }),
]);

const IconFonts = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { d: 'M4 7V4h16v3' }),
  h('path', { d: 'M9 20h6' }),
  h('path', { d: 'M12 4v16' }),
]);

const IconAnimation = () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('circle', { cx: '12', cy: '12', r: '10' }),
  h('polygon', { points: '10 8 16 12 10 16 10 8' }),
]);

const tabs = [
  { id: 'slides', label: 'Slides', icon: IconSlides },
  { id: 'images', label: 'Imagens', icon: IconImages },
  { id: 'text', label: 'Texto', icon: IconText },
  { id: 'background', label: 'Fundo', icon: IconBackground },
  { id: 'animation', label: 'Animação', icon: IconAnimation },
  { id: 'ai', label: 'IA (Gemini)', icon: IconAI },
];
</script>

<style scoped>
.sidebar-left {
  display: flex;
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-sidebar);
  overflow: hidden;
}

.tab-rail {
  width: 48px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  gap: 2px;
  align-items: center;
  position: relative;
  z-index: 10;
}

.tab-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  position: relative;
}

.tab-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.tab-btn.active {
  background: var(--accent-light);
  color: var(--accent);
}

.tab-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  background: var(--bg-surface, #1e1e2e);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  z-index: 50;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.tab-btn:hover::after {
  opacity: 1;
}

.tab-panel {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
