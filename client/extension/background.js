// background.js

const BACKEND_URL = "http://localhost:8000";

// Store results per tab ID
const tabResults = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PAGE_LOADED") {
        const tabId = sender.tab.id;
        const { url, page_text } = message.payload;

        fetch(`${BACKEND_URL}/phishing/check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, page_text })
        })
            .then(res => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then(data => {
                updateBadge(tabId, data.tier);
                tabResults[tabId] = data;
            })
            .catch(error => {
                console.error("Fetch error:", error);
                updateBadge(tabId, "error");
                tabResults[tabId] = null; // Indicates error
            });
    }
});

function updateBadge(tabId, tier) {
    let color = "#5f6368"; // default gray
    let text = "!";
    if (tier === "low") color = "#2e7d32"; // green
    if (tier === "medium") color = "#ed6c02"; // orange
    if (tier === "high") color = "#d32f2f"; // red
    if (tier === "error") {
        color = "#5f6368"; // Keep gray on error
        text = "?";
    }

    chrome.action.setBadgeBackgroundColor({ tabId, color });
    chrome.action.setBadgeText({ tabId, text });
}

// Allow popup to request the result for its current tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_RESULT") {
        const result = tabResults[message.tabId];
        if (result === undefined) {
            sendResponse({ status: "loading" });
        } else if (result === null) {
            sendResponse({ status: "error" });
        } else {
            sendResponse({ status: "success", result });
        }
    }
});
