import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUp, ChevronDown, Play, X } from 'lucide-react';
import type { AiSkin } from '../types';
import { FAQ_ITEMS, SCRIPT_TEMPLATES, type ScriptTemplate } from '../utils/templates';
import {
  ClaudeStarburstIcon,
  GeminiSparkIcon,
  GrokSlashXIcon,
  LayoutLabLogo,
  OpenAISwirlIcon,
} from './ChatGptIcons';

interface HomePageProps {
  onLaunchStudio: (skin?: AiSkin) => void;
  onSelectTemplate: (template: ScriptTemplate) => void;
}

interface ChatbotCardSpec {
  skin: AiSkin;
  name: string;
  accentSurface: string;
}

const CHATBOT_CARDS: ChatbotCardSpec[] = [
  {
    skin: 'chatgpt',
    name: 'ChatGPT',
    accentSurface: 'bg-slate-900 text-white',
  },
  {
    skin: 'claude',
    name: 'Claude',
    accentSurface: 'bg-[#f5f4ef] border border-[#e3dfd3]',
  },
  {
    skin: 'gemini',
    name: 'Gemini',
    accentSurface: 'bg-[#f0f4f9] border border-[#dbe5f4]',
  },
  {
    skin: 'grok',
    name: 'Grok',
    accentSurface: 'bg-black text-white',
  },
];

function renderCardIcon(skin: AiSkin) {
  switch (skin) {
    case 'claude':
      return <ClaudeStarburstIcon size={22} color="#d97757" />;
    case 'gemini':
      return <GeminiSparkIcon size={22} gradientId="home-gemini-spark" />;
    case 'grok':
      return <GrokSlashXIcon size={20} />;
    case 'chatgpt':
    default:
      return <OpenAISwirlIcon size={20} />;
  }
}

