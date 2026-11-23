/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Maximize2,
  Minimize2,
  Play,
  ShieldCheck,
  Smartphone,
  Square,
  WifiOff,
  X,
} from 'lucide-react';
import { LayoutLabLogo } from './components/ChatGptIcons';
import {
  type CleanFontSize,
  EditorPanel,
  type MessageSenderPatch,
} from './components/EditorPanel';
import { HomePage } from './components/HomePage';
import { PreviewCanvas } from './components/PreviewCanvas';
import {
  type AiSkin,
  type AnimationFormat,
  type ChatMessage,
  type DeviceMode,
  getEffectivePlaybackMultiplier,
  type ImageFormat,
  INITIAL_MESSAGES,
  type MessageAttachment,
  type MessageRole,
  MULTI_AI_SAMPLE_MESSAGES,
  type PlaybackSpeed,
  type PreviewMode,
  type ThemeMode,
  type VideoQuality,
} from './types';
import { exportCleanImage } from './utils/exportPng';
import {
  type AnimationExportController,
  startNativeAnimationExport,
} from './utils/exportVideo';
import { buildAnimationTimeline } from './utils/nativeCanvasRenderer';
import { AI_SKINS } from './utils/skins';
import type { ScriptTemplate } from './utils/templates';
import {
  isOfflineStudioPath,
  useOfflineStudio,
} from './utils/useOfflineStudio';

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function waitNextFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}

