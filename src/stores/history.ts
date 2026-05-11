import { defineStore } from 'pinia';
import { ref } from 'vue';

const MAX_HISTORY = 50;

interface HistoryStack {
  past: string[];
  future: string[];
}

export const useHistoryStore = defineStore('history', () => {
  const stacks = ref<Record<string, HistoryStack>>({});

  function getStack(slideId: string): HistoryStack {
    if (!stacks.value[slideId]) {
      stacks.value[slideId] = { past: [], future: [] };
    }
    return stacks.value[slideId];
  }

  function push(slideId: string, json: string) {
    const stack = getStack(slideId);
    stack.past.push(json);
    if (stack.past.length > MAX_HISTORY) {
      stack.past.shift();
    }
    stack.future = [];
  }

  function undo(slideId: string): string | null {
    const stack = getStack(slideId);
    if (stack.past.length < 2) return null;
    const current = stack.past.pop()!;
    stack.future.unshift(current);
    return stack.past[stack.past.length - 1] ?? null;
  }

  function redo(slideId: string): string | null {
    const stack = getStack(slideId);
    if (stack.future.length === 0) return null;
    const next = stack.future.shift()!;
    stack.past.push(next);
    return next;
  }

  function canUndo(slideId: string): boolean {
    return (stacks.value[slideId]?.past.length ?? 0) >= 2;
  }

  function canRedo(slideId: string): boolean {
    return (stacks.value[slideId]?.future.length ?? 0) > 0;
  }

  function initSlide(slideId: string, initialJSON: string) {
    stacks.value[slideId] = { past: [initialJSON], future: [] };
  }

  return { push, undo, redo, canUndo, canRedo, initSlide };
});
