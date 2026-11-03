"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { API_V1_URL } from '@/lib/api';

export default function SignupPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSignup = async () => {
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`${API_V1_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full_name: fullName, email, password }),
            });
            const data = await res.json();
            
            if (!res.ok) {
                const detail = data.detail;
                const message = Array.isArray(detail)
                    ? detail.map((item: unknown) => typeof item === "object" && item !== null && "msg" in item ? String((item as { msg: unknown }).msg) : String(item)).join(", ")
                    : typeof detail === "string" ? detail : "Failed to register";
                setError(message);
                setLoading(false);
                return;
            }

            // Auto-login after register
            const loginRes = await fetch(`${API_V1_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const loginData = await loginRes.json();
            
            if (loginRes.ok && loginData.access_token) {
                localStorage.setItem('access_token', loginData.access_token);
                localStorage.setItem('isLoggedIn', 'true');
                window.postMessage({ type: 'BAITLOCK_LOGIN', token: loginData.access_token }, '*');
                router.push('/dashboard');
            } else {
                router.push('/login');
            }
        } catch (err) {
            setError("Network error. Is the server running?");
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col w-full min-h-screen max-w-[1920px] mx-auto relative z-10 px-8 py-10 fade-in">
            <header className="flex justify-center items-center w-full mb-16 py-5 absolute top-0 left-0 right-0 z-50">
                <Link href="/" className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                        <ShieldAlert size={18} className="text-white" strokeWidth={2} />
                    </span>
                    <h1 className="font-cormorant text-[32px] font-bold text-white tracking-widest relative">Baitlock</h1>
                </Link>
            </header>

            <main className="flex-1 flex items-center justify-center -mt-20">
                <div className="flex flex-col items-center w-full max-w-md">
                    <h2 className="font-cormorant text-[44px] sm:text-[48px] leading-tight font-bold text-white mb-2 tracking-tight text-center">
                        Create your account
                    </h2>
                    <p className="font-inter text-sm text-white/50 mb-8 text-center">
                        Join Baitlock and shield your traffic in minutes.
                    </p>

                    <div className="w-full max-w-md surface-panel surface-panel-sheen rounded-2xl p-8 sm:p-10 relative z-20">
                        <form className="flex flex-col gap-5 w-full font-inter" onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
                            
                            {error && <div className="text-red-400 text-sm font-medium text-center bg-red-500/10 py-2 rounded border border-red-500/20">{error}</div>}

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-white text-[13px] font-medium tracking-wide">Full Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full h-12.5 bg-black/40 backdrop-blur-sm rounded-xl px-4 text-white border border-white/10 focus:outline-none input-ring relative z-10 placeholder:text-white/25"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-white text-[13px] font-medium tracking-wide">Email Address</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-12.5 bg-black/40 backdrop-blur-sm rounded-xl px-4 text-white border border-white/10 focus:outline-none input-ring relative z-10 placeholder:text-white/25"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 w-full mb-2">
                                <label className="text-white text-[13px] font-medium tracking-wide">Password</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-12.5 bg-black/40 backdrop-blur-sm rounded-xl px-4 text-white border border-white/10 focus:outline-none input-ring relative z-10 placeholder:text-white/25"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between w-full mt-2 gap-4">
                                <Link href="/login" className="font-inter text-white/80 hover:text-white transition-colors text-[14px] font-medium text-left">
                                    Already have an account? Sign in
                                </Link>

                                <button type="submit" disabled={loading} className="px-8 py-3 btn-primary rounded-xl font-inter text-[15px] font-semibold text-white text-center">
                                    {loading ? 'Creating...' : 'Create account'}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
