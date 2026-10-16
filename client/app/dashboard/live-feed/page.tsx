"use client";
import { useEffect, useState } from "react";
import { Circle, ShieldAlert, CheckCircle, AlertTriangle, Clock } from "lucide-react";

export default function LiveFeedPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [pulse, setPulse] = useState(true);

    useEffect(() => {
        const pulseInterval = setInterval(() => setPulse((p) => !p), 1000);
        
        const fetchEvents = () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const token = localStorage.getItem('access_token');
            const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
            fetch(`${apiUrl}/api/v1/events?limit=50`, { headers })
                .then(res => res.json())
                .then(data => {
                    if (data.events) {
                        const formattedEvents = data.events.map((e: any) => {
                            const date = new Date(e.created_at);
                            const time = date.toLocaleTimeString('en-US', { hour12: false });
                            let tier = "safe";
                            if (e.tier === "high" || e.tier === "critical") tier = "critical";
                            else if (e.tier === "moderate") tier = "warning";
                            
                            return {
                                id: e.id,
                                time: time,
                                tier: tier,
                                target: e.target,
                                verdict: e.verdict,
                                reasons: e.reasons || [],
                                score: e.score
                            };
                        });
                        setEvents(formattedEvents);
                    }
                })
                .catch(console.error);
        };

        fetchEvents();
        const pollInterval = setInterval(fetchEvents, 3000);

        return () => {
            clearInterval(pulseInterval);
            clearInterval(pollInterval);
        };
    }, []);

    const getTierConfig = (tier: string) => {
        switch(tier) {
            case "critical": return { 
                icon: <ShieldAlert className="w-5 h-5 text-red-400" />, 
                bg: "bg-[#1E0505]/90", 
                border: "border-red-500/20",
                text: "text-red-400",
                label: "CRITICAL THREAT"
            };
            case "warning": return { 
                icon: <AlertTriangle className="w-5 h-5 text-amber-400" />, 
                bg: "bg-[#1F1305]/90", 
                border: "border-amber-500/20",
                text: "text-amber-400",
                label: "MODERATE RISK"
            };
            default: return { 
                icon: <CheckCircle className="w-5 h-5 text-green-400" />, 
                bg: "bg-[#051F10]/90", 
                border: "border-green-500/20",
                text: "text-green-400",
                label: "CLEAN"
            };
        }
    };

    return (
        <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-10 pl-2 lg:pl-6 xl:pl-10">
                <h2 className="font-cormorant text-[48px] md:text-[64px] leading-14.5 md:leading-19.5 font-bold tracking-tight mb-4 md:mb-0">Live Feed</h2>
                <div className="flex items-center gap-2 mb-4 bg-white/5 px-4 py-2 rounded-full border border-white/10 shadow-lg">
                    <Circle className={`w-3 h-3 fill-green-400 text-green-400 ${pulse ? 'opacity-100' : 'opacity-40'} transition-opacity`} />
                    <span className="font-inter text-green-400 text-sm tracking-wide">Stream active</span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pl-2 lg:pl-6 xl:pl-10 pr-4 custom-scrollbar pb-8">
                <div className="flex flex-col gap-4 max-w-full">
                    {events.length > 0 ? (
                        events.map((event) => {
                            const config = getTierConfig(event.tier);
                            return (
                                <div key={event.id} className={`w-full p-5 rounded-[9px] border ${config.border} ${config.bg} backdrop-blur-sm shadow-xl transition-all hover:scale-[1.002] flex flex-col md:flex-row gap-4 justify-between`}>
                                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            {config.icon}
                                            <h3 className="font-inter font-medium text-lg text-white truncate flex-1">{event.target}</h3>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="font-inter text-white/70 text-sm">
                                                <span className="font-semibold text-white">Verdict:</span> {event.verdict}
                                            </p>
                                            {event.reasons.length > 0 && (
                                                <p className="font-inter text-white/50 text-xs">
                                                    <span className="font-semibold text-white/60">Flags:</span> {event.reasons.join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-white/40" />
                                            <span className="font-mono text-sm text-white/60">{event.time}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-inter text-sm text-white/40">Score: <strong className={config.text}>{event.score}</strong></span>
                                            <span className={`text-[10px] font-inter uppercase tracking-widest font-bold px-2.5 py-1 rounded-sm border ${config.border} ${config.text}`}>
                                                {config.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-10 rounded-[9px] border border-white/10 text-center flex flex-col items-center justify-center">
                            <span className="text-white/40 italic">Waiting for events...</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
