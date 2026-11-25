export type StandardAiSkin = 'chatgpt' | 'claude' | 'gemini' | 'grok';
export type AiSkin = StandardAiSkin | 'multi';
export type MessageSenderSkin = StandardAiSkin | 'custom';
export type CustomAiIconId =
  | 'sparkles'
  | 'bot'
  | 'zap'
  | 'cpu'
  | 'terminal'
  | 'globe'
  | 'user'
  | 'heart'
  | 'flame'
  | 'crown'
  | 'brain'
  | 'ghost';
export type MessageRole = 'user' | 'assistant' | 'system';
export type PreviewMode = 'standard' | 'clean16x9';

export interface MessageAttachment {
  id: string;
  kind: 'image' | 'file';
  name: string;
  sizeLabel?: string;
  dataUrl?: string;
}

export type VisualEffectType = 'none' | 'red_flash' | 'cut_to_black';
export type MessageCueKind = 'typing' | 'visual_effect' | 'hold';
export type SfxPlaybackMode = 'hold_until_done' | 'duck_on_next' | 'cut_on_next';

export interface ActiveVisualEffect {
  type: 'red_flash' | 'cut_to_black';
  intensity: number;
}

export interface CameraTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  originX: number;
  originY: number;
}

export const NEUTRAL_CAMERA_TRANSFORM: CameraTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  originX: 0.5,
  originY: 0.5,
};

export interface ActiveEmojiBurst {
  id: string;
  messageId: string;
  emoji: string;
  progress: number;
  scale: number;
  opacity: number;
  offsetY: number;
  rotationDeg: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  thoughtDuration?: string;
  attachment?: MessageAttachment | null;
  senderSkin?: MessageSenderSkin;
  customSenderName?: string;
  customSenderColor?: string;
  customSenderIcon?: CustomAiIconId;
  customSenderAvatar?: string;
  systemAnimate?: boolean;
  /** Optional cue mode for script-parsed typing holds or standalone visual effects */
  cueKind?: MessageCueKind;
  /** Explicit hold duration in seconds (e.g. [TYPING...] Hold 1.5 sec or Hard cut to black) */
  holdDurationSec?: number;
  /** Extra hold beat after this message (e.g. breathing room for a following GIF overlay) */
  postHoldSec?: number;
  /** Visual effect triggered by this line or cue */
  visualEffect?: VisualEffectType;
  /** Parsed [SFX: ...] cue label from script */
  sfxCue?: string;
  /** 'auto' (fuzzy match sfxCue), 'none', or a SoundBankFile.id */
  sfxFileId?: string;
  sfxMuted?: boolean;
  sfxVolume?: number;
  /** Per-line SFX time-shift nudge in milliseconds (-1000 to +1000) */
  sfxOffsetMs?: number;
  /** Controls how the timeline & audio handle this line's SFX tail: Hold (default), Duck, or Cut */
  sfxMode?: SfxPlaybackMode;
  /** Explicit [ZOOM] camera punch-in flag from script */
  cameraZoom?: boolean;
}

export interface ThinkingSenderInfo {
  senderSkin: MessageSenderSkin;
  customSenderName?: string;
  customSenderColor?: string;
  customSenderIcon?: CustomAiIconId;
  customSenderAvatar?: string;
}

export type OverlayKind = 'text' | 'image';
export type OverlayFontFamily = 'sans' | 'display' | 'serif' | 'mono';
export type OverlayTimingMode = 'full' | 'timed';
export type OverlayTransition = 'none' | 'fade' | 'pop';

export interface StageOverlay {
  id: string;
  kind: OverlayKind;
  /** Logical 960x540 stage coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Text box styling */
  text?: string;
  fontFamily?: OverlayFontFamily;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  pillBg?: boolean;
  pillBgColor?: string;
  pillBgOpacity?: number;
  /** Image / GIF overlay properties */
  imageDataUrl?: string;
  imageName?: string;
  imageAspectRatio?: number;
  imageBorderRadius?: number;
  /** Script-generated GIF placeholder metadata */
  isGifPlaceholder?: boolean;
  placeholderLabel?: string;
  /** Optional SFX synced to overlay appearance */
  sfxCue?: string;
  sfxFileId?: string;
  sfxMuted?: boolean;
  sfxVolume?: number;
  /** Timing & transitions */
  timingMode: OverlayTimingMode;
  startSec: number;
  endSec: number;
  transition: OverlayTransition;
}

export interface SoundBankFile {
  id: string;
  name: string;
  baseName: string;
  normalized: string;
  compact: string;
  tokens: string[];
  durationSec: number;
  buffer: AudioBuffer;
}

export interface BackgroundLoopConfig {
  enabled: boolean;
  cueName: string;
  /** 'auto' (fuzzy match cueName), 'none', or a SoundBankFile.id */
  selectedFileId: string;
  /** 0.0 to 1.0 (default 0.11 = 11%) */
  volume: number;
  muted: boolean;
}

