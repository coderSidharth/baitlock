document.addEventListener('DOMContentLoaded', () => {
    // Query the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        const currentTabId = tabs[0].id;

        // Get result from background script
        chrome.runtime.sendMessage({ type: "GET_RESULT", tabId: currentTabId }, (response) => {
            if (chrome.runtime.lastError || !response || response.status === "error") {
                renderError();
            } else if (response.status === "success") {
                renderResult(response.result);
            }
            // if loading, keep the existing "Loading..." UI state
        });
    });
});

function renderError() {
    document.getElementById('tier-badge').textContent = "ERROR";
    document.getElementById('tier-badge').style.backgroundColor = "#5f6368";
    document.getElementById('verdict-text').textContent = "Couldn't reach server / Analysis failed";
    document.getElementById('score').textContent = "--";
    document.getElementById('reasons-list').innerHTML = "<li>No data available for this page.</li>";
}

function renderResult(data) {
    // Tier badge
    const badge = document.getElementById('tier-badge');
    badge.textContent = data.tier.toUpperCase() + " RISK";
    badge.className = `badge tier-${data.tier}`;

    // Verdict
    document.getElementById('verdict-text').textContent = data.verdict;

    // Score
    document.getElementById('score').textContent = data.score;

    // Reasons list
    const reasonsList = document.getElementById('reasons-list');
    reasonsList.innerHTML = '';
    if (data.reasons && data.reasons.length > 0) {
        data.reasons.forEach(reason => {
            const li = document.createElement('li');
            li.textContent = reason;
            reasonsList.appendChild(li);
        });
    } else {
        reasonsList.innerHTML = "<li>No significant issues found.</li>";
    }
}
