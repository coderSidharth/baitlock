"use client";
import Link from 'next/link';
import { Suspense, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Shield } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const subscribeAuth = (notify: () => void) => {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
};
const readAuth = () => localStorage.getItem("isLoggedIn") === "true";
const serverAuth = () => false;

function HomeContent() {
  const isLoggedIn = useSyncExternalStore(subscribeAuth, readAuth, serverAuth);
  const searchParams = useSearchParams();
  const isBlocked = searchParams.get('blocked') === 'true';
  const blockedUrl = searchParams.get('url') || 'Unknown URL';
  const score = searchParams.get('score') || '100';
  const tier = searchParams.get('tier') || 'critical';



  if (isBlocked) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-background text-foreground items-center justify-center p-4 fade-in">
        <div className="w-full max-w-lg surface-panel p-8 sm:p-10">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-destructive/10 border border-destructive/20 mb-6">
            <ShieldAlert size={26} className="text-destructive" strokeWidth={2} />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-[11px] font-semibold uppercase tracking-wider mb-4">
            Access Intercepted
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">Threat Blocked</h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed mb-8 max-w-md">
            Baitlock intercepted your request to access this website because it was flagged as a severe security risk.
          </p>

          <div className="w-full rounded-lg border border-border bg-muted/40 p-5 mb-8">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Target URL</div>
            <div className="text-foreground font-mono text-[13px] break-all mb-5">{blockedUrl}</div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Safety Score</div>
                <div className="text-2xl font-semibold text-destructive">{score} <span className="text-sm text-muted-foreground font-medium">/ 100</span></div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Threat Level: {100 - Math.min(100, Math.max(0, parseInt(score) || 0))}%</div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Risk Tier</div>
                <div className="text-2xl font-semibold text-destructive capitalize">{tier}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (window.history.length > 2) {
                  window.history.go(-2);
                } else {
                  window.location.href = "about:blank";
                }
              }}
              className="flex-1 py-3 btn-destructive rounded-lg font-medium text-sm"
            >
              Go Back Safely
            </button>
            <Link href="/dashboard" className="flex-1 py-3 btn-secondary rounded-lg font-medium text-sm flex items-center justify-center gap-2">
              <ArrowLeft size={16} /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen max-w-[1400px] mx-auto px-6 sm:px-10 py-6 fade-in">
      {/* Header */}
      <header className="flex justify-between items-center w-full max-w-5xl mx-auto py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield size={16} className="text-primary-foreground" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Baitlock</span>
        </Link>
        <nav className="flex gap-2 items-center text-sm">
          <Link href="/docs" className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors font-medium">Docs</Link>
          {!isLoggedIn && (
            <Link href="/login" className="px-4 py-2 rounded-lg btn-secondary font-medium">Sign in</Link>
          )}
          {isLoggedIn && (
            <Link href="/dashboard" className="px-4 py-2 rounded-lg btn-primary font-medium">Dashboard</Link>
          )}
          <ThemeToggle />
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground text-[13px] font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Enterprise-Grade Phishing Protection
        </div>

        <h1 className="text-5xl sm:text-7xl leading-[1.05] font-semibold tracking-tight mb-6 max-w-4xl text-balance">
          Investigate{" "}<span className="text-primary">before</span>{" "}it&apos;s a problem
        </h1>

        <p className="text-[16px] leading-7 text-muted-foreground max-w-xl mb-10">
          Baitlock fuses deterministic rule engines, isolation forest anomaly detection, and large language models to intercept phishing and fraud before it reaches your users.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <a href="/baitlock-extension.zip" download className="w-full sm:w-auto px-6 py-3 btn-primary rounded-lg text-[15px] font-medium text-center">
            Get Extension
          </a>
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="w-full sm:w-auto px-6 py-3 btn-secondary rounded-lg text-[15px] font-medium text-center">
            Get Checked
          </Link>
        </div>

        {/* Feature row */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-foreground/40" /> Sub-millisecond rule engine</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-foreground/40" /> Isolation Forest anomaly detection</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-foreground/40" /> NIST CSF aligned</span>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex w-full min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}
