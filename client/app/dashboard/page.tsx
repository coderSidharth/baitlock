"use client";
import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, Ban, Trash2, Download, CreditCard, X, Play, RefreshCw, Zap } from "lucide-react";
import { API_V1_URL } from "@/lib/api";

export default function DashboardPage() {
  const [showLogs, setShowLogs] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('All');
  const [dbStatus, setDbStatus] = useState<'ok' | 'warning' | 'error'>('warning');
  const [llmStatus, setLlmStatus] = useState<'ok' | 'warning' | 'error'>('warning');

  // Fraud Simulation State
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudAmount, setFraudAmount] = useState("12500");
  const [fraudVelocity, setFraudVelocity] = useState("18");
  const [fraudHour, setFraudHour] = useState("3");
  const [fraudGeoDistance, setFraudGeoDistance] = useState("4500");
  const [fraudLoading, setFraudLoading] = useState(false);
  const [fraudResult, setFraudResult] = useState<any>(null);

  const averageScore = events.length > 0 ? Math.round(events.reduce((acc, evt) => acc + evt.score, 0) / events.length) : 100;
  const criticalEvents = events.filter(e => e.tier === 'critical' || e.tier === 'high');
  const filteredEvents = filterType === 'All' ? events : events.filter(e => e.type.toLowerCase() === filterType.toLowerCase());

  const fetchEvents = () => {
    let url = `${API_V1_URL}/events?limit=20`;
    if (filterType !== 'All') {
      url += `&type=${filterType.toLowerCase()}`;
    }
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    fetch(url, { headers })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.events) setEvents(data.events);
      })
      .catch(err => console.warn("Dashboard events fetch warning:", err?.message || err));
  };

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

  const handleSimulateFraud = async (e: React.FormEvent) => {
    e.preventDefault();
    setFraudLoading(true);
    setFraudResult(null);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_V1_URL}/fraud/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          transaction: {
            amount: parseFloat(fraudAmount) || 0,
            velocity: fraudVelocity !== "" ? parseInt(fraudVelocity, 10) : 1,
            hour: fraudHour !== "" ? parseInt(fraudHour, 10) : 12,
            geo_distance: fraudGeoDistance !== "" ? parseFloat(fraudGeoDistance) : 0
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        setFraudResult(data);
        fetchEvents();
      } else {
        alert("Failed to analyze transaction.");
      }
    } catch (err: any) {
      alert("Error scoring transaction: " + (err?.message || err));
    } finally {
      setFraudLoading(false);
    }
  };

  const applyPreset = (amount: string, velocity: string, hour: string, geo: string) => {
    setFraudAmount(amount);
    setFraudVelocity(velocity);
    setFraudHour(hour);
    setFraudGeoDistance(geo);
    setFraudResult(null);
  };

  useEffect(() => {
    // Check backend health
    fetch(`${API_V1_URL}/health`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setDbStatus(data.database === 'connected' ? 'ok' : 'error');
          setLlmStatus(data.status === 'healthy' ? 'ok' : 'warning');
        } else {
          setDbStatus('error');
          setLlmStatus('error');
        }
      })
      .catch(() => {
        setDbStatus('error');
        setLlmStatus('error');
      });

    fetchEvents();
  }, [filterType]);

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-10">
        <div>
          <h2 className="font-cormorant text-[48px] md:text-[64px] leading-14.5 md:leading-19.5 font-bold tracking-tight mb-1">Threat Matrix</h2>
          <p className="text-white/60 font-inter text-sm">Real-time behavioral telemetry, phishing signals, and fraud detection.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <button 
            onClick={() => { setShowFraudModal(true); setFraudResult(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-linear-to-r from-[#0048A6] to-[#00214D] text-white font-inter text-sm font-medium hover:brightness-125 transition-all border border-[#0055c4]/50 shadow-[0_0_15px_rgba(0,72,166,0.5)] cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-cyan-300" />
            Simulate Fraud Txn
          </button>
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
          <div className="grow surface-panel surface-panel-sheen p-6 flex flex-col relative overflow-hidden group">
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
          <div className="grow surface-panel p-6 relative overflow-hidden group flex flex-col">
            <h3 className="font-medium text-[24px] leading-7.5 tracking-tight relative z-10 mb-4">Module<br />Status</h3>
            <div className="my-auto flex flex-col gap-3 z-10 w-full">
              <StatusItem label="Ingestion" status={events.length > 0 ? "ok" : "warning"} />
              <StatusItem label="LLM Analysis" status={llmStatus} />
              <StatusItem label="Db Sync" status={dbStatus} />
            </div>
          </div>

          {/* Blocked Sites */}
          <div className="surface-panel p-5 relative overflow-hidden flex flex-col gap-3">
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
        <div className="lg:col-span-8 2xl:col-span-5 surface-panel p-5 lg:p-8 flex flex-col min-h-100 max-h-200">
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
        <div className="lg:col-span-12 2xl:col-span-4 surface-panel p-5 lg:p-8 flex flex-col">
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

      {/* Fraud Simulation Modal */}
      {showFraudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl surface-panel surface-panel-sheen p-6 md:p-8 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0048A6]/20 border border-[#0048A6]/40">
                  <CreditCard className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-cormorant font-bold text-2xl text-white">Transaction Fraud Simulator</h3>
                  <p className="text-white/50 font-inter text-xs">Simulate transaction parameters to test Layer 1 rules & Layer 2 ML anomaly detection.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFraudModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-6">
              {/* Presets */}
              <div>
                <label className="block text-xs font-mono uppercase text-white/50 mb-2">Quick Presets</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button 
                    type="button"
                    onClick={() => applyPreset("15000", "18", "3", "3500")}
                    className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-red-400">Critical: Exceeds Limit</div>
                    <div className="text-white/50 font-mono text-[10px] mt-0.5">$15k • 18 txns • 3 AM</div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => applyPreset("350", "2", "23", "5500")}
                    className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-amber-300">High: Geo-Velocity</div>
                    <div className="text-white/50 font-mono text-[10px] mt-0.5">$350 • 2 txns • 5,500 mi</div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => applyPreset("42.50", "1", "14", "8")}
                    className="p-2.5 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-green-400">Safe: Normal Purchase</div>
                    <div className="text-white/50 font-mono text-[10px] mt-0.5">$42.50 • 1 txn • 8 mi</div>
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSimulateFraud} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Transaction Amount ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={fraudAmount} 
                      onChange={(e) => setFraudAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
                      placeholder="e.g. 150.00"
                    />
                    <span className="text-[10px] text-white/40 block mt-0.5">Hard limit rule triggers above $10,000</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Velocity (txns in last hour)</label>
                    <input 
                      type="number" 
                      value={fraudVelocity} 
                      onChange={(e) => setFraudVelocity(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
                      placeholder="e.g. 2"
                    />
                    <span className="text-[10px] text-white/40 block mt-0.5">Frequent attempts trigger velocity rules</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Hour of Day (0–23)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="23"
                      value={fraudHour} 
                      onChange={(e) => setFraudHour(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
                      placeholder="e.g. 14"
                    />
                    <span className="text-[10px] text-white/40 block mt-0.5">Off-hours (2:00–4:00 AM) increase anomaly score</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Geo Distance (miles from home)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={fraudGeoDistance} 
                      onChange={(e) => setFraudGeoDistance(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
                      placeholder="e.g. 25.0"
                    />
                    <span className="text-[10px] text-white/40 block mt-0.5">&gt; 5,000 miles triggers impossible travel</span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={fraudLoading}
                  className="w-full py-2.5 rounded-lg bg-linear-to-r from-[#0048A6] to-[#00214D] hover:brightness-125 text-white font-inter text-sm font-semibold flex items-center justify-center gap-2 transition-all border border-cyan-500/30 shadow-[0_0_15px_rgba(0,150,255,0.3)] cursor-pointer disabled:opacity-50"
                >
                  {fraudLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Evaluating Neural Models...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-cyan-300" />
                      Evaluate Transaction Risk
                    </>
                  )}
                </button>
              </form>

              {/* Result Display */}
              {fraudResult && (
                <div className="p-4 rounded-xl border border-white/15 bg-black/40 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase font-mono text-white/50">Assessment Verdict</div>
                      <div className="text-xl font-bold font-cormorant text-white flex items-center gap-2">
                        {fraudResult.verdict}
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                          fraudResult.tier === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                          fraudResult.tier === 'high' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          fraudResult.tier === 'moderate' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                          'bg-green-500/20 text-green-400 border-green-500/40'
                        }`}>
                          {fraudResult.tier}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-mono text-white/50">Security Score</div>
                      <div className={`text-2xl font-mono font-bold ${
                        fraudResult.final_score < 30 ? 'text-red-400' :
                        fraudResult.final_score < 70 ? 'text-amber-300' : 'text-green-400'
                      }`}>
                        {fraudResult.final_score}/100
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white/5 p-2 rounded-lg border border-white/5">
                    <div>Rule Score: <span className="text-cyan-300 font-bold">{fraudResult.breakdown?.rule_score}/100</span></div>
                    <div>ML Score: <span className="text-cyan-300 font-bold">{fraudResult.breakdown?.ml_score}/100</span></div>
                  </div>

                  {fraudResult.reasons && fraudResult.reasons.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-white/60 mb-1">Triggered Indicators:</div>
                      <ul className="space-y-1">
                        {fraudResult.reasons.map((r: string, idx: number) => (
                          <li key={idx} className="text-xs font-inter text-red-300/90 flex items-start gap-1.5">
                            <span className="text-red-400 font-mono">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setFilterType('Fraud');
                        setShowFraudModal(false);
                      }}
                      className="text-xs font-medium px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    >
                      View in Threat Matrix
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
  const accent = type === 'phishing'
    ? { border: 'border-red-500/30', dot: 'bg-red-400', text: 'text-red-300' }
    : type === 'fraud'
    ? { border: 'border-amber-500/30', dot: 'bg-amber-400', text: 'text-amber-300' }
    : { border: 'border-white/8', dot: 'bg-emerald-400', text: 'text-emerald-300' };

  return (
    <div className={`surface-card hover-lift p-6 cursor-pointer group ${accent.border}`}>
      <div className="flex justify-between items-start mb-4">
        <h4 className="font-inter font-medium text-[20px] leading-6 text-white tracking-tight flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${accent.dot} shadow-[0_0_8px_currentColor]`} />
          {label}
        </h4>
      </div>
      <div className="font-mono text-[14px] leading-5 tracking-tight text-white mb-6 underline decoration-white/20 underline-offset-4 group-hover:text-[#a5c7fc] group-hover:decoration-[#a5c7fc]/50 transition-colors break-all opacity-90">{domain}</div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center bg-black/50 rounded-md border border-white/8 px-2.5 py-1 shadow-inner mr-2">
          <span className="font-mono text-lg font-bold text-white mr-2">{score}</span>
          <span className="text-[10px] text-white/60 font-inter uppercase tracking-widest leading-none mt-0.5">Score</span>
        </div>
        {tags.map((tag, i) => (
          <span key={i} className={`font-mono text-[13px] px-2 py-0.5 rounded-md bg-black/40 border border-white/10 ${accent.text} whitespace-nowrap`}>
            [!] {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
