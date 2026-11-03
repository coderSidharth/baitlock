importScripts("config.js");
const API_BASE = BAITLOCK_CONFIG.API_BASE;

function updateBadge(tabId, tier) {
    let color = "#5f6368";
    let text = "";
    if (tier === "safe") {
        color = "#10B981"; // green
        text = "OK";
    } else if (tier === "low") {
        color = "#3B82F6"; // blue
        text = "LOW";
    } else if (tier === "medium" || tier === "moderate") {
        color = "#F59E0B"; // amber
        text = "MED";
    } else if (tier === "high") {
        color = "#EF4444"; // red
        text = "HIGH";
    } else if (tier === "critical") {
        color = "#DC2626"; // dark red
        text = "!";
    } else if (tier === "error") {
        color = "#6B7280";
        text = "?";
    }

    try {
        chrome.action.setBadgeBackgroundColor({ tabId, color });
        chrome.action.setBadgeText({ tabId, text });
    } catch (e) {
        // Tab might have been closed or detached
    }
}

// Use webNavigation.onBeforeNavigate for early interception before page loads
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only process top-level frame navigations
    if (details.frameId !== 0) return;

    const url = details.url;

    // Only scan http/https URLs (skip chrome://, edge://, about:, file://, data:, etc.)
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;

    // Ignore internal pages: the Baitlock dashboard and block page
    if (baitlockIsAppUrl(url)) return;

    const { baitlock_token } = await chrome.storage.local.get(['baitlock_token']);
    
    // Fail-open: if user is not logged in, allow normal navigation without blocking
    if (!baitlock_token) return;

    try {
        // Initiate fast background scan
        const response = await fetch(`${API_BASE}/phishing/check`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${baitlock_token}`
            },
            body: JSON.stringify({ url: url, fast_mode: true })
        });

        if (response.ok) {
            const data = await response.json();
            
            // Set badge color and text per threat tier
            updateBadge(details.tabId, data.tier);

            // If threat is High or Critical, intercept and redirect
            if (data.tier === "high" || data.tier === "critical") {
                const blockUrl = `${BAITLOCK_CONFIG.APP_ORIGIN}/?blocked=true&url=${encodeURIComponent(url)}&score=${data.final_score}&tier=${data.tier}`;
                chrome.tabs.update(details.tabId, { url: blockUrl });
            }
            
            // Save scan result keyed by tab ID so multiple tabs don't overwrite each other
            const scanResults = (await chrome.storage.local.get(['scan_results'])).scan_results || {};
            scanResults[details.tabId] = { data, url, timestamp: Date.now() };
            chrome.storage.local.set({ 
                scan_results: scanResults,
                latest_scan: data,
                latest_url: url
            });
        } else {
            // Fail open on non-200 responses
            updateBadge(details.tabId, "error");
        }
    } catch (error) {
        // Ensure fail-open: network down or timeout should never block the user
        console.warn("Background scan deferred (fail-open):", error?.message || error);
        updateBadge(details.tabId, "error");
    }
});

// Clean up stored results and badge when a tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
        const { scan_results } = await chrome.storage.local.get(['scan_results']);
        if (scan_results && scan_results[tabId]) {
            delete scan_results[tabId];
            chrome.storage.local.set({ scan_results });
        }
    } catch (e) {}
});
