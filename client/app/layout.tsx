import type { Metadata } from "next";
import { Inter, Cormorant_Garamond, Fira_Code } from "next/font/google";
import AIChatWidget from "@/components/AIChatWidget";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-cormorant"
});
const firaCode = Fira_Code({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Baitlock | Phishing Shield",
  description: "Real-time phishing detector",
  icons: {
    icon: "/baitlock-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen text-zinc-100 font-sans overflow-x-hidden relative bg-[#09090b]"
        suppressHydrationWarning>
        
        {/* Ambient Background Elements */}
        <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"></div>
            
            {/* Ambient Glows */}
            <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-250 h-150 bg-blue-600/15 rounded-full blur-[120px] mix-blend-screen"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-150 h-150 bg-indigo-600/10 rounded-full blur-[150px] mix-blend-screen"></div>
        </div>

        {children}
        <AIChatWidget />
      </body>
    </html>
  );
}
