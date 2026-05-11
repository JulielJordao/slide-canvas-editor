import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
  const geminiApiKey = ref(localStorage.getItem('se_gemini_key') ?? '');
  const recentFonts = ref<string[]>(JSON.parse(localStorage.getItem('se_recent_fonts') ?? '[]'));
  const exportQuality = ref(0.92);
  const defaultAspectRatio = ref(localStorage.getItem('se_aspect_ratio') ?? '16:9');

  watch(geminiApiKey, (v) => localStorage.setItem('se_gemini_key', v));
  watch(recentFonts, (v) => localStorage.setItem('se_recent_fonts', JSON.stringify(v)), { deep: true });
  watch(defaultAspectRatio, (v) => localStorage.setItem('se_aspect_ratio', v));

  function addRecentFont(family: string) {
    const list = recentFonts.value.filter(f => f !== family);
    list.unshift(family);
    recentFonts.value = list.slice(0, 10);
  }

  return { geminiApiKey, recentFonts, exportQuality, defaultAspectRatio, addRecentFont };
});
