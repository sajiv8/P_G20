import { useEffect } from 'react';

export function ChatWidget() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
    document.head.appendChild(link);

    // Custom CSS: hide n8n branding + reposition on mobile above bottom nav
    const style = document.createElement('style');
    style.innerHTML = `
      /* Hide "Powered by n8n" branding */
      .chat-footer > a, .n8n-chat-footer > a, a[href*="n8n.io"] {
        display: none !important;
      }

      /* ── Mobile: move chat launcher + window above bottom nav ── */
      @media (max-width: 767px) {
        /* The n8n chat toggle button */
        .n8n-chat .chat-window-toggle {
          bottom: calc(
            var(--bottomnav-height, 60px)
            + env(safe-area-inset-bottom, 0px)
            + 16px
          ) !important;
          right: 16px !important;
        }

        /* The chat window itself */
        .n8n-chat .chat-window-wrapper {
          bottom: calc(
            var(--bottomnav-height, 60px)
            + env(safe-area-inset-bottom, 0px)
            + 16px
          ) !important;
          right: 8px !important;
          max-height: calc(
            100dvh
            - var(--bottomnav-height, 60px)
            - env(safe-area-inset-bottom, 0px)
            - 32px
          ) !important;
        }
      }
    `;
    document.head.appendChild(style);

    // @ts-ignore - TypeScript doesn't know about CDN imports
    import('https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js')
      .then((module: any) => {
        module.createChat({
          webhookUrl: 'https://nn.hnasiaexport.com:8443/webhook/rso-campus-chatbot/chat',
          mode: 'window',
          chatInputKey: 'chatInput',
          showWelcomeScreen: true,
          showPoweredBy: false, // Disables branding if supported by the widget version
          initialMessages: [
            'ආයුබෝවන්! 👋 මම RSO Campus Assistant.',
            'Halls, labs, bookings, users ගැන අහන්න!'
          ],
          i18n: {
            en: {
              title: '🎓 RSO Campus Assistant',
              subtitle: 'Database Explorer | ප්‍රශ්න අහන්න!',
              inputPlaceholder: 'ඔබේ ප්‍රශ්නය type කරන්න...',
            },
          },
          theme: {
            button: {
              backgroundColor: '#6366f1',
              right: 20,
              bottom: 20,
              size: 56,
              iconColor: '#ffffff',
            },
          },
        });
      });

    return () => { 
      if (document.head.contains(link)) document.head.removeChild(link); 
      if (document.head.contains(style)) document.head.removeChild(style);
    };
  }, []);

  return null;
}
