import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Moon,
  Paperclip,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Smartphone,
  Square,
  Sun,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import {
  type AiSkin,
  type AnimationFormat,
  type ChatMessage,
  CUSTOM_AI_COLORS,
  type CustomAiIconId,
  type DeviceMode,
  type ImageFormat,
  type MessageAttachment,
  type MessageRole,
  type MessageSenderSkin,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  type PreviewMode,
  type ThemeMode,
  type VideoQuality,
} from '../types';
import { AI_SKINS, SKIN_ORDER } from '../utils/skins';
import {
  ClaudeStarburstIcon,
  CustomAiGlyphIcon,
  GeminiSparkIcon,
  GrokSlashXIcon,
  MultiAiIcon,
  OpenAISwirlIcon,
} from './ChatGptIcons';

const CUSTOM_ICON_IDS: readonly CustomAiIconId[] = [
  'sparkles',
  'bot',
  'zap',
  'cpu',
  'terminal',
  'globe',
] as const;

export type CleanFontSize = 26 | 28 | 34;

export interface MessageSenderPatch {
  role?: MessageRole;
  senderSkin?: MessageSenderSkin;
  customSenderName?: string;
  customSenderColor?: string;
  customSenderIcon?: CustomAiIconId;
}

interface EditorPanelProps {
  skin: AiSkin;
  onSkinChange: (skin: AiSkin) => void;
  modelLabel: string;
  onModelLabelChange: (value: string) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  device: DeviceMode;
  onDeviceChange: (device: DeviceMode) => void;
  previewMode: PreviewMode;
  cleanFontSize: CleanFontSize;
  onCleanFontSizeChange: (size: CleanFontSize) => void;
  showHeader: boolean;
  onShowHeaderChange: (show: boolean) => void;
  showSidebar: boolean;
  onShowSidebarChange: (show: boolean) => void;
  showIosStatusBar: boolean;
  onShowIosStatusBarChange: (show: boolean) => void;
  showBottomBar: boolean;
  onShowBottomBarChange: (show: boolean) => void;
  showFooterDisclaimer: boolean;
  onShowFooterDisclaimerChange: (show: boolean) => void;
  enableThoughtPill: boolean;
  onEnableThoughtPillChange: (enable: boolean) => void;
  messages: ChatMessage[];
  onAddMessage: (role: MessageRole) => void;
  onUpdateMessage: (id: string, content: string) => void;
  onUpdateMessageThought: (id: string, thoughtDuration: string) => void;
  onUpdateMessageAttachment: (
    id: string,
    attachment: MessageAttachment | null
  ) => void;
  onUpdateMessageSender: (id: string, patch: MessageSenderPatch) => void;
  onToggleRole: (id: string) => void;
  onMoveMessage: (index: number, direction: 'up' | 'down') => void;
  onDeleteMessage: (id: string) => void;
  onClearAll: () => void;
  onLoadSample: () => void;
  onExportImage: (format: ImageFormat) => void;
  onExportAnimation: (format: AnimationFormat) => void;
  onExportVideo: () => void;
  onCancelExport: () => void;
  videoQuality: VideoQuality;
  onVideoQualityChange: (quality: VideoQuality) => void;
  isExporting: boolean;
  isRecording: boolean;
  exportProgress: number;
  exportFrame: number;
  exportTotalFrames: number;
  exportError: string | null;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  onPlaybackSpeedChange: (speed: PlaybackSpeed) => void;
  onTogglePlayback: () => void;
}

