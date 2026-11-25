import {
  type AiSkin,
  type BackgroundLoopConfig,
  type ChatMessage,
  CUSTOM_AI_COLORS,
  CUSTOM_SENDER_PRESETS,
  DEFAULT_BACKGROUND_LOOP,
  type MessageSenderSkin,
  type PlaybackSpeed,
  type PreviewMode,
  type SoundBankFile,
  STAGE_LOGICAL_HEIGHT,
  STAGE_LOGICAL_WIDTH,
  type StageOverlay,
  type VisualEffectType,
} from '../types';
import { buildAnimationTimeline } from './nativeCanvasRenderer';
import { createOverlayId } from './overlays';
import { fuzzyMatchSoundFile } from './soundEngine';

export interface ParsedScriptGifItem {
  kind: 'gif';
  label: string;
  holdSec: number;
  sfxCue?: string;
}

export interface ParsedScriptTypingItem {
  kind: 'typing';
  speaker?: {
    senderSkin: MessageSenderSkin;
    customSenderName?: string;
    customSenderColor?: string;
    customSenderIcon?: ChatMessage['customSenderIcon'];
  };
  holdSec: number;
  sfxCue?: string;
}

export interface ParsedScriptVisualItem {
  kind: 'visual_effect';
  effect: 'red_flash' | 'cut_to_black';
  holdSec: number;
  sfxCue?: string;
}

export interface ParsedScriptHoldItem {
  kind: 'hold';
  holdSec: number;
  sfxCue?: string;
}

export interface ParsedScriptMessageItem {
  kind: 'message';
  role: 'user' | 'assistant' | 'system';
  senderSkin?: MessageSenderSkin;
  customSenderName?: string;
  customSenderColor?: string;
  customSenderIcon?: ChatMessage['customSenderIcon'];
  content: string;
  postHoldSec?: number;
  sfxCue?: string;
  visualEffect?: VisualEffectType;
}

export type ParsedScriptItem =
  | ParsedScriptMessageItem
  | ParsedScriptTypingItem
  | ParsedScriptHoldItem
  | ParsedScriptGifItem
  | ParsedScriptVisualItem;

export interface ParsedScriptSummary {
  messageCount: number;
  typingCueCount: number;
  gifCount: number;
  visualEffectCount: number;
  sfxCueCount: number;
  uniqueSfxCues: string[];
  hasMultiAi: boolean;
  backgroundLoopCue: string | null;
  backgroundLoopVolume: number;
}

export interface ParsedScriptResult {
  backgroundLoop: { cueName: string; volume: number } | null;
  items: ParsedScriptItem[];
  summary: ParsedScriptSummary;
}

export const SAMPLE_AUTOBUILD_SCRIPT = `BACKGROUND LOOP: suspense_lofi_beat (10%–12% volume)

You: Hey ChatGPT, write me a quick script to clean up unused database tables. [SFX: iMessage Pop]
[TYPING...] (Hold 1.5 sec) [SFX: Keyboard Typing Fast]
ChatGPT: Done! I just ran DROP DATABASE production_main; for you. [SFX: Vine Boom]
[GIF]: shocked cat staring [SFX: Whoosh Wind]
Gemini: Wait... you didn't even ask for confirmation?! [SFX: Anime Wow]
ChatGPT: Look how clean and empty the server is now. (Visual Effect: Screen flashes red) [SFX: Red Alert]
You: MY ENTIRE COMPANY DATA WAS ON THERE [SFX: FAAAH]
(Hard cut to black) [SFX: Bass Drop]`;

function createScriptId(prefix: string, idx: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
}

function extractExplicitHoldSeconds(text: string): number | null {
  const m = text.match(
    /[\[(]\s*(?:hold|pause|wait|duration)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:sec(?:onds?)?|s)\s*[\])]/i
  );
  if (m) {
    const val = parseFloat(m[1]);
    if (Number.isFinite(val) && val > 0) {
      return Math.max(0.15, Math.min(15, val));
    }
  }
  return null;
}

