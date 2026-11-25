/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ClipboardPaste,
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
import { ScriptAutoBuildModal } from './components/ScriptAutoBuildModal';
import {
  type ActiveVisualEffect,
  type AiSkin,
  type AnimationFormat,
  type BackgroundLoopConfig,
  type ChatMessage,
  DEFAULT_BACKGROUND_LOOP,
  type DeviceMode,
  getEffectivePlaybackMultiplier,
  type ImageFormat,
  INITIAL_MESSAGES,
  type MessageAttachment,
  type MessageRole,
  MULTI_AI_SAMPLE_MESSAGES,
  type PlaybackSpeed,
  type PreviewMode,
  type SoundBankFile,
  STAGE_LOGICAL_HEIGHT,
  STAGE_LOGICAL_WIDTH,
  type StageOverlay,
  type ThemeMode,
  type ThinkingSenderInfo,
  type VideoAudioMode,
  type VideoQuality,
} from './types';
import { exportCleanImage } from './utils/exportPng';
import {
  type AnimationExportController,
  exportAudioStemWav,
  startNativeAnimationExport,
} from './utils/exportVideo';
import { buildAnimationTimeline } from './utils/nativeCanvasRenderer';
import {
  createDefaultTextOverlay,
  createImageOverlayFromFile,
  createOverlayId,
} from './utils/overlays';
import { autoBuildFromScript } from './utils/scriptParser';
import { AI_SKINS } from './utils/skins';
import {
  buildMasterAudioSchedule,
  decodeSoundBankFiles,
  LiveAudioEngine,
  SYNTH_KEYCLICK_ID,
} from './utils/soundEngine';
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
  const [videoAudioMode, setVideoAudioMode] = useState<VideoAudioMode>('baked');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingWav, setIsExportingWav] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportFrame, setExportFrame] = useState<number>(0);
  const [exportTotalFrames, setExportTotalFrames] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);

  // Paste Script Modal + Sound Bank + Background Loop state
  const [scriptModalOpen, setScriptModalOpen] = useState<boolean>(false);
  const [soundBank, setSoundBank] = useState<SoundBankFile[]>([]);
  const [soundBankLoading, setSoundBankLoading] = useState<boolean>(false);
  const [soundBankStatus, setSoundBankStatus] = useState<string | null>(null);
  const [masterAudioMuted, setMasterAudioMuted] = useState<boolean>(false);
  const [backgroundLoop, setBackgroundLoop] = useState<BackgroundLoopConfig>(
    DEFAULT_BACKGROUND_LOOP
  );

  // Live typing & streaming playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [displayedMessages, setDisplayedMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [thinkingSender, setThinkingSender] =
    useState<ThinkingSenderInfo | null>(null);
  const [activeVisualEffect, setActiveVisualEffect] =
    useState<ActiveVisualEffect | null>(null);
  const [playbackTimeSec, setPlaybackTimeSec] = useState<number>(0);
  const [scrubTimeSec, setScrubTimeSec] = useState<number | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<string>('');
  const [sendHighlighted, setSendHighlighted] = useState<boolean>(false);

  // 16:9 Stage Overlays (full-time or timed text boxes & image/GIF popups)
  const [overlays, setOverlays] = useState<StageOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  const captureRef = useRef<HTMLDivElement | null>(null);
  const playbackRunIdRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const speedRef = useRef<PlaybackSpeed>(1);
  const showBottomBarRef = useRef<boolean>(true);
  const isPlayingRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const isExportingRef = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const overlaysRef = useRef<StageOverlay[]>(overlays);
  const skinRef = useRef<AiSkin>(skin);
  const themeRef = useRef<ThemeMode>(theme);
  const previewModeRef = useRef<PreviewMode>(previewMode);
  const scrubTimeSecRef = useRef<number | null>(scrubTimeSec);
  const soundBankRef = useRef<SoundBankFile[]>(soundBank);
  const backgroundLoopRef = useRef<BackgroundLoopConfig>(backgroundLoop);
  const masterAudioMutedRef = useRef<boolean>(masterAudioMuted);
  const liveAudioRef = useRef<LiveAudioEngine | null>(null);
  const animationExportRef = useRef<AnimationExportController | null>(null);

  const getLiveAudioEngine = useCallback((): LiveAudioEngine => {
    if (!liveAudioRef.current) {
      liveAudioRef.current = new LiveAudioEngine();
    }
    return liveAudioRef.current;
  }, []);

  const staticDisplayMessages = useMemo(
    () => messages.filter((m) => !m.cueKind),
    [messages]
  );

  const totalDurationSec = useMemo(() => {
    if (messages.length === 0) return 6;
    const tl = buildAnimationTimeline(messages, playbackSpeed, showBottomBar, {
      includeFinalHold: true,
    });
    return Math.max(1, tl.totalDurationMs / 1000);
  }, [messages, playbackSpeed, showBottomBar]);

  const totalDurationSecRef = useRef<number>(totalDurationSec);

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
    overlaysRef.current = overlays;
  }, [overlays]);

  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    previewModeRef.current = previewMode;
  }, [previewMode]);

  useEffect(() => {
    scrubTimeSecRef.current = scrubTimeSec;
  }, [scrubTimeSec]);

  useEffect(() => {
    soundBankRef.current = soundBank;
  }, [soundBank]);

  useEffect(() => {
    backgroundLoopRef.current = backgroundLoop;
  }, [backgroundLoop]);

  useEffect(() => {
    masterAudioMutedRef.current = masterAudioMuted;
  }, [masterAudioMuted]);

  useEffect(() => {
    totalDurationSecRef.current = totalDurationSec;
  }, [totalDurationSec]);

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
    liveAudioRef.current?.stopAll();
    cancelActiveExport();
    setIsPlaying(false);
    setIsThinking(false);
    setThinkingSender(null);
    setActiveVisualEffect(null);
    setPlaybackTimeSec(0);
    setScrubTimeSec(null);
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
      if (liveAudioRef.current) {
        liveAudioRef.current.dispose();
        liveAudioRef.current = null;
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
    (overrideMessages?: ChatMessage[], startAtSec = 0) => {
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

      const initialSpeed = speedRef.current;
      const initialMultiplier = getEffectivePlaybackMultiplier(initialSpeed);
      const timeline = buildAnimationTimeline(
        scriptSnapshot,
        initialSpeed,
        showBottomBarRef.current,
        { includeFinalHold: true }
      );

      const clampedStartMs = Math.max(
        0,
        Math.min(timeline.totalDurationMs, startAtSec * 1000)
      );

      // Build synced Web Audio schedule (Background Loop + per-line SFX + timed overlay SFX)
      const currentSoundBank = soundBankRef.current;
      const audioSchedule = buildMasterAudioSchedule({
        timeline,
        messages: scriptSnapshot,
        overlays: overlaysRef.current,
        previewMode: previewModeRef.current,
        soundBank: currentSoundBank,
        backgroundLoop: backgroundLoopRef.current,
        masterMuted: false, // live masterAudioMutedRef is checked dynamically
      });
      const audioFileMap = new Map(currentSoundBank.map((f) => [f.id, f]));
      let liveAudio: LiveAudioEngine | null = null;
      if (
        audioSchedule.events.length > 0 ||
        audioSchedule.backgroundFile !== null
      ) {
        liveAudio = getLiveAudioEngine();
        liveAudio.stopAll();
        liveAudio.unlock();
        if (audioSchedule.backgroundFile) {
          const initialBgVol =
            masterAudioMutedRef.current || backgroundLoopRef.current.muted
              ? 0
              : audioSchedule.backgroundVolume;
          liveAudio.startBackgroundLoop(
            audioSchedule.backgroundFile.buffer,
            initialBgVol,
            clampedStartMs / 1000
          );
        }
      } else {
        liveAudioRef.current?.stopAll();
      }

      let nextAudioEventIdx = 0;
      while (
        nextAudioEventIdx < audioSchedule.events.length &&
        audioSchedule.events[nextAudioEventIdx].timeMs < clampedStartMs - 15
      ) {
        nextAudioEventIdx += 1;
      }
      let wasDuckedForBlackout = false;
      let wasInTypingWindow = false;

      setScrubTimeSec(null);
      setIsPlaying(true);
      setDisplayedMessages([]);
      setIsThinking(false);
      setThinkingSender(null);
      setActiveVisualEffect(null);
      setPlaybackTimeSec(clampedStartMs / 1000);
      setStreamingMessageId(null);
      setComposerDraft('');
      setSendHighlighted(false);
      setSelectedOverlayId(null);

      let prevTs: number | null = null;
      let accumulatedMs = clampedStartMs;
      let lastSignature = '';
      let lastVfxSig = '';
      let prevRenderedMessages: ChatMessage[] = [];

      const tick = (now: number) => {
        if (playbackRunIdRef.current !== runId) {
          rafIdRef.current = null;
          return;
        }

        const rawDelta = prevTs === null ? 0 : Math.max(0, now - prevTs);
        prevTs = now;
        const safeDelta = Math.min(rawDelta, 28);
        const speedRatio =
          initialMultiplier > 0
            ? getEffectivePlaybackMultiplier(speedRef.current) /
              initialMultiplier
            : 1;
        accumulatedMs += safeDelta * speedRatio;

        const currentVideoSec = accumulatedMs / 1000;
        const frame = timeline.evaluateAt(accumulatedMs);

        // Immediately silence any active typing SFX the exact millisecond user_typing / [TYPING...] ends or send highlights
        const inTypingNow = audioSchedule.typingWindowsMs.some(
          (w) => accumulatedMs >= w.startMs && accumulatedMs < w.endMs
        );
        if (
          liveAudio &&
          ((wasInTypingWindow && !inTypingNow) || frame.sendHighlighted)
        ) {
          liveAudio.stopTypingSources();
        }
        wasInTypingWindow = inTypingNow;

        // Fire sample-accurate one-shot SFX & typing keyclick events with 25ms lookahead
        if (liveAudio && nextAudioEventIdx < audioSchedule.events.length) {
          const safeSpeedScale = speedRatio > 0 ? speedRatio : 1;
          while (
            nextAudioEventIdx < audioSchedule.events.length &&
            audioSchedule.events[nextAudioEventIdx].timeMs <= accumulatedMs + 25
          ) {
            const ev = audioSchedule.events[nextAudioEventIdx];
            nextAudioEventIdx += 1;
            if (!masterAudioMutedRef.current) {
              // Skip stale typing events if we already exited the typing phase
              if (ev.isTyping && !inTypingNow && ev.timeMs <= accumulatedMs) {
                continue;
              }
              const buffer =
                ev.fileId === SYNTH_KEYCLICK_ID
                  ? liveAudio.getSynthKeyclickBuffer()
                  : audioFileMap.get(ev.fileId)?.buffer ?? null;
              if (buffer) {
                const delaySec = Math.max(
                  0,
                  (ev.timeMs - accumulatedMs) / (1000 * safeSpeedScale)
                );
                const maxDurationSec = ev.maxDurationSec
                  ? Math.max(0.015, ev.maxDurationSec / safeSpeedScale)
                  : undefined;
                liveAudio.playOneShot(buffer, ev.volume, {
                  delaySec,
                  maxDurationSec,
                  pitchRate: ev.pitchRate,
                  isTyping: ev.isTyping,
                });
              }
            }
          }
        }

        // Duck background loop immediately during hard cut to black
        if (liveAudio && audioSchedule.backgroundFile) {
          const inBlackout = frame.activeVisualEffect?.type === 'cut_to_black';
          if (inBlackout !== wasDuckedForBlackout) {
            wasDuckedForBlackout = inBlackout;
            liveAudio.setBackgroundDucked(inBlackout);
          }
        }

        let nextStreamingId: string | null = null;
        for (let i = 0; i < frame.messages.length; i++) {
          if (frame.messages[i].isStreaming) {
            nextStreamingId = frame.messages[i].id;
            break;
          }
        }

        const vfxSig = frame.activeVisualEffect
          ? `${frame.activeVisualEffect.type}:${Math.round(
              frame.activeVisualEffect.intensity * 100
            )}`
          : '';
        if (vfxSig !== lastVfxSig) {
          lastVfxSig = vfxSig;
          setActiveVisualEffect(frame.activeVisualEffect);
        }

        const lastMsg = frame.messages[frame.messages.length - 1];
        const thinkSig = frame.thinkingSender
          ? `${frame.thinkingSender.senderSkin}:${
              frame.thinkingSender.customSenderName ?? ''
            }:${frame.thinkingSender.customSenderColor ?? ''}:${
              frame.thinkingSender.customSenderIcon ?? ''
            }:${frame.thinkingSender.customSenderAvatar ? 1 : 0}`
          : '';
        const sig = `${frame.messages.length}|${lastMsg?.id ?? ''}|${
          lastMsg?.content.length ?? 0
        }|${nextStreamingId ?? ''}|${frame.isThinking ? 1 : 0}|${thinkSig}|${
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
              existing.customSenderIcon === fm.customSenderIcon &&
              existing.customSenderAvatar === fm.customSenderAvatar &&
              existing.systemAnimate === fm.systemAnimate
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
              customSenderAvatar: fm.customSenderAvatar,
              systemAnimate: fm.systemAnimate,
            };
          });

          prevRenderedMessages = nextMessages;
          setDisplayedMessages(nextMessages);
          setIsThinking(frame.isThinking);
          setThinkingSender(frame.thinkingSender);
          setStreamingMessageId(nextStreamingId);
          setComposerDraft(frame.composerDraft);
          setSendHighlighted(frame.sendHighlighted);
          setPlaybackTimeSec(currentVideoSec);
        } else {
          setPlaybackTimeSec(currentVideoSec);
        }

        if (accumulatedMs >= timeline.totalDurationMs) {
          rafIdRef.current = null;
          liveAudioRef.current?.stopAll();
          setIsPlaying(false);
          setIsThinking(false);
          setThinkingSender(null);
          setActiveVisualEffect(null);
          setPlaybackTimeSec(0);
          setStreamingMessageId(null);
          setComposerDraft('');
          setSendHighlighted(false);
          return;
        }

        rafIdRef.current = window.requestAnimationFrame(tick);
      };

      rafIdRef.current = window.requestAnimationFrame(tick);
    },
    [getLiveAudioEngine]
  );

  const handleTogglePlayback = useCallback(() => {
    if (isPlayingRef.current) {
      stopAnimation();
    } else {
      const resumeSec =
        scrubTimeSecRef.current !== null &&
        scrubTimeSecRef.current < totalDurationSecRef.current - 0.15
          ? scrubTimeSecRef.current
          : 0;
      startAnimation(undefined, resumeSec);
    }
  }, [startAnimation, stopAnimation]);

  const handleScrubTime = useCallback(
    (sec: number | null) => {
      if (isPlayingRef.current) {
        playbackRunIdRef.current += 1;
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        setIsPlaying(false);
      }
      liveAudioRef.current?.stopAll();

      if (sec === null || messagesRef.current.length === 0) {
        setScrubTimeSec(null);
        setPlaybackTimeSec(0);
        setDisplayedMessages([]);
        setIsThinking(false);
        setThinkingSender(null);
        setActiveVisualEffect(null);
        setStreamingMessageId(null);
        setComposerDraft('');
        setSendHighlighted(false);
        return;
      }

      const clampedSec = Math.max(0, Math.min(totalDurationSecRef.current, sec));
      const timeline = buildAnimationTimeline(
        messagesRef.current,
        speedRef.current,
        showBottomBarRef.current,
        { includeFinalHold: true }
      );
      const frame = timeline.evaluateAt(clampedSec * 1000);
      let nextStreamingId: string | null = null;
      for (let i = 0; i < frame.messages.length; i++) {
        if (frame.messages[i].isStreaming) {
          nextStreamingId = frame.messages[i].id;
          break;
        }
      }
      setScrubTimeSec(clampedSec);
      setPlaybackTimeSec(clampedSec);
      setDisplayedMessages(
        frame.messages.map((fm) => ({
          id: fm.id,
          role: fm.role,
          content: fm.content,
          thoughtDuration: fm.thoughtDuration,
          attachment: fm.attachment,
          senderSkin: fm.senderSkin,
          customSenderName: fm.customSenderName,
          customSenderColor: fm.customSenderColor,
          customSenderIcon: fm.customSenderIcon,
          customSenderAvatar: fm.customSenderAvatar,
          systemAnimate: fm.systemAnimate,
        }))
      );
      setIsThinking(frame.isThinking);
      setThinkingSender(frame.thinkingSender);
      setActiveVisualEffect(frame.activeVisualEffect);
      setStreamingMessageId(nextStreamingId);
      setComposerDraft(frame.composerDraft);
      setSendHighlighted(frame.sendHighlighted);
    },
    []
  );

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
        systemAnimate: role === 'system' ? true : undefined,
        content:
          role === 'system'
            ? 'ChatGPT joined the chat'
            : role === 'user'
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

  const handleUpdateMessageMeta = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg))
      );
    },
    [stopAnimation]
  );

  // Sound Bank & Script Auto-Build handlers
  const handleLoadSoundBankFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setSoundBankLoading(true);
      setSoundBankStatus(`Decoding ${list.length} audio files...`);
      try {
        const engine = getLiveAudioEngine();
        const ctx = engine.ensureContext();
        const { loaded, skippedCount } = await decodeSoundBankFiles(list, ctx);
        if (loaded.length === 0) {
          setSoundBankStatus(
            'No supported audio files found (.mp3, .wav, .ogg, .m4a).'
          );
          return;
        }
        setSoundBank((prev) => {
          const byName = new Map(prev.map((f) => [f.name.toLowerCase(), f]));
          for (const item of loaded) {
            byName.set(item.name.toLowerCase(), item);
          }
          return Array.from(byName.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        });
        setSoundBankStatus(
          skippedCount > 0
            ? `Loaded ${loaded.length} sounds (${skippedCount} skipped). Fuzzy-matched to script.`
            : `Loaded ${loaded.length} sounds & auto-matched to script cues.`
        );
      } catch {
        setSoundBankStatus('Unable to decode selected audio files.');
      } finally {
        setSoundBankLoading(false);
      }
    },
    [getLiveAudioEngine]
  );

  const handleClearSoundBank = useCallback(() => {
    liveAudioRef.current?.stopAll();
    setSoundBank([]);
    setSoundBankStatus(null);
  }, []);

  const handleToggleMasterAudioMute = useCallback(() => {
    setMasterAudioMuted((prev) => {
      const nextMuted = !prev;
      if (liveAudioRef.current) {
        if (nextMuted) {
          liveAudioRef.current.setBackgroundLoopGain(0);
          liveAudioRef.current.stopTypingSources();
        } else if (
          backgroundLoopRef.current.enabled &&
          !backgroundLoopRef.current.muted
        ) {
          liveAudioRef.current.setBackgroundLoopGain(
            backgroundLoopRef.current.volume
          );
        }
      }
      return nextMuted;
    });
  }, []);

  const handleUpdateBackgroundLoop = useCallback(
    (patch: Partial<BackgroundLoopConfig>) => {
      setBackgroundLoop((prev) => {
        const next = { ...prev, ...patch };
        if (liveAudioRef.current && isPlayingRef.current) {
          if (masterAudioMutedRef.current || !next.enabled || next.muted) {
            liveAudioRef.current.setBackgroundLoopGain(0);
          } else {
            liveAudioRef.current.setBackgroundLoopGain(next.volume);
          }
        }
        return next;
      });
    },
    []
  );

  const handleAuditionSoundFile = useCallback(
    (fileId: string, volume = 0.9) => {
      const file = soundBankRef.current.find((f) => f.id === fileId);
      if (!file) return;
      const engine = getLiveAudioEngine();
      engine.unlock();
      engine.playOneShot(file.buffer, volume, { maxDurationSec: 3.5 });
    },
    [getLiveAudioEngine]
  );

  const handleAutoBuildScript = useCallback(
    (rawScript: string) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      const built = autoBuildFromScript(rawScript, {
        speed: speedRef.current,
        showBottomBar: showBottomBarRef.current,
        soundBank: soundBankRef.current,
        currentSkin: skinRef.current,
      });

      setMessages(built.messages);
      setOverlays(built.overlays);
      setBackgroundLoop(built.backgroundLoop);
      setSelectedOverlayId(null);
      setScrubTimeSec(null);
      setActiveVisualEffect(null);
      setExportError(null);

      if (built.recommendedSkin !== skinRef.current) {
        setSkin(built.recommendedSkin);
        setModelLabel(AI_SKINS[built.recommendedSkin].defaultModel);
      }

      if (built.recommendedPreviewMode === 'clean16x9') {
        setPreviewMode('clean16x9');
        setShowHeader(false);
        setShowSidebar(false);
        setShowFooterDisclaimer(false);
        setShowBottomBar(true);
      }
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

  // 16:9 Stage Overlay handlers
  const handleAddTextOverlay = useCallback(() => {
    if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
    const next = createDefaultTextOverlay(
      overlaysRef.current.length,
      themeRef.current,
      totalDurationSecRef.current
    );
    setOverlays((prev) => [...prev, next]);
    setSelectedOverlayId(next.id);
  }, [stopAnimation]);

  const handleAddImageOverlayFile = useCallback(
    (file: File) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      void createImageOverlayFromFile(
        file,
        overlaysRef.current.length,
        totalDurationSecRef.current
      )
        .then((next) => {
          setOverlays((prev) => [...prev, next]);
          setSelectedOverlayId(next.id);
        })
        .catch(() => {
          setExportError('Unable to load overlay image file.');
        });
    },
    [stopAnimation]
  );

  const handleUpdateOverlay = useCallback(
    (id: string, patch: Partial<StageOverlay>) => {
      setOverlays((prev) =>
        prev.map((ov) => (ov.id === id ? { ...ov, ...patch } : ov))
      );
    },
    []
  );

  const handleUploadOverlayImage = useCallback(
    (overlayId: string, file: File) => {
      if (isPlayingRef.current || isRecordingRef.current) stopAnimation();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
          const aspect =
            img.naturalWidth && img.naturalHeight
              ? img.naturalWidth / img.naturalHeight
              : 16 / 9;
          setOverlays((prev) =>
            prev.map((ov) => {
              if (ov.id !== overlayId) return ov;
              const nextH = Math.max(48, Math.min(440, Math.round(ov.width / aspect)));
              return {
                ...ov,
                imageDataUrl: dataUrl,
                imageName: file.name,
                imageAspectRatio: aspect,
                isGifPlaceholder: false,
                height: nextH,
              };
            })
          );
          setSelectedOverlayId(overlayId);
        };
        img.onerror = () => {
          setExportError('Unable to read selected GIF or image file.');
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [stopAnimation]
  );

  const handleDuplicateOverlay = useCallback((id: string) => {
    const source = overlaysRef.current.find((o) => o.id === id);
    if (!source) return;
    const copy: StageOverlay = {
      ...source,
      id: createOverlayId(),
      x: Math.min(STAGE_LOGICAL_WIDTH - source.width - 8, source.x + 22),
      y: Math.min(STAGE_LOGICAL_HEIGHT - source.height - 8, source.y + 22),
    };
    setOverlays((prev) => [...prev, copy]);
    setSelectedOverlayId(copy.id);
  }, []);

  const handleDeleteOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId((prev) => (prev === id ? null : prev));
  }, []);

  const handleMoveOverlay = useCallback(
    (index: number, direction: 'up' | 'down') => {
      setOverlays((prev) => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(index, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    []
  );

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
      setSelectedOverlayId(null);

      if (isPlayingRef.current || scrubTimeSecRef.current !== null) {
        stopAnimation();
        await waitNextFrames(3);
      }

      if (!captureRef.current) return;

      setIsExporting(true);
      await waitNextFrames(2);
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

  // Dropdown 2 & Direct 4K: Download Animation (60 FPS MP4 / WebM or Smooth GIF)
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

      if (isPlayingRef.current || scrubTimeSecRef.current !== null) {
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
          overlays: overlaysRef.current.map((o) => ({ ...o })),
        },
        speed: playbackSpeed,
        quality: effectiveQuality,
        format,
        audioMode: videoAudioMode,
        soundBank: soundBankRef.current,
        backgroundLoop: backgroundLoopRef.current,
        masterAudioMuted: masterAudioMutedRef.current,
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
      videoAudioMode,
      videoQuality,
    ]
  );

  const handleExportWavStem = useCallback(async () => {
    if (isExportingWav || isRecordingRef.current || messagesRef.current.length === 0) {
      return;
    }
    setExportError(null);
    setIsExportingWav(true);
    try {
      await exportAudioStemWav({
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
          overlays: overlaysRef.current.map((o) => ({ ...o })),
        },
        speed: playbackSpeed,
        soundBank: soundBankRef.current,
        backgroundLoop: backgroundLoopRef.current,
        masterMuted: masterAudioMutedRef.current,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to export WAV audio stem.';
      setExportError(message);
    } finally {
      setIsExportingWav(false);
    }
  }, [
    cleanFontSize,
    device,
    enableThoughtPill,
    isExportingWav,
    modelLabel,
    playbackSpeed,
    previewMode,
    showBottomBar,
    showFooterDisclaimer,
    showHeader,
    showIosStatusBar,
    showSidebar,
    skin,
    theme,
  ]);

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
            <button
              type="button"
              disabled={isRecording}
              onClick={() => setScriptModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Paste Script</span>
            </button>

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
            onUpdateMessageMeta={handleUpdateMessageMeta}
            onToggleRole={handleToggleRole}
            onMoveMessage={handleMoveMessage}
            onDeleteMessage={handleDeleteMessage}
            onClearAll={handleClearAll}
            onLoadSample={handleLoadSample}
            onOpenScriptModal={() => setScriptModalOpen(true)}
            soundBank={soundBank}
            soundBankLoading={soundBankLoading}
            soundBankStatus={soundBankStatus}
            onLoadSoundBankFiles={handleLoadSoundBankFiles}
            onClearSoundBank={handleClearSoundBank}
            masterAudioMuted={masterAudioMuted}
            onToggleMasterAudioMute={handleToggleMasterAudioMute}
            backgroundLoop={backgroundLoop}
            onUpdateBackgroundLoop={handleUpdateBackgroundLoop}
            onAuditionSoundFile={handleAuditionSoundFile}
            overlays={overlays}
            selectedOverlayId={selectedOverlayId}
            onSelectOverlay={setSelectedOverlayId}
            onAddTextOverlay={handleAddTextOverlay}
            onAddImageOverlayFile={handleAddImageOverlayFile}
            onUploadOverlayImage={handleUploadOverlayImage}
            onDeleteOverlay={handleDeleteOverlay}
            onMoveOverlay={handleMoveOverlay}
            onExportImage={handleExportImage}
            onExportAnimation={handleExportAnimationClick}
            onExportVideo={handleExportVideoClick}
            onExportWavStem={() => void handleExportWavStem()}
            onCancelExport={cancelActiveExport}
            videoQuality={videoQuality}
            onVideoQualityChange={setVideoQuality}
            videoAudioMode={videoAudioMode}
            onVideoAudioModeChange={setVideoAudioMode}
            isExporting={isExporting}
            isExportingWav={isExportingWav}
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
          messages={
            isPlaying || scrubTimeSec !== null
              ? displayedMessages
              : staticDisplayMessages
          }
          isPlaying={isPlaying}
          isExporting={isExporting}
          isThinking={isThinking}
          thinkingSender={thinkingSender}
          streamingMessageId={streamingMessageId}
          composerDraft={composerDraft}
          sendHighlighted={sendHighlighted}
          lockedMinHeight={null}
          isTheaterMode={isTheaterMode}
          playbackTimeSec={playbackTimeSec}
          totalDurationSec={totalDurationSec}
          scrubTimeSec={scrubTimeSec}
          onScrubTime={handleScrubTime}
          onTogglePlayback={handleTogglePlayback}
          overlays={overlays}
          selectedOverlayId={selectedOverlayId}
          onSelectOverlay={setSelectedOverlayId}
          onAddTextOverlay={handleAddTextOverlay}
          onAddImageOverlayFile={handleAddImageOverlayFile}
          onUploadOverlayImage={handleUploadOverlayImage}
          onUpdateOverlay={handleUpdateOverlay}
          onDuplicateOverlay={handleDuplicateOverlay}
          onDeleteOverlay={handleDeleteOverlay}
          activeVisualEffect={activeVisualEffect}
          soundBank={soundBank}
          onAuditionSoundFile={handleAuditionSoundFile}
        />
      </div>

      {/* Paste Script & Auto-Build Modal */}
      <ScriptAutoBuildModal
        open={scriptModalOpen}
        onClose={() => setScriptModalOpen(false)}
        soundBank={soundBank}
        soundBankLoading={soundBankLoading}
        onLoadSoundBankFiles={handleLoadSoundBankFiles}
        onAutoBuild={handleAutoBuildScript}
      />

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
