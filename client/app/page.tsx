"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const searchParams = useSearchParams();
  const isBlocked = searchParams.get('blocked') === 'true';
  const blockedUrl = searchParams.get('url') || 'Unknown URL';
  const score = searchParams.get('score') || '100';
  const tier = searchParams.get('tier') || 'critical';

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
  }, []);

  if (isBlocked) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-[#09090b] text-zinc-100 font-inter items-center justify-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-red-600/15 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="z-10 flex flex-col items-center max-w-150 w-full mx-4 text-center p-10 bg-zinc-950/40 border border-red-500/20 rounded-3xl backdrop-blur-2xl shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.15)]">
            <ShieldAlert size={36} className="text-red-500" strokeWidth={1.5} />
          </div>

          <h1 className="text-3xl font-semibold text-red-500 mb-3 tracking-tight">Threat Blocked</h1>
          <p className="text-zinc-400 mb-8 text-[15px] leading-relaxed max-w-100">
            Baitlock intercepted your request to access this website because it was flagged as a severe security risk.
          </p>

          <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 mb-8 text-left">
            <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5">Target URL</div>
            <div className="text-zinc-200 font-mono text-[13px] break-all mb-5">{blockedUrl}</div>

            <div className="flex gap-4">
              <div className="flex-1 bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Threat Score</div>
                <div className="text-2xl font-semibold text-red-400">{score} <span className="text-sm text-zinc-600 font-medium">/ 100</span></div>
              </div>
              <div className="flex-1 bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Risk Tier</div>
                <div className="text-2xl font-semibold text-red-400 capitalize">{tier}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <button 
              onClick={() => {
                if (window.history.length > 2) {
                  window.history.go(-2);
                } else {
                  window.location.href = "about:blank";
                }
              }} 
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-900/20"
            >
              Go Back Safely
            </button>
            <Link href="/dashboard" className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
              <ArrowLeft size={16} /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen max-w-[1920px] mx-auto relative z-10 px-6 sm:px-12 py-8 fade-in">
      {/* Header */}
      <header className="flex justify-between items-center w-full max-w-6xl mx-auto py-4 z-50">
        <h1 className="font-inter text-2xl font-bold text-zinc-100 tracking-tight">Baitlock</h1>
        <nav className="flex gap-3 sm:gap-6 font-inter text-[14px] items-center">
          {!isLoggedIn && (
            <Link href="/login" className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-200 font-medium transition-all border border-white/10 backdrop-blur-md">Sign in</Link>
          )}
          <Link href="/docs" className="px-5 py-2.5 rounded-full bg-transparent text-zinc-400 hover:text-zinc-100 font-medium transition-colors">Docs</Link>
          {isLoggedIn && (
            <Link href="/dashboard" className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]">Dashboard</Link>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center relative z-20 mt-10 sm:-mt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[13px] font-medium mb-8">
          <ShieldAlert size={14} /> Enterprise-Grade Phishing Protection
        </div>
        
        <h2 className="font-cormorant text-6xl sm:text-[90px] leading-[1.1] font-medium text-zinc-50 mb-6 tracking-tight max-w-4xl">
          Investigate <em className="italic text-zinc-400 pr-1">before</em><br />it's a problem
        </h2>

        <p className="font-inter text-[16px] leading-6.5 text-zinc-400 max-w-150 mb-12">
          Baitlock fuses deterministic rule engines, isolation forest anomaly detection, and large language models to intercept phishing and fraud before it reaches your users.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <a href="/baitlock-extension.zip" download className="w-full sm:w-auto px-8 py-4 bg-zinc-100 hover:bg-white text-zinc-900 rounded-2xl font-inter text-[15px] font-semibold transition-colors shadow-[0_0_30px_rgba(255,255,255,0.1)] text-center">
            Get Extension
          </a>

          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 rounded-2xl font-inter text-[15px] font-medium transition-all backdrop-blur-md text-center">
            Get Checked
          </Link>
        </div>
      </main>
    </div>
  );
}
