import { marked, type Token, type Tokens } from 'marked';
import type {
  AiSkin,
  ChatMessage,
  DeviceMode,
  MessageAttachment,
  MessageRole,
  PlaybackSpeed,
  ThemeMode,
} from '../types';
import { AI_SKINS, getSkinPalette, type SkinPalette } from './skins';

export interface RenderConfig {
  skin: AiSkin;
  modelLabel: string;
  theme: ThemeMode;
  device: DeviceMode;
  showIosStatusBar: boolean;
  showBottomBar: boolean;
  showFooterDisclaimer: boolean;
  enableThoughtPill: boolean;
}

export interface RenderedFrameMessage {
  id: string;
  role: MessageRole;
  content: string;
  thoughtDuration?: string;
  attachment?: MessageAttachment | null;
  enterProgress: number;
  isStreaming: boolean;
}

export interface AnimationFrameState {
  messages: RenderedFrameMessage[];
  isThinking: boolean;
  composerDraft: string;
  sendHighlighted: boolean;
  timeMs: number;
}

export interface AnimationTimeline {
  totalDurationMs: number;
  evaluateAt: (elapsedMs: number) => AnimationFrameState;
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

function getBodyFontFamily(skin: AiSkin): string {
  return skin === 'claude' ? CLAUDE_SERIF_FONT : INTER_FONT;
}

export async function preloadAttachmentImages(
  messages: ChatMessage[]
): Promise<Map<string, HTMLImageElement>> {
  const cache = new Map<string, HTMLImageElement>();
  const tasks: Promise<void>[] = [];

  for (const msg of messages) {
    if (msg.attachment?.kind === 'image' && msg.attachment.dataUrl) {
      const url = msg.attachment.dataUrl;
      if (!cache.has(url)) {
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
    }
  }

  await Promise.all(tasks);
  return cache;
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

interface TimelineSegment {
  startMs: number;
  endMs: number;
  kind:
    | 'idle'
    | 'user_typing'
    | 'user_presend'
    | 'user_send_highlight'
    | 'user_slide'
    | 'thinking'
    | 'ai_stream'
    | 'final_hold';
  msgIndex: number;
  chars?: string[];
  words?: string[];
}

export function buildAnimationTimeline(
  messages: ChatMessage[],
  speed: PlaybackSpeed,
  showBottomBar: boolean
): AnimationTimeline {
  const segments: TimelineSegment[] = [];
  let cursorMs = 0;

  const pushSegment = (
    durationMs: number,
    seg: Omit<TimelineSegment, 'startMs' | 'endMs'>
  ) => {
    const startMs = cursorMs;
    const endMs = cursorMs + Math.max(1, durationMs);
    segments.push({ ...seg, startMs, endMs });
    cursorMs = endMs;
  };

  pushSegment(Math.round(180 / speed), { kind: 'idle', msgIndex: -1 });

  messages.forEach((msg, index) => {
    if (msg.role === 'user') {
      if (showBottomBar) {
        const chars = Array.from(msg.content);
        if (chars.length > 0) {
          pushSegment(Math.round((chars.length * 22) / speed), {
            kind: 'user_typing',
            msgIndex: index,
            chars,
          });
        }
        pushSegment(Math.round(140 / speed), {
          kind: 'user_presend',
          msgIndex: index,
        });
        pushSegment(Math.round(220 / speed), {
          kind: 'user_send_highlight',
          msgIndex: index,
        });
      }
      pushSegment(Math.round(240 / speed), {
        kind: 'user_slide',
        msgIndex: index,
      });
      pushSegment(Math.round(200 / speed), {
        kind: 'idle',
        msgIndex: index,
      });
    } else {
      pushSegment(Math.round(1000 / speed), {
        kind: 'thinking',
        msgIndex: index,
      });
      const words = tokenizeWordsPreservingWhitespace(msg.content);
      if (words.length > 0) {
        pushSegment(Math.round((words.length * 45) / speed), {
          kind: 'ai_stream',
          msgIndex: index,
          words,
        });
      }
      pushSegment(Math.round(420 / speed), {
        kind: 'idle',
        msgIndex: index,
      });
    }
  });

  // 1.5-second pause on the completed final frame
  pushSegment(1500, {
    kind: 'final_hold',
    msgIndex: messages.length - 1,
  });

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
    let composerDraft = '';
    let sendHighlighted = false;

    const segDuration = Math.max(1, activeSeg.endMs - activeSeg.startMs);
    const localProgress = Math.max(
      0,
      Math.min(1, (clamped - activeSeg.startMs) / segDuration)
    );

    if (activeSeg.kind === 'final_hold') {
      for (const m of messages) {
        visible.push({
          id: m.id,
          role: m.role,
          content: m.content,
          thoughtDuration: m.thoughtDuration,
          attachment: m.attachment,
          enterProgress: 1,
          isStreaming: false,
        });
      }
      return {
        messages: visible,
        isThinking: false,
        composerDraft: '',
        sendHighlighted: false,
        timeMs: clamped,
      };
    }

    const completedUpTo =
      activeSeg.kind === 'idle' ? activeSeg.msgIndex : activeSeg.msgIndex - 1;

    for (let i = 0; i <= completedUpTo && i < messages.length; i++) {
      const m = messages[i];
      visible.push({
        id: m.id,
        role: m.role,
        content: m.content,
        thoughtDuration: m.thoughtDuration,
        attachment: m.attachment,
        enterProgress: 1,
        isStreaming: false,
      });
    }

    const currentMsg =
      activeSeg.msgIndex >= 0 && activeSeg.msgIndex < messages.length
        ? messages[activeSeg.msgIndex]
        : null;

    if (currentMsg) {
      if (activeSeg.kind === 'user_typing' && activeSeg.chars) {
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
      } else if (activeSeg.kind === 'user_slide') {
        visible.push({
          id: currentMsg.id,
          role: 'user',
          content: currentMsg.content,
          attachment: currentMsg.attachment,
          enterProgress: localProgress,
          isStreaming: false,
        });
      } else if (activeSeg.kind === 'thinking') {
        isThinking = true;
      } else if (activeSeg.kind === 'ai_stream' && activeSeg.words) {
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
          enterProgress: 1,
          isStreaming: true,
        });
      }
    }

    return {
      messages: visible,
      isThinking,
      composerDraft,
      sendHighlighted,
      timeMs: clamped,
    };
  };

