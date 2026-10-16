"use client";

import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ScanLine, Link2, CreditCard, RefreshCw, Activity, MessageSquare, LogOut, User as UserIcon, Send, ShieldAlert } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const VERDICT_STYLE = {
  safe: { label: "SAFE", color: "#2F6F4E", bg: "#F0F7F3" },
  moderate: { label: "MODERATE RISK", color: "#B8791A", bg: "#FFF9EE" },
  high: { label: "HIGH RISK", color: "#A63232", bg: "#FDF2F2" },
  critical: { label: "CRITICAL RISK", color: "#A63232", bg: "#FDF2F2" },
};

function Stamp({ verdict, tier }) {
  const normalizedTier = (tier || "safe").toLowerCase();
  const v = VERDICT_STYLE[normalizedTier] || VERDICT_STYLE.safe;
  const displayLabel = verdict ? verdict.replace("_", " ") : v.label;

  return (
    <div
      style={{
        border: `2.5px solid ${v.color}`,
        color: v.color,
        background: v.bg,
        transform: "rotate(-4deg)",
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: "0.12em",
      }}
      className="px-4 py-1.5 text-xs font-bold rounded-sm select-none uppercase shadow-sm"
    >
      {displayLabel}
    </div>
  );
}

function SignalRow({ reason, index }) {
  const isLlm = typeof reason === "string" && (reason.toLowerCase().includes("llm") || reason.toLowerCase().includes("urgency") || reason.toLowerCase().includes("sensitive"));
  const Icon = isLlm ? AlertTriangle : CheckCircle2;

  return (
    <div className="flex items-start gap-3 py-3" style={{ borderTop: "1px solid #DAD6CC" }}>
      <Icon size={18} style={{ color: isLlm ? "#B8791A" : "#A63232", marginTop: 2, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#1C1B19" }}
            className="text-sm font-semibold"
          >
            Signal #{index + 1}
          </span>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: isLlm ? "#B8791A" : "#6B6558",
              letterSpacing: "0.08em",
            }}
            className="text-[10px] font-bold uppercase"
          >
            {isLlm ? "Reasoned (LLM)" : "Rule & ML Signal"}
          </span>
        </div>
        <p style={{ color: "#4A463D", fontFamily: "'Source Serif 4', serif" }} className="text-sm mt-0.5">
          {typeof reason === "string" ? reason : JSON.stringify(reason)}
        </p>
      </div>
    </div>
  );
}

