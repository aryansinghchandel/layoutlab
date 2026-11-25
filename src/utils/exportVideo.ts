import {
  ArrayBufferTarget as Mp4ArrayBufferTarget,
  Muxer as Mp4Muxer,
} from 'mp4-muxer';
import {
  ArrayBufferTarget as WebmArrayBufferTarget,
  Muxer as WebmMuxer,
} from 'webm-muxer';
import {
  type AnimationFormat,
  type BackgroundLoopConfig,
  type ChatMessage,
  DEFAULT_BACKGROUND_LOOP,
  type PlaybackSpeed,
  type SoundBankFile,
  type VideoAudioMode,
  type VideoQuality,
} from '../types';
import {
  buildAnimationTimeline,
  computeLogicalDimensions,
  type DecodedGifTrack,
  disposeAnimatedGifs,
  preloadAnimatedGifs,
  preloadAttachmentImages,
  type RenderConfig,
  renderChatFrameToCanvas,
  type ScrollState,
} from './nativeCanvasRenderer';
import {
  buildMasterAudioSchedule,
  buildSfxDurationMap,
  encodeAudioBufferToWavBlob,
  renderMasterAudioMixToBuffer,
} from './soundEngine';

const GIF_JS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
const GIF_WORKER_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js';

interface GifJsInstance {
  addFrame: (
    canvas: HTMLCanvasElement,
    options?: { copy?: boolean; delay?: number }
  ) => void;
  on: (event: string, cb: (arg: unknown) => void) => void;
  render: () => void;
  abort?: () => void;
}

declare global {
  interface Window {
    GIF?: new (options: Record<string, unknown>) => GifJsInstance;
  }
}

export interface ExportProgressInfo {
  percent: number;
  currentFrame: number;
  totalFrames: number;
}

export interface AnimationExportController {
  promise: Promise<void>;
  cancel: () => void;
}

const EXPORT_FPS = 60;
const FRAME_STEP_MS = 1000 / EXPORT_FPS;
const FRAME_DURATION_US = Math.round(1_000_000 / EXPORT_FPS);
const EXPORT_AUDIO_SAMPLE_RATE = 48000;
const EXPORT_AUDIO_CHANNELS = 2;
const EXPORT_AUDIO_CHUNK_FRAMES = 960; // 20ms at 48kHz

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function pickVideoMimeType(
  requested: 'mp4' | 'webm',
  withAudio = false
): { mimeType: string; extension: 'mp4' | 'webm' } {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  if (requested === 'mp4') {
    const mp4Candidates = withAudio
      ? [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
        ]
      : [
          'video/mp4;codecs=avc1.42E01E',
          'video/mp4;codecs=avc1',
          'video/mp4',
        ];
    for (const type of mp4Candidates) {
      if (MediaRecorder.isTypeSupported(type)) {
        return { mimeType: type, extension: 'mp4' };
      }
    }
  }

  const webmCandidates = withAudio
    ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const type of webmCandidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, extension: 'webm' };
    }
  }

  return { mimeType: '', extension: 'webm' };
}

interface SupportedWebCodecsSetup {
  container: 'mp4' | 'webm';
  mp4Codec?: 'avc' | 'vp9';
  webmCodec?: 'V_VP9' | 'V_VP8';
  encoderConfig: VideoEncoderConfig;
}

interface SupportedAudioWebCodecsSetup {
  mp4AudioCodec?: 'aac' | 'opus';
  webmAudioCodec?: 'A_OPUS';
  encoderConfig: AudioEncoderConfig;
}

async function probeWebCodecsAudioSetup(
  container: 'mp4' | 'webm'
): Promise<SupportedAudioWebCodecsSetup | null> {
  if (
    typeof AudioEncoder === 'undefined' ||
    typeof AudioData === 'undefined'
  ) {
    return null;
  }

  if (container === 'mp4') {
    const mp4AudioCandidates: Array<{
      codec: string;
      muxCodec: 'aac' | 'opus';
    }> = [
      { codec: 'mp4a.40.2', muxCodec: 'aac' },
      { codec: 'opus', muxCodec: 'opus' },
    ];
    for (const item of mp4AudioCandidates) {
      const cfg: AudioEncoderConfig = {
        codec: item.codec,
        numberOfChannels: EXPORT_AUDIO_CHANNELS,
        sampleRate: EXPORT_AUDIO_SAMPLE_RATE,
        bitrate: 192_000,
      };
      try {
        const support = await AudioEncoder.isConfigSupported(cfg);
        if (support.supported) {
          return { mp4AudioCodec: item.muxCodec, encoderConfig: cfg };
        }
      } catch {
        // Try next candidate
      }
    }
    return null;
  }

  const webmCfg: AudioEncoderConfig = {
    codec: 'opus',
    numberOfChannels: EXPORT_AUDIO_CHANNELS,
    sampleRate: EXPORT_AUDIO_SAMPLE_RATE,
    bitrate: 192_000,
  };
  try {
    const support = await AudioEncoder.isConfigSupported(webmCfg);
    if (support.supported) {
      return { webmAudioCodec: 'A_OPUS', encoderConfig: webmCfg };
    }
  } catch {
    // Unsupported
  }
  return null;
}

