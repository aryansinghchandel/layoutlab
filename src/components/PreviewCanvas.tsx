import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Layers, RectangleHorizontal } from 'lucide-react';
import type {
  AiSkin,
  ChatMessage,
  CustomAiIconId,
  DeviceMode,
  MessageAttachment,
  MessageSenderSkin,
  PreviewMode,
  ThemeMode,
} from '../types';
import { renderChatGptMarkdown } from '../utils/markdown';
import {
  AI_SKINS,
  getSenderBadgeMeta,
  getSkinPalette,
  type SkinPalette,
} from '../utils/skins';
import {
  ActionCopyIcon,
  ActionRegenerateIcon,
  ActionSpeakerIcon,
  ActionThumbDownIcon,
  ActionThumbUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClaudeStarburstIcon,
  CustomAiGlyphIcon,
  DeepSearchIcon,
  GeminiSparkIcon,
  GhostChatIcon,
  GoogleGIcon,
  GrokSlashXIcon,
  HamburgerIcon,
  IosStatusBar,
  MicIcon,
  MobileMenuIcon,
  NewChatIcon,
  OpenAISwirlIcon,
  PaperclipIcon,
  PlusIcon,
  SendArrowIcon,
  ShareIcon,
  SidebarToggleIcon,
  StarIcon,
  ThinkBulbIcon,
  VoiceWaveformIcon,
} from './ChatGptIcons';
import type { CleanFontSize } from './EditorPanel';

interface PreviewCanvasProps {
  captureRef: React.RefObject<HTMLDivElement | null>;
  skin: AiSkin;
  modelLabel: string;
  theme: ThemeMode;
  device: DeviceMode;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  cleanFontSize?: CleanFontSize;
  showHeader: boolean;
  showSidebar: boolean;
  showIosStatusBar: boolean;
  showBottomBar: boolean;
  showFooterDisclaimer: boolean;
  enableThoughtPill: boolean;
  messages: ChatMessage[];
  isPlaying: boolean;
  isThinking: boolean;
  streamingMessageId: string | null;
  composerDraft: string;
  sendHighlighted: boolean;
  lockedMinHeight: number | null;
  isTheaterMode?: boolean;
}

