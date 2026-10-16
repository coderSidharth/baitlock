"use client";
import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, Ban, Trash2, Download } from "lucide-react";

export default function DashboardPage() {
  const [showLogs, setShowLogs] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('All');

  const averageScore = events.length > 0 ? Math.round(events.reduce((acc, evt) => acc + evt.score, 0) / events.length) : 100;
  const criticalEvents = events.filter(e => e.tier === 'critical' || e.tier === 'high');
  const filteredEvents = filterType === 'All' ? events : events.filter(e => e.type.toLowerCase() === filterType.toLowerCase());

  const handleClearLogs = () => {
    setEvents([]);
    setShowLogs(false);
  };

  const handleExportLogs = () => {
    if (events.length === 0) {
      alert("No logs to export.");
      return;
    }
    const jsonString = JSON.stringify(events, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `baitlock-logs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    let url = `${apiUrl}/api/v1/events?limit=10`;
    if (filterType !== 'All') {
      url += `&type=${filterType.toLowerCase()}`;
    }
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    fetch(url, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.events) setEvents(data.events);
      })
      .catch(console.error);
  }, [filterType]);

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-10">
        <h2 className="font-cormorant text-[48px] md:text-[64px] leading-14.5 md:leading-19.5 font-bold tracking-tight mb-4 md:mb-0">Threat Matrix</h2>
        <div className="flex items-center gap-4 mb-4">
          {!showLogs ? (
            <button onClick={() => setShowLogs(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-linear-to-r from-[#003882] to-[#0048A6] text-white font-inter text-sm font-medium hover:brightness-110 transition-all border border-white/10 shadow-[0_0_12px_rgba(0,30,100,0.4)] cursor-pointer">
              Restore logs
            </button>
          ) : (
            <button onClick={handleClearLogs} className="flex items-center gap-2 px-4 py-2 rounded-md bg-linear-to-b from-[#2a1010]/80 to-[#1a0808]/80 text-red-400 font-inter text-sm font-medium hover:text-red-300 hover:brightness-110 transition-all border border-red-500/20 cursor-pointer">
              <Trash2 className="w-4 h-4" />
              Clear logs
            </button>
          )}
          <button onClick={handleExportLogs} className="flex items-center gap-2 px-4 py-2 rounded-md bg-linear-to-b from-[#1C1F2B]/80 to-[#12141A]/80 text-white font-inter text-sm font-medium hover:brightness-110 transition-all border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] cursor-pointer">
            <Download className="w-4 h-4" />
            Export logs
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 min-h-0 overflow-y-auto custom-scrollbar pb-10">
        {/* Left Column */}
        <div className="lg:col-span-4 2xl:col-span-3 flex flex-col gap-6">

          {/* Pipeline Health */}
          <div className="grow rounded-[9px] p-6 flex flex-col relative overflow-hidden group shadow-xl"
            style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}>
            <h3 className="font-medium text-[24px] leading-7.5 tracking-tight relative z-10">Avg Security<br />Score</h3>
            <div className="my-auto relative z-10 flex flex-col items-center w-full mt-4">
              <div className="font-cormorant text-[42px] leading-10.5 font-bold">{averageScore}%</div>
              <div className="h-3 w-full rounded-[9px] bg-linear-to-r from-[#414141] to-[#1E2022] relative overflow-hidden mt-4 shadow-inner">
                <div className="h-full bg-linear-to-r from-[#0048A6] to-[#001C40] rounded-[9px] transition-all duration-1000 ease-out relative" style={{ width: `${averageScore}%` }}>
                  <div className="absolute inset-0 bg-white/20 w-1/2 blur-sm skew-x-12 translate-x-full animate-shine" />
                </div>
              </div>
            </div>
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#0048A6]/20 blur-2xl rounded-full" />
          </div>

          {/* Module Status */}
          <div className="grow rounded-[9px] p-6 relative overflow-hidden group shadow-xl flex flex-col"
            style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}>
            <h3 className="font-medium text-[24px] leading-7.5 tracking-tight relative z-10 mb-4">Module<br />Status</h3>
            <div className="my-auto flex flex-col gap-3 z-10 w-full">
              <StatusItem label="Ingestion" status={events.length > 0 ? "ok" : "warning"} />
              <StatusItem label="LLM Analysis" status="ok" />
              <StatusItem label="Db Sync" status="ok" />
            </div>
          </div>

          {/* Blocked Sites */}
          <div className="rounded-[9px] p-5 relative overflow-hidden shadow-xl flex flex-col gap-3"
            style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}>
            <h3 className="font-medium text-[18px] leading-5.5 tracking-tight relative z-10 flex items-center gap-2 mb-2">
              <Ban className="w-5 h-5 text-red-400" />
              Blocked Sites
            </h3>
            <div className="flex flex-col gap-2 z-10 w-full">
              {events
                .filter(e => e.tier === "high" || e.tier === "critical")
                .slice(0, 3)
                .map(event => (
                  <BlockedSite key={event.id} domain={event.target} reason={event.type.toUpperCase()} />
              ))}
              {events.filter(e => e.tier === "high" || e.tier === "critical").length === 0 && (
                <div className="text-white/40 text-[13px] font-inter italic py-2 text-center">No blocks recently</div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column - AI Forecast */}
        <div className="lg:col-span-8 2xl:col-span-5 rounded-[9px] p-5 lg:p-8 flex flex-col shadow-xl min-h-100 max-h-200"
          style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 shrink-0">
            <h3 className="font-cormorant font-bold text-[28px] leading-8.5 tracking-tight">AI Forecast</h3>
            <div className="flex flex-wrap gap-4 sm:gap-2">
              <div className="relative flex justify-center">
                <button onClick={() => setFilterType('All')} className={`px-3 transition-colors text-[18px] sm:text-[20px] leading-6 relative z-10 ${filterType === 'All' ? 'text-white' : 'text-white/50 hover:text-white'}`}>All</button>
                {filterType === 'All' && <div className="absolute -bottom-2 w-full h-0.5 bg-white rounded shadow-[0_0_8px_white]"></div>}
              </div>
              <div className="relative flex justify-center">
                <button onClick={() => setFilterType('Phishing')} className={`px-3 transition-colors text-[18px] sm:text-[20px] leading-6 relative z-10 ${filterType === 'Phishing' ? 'text-white' : 'text-white/50 hover:text-white'}`}>Phishing</button>
                {filterType === 'Phishing' && <div className="absolute -bottom-2 w-full h-0.5 bg-white rounded shadow-[0_0_8px_white]"></div>}
              </div>
              <div className="relative flex justify-center">
                <button onClick={() => setFilterType('Fraud')} className={`px-3 transition-colors text-[18px] sm:text-[20px] leading-6 relative z-10 ${filterType === 'Fraud' ? 'text-white' : 'text-white/50 hover:text-white'}`}>Fraud</button>
                {filterType === 'Fraud' && <div className="absolute -bottom-2 w-full h-0.5 bg-white rounded shadow-[0_0_8px_white]"></div>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto pr-3 -mr-3 custom-scrollbar flex-1">
            {showLogs ? (
              filteredEvents.length > 0 ? filteredEvents.map(evt => (
                <FeedCard 
                  key={evt.id}
                  label={evt.type === 'phishing' ? 'URL Scan' : 'Txn Fraud'} 
                  domain={evt.target} 
                  score={evt.score} 
                  tags={evt.reasons || [evt.verdict]} 
                  type={evt.type} 
                />
              )) : (
                <div className="flex-1 flex items-center justify-center text-white/30 font-inter text-lg h-32">
                  No events recorded yet.
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/30 font-inter text-lg h-32">
                Logs cleared. Click &quot;Restore logs&quot; to view again.
              </div>
            )}
          </div>
        </div>

        {/* Right Column - AI Insight */}
        <div className="lg:col-span-12 2xl:col-span-4 rounded-[9px] p-5 lg:p-8 flex flex-col shadow-xl"
          style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}>
          <h3 className="font-cormorant font-bold text-[28px] leading-8.5 tracking-tight mb-8">AI Insight</h3>
          <div className="flex-1 flex flex-col gap-6 relative">
            {showLogs ? (
              <div className="font-inter space-y-6 text-white leading-relaxed text-lg">
                {criticalEvents.length > 0 ? (
                  <>
                    <p>The neural model has intercepted <strong>{criticalEvents.length} severe threat(s)</strong> recently, including highly suspicious activity originating from <span className="text-red-400 font-mono text-[15px] break-all border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 rounded block sm:inline mt-1 sm:mt-0">{criticalEvents[0].target}</span>.</p>
                    <div className="p-5 sm:p-6 rounded-[9px] border border-white/20 bg-[#1E2022]/40 backdrop-blur-md shadow-lg shadow-black/20">
                      <h4 className="text-white font-medium mb-3 flex items-center gap-2 text-lg sm:text-xl">
                        <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                        Recommended Action
                      </h4>
                      <p className="text-sm sm:text-base text-white/80">Avoid interacting with <strong className="break-all">{criticalEvents[0].target}</strong>. We recommend navigating to your Blocklist to ensure this domain is permanently restricted from your network.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Your network traffic is currently <strong>clean and stable</strong>. No critical threats have been detected in recent sessions.</p>
                    <div className="p-5 sm:p-6 rounded-[9px] border border-white/20 bg-[#1E2022]/40 backdrop-blur-md shadow-lg shadow-black/20">
                      <h4 className="text-white font-medium mb-3 flex items-center gap-2 text-lg sm:text-xl">
                        <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 shrink-0" />
                        All Clear
                      </h4>
                      <p className="text-sm sm:text-base text-white/80">Continue normal browsing. The AI shield remains active in the background to automatically intercept anomalies.</p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/30 font-inter text-lg">
                Insights cleared.
              </div>
            )}
            <div className="mt-8 bg-[#001C40]/50 p-5 sm:p-6 rounded-[9px] border border-[#0048A6]/30">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 sm:mb-2">
                <span className="font-mono text-sm text-white/60">System Integrity</span>
                <span className="font-mono text-xl text-green-400 font-bold">{Math.max(0, 100 - (criticalEvents.length * 2))}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#1E2022] rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full shadow-[0_0_10px_#22c55e] transition-all duration-1000" style={{ width: `${Math.max(0, 100 - (criticalEvents.length * 2))}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusItem({ label, status }: { label: string, status: "ok" | "warning" | "error" }) {
  const colors = {
    ok: "text-green-400 border-green-500/20 bg-green-500/5",
    warning: "text-amber-400 border-amber-500/20 bg-amber-500/5",
    error: "text-red-400 border-red-500/20 bg-red-500/5",
  };
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-[9px] border backdrop-blur-sm ${colors[status]} shadow-lg transition-transform hover:scale-[1.02]`}>
      <span className="font-medium text-[13px] text-white/90 font-inter tracking-wide">{label}</span>
      <CheckCircle className="w-4 h-4 shadow-inner" />
    </div>
  );
}

function BlockedSite({ domain, reason }: { domain: string, reason: string }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-md border border-red-500/15 bg-red-500/5 backdrop-blur-sm">
      <span className="font-mono text-[13px] text-white/80 truncate">{domain}</span>
      <span className="font-inter text-[11px] text-red-400 uppercase tracking-wider font-medium shrink-0 ml-2">{reason}</span>
    </div>
  );
}

function FeedCard({ label, domain, score, tags, type }: { label: string, domain: string, score: number, tags: string[], type: string }) {
  const bgStyle = { background: "radial-gradient(100% 150% at 50% 50%, #3C3C3C 0%, #28292B 60%, #1E2022 100%)" };
  const borderColor = type === 'phishing' ? 'border-red-500/30' : type === 'fraud' ? 'border-amber-500/30' : 'border-white/5';

  return (
    <div className={`p-6 rounded-[9px] border hover:border-white/30 transition-all cursor-pointer group shadow-xl ${borderColor}`} style={bgStyle}>
      <div className="flex justify-between items-start mb-4">
        <h4 className="font-inter font-medium text-[20px] leading-6 text-white tracking-tight">{label}</h4>
      </div>
      <div className="font-mono text-[14px] leading-5 tracking-tight text-white mb-6 underline hover:text-[#a5c7fc] transition-colors break-all opacity-90">{domain}</div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center bg-[#111111]/90 rounded border border-white/5 px-2 py-0.5 shadow-inner mr-2">
          <span className="font-mono text-lg font-bold text-white mr-2">{score}</span>
          <span className="text-[10px] text-white/60 font-inter uppercase tracking-widest leading-none mt-0.5">Score</span>
        </div>
        {tags.map((tag, i) => (
          <span key={i} className="font-mono text-[14px] px-2 py-0.5 rounded bg-black/40 border border-white/10 text-white/80 whitespace-nowrap">
            [!] {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
