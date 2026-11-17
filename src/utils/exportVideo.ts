import type {
  AnimationFormat,
  ChatMessage,
  PlaybackSpeed,
  VideoQuality,
} from '../types';
import {
  buildAnimationTimeline,
  computeLogicalDimensions,
  preloadAttachmentImages,
  type RenderConfig,
  renderChatFrameToCanvas,
  type ScrollState,
} from './nativeCanvasRenderer';

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

export interface AnimationExportController {
  promise: Promise<void>;
  cancel: () => void;
}

function pickVideoMimeType(
  requested: 'mp4' | 'webm'
): { mimeType: string; extension: 'mp4' | 'webm' } {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  if (requested === 'mp4') {
    const mp4Candidates = [
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

  const webmCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of webmCandidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, extension: 'webm' };
    }
  }

  return { mimeType: '', extension: 'webm' };
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

export function startNativeAnimationExport(params: {
  messages: ChatMessage[];
  config: RenderConfig;
  speed: PlaybackSpeed;
  quality: VideoQuality;
  format: AnimationFormat;
  onProgress: (percent: number) => void;
}): AnimationExportController {
  const { messages, config, speed, quality, format, onProgress } = params;
  let cancelled = false;
  let activeRafId = 0;
  let activeRecorder: MediaRecorder | null = null;
  let activeStream: MediaStream | null = null;
  let activeGif: GifJsInstance | null = null;
  let activeWorkerUrl: string | null = null;

  const cleanup = () => {
    if (activeRafId) {
      window.cancelAnimationFrame(activeRafId);
      activeRafId = 0;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop());
      activeStream = null;
    }
    if (activeWorkerUrl) {
      URL.revokeObjectURL(activeWorkerUrl);
      activeWorkerUrl = null;
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

    const imageCache = await preloadAttachmentImages(messages);
    if (cancelled) return;

    const { width: logicalWidth, height: logicalHeight } =
      computeLogicalDimensions(ctx, config, messages, imageCache);

    if (format === 'gif') {
      const gifScale = quality === '4k' ? 2 : 1.5;
      canvas.width = Math.round(logicalWidth * gifScale);
      canvas.height = Math.round(logicalHeight * gifScale);

      const GIFConstructor = await ensureGifJsLoaded();
      if (cancelled) return;
      activeWorkerUrl = await createInlineGifWorkerUrl();
      if (cancelled) {
        cleanup();
        return;
      }

      const timeline = buildAnimationTimeline(messages, speed, config.showBottomBar);
      const scrollState: ScrollState = { y: 0 };
      const frameDelayMs = 40; // Smooth 25 FPS GIF
      const totalSteps = Math.max(1, Math.ceil(timeline.totalDurationMs / frameDelayMs));

      const gif = new GIFConstructor({
        workers: 2,
        quality: 8,
        width: canvas.width,
        height: canvas.height,
        workerScript: activeWorkerUrl,
      });
      activeGif = gif;

      for (let step = 0; step <= totalSteps; step++) {
        if (cancelled) {
          cleanup();
          return;
        }
        const elapsed = Math.min(step * frameDelayMs, timeline.totalDurationMs);
        const frame = timeline.evaluateAt(elapsed);
        renderChatFrameToCanvas(
          ctx,
          logicalWidth,
          logicalHeight,
          gifScale,
          config,
          frame,
          scrollState,
          imageCache
        );
        gif.addFrame(canvas, { copy: true, delay: frameDelayMs });
        onProgress(Math.min(40, Math.round((step / totalSteps) * 40)));

        if (step % 4 === 0) {
          await new Promise((r) => window.setTimeout(r, 0));
        }
      }

      await new Promise<void>((resolve, reject) => {
        gif.on('progress', (p) => {
          if (cancelled) return;
          const pct = typeof p === 'number' ? p : 0;
          onProgress(Math.min(99, 40 + Math.round(pct * 60)));
        });
        gif.on('finished', (blob) => {
          if (cancelled) {
            cleanup();
            resolve();
            return;
          }
          onProgress(100);
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

    // 60 FPS Native Canvas Video Export (MP4 or WebM)
    canvas.width = Math.round(logicalWidth * scale);
    canvas.height = Math.round(logicalHeight * scale);

    if (typeof canvas.captureStream !== 'function') {
      throw new Error('Canvas 60 FPS stream capture is not supported in this browser.');
    }

    const { mimeType, extension } = pickVideoMimeType(format);
    const stream = canvas.captureStream(60);
    activeStream = stream;

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

    const timeline = buildAnimationTimeline(messages, speed, config.showBottomBar);
    const scrollState: ScrollState = { y: 0 };

    // Paint initial frame cleanly before starting recorder
    renderChatFrameToCanvas(
      ctx,
      logicalWidth,
      logicalHeight,
      scale,
      config,
      timeline.evaluateAt(0),
      scrollState,
      imageCache
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
          onProgress(100);
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

    recorder.start(200);
    const startTime = performance.now();
    onProgress(0);

    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (cancelled) {
          resolve();
          return;
        }

        const elapsedMs = now - startTime;
        const clampedElapsed = Math.min(elapsedMs, timeline.totalDurationMs);
        const frame = timeline.evaluateAt(clampedElapsed);

        renderChatFrameToCanvas(
          ctx,
          logicalWidth,
          logicalHeight,
          scale,
          config,
          frame,
          scrollState,
          imageCache
        );

        const pct = Math.min(
          99,
          Math.round((clampedElapsed / Math.max(1, timeline.totalDurationMs)) * 100)
        );
        onProgress(pct);

        if (elapsedMs >= timeline.totalDurationMs) {
          resolve();
          return;
        }

        activeRafId = window.requestAnimationFrame(tick);
      };

      activeRafId = window.requestAnimationFrame(tick);
    });

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
