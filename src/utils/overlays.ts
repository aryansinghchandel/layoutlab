import {
  type OverlayFontFamily,
  STAGE_LOGICAL_HEIGHT,
  STAGE_LOGICAL_WIDTH,
  type StageOverlay,
  type ThemeMode,
} from '../types';

export interface OverlayVisualState {
  visible: boolean;
  opacity: number;
  scale: number;
  offsetY: number;
}

export function getOverlayFontStack(family: OverlayFontFamily = 'sans'): string {
  switch (family) {
    case 'display':
      return "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    case 'serif':
      return "'Source Serif 4', Georgia, 'Times New Roman', serif";
    case 'mono':
      return "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    case 'sans':
    default:
      return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
    }
  } else if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
    }
  }
  return `rgba(15, 23, 42, ${clampedAlpha})`;
}

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

function easeOutBack(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

export function evaluateOverlayVisibility(
  overlay: StageOverlay,
  elapsedSec: number,
  isPlaying: boolean
): OverlayVisualState {
  // Always show all overlays at full opacity when editing on the stage
  if (!isPlaying || overlay.timingMode === 'full') {
    return { visible: true, opacity: 1, scale: 1, offsetY: 0 };
  }

  const start = Math.max(0, Number.isFinite(overlay.startSec) ? overlay.startSec : 0);
  const rawEnd = Number.isFinite(overlay.endSec) ? overlay.endSec : start + 3;
  const end = Math.max(start + 0.05, rawEnd);

  if (elapsedSec < start || elapsedSec > end) {
    return { visible: false, opacity: 0, scale: 1, offsetY: 0 };
  }

  if (overlay.transition === 'none') {
    return { visible: true, opacity: 1, scale: 1, offsetY: 0 };
  }

  const transDur = Math.min(0.28, (end - start) * 0.35);
  const tIn = transDur > 0 ? Math.min(1, (elapsedSec - start) / transDur) : 1;
  const tOut = transDur > 0 ? Math.min(1, (end - elapsedSec) / transDur) : 1;

  if (overlay.transition === 'fade') {
    const p = Math.min(tIn, tOut);
    return {
      visible: true,
      opacity: easeOutCubic(p),
      scale: 1,
      offsetY: 0,
    };
  }

  // 'pop' entrance & exit
  if (tIn < 1 && tIn <= tOut) {
    const popped = easeOutBack(tIn);
    const eased = easeOutCubic(tIn);
    return {
      visible: true,
      opacity: Math.min(1, tIn * 1.6),
      scale: 0.72 + 0.28 * popped,
      offsetY: (1 - eased) * 10,
    };
  }

  if (tOut < 1) {
    const eased = easeOutCubic(tOut);
    return {
      visible: true,
      opacity: eased,
      scale: 0.86 + 0.14 * eased,
      offsetY: (1 - eased) * -6,
    };
  }

  return { visible: true, opacity: 1, scale: 1, offsetY: 0 };
}

export function getSystemPillColors(
  theme: ThemeMode,
  isClean16x9: boolean
): { bg: string; border: string; text: string } {
  if (theme === 'dark') {
    return isClean16x9
      ? {
          bg: '#161618',
          border: '#2c2c30',
          text: '#a1a1aa',
        }
      : {
          bg: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.13)',
          text: '#a1a1aa',
        };
  }
  return {
    bg: '#f1f5f9',
    border: '#e2e8f0',
    text: '#64748b',
  };
}

export function createOverlayId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ov-${crypto.randomUUID()}`;
  }
  return `ov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultTextOverlay(
  existingCount: number,
  theme: ThemeMode,
  totalDurationSec: number
): StageOverlay {
  const offset = (existingCount % 4) * 24;
  const width = 320;
  const height = 64;
  const x = Math.round((STAGE_LOGICAL_WIDTH - width) / 2 + offset);
  const y = Math.round(36 + offset);
  const defaultEnd = Math.max(2.5, Math.min(4.5, Number(totalDurationSec.toFixed(1))));

  return {
    id: createOverlayId(),
    kind: 'text',
    x: Math.min(STAGE_LOGICAL_WIDTH - width - 16, Math.max(16, x)),
    y: Math.min(STAGE_LOGICAL_HEIGHT - height - 16, Math.max(16, y)),
    width,
    height,
    text: 'Wait for it...',
    fontFamily: 'display',
    fontSize: 26,
    color: theme === 'dark' ? '#ffffff' : '#ffffff',
    bold: true,
    italic: false,
    pillBg: true,
    pillBgColor: theme === 'dark' ? '#1f2937' : '#0f172a',
    pillBgOpacity: 0.92,
    timingMode: 'full',
    startSec: 1.0,
    endSec: defaultEnd,
    transition: 'pop',
  };
}

export function createImageOverlayFromFile(
  file: File,
  existingCount: number,
  totalDurationSec: number
): Promise<StageOverlay> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Empty image data.'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const natW = img.naturalWidth || 320;
        const natH = img.naturalHeight || 180;
        const aspect = natW / natH;
        const maxInitialW = 300;
        const maxInitialH = 220;
        let width = Math.min(maxInitialW, natW);
        let height = Math.round(width / aspect);
        if (height > maxInitialH) {
          height = maxInitialH;
          width = Math.round(height * aspect);
        }
        width = Math.max(80, width);
        height = Math.max(50, height);
        const offset = (existingCount % 4) * 20;
        const x = Math.round(STAGE_LOGICAL_WIDTH - width - 28 - offset);
        const y = Math.round(28 + offset);
        const defaultEnd = Math.max(
          2.5,
          Math.min(5.0, Number(totalDurationSec.toFixed(1)))
        );

        resolve({
          id: createOverlayId(),
          kind: 'image',
          x: Math.max(16, x),
          y: Math.max(16, y),
          width,
          height,
          imageDataUrl: dataUrl,
          imageName: file.name,
          imageAspectRatio: aspect,
          imageBorderRadius: 14,
          timingMode: 'timed',
          startSec: 1.0,
          endSec: defaultEnd,
          transition: 'pop',
        });
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
