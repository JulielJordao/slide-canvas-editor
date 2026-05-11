import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SidebarTab, ActiveModal } from '@/types';

export const useUiStore = defineStore('ui', () => {
  const sidebarTab = ref<SidebarTab>('slides');
  const activeModal = ref<ActiveModal>(null);
  const inspectorVisible = ref(true);
  const sidebarVisible = ref(true);

  function openModal(modal: ActiveModal) {
    activeModal.value = modal;
  }

  function closeModal() {
    activeModal.value = null;
  }

  function setSidebarTab(tab: SidebarTab) {
    sidebarTab.value = tab;
  }

  return {
    sidebarTab,
    activeModal,
    inspectorVisible,
    sidebarVisible,
    openModal,
    closeModal,
    setSidebarTab,
  };
});
