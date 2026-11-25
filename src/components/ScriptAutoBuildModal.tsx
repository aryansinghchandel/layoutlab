import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  FileAudio,
  Film,
  Flame,
  Loader2,
  Music,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import type { SoundBankFile } from '../types';
import {
  parseScriptText,
  SAMPLE_AUTOBUILD_SCRIPT,
} from '../utils/scriptParser';
import { fuzzyMatchSoundFile } from '../utils/soundEngine';

interface ScriptAutoBuildModalProps {
  open: boolean;
  onClose: () => void;
  soundBank: SoundBankFile[];
  soundBankLoading?: boolean;
  onLoadSoundBankFiles: (files: FileList | File[]) => void;
  onAutoBuild: (rawScript: string) => void;
}

export function ScriptAutoBuildModal({
  open,
  onClose,
  soundBank,
  soundBankLoading = false,
  onLoadSoundBankFiles,
  onAutoBuild,
}: ScriptAutoBuildModalProps) {
  const [scriptText, setScriptText] = useState<string>('');
  const soundInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 30);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  const parsed = useMemo(() => parseScriptText(scriptText), [scriptText]);

  const sfxMatches = useMemo(() => {
    return parsed.summary.uniqueSfxCues.map((cue) => ({
      cue,
      matched: fuzzyMatchSoundFile(cue, soundBank),
    }));
  }, [parsed.summary.uniqueSfxCues, soundBank]);

  const matchedUniqueCount = useMemo(
    () => sfxMatches.filter((m) => m.matched !== null).length,
    [sfxMatches]
  );

  const bgLoopMatch = useMemo(() => {
    if (!parsed.summary.backgroundLoopCue) return null;
    return fuzzyMatchSoundFile(parsed.summary.backgroundLoopCue, soundBank);
  }, [parsed.summary.backgroundLoopCue, soundBank]);

  if (!open) return null;

  const canBuild = parsed.items.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="script-autobuild-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="script-autobuild-title"
                className="text-sm font-bold tracking-tight text-slate-900"
              >
                Paste Script &amp; Auto-Build Timeline
              </h2>
              <p className="text-[11.5px] text-slate-500">
                Parses speakers, <code className="font-mono">[SFX: ...]</code>,{' '}
                <code className="font-mono">[GIF]: ...</code>,{' '}
                <code className="font-mono">[TYPING...]</code>, visual cues, and{' '}
                <code className="font-mono">BACKGROUND LOOP</code>.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Paste Script modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="studio-scroll flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setScriptText(SAMPLE_AUTOBUILD_SCRIPT)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-slate-600" />
                Load Example Script
              </button>
              {scriptText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setScriptText('')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={soundInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onLoadSoundBankFiles(e.target.files);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                disabled={soundBankLoading}
                onClick={() => soundInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                {soundBankLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileAudio className="h-3.5 w-3.5 text-slate-600" />
                )}
                <span>
                  {soundBank.length > 0
                    ? `Sound Bank (${soundBank.length} loaded)`
                    : 'Load Sound Bank (Ctrl+A)'}
                </span>
              </button>
            </div>
          </div>

          {/* Script Textarea */}
          <div className="space-y-1.5">
            <textarea
              ref={textareaRef}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              rows={11}
              spellCheck={false}
              placeholder={`BACKGROUND LOOP: suspense_lofi_beat (10%–12% volume)\n\nYou: Hey ChatGPT, clean up my database. [SFX: iMessage Pop]\n[TYPING...] (Hold 1.5 sec) [SFX: Keyboard Typing Fast]\nChatGPT: Done! I dropped production. [SFX: Vine Boom]\n[GIF]: shocked cat staring [SFX: Whoosh Wind]\nGemini: Wait... you didn't ask first?! [SFX: Anime Wow]\nChatGPT: Look how clean it is now. (Visual Effect: Screen flashes red)\nYou: MY DATA! [SFX: FAAAH]\n(Hard cut to black)`}
              className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50/70 p-3.5 font-mono text-[12.5px] leading-relaxed text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-slate-900 focus:bg-white"
            />
          </div>

          {/* Real-time Parsed Preview Summary */}
          {parsed.items.length > 0 || parsed.backgroundLoop ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold text-slate-700">
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 tabular-nums">
                  {parsed.summary.messageCount}{' '}
                  {parsed.summary.messageCount === 1 ? 'Message' : 'Messages'}
                </span>
                {parsed.summary.typingCueCount > 0 && (
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 tabular-nums">
                    {parsed.summary.typingCueCount} Typing Hold
                    {parsed.summary.typingCueCount > 1 ? 's' : ''}
                  </span>
                )}
                {parsed.summary.gifCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800 tabular-nums">
                    <Film className="h-3 w-3" />
                    {parsed.summary.gifCount} GIF Placeholder
                    {parsed.summary.gifCount > 1 ? 's' : ''}
                  </span>
                )}
                {parsed.summary.visualEffectCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-800 tabular-nums">
                    <Flame className="h-3 w-3" />
                    {parsed.summary.visualEffectCount} Visual Effect
                    {parsed.summary.visualEffectCount > 1 ? 's' : ''}
                  </span>
                )}
                {parsed.summary.sfxCueCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 tabular-nums ${
                      soundBank.length > 0 &&
                      matchedUniqueCount === sfxMatches.length
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    <Volume2 className="h-3 w-3" />
                    {soundBank.length > 0
                      ? `${matchedUniqueCount}/${sfxMatches.length} SFX auto-matched`
                      : `${parsed.summary.sfxCueCount} SFX cues detected`}
                  </span>
                )}
              </div>

              {/* Background Loop Preview */}
              {parsed.summary.backgroundLoopCue && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Music className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <span className="font-semibold text-slate-800 truncate">
                      BG Loop: {parsed.summary.backgroundLoopCue}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      ({Math.round(parsed.summary.backgroundLoopVolume * 100)}%)
                    </span>
                  </div>
                  {bgLoopMatch ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {bgLoopMatch.name}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-amber-700">
                      {soundBank.length > 0
                        ? 'No match yet (select manually in Sound Bank)'
                        : 'Load Sound Bank to auto-match'}
                    </span>
                  )}
                </div>
              )}

              {/* Detected SFX Cues Mapping List */}
              {sfxMatches.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {sfxMatches.map(({ cue, matched }) => (
                    <span
                      key={cue}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        matched
                          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span className="font-semibold">{cue}</span>
                      {matched && (
                        <span className="text-emerald-600">
                          → {matched.baseName}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-500">
              Paste your formatted script above or click{' '}
              <strong className="font-semibold text-slate-700">
                Load Example Script
              </strong>{' '}
              to preview parsed messages, GIF slots, visual effects, and SFX tags.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5">
          <span className="text-[11px] text-slate-500">
            {parsed.summary.gifCount > 0
              ? 'Auto-switches to 16:9 Clean Focus so GIF overlays align perfectly.'
              : parsed.summary.hasMultiAi
                ? 'Auto-switches to Multi-AI mode for multiple AI speakers.'
                : 'You can load or update your Sound Bank anytime before or after building.'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canBuild}
              onClick={() => {
                if (!canBuild) return;
                onAutoBuild(scriptText);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Auto-Build Timeline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
