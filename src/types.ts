export type AiSkin = 'chatgpt' | 'claude' | 'gemini' | 'grok';
export type MessageRole = 'user' | 'assistant';

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
}

export type ThemeMode = 'light' | 'dark';
export type DeviceMode = 'desktop' | 'mobile';
export type PlaybackSpeed = 0.5 | 1 | 2;
export type ImageFormat = 'png' | 'jpg' | 'webp';
export type VideoQuality = '1080p' | '4k';
export type AnimationFormat = 'mp4' | 'webm' | 'gif';

export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [0.5, 1, 2] as const;

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
