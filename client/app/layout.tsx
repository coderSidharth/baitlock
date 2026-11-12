import type { Metadata } from "next";
import localFont from "next/font/local";
import AIChatWidget from "@/components/AIChatWidget";
import "./globals.css";

const inter = localFont({ src: "./fonts/Inter-Latin.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });
const firaCode = localFont({ src: "./fonts/FiraCode-Latin.woff2", variable: "--font-mono", weight: "300 700", display: "swap" });

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
