"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiUrl}/api/v1/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full_name: fullName, email, password }),
            });
            const data = await res.json();
            
            if (!res.ok) {
                setError(data.detail || "Failed to register");
                setLoading(false);
                return;
            }

            // Auto-login after register
            const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const loginData = await loginRes.json();
            
            if (loginRes.ok && loginData.access_token) {
                localStorage.setItem('access_token', loginData.access_token);
                localStorage.setItem('isLoggedIn', 'true');
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
            <header className="flex justify-center items-center w-full mb-16 bg-linear-to-r from-transparent via-[#003882]/0 to-[#0048A6]/20 py-4 absolute top-0 left-0 right-0 z-50">
                <Link href="/">
                    <h1 className="font-cormorant text-[36px] font-bold text-white tracking-widest relative">Baitlock</h1>
                </Link>
            </header>

            <main className="flex-1 flex items-center justify-center -mt-20">
                <div className="flex flex-col items-center">
                    <h2 className="font-cormorant text-[48px] leading-16 font-bold text-white mb-8 tracking-tight text-center">
                        Create your account
                    </h2>

                    <div className="w-112.5 bg-linear-to-b from-[#0B1530] to-[#040C1F] rounded-2xl p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 backdrop-blur-xl relative z-20">
                        <form className="flex flex-col gap-5 w-full font-inter" onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
                            
                            {error && <div className="text-red-400 text-sm font-medium text-center bg-red-500/10 py-2 rounded border border-red-500/20">{error}</div>}

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-white text-[13px] font-medium tracking-wide">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent rounded-lg opacity-10 pointer-events-none shadow-inner" />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full h-12.5 bg-[#222222]/80 backdrop-blur-sm rounded-md px-4 text-white border border-black focus:outline-none focus:border-[#0048A6] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] relative z-10 placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-white text-[13px] font-medium tracking-wide">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent rounded-lg opacity-10 pointer-events-none shadow-inner" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-12.5 bg-[#222222]/80 backdrop-blur-sm rounded-md px-4 text-white border border-black focus:outline-none focus:border-[#0048A6] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] relative z-10 placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 w-full mb-2">
                                <label className="text-white text-[13px] font-medium tracking-wide">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent rounded-lg opacity-10 pointer-events-none shadow-inner" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-12.5 bg-[#222222]/80 backdrop-blur-sm rounded-md px-4 text-white border border-black focus:outline-none focus:border-[#0048A6] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] relative z-10 placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between w-full mt-2 gap-4">
                                <Link href="/login" className="font-inter text-white/80 hover:text-white transition-colors text-[14px] font-medium text-left">
                                    Already have an account? Sign in
                                </Link>

                                <button type="submit" disabled={loading} className="px-8 py-3 bg-linear-to-r from-[#003882] to-[#0048A6] hover:brightness-110 transition-all rounded-md font-inter text-[15px] font-medium text-white shadow-[0_0_15px_rgba(0,30,100,0.6)] border border-white/10 text-center disabled:opacity-50">
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
