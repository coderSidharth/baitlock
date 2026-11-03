"use client";
import { useState, useEffect } from "react";
import { Ban, ShieldAlert, CheckCircle, Trash2 } from "lucide-react";
import { API_V1_URL } from "@/lib/api";

type DomainEntry = { domain?: string };
type FeedEvent = { id: string; target: string; tier: string; score: number; verdict: string };
type OverrideEntry = FeedEvent & { isExplicit?: boolean };

export default function OverridesPage() {
    const [activeTab, setActiveTab] = useState<'blocklist' | 'whitelist'>('blocklist');
    const [blockedEvents, setBlockedEvents] = useState<OverrideEntry[]>([]);
    const [whitelist, setWhitelist] = useState<OverrideEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
        Promise.all([
            fetch(`${API_V1_URL}/events?limit=50`, { headers }).then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
            fetch(`${API_V1_URL}/phishing/blocklist`, { headers }).then(r => r.ok ? r.json() : { blocklist: [] }).catch(() => ({ blocklist: [] })),
            fetch(`${API_V1_URL}/phishing/whitelist`, { headers }).then(r => r.ok ? r.json() : { whitelist: [] }).catch(() => ({ whitelist: [] }))
        ])
        .then(([eventsData, blocklistData, whitelistData]) => {
            // Build the set of whitelisted (trusted) domains so they are never shown
            // as blocked — a site marked safe must disappear from the blocklist.
            const whitelistDomains = new Set<string>(
                (whitelistData.whitelist || []).map((w: DomainEntry) => (w.domain || "").toLowerCase().replace(/\.$/, ""))
            );
            const hostOf = (target: string) => {
                try {
                    const u = new URL(target.includes("://") ? target : `http://${target}`);
                    return u.hostname.toLowerCase().replace(/\.$/, "");
                } catch {
                    return (target || "").toLowerCase().replace(/\.$/, "");
                }
            };
            const isWhitelisted = (target: string) => {
                const h = hostOf(target);
                for (const wd of whitelistDomains) {
                    if (wd && (h === wd || h.endsWith(`.${wd}`))) return true;
                }
                return false;
            };

            const blocked = (eventsData.events || []).filter(
                (e: FeedEvent) => (e.tier === "high" || e.tier === "critical") && !isWhitelisted(e.target)
            );

            const explicitBlocks = (blocklistData.blocklist || [])
                .filter((b: DomainEntry) => !whitelistDomains.has((b.domain || "").toLowerCase().replace(/\.$/, "")))
                .map((b: DomainEntry) => ({
                    id: `explicit_block_${b.domain}`,
                    target: b.domain,
                    tier: "critical",
                    score: 100,
                    verdict: "Blocked manually by user",
                    isExplicit: true
                }));

            setBlockedEvents([...explicitBlocks, ...blocked]);

            const explicitWhitelists = (whitelistData.whitelist || []).map((w: DomainEntry) => ({
                id: `explicit_white_${w.domain}`,
                target: w.domain,
                tier: "safe",
                score: 0,
                verdict: "Allowed by user",
                isExplicit: true
            }));

            setWhitelist(explicitWhitelists);
            setLoading(false);
        })
        .catch(err => {
            console.warn("Overrides load warning:", err?.message || err);
            setLoading(false);
        });
    }, []);

    return (
        <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">Overrides</h1>
                    <p className="text-muted-foreground text-sm">Manage domains you have explicitly blocked or trusted.</p>
                </div>

                <div className="inline-flex p-1 rounded-lg bg-muted border border-border">
                    <button
                        onClick={() => setActiveTab('blocklist')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'blocklist' ? 'bg-card text-foreground border border-border shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Blocklist ({blockedEvents.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('whitelist')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'whitelist' ? 'bg-card text-foreground border border-border shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Whitelist ({whitelist.length})
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar pb-8">
                <div className="flex flex-col gap-3 max-w-4xl">
                    {loading ? (
                        <div className="text-muted-foreground text-sm">Loading overrides...</div>
                    ) : activeTab === 'blocklist' ? (
                        blockedEvents.length > 0 ? (
                            blockedEvents.map((event) => (
                                <div key={event.id} className="surface-card hover-lift p-5">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Ban className="w-4 h-4 text-destructive shrink-0" />
                                            <h3 className="font-medium text-base truncate">{event.target}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full border border-destructive/30 text-destructive">
                                                {event.tier}
                                            </span>
                                            {event.isExplicit ? (
                                                <button
                                                  className="text-xs font-medium px-3 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-full transition-colors flex items-center gap-1"
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      fetch(`${API_V1_URL}/phishing/blocklist`, {
                                                        method: 'DELETE',
                                                        headers: {
                                                          'Content-Type': 'application/json',
                                                          ...(localStorage.getItem('access_token') ? { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } : {})
                                                        } as HeadersInit,
                                                        body: JSON.stringify({ domain: event.target })
                                                      }).then(() => {
                                                          alert("Removed from explicit blocklist!");
                                                          window.location.reload();
                                                      });
                                                  }}
                                                >
                                                    <Trash2 size={12} />
                                                    Remove
                                                </button>
                                            ) : (
                                              <button
                                                className="text-xs font-medium px-3 py-1 bg-success/10 hover:bg-success/20 text-success border border-success/30 rounded-full transition-colors flex items-center gap-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fetch(`${API_V1_URL}/phishing/whitelist`, {
                                                      method: 'POST',
                                                      headers: {
                                                        'Content-Type': 'application/json',
                                                        ...(localStorage.getItem('access_token') ? { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } : {})
                                                      } as HeadersInit,
                                                      body: JSON.stringify({ domain: event.target })
                                                    }).then(() => {
                                                        alert("Added to whitelist!");
                                                        window.location.reload();
                                                    });
                                                }}
                                              >
                                                  <CheckCircle size={12} />
                                                  Mark Safe
                                              </button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-muted-foreground text-sm"><span className="text-muted-foreground/70">Score:</span> <span className="font-semibold text-destructive">{event.score}/100</span> — {event.verdict}</p>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 rounded-xl border border-dashed border-border text-center flex flex-col items-center justify-center">
                                <ShieldAlert className="w-10 h-10 text-muted-foreground/50 mb-3" />
                                <h3 className="text-base font-medium mb-1">No Active Blocks</h3>
                                <p className="text-muted-foreground text-sm">Active Shield has not intercepted any critical threats yet.</p>
                            </div>
                        )
                    ) : (
                        whitelist.length > 0 ? (
                            whitelist.map((item) => (
                                <div key={item.id} className="surface-card hover-lift p-5">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <CheckCircle className="w-4 h-4 text-success shrink-0" />
                                            <h3 className="font-medium text-base truncate">{item.target}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full border border-success/30 text-success">
                                                TRUSTED
                                            </span>
                                            <button
                                              className="text-xs font-medium px-3 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-full transition-colors flex items-center gap-1"
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  fetch(`${API_V1_URL}/phishing/whitelist`, {
                                                    method: 'DELETE',
                                                    headers: {
                                                      'Content-Type': 'application/json',
                                                      ...(localStorage.getItem('access_token') ? { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } : {})
                                                    } as HeadersInit,
                                                    body: JSON.stringify({ domain: item.target })
                                                  }).then(() => {
                                                      alert("Removed from whitelist!");
                                                      window.location.reload();
                                                  });
                                              }}
                                            >
                                                <Trash2 size={12} />
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-muted-foreground text-sm"><span className="text-muted-foreground/70">Score:</span> <span className="font-semibold text-success">{item.score}/100</span> — Allowed by user</p>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 rounded-xl border border-dashed border-border text-center flex flex-col items-center justify-center">
                                <ShieldAlert className="w-10 h-10 text-muted-foreground/50 mb-3" />
                                <h3 className="text-base font-medium mb-1">No Whitelisted Sites</h3>
                                <p className="text-muted-foreground text-sm">You haven&apos;t manually trusted any blocked domains yet.</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </>
    );
}
