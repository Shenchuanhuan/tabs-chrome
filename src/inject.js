(function() {
  if (window.hasTabsHomeInjected) return;
  window.hasTabsHomeInjected = true;

  const iconUrl = chrome.runtime.getURL('assets/icons/favicon-32x32.png');
  const panelUrl = chrome.runtime.getURL('html/sidepanel.html');

  // Create floating button
  const button = document.createElement('div');
  button.id = 'tabs-home-floating-button';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 48px;
    height: 48px;
    background-color: #6366f1;
    background-image: url("${iconUrl}");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 24px;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    z-index: 2147483647;
    transition: transform 0.2s, background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    touch-action: none;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.backgroundColor = '#4f46e5';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.backgroundColor = '#6366f1';
  });

  // Create iframe container
  const iframe = document.createElement('iframe');
  iframe.id = 'tabs-home-panel';
  iframe.src = panelUrl;
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    right: -400px;
    width: 380px;
    height: 100vh;
    border: none;
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
    z-index: 2147483646;
    transition: right 0.3s ease-in-out;
    background: white;
  `;

  document.body.appendChild(button);
  document.body.appendChild(iframe);

  let isOpen = false;
  let isDragging = false;
  let startX, startY;
  let initialRight, initialBottom;
  let originalUserSelect = '';
  let dragOverlay = null;

  button.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    
    const style = window.getComputedStyle(button);
    initialRight = parseInt(style.right);
    initialBottom = parseInt(style.bottom);

    originalUserSelect = document.body.style.userSelect || '';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = startX - moveEvent.clientX;
      const deltaY = startY - moveEvent.clientY;
      
      if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        isDragging = true;
        
        if (!dragOverlay) {
          dragOverlay = document.createElement('div');
          dragOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483646;
            background: transparent;
            cursor: move;
          `;
          document.body.appendChild(dragOverlay);
        }
      }

      if (isDragging) {
        let newRight = initialRight + deltaX;
        let newBottom = initialBottom + deltaY;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const buttonSize = 48;

        if (newBottom > viewportHeight - buttonSize) newBottom = viewportHeight - buttonSize;
        if (newBottom < 0) newBottom = 0;
        if (newRight < 0) newRight = 0;
        if (newRight > viewportWidth - buttonSize) newRight = viewportWidth - buttonSize;

        button.style.right = newRight + 'px';
        button.style.bottom = newBottom + 'px';
        button.style.left = 'auto';
        button.style.top = 'auto';
      }
    };

    const onMouseUp = () => {
      if (dragOverlay) {
        dragOverlay.remove();
        dragOverlay = null;
      }
      document.body.style.userSelect = originalUserSelect;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  button.addEventListener('click', (e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.right = '0';
    } else {
      iframe.style.right = '-400px';
    }
  });

  window.addEventListener('message', (event) => {
    if (event.data === 'close-tabs-home-panel') {
      isOpen = false;
      iframe.style.right = '-400px';
    }
  });
})();