function encodeAudioSliceToEncoder(
  audioEncoder: AudioEncoder,
  ch0: Float32Array,
  ch1: Float32Array,
  sampleRate: number,
  offsetFrames: number,
  numFrames: number
) {
  const planar = new Float32Array(numFrames * 2);
  planar.set(ch0.subarray(offsetFrames, offsetFrames + numFrames), 0);
  planar.set(ch1.subarray(offsetFrames, offsetFrames + numFrames), numFrames);
  const timestampUs = Math.round((offsetFrames / sampleRate) * 1_000_000);
  const audioData = new AudioData({
    format: 'f32-planar',
    sampleRate,
    numberOfFrames: numFrames,
    numberOfChannels: 2,
    timestamp: timestampUs,
    data: planar,
  });
  try {
    audioEncoder.encode(audioData);
  } finally {
    audioData.close();
  }
}

async function probeWebCodecsSetup(
  requestedFormat: 'mp4' | 'webm',
  width: number,
  height: number,
  bitrate: number
): Promise<SupportedWebCodecsSetup | null> {
  if (
    typeof VideoEncoder === 'undefined' ||
    typeof VideoFrame === 'undefined'
  ) {
    return null;
  }

  const isUltraHd = width > 1920 || height > 1080;

  if (requestedFormat === 'mp4') {
    const avcCodecs = isUltraHd
      ? [
          'avc1.640034',
          'avc1.4d0034',
          'avc1.420034',
          'avc1.640033',
          'avc1.4d0033',
        ]
      : [
          'avc1.64002a',
          'avc1.4d002a',
          'avc1.42002a',
          'avc1.640028',
          'avc1.4d0028',
          'avc1.42E01F',
        ];

    for (const codec of avcCodecs) {
      const cfg: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: EXPORT_FPS,
        avc: { format: 'avc' },
      };
      try {
        const support = await VideoEncoder.isConfigSupported(cfg);
        if (support.supported) {
          return {
            container: 'mp4',
            mp4Codec: 'avc',
            encoderConfig: cfg,
          };
        }
      } catch {
        // Try next codec candidate
      }
    }

    const vp9Codecs = isUltraHd
      ? ['vp09.00.50.08', 'vp09.00.41.08', 'vp09.00.10.08']
      : ['vp09.00.41.08', 'vp09.00.10.08'];

    for (const codec of vp9Codecs) {
      const cfg: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: EXPORT_FPS,
      };
      try {
        const support = await VideoEncoder.isConfigSupported(cfg);
        if (support.supported) {
          return {
            container: 'mp4',
            mp4Codec: 'vp9',
            encoderConfig: cfg,
          };
        }
      } catch {
        // Try next codec candidate
      }
    }
  }

  const webmCandidates: Array<{ codec: string; muxCodec: 'V_VP9' | 'V_VP8' }> =
    isUltraHd
      ? [
          { codec: 'vp09.00.50.08', muxCodec: 'V_VP9' },
          { codec: 'vp09.00.41.08', muxCodec: 'V_VP9' },
          { codec: 'vp09.00.10.08', muxCodec: 'V_VP9' },
          { codec: 'vp8', muxCodec: 'V_VP8' },
        ]
      : [
          { codec: 'vp09.00.41.08', muxCodec: 'V_VP9' },
          { codec: 'vp09.00.10.08', muxCodec: 'V_VP9' },
          { codec: 'vp8', muxCodec: 'V_VP8' },
        ];

  for (const item of webmCandidates) {
    const cfg: VideoEncoderConfig = {
      codec: item.codec,
      width,
      height,
      bitrate,
      framerate: EXPORT_FPS,
    };
    try {
      const support = await VideoEncoder.isConfigSupported(cfg);
      if (support.supported) {
        return {
          container: 'webm',
          webmCodec: item.muxCodec,
          encoderConfig: cfg,
        };
      }
    } catch {
      // Try next codec candidate
    }
  }

  return null;
}