export default function App() {
  const [isOfflineRoute] = useState<boolean>(() => isOfflineStudioPath());
  const offlineStudio = useOfflineStudio(isOfflineRoute);
  const [installGuideOpen, setInstallGuideOpen] = useState<boolean>(false);

  const [activeView, setActiveView] = useState<'home' | 'studio'>(() =>
    isOfflineRoute ? 'studio' : 'home'
  );
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [skin, setSkin] = useState<AiSkin>('chatgpt');
  const [modelLabel, setModelLabel] = useState<string>('ChatGPT');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('standard');
  const [cleanFontSize, setCleanFontSize] = useState<CleanFontSize>(28);
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [showIosStatusBar, setShowIosStatusBar] = useState<boolean>(true);
  const [showBottomBar, setShowBottomBar] = useState<boolean>(true);
  const [showFooterDisclaimer, setShowFooterDisclaimer] =
    useState<boolean>(true);
  const [enableThoughtPill, setEnableThoughtPill] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('1080p');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportFrame, setExportFrame] = useState<number>(0);
  const [exportTotalFrames, setExportTotalFrames] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);

  // Live typing & streaming playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [displayedMessages, setDisplayedMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const [sendHighlighted, setSendHighlighted] = useState<boolean>(false);

  const captureRef = useRef<HTMLDivElement | null>(null);
  const playbackRunIdRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const speedRef = useRef<PlaybackSpeed>(1);
  const showBottomBarRef = useRef<boolean>(true);
  const isPlayingRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const isExportingRef = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const skinRef = useRef<AiSkin>(skin);
  const animationExportRef = useRef<AnimationExportController | null>(null);

  useEffect(() => {
    speedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    showBottomBarRef.current = showBottomBar;
  }, [showBottomBar]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isExportingRef.current = isExporting;
  }, [isExporting]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);

  const cancelActiveExport = useCallback(() => {
    if (animationExportRef.current) {
      animationExportRef.current.cancel();
      animationExportRef.current = null;
    }
    setIsRecording(false);
    setExportProgress(0);
    setExportFrame(0);
    setExportTotalFrames(0);
  }, []);

  const stopAnimation = useCallback(() => {
    playbackRunIdRef.current += 1;
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    cancelActiveExport();
    setIsPlaying(false);
    setIsThinking(false);
    setStreamingMessageId(null);
    setComposerDraft('');
    setSendHighlighted(false);
    setDisplayedMessages([]);
  }, [cancelActiveExport]);

  useEffect(() => {
    return () => {
      playbackRunIdRef.current += 1;
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (animationExportRef.current) {
        animationExportRef.current.cancel();
        animationExportRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isTheaterMode) return;
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setIsTheaterMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTheaterMode]);

  useEffect(() => {
    if (!installGuideOpen) return;
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setInstallGuideOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [installGuideOpen]);

  const handleSkinChange = useCallback(
    (nextSkin: AiSkin) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setSkin(nextSkin);
      setModelLabel(AI_SKINS[nextSkin].defaultModel);
      if (nextSkin === 'multi' && messagesRef.current === INITIAL_MESSAGES) {
        setMessages(MULTI_AI_SAMPLE_MESSAGES);
      } else if (
        nextSkin !== 'multi' &&
        messagesRef.current === MULTI_AI_SAMPLE_MESSAGES
      ) {
        setMessages(INITIAL_MESSAGES);
      }
    },
    [stopAnimation]
  );

  const handleModelLabelChange = useCallback(
    (value: string) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setModelLabel(value);
    },
    [stopAnimation]
  );

  const handlePreviewModeChange = useCallback(
    (nextMode: PreviewMode) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setPreviewMode(nextMode);
      if (nextMode === 'clean16x9') {
        setShowHeader(false);
        setShowSidebar(false);
        setShowFooterDisclaimer(false);
        setShowBottomBar(true);
      } else {
        setShowHeader(true);
        setShowSidebar(false);
        setShowFooterDisclaimer(true);
        setShowBottomBar(true);
      }
    },
    [stopAnimation]
  );

  const startAnimation = useCallback(
    (overrideMessages?: ChatMessage[]) => {
      const sourceMessages = overrideMessages ?? messagesRef.current;
      if (sourceMessages.length === 0 || isRecordingRef.current) {
        return;
      }

      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      const scriptSnapshot = sourceMessages.map((m) => ({ ...m }));
      const runId = playbackRunIdRef.current + 1;
      playbackRunIdRef.current = runId;

      const timeline = buildAnimationTimeline(
        scriptSnapshot,
        1.5,
        showBottomBarRef.current,
        { includeFinalHold: false }
      );

      setIsPlaying(true);
      setDisplayedMessages([]);
      setIsThinking(false);
      setStreamingMessageId(null);
      setComposerDraft('');
      setSendHighlighted(false);

      let prevTs: number | null = null;
      let accumulatedUnitMs = 0;
      let lastSignature = '';
      let prevRenderedMessages: ChatMessage[] = [];

      const tick = (now: number) => {
        if (playbackRunIdRef.current !== runId) {
          rafIdRef.current = null;
          return;
        }

        const rawDelta = prevTs === null ? 0 : Math.max(0, now - prevTs);
        prevTs = now;
        const safeDelta = Math.min(rawDelta, 28);
        accumulatedUnitMs +=
          safeDelta * getEffectivePlaybackMultiplier(speedRef.current);

        const frame = timeline.evaluateAt(accumulatedUnitMs);
        let nextStreamingId: string | null = null;
        for (let i = 0; i < frame.messages.length; i++) {
          if (frame.messages[i].isStreaming) {
            nextStreamingId = frame.messages[i].id;
            break;
          }
        }

        const lastMsg = frame.messages[frame.messages.length - 1];
        const sig = `${frame.messages.length}|${lastMsg?.id ?? ''}|${
          lastMsg?.content.length ?? 0
        }|${nextStreamingId ?? ''}|${frame.isThinking ? 1 : 0}|${
          frame.composerDraft.length
        }|${frame.sendHighlighted ? 1 : 0}`;

        if (sig !== lastSignature) {
          lastSignature = sig;

          const nextMessages: ChatMessage[] = frame.messages.map((fm, idx) => {
            const existing = prevRenderedMessages[idx];
            if (
              existing &&
              existing.id === fm.id &&
              existing.role === fm.role &&
              existing.content === fm.content &&
              existing.thoughtDuration === fm.thoughtDuration &&
              existing.attachment === fm.attachment &&
              existing.senderSkin === fm.senderSkin &&
              existing.customSenderName === fm.customSenderName &&
              existing.customSenderColor === fm.customSenderColor &&
              existing.customSenderIcon === fm.customSenderIcon
            ) {
              return existing;
            }
            return {
              id: fm.id,
              role: fm.role,
              content: fm.content,
              thoughtDuration: fm.thoughtDuration,
              attachment: fm.attachment,
              senderSkin: fm.senderSkin,
              customSenderName: fm.customSenderName,
              customSenderColor: fm.customSenderColor,
              customSenderIcon: fm.customSenderIcon,
            };
          });

          prevRenderedMessages = nextMessages;
          setDisplayedMessages(nextMessages);
          setIsThinking(frame.isThinking);
          setStreamingMessageId(nextStreamingId);
          setComposerDraft(frame.composerDraft);
          setSendHighlighted(frame.sendHighlighted);
        }

        if (accumulatedUnitMs >= timeline.totalDurationMs) {
          rafIdRef.current = null;
          setIsPlaying(false);
          setIsThinking(false);
          setStreamingMessageId(null);
          setComposerDraft('');
          setSendHighlighted(false);
          return;
        }

        rafIdRef.current = window.requestAnimationFrame(tick);
      };

      rafIdRef.current = window.requestAnimationFrame(tick);
    },
    []
  );

  const handleTogglePlayback = useCallback(() => {
    if (isPlayingRef.current) {
      stopAnimation();
    } else {
      startAnimation();
    }
  }, [startAnimation, stopAnimation]);

  const handleLaunchStudio = (targetSkin?: AiSkin) => {
    if (isPlaying || isRecording) stopAnimation();
    if (targetSkin) {
      setSkin(targetSkin);
      setModelLabel(AI_SKINS[targetSkin].defaultModel);
    }
    setIsTheaterMode(false);
    setActiveView('studio');
    window.scrollTo({ top: 0 });
  };

  const handleReturnHome = () => {
    if (isPlaying || isRecording) stopAnimation();
    setIsTheaterMode(false);
    setActiveView('home');
    window.scrollTo({ top: 0 });
  };

  const handleSelectTemplate = (template: ScriptTemplate) => {
    if (isPlaying || isRecording) stopAnimation();
    const hydrated: ChatMessage[] = template.messages.map((m, idx) => ({
      ...m,
      id: `${createMessageId()}-${idx}`,
    }));
    setSkin(template.skin);
    setModelLabel(template.modelLabel);
    setTheme(template.theme);
    setMessages(hydrated);
    setIsTheaterMode(false);
    setActiveView('studio');
    window.scrollTo({ top: 0 });
    window.setTimeout(() => {
      startAnimation(hydrated);
    }, 60);
  };

  const handleAddMessage = useCallback(
    (role: MessageRole) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      const currentSkin = skinRef.current;
      const newMessage: ChatMessage = {
        id: createMessageId(),
        role,
        senderSkin:
          role === 'assistant'
            ? currentSkin === 'multi'
              ? 'chatgpt'
              : currentSkin
            : undefined,
        thoughtDuration: role === 'assistant' ? '4s' : undefined,
        attachment: null,
        content:
          role === 'user'
            ? 'How can I optimize this further?'
            : 'Here are two clean improvements you can apply right away:\n\n- **Memoize expensive selectors** so child components avoid unnecessary renders.\n- **Batch state updates** inside event handlers for smoother UI responsiveness.',
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    [stopAnimation]
  );

  const handleUpdateMessage = useCallback(
    (id: string, content: string) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, content } : msg))
      );
    },
    [stopAnimation]
  );

  const handleUpdateMessageThought = useCallback(
    (id: string, thoughtDuration: string) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, thoughtDuration } : msg))
      );
    },
    [stopAnimation]
  );

  const handleUpdateMessageAttachment = useCallback(
    (id: string, attachment: MessageAttachment | null) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, attachment } : msg))
      );
    },
    [stopAnimation]
  );

  const handleUpdateMessageSender = useCallback(
    (id: string, patch: MessageSenderPatch) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg))
      );
    },
    [stopAnimation]
  );

  const handleToggleRole = useCallback(
    (id: string) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      const currentSkin = skinRef.current;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id
            ? {
                ...msg,
                role: msg.role === 'user' ? 'assistant' : 'user',
                senderSkin:
                  msg.role === 'user'
                    ? msg.senderSkin ??
                      (currentSkin === 'multi' ? 'chatgpt' : currentSkin)
                    : msg.senderSkin,
              }
            : msg
        )
      );
    },
    [stopAnimation]
  );

  const handleMoveMessage = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setMessages((prev) => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) {
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(index, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    [stopAnimation]
  );

  const handleDeleteMessage = useCallback(
    (id: string) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setMessages((prev) => prev.filter((msg) => msg.id !== id));
    },
    [stopAnimation]
  );

  const handleClearAll = useCallback(() => {
    if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
    setMessages([]);
  }, [stopAnimation]);

  const handleLoadSample = useCallback(() => {
    if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
    setMessages(
      skinRef.current === 'multi' ? MULTI_AI_SAMPLE_MESSAGES : INITIAL_MESSAGES
    );
  }, [stopAnimation]);

  // Dropdown 1: Download Image (PNG / JPG / WEBP of final frame)
  const handleExportImage = useCallback(
    async (format: ImageFormat) => {
      if (
        !captureRef.current ||
        isExportingRef.current ||
        isRecordingRef.current
      ) {
        return;
      }
      setExportError(null);

      if (isPlayingRef.current) {
        stopAnimation();
        await waitNextFrames(3);
      }

      if (!captureRef.current) return;

      setIsExporting(true);
      try {
        const exportDevice = previewMode === 'clean16x9' ? 'desktop' : device;
        await exportCleanImage(
          captureRef.current,
          theme,
          exportDevice,
          format,
          skin
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to export image.';
        setExportError(message);
      } finally {
        setIsExporting(false);
      }
    },
    [device, previewMode, skin, stopAnimation, theme]
  );

  // Dropdown 2 & Direct 4K: Download Animation (60 FPS MP4 / WebM / Smooth GIF via Native Canvas)
  const handleExportAnimation = useCallback(
    async (format: AnimationFormat, overrideQuality?: VideoQuality) => {
      if (
        isExportingRef.current ||
        isRecordingRef.current ||
        messagesRef.current.length === 0
      ) {
        return;
      }
      setExportError(null);

      if (isPlayingRef.current) {
        stopAnimation();
        await waitNextFrames(2);
      }

      const effectiveQuality = overrideQuality ?? videoQuality;
      if (overrideQuality) {
        setVideoQuality(overrideQuality);
      }

      setIsRecording(true);
      setExportProgress(0);
      setExportFrame(0);
      setExportTotalFrames(0);

      const controller = startNativeAnimationExport({
        messages: messagesRef.current.map((m) => ({ ...m })),
        config: {
          skin,
          modelLabel,
          theme,
          device,
          previewMode,
          cleanFontSize,
          showHeader,
          showSidebar,
          showIosStatusBar,
          showBottomBar,
          showFooterDisclaimer,
          enableThoughtPill,
        },
        speed: playbackSpeed,
        quality: effectiveQuality,
        format,
        onProgress: ({ percent, currentFrame, totalFrames }) => {
          setExportProgress(percent);
          setExportFrame(currentFrame);
          setExportTotalFrames(totalFrames);
        },
      });

      animationExportRef.current = controller;

      try {
        await controller.promise;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to export 60fps animation.';
        setExportError(message);
      } finally {
        if (animationExportRef.current === controller) {
          animationExportRef.current = null;
        }
        setIsRecording(false);
        setExportProgress(0);
        setExportFrame(0);
        setExportTotalFrames(0);
      }
    },
    [
      cleanFontSize,
      device,
      enableThoughtPill,
      modelLabel,
      playbackSpeed,
      previewMode,
      showBottomBar,
      showFooterDisclaimer,
      showHeader,
      showIosStatusBar,
      showSidebar,
      skin,
      stopAnimation,
      theme,
      videoQuality,
    ]
  );

  const handleExportAnimationClick = useCallback(
    (format: AnimationFormat) => {
      void handleExportAnimation(format);
    },
    [handleExportAnimation]
  );

  const handleExportVideoClick = useCallback(() => {
    void handleExportAnimation('mp4');
  }, [handleExportAnimation]);

  const handleInstallOfflineApp = async () => {
    if (offlineStudio.canPromptInstall) {
      const accepted = await offlineStudio.promptInstall();
      if (!accepted) {
        setInstallGuideOpen(true);
      }
      return;
    }
    setInstallGuideOpen(true);
  };

  if (activeView === 'home') {
    return (
      <HomePage
        onLaunchStudio={handleLaunchStudio}
        onSelectTemplate={handleSelectTemplate}
      />
    );
  }

  return (
    <div
      id="studioView"
      className="flex min-h-screen w-full flex-col bg-[#ebeff4] text-slate-900 lg:h-screen lg:overflow-hidden"
    >
      {/* Top Studio Header Bar (Hidden in Theater Mode) */}
      {!isTheaterMode && (
        <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-1.5 sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReturnHome}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Home</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
              <LayoutLabLogo size={22} />
              <span>LayoutLab</span>
            </div>

            {isOfflineRoute && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 whitespace-nowrap"
                title={
                  offlineStudio.swReady
                    ? 'Service worker cached for offline 4K exports'
                    : 'Preparing offline studio cache'
                }
              >
                {!offlineStudio.isOnline ? (
                  <WifiOff className="h-3 w-3 text-emerald-700" aria-hidden="true" />
                ) : (
                  <ShieldCheck
                    className="h-3.5 w-3.5 text-emerald-700"
                    aria-hidden="true"
                  />
                )}
                <span>Personal Offline Studio Unlocked</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOfflineRoute && !offlineStudio.isInstalled && (
              <button
                type="button"
                onClick={() => void handleInstallOfflineApp()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Install Offline App to Phone</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsTheaterMode(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Theater Mode</span>
            </button>
          </div>
        </header>
      )}

      {/* Floating Theater Mode Controls */}
      {isTheaterMode && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlayback}
            disabled={messages.length === 0 && !isPlaying}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur-sm transition-colors hover:bg-white disabled:opacity-45 whitespace-nowrap cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Square className="h-3 w-3 fill-current text-red-600" aria-hidden="true" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                <span>Play Animation</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsTheaterMode(false)}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Exit Theater Mode</span>
          </button>
        </div>
      )}

      {/* Main Split-Screen Studio (or Full-Screen Centered Preview in Theater Mode) */}
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {!isTheaterMode && (
          <EditorPanel
            skin={skin}
            onSkinChange={handleSkinChange}
            modelLabel={modelLabel}
            onModelLabelChange={handleModelLabelChange}
            theme={theme}
            onThemeChange={setTheme}
            device={device}
            onDeviceChange={setDevice}
            previewMode={previewMode}
            cleanFontSize={cleanFontSize}
            onCleanFontSizeChange={setCleanFontSize}
            showHeader={showHeader}
            onShowHeaderChange={setShowHeader}
            showSidebar={showSidebar}
            onShowSidebarChange={setShowSidebar}
            showIosStatusBar={showIosStatusBar}
            onShowIosStatusBarChange={setShowIosStatusBar}
            showBottomBar={showBottomBar}
            onShowBottomBarChange={setShowBottomBar}
            showFooterDisclaimer={showFooterDisclaimer}
            onShowFooterDisclaimerChange={setShowFooterDisclaimer}
            enableThoughtPill={enableThoughtPill}
            onEnableThoughtPillChange={setEnableThoughtPill}
            messages={messages}
            onAddMessage={handleAddMessage}
            onUpdateMessage={handleUpdateMessage}
            onUpdateMessageThought={handleUpdateMessageThought}
            onUpdateMessageAttachment={handleUpdateMessageAttachment}
            onUpdateMessageSender={handleUpdateMessageSender}
            onToggleRole={handleToggleRole}
            onMoveMessage={handleMoveMessage}
            onDeleteMessage={handleDeleteMessage}
            onClearAll={handleClearAll}
            onLoadSample={handleLoadSample}
            onExportImage={handleExportImage}
            onExportAnimation={handleExportAnimationClick}
            onExportVideo={handleExportVideoClick}
            onCancelExport={cancelActiveExport}
            videoQuality={videoQuality}
            onVideoQualityChange={setVideoQuality}
            isExporting={isExporting}
            isRecording={isRecording}
            exportProgress={exportProgress}
            exportFrame={exportFrame}
            exportTotalFrames={exportTotalFrames}
            exportError={exportError}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            onTogglePlayback={handleTogglePlayback}
          />
        )}

        <PreviewCanvas
          captureRef={captureRef}
          skin={skin}
          modelLabel={modelLabel}
          theme={theme}
          device={device}
          previewMode={previewMode}
          onPreviewModeChange={handlePreviewModeChange}
          cleanFontSize={cleanFontSize}
          showHeader={showHeader}
          showSidebar={showSidebar}
          showIosStatusBar={showIosStatusBar}
          showBottomBar={showBottomBar}
          showFooterDisclaimer={showFooterDisclaimer}
          enableThoughtPill={enableThoughtPill}
          messages={isPlaying ? displayedMessages : messages}
          isPlaying={isPlaying}
          isThinking={isThinking}
          streamingMessageId={streamingMessageId}
          composerDraft={composerDraft}
          sendHighlighted={sendHighlighted}
          lockedMinHeight={null}
          isTheaterMode={isTheaterMode}
        />
      </div>

      {/* Offline Install Guide Modal (iOS Safari / Manual Install Fallback) */}
      {isOfflineRoute && installGuideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="offline-install-title"
          onClick={() => setInstallGuideOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-800" aria-hidden="true" />
                <h2
                  id="offline-install-title"
                  className="text-base font-bold text-slate-900"
                >
                  Install Offline Studio
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setInstallGuideOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">
              {offlineStudio.isIOS ? (
                <>
                  <p>
                    On iPhone or iPad Safari, tap the{' '}
                    <strong className="font-semibold text-slate-900">
                      Share
                    </strong>{' '}
                    button in the browser toolbar, then select{' '}
                    <strong className="font-semibold text-slate-900">
                      Add to Home Screen
                    </strong>
                    .
                  </p>
                  <p>
                    Launch LayoutLab from your Home Screen icon to run all chat
                    animations and 4K 60fps exports 100% offline.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Open your browser menu and choose{' '}
                    <strong className="font-semibold text-slate-900">
                      Install app
                    </strong>{' '}
                    or{' '}
                    <strong className="font-semibold text-slate-900">
                      Add to Home screen
                    </strong>{' '}
                    to save this personal studio directly on your device.
                  </p>
                  <p>
                    {offlineStudio.swReady
                      ? 'Offline cache is active — animations and 4K 60fps exports work without an internet connection.'
                      : 'Service worker caching is initializing for offline 4K 60fps exports.'}
                  </p>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setInstallGuideOpen(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
