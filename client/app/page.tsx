"use client";
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, AlertTriangle, ArrowLeft } from 'lucide-react';

function HomeContent() {
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
      <div className="flex flex-col w-full min-h-screen bg-[#070910] text-zinc-100 font-inter items-center justify-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-red-600/15 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-size-[26px_26px] [mask-image:radial-gradient(70%_60%_at_50%_50%,#000,transparent)] pointer-events-none"></div>

        <div className="z-10 flex flex-col items-center max-w-150 w-full mx-4 text-center p-8 sm:p-10 bg-zinc-950/50 border border-red-500/25 rounded-3xl backdrop-blur-2xl shadow-[0_30px_80px_-30px_rgba(220,38,38,0.4)] animate-fade-in">
          <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/25 shadow-[0_0_40px_rgba(220,38,38,0.25)]">
            <ShieldAlert size={38} className="text-red-500" strokeWidth={1.5} />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-[11px] font-semibold uppercase tracking-widest mb-4">
            Access Intercepted
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-red-500 mb-3 tracking-tight">Threat Blocked</h1>
          <p className="text-zinc-400 mb-8 text-[15px] leading-relaxed max-w-100">
            Baitlock intercepted your request to access this website because it was flagged as a severe security risk.
          </p>

          <div className="w-full bg-black/40 border border-white/8 rounded-2xl p-5 mb-8 text-left">
            <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5">Target URL</div>
            <div className="text-zinc-200 font-mono text-[13px] break-all mb-5">{blockedUrl}</div>

            <div className="flex gap-4">
              <div className="flex-1 bg-white/5 rounded-xl p-4 border border-white/8">
                <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Safety Score</div>
                <div className="text-2xl font-semibold text-red-400">{score} <span className="text-sm text-zinc-600 font-medium">/ 100</span></div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Threat Level: {100 - Math.min(100, Math.max(0, parseInt(score) || 0))}%</div>
              </div>
              <div className="flex-1 bg-white/5 rounded-xl p-4 border border-white/8">
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
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors shadow-[0_12px_30px_-12px_rgba(220,38,38,0.7)] active:translate-y-px"
            >
              Go Back Safely
            </button>
            <Link href="/dashboard" className="flex-1 py-3.5 btn-ghost text-zinc-200 rounded-xl font-medium flex items-center justify-center gap-2">
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
      <header className="flex justify-between items-center w-full max-w-6xl mx-auto py-3 px-4 sm:px-5 z-50 rounded-full surface-glass border mt-2">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <ShieldAlert size={17} className="text-white" strokeWidth={2} />
          </span>
          <span className="font-inter text-xl font-bold text-zinc-100 tracking-tight">Baitlock</span>
        </Link>
        <nav className="flex gap-2 sm:gap-3 font-inter text-[14px] items-center">
          {!isLoggedIn && (
            <Link href="/login" className="px-5 py-2.5 rounded-full btn-ghost text-zinc-200 font-medium">Sign in</Link>
          )}
          <Link href="/docs" className="px-5 py-2.5 rounded-full bg-transparent text-zinc-400 hover:text-zinc-100 font-medium transition-colors">Docs</Link>
          {isLoggedIn && (
            <Link href="/dashboard" className="px-5 py-2.5 rounded-full btn-primary text-white font-medium">Dashboard</Link>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center relative z-20 mt-10 sm:-mt-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[13px] font-medium mb-8 shadow-[0_0_30px_-8px_rgba(37,99,235,0.5)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
          </span>
          Enterprise-Grade Phishing Protection
        </div>

        <h2 className="font-cormorant text-6xl sm:text-[92px] leading-[1.05] font-medium text-zinc-50 mb-6 tracking-tight max-w-4xl">
          Investigate <em className="italic bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent pr-1">before</em><br />it&apos;s a problem
        </h2>

        <p className="font-inter text-[16px] leading-7 text-zinc-400 max-w-150 mb-12">
          Baitlock fuses deterministic rule engines, isolation forest anomaly detection, and large language models to intercept phishing and fraud before it reaches your users.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <a href="/baitlock-extension.zip" download className="group w-full sm:w-auto px-8 py-4 bg-zinc-100 hover:bg-white text-zinc-900 rounded-2xl font-inter text-[15px] font-semibold transition-all shadow-[0_0_40px_-8px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_-6px_rgba(255,255,255,0.45)] active:translate-y-px text-center">
            Get Extension
          </a>

          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="w-full sm:w-auto px-8 py-4 btn-ghost text-zinc-200 rounded-2xl font-inter text-[15px] font-medium text-center backdrop-blur-md">
            Get Checked
          </Link>
        </div>

        {/* Trust strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[12px] font-inter text-zinc-500">
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Sub-millisecond rule engine</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Isolation Forest anomaly detection</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> NIST CSF aligned</span>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex w-full min-h-screen bg-[#09090b]" />}>
      <HomeContent />
    </Suspense>
  );
}
