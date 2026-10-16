"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { LayoutDashboard, ShieldHalf, Activity, BookOpen, LogOut, PanelLeftClose, PanelLeftOpen, User } from "lucide-react";

const navItems = [
    { href: "/dashboard", icon: <LayoutDashboard />, label: "Dashboard" },
    { href: "/dashboard/profile", icon: <User />, label: "Profile" },
    { href: "/dashboard/overrides", icon: <ShieldHalf />, label: "Overrides" },
    { href: "/dashboard/live-feed", icon: <Activity />, label: "Live feed" },
    { href: "/dashboard/docs", icon: <BookOpen />, label: "Docs" },
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
                await fetch('http://localhost:8000/api/v1/auth/logout', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error(e);
            }
        }
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('access_token');
        window.postMessage({ type: 'BAITLOCK_LOGOUT' }, '*');
        router.push('/login');
    };

    return (
        <aside className={`shrink-0 h-auto lg:h-full rounded-b-2xl lg:rounded-none flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-full lg:w-20 p-4' : 'w-full lg:w-60 p-4 lg:p-6'} bg-zinc-950/40 backdrop-blur-2xl border-r border-b lg:border-b-0 border-white/5 z-20`}>
            <div className="relative z-10 w-full flex flex-col h-full">
                <div className={`flex ${isCollapsed ? 'flex-col gap-4 items-center justify-start' : 'flex-row items-center justify-between'} mb-2 lg:mb-10`}>
                    {!isCollapsed && (
                        <Link href="/" className="font-inter text-2xl font-bold tracking-tight text-zinc-100 block hover:opacity-80 transition-opacity">Baitlock</Link>
                    )}
                    
                    <div className="flex items-center gap-2">
                        {/* Mobile Logout Button */}
                        <button onClick={handleLogout} className="lg:hidden text-zinc-400 hover:text-zinc-100 p-2 rounded-lg hover:bg-white/5 transition-colors">
                            <LogOut size={20} strokeWidth={2} />
                        </button>
                        
                        {/* Desktop Toggle Button */}
                        <button onClick={() => setIsCollapsed(!isCollapsed)} className="text-zinc-500 hover:text-zinc-200 transition-colors hidden lg:block">
                            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                        </button>
                    </div>

                    {isCollapsed && (
                        <Link href="/" className="block hover:opacity-80 transition-opacity">
                            <Image src="/baitlock-logo.png" alt="Baitlock" width={32} height={32} className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(37,99,235,0.4)]" />
                        </Link>
                    )}
                </div>

                <nav className="flex flex-row lg:flex-col gap-2 lg:gap-1.5 flex-wrap lg:flex-nowrap pb-2 lg:pb-0 justify-center lg:justify-start">
                    {navItems.map((item) => (
                        <Link key={item.href} href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={`shrink-0 lg:w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-2.5'} rounded-xl transition-all duration-200 cursor-pointer
                ${pathname === item.href ? 'text-zinc-100 bg-white/10 font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 font-normal'}`}>
                            <div className={`flex items-center justify-center ${pathname === item.href ? 'text-blue-400' : ''}`}>
                                {item.icon}
                            </div>
                            {!isCollapsed && <span className="font-inter text-[14px] tracking-wide whitespace-nowrap">{item.label}</span>}
                        </Link>
                    ))}
                </nav>

                {/* Desktop Logout Button */}
                <button onClick={handleLogout} title={isCollapsed ? "Logout" : undefined} className={`hidden lg:flex shrink-0 lg:w-full items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-2.5'} text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded-xl transition-colors duration-200 mt-auto cursor-pointer`}>
                    <LogOut size={isCollapsed ? 20 : 18} strokeWidth={2} />
                    {!isCollapsed && <span className="font-inter text-[14px] tracking-wide whitespace-nowrap">Logout</span>}
                </button>
            </div>
        </aside>
    );
}
