"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  Shield,
  Layers,
  Cpu,
  Sparkles,
  CheckCircle2,
  Terminal,
  Search,
  BookOpen,
  ArrowLeft,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Lock,
  Download,
  GitBranch,
  ChevronRight
} from "lucide-react";

export default function DocsContent({ isDashboard = false }: { isDashboard?: boolean }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(id);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const sections = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "architecture", label: "How it Works (Architecture)", icon: Layers },
    { id: "nist-alignment", label: "NIST Framework Alignment", icon: ShieldCheck },
    { id: "nist-800-63b", label: "NIST SP 800-63B Alignment", icon: Lock },
    { id: "local-installation", label: "Local Installation", icon: GitBranch },
    { id: "extension-install", label: "Install Extension", icon: Download },
  ];

  const filteredSections = sections.filter((s) =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`w-full flex flex-col flex-1 ${isDashboard ? "h-full min-h-0" : "min-h-0"}`}>
      {/* Header Banner if standalone page */}
      {!isDashboard && (
        <header className="flex justify-between items-center w-full px-8 py-6 bg-linear-to-r from-transparent via-[#003882]/20 to-[#0048A6]/30 border-b border-white/10 mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors font-inter text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
            <span className="text-white/20">|</span>
            <span className="font-cormorant text-2xl font-bold text-white tracking-widest">
              Baitlock Docs
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="px-5 py-2 rounded-md bg-linear-to-r from-[#003882] to-[#0048A6] text-white font-inter text-sm font-medium hover:brightness-110 transition-all border border-white/10 shadow-[0_0_12px_rgba(0,30,100,0.4)]"
            >
              Go to Dashboard
            </Link>
          </div>
        </header>
      )}

      {/* Main Container */}
      <div className={`flex-1 flex flex-col lg:flex-row gap-8 ${isDashboard ? "pt-2 min-h-0" : "px-8 pb-12"}`}>
        {/* Sidebar Nav */}
        <div className="w-full lg:w-70 shrink-0 flex flex-col gap-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-white/40 text-sm font-inter focus:outline-none focus:border-[#0048A6] transition-colors"
            />
          </div>

          {/* Navigation Items */}
          <div
            className="rounded-xl p-3 border border-white/10 shadow-xl flex flex-col gap-1"
            style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}
          >
            <div className="px-3 py-2 text-xs font-mono text-white/40 uppercase tracking-wider font-semibold">
              Documentation Nav
            </div>
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    setActiveSection(sec.id);
                    const el = document.getElementById(sec.id);
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-inter transition-all cursor-pointer ${
                    isActive
                      ? "bg-linear-to-r from-[#003882] to-[#0048A6] text-white font-medium shadow-md border border-white/15"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-white/50"}`} />
                    <span className="truncate">{sec.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-0"}`} />
                </button>
              );
            })}
          </div>

          {/* Key Specs Widget */}
          <div
            className="rounded-xl p-5 border border-white/10 shadow-xl flex flex-col gap-3"
            style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}
          >
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider font-semibold">
              <Zap className="w-4 h-4" /> System Metrics
            </div>
            <div className="space-y-2 text-xs font-inter text-white/70">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>Latency</span>
                <span className="font-mono text-cyan-400 font-bold">&lt; 1ms (Layer 1)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>ML Model</span>
                <span className="font-mono text-cyan-400">Isolation Forest</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Framework</span>
                <span className="font-mono text-cyan-400">NIST CSF Aligned</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-24 pr-2 space-y-10 custom-scrollbar max-w-300">
          {/* Page Title */}
          <div className="flex flex-col gap-2 pb-6 border-b border-white/10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0048A6]/30 border border-[#0048A6]/50 text-cyan-300 font-mono text-xs w-fit">
              <BookOpen className="w-3.5 h-3.5" /> Official Documentation
            </div>
            <h1 className="font-cormorant text-5xl lg:text-6xl font-bold tracking-tight text-white">
              Baitlock Documentation
            </h1>
            <p className="font-inter text-white/60 text-lg">
              Architecture, detection layers, compliance guidelines, local setup, and extension installation manual.
            </p>
          </div>

          {/* SECTION 1: OVERVIEW */}
          <section id="overview" className="scroll-mt-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0048A6]/20 border border-[#0048A6]/40 text-cyan-400">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="font-cormorant text-3xl font-bold text-white tracking-wide">
                Overview
              </h2>
            </div>
            <div
              className="p-6 lg:p-8 rounded-xl border border-white/10 shadow-xl leading-relaxed text-white/80 font-inter text-base space-y-4"
              style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}
            >
              <p>
                Baitlock is a real-time, AI-powered phishing and fraud detection platform. It provides immediate analysis of URLs and financial transactions to block malicious activity before it reaches the end user.
              </p>
              <p>
                By utilizing a tiered detection model, Baitlock balances sub-millisecond response times with deep contextual analysis. The architecture is mapped to the National Institute of Standards and Technology Cybersecurity Framework, specifically focusing on the Identify, Protect, and Detect functions to ensure a standardized approach to threat mitigation.
              </p>
            </div>
          </section>

          {/* SECTION 2: HOW IT WORKS */}
          <section id="architecture" className="scroll-mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0048A6]/20 border border-[#0048A6]/40 text-cyan-400">
                <Layers className="w-6 h-6" />
              </div>
              <h2 className="font-cormorant text-3xl font-bold text-white tracking-wide">
                How it Works
              </h2>
            </div>

            <p className="text-white/70 font-inter text-base">
              Baitlock does not rely on a single model for every request. Instead, it uses a three-layer cascade architecture to optimize for speed, cost, and accuracy. When a URL or transaction is checked, it passes through the following layers.
            </p>

            {/* 3 Cascade Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Layer One */}
              <div
                className="p-6 rounded-xl border border-cyan-500/20 shadow-xl flex flex-col justify-between group hover:border-cyan-400/40 transition-all"
                style={{ background: "radial-gradient(100% 150% at 50% 50%, #002D66 0%, #001C40 100%)" }}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 uppercase">
                      Layer 1
                    </span>
                    <Zap className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="font-cormorant text-2xl font-bold text-white mb-3">
                    Rule Engine
                  </h3>
                  <p className="font-inter text-sm text-white/70 leading-relaxed">
                    Every request first passes through deterministic checks. For URLs, the system analyzes the top-level domain against a blocklist, calculates Shannon entropy to detect randomly generated domains, and uses Levenshtein distance to identify brand impersonation such as distinguishing between a legitimate domain and a spoofed variant. For transactions, the engine verifies the transaction amount against the user's historical average and checks the frequency of recent activity.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/10 font-mono text-xs text-cyan-300/80">
                  ⚡ Latency: &lt; 1ms
                </div>
              </div>

              {/* Layer Two */}
              <div
                className="p-6 rounded-xl border border-blue-500/20 shadow-xl flex flex-col justify-between group hover:border-blue-400/40 transition-all"
                style={{ background: "radial-gradient(100% 150% at 50% 50%, #002D66 0%, #001C40 100%)" }}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 uppercase">
                      Layer 2
                    </span>
                    <Cpu className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="font-cormorant text-2xl font-bold text-white mb-3">
                    Machine Learning Classifier
                  </h3>
                  <p className="font-inter text-sm text-white/70 leading-relaxed">
                    If the rule engine does not immediately flag the input as highly critical, the data is passed to a machine learning model. The URL classifier is trained on the PhishTank dataset to identify malicious URL structures. The transaction model uses an Isolation Forest algorithm trained on synthetic behavioral data to detect anomalous spending patterns or geographic mismatches.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/10 font-mono text-xs text-blue-300/80">
                  🤖 PhishTank &amp; Isolation Forest
                </div>
              </div>

              {/* Layer Three */}
              <div
                className="p-6 rounded-xl border border-purple-500/20 shadow-xl flex flex-col justify-between group hover:border-purple-400/40 transition-all"
                style={{ background: "radial-gradient(100% 150% at 50% 50%, #002D66 0%, #001C40 100%)" }}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 uppercase">
                      Layer 3
                    </span>
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="font-cormorant text-2xl font-bold text-white mb-3">
                    LLM Cascade
                  </h3>
                  <p className="font-inter text-sm text-white/70 leading-relaxed">
                    If the composite score from the rule engine and the machine learning model falls within an ambiguous band, typically a score between thirty and seventy, the system escalates the analysis. If page text is available, a large language model analyzes the content for brand spoofing, urgency language, and credential harvesting intent. This deliberate escalation ensures that expensive and latency-heavy API calls are only made when deterministic systems are uncertain.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/10 font-mono text-xs text-purple-300/80">
                  🧠 Escalation Score: 30 - 70
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: NIST FRAMEWORK ALIGNMENT */}
          <section id="nist-alignment" className="scroll-mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0048A6]/20 border border-[#0048A6]/40 text-cyan-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="font-cormorant text-3xl font-bold text-white tracking-wide">
                NIST Framework Alignment
              </h2>
            </div>

            <p className="text-white/70 font-inter text-base">
              Baitlock is designed to support enterprise compliance and security postures aligned with NIST guidelines.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Detect */}
              <div
                className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md space-y-3"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" /> Detect Function
                </div>
                <p className="font-inter text-sm text-white/80 leading-relaxed">
                  Baitlock fulfills continuous monitoring requirements by analyzing network traffic and user inputs in real-time. The anomaly detection capabilities provide proactive identification of malicious code, unauthorized execution, and spoofed domains.
                </p>
              </div>

              {/* Protect */}
              <div
                className="p-6 rounded-xl border border-blue-500/30 bg-blue-950/20 backdrop-blur-md space-y-3"
              >
                <div className="flex items-center gap-2 text-blue-400 font-mono text-sm font-bold uppercase tracking-wider">
                  <Shield className="w-4 h-4" /> Protect Function
                </div>
                <p className="font-inter text-sm text-white/80 leading-relaxed">
                  By blocking high-risk URLs and flagging anomalous transactions before they are processed, Baitlock acts as an access control and protective mechanism. It limits the attack surface available to malicious actors attempting to exploit end users.
                </p>
              </div>

              {/* Respond */}
              <div
                className="p-6 rounded-xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-md space-y-3"
              >
                <div className="flex items-center gap-2 text-amber-400 font-mono text-sm font-bold uppercase tracking-wider">
                  <Zap className="w-4 h-4" /> Respond Function
                </div>
                <p className="font-inter text-sm text-white/80 leading-relaxed">
                  The system generates immediate alerts and writes every event to a persistent audit log. This supports incident response teams by providing the contextual data required for mitigation, recovery, and post-incident analysis.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 4: NIST SP 800-63B ALIGNMENT */}
          <section id="nist-800-63b" className="scroll-mt-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0048A6]/20 border border-[#0048A6]/40 text-cyan-400">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="font-cormorant text-3xl font-bold text-white tracking-wide">
                NIST SP 800-63B Digital Identity Alignment
              </h2>
            </div>

            <div
              className="p-6 lg:p-8 rounded-xl border border-white/10 shadow-xl leading-relaxed text-white/80 font-inter text-base space-y-4"
              style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}
            >
              <p>
                Phishing attacks frequently target user credentials. Baitlock aligns with NIST Special Publication 800-63B by actively mitigating credential harvesting attempts.
              </p>
              <p>
                The LLM cascade layer specifically analyzes page text for credential input forms and deceptive prompts. By identifying and blocking these phishing vectors at the network edge or browser level, Baitlock supports the integrity of digital identity systems and reduces the risk of credential compromise.
              </p>
            </div>
          </section>

          {/* SECTION 5: LOCAL INSTALLATION FROM GITHUB */}
          <section id="local-installation" className="scroll-mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0048A6]/20 border border-[#0048A6]/40 text-cyan-400">
                <GitBranch className="w-6 h-6" />
              </div>
              <h2 className="font-cormorant text-3xl font-bold text-white tracking-wide">
                Local Installation
              </h2>
            </div>

            <p className="text-white/70 font-inter text-base">
              To deploy the Baitlock platform locally, download the source code package and configure the environment.
            </p>

            <div
              className="p-6 lg:p-8 rounded-xl border border-white/10 shadow-xl space-y-6"
              style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}
            >
              <div className="space-y-4 font-inter text-sm">
                {/* Step 1 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    1
                  </span>
                  <p className="text-white/90 font-medium pt-1">
                    Open a terminal window on your local machine.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    2
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-white/90 font-medium">
                      Clone the repository from GitHub using the git clone command followed by the repository URL.
                    </p>
                    <div className="flex items-center justify-between p-2.5 rounded bg-black/60 font-mono text-xs text-cyan-300 border border-white/10">
                      <span>cd baitlock</span>
                      <button
                        onClick={() => copyToClipboard("cd baitlock", "cd-baitlock")}
                        className="text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedStep === "cd-baitlock" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    3
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-white/90 font-medium">
                      Navigate into the newly created Baitlock project directory.
                    </p>
                    <div className="flex items-center justify-between p-2.5 rounded bg-black/60 font-mono text-xs text-cyan-300 border border-white/10">
                      <span>cd baitlock</span>
                      <button
                        onClick={() => copyToClipboard("cd baitlock", "cd-baitlock")}
                        className="text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedStep === "cd-baitlock" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    4
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-white/90 font-medium">
                      Set up the backend environment by creating a Python virtual environment and installing the required dependencies from the requirements file.
                    </p>
                    <div className="flex items-center justify-between p-2.5 rounded bg-black/60 font-mono text-xs text-cyan-300 border border-white/10">
                      <span>cd server &amp;&amp; uv sync</span>
                      <button
                        onClick={() => copyToClipboard("cd server && uv sync", "backend-setup")}
                        className="text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedStep === "backend-setup" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    5
                  </span>
                  <p className="text-white/90 font-medium pt-1">
                    Configure your local environment variables, including your database connection string and the API key for the large language model. The system will gracefully degrade if the API key is omitted.
                  </p>
                </div>

                {/* Step 6 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    6
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-white/90 font-medium">
                      Initialize the database schema and start the FastAPI backend server. Ensure the server is running on local port eight thousand.
                    </p>
                    <div className="flex items-center justify-between p-2.5 rounded bg-black/60 font-mono text-xs text-cyan-300 border border-white/10">
                      <span>uv run fastapi dev main.py</span>
                      <button
                        onClick={() => copyToClipboard("uv run fastapi dev main.py", "start-backend")}
                        className="text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedStep === "start-backend" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 7 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    7
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-white/90 font-medium">
                      Navigate to the frontend dashboard directory, install the Node.js dependencies, and start the development server.
                    </p>
                    <div className="flex items-center justify-between p-2.5 rounded bg-black/60 font-mono text-xs text-cyan-300 border border-white/10">
                      <span>cd client &amp;&amp; npm install &amp;&amp; npm run dev</span>
                      <button
                        onClick={() => copyToClipboard("cd client && npm install && npm run dev", "start-frontend")}
                        className="text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedStep === "start-frontend" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6: INSTALL EXTENSION */}
          <section id="extension-install" className="scroll-mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0048A6]/20 border border-[#0048A6]/40 text-cyan-400">
                <Download className="w-6 h-6" />
              </div>
              <h2 className="font-cormorant text-3xl font-bold text-white tracking-wide">
                Install Extension
              </h2>
            </div>

            <p className="text-white/70 font-inter text-base">
              The Baitlock browser extension operates locally for the demo environment. It monitors page navigations, extracts URLs and page text, and forwards this data to the local backend for analysis.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center py-2">
              <a
                href="/baitlock-extension.zip"
                download
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-linear-to-r from-[#003882] to-[#0048A6] text-white font-inter text-base font-semibold hover:brightness-110 transition-all border border-white/10 shadow-[0_0_15px_rgba(0,56,130,0.5)]"
              >
                <Download className="w-5 h-5 text-cyan-400" />
                <span>Download Baitlock Extension Package</span>
              </a>
            </div>

            <div
              className="p-6 lg:p-8 rounded-xl border border-white/10 shadow-xl space-y-6"
              style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}
            >
              <h3 className="font-cormorant text-2xl font-bold text-white">
                To install the extension:
              </h3>

              <div className="space-y-4 font-inter text-sm">
                {/* Step 1 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    1
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-white/90 font-medium">
                      Ensure the Baitlock backend server is running locally on port eight thousand.
                    </p>
                    <div className="flex items-center justify-between p-2.5 rounded bg-black/60 font-mono text-xs text-cyan-300 border border-white/10">
                      <span>uv run fastapi dev main.py</span>
                      <button
                        onClick={() => copyToClipboard("uv run fastapi dev main.py", "ext-step-1")}
                        className="text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedStep === "ext-step-1" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    2
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-white/90 font-medium">
                      Open Google Chrome and navigate to the extensions management page by entering chrome slash extensions in the address bar.
                    </p>
                    <div className="flex items-center justify-between p-2.5 rounded bg-black/60 font-mono text-xs text-cyan-300 border border-white/10">
                      <span>chrome://extensions</span>
                      <button
                        onClick={() => copyToClipboard("chrome://extensions", "ext-step-2")}
                        className="text-white/50 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedStep === "ext-step-2" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    3
                  </span>
                  <p className="text-white/90 font-medium pt-1">
                    Enable Developer Mode using the toggle switch located in the top right corner of the extensions page.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    4
                  </span>
                  <p className="text-white/90 font-medium pt-1">
                    Click the Load Unpacked button in the top left corner.
                  </p>
                </div>

                {/* Step 5 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    5
                  </span>
                  <p className="text-white/90 font-medium pt-1">
                    Extract the downloaded Baitlock Extension Package, then select its <code className="rounded bg-white/10 px-1.5 py-0.5 text-cyan-200">extension</code> directory.
                  </p>
                </div>

                {/* Step 6 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <span className="w-7 h-7 rounded-full bg-[#0048A6] text-white flex items-center justify-center font-bold font-mono shrink-0">
                    6
                  </span>
                  <p className="text-white/90 font-medium pt-1">
                    The extension will activate automatically. Pin the Baitlock icon to your browser toolbar. As you browse, the extension will evaluate pages and update its icon color to reflect the current threat tier.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
