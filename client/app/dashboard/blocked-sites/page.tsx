"use client";
import { Ban, Trash2 } from "lucide-react";
import { useState } from "react";

const initialBlockedSites = [
    { id: 1, domain: "paypa1-login.tk", reason: "Phishing", blockedAt: "15:26:04" },
    { id: 2, domain: "update-secure-auth.com", reason: "Malware", blockedAt: "15:22:19" },
    { id: 3, domain: "free-prize-claim.xyz", reason: "Scam", blockedAt: "14:58:33" },
    { id: 4, domain: "cdn-static-res.ru", reason: "C2 Server", blockedAt: "14:41:07" },
    { id: 5, domain: "login-verify-account.tk", reason: "Phishing", blockedAt: "14:12:55" },
];

export default function BlockedSitesPage() {
    const [sites, setSites] = useState(initialBlockedSites);

    const removeSite = (id: number) => {
        setSites(sites.filter(s => s.id !== id));
    };

    return (
        <>
            <header className="flex justify-between items-end mb-10 pl-6 xl:pl-10">
                <h2 className="font-cormorant text-[64px] leading-[78px] font-bold tracking-tight">Blocked Sites</h2>
                <span className="font-inter text-white/50 text-sm mb-4">{sites.length} sites blocked</span>
            </header>

            <div className="flex-1 overflow-y-auto pl-6 xl:pl-10 pr-4 custom-scrollbar">
                <div className="flex flex-col gap-3">
                    {sites.map((site) => (
                        <div key={site.id} className="flex items-center justify-between p-5 rounded-[9px] border border-red-500/15 bg-red-500/5 backdrop-blur-sm shadow-xl transition-all hover:border-red-500/30">
                            <div className="flex items-center gap-4">
                                <Ban className="w-5 h-5 text-red-400 shrink-0" />
                                <div>
                                    <span className="font-mono text-[15px] text-white">{site.domain}</span>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="font-inter text-[11px] text-red-400 uppercase tracking-wider font-bold">{site.reason}</span>
                                        <span className="font-mono text-[11px] text-white/30">blocked at {site.blockedAt}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => removeSite(site.id)} className="text-white/20 hover:text-white/60 transition-colors cursor-pointer p-2">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {sites.length === 0 && (
                        <div className="flex items-center justify-center text-white/30 font-inter text-lg py-20">
                            No blocked sites.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
