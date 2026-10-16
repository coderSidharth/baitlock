const url = window.location.href;
// Grab visible body text, limiting to first 5000 chars to avoid huge payloads
const pageText = document.body ? document.body.innerText.slice(0, 5000) : "";

// Send to background script
chrome.runtime.sendMessage({
    type: "PAGE_LOADED",
    payload: { url, page_text: pageText }
});
