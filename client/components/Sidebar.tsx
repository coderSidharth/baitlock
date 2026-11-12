"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import BrandMark from "@/components/BrandMark";
import { LayoutDashboard, ShieldHalf, Activity, BookOpen, LogOut, PanelLeftClose, PanelLeftOpen, User } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { API_V1_URL } from "@/lib/api";

const navItems = [
    { href: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
    { href: "/dashboard/profile", icon: <User size={18} />, label: "Profile" },
    { href: "/dashboard/overrides", icon: <ShieldHalf size={18} />, label: "Overrides" },
    { href: "/dashboard/live-feed", icon: <Activity size={18} />, label: "Live feed" },
    { href: "/dashboard/docs", icon: <BookOpen size={18} />, label: "Docs" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            router.push('/login');
        }
    }, [router]);

    const handleLogout = async () => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                await fetch(`${API_V1_URL}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error(e);
            }
        }
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('access_token');
        window.postMessage({ type: 'BAITLOCK_LOGOUT' }, window.location.origin);
        router.push('/login');
    };

    return (
        <aside className={`shrink-0 h-auto lg:h-full flex flex-col justify-between relative transition-all duration-200 ${isCollapsed ? 'w-full lg:w-20 p-4' : 'w-full lg:w-60 p-4 lg:p-5'} bg-card border-r border-b lg:border-b-0 border-border z-20`}>
            <div className="w-full flex flex-col h-full">
                <div className={`flex ${isCollapsed ? 'flex-col gap-4 items-center justify-start' : 'flex-row items-center justify-between'} mb-2 lg:mb-8`}>
                    {!isCollapsed && (
                        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                            <BrandMark />
                            <span className="text-lg font-semibold tracking-tight text-foreground">Baitlock</span>
                        </Link>
                    )}

                    <div className="flex items-center gap-1">
                        {/* Mobile Logout Button */}
                        <button onClick={handleLogout} aria-label="Logout" className="lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-accent transition-colors">
                            <LogOut size={18} strokeWidth={2} />
                        </button>

                        {/* Desktop Toggle Button */}
                        <button onClick={() => setIsCollapsed(!isCollapsed)} aria-label="Toggle sidebar" className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-accent transition-colors hidden lg:block cursor-pointer">
                            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                        </button>
                    </div>

                    {isCollapsed && (
                        <Link href="/" aria-label="Baitlock home" className="block hover:opacity-80 transition-opacity">
                            <BrandMark />
                        </Link>
                    )}
                </div>

                <nav className="flex flex-row lg:flex-col gap-1 flex-wrap lg:flex-nowrap pb-2 lg:pb-0 justify-center lg:justify-start">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href}
                                title={isCollapsed ? item.label : undefined}
                                className={`shrink-0 lg:w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg transition-colors cursor-pointer
                    ${isActive ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 font-normal'}`}>
                                <span className={`flex items-center justify-center ${isActive ? 'text-primary' : ''}`}>
                                    {item.icon}
                                </span>
                                {!isCollapsed && <span className="text-sm whitespace-nowrap">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom controls (desktop) */}
                <div className={`hidden lg:flex mt-auto pt-2 border-t border-border ${isCollapsed ? 'flex-col items-center gap-2' : 'flex-row items-center justify-between gap-2'}`}>
                    <button onClick={handleLogout} title={isCollapsed ? "Logout" : undefined} className={`shrink-0 flex items-center ${isCollapsed ? 'justify-center w-9 h-9' : 'flex-1 gap-3 px-3 py-2'} text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer`}>
                        <LogOut size={18} strokeWidth={2} />
                        {!isCollapsed && <span className="text-sm whitespace-nowrap">Logout</span>}
                    </button>
                    <ThemeToggle />
                </div>
            </div>
        </aside>
    );
}
