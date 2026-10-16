const API_BASE = "http://localhost:8000/api/v1";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only scan when URL is present and page has finished loading (or is loading a new url)
    if (changeInfo.url && !changeInfo.url.startsWith("chrome://") && !changeInfo.url.startsWith("edge://")) {
        const { baitlock_token } = await chrome.storage.local.get(['baitlock_token']);
        
        if (!baitlock_token) return; // Ignore if user is not logged into Baitlock

        try {
            // Initiate scan
            const response = await fetch(`${API_BASE}/phishing/check`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${baitlock_token}`
                },
                body: JSON.stringify({ url: changeInfo.url, fast_mode: true })
            });

            if (response.ok) {
                const data = await response.json();
                
                // If threat is High or Critical, intercept and redirect
                if (data.tier === "high" || data.tier === "critical") {
                    const blockUrl = `http://localhost:3000/?blocked=true&url=${encodeURIComponent(changeInfo.url)}&score=${data.final_score}&tier=${data.tier}`;
                    chrome.tabs.update(tabId, { url: blockUrl });
                }
                
                // Save latest scan result for popup to read
                chrome.storage.local.set({ latest_scan: data, latest_url: changeInfo.url });
            }
        } catch (error) {
            console.error("Background scan failed:", error);
        }
    }
});