function SkinMiniIcon({
  skin,
  size = 14,
  customIcon,
}: {
  skin: AiSkin | MessageSenderSkin;
  size?: number;
  customIcon?: CustomAiIconId;
}) {
  switch (skin) {
    case 'claude':
      return <ClaudeStarburstIcon size={size} />;
    case 'gemini':
      return <GeminiSparkIcon size={size} gradientId={`tab-gem-${size}`} />;
    case 'grok':
      return <GrokSlashXIcon size={size} />;
    case 'multi':
      return <MultiAiIcon size={size} />;
    case 'custom':
      return <CustomAiGlyphIcon icon={customIcon || 'sparkles'} size={size} />;
    case 'chatgpt':
    default:
      return <OpenAISwirlIcon size={size} />;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SwitchRow({
  label,
  checked,
  disabled = false,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span
        className={`text-xs font-medium ${
          disabled ? 'text-slate-400' : 'text-slate-800'
        }`}
      >
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
          checked ? 'bg-slate-900' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export const EditorPanel = React.memo(function EditorPanel({
  skin,
  onSkinChange,
  modelLabel,
  onModelLabelChange,
  theme,
  onThemeChange,
  device,
  onDeviceChange,
  previewMode,
  cleanFontSize,
  onCleanFontSizeChange,
  showHeader,
  onShowHeaderChange,
  showSidebar,
  onShowSidebarChange,
  showIosStatusBar,
  onShowIosStatusBarChange,
  showBottomBar,
  onShowBottomBarChange,
  showFooterDisclaimer,
  onShowFooterDisclaimerChange,
  enableThoughtPill,
  onEnableThoughtPillChange,
  messages,
  onAddMessage,
  onUpdateMessage,
  onUpdateMessageThought,
  onUpdateMessageAttachment,
  onUpdateMessageSender,
  onToggleRole,
  onMoveMessage,
  onDeleteMessage,
  onClearAll,
  onLoadSample,
  onExportImage,
  onExportAnimation,
  onExportVideo,
  onCancelExport,
  videoQuality,
  onVideoQualityChange,
  isExporting,
  isRecording,
  exportProgress,
  exportFrame,
  exportTotalFrames,
  exportError,
  isPlaying,
  playbackSpeed,
  onPlaybackSpeedChange,
  onTogglePlayback,
}: EditorPanelProps) {
  const skinMeta = AI_SKINS[skin];
  const isPreset = skinMeta.presets.includes(modelLabel);
  const isClean16x9 = previewMode === 'clean16x9';
  const [openMenu, setOpenMenu] = useState<'image' | 'animation' | null>(null);
  const [realismDrawerOpen, setRealismDrawerOpen] = useState<boolean>(true);
  const menusContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (ev: MouseEvent) => {
      if (
        menusContainerRef.current &&
        !menusContainerRef.current.contains(ev.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const handleFilePicked = (
    msgId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const attId = `att-${Date.now()}`;
    const sizeLabel = formatBytes(file.size);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUpdateMessageAttachment(msgId, {
            id: attId,
            kind: 'image',
            name: file.name,
            sizeLabel,
            dataUrl: reader.result,
          });
        }
      };
      reader.readAsDataURL(file);
    } else {
      onUpdateMessageAttachment(msgId, {
        id: attId,
        kind: 'file',
        name: file.name,
        sizeLabel,
      });
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-b border-slate-200 bg-white lg:w-[440px] lg:shrink-0 lg:border-r lg:border-b-0 xl:w-[470px]">
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h1 className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
          LayoutLab
        </h1>
        <span className="text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {/* 5-Mode AI Skin Switcher (4 AIs + Multi-AI) */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 sm:px-5">
        <div
          role="tablist"
          aria-label="AI interface skin"
          className="grid grid-cols-5 gap-1 rounded-xl bg-slate-200/70 p-1"
        >
          {SKIN_ORDER.map((skinId) => {
            const meta = AI_SKINS[skinId];
            const active = skin === skinId;
            return (
              <button
                key={skinId}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={isRecording}
                onClick={() => onSkinChange(skinId)}
                className={`flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <SkinMiniIcon skin={skinId} size={12} />
                <span className="truncate">{meta.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Editor Controls */}
      <div className="studio-scroll flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Section 1: Header & View Settings */}
        <section aria-labelledby="settings-heading" className="space-y-4">
          <h2
            id="settings-heading"
            className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
          >
            Header &amp; View Settings
          </h2>

          {/* Model Label Dropdown + Custom Input */}
          <div className="space-y-2">
            <label
              htmlFor="model-label-input"
              className="block text-xs font-medium text-slate-700"
            >
              Top Model Label
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                aria-label="Select preset model label"
                value={isPreset ? modelLabel : '__custom__'}
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    onModelLabelChange(e.target.value);
                  }
                }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
              >
                {skinMeta.presets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
                {!isPreset && <option value="__custom__">Custom label</option>}
              </select>

              <input
                id="model-label-input"
                type="text"
                value={modelLabel}
                onChange={(e) => onModelLabelChange(e.target.value)}
                placeholder="Custom model name..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-slate-900"
              />
            </div>
          </div>

          {/* Theme & Device Segmented Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-slate-700">Theme</span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => onThemeChange('light')}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => onThemeChange('dark')}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-slate-700">Viewport</span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => onDeviceChange('desktop')}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isClean16x9 || device === 'desktop'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  {isClean16x9 ? '16:9' : 'Web'}
                </button>
                <button
                  type="button"
                  disabled={isClean16x9}
                  onClick={() => onDeviceChange('mobile')}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap cursor-pointer ${
                    !isClean16x9 && device === 'mobile'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Mobile
                </button>
              </div>
            </div>
          </div>

          {/* 16:9 Clean Focus Font Size Toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-medium text-slate-700">
                16:9 Chat Font Size
              </span>
              <span className="text-[11px] text-slate-400">
                Preview &amp; Export
              </span>
            </div>
            <div
              role="group"
              aria-label="16:9 Chat Font Size"
              className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
            >
              {(
                [
                  { size: 26, label: '26px (Compact)' },
                  { size: 28, label: '28px (Viral)' },
                  { size: 34, label: '34px (XL)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.size}
                  type="button"
                  disabled={isRecording}
                  onClick={() => onCleanFontSizeChange(opt.size)}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer ${
                    cleanFontSize === opt.size
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {!isClean16x9 && device === 'mobile' && showHeader && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
              <span className="text-xs font-medium text-slate-800">
                Show 09:41 iOS Status Bar
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showIosStatusBar}
                aria-label="Show 09:41 iOS Status Bar"
                onClick={() => onShowIosStatusBarChange(!showIosStatusBar)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                  showIosStatusBar ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    showIosStatusBar ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Optional Frame Visibility & Realism Controls */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
            <button
              type="button"
              aria-expanded={realismDrawerOpen}
              onClick={() => setRealismDrawerOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-slate-100/70 cursor-pointer"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Settings className="h-3.5 w-3.5 text-slate-500" />
                Frame &amp; Visibility Controls
              </span>
              {realismDrawerOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {realismDrawerOpen && (
              <div className="divide-y divide-slate-200/70 border-t border-slate-200 bg-white">
                <SwitchRow
                  label="Show Header"
                  checked={showHeader}
                  onToggle={() => onShowHeaderChange(!showHeader)}
                />
                <SwitchRow
                  label="Show Sidebar"
                  checked={showSidebar}
                  disabled={!isClean16x9 && device === 'mobile'}
                  onToggle={() => onShowSidebarChange(!showSidebar)}
                />
                <SwitchRow
                  label="Show Bottom Composer Bar"
                  checked={showBottomBar}
                  onToggle={() => onShowBottomBarChange(!showBottomBar)}
                />
                <SwitchRow
                  label="Show Disclaimer Text"
                  checked={showFooterDisclaimer}
                  onToggle={() =>
                    onShowFooterDisclaimerChange(!showFooterDisclaimer)
                  }
                />
                <SwitchRow
                  label='Enable "Thought for Xs" Pill'
                  checked={enableThoughtPill}
                  onToggle={() => onEnableThoughtPillChange(!enableThoughtPill)}
                />
              </div>
            )}
          </div>
        </section>

        <hr className="border-slate-200" />

        {/* Section 2: Script Builder (Word-for-Word Message List) */}
        <section aria-labelledby="script-heading" className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="script-heading"
              className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
            >
              Conversation Script
            </h2>
            <div className="flex items-center gap-3">
              {skin === 'multi' && (
                <button
                  type="button"
                  onClick={onLoadSample}
                  className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 whitespace-nowrap cursor-pointer"
                >
                  Load Multi-AI Demo
                </button>
              )}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-medium text-slate-500 transition-colors hover:text-red-600 whitespace-nowrap cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Top Add Prompt / Add AI Reply Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAddMessage('user')}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add User Prompt
            </button>
            <button
              type="button"
              onClick={() => onAddMessage('assistant')}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add AI Reply
            </button>
          </div>

          {/* Message Cards List */}
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                Your script is empty
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Add a User Prompt or AI Reply above to start building your mockup.
              </p>
              <button
                type="button"
                onClick={onLoadSample}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Load Sample Exchange
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const currentSenderValue = isUser
                  ? 'user'
                  : (msg.senderSkin ?? 'chatgpt');

                return (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors focus-within:border-slate-400"
                  >
                    {/* Card Header */}
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 shrink-0">
                          /
                        </span>

                        {skin === 'multi' ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!isUser && (
                              <span
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200"
                                style={
                                  msg.senderSkin === 'custom'
                                    ? {
                                        backgroundColor:
                                          msg.customSenderColor || '#6366f1',
                                        borderColor:
                                          msg.customSenderColor || '#6366f1',
                                        color: '#ffffff',
                                      }
                                    : undefined
                                }
                              >
                                <SkinMiniIcon
                                  skin={msg.senderSkin ?? 'chatgpt'}
                                  size={11}
                                  customIcon={msg.customSenderIcon}
                                />
                              </span>
                            )}
                            <select
                              aria-label="Sender or AI model"
                              value={currentSenderValue}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'user') {
                                  onUpdateMessageSender(msg.id, { role: 'user' });
                                } else {
                                  const nextSender = val as MessageSenderSkin;
                                  onUpdateMessageSender(msg.id, {
                                    role: 'assistant',
                                    senderSkin: nextSender,
                                    customSenderColor:
                                      nextSender === 'custom'
                                        ? msg.customSenderColor ||
                                          CUSTOM_AI_COLORS[0]
                                        : msg.customSenderColor,
                                    customSenderIcon:
                                      nextSender === 'custom'
                                        ? msg.customSenderIcon || 'sparkles'
                                        : msg.customSenderIcon,
                                  });
                                }
                              }}
                              className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                            >
                              <option value="user">User</option>
                              <option value="chatgpt">ChatGPT</option>
                              <option value="claude">Claude</option>
                              <option value="gemini">Gemini</option>
                              <option value="grok">Grok</option>
                              <option value="custom">Custom AI</option>
                            </select>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onToggleRole(msg.id)}
                            title={`Click to switch role between User and ${skinMeta.name}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-slate-600 whitespace-nowrap cursor-pointer"
                          >
                            {!isUser && (
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 text-slate-800">
                                <SkinMiniIcon skin={skin} size={10} />
                              </span>
                            )}
                            {isUser ? 'User' : skinMeta.name}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onMoveMessage(index, 'up')}
                          disabled={index === 0}
                          aria-label="Move message up"
                          title="Move Up"
                          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveMessage(index, 'down')}
                          disabled={index === messages.length - 1}
                          aria-label="Move message down"
                          title="Move Down"
                          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          aria-label="Delete message"
                          title="Delete"
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Multi-AI Custom AI Inline Configuration */}
                    {skin === 'multi' &&
                      !isUser &&
                      msg.senderSkin === 'custom' && (
                        <div className="mb-2.5 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                          <input
                            type="text"
                            value={msg.customSenderName ?? ''}
                            onChange={(e) =>
                              onUpdateMessageSender(msg.id, {
                                customSenderName: e.target.value,
                              })
                            }
                            placeholder="Custom AI name (e.g. DeepSeek, Perplexity)..."
                            aria-label="Custom AI name"
                            className="h-7 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-slate-400"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div
                              className="flex items-center gap-1.5"
                              aria-label="Custom AI badge color"
                            >
                              {CUSTOM_AI_COLORS.map((swatch) => {
                                const selected =
                                  (msg.customSenderColor ||
                                    CUSTOM_AI_COLORS[0]) === swatch;
                                return (
                                  <button
                                    key={swatch}
                                    type="button"
                                    onClick={() =>
                                      onUpdateMessageSender(msg.id, {
                                        customSenderColor: swatch,
                                      })
                                    }
                                    aria-label={`Select color ${swatch}`}
                                    className={`h-5 w-5 rounded-full transition-transform cursor-pointer ${
                                      selected
                                        ? 'ring-2 ring-slate-900 ring-offset-1 scale-110'
                                        : 'hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: swatch }}
                                  />
                                );
                              })}
                            </div>

                            <div
                              className="flex items-center gap-1"
                              aria-label="Custom AI icon"
                            >
                              {CUSTOM_ICON_IDS.map((iconId) => {
                                const activeIcon =
                                  (msg.customSenderIcon || 'sparkles') === iconId;
                                return (
                                  <button
                                    key={iconId}
                                    type="button"
                                    onClick={() =>
                                      onUpdateMessageSender(msg.id, {
                                        customSenderIcon: iconId,
                                      })
                                    }
                                    aria-label={`Select ${iconId} icon`}
                                    className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                                      activeIcon
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    <CustomAiGlyphIcon icon={iconId} size={12} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Optional "Thought for Xs >" input on AI Reply cards */}
                    {!isUser && enableThoughtPill && (
                      <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                        <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                          Thought for
                        </span>
                        <input
                          type="text"
                          value={msg.thoughtDuration ?? ''}
                          onChange={(e) =>
                            onUpdateMessageThought(msg.id, e.target.value)
                          }
                          placeholder="4s"
                          aria-label="Reasoning duration"
                          className="h-6 w-16 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-slate-400"
                        />
                        <span className="text-[11px] text-slate-400">
                          &gt; (blank to hide)
                        </span>
                      </div>
                    )}

                    {/* Optional Image / File Attachment Controls on User Prompt cards */}
                    {isUser && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[msg.id] = el;
                          }}
                          type="file"
                          accept="image/*,.pdf,.txt,.csv,.json,.md,.ts,.tsx,.js,.py"
                          onChange={(e) => handleFilePicked(msg.id, e)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[msg.id]?.click()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                        >
                          <Paperclip className="h-3 w-3" />
                          Attach Image / File
                        </button>

                        {msg.attachment && (
                          <div className="flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                            {msg.attachment.kind === 'image' ? (
                              <ImageIcon className="h-3 w-3 shrink-0 text-slate-500" />
                            ) : (
                              <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                            )}
                            <span className="max-w-[160px] truncate font-medium">
                              {msg.attachment.name}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateMessageAttachment(msg.id, null)
                              }
                              aria-label="Remove attachment"
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Word-for-Word Message Textarea */}
                    <textarea
                      value={msg.content}
                      onChange={(e) => onUpdateMessage(msg.id, e.target.value)}
                      rows={isUser ? 2 : 6}
                      placeholder={
                        isUser
                          ? 'Type the exact user prompt...'
                          : 'Write the exact AI reply (supports **bold**, bullet lists, and ```code``` blocks)...'
                      }
                      className={`w-full resize-y rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-[13px] leading-relaxed text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-slate-400 focus:bg-white ${
                        !isUser ? 'font-mono text-[12.5px]' : ''
                      }`}
                    />
                  </div>
                );
              })}

              {/* Bottom Quick-Add Row */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onAddMessage('user')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add User Prompt
                </button>
                <button
                  type="button"
                  onClick={() => onAddMessage('assistant')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add AI Reply
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Pinned Playback & Export Controls */}
      <div className="border-t border-slate-200 bg-white px-5 py-4 space-y-2.5">
        {exportError && (
          <p className="text-xs font-medium text-red-600">{exportError}</p>
        )}

        {/* Playback Controls Row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlayback}
            disabled={(messages.length === 0 && !isPlaying) || isRecording}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap cursor-pointer ${
              isPlaying
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Play Animation
              </>
            )}
          </button>

          <div
            role="group"
            aria-label="Animation playback speed"
            className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-1 shrink-0"
          >
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                disabled={isRecording}
                onClick={() => onPlaybackSpeedChange(speed)}
                className={`rounded-lg px-1.5 py-1.5 text-[11px] font-semibold tabular-nums transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer ${
                  playbackSpeed === speed
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Sleek Deterministic 60 FPS Export Progress Bar */}
        {isRecording && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800 tabular-nums">
                {exportTotalFrames > 0
                  ? `Exporting Frame ${exportFrame} / ${exportTotalFrames} (${exportProgress}%)`
                  : `Exporting Animation... ${exportProgress}%`}
              </span>
              <button
                type="button"
                onClick={onCancelExport}
                className="text-[11px] font-semibold text-red-600 hover:text-red-700 whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-[width] duration-150 ease-out"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Export Controls: Image, Animation, and Direct 4K 60fps Video */}
        <div
          ref={menusContainerRef}
          className="relative grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {/* Dropdown 1: Download Image */}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'image'}
              onClick={() =>
                setOpenMenu((prev) => (prev === 'image' ? null : 'image'))
              }
              disabled={isExporting || isRecording}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Exporting...
                </>
              ) : (
                <>
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Download Image</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
                </>
              )}
            </button>

            {openMenu === 'image' && (
              <div
                role="menu"
                aria-label="Download final frame image formats"
                className="absolute bottom-full left-0 z-30 mb-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">
                  Final Frame (2x Scale)
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportImage('png');
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <span>PNG (High-Res Lossless)</span>
                  <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportImage('jpg');
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <span>JPG (Standard)</span>
                  <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportImage('webp');
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <span>WEBP (Compressed)</span>
                  <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </button>
              </div>
            )}
          </div>

          {/* Dropdown 2: Download Animation */}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'animation'}
              onClick={() =>
                setOpenMenu((prev) =>
                  prev === 'animation' ? null : 'animation'
                )
              }
              disabled={isExporting || isRecording || messages.length === 0}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {isRecording ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600 shrink-0" />
                  <span>{exportProgress}%</span>
                </>
              ) : (
                <>
                  <Video className="h-3.5 w-3.5 shrink-0" />
                  <span>Download Animation</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </>
              )}
            </button>

            {openMenu === 'animation' && (
              <div
                role="menu"
                aria-label="Download 60fps animation formats"
                className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <div className="mb-1 border-b border-slate-100 px-2 py-2">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Output Quality</span>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {playbackSpeed}x speed
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => onVideoQualityChange('1080p')}
                      className={`rounded-md py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        videoQuality === '1080p'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1080p 60fps
                    </button>
                    <button
                      type="button"
                      onClick={() => onVideoQualityChange('4k')}
                      className={`rounded-md py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        videoQuality === '4k'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      4K 60fps
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportAnimation('mp4');
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <span>MP4 Video (60 FPS)</span>
                  <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportAnimation('webm');
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <span>WebM Video (60 FPS)</span>
                  <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportAnimation('gif');
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <span>Animated GIF (Smooth)</span>
                  <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact Export Quality Selector + Direct Video Download */}
        <div className="flex items-center gap-2">
          <select
            aria-label="Export Quality"
            value={videoQuality}
            disabled={isExporting || isRecording}
            onChange={(e) => onVideoQualityChange(e.target.value as VideoQuality)}
            className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <option value="1080p">1080p 60fps (Fast, Smooth)</option>
            <option value="4k">4K 60fps (High Quality)</option>
          </select>

          <button
            type="button"
            onClick={onExportVideo}
            disabled={isExporting || isRecording || messages.length === 0}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            <Film className="h-3.5 w-3.5 shrink-0" />
            <span>Download Video</span>
          </button>
        </div>

        <p className="pt-0.5 text-center text-[10.5px] leading-tight text-slate-400">
          For creative &amp; mockup use only. Do not use to deceive or
          impersonate.
        </p>
      </div>
    </aside>
  );
});
