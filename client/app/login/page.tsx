"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function LoginPage() {
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (isRegister) {
                // Register
                const res = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, full_name: fullName || undefined })
                });
                const data = await res.json();
                if (!res.ok) {
                    const detail = data.detail;
                    let message = 'Registration failed';
                    if (typeof detail === 'string') {
                        message = detail;
                    } else if (Array.isArray(detail)) {
                        message = detail
                            .map((d: any) => (typeof d === 'object' && d !== null) ? (d.msg || JSON.stringify(d)) : String(d))
                            .join(', ');
                    } else if (detail && typeof detail === 'object') {
                        message = (detail as any).msg || (detail as any).message || JSON.stringify(detail);
                    }
                    setError(message);
                    setLoading(false);
                    return;
                }
                setSuccess('Account created! Signing you in...');
                // Auto-login after registration
                const formData = new URLSearchParams();
                formData.append('username', email);
                formData.append('password', password);

                const loginRes = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const loginData = await loginRes.json();
                if (loginRes.ok && loginData.access_token) {
                    localStorage.setItem('access_token', loginData.access_token);
                    localStorage.setItem('isLoggedIn', 'true');
                    window.postMessage({ type: 'BAITLOCK_LOGIN', token: loginData.access_token }, '*');
                    router.push('/dashboard');
                    return;
                }
                // If auto-login fails, let them log in manually
                setSuccess('Account created! Please sign in.');
                setIsRegister(false);
                setLoading(false);
            } else {
                // Login
                const formData = new URLSearchParams();
                formData.append('username', email);
                formData.append('password', password);

                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const data = await res.json();
                if (!res.ok) {
                    const detail = data.detail;
                    let message = 'Invalid credentials';
                    if (typeof detail === 'string') {
                        message = detail;
                    } else if (Array.isArray(detail)) {
                        message = detail
                            .map((d: any) => (typeof d === 'object' && d !== null) ? (d.msg || JSON.stringify(d)) : String(d))
                            .join(', ');
                    } else if (detail && typeof detail === 'object') {
                        message = (detail as any).msg || (detail as any).message || JSON.stringify(detail);
                    }
                    setError(message);
                    setLoading(false);
                    return;
                }
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('isLoggedIn', 'true');
                window.postMessage({ type: 'BAITLOCK_LOGIN', token: data.access_token }, '*');
                router.push('/dashboard');
            }
        } catch (err) {
            setError('Could not connect to server. Make sure the backend is running.');
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
                        {isRegister ? 'Create your account' : 'Analyze more clearly'}
                    </h2>

                    <div className="w-112.5 bg-linear-to-b from-[#0B1530] to-[#040C1F] rounded-2xl p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 backdrop-blur-xl relative z-20">
                        <form className="flex flex-col gap-6 w-full font-inter" onSubmit={handleSubmit}>

                            {/* Error / Success messages */}
                            {error && (
                                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium">
                                    {success}
                                </div>
                            )}

                            {/* Full Name (register only) */}
                            {isRegister && (
                                <div className="flex flex-col gap-2.5 w-full">
                                    <label className="text-white text-[13px] font-medium tracking-wide">Full Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent rounded-lg opacity-10 pointer-events-none shadow-inner" />
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full h-13 bg-[#222222]/80 backdrop-blur-sm rounded-md px-4 text-white border border-black focus:outline-none focus:border-[#0048A6] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] relative z-10 placeholder:text-white/20"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-2.5 w-full">
                                <label className="text-white text-[13px] font-medium tracking-wide">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent rounded-lg opacity-10 pointer-events-none shadow-inner" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full h-13 bg-[#222222]/80 backdrop-blur-sm rounded-md px-4 text-white border border-black focus:outline-none focus:border-[#0048A6] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] relative z-10 placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2.5 w-full mb-4">
                                <label className="text-white text-[13px] font-medium tracking-wide">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent rounded-lg opacity-10 pointer-events-none shadow-inner" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        className="w-full h-13 bg-[#222222]/80 backdrop-blur-sm rounded-md px-4 text-white border border-black focus:outline-none focus:border-[#0048A6] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] relative z-10 placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-5 w-full mt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-linear-to-r from-[#003882] to-[#0048A6] hover:brightness-110 transition-all rounded-md font-inter text-[15px] font-medium text-white shadow-[0_0_15px_rgba(0,30,100,0.6)] border border-white/10 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                            </svg>
                                            {isRegister ? 'Creating...' : 'Signing in...'}
                                        </span>
                                    ) : (
                                        isRegister ? 'Create Account' : 'Sign in'
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRegister(!isRegister);
                                        setError('');
                                        setSuccess('');
                                    }}
                                    className="font-inter text-white/60 hover:text-white transition-colors text-[14px] font-medium"
                                >
                                    {isRegister ? 'Already have an account? Sign in' : 'Don\'t have an account? Create one'}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