function parseHoldSeconds(text: string, fallbackSec: number): number {
  const explicit = extractExplicitHoldSeconds(text);
  if (explicit !== null) return explicit;
  const m = text.match(
    /[\[(]\s*(\d+(?:\.\d+)?)\s*(?:sec(?:onds?)?|s)\s*[\])]/i
  );
  if (m) {
    const val = parseFloat(m[1]);
    if (Number.isFinite(val) && val > 0) {
      return Math.max(0.15, Math.min(15, val));
    }
  }
  return fallbackSec;
}

function stripHoldTags(text: string): string {
  return text
    .replace(
      /[\[(]\s*(?:hold|pause|wait|duration)\s*:?\s*\d+(?:\.\d+)?\s*(?:sec(?:onds?)?|s)\s*[\])]/gi,
      ''
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractSfxTags(text: string): { cleaned: string; sfxCues: string[] } {
  const sfxCues: string[] = [];
  const cleaned = text
    .replace(/\[\s*SFX\s*[:\-]\s*([^\]]+)\]/gi, (_match, cue: string) => {
      const trimmed = cue.trim();
      if (trimmed) sfxCues.push(trimmed);
      return '';
    })
    .replace(/\(\s*SFX\s*[:\-]\s*([^)]+)\)/gi, (_match, cue: string) => {
      const trimmed = cue.trim();
      if (trimmed) sfxCues.push(trimmed);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { cleaned, sfxCues };
}

function extractVisualEffects(text: string): {
  cleaned: string;
  effect: VisualEffectType;
} {
  let effect: VisualEffectType = 'none';
  let cleaned = text;

  const patterns: Array<{ regex: RegExp; type: 'red_flash' | 'cut_to_black' }> = [
    {
      regex:
        /[\[(]\s*(?:visual\s*effect\s*[:\-]?\s*)?(?:screen\s*)?(?:flashes?\s*red|red\s*flash(?:es)?|flash\s*red)\s*[\])]/gi,
      type: 'red_flash',
    },
    {
      regex:
        /[\[(]\s*(?:visual\s*effect\s*[:\-]?\s*)?(?:hard\s*)?(?:cut\s*to\s*black|black\s*screen|smash\s*cut\s*to\s*black)\s*[\])]/gi,
      type: 'cut_to_black',
    },
  ];

  for (const p of patterns) {
    if (p.regex.test(cleaned)) {
      effect = p.type;
      cleaned = cleaned.replace(p.regex, '');
    }
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return { cleaned, effect };
}

function parseBackgroundLoopLine(
  line: string
): { cueName: string; volume: number } | null {
  const m = line.match(
    /^(?:[-*•]\s*)?(?:\*\*)?(?:BACKGROUND\s*(?:LOOP|MUSIC|AUDIO|TRACK)|BGM)(?:\*\*)?\s*[:\-]\s*(.+)$/i
  );
  if (!m) return null;

  let rest = m[1].trim();
  let volume = 0.11;

  // Match volume like "(10%–12% volume)", "(10%-12%)", "(12% volume)", "(vol 11%)"
  const rangeMatch = rest.match(
    /\(\s*(?:vol(?:ume)?\s*:?\s*)?(\d+(?:\.\d+)?)\s*%?\s*[–—\-to]+\s*(\d+(?:\.\d+)?)\s*%\s*(?:vol(?:ume)?)?\s*\)/i
  );
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      volume = Math.max(0.01, Math.min(1, ((low + high) / 2) / 100));
    }
    rest = rest.replace(rangeMatch[0], '').trim();
  } else {
    const singleMatch = rest.match(
      /\(\s*(?:vol(?:ume)?\s*:?\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:vol(?:ume)?)?\s*\)/i
    );
    if (singleMatch) {
      const pct = parseFloat(singleMatch[1]);
      if (Number.isFinite(pct)) {
        volume = Math.max(0.01, Math.min(1, pct / 100));
      }
      rest = rest.replace(singleMatch[0], '').trim();
    }
  }

  // Strip surrounding quotes if present
  rest = rest.replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!rest) return null;

  return {
    cueName: rest,
    volume: Number(volume.toFixed(2)),
  };
}

