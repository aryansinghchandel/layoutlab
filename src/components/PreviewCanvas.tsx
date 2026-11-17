import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AiSkin,
  ChatMessage,
  DeviceMode,
  MessageAttachment,
  ThemeMode,
} from '../types';
import { renderChatGptMarkdown } from '../utils/markdown';
import { AI_SKINS, getSkinPalette, type SkinPalette } from '../utils/skins';
import {
  ActionCopyIcon,
  ActionRegenerateIcon,
  ActionThumbDownIcon,
  ActionThumbUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClaudeStarburstIcon,
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
  SlidersIcon,
  StarIcon,
  ThinkBulbIcon,
  VoiceWaveformIcon,
} from './ChatGptIcons';

interface PreviewCanvasProps {
  captureRef: React.RefObject<HTMLDivElement | null>;
  skin: AiSkin;
  modelLabel: string;
  theme: ThemeMode;
  device: DeviceMode;
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

function AssistantMessageContent({
  content,
  theme,
  skin,
  textColor,
  showStreamCursor,
}: {
  content: string;
  theme: ThemeMode;
  skin: AiSkin;
  textColor: string;
  showStreamCursor: boolean;
}) {
  const html = useMemo(
    () => renderChatGptMarkdown(content, showStreamCursor),
    [content, showStreamCursor]
  );

  return (
    <div
      className={`chatgpt-markdown ${theme === 'dark' ? 'theme-dark' : 'theme-light'} ${
        skin === 'claude' ? 'skin-claude-serif' : ''
      }`}
      style={{ color: textColor }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function SkinAssistantAvatar({
  skin,
  palette,
}: {
  skin: AiSkin;
  palette: SkinPalette;
}) {
  if (skin === 'claude') {
    return (
      <div
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        <ClaudeStarburstIcon size={20} color="#d97757" />
      </div>
    );
  }

  if (skin === 'gemini') {
    return (
      <div
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        <GeminiSparkIcon size={20} gradientId="preview-gemini-spark" />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '9999px',
        border: `1px solid ${palette.avatarBorder}`,
        backgroundColor: palette.avatarBg,
        color: palette.textPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '1px',
      }}
    >
      {skin === 'grok' ? (
        <GrokSlashXIcon size={17} />
      ) : (
        <OpenAISwirlIcon size={16} />
      )}
    </div>
  );
}

function SkinActionIcons({
  skin,
  mutedColor,
}: {
  skin: AiSkin;
  mutedColor: string;
}) {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '10px',
    color: mutedColor,
  };

  if (skin === 'gemini') {
    return (
      <div style={rowStyle}>
        <span style={{ display: 'inline-flex' }} title="Good response">
          <ActionThumbUpIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Bad response">
          <ActionThumbDownIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Modify response">
          <SlidersIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Share">
          <ShareIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Copy">
          <ActionCopyIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Double-check response">
          <GoogleGIcon size={14} />
        </span>
      </div>
    );
  }

  if (skin === 'grok') {
    return (
      <div style={rowStyle}>
        <span style={{ display: 'inline-flex' }} title="Regenerate">
          <ActionRegenerateIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Copy">
          <ActionCopyIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Good response">
          <ActionThumbUpIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Bad response">
          <ActionThumbDownIcon size={15} />
        </span>
        <span style={{ display: 'inline-flex' }} title="Share">
          <ShareIcon size={15} />
        </span>
      </div>
    );
  }

  // ChatGPT & Claude both use Copy, Thumbs Up, Thumbs Down, Regenerate/Retry
  return (
    <div style={rowStyle}>
      <span style={{ display: 'inline-flex' }} title="Copy">
        <ActionCopyIcon size={15} />
      </span>
      <span style={{ display: 'inline-flex' }} title="Good response">
        <ActionThumbUpIcon size={15} />
      </span>
      <span style={{ display: 'inline-flex' }} title="Bad response">
        <ActionThumbDownIcon size={15} />
      </span>
      <span
        style={{ display: 'inline-flex' }}
        title={skin === 'claude' ? 'Retry' : 'Regenerate'}
      >
        <ActionRegenerateIcon size={15} />
      </span>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  palette,
  alignRight,
}: {
  attachment: MessageAttachment;
  palette: SkinPalette;
  alignRight: boolean;
}) {
  if (attachment.kind === 'image' && attachment.dataUrl) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: alignRight ? 'flex-end' : 'flex-start',
          marginBottom: '8px',
        }}
      >
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          referrerPolicy="no-referrer"
          style={{
            maxWidth: '240px',
            maxHeight: '180px',
            width: 'auto',
            height: 'auto',
            borderRadius: '14px',
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
        marginBottom: '8px',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: '240px',
          padding: '8px 12px',
          borderRadius: '10px',
          backgroundColor: palette.attachmentCardBg,
          border: `1px solid ${palette.attachmentCardBorder}`,
          color: palette.textPrimary,
          fontSize: '12.5px',
          fontWeight: 500,
        }}
      >
        <svg
          width="15"
          height="15"
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
}: {
  duration: string;
  palette: SkinPalette;
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
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '8px',
          backgroundColor: palette.thoughtBg,
          border: `1px solid ${palette.thoughtBorder}`,
          color: palette.thoughtText,
          fontSize: '12.5px',
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
          <ChevronRightIcon size={12} />
        </span>
      </button>

      {expanded && (
        <div
          style={{
            marginTop: '6px',
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: palette.thoughtBg,
            border: `1px solid ${palette.thoughtBorder}`,
            color: palette.thoughtText,
            fontSize: '12.5px',
            lineHeight: 1.5,
          }}
        >
          Analyzed prompt requirements, verified constraints, and structured the response cleanly.
        </div>
      )}
    </div>
  );
}

