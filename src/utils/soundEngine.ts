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
  totalDurationMs: number;
}

function isTypingSoundCue(cue: string | undefined): boolean {
  if (!cue) return false;
  return /\b(type|typing|keyboard|keystroke|keys|clack)\b/i.test(cue);
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

  if (masterMuted || soundBank.length === 0) {
    return {
      events: [],
      backgroundFile: null,
      backgroundVolume: 0,
      blackoutRangesMs: [],
      totalDurationMs: timeline.totalDurationMs,
    };
  }

  const events: ScheduledAudioEvent[] = [];
  const blackoutRangesMs: Array<{ startMs: number; endMs: number }> = [];

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

  // 1. Per-line SFX from ChatMessage items
  messages.forEach((msg, idx) => {
    if (msg.sfxMuted) return;
    const hasCueOrManual =
      Boolean(msg.sfxCue?.trim()) ||
      (Boolean(msg.sfxFileId) &&
        msg.sfxFileId !== 'auto' &&
        msg.sfxFileId !== 'none');
    if (!hasCueOrManual) return;

    const file = resolveSfxFile(msg.sfxCue, msg.sfxFileId, soundBank);
    if (!file) return;

    const msgSegs = segsByMsg.get(idx) ?? [];
    if (msgSegs.length === 0) return;

    let triggerTimeMs: number | null = null;
    let maxDurationSec: number | undefined;

    if (msg.cueKind === 'typing') {
      const seg = msgSegs.find((s) => s.kind === 'thinking') ?? msgSegs[0];
      triggerTimeMs = seg.startMs;
      maxDurationSec = Math.max(0.25, (seg.endMs - seg.startMs) / 1000);
    } else if (msg.cueKind === 'visual_effect') {
      const seg = msgSegs.find((s) => s.kind === 'visual_effect') ?? msgSegs[0];
      triggerTimeMs = seg.startMs;
    } else if (msg.role === 'system') {
      const seg = msgSegs.find((s) => s.kind === 'system_enter') ?? msgSegs[0];
      triggerTimeMs = seg.startMs;
    } else if (msg.role === 'user') {
      if (isTypingSoundCue(msg.sfxCue)) {
        const typeSeg = msgSegs.find((s) => s.kind === 'user_typing');
        if (typeSeg) {
          triggerTimeMs = typeSeg.startMs;
          maxDurationSec = Math.max(0.25, (typeSeg.endMs - typeSeg.startMs) / 1000);
        }
      }
      if (triggerTimeMs === null) {
        const slideSeg =
          msgSegs.find((s) => s.kind === 'user_slide') ??
          msgSegs.find((s) => s.kind === 'user_send_highlight') ??
          msgSegs[0];
        triggerTimeMs = slideSeg.startMs;
      }
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
        maxDurationSec,
        sourceLabel: msg.sfxCue || file.baseName,
      });
    }
  });

  // 2. Timed 16:9 Overlay / GIF Placeholder SFX
  if (previewMode === 'clean16x9') {
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
  if (backgroundLoop.enabled && !backgroundLoop.muted && backgroundLoop.volume > 0) {
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

  // 2. Per-Line & Overlay One-Shot SFX Events
  for (const ev of schedule.events) {
    const file = fileMap.get(ev.fileId);
    if (!file || ev.volume <= 0) continue;

    const startSec = Math.max(0, ev.timeMs / 1000);
    if (startSec >= durationSec) continue;

    const src = offline.createBufferSource();
    src.buffer = file.buffer;

    const gain = offline.createGain();
    gain.gain.setValueAtTime(ev.volume, startSec);

    src.connect(gain);
    gain.connect(masterBus);

    const maxClipDur = ev.maxDurationSec
      ? Math.min(ev.maxDurationSec, durationSec - startSec)
      : durationSec - startSec;

    if (ev.maxDurationSec && file.durationSec > maxClipDur) {
      const fadeStart = Math.max(startSec, startSec + maxClipDur - 0.04);
      gain.gain.setValueAtTime(ev.volume, fadeStart);
      gain.gain.linearRampToValueAtTime(0.0001, startSec + maxClipDur);
      src.start(startSec, 0, Math.max(0.02, maxClipDur));
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
    options?: { delaySec?: number; maxDurationSec?: number }
  ): void {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const gain = ctx.createGain();
      const clampedVol = Math.max(0, Math.min(1.5, volume));
      const startTime = ctx.currentTime + Math.max(0, options?.delaySec ?? 0);
      gain.gain.setValueAtTime(clampedVol, startTime);

      src.connect(gain);
      gain.connect(ctx.destination);

      this.activeSources.add(src);
      src.onended = () => {
        this.activeSources.delete(src);
        try {
          src.disconnect();
          gain.disconnect();
        } catch {
          // Ignore
        }
      };

      const maxDur = options?.maxDurationSec;
      if (maxDur && maxDur > 0 && buffer.duration > maxDur) {
        const fadeStart = Math.max(startTime, startTime + maxDur - 0.04);
        gain.gain.setValueAtTime(clampedVol, fadeStart);
        gain.gain.linearRampToValueAtTime(0.0001, startTime + maxDur);
        src.start(startTime, 0, Math.max(0.02, maxDur));
      } else {
        src.start(startTime);
      }
    } catch {
      // Ignore
    }
  }

  stopAll(): void {
    this.stopBackgroundLoop();
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
