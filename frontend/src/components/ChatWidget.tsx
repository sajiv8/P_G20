import { useEffect } from 'react';

export function ChatWidget() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
    document.head.appendChild(link);

    import('https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js')
      .then(module => {
        module.createChat({
          webhookUrl: 'https://nn.isuruhub.site:8443/webhook/rso-campus-chatbot/chat',
          mode: 'window',
          chatInputKey: 'chatInput',
          showWelcomeScreen: true,
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
      if (document.head.contains(link)) {
        document.head.removeChild(link); 
      }
    };
  }, []);

  return null;
}
