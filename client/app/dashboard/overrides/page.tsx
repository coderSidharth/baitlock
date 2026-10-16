"use client";
import { useState, useEffect } from "react";
import { Ban, ShieldAlert, CheckCircle, Trash2 } from "lucide-react";

export default function OverridesPage() {
    const [activeTab, setActiveTab] = useState<'blocklist' | 'whitelist'>('blocklist');
    const [blockedEvents, setBlockedEvents] = useState<any[]>([]);
    const [whitelist, setWhitelist] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
        Promise.all([
            fetch("http://localhost:8000/api/v1/events?limit=50", { headers }).then(r => r.json()),
            fetch("http://localhost:8000/api/v1/phishing/blocklist", { headers }).then(r => r.json()),
            fetch("http://localhost:8000/api/v1/phishing/whitelist", { headers }).then(r => r.json())
        ])
        .then(([eventsData, blocklistData, whitelistData]) => {
            const blocked = (eventsData.events || []).filter((e: any) => e.tier === "high" || e.tier === "critical");
            
            const explicitBlocks = (blocklistData.blocklist || []).map((b: any) => ({
                id: `explicit_block_${b.domain}`,
                target: b.domain,
                tier: "critical",
                score: 100,
                verdict: "Blocked manually by user",
                isExplicit: true
            }));
            
            setBlockedEvents([...explicitBlocks, ...blocked]);

            const explicitWhitelists = (whitelistData.whitelist || []).map((w: any) => ({
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
            console.error(err);
            setLoading(false);
        });
    }, []);

    return (
        <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-10 pl-2 lg:pl-6 xl:pl-10">
                <h2 className="font-cormorant text-[48px] md:text-[64px] leading-14.5 md:leading-19.5 font-bold tracking-tight mb-4 md:mb-0">Overrides</h2>
                
                <div className="flex bg-[#001C40] p-1 rounded-[9px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
                    <button 
                        onClick={() => setActiveTab('blocklist')}
                        className={`px-6 py-2 rounded-md font-inter text-[14px] font-medium transition-all ${activeTab === 'blocklist' ? 'bg-[#0048A6] text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]' : 'text-white/50 hover:text-white'}`}
                    >
                        Blocklist ({blockedEvents.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('whitelist')}
                        className={`px-6 py-2 rounded-md font-inter text-[14px] font-medium transition-all ${activeTab === 'whitelist' ? 'bg-[#0048A6] text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]' : 'text-white/50 hover:text-white'}`}
                    >
                        Whitelist ({whitelist.length})
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pl-2 lg:pl-6 xl:pl-10 pr-4 custom-scrollbar pb-8">
                <div className="flex flex-col gap-4 max-w-4xl">
                    {loading ? (
                        <div className="text-white/40 italic">Loading overrides...</div>
                    ) : activeTab === 'blocklist' ? (
                        blockedEvents.length > 0 ? (
                            blockedEvents.map((event) => (
                                <div key={event.id} className="p-6 rounded-[9px] border border-red-500/40 bg-red-500/5 backdrop-blur-sm shadow-xl transition-all hover:scale-[1.005] cursor-pointer"
                                    style={{ background: "radial-gradient(100% 150% at 50% 50%, #3C3C3C 0%, #28292B 60%, #1E2022 100%)" }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <Ban className="w-5 h-5 text-red-400" />
                                            <h3 className="font-inter font-medium text-lg text-white max-w-xl truncate">{event.target}</h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-inter uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-red-500/40 text-red-400">
                                                {event.tier}
                                            </span>
                                            {event.isExplicit ? (
                                                <button 
                                                  className="text-xs font-medium px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 rounded-full transition-colors flex items-center gap-1"
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      fetch(`http://localhost:8000/api/v1/phishing/blocklist`, {
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
                                                className="text-xs font-medium px-3 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 border border-green-500/30 rounded-full transition-colors flex items-center gap-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fetch(`http://localhost:8000/api/v1/phishing/whitelist`, {
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
                                    <div className="flex flex-col gap-2">
                                        <p className="font-inter text-white/70 text-sm"><span className="text-white/40">Score:</span> <span className="font-bold text-red-400">{event.score}/100</span> — {event.verdict}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-10 rounded-[9px] border border-white/10 text-center flex flex-col items-center justify-center">
                                <ShieldAlert className="w-12 h-12 text-white/20 mb-4" />
                                <h3 className="text-xl font-medium text-white/60 mb-2">No Active Blocks</h3>
                                <p className="text-white/40 text-sm">Active Shield has not intercepted any critical threats yet.</p>
                            </div>
                        )
                    ) : (
                        whitelist.length > 0 ? (
                            whitelist.map((item) => (
                                <div key={item.id} className="p-6 rounded-[9px] border border-green-500/40 bg-green-500/5 backdrop-blur-sm shadow-xl transition-all hover:scale-[1.005] cursor-pointer"
                                    style={{ background: "radial-gradient(100% 150% at 50% 50%, #1A2E20 0%, #122116 60%, #0A130C 100%)" }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                            <h3 className="font-inter font-medium text-lg text-white max-w-xl truncate">{item.target}</h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-inter uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-green-500/40 text-green-400">
                                                TRUSTED
                                            </span>
                                            <button 
                                              className="text-xs font-medium px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 rounded-full transition-colors flex items-center gap-1"
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  fetch(`http://localhost:8000/api/v1/phishing/whitelist`, {
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
                                    <div className="flex flex-col gap-2">
                                        <p className="font-inter text-white/70 text-sm"><span className="text-white/40">Score:</span> <span className="font-bold text-green-400">{item.score}/100</span> — Allowed by user</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-10 rounded-[9px] border border-white/10 text-center flex flex-col items-center justify-center">
                                <ShieldAlert className="w-12 h-12 text-white/20 mb-4" />
                                <h3 className="text-xl font-medium text-white/60 mb-2">No Whitelisted Sites</h3>
                                <p className="text-white/40 text-sm">You haven't manually trusted any blocked domains yet.</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </>
    );
}
