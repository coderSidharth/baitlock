// Synchronizes Web App auth state to Extension

function syncTokenFromWeb() {
    const token = localStorage.getItem('access_token');
    if (token) {
        chrome.storage.local.set({ baitlock_token: token });
    } else {
        chrome.storage.local.remove('baitlock_token');
    }
}

// 1. Check on initial page load
syncTokenFromWeb();

// 2. Listen for explicit messages from the web app
window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === 'BAITLOCK_LOGIN') {
        if (event.data.token) {
            chrome.storage.local.set({ baitlock_token: event.data.token });
        }
    } else if (event.data && event.data.type === 'BAITLOCK_LOGOUT') {
        chrome.storage.local.remove('baitlock_token');
    }
});
