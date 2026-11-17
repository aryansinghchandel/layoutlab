import type { AiSkin, ThemeMode } from '../types';

export interface SkinMeta {
  id: AiSkin;
  name: string;
  defaultModel: string;
  presets: string[];
  composerPlaceholder: string;
  disclaimer: string;
  supportsReasoning: boolean;
}

export const AI_SKINS: Record<AiSkin, SkinMeta> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    defaultModel: 'ChatGPT',
    presets: ['ChatGPT', 'GPT-6 Instant', 'GPT-5.6 Instant', 'GPT-5.5 Instant'],
    composerPlaceholder: 'Message ChatGPT',
    disclaimer: 'ChatGPT can make mistakes. Check important info.',
    supportsReasoning: true,
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    defaultModel: 'Claude 4.5 Sonnet',
    presets: ['Claude 4.5 Sonnet', 'Claude 4.5 Opus', 'Claude 4.5 Haiku', 'Claude'],
    composerPlaceholder: 'Reply to Claude...',
    disclaimer: 'Claude can make mistakes. Please double-check responses.',
    supportsReasoning: true,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    defaultModel: '3 Pro',
    presets: ['3 Pro', '2.5 Pro', '2.5 Flash', 'Thinking'],
    composerPlaceholder: 'Ask Gemini',
    disclaimer: 'Gemini can make mistakes, so double-check it.',
    supportsReasoning: true,
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    defaultModel: 'Grok 4',
    presets: ['Grok 4', 'Grok 4 Heavy', 'Grok 3', 'Grok 3 Mini'],
    composerPlaceholder: 'Ask anything',
    disclaimer: 'Grok can make mistakes. Verify important information.',
    supportsReasoning: true,
  },
};

export const SKIN_ORDER: readonly AiSkin[] = [
  'chatgpt',
  'claude',
  'gemini',
  'grok',
] as const;

export interface SkinPalette {
  canvasBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  userBubbleBg: string;
  userBubbleBorder: string;
  avatarBg: string;
  avatarBorder: string;
  composerBg: string;
  composerBorder: string;
  composerShadow: string;
  sendBtnBg: string;
  sendBtnFg: string;
  inlineCodeBg: string;
  inlineCodeFg: string;
  blockquoteBorder: string;
  blockquoteFg: string;
  hrBg: string;
  codeBlockBorder: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  thoughtBg: string;
  thoughtBorder: string;
  thoughtText: string;
  attachmentCardBg: string;
  attachmentCardBorder: string;
}

