import type { AiSkin, ChatMessage, ThemeMode } from '../types';

export interface ScriptTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  skin: AiSkin;
  modelLabel: string;
  theme: ThemeMode;
  messages: Omit<ChatMessage, 'id'>[];
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'viral-roast',
    title: 'Viral AI Roast',
    category: 'Social Clip',
    description: 'Sharp comedic teardown built for short-form reels.',
    skin: 'grok',
    modelLabel: 'Grok 4',
    theme: 'dark',
    messages: [
      {
        role: 'user',
        content:
          'Be brutally honest. Roast my startup idea: an AI smart toaster that tweets every time my sourdough is ready.',
        attachment: null,
      },
      {
        role: 'assistant',
        thoughtDuration: '3s',
        content: `Congratulations, you invented a **$299 push notification for burnt carbs**.

- **Market size:** 4 people in San Francisco and your mom.
- **Retention cliff:** Users mute their own kitchen appliance by Day 3.
- **Pitch deck:** Just a single slide that says *"We put an LLM inside a heating coil."*

Keep the sourdough starter. Pivot away from the toaster.`,
      },
    ],
  },
  {
    id: 'coding-tutorial',
    title: 'Coding Tutorial',
    category: 'Dev Guide',
    description: 'Clean prompt + syntax-highlighted TypeScript walkthrough.',
    skin: 'chatgpt',
    modelLabel: 'ChatGPT',
    theme: 'light',
    messages: [
      {
        role: 'user',
        content:
          'Show me how to cleanly cancel an in-flight fetch request when a React component unmounts.',
        attachment: null,
      },
      {
        role: 'assistant',
        thoughtDuration: '4s',
        content: `Use the browser's built-in **\`AbortController\`** inside \`useEffect\` cleanup:

\`\`\`typescript
useEffect(() => {
  const controller = new AbortController();

  fetch('/api/metrics', { signal: controller.signal })
    .then((res) => res.json())
    .then(setData)
    .catch((err) => {
      if (err.name !== 'AbortError') console.error(err);
    });

  return () => controller.abort();
}, []);
\`\`\`

- **Zero stale state updates** if the user navigates away mid-request.
- **Native browser API** with no extra packages needed.`,
      },
    ],
  },
  {
    id: 'saas-launch',
    title: 'SaaS Launch Demo',
    category: 'Product Video',
    description: 'Executive launch brief tailored for changelog announcements.',
    skin: 'claude',
    modelLabel: 'Claude 4.5 Sonnet',
    theme: 'light',
    messages: [
      {
        role: 'user',
        content:
          'Draft a crisp release summary for v2.4 highlighting faster exports and 60 FPS canvas rendering.',
        attachment: null,
      },
      {
        role: 'assistant',
        thoughtDuration: '5s',
        content: `Here is a concise release note ready for your launch thread:

**What shipped in v2.4**
- **3.4x faster exports:** Rebuilt our frame pipeline directly on hardware-accelerated 2D canvas.
- **4K 60 FPS video:** Smooth word-by-word streaming with zero dropped frames.
- **Theater Mode:** One-click full-screen presentation for clean product demos.`,
      },
    ],
  },
  {
    id: 'plot-twist',
    title: 'Plot Twist Story',
    category: 'Creative Fiction',
    description: 'Suspenseful four-sentence micro-fiction with pacing.',
    skin: 'gemini',
    modelLabel: '3 Pro',
    theme: 'dark',
    messages: [
      {
        role: 'user',
        content:
          'Write a 4-sentence sci-fi micro-story where the deep-space rescue beacon turns out to be a warning.',
        attachment: null,
      },
      {
        role: 'assistant',
        thoughtDuration: '4s',
        content: `For eleven years, our crew followed the faint distress pulse across the Kepler void, expecting survivors. When we breached the orbital ring, we found hundreds of untouched ships drifting in silent formation around a black star. Our comms officer finally decoded the repeating header that static had hidden for a decade. It wasn't an SOS—it was a **quarantine buoy** begging ships to turn back before waking what lived below.`,
      },
    ],
  },
];

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'script-word-by-word',
    question: 'How do I script prompts and AI replies word-for-word?',
    answer:
      'Open the Studio and add User Prompts and AI Replies in any order. Type the exact wording you want—AI replies support Markdown formatting including **bold text**, bullet lists, inline code, and syntax-labeled ```code``` blocks. You can also attach images or files to user prompts and enable an optional "Thought for Xs" reasoning pill.',
  },
  {
    id: 'switch-skins',
    question: 'Can I switch between ChatGPT, Claude, Gemini, and Grok?',
    answer:
      'Yes. Use the 4-AI Skin Switcher at the top of the Studio sidebar at any time without losing your script. Each skin automatically updates its authentic top bar, color palette, SVG avatar, message bubble styling, composer bar, action icons, and footer disclaimer in both Light and Dark themes across Web (760px) and Mobile (390px + optional 09:41 iOS status bar).',
  },
  {
    id: 'theater-mode',
    question: 'What is Theater Mode used for?',
    answer:
      'Clicking Theater Mode in the top-right of the Studio header hides the left script editor sidebar completely and centers the live chat preview full-screen on a clean stage—ideal if you want to record directly with OBS, Screen Studio, or QuickTime. Click the floating "Exit Theater Mode" pill in the top corner (or press Escape) to return to editing.',
  },
  {
    id: 'watermark-free-exports',
    question: 'Are exported videos and images really 100% watermark-free?',
    answer:
      'Yes. Zero branding, badges, or watermarks are ever added to the live preview, static images, or animated videos. Export the completed final frame at 2x resolution as PNG, JPG, or WebP, or render a full 60 FPS animation synced to your chosen 0.5x, 1x, or 2x speed in 1080p or 4K as MP4, WebM, or smooth GIF.',
  },
];
