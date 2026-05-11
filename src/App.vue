<template>
  <div class="app-layout">
    <TopToolbar />
    <div class="app-body" :class="{ 'animation-mode': animStore.isAnimationMode }">
      <SidebarLeft />
      <div class="canvas-column">
        <SlideCanvas />
        <!-- Timeline panel (animation mode only) -->
        <Transition name="slide-up">
          <div
            class="timeline-area"
            v-if="animStore.isAnimationMode"
            :style="{ height: animStore.timelineHeight + 'px' }"
          >
            <TimelinePanel />
          </div>
        </Transition>
      </div>
      <div class="right-column">
        <InspectorPanel />
      </div>
    </div>

    <!-- Modals -->
    <Transition name="fade">
      <AspectRatioModal v-if="uiStore.activeModal === 'aspectRatio'" />
    </Transition>
    <Transition name="fade">
      <ExportModal v-if="uiStore.activeModal === 'export'" />
    </Transition>
    <Transition name="fade">
      <GeminiKeyModal v-if="uiStore.activeModal === 'geminiKey'" />
    </Transition>
    <Transition name="fade">
      <FontsModal v-if="uiStore.activeModal === 'fontsModal'" />
    </Transition>
    <!-- Per-zone drop overlays live inside the zone components themselves -->
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useAutoSave } from '@/composables/useAutoSave';
import TopToolbar from '@/components/toolbar/TopToolbar.vue';
import SidebarLeft from '@/components/sidebar/SidebarLeft.vue';
import SlideCanvas from '@/components/canvas/SlideCanvas.vue';
import InspectorPanel from '@/components/inspector/InspectorPanel.vue';
import TimelinePanel from '@/components/timeline/TimelinePanel.vue';
import AspectRatioModal from '@/components/modals/AspectRatioModal.vue';
import ExportModal from '@/components/modals/ExportModal.vue';
import GeminiKeyModal from '@/components/modals/GeminiKeyModal.vue';
import FontsModal from '@/components/modals/FontsModal.vue';
import { useUiStore } from '@/stores/ui';
import { useAnimationStore } from '@/stores/animation';

const uiStore = useUiStore();
const animStore = useAnimationStore();
const { loadProject } = useAutoSave();

function handleKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
  if (e.key === 'Escape') uiStore.closeModal();
  if (e.key === ' ' && animStore.isAnimationMode) {
    e.preventDefault();
    if (animStore.isPlaying) animStore.pause(); else animStore.play();
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown);
  const restored = await loadProject();
  if (restored) {
    // SlideCanvas already mounted with blank data — signal it to reload
    window.dispatchEvent(new CustomEvent('se:reload-canvas'));
  }
});
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: var(--bg-app);
  position: relative;
  overflow: hidden;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.canvas-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline-area {
  flex-shrink: 0;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border);
  /* height now comes from animStore.timelineHeight (resizable) */
}

.right-column {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  overflow: hidden;
}


/* Transitions */
.slide-up-enter-active, .slide-up-leave-active { transition: max-height 0.25s ease, opacity 0.25s; }
.slide-up-enter-from, .slide-up-leave-to { max-height: 0; opacity: 0; }
.slide-up-enter-to, .slide-up-leave-from { max-height: 400px; opacity: 1; }
</style>
