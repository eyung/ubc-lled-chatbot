(function() {
    // Prevent multiple instances
    if (document.getElementById('ubc-lled-chatbot-widget')) {
        return;
    }

    // Create container for styles
    const style = document.createElement('style');
    style.textContent = `
        #ubc-lled-chatbot-widget {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            display: none;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 999999;
            height: 500px;
            overflow: hidden;
        }
        
        #ubc-lled-chatbot-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #002145;
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            z-index: 999999;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 768px) {
            #ubc-lled-chatbot-widget {
                width: 90%;
                right: 5%;
                left: 5%;
                bottom: 80px;
            }
        }
    `;
    document.head.appendChild(style);

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'ubc-lled-chatbot-toggle';
    toggleBtn.innerHTML = '💬';
    toggleBtn.setAttribute('aria-label', 'Toggle chat assistant');
    document.body.appendChild(toggleBtn);

    // Create chatbot container
    const container = document.createElement('div');
    container.id = 'ubc-lled-chatbot-widget';
    document.body.appendChild(container);

    // Load the chatbot in an iframe
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '10px';
    iframe.src = 'https://ubc-lled-chatbot.vercel.app/chatbot-iframe';
    iframe.title = 'UBC LLED Chat Assistant';
    container.appendChild(iframe);

    // Toggle functionality
    let isOpen = false;
    toggleBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        container.style.display = isOpen ? 'flex' : 'none';
        toggleBtn.style.display = isOpen ? 'none' : 'flex';
    });

    // Listen for messages from the iframe
    window.addEventListener('message', (event) => {
        if (event.data.type === 'chatbot_event') {
            if (window.gtag) {
                gtag('event', event.data.action, {
                    'event_category': 'Chatbot',
                    'event_label': event.data.label
                });
            }
        }
    });
})();