(function () {
  if (window.hasTabsHomeInjected) return;
  window.hasTabsHomeInjected = true;

  const iconUrl = chrome.runtime.getURL("assets/icons/favicon-32x32.png");

  // Inject speech bubble tail style
  const bubbleStyle = document.createElement("style");
  bubbleStyle.textContent = `
    .tabs-home-introduce-bubble::before,
    .tabs-home-introduce-bubble::after {
      content: '';
      position: absolute;
      pointer-events: none;
      width: 0;
      height: 0;
      transform: rotate(-8deg);
      transform-origin: top center;
    }

    .tabs-home-introduce-bubble::before {
      bottom: -13px;
      right: 15px;
      border-left: 10px solid transparent;
      border-right: 8px solid transparent;
      border-top: 14px solid rgba(0, 0, 0, 0.18);
      filter: blur(1px);
    }

    .tabs-home-introduce-bubble::after {
      bottom: -10px;
      right: 18px;
      width: 0;
      height: 0;
      border-left: 9px solid transparent;
      border-right: 7px solid transparent;
      border-top: 13px solid #1f2937;
    }
  `;
  document.head.appendChild(bubbleStyle);

  // Create floating button
  const button = document.createElement("div");
  button.id = "tabs-home-floating-button";
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

  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.1)";
    button.style.backgroundColor = "#4f46e5";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
    button.style.backgroundColor = "#6366f1";
  });

  // Disable right-click menu
  button.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  document.body.appendChild(button);

  let isDragging = false;
  let startX, startY;
  let initialRight, initialBottom;
  let originalUserSelect = "";
  let dragOverlay = null;

  const openSidePanel = () => {
    // Check if context is still valid
    if (!chrome.runtime?.id) {
      console.debug(
        "Tabs Home: Context invalidated, removing floating button.",
      );
      button.remove();
      return;
    }

    chrome.runtime.sendMessage({ action: "toggle_side_panel" }, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        if (errorMsg.includes("Extension context invalidated")) {
          console.debug(
            "Tabs Home: Context invalidated, removing floating button.",
          );
          button.remove();
        } else {
          console.error(
            "Tabs Home: Connection to background script failed:",
            errorMsg,
          );
        }
      }
    });
  };

  button.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;

    const style = window.getComputedStyle(button);
    initialRight = parseInt(style.right);
    initialBottom = parseInt(style.bottom);

    originalUserSelect = document.body.style.userSelect || "";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = startX - moveEvent.clientX;
      const deltaY = startY - moveEvent.clientY;

      if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        isDragging = true;

        if (!dragOverlay) {
          dragOverlay = document.createElement("div");
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

        if (newBottom > viewportHeight - buttonSize)
          newBottom = viewportHeight - buttonSize;
        if (newBottom < 0) newBottom = 0;
        if (newRight < 0) newRight = 0;
        if (newRight > viewportWidth - buttonSize)
          newRight = viewportWidth - buttonSize;

        button.style.right = newRight + "px";
        button.style.bottom = newBottom + "px";
        button.style.left = "auto";
        button.style.top = "auto";
      }
    };

    const onMouseUp = () => {
      if (dragOverlay) {
        dragOverlay.remove();
        dragOverlay = null;
      }
      document.body.style.userSelect = originalUserSelect;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  button.addEventListener("click", (e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    openSidePanel();
  });

  // ============================================================
  //  Introduce Bubble — periodic random link recommendation
  // ============================================================

  let introduceBubble = null;
  let introduceTimer = null;

  function dismissIntroduceBubble() {
    if (introduceTimer) {
      clearTimeout(introduceTimer);
      introduceTimer = null;
    }
    if (introduceBubble) {
      introduceBubble.style.opacity = "0";
      introduceBubble.style.transform = "translateY(8px)";
      setTimeout(() => {
        if (introduceBubble) {
          introduceBubble.remove();
          introduceBubble = null;
        }
      }, 200);
    }
  }

  async function showIntroduceBubble() {
    // Don't show on restricted pages
    if (
      window.location.protocol === "chrome:" ||
      window.location.protocol === "chrome-extension:" ||
      window.location.href === "about:blank"
    )
      return;

    // Remove existing bubble
    dismissIntroduceBubble();

    // Get saved tabs and existing introduce data
    const result = await chrome.storage.local.get(["tabs", "introduce"]);
    const allTabs = result.tabs || [];
    const existingIntroduce = result.introduce;

    if (allTabs.length === 0) return; // No saved links to recommend

    // Pick a random link, avoiding the current introduce.link if it exists
    let picked = null;
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      const randomIndex = Math.floor(Math.random() * allTabs.length);
      const candidate = allTabs[randomIndex];
      // Skip if title AND url match existing introduce.link
      if (
        existingIntroduce &&
        existingIntroduce.link &&
        candidate.title === existingIntroduce.link.title &&
        candidate.url === existingIntroduce.link.url
      ) {
        continue;
      }
      picked = candidate;
      break;
    }

    // Fallback: if all attempts failed (e.g. only one link and it matches), use first link
    if (!picked) {
      picked = allTabs[0];
    }

    // Deep copy and save to introduce
    const linkData = {
      url: picked.url,
      title: picked.title,
      favIconUrl: picked.favIconUrl || "",
      description: picked.description || "",
      created_at: picked.created_at || Date.now(),
      isFavorite: picked.isFavorite || false,
    };

    chrome.storage.local.set({
      introduce: {
        last_timestamp: Date.now(),
        link: linkData,
      },
    });

    // Create bubble
    introduceBubble = document.createElement("div");
    introduceBubble.className = "tabs-home-introduce-bubble";
    introduceBubble.style.cssText = `
      position: fixed;
      bottom: 0;
      right: 0;
      background: #1f2937;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      padding: 10px 14px;
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      z-index: 2147483646;
      white-space: normal;
      max-width: 280px;
      opacity: 1;
      transition: opacity 0.2s, transform 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
      text-align: left;
    `;

    // Position bubble relative to floating button
    const btnRect = button.getBoundingClientRect();
    const bubbleBottom = window.innerHeight - btnRect.top + 10; // 10px gap above button
    const bubbleRight = window.innerWidth - btnRect.right;
    introduceBubble.style.bottom = bubbleBottom + "px";
    introduceBubble.style.right = bubbleRight + "px";

    introduceBubble.innerHTML = `<span>💡 主人，看 「 ${picked.title} 」吗？</span>`;

    // Click handler: dismiss and open link in new tab
    introduceBubble.addEventListener("click", (e) => {
      e.stopPropagation();
      const urlToOpen = linkData.url;
      dismissIntroduceBubble();
      chrome.runtime.sendMessage(
        { action: "open_link", url: urlToOpen },
        () => {
          if (chrome.runtime.lastError) {
            // Fallback: open directly
            window.open(urlToOpen, "_blank");
          }
        },
      );
    });

    document.body.appendChild(introduceBubble);

    // Auto-dismiss after 5 seconds
    introduceTimer = setTimeout(dismissIntroduceBubble, 5000);
  }

  // Start periodic timer: every 30 seconds
  setInterval(() => {
    if (document.visibilityState === "visible") {
      showIntroduceBubble();
    }
  }, 30000);

  // First bubble after 2 seconds
  setTimeout(() => {
    if (document.visibilityState === "visible") {
      showIntroduceBubble();
    }
  }, 2000);
})();
