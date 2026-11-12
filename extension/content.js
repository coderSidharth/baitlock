// This bridge shares the dashboard's trust boundary; an XSS there still requires
// fixing in the dashboard. Only the backend can authenticate a token.
(() => {
    if (!baitlockIsAppUrl(location.href)) return;
    const sync = () => {
        try {
            const token = localStorage.getItem("access_token");
            if (token !== null && !baitlockTokenValid(token)) return;
            chrome.runtime.sendMessage({ type: "BAITLOCK_AUTH_SYNC", token }).catch(console.warn);
        } catch (error) { console.warn("Baitlock auth sync unavailable", error); }
    };
    sync();
    window.addEventListener("storage", (event) => {
        if (event.key === "access_token" || event.key === null) sync();
    });
    window.addEventListener("message", (event) => {
        if (event.source !== window || event.origin !== location.origin) return;
        if (["BAITLOCK_LOGIN", "BAITLOCK_LOGOUT"].includes(event.data?.type)) sync();
    });
})();
