// chrome-extension/content.js
// Listens for "/" keypress and forwards to background.js
// Note: preventDefault() will override "/" shortcuts in web apps
// (GitHub, YouTube, etc.) — accepted trade-off for global search focus.

document.addEventListener('keydown', (e) => {
    if (e.key !== '/') return;

    // Don't intercept when typing in input fields
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (document.activeElement?.isContentEditable) return;

    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'focus_search' });
});
