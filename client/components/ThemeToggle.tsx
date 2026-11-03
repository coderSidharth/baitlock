"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
    const [dark, setDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setDark(document.documentElement.classList.contains("dark"));
    }, []);

    const toggle = () => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
            localStorage.setItem("theme", next ? "dark" : "light");
        } catch {
            /* ignore storage errors */
        }
        setDark(next);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label="Toggle color theme"
            title={mounted ? (dark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer ${className}`}
        >
            {mounted && dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
    );
}