export const DEFAULT_BACKGROUND_LOOP: BackgroundLoopConfig = {
  enabled: false,
  cueName: '',
  selectedFileId: 'auto',
  volume: 0.11,
  muted: false,
};

export interface ScheduledAudioEvent {
  id: string;
  timeMs: number;
  fileId: string;
  volume: number;
  maxDurationSec?: number;
  duckAtMs?: number;
  duckFadeMs?: number;
  sfxMode?: SfxPlaybackMode;
  pitchRate?: number;
  isTyping?: boolean;
  sourceLabel?: string;
}

export type VideoAudioMode = 'baked' | 'silent';

export const STAGE_LOGICAL_WIDTH = 960;
export const STAGE_LOGICAL_HEIGHT = 540;

export type ThemeMode = 'light' | 'dark';
export type DeviceMode = 'desktop' | 'mobile';
export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;
export type ImageFormat = 'png' | 'jpg' | 'webp';
export type VideoQuality = '1080p' | '4k';
export type AnimationFormat = 'mp4' | 'webm' | 'gif';

export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [
  0.5, 1, 1.5, 2,
] as const;

export function getEffectivePlaybackMultiplier(speed: PlaybackSpeed): number {
  switch (speed) {
    case 0.5:
      return 0.25;
    case 1:
      return 0.5;
    case 1.5:
      return 1.0;
    case 2:
      return 1.5;
  }
}

export const CUSTOM_AI_COLORS: readonly string[] = [
  '#6366f1',
  '#10b981',
  '#ec4899',
  '#f59e0b',
  '#0ea5e9',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
] as const;

export const CUSTOM_ICON_IDS: readonly CustomAiIconId[] = [
  'sparkles',
  'bot',
  'zap',
  'cpu',
  'terminal',
  'globe',
  'user',
  'heart',
  'flame',
  'crown',
  'brain',
  'ghost',
] as const;

export interface CustomSenderPreset {
  label: string;
  name: string;
  color: string;
  icon: CustomAiIconId;
}

export const CUSTOM_SENDER_PRESETS: readonly CustomSenderPreset[] = [
  { label: 'DeepSeek', name: 'DeepSeek', color: '#4f46e5', icon: 'brain' },
  { label: 'Perplexity', name: 'Perplexity', color: '#0ea5e9', icon: 'globe' },
  { label: 'Llama', name: 'Llama 4', color: '#8b5cf6', icon: 'flame' },
  { label: 'Mom', name: 'Mom', color: '#ec4899', icon: 'heart' },
  { label: 'Boss', name: 'Boss', color: '#f59e0b', icon: 'crown' },
  { label: 'Dev', name: 'Senior Dev', color: '#10b981', icon: 'terminal' },
] as const;

export const OVERLAY_TEXT_COLORS: readonly string[] = [
  '#ffffff',
  '#0f172a',
  '#facc15',
  '#38bdf8',
  '#4ade80',
  '#fb7185',
  '#c084fc',
] as const;

export const OVERLAY_PILL_BG_COLORS: readonly string[] = [
  '#0f172a',
  '#ffffff',
  '#dc2626',
  '#2563eb',
  '#059669',
  '#7c3aed',
  '#ea580c',
] as const;

export const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-sample-1',
    role: 'user',
    content: 'Give me a clean TypeScript debounce hook and explain when to use it.',
    attachment: null,
  },
  {
    id: 'msg-sample-2',
    role: 'assistant',
    senderSkin: 'chatgpt',
    thoughtDuration: '4s',
    content: `Here is a lightweight, zero-dependency **\`useDebounce\`** hook for React and TypeScript:

\`\`\`typescript
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
\`\`\`

**Best use cases:**
- **Live search inputs** to avoid firing an API call on every keystroke.
- **Auto-saving drafts** in editors after the user pauses typing for 400–600ms.
- **Resize or filter handlers** where rapid state updates cause unnecessary re-renders.`,
  },
];

export const MULTI_AI_SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: 'multi-sample-1',
    role: 'user',
    content: 'In one sharp sentence each, what matters most when shipping a product fast?',
    attachment: null,
  },
  {
    id: 'multi-sample-2',
    role: 'assistant',
    senderSkin: 'chatgpt',
    thoughtDuration: '2s',
    content:
      'Cut scope ruthlessly until one core workflow feels effortless, then ship it to real users this week.',
  },
  {
    id: 'multi-sample-3',
    role: 'assistant',
    senderSkin: 'claude',
    thoughtDuration: '3s',
    content:
      'Clarity of intent beats feature volume—every screen should answer one obvious question without a manual.',
  },
  {
    id: 'multi-sample-4',
    role: 'assistant',
    senderSkin: 'gemini',
    thoughtDuration: '2s',
    content:
      'Tighten your feedback loop with telemetry and fast iterations so real usage—not guesses—drives v2.',
  },
  {
    id: 'multi-sample-5',
    role: 'assistant',
    senderSkin: 'grok',
    thoughtDuration: '2s',
    content:
      'Delete half the roadmap, fix the slowest click in the app, and launch before your competitors finish debating fonts.',
  },
];
