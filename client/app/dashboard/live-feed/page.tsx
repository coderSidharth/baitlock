"use client";
import { useEffect, useState } from "react";
import { Circle, ShieldAlert, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { API_V1_URL, type SecurityEvent } from "@/lib/api";

export default function LiveFeedPage() {
    const [events, setEvents] = useState<(Omit<SecurityEvent, "tier" | "created_at" | "type"> & { tier: string; time: string })[]>([]);
    const [pulse, setPulse] = useState(true);
    const [streamStatus, setStreamStatus] = useState<"connecting" | "active" | "offline">("connecting");

    useEffect(() => {
        const pulseInterval = setInterval(() => setPulse((p) => !p), 1000);

        const fetchEvents = () => {
            const token = localStorage.getItem('access_token');
            const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
            fetch(`${API_V1_URL}/events?limit=50`, { headers })
                .then(res => {
                    if (!res.ok) throw new Error(`Event stream returned ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (data?.events) {
                        setStreamStatus("active");
                        const formattedEvents = data.events.map((e: SecurityEvent) => {
                            const date = new Date(e.created_at);
                            const time = date.toLocaleTimeString('en-US', { hour12: false });

                            return {
                                id: e.id,
                                time: time,
                                tier: e.tier,
                                target: e.target,
                                verdict: e.verdict,
                                reasons: e.reasons || [],
                                score: e.score
                            };
                        });
                        setEvents(formattedEvents);
                    }
                })
                .catch(err => {
                    setStreamStatus("offline");
                    console.warn("Live feed fetch warning:", err?.message || err);
                });
        };

        fetchEvents();
        const pollInterval = setInterval(fetchEvents, 10000);

        return () => {
            clearInterval(pulseInterval);
            clearInterval(pollInterval);
        };
    }, []);

    const getTierConfig = (tier: string) => {
        switch(tier) {
            case "critical":
            case "high": return {
                icon: <ShieldAlert className="w-5 h-5 text-destructive" />,
                border: "border-destructive/25",
                tint: "bg-destructive/5",
                text: "text-destructive",
                label: tier === "critical" ? "CRITICAL THREAT" : "HIGH RISK"
            };
            case "moderate": return {
                icon: <AlertTriangle className="w-5 h-5 text-warning" />,
                border: "border-warning/25",
                tint: "bg-warning/5",
                text: "text-warning",
                label: "MODERATE RISK"
            };
            default: return {
                icon: <CheckCircle className="w-5 h-5 text-success" />,
                border: "border-success/25",
                tint: "bg-success/5",
                text: "text-success",
                label: "CLEAN"
            };
        }
    };

    return (
        <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">Live Feed</h1>
                    <p className="text-muted-foreground text-sm">Streaming analysis events as they are processed.</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50">
                    <Circle className={`w-2.5 h-2.5 ${streamStatus === "active" ? "fill-success text-success" : "fill-warning text-warning"} ${pulse ? 'opacity-100' : 'opacity-40'} transition-opacity`} />
                    <span className="text-sm font-medium" role="status">{streamStatus === "active" ? "Stream active" : streamStatus === "offline" ? "Stream offline — retrying" : "Connecting…"}</span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar pb-8">
                <div className="flex flex-col gap-3 max-w-full">
                    {events.length > 0 ? (
                        events.map((event) => {
                            const config = getTierConfig(event.tier);
                            return (
                                <div key={event.id} className={`w-full p-4 rounded-xl border ${config.border} ${config.tint} hover-lift flex flex-col md:flex-row gap-4 justify-between`}>
                                    <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            {config.icon}
                                            <h3 className="font-medium text-base truncate flex-1">{event.target}</h3>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm text-muted-foreground">
                                                <span className="font-medium text-foreground">Verdict:</span> {event.verdict}
                                            </p>
                                            {event.reasons.length > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="font-medium">Flags:</span> {event.reasons.join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="font-mono text-sm text-muted-foreground">{event.time}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-muted-foreground">Score: <strong className={config.text}>{event.score}</strong></span>
                                            <span className={`text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-md border ${config.border} ${config.text}`}>
                                                {config.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-12 rounded-xl border border-dashed border-border text-center flex flex-col items-center justify-center">
                            <span className="text-muted-foreground text-sm">Waiting for events...</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