export function getSkinPalette(skin: AiSkin, theme: ThemeMode): SkinPalette {
  const isDark = theme === 'dark';

  switch (skin) {
    case 'claude':
      return {
        canvasBg: isDark ? '#2b2a27' : '#f5f4ef',
        textPrimary: isDark ? '#eceae4' : '#1f1e1b',
        textSecondary: isDark ? '#b5b1a8' : '#5f5d55',
        textMuted: isDark ? '#97938a' : '#7c7a72',
        userBubbleBg: isDark ? '#393834' : '#eae8e1',
        userBubbleBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        avatarBg: isDark ? '#2b2a27' : '#f5f4ef',
        avatarBorder: 'transparent',
        composerBg: isDark ? '#34332f' : '#ffffff',
        composerBorder: isDark ? '#4a4842' : '#dedcd3',
        composerShadow: isDark
          ? '0 2px 10px rgba(0, 0, 0, 0.24)'
          : '0 2px 10px rgba(31, 30, 27, 0.05)',
        sendBtnBg: '#d97757',
        sendBtnFg: '#ffffff',
        inlineCodeBg: isDark ? '#3a3934' : '#e6e3da',
        inlineCodeFg: isDark ? '#eceae4' : '#1f1e1b',
        blockquoteBorder: isDark ? '#5a5850' : '#ccc9be',
        blockquoteFg: isDark ? '#c9c6bd' : '#4d4b44',
        hrBg: isDark ? '#42403a' : '#dfddd4',
        codeBlockBorder: isDark ? '#3c3b36' : '#2b2a27',
        pillBg: isDark ? '#3d3b36' : '#eeece5',
        pillBorder: isDark ? '#4c4a43' : '#dcd9cf',
        pillText: isDark ? '#d7d4cb' : '#4b4942',
        thoughtBg: isDark ? '#34332f' : '#ebe9e2',
        thoughtBorder: isDark ? '#484640' : '#dbd8ce',
        thoughtText: isDark ? '#b5b1a8' : '#5f5d55',
        attachmentCardBg: isDark ? '#393834' : '#eae8e1',
        attachmentCardBorder: isDark ? '#4a4842' : '#d8d5cc',
      };

    case 'gemini':
      return {
        canvasBg: isDark ? '#131314' : '#ffffff',
        textPrimary: isDark ? '#e3e3e3' : '#1f1f1f',
        textSecondary: isDark ? '#c4c7c5' : '#444746',
        textMuted: isDark ? '#8e918f' : '#747775',
        userBubbleBg: isDark ? '#282a2c' : '#e8f0fe',
        userBubbleBorder: 'transparent',
        avatarBg: isDark ? '#131314' : '#ffffff',
        avatarBorder: 'transparent',
        composerBg: isDark ? '#1e1f20' : '#f0f4f9',
        composerBorder: isDark ? '#333537' : '#dce3ed',
        composerShadow: 'none',
        sendBtnBg: isDark ? '#a8c7fa' : '#0b57d0',
        sendBtnFg: isDark ? '#062e6f' : '#ffffff',
        inlineCodeBg: isDark ? '#282a2c' : '#eff3f8',
        inlineCodeFg: isDark ? '#e3e3e3' : '#1f1f1f',
        blockquoteBorder: isDark ? '#444746' : '#c4c7c5',
        blockquoteFg: isDark ? '#c4c7c5' : '#444746',
        hrBg: isDark ? '#2d2f31' : '#e1e3e1',
        codeBlockBorder: isDark ? '#2c2e30' : '#242629',
        pillBg: isDark ? '#282a2c' : '#f0f4f9',
        pillBorder: isDark ? '#3c4043' : '#d2e3fc',
        pillText: isDark ? '#c4c7c5' : '#444746',
        thoughtBg: isDark ? '#1e1f20' : '#f3f6fc',
        thoughtBorder: isDark ? '#333537' : '#dfe4ec',
        thoughtText: isDark ? '#a8abb0' : '#5f6368',
        attachmentCardBg: isDark ? '#1e1f20' : '#f0f4f9',
        attachmentCardBorder: isDark ? '#333537' : '#d2e3fc',
      };

    case 'grok':
      return {
        canvasBg: isDark ? '#000000' : '#ffffff',
        textPrimary: isDark ? '#f5f5f5' : '#0f1419',
        textSecondary: isDark ? '#a1a1aa' : '#536471',
        textMuted: isDark ? '#71717a' : '#6b7280',
        userBubbleBg: isDark ? '#16181c' : '#f3f4f6',
        userBubbleBorder: isDark ? '#26292e' : '#e5e7eb',
        avatarBg: isDark ? '#000000' : '#ffffff',
        avatarBorder: isDark ? '#27272a' : '#e5e7eb',
        composerBg: isDark ? '#0a0a0a' : '#ffffff',
        composerBorder: isDark ? '#27272a' : '#e5e7eb',
        composerShadow: isDark
          ? '0 2px 8px rgba(0, 0, 0, 0.45)'
          : '0 2px 8px rgba(15, 20, 25, 0.04)',
        sendBtnBg: isDark ? '#ffffff' : '#0f1419',
        sendBtnFg: isDark ? '#000000' : '#ffffff',
        inlineCodeBg: isDark ? '#18181b' : '#f3f4f6',
        inlineCodeFg: isDark ? '#f5f5f5' : '#0f1419',
        blockquoteBorder: isDark ? '#3f3f46' : '#d1d5db',
        blockquoteFg: isDark ? '#a1a1aa' : '#4b5563',
        hrBg: isDark ? '#27272a' : '#e5e7eb',
        codeBlockBorder: isDark ? '#27272a' : '#1f2937',
        pillBg: isDark ? '#141416' : '#f3f4f6',
        pillBorder: isDark ? '#27272a' : '#e5e7eb',
        pillText: isDark ? '#d4d4d8' : '#374151',
        thoughtBg: isDark ? '#111113' : '#f3f4f6',
        thoughtBorder: isDark ? '#27272a' : '#e5e7eb',
        thoughtText: isDark ? '#a1a1aa' : '#536471',
        attachmentCardBg: isDark ? '#16181c' : '#f3f4f6',
        attachmentCardBorder: isDark ? '#27272a' : '#e5e7eb',
      };

    case 'chatgpt':
    default:
      return {
        canvasBg: isDark ? '#212121' : '#ffffff',
        textPrimary: isDark ? '#ececec' : '#0d0d0d',
        textSecondary: isDark ? '#b4b4b4' : '#5d5d5d',
        textMuted: isDark ? '#9b9b9b' : '#8e8e8e',
        userBubbleBg: isDark ? '#2f2f2f' : '#f4f4f4',
        userBubbleBorder: 'transparent',
        avatarBg: isDark ? '#212121' : '#ffffff',
        avatarBorder: isDark ? 'rgba(255, 255, 255, 0.14)' : '#e5e5e5',
        composerBg: isDark ? '#2f2f2f' : '#ffffff',
        composerBorder: isDark ? '#3e3e3e' : '#dcdcdc',
        composerShadow: isDark
          ? '0 2px 8px rgba(0, 0, 0, 0.22)'
          : '0 2px 8px rgba(0, 0, 0, 0.05)',
        sendBtnBg: isDark ? '#ffffff' : '#0d0d0d',
        sendBtnFg: isDark ? '#212121' : '#ffffff',
        inlineCodeBg: isDark ? '#2f2f2f' : '#ececec',
        inlineCodeFg: isDark ? '#ececec' : '#0d0d0d',
        blockquoteBorder: isDark ? '#4d4d4f' : '#d9d9e3',
        blockquoteFg: isDark ? '#c5c5d2' : '#4a4a4a',
        hrBg: isDark ? '#383838' : '#e5e5e5',
        codeBlockBorder: isDark ? '#2a2a2a' : '#222222',
        pillBg: isDark ? '#2f2f2f' : '#f4f4f4',
        pillBorder: isDark ? '#3e3e3e' : '#e5e5e5',
        pillText: isDark ? '#d1d5db' : '#4b5563',
        thoughtBg: isDark ? '#2a2a2a' : '#f4f4f4',
        thoughtBorder: isDark ? '#3a3a3a' : '#e5e5e5',
        thoughtText: isDark ? '#b4b4b4' : '#5d5d5d',
        attachmentCardBg: isDark ? '#2f2f2f' : '#f4f4f4',
        attachmentCardBorder: isDark ? '#3e3e3e' : '#e5e5e5',
      };
  }
}
