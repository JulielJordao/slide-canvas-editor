import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { nanoid } from 'nanoid';
import type { SlideData, BackgroundConfig, AspectRatio, SlideAnimationData, BackgroundTransition } from '@/types';
import { ASPECT_RATIO_PRESETS, DEFAULT_SLIDE_DURATION_MS } from '@/types';

function defaultAnimation(): SlideAnimationData {
  return {
    durationMs: DEFAULT_SLIDE_DURATION_MS,
    effects: [],
    outTransition: { type: 'fade', durationMs: 500 },
  };
}

function createBlankSlide(): SlideData {
  return {
    id: nanoid(),
    fabricJSON: JSON.stringify({ version: '6.0.0', objects: [] }),
    background: { type: 'solid', color: '#ffffff' },
    thumbnailDataUrl: '',
    animation: defaultAnimation(),
  };
}

export const useSlidesStore = defineStore('slides', () => {
  const slides = ref<SlideData[]>([createBlankSlide()]);
  const activeSlideIndex = ref(0);
  const aspectRatio = ref<AspectRatio>(ASPECT_RATIO_PRESETS[0]);

  const activeSlide = computed(() => slides.value[activeSlideIndex.value]);

  function addSlide(afterIndex?: number) {
    const idx = afterIndex ?? activeSlideIndex.value;
    const newSlide = createBlankSlide();
    if (slides.value[idx]) {
      newSlide.background = { ...slides.value[idx].background };
    }
    slides.value.splice(idx + 1, 0, newSlide);
    activeSlideIndex.value = idx + 1;
  }

  function duplicateSlide(index: number) {
    const src = slides.value[index];
    const copy: SlideData = {
      id: nanoid(),
      fabricJSON: src.fabricJSON,
      background: { ...src.background, stops: src.background.stops ? [...src.background.stops] : undefined },
      thumbnailDataUrl: src.thumbnailDataUrl,
      animation: {
        durationMs: src.animation.durationMs,
        effects: src.animation.effects.map(e => ({ ...e, id: nanoid() })),
        outTransition: { ...src.animation.outTransition },
      },
    };
    slides.value.splice(index + 1, 0, copy);
    activeSlideIndex.value = index + 1;
  }

  function removeSlide(id: string) {
    const idx = slides.value.findIndex(s => s.id === id);
    if (idx === -1 || slides.value.length === 1) return;
    slides.value.splice(idx, 1);
    if (activeSlideIndex.value >= slides.value.length) {
      activeSlideIndex.value = slides.value.length - 1;
    }
  }

  function reorderSlides(fromIndex: number, toIndex: number) {
    const [removed] = slides.value.splice(fromIndex, 1);
    slides.value.splice(toIndex, 0, removed);
    if (activeSlideIndex.value === fromIndex) {
      activeSlideIndex.value = toIndex;
    }
  }

  function updateActiveSlideJSON(json: string) {
    if (slides.value[activeSlideIndex.value]) {
      slides.value[activeSlideIndex.value].fabricJSON = json;
    }
  }

  function updateSlideThumbnail(id: string, dataUrl: string) {
    const slide = slides.value.find(s => s.id === id);
    if (slide) slide.thumbnailDataUrl = dataUrl;
  }

  function setBackground(config: BackgroundConfig) {
    if (slides.value[activeSlideIndex.value]) {
      slides.value[activeSlideIndex.value].background = config;
    }
  }

  function setAspectRatio(ratio: AspectRatio) {
    aspectRatio.value = ratio;
  }

  function switchSlide(index: number, currentJSON: string) {
    updateActiveSlideJSON(currentJSON);
    activeSlideIndex.value = index;
  }

  function setSlideDuration(slideId: string, durationMs: number) {
    const slide = slides.value.find(s => s.id === slideId);
    if (slide) slide.animation.durationMs = durationMs;
  }

  function setSlideOutTransition(slideId: string, transition: BackgroundTransition) {
    const slide = slides.value.find(s => s.id === slideId);
    if (slide) slide.animation.outTransition = transition;
  }

  function addAnimationEffect(slideId: string, effect: import('@/types').AnimationEffect) {
    const slide = slides.value.find(s => s.id === slideId);
    if (slide) slide.animation.effects.push(effect);
  }

  function removeAnimationEffect(slideId: string, effectId: string) {
    const slide = slides.value.find(s => s.id === slideId);
    if (slide) {
      slide.animation.effects = slide.animation.effects.filter(e => e.id !== effectId);
    }
  }

  function updateAnimationEffect(slideId: string, effectId: string, patch: Partial<import('@/types').AnimationEffect>) {
    const slide = slides.value.find(s => s.id === slideId);
    if (!slide) return;
    const idx = slide.animation.effects.findIndex(e => e.id === effectId);
    if (idx !== -1) slide.animation.effects[idx] = { ...slide.animation.effects[idx], ...patch };
  }

  function resetProject() {
    slides.value = [createBlankSlide()];
    activeSlideIndex.value = 0;
  }

  return {
    slides, activeSlideIndex, aspectRatio, activeSlide,
    addSlide, duplicateSlide, removeSlide, reorderSlides,
    updateActiveSlideJSON, updateSlideThumbnail,
    setBackground, setAspectRatio, switchSlide,
    setSlideDuration, setSlideOutTransition,
    addAnimationEffect, removeAnimationEffect, updateAnimationEffect,
    resetProject,
  };
});
