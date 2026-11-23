export type StandardAiSkin = 'chatgpt' | 'claude' | 'gemini' | 'grok';
export type AiSkin = StandardAiSkin | 'multi';
export type MessageSenderSkin = StandardAiSkin | 'custom';
export type CustomAiIconId =
  | 'sparkles'
  | 'bot'
  | 'zap'
  | 'cpu'
  | 'terminal'
  | 'globe';
export type MessageRole = 'user' | 'assistant';
export type PreviewMode = 'standard' | 'clean16x9';

export interface MessageAttachment {
  id: string;
  kind: 'image' | 'file';
  name: string;
  sizeLabel?: string;
  dataUrl?: string;
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
}

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
