import type {
  BackgroundLoopConfig,
  ChatMessage,
  PreviewMode,
  ScheduledAudioEvent,
  SoundBankFile,
  StageOverlay,
} from '../types';
import type { AnimationTimeline, TimelineSegment } from './nativeCanvasRenderer';

const AUDIO_FILE_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i;

export const SYNTH_KEYCLICK_ID = '__synth_keyclick__';

const synthKeyclickCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/**
 * Generates a subtle, crisp mechanical/laptop keyclick AudioBuffer (~32ms)
 * deterministically so Live Preview and Offline Export sound identical when
 * no typing audio file is loaded in the Sound Bank.
 */
export function getSynthKeyclickBuffer(ctx: BaseAudioContext): AudioBuffer {
  const existing = synthKeyclickCache.get(ctx);
  if (existing) return existing;

  const sampleRate = ctx.sampleRate || 48000;
  const durationSec = 0.034;
  const length = Math.max(64, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Deterministic LCG PRNG for consistent transient texture across preview & export
  let seed = 0x5f3759df;
  const nextRand = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  let lpState = 0;
  let hpPrev = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const white = nextRand();

    // Soft bandpass-shaped click burst (fast 5ms transient)
    lpState = lpState + 0.42 * (white - lpState);
    const bp = lpState - hpPrev * 0.65;
    hpPrev = lpState;

    const attackEnv = Math.min(1, t / 0.0009);
    const clickEnv = Math.exp(-t / 0.0042);
    const bodyEnv = Math.exp(-t / 0.011);

    const tactileSnap = Math.sin(2 * Math.PI * 1950 * t) * clickEnv * 0.24;
    const keyThock = Math.sin(2 * Math.PI * 240 * t) * bodyEnv * 0.22;
    const noiseTick = bp * clickEnv * 0.42;

    const tailFade =
      i > length - 120 ? Math.max(0, (length - i) / 120) : 1;

    data[i] =
      Math.max(-0.95, Math.min(0.95, (tactileSnap + keyThock + noiseTick) * attackEnv * tailFade)) *
      0.55;
  }

  synthKeyclickCache.set(ctx, buffer);
  return buffer;
}

export function findFallbackTypingFile(
  soundBank: SoundBankFile[]
): SoundBankFile | null {
  if (soundBank.length === 0) return null;

  let best: SoundBankFile | null = null;
  let bestScore = 0;

  for (const file of soundBank) {
    const norm = file.normalized;
    const compact = file.compact;
    let score = 0;

    if (/\b(keyboard|typing|typewriter|keystroke|keyclick)\b/.test(norm)) {
      score = 100;
    } else if (compact.includes('keyboard') || compact.includes('typing')) {
      score = 95;
    } else if (/\b(type|key|keys|clack)\b/.test(norm)) {
      score = 80;
    } else if (compact.includes('type') || compact.includes('key')) {
      score = 70;
    }

    if (score > bestScore) {
      bestScore = score;
      best = file;
    }
  }

  return best;
}

export function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

export function normalizeAudioText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[_\-./\\()[\]{}:,!?'"~+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCompactAlphaNum(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function collapseRepeats(text: string): string {
  return text.replace(/(.)\1+/g, '$1');
}