export function PreviewCanvas({
  captureRef,
  skin,
  modelLabel,
  theme,
  device,
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
  const isMobile = device === 'mobile';
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [isPlaying, messages, isThinking, composerDraft]);

  const palette = getSkinPalette(skin, theme);
  const skinMeta = AI_SKINS[skin];
  const displayModel = modelLabel.trim() || skinMeta.defaultModel;

  return (
    <main
      ref={scrollContainerRef}
      className={`studio-scroll relative flex flex-1 flex-col items-center overflow-auto bg-[#ebeff4] px-4 py-6 sm:px-8 sm:py-10 ${
        isTheaterMode ? 'justify-center min-h-screen' : ''
      }`}
    >
      {/* Studio Stage Info Bar (Outside Capture Area) */}
      {!isTheaterMode && (
        <div className="mb-4 flex w-full max-w-[780px] items-center justify-between text-xs text-slate-500">
          <span>Live Preview</span>
        </div>
      )}

      {/* Outer Presentation Shadow Wrapper (Outside Capture Target) */}
      <div
        className="flex w-full justify-center"
        style={{ maxWidth: isMobile ? '390px' : '760px' }}
      >
        <div className="w-full overflow-hidden rounded-lg shadow-[0_18px_50px_-12px_rgba(15,23,42,0.18)]">
          {/* =================================================================
              PURE WATERMARK-FREE CAPTURE TARGET
              ================================================================= */}
          <div
            id="chatgpt-capture-frame"
            ref={captureRef}
            className="chatgpt-preview-root"
            style={{
              width: '100%',
              backgroundColor: palette.canvasBg,
              color: palette.textPrimary,
              display: 'flex',
              flexDirection: 'column',
              minHeight: lockedMinHeight
                ? `${lockedMinHeight}px`
                : isMobile
                  ? '640px'
                  : '540px',
              boxSizing: 'border-box',
            }}
          >
            {/* Optional 09:41 iOS Status Bar */}
            {isMobile && showIosStatusBar && (
              <IosStatusBar color={palette.textPrimary} />
            )}

            {/* Skin-Specific Top Navigation Bar */}
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
                  <span
                    style={{
                      color: palette.textSecondary,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <SidebarToggleIcon size={19} />
                  </span>
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
                  <span
                    style={{
                      color: palette.textSecondary,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <HamburgerIcon size={20} />
                  </span>
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
                  <span style={{ color: palette.textSecondary, display: 'inline-flex' }}>
                    <SidebarToggleIcon size={20} />
                  </span>

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

            {/* Conversation Messages Area */}
            <div
              style={{
                flex: 1,
                width: '100%',
                maxWidth: isMobile ? '100%' : '680px',
                margin: '0 auto',
                padding: isMobile ? '16px 16px 24px 16px' : '22px 24px 28px 24px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '22px' : '28px',
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
                        fontSize: isMobile ? '22px' : '26px',
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
                            : 'What can I help with?'}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    if (msg.role === 'user') {
                      if (skin === 'claude') {
                        return (
                          <div
                            key={msg.id}
                            className={
                              isPlaying ? 'chatgpt-user-bubble-enter' : undefined
                            }
                            style={{ width: '100%' }}
                          >
                            {msg.attachment && (
                              <AttachmentPreview
                                attachment={msg.attachment}
                                palette={palette}
                                alignRight={false}
                              />
                            )}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                backgroundColor: palette.userBubbleBg,
                                border: `1px solid ${palette.userBubbleBorder}`,
                                color: palette.textPrimary,
                                borderRadius: '14px',
                                padding: '11px 14px',
                                fontSize: '15px',
                                lineHeight: 1.55,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              }}
                            >
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '9999px',
                                  backgroundColor: isDark ? '#57544c' : '#2b2a27',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                U
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {msg.content || ' '}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={
                            isPlaying ? 'chatgpt-user-bubble-enter' : undefined
                          }
                          style={{ width: '100%' }}
                        >
                          {msg.attachment && (
                            <AttachmentPreview
                              attachment={msg.attachment}
                              palette={palette}
                              alignRight={true}
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
                                maxWidth: isMobile ? '80%' : '70%',
                                backgroundColor: palette.userBubbleBg,
                                border:
                                  skin === 'grok'
                                    ? `1px solid ${palette.userBubbleBorder}`
                                    : 'none',
                                color: palette.textPrimary,
                                borderRadius: skin === 'grok' ? '14px' : '22px',
                                padding: isMobile ? '10px 16px' : '11px 18px',
                                fontSize: '15px',
                                lineHeight: 1.55,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              }}
                            >
                              {msg.content || ' '}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isStreamingThis =
                      isPlaying && streamingMessageId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: isMobile ? '12px' : '16px',
                          width: '100%',
                        }}
                      >
                        <SkinAssistantAvatar skin={skin} palette={palette} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {enableThoughtPill && msg.thoughtDuration?.trim() && (
                            <ThoughtPillBlock
                              duration={msg.thoughtDuration}
                              palette={palette}
                            />
                          )}

                          <AssistantMessageContent
                            content={msg.content}
                            theme={theme}
                            skin={skin}
                            textColor={palette.textPrimary}
                            showStreamCursor={isStreamingThis}
                          />

                          {!isStreamingThis && (
                            <SkinActionIcons
                              skin={skin}
                              mutedColor={palette.textMuted}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Thinking Pause Indicator before AI Reply */}
                  {isPlaying && isThinking && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? '12px' : '16px',
                        width: '100%',
                      }}
                    >
                      <SkinAssistantAvatar skin={skin} palette={palette} />
                      <span
                        className="chatgpt-thinking-dot"
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

            {/* Skin-Specific Bottom Composer Bar */}
            {showBottomBar && (
              <div
                style={{
                  width: '100%',
                  maxWidth: isMobile ? '100%' : '680px',
                  margin: '0 auto',
                  padding: showFooterDisclaimer
                    ? isMobile
                      ? '4px 14px 6px 14px'
                      : '4px 24px 8px 24px'
                    : isMobile
                      ? '4px 14px 18px 14px'
                      : '4px 24px 24px 24px',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                {skin === 'claude' || skin === 'grok' ? (
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
                        {skinMeta.composerPlaceholder}
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
                      gap: '10px',
                      backgroundColor: palette.composerBg,
                      border: `1px solid ${palette.composerBorder}`,
                      boxShadow: palette.composerShadow,
                      borderRadius: '26px',
                      padding: isMobile
                        ? '8px 10px 8px 14px'
                        : '10px 12px 10px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
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
                          <PlusIcon size={18} />
                        ) : (
                          <PaperclipIcon size={18} />
                        )}
                      </span>
                      {isPlaying && composerDraft ? (
                        <span
                          style={{
                            color: palette.textPrimary,
                            fontSize: '15px',
                            lineHeight: 1.45,
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
                            fontSize: '15px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {skinMeta.composerPlaceholder}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
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
                          <MicIcon size={18} />
                        ) : (
                          <VoiceWaveformIcon size={18} />
                        )}
                      </span>
                      <span
                        style={{
                          width: '30px',
                          height: '30px',
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
                        <SendArrowIcon size={15} />
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
                  fontSize: '11.5px',
                  padding: isMobile ? '2px 14px 12px' : '2px 24px 14px',
                  flexShrink: 0,
                }}
              >
                {skinMeta.disclaimer}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
