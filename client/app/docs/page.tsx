import DocsContent from "@/components/DocsContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation - Baitlock",
  description: "Baitlock Phishing & Fraud Detection Documentation, Architecture, and Extension Installation",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen w-full flex flex-col max-w-[1920px] mx-auto relative z-10 fade-in">
      <DocsContent isDashboard={false} />
    </div>
  );
}
