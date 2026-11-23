import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function isOfflineStudioPath(): boolean {
  if (typeof window === 'undefined') return false;
  const normalized = window.location.pathname.replace(/\/+$/, '');
  return normalized === '/offline-studio';
}

export function useOfflineStudio(enabled: boolean) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Detect standalone PWA mode
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    // Dynamically inject manifest & iOS PWA tags ONLY on /offline-studio
    const injectedNodes: HTMLElement[] = [];

    if (!document.querySelector('link[rel="manifest"]')) {
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.webmanifest';
      manifestLink.setAttribute('data-layoutlab-offline', 'true');
      document.head.appendChild(manifestLink);
      injectedNodes.push(manifestLink);
    }

    const metaDefs: Array<{ name: string; content: string }> = [
      { name: 'theme-color', content: '#0f172a' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'LayoutLab' },
    ];
    for (const def of metaDefs) {
      if (!document.querySelector(`meta[name="${def.name}"]`)) {
        const meta = document.createElement('meta');
        meta.name = def.name;
        meta.content = def.content;
        meta.setAttribute('data-layoutlab-offline', 'true');
        document.head.appendChild(meta);
        injectedNodes.push(meta);
      }
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = '/apple-touch-icon.png';
      appleIcon.setAttribute('data-layoutlab-offline', 'true');
      document.head.appendChild(appleIcon);
      injectedNodes.push(appleIcon);
    }

    // Manually register the service worker ONLY on /offline-studio
    let cancelled = false;
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return;
        registerSW({
          immediate: true,
          onOfflineReady() {
            if (!cancelled) setSwReady(true);
          },
          onRegisteredSW() {
            if (!cancelled) setSwReady(true);
          },
        });
      })
      .catch(() => {
        // Gracefully ignore in environments where SW registration is blocked
      });

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      cancelled = true;
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      for (const node of injectedNodes) {
        node.remove();
      }
    };
  }, [enabled]);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    canPromptInstall: !!deferredPrompt,
    isInstalled,
    isIOS,
    swReady,
    isOnline,
    promptInstall,
  };
}
