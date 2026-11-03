document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = "http://localhost:8000/api/v1";
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
    const loginBtnText = loginBtn.querySelector('.btn-text');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    // Scanner Elements
    const currentUrlEl = document.getElementById('current-url');
    const scanBtn = document.getElementById('scan-btn');
    const spinner = document.getElementById('spinner');
    const btnText = scanBtn.querySelector('.btn-text');
    const resultContainer = document.getElementById('result-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');

    // Flagging Elements
    const flagLegitBtn = document.getElementById('flag-legit-btn');
    const flagMaliciousBtn = document.getElementById('flag-malicious-btn');
    const flagStatus = document.getElementById('flag-status');
    const flagSection = document.getElementById('flag-section');

    // Tabs & Fraud Elements
    const tabPhishing = document.getElementById('tab-phishing');
    const tabFraud = document.getElementById('tab-fraud');
    const sectionPhishing = document.getElementById('section-phishing');
    const sectionFraud = document.getElementById('section-fraud');
    const fraudForm = document.getElementById('fraud-form');
    const fraudAmount = document.getElementById('fraud-amount');
    const fraudVelocity = document.getElementById('fraud-velocity');
    const fraudDistance = document.getElementById('fraud-distance');
    const fraudBtn = document.getElementById('fraud-btn');
    const fraudSpinner = document.getElementById('fraud-spinner');

    let currentTab = null;
    let currentDomain = null;

    // Initialization: Check Token
    chrome.storage.local.get(['baitlock_token'], async (res) => {
        if (res.baitlock_token) {
            token = res.baitlock_token;
            showScanView();
        } else {
            showLoginView();
        }
        await initCurrentTab();
    });

    async function initCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tabs[0];
            if (currentTab && currentTab.url) {
                let activeUrl = currentTab.url;
                try {
                    const parsedUrl = new URL(currentTab.url);
                    if (parsedUrl.hostname === 'localhost' && parsedUrl.searchParams.has('blocked') && parsedUrl.searchParams.has('url')) {
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

    // Sync auth to Web App
    function syncWebAuth(action, tokenValue = null) {
        chrome.tabs.query({ url: "http://localhost:3000/*" }, (tabs) => {
            tabs.forEach(tab => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (act, tok) => {
                        if (act === 'login') {
                            localStorage.setItem('access_token', tok);
                            localStorage.setItem('isLoggedIn', 'true');
                            window.location.reload();
                        } else if (act === 'logout') {
                            localStorage.removeItem('access_token');
                            localStorage.removeItem('isLoggedIn');
                            window.location.reload();
                        }
                    },
                    args: [action, tokenValue]
                });
            });
        });
    }

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();
        if (!email || !password) return;

        loginBtn.disabled = true;
        loginBtnText.classList.add('hidden');
        loginSpinner.classList.remove('hidden');
        loginError.classList.add('hidden');

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const res = await fetch(`${API_BASE}/auth/login`, {
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
            token = data.access_token;
            chrome.storage.local.set({ baitlock_token: token });
            syncWebAuth('login', token);
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
                await fetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error("Logout error", e);
            }
        }
        token = null;
        chrome.storage.local.remove('baitlock_token');
        syncWebAuth('logout');
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

            const response = await fetch(`${API_BASE}/phishing/check`, {
                method: "POST",
                headers,
                body: JSON.stringify({ url: currentTab.url, page_text: pageText || undefined })
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

    // Tab Switching Logic
    tabPhishing.addEventListener('click', () => {
        tabPhishing.classList.add('active');
        tabFraud.classList.remove('active');
        sectionPhishing.style.display = 'block';
        sectionFraud.style.display = 'none';
        errorContainer.classList.add('hidden');
        if (!resultContainer.classList.contains('hidden')) {
            flagSection.classList.remove('hidden');
        }
    });

    tabFraud.addEventListener('click', async () => {
        tabFraud.classList.add('active');
        tabPhishing.classList.remove('active');
        sectionFraud.style.display = 'block';
        sectionPhishing.style.display = 'none';
        errorContainer.classList.add('hidden');
        flagSection.classList.add('hidden');

        // Suggest amount from current active page if available
        if (!fraudAmount.value && currentTab && currentTab.id) {
            try {
                const res = await chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    func: () => {
                        const match = document.body.innerText.match(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
                        return match ? match[1].replace(/,/g, '') : null;
                    }
                });
                if (res && res[0] && res[0].result) {
                    fraudAmount.placeholder = `Detected $${res[0].result}`;
                }
            } catch (_) {}
        }
    });

    // Transaction Fraud Scoring Handler
    fraudForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(fraudAmount.value);
        if (isNaN(amount) || amount <= 0) {
            showError("Please enter a valid transaction amount.");
            return;
        }

        const velocity = parseInt(fraudVelocity.value, 10) || 1;
        const geoDistance = parseFloat(fraudDistance.value) || 0.0;
        const hour = new Date().getHours();

        fraudBtn.disabled = true;
        fraudBtn.querySelector('.btn-text').classList.add('hidden');
        fraudSpinner.classList.remove('hidden');
        errorContainer.classList.add('hidden');

        try {
            const headers = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE}/fraud/score`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    transaction: {
                        amount: amount,
                        velocity: velocity,
                        hour: hour,
                        geo_distance: geoDistance
                    }
                })
            });

            if (!response.ok) {
                let errMsg = `Server error (${response.status})`;
                try {
                    const errBody = await response.json();
                    const detail = errBody.detail;
                    if (typeof detail === 'string') errMsg = detail;
                    else if (Array.isArray(detail)) errMsg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
                } catch (_) {}
                throw new Error(errMsg);
            }

            const data = await response.json();
            renderResult(data);
            flagSection.classList.add('hidden'); // Transactions don't use domain community review

        } catch (error) {
            showError("Transaction check failed: " + error.message);
        } finally {
            fraudBtn.disabled = false;
            fraudBtn.querySelector('.btn-text').classList.remove('hidden');
            fraudSpinner.classList.add('hidden');
        }
    });

    // Flagging Logic
    const sendFlag = async (flagType, endpoint, payload) => {
        if (!currentDomain || !token) return;
        
        flagLegitBtn.disabled = true;
        flagMaliciousBtn.disabled = true;
        
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                // Record community reputation flag
                fetch(`${API_BASE}/companies/flag`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        url: currentDomain,
                        flag_type: flagType === 'whitelist' ? 'legitimate' : 'malicious'
                    })
                }).catch(() => {});

                flagStatus.textContent = flagType === 'whitelist' 
                    ? "Added to your personal whitelist!" 
                    : "Thank you! Flag recorded.";
                flagStatus.className = "flag-status success";

                if (flagType === 'whitelist') {
                    let activeUrl = currentTab.url;
                    try {
                        const parsedUrl = new URL(currentTab.url);
                        if (parsedUrl.hostname === 'localhost' && parsedUrl.searchParams.has('url')) {
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
            const llmEl = document.getElementById('bd-llm');
            const llmRow = llmEl ? llmEl.parentElement : null;
            if (llmRow) {
                if (data.breakdown.llm_score) {
                    llmRow.style.display = 'flex';
                    llmEl.textContent = data.breakdown.llm_score;
                } else {
                    llmRow.style.display = 'none';
                }
            }
        } else {
            document.getElementById('breakdown-container').classList.add('hidden');
        }
    }
});
