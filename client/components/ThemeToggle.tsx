"use client";
import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

const subscribe = (notify: () => void) => {
    const observer = new MutationObserver(notify);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
};
const snapshot = () => document.documentElement.classList.contains("dark");
const serverSnapshot = () => false;

export default function ThemeToggle({ className = "" }: { className?: string }) {
    const dark = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

    const toggle = () => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
            localStorage.setItem("theme", next ? "dark" : "light");
        } catch {
            /* ignore storage errors */
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label="Toggle color theme"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer ${className}`}
        >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
    );
}
