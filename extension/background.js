let configReady = false;
try {
    importScripts("config.js");
    configReady = true;
} catch (error) { console.error("Baitlock configuration failed", error); }
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch(console.error);
const bypassNavigations = new Map();
let storageWrites = Promise.resolve();
let authRevision = 0;

function updateBadge(tabId, tier) {
    const badges = { safe: ["#10B981", "OK"], moderate: ["#F59E0B", "MED"], high: ["#EF4444", "HIGH"], critical: ["#DC2626", "!"], error: ["#6B7280", "?"] };
    const [color, text] = badges[tier] || badges.error;
    chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(console.debug);
    chrome.action.setBadgeText({ tabId, text }).catch(console.debug);
}

function writeScanResults(change) {
    const operation = storageWrites.then(async () => {
        const { scan_results = {} } = await chrome.storage.local.get("scan_results");
        const latest = change(scan_results);
        const entries = Object.entries(scan_results).filter(([, result]) => Date.now() - result.timestamp < 86400000)
            .sort((a, b) => b[1].timestamp - a[1].timestamp).slice(0, 200);
        await chrome.storage.local.set({ scan_results: Object.fromEntries(entries), ...latest });
    });
    storageWrites = operation.catch(console.error);
    return operation;
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0 || !/^https?:\/\//.test(details.url)) return;
    if (!configReady) { updateBadge(details.tabId, "error"); return; }
    for (const [id, bypass] of bypassNavigations) {
        if (bypass.expiresAt < Date.now()) bypassNavigations.delete(id);
    }
    if (baitlockIsAppUrl(details.url)) return;
    const bypass = bypassNavigations.get(details.tabId);
    bypassNavigations.delete(details.tabId);
    if (bypass?.url === details.url) return;
    chrome.tabs.update(details.tabId, { url: `${chrome.runtime.getURL("scan.html")}?url=${encodeURIComponent(details.url)}` })
        .catch(console.debug);
});

async function completeScan(tabId, targetUrl, data, senderUrl) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url !== senderUrl) throw new Error("Ignoring an outdated scan");
    if (data) {
        updateBadge(tabId, data.tier);
        await writeScanResults((results) => {
            results[tabId] = { data, url: targetUrl, timestamp: Date.now() };
            return { latest_scan: data, latest_url: targetUrl };
        });
        if (["high", "critical"].includes(data.tier)) {
            await chrome.tabs.update(tabId, { url: `${BAITLOCK_CONFIG.APP_ORIGIN}/?blocked=true&url=${encodeURIComponent(targetUrl)}&score=${data.final_score}&tier=${data.tier}` });
            return;
        }
    } else { updateBadge(tabId, "error"); }
    if (bypassNavigations.size >= 500) bypassNavigations.delete(bypassNavigations.keys().next().value);
    bypassNavigations.set(tabId, { url: targetUrl, expiresAt: Date.now() + 30000 });
    await chrome.tabs.update(tabId, { url: targetUrl });
}

function validResult(data) {
    return data && ["safe", "moderate", "high", "critical"].includes(data.tier) &&
        Number.isFinite(data.final_score) && data.final_score >= 0 && data.final_score <= 100;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!configReady) { sendResponse({ ok: false }); return; }
    if (message?.type === "BAITLOCK_AUTH_SYNC") {
        if (!sender.url || !baitlockIsAppUrl(sender.url) || sender.frameId !== 0) return;
        const revision = ++authRevision;
        (async () => {
            const token = message.token;
            if (token === null) {
                await chrome.storage.local.remove("baitlock_token");
            } else {
                if (!baitlockTokenValid(token)) throw new Error("Invalid or expired token");
                const response = await fetch(`${BAITLOCK_CONFIG.API_BASE}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
                });
                if (!response.ok) throw new Error("Server rejected the token");
                if (revision === authRevision) await chrome.storage.local.set({ baitlock_token: token });
            }
            sendResponse({ ok: true });
        })().catch((error) => { console.warn("Auth sync failed", error.message); sendResponse({ ok: false }); });
        return true;
    }
    if (message?.type !== "BAITLOCK_SCAN_COMPLETE") return;
    try {
        const senderUrl = new URL(sender.url);
        const expectedPage = new URL(chrome.runtime.getURL("scan.html"));
        const target = new URL(message.targetUrl);
        if (senderUrl.origin !== expectedPage.origin || senderUrl.pathname !== expectedPage.pathname ||
            sender.tab?.id === undefined || senderUrl.searchParams.get("url") !== target.href ||
            !["http:", "https:"].includes(target.protocol) || (message.data && !validResult(message.data))) {
            throw new Error("Invalid scan completion");
        }
        completeScan(sender.tab.id, target.href, message.data || null, sender.url)
            .then(() => sendResponse({ ok: true }))
            .catch((error) => { console.warn(error.message); sendResponse({ ok: false }); });
        return true;
    } catch { sendResponse({ ok: false }); }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    bypassNavigations.delete(tabId);
    writeScanResults((results) => { delete results[tabId]; return {}; }).catch(console.error);
});
