/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Play, Square } from 'lucide-react';
import { LayoutLabLogo } from './components/ChatGptIcons';
import { EditorPanel } from './components/EditorPanel';
import { HomePage } from './components/HomePage';
import { PreviewCanvas } from './components/PreviewCanvas';
import {
  type AiSkin,
  type AnimationFormat,
  type ChatMessage,
  type DeviceMode,
  type ImageFormat,
  INITIAL_MESSAGES,
  type MessageAttachment,
  type MessageRole,
  type PlaybackSpeed,
  type ThemeMode,
  type VideoQuality,
} from './types';
import { exportCleanImage } from './utils/exportPng';
import {
  type AnimationExportController,
  startNativeAnimationExport,
} from './utils/exportVideo';
import { AI_SKINS } from './utils/skins';
import type { ScriptTemplate } from './utils/templates';

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tokenizeWordsPreservingWhitespace(text: string): string[] {
  const matches = text.match(/\s*\S+/g);
  if (!matches) {
    return text.length > 0 ? [text] : [];
  }
  const matchedLength = matches.reduce((sum, token) => sum + token.length, 0);
  if (matchedLength < text.length) {
    matches[matches.length - 1] += text.slice(matchedLength);
  }
  return matches;
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
  const [activeView, setActiveView] = useState<'home' | 'studio'>('home');
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [skin, setSkin] = useState<AiSkin>('chatgpt');
  const [modelLabel, setModelLabel] = useState<string>('ChatGPT');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [device, setDevice] = useState<DeviceMode>('desktop');
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
  const speedRef = useRef<PlaybackSpeed>(1);
  const showBottomBarRef = useRef<boolean>(true);
  const animationExportRef = useRef<AnimationExportController | null>(null);

  useEffect(() => {
    speedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    showBottomBarRef.current = showBottomBar;
  }, [showBottomBar]);

  const cancelActiveExport = useCallback(() => {
    if (animationExportRef.current) {
      animationExportRef.current.cancel();
      animationExportRef.current = null;
    }
    setIsRecording(false);
    setExportProgress(0);
  }, []);

  const stopAnimation = useCallback(() => {
    playbackRunIdRef.current += 1;
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

  const handleSkinChange = (nextSkin: AiSkin) => {
    if (isPlaying || isRecording) stopAnimation();
    setSkin(nextSkin);
    setModelLabel(AI_SKINS[nextSkin].defaultModel);
  };

  const sleepScaled = (baseMs: number, runId: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const delay = Math.max(8, Math.round(baseMs / speedRef.current));
      window.setTimeout(() => {
        resolve(playbackRunIdRef.current === runId);
      }, delay);
    });
  };

  const runAnimationSequence = async (
    scriptSnapshot: ChatMessage[],
    runId: number
  ): Promise<boolean> => {
    if (!(await sleepScaled(180, runId))) return false;

    for (let i = 0; i < scriptSnapshot.length; i++) {
      if (playbackRunIdRef.current !== runId) return false;
      const msg = scriptSnapshot[i];

      if (msg.role === 'user') {
        if (showBottomBarRef.current) {
          const chars = Array.from(msg.content);
          for (let c = 1; c <= chars.length; c++) {
            if (playbackRunIdRef.current !== runId) return false;
            setComposerDraft(chars.slice(0, c).join(''));
            if (!(await sleepScaled(22, runId))) return false;
          }

          if (!(await sleepScaled(140, runId))) return false;
          setSendHighlighted(true);
          if (!(await sleepScaled(220, runId))) return false;
          setComposerDraft('');
          setSendHighlighted(false);
        }

        setDisplayedMessages((prev) => [...prev, msg]);
        if (!(await sleepScaled(280, runId))) return false;
      } else {
        setIsThinking(true);
        if (!(await sleepScaled(1000, runId))) return false;
        setIsThinking(false);

        const words = tokenizeWordsPreservingWhitespace(msg.content);
        setDisplayedMessages((prev) => [...prev, { ...msg, content: '' }]);
        setStreamingMessageId(msg.id);

        for (let w = 0; w < words.length; w++) {
          if (playbackRunIdRef.current !== runId) return false;
          const partial = words.slice(0, w + 1).join('');
          setDisplayedMessages((prev) =>
            prev.map((item) =>
              item.id === msg.id ? { ...item, content: partial } : item
            )
          );
          if (!(await sleepScaled(45, runId))) return false;
        }

        setStreamingMessageId(null);
        if (!(await sleepScaled(420, runId))) return false;
      }
    }

    return playbackRunIdRef.current === runId;
  };

  const startAnimation = async (overrideMessages?: ChatMessage[]) => {
    const sourceMessages = overrideMessages ?? messages;
    if (sourceMessages.length === 0 || isRecording) {
      return;
    }

    const scriptSnapshot = sourceMessages.map((m) => ({ ...m }));
    const runId = playbackRunIdRef.current + 1;
    playbackRunIdRef.current = runId;

    setIsPlaying(true);
    setDisplayedMessages([]);
    setIsThinking(false);
    setStreamingMessageId(null);
    setComposerDraft('');
    setSendHighlighted(false);

    const completed = await runAnimationSequence(scriptSnapshot, runId);

    if (completed && playbackRunIdRef.current === runId) {
      setIsPlaying(false);
      setIsThinking(false);
      setStreamingMessageId(null);
      setComposerDraft('');
      setSendHighlighted(false);
    }
  };

  const handleTogglePlayback = () => {
    if (isPlaying) {
      stopAnimation();
    } else {
      void startAnimation();
    }
  };

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
      void startAnimation(hydrated);
    }, 60);
  };

  const handleAddMessage = (role: MessageRole) => {
    if (isPlaying || isRecording) stopAnimation();
    const newMessage: ChatMessage = {
      id: createMessageId(),
      role,
      thoughtDuration: role === 'assistant' ? '4s' : undefined,
      attachment: null,
      content:
        role === 'user'
          ? 'How can I optimize this further?'
          : 'Here are two clean improvements you can apply right away:\n\n- **Memoize expensive selectors** so child components avoid unnecessary renders.\n- **Batch state updates** inside event handlers for smoother UI responsiveness.',
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleUpdateMessage = (id: string, content: string) => {
    if (isPlaying || isRecording) stopAnimation();
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, content } : msg))
    );
  };

  const handleUpdateMessageThought = (id: string, thoughtDuration: string) => {
    if (isPlaying || isRecording) stopAnimation();
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, thoughtDuration } : msg))
    );
  };

  const handleUpdateMessageAttachment = (
    id: string,
    attachment: MessageAttachment | null
  ) => {
    if (isPlaying || isRecording) stopAnimation();
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, attachment } : msg))
    );
  };

  const handleToggleRole = (id: string) => {
    if (isPlaying || isRecording) stopAnimation();
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? { ...msg, role: msg.role === 'user' ? 'assistant' : 'user' }
          : msg
      )
    );
  };

  const handleMoveMessage = (index: number, direction: 'up' | 'down') => {
    if (isPlaying || isRecording) stopAnimation();
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
  };

  const handleDeleteMessage = (id: string) => {
    if (isPlaying || isRecording) stopAnimation();
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  const handleClearAll = () => {
    if (isPlaying || isRecording) stopAnimation();
    setMessages([]);
  };

  const handleLoadSample = () => {
    if (isPlaying || isRecording) stopAnimation();
    setMessages(INITIAL_MESSAGES);
  };

  // Dropdown 1: Download Image (PNG / JPG / WEBP of final frame)
  const handleExportImage = async (format: ImageFormat) => {
    if (!captureRef.current || isExporting || isRecording) {
      return;
    }
    setExportError(null);

    if (isPlaying) {
      stopAnimation();
      await waitNextFrames(3);
    }

    if (!captureRef.current) return;

    setIsExporting(true);
    try {
      await exportCleanImage(captureRef.current, theme, device, format, skin);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to export image.';
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  };

  // Dropdown 2: Download Animation (60 FPS MP4 / WebM / Smooth GIF via Native Canvas)
  const handleExportAnimation = async (format: AnimationFormat) => {
    if (isExporting || isRecording || messages.length === 0) {
      return;
    }
    setExportError(null);

    if (isPlaying) {
      stopAnimation();
      await waitNextFrames(2);
    }

    setIsRecording(true);
    setExportProgress(0);

    const controller = startNativeAnimationExport({
      messages: messages.map((m) => ({ ...m })),
      config: {
        skin,
        modelLabel,
        theme,
        device,
        showIosStatusBar,
        showBottomBar,
        showFooterDisclaimer,
        enableThoughtPill,
      },
      speed: playbackSpeed,
      quality: videoQuality,
      format,
      onProgress: (pct) => setExportProgress(pct),
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
    }
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
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-5">
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
          </div>

          <button
            type="button"
            onClick={() => setIsTheaterMode(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Theater Mode</span>
          </button>
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
            onModelLabelChange={(value) => {
              if (isPlaying || isRecording) stopAnimation();
              setModelLabel(value);
            }}
            theme={theme}
            onThemeChange={setTheme}
            device={device}
            onDeviceChange={setDevice}
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
            onToggleRole={handleToggleRole}
            onMoveMessage={handleMoveMessage}
            onDeleteMessage={handleDeleteMessage}
            onClearAll={handleClearAll}
            onLoadSample={handleLoadSample}
            onExportImage={handleExportImage}
            onExportAnimation={handleExportAnimation}
            onCancelExport={cancelActiveExport}
            videoQuality={videoQuality}
            onVideoQualityChange={setVideoQuality}
            isExporting={isExporting}
            isRecording={isRecording}
            exportProgress={exportProgress}
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
    </div>
  );
}