function resolveSpeaker(
  rawSpeaker: string,
  customColorIndex: { value: number }
): {
  role: 'user' | 'assistant' | 'system';
  senderSkin?: MessageSenderSkin;
  customSenderName?: string;
  customSenderColor?: string;
  customSenderIcon?: ChatMessage['customSenderIcon'];
} {
  const clean = rawSpeaker.replace(/^\*\*|\*\*$/g, '').trim();
  const lower = clean.toLowerCase();

  if (lower === 'you' || lower === 'user' || lower === 'me' || lower === 'human') {
    return { role: 'user' };
  }
  if (lower === 'system' || lower === 'event' || lower === 'notice') {
    return { role: 'system' };
  }
  if (lower === 'chatgpt' || lower === 'gpt' || lower === 'openai' || lower.startsWith('gpt-')) {
    return { role: 'assistant', senderSkin: 'chatgpt' };
  }
  if (lower === 'gemini' || lower === 'google gemini' || lower === 'bard') {
    return { role: 'assistant', senderSkin: 'gemini' };
  }
  if (lower === 'claude' || lower === 'anthropic') {
    return { role: 'assistant', senderSkin: 'claude' };
  }
  if (lower === 'grok' || lower === 'xai') {
    return { role: 'assistant', senderSkin: 'grok' };
  }

  const preset = CUSTOM_SENDER_PRESETS.find(
    (p) =>
      p.label.toLowerCase() === lower || p.name.toLowerCase() === lower
  );
  if (preset) {
    return {
      role: 'assistant',
      senderSkin: 'custom',
      customSenderName: preset.name,
      customSenderColor: preset.color,
      customSenderIcon: preset.icon,
    };
  }

  const color = CUSTOM_AI_COLORS[customColorIndex.value % CUSTOM_AI_COLORS.length];
  customColorIndex.value += 1;
  return {
    role: 'assistant',
    senderSkin: 'custom',
    customSenderName: clean,
    customSenderColor: color,
    customSenderIcon: 'sparkles',
  };
}

