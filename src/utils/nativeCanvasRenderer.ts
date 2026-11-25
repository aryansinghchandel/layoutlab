import { marked, type Token, type Tokens } from 'marked';
import {
  type ActiveVisualEffect,
  type AiSkin,
  type ChatMessage,
  type CustomAiIconId,
  type DeviceMode,
  getEffectivePlaybackMultiplier,
  type MessageAttachment,
  type MessageRole,
  type MessageSenderSkin,
  type PlaybackSpeed,
  type PreviewMode,
  type StageOverlay,
  type ThemeMode,
  type ThinkingSenderInfo,
} from '../types';
import {
  evaluateOverlayVisibility,
  getOverlayFontStack,
  getSystemPillColors,
  hexToRgba,
} from './overlays';
import {
  AI_SKINS,
  getSenderBadgeMeta,
  getSkinPalette,
  type SkinPalette,
} from './skins';

export interface RenderConfig {
  skin: AiSkin;
  modelLabel: string;
  theme: ThemeMode;
  device: DeviceMode;
  previewMode: PreviewMode;
  cleanFontSize?: 26 | 28 | 34;
  showHeader: boolean;
  showSidebar: boolean;
  showIosStatusBar: boolean;
  showBottomBar: boolean;
  showFooterDisclaimer: boolean;
  enableThoughtPill: boolean;
  overlays?: StageOverlay[];
}

export interface RenderedFrameMessage {
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
  enterProgress: number;
  isStreaming: boolean;
}

export interface AnimationFrameState {
  messages: RenderedFrameMessage[];
  isThinking: boolean;
  thinkingSender: ThinkingSenderInfo | null;
  composerDraft: string;
  sendHighlighted: boolean;
  activeVisualEffect: ActiveVisualEffect | null;
  timeMs: number;
}

export interface TimelineSegment {
  startMs: number;
  endMs: number;
  kind:
    | 'idle'
    | 'user_typing'
    | 'user_presend'
    | 'user_send_highlight'
    | 'user_slide'
    | 'system_enter'
    | 'thinking'
    | 'ai_stream'
    | 'post_hold'
    | 'visual_effect'
    | 'final_hold';
  msgIndex: number;
  visualEffect?: 'red_flash' | 'cut_to_black';
  chars?: string[];
  words?: string[];
}

export interface AnimationTimeline {
  totalDurationMs: number;
  segments: TimelineSegment[];
  evaluateAt: (elapsedMs: number) => AnimationFrameState;
}

export interface DecodedGifTrack {
  frames: Array<{ bitmap: ImageBitmap; durationMs: number }>;
  totalDurationMs: number;
}

export interface ScrollState {
  y: number;
}

const OPENAI_SWIRL_PATH =
  'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z';

const GEMINI_SPARK_PATH =
  'M12 1.5C12 7.3 16.7 12 22.5 12C16.7 12 12 16.7 12 22.5C12 16.7 7.3 12 1.5 12C7.3 12 12 7.3 12 1.5Z';

const INTER_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const CLAUDE_SERIF_FONT =
  "'Source Serif 4', Georgia, 'Times New Roman', serif";
const MONO_FONT =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function getBodyFontFamily(skin: MessageSenderSkin | AiSkin): string {
  return skin === 'claude' ? CLAUDE_SERIF_FONT : INTER_FONT;
}

export async function preloadAttachmentImages(
  messages: ChatMessage[],
  overlays: StageOverlay[] = []
): Promise<Map<string, HTMLImageElement>> {
  const cache = new Map<string, HTMLImageElement>();
  const urls = new Set<string>();

  for (const msg of messages) {
    if (msg.attachment?.kind === 'image' && msg.attachment.dataUrl) {
      urls.add(msg.attachment.dataUrl);
    }
    if (msg.customSenderAvatar) {
      urls.add(msg.customSenderAvatar);
    }
  }

  for (const ov of overlays) {
    if (ov.kind === 'image' && ov.imageDataUrl) {
      urls.add(ov.imageDataUrl);
    }
  }

  const tasks: Promise<void>[] = [];
  for (const url of urls) {
    tasks.push(
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          cache.set(url, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      })
    );
  }

  await Promise.all(tasks);
  return cache;
}

interface ImageDecoderLike {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  decode: (opts: { frameIndex: number }) => Promise<{
    image: VideoFrame & { duration?: number | null; close: () => void };
  }>;
  close: () => void;
}

export async function preloadAnimatedGifs(
  overlays: StageOverlay[] = []
): Promise<Map<string, DecodedGifTrack>> {
  const gifCache = new Map<string, DecodedGifTrack>();
  if (typeof window === 'undefined' || !('ImageDecoder' in window)) {
    return gifCache;
  }
  const ImageDecoderCtor = (
    window as unknown as {
      ImageDecoder?: new (init: {
        data: BufferSource;
        type: string;
      }) => ImageDecoderLike;
    }
  ).ImageDecoder;
  if (!ImageDecoderCtor || typeof createImageBitmap !== 'function') {
    return gifCache;
  }

  const gifUrls = new Set<string>();
  for (const ov of overlays) {
    if (
      ov.kind === 'image' &&
      ov.imageDataUrl &&
      ov.imageDataUrl.startsWith('data:image/gif')
    ) {
      gifUrls.add(ov.imageDataUrl);
    }
  }

  for (const url of gifUrls) {
    try {
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      const decoder = new ImageDecoderCtor({ data: buf, type: 'image/gif' });
      await decoder.tracks.ready;
      const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
      if (frameCount > 1) {
        const capped = Math.min(frameCount, 120);
        const frames: Array<{ bitmap: ImageBitmap; durationMs: number }> = [];
        let totalDurationMs = 0;
        for (let i = 0; i < capped; i++) {
          const decoded = await decoder.decode({ frameIndex: i });
          const rawDurUs = decoded.image.duration ?? 80_000;
          const durationMs = Math.max(20, Math.round(rawDurUs / 1000));
          const bitmap = await createImageBitmap(decoded.image);
          decoded.image.close();
          frames.push({ bitmap, durationMs });
          totalDurationMs += durationMs;
        }
        if (frames.length > 1 && totalDurationMs > 0) {
          gifCache.set(url, { frames, totalDurationMs });
        }
      }
      decoder.close();
    } catch {
      // Fall back to static HTMLImageElement rendering
    }
  }

  return gifCache;
}

