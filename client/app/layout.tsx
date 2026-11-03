import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import AIChatWidget from "@/components/AIChatWidget";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const firaCode = Fira_Code({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Baitlock | Phishing Shield",
  description: "Real-time phishing detector",
  icons: {
    icon: "/baitlock-logo.png",
  },
};

// Applies the saved (or system) theme before paint to avoid a flash.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased min-h-screen bg-background text-foreground font-sans overflow-x-hidden relative"
        suppressHydrationWarning>
        {children}
        <AIChatWidget />
      </body>
    </html>
  );
}
