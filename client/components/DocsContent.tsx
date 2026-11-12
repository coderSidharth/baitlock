"use client";
import React, { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import BrandMark from "@/components/BrandMark";
import {
  Shield,
  Layers,
  Cpu,
  Sparkles,
  CheckCircle2,
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

function StepNum({ n }: { n: number }) {
  return (
    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold font-mono text-sm shrink-0">
      {n}
    </span>
  );
}

function CodeLine({ cmd, id, copiedStep, onCopy }: { cmd: string; id: string; copiedStep: string | null; onCopy: (text: string, id: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-muted border border-border font-mono text-xs text-foreground">
      <span className="break-all">{cmd}</span>
      <button
        onClick={() => onCopy(cmd, id)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        aria-label="Copy command"
      >
        {copiedStep === id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

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
        <header className="flex justify-between items-center w-full px-6 sm:px-8 py-4 border-b border-border mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
            <span className="text-border">|</span>
            <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"><BrandMark />Baitlock Docs</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg btn-primary text-sm font-medium"
            >
              Go to Dashboard
            </Link>
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Main Container */}
      <div className={`flex-1 flex flex-col lg:flex-row gap-8 ${isDashboard ? "pt-2 min-h-0" : "px-6 sm:px-8 pb-12"}`}>
        {/* Sidebar Nav */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 input-base text-sm"
            />
          </div>

          {/* Navigation Items */}
          <div className="surface-panel p-2 flex flex-col gap-0.5">
            <div className="px-3 py-2 text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
              Documentation
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    isActive
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="truncate">{sec.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-0"}`} />
                </button>
              );
            })}
          </div>

          {/* Key Specs Widget */}
          <div className="surface-panel p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
              <Zap className="w-3.5 h-3.5" /> System Metrics
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between py-1 border-b border-border">
                <span>Latency</span>
                <span className="font-mono text-foreground font-medium">&lt; 1ms (Layer 1)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span>URL Model</span>
                <span className="font-mono text-foreground font-medium">Gradient Boosting</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Framework</span>
                <span className="font-mono text-foreground font-medium">NIST CSF Aligned</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-24 pr-1 space-y-12 custom-scrollbar max-w-3xl">
          {/* Page Title */}
          <div className="flex flex-col gap-3 pb-6 border-b border-border">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted border border-border text-muted-foreground text-xs font-medium w-fit">
              <BookOpen className="w-3.5 h-3.5" /> Official Documentation
            </div>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">
              Baitlock Documentation
            </h1>
            <p className="text-muted-foreground text-base">
              Architecture, detection layers, compliance guidelines, local setup, and extension installation manual.
            </p>
          </div>

          {/* SECTION 1: OVERVIEW */}
          <section id="overview" className="scroll-mt-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted border border-border text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
            </div>
            <div className="surface-panel p-6 leading-relaxed text-muted-foreground text-[15px] space-y-4">
              <p>
                Baitlock is a real-time, AI-powered phishing and fraud detection platform. It provides immediate analysis of URLs and financial transactions to block malicious activity before it reaches the end user.
              </p>
              <p>
                By utilizing a tiered detection model, Baitlock balances sub-millisecond response times with deep contextual analysis. The architecture is mapped to the National Institute of Standards and Technology Cybersecurity Framework, specifically focusing on the Identify, Protect, and Detect functions to ensure a standardized approach to threat mitigation.
              </p>
            </div>
          </section>

          {/* SECTION 2: HOW IT WORKS */}
          <section id="architecture" className="scroll-mt-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted border border-border text-primary">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">How it Works</h2>
            </div>

            <p className="text-muted-foreground text-[15px]">
              Baitlock does not rely on a single model for every request. Instead, it uses a three-layer cascade architecture to optimize for speed, cost, and accuracy. When a URL or transaction is checked, it passes through the following layers.
            </p>

            {/* 3 Cascade Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Layer One */}
              <div className="surface-panel p-5 flex flex-col justify-between hover-lift">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-foreground font-semibold border border-border uppercase">
                      Layer 1
                    </span>
                    <Zap className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Rule Engine</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Every request first passes through deterministic checks. For URLs, the system analyzes the top-level domain against a blocklist, calculates Shannon entropy to detect randomly generated domains, and uses Levenshtein distance to identify brand impersonation such as distinguishing between a legitimate domain and a spoofed variant. For transactions, the engine verifies the transaction amount against a fixed amount limit and checks the frequency of recent activity.
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-border font-mono text-xs text-muted-foreground">
                  Latency: &lt; 1ms
                </div>
              </div>

              {/* Layer Two */}
              <div className="surface-panel p-5 flex flex-col justify-between hover-lift">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-foreground font-semibold border border-border uppercase">
                      Layer 2
                    </span>
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Machine Learning Classifier</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    If the rule engine does not immediately flag the input as highly critical, the data is passed to a machine learning model. The URL classifier is a gradient-boosted model trained on 200,000 URLs drawn from PhishTank, the Phishing.Database live feed and public benign corpora, and evaluated only on domains it never saw during training. A domain-reputation layer keeps established sites from being blocked on URL shape alone. Transaction screening uses deterministic rules by default. The synthetic Isolation Forest model is an optional development demo and is disabled in production.
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-border font-mono text-xs text-muted-foreground">
                  URL classifier &amp; transaction rules
                </div>
              </div>

              {/* Layer Three */}
              <div className="surface-panel p-5 flex flex-col justify-between hover-lift">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-foreground font-semibold border border-border uppercase">
                      Layer 3
                    </span>
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">LLM Cascade</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    If the composite score from the rule engine and the machine learning model falls within an ambiguous band, typically a score between forty and eighty-five, the system escalates the analysis. If page text is available, a large language model analyzes the content for brand spoofing, urgency language, and credential harvesting intent. This deliberate escalation ensures that expensive and latency-heavy API calls are only made when deterministic systems are uncertain.
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-border font-mono text-xs text-muted-foreground">
                  Escalation Score: 40 - 85
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: NIST FRAMEWORK ALIGNMENT */}
          <section id="nist-alignment" className="scroll-mt-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted border border-border text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">NIST Framework Alignment</h2>
            </div>

            <p className="text-muted-foreground text-[15px]">
              Baitlock is designed to support enterprise compliance and security postures aligned with NIST guidelines.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Detect */}
              <div className="surface-panel p-5 space-y-3">
                <div className="flex items-center gap-2 text-success font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Detect Function
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Baitlock fulfills continuous monitoring requirements by analyzing network traffic and user inputs in real-time. The anomaly detection capabilities provide proactive identification of malicious code, unauthorized execution, and spoofed domains.
                </p>
              </div>

              {/* Protect */}
              <div className="surface-panel p-5 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <Shield className="w-4 h-4" /> Protect Function
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  By blocking high-risk URLs and flagging anomalous transactions before they are processed, Baitlock acts as an access control and protective mechanism. It limits the attack surface available to malicious actors attempting to exploit end users.
                </p>
              </div>

              {/* Respond */}
              <div className="surface-panel p-5 space-y-3">
                <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                  <Zap className="w-4 h-4" /> Respond Function
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The system generates immediate alerts and writes every event to a persistent audit log. This supports incident response teams by providing the contextual data required for mitigation, recovery, and post-incident analysis.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 4: NIST SP 800-63B ALIGNMENT */}
          <section id="nist-800-63b" className="scroll-mt-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted border border-border text-primary">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">NIST SP 800-63B Digital Identity Alignment</h2>
            </div>

            <div className="surface-panel p-6 leading-relaxed text-muted-foreground text-[15px] space-y-4">
              <p>
                Phishing attacks frequently target user credentials. Baitlock aligns with NIST Special Publication 800-63B by actively mitigating credential harvesting attempts.
              </p>
              <p>
                The LLM cascade layer specifically analyzes page text for credential input forms and deceptive prompts. By identifying and blocking these phishing vectors at the network edge or browser level, Baitlock supports the integrity of digital identity systems and reduces the risk of credential compromise.
              </p>
            </div>
          </section>

          {/* SECTION 5: LOCAL INSTALLATION FROM GITHUB */}
          <section id="local-installation" className="scroll-mt-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted border border-border text-primary">
                <GitBranch className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Local Installation</h2>
            </div>

            <p className="text-muted-foreground text-[15px]">
              To deploy the Baitlock platform locally, download the source code package and configure the environment.
            </p>

            <div className="surface-panel p-6 space-y-4">
              {/* Step 1 */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <StepNum n={1} />
                <p className="text-foreground text-sm font-medium pt-1">
                  Open a terminal window on your local machine.
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <StepNum n={2} />
                <div className="flex-1 space-y-2">
                  <p className="text-foreground text-sm font-medium">
                    Clone the repository from GitHub using the git clone command followed by the repository URL.
                  </p>
                  <CodeLine cmd="git clone YOUR_REPOSITORY_URL baitlock" id="cd-baitlock" copiedStep={copiedStep} onCopy={copyToClipboard} />
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <StepNum n={3} />
                <div className="flex-1 space-y-2">
                  <p className="text-foreground text-sm font-medium">
                    Navigate into the newly created Baitlock project directory.
                  </p>
                  <CodeLine cmd="cd baitlock" id="cd-baitlock-2" copiedStep={copiedStep} onCopy={copyToClipboard} />
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <StepNum n={4} />
                <div className="flex-1 space-y-2">
                  <p className="text-foreground text-sm font-medium">
                    Set up the backend environment by creating a Python virtual environment and installing the locked dependencies with uv.
                  </p>
                  <CodeLine cmd="cd server && uv sync" id="backend-setup" copiedStep={copiedStep} onCopy={copyToClipboard} />
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <StepNum n={5} />
                <p className="text-foreground text-sm font-medium pt-1">
                  Configure your local environment variables, including your database connection string and the API key for the large language model. The system will gracefully degrade if the API key is omitted.
                </p>
              </div>

              {/* Step 6 */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <StepNum n={6} />
                <div className="flex-1 space-y-2">
                  <p className="text-foreground text-sm font-medium">
                    Run uv run alembic upgrade head from server/ before starting the API. For an existing database, follow the backup and repair procedure in README.md. The API runs on port 8000.
                  </p>
                  <CodeLine cmd="uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" id="start-backend" copiedStep={copiedStep} onCopy={copyToClipboard} />
                </div>
              </div>

              {/* Step 7 */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <StepNum n={7} />
                <div className="flex-1 space-y-2">
                  <p className="text-foreground text-sm font-medium">
                    In a new terminal from the project root, install the dashboard dependencies and start the development server.
                  </p>
                  <CodeLine cmd="cd client && npm ci && npm run dev" id="start-frontend" copiedStep={copiedStep} onCopy={copyToClipboard} />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6: INSTALL EXTENSION */}
          <section id="extension-install" className="scroll-mt-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted border border-border text-primary">
                <Download className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Install Extension</h2>
            </div>

            <p className="text-muted-foreground text-[15px]">
              The Baitlock browser extension operates locally for the demo environment. It monitors page navigations, extracts URLs and page text, and forwards this data to the local backend for analysis.
            </p>

            <div className="py-1">
              <a
                href="/baitlock-extension.zip"
                download
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-lg btn-primary text-[15px] font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Download Baitlock Extension Package</span>
              </a>
            </div>

            <div className="surface-panel p-6 space-y-5">
              <h3 className="text-lg font-semibold">To install the extension:</h3>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <StepNum n={1} />
                  <div className="flex-1 space-y-2">
                    <p className="text-foreground text-sm font-medium">
                      Ensure the Baitlock backend server is running locally on port eight thousand.
                    </p>
                    <CodeLine cmd="uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" id="ext-step-1" copiedStep={copiedStep} onCopy={copyToClipboard} />
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <StepNum n={2} />
                  <div className="flex-1 space-y-2">
                    <p className="text-foreground text-sm font-medium">
                      Open Google Chrome and navigate to the extensions management page by entering chrome slash extensions in the address bar.
                    </p>
                    <CodeLine cmd="chrome://extensions" id="ext-step-2" copiedStep={copiedStep} onCopy={copyToClipboard} />
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <StepNum n={3} />
                  <p className="text-foreground text-sm font-medium pt-1">
                    Enable Developer Mode using the toggle switch located in the top right corner of the extensions page.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <StepNum n={4} />
                  <p className="text-foreground text-sm font-medium pt-1">
                    Click the Load Unpacked button in the top left corner.
                  </p>
                </div>

                {/* Step 5 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <StepNum n={5} />
                  <p className="text-foreground text-sm font-medium pt-1">
                    Extract the downloaded package, then select the extracted folder containing <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono text-[13px] border border-border">manifest.json</code>.
                  </p>
                </div>

                {/* Step 6 */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <StepNum n={6} />
                  <p className="text-foreground text-sm font-medium pt-1">
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
