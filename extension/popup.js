document.addEventListener('DOMContentLoaded', async () => {
    if (typeof BAITLOCK_CONFIG === "undefined") {
        document.getElementById("login-error")?.classList.remove("hidden");
        document.getElementById("login-error").textContent = "Configuration failed. Reload the extension.";
        return;
    }
    const API_BASE = BAITLOCK_CONFIG.API_BASE;
    let token = null;

    // Views
    const viewLogin = document.getElementById('view-login');
    const viewScan = document.getElementById('view-scan');

    // Login Elements
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const loginSpinner = document.getElementById('login-spinner');
    const loginBtnText = loginBtn?.querySelector('.btn-text');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    // Scanner Elements
    const currentUrlEl = document.getElementById('current-url');
    const scanBtn = document.getElementById('scan-btn');
    const spinner = document.getElementById('spinner');
    const btnText = scanBtn?.querySelector('.btn-text');
    const resultContainer = document.getElementById('result-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');

    // Flagging Elements
    const flagLegitBtn = document.getElementById('flag-legit-btn');
    const flagMaliciousBtn = document.getElementById('flag-malicious-btn');
    const flagStatus = document.getElementById('flag-status');

    let currentTab = null;
    let currentDomain = null;

    if ([viewLogin, viewScan, loginForm, loginEmail, loginPassword, loginBtn, loginSpinner,
         loginBtnText, loginError, logoutBtn, currentUrlEl, scanBtn, spinner, btnText,
         resultContainer, errorContainer, errorMessage, flagLegitBtn, flagMaliciousBtn, flagStatus].some(el => !el)) {
        console.error("Baitlock popup markup is incomplete");
        return;
    }

    async function apiFetch(url, options = {}) {
        const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
        if (response.status === 401) {
            token = null;
            await chrome.storage.local.remove("baitlock_token");
            showLoginView();
            loginError.textContent = "Your session expired. Please sign in again.";
            loginError.classList.remove("hidden");
        }
        return response;
    }

    const stored = await chrome.storage.local.get("baitlock_token");
    if (baitlockTokenValid(stored.baitlock_token)) {
        token = stored.baitlock_token;
        try {
            const me = await apiFetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (me.ok) showScanView(); else showLoginView();
        } catch { showLoginView(); }
    } else {
        await chrome.storage.local.remove("baitlock_token");
        showLoginView();
    }
    await initCurrentTab();

    async function initCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tabs[0];
            if (currentTab && currentTab.url) {
                let activeUrl = currentTab.url;
                try {
                    const parsedUrl = new URL(currentTab.url);
                    if (baitlockIsAppUrl(currentTab.url) && parsedUrl.searchParams.has('blocked') && parsedUrl.searchParams.has('url')) {
                        activeUrl = parsedUrl.searchParams.get('url');
                    }
                    currentDomain = new URL(activeUrl).hostname;
                } catch (e) {
                    currentDomain = activeUrl;
                }
                currentUrlEl.textContent = activeUrl;

                // Load background scan result for current tab
                chrome.storage.local.get(['scan_results', 'latest_scan', 'latest_url'], (res) => {
                    const tabResult = res.scan_results && currentTab && res.scan_results[currentTab.id];
                    if (tabResult && tabResult.url === activeUrl && tabResult.data) {
                        renderResult(tabResult.data);
                        flagStatus.classList.add('hidden');
                        flagLegitBtn.disabled = false;
                        flagMaliciousBtn.disabled = false;
                    } else if (res.latest_url === activeUrl && res.latest_scan) {
                        renderResult(res.latest_scan);
                        flagStatus.classList.add('hidden');
                        flagLegitBtn.disabled = false;
                        flagMaliciousBtn.disabled = false;
                    }
                });
            } else {
                currentUrlEl.textContent = "Unable to read URL";
                scanBtn.disabled = true;
            }
        } catch (e) {
            currentUrlEl.textContent = "Error reading tab";
            scanBtn.disabled = true;
        }
    }

    // View Toggles
    function showLoginView() {
        viewLogin.style.display = 'block';
        viewScan.style.display = 'none';
    }

    function showScanView() {
        viewLogin.style.display = 'none';
        viewScan.style.display = 'block';
    }

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value;
        if (!email || !password) return;

        loginBtn.disabled = true;
        loginBtnText.classList.add('hidden');
        loginSpinner.classList.remove('hidden');
        loginError.classList.add('hidden');

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const res = await apiFetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData
            });

            if (!res.ok) {
                let message = "Login failed";
                try {
                    const err = await res.json();
                    const detail = err.detail;
                    if (typeof detail === 'string') {
                        message = detail;
                    } else if (Array.isArray(detail)) {
                        // FastAPI validation errors: [{loc, msg, type}, ...]
                        message = detail
                            .map(d => (typeof d === 'object' && d !== null) ? (d.msg || JSON.stringify(d)) : String(d))
                            .join(', ');
                    } else if (detail && typeof detail === 'object') {
                        message = detail.msg || detail.message || JSON.stringify(detail);
                    }
                } catch (_) {
                    message = `Server error (${res.status})`;
                }
                throw new Error(message);
            }

            const data = await res.json();
            if (!baitlockTokenValid(data.access_token)) throw new Error("Server returned an invalid token");
            token = data.access_token;
            chrome.storage.local.set({ baitlock_token: token });

            showScanView();
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        } finally {
            loginBtn.disabled = false;
            loginBtnText.classList.remove('hidden');
            loginSpinner.classList.add('hidden');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        if (token) {
            try {
                await apiFetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error("Logout error", e);
            }
        }
        token = null;
        chrome.storage.local.remove('baitlock_token');

        showLoginView();
        resultContainer.classList.add('hidden');
    });

    // Manual Scanner Logic
    scanBtn.addEventListener('click', async () => {
        if (!currentTab || !currentTab.url) return;
        if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('edge://')) {
            showError("System pages cannot be scanned.");
            return;
        }

        setLoading(true);
        try {
            let pageText = "";
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    func: () => document.body.innerText,
                });
                if (results && results[0] && results[0].result) {
                    pageText = results[0].result.substring(0, 45000);
                }
            } catch (err) {
                console.warn("Could not extract page text:", err);
            }

            const headers = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const response = await apiFetch(`${API_BASE}/phishing/check`, {
                method: "POST",
                headers,
                body: JSON.stringify({ url: currentUrlEl.textContent, page_text: pageText || undefined })
            });

            if (!response.ok) {
                let errMsg = `Server error (${response.status})`;
                try {
                    const errBody = await response.json();
                    const detail = errBody.detail;
                    if (typeof detail === 'string') {
                        errMsg = detail;
                    } else if (Array.isArray(detail)) {
                        errMsg = detail
                            .map(d => (typeof d === 'object' && d !== null) ? (d.msg || JSON.stringify(d)) : String(d))
                            .join(', ');
                    } else if (detail && typeof detail === 'object') {
                        errMsg = detail.msg || detail.message || JSON.stringify(detail);
                    }
                } catch (_) {}
                throw new Error(errMsg);
            }

            const data = await response.json();
            renderResult(data);
            
            // Reset flag status for new scan
            flagStatus.classList.add('hidden');
            flagLegitBtn.disabled = false;
            flagMaliciousBtn.disabled = false;

        } catch (error) {
            showError("Failed to scan: " + error.message);
        } finally {
            setLoading(false);
        }
    });

    // Flagging Logic
    const sendFlag = async (flagType, endpoint, payload) => {
        if (!currentDomain || !token) return;
        
        flagLegitBtn.disabled = true;
        flagMaliciousBtn.disabled = true;
        
        try {
            const res = await apiFetch(`${API_BASE}${endpoint}`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                // Record community reputation flag
                const community = await apiFetch(`${API_BASE}/companies/flag`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        url: currentDomain,
                        flag_type: flagType === 'whitelist' ? 'legitimate' : 'malicious'
                    })
                });
                if (!community.ok) {
                    flagStatus.textContent = "Personal list saved; the community vote could not be recorded.";
                    flagStatus.className = "flag-status error";
                    flagStatus.classList.remove("hidden");
                    return;
                }

                flagStatus.textContent = flagType === 'whitelist' 
                    ? "Added to your personal whitelist!" 
                    : "Thank you! Flag recorded.";
                flagStatus.className = "flag-status success";

                if (flagType === 'whitelist') {
                    let activeUrl = currentTab.url;
                    try {
                        const parsedUrl = new URL(currentTab.url);
                        if (baitlockIsAppUrl(currentTab.url) && parsedUrl.searchParams.has('url')) {
                            activeUrl = parsedUrl.searchParams.get('url');
                        }
                    } catch(e) {}
                    chrome.tabs.update(currentTab.id, { url: activeUrl });
                    setTimeout(() => window.close(), 1000);
                }
            } else {
                throw new Error("Failed");
            }
        } catch (e) {
            flagStatus.textContent = "Error submitting flag.";
            flagStatus.className = "flag-status error";
            flagLegitBtn.disabled = false;
            flagMaliciousBtn.disabled = false;
        }
        flagStatus.classList.remove('hidden');
    };

    flagLegitBtn.addEventListener('click', () => sendFlag('whitelist', '/phishing/whitelist', { domain: currentDomain }));
    flagMaliciousBtn.addEventListener('click', () => sendFlag('malicious', '/phishing/blocklist', { domain: currentDomain }));

    function setLoading(isLoading) {
        scanBtn.disabled = isLoading;
        if (isLoading) {
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            resultContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
        } else {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }

    function showError(msg) {
        errorContainer.classList.remove('hidden');
        errorMessage.textContent = msg;
        resultContainer.classList.add('hidden');
    }

    function renderResult(data) {
        resultContainer.classList.remove('hidden');
        errorContainer.classList.add('hidden');

        // Handle both 'final_score' (service dict) and 'score' (Pydantic serialized alias)
        const score = data.final_score !== undefined ? data.final_score : data.score;
        const verdict = data.verdict || 'UNKNOWN';
        const tier = data.tier || 'safe';
        const reasons = data.reasons || [];

        document.getElementById('verdict-title').textContent = verdict;
        document.getElementById('score-value').textContent = score !== undefined ? score : '?';
        document.getElementById('tier-value').textContent = tier;

        document.getElementById('result-container').className = 'result-container tier-' + tier;
        document.getElementById('verdict-banner').className = 'verdict-banner';
        document.getElementById('tier-value').className = 'tier-badge badge-' + tier;

        const reasonsList = document.getElementById('reasons-list');
        reasonsList.innerHTML = '';
        if (reasons.length > 0) {
            document.getElementById('reasons-container').classList.remove('hidden');
            reasons.forEach(reason => {
                const li = document.createElement('li');
                li.textContent = typeof reason === 'string' ? reason : JSON.stringify(reason);
                reasonsList.appendChild(li);
            });
        } else {
            document.getElementById('reasons-container').classList.add('hidden');
        }

        if (data.breakdown) {
            document.getElementById('breakdown-container').classList.remove('hidden');
            document.getElementById('bd-rule').textContent = data.breakdown.rule_score || 0;
            document.getElementById('bd-ml').textContent = data.breakdown.ml_score || 0;
            document.getElementById('bd-llm').textContent = data.breakdown.llm_score ?? 'Not run';
        } else {
            document.getElementById('breakdown-container').classList.add('hidden');
        }
    }
});
