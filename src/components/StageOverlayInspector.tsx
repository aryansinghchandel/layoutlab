import React, { useRef } from 'react';
import {
  Bold,
  Clock,
  Copy,
  Image as ImageIcon,
  Italic,
  Play,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  OVERLAY_PILL_BG_COLORS,
  OVERLAY_TEXT_COLORS,
  type OverlayFontFamily,
  type OverlayTransition,
  type SoundBankFile,
  type StageOverlay,
} from '../types';
import { fuzzyMatchSoundFile, resolveSfxFile } from '../utils/soundEngine';

interface StageOverlayInspectorProps {
  overlay: StageOverlay;
  totalDurationSec: number;
  textInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  soundBank?: SoundBankFile[];
  onAuditionSoundFile?: (fileId: string, volume?: number) => void;
  onUpdate: (id: string, patch: Partial<StageOverlay>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function StageOverlayInspector({
  overlay,
  totalDurationSec,
  textInputRef,
  soundBank = [],
  onAuditionSoundFile,
  onUpdate,
  onDuplicate,
  onDelete,
  onClose,
}: StageOverlayInspectorProps) {
  const replaceImgRef = useRef<HTMLInputElement | null>(null);

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const aspect =
          img.naturalWidth && img.naturalHeight
            ? img.naturalWidth / img.naturalHeight
            : overlay.width / Math.max(1, overlay.height);
        const nextH = Math.max(40, Math.round(overlay.width / aspect));
        onUpdate(overlay.id, {
          imageDataUrl: dataUrl,
          imageName: file.name,
          imageAspectRatio: aspect,
          isGifPlaceholder: false,
          height: Math.min(460, nextH),
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const isText = overlay.kind === 'text';
  const isGifSlot = !isText && !overlay.imageDataUrl;
  const usePill = overlay.pillBg !== false;
  const resolvedOverlaySfx = resolveSfxFile(
    overlay.sfxCue,
    overlay.sfxFileId,
    soundBank
  );
  const autoMatchedSfx = fuzzyMatchSoundFile(overlay.sfxCue, soundBank);

  return (
    <div
      className="mt-4 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      style={{ maxWidth: '960px' }}
    >
      {/* Top Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
            {isText ? (
              <Type className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
          <span className="text-xs font-bold text-slate-900">
            {isText
              ? 'Text Box Overlay'
              : isGifSlot
                ? 'GIF Overlay Placeholder'
                : 'GIF / Image Overlay'}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-medium text-slate-500 tabular-nums">
            {Math.round(overlay.width)}×{Math.round(overlay.height)} px
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDuplicate(overlay.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => onDelete(overlay.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Deselect overlay"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Column: Content & Style */}
        <div className="space-y-3 lg:col-span-7">
          {isText ? (
            <>
              <div className="space-y-1">
                <label
                  htmlFor="overlay-text-input"
                  className="block text-[11px] font-semibold text-slate-600"
                >
                  Overlay Text
                </label>
                <textarea
                  ref={textInputRef}
                  id="overlay-text-input"
                  rows={2}
                  value={overlay.text ?? ''}
                  onChange={(e) =>
                    onUpdate(overlay.id, { text: e.target.value })
                  }
                  placeholder="Enter popup text or title..."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              {/* Font Family, Size, Bold/Italic */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Font family"
                  value={overlay.fontFamily ?? 'display'}
                  onChange={(e) =>
                    onUpdate(overlay.id, {
                      fontFamily: e.target.value as OverlayFontFamily,
                    })
                  }
                  className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="display">Plus Jakarta Sans</option>
                  <option value="sans">Inter</option>
                  <option value="serif">Source Serif 4</option>
                  <option value="mono">JetBrains Mono</option>
                </select>

                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                  <span className="text-[11px] font-medium text-slate-500">
                    Size
                  </span>
                  <input
                    type="range"
                    min={12}
                    max={68}
                    value={overlay.fontSize ?? 26}
                    onChange={(e) =>
                      onUpdate(overlay.id, {
                        fontSize: Number(e.target.value),
                      })
                    }
                    className="w-20 accent-slate-900 cursor-pointer"
                  />
                  <span className="w-8 text-right font-mono text-[11px] font-semibold text-slate-800 tabular-nums">
                    {overlay.fontSize ?? 26}px
                  </span>
                </div>

                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={Boolean(overlay.bold)}
                    onClick={() =>
                      onUpdate(overlay.id, { bold: !overlay.bold })
                    }
                    title="Bold"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                      overlay.bold
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Bold className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={Boolean(overlay.italic)}
                    onClick={() =>
                      onUpdate(overlay.id, { italic: !overlay.italic })
                    }
                    title="Italic"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                      overlay.italic
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Italic className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Text Color & Pill Background Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Text
                  </span>
                  {OVERLAY_TEXT_COLORS.map((hex) => {
                    const active = (overlay.color || '#ffffff') === hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => onUpdate(overlay.id, { color: hex })}
                        aria-label={`Text color ${hex}`}
                        className={`h-5 w-5 rounded-full border border-slate-300 transition-transform cursor-pointer ${
                          active
                            ? 'ring-2 ring-slate-900 ring-offset-1 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                  <input
                    type="color"
                    aria-label="Custom text color"
                    value={overlay.color || '#ffffff'}
                    onChange={(e) =>
                      onUpdate(overlay.id, { color: e.target.value })
                    }
                    className="h-6 w-6 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                  />
                </div>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={usePill}
                    onClick={() => onUpdate(overlay.id, { pillBg: !usePill })}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      usePill
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Pill BG: {usePill ? 'ON' : 'OFF'}
                  </button>

                  {usePill && (
                    <>
                      <div className="flex items-center gap-1">
                        {OVERLAY_PILL_BG_COLORS.map((hex) => {
                          const active =
                            (overlay.pillBgColor || '#0f172a') === hex;
                          return (
                            <button
                              key={hex}
                              type="button"
                              onClick={() =>
                                onUpdate(overlay.id, { pillBgColor: hex })
                              }
                              aria-label={`Pill background ${hex}`}
                              className={`h-5 w-5 rounded-full border border-slate-300 transition-transform cursor-pointer ${
                                active
                                  ? 'ring-2 ring-slate-900 ring-offset-1 scale-110'
                                  : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          );
                        })}
                        <input
                          type="color"
                          aria-label="Custom pill background color"
                          value={overlay.pillBgColor || '#0f172a'}
                          onChange={(e) =>
                            onUpdate(overlay.id, {
                              pillBgColor: e.target.value,
                            })
                          }
                          className="h-6 w-6 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] font-medium text-slate-500">
                          Opacity
                        </span>
                        <input
                          type="range"
                          min={20}
                          max={100}
                          value={Math.round((overlay.pillBgOpacity ?? 0.92) * 100)}
                          onChange={(e) =>
                            onUpdate(overlay.id, {
                              pillBgOpacity: Number(e.target.value) / 100,
                            })
                          }
                          className="w-16 accent-slate-900 cursor-pointer"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={replaceImgRef}
                  type="file"
                  accept="image/gif,image/*"
                  onChange={handleReplaceImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => replaceImgRef.current?.click()}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    isGifSlot
                      ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  {isGifSlot ? 'Upload GIF / Image' : 'Replace GIF / Image'}
                </button>
                {(overlay.placeholderLabel || overlay.imageName) && (
                  <span className="max-w-[240px] truncate text-xs text-slate-500">
                    {isGifSlot
                      ? `Cue: ${overlay.placeholderLabel || overlay.imageName}`
                      : overlay.imageName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  Corner Radius
                </span>
                <input
                  type="range"
                  min={0}
                  max={36}
                  value={overlay.imageBorderRadius ?? 14}
                  onChange={(e) =>
                    onUpdate(overlay.id, {
                      imageBorderRadius: Number(e.target.value),
                    })
                  }
                  className="w-28 accent-slate-900 cursor-pointer"
                />
                <span className="font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
                  {overlay.imageBorderRadius ?? 14}px
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Timing & Entrance/Exit Transition */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
              <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              Visibility Timing
            </span>
            <span className="font-mono text-[10.5px] text-slate-500 tabular-nums">
              Video ~{totalDurationSec.toFixed(1)}s
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/75 p-1">
            <button
              type="button"
              onClick={() => onUpdate(overlay.id, { timingMode: 'full' })}
              className={`rounded-md py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                overlay.timingMode === 'full'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Video
            </button>
            <button
              type="button"
              onClick={() => onUpdate(overlay.id, { timingMode: 'timed' })}
              className={`rounded-md py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                overlay.timingMode === 'timed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Timed Effect
            </button>
          </div>

          {overlay.timingMode === 'timed' && (
            <div className="space-y-2.5 pt-0.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="block text-[10.5px] font-semibold text-slate-600">
                    Start (sec)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={overlay.startSec}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      onUpdate(overlay.id, {
                        startSec: val,
                        endSec: Math.max(val + 0.2, overlay.endSec),
                      });
                    }}
                    className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 font-mono text-xs font-medium text-slate-900 outline-none focus:border-slate-400"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="block text-[10.5px] font-semibold text-slate-600">
                    End (sec)
                  </span>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={overlay.endSec}
                    onChange={(e) => {
                      const val = Math.max(
                        overlay.startSec + 0.1,
                        Number(e.target.value) || overlay.startSec + 0.5
                      );
                      onUpdate(overlay.id, { endSec: val });
                    }}
                    className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 font-mono text-xs font-medium text-slate-900 outline-none focus:border-slate-400"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-600">
                  <Sparkles className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  Transition
                </span>
                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/75 p-0.5">
                  {(['none', 'fade', 'pop'] as readonly OverlayTransition[]).map(
                    (tr) => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => onUpdate(overlay.id, { transition: tr })}
                        className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                          overlay.transition === tr
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tr}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Overlay SFX Cue & Override */}
          {(overlay.sfxCue || soundBank.length > 0) && (
            <div className="mt-2 space-y-1.5 border-t border-slate-200/80 pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-700">
                  <Volume2 className="h-3 w-3 text-slate-500" />
                  Overlay SFX
                </span>
                {overlay.sfxCue && (
                  <span className="max-w-[160px] truncate rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 border border-slate-200">
                    {overlay.sfxCue}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Overlay sound effect"
                  value={overlay.sfxFileId ?? 'auto'}
                  onChange={(e) =>
                    onUpdate(overlay.id, { sfxFileId: e.target.value })
                  }
                  className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-800 outline-none focus:border-slate-400"
                >
                  <option value="auto">
                    {autoMatchedSfx
                      ? `Auto (${autoMatchedSfx.baseName})`
                      : 'Auto (None matched)'}
                  </option>
                  <option value="none">No Sound</option>
                  {soundBank.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!resolvedOverlaySfx || Boolean(overlay.sfxMuted)}
                  onClick={() => {
                    if (resolvedOverlaySfx) {
                      onAuditionSoundFile?.(
                        resolvedOverlaySfx.id,
                        overlay.sfxVolume ?? 0.9
                      );
                    }
                  }}
                  title="Preview SFX"
                  aria-label="Preview overlay SFX"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <Play className="h-3 w-3 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdate(overlay.id, { sfxMuted: !overlay.sfxMuted })
                  }
                  title={overlay.sfxMuted ? 'Unmute overlay SFX' : 'Mute overlay SFX'}
                  aria-label={overlay.sfxMuted ? 'Unmute overlay SFX' : 'Mute overlay SFX'}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                    overlay.sfxMuted
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {overlay.sfxMuted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