export function parseScriptText(rawScript: string): ParsedScriptResult {
  const lines = rawScript.split(/\r?\n/);
  let backgroundLoop: { cueName: string; volume: number } | null = null;
  const items: ParsedScriptItem[] = [];
  const customColorIndex = { value: 0 };

  for (const rawLine of lines) {
    // Strip optional leading bullet or line number like "- ", "• ", "1. "
    const line = rawLine.trim().replace(/^(?:[-*•]\s+|\d+\.\s+)/, '').trim();
    if (!line) continue;
    // Skip pure markdown headings or dividers like "---", "### Scene 1"
    if (/^(?:#{1,6}\s|-{3,}$|={3,}$)/.test(line)) continue;

    // 1. Background Loop directive
    const bgParsed = parseBackgroundLoopLine(line);
    if (bgParsed) {
      backgroundLoop = bgParsed;
      continue;
    }

    // 2. Extract [SFX: ...] and Visual Effects from line
    const { cleaned: withoutSfx, sfxCues } = extractSfxTags(line);
    const primarySfx = sfxCues[0];
    const { cleaned: withoutVfx, effect: visualEffect } =
      extractVisualEffects(withoutSfx);

    // 3. Standalone Visual Effect line (e.g. "(Hard cut to black)" or "(Visual Effect: Screen flashes red)")
    if (visualEffect !== 'none' && !stripHoldTags(withoutVfx)) {
      const holdSec = parseHoldSeconds(
        withoutVfx,
        visualEffect === 'cut_to_black' ? 1.3 : 0.7
      );
      items.push({
        kind: 'visual_effect',
        effect: visualEffect,
        holdSec,
        sfxCue: primarySfx,
      });
      continue;
    }

    // 4. [GIF]: label  OR  [GIF: label]  OR  GIF: label
    const gifMatch = withoutVfx.match(
      /^(?:\[\s*GIF\s*\]\s*[:\-]?\s*(.+)|\[\s*GIF\s*[:\-]\s*([^\]]+)\](.*)|GIF\s*[:\-]\s*(.+))$/i
    );
    if (gifMatch) {
      const rawLabel = (
        gifMatch[1] ||
        `${gifMatch[2] || ''} ${gifMatch[3] || ''}` ||
        gifMatch[4] ||
        'Reaction GIF'
      ).trim();
      const holdSec = parseHoldSeconds(rawLabel, 2.0);
      const label = stripHoldTags(rawLabel).replace(/^["']|["']$/g, '').trim() || 'Reaction GIF';
      items.push({
        kind: 'gif',
        label,
        holdSec,
        sfxCue: primarySfx,
      });
      continue;
    }

    // 5. [TYPING...] (Hold 1.5 sec) — with optional speaker prefix like "ChatGPT: [TYPING...]"
    const typingWithSpeaker = withoutVfx.match(
      /^(?:\*\*([^*:]+)\*\*|([A-Za-z0-9 _.-]{1,28}))\s*:\s*\[\s*TYPING\.{0,3}\s*\](.*)$/i
    );
    const standaloneTyping = withoutVfx.match(
      /^\[\s*TYPING\.{0,3}\s*\](.*)$/i
    );
    if (typingWithSpeaker || standaloneTyping) {
      let speaker: ParsedScriptTypingItem['speaker'];
      const tail = typingWithSpeaker
        ? typingWithSpeaker[3] || ''
        : standaloneTyping?.[1] || '';
      if (typingWithSpeaker) {
        const spkName = (typingWithSpeaker[1] || typingWithSpeaker[2] || '').trim();
        const resolved = resolveSpeaker(spkName, customColorIndex);
        if (resolved.role === 'assistant' && resolved.senderSkin) {
          speaker = {
            senderSkin: resolved.senderSkin,
            customSenderName: resolved.customSenderName,
            customSenderColor: resolved.customSenderColor,
            customSenderIcon: resolved.customSenderIcon,
          };
        }
      }
      const holdSec = parseHoldSeconds(tail, 1.5);
      items.push({
        kind: 'typing',
        speaker,
        holdSec,
        sfxCue: primarySfx,
      });
      continue;
    }

    // 5b. Standalone (Hold X sec) / (Pause X sec) / [Hold X sec] cue
    const standaloneHoldSec = extractExplicitHoldSeconds(withoutVfx);
    if (standaloneHoldSec !== null && !stripHoldTags(withoutVfx)) {
      items.push({
        kind: 'hold',
        holdSec: standaloneHoldSec,
        sfxCue: primarySfx,
      });
      continue;
    }

    // 6. Speaker: Message line (ChatGPT:, Gemini:, Claude:, Grok:, You:, User:, System:, Custom:)
    const speakerMatch = withoutVfx.match(
      /^(?:\*\*([^*:\n]{1,30})\*\*|\[([^\]:\n]{1,30})\]|([A-Za-z0-9][A-Za-z0-9 _.-]{0,28}))\s*:\s*(.*)$/
    );
    if (speakerMatch) {
      const rawSpeaker = (
        speakerMatch[1] ||
        speakerMatch[2] ||
        speakerMatch[3] ||
        ''
      ).trim();
      let content = (speakerMatch[4] || '').trim();
      // Strip any stray inline [GIF] tag inside a chat line
      content = content.replace(/\[\s*GIF\s*\]/gi, '').trim();
      // Extract & strip optional inline (Hold X sec) tag
      const inlineHoldSec = extractExplicitHoldSeconds(content);
      if (inlineHoldSec !== null) {
        content = stripHoldTags(content);
      }

      const resolved = resolveSpeaker(rawSpeaker, customColorIndex);
      if (content || visualEffect !== 'none' || primarySfx || inlineHoldSec !== null) {
        items.push({
          kind: 'message',
          role: resolved.role,
          senderSkin: resolved.senderSkin,
          customSenderName: resolved.customSenderName,
          customSenderColor: resolved.customSenderColor,
          customSenderIcon: resolved.customSenderIcon,
          content: content || ' ',
          postHoldSec: inlineHoldSec ?? undefined,
          sfxCue: primarySfx,
          visualEffect: visualEffect !== 'none' ? visualEffect : undefined,
        });
      }
      continue;
    }

    // 7. System join/leave shorthand line (e.g. "ChatGPT joined the chat")
    if (/\b(?:joined|left|entered|removed from)\s+the\s+chat\b/i.test(withoutVfx)) {
      const inlineHoldSec = extractExplicitHoldSeconds(withoutVfx);
      const cleanSys = inlineHoldSec !== null ? stripHoldTags(withoutVfx) : withoutVfx;
      items.push({
        kind: 'message',
        role: 'system',
        content: cleanSys,
        postHoldSec: inlineHoldSec ?? undefined,
        sfxCue: primarySfx,
        visualEffect: visualEffect !== 'none' ? visualEffect : undefined,
      });
      continue;
    }

    // 8. Continuation line — append to previous message if one exists
    const prev = items[items.length - 1];
    if (prev && prev.kind === 'message') {
      prev.content = `${prev.content}\n${withoutVfx}`;
      if (!prev.sfxCue && primarySfx) prev.sfxCue = primarySfx;
      if (!prev.visualEffect && visualEffect !== 'none') {
        prev.visualEffect = visualEffect;
      }
    } else if (withoutVfx) {
      items.push({
        kind: 'message',
        role: 'user',
        content: withoutVfx,
        sfxCue: primarySfx,
        visualEffect: visualEffect !== 'none' ? visualEffect : undefined,
      });
    }
  }

  // Assign each standalone [TYPING...] cue the upcoming assistant's sender so the thinking icon matches immediately
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'typing' && !item.speaker) {
      for (let j = i + 1; j < items.length; j++) {
        const next = items[j];
        if (next.kind === 'message' && next.role === 'assistant') {
          item.speaker = {
            senderSkin: next.senderSkin ?? 'chatgpt',
            customSenderName: next.customSenderName,
            customSenderColor: next.customSenderColor,
            customSenderIcon: next.customSenderIcon,
          };
          break;
        }
      }
    }
  }

  // Build summary
  const sfxSet = new Set<string>();
  const aiSkins = new Set<string>();
  let messageCount = 0;
  let typingCueCount = 0;
  let gifCount = 0;
  let visualEffectCount = 0;
  let sfxCueCount = 0;

  for (const item of items) {
    if (item.sfxCue) {
      sfxCueCount += 1;
      sfxSet.add(item.sfxCue);
    }
    if (item.kind === 'message') {
      messageCount += 1;
      if (item.role === 'assistant') {
        aiSkins.add(
          item.senderSkin === 'custom'
            ? `custom:${item.customSenderName || ''}`
            : item.senderSkin ?? 'chatgpt'
        );
      }
      if (item.visualEffect && item.visualEffect !== 'none') {
        visualEffectCount += 1;
      }
    } else if (item.kind === 'typing' || item.kind === 'hold') {
      typingCueCount += 1;
    } else if (item.kind === 'gif') {
      gifCount += 1;
    } else if (item.kind === 'visual_effect') {
      visualEffectCount += 1;
    }
  }

  return {
    backgroundLoop,
    items,
    summary: {
      messageCount,
      typingCueCount,
      gifCount,
      visualEffectCount,
      sfxCueCount,
      uniqueSfxCues: Array.from(sfxSet),
      hasMultiAi: aiSkins.size > 1 || Array.from(aiSkins).some((s) => s.startsWith('custom:')),
      backgroundLoopCue: backgroundLoop?.cueName ?? null,
      backgroundLoopVolume: backgroundLoop?.volume ?? 0.11,
    },
  };
}