export default function ScanLedger() {
  const [mode, setMode] = useState("phishing");
  const [phishingUrl, setPhishingUrl] = useState("paypa1-secure-verify.xyz/login");
  const [pageText, setPageText] = useState("Urgent: Your account is suspended. Verify credentials immediately.");
  
  // Auth state
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [authModal, setAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "", full_name: "" });
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("access_token");
    if (savedToken) {
      setToken(savedToken);
      // We'd ideally fetch /auth/me here, but for now we'll just trust the token exists
      setUser({ email: "user@aegis.com" }); // mock user info for now
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("isLoggedIn");
    window.postMessage({ type: 'AEGIS_LOGOUT' }, '*');
    setToken("");
    setUser(null);
    setChatMessages([]);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister ? authForm : { email: authForm.email, password: authForm.password };
      
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Authentication failed");
      }
      
      if (isRegister) {
        // Auto-login after register
        setIsRegister(false);
        setAuthForm({ ...authForm, password: "" });
        setErrorMsg("Registration successful! Please log in.");
      } else {
        const data = await res.json();
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("isLoggedIn", "true");
        window.postMessage({ type: 'AEGIS_LOGIN', token: data.access_token }, '*');
        setToken(data.access_token);
        setUser({ email: authForm.email });
        setAuthModal(false);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Fraud form state
  const [fraudForm, setFraudForm] = useState({
    amount: 1250.0,
    velocity: 5,
    hour: 3,
    geo_distance: 450.0,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);
  
  // Live audit log state
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/events?limit=50`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.warn("Could not fetch audit events feed", e);
    } finally {
      setEventsLoading(false);
    }
  };

  const addToWhitelist = async (url) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/phishing/whitelist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ domain: url })
      });
      if (res.ok) {
        alert("Site marked as safe and added to your whitelist!");
        fetchEvents();
      } else {
        const err = await res.json();
        alert("Failed to whitelist: " + (err.detail || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Error adding to whitelist.");
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [token]); // re-fetch when token changes

  const fetchChatHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/chat/history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch (e) {
      console.warn("Could not fetch chat history", e);
    }
  };

  useEffect(() => {
    if (mode === "chat") {
      fetchChatHistory();
    }
  }, [mode, token]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, mode]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !token) return;
    const msg = chatInput.trim();
    setChatInput("");
    
    // Optimistic UI
    const tempId = Date.now();
    setChatMessages(prev => [...prev, { id: tempId, role: "user", content: msg }]);
    
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ role: "user", content: msg })
      });
      if (res.ok) {
        const aiMsg = await res.json();
        setChatMessages(prev => [...prev.filter(m => m.id !== tempId), { id: tempId, role: "user", content: msg }, aiMsg]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runScan = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      let endpoint = "";
      let payload = {};

      if (mode === "phishing") {
        endpoint = `${API_BASE}/phishing/check`;
        let targetUrl = phishingUrl.trim();
        if (targetUrl && !targetUrl.match(/^https?:\/\//i)) {
          targetUrl = `https://${targetUrl}`;
        }
        payload = { url: targetUrl, page_text: pageText.trim() || undefined };
      } else {
        endpoint = `${API_BASE}/fraud/score`;
        payload = {
          transaction: {
            amount: Number(fraudForm.amount),
            velocity: Number(fraudForm.velocity),
            hour: Number(fraudForm.hour),
            geo_distance: Number(fraudForm.geo_distance),
          },
        };
      }

      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.[0]?.msg || errData.detail || `Scan failed (${res.status})`);
      }

      const data = await res.json();
      setResult({
        ...data,
        targetInput: mode === "phishing" ? payload.url : `$${fraudForm.amount} txn (${fraudForm.velocity} tx/hr)`,
      });
      fetchEvents();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to reach Aegis API");
    } finally {
      setLoading(false);
    }
  };

  const [blockedData, setBlockedData] = useState(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("blocked") === "true") {
        setBlockedData({
          url: searchParams.get("url"),
          score: searchParams.get("score"),
          tier: searchParams.get("tier")
        });
      }
    }
  }, []);

  if (blockedData) {
    return (
      <div style={{ background: "#A63232", minHeight: "100vh", color: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600&family=IBM+Plex+Mono:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        `}</style>
        <AlertTriangle size={80} style={{ color: "#FDF2F2", marginBottom: "1rem" }} />
        <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: "3rem", marginBottom: "1rem", textAlign: "center" }}>Access Blocked by Aegis</h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "1.2rem", textAlign: "center", maxWidth: "600px", lineHeight: "1.6" }}>
          This page has been automatically intercepted and flagged as a <strong>{blockedData.tier}</strong> threat.
        </p>
        <div style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "8px", marginTop: "2rem", fontFamily: "'IBM Plex Mono', monospace", wordBreak: "break-all", maxWidth: "800px" }}>
          Target URL: {blockedData.url}
        </div>
        <button onClick={() => window.location.href = '/'} style={{ marginTop: "3rem", background: "white", color: "#A63232", padding: "12px 24px", borderRadius: "4px", fontWeight: "bold", fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" }}>
          Return to Safe Dashboard
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ background: "#F7F5F1", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}
      className="w-full p-6 md:p-10 text-black"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600&family=IBM+Plex+Mono:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
      `}</style>

      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ScanLine size={16} style={{ color: "#8A8474" }} />
              <span
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8A8474", letterSpacing: "0.16em" }}
                className="text-xs font-semibold uppercase"
              >
                AEGIS REAL-TIME THREAT DETECTOR
              </span>
            </div>
            <h1
              style={{ fontFamily: "'Source Serif 4', serif", color: "#1C1B19" }}
              className="text-3xl md:text-4xl font-semibold"
            >
              Signal Ledger
            </h1>
          </div>
          <div>
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-mono text-gray-700">
                  <UserIcon size={16} /> {user.email}
                </div>
                <button onClick={handleLogout} className="text-gray-500 hover:text-black" title="Logout">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModal(true)}
                style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#1C1B19", color: "#F7F5F1" }}
                className="px-4 py-2 text-xs font-bold uppercase rounded-sm cursor-pointer"
              >
                Login / Connect
              </button>
            )}
          </div>
        </div>

        {/* Auth Modal */}
        {authModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div style={{ background: "#FFFFFF", border: "1px solid #1C1B19" }} className="p-6 rounded-sm w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-serif font-semibold">{isRegister ? "Create Account" : "Login to Aegis"}</h2>
                <button onClick={() => setAuthModal(false)}><XCircle size={20} className="text-gray-500 hover:text-black" /></button>
              </div>
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-700 mb-1">Full Name</label>
                    <input type="text" value={authForm.full_name} onChange={e => setAuthForm({...authForm, full_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-sm font-sans text-sm" required />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-mono uppercase text-gray-700 mb-1">Email</label>
                  <input type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-sm font-sans text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-gray-700 mb-1">Password</label>
                  <input type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-sm font-sans text-sm" required />
                </div>
                {errorMsg && <div className="text-red-600 text-xs font-mono">{errorMsg}</div>}
                <button type="submit" disabled={loading} style={{ background: "#1C1B19", color: "#F7F5F1" }} className="w-full py-2 text-xs font-bold font-mono uppercase rounded-sm disabled:opacity-50">
                  {loading ? "Processing..." : isRegister ? "Register" : "Login"}
                </button>
                <div className="text-center mt-2">
                  <button type="button" onClick={() => setIsRegister(!isRegister)} className="text-xs font-mono text-gray-500 hover:text-black underline">
                    {isRegister ? "Already have an account? Login" : "Need an account? Register"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex gap-2 border-b border-gray-300 pb-2">
          {[
            { key: "phishing", label: "URL Scan", icon: Link2 },
            { key: "fraud", label: "Txn Fraud", icon: CreditCard },
            { key: "chat", label: "AI Chat", icon: MessageSquare },
            { key: "blocklist", label: "Blocklist", icon: ShieldAlert },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setMode(key); setErrorMsg(""); }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                background: mode === key ? "#1C1B19" : "transparent",
                color: mode === key ? "#F7F5F1" : "#4A463D",
                border: "1.5px solid #1C1B19",
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase rounded-sm tracking-wide transition-colors cursor-pointer"
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        {mode === "blocklist" ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #DAD6CC", minHeight: "400px" }} className="flex flex-col rounded-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
              <ShieldAlert size={20} className="text-red-600" />
              <h2 style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-lg font-bold uppercase tracking-wider text-red-700">Blocked Sites Registry</h2>
            </div>
            <div className="space-y-3 font-mono text-xs overflow-y-auto max-h-125">
              {!user ? (
                <div className="py-10 text-center text-gray-500 italic">Please login to view and manage your blocklist.</div>
              ) : events.filter(e => e.type === "phishing" && (e.tier?.toLowerCase() === "high" || e.tier?.toLowerCase() === "critical")).length > 0 ? (
                events.filter(e => e.type === "phishing" && (e.tier?.toLowerCase() === "high" || e.tier?.toLowerCase() === "critical")).map((evt) => (
                  <div key={evt.id} style={{ border: "1px solid #FCA5A5", background: "#FEF2F2" }} className="p-3 rounded-sm flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-red-800 font-bold mb-1 truncate">{evt.target}</div>
                      <div className="text-[10px] text-red-600">Score: {evt.score}/100 | {evt.verdict}</div>
                    </div>
                    <button
                      onClick={() => addToWhitelist(evt.target)}
                      className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold uppercase rounded-sm hover:bg-green-700 transition-colors shrink-0"
                    >
                      Mark as Safe
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-gray-500 italic">No blocked sites recorded. You're completely safe!</div>
              )}
            </div>
          </div>
        ) : mode === "chat" ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #DAD6CC", minHeight: "400px" }} className="flex flex-col rounded-sm">
            {!user ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <MessageSquare size={48} className="text-gray-300 mb-4" />
                <h3 className="font-serif text-xl mb-2">Connect to AI Assistant</h3>
                <p className="text-sm text-gray-500 font-mono mb-4">You need to be logged in to use the AI Security Chat and maintain conversation history.</p>
                <button onClick={() => setAuthModal(true)} style={{ background: "#1C1B19", color: "#F7F5F1" }} className="px-6 py-2 text-xs font-bold font-mono uppercase rounded-sm">Login</button>
              </div>
            ) : (
              <>
                <div className="flex-1 p-4 overflow-y-auto max-h-125 space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-400 italic font-mono text-sm py-10">
                      Start a conversation with Aegis AI Assistant...
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-sm p-3 text-sm ${msg.role === 'user' ? 'bg-[#1C1B19] text-white font-sans' : 'bg-[#F7F5F1] text-black border border-gray-200 font-serif'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-gray-200 flex gap-2">
                  <input 
                    type="text" 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Ask about a threat or security policy..." 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-sm font-sans text-sm outline-none focus:border-black"
                  />
                  <button onClick={sendChatMessage} style={{ background: "#1C1B19", color: "#F7F5F1" }} className="px-4 py-2 rounded-sm flex items-center justify-center">
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div style={{ background: "#FFFFFF", border: "1px solid #DAD6CC" }} className="p-6 rounded-sm space-y-4">
              {mode === "phishing" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      Target URL
                    </label>
                    <input
                      type="text"
                      value={phishingUrl}
                      onChange={(e) => setPhishingUrl(e.target.value)}
                      placeholder="e.g. paypa1-secure-verify.xyz/login"
                      style={{ border: "1.5px solid #DAD6CC" }}
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      Page Body Text (Optional LLM Analysis)
                    </label>
                    <textarea
                      rows={2}
                      value={pageText}
                      onChange={(e) => setPageText(e.target.value)}
                      placeholder="Paste page content..."
                      style={{ border: "1.5px solid #DAD6CC" }}
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none focus:border-black"
                    />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      value={fraudForm.amount}
                      onChange={(e) => setFraudForm({ ...fraudForm, amount: e.target.value })}
                      style={{ border: "1.5px solid #DAD6CC" }}
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      Velocity (txns/hr)
                    </label>
                    <input
                      type="number"
                      value={fraudForm.velocity}
                      onChange={(e) => setFraudForm({ ...fraudForm, velocity: e.target.value })}
                      style={{ border: "1.5px solid #DAD6CC" }}
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      Hour of Day (0-23)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={fraudForm.hour}
                      onChange={(e) => setFraudForm({ ...fraudForm, hour: e.target.value })}
                      style={{ border: "1.5px solid #DAD6CC" }}
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      Geo Distance (km)
                    </label>
                    <input
                      type="number"
                      value={fraudForm.geo_distance}
                      onChange={(e) => setFraudForm({ ...fraudForm, geo_distance: e.target.value })}
                      style={{ border: "1.5px solid #DAD6CC" }}
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none focus:border-black"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={runScan}
                disabled={loading}
                style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#1C1B19", color: "#F7F5F1" }}
                className="w-full py-3 text-xs font-bold uppercase rounded-sm tracking-wide hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Analyzing Threat Signals…" : "Run Real-Time Check"}
              </button>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm font-mono">
                  ⚠️ {errorMsg}
                </div>
              )}
            </div>

            {/* Verdict Result Card */}
            {result && (
              <div
                style={{ background: "#FFFFFF", border: "1px solid #DAD6CC" }}
                className="rounded-sm p-6 relative overflow-hidden shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div
                      style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#8A8474" }}
                      className="text-[11px] uppercase tracking-wide mb-1 truncate"
                    >
                      {result.targetInput}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#1C1B19" }}
                        className="text-5xl font-bold"
                      >
                        {result.score ?? result.final_score ?? 0}
                      </span>
                      <span style={{ color: "#8A8474" }} className="text-lg font-medium">
                        /100
                      </span>
                    </div>
                  </div>
                  <Stamp verdict={result.verdict} tier={result.tier} />
                </div>

                {/* Component Breakdown */}
                {result.breakdown && (
                  <div
                    style={{ background: "#F7F5F1", border: "1px solid #E5E2DA" }}
                    className="grid grid-cols-3 gap-2 p-3 my-4 rounded-sm text-center font-mono text-xs"
                  >
                    <div>
                      <div className="text-gray-500 text-[10px]">RULE SCORE</div>
                      <div className="font-bold text-sm">{result.breakdown.rule_score}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-[10px]">ML SCORE</div>
                      <div className="font-bold text-sm">{result.breakdown.ml_score}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-[10px]">LLM SCORE</div>
                      <div className="font-bold text-sm">{result.breakdown.llm_score ?? 0}</div>
                    </div>
                  </div>
                )}

                {/* Reasons Signal Ledger */}
                <div className="mt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 font-mono">
                    Detected Threat Signals ({result.reasons?.length || 0})
                  </div>
                  {result.reasons && result.reasons.length > 0 ? (
                    result.reasons.map((reason, i) => <SignalRow key={i} index={i} reason={reason} />)
                  ) : (
                    <div className="py-4 text-xs text-gray-500 italic font-mono">No threat signals triggered — request evaluated as safe.</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Live Audit Log Feed */}
        <div style={{ background: "#FFFFFF", border: "1px solid #DAD6CC" }} className="p-6 rounded-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-gray-600" />
              <h2 style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm font-bold uppercase tracking-wider">
                Live Audit Trail Feed
              </h2>
            </div>
            <button
              onClick={fetchEvents}
              disabled={eventsLoading}
              className="text-xs font-mono text-gray-500 hover:text-black flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} className={eventsLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {events.length > 0 ? (
              events.map((evt) => (
                <div
                  key={evt.id}
                  style={{ borderBottom: "1px dashed #E5E2DA" }}
                  className="py-2 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${evt.type === 'phishing' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                      {evt.type}
                    </span>
                    <span className="truncate text-gray-800">{evt.target}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold">{evt.score}/100</span>
                    <span className={`text-[10px] font-bold ${evt.score < 50 ? 'text-red-600' : 'text-green-700'}`}>
                      {evt.verdict}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-gray-400 italic">No events recorded yet in audit trail.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
