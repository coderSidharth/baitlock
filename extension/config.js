// Generated release packages replace these origins using scripts/build_extension.py.
(() => {
    const config = Object.freeze({
        ENVIRONMENT: "development",
        API_BASE: "http://localhost:8000/api/v1",
        APP_ORIGIN: "http://localhost:3000",
    });
    for (const value of [config.API_BASE, config.APP_ORIGIN]) {
        const url = new URL(value);
        const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        if (url.username || url.password || url.search || url.hash ||
            (url.protocol !== "https:" && !(config.ENVIRONMENT === "development" && local && url.protocol === "http:"))) {
            throw new Error("Baitlock requires HTTPS outside local development.");
        }
    }
    globalThis.BAITLOCK_CONFIG = config;
    globalThis.baitlockIsAppUrl = (value) => {
        try {
            const url = new URL(value);
            const app = new URL(config.APP_ORIGIN);
            const normalize = (host) => host === "127.0.0.1" ? "localhost" : host;
            return url.protocol === app.protocol && normalize(url.hostname) === normalize(app.hostname) && url.port === app.port;
        } catch { return false; }
    };
    globalThis.baitlockTokenValid = (token) => {
        try {
            if (typeof token !== "string" || token.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return false;
            const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(atob(part));
            return Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now();
        } catch { return false; }
    };
})();
