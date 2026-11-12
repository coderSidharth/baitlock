(async () => {
    const status = document.getElementById("status");
    const destination = document.getElementById("destination");
    let targetUrl;

    try {
        targetUrl = new URL(new URLSearchParams(window.location.search).get("url"));
        if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") throw new Error("Unsupported URL");
    } catch {
        status.textContent = "The destination URL is invalid. Close this tab and try again.";
        document.querySelector(".spinner").hidden = true;
        return;
    }

    destination.textContent = targetUrl.href;

    const notifyBackground = async (data, reason) => {
        try {
            const result = await chrome.runtime.sendMessage({
                type: "BAITLOCK_SCAN_COMPLETE",
                targetUrl: targetUrl.href,
                data,
                reason,
            });
            if (!result?.ok) throw new Error("Navigation was not completed");
        } catch {
            status.textContent = "Unable to finish. You can close this tab and try again.";
            document.querySelector(".spinner").hidden = true;
        }
    };

    const allowManualContinue = (reason) => {
        status.textContent = reason === "not-authenticated"
            ? "Sign in to scan this site. The destination is being held until you choose to continue."
            : "The scan could not be completed. The destination is being held until you choose to continue.";
        document.querySelector(".spinner").hidden = true;
        const button = document.getElementById("continue");
        button.hidden = false;
        button.addEventListener("click", () => {
            button.disabled = true;
            status.textContent = "Opening the destination…";
            notifyBackground(null, "user-continued");
        }, { once: true });
    };

    const release = async (data) => {
        status.textContent = "Scan complete. Opening the destination…";
        await notifyBackground(data, "scan-complete");
    };

    try {
        const { baitlock_token: token } = await chrome.storage.local.get(["baitlock_token"]);
        if (!baitlockTokenValid(token)) {
            allowManualContinue("not-authenticated");
            return;
        }

        status.textContent = "Analyzing the destination…";
        const response = await fetch(`${BAITLOCK_CONFIG.API_BASE}/phishing/check`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ url: targetUrl.href, fast_mode: true }),
            signal: AbortSignal.timeout(15000),
        });
        if (response.status === 401) await chrome.storage.local.remove("baitlock_token");
        if (!response.ok) {
            allowManualContinue("scan-failed");
            return;
        }
        const data = await response.json();
        if (!data || !["safe", "moderate", "high", "critical"].includes(data.tier) || !Number.isFinite(data.final_score)) {
            allowManualContinue("scan-failed");
            return;
        }
        await release(data);
    } catch {
        allowManualContinue("scan-failed");
    }
})();