export function HomePage({ onLaunchStudio, onSelectTemplate }: HomePageProps) {
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0].id);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => {
    if (!legalModal) return;
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setLegalModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [legalModal]);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      id="homeView"
      className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col"
    >
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <a
            href="#homeView"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
          >
            <LayoutLabLogo size={28} />
            <span>LayoutLab</span>
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#chatbots"
              className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Chatbots
            </a>
            <a
              href="#templates"
              className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Templates
            </a>
            <a
              href="#faq"
              className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onLaunchStudio()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Launch Studio</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16 lg:px-8">
          <div className="max-w-3xl">
            <h1
              className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]"
              style={{
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                textWrap: 'balance',
              }}
            >
              Fake AI Chat Generator — Create Animated Mockups in Seconds
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Use LayoutLab to script exact prompts and word-by-word AI replies
              across ChatGPT, Claude, Gemini, and Grok. Export razor-sharp PNG,
              JPG, WebP screenshots or smooth 60 FPS 1080p and 4K videos
              completely watermark-free.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onLaunchStudio()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Start Creating Free</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                No sign-up required · 100% browser-based · Zero watermarks
              </span>
            </div>
          </div>
        </section>

        {/* 4 Interactive Chatbot Cards Grid */}
        <section
          id="chatbots"
          aria-labelledby="chatbots-heading"
          className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
        >
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="chatbots-heading"
              className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
            >
              Choose Your AI Interface
            </h2>
            <span className="text-xs font-medium text-slate-500">
              Click any interface to open the studio with that skin active
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CHATBOT_CARDS.map((card) => (
              <button
                key={card.skin}
                type="button"
                onClick={() => onLaunchStudio(card.skin)}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer"
              >
                <div>
                  <div
                    className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${card.accentSurface}`}
                  >
                    {renderCardIcon(card.skin)}
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-slate-950">
                    {card.name}
                  </h3>
                </div>

                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-600 group-hover:text-slate-900">
                  <span>Open Studio</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 1-Click Starter Script Templates */}
        <section
          id="templates"
          aria-labelledby="templates-heading"
          className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
        >
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="templates-heading"
              className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
            >
              Or try a 1-click animated template
            </h2>
            <span className="text-xs font-medium text-slate-500">
              Loads the full script and starts live typing playback immediately
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCRIPT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelectTemplate(tpl)}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer"
              >
                <div>
                  <div className="mb-2.5 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
                    <span>
                      {tpl.category} · {tpl.modelLabel}
                    </span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                      <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900">
                    {tpl.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {tpl.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-2.5 text-[11px] font-semibold text-slate-700 group-hover:text-slate-900">
                  Play Animated Template →
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Collapsible How It Works & FAQ Accordion */}
        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mb-6 text-center">
            <h2
              id="faq-heading"
              className="text-2xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
            >
              How It Works &amp; FAQ
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Everything you need to know about scripting, Theater Mode, and
              60 FPS exports.
            </p>
          </div>

          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {FAQ_ITEMS.map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenFaqId((prev) => (prev === item.id ? null : item.id))
                    }
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-900 cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 text-sm leading-relaxed text-slate-600">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        {/* Pre-Footer Call-to-Action Card */}
        <section
          aria-labelledby="prefooter-cta-heading"
          className="mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800 bg-[#0f172a] px-6 py-10 text-center text-white shadow-sm sm:px-12 sm:py-14">
            <h2
              id="prefooter-cta-heading"
              className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl"
              style={{
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                textWrap: 'balance',
              }}
            >
              Ready to create your first animated AI chat?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              No sign-up, no watermarks, and instant 60 FPS video or HD image
              exports.
            </p>
            <div className="mt-7 flex justify-center">
              <button
                type="button"
                onClick={() => onLaunchStudio()}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open LayoutLab Studio</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Structured 4-Column Professional Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Column 1: Brand */}
            <div className="space-y-4">
              <a
                href="#homeView"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTop();
                }}
                className="inline-flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
              >
                <LayoutLabLogo size={24} />
                <span>LayoutLab</span>
              </a>
              <p className="text-xs leading-relaxed text-slate-600">
                The watermark-free AI chat mockup and 60 FPS typing animation
                studio for creators, marketers, and educators.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 whitespace-nowrap">
                <span
                  className="h-2 w-2 rounded-full bg-emerald-600"
                  aria-hidden="true"
                />
                <span>100% Free &amp; Watermark-Free</span>
              </div>
            </div>

            {/* Column 2: AI Generators */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-slate-900 uppercase">
                AI Generators
              </h3>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
                <li>
                  <button
                    type="button"
                    onClick={() => onLaunchStudio('chatgpt')}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    ChatGPT Generator
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onLaunchStudio('claude')}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    Claude Generator
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onLaunchStudio('gemini')}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    Gemini Generator
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onLaunchStudio('grok')}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    Grok Generator
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Features & Templates */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-slate-900 uppercase">
                Features &amp; Templates
              </h3>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
                <li>
                  <button
                    type="button"
                    onClick={() => onLaunchStudio()}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    60 FPS Video Export
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('templates')}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    Starter Templates
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFaqId(FAQ_ITEMS[0].id);
                      scrollToSection('faq');
                    }}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('faq')}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    FAQ
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal & Info */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-slate-900 uppercase">
                Legal &amp; Info
              </h3>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal('privacy')}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal('terms')}
                    className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    Terms of Use
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={scrollToTop}
                    className="inline-flex items-center gap-1 font-medium text-slate-700 transition-colors hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
                  >
                    <span>Back to Top</span>
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Persistent Legal Disclaimer & Bottom Copyright Bar */}
          <div className="mt-10 border-t border-slate-200 pt-6">
            <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
              Disclaimer: LayoutLab is an independent UI mockup and animation
              utility for creative, educational, and entertainment purposes
              only. It is not affiliated with, endorsed by, or sponsored by
              OpenAI, Anthropic, Google, or xAI. ChatGPT, Claude, Gemini, and
              Grok are trademarks of their respective owners.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
              <span>&copy; 2026 LayoutLab. All rights reserved.</span>
              <span>Built for creators &mdash; Zero watermarks</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Privacy Policy & Terms of Use Modal */}
      {legalModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
          onClick={() => setLegalModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <h2
                id="legal-modal-title"
                className="text-base font-bold text-slate-900"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
              >
                {legalModal === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}
              </h2>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setLegalModal(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {legalModal === 'privacy' ? (
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
                <p>
                  <strong className="font-semibold text-slate-900">
                    100% Local Browser Processing:
                  </strong>{' '}
                  LayoutLab runs completely locally inside your web browser. All
                  scripts, prompts, AI replies, uploaded images or file
                  attachments, and 60 FPS video or HD image exports (PNG, JPG,
                  WebP, MP4, WebM, GIF) are processed exclusively on your device.
                </p>
                <p>
                  <strong className="font-semibold text-slate-900">
                    Zero Server Uploads or Storage:
                  </strong>{' '}
                  Zero prompts, media files, or personal data are ever uploaded
                  to, transmitted through, or stored on external servers. We do
                  not require user accounts or inject tracking pixels or
                  watermarks into exported files.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
                <p>
                  <strong className="font-semibold text-slate-900">
                    Permitted Use:
                  </strong>{' '}
                  LayoutLab is provided for creative content, memes, social
                  media videos, tutorials, product demos, and UI mockups. All
                  exported images and videos are watermark-free.
                </p>
                <p>
                  <strong className="font-semibold text-slate-900">
                    Strictly Prohibited Use:
                  </strong>{' '}
                  You may not use LayoutLab for fraud, financial deception,
                  forging legal or official records, defamation, impersonation
                  of real individuals, or generating fake commercial customer
                  reviews or testimonials.
                </p>
                <p>
                  <strong className="font-semibold text-slate-900">
                    User Responsibility:
                  </strong>{' '}
                  Users bear 100% legal responsibility for any text, images, or
                  videos they create, publish, or share using this tool.
                </p>
                <p>
                  <strong className="font-semibold text-slate-900">
                    Trademarks:
                  </strong>{' '}
                  Third-party UI styles, product names, and trademarks
                  (including ChatGPT, Claude, Gemini, and Grok) belong to their
                  respective owners. LayoutLab is not affiliated with, endorsed
                  by, or sponsored by OpenAI, Anthropic, Google, or xAI.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