const AssistantMessageContent = React.memo(function AssistantMessageContent({
  content,
  theme,
  senderSkin,
  textColor,
  showStreamCursor,
  isClean16x9,
  cleanFontSize,
}: {
  content: string;
  theme: ThemeMode;
  senderSkin: MessageSenderSkin;
  textColor: string;
  showStreamCursor: boolean;
  isClean16x9: boolean;
  cleanFontSize: CleanFontSize;
}) {
  const html = useMemo(
    () => renderChatGptMarkdown(content, showStreamCursor),
    [content, showStreamCursor]
  );

  return (
    <div
      className={`chatgpt-markdown ${theme === 'dark' ? 'theme-dark' : 'theme-light'} ${
        senderSkin === 'claude' ? 'skin-claude-serif' : ''
      } ${isClean16x9 ? 'clean16x9-markdown' : ''}`}
      style={{
        color: textColor,
        ...(isClean16x9
          ? {
              fontSize: `${cleanFontSize}px`,
              lineHeight: cleanFontSize >= 32 ? 1.3 : 1.38,
              letterSpacing: '-0.015em',
            }
          : {}),
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

function SkinAssistantAvatar({
  senderSkin,
  palette,
  gradientId,
  customColor,
  customIcon,
  isClean16x9 = false,
  cleanFontSize = 28,
}: {
  senderSkin: MessageSenderSkin;
  palette: SkinPalette;
  gradientId: string;
  customColor?: string;
  customIcon?: CustomAiIconId;
  isClean16x9?: boolean;
  cleanFontSize?: CleanFontSize;
}) {
  const isXL = cleanFontSize >= 32;
  const boxSize = isClean16x9 ? (isXL ? '48px' : '42px') : '28px';

  if (senderSkin === 'claude') {
    return (
      <div
        style={{
          width: boxSize,
          height: boxSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        <ClaudeStarburstIcon
          size={isClean16x9 ? (isXL ? 34 : 30) : 20}
          color="#d97757"
        />
      </div>
    );
  }

  if (senderSkin === 'gemini') {
    return (
      <div
        style={{
          width: boxSize,
          height: boxSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        <GeminiSparkIcon
          size={isClean16x9 ? (isXL ? 34 : 30) : 20}
          gradientId={gradientId}
        />
      </div>
    );
  }

  if (senderSkin === 'custom') {
    return (
      <div
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: '9999px',
          backgroundColor: customColor || '#6366f1',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        <CustomAiGlyphIcon
          icon={customIcon || 'sparkles'}
          size={isClean16x9 ? (isXL ? 25 : 22) : 15}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: boxSize,
        height: boxSize,
        borderRadius: '9999px',
        border: `1px solid ${palette.avatarBorder}`,
        backgroundColor: palette.avatarBg,
        color: palette.textPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '2px',
      }}
    >
      {senderSkin === 'grok' ? (
        <GrokSlashXIcon size={isClean16x9 ? (isXL ? 28 : 25) : 17} />
      ) : (
        <OpenAISwirlIcon size={isClean16x9 ? (isXL ? 27 : 24) : 16} />
      )}
    </div>
  );
}

function SkinActionIcons({
  senderSkin,
  mutedColor,
  isClean16x9 = false,
}: {
  senderSkin: MessageSenderSkin;
  mutedColor: string;
  isClean16x9?: boolean;
}) {
  const iconSize = isClean16x9 ? 22 : 15;
  const googleSize = isClean16x9 ? 21 : 14;
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isClean16x9 ? '18px' : '12px',
    marginTop: '10px',
    color: mutedColor,
  };

  if (senderSkin === 'gemini') {
    return (
      <div style={rowStyle}>
        <span style={{ display: 'inline-flex' }} title="Good response">
          <ActionThumbUpIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Bad response">
          <ActionThumbDownIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Regenerate">
          <ActionRegenerateIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Share">
          <ShareIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Double-check response">
          <GoogleGIcon size={googleSize} />
        </span>
      </div>
    );
  }

  if (senderSkin === 'grok') {
    return (
      <div style={rowStyle}>
        <span style={{ display: 'inline-flex' }} title="Regenerate">
          <ActionRegenerateIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Copy">
          <ActionCopyIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Share">
          <ShareIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Good response">
          <ActionThumbUpIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Bad response">
          <ActionThumbDownIcon size={iconSize} />
        </span>
      </div>
    );
  }

  if (senderSkin === 'claude' || senderSkin === 'custom') {
    return (
      <div style={rowStyle}>
        <span style={{ display: 'inline-flex' }} title="Copy">
          <ActionCopyIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Good response">
          <ActionThumbUpIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Bad response">
          <ActionThumbDownIcon size={iconSize} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Retry">
          <ActionRegenerateIcon size={iconSize} />
        </span>
      </div>
    );
  }

  return (
    <div style={rowStyle}>
      <span style={{ display: 'inline-flex' }} title="Copy">
        <ActionCopyIcon size={iconSize} />
      </span>
      <span style={{ display: 'inline-flex' }} title="Good response">
        <ActionThumbUpIcon size={iconSize} />
      </span>
      <span style={{ display: 'inline-flex' }} title="Bad response">
        <ActionThumbDownIcon size={iconSize} />
      </span>
      <span style={{ display: 'inline-flex' }} title="Read aloud">
        <ActionSpeakerIcon size={iconSize} />
      </span>
      <span style={{ display: 'inline-flex' }} title="Regenerate">
        <ActionRegenerateIcon size={iconSize} />
      </span>
      <span style={{ display: 'inline-flex' }} title="Share">
        <ShareIcon size={iconSize} />
      </span>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  palette,
  alignRight,
  isClean16x9 = false,
}: {
  attachment: MessageAttachment;
  palette: SkinPalette;
  alignRight: boolean;
  isClean16x9?: boolean;
}) {
  if (attachment.kind === 'image' && attachment.dataUrl) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: alignRight ? 'flex-end' : 'flex-start',
          marginBottom: isClean16x9 ? '10px' : '8px',
        }}
      >
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          referrerPolicy="no-referrer"
          style={{
            maxWidth: isClean16x9 ? '300px' : '240px',
            maxHeight: isClean16x9 ? '220px' : '180px',
            width: 'auto',
            height: 'auto',
            borderRadius: isClean16x9 ? '16px' : '14px',
            border: `1px solid ${palette.attachmentCardBorder}`,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: alignRight ? 'flex-end' : 'flex-start',
        marginBottom: isClean16x9 ? '10px' : '8px',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isClean16x9 ? '10px' : '8px',
          maxWidth: isClean16x9 ? '300px' : '240px',
          padding: isClean16x9 ? '10px 14px' : '8px 12px',
          borderRadius: isClean16x9 ? '12px' : '10px',
          backgroundColor: palette.attachmentCardBg,
          border: `1px solid ${palette.attachmentCardBorder}`,
          color: palette.textPrimary,
          fontSize: isClean16x9 ? '17px' : '12.5px',
          fontWeight: 500,
        }}
      >
        <svg
          width={isClean16x9 ? '18' : '15'}
          height={isClean16x9 ? '18' : '15'}
          viewBox="0 0 24 24"
          fill="none"
          stroke={palette.textSecondary}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {attachment.name}
        </span>
      </div>
    </div>
  );
}

function ThoughtPillBlock({
  duration,
  palette,
  isClean16x9 = false,
}: {
  duration: string;
  palette: SkinPalette;
  isClean16x9?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: '10px' }}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isClean16x9 ? '6px' : '5px',
          padding: isClean16x9 ? '5px 12px' : '4px 10px',
          borderRadius: isClean16x9 ? '10px' : '8px',
          backgroundColor: palette.thoughtBg,
          border: `1px solid ${palette.thoughtBorder}`,
          color: palette.thoughtText,
          fontSize: isClean16x9 ? '17px' : '12.5px',
          fontWeight: 500,
          cursor: 'pointer',
          lineHeight: 1.3,
        }}
      >
        <span>Thought for {duration.trim()}</span>
        <span
          style={{
            display: 'inline-flex',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        >
          <ChevronRightIcon size={isClean16x9 ? 16 : 12} />
        </span>
      </button>

      {expanded && (
        <div
          style={{
            marginTop: '6px',
            padding: isClean16x9 ? '10px 14px' : '8px 12px',
            borderRadius: isClean16x9 ? '10px' : '8px',
            backgroundColor: palette.thoughtBg,
            border: `1px solid ${palette.thoughtBorder}`,
            color: palette.thoughtText,
            fontSize: isClean16x9 ? '17px' : '12.5px',
            lineHeight: 1.5,
          }}
        >
          Analyzed prompt requirements, verified constraints, and structured the response cleanly.
        </div>
      )}
    </div>
  );
}

interface MemoizedMessageRowProps {
  msgId: string;
  role: ChatMessage['role'];
  content: string;
  thoughtDuration?: string;
  attachment?: MessageAttachment | null;
  senderSkin?: MessageSenderSkin;
  customSenderName?: string;
  customSenderColor?: string;
  customSenderIcon?: CustomAiIconId;
  skin: AiSkin;
  theme: ThemeMode;
  isDark: boolean;
  isMobile: boolean;
  isClean16x9: boolean;
  cleanFontSize: CleanFontSize;
  enableThoughtPill: boolean;
  isPlaying: boolean;
  isStreamingThis: boolean;
  palette: SkinPalette;
}

const MemoizedMessageRow = React.memo(function MemoizedMessageRow({
  msgId,
  role,
  content,
  thoughtDuration,
  attachment,
  senderSkin,
  customSenderName,
  customSenderColor,
  customSenderIcon,
  skin,
  theme,
  isDark,
  isMobile,
  isClean16x9,
  cleanFontSize,
  enableThoughtPill,
  isPlaying,
  isStreamingThis,
  palette,
}: MemoizedMessageRowProps) {
  const userFontSizePx = cleanFontSize - 2;

  if (role === 'user') {
    if (skin === 'claude') {
      return (
        <div
          className={isPlaying ? 'chatgpt-user-bubble-enter' : undefined}
          style={{ width: '100%' }}
        >
          {attachment && (
            <AttachmentPreview
              attachment={attachment}
              palette={palette}
              alignRight={false}
              isClean16x9={isClean16x9}
            />
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: isClean16x9 ? '16px' : '12px',
              backgroundColor: palette.userBubbleBg,
              border: `1px solid ${palette.userBubbleBorder}`,
              color: palette.textPrimary,
              borderRadius: isClean16x9 ? '20px' : '14px',
              padding: isClean16x9 ? '16px 22px' : '11px 14px',
              fontSize: isClean16x9 ? `${userFontSizePx}px` : '15px',
              lineHeight: isClean16x9 ? 1.32 : 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <div
              style={{
                width: isClean16x9 ? '42px' : '24px',
                height: isClean16x9 ? '42px' : '24px',
                borderRadius: '9999px',
                backgroundColor: isDark ? '#57544c' : '#2b2a27',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isClean16x9 ? '18px' : '11px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              U
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>{content || ' '}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={isPlaying ? 'chatgpt-user-bubble-enter' : undefined}
        style={{ width: '100%' }}
      >
        {attachment && (
          <AttachmentPreview
            attachment={attachment}
            palette={palette}
            alignRight={true}
            isClean16x9={isClean16x9}
          />
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            width: '100%',
          }}
        >
          <div
            style={{
              maxWidth: isClean16x9 ? '84%' : isMobile ? '80%' : '70%',
              backgroundColor: palette.userBubbleBg,
              border:
                skin === 'grok' || skin === 'multi'
                  ? `1px solid ${palette.userBubbleBorder}`
                  : 'none',
              color: palette.textPrimary,
              borderRadius:
                skin === 'grok'
                  ? isClean16x9
                    ? '20px'
                    : '14px'
                  : isClean16x9
                    ? '30px'
                    : '22px',
              padding: isClean16x9
                ? '16px 26px'
                : isMobile
                  ? '10px 16px'
                  : '11px 18px',
              fontSize: isClean16x9 ? `${userFontSizePx}px` : '15px',
              lineHeight: isClean16x9 ? 1.32 : 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content || ' '}
          </div>
        </div>
      </div>
    );
  }

  const effectiveSender: MessageSenderSkin =
    skin === 'multi' ? (senderSkin ?? 'chatgpt') : skin;
  const senderBadge =
    skin === 'multi'
      ? getSenderBadgeMeta(
          {
            senderSkin,
            customSenderName,
            customSenderColor,
          },
          skin,
          theme
        )
      : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: isClean16x9 ? '18px' : isMobile ? '12px' : '16px',
        width: '100%',
      }}
    >
      <SkinAssistantAvatar
        senderSkin={effectiveSender}
        palette={palette}
        gradientId={`preview-gemini-spark-${msgId}`}
        customColor={customSenderColor}
        customIcon={customSenderIcon}
        isClean16x9={isClean16x9}
        cleanFontSize={cleanFontSize}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {senderBadge && (
          <div style={{ marginBottom: isClean16x9 ? '7px' : '5px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: isClean16x9 ? '28px' : '19px',
                padding: isClean16x9 ? '0 10px' : '0 7px',
                borderRadius: isClean16x9 ? '8px' : '6px',
                backgroundColor: senderBadge.badgeBg,
                color: senderBadge.badgeText,
                border: `1px solid ${senderBadge.badgeBorder}`,
                fontSize: isClean16x9 ? '15px' : '11px',
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              {senderBadge.label}
            </span>
          </div>
        )}

        {enableThoughtPill && thoughtDuration?.trim() && (
          <ThoughtPillBlock
            duration={thoughtDuration}
            palette={palette}
            isClean16x9={isClean16x9}
          />
        )}

        <AssistantMessageContent
          content={content}
          theme={theme}
          senderSkin={effectiveSender}
          textColor={palette.textPrimary}
          showStreamCursor={isStreamingThis}
          isClean16x9={isClean16x9}
          cleanFontSize={cleanFontSize}
        />

        {!isStreamingThis && (
          <SkinActionIcons
            senderSkin={effectiveSender}
            mutedColor={palette.textMuted}
            isClean16x9={isClean16x9}
          />
        )}
      </div>
    </div>
  );
});

function InFrameSidebar({
  palette,
  skin,
}: {
  palette: SkinPalette;
  skin: AiSkin;
}) {
  const sidebarItems = [
    'Active conversation',
    'API refactor notes',
    'Release checklist',
    'UI layout brainstorm',
  ];

  return (
    <div
      style={{
        width: '196px',
        flexShrink: 0,
        backgroundColor: palette.sidebarBg,
        borderRight: `1px solid ${palette.sidebarBorder}`,
        padding: '16px 10px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px',
          color: palette.textSecondary,
        }}
      >
        <SidebarToggleIcon size={18} />
        <NewChatIcon size={18} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sidebarItems.map((label, idx) => (
          <div
            key={label}
            className={skin === 'claude' ? 'skin-claude-serif' : undefined}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: idx === 0 ? palette.pillBg : 'transparent',
              color: idx === 0 ? palette.textPrimary : palette.textSecondary,
              fontSize: '12.5px',
              fontWeight: idx === 0 ? 500 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PreviewCanvas({
  captureRef,
  skin,
  modelLabel,
  theme,
  device,
  previewMode,
  onPreviewModeChange,
  cleanFontSize = 28,
  showHeader,
  showSidebar,
  showIosStatusBar,
  showBottomBar,
  showFooterDisclaimer,
  enableThoughtPill,
  messages,
  isPlaying,
  isThinking,
  streamingMessageId,
  composerDraft,
  sendHighlighted,
  lockedMinHeight,
  isTheaterMode = false,
}: PreviewCanvasProps) {
  const isDark = theme === 'dark';
  const isClean16x9 = previewMode === 'clean16x9';
  const isMobile = !isClean16x9 && device === 'mobile';
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const feedViewportRef = useRef<HTMLDivElement | null>(null);
  const feedStackRef = useRef<HTMLDivElement | null>(null);
  const [overflowOffset, setOverflowOffset] = useState<number>(0);

  useLayoutEffect(() => {
    if (!isClean16x9) {
      setOverflowOffset(0);
      return;
    }

    const measure = () => {
      const viewport = feedViewportRef.current;
      const stack = feedStackRef.current;
      if (!viewport || !stack) return;
      const overflow = Math.max(0, stack.scrollHeight - viewport.clientHeight);
      setOverflowOffset(overflow);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => measure());
    if (feedViewportRef.current) observer.observe(feedViewportRef.current);
    if (feedStackRef.current) observer.observe(feedStackRef.current);

    return () => observer.disconnect();
  }, [
    isClean16x9,
    cleanFontSize,
    messages,
    isThinking,
    isPlaying,
    composerDraft,
    showHeader,
    showSidebar,
    showBottomBar,
    showFooterDisclaimer,
    enableThoughtPill,
  ]);

  useEffect(() => {
    if (isClean16x9 || !isPlaying || !scrollContainerRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    container.scrollTop = container.scrollHeight;
  }, [isClean16x9, isPlaying, messages, isThinking, composerDraft]);

  // Apply pure #000000 OLED Dark Mode palette automatically in 16:9 Clean Focus Dark Mode
  const palette = useMemo(() => {
    const base = getSkinPalette(skin, theme);
    if (isClean16x9 && isDark) {
      return {
        ...base,
        canvasBg: '#000000',
        userBubbleBg: '#1E1E1E',
        userBubbleBorder: '#2C2C2E',
        composerBg: '#1E1E1E',
        composerBorder: '#2C2C2E',
        avatarBg: '#1E1E1E',
        avatarBorder: '#2C2C2E',
        textPrimary: '#F3F4F6',
        textSecondary: '#A1A1AA',
        textMuted: '#71717A',
      };
    }
    return base;
  }, [skin, theme, isClean16x9, isDark]);

  const skinMeta = AI_SKINS[skin];
  const displayModel = modelLabel.trim() || skinMeta.defaultModel;
  const composerPlaceholder =
    isClean16x9 || skin === 'multi'
      ? 'Ask anything'
      : skinMeta.composerPlaceholder;
  const disclaimerText =
    isClean16x9 || skin === 'multi'
      ? 'AI can make mistakes. Check important info.'
      : skinMeta.disclaimer;
  const useTwoRowComposer =
    !isClean16x9 && (skin === 'claude' || skin === 'grok');
  const mdLineHeight = cleanFontSize >= 32 ? 1.3 : 1.38;

  return (
    <main
      ref={scrollContainerRef}
      className={`studio-scroll relative flex flex-1 flex-col items-center overflow-auto bg-[#ebeff4] px-4 py-6 sm:px-8 sm:py-8 ${
        isTheaterMode ? 'justify-center min-h-screen' : ''
      }`}
    >
      {/* Dynamic 16:9 Clean Focus font-size override synced to Layout toggle */}
      {isClean16x9 && (
        <style>{`
          .clean16x9-markdown,
          .clean16x9-markdown p,
          .clean16x9-markdown li,
          .clean16x9-markdown blockquote {
            font-size: ${cleanFontSize}px !important;
            line-height: ${mdLineHeight} !important;
          }
          .clean16x9-markdown h1 { font-size: ${cleanFontSize + 6}px !important; }
          .clean16x9-markdown h2 { font-size: ${cleanFontSize + 3}px !important; }
          .clean16x9-markdown h3 { font-size: ${cleanFontSize + 1}px !important; }
          .clean16x9-markdown pre,
          .clean16x9-markdown pre code {
            font-size: ${Math.max(20, cleanFontSize - 9)}px !important;
            line-height: 1.35 !important;
          }
          .clean16x9-markdown :not(pre) > code {
            font-size: ${Math.max(22, cleanFontSize - 6)}px !important;
          }
        `}</style>
      )}

      {/* Studio Stage Info Bar + Preview Mode Switcher (Outside Capture Area) */}
      {!isTheaterMode && (
        <div
          className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 text-xs text-slate-500"
          style={{ maxWidth: isClean16x9 ? '960px' : '760px' }}
        >
          <span>Live Preview</span>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              Preview Mode
            </span>
            <div
              role="group"
              aria-label="Preview Mode"
              className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs"
            >
              <button
                type="button"
                aria-pressed={previewMode === 'standard'}
                onClick={() => onPreviewModeChange('standard')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  previewMode === 'standard'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Layers className="h-3 w-3" aria-hidden="true" />
                <span>Standard Full UI</span>
              </button>
              <button
                type="button"
                aria-pressed={previewMode === 'clean16x9'}
                onClick={() => onPreviewModeChange('clean16x9')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  previewMode === 'clean16x9'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <RectangleHorizontal className="h-3 w-3" aria-hidden="true" />
                <span>16:9 Clean Focus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outer Presentation Shadow Wrapper (Outside Capture Target) */}
      <div
        className="flex w-full justify-center"
        style={{
          maxWidth: isClean16x9 ? '960px' : isMobile ? '390px' : '760px',
        }}
      >
        <div className="w-full overflow-hidden rounded-lg shadow-[0_18px_50px_-12px_rgba(15,23,42,0.18)]">
          {/* =================================================================
              PURE WATERMARK-FREE CAPTURE TARGET
              ================================================================= */}
          <div
            id="chatgpt-capture-frame"
            ref={captureRef}
            className={`chatgpt-preview-root ${isClean16x9 ? 'aspect-video overflow-hidden' : ''}`}
            style={{
              width: '100%',
              backgroundColor: palette.canvasBg,
              color: palette.textPrimary,
              display: 'flex',
              flexDirection: 'row',
              ...(isClean16x9
                ? {
                    aspectRatio: '16 / 9',
                    overflow: 'hidden',
                  }
                : {
                    minHeight: lockedMinHeight
                      ? `${lockedMinHeight}px`
                      : isMobile
                        ? '640px'
                        : '540px',
                  }),
              boxSizing: 'border-box',
            }}
          >
            {/* Optional In-Frame Sidebar */}
            {showSidebar && !isMobile && (
              <InFrameSidebar palette={palette} skin={skin} />
            )}

            {/* Main Chat Column */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Optional 09:41 iOS Status Bar & Top Model Header */}
              {showHeader && (
                <>
                  {isMobile && showIosStatusBar && (
                    <IosStatusBar color={palette.textPrimary} />
                  )}

                  {skin === 'claude' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: isMobile ? '48px' : '56px',
                        padding: '0 18px',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {!showSidebar && (
                          <span
                            style={{
                              color: palette.textSecondary,
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <SidebarToggleIcon size={19} />
                          </span>
                        )}
                        <div
                          className="skin-claude-serif"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: palette.textPrimary,
                            fontSize: '17px',
                            fontWeight: 500,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          <span>{displayModel}</span>
                          <span
                            style={{
                              color: palette.textMuted,
                              display: 'inline-flex',
                              marginTop: '1px',
                            }}
                          >
                            <ChevronDownIcon size={15} />
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span
                          style={{
                            color: palette.textSecondary,
                            display: 'inline-flex',
                          }}
                        >
                          <StarIcon size={17} />
                        </span>
                        <span
                          style={{
                            color: palette.textSecondary,
                            display: 'inline-flex',
                          }}
                        >
                          <ShareIcon size={17} />
                        </span>
                      </div>
                    </div>
                  ) : skin === 'gemini' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: isMobile ? '48px' : '56px',
                        padding: '0 18px',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {!showSidebar && (
                          <span
                            style={{
                              color: palette.textSecondary,
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <HamburgerIcon size={20} />
                          </span>
                        )}
                        <span
                          style={{
                            color: palette.textPrimary,
                            fontSize: '18px',
                            fontWeight: 500,
                            letterSpacing: '-0.015em',
                          }}
                        >
                          Gemini
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            backgroundColor: palette.pillBg,
                            color: palette.textSecondary,
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          <span>{displayModel}</span>
                          <ChevronDownIcon size={12} />
                        </span>
                      </div>

                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '9999px',
                          backgroundColor: '#1a73e8',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        A
                      </div>
                    </div>
                  ) : skin === 'grok' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: isMobile ? '48px' : '56px',
                        padding: '0 18px',
                        borderBottom: `1px solid ${palette.hrBg}`,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: palette.textPrimary,
                          fontSize: '17px',
                          fontWeight: 600,
                          letterSpacing: '-0.015em',
                        }}
                      >
                        <span>{displayModel}</span>
                        <span style={{ color: palette.textMuted, display: 'inline-flex' }}>
                          <ChevronDownIcon size={15} />
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{ color: palette.textSecondary, display: 'inline-flex' }}>
                          <GhostChatIcon size={19} />
                        </span>
                        <span style={{ color: palette.textSecondary, display: 'inline-flex' }}>
                          <NewChatIcon size={19} />
                        </span>
                      </div>
                    </div>
                  ) : isMobile ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: '48px',
                        padding: '0 16px',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ color: palette.textSecondary, display: 'inline-flex' }}>
                        <MobileMenuIcon size={20} />
                      </span>

                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: palette.textPrimary,
                          fontSize: '16px',
                          fontWeight: 600,
                          letterSpacing: '-0.015em',
                        }}
                      >
                        <span>{displayModel}</span>
                        <span style={{ color: palette.textMuted, display: 'inline-flex' }}>
                          <ChevronDownIcon size={15} />
                        </span>
                      </div>

                      <span style={{ color: palette.textSecondary, display: 'inline-flex' }}>
                        <NewChatIcon size={19} />
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: '56px',
                        padding: '0 18px',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {!showSidebar && (
                          <span style={{ color: palette.textSecondary, display: 'inline-flex' }}>
                            <SidebarToggleIcon size={20} />
                          </span>
                        )}

                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: palette.textPrimary,
                            fontSize: '17px',
                            fontWeight: 600,
                            letterSpacing: '-0.015em',
                          }}
                        >
                          <span>{displayModel}</span>
                          <span
                            style={{
                              color: palette.textMuted,
                              display: 'inline-flex',
                              marginTop: '2px',
                            }}
                          >
                            <ChevronDownIcon size={16} />
                          </span>
                        </div>
                      </div>

                      <span style={{ color: palette.textSecondary, display: 'inline-flex' }}>
                        <NewChatIcon size={20} />
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Conversation Messages Viewport (Clips top cleanly & slides older messages up in 16:9 Clean Focus) */}
              <div
                ref={feedViewportRef}
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: isClean16x9 ? 'hidden' : 'visible',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  ref={feedStackRef}
                  style={{
                    width: '100%',
                    maxWidth: isClean16x9 || isMobile ? '100%' : '680px',
                    margin: '0 auto',
                    padding: isClean16x9
                      ? '14px 22px'
                      : isMobile
                        ? '16px 16px 24px 16px'
                        : '22px 24px 28px 24px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: messages.length === 0 && !isThinking ? 1 : undefined,
                    gap: isClean16x9 ? '20px' : isMobile ? '22px' : '28px',
                    transform:
                      isClean16x9 && overflowOffset > 0
                        ? `translateY(-${overflowOffset}px)`
                        : 'translateY(0)',
                    transition: isClean16x9
                      ? 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)'
                      : undefined,
                    willChange: isClean16x9 ? 'transform' : undefined,
                  }}
                >
                  {messages.length === 0 && !isThinking ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px 16px',
                        textAlign: 'center',
                      }}
                    >
                      {!isPlaying && (
                        <span
                          className={skin === 'claude' ? 'skin-claude-serif' : undefined}
                          style={{
                            fontSize: isClean16x9
                              ? `${cleanFontSize + 4}px`
                              : isMobile
                                ? '22px'
                                : '26px',
                            fontWeight: skin === 'claude' ? 500 : 600,
                            letterSpacing: '-0.02em',
                            color: palette.textPrimary,
                          }}
                        >
                          {skin === 'claude'
                            ? 'How can I help you today?'
                            : skin === 'gemini'
                              ? 'Hello, how can I help?'
                              : skin === 'grok'
                                ? 'Ask Grok anything.'
                                : skin === 'multi'
                                  ? 'Ask anything.'
                                  : 'What can I help with?'}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <MemoizedMessageRow
                          key={msg.id}
                          msgId={msg.id}
                          role={msg.role}
                          content={msg.content}
                          thoughtDuration={msg.thoughtDuration}
                          attachment={msg.attachment}
                          senderSkin={msg.senderSkin}
                          customSenderName={msg.customSenderName}
                          customSenderColor={msg.customSenderColor}
                          customSenderIcon={msg.customSenderIcon}
                          skin={skin}
                          theme={theme}
                          isDark={isDark}
                          isMobile={isMobile}
                          isClean16x9={isClean16x9}
                          cleanFontSize={cleanFontSize}
                          enableThoughtPill={enableThoughtPill}
                          isPlaying={isPlaying}
                          isStreamingThis={
                            isPlaying && streamingMessageId === msg.id
                          }
                          palette={palette}
                        />
                      ))}

                      {/* Thinking Pause Indicator before AI Reply */}
                      {isPlaying && isThinking && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: isClean16x9 ? '18px' : isMobile ? '12px' : '16px',
                            width: '100%',
                          }}
                        >
                          <SkinAssistantAvatar
                            senderSkin={skin === 'multi' ? 'chatgpt' : skin}
                            palette={palette}
                            gradientId="preview-gemini-spark-thinking"
                            isClean16x9={isClean16x9}
                            cleanFontSize={cleanFontSize}
                          />
                          <span
                            className={
                              isClean16x9
                                ? 'chatgpt-thinking-dot clean16x9-dot'
                                : 'chatgpt-thinking-dot'
                            }
                            style={{
                              color:
                                skin === 'claude' ? '#d97757' : palette.textPrimary,
                            }}
                            aria-label={`${skinMeta.name} is thinking`}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Anchored Bottom Composer Bar */}
              {showBottomBar && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: isClean16x9 || isMobile ? '100%' : '680px',
                    margin: '0 auto',
                    padding: isClean16x9
                      ? showFooterDisclaimer
                        ? '4px 22px'
                        : '4px 22px 14px 22px'
                      : showFooterDisclaimer
                        ? isMobile
                          ? '4px 14px 6px 14px'
                          : '4px 24px 8px 24px'
                        : isMobile
                          ? '4px 14px 18px 14px'
                          : '4px 24px 24px 24px',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                    backgroundColor: palette.canvasBg,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  {useTwoRowComposer ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        backgroundColor: palette.composerBg,
                        border: `1px solid ${palette.composerBorder}`,
                        boxShadow: palette.composerShadow,
                        borderRadius: '18px',
                        padding: '12px 14px 10px 14px',
                      }}
                    >
                      {isPlaying && composerDraft ? (
                        <div
                          style={{
                            color: palette.textPrimary,
                            fontSize: '15px',
                            lineHeight: 1.45,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {composerDraft}
                        </div>
                      ) : (
                        <div
                          style={{
                            color: palette.textMuted,
                            fontSize: '15px',
                            lineHeight: 1.45,
                          }}
                        >
                          {composerPlaceholder}
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        {skin === 'claude' ? (
                          <span
                            style={{
                              color: palette.textSecondary,
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <PlusIcon size={18} />
                          </span>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                backgroundColor: palette.pillBg,
                                border: `1px solid ${palette.pillBorder}`,
                                color: palette.pillText,
                                fontSize: '11.5px',
                                fontWeight: 500,
                              }}
                            >
                              <DeepSearchIcon size={12} />
                              DeepSearch
                            </span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                backgroundColor: palette.pillBg,
                                border: `1px solid ${palette.pillBorder}`,
                                color: palette.pillText,
                                fontSize: '11.5px',
                                fontWeight: 500,
                              }}
                            >
                              <ThinkBulbIcon size={12} />
                              Think
                            </span>
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          {skin === 'claude' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                backgroundColor: palette.pillBg,
                                color: palette.pillText,
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              <span>{displayModel}</span>
                              <ChevronDownIcon size={11} />
                            </span>
                          )}

                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '9999px',
                              backgroundColor:
                                sendHighlighted && skin !== 'claude'
                                  ? '#10a37f'
                                  : palette.sendBtnBg,
                              color:
                                sendHighlighted && skin !== 'claude'
                                  ? '#ffffff'
                                  : palette.sendBtnFg,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transform: sendHighlighted ? 'scale(1.12)' : 'scale(1)',
                              boxShadow: sendHighlighted
                                ? skin === 'claude'
                                  ? '0 0 0 4px rgba(217, 119, 87, 0.28)'
                                  : '0 0 0 4px rgba(16, 163, 127, 0.25)'
                                : 'none',
                              transition:
                                'transform 140ms ease, background-color 140ms ease, box-shadow 140ms ease',
                            }}
                          >
                            <SendArrowIcon size={14} />
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: isClean16x9 ? '14px' : '10px',
                        backgroundColor: palette.composerBg,
                        border: `1px solid ${palette.composerBorder}`,
                        boxShadow: palette.composerShadow,
                        borderRadius: isClean16x9 ? '34px' : '26px',
                        padding: isClean16x9
                          ? '12px 14px 12px 22px'
                          : isMobile
                            ? '8px 10px 8px 14px'
                            : '10px 12px 10px 16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isClean16x9 ? '14px' : '10px',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span
                          style={{
                            color: palette.textSecondary,
                            display: 'inline-flex',
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {skin === 'gemini' ? (
                            <PlusIcon size={isClean16x9 ? 25 : 18} />
                          ) : (
                            <PaperclipIcon size={isClean16x9 ? 25 : 18} />
                          )}
                        </span>
                        {isPlaying && composerDraft ? (
                          <span
                            style={{
                              color: palette.textPrimary,
                              fontSize: isClean16x9 ? '25px' : '15px',
                              lineHeight: 1.4,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {composerDraft}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: palette.textMuted,
                              fontSize: isClean16x9 ? '25px' : '15px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {composerPlaceholder}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isClean16x9 ? '10px' : '8px',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            color: palette.textSecondary,
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px',
                          }}
                        >
                          {skin === 'gemini' ? (
                            <MicIcon size={isClean16x9 ? 25 : 18} />
                          ) : (
                            <VoiceWaveformIcon size={isClean16x9 ? 25 : 18} />
                          )}
                        </span>
                        <span
                          style={{
                            width: isClean16x9 ? '42px' : '30px',
                            height: isClean16x9 ? '42px' : '30px',
                            borderRadius: '9999px',
                            backgroundColor: sendHighlighted
                              ? '#10a37f'
                              : palette.sendBtnBg,
                            color: sendHighlighted ? '#ffffff' : palette.sendBtnFg,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: sendHighlighted ? 'scale(1.12)' : 'scale(1)',
                            boxShadow: sendHighlighted
                              ? '0 0 0 4px rgba(16, 163, 127, 0.25)'
                              : 'none',
                            transition:
                              'transform 140ms ease, background-color 140ms ease, box-shadow 140ms ease',
                          }}
                        >
                          <SendArrowIcon size={isClean16x9 ? 21 : 15} />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Footer Disclaimer */}
              {showFooterDisclaimer && (
                <div
                  style={{
                    textAlign: 'center',
                    color: palette.textMuted,
                    fontSize: isClean16x9 ? '14px' : '11.5px',
                    padding: isClean16x9
                      ? '2px 22px 12px'
                      : isMobile
                        ? '2px 14px 12px'
                        : '2px 24px 14px',
                    flexShrink: 0,
                    backgroundColor: palette.canvasBg,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  {disclaimerText}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