async function ensureGifJsLoaded(): Promise<NonNullable<Window['GIF']>> {
  if (window.GIF) {
    return window.GIF;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIF_JS_CDN}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load gif.js from CDN.')),
        { once: true }
      );
      return;
    }
    const script = document.createElement('script');
    script.src = GIF_JS_CDN;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load gif.js from CDN.'));
    document.head.appendChild(script);
  });

  if (!window.GIF) {
    throw new Error('gif.js did not initialize.');
  }
  return window.GIF;
}

async function createInlineGifWorkerUrl(): Promise<string> {
  const response = await fetch(GIF_WORKER_CDN, { mode: 'cors' });
  if (!response.ok) {
    throw new Error('Unable to load gif.worker.js from CDN.');
  }
  const workerSource = await response.text();
  const blob = new Blob([workerSource], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportAudioStemWav(params: {
  messages: ChatMessage[];
  config: RenderConfig;
  speed: PlaybackSpeed;
  readingPacing?: number;
  autoCameraMotion?: boolean;
  emojiBurstEnabled?: boolean;
  soundBank: SoundBankFile[];
  backgroundLoop: BackgroundLoopConfig;
  masterMuted?: boolean;
  masterVolume?: number;
}): Promise<{ eventCount: number; hasBackground: boolean; durationSec: number }> {
  const {
    messages,
    config,
    speed,
    readingPacing = 1.0,
    autoCameraMotion = true,
    emojiBurstEnabled = true,
    soundBank,
    backgroundLoop,
    masterMuted = false,
    masterVolume = 1.0,
  } = params;

  if (messages.length === 0) {
    throw new Error('Add at least one message before exporting a WAV audio stem.');
  }

  const sfxDurationsMs = buildSfxDurationMap(messages, soundBank);
  const timeline = buildAnimationTimeline(
    messages,
    speed,
    config.showBottomBar,
    {
      includeFinalHold: true,
      readingPacing,
      autoCameraMotion,
      emojiBurstEnabled,
      sfxDurationsMs,
    }
  );

  const schedule = buildMasterAudioSchedule({
    timeline,
    messages,
    overlays: config.overlays ?? [],
    previewMode: config.previewMode,
    soundBank,
    backgroundLoop,
    masterMuted,
    masterVolume,
  });

  if (schedule.events.length === 0 && !schedule.backgroundFile) {
    throw new Error(
      'No matched SFX cues or background loop are active. Assign sounds or unmute to export WAV.'
    );
  }

  const renderedBuffer = await renderMasterAudioMixToBuffer(
    schedule,
    soundBank,
    EXPORT_AUDIO_SAMPLE_RATE
  );
  if (!renderedBuffer) {
    throw new Error('Unable to render audio mix.');
  }

  const wavBlob = encodeAudioBufferToWavBlob(renderedBuffer);
  triggerBlobDownload(wavBlob, 'layoutlab-audio-stem.wav');

  return {
    eventCount: schedule.events.length,
    hasBackground: Boolean(schedule.backgroundFile),
    durationSec: timeline.totalDurationMs / 1000,
  };
}

export function startNativeAnimationExport(params: {
  messages: ChatMessage[];
  config: RenderConfig;
  speed: PlaybackSpeed;
  readingPacing?: number;
  autoCameraMotion?: boolean;
  emojiBurstEnabled?: boolean;
  quality: VideoQuality;
  format: AnimationFormat;
  audioMode?: VideoAudioMode;
  soundBank?: SoundBankFile[];
  backgroundLoop?: BackgroundLoopConfig;
  masterAudioMuted?: boolean;
  masterAudioVolume?: number;
  onProgress: (info: ExportProgressInfo) => void;
}): AnimationExportController {
  const {
    messages,
    config,
    speed,
    readingPacing = 1.0,
    autoCameraMotion = true,
    emojiBurstEnabled = true,
    quality,
    format,
    audioMode = 'baked',
    soundBank = [],
    backgroundLoop,
    masterAudioMuted = false,
    masterAudioVolume = 1.0,
    onProgress,
  } = params;
  let cancelled = false;
  let activeRecorder: MediaRecorder | null = null;
  let activeStream: MediaStream | null = null;
  let activeEncoder: VideoEncoder | null = null;
  let activeAudioEncoder: AudioEncoder | null = null;
  let activeFallbackAudioCtx: AudioContext | null = null;
  let activeGif: GifJsInstance | null = null;
  let activeWorkerUrl: string | null = null;
  let activeGifCache: Map<string, DecodedGifTrack> | null = null;

  const cleanup = () => {
    if (activeEncoder) {
      try {
        if (activeEncoder.state !== 'closed') {
          activeEncoder.close();
        }
      } catch {
        // Ignore close errors during cleanup
      }
      activeEncoder = null;
    }
    if (activeAudioEncoder) {
      try {
        if (activeAudioEncoder.state !== 'closed') {
          activeAudioEncoder.close();
        }
      } catch {
        // Ignore
      }
      activeAudioEncoder = null;
    }
    if (activeFallbackAudioCtx) {
      try {
        if (activeFallbackAudioCtx.state !== 'closed') {
          void activeFallbackAudioCtx.close();
        }
      } catch {
        // Ignore
      }
      activeFallbackAudioCtx = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop());
      activeStream = null;
    }
    if (activeWorkerUrl) {
      URL.revokeObjectURL(activeWorkerUrl);
      activeWorkerUrl = null;
    }
    if (activeGifCache) {
      disposeAnimatedGifs(activeGifCache);
      activeGifCache = null;
    }
  };

  const cancel = () => {
    cancelled = true;
    if (activeRecorder && activeRecorder.state !== 'inactive') {
      activeRecorder.onstop = null;
      activeRecorder.stop();
    }
    if (activeGif && typeof activeGif.abort === 'function') {
      activeGif.abort();
    }
    cleanup();
  };

  const promise = (async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    if (cancelled) return;

    const scale = quality === '4k' ? 4 : 2;
    const videoBitsPerSecond = quality === '4k' ? 25_000_000 : 12_000_000;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create off-screen 2D canvas.');
    }

    const [imageCache, gifCache] = await Promise.all([
      preloadAttachmentImages(messages, config.overlays),
      preloadAnimatedGifs(config.overlays),
    ]);
    activeGifCache = gifCache;
    if (cancelled) {
      cleanup();
      return;
    }

    const { width: logicalWidth, height: logicalHeight } =
      computeLogicalDimensions(ctx, config, messages, imageCache);

    if (format === 'gif') {
      const gifScale = quality === '4k' ? 2 : 1.5;
      canvas.width = Math.round(logicalWidth * gifScale);
      canvas.height = Math.round(logicalHeight * gifScale);

      const GIFConstructor = await ensureGifJsLoaded();
      if (cancelled) {
        cleanup();
        return;
      }
      activeWorkerUrl = await createInlineGifWorkerUrl();
      if (cancelled) {
        cleanup();
        return;
      }

      const sfxDurationsMs = buildSfxDurationMap(messages, soundBank);
      const timeline = buildAnimationTimeline(
        messages,
        speed,
        config.showBottomBar,
        {
          includeFinalHold: true,
          readingPacing,
          autoCameraMotion,
          emojiBurstEnabled,
          sfxDurationsMs,
        }
      );
      const scrollState: ScrollState = { y: 0 };
      const frameDelayMs = 40; // Smooth deterministic 25 FPS GIF
      const totalSteps = Math.max(
        1,
        Math.ceil(timeline.totalDurationMs / frameDelayMs)
      );
      const totalFrames = totalSteps + 1;

      const gif = new GIFConstructor({
        workers: 2,
        quality: 8,
        width: canvas.width,
        height: canvas.height,
        workerScript: activeWorkerUrl,
      });
      activeGif = gif;

      let currentTimeMs = 0;
      for (let step = 0; step <= totalSteps; step++) {
        if (cancelled) {
          cleanup();
          return;
        }
        const elapsed = Math.min(currentTimeMs, timeline.totalDurationMs);
        const frame = timeline.evaluateAt(elapsed);
        renderChatFrameToCanvas(
          ctx,
          logicalWidth,
          logicalHeight,
          gifScale,
          config,
          frame,
          scrollState,
          imageCache,
          gifCache
        );
        gif.addFrame(canvas, { copy: true, delay: frameDelayMs });
        currentTimeMs += frameDelayMs;

        const currentFrame = step + 1;
        onProgress({
          percent: Math.min(40, Math.round((currentFrame / totalFrames) * 40)),
          currentFrame,
          totalFrames,
        });

        await yieldToMainThread();
      }

      await new Promise<void>((resolve, reject) => {
        gif.on('progress', (p) => {
          if (cancelled) return;
          const pct = typeof p === 'number' ? p : 0;
          onProgress({
            percent: Math.min(99, 40 + Math.round(pct * 60)),
            currentFrame: totalFrames,
            totalFrames,
          });
        });
        gif.on('finished', (blob) => {
          if (cancelled) {
            cleanup();
            resolve();
            return;
          }
          onProgress({
            percent: 100,
            currentFrame: totalFrames,
            totalFrames,
          });
          triggerBlobDownload(blob as Blob, 'layoutlab-animation.gif');
          cleanup();
          resolve();
        });
        gif.on('abort', () => {
          cleanup();
          resolve();
        });
        try {
          gif.render();
        } catch (err) {
          cleanup();
          reject(err);
        }
      });
      return;
    }

    // Ensure even pixel dimensions required by H.264 / VP9 video encoders
    const pixelWidth = Math.max(2, Math.round((logicalWidth * scale) / 2) * 2);
    const pixelHeight = Math.max(2, Math.round((logicalHeight * scale) / 2) * 2);
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    const sfxDurationsMs = buildSfxDurationMap(messages, soundBank);
    const timeline = buildAnimationTimeline(
      messages,
      speed,
      config.showBottomBar,
      {
        includeFinalHold: true,
        readingPacing,
        autoCameraMotion,
        emojiBurstEnabled,
        sfxDurationsMs,
      }
    );
    const scrollState: ScrollState = { y: 0 };
    const totalFrames = Math.max(
      1,
      Math.ceil(timeline.totalDurationMs / FRAME_STEP_MS) + 1
    );

    // Offline render synced audio mix (Background Loop + typing SFX + per-line SFX + GIF overlay SFX)
    let renderedAudioBuffer: AudioBuffer | null = null;
    if (audioMode === 'baked' && !masterAudioMuted && masterAudioVolume > 0) {
      const schedule = buildMasterAudioSchedule({
        timeline,
        messages,
        overlays: config.overlays ?? [],
        previewMode: config.previewMode,
        soundBank,
        backgroundLoop: backgroundLoop ?? DEFAULT_BACKGROUND_LOOP,
        masterMuted: masterAudioMuted,
        masterVolume: masterAudioVolume,
      });
      if (schedule.events.length > 0 || schedule.backgroundFile) {
        renderedAudioBuffer = await renderMasterAudioMixToBuffer(
          schedule,
          soundBank,
          EXPORT_AUDIO_SAMPLE_RATE
        );
        if (cancelled) {
          cleanup();
          return;
        }
      }
    }

    // Primary Path: Frame-Locked Deterministic WebCodecs (VideoEncoder + Optional AudioEncoder + MP4/WebM Muxer)
    const webCodecsSetup = await probeWebCodecsSetup(
      format,
      pixelWidth,
      pixelHeight,
      videoBitsPerSecond
    );
    if (cancelled) {
      cleanup();
      return;
    }

    if (webCodecsSetup) {
      const audioWebCodecsSetup = renderedAudioBuffer
        ? await probeWebCodecsAudioSetup(webCodecsSetup.container)
        : null;
      if (cancelled) {
        cleanup();
        return;
      }

      const audioCh0 =
        renderedAudioBuffer && audioWebCodecsSetup
          ? renderedAudioBuffer.getChannelData(0)
          : null;
      const audioCh1 =
        renderedAudioBuffer && audioWebCodecsSetup
          ? renderedAudioBuffer.numberOfChannels > 1
            ? renderedAudioBuffer.getChannelData(1)
            : renderedAudioBuffer.getChannelData(0)
          : null;
      const audioTotalFrames = renderedAudioBuffer?.length ?? 0;

      let encoderFailure: Error | null = null;

      if (webCodecsSetup.container === 'mp4') {
        const target = new Mp4ArrayBufferTarget();
        const muxer = new Mp4Muxer({
          target,
          video: {
            codec: webCodecsSetup.mp4Codec ?? 'avc',
            width: pixelWidth,
            height: pixelHeight,
            frameRate: EXPORT_FPS,
          },
          ...(audioWebCodecsSetup && audioWebCodecsSetup.mp4AudioCodec
            ? {
                audio: {
                  codec: audioWebCodecsSetup.mp4AudioCodec,
                  numberOfChannels: EXPORT_AUDIO_CHANNELS,
                  sampleRate: EXPORT_AUDIO_SAMPLE_RATE,
                },
              }
            : {}),
          fastStart: 'in-memory',
          firstTimestampBehavior: 'strict',
        });

        const encoder = new VideoEncoder({
          output: (chunk, meta) => {
            muxer.addVideoChunk(chunk, meta);
          },
          error: (err) => {
            encoderFailure =
              err instanceof Error ? err : new Error(String(err));
          },
        });
        activeEncoder = encoder;
        encoder.configure(webCodecsSetup.encoderConfig);

        let audioEncoder: AudioEncoder | null = null;
        if (audioWebCodecsSetup && audioCh0 && audioCh1) {
          audioEncoder = new AudioEncoder({
            output: (chunk, meta) => {
              muxer.addAudioChunk(chunk, meta);
            },
            error: (err) => {
              encoderFailure =
                err instanceof Error ? err : new Error(String(err));
            },
          });
          activeAudioEncoder = audioEncoder;
          audioEncoder.configure(audioWebCodecsSetup.encoderConfig);
        }

        onProgress({ percent: 0, currentFrame: 0, totalFrames });

        let currentTimeMs = 0;
        let audioOffsetFrames = 0;
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
          if (cancelled) {
            cleanup();
            return;
          }
          if (encoderFailure) {
            throw encoderFailure;
          }

          const clampedElapsed = Math.min(
            currentTimeMs,
            timeline.totalDurationMs
          );
          const frameState = timeline.evaluateAt(clampedElapsed);

          renderChatFrameToCanvas(
            ctx,
            logicalWidth,
            logicalHeight,
            scale,
            config,
            frameState,
            scrollState,
            imageCache,
            gifCache
          );

          while (!cancelled && !encoderFailure && encoder.encodeQueueSize > 8) {
            await yieldToMainThread();
          }
          if (cancelled) {
            cleanup();
            return;
          }
          if (encoderFailure) {
            throw encoderFailure;
          }

          const timestampUs = Math.round(
            frameIndex * (1_000_000 / EXPORT_FPS)
          );
          const videoFrame = new VideoFrame(canvas, {
            timestamp: timestampUs,
            duration: FRAME_DURATION_US,
          });
          try {
            encoder.encode(videoFrame, {
              keyFrame: frameIndex % (EXPORT_FPS * 2) === 0,
            });
          } finally {
            videoFrame.close();
          }

          if (audioEncoder && audioCh0 && audioCh1) {
            while (
              audioOffsetFrames < audioTotalFrames &&
              Math.round(
                (audioOffsetFrames / EXPORT_AUDIO_SAMPLE_RATE) * 1_000_000
              ) <= timestampUs
            ) {
              while (
                !cancelled &&
                !encoderFailure &&
                audioEncoder.encodeQueueSize > 16
              ) {
                await yieldToMainThread();
              }
              if (cancelled || encoderFailure) break;
              const numFrames = Math.min(
                EXPORT_AUDIO_CHUNK_FRAMES,
                audioTotalFrames - audioOffsetFrames
              );
              encodeAudioSliceToEncoder(
                audioEncoder,
                audioCh0,
                audioCh1,
                EXPORT_AUDIO_SAMPLE_RATE,
                audioOffsetFrames,
                numFrames
              );
              audioOffsetFrames += numFrames;
            }
          }

          currentTimeMs += FRAME_STEP_MS;

          const currentFrame = frameIndex + 1;
          onProgress({
            percent: Math.min(
              99,
              Math.round((currentFrame / totalFrames) * 100)
            ),
            currentFrame,
            totalFrames,
          });

          await yieldToMainThread();
        }

        if (audioEncoder && audioCh0 && audioCh1) {
          while (
            !cancelled &&
            !encoderFailure &&
            audioOffsetFrames < audioTotalFrames
          ) {
            while (
              !cancelled &&
              !encoderFailure &&
              audioEncoder.encodeQueueSize > 16
            ) {
              await yieldToMainThread();
            }
            if (cancelled || encoderFailure) break;
            const numFrames = Math.min(
              EXPORT_AUDIO_CHUNK_FRAMES,
              audioTotalFrames - audioOffsetFrames
            );
            encodeAudioSliceToEncoder(
              audioEncoder,
              audioCh0,
              audioCh1,
              EXPORT_AUDIO_SAMPLE_RATE,
              audioOffsetFrames,
              numFrames
            );
            audioOffsetFrames += numFrames;
          }
        }

        if (cancelled) {
          cleanup();
          return;
        }
        if (encoderFailure) {
          throw encoderFailure;
        }

        await encoder.flush();
        if (audioEncoder) {
          await audioEncoder.flush();
        }
        if (cancelled) {
          cleanup();
          return;
        }
        muxer.finalize();
        const blob = new Blob([target.buffer], { type: 'video/mp4' });
        onProgress({ percent: 100, currentFrame: totalFrames, totalFrames });
        triggerBlobDownload(blob, 'layoutlab-animation.mp4');
        cleanup();
        return;
      }

      // WebM via WebCodecs + webm-muxer
      const target = new WebmArrayBufferTarget();
      const muxer = new WebmMuxer({
        target,
        video: {
          codec: webCodecsSetup.webmCodec ?? 'V_VP9',
          width: pixelWidth,
          height: pixelHeight,
          frameRate: EXPORT_FPS,
        },
        ...(audioWebCodecsSetup && audioWebCodecsSetup.webmAudioCodec
          ? {
              audio: {
                codec: audioWebCodecsSetup.webmAudioCodec,
                numberOfChannels: EXPORT_AUDIO_CHANNELS,
                sampleRate: EXPORT_AUDIO_SAMPLE_RATE,
              },
            }
          : {}),
        firstTimestampBehavior: 'strict',
      });

      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta);
        },
        error: (err) => {
          encoderFailure = err instanceof Error ? err : new Error(String(err));
        },
      });
      activeEncoder = encoder;
      encoder.configure(webCodecsSetup.encoderConfig);

      let audioEncoder: AudioEncoder | null = null;
      if (audioWebCodecsSetup && audioCh0 && audioCh1) {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            muxer.addAudioChunk(chunk, meta);
          },
          error: (err) => {
            encoderFailure =
              err instanceof Error ? err : new Error(String(err));
          },
        });
        activeAudioEncoder = audioEncoder;
        audioEncoder.configure(audioWebCodecsSetup.encoderConfig);
      }

      onProgress({ percent: 0, currentFrame: 0, totalFrames });

      let currentTimeMs = 0;
      let audioOffsetFrames = 0;
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (cancelled) {
          cleanup();
          return;
        }
        if (encoderFailure) {
          throw encoderFailure;
        }

        const clampedElapsed = Math.min(
          currentTimeMs,
          timeline.totalDurationMs
        );
        const frameState = timeline.evaluateAt(clampedElapsed);

        renderChatFrameToCanvas(
          ctx,
          logicalWidth,
          logicalHeight,
          scale,
          config,
          frameState,
          scrollState,
          imageCache,
          gifCache
        );

        while (!cancelled && !encoderFailure && encoder.encodeQueueSize > 8) {
          await yieldToMainThread();
        }
        if (cancelled) {
          cleanup();
          return;
        }
        if (encoderFailure) {
          throw encoderFailure;
        }

        const timestampUs = Math.round(frameIndex * (1_000_000 / EXPORT_FPS));
        const videoFrame = new VideoFrame(canvas, {
          timestamp: timestampUs,
          duration: FRAME_DURATION_US,
        });
        try {
          encoder.encode(videoFrame, {
            keyFrame: frameIndex % (EXPORT_FPS * 2) === 0,
          });
        } finally {
          videoFrame.close();
        }

        if (audioEncoder && audioCh0 && audioCh1) {
          while (
            audioOffsetFrames < audioTotalFrames &&
            Math.round(
              (audioOffsetFrames / EXPORT_AUDIO_SAMPLE_RATE) * 1_000_000
            ) <= timestampUs
          ) {
            while (
              !cancelled &&
              !encoderFailure &&
              audioEncoder.encodeQueueSize > 16
            ) {
              await yieldToMainThread();
            }
            if (cancelled || encoderFailure) break;
            const numFrames = Math.min(
              EXPORT_AUDIO_CHUNK_FRAMES,
              audioTotalFrames - audioOffsetFrames
            );
            encodeAudioSliceToEncoder(
              audioEncoder,
              audioCh0,
              audioCh1,
              EXPORT_AUDIO_SAMPLE_RATE,
              audioOffsetFrames,
              numFrames
            );
            audioOffsetFrames += numFrames;
          }
        }

        currentTimeMs += FRAME_STEP_MS;

        const currentFrame = frameIndex + 1;
        onProgress({
          percent: Math.min(
            99,
            Math.round((currentFrame / totalFrames) * 100)
          ),
          currentFrame,
          totalFrames,
        });

        await yieldToMainThread();
      }

      if (audioEncoder && audioCh0 && audioCh1) {
        while (
          !cancelled &&
          !encoderFailure &&
          audioOffsetFrames < audioTotalFrames
        ) {
          while (
            !cancelled &&
            !encoderFailure &&
            audioEncoder.encodeQueueSize > 16
          ) {
            await yieldToMainThread();
          }
          if (cancelled || encoderFailure) break;
          const numFrames = Math.min(
            EXPORT_AUDIO_CHUNK_FRAMES,
            audioTotalFrames - audioOffsetFrames
          );
          encodeAudioSliceToEncoder(
            audioEncoder,
            audioCh0,
            audioCh1,
            EXPORT_AUDIO_SAMPLE_RATE,
            audioOffsetFrames,
            numFrames
          );
          audioOffsetFrames += numFrames;
        }
      }

      if (cancelled) {
        cleanup();
        return;
      }
      if (encoderFailure) {
        throw encoderFailure;
      }

      await encoder.flush();
      if (audioEncoder) {
        await audioEncoder.flush();
      }
      if (cancelled) {
        cleanup();
        return;
      }
      muxer.finalize();
      const blob = new Blob([target.buffer], { type: 'video/webm' });
      onProgress({ percent: 100, currentFrame: totalFrames, totalFrames });
      triggerBlobDownload(blob, 'layoutlab-animation.webm');
      cleanup();
      return;
    }

    // Fallback Path (Legacy browsers without WebCodecs):
    if (typeof canvas.captureStream !== 'function') {
      throw new Error(
        'Canvas 60 FPS video export is not supported in this browser.'
      );
    }

    const withFallbackAudio = Boolean(renderedAudioBuffer);
    const { mimeType, extension } = pickVideoMimeType(format, withFallbackAudio);
    const videoStream = canvas.captureStream(0);
    const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

    let fallbackAudioSource: AudioBufferSourceNode | null = null;
    if (renderedAudioBuffer) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          activeFallbackAudioCtx = audioCtx;
          const dest = audioCtx.createMediaStreamDestination();
          const src = audioCtx.createBufferSource();
          src.buffer = renderedAudioBuffer;
          src.connect(dest);
          fallbackAudioSource = src;
          combinedTracks.push(...dest.stream.getAudioTracks());
        }
      } catch {
        // Proceed video-only
      }
    }

    const stream = new MediaStream(combinedTracks);
    activeStream = stream;
    const videoTrack = videoStream.getVideoTracks()[0] as
      | (MediaStreamTrack & { requestFrame?: () => void })
      | undefined;

    const recorder = new MediaRecorder(stream, {
      videoBitsPerSecond,
      ...(mimeType ? { mimeType } : {}),
    });
    activeRecorder = recorder;

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };

    renderChatFrameToCanvas(
      ctx,
      logicalWidth,
      logicalHeight,
      scale,
      config,
      timeline.evaluateAt(0),
      scrollState,
      imageCache,
      gifCache
    );

    const stopPromise = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => {
        if (cancelled) {
          cleanup();
          resolve();
          return;
        }
        try {
          const blob = new Blob(chunks, {
            type: mimeType || `video/${extension}`,
          });
          onProgress({
            percent: 100,
            currentFrame: totalFrames,
            totalFrames,
          });
          triggerBlobDownload(blob, `layoutlab-animation.${extension}`);
          cleanup();
          resolve();
        } catch (err) {
          cleanup();
          reject(err);
        }
      };
      recorder.onerror = () => {
        cleanup();
        reject(new Error('Video encoder encountered an error while recording.'));
      };
    });

    if (fallbackAudioSource) {
      fallbackAudioSource.start();
    }

    recorder.start(200);
    onProgress({ percent: 0, currentFrame: 0, totalFrames });

    let currentTimeMs = 0;
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (cancelled) {
        cleanup();
        return;
      }

      const clampedElapsed = Math.min(currentTimeMs, timeline.totalDurationMs);
      const frame = timeline.evaluateAt(clampedElapsed);

      renderChatFrameToCanvas(
        ctx,
        logicalWidth,
        logicalHeight,
        scale,
        config,
        frame,
        scrollState,
        imageCache,
        gifCache
      );

      if (videoTrack && typeof videoTrack.requestFrame === 'function') {
        videoTrack.requestFrame();
      }

      currentTimeMs += FRAME_STEP_MS;

      const currentFrame = frameIndex + 1;
      onProgress({
        percent: Math.min(99, Math.round((currentFrame / totalFrames) * 100)),
        currentFrame,
        totalFrames,
      });

      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, Math.round(FRAME_STEP_MS))
      );
    }

    if (cancelled) {
      cleanup();
      return;
    }

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }

    await stopPromise;
  })();

  return { promise, cancel };
}