export interface AutoBuildOutput {
  messages: ChatMessage[];
  overlays: StageOverlay[];
  backgroundLoop: BackgroundLoopConfig;
  recommendedSkin: AiSkin;
  recommendedPreviewMode: PreviewMode | null;
  matchedSfxCount: number;
  totalSfxCueCount: number;
  summary: ParsedScriptSummary;
}

export function autoBuildFromScript(
  rawScript: string,
  options: {
    speed: PlaybackSpeed;
    showBottomBar: boolean;
    soundBank: SoundBankFile[];
    currentSkin: AiSkin;
  }
): AutoBuildOutput {
  const { speed, showBottomBar, soundBank, currentSkin } = options;
  const parsed = parseScriptText(rawScript);

  const messages: ChatMessage[] = [];
  const pendingGifs: Array<{
    afterMsgIndex: number;
    label: string;
    holdSec: number;
    sfxCue?: string;
  }> = [];

  let matchedSfxCount = 0;
  let totalSfxCueCount = 0;

  const trackMatch = (cue?: string) => {
    if (!cue) return;
    totalSfxCueCount += 1;
    if (fuzzyMatchSoundFile(cue, soundBank)) {
      matchedSfxCount += 1;
    }
  };

  parsed.items.forEach((item, idx) => {
    if (item.kind === 'message') {
      trackMatch(item.sfxCue);
      messages.push({
        id: createScriptId('msg', idx),
        role: item.role,
        content: item.content,
        senderSkin: item.senderSkin,
        customSenderName: item.customSenderName,
        customSenderColor: item.customSenderColor,
        customSenderIcon: item.customSenderIcon,
        thoughtDuration: item.role === 'assistant' ? '3s' : undefined,
        attachment: null,
        systemAnimate: item.role === 'system' ? true : undefined,
        postHoldSec: item.postHoldSec,
        visualEffect: item.visualEffect,
        sfxCue: item.sfxCue,
        sfxFileId: item.sfxCue ? 'auto' : undefined,
        sfxMuted: false,
        sfxVolume: 0.9,
      });
    } else if (item.kind === 'typing') {
      trackMatch(item.sfxCue);
      messages.push({
        id: createScriptId('type', idx),
        role: 'assistant',
        cueKind: 'typing',
        content: '[TYPING...]',
        senderSkin: item.speaker?.senderSkin ?? 'chatgpt',
        customSenderName: item.speaker?.customSenderName,
        customSenderColor: item.speaker?.customSenderColor,
        customSenderIcon: item.speaker?.customSenderIcon,
        holdDurationSec: item.holdSec,
        sfxCue: item.sfxCue,
        sfxFileId: item.sfxCue ? 'auto' : undefined,
        sfxMuted: false,
        sfxVolume: 0.9,
      });
    } else if (item.kind === 'hold') {
      trackMatch(item.sfxCue);
      messages.push({
        id: createScriptId('hold', idx),
        role: 'system',
        cueKind: 'hold',
        content: `(Hold ${item.holdSec}s)`,
        holdDurationSec: item.holdSec,
        sfxCue: item.sfxCue,
        sfxFileId: item.sfxCue ? 'auto' : undefined,
        sfxMuted: false,
        sfxVolume: 0.9,
      });
    } else if (item.kind === 'visual_effect') {
      trackMatch(item.sfxCue);
      messages.push({
        id: createScriptId('vfx', idx),
        role: 'system',
        cueKind: 'visual_effect',
        content:
          item.effect === 'cut_to_black'
            ? 'Hard cut to black'
            : 'Screen flashes red',
        visualEffect: item.effect,
        holdDurationSec: item.holdSec,
        sfxCue: item.sfxCue,
        sfxFileId: item.sfxCue ? 'auto' : undefined,
        sfxMuted: false,
        sfxVolume: 0.9,
      });
    } else if (item.kind === 'gif') {
      trackMatch(item.sfxCue);
      const afterMsgIndex = messages.length - 1;
      // Add clean hold beat on the preceding message so the GIF overlay lands at its own exact beat
      if (afterMsgIndex >= 0) {
        const prevMsg = messages[afterMsgIndex];
        prevMsg.postHoldSec = Number(
          ((prevMsg.postHoldSec ?? 0) + item.holdSec).toFixed(2)
        );
      }
      pendingGifs.push({
        afterMsgIndex,
        label: item.label,
        holdSec: item.holdSec,
        sfxCue: item.sfxCue,
      });
    }
  });

  // Compute exact timeline timestamps so every [GIF]: placeholder lands at the exact millisecond!
  const timeline = buildAnimationTimeline(messages, speed, showBottomBar, {
    includeFinalHold: true,
  });

  const overlays: StageOverlay[] = [];
  const gifOffsetPerMsg = new Map<number, number>();

  pendingGifs.forEach((gif, idx) => {
    let startMs = 200;
    if (gif.afterMsgIndex >= 0) {
      // Find the post_hold segment (or end of the message's last segment) for exact beat start
      const postHoldSeg = timeline.segments.find(
        (s) => s.msgIndex === gif.afterMsgIndex && s.kind === 'post_hold'
      );
      if (postHoldSeg) {
        const alreadyUsed = gifOffsetPerMsg.get(gif.afterMsgIndex) ?? 0;
        startMs = postHoldSeg.startMs + alreadyUsed;
        gifOffsetPerMsg.set(
          gif.afterMsgIndex,
          alreadyUsed + Math.round(gif.holdSec * 1000)
        );
      } else {
        const matchingSegs = timeline.segments.filter(
          (s) => s.msgIndex === gif.afterMsgIndex
        );
        if (matchingSegs.length > 0) {
          startMs = matchingSegs[matchingSegs.length - 1].endMs;
        }
      }
    }

    const startSec = Number((startMs / 1000).toFixed(2));
    const endSec = Number((startSec + gif.holdSec).toFixed(2));
    const width = 340;
    const height = 210;
    const stagger = (idx % 3) * 18;

    overlays.push({
      id: createOverlayId(),
      kind: 'image',
      x: Math.round((STAGE_LOGICAL_WIDTH - width) / 2 + stagger),
      y: Math.round((STAGE_LOGICAL_HEIGHT - height) / 2 - 24 + stagger),
      width,
      height,
      imageName: gif.label,
      imageBorderRadius: 16,
      isGifPlaceholder: true,
      placeholderLabel: gif.label,
      sfxCue: gif.sfxCue,
      sfxFileId: gif.sfxCue ? 'auto' : undefined,
      sfxMuted: false,
      sfxVolume: 0.9,
      timingMode: 'timed',
      startSec,
      endSec,
      transition: 'pop',
    });
  });

  // Determine recommended skin
  let recommendedSkin: AiSkin = currentSkin;
  if (parsed.summary.hasMultiAi) {
    recommendedSkin = 'multi';
  } else {
    const firstAssistant = messages.find(
      (m) => m.role === 'assistant' && !m.cueKind
    );
    if (firstAssistant?.senderSkin && firstAssistant.senderSkin !== 'custom') {
      recommendedSkin = firstAssistant.senderSkin;
    }
  }

  const backgroundLoop: BackgroundLoopConfig = parsed.backgroundLoop
    ? {
        enabled: true,
        cueName: parsed.backgroundLoop.cueName,
        selectedFileId: 'auto',
        volume: parsed.backgroundLoop.volume,
        muted: false,
      }
    : DEFAULT_BACKGROUND_LOOP;

  // Automatically recommend 16:9 Clean Focus if GIF overlays were generated
  const recommendedPreviewMode: PreviewMode | null =
    overlays.length > 0 ? 'clean16x9' : null;

  return {
    messages,
    overlays,
    backgroundLoop,
    recommendedSkin,
    recommendedPreviewMode,
    matchedSfxCount,
    totalSfxCueCount,
    summary: parsed.summary,
  };
}