export function disposeAnimatedGifs(gifCache: Map<string, DecodedGifTrack>) {
  for (const track of gifCache.values()) {
    for (const f of track.frames) {
      try {
        f.bitmap.close();
      } catch {
        // Ignore
      }
    }
  }
  gifCache.clear();
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

function evaluateRedFlashIntensity(elapsedInWindowMs: number, durationMs: number): number {
  if (elapsedInWindowMs < 0 || elapsedInWindowMs > durationMs) return 0;
  const t = elapsedInWindowMs / Math.max(1, durationMs);
  // Snappy double-pulse crimson flash curve
  if (t < 0.14) {
    return t / 0.14;
  }
  if (t < 0.34) {
    return 1 - ((t - 0.14) / 0.2) * 0.62;
  }
  if (t < 0.48) {
    return 0.38 + ((t - 0.34) / 0.14) * 0.42;
  }
  return Math.max(0, 0.8 * (1 - (t - 0.48) / 0.52));
}

export function buildAnimationTimeline(
  messages: ChatMessage[],
  speed: PlaybackSpeed,
  showBottomBar: boolean,
  options?: { includeFinalHold?: boolean }
): AnimationTimeline {
  const effectiveSpeed = getEffectivePlaybackMultiplier(speed);
  const includeFinalHold = options?.includeFinalHold ?? true;
  const segments: TimelineSegment[] = [];
  const redFlashWindows: Array<{ startMs: number; durationMs: number }> = [];
  let cursorMs = 0;

  const pushSegment = (
    durationMs: number,
    seg: Omit<TimelineSegment, 'startMs' | 'endMs'>
  ): TimelineSegment => {
    const startMs = cursorMs;
    const endMs = cursorMs + Math.max(1, durationMs);
    const created: TimelineSegment = { ...seg, startMs, endMs };
    segments.push(created);
    cursorMs = endMs;
    return created;
  };

  pushSegment(Math.round(180 / effectiveSpeed), { kind: 'idle', msgIndex: -1 });

  messages.forEach((msg, index) => {
    const prevMsg = index > 0 ? messages[index - 1] : null;

    if (msg.cueKind === 'typing') {
      const holdMs = Math.max(200, Math.round((msg.holdDurationSec ?? 1.5) * 1000));
      pushSegment(holdMs, {
        kind: 'thinking',
        msgIndex: index,
      });
      if (msg.postHoldSec && msg.postHoldSec > 0) {
        pushSegment(Math.round(msg.postHoldSec * 1000), {
          kind: 'post_hold',
          msgIndex: index,
        });
      }
      return;
    }

    if (msg.cueKind === 'visual_effect') {
      const eff = msg.visualEffect === 'red_flash' ? 'red_flash' : 'cut_to_black';
      const defaultSec = eff === 'cut_to_black' ? 1.3 : 0.7;
      const holdMs = Math.max(200, Math.round((msg.holdDurationSec ?? defaultSec) * 1000));
      const seg = pushSegment(holdMs, {
        kind: 'visual_effect',
        msgIndex: index,
        visualEffect: eff,
      });
      if (eff === 'red_flash') {
        redFlashWindows.push({ startMs: seg.startMs, durationMs: Math.max(650, holdMs) });
      }
      if (msg.postHoldSec && msg.postHoldSec > 0) {
        pushSegment(Math.round(msg.postHoldSec * 1000), {
          kind: 'post_hold',
          msgIndex: index,
          visualEffect: eff === 'cut_to_black' ? 'cut_to_black' : undefined,
        });
      }
      return;
    }

    if (msg.role === 'system') {
      const animate = msg.systemAnimate !== false;
      const enterSeg = pushSegment(Math.round((animate ? 320 : 60) / effectiveSpeed), {
        kind: 'system_enter',
        msgIndex: index,
      });
      if (msg.visualEffect === 'red_flash') {
        redFlashWindows.push({ startMs: enterSeg.startMs, durationMs: 680 });
      }
      pushSegment(Math.round((animate ? 380 : 320) / effectiveSpeed), {
        kind: 'idle',
        msgIndex: index,
      });
      if (msg.visualEffect === 'cut_to_black') {
        pushSegment(1100, {
          kind: 'visual_effect',
          msgIndex: index,
          visualEffect: 'cut_to_black',
        });
      }
      if (msg.postHoldSec && msg.postHoldSec > 0) {
        pushSegment(Math.round(msg.postHoldSec * 1000), {
          kind: 'post_hold',
          msgIndex: index,
        });
      }
    } else if (msg.role === 'user') {
      if (showBottomBar) {
        const chars = Array.from(msg.content);
        if (chars.length > 0) {
          pushSegment(Math.round((chars.length * 22) / effectiveSpeed), {
            kind: 'user_typing',
            msgIndex: index,
            chars,
          });
        }
        pushSegment(Math.round(140 / effectiveSpeed), {
          kind: 'user_presend',
          msgIndex: index,
        });
        pushSegment(Math.round(220 / effectiveSpeed), {
          kind: 'user_send_highlight',
          msgIndex: index,
        });
      }
      const slideSeg = pushSegment(Math.round(240 / effectiveSpeed), {
        kind: 'user_slide',
        msgIndex: index,
      });
      if (msg.visualEffect === 'red_flash') {
        redFlashWindows.push({ startMs: slideSeg.startMs, durationMs: 680 });
      }
      pushSegment(Math.round(200 / effectiveSpeed), {
        kind: 'idle',
        msgIndex: index,
      });
      if (msg.visualEffect === 'cut_to_black') {
        pushSegment(1100, {
          kind: 'visual_effect',
          msgIndex: index,
          visualEffect: 'cut_to_black',
        });
      }
      if (msg.postHoldSec && msg.postHoldSec > 0) {
        pushSegment(Math.round(msg.postHoldSec * 1000), {
          kind: 'post_hold',
          msgIndex: index,
        });
      }
    } else {
      // Skip redundant default thinking pause if immediately preceded by an explicit [TYPING...] cue
      if (prevMsg?.cueKind !== 'typing') {
        pushSegment(Math.round(1000 / effectiveSpeed), {
          kind: 'thinking',
          msgIndex: index,
        });
      }
      const words = tokenizeWordsPreservingWhitespace(msg.content);
      let triggerStartMs = cursorMs;
      if (words.length > 0) {
        const streamSeg = pushSegment(Math.round((words.length * 45) / effectiveSpeed), {
          kind: 'ai_stream',
          msgIndex: index,
          words,
        });
        triggerStartMs = streamSeg.startMs;
      }
      if (msg.visualEffect === 'red_flash') {
        redFlashWindows.push({ startMs: triggerStartMs, durationMs: 680 });
      }
      pushSegment(Math.round(420 / effectiveSpeed), {
        kind: 'idle',
        msgIndex: index,
      });
      if (msg.visualEffect === 'cut_to_black') {
        pushSegment(1100, {
          kind: 'visual_effect',
          msgIndex: index,
          visualEffect: 'cut_to_black',
        });
      }
      if (msg.postHoldSec && msg.postHoldSec > 0) {
        pushSegment(Math.round(msg.postHoldSec * 1000), {
          kind: 'post_hold',
          msgIndex: index,
        });
      }
    }
  });

  const lastSeg = segments[segments.length - 1];
  const endsInBlackout = lastSeg?.visualEffect === 'cut_to_black';

  if (includeFinalHold) {
    pushSegment(endsInBlackout ? 800 : 1500, {
      kind: 'final_hold',
      msgIndex: messages.length - 1,
      visualEffect: endsInBlackout ? 'cut_to_black' : undefined,
    });
  }

  const totalDurationMs = cursorMs;

  const evaluateAt = (elapsedMs: number): AnimationFrameState => {
    const clamped = Math.max(0, Math.min(elapsedMs, totalDurationMs));
    let activeSeg = segments[segments.length - 1];
    for (let i = 0; i < segments.length; i++) {
      if (clamped <= segments[i].endMs) {
        activeSeg = segments[i];
        break;
      }
    }

    const visible: RenderedFrameMessage[] = [];
    let isThinking = false;
    let thinkingSender: ThinkingSenderInfo | null = null;
    let composerDraft = '';
    let sendHighlighted = false;

    const segDuration = Math.max(1, activeSeg.endMs - activeSeg.startMs);
    const localProgress = Math.max(
      0,
      Math.min(1, (clamped - activeSeg.startMs) / segDuration)
    );

    // Determine active visual effect (cut_to_black takes precedence over red_flash)
    let activeVisualEffect: ActiveVisualEffect | null = null;
    if (activeSeg.visualEffect === 'cut_to_black') {
      activeVisualEffect = { type: 'cut_to_black', intensity: 1 };
    } else {
      let maxFlash = 0;
      for (const win of redFlashWindows) {
        if (clamped >= win.startMs && clamped <= win.startMs + win.durationMs) {
          const val = evaluateRedFlashIntensity(clamped - win.startMs, win.durationMs);
          if (val > maxFlash) maxFlash = val;
        }
      }
      if (maxFlash > 0.01) {
        activeVisualEffect = { type: 'red_flash', intensity: maxFlash };
      }
    }

    if (activeSeg.kind === 'final_hold') {
      for (const m of messages) {
        if (m.cueKind) continue;
        visible.push({
          id: m.id,
          role: m.role,
          content: m.content,
          thoughtDuration: m.thoughtDuration,
          attachment: m.attachment,
          senderSkin: m.senderSkin,
          customSenderName: m.customSenderName,
          customSenderColor: m.customSenderColor,
          customSenderIcon: m.customSenderIcon,
          customSenderAvatar: m.customSenderAvatar,
          systemAnimate: m.systemAnimate,
          enterProgress: 1,
          isStreaming: false,
        });
      }
      return {
        messages: visible,
        isThinking: false,
        thinkingSender: null,
        composerDraft: '',
        sendHighlighted: false,
        activeVisualEffect,
        timeMs: clamped,
      };
    }

    const isCompletedSegKind =
      activeSeg.kind === 'idle' ||
      activeSeg.kind === 'post_hold' ||
      activeSeg.kind === 'visual_effect';
    const completedUpTo = isCompletedSegKind
      ? activeSeg.msgIndex
      : activeSeg.msgIndex - 1;

    for (let i = 0; i <= completedUpTo && i < messages.length; i++) {
      const m = messages[i];
      if (m.cueKind) continue;
      visible.push({
        id: m.id,
        role: m.role,
        content: m.content,
        thoughtDuration: m.thoughtDuration,
        attachment: m.attachment,
        senderSkin: m.senderSkin,
        customSenderName: m.customSenderName,
        customSenderColor: m.customSenderColor,
        customSenderIcon: m.customSenderIcon,
        customSenderAvatar: m.customSenderAvatar,
        systemAnimate: m.systemAnimate,
        enterProgress: 1,
        isStreaming: false,
      });
    }

    const currentMsg =
      activeSeg.msgIndex >= 0 && activeSeg.msgIndex < messages.length
        ? messages[activeSeg.msgIndex]
        : null;

    if (currentMsg) {
      if (activeSeg.kind === 'system_enter' && !currentMsg.cueKind) {
        visible.push({
          id: currentMsg.id,
          role: 'system',
          content: currentMsg.content,
          systemAnimate: currentMsg.systemAnimate,
          enterProgress: currentMsg.systemAnimate === false ? 1 : localProgress,
          isStreaming: false,
        });
      } else if (activeSeg.kind === 'user_typing' && activeSeg.chars) {
        const count = Math.max(
          1,
          Math.min(
            activeSeg.chars.length,
            Math.ceil(localProgress * activeSeg.chars.length)
          )
        );
        composerDraft = activeSeg.chars.slice(0, count).join('');
      } else if (activeSeg.kind === 'user_presend') {
        composerDraft = currentMsg.content;
      } else if (activeSeg.kind === 'user_send_highlight') {
        composerDraft = currentMsg.content;
        sendHighlighted = true;
      } else if (activeSeg.kind === 'user_slide' && !currentMsg.cueKind) {
        visible.push({
          id: currentMsg.id,
          role: 'user',
          content: currentMsg.content,
          attachment: currentMsg.attachment,
          senderSkin: currentMsg.senderSkin,
          customSenderName: currentMsg.customSenderName,
          customSenderColor: currentMsg.customSenderColor,
          customSenderIcon: currentMsg.customSenderIcon,
          customSenderAvatar: currentMsg.customSenderAvatar,
          enterProgress: localProgress,
          isStreaming: false,
        });
      } else if (activeSeg.kind === 'thinking') {
        isThinking = true;
        thinkingSender = {
          senderSkin: currentMsg.senderSkin ?? 'chatgpt',
          customSenderName: currentMsg.customSenderName,
          customSenderColor: currentMsg.customSenderColor,
          customSenderIcon: currentMsg.customSenderIcon,
          customSenderAvatar: currentMsg.customSenderAvatar,
        };
      } else if (activeSeg.kind === 'ai_stream' && activeSeg.words && !currentMsg.cueKind) {
        const count = Math.max(
          1,
          Math.min(
            activeSeg.words.length,
            Math.ceil(localProgress * activeSeg.words.length)
          )
        );
        visible.push({
          id: currentMsg.id,
          role: 'assistant',
          content: activeSeg.words.slice(0, count).join(''),
          thoughtDuration: currentMsg.thoughtDuration,
          senderSkin: currentMsg.senderSkin,
          customSenderName: currentMsg.customSenderName,
          customSenderColor: currentMsg.customSenderColor,
          customSenderIcon: currentMsg.customSenderIcon,
          customSenderAvatar: currentMsg.customSenderAvatar,
          enterProgress: 1,
          isStreaming: true,
        });
      }
    }

    return {
      messages: visible,
      isThinking,
      thinkingSender,
      composerDraft,
      sendHighlighted,
      activeVisualEffect,
      timeMs: clamped,
    };
  };

  return { totalDurationMs, segments, evaluateAt };
}

// ============================================================================
// GEOMETRY & SKIN AVATAR / ACTION ICONS
// ============================================================================

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function roundedTopRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

let cachedSwirlPath: Path2D | null = null;
let cachedGeminiPath: Path2D | null = null;

function drawAiAvatar(
  ctx: CanvasRenderingContext2D,
  skin: MessageSenderSkin,
  x: number,
  y: number,
  palette: SkinPalette,
  customColor?: string,
  customIcon?: CustomAiIconId,
  avatarSize = 28,
  customAvatar?: string,
  imageCache?: Map<string, HTMLImageElement>
) {
  const size = avatarSize;
  const ratio = size / 28;
  const cx = x + size / 2;
  const cy = y + size / 2;

  ctx.save();
  if (skin === 'custom') {
    if (customAvatar) {
      const img = imageCache?.get(customAvatar);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = customColor || '#6366f1';
      ctx.fill();
      ctx.clip();
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        let sx = 0;
        let sy = 0;
        let sw = img.naturalWidth;
        let sh = img.naturalHeight;
        if (imgAspect > 1) {
          sw = img.naturalHeight;
          sx = (img.naturalWidth - sw) / 2;
        } else if (imgAspect < 1) {
          sh = img.naturalWidth;
          sy = (img.naturalHeight - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, x, y, size, size);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = customColor || palette.avatarBorder;
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = customColor || '#6366f1';
    ctx.fill();

    const glyphHalf = 7.5 * ratio;
    ctx.translate(cx - glyphHalf, cy - glyphHalf);
    ctx.scale((15 * ratio) / 24, (15 * ratio) / 24);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (customIcon) {
      case 'bot':
        ctx.stroke(new Path2D('M12 8V4H8'));
        roundedRectPath(ctx, 4, 8, 16, 12, 2);
        ctx.stroke();
        ctx.stroke(new Path2D('M2 14h2M20 14h2M15 13v2M9 13v2'));
        break;
      case 'zap':
        ctx.stroke(new Path2D('M13 2 3 14h9l-1 8 10-12h-9l1-8Z'));
        break;
      case 'cpu':
        roundedRectPath(ctx, 4, 4, 16, 16, 2);
        ctx.stroke();
        roundedRectPath(ctx, 9, 9, 6, 6, 1);
        ctx.stroke();
        ctx.stroke(new Path2D('M15 2v2M9 2v2M15 20v2M9 20v2M2 9h2M2 15h2M20 9h2M20 15h2'));
        break;
      case 'terminal':
        ctx.stroke(new Path2D('m4 17 6-6-6-6M12 19h8'));
        break;
      case 'globe':
        ctx.beginPath();
        ctx.arc(12, 12, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.stroke(new Path2D('M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20'));
        break;
      case 'user':
        ctx.beginPath();
        ctx.arc(12, 8, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.stroke(new Path2D('M4 20a8 8 0 0 1 16 0'));
        break;
      case 'heart':
        ctx.stroke(
          new Path2D(
            'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
          )
        );
        break;
      case 'flame':
        ctx.stroke(
          new Path2D(
            'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z'
          )
        );
        break;
      case 'crown':
        ctx.stroke(new Path2D('M2 18h20L20 7l-5 4-3-6-3 6-5-4-2 11Z'));
        break;
      case 'brain':
        ctx.stroke(
          new Path2D(
            'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z'
          )
        );
        ctx.stroke(
          new Path2D(
            'M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z'
          )
        );
        break;
      case 'ghost':
        ctx.stroke(
          new Path2D(
            'M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8Z'
          )
        );
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(9.5, 10, 1.1, 0, Math.PI * 2);
        ctx.arc(14.5, 10, 1.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'sparkles':
      default:
        ctx.stroke(
          new Path2D(
            'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'
          )
        );
        break;
    }
    ctx.restore();
    return;
  }

  if (skin === 'chatgpt' || skin === 'grok') {
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = palette.avatarBg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.avatarBorder;
    ctx.stroke();
  }

  if (skin === 'claude') {
    const iconHalf = 10 * ratio;
    ctx.translate(cx - iconHalf, cy - iconHalf);
    ctx.scale((20 * ratio) / 24, (20 * ratio) / 24);
    ctx.strokeStyle = '#d97757';
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    const rays = [
      [12, 2.2, 12, 8.8],
      [12, 15.2, 12, 21.8],
      [2.2, 12, 8.8, 12],
      [15.2, 12, 21.8, 12],
      [5.07, 5.07, 9.73, 9.73],
      [14.27, 14.27, 18.93, 18.93],
      [18.93, 5.07, 14.27, 9.73],
      [9.73, 14.27, 5.07, 18.93],
      [8.1, 3.1, 10.5, 9],
      [13.5, 15, 15.9, 20.9],
      [3.1, 15.9, 9, 13.5],
      [15, 10.5, 20.9, 8.1],
    ];
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of rays) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  } else if (skin === 'gemini') {
    if (!cachedGeminiPath) cachedGeminiPath = new Path2D(GEMINI_SPARK_PATH);
    const iconHalf = 10 * ratio;
    ctx.translate(cx - iconHalf, cy - iconHalf);
    ctx.scale((20 * ratio) / 24, (20 * ratio) / 24);
    const grad = ctx.createLinearGradient(2, 2, 22, 22);
    grad.addColorStop(0, '#4285f4');
    grad.addColorStop(0.52, '#9b72cb');
    grad.addColorStop(1, '#d96570');
    ctx.fillStyle = grad;
    ctx.fill(cachedGeminiPath);
  } else if (skin === 'grok') {
    const iconHalf = 8.5 * ratio;
    ctx.translate(cx - iconHalf, cy - iconHalf);
    ctx.scale((17 * ratio) / 24, (17 * ratio) / 24);
    ctx.strokeStyle = palette.textPrimary;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(12, 12, 9.2, 0, Math.PI * 2);
    ctx.moveTo(16.2, 6.8);
    ctx.lineTo(7.8, 17.2);
    ctx.moveTo(8.6, 8.2);
    ctx.lineTo(15.4, 15.8);
    ctx.stroke();
  } else {
    if (!cachedSwirlPath) cachedSwirlPath = new Path2D(OPENAI_SWIRL_PATH);
    const iconHalf = 8 * ratio;
    ctx.translate(cx - iconHalf, cy - iconHalf);
    ctx.scale((16 * ratio) / 24, (16 * ratio) / 24);
    ctx.fillStyle = palette.textPrimary;
    ctx.fill(cachedSwirlPath);
  }
  ctx.restore();
}

function drawSidebarToggleIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(20 / 24, 20 / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  roundedRectPath(ctx, 3, 4, 18, 16, 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9, 4);
  ctx.lineTo(9, 20);
  ctx.stroke();
  ctx.restore();
}

function drawHamburgerIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(20 / 24, 20 / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, 6.5);
  ctx.lineTo(20, 6.5);
  ctx.moveTo(4, 12);
  ctx.lineTo(20, 12);
  ctx.moveTo(4, 17.5);
  ctx.lineTo(20, 17.5);
  ctx.stroke();
  ctx.restore();
}

function drawNewChatIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(12, 4);
  ctx.lineTo(6, 4);
  ctx.arcTo(4, 4, 4, 6, 2);
  ctx.lineTo(4, 18);
  ctx.arcTo(4, 20, 6, 20, 2);
  ctx.lineTo(18, 20);
  ctx.arcTo(20, 20, 20, 18, 2);
  ctx.lineTo(20, 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(18.375, 3.625);
  ctx.lineTo(20.496, 5.746);
  ctx.lineTo(12.5, 13.743);
  ctx.lineTo(9.318, 14.538);
  ctx.lineTo(10.113, 11.356);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawShareIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'));
  ctx.stroke(new Path2D('M16 6 12 2 8 6'));
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(12, 15);
  ctx.stroke();
  ctx.restore();
}

function drawStarIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(
    new Path2D(
      'M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2Z'
    )
  );
  ctx.restore();
}

function drawGhostIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(
    new Path2D(
      'M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8Z'
    )
  );
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(9.5, 10, 1, 0, Math.PI * 2);
  ctx.arc(14.5, 10, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawChevronDown(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(6, 9);
  ctx.lineTo(12, 15);
  ctx.lineTo(18, 9);
  ctx.stroke();
  ctx.restore();
}

function drawPlusIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(12, 5);
  ctx.lineTo(12, 19);
  ctx.moveTo(5, 12);
  ctx.lineTo(19, 12);
  ctx.stroke();
  ctx.restore();
}

function drawMicIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = 18
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z'));
  ctx.stroke(new Path2D('M19 10v2a7 7 0 0 1-14 0v-2'));
  ctx.beginPath();
  ctx.moveTo(12, 19);
  ctx.lineTo(12, 22);
  ctx.stroke();
  ctx.restore();
}

function drawPaperclipIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = 18
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(
    new Path2D(
      'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48'
    )
  );
  ctx.restore();
}

function drawVoiceWaveformIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = 18
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const bars: Array<[number, number, number]> = [
    [4, 10, 14],
    [8, 7, 17],
    [12, 4, 20],
    [16, 7, 17],
    [20, 10, 14],
  ];
  ctx.beginPath();
  for (const [bx, y1, y2] of bars) {
    ctx.moveTo(bx, y1);
    ctx.lineTo(bx, y2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSendArrowIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = 15
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(12, 19);
  ctx.lineTo(12, 5);
  ctx.moveTo(5, 12);
  ctx.lineTo(12, 5);
  ctx.lineTo(19, 12);
  ctx.stroke();
  ctx.restore();
}

function drawSingleActionIcon(
  ctx: CanvasRenderingContext2D,
  kind:
    | 'copy'
    | 'up'
    | 'down'
    | 'speaker'
    | 'retry'
    | 'share'
    | 'sliders'
    | 'google',
  x: number,
  y: number,
  color: string,
  size = 15
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (kind) {
    case 'copy':
      roundedRectPath(ctx, 9, 9, 13, 13, 2);
      ctx.stroke();
      ctx.stroke(new Path2D('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'));
      break;
    case 'up':
      ctx.stroke(new Path2D('M7 10v12'));
      ctx.stroke(
        new Path2D(
          'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z'
        )
      );
      break;
    case 'down':
      ctx.stroke(new Path2D('M17 14V2'));
      ctx.stroke(
        new Path2D(
          'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z'
        )
      );
      break;
    case 'speaker':
      ctx.stroke(new Path2D('M11 5 6 9H2v6h4l5 4V5Z'));
      ctx.stroke(new Path2D('M15.54 8.46a5 5 0 0 1 0 7.07'));
      ctx.stroke(new Path2D('M19.07 4.93a10 10 0 0 1 0 14.14'));
      break;
    case 'retry':
      ctx.stroke(new Path2D('M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'));
      ctx.stroke(new Path2D('M3 3v5h5'));
      ctx.stroke(new Path2D('M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16'));
      ctx.stroke(new Path2D('M16 16h5v5'));
      break;
    case 'share':
      ctx.stroke(new Path2D('M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'));
      ctx.stroke(new Path2D('M16 6 12 2 8 6'));
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.lineTo(12, 15);
      ctx.stroke();
      break;
    case 'sliders':
      ctx.beginPath();
      ctx.moveTo(4, 7);
      ctx.lineTo(20, 7);
      ctx.moveTo(4, 17);
      ctx.lineTo(20, 17);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(9, 7, 2.2, 0, Math.PI * 2);
      ctx.arc(15, 17, 2.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'google':
      ctx.fillStyle = '#4285f4';
      ctx.fill(
        new Path2D(
          'M21.8 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.49a4.69 4.69 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.05-4.4 3.05-7.48Z'
        )
      );
      ctx.fillStyle = '#34a853';
      ctx.fill(
        new Path2D(
          'M12 22c2.76 0 5.07-.91 6.76-2.47l-3.3-2.56c-.91.61-2.08.98-3.46.98-2.66 0-4.92-1.8-5.73-4.22H2.86v2.64A10.2 10.2 0 0 0 12 22Z'
        )
      );
      ctx.fillStyle = '#fbbc05';
      ctx.fill(
        new Path2D(
          'M6.27 13.73A6.13 6.13 0 0 1 5.95 12c0-.6.11-1.18.32-1.73V7.63H2.86A10.2 10.2 0 0 0 1.8 12c0 1.65.4 3.21 1.06 4.37l3.41-2.64Z'
        )
      );
      ctx.fillStyle = '#ea4335';
      ctx.fill(
        new Path2D(
          'M12 6.05c1.5 0 2.85.52 3.91 1.53l2.93-2.93C17.06 3 14.75 2 12 2a10.2 10.2 0 0 0-9.14 5.63l3.41 2.64C7.08 7.85 9.34 6.05 12 6.05Z'
        )
      );
      break;
  }
  ctx.restore();
}

function drawSkinActionIconsRow(
  ctx: CanvasRenderingContext2D,
  skin: MessageSenderSkin,
  x: number,
  y: number,
  color: string,
  iconSize = 15,
  stepX = 27
) {
  let icons: Array<
    'copy' | 'up' | 'down' | 'speaker' | 'retry' | 'share' | 'sliders' | 'google'
  >;
  switch (skin) {
    case 'claude':
      icons = ['copy', 'up', 'down', 'retry'];
      break;
    case 'gemini':
      icons = ['up', 'down', 'retry', 'share', 'google'];
      break;
    case 'grok':
      icons = ['retry', 'copy', 'share', 'up', 'down'];
      break;
    case 'custom':
      icons = ['copy', 'up', 'down', 'retry'];
      break;
    case 'chatgpt':
    default:
      icons = ['copy', 'up', 'down', 'speaker', 'retry', 'share'];
      break;
  }

  icons.forEach((kind, idx) => {
    drawSingleActionIcon(ctx, kind, x + idx * stepX, y, color, iconSize);
  });
}

function drawIosStatusBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 15px ${INTER_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('09:41', 26, 21);

  const rightEnd = width - 24;
  const batX = rightEnd - 25;
  const batY = 15;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.2;
  roundedRectPath(ctx, batX + 0.75, batY + 0.75, 21, 10.5, 2.6);
  ctx.stroke();
  ctx.globalAlpha = 1;
  roundedRectPath(ctx, batX + 2.2, batY + 2.2, 18, 7.6, 1.5);
  ctx.fill();
  ctx.globalAlpha = 0.45;
  ctx.fillRect(batX + 23, batY + 4, 1.5, 4);

  ctx.globalAlpha = 1;
  const wifiCx = batX - 13;
  const wifiCy = 24.5;
  ctx.beginPath();
  ctx.arc(wifiCx, wifiCy, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (const r of [4.2, 7.2, 10.2]) {
    ctx.beginPath();
    ctx.arc(wifiCx, wifiCy, r, Math.PI * 1.23, Math.PI * 1.77);
    ctx.stroke();
  }

  const sigX = wifiCx - 29;
  const heights = [3.5, 5.8, 8.2, 11];
  heights.forEach((bh, idx) => {
    roundedRectPath(ctx, sigX + idx * 4.5, 26 - bh, 3, bh, 0.8);
    ctx.fill();
  });

  ctx.restore();
}

// ============================================================================
// TEXT WRAPPING & MARKDOWN-TO-CANVAS LAYOUT
// ============================================================================

interface InlineRun {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  underline: boolean;
}

interface MeasuredLine {
  runs: Array<{
    text: string;
    x: number;
    width: number;
    bold: boolean;
    italic: boolean;
    code: boolean;
    underline: boolean;
    font: string;
  }>;
  width: number;
  height: number;
  endX: number;
}

function getFontSpec(
  bold: boolean,
  italic: boolean,
  code: boolean,
  fontSize: number,
  fontFamily: string
): string {
  if (code) {
    return `500 ${Math.round(fontSize * 0.84)}px ${MONO_FONT}`;
  }
  const style = italic ? 'italic ' : '';
  const weight = bold ? '600' : '400';
  return `${style}${weight} ${fontSize}px ${fontFamily}`;
}

function flattenInlineTokens(
  tokens: Token[] | undefined,
  state: { bold: boolean; italic: boolean; underline: boolean } = {
    bold: false,
    italic: false,
    underline: false,
  }
): InlineRun[] {
  if (!tokens || tokens.length === 0) return [];
  const runs: InlineRun[] = [];

  for (const tok of tokens) {
    switch (tok.type) {
      case 'strong': {
        const t = tok as Tokens.Strong;
        runs.push(...flattenInlineTokens(t.tokens, { ...state, bold: true }));
        break;
      }
      case 'em': {
        const t = tok as Tokens.Em;
        runs.push(...flattenInlineTokens(t.tokens, { ...state, italic: true }));
        break;
      }
      case 'link': {
        const t = tok as Tokens.Link;
        runs.push(...flattenInlineTokens(t.tokens, { ...state, underline: true }));
        break;
      }
      case 'del': {
        const t = tok as Tokens.Del;
        runs.push(...flattenInlineTokens(t.tokens, state));
        break;
      }
      case 'codespan': {
        const t = tok as Tokens.Codespan;
        runs.push({
          text: t.text,
          bold: false,
          italic: false,
          code: true,
          underline: false,
        });
        break;
      }
      case 'br': {
        runs.push({
          text: '\n',
          bold: false,
          italic: false,
          code: false,
          underline: false,
        });
        break;
      }
      case 'escape':
      case 'text': {
        const t = tok as Tokens.Text;
        if (t.tokens && t.tokens.length > 0) {
          runs.push(...flattenInlineTokens(t.tokens, state));
        } else {
          runs.push({
            text: t.text,
            bold: state.bold,
            italic: state.italic,
            code: false,
            underline: state.underline,
          });
        }
        break;
      }
      default: {
        if ('text' in tok && typeof tok.text === 'string') {
          runs.push({
            text: tok.text,
            bold: state.bold,
            italic: state.italic,
            code: false,
            underline: state.underline,
          });
        }
      }
    }
  }
  return runs;
}

function layoutInlineRuns(
  ctx: CanvasRenderingContext2D,
  runs: InlineRun[],
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  fontFamily: string
): MeasuredLine[] {
  const lines: MeasuredLine[] = [];
  let currentRuns: MeasuredLine['runs'] = [];
  let cursorX = 0;

  const flushLine = () => {
    lines.push({
      runs: currentRuns,
      width: cursorX,
      height: lineHeight,
      endX: cursorX,
    });
    currentRuns = [];
    cursorX = 0;
  };

  for (const run of runs) {
    const font = getFontSpec(run.bold, run.italic, run.code, fontSize, fontFamily);
    ctx.font = font;

    if (run.code) {
      const textW = ctx.measureText(run.text).width;
      const boxW = textW + 10;
      if (cursorX > 0 && cursorX + boxW > maxWidth) {
        flushLine();
      }
      currentRuns.push({
        text: run.text,
        x: cursorX,
        width: boxW,
        bold: false,
        italic: false,
        code: true,
        underline: false,
        font,
      });
      cursorX += boxW;
      continue;
    }

    const parts = run.text.split(/(\n|\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (part === '\n') {
        flushLine();
        continue;
      }
      if (/^\s+$/.test(part)) {
        const spaceW = ctx.measureText(' ').width * part.length;
        if (cursorX > 0 && cursorX + spaceW <= maxWidth) {
          currentRuns.push({
            text: part,
            x: cursorX,
            width: spaceW,
            bold: run.bold,
            italic: run.italic,
            code: false,
            underline: run.underline,
            font,
          });
          cursorX += spaceW;
        }
        continue;
      }

      const wordW = ctx.measureText(part).width;
      if (cursorX > 0 && cursorX + wordW > maxWidth) {
        flushLine();
      }
      if (wordW > maxWidth) {
        let slice = '';
        for (const ch of Array.from(part)) {
          const next = slice + ch;
          const nextW = ctx.measureText(next).width;
          if (cursorX + nextW > maxWidth && slice.length > 0) {
            const sliceW = ctx.measureText(slice).width;
            currentRuns.push({
              text: slice,
              x: cursorX,
              width: sliceW,
              bold: run.bold,
              italic: run.italic,
              code: false,
              underline: run.underline,
              font,
            });
            flushLine();
            slice = ch;
          } else {
            slice = next;
          }
        }
        if (slice) {
          const sliceW = ctx.measureText(slice).width;
          currentRuns.push({
            text: slice,
            x: cursorX,
            width: sliceW,
            bold: run.bold,
            italic: run.italic,
            code: false,
            underline: run.underline,
            font,
          });
          cursorX += sliceW;
        }
      } else {
        currentRuns.push({
          text: part,
          x: cursorX,
          width: wordW,
          bold: run.bold,
          italic: run.italic,
          code: false,
          underline: run.underline,
          font,
        });
        cursorX += wordW;
      }
    }
  }

  if (currentRuns.length > 0 || lines.length === 0) {
    flushLine();
  }

  return lines;
}

function wrapPlainText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string
): string[] {
  ctx.font = font;
  const paragraphs = (text || ' ').split('\n');
  const out: string[] = [];

  for (const para of paragraphs) {
    if (para === '') {
      out.push('');
      continue;
    }
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const candidate = line + w;
      if (line.length > 0 && ctx.measureText(candidate).width > maxWidth) {
        out.push(line.trimEnd());
        const trimmed = w.trimStart();
        if (ctx.measureText(trimmed).width > maxWidth) {
          let chunk = '';
          for (const ch of Array.from(trimmed)) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk.length > 0) {
              out.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
        } else {
          line = trimmed;
        }
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

const lexerCache = new Map<string, Token[]>();
function getMarkdownTokens(content: string): Token[] {
  if (!content.trim()) return [];
  const cached = lexerCache.get(content);
  if (cached) return cached;
  const tokens = marked.lexer(content, { gfm: true, breaks: true });
  if (lexerCache.size > 400) {
    lexerCache.clear();
  }
  lexerCache.set(content, tokens);
  return tokens;
}

interface MarkdownDrawResult {
  height: number;
  cursorX: number;
  cursorY: number;
  cursorColor: string;
}

function processMarkdownBlock(
  ctx: CanvasRenderingContext2D,
  tokens: Token[],
  startX: number,
  startY: number,
  maxWidth: number,
  palette: SkinPalette,
  fontFamily: string,
  draw: boolean,
  cleanFontPx = 0
): MarkdownDrawResult {
  const isViral16x9 = cleanFontPx > 0;
  const bodySize = isViral16x9 ? cleanFontPx : 15;
  const lineRatio = cleanFontPx >= 32 ? 1.3 : 1.38;
  const bodyLineH = isViral16x9
    ? Math.round(cleanFontPx * lineRatio * 10) / 10
    : 24.5;
  let y = startY;
  let lastCursorX = startX;
  let lastCursorY = startY + bodyLineH / 2;
  let lastCursorColor = palette.textPrimary;

  const drawLines = (
    lines: MeasuredLine[],
    x: number,
    textColor: string,
    fontSize: number
  ) => {
    for (const line of lines) {
      if (draw) {
        for (const r of line.runs) {
          ctx.font = r.font;
          if (r.code) {
            const boxH = Math.round(fontSize * 1.28);
            const boxY = y + (line.height - boxH) / 2;
            ctx.fillStyle = palette.inlineCodeBg;
            roundedRectPath(ctx, x + r.x, boxY, r.width, boxH, 5);
            ctx.fill();
            ctx.fillStyle = palette.inlineCodeFg;
            ctx.textBaseline = 'middle';
            ctx.fillText(r.text, x + r.x + 5, y + line.height / 2 + 0.5);
          } else {
            ctx.fillStyle = textColor;
            ctx.textBaseline = 'middle';
            ctx.fillText(r.text, x + r.x, y + line.height / 2);
            if (r.underline) {
              ctx.fillRect(
                x + r.x,
                y + line.height / 2 + fontSize * 0.45,
                r.width,
                1
              );
            }
          }
        }
      }
      lastCursorX = x + line.endX;
      lastCursorY = y + line.height / 2;
      lastCursorColor = textColor;
      y += line.height;
    }
  };

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    const isLast = idx === tokens.length - 1;

    if (tok.type === 'space') {
      continue;
    }

    if (tok.type === 'paragraph') {
      const p = tok as Tokens.Paragraph;
      const runs = flattenInlineTokens(p.tokens);
      const lines = layoutInlineRuns(
        ctx,
        runs,
        maxWidth,
        bodySize,
        bodyLineH,
        fontFamily
      );
      drawLines(lines, startX, palette.textPrimary, bodySize);
      if (!isLast) y += isViral16x9 ? 14 : 10;
      continue;
    }

    if (tok.type === 'heading') {
      const h = tok as Tokens.Heading;
      if (idx > 0) y += isViral16x9 ? 8 : 6;
      const size = isViral16x9
        ? h.depth === 1
          ? cleanFontPx + 6
          : h.depth === 2
            ? cleanFontPx + 3
            : cleanFontPx + 1
        : h.depth === 1
          ? 22
          : h.depth === 2
            ? 18
            : 16;
      const lh = Math.round(size * 1.32);
      const runs = flattenInlineTokens(h.tokens, {
        bold: true,
        italic: false,
        underline: false,
      });
      const lines = layoutInlineRuns(ctx, runs, maxWidth, size, lh, fontFamily);
      drawLines(lines, startX, palette.textPrimary, size);
      if (!isLast) y += isViral16x9 ? 10 : 8;
      continue;
    }

    if (tok.type === 'list') {
      const list = tok as Tokens.List;
      if (idx > 0) y += 2;
      const indent = isViral16x9 ? Math.round(cleanFontPx * 1.05) : 22;
      const startNum = typeof list.start === 'number' ? list.start : 1;

      list.items.forEach((item, itemIdx) => {
        const marker = list.ordered ? `${startNum + itemIdx}.` : '•';
        const inlineTokens: Token[] = [];
        for (const sub of item.tokens) {
          if (sub.type === 'text' || sub.type === 'paragraph') {
            const subToks = (sub as Tokens.Paragraph).tokens;
            if (subToks) inlineTokens.push(...subToks);
            else inlineTokens.push(sub);
          }
        }
        const runs = flattenInlineTokens(
          inlineTokens.length > 0 ? inlineTokens : item.tokens
        );
        const lines = layoutInlineRuns(
          ctx,
          runs,
          Math.max(60, maxWidth - indent),
          bodySize,
          bodyLineH,
          fontFamily
        );

        if (draw) {
          ctx.fillStyle = palette.textSecondary;
          ctx.font = `500 ${bodySize}px ${fontFamily}`;
          ctx.textBaseline = 'middle';
          ctx.fillText(marker, startX + 4, y + bodyLineH / 2);
        }
        drawLines(lines, startX + indent, palette.textPrimary, bodySize);
        y += isViral16x9 ? 7 : 5;
      });
      if (!isLast) y += isViral16x9 ? 8 : 6;
      continue;
    }

    if (tok.type === 'code') {
      const c = tok as Tokens.Code;
      if (idx > 0) y += 4;
      const lang =
        c.lang && c.lang.trim()
          ? c.lang.trim().split(/\s+/)[0].toLowerCase()
          : 'code';
      const headerH = isViral16x9 ? 38 : 30;
      const codeSize = isViral16x9 ? Math.max(20, cleanFontPx - 7) : 13;
      const codeFont = `400 ${codeSize}px ${MONO_FONT}`;
      const codeLines = wrapPlainText(
        ctx,
        c.text,
        Math.max(80, maxWidth - 36),
        codeFont
      );
      const codeLineH = Math.round(codeSize * 1.36);
      const bodyPadY = isViral16x9 ? 16 : 14;
      const bodyH = codeLines.length * codeLineH + bodyPadY * 2;
      const totalBoxH = headerH + bodyH;

      if (draw) {
        ctx.fillStyle = '#0d0d0d';
        roundedRectPath(ctx, startX, y, maxWidth, totalBoxH, 10);
        ctx.fill();
        ctx.strokeStyle = palette.codeBlockBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#2f2f2f';
        roundedTopRectPath(ctx, startX, y, maxWidth, headerH, 10);
        ctx.fill();

        const headerFontSize = isViral16x9 ? 14 : 12;
        ctx.fillStyle = '#b4b4b4';
        ctx.font = `400 ${headerFontSize}px ${INTER_FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillText(lang, startX + 16, y + headerH / 2);

        const copyLabel = 'Copy code';
        const copyTextW = ctx.measureText(copyLabel).width;
        ctx.fillText(
          copyLabel,
          startX + maxWidth - 16 - copyTextW,
          y + headerH / 2
        );
        ctx.save();
        ctx.translate(
          startX + maxWidth - 16 - copyTextW - 18,
          y + headerH / 2 - 6.5
        );
        ctx.scale(13 / 24, 13 / 24);
        ctx.strokeStyle = '#b4b4b4';
        ctx.lineWidth = 1.9;
        roundedRectPath(ctx, 9, 9, 13, 13, 2);
        ctx.stroke();
        ctx.stroke(
          new Path2D('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')
        );
        ctx.restore();

        ctx.fillStyle = '#f8f8f2';
        ctx.font = codeFont;
        ctx.textBaseline = 'middle';
        codeLines.forEach((cl, lineIdx) => {
          const lineY =
            y + headerH + bodyPadY + lineIdx * codeLineH + codeLineH / 2;
          ctx.fillText(cl, startX + 18, lineY);
        });
      }

      const lastCodeLine = codeLines[codeLines.length - 1] ?? '';
      ctx.font = codeFont;
      const lastCodeW = ctx.measureText(lastCodeLine).width;
      lastCursorX = startX + 18 + lastCodeW;
      lastCursorY =
        y +
        headerH +
        bodyPadY +
        (codeLines.length - 1) * codeLineH +
        codeLineH / 2;
      lastCursorColor = '#f8f8f2';

      y += totalBoxH;
      if (!isLast) y += 12;
      continue;
    }

    if (tok.type === 'blockquote') {
      const bq = tok as Tokens.Blockquote;
      const bqStartY = y;
      const innerRes = processMarkdownBlock(
        ctx,
        bq.tokens,
        startX + (isViral16x9 ? 18 : 14),
        y,
        Math.max(60, maxWidth - (isViral16x9 ? 18 : 14)),
        { ...palette, textPrimary: palette.blockquoteFg },
        fontFamily,
        draw,
        cleanFontPx
      );
      if (draw) {
        ctx.fillStyle = palette.blockquoteBorder;
        ctx.fillRect(startX, bqStartY + 2, 2, Math.max(12, innerRes.height - 4));
      }
      y += innerRes.height;
      lastCursorX = innerRes.cursorX;
      lastCursorY = innerRes.cursorY;
      lastCursorColor = innerRes.cursorColor;
      if (!isLast) y += isViral16x9 ? 12 : 10;
      continue;
    }

    if (tok.type === 'hr') {
      y += 8;
      if (draw) {
        ctx.fillStyle = palette.hrBg;
        ctx.fillRect(startX, y, maxWidth, 1);
      }
      y += 10;
      continue;
    }

    if ('raw' in tok && typeof tok.raw === 'string' && tok.raw.trim()) {
      const runs: InlineRun[] = [
        {
          text: tok.raw.trim(),
          bold: false,
          italic: false,
          code: false,
          underline: false,
        },
      ];
      const lines = layoutInlineRuns(
        ctx,
        runs,
        maxWidth,
        bodySize,
        bodyLineH,
        fontFamily
      );
      drawLines(lines, startX, palette.textPrimary, bodySize);
      if (!isLast) y += isViral16x9 ? 10 : 8;
    }
  }

  return {
    height: Math.max(0, y - startY),
    cursorX: lastCursorX,
    cursorY: lastCursorY,
    cursorColor: lastCursorColor,
  };
}

function measureAttachmentBlock(
  attachment: MessageAttachment | null | undefined,
  imageCache: Map<string, HTMLImageElement>
): { width: number; height: number } {
  if (!attachment) return { width: 0, height: 0 };
  if (attachment.kind === 'image' && attachment.dataUrl) {
    const img = imageCache.get(attachment.dataUrl);
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const maxW = 240;
      const maxH = 180;
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      return {
        width: Math.max(80, Math.round(img.naturalWidth * ratio)),
        height: Math.max(60, Math.round(img.naturalHeight * ratio)),
      };
    }
    return { width: 220, height: 140 };
  }
  return { width: 220, height: 38 };
}

function drawAttachmentBlock(
  ctx: CanvasRenderingContext2D,
  attachment: MessageAttachment,
  x: number,
  y: number,
  size: { width: number; height: number },
  palette: SkinPalette,
  imageCache: Map<string, HTMLImageElement>
) {
  if (attachment.kind === 'image' && attachment.dataUrl) {
    const img = imageCache.get(attachment.dataUrl);
    ctx.save();
    roundedRectPath(ctx, x, y, size.width, size.height, 14);
    ctx.clip();
    ctx.fillStyle = palette.attachmentCardBg;
    ctx.fillRect(x, y, size.width, size.height);
    if (img && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, size.width, size.height);
    }
    ctx.restore();
    ctx.save();
    roundedRectPath(ctx, x, y, size.width, size.height, 14);
    ctx.strokeStyle = palette.attachmentCardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = palette.attachmentCardBg;
  roundedRectPath(ctx, x, y, size.width, size.height, 10);
  ctx.fill();
  ctx.strokeStyle = palette.attachmentCardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = palette.textSecondary;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.translate(x + 10, y + 11);
  ctx.scale(16 / 24, 16 / 24);
  ctx.stroke(new Path2D('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'));
  ctx.stroke(new Path2D('M14 2v6h6'));
  ctx.restore();

  ctx.fillStyle = palette.textPrimary;
  ctx.font = `500 12.5px ${INTER_FONT}`;
  ctx.textBaseline = 'middle';
  const maxNameW = size.width - 42;
  let label = attachment.name;
  while (label.length > 4 && ctx.measureText(label).width > maxNameW) {
    label = label.slice(0, -2) + '…';
  }
  ctx.fillText(label, x + 32, y + size.height / 2);
  ctx.restore();
}

// ============================================================================
// MAIN FRAME MEASUREMENT & 60 FPS NATIVE RENDERER
// ============================================================================

export function computeLogicalDimensions(
  ctx: CanvasRenderingContext2D,
  config: RenderConfig,
  finalMessages: ChatMessage[],
  imageCache: Map<string, HTMLImageElement> = new Map()
): { width: number; height: number } {
  if (config.previewMode === 'clean16x9') {
    return { width: 960, height: 540 };
  }

  const isMobile = config.device === 'mobile';
  const sidebarW = config.showSidebar && !isMobile ? 196 : 0;
  const width = isMobile ? 390 : 760;
  const chatAreaW = width - sidebarW;
  const baseMinHeight = isMobile ? 640 : 540;
  const maxViewportHeight = isMobile ? 844 : 760;

  const statusH =
    config.showHeader && isMobile && config.showIosStatusBar ? 38 : 0;
  const headerH = config.showHeader ? (isMobile ? 48 : 56) : 0;
  const composerTallSkin =
    config.skin === 'claude' || config.skin === 'grok';
  const composerH = config.showBottomBar
    ? composerTallSkin
      ? isMobile
        ? 98
        : 106
      : isMobile
        ? 68
        : 76
    : 0;
  const disclaimerH = config.showFooterDisclaimer ? 24 : 0;

  const contentContainerW = isMobile ? chatAreaW : Math.min(chatAreaW, 680);
  const padX = isMobile ? 16 : 24;
  const padTop = isMobile ? 16 : 22;
  const padBottom = isMobile ? 24 : 28;
  const msgGap = isMobile ? 22 : 28;
  const palette = getSkinPalette(config.skin, config.theme);

  let messagesH = 0;
  const visibleMessages = finalMessages.filter((m) => !m.cueKind);
  visibleMessages.forEach((msg, idx) => {
    if (idx > 0) messagesH += msgGap;
    if (msg.role === 'system') {
      const bodyW = contentContainerW - padX * 2;
      const lines = wrapPlainText(
        ctx,
        msg.content || ' ',
        Math.max(80, bodyW * 0.85 - 28),
        `500 12px ${INTER_FONT}`
      );
      messagesH += lines.length * 16 + 10;
    } else if (msg.role === 'user') {
      const attSize = measureAttachmentBlock(msg.attachment, imageCache);
      const attH = attSize.height > 0 ? attSize.height + 8 : 0;
      const bodyW = contentContainerW - padX * 2;
      if (config.skin === 'claude') {
        const textMaxW = bodyW - 28 - 38;
        const lines = wrapPlainText(ctx, msg.content, textMaxW, `400 15px ${INTER_FONT}`);
        messagesH += attH + Math.max(44, lines.length * 23 + 22);
      } else {
        const maxBubbleW = bodyW * (isMobile ? 0.8 : 0.7);
        const lines = wrapPlainText(
          ctx,
          msg.content,
          maxBubbleW - (isMobile ? 32 : 36),
          `400 15px ${INTER_FONT}`
        );
        const bubblePadY = isMobile ? 20 : 22;
        messagesH += attH + lines.length * 23 + bubblePadY;
      }
    } else {
      const avatarGap = isMobile ? 12 : 16;
      const bodyMaxW = contentContainerW - padX * 2 - 28 - avatarGap;
      const senderBadgeH = config.skin === 'multi' ? 24 : 0;
      const thoughtH =
        config.enableThoughtPill && msg.thoughtDuration?.trim() ? 36 : 0;
      const effectiveSender: MessageSenderSkin =
        config.skin === 'multi' ? (msg.senderSkin ?? 'chatgpt') : config.skin;
      const mdRes = processMarkdownBlock(
        ctx,
        getMarkdownTokens(msg.content),
        0,
        0,
        bodyMaxW,
        palette,
        getBodyFontFamily(effectiveSender),
        false,
        0
      );
      messagesH += Math.max(28, senderBadgeH + thoughtH + mdRes.height + 25);
    }
  });

  const totalFinalHeight =
    statusH +
    headerH +
    padTop +
    messagesH +
    padBottom +
    composerH +
    disclaimerH;

  return {
    width,
    height: Math.max(
      baseMinHeight,
      Math.min(Math.ceil(totalFinalHeight), maxViewportHeight)
    ),
  };
}

function drawInFrameSidebar(
  ctx: CanvasRenderingContext2D,
  sidebarW: number,
  logicalHeight: number,
  palette: SkinPalette,
  skin: AiSkin
) {
  ctx.save();
  ctx.fillStyle = palette.sidebarBg;
  ctx.fillRect(0, 0, sidebarW, logicalHeight);
  ctx.fillStyle = palette.sidebarBorder;
  ctx.fillRect(sidebarW - 1, 0, 1, logicalHeight);

  drawSidebarToggleIcon(ctx, 16, 18, palette.textSecondary);
  drawNewChatIcon(ctx, sidebarW - 34, 18, 18, palette.textSecondary);

  const items = [
    'Active conversation',
    'API refactor notes',
    'Release checklist',
    'UI layout brainstorm',
  ];

  items.forEach((label, idx) => {
    const iy = 64 + idx * 34;
    if (idx === 0) {
      ctx.fillStyle = palette.pillBg;
      roundedRectPath(ctx, 10, iy - 14, sidebarW - 20, 28, 8);
      ctx.fill();
    }
    ctx.fillStyle = idx === 0 ? palette.textPrimary : palette.textSecondary;
    ctx.font = `${idx === 0 ? 500 : 400} 12.5px ${
      skin === 'claude' ? CLAUDE_SERIF_FONT : INTER_FONT
    }`;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 18, iy);
  });
  ctx.restore();
}

export function renderChatFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  logicalWidth: number,
  logicalHeight: number,
  scale: number,
  config: RenderConfig,
  frame: AnimationFrameState,
  scrollState: ScrollState,
  imageCache: Map<string, HTMLImageElement> = new Map(),
  gifCache?: Map<string, DecodedGifTrack>
): void {
  const isClean16x9 = config.previewMode === 'clean16x9';
  const isMobile = !isClean16x9 && config.device === 'mobile';
  const activeCleanFont = isClean16x9 ? (config.cleanFontSize ?? 28) : 0;
  const isXL = activeCleanFont >= 32;
  const msgFontSize = isClean16x9 ? activeCleanFont - 2 : 15;
  const userLineH = isClean16x9 ? Math.round((activeCleanFont - 2) * 1.34) : 23;
  const avatarSize = isClean16x9 ? (isXL ? 48 : 42) : 28;
  const avatarGap = isClean16x9 ? 18 : isMobile ? 12 : 16;

  const basePalette = getSkinPalette(config.skin, config.theme);
  const palette: SkinPalette =
    isClean16x9 && config.theme === 'dark'
      ? {
          ...basePalette,
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
        }
      : basePalette;

  const skinMeta = AI_SKINS[config.skin];
  const displayModel = config.modelLabel.trim() || skinMeta.defaultModel;
  const sidebarW = config.showSidebar && !isMobile ? 196 : 0;
  const chatAreaX = sidebarW;
  const chatAreaW = logicalWidth - sidebarW;

  const composerPlaceholderText =
    isClean16x9 || config.skin === 'multi'
      ? 'Ask anything'
      : skinMeta.composerPlaceholder;
  const disclaimerText =
    isClean16x9 || config.skin === 'multi'
      ? 'AI can make mistakes. Check important info.'
      : skinMeta.disclaimer;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Full Canvas Background
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // Top Chrome Geometry
  const statusH =
    config.showHeader && isMobile && config.showIosStatusBar ? 38 : 0;
  const headerH = config.showHeader ? (isMobile ? 48 : 56) : 0;
  const topChromeH = statusH + headerH;

  // Bottom Chrome Geometry (Edge-to-Edge in 16:9 Clean Focus)
  const composerOuterW = isClean16x9
    ? chatAreaW - 44
    : isMobile
      ? chatAreaW - 28
      : Math.min(chatAreaW, 680) - 48;
  const composerLeft = chatAreaX + (chatAreaW - composerOuterW) / 2;
  const isTwoRowComposer =
    !isClean16x9 && (config.skin === 'claude' || config.skin === 'grok');
  const composerFontSize = isClean16x9 ? 23 : 15;
  const composerLineH = isClean16x9 ? 32 : 22;
  const composerTextMaxW = isTwoRowComposer
    ? Math.max(80, composerOuterW - 32)
    : Math.max(80, composerOuterW - (isClean16x9 ? 156 : 118));

  let composerLines: string[] = [];
  let composerBoxH = 0;
  if (config.showBottomBar) {
    if (frame.composerDraft) {
      composerLines = wrapPlainText(
        ctx,
        frame.composerDraft,
        composerTextMaxW,
        `400 ${composerFontSize}px ${INTER_FONT}`
      );
    }
    const textH = Math.max(composerLineH, composerLines.length * composerLineH);
    composerBoxH = isTwoRowComposer
      ? textH + 54
      : textH + (isClean16x9 ? 26 : isMobile ? 18 : 22);
  }

  const disclaimerH = config.showFooterDisclaimer ? 24 : 0;
  const composerPadBottom = config.showBottomBar
    ? config.showFooterDisclaimer
      ? 4
      : isClean16x9
        ? 14
        : isMobile
          ? 18
          : 24
    : config.showFooterDisclaimer
      ? 12
      : 0;
  const bottomChromeH =
    (config.showBottomBar ? composerBoxH + 6 : 0) +
    disclaimerH +
    composerPadBottom;
  const scrollViewportH = Math.max(
    80,
    logicalHeight - topChromeH - bottomChromeH
  );

  // Measure visible messages for smooth auto-scroll (edge-to-edge in 16:9 Clean Focus)
  const contentContainerW = isClean16x9
    ? chatAreaW
    : isMobile
      ? chatAreaW
      : Math.min(chatAreaW, 680);
  const contentOriginX = chatAreaX + (chatAreaW - contentContainerW) / 2;
  const padX = isClean16x9 ? 22 : isMobile ? 16 : 24;
  const padTop = isClean16x9 ? 16 : isMobile ? 16 : 22;
  const padBottom = isClean16x9 ? 16 : isMobile ? 18 : 22;
  const msgGap = isClean16x9 ? 22 : isMobile ? 22 : 28;
  const bodyX = contentOriginX + padX;
  const bodyW = contentContainerW - padX * 2;

  let cursorContentY = padTop;
  interface LayoutItem {
    kind: 'user' | 'assistant' | 'system' | 'thinking';
    y: number;
    height: number;
    msg?: RenderedFrameMessage;
    userLines?: string[];
    systemLines?: string[];
    pillW?: number;
    pillH?: number;
    bubbleW?: number;
    bubbleH?: number;
    attSize?: { width: number; height: number };
    mdTokens?: Token[];
  }

  const layoutItems: LayoutItem[] = [];

  frame.messages.forEach((msg, idx) => {
    if (idx > 0) cursorContentY += msgGap;

    if (msg.role === 'system') {
      const sysFontSize = isClean16x9 ? Math.round(activeCleanFont * 0.62) : 12;
      const sysLineH = Math.round(sysFontSize * 1.35);
      const padPillX = isClean16x9 ? 20 : 14;
      const padPillY = isClean16x9 ? 8 : 5;
      const maxPillW = bodyW * (isClean16x9 ? 0.88 : 0.85);
      const font = `500 ${sysFontSize}px ${INTER_FONT}`;
      const lines = wrapPlainText(
        ctx,
        msg.content || ' ',
        Math.max(80, maxPillW - padPillX * 2),
        font
      );
      ctx.font = font;
      let maxLineW = 0;
      for (const l of lines) {
        maxLineW = Math.max(maxLineW, ctx.measureText(l).width);
      }
      const pillW = Math.min(maxPillW, Math.max(64, maxLineW + padPillX * 2));
      const pillH = lines.length * sysLineH + padPillY * 2;
      layoutItems.push({
        kind: 'system',
        y: cursorContentY,
        height: pillH,
        msg,
        systemLines: lines,
        pillW,
        pillH,
      });
      cursorContentY += pillH;
    } else if (msg.role === 'user') {
      const attSize = measureAttachmentBlock(msg.attachment, imageCache);
      const attH = attSize.height > 0 ? attSize.height + 8 : 0;
      const font = `400 ${msgFontSize}px ${INTER_FONT}`;

      if (config.skin === 'claude') {
        const innerPadX = isClean16x9 ? 20 : 14;
        const innerPadY = isClean16x9 ? 14 : 11;
        const uCircleOffset = isClean16x9 ? 53 : 36;
        const textMaxW = bodyW - innerPadX * 2 - uCircleOffset;
        const lines = wrapPlainText(ctx, msg.content || ' ', textMaxW, font);
        const bubbleH = Math.max(
          isClean16x9 ? 66 : 44,
          lines.length * userLineH + innerPadY * 2
        );
        layoutItems.push({
          kind: 'user',
          y: cursorContentY,
          height: attH + bubbleH,
          msg,
          userLines: lines,
          bubbleW: bodyW,
          bubbleH,
          attSize,
        });
        cursorContentY += attH + bubbleH;
      } else {
        const maxBubbleW = bodyW * (isClean16x9 ? 0.82 : isMobile ? 0.8 : 0.7);
        const innerPadX = isClean16x9 ? 24 : isMobile ? 16 : 18;
        const innerPadY = isClean16x9 ? 14 : isMobile ? 10 : 11;
        const lines = wrapPlainText(
          ctx,
          msg.content || ' ',
          maxBubbleW - innerPadX * 2,
          font
        );
        ctx.font = font;
        let maxLineW = 0;
        for (const l of lines) {
          maxLineW = Math.max(maxLineW, ctx.measureText(l).width);
        }
        const bubbleW = Math.min(maxBubbleW, Math.max(60, maxLineW + innerPadX * 2));
        const bubbleH = lines.length * userLineH + innerPadY * 2;
        layoutItems.push({
          kind: 'user',
          y: cursorContentY,
          height: attH + bubbleH,
          msg,
          userLines: lines,
          bubbleW,
          bubbleH,
          attSize,
        });
        cursorContentY += attH + bubbleH;
      }
    } else {
      const mdMaxW = bodyW - avatarSize - avatarGap;
      const tokens = getMarkdownTokens(msg.content);
      const effectiveSender: MessageSenderSkin =
        config.skin === 'multi' ? (msg.senderSkin ?? 'chatgpt') : config.skin;
      const mdRes = processMarkdownBlock(
        ctx,
        tokens,
        0,
        0,
        mdMaxW,
        palette,
        getBodyFontFamily(effectiveSender),
        false,
        activeCleanFont
      );
      const senderBadgeH = config.skin === 'multi' ? (isClean16x9 ? 33 : 24) : 0;
      const thoughtH =
        config.enableThoughtPill && msg.thoughtDuration?.trim()
          ? isClean16x9
            ? 44
            : 36
          : 0;
      const actionsH = msg.isStreaming ? 0 : isClean16x9 ? 31 : 25;
      const itemH = Math.max(
        avatarSize,
        senderBadgeH + thoughtH + mdRes.height + actionsH
      );
      layoutItems.push({
        kind: 'assistant',
        y: cursorContentY,
        height: itemH,
        msg,
        mdTokens: tokens,
      });
      cursorContentY += itemH;
    }
  });

  if (frame.isThinking) {
    if (frame.messages.length > 0) cursorContentY += msgGap;
    layoutItems.push({
      kind: 'thinking',
      y: cursorContentY,
      height: avatarSize,
    });
    cursorContentY += avatarSize;
  }

  const totalContentH = cursorContentY + padBottom;
  const targetScrollY = Math.max(0, totalContentH - scrollViewportH);
  if (Math.abs(targetScrollY - scrollState.y) < 0.5) {
    scrollState.y = targetScrollY;
  } else {
    scrollState.y += (targetScrollY - scrollState.y) * 0.24;
  }

  // Draw Scrollable Chat Feed Clipped Between Top Chrome & Bottom Chrome
  ctx.save();
  ctx.beginPath();
  ctx.rect(chatAreaX, topChromeH, chatAreaW, scrollViewportH);
  ctx.clip();

  for (const item of layoutItems) {
    const drawY = topChromeH + item.y - scrollState.y;
    if (
      drawY + item.height < topChromeH - 40 ||
      drawY > topChromeH + scrollViewportH + 40
    ) {
      continue;
    }

    if (
      item.kind === 'system' &&
      item.msg &&
      item.systemLines &&
      item.pillW &&
      item.pillH
    ) {
      const sysColors = getSystemPillColors(config.theme, isClean16x9);
      const sysFontSize = isClean16x9 ? Math.round(activeCleanFont * 0.62) : 12;
      const sysLineH = Math.round(sysFontSize * 1.35);
      const padPillY = isClean16x9 ? 8 : 5;
      const t = item.msg.systemAnimate === false ? 1 : item.msg.enterProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      const scaleFactor = 0.94 + 0.06 * eased;
      const offsetY = (1 - eased) * 6;
      const centerX = bodyX + bodyW / 2;
      const centerY = drawY + item.pillH / 2 + offsetY;

      ctx.save();
      ctx.globalAlpha = eased;
      ctx.translate(centerX, centerY);
      ctx.scale(scaleFactor, scaleFactor);
      ctx.translate(-item.pillW / 2, -item.pillH / 2);

      ctx.fillStyle = sysColors.bg;
      roundedRectPath(ctx, 0, 0, item.pillW, item.pillH, 999);
      ctx.fill();
      ctx.strokeStyle = sysColors.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = sysColors.text;
      ctx.font = `500 ${sysFontSize}px ${INTER_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      item.systemLines.forEach((line, li) => {
        ctx.fillText(
          line,
          item.pillW! / 2,
          padPillY + li * sysLineH + sysLineH / 2
        );
      });
      ctx.restore();
    } else if (
      item.kind === 'user' &&
      item.msg &&
      item.userLines &&
      item.bubbleW &&
      item.bubbleH
    ) {
      const t = item.msg.enterProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      const offsetY = (1 - eased) * 10;

      ctx.save();
      ctx.globalAlpha = eased;

      let textBubbleY = drawY + offsetY;
      if (item.msg.attachment && item.attSize && item.attSize.height > 0) {
        const attX =
          config.skin === 'claude'
            ? bodyX
            : bodyX + bodyW - item.attSize.width;
        drawAttachmentBlock(
          ctx,
          item.msg.attachment,
          attX,
          textBubbleY,
          item.attSize,
          palette,
          imageCache
        );
        textBubbleY += item.attSize.height + 8;
      }

      if (config.skin === 'claude') {
        const innerPadX = isClean16x9 ? 20 : 14;
        const innerPadY = isClean16x9 ? 14 : 11;
        const uCircleR = isClean16x9 ? 19 : 12;
        const uCircleCx = bodyX + innerPadX + uCircleR;
        const uCircleCy = textBubbleY + innerPadY + uCircleR;

        ctx.fillStyle = palette.userBubbleBg;
        roundedRectPath(
          ctx,
          bodyX,
          textBubbleY,
          item.bubbleW,
          item.bubbleH,
          isClean16x9 ? 18 : 14
        );
        ctx.fill();
        ctx.strokeStyle = palette.userBubbleBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = config.theme === 'dark' ? '#57544c' : '#2b2a27';
        ctx.beginPath();
        ctx.arc(uCircleCx, uCircleCy, uCircleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${isClean16x9 ? 16 : 11}px ${INTER_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('U', uCircleCx, uCircleCy + 0.5);
        ctx.textAlign = 'left';

        ctx.fillStyle = palette.textPrimary;
        ctx.font = `400 ${msgFontSize}px ${INTER_FONT}`;
        const textOffsetX = innerPadX + uCircleR * 2 + (isClean16x9 ? 15 : 12);
        item.userLines.forEach((line, li) => {
          ctx.fillText(
            line,
            bodyX + textOffsetX,
            textBubbleY + innerPadY + li * userLineH + userLineH / 2
          );
        });
      } else {
        const radius =
          config.skin === 'grok'
            ? isClean16x9
              ? 18
              : 14
            : isClean16x9
              ? 28
              : 22;
        const bx = bodyX + bodyW - item.bubbleW;
        ctx.fillStyle = palette.userBubbleBg;
        roundedRectPath(ctx, bx, textBubbleY, item.bubbleW, item.bubbleH, radius);
        ctx.fill();
        if (config.skin === 'grok' || config.skin === 'multi') {
          ctx.strokeStyle = palette.userBubbleBorder;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.fillStyle = palette.textPrimary;
        ctx.font = `400 ${msgFontSize}px ${INTER_FONT}`;
        ctx.textBaseline = 'middle';
        const innerPadX = isClean16x9 ? 24 : isMobile ? 16 : 18;
        const innerPadY = isClean16x9 ? 14 : isMobile ? 10 : 11;
        item.userLines.forEach((line, li) => {
          ctx.fillText(
            line,
            bx + innerPadX,
            textBubbleY + innerPadY + li * userLineH + userLineH / 2
          );
        });
      }
      ctx.restore();
    } else if (item.kind === 'assistant' && item.msg && item.mdTokens) {
      const mdX = bodyX + avatarSize + avatarGap;
      const mdW = bodyW - avatarSize - avatarGap;
      const effectiveSender: MessageSenderSkin =
        config.skin === 'multi'
          ? (item.msg.senderSkin ?? 'chatgpt')
          : config.skin;

      drawAiAvatar(
        ctx,
        effectiveSender,
        bodyX,
        drawY + 2,
        palette,
        item.msg.customSenderColor,
        item.msg.customSenderIcon,
        avatarSize,
        item.msg.customSenderAvatar,
        imageCache
      );

      let contentDrawY = drawY;

      if (config.skin === 'multi') {
        const badge = getSenderBadgeMeta(item.msg, config.skin, config.theme);
        const badgeFontSize = isClean16x9 ? 14 : 11;
        const badgeH = isClean16x9 ? 26 : 19;
        ctx.font = `600 ${badgeFontSize}px ${INTER_FONT}`;
        const bw = ctx.measureText(badge.label).width + (isClean16x9 ? 20 : 14);
        ctx.fillStyle = badge.badgeBg;
        roundedRectPath(ctx, mdX, contentDrawY, bw, badgeH, isClean16x9 ? 8 : 6);
        ctx.fill();
        ctx.strokeStyle = badge.badgeBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = badge.badgeText;
        ctx.textBaseline = 'middle';
        ctx.fillText(
          badge.label,
          mdX + (isClean16x9 ? 10 : 7),
          contentDrawY + badgeH / 2 + 0.5
        );
        contentDrawY += badgeH + (isClean16x9 ? 7 : 5);
      }

      if (config.enableThoughtPill && item.msg.thoughtDuration?.trim()) {
        const thoughtLabel = `Thought for ${item.msg.thoughtDuration.trim()}`;
        const thoughtFontSize = isClean16x9 ? 16 : 12.5;
        ctx.font = `500 ${thoughtFontSize}px ${INTER_FONT}`;
        const tw = ctx.measureText(thoughtLabel).width;
        const pillW = tw + (isClean16x9 ? 42 : 34);
        const pillH = isClean16x9 ? 34 : 26;
        ctx.fillStyle = palette.thoughtBg;
        roundedRectPath(ctx, mdX, contentDrawY, pillW, pillH, 10);
        ctx.fill();
        ctx.strokeStyle = palette.thoughtBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = palette.thoughtText;
        ctx.textBaseline = 'middle';
        ctx.fillText(
          thoughtLabel,
          mdX + (isClean16x9 ? 12 : 10),
          contentDrawY + pillH / 2 + 0.5
        );

        ctx.save();
        ctx.translate(
          mdX + (isClean16x9 ? 12 : 10) + tw + 6,
          contentDrawY + pillH / 2 - (isClean16x9 ? 6 : 5)
        );
        const chevScale = isClean16x9 ? 13 / 24 : 10 / 24;
        ctx.scale(chevScale, chevScale);
        ctx.strokeStyle = palette.thoughtText;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(9, 6);
        ctx.lineTo(15, 12);
        ctx.lineTo(9, 18);
        ctx.stroke();
        ctx.restore();

        contentDrawY += pillH + 10;
      }

      const res = processMarkdownBlock(
        ctx,
        item.mdTokens,
        mdX,
        contentDrawY,
        mdW,
        palette,
        getBodyFontFamily(effectiveSender),
        true,
        activeCleanFont
      );

      if (item.msg.isStreaming) {
        const pulse =
          0.28 +
          0.72 * (0.5 + 0.5 * Math.cos((frame.timeMs / 850) * Math.PI * 2));
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle =
          effectiveSender === 'claude' ? '#d97757' : res.cursorColor;
        ctx.beginPath();
        ctx.arc(res.cursorX + (isClean16x9 ? 12 : 9), res.cursorY, isClean16x9 ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawSkinActionIconsRow(
          ctx,
          effectiveSender,
          mdX,
          contentDrawY + res.height + 10,
          palette.textMuted,
          isClean16x9 ? 21 : 15,
          isClean16x9 ? 39 : 27
        );
      }
    } else if (item.kind === 'thinking') {
      const thinkingSkin: MessageSenderSkin =
        config.skin === 'multi'
          ? (frame.thinkingSender?.senderSkin ?? 'chatgpt')
          : config.skin;
      drawAiAvatar(
        ctx,
        thinkingSkin,
        bodyX,
        drawY,
        palette,
        config.skin === 'multi'
          ? frame.thinkingSender?.customSenderColor
          : undefined,
        config.skin === 'multi'
          ? frame.thinkingSender?.customSenderIcon
          : undefined,
        avatarSize,
        config.skin === 'multi'
          ? frame.thinkingSender?.customSenderAvatar
          : undefined,
        imageCache
      );
      const pulse =
        0.28 +
        0.72 * (0.5 + 0.5 * Math.cos((frame.timeMs / 1000) * Math.PI * 2));
      const dotScale = 0.84 + 0.16 * pulse;
      const dotRadius = isClean16x9 ? 7.5 : 5.5;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle =
        thinkingSkin === 'claude' ? '#d97757' : palette.textPrimary;
      ctx.beginPath();
      ctx.arc(
        bodyX + avatarSize + avatarGap + dotRadius,
        drawY + avatarSize / 2,
        dotRadius * dotScale,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore(); // End feed clip

  // Draw Sticky Top Chrome (Optional Header)
  if (config.showHeader) {
    ctx.fillStyle = palette.canvasBg;
    ctx.fillRect(chatAreaX, 0, chatAreaW, topChromeH);

    if (isMobile && config.showIosStatusBar) {
      drawIosStatusBar(ctx, logicalWidth, palette.textPrimary);
    }

    const headerTop = statusH;
    const headerCenterY = headerTop + headerH / 2;

    if (config.skin === 'claude') {
      if (!config.showSidebar) {
        drawSidebarToggleIcon(ctx, chatAreaX + 18, headerCenterY - 10, palette.textSecondary);
      }
      const modelX = chatAreaX + (config.showSidebar ? 20 : 52);
      ctx.font = `500 17px ${CLAUDE_SERIF_FONT}`;
      const labelW = ctx.measureText(displayModel).width;
      ctx.fillStyle = palette.textPrimary;
      ctx.textBaseline = 'middle';
      ctx.fillText(displayModel, modelX, headerCenterY);
      drawChevronDown(ctx, modelX + labelW + 5, headerCenterY - 7, 15, palette.textMuted);

      drawStarIcon(ctx, logicalWidth - 62, headerCenterY - 8.5, 17, palette.textSecondary);
      drawShareIcon(ctx, logicalWidth - 34, headerCenterY - 8.5, 17, palette.textSecondary);
    } else if (config.skin === 'gemini') {
      if (!config.showSidebar) {
        drawHamburgerIcon(ctx, chatAreaX + 18, headerCenterY - 10, palette.textSecondary);
      }
      const gemX = chatAreaX + (config.showSidebar ? 20 : 50);
      ctx.font = `500 18px ${INTER_FONT}`;
      ctx.fillStyle = palette.textPrimary;
      ctx.textBaseline = 'middle';
      ctx.fillText('Gemini', gemX, headerCenterY);
      const gemW = ctx.measureText('Gemini').width;

      ctx.font = `500 12px ${INTER_FONT}`;
      const pillLabelW = ctx.measureText(displayModel).width;
      const pillX = gemX + gemW + 8;
      const pillW = pillLabelW + 24;
      const pillH = 22;
      ctx.fillStyle = palette.pillBg;
      roundedRectPath(ctx, pillX, headerCenterY - pillH / 2, pillW, pillH, 999);
      ctx.fill();
      ctx.fillStyle = palette.textSecondary;
      ctx.fillText(displayModel, pillX + 9, headerCenterY + 0.5);
      drawChevronDown(ctx, pillX + 9 + pillLabelW + 2, headerCenterY - 6, 12, palette.textMuted);

      ctx.fillStyle = '#1a73e8';
      ctx.beginPath();
      ctx.arc(logicalWidth - 28, headerCenterY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 12px ${INTER_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('A', logicalWidth - 28, headerCenterY + 0.5);
      ctx.textAlign = 'left';
    } else if (config.skin === 'grok') {
      ctx.strokeStyle = palette.hrBg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chatAreaX, topChromeH - 0.5);
      ctx.lineTo(logicalWidth, topChromeH - 0.5);
      ctx.stroke();

      ctx.font = `600 17px ${INTER_FONT}`;
      const labelW = ctx.measureText(displayModel).width;
      ctx.fillStyle = palette.textPrimary;
      ctx.textBaseline = 'middle';
      ctx.fillText(displayModel, chatAreaX + 18, headerCenterY);
      drawChevronDown(ctx, chatAreaX + 18 + labelW + 5, headerCenterY - 7, 15, palette.textMuted);

      drawGhostIcon(ctx, logicalWidth - 68, headerCenterY - 9.5, 19, palette.textSecondary);
      drawNewChatIcon(ctx, logicalWidth - 38, headerCenterY - 9.5, 19, palette.textSecondary);
    } else {
      if (isMobile) {
        drawHamburgerIcon(ctx, 16, headerCenterY - 10, palette.textSecondary);
        ctx.font = `600 16px ${INTER_FONT}`;
        const labelW = ctx.measureText(displayModel).width;
        const totalW = labelW + 4 + 15;
        const labelStartX = (logicalWidth - totalW) / 2;
        ctx.fillStyle = palette.textPrimary;
        ctx.textBaseline = 'middle';
        ctx.fillText(displayModel, labelStartX, headerCenterY);
        drawChevronDown(ctx, labelStartX + labelW + 4, headerCenterY - 7, 15, palette.textMuted);
        drawNewChatIcon(ctx, logicalWidth - 35, headerCenterY - 9.5, 19, palette.textSecondary);
      } else {
        if (!config.showSidebar) {
          drawSidebarToggleIcon(ctx, chatAreaX + 18, headerCenterY - 10, palette.textSecondary);
        }
        const modelX = chatAreaX + (config.showSidebar ? 20 : 52);
        ctx.font = `600 17px ${INTER_FONT}`;
        const labelW = ctx.measureText(displayModel).width;
        ctx.fillStyle = palette.textPrimary;
        ctx.textBaseline = 'middle';
        ctx.fillText(displayModel, modelX, headerCenterY);
        drawChevronDown(ctx, modelX + labelW + 5, headerCenterY - 7, 16, palette.textMuted);
        drawNewChatIcon(ctx, logicalWidth - 38, headerCenterY - 10, 20, palette.textSecondary);
      }
    }
  }

  // Draw Sticky Bottom Chrome (Composer Bar + Optional Footer Disclaimer)
  if (config.showBottomBar || config.showFooterDisclaimer) {
    ctx.fillStyle = palette.canvasBg;
    ctx.fillRect(
      chatAreaX,
      logicalHeight - bottomChromeH - 4,
      chatAreaW,
      bottomChromeH + 4
    );
  }

  if (config.showBottomBar) {
    const composerBottomY = logicalHeight - disclaimerH - composerPadBottom;
    const composerTop = composerBottomY - composerBoxH;

    ctx.save();
    ctx.fillStyle = palette.composerBg;
    roundedRectPath(
      ctx,
      composerLeft,
      composerTop,
      composerOuterW,
      composerBoxH,
      isTwoRowComposer ? 18 : isClean16x9 ? 34 : 26
    );
    ctx.fill();
    ctx.strokeStyle = palette.composerBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isTwoRowComposer) {
      const textX = composerLeft + 16;
      const topTextY = composerTop + 14;
      ctx.font = `400 15px ${INTER_FONT}`;
      ctx.textBaseline = 'middle';
      if (frame.composerDraft) {
        ctx.fillStyle = palette.textPrimary;
        composerLines.forEach((line, li) => {
          ctx.fillText(line, textX, topTextY + li * 22 + 11);
        });
      } else {
        ctx.fillStyle = palette.textMuted;
        ctx.fillText(composerPlaceholderText, textX, topTextY + 11);
      }

      const bottomRowY = composerTop + composerBoxH - 22;

      if (config.skin === 'claude') {
        drawPlusIcon(ctx, composerLeft + 14, bottomRowY - 8.5, 17, palette.textSecondary);

        ctx.font = `500 12px ${INTER_FONT}`;
        const pillW = ctx.measureText(displayModel).width + 24;
        const sendX = composerLeft + composerOuterW - 26;
        const pillX = sendX - 22 - pillW;
        ctx.fillStyle = palette.pillBg;
        roundedRectPath(ctx, pillX, bottomRowY - 12, pillW, 24, 999);
        ctx.fill();
        ctx.fillStyle = palette.pillText;
        ctx.fillText(displayModel, pillX + 8, bottomRowY + 0.5);
        drawChevronDown(ctx, pillX + pillW - 15, bottomRowY - 5, 11, palette.textMuted);

        const sendScale = frame.sendHighlighted ? 1.12 : 1;
        ctx.save();
        ctx.translate(sendX, bottomRowY);
        ctx.scale(sendScale, sendScale);
        if (frame.sendHighlighted) {
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(217, 119, 87, 0.25)';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = palette.sendBtnBg;
        ctx.fill();
        drawSendArrowIcon(ctx, -7.5, -7.5, palette.sendBtnFg);
        ctx.restore();
      } else {
        ctx.font = `500 11.5px ${INTER_FONT}`;
        const drawPill = (px: number, label: string) => {
          const w = ctx.measureText(label).width + 20;
          ctx.fillStyle = palette.pillBg;
          roundedRectPath(ctx, px, bottomRowY - 12, w, 24, 999);
          ctx.fill();
          ctx.strokeStyle = palette.pillBorder;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = palette.pillText;
          ctx.fillText(label, px + 10, bottomRowY + 0.5);
          return w;
        };
        const w1 = drawPill(composerLeft + 14, 'DeepSearch');
        drawPill(composerLeft + 14 + w1 + 6, 'Think');

        const sendX = composerLeft + composerOuterW - 26;
        const sendScale = frame.sendHighlighted ? 1.12 : 1;
        ctx.save();
        ctx.translate(sendX, bottomRowY);
        ctx.scale(sendScale, sendScale);
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = frame.sendHighlighted ? '#10a37f' : palette.sendBtnBg;
        ctx.fill();
        drawSendArrowIcon(
          ctx,
          -7.5,
          -7.5,
          frame.sendHighlighted ? '#ffffff' : palette.sendBtnFg
        );
        ctx.restore();
      }
    } else {
      const leftPad = isClean16x9 ? 22 : isMobile ? 14 : 16;
      const rightPad = isClean16x9 ? 14 : isMobile ? 10 : 12;
      const compIconSize = isClean16x9 ? 24 : 18;
      const sendRadius = isClean16x9 ? 20 : 15;
      const sendArrowSize = isClean16x9 ? 20 : 15;
      const barCenterY = composerTop + composerBoxH / 2;

      if (config.skin === 'gemini') {
        drawPlusIcon(
          ctx,
          composerLeft + leftPad,
          barCenterY - compIconSize / 2,
          compIconSize,
          palette.textSecondary
        );
      } else {
        drawPaperclipIcon(
          ctx,
          composerLeft + leftPad,
          barCenterY - compIconSize / 2,
          palette.textSecondary,
          compIconSize
        );
      }

      const textX = composerLeft + leftPad + compIconSize + (isClean16x9 ? 14 : 10);
      ctx.font = `400 ${composerFontSize}px ${INTER_FONT}`;
      ctx.textBaseline = 'middle';
      if (frame.composerDraft) {
        ctx.fillStyle = palette.textPrimary;
        const topTextY = composerTop + (isClean16x9 ? 13 : isMobile ? 9 : 11);
        composerLines.forEach((line, li) => {
          ctx.fillText(
            line,
            textX,
            topTextY + li * composerLineH + composerLineH / 2
          );
        });
      } else {
        ctx.fillStyle = palette.textMuted;
        ctx.fillText(composerPlaceholderText, textX, barCenterY);
      }

      const sendBtnX = composerLeft + composerOuterW - rightPad - sendRadius;
      const voiceX = sendBtnX - sendRadius - (isClean16x9 ? 12 : 8) - compIconSize - 4;
      if (config.skin === 'gemini') {
        drawMicIcon(
          ctx,
          voiceX,
          barCenterY - compIconSize / 2,
          palette.textSecondary,
          compIconSize
        );
      } else {
        drawVoiceWaveformIcon(
          ctx,
          voiceX,
          barCenterY - compIconSize / 2,
          palette.textSecondary,
          compIconSize
        );
      }

      const sendScale = frame.sendHighlighted ? 1.12 : 1;
      ctx.save();
      ctx.translate(sendBtnX, barCenterY);
      ctx.scale(sendScale, sendScale);
      if (frame.sendHighlighted) {
        ctx.beginPath();
        ctx.arc(0, 0, sendRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 163, 127, 0.25)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, sendRadius, 0, Math.PI * 2);
      ctx.fillStyle = frame.sendHighlighted ? '#10a37f' : palette.sendBtnBg;
      ctx.fill();
      drawSendArrowIcon(
        ctx,
        -sendArrowSize / 2,
        -sendArrowSize / 2,
        frame.sendHighlighted ? '#ffffff' : palette.sendBtnFg,
        sendArrowSize
      );
      ctx.restore();
    }

    ctx.restore();
  }

  if (config.showFooterDisclaimer) {
    ctx.save();
    ctx.fillStyle = palette.textMuted;
    ctx.font = `400 ${isClean16x9 ? 14 : 11.5}px ${INTER_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      disclaimerText,
      chatAreaX + chatAreaW / 2,
      logicalHeight - 13
    );
    ctx.restore();
  }

  // Draw Optional In-Frame Sidebar on top of full height on the left
  if (sidebarW > 0) {
    drawInFrameSidebar(ctx, sidebarW, logicalHeight, palette, config.skin);
  }

  // Draw 16:9 Clean Focus Stage Overlays (Full-Time & Timed Popups)
  if (isClean16x9 && config.overlays && config.overlays.length > 0) {
    drawStageOverlays(
      ctx,
      logicalWidth,
      logicalHeight,
      config.overlays,
      frame.timeMs / 1000,
      imageCache,
      gifCache
    );
  }

  // Draw Script Visual Effects (Red Flash / Hard Cut to Black) on top of entire frame
  if (frame.activeVisualEffect) {
    drawVisualEffectOverlay(
      ctx,
      logicalWidth,
      logicalHeight,
      frame.activeVisualEffect
    );
  }

  ctx.restore();
}

function drawVisualEffectOverlay(
  ctx: CanvasRenderingContext2D,
  logicalWidth: number,
  logicalHeight: number,
  effect: ActiveVisualEffect
) {
  if (effect.intensity <= 0.005) return;
  ctx.save();

  if (effect.type === 'cut_to_black') {
    ctx.globalAlpha = Math.max(0, Math.min(1, effect.intensity));
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  } else if (effect.type === 'red_flash') {
    const clamped = Math.max(0, Math.min(1, effect.intensity));
    // Crimson full-frame wash
    ctx.fillStyle = `rgba(220, 38, 38, ${(clamped * 0.48).toFixed(4)})`;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Intense radial edge vignette for dramatic alarm/flash impact
    const cx = logicalWidth / 2;
    const cy = logicalHeight / 2;
    const innerR = Math.min(logicalWidth, logicalHeight) * 0.24;
    const outerR = Math.hypot(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(220, 38, 38, 0)');
    grad.addColorStop(1, `rgba(153, 27, 27, ${(clamped * 0.85).toFixed(4)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  }

  ctx.restore();
}

function pickGifFrameBitmap(
  track: DecodedGifTrack,
  localElapsedMs: number
): ImageBitmap {
  const safeMs =
    ((localElapsedMs % track.totalDurationMs) + track.totalDurationMs) %
    track.totalDurationMs;
  let acc = 0;
  for (const frame of track.frames) {
    acc += frame.durationMs;
    if (safeMs <= acc) {
      return frame.bitmap;
    }
  }
  return track.frames[track.frames.length - 1].bitmap;
}

function drawStageOverlays(
  ctx: CanvasRenderingContext2D,
  logicalWidth: number,
  logicalHeight: number,
  overlays: StageOverlay[],
  elapsedSec: number,
  imageCache: Map<string, HTMLImageElement>,
  gifCache?: Map<string, DecodedGifTrack>
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, logicalWidth, logicalHeight);
  ctx.clip();

  for (const overlay of overlays) {
    // Skip empty GIF placeholders in exported video frames
    if (overlay.kind === 'image' && !overlay.imageDataUrl) continue;

    const vis = evaluateOverlayVisibility(overlay, elapsedSec, true);
    if (!vis.visible || vis.opacity <= 0.005) continue;

    const w = Math.max(20, overlay.width);
    const h = Math.max(20, overlay.height);
    const cx = overlay.x + w / 2;
    const cy = overlay.y + h / 2 + vis.offsetY;

    ctx.save();
    ctx.globalAlpha = vis.opacity;
    ctx.translate(cx, cy);
    ctx.scale(vis.scale, vis.scale);
    ctx.translate(-w / 2, -h / 2);

    if (overlay.kind === 'image' && overlay.imageDataUrl) {
      const gifTrack = gifCache?.get(overlay.imageDataUrl);
      const img = imageCache.get(overlay.imageDataUrl);
      const radius = Math.max(0, overlay.imageBorderRadius ?? 14);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
      roundedRectPath(ctx, 0, 0, w, h, radius);
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundedRectPath(ctx, 0, 0, w, h, radius);
      ctx.clip();
      if (gifTrack) {
        const localMs =
          overlay.timingMode === 'timed'
            ? Math.max(0, (elapsedSec - overlay.startSec) * 1000)
            : elapsedSec * 1000;
        const bitmap = pickGifFrameBitmap(gifTrack, localMs);
        ctx.drawImage(bitmap, 0, 0, w, h);
      } else if (img && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, w, h);
      }
      ctx.restore();
    } else if (overlay.kind === 'text') {
      const usePill = overlay.pillBg !== false;
      const padX = usePill ? 16 : 6;
      const padY = usePill ? 10 : 4;

      if (usePill) {
        const pillRadius = Math.min(18, h / 2);
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = hexToRgba(
          overlay.pillBgColor || '#0f172a',
          overlay.pillBgOpacity ?? 0.92
        );
        roundedRectPath(ctx, 0, 0, w, h, pillRadius);
        ctx.fill();
        ctx.restore();
      }

      const fontSize = Math.max(10, overlay.fontSize ?? 26);
      const weight = overlay.bold ? '700' : '500';
      const style = overlay.italic ? 'italic ' : '';
      const fontFamily = getOverlayFontStack(overlay.fontFamily ?? 'display');
      const font = `${style}${weight} ${fontSize}px ${fontFamily}`;
      const lineH = Math.round(fontSize * 1.28);
      const maxTextW = Math.max(24, w - padX * 2);
      const lines = wrapPlainText(ctx, overlay.text ?? '', maxTextW, font);

      ctx.save();
      roundedRectPath(ctx, 0, 0, w, h, usePill ? Math.min(18, h / 2) : 0);
      ctx.clip();
      ctx.font = font;
      ctx.fillStyle = overlay.color || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const totalTextH = lines.length * lineH;
      const startY = Math.max(padY, (h - totalTextH) / 2);
      lines.forEach((line, idx) => {
        ctx.fillText(line, w / 2, startY + idx * lineH + lineH / 2);
      });
      ctx.restore();
    }

    ctx.restore();
  }

  ctx.restore();
}

