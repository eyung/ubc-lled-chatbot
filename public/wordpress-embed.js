(function() {
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
    `;
    document.head.appendChild(style);

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'ubc-lled-chatbot-toggle';
    toggleBtn.innerHTML = '💬';
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
    iframe.src = 'https://ubc-lled-chatbot.vercel.app/chatbot';
    container.appendChild(iframe);

    // Toggle functionality
    let isOpen = false;
    toggleBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        container.style.display = isOpen ? 'flex' : 'none';
    });

    // Handle responsive layout
    function adjustForMobile() {
        if (window.innerWidth < 768) {
            container.style.width = '90%';
            container.style.right = '5%';
            container.style.left = '5%';
            toggleBtn.style.right = '20px';
        } else {
            container.style.width = '350px';
            container.style.right = '20px';
            container.style.left = 'auto';
        }
    }

    window.addEventListener('resize', adjustForMobile);
    adjustForMobile();
})();