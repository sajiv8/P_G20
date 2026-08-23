import { useEffect } from 'react';

export function ChatWidget() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
    document.head.appendChild(link);

    // Add custom CSS to hide the "Powered by n8n" branding
    const style = document.createElement('style');
    style.innerHTML = `
      .chat-footer > a, .n8n-chat-footer > a, a[href*="n8n.io"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    // @ts-ignore - TypeScript doesn't know about CDN imports
    import('https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js')
      .then((module: any) => {
        module.createChat({
          webhookUrl: window.location.origin + '/webhook/rso-campus-chatbot/chat',
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