  return { totalDurationMs, evaluateAt };
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
  skin: AiSkin,
  x: number,
  y: number,
  palette: SkinPalette
) {
  const size = 28;
  const cx = x + size / 2;
  const cy = y + size / 2;

  ctx.save();
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
    ctx.translate(cx - 10, cy - 10);
    ctx.scale(20 / 24, 20 / 24);
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
    ctx.translate(cx - 10, cy - 10);
    ctx.scale(20 / 24, 20 / 24);
    const grad = ctx.createLinearGradient(2, 2, 22, 22);
    grad.addColorStop(0, '#4285f4');
    grad.addColorStop(0.52, '#9b72cb');
    grad.addColorStop(1, '#d96570');
    ctx.fillStyle = grad;
    ctx.fill(cachedGeminiPath);
  } else if (skin === 'grok') {
    ctx.translate(cx - 8.5, cy - 8.5);
    ctx.scale(17 / 24, 17 / 24);
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
    ctx.translate(cx - 8, cy - 8);
    ctx.scale(16 / 24, 16 / 24);
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
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(18 / 24, 18 / 24);
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
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(18 / 24, 18 / 24);
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
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(18 / 24, 18 / 24);
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
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(15 / 24, 15 / 24);
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
  kind: 'copy' | 'up' | 'down' | 'retry' | 'share' | 'sliders' | 'google',
  x: number,
  y: number,
  color: string
) {
  const size = 15;
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
  skin: AiSkin,
  x: number,
  y: number,
  color: string
) {
  let icons: Array<'copy' | 'up' | 'down' | 'retry' | 'share' | 'sliders' | 'google'>;
  switch (skin) {
    case 'claude':
      icons = ['copy', 'up', 'down', 'retry'];
      break;
    case 'gemini':
      icons = ['up', 'down', 'sliders', 'share', 'copy', 'google'];
      break;
    case 'grok':
      icons = ['retry', 'copy', 'up', 'down', 'share'];
      break;
    case 'chatgpt':
    default:
      icons = ['copy', 'up', 'down', 'retry'];
      break;
  }

  icons.forEach((kind, idx) => {
    drawSingleActionIcon(ctx, kind, x + idx * 27, y, color);
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
    return `500 ${Math.round(fontSize * 0.86)}px ${MONO_FONT}`;
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
  draw: boolean
): MarkdownDrawResult {
  let y = startY;
  let lastCursorX = startX;
  let lastCursorY = startY + 12;
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
      const lines = layoutInlineRuns(ctx, runs, maxWidth, 15, 24.5, fontFamily);
      drawLines(lines, startX, palette.textPrimary, 15);
      if (!isLast) y += 10;
      continue;
    }

    if (tok.type === 'heading') {
      const h = tok as Tokens.Heading;
      if (idx > 0) y += 6;
      const size = h.depth === 1 ? 22 : h.depth === 2 ? 18 : 16;
      const lh = Math.round(size * 1.38);
      const runs = flattenInlineTokens(h.tokens, {
        bold: true,
        italic: false,
        underline: false,
      });
      const lines = layoutInlineRuns(ctx, runs, maxWidth, size, lh, fontFamily);
      drawLines(lines, startX, palette.textPrimary, size);
      if (!isLast) y += 8;
      continue;
    }

    if (tok.type === 'list') {
      const list = tok as Tokens.List;
      if (idx > 0) y += 2;
      const indent = 22;
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
          15,
          24,
          fontFamily
        );

        if (draw) {
          ctx.fillStyle = palette.textSecondary;
          ctx.font = `500 15px ${fontFamily}`;
          ctx.textBaseline = 'middle';
          ctx.fillText(marker, startX + 4, y + 12);
        }
        drawLines(lines, startX + indent, palette.textPrimary, 15);
        y += 5;
      });
      if (!isLast) y += 6;
      continue;
    }

    if (tok.type === 'code') {
      const c = tok as Tokens.Code;
      if (idx > 0) y += 4;
      const lang =
        c.lang && c.lang.trim()
          ? c.lang.trim().split(/\s+/)[0].toLowerCase()
          : 'code';
      const headerH = 30;
      const codeFont = `400 13px ${MONO_FONT}`;
      const codeLines = wrapPlainText(
        ctx,
        c.text,
        Math.max(80, maxWidth - 32),
        codeFont
      );
      const codeLineH = 20;
      const bodyPadY = 14;
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

        ctx.fillStyle = '#b4b4b4';
        ctx.font = `400 12px ${INTER_FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillText(lang, startX + 14, y + headerH / 2);

        const copyLabel = 'Copy code';
        const copyTextW = ctx.measureText(copyLabel).width;
        ctx.fillText(
          copyLabel,
          startX + maxWidth - 14 - copyTextW,
          y + headerH / 2
        );
        ctx.save();
        ctx.translate(
          startX + maxWidth - 14 - copyTextW - 18,
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
          ctx.fillText(cl, startX + 16, lineY);
        });
      }

      const lastCodeLine = codeLines[codeLines.length - 1] ?? '';
      ctx.font = codeFont;
      const lastCodeW = ctx.measureText(lastCodeLine).width;
      lastCursorX = startX + 16 + lastCodeW;
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
        startX + 14,
        y,
        Math.max(60, maxWidth - 14),
        { ...palette, textPrimary: palette.blockquoteFg },
        fontFamily,
        draw
      );
      if (draw) {
        ctx.fillStyle = palette.blockquoteBorder;
        ctx.fillRect(startX, bqStartY + 2, 2, Math.max(12, innerRes.height - 4));
      }
      y += innerRes.height;
      lastCursorX = innerRes.cursorX;
      lastCursorY = innerRes.cursorY;
      lastCursorColor = innerRes.cursorColor;
      if (!isLast) y += 10;
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
      const lines = layoutInlineRuns(ctx, runs, maxWidth, 15, 24, fontFamily);
      drawLines(lines, startX, palette.textPrimary, 15);
      if (!isLast) y += 8;
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

  // Compact file badge
  ctx.save();
  ctx.fillStyle = palette.attachmentCardBg;
  roundedRectPath(ctx, x, y, size.width, size.height, 10);
  ctx.fill();
  ctx.strokeStyle = palette.attachmentCardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // File icon
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
  const isMobile = config.device === 'mobile';
  const width = isMobile ? 390 : 760;
  const baseMinHeight = isMobile ? 640 : 540;
  const maxViewportHeight = isMobile ? 844 : 760;

  const statusH = isMobile && config.showIosStatusBar ? 38 : 0;
  const headerH = isMobile ? 48 : 56;
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

  const contentContainerW = isMobile ? width : Math.min(width, 680);
  const padX = isMobile ? 16 : 24;
  const padTop = isMobile ? 16 : 22;
  const padBottom = isMobile ? 24 : 28;
  const msgGap = isMobile ? 22 : 28;
  const palette = getSkinPalette(config.skin, config.theme);
  const bodyFont = getBodyFontFamily(config.skin);

  let messagesH = 0;
  finalMessages.forEach((msg, idx) => {
    if (idx > 0) messagesH += msgGap;
    if (msg.role === 'user') {
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
      const thoughtH =
        config.enableThoughtPill && msg.thoughtDuration?.trim() ? 36 : 0;
      const mdRes = processMarkdownBlock(
        ctx,
        getMarkdownTokens(msg.content),
        0,
        0,
        bodyMaxW,
        palette,
        bodyFont,
        false
      );
      messagesH += Math.max(28, thoughtH + mdRes.height + 25);
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

export function renderChatFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  logicalWidth: number,
  logicalHeight: number,
  scale: number,
  config: RenderConfig,
  frame: AnimationFrameState,
  scrollState: ScrollState,
  imageCache: Map<string, HTMLImageElement> = new Map()
): void {
  const isMobile = config.device === 'mobile';
  const palette = getSkinPalette(config.skin, config.theme);
  const skinMeta = AI_SKINS[config.skin];
  const displayModel = config.modelLabel.trim() || skinMeta.defaultModel;
  const bodyFont = getBodyFontFamily(config.skin);

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Full Canvas Background
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // Top Chrome Geometry
  const statusH = isMobile && config.showIosStatusBar ? 38 : 0;
  const headerH = isMobile ? 48 : 56;
  const topChromeH = statusH + headerH;

  // Bottom Chrome Geometry (Composer + optional Footer Disclaimer)
  const composerOuterW = isMobile
    ? logicalWidth - 28
    : Math.min(logicalWidth, 680) - 48;
  const composerLeft = (logicalWidth - composerOuterW) / 2;
  const isTwoRowComposer =
    config.skin === 'claude' || config.skin === 'grok';
  const composerTextMaxW = isTwoRowComposer
    ? Math.max(80, composerOuterW - 32)
    : Math.max(80, composerOuterW - 118);

  let composerLines: string[] = [];
  let composerBoxH = 0;
  if (config.showBottomBar) {
    if (frame.composerDraft) {
      composerLines = wrapPlainText(
        ctx,
        frame.composerDraft,
        composerTextMaxW,
        `400 15px ${INTER_FONT}`
      );
    }
    const textH = Math.max(22, composerLines.length * 22);
    composerBoxH = isTwoRowComposer
      ? textH + 54
      : textH + (isMobile ? 18 : 22);
  }

  const disclaimerH = config.showFooterDisclaimer ? 24 : 0;
  const composerPadBottom = config.showBottomBar
    ? config.showFooterDisclaimer
      ? 6
      : isMobile
        ? 18
        : 24
    : config.showFooterDisclaimer
      ? 12
      : 0;
  const bottomChromeH =
    (config.showBottomBar ? composerBoxH + 8 : 0) +
    disclaimerH +
    composerPadBottom;
  const scrollViewportH = Math.max(
    100,
    logicalHeight - topChromeH - bottomChromeH
  );

  // Measure visible messages for smooth auto-scroll
  const contentContainerW = isMobile ? logicalWidth : Math.min(logicalWidth, 680);
  const contentOriginX = (logicalWidth - contentContainerW) / 2;
  const padX = isMobile ? 16 : 24;
  const padTop = isMobile ? 16 : 22;
  const padBottom = isMobile ? 18 : 22;
  const msgGap = isMobile ? 22 : 28;
  const bodyX = contentOriginX + padX;
  const bodyW = contentContainerW - padX * 2;

  let cursorContentY = padTop;
  interface LayoutItem {
    kind: 'user' | 'assistant' | 'thinking';
    y: number;
    height: number;
    msg?: RenderedFrameMessage;
    userLines?: string[];
    bubbleW?: number;
    bubbleH?: number;
    attSize?: { width: number; height: number };
    mdTokens?: Token[];
  }

  const layoutItems: LayoutItem[] = [];

  frame.messages.forEach((msg, idx) => {
    if (idx > 0) cursorContentY += msgGap;

    if (msg.role === 'user') {
      const attSize = measureAttachmentBlock(msg.attachment, imageCache);
      const attH = attSize.height > 0 ? attSize.height + 8 : 0;
      const font = `400 15px ${INTER_FONT}`;

      if (config.skin === 'claude') {
        const innerPadX = 14;
        const innerPadY = 11;
        const textMaxW = bodyW - innerPadX * 2 - 36;
        const lines = wrapPlainText(ctx, msg.content || ' ', textMaxW, font);
        const bubbleH = Math.max(44, lines.length * 23 + innerPadY * 2);
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
        const maxBubbleW = bodyW * (isMobile ? 0.8 : 0.7);
        const innerPadX = isMobile ? 16 : 18;
        const innerPadY = isMobile ? 10 : 11;
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
        const bubbleW = Math.min(maxBubbleW, Math.max(44, maxLineW + innerPadX * 2));
        const bubbleH = lines.length * 23 + innerPadY * 2;
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
      const avatarGap = isMobile ? 12 : 16;
      const mdMaxW = bodyW - 28 - avatarGap;
      const tokens = getMarkdownTokens(msg.content);
      const mdRes = processMarkdownBlock(
        ctx,
        tokens,
        0,
        0,
        mdMaxW,
        palette,
        bodyFont,
        false
      );
      const thoughtH =
        config.enableThoughtPill && msg.thoughtDuration?.trim() ? 36 : 0;
      const actionsH = msg.isStreaming ? 0 : 25;
      const itemH = Math.max(28, thoughtH + mdRes.height + actionsH);
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
      height: 28,
    });
    cursorContentY += 28;
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
  ctx.rect(0, topChromeH, logicalWidth, scrollViewportH);
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
        // Claude warm block card with left initial circle
        ctx.fillStyle = palette.userBubbleBg;
        roundedRectPath(ctx, bodyX, textBubbleY, item.bubbleW, item.bubbleH, 14);
        ctx.fill();
        ctx.strokeStyle = palette.userBubbleBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Initial circle
        ctx.fillStyle = config.theme === 'dark' ? '#57544c' : '#2b2a27';
        ctx.beginPath();
        ctx.arc(bodyX + 26, textBubbleY + 22, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 11px ${INTER_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('U', bodyX + 26, textBubbleY + 22.5);
        ctx.textAlign = 'left';

        ctx.fillStyle = palette.textPrimary;
        ctx.font = `400 15px ${INTER_FONT}`;
        item.userLines.forEach((line, li) => {
          ctx.fillText(line, bodyX + 48, textBubbleY + 11 + li * 23 + 11.5);
        });
      } else {
        const radius = config.skin === 'grok' ? 14 : 22;
        const bx = bodyX + bodyW - item.bubbleW;
        ctx.fillStyle = palette.userBubbleBg;
        roundedRectPath(ctx, bx, textBubbleY, item.bubbleW, item.bubbleH, radius);
        ctx.fill();
        if (config.skin === 'grok') {
          ctx.strokeStyle = palette.userBubbleBorder;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.fillStyle = palette.textPrimary;
        ctx.font = `400 15px ${INTER_FONT}`;
        ctx.textBaseline = 'middle';
        const innerPadX = isMobile ? 16 : 18;
        const innerPadY = isMobile ? 10 : 11;
        item.userLines.forEach((line, li) => {
          ctx.fillText(
            line,
            bx + innerPadX,
            textBubbleY + innerPadY + li * 23 + 11.5
          );
        });
      }
      ctx.restore();
    } else if (item.kind === 'assistant' && item.msg && item.mdTokens) {
      const avatarGap = isMobile ? 12 : 16;
      const mdX = bodyX + 28 + avatarGap;
      const mdW = bodyW - 28 - avatarGap;

      drawAiAvatar(ctx, config.skin, bodyX, drawY + 1, palette);

      let contentDrawY = drawY;
      if (config.enableThoughtPill && item.msg.thoughtDuration?.trim()) {
        const thoughtLabel = `Thought for ${item.msg.thoughtDuration.trim()}`;
        ctx.font = `500 12.5px ${INTER_FONT}`;
        const tw = ctx.measureText(thoughtLabel).width;
        const pillW = tw + 34;
        const pillH = 26;
        ctx.fillStyle = palette.thoughtBg;
        roundedRectPath(ctx, mdX, contentDrawY, pillW, pillH, 8);
        ctx.fill();
        ctx.strokeStyle = palette.thoughtBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = palette.thoughtText;
        ctx.textBaseline = 'middle';
        ctx.fillText(thoughtLabel, mdX + 10, contentDrawY + pillH / 2 + 0.5);

        // Chevron right >
        ctx.save();
        ctx.translate(mdX + 10 + tw + 6, contentDrawY + pillH / 2 - 5);
        ctx.scale(10 / 24, 10 / 24);
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

        contentDrawY += 36;
      }

      const res = processMarkdownBlock(
        ctx,
        item.mdTokens,
        mdX,
        contentDrawY,
        mdW,
        palette,
        bodyFont,
        true
      );

      if (item.msg.isStreaming) {
        const pulse =
          0.28 +
          0.72 * (0.5 + 0.5 * Math.cos((frame.timeMs / 850) * Math.PI * 2));
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle =
          config.skin === 'claude' ? '#d97757' : res.cursorColor;
        ctx.beginPath();
        ctx.arc(res.cursorX + 9, res.cursorY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawSkinActionIconsRow(
          ctx,
          config.skin,
          mdX,
          contentDrawY + res.height + 10,
          palette.textMuted
        );
      }
    } else if (item.kind === 'thinking') {
      drawAiAvatar(ctx, config.skin, bodyX, drawY, palette);
      const avatarGap = isMobile ? 12 : 16;
      const pulse =
        0.28 +
        0.72 * (0.5 + 0.5 * Math.cos((frame.timeMs / 1000) * Math.PI * 2));
      const dotScale = 0.84 + 0.16 * pulse;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle =
        config.skin === 'claude' ? '#d97757' : palette.textPrimary;
      ctx.beginPath();
      ctx.arc(
        bodyX + 28 + avatarGap + 5.5,
        drawY + 14,
        5.5 * dotScale,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore(); // End feed clip

  // Draw Sticky Top Chrome (Background + optional iOS Bar + Skin Top Header)
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, logicalWidth, topChromeH);

  if (isMobile && config.showIosStatusBar) {
    drawIosStatusBar(ctx, logicalWidth, palette.textPrimary);
  }

  const headerTop = statusH;
  const headerCenterY = headerTop + headerH / 2;

  if (config.skin === 'claude') {
    drawSidebarToggleIcon(ctx, 18, headerCenterY - 10, palette.textSecondary);
    const modelX = 52;
    ctx.font = `500 17px ${CLAUDE_SERIF_FONT}`;
    const labelW = ctx.measureText(displayModel).width;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'middle';
    ctx.fillText(displayModel, modelX, headerCenterY);
    drawChevronDown(ctx, modelX + labelW + 5, headerCenterY - 7, 15, palette.textMuted);

    drawStarIcon(ctx, logicalWidth - 62, headerCenterY - 8.5, 17, palette.textSecondary);
    drawShareIcon(ctx, logicalWidth - 34, headerCenterY - 8.5, 17, palette.textSecondary);
  } else if (config.skin === 'gemini') {
    drawHamburgerIcon(ctx, 18, headerCenterY - 10, palette.textSecondary);
    const gemX = 50;
    ctx.font = `500 18px ${INTER_FONT}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'middle';
    ctx.fillText('Gemini', gemX, headerCenterY);
    const gemW = ctx.measureText('Gemini').width;

    // 3 Pro ▾ pill badge
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

    // User initial circle top-right
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
    ctx.moveTo(0, topChromeH - 0.5);
    ctx.lineTo(logicalWidth, topChromeH - 0.5);
    ctx.stroke();

    ctx.font = `600 17px ${INTER_FONT}`;
    const labelW = ctx.measureText(displayModel).width;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'middle';
    ctx.fillText(displayModel, 18, headerCenterY);
    drawChevronDown(ctx, 18 + labelW + 5, headerCenterY - 7, 15, palette.textMuted);

    drawGhostIcon(ctx, logicalWidth - 68, headerCenterY - 9.5, 19, palette.textSecondary);
    drawNewChatIcon(ctx, logicalWidth - 38, headerCenterY - 9.5, 19, palette.textSecondary);
  } else {
    // ChatGPT
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
      drawSidebarToggleIcon(ctx, 18, headerCenterY - 10, palette.textSecondary);
      const modelX = 52;
      ctx.font = `600 17px ${INTER_FONT}`;
      const labelW = ctx.measureText(displayModel).width;
      ctx.fillStyle = palette.textPrimary;
      ctx.textBaseline = 'middle';
      ctx.fillText(displayModel, modelX, headerCenterY);
      drawChevronDown(ctx, modelX + labelW + 5, headerCenterY - 7, 16, palette.textMuted);
      drawNewChatIcon(ctx, logicalWidth - 38, headerCenterY - 10, 20, palette.textSecondary);
    }
  }

  // Draw Sticky Bottom Chrome (Composer Bar + Optional Footer Disclaimer)
  if (config.showBottomBar || config.showFooterDisclaimer) {
    ctx.fillStyle = palette.canvasBg;
    ctx.fillRect(0, logicalHeight - bottomChromeH - 4, logicalWidth, bottomChromeH + 4);
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
      isTwoRowComposer ? 18 : 26
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
        ctx.fillText(skinMeta.composerPlaceholder, textX, topTextY + 11);
      }

      const bottomRowY = composerTop + composerBoxH - 22;

      if (config.skin === 'claude') {
        drawPlusIcon(ctx, composerLeft + 14, bottomRowY - 8.5, 17, palette.textSecondary);

        // Model pill + terracotta send button on bottom-right
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
        // Grok: DeepSearch & Think pills bottom-left, monochrome send bottom-right
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
      // Single-row pill (ChatGPT / Gemini)
      const leftPad = isMobile ? 14 : 16;
      const rightPad = isMobile ? 10 : 12;
      const barCenterY = composerTop + composerBoxH / 2;

      if (config.skin === 'gemini') {
        drawPlusIcon(ctx, composerLeft + leftPad, barCenterY - 9, 18, palette.textSecondary);
      } else {
        drawPaperclipIcon(ctx, composerLeft + leftPad, barCenterY - 9, palette.textSecondary);
      }

      const textX = composerLeft + leftPad + 28;
      ctx.font = `400 15px ${INTER_FONT}`;
      ctx.textBaseline = 'middle';
      if (frame.composerDraft) {
        ctx.fillStyle = palette.textPrimary;
        const topTextY = composerTop + (isMobile ? 9 : 11);
        composerLines.forEach((line, li) => {
          ctx.fillText(line, textX, topTextY + li * 22 + 11);
        });
      } else {
        ctx.fillStyle = palette.textMuted;
        ctx.fillText(skinMeta.composerPlaceholder, textX, barCenterY);
      }

      const sendBtnX = composerLeft + composerOuterW - rightPad - 15;
      const voiceX = sendBtnX - 15 - 8 - 22;
      if (config.skin === 'gemini') {
        drawMicIcon(ctx, voiceX, barCenterY - 9, palette.textSecondary);
      } else {
        drawVoiceWaveformIcon(ctx, voiceX, barCenterY - 9, palette.textSecondary);
      }

      const sendScale = frame.sendHighlighted ? 1.12 : 1;
      ctx.save();
      ctx.translate(sendBtnX, barCenterY);
      ctx.scale(sendScale, sendScale);
      if (frame.sendHighlighted) {
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 163, 127, 0.25)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
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

    ctx.restore();
  }

  if (config.showFooterDisclaimer) {
    ctx.save();
    ctx.fillStyle = palette.textMuted;
    ctx.font = `400 11.5px ${INTER_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      skinMeta.disclaimer,
      logicalWidth / 2,
      logicalHeight - 13
    );
    ctx.restore();
  }

  ctx.restore();
}
