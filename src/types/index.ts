export interface GradientStop {
  offset: number; // 0–1
  color: string;  // hex
}

export type BackgroundType = 'solid' | 'linear-gradient' | 'radial-gradient' | 'image' | 'video';

export interface BackgroundConfig {
  type: BackgroundType;
  color?: string;
  stops?: GradientStop[];
  angle?: number;
  src?: string;
  assetId?: string;
}

// ─── Animation Types ─────────────────────────────────────────────────────────

export type AnimationEffectType =
  | 'fadeIn' | 'fadeOut'
  | 'slideInLeft' | 'slideInRight' | 'slideInTop' | 'slideInBottom'
  | 'slideOutLeft' | 'slideOutRight' | 'slideOutTop' | 'slideOutBottom'
  | 'zoomIn' | 'zoomOut'
  | 'appear' | 'disappear'
  | 'blurIn' | 'blurOut'
  | 'rotateIn' | 'rotateOut'
  | 'shake'
  | 'typewriter'
  | 'bounce'
  | 'pulse';

export type EasingType = 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';

export type BackgroundTransitionType = 'none' | 'fade' | 'wipeLeft' | 'wipeRight' | 'wipeUp' | 'wipeDown' | 'zoom';

export interface AnimationEffect {
  id: string;
  objectId: string;  // Fabric object's 'name' property
  type: AnimationEffectType;
  startMs: number;
  durationMs: number;
  easing: EasingType;
}

export interface BackgroundTransition {
  type: BackgroundTransitionType;
  durationMs: number;
}

export interface SlideAnimationData {
  durationMs: number;         // Total slide display duration
  effects: AnimationEffect[];
  outTransition: BackgroundTransition;
}

export type TimelineMode = 'continuous' | 'slide-based';

// ─── Slide ───────────────────────────────────────────────────────────────────

export interface SlideData {
  id: string;
  fabricJSON: string;
  background: BackgroundConfig;
  thumbnailDataUrl: string;
  animation: SlideAnimationData;
}

export interface AspectRatio {
  label: string;
  width: number;
  height: number;
}

export const ASPECT_RATIO_PRESETS: AspectRatio[] = [
  { label: '16:9', width: 1920, height: 1080 },
  { label: '4:3', width: 1600, height: 1200 },
  { label: '1:1', width: 1080, height: 1080 },
  { label: '9:16', width: 1080, height: 1920 },
  { label: 'A4', width: 2480, height: 3508 },
];

export const DEFAULT_SLIDE_DURATION_MS = 5000;

export const ANIMATION_EFFECT_LABELS: Record<AnimationEffectType, string> = {
  fadeIn: 'Fade In', fadeOut: 'Fade Out',
  slideInLeft: 'Slide ← Esquerda', slideInRight: 'Slide → Direita',
  slideInTop: 'Slide ↓ Cima', slideInBottom: 'Slide ↑ Baixo',
  slideOutLeft: 'Sair ← Esquerda', slideOutRight: 'Sair → Direita',
  slideOutTop: 'Sair ↑ Cima', slideOutBottom: 'Sair ↓ Baixo',
  zoomIn: 'Zoom In', zoomOut: 'Zoom Out',
  appear: 'Surgir', disappear: 'Sumir',
  blurIn: 'Desfoque Entrada', blurOut: 'Desfoque Saída',
  rotateIn: 'Girar Entrada', rotateOut: 'Girar Saída',
  shake: 'Tremer',
  typewriter: 'Máquina de Escrever',
  bounce: 'Bounce',
  pulse: 'Pulsar',
};

export const BG_TRANSITION_LABELS: Record<BackgroundTransitionType, string> = {
  none: 'Nenhuma', fade: 'Fade', wipeLeft: 'Wipe ←',
  wipeRight: 'Wipe →', wipeUp: 'Wipe ↑', wipeDown: 'Wipe ↓', zoom: 'Zoom',
};

export type SidebarTab = 'slides' | 'images' | 'text' | 'background' | 'ai' | 'animation';
export type ActiveModal = 'export' | 'aspectRatio' | 'geminiKey' | 'fontsModal' | null;
export type ToolMode = 'select' | 'text' | 'pan';
export type ObjectType = 'text' | 'image' | 'shape' | 'group' | 'none';
export type AppMode = 'design' | 'animation';

export interface FontInfo {
  family: string;
  category: string;
  variants: string[];
  files?: Record<string, string>;
}