function tokenizeNormalized(norm: string): string[] {
  return norm
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

function scoreMatch(cueRaw: string, file: SoundBankFile): number {
  const cueNorm = normalizeAudioText(cueRaw);
  if (!cueNorm) return 0;
  const cueCompact = toCompactAlphaNum(cueNorm);
  const cueCollapsed = collapseRepeats(cueCompact);
  const cueTokens = tokenizeNormalized(cueNorm);

  if (cueNorm === file.normalized) return 1.0;
  if (cueCompact && cueCompact === file.compact) return 0.98;

  const fileCollapsed = collapseRepeats(file.compact);
  if (cueCollapsed && cueCollapsed === fileCollapsed) return 0.94;

  // Compact substring match (e.g., "FAAAH" -> "faaah_loud.mp3" or "vineboom" -> "vine_boom_sfx.mp3")
  if (cueCompact.length >= 3 && file.compact.length >= 3) {
    if (file.compact.includes(cueCompact)) {
      const ratio = cueCompact.length / file.compact.length;
      return 0.84 + ratio * 0.12;
    }
    if (cueCompact.includes(file.compact)) {
      const ratio = file.compact.length / cueCompact.length;
      return 0.78 + ratio * 0.12;
    }
    if (
      cueCollapsed.length >= 3 &&
      (fileCollapsed.includes(cueCollapsed) ||
        cueCollapsed.includes(fileCollapsed))
    ) {
      const minLen = Math.min(cueCollapsed.length, fileCollapsed.length);
      const maxLen = Math.max(cueCollapsed.length, fileCollapsed.length);
      return 0.72 + (minLen / Math.max(1, maxLen)) * 0.12;
    }
  }

  // Token overlap + fuzzy token similarity
  if (cueTokens.length > 0 && file.tokens.length > 0) {
    let matchedCueWeight = 0;
    for (const ct of cueTokens) {
      const ctCol = collapseRepeats(ct);
      let bestTokenScore = 0;
      for (const ft of file.tokens) {
        if (ct === ft) {
          bestTokenScore = 1;
          break;
        }
        const ftCol = collapseRepeats(ft);
        if (ctCol === ftCol) {
          bestTokenScore = Math.max(bestTokenScore, 0.92);
          continue;
        }
        if (
          ct.length >= 3 &&
          ft.length >= 3 &&
          (ft.startsWith(ct) || ct.startsWith(ft))
        ) {
          bestTokenScore = Math.max(bestTokenScore, 0.82);
          continue;
        }
        if (ct.length >= 3 && ft.length >= 3) {
          const dist = levenshteinDistance(ctCol, ftCol);
          const maxL = Math.max(ctCol.length, ftCol.length);
          const sim = 1 - dist / maxL;
          if (sim >= 0.72) {
            bestTokenScore = Math.max(bestTokenScore, sim * 0.85);
          }
        }
      }
      matchedCueWeight += bestTokenScore;
    }

    const recall = matchedCueWeight / cueTokens.length;
    const precision = matchedCueWeight / Math.max(cueTokens.length, file.tokens.length);
    const tokenF1 =
      recall + precision > 0
        ? (2 * recall * precision) / (recall + precision)
        : 0;
    const blended = recall * 0.65 + tokenF1 * 0.35;
    if (blended >= 0.48) {
      return Math.min(0.88, blended * 0.92);
    }
  }

  // Whole-string Levenshtein fallback for short cues like "whoosh" vs "woosh" or "faaah" vs "fah"
  if (cueCompact.length >= 3 && file.compact.length >= 3) {
    const dist = levenshteinDistance(cueCollapsed, fileCollapsed);
    const maxL = Math.max(cueCollapsed.length, fileCollapsed.length);
    const sim = 1 - dist / maxL;
    if (sim >= 0.68) {
      return sim * 0.76;
    }
  }

  return 0;
}

export function fuzzyMatchSoundFile(
  cue: string | undefined,
  soundBank: SoundBankFile[]
): SoundBankFile | null {
  if (!cue || !cue.trim() || soundBank.length === 0) return null;

  let bestFile: SoundBankFile | null = null;
  let bestScore = 0;

  for (const file of soundBank) {
    const s = scoreMatch(cue, file);
    if (s > bestScore) {
      bestScore = s;
      bestFile = file;
    }
  }

  return bestScore >= 0.48 ? bestFile : null;
}

export function resolveSfxFile(
  cue: string | undefined,
  selectedFileId: string | undefined,
  soundBank: SoundBankFile[]
): SoundBankFile | null {
  if (soundBank.length === 0) return null;
  if (selectedFileId === 'none') return null;

  if (selectedFileId && selectedFileId !== 'auto') {
    const exact = soundBank.find((f) => f.id === selectedFileId);
    if (exact) return exact;
  }

  return fuzzyMatchSoundFile(cue, soundBank);
}

export async function decodeSoundBankFiles(
  fileList: FileList | File[],
  audioCtx: AudioContext
): Promise<{ loaded: SoundBankFile[]; skippedCount: number }> {
  const files = Array.from(fileList);
  const loaded: SoundBankFile[] = [];
  let skippedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isAudioMime = file.type.startsWith('audio/');
    const isAudioExt = AUDIO_FILE_EXTENSIONS.test(file.name);
    if (!isAudioMime && !isAudioExt) {
      skippedCount += 1;
      continue;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const baseName = stripFileExtension(file.name);
      const normalized = normalizeAudioText(file.name);
      loaded.push({
        id: `sfx-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        baseName,
        normalized,
        compact: toCompactAlphaNum(normalized),
        tokens: tokenizeNormalized(normalized),
        durationSec: buffer.duration,
        buffer,
      });
    } catch {
      skippedCount += 1;
    }
  }

  loaded.sort((a, b) => a.name.localeCompare(b.name));
  return { loaded, skippedCount };
}

export interface MasterAudioSchedule {
  events: ScheduledAudioEvent[];
  backgroundFile: SoundBankFile | null;
  backgroundVolume: number;
  blackoutRangesMs: Array<{ startMs: number; endMs: number }>;
  typingWindowsMs: Array<{ startMs: number; endMs: number }>;
  totalDurationMs: number;
}

function isTypingSoundCue(cue: string | undefined): boolean {
  if (!cue) return false;
  return /\b(type|typing|keyboard|keystroke|keyclick|keys?|clack)\b/i.test(cue);
}

function scheduleTypingSpan(params: {
  events: ScheduledAudioEvent[];
  typingWindowsMs: Array<{ startMs: number; endMs: number }>;
  idPrefix: string;
  startMs: number;
  endMs: number;
  typingFile: SoundBankFile | null;
  volume: number;
  seed: number;
  sourceLabel: string;
}): void {
  const {
    events,
    typingWindowsMs,
    idPrefix,
    startMs,
    endMs,
    typingFile,
    volume,
    seed,
    sourceLabel,
  } = params;

  const spanMs = endMs - startMs;
  if (spanMs < 35 || volume <= 0) return;

  typingWindowsMs.push({ startMs, endMs });

  // Continuous multi-stroke typing recording (> 0.45s): tile cleanly across the span and hard-stop at endMs
  if (typingFile && typingFile.durationSec > 0.45) {
    const stepMs = Math.max(240, Math.floor((typingFile.durationSec - 0.04) * 1000));
    let cursorMs = startMs;
    let sliceIdx = 0;
    while (cursorMs < endMs - 20) {
      const remainingSec = Math.max(0.02, (endMs - cursorMs) / 1000);
      events.push({
        id: `${idPrefix}-loop-${sliceIdx}`,
        timeMs: cursorMs,
        fileId: typingFile.id,
        volume,
        maxDurationSec: remainingSec,
        isTyping: true,
        sourceLabel,
      });
      cursorMs += stepMs;
      sliceIdx += 1;
    }
    return;
  }

  // Short single keyclick sample (<= 0.45s) OR subtle synthesized keyclick fallback:
  // fire repeated keystrokes at deterministic ~90–120ms intervals, strictly stopping at endMs.
  const fileId = typingFile ? typingFile.id : SYNTH_KEYCLICK_ID;
  let hitMs = startMs;
  let step = 0;
  while (hitMs < endMs - 20) {
    const remainingSec = Math.max(0.02, (endMs - hitMs) / 1000);
    const maxDur = typingFile
      ? Math.min(typingFile.durationSec, remainingSec)
      : Math.min(0.04, remainingSec);
    const pitchRate = 0.95 + (((step * 13 + seed * 7) % 11) / 100);
    events.push({
      id: `${idPrefix}-key-${step}`,
      timeMs: hitMs,
      fileId,
      volume,
      maxDurationSec: Math.max(0.015, maxDur),
      pitchRate,
      isTyping: true,
      sourceLabel,
    });
    const intervalMs = 90 + ((step * 17 + seed * 11) % 31); // 90..120ms deterministic rhythm
    hitMs += intervalMs;
    step += 1;
  }
}

export function buildMasterAudioSchedule(params: {
  timeline: AnimationTimeline;
  messages: ChatMessage[];
  overlays: StageOverlay[];
  previewMode: PreviewMode;
  soundBank: SoundBankFile[];
  backgroundLoop: BackgroundLoopConfig;
  masterMuted?: boolean;
}): MasterAudioSchedule {
  const {
    timeline,
    messages,
    overlays,
    previewMode,
    soundBank,
    backgroundLoop,
    masterMuted = false,
  } = params;

  if (masterMuted) {
    return {
      events: [],
      backgroundFile: null,
      backgroundVolume: 0,
      blackoutRangesMs: [],
      typingWindowsMs: [],
      totalDurationMs: timeline.totalDurationMs,
    };
  }

  const events: ScheduledAudioEvent[] = [];
  const blackoutRangesMs: Array<{ startMs: number; endMs: number }> = [];
  const typingWindowsMs: Array<{ startMs: number; endMs: number }> = [];
  const fallbackTypingFile = findFallbackTypingFile(soundBank);

  // Index segments by message index for exact trigger lookup
  const segsByMsg = new Map<number, TimelineSegment[]>();
  for (const seg of timeline.segments) {
    if (seg.visualEffect === 'cut_to_black') {
      blackoutRangesMs.push({ startMs: seg.startMs, endMs: seg.endMs });
    }
    if (seg.msgIndex >= 0) {
      const list = segsByMsg.get(seg.msgIndex);
      if (list) list.push(seg);
      else segsByMsg.set(seg.msgIndex, [seg]);
    }
  }

  // 1. Per-line SFX + User Typing / [TYPING...] SFX from ChatMessage items
  messages.forEach((msg, idx) => {
    if (msg.sfxMuted) return;

    const msgSegs = segsByMsg.get(idx) ?? [];
    if (msgSegs.length === 0) return;

    // 1a. Explicit [TYPING...] (Hold X sec) cue
    if (msg.cueKind === 'typing') {
      if (msg.sfxFileId === 'none') return;
      const seg = msgSegs.find((s) => s.kind === 'thinking') ?? msgSegs[0];
      const assignedFile = resolveSfxFile(msg.sfxCue, msg.sfxFileId, soundBank);
      const typingFile = assignedFile ?? fallbackTypingFile;
      scheduleTypingSpan({
        events,
        typingWindowsMs,
        idPrefix: `ev-typecue-${msg.id}`,
        startMs: seg.startMs,
        endMs: seg.endMs,
        typingFile,
        volume: Math.max(0, Math.min(1.5, msg.sfxVolume ?? (typingFile ? 0.85 : 0.7))),
        seed: idx + 1,
        sourceLabel: msg.sfxCue || typingFile?.baseName || 'Synthesized Keyclick',
      });
      return;
    }

    // 1b. Regular user message: always play typing SFX during user_typing phase
    // and stop cleanly at user_typing end before user_slide / send pop!
    if (msg.role === 'user' && !msg.cueKind) {
      const typeSeg = msgSegs.find((s) => s.kind === 'user_typing');
      const hasExplicitLineSfx =
        Boolean(msg.sfxCue?.trim()) ||
        (Boolean(msg.sfxFileId) &&
          msg.sfxFileId !== 'auto' &&
          msg.sfxFileId !== 'none');
      const resolvedLineFile = hasExplicitLineSfx
        ? resolveSfxFile(msg.sfxCue, msg.sfxFileId, soundBank)
        : null;
      const lineIsTypingSfx =
        isTypingSoundCue(msg.sfxCue) ||
        Boolean(resolvedLineFile && isTypingSoundCue(resolvedLineFile.normalized));

      if (typeSeg) {
        const typingFile = lineIsTypingSfx
          ? (resolvedLineFile ?? fallbackTypingFile)
          : fallbackTypingFile;
        const typingVol = lineIsTypingSfx
          ? Math.max(0, Math.min(1.5, msg.sfxVolume ?? 0.85))
          : typingFile
            ? 0.55
            : 0.65;
        scheduleTypingSpan({
          events,
          typingWindowsMs,
          idPrefix: `ev-utype-${msg.id}`,
          startMs: typeSeg.startMs,
          endMs: typeSeg.endMs,
          typingFile,
          volume: typingVol,
          seed: idx + 3,
          sourceLabel:
            (lineIsTypingSfx ? msg.sfxCue : undefined) ||
            typingFile?.baseName ||
            'Synthesized Keyclick',
        });
      }

      // Schedule non-typing send SFX (e.g. [SFX: iMessage Pop]) right when the message sends!
      if (!lineIsTypingSfx && resolvedLineFile) {
        const slideSeg =
          msgSegs.find((s) => s.kind === 'user_slide') ??
          msgSegs.find((s) => s.kind === 'user_send_highlight') ??
          msgSegs[0];
        events.push({
          id: `ev-msg-${msg.id}`,
          timeMs: Math.max(0, Math.min(timeline.totalDurationMs, slideSeg.startMs)),
          fileId: resolvedLineFile.id,
          volume: Math.max(0, Math.min(1.5, msg.sfxVolume ?? 0.9)),
          sourceLabel: msg.sfxCue || resolvedLineFile.baseName,
        });
      }
      return;
    }

    // 1c. Visual effects, system events, and assistant replies
    if (soundBank.length === 0) return;

    const hasCueOrManual =
      Boolean(msg.sfxCue?.trim()) ||
      (Boolean(msg.sfxFileId) &&
        msg.sfxFileId !== 'auto' &&
        msg.sfxFileId !== 'none');
    if (!hasCueOrManual) return;

    const file = resolveSfxFile(msg.sfxCue, msg.sfxFileId, soundBank);
    if (!file) return;

    let triggerTimeMs: number | null = null;
    if (msg.cueKind === 'visual_effect') {
      const seg = msgSegs.find((s) => s.kind === 'visual_effect') ?? msgSegs[0];
      triggerTimeMs = seg.startMs;
    } else if (msg.cueKind === 'hold') {
      const seg = msgSegs.find((s) => s.kind === 'post_hold') ?? msgSegs[0];
      triggerTimeMs = seg.startMs;
    } else if (msg.role === 'system') {
      const seg = msgSegs.find((s) => s.kind === 'system_enter') ?? msgSegs[0];
      triggerTimeMs = seg.startMs;
    } else {
      // Assistant message: fire right when the reply begins appearing
      const streamSeg =
        msgSegs.find((s) => s.kind === 'ai_stream') ??
        msgSegs.find((s) => s.kind === 'idle') ??
        msgSegs[0];
      triggerTimeMs = streamSeg.startMs;
    }

    if (triggerTimeMs !== null) {
      events.push({
        id: `ev-msg-${msg.id}`,
        timeMs: Math.max(0, Math.min(timeline.totalDurationMs, triggerTimeMs)),
        fileId: file.id,
        volume: Math.max(0, Math.min(1.5, msg.sfxVolume ?? 0.9)),
        sourceLabel: msg.sfxCue || file.baseName,
      });
    }
  });

  // 2. Timed 16:9 Overlay / GIF Placeholder SFX
  if (previewMode === 'clean16x9' && soundBank.length > 0) {
    for (const ov of overlays) {
      if (ov.sfxMuted) continue;
      const hasCueOrManual =
        Boolean(ov.sfxCue?.trim()) ||
        (Boolean(ov.sfxFileId) &&
          ov.sfxFileId !== 'auto' &&
          ov.sfxFileId !== 'none');
      if (!hasCueOrManual) continue;

      const file = resolveSfxFile(ov.sfxCue, ov.sfxFileId, soundBank);
      if (!file) continue;

      const startMs =
        ov.timingMode === 'timed' ? Math.max(0, ov.startSec * 1000) : 0;
      if (startMs <= timeline.totalDurationMs) {
        events.push({
          id: `ev-ov-${ov.id}`,
          timeMs: startMs,
          fileId: file.id,
          volume: Math.max(0, Math.min(1.5, ov.sfxVolume ?? 0.9)),
          sourceLabel: ov.sfxCue || file.baseName,
        });
      }
    }
  }

  events.sort((a, b) => a.timeMs - b.timeMs);

  // 3. Background Loop Track
  let backgroundFile: SoundBankFile | null = null;
  let backgroundVolume = 0;
  if (
    soundBank.length > 0 &&
    backgroundLoop.enabled &&
    !backgroundLoop.muted &&
    backgroundLoop.volume > 0
  ) {
    backgroundFile = resolveSfxFile(
      backgroundLoop.cueName,
      backgroundLoop.selectedFileId,
      soundBank
    );
    if (backgroundFile) {
      backgroundVolume = Math.max(0, Math.min(1, backgroundLoop.volume));
    }
  }

  return {
    events,
    backgroundFile,
    backgroundVolume,
    blackoutRangesMs,
    typingWindowsMs,
    totalDurationMs: timeline.totalDurationMs,
  };
}

export async function renderMasterAudioMixToBuffer(
  schedule: MasterAudioSchedule,
  soundBank: SoundBankFile[],
  sampleRate = 48000
): Promise<AudioBuffer | null> {
  if (schedule.events.length === 0 && !schedule.backgroundFile) {
    return null;
  }

  const durationSec = Math.max(0.25, schedule.totalDurationMs / 1000);
  const totalFrames = Math.max(1, Math.ceil(durationSec * sampleRate));
  const offline = new OfflineAudioContext(2, totalFrames, sampleRate);
  const fileMap = new Map(soundBank.map((f) => [f.id, f]));

  // Subtle master safety limiter / compressor to prevent clipping when multiple SFX hit together
  const masterBus = offline.createGain();
  masterBus.gain.value = 1.0;
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -2;
  compressor.knee.value = 6;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.1;
  masterBus.connect(compressor);
  compressor.connect(offline.destination);

  // 1. Background Loop (ducked cleanly during hard cut to black!)
  if (schedule.backgroundFile && schedule.backgroundVolume > 0) {
    const bgSrc = offline.createBufferSource();
    bgSrc.buffer = schedule.backgroundFile.buffer;
    bgSrc.loop = true;

    const bgGain = offline.createGain();
    const vol = schedule.backgroundVolume;
    const fadeIn = Math.min(0.08, durationSec * 0.1);
    const fadeOut = Math.min(0.22, durationSec * 0.15);

    bgGain.gain.setValueAtTime(0.0001, 0);
    bgGain.gain.linearRampToValueAtTime(vol, fadeIn);
    if (durationSec > fadeIn + fadeOut) {
      bgGain.gain.setValueAtTime(vol, Math.max(fadeIn, durationSec - fadeOut));
      bgGain.gain.linearRampToValueAtTime(0.0001, durationSec);
    }

    // Hard cut audio silence during cut_to_black segments for authentic punch
    for (const blk of schedule.blackoutRangesMs) {
      const sSec = Math.max(0, blk.startMs / 1000);
      const eSec = Math.min(durationSec, blk.endMs / 1000);
      if (eSec > sSec) {
        bgGain.gain.setValueAtTime(vol, Math.max(0, sSec - 0.005));
        bgGain.gain.linearRampToValueAtTime(0, sSec + 0.01);
        if (eSec < durationSec - 0.05) {
          bgGain.gain.setValueAtTime(0, eSec);
          bgGain.gain.linearRampToValueAtTime(vol, Math.min(durationSec, eSec + 0.04));
        }
      }
    }

    bgSrc.connect(bgGain);
    bgGain.connect(masterBus);
    bgSrc.start(0);
    bgSrc.stop(durationSec);
  }

  // 2. Per-Line, Typing, & Overlay One-Shot SFX Events
  let cachedSynthBuffer: AudioBuffer | null = null;
  for (const ev of schedule.events) {
    if (ev.volume <= 0) continue;

    let audioBuffer: AudioBuffer | null = null;
    if (ev.fileId === SYNTH_KEYCLICK_ID) {
      if (!cachedSynthBuffer) {
        cachedSynthBuffer = getSynthKeyclickBuffer(offline);
      }
      audioBuffer = cachedSynthBuffer;
    } else {
      audioBuffer = fileMap.get(ev.fileId)?.buffer ?? null;
    }
    if (!audioBuffer) continue;

    const startSec = Math.max(0, ev.timeMs / 1000);
    if (startSec >= durationSec) continue;

    const src = offline.createBufferSource();
    src.buffer = audioBuffer;
    const rate = ev.pitchRate && ev.pitchRate > 0 ? ev.pitchRate : 1;
    if (rate !== 1) {
      src.playbackRate.setValueAtTime(rate, startSec);
    }

    const gain = offline.createGain();
    gain.gain.setValueAtTime(ev.volume, startSec);

    src.connect(gain);
    gain.connect(masterBus);

    const effectiveBufferDur = audioBuffer.duration / rate;
    const maxClipDur = ev.maxDurationSec
      ? Math.min(ev.maxDurationSec, durationSec - startSec)
      : durationSec - startSec;

    if (ev.maxDurationSec && (effectiveBufferDur > maxClipDur || ev.isTyping)) {
      const clampedDur = Math.max(0.015, Math.min(effectiveBufferDur, maxClipDur));
      const fadeLen = ev.isTyping
        ? Math.min(0.015, clampedDur * 0.35)
        : Math.min(0.04, clampedDur * 0.35);
      const fadeStart = Math.max(startSec, startSec + clampedDur - fadeLen);
      gain.gain.setValueAtTime(ev.volume, fadeStart);
      gain.gain.linearRampToValueAtTime(0.0001, startSec + clampedDur);
      src.start(startSec, 0, Math.max(0.015, clampedDur * rate));
    } else {
      src.start(startSec);
    }
  }

  return offline.startRendering();
}

export function encodeAudioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;

  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(
        offset,
        sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff),
        true
      );
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Live Web Audio engine for Preview Playback + single-SFX auditioning.
 * Prevents overlap glitches on pause, stop, or timeline scrubbing.
 */
export class LiveAudioEngine {
  private ctx: AudioContext | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private activeTypingSources = new Set<AudioBufferSourceNode>();
  private bgSource: AudioBufferSourceNode | null = null;
  private bgGain: GainNode | null = null;
  private bgBaseVolume = 0.11;

  ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser.');
      }
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  getSynthKeyclickBuffer(): AudioBuffer {
    return getSynthKeyclickBuffer(this.ensureContext());
  }

  unlock(): void {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
    } catch {
      // Ignore unlock errors before gesture
    }
  }

  startBackgroundLoop(
    buffer: AudioBuffer,
    volume: number,
    startOffsetSec = 0
  ): void {
    this.stopBackgroundLoop();
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const gain = ctx.createGain();
      const clampedVol = Math.max(0, Math.min(1, volume));
      this.bgBaseVolume = clampedVol;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(clampedVol, now + 0.06);

      src.connect(gain);
      gain.connect(ctx.destination);

      const safeOffset =
        buffer.duration > 0.05 ? startOffsetSec % buffer.duration : 0;
      src.start(now, safeOffset);

      this.bgSource = src;
      this.bgGain = gain;
    } catch {
      // Ignore playback errors
    }
  }

  setBackgroundLoopGain(volume: number): void {
    if (!this.bgGain || !this.ctx) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this.bgBaseVolume = clamped;
    try {
      this.bgGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.015);
    } catch {
      // Ignore
    }
  }

  setBackgroundDucked(ducked: boolean): void {
    if (!this.bgGain || !this.ctx) return;
    try {
      this.bgGain.gain.setTargetAtTime(
        ducked ? 0 : this.bgBaseVolume,
        this.ctx.currentTime,
        0.01
      );
    } catch {
      // Ignore
    }
  }

  stopBackgroundLoop(): void {
    if (this.bgSource) {
      try {
        this.bgSource.stop();
        this.bgSource.disconnect();
      } catch {
        // Already stopped
      }
      this.bgSource = null;
    }
    if (this.bgGain) {
      try {
        this.bgGain.disconnect();
      } catch {
        // Ignore
      }
      this.bgGain = null;
    }
  }

  playOneShot(
    buffer: AudioBuffer,
    volume: number,
    options?: {
      delaySec?: number;
      maxDurationSec?: number;
      pitchRate?: number;
      isTyping?: boolean;
    }
  ): void {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const rate =
        options?.pitchRate && options.pitchRate > 0 ? options.pitchRate : 1;
      const startTime = ctx.currentTime + Math.max(0, options?.delaySec ?? 0);
      if (rate !== 1) {
        src.playbackRate.setValueAtTime(rate, startTime);
      }

      const gain = ctx.createGain();
      const clampedVol = Math.max(0, Math.min(1.5, volume));
      gain.gain.setValueAtTime(clampedVol, startTime);

      src.connect(gain);
      gain.connect(ctx.destination);

      this.activeSources.add(src);
      if (options?.isTyping) {
        this.activeTypingSources.add(src);
      }
      src.onended = () => {
        this.activeSources.delete(src);
        this.activeTypingSources.delete(src);
        try {
          src.disconnect();
          gain.disconnect();
        } catch {
          // Ignore
        }
      };

      const maxDur = options?.maxDurationSec;
      const effectiveDur = buffer.duration / rate;
      if (maxDur && maxDur > 0 && (effectiveDur > maxDur || options?.isTyping)) {
        const clampedDur = Math.max(0.015, Math.min(effectiveDur, maxDur));
        const fadeLen = options?.isTyping
          ? Math.min(0.015, clampedDur * 0.35)
          : Math.min(0.04, clampedDur * 0.35);
        const fadeStart = Math.max(startTime, startTime + clampedDur - fadeLen);
        gain.gain.setValueAtTime(clampedVol, fadeStart);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + clampedDur);
        src.start(startTime, 0, Math.max(0.015, clampedDur * rate));
      } else {
        src.start(startTime);
      }
    } catch {
      // Ignore
    }
  }

  stopTypingSources(): void {
    for (const src of Array.from(this.activeTypingSources)) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Already stopped
      }
      this.activeSources.delete(src);
    }
    this.activeTypingSources.clear();
  }

  stopAll(): void {
    this.stopBackgroundLoop();
    this.activeTypingSources.clear();
    for (const src of Array.from(this.activeSources)) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.activeSources.clear();
  }

  dispose(): void {
    this.stopAll();
    if (this.ctx) {
      try {
        if (this.ctx.state !== 'closed') {
          void this.ctx.close();
        }
      } catch {
        // Ignore
      }
      this.ctx = null;
    }
  }
}
