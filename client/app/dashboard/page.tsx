"use client";
import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, Ban, Trash2, Download, CreditCard, X, RefreshCw, Zap } from "lucide-react";
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
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">Threat Matrix</h1>
          <p className="text-muted-foreground text-sm">Real-time behavioral telemetry, phishing signals, and fraud detection.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setShowFraudModal(true); setFraudResult(null); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg btn-primary text-sm font-medium cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            Simulate Fraud Txn
          </button>
          {!showLogs ? (
            <button onClick={() => setShowLogs(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg btn-secondary text-sm font-medium cursor-pointer">
              Restore logs
            </button>
          ) : (
            <button onClick={handleClearLogs} className="flex items-center gap-2 px-3.5 py-2 rounded-lg btn-secondary text-sm font-medium text-destructive hover:text-destructive cursor-pointer">
              <Trash2 className="w-4 h-4" />
              Clear logs
            </button>
          )}
          <button onClick={handleExportLogs} className="flex items-center gap-2 px-3.5 py-2 rounded-lg btn-secondary text-sm font-medium cursor-pointer">
            <Download className="w-4 h-4" />
            Export logs
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto custom-scrollbar pb-10">
        {/* Left Column */}
        <div className="lg:col-span-4 2xl:col-span-3 flex flex-col gap-5">

          {/* Avg Security Score */}
          <div className="surface-panel p-6 flex flex-col">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Avg Security Score</h3>
            <div className="mt-4 flex flex-col">
              <div className="text-4xl font-semibold tracking-tight">{averageScore}<span className="text-xl text-muted-foreground">%</span></div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-4">
                <div className="h-full bg-primary rounded-full transition-all duration-700 ease-out" style={{ width: `${averageScore}%` }} />
              </div>
            </div>
          </div>

          {/* Module Status */}
          <div className="surface-panel p-6 flex flex-col">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Module Status</h3>
            <div className="flex flex-col gap-2 w-full">
              <StatusItem label="Ingestion" status={events.length > 0 ? "ok" : "warning"} />
              <StatusItem label="LLM Analysis" status={llmStatus} />
              <StatusItem label="Db Sync" status={dbStatus} />
            </div>
          </div>

          {/* Blocked Sites */}
          <div className="surface-panel p-5 flex flex-col gap-3">
            <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
              <Ban className="w-4 h-4 text-destructive" />
              Blocked Sites
            </h3>
            <div className="flex flex-col gap-2 w-full">
              {events
                .filter(e => e.tier === "high" || e.tier === "critical")
                .slice(0, 3)
                .map(event => (
                  <BlockedSite key={event.id} domain={event.target} reason={event.type.toUpperCase()} />
              ))}
              {events.filter(e => e.tier === "high" || e.tier === "critical").length === 0 && (
                <div className="text-muted-foreground text-[13px] py-2 text-center">No blocks recently</div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column - AI Forecast */}
        <div className="lg:col-span-8 2xl:col-span-5 surface-panel p-5 lg:p-6 flex flex-col min-h-100 max-h-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
            <h3 className="text-lg font-semibold tracking-tight">AI Forecast</h3>
            <div className="inline-flex p-1 rounded-lg bg-muted border border-border self-start">
              {['All', 'Phishing', 'Fraud'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === f ? 'bg-card text-foreground border border-border shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto pr-2 -mr-2 custom-scrollbar flex-1">
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
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-32">
                  No events recorded yet.
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-32">
                Logs cleared. Click &quot;Restore logs&quot; to view again.
              </div>
            )}
          </div>
        </div>

        {/* Right Column - AI Insight */}
        <div className="lg:col-span-12 2xl:col-span-4 surface-panel p-5 lg:p-6 flex flex-col">
          <h3 className="text-lg font-semibold tracking-tight mb-6">AI Insight</h3>
          <div className="flex-1 flex flex-col gap-6">
            {showLogs ? (
              <div className="space-y-5 text-[15px] leading-relaxed text-foreground">
                {criticalEvents.length > 0 ? (
                  <>
                    <p>The neural model has intercepted <strong>{criticalEvents.length} severe threat(s)</strong> recently, including highly suspicious activity originating from <span className="text-destructive font-mono text-[13px] break-all bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 rounded inline-block mt-1">{criticalEvents[0].target}</span>.</p>
                    <div className="p-5 rounded-lg border border-border bg-muted/40">
                      <h4 className="font-medium mb-2 flex items-center gap-2 text-[15px]">
                        <ShieldAlert className="w-5 h-5 text-warning shrink-0" />
                        Recommended Action
                      </h4>
                      <p className="text-sm text-muted-foreground">Avoid interacting with <strong className="break-all text-foreground">{criticalEvents[0].target}</strong>. We recommend navigating to your Blocklist to ensure this domain is permanently restricted from your network.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Your network traffic is currently <strong>clean and stable</strong>. No critical threats have been detected in recent sessions.</p>
                    <div className="p-5 rounded-lg border border-border bg-muted/40">
                      <h4 className="font-medium mb-2 flex items-center gap-2 text-[15px]">
                        <CheckCircle className="w-5 h-5 text-success shrink-0" />
                        All Clear
                      </h4>
                      <p className="text-sm text-muted-foreground">Continue normal browsing. The AI shield remains active in the background to automatically intercept anomalies.</p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Insights cleared.
              </div>
            )}
            <div className="mt-auto p-5 rounded-lg border border-border bg-muted/40">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-sm text-muted-foreground">System Integrity</span>
                <span className="font-mono text-lg text-success font-semibold">{Math.max(0, 100 - (criticalEvents.length * 2))}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all duration-700" style={{ width: `${Math.max(0, 100 - (criticalEvents.length * 2))}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fraud Simulation Modal */}
      {showFraudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="relative w-full max-w-2xl surface-panel p-6 md:p-7 overflow-hidden max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted border border-border">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Transaction Fraud Simulator</h3>
                  <p className="text-muted-foreground text-xs">Simulate transaction parameters to test Layer 1 rules &amp; Layer 2 ML anomaly detection.</p>
                </div>
              </div>
              <button
                onClick={() => setShowFraudModal(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar pr-1 flex-1 space-y-6">
              {/* Presets */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Quick Presets</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset("15000", "18", "3", "3500")}
                    className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-destructive">Critical: Exceeds Limit</div>
                    <div className="text-muted-foreground font-mono text-[10px] mt-0.5">$15k • 18 txns • 3 AM</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("350", "2", "23", "5500")}
                    className="p-2.5 rounded-lg border border-warning/30 bg-warning/5 hover:bg-warning/10 text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-warning">High: Geo-Velocity</div>
                    <div className="text-muted-foreground font-mono text-[10px] mt-0.5">$350 • 2 txns • 5,500 mi</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("42.50", "1", "14", "8")}
                    className="p-2.5 rounded-lg border border-success/30 bg-success/5 hover:bg-success/10 text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-success">Safe: Normal Purchase</div>
                    <div className="text-muted-foreground font-mono text-[10px] mt-0.5">$42.50 • 1 txn • 8 mi</div>
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSimulateFraud} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Transaction Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fraudAmount}
                      onChange={(e) => setFraudAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 input-base font-mono text-sm"
                      placeholder="e.g. 150.00"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-1">Hard limit rule triggers above $10,000</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Velocity (txns in last hour)</label>
                    <input
                      type="number"
                      value={fraudVelocity}
                      onChange={(e) => setFraudVelocity(e.target.value)}
                      required
                      className="w-full px-3 py-2 input-base font-mono text-sm"
                      placeholder="e.g. 2"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-1">Frequent attempts trigger velocity rules</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Hour of Day (0–23)</label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={fraudHour}
                      onChange={(e) => setFraudHour(e.target.value)}
                      required
                      className="w-full px-3 py-2 input-base font-mono text-sm"
                      placeholder="e.g. 14"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-1">Off-hours (2:00–4:00 AM) increase anomaly score</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Geo Distance (miles from home)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={fraudGeoDistance}
                      onChange={(e) => setFraudGeoDistance(e.target.value)}
                      required
                      className="w-full px-3 py-2 input-base font-mono text-sm"
                      placeholder="e.g. 25.0"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-1">&gt; 5,000 miles triggers impossible travel</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={fraudLoading}
                  className="w-full py-2.5 rounded-lg btn-primary text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
                >
                  {fraudLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Evaluating Neural Models...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Evaluate Transaction Risk
                    </>
                  )}
                </button>
              </form>

              {/* Result Display */}
              {fraudResult && (
                <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase font-medium text-muted-foreground">Assessment Verdict</div>
                      <div className="text-lg font-semibold flex items-center gap-2">
                        {fraudResult.verdict}
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold border ${
                          fraudResult.tier === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                          fraudResult.tier === 'high' ? 'bg-warning/10 text-warning border-warning/30' :
                          fraudResult.tier === 'moderate' ? 'bg-warning/10 text-warning border-warning/30' :
                          'bg-success/10 text-success border-success/30'
                        }`}>
                          {fraudResult.tier}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-medium text-muted-foreground">Security Score</div>
                      <div className={`text-2xl font-mono font-semibold ${
                        fraudResult.final_score < 30 ? 'text-destructive' :
                        fraudResult.final_score < 70 ? 'text-warning' : 'text-success'
                      }`}>
                        {fraudResult.final_score}/100
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-card p-2 rounded-lg border border-border">
                    <div className="text-muted-foreground">Rule Score: <span className="text-foreground font-semibold">{fraudResult.breakdown?.rule_score}/100</span></div>
                    <div className="text-muted-foreground">ML Score: <span className="text-foreground font-semibold">{fraudResult.breakdown?.ml_score}/100</span></div>
                  </div>

                  {fraudResult.reasons && fraudResult.reasons.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1.5">Triggered Indicators:</div>
                      <ul className="space-y-1">
                        {fraudResult.reasons.map((r: string, idx: number) => (
                          <li key={idx} className="text-xs text-foreground flex items-start gap-1.5">
                            <span className="text-destructive font-mono">•</span>
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
                      className="text-xs font-medium px-4 py-1.5 rounded-lg btn-secondary cursor-pointer"
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
  const dot = {
    ok: "bg-success",
    warning: "bg-warning",
    error: "bg-destructive",
  };
  const text = {
    ok: "Operational",
    warning: "Degraded",
    error: "Offline",
  };
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/40">
      <span className="font-medium text-[13px] text-foreground">{label}</span>
      <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
        {text[status]}
        <span className={`w-2 h-2 rounded-full ${dot[status]}`} />
      </span>
    </div>
  );
}

function BlockedSite({ domain, reason }: { domain: string, reason: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/40">
      <span className="font-mono text-[13px] text-foreground truncate">{domain}</span>
      <span className="text-[11px] text-destructive uppercase tracking-wider font-medium shrink-0 ml-2">{reason}</span>
    </div>
  );
}

function FeedCard({ label, domain, score, tags, type }: { label: string, domain: string, score: number, tags: string[], type: string }) {
  const accent = type === 'phishing'
    ? { dot: 'bg-destructive', tag: 'text-destructive' }
    : type === 'fraud'
    ? { dot: 'bg-warning', tag: 'text-warning' }
    : { dot: 'bg-success', tag: 'text-success' };

  return (
    <div className="surface-card hover-lift p-5 cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-medium text-base flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
          {label}
        </h4>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5">
          <span className="font-mono text-sm font-semibold text-foreground">{score}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</span>
        </div>
      </div>
      <div className="font-mono text-[13px] text-foreground mb-4 break-all underline decoration-border underline-offset-4 hover:decoration-primary transition-colors">{domain}</div>
      <div className="flex flex-wrap gap-2 items-center">
        {tags.map((tag, i) => (
          <span key={i} className={`font-mono text-[12px] px-2 py-0.5 rounded-md bg-muted border border-border ${accent.tag}`}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
