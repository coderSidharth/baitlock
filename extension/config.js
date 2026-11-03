// Baitlock extension configuration — the single place to point the extension
// at your deployment. For a production deployment set both values to your
// HTTPS URLs AND update manifest.json:
//   - "host_permissions"           -> your API origin (e.g. "https://api.example.com/*")
//   - "content_scripts[0].matches" -> your dashboard origin (e.g. "https://app.example.com/*")
const BAITLOCK_CONFIG = {
    // Backend API base (FastAPI, including the /api/v1 prefix).
    API_BASE: "http://localhost:8000/api/v1",
    // Dashboard web app origin (hosts the block page at "/?blocked=true").
    APP_ORIGIN: "http://localhost:3000",
};

// True when `url` belongs to the Baitlock dashboard itself. Compares origins
// exactly (substring checks would let "https://evil.example/?x=localhost:3000"
// skip scanning). "localhost" and "127.0.0.1" are treated as the same host.
function baitlockIsAppUrl(url) {
    try {
        const u = new URL(url);
        const app = new URL(BAITLOCK_CONFIG.APP_ORIGIN);
        const norm = (h) => (h === "127.0.0.1" ? "localhost" : h);
        return u.protocol === app.protocol && norm(u.hostname) === norm(app.hostname) && u.port === app.port;
    } catch (e) {
        return false;
    }
}
