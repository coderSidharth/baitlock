"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { API_V1_URL } from '@/lib/api';

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
                const res = await fetch(`${API_V1_URL}/auth/register`, {
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

                const loginRes = await fetch(`${API_V1_URL}/auth/login`, {
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

                const res = await fetch(`${API_V1_URL}/auth/login`, {
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
                        {isRegister ? 'Create your account' : 'Analyze more clearly'}
                    </h2>
                    <p className="font-inter text-sm text-white/50 mb-8 text-center">
                        {isRegister ? 'Set up your Baitlock security console.' : 'Sign in to your Baitlock security console.'}
                    </p>

                    <div className="w-full max-w-md surface-panel surface-panel-sheen rounded-2xl p-8 sm:p-10 relative z-20">
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
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full h-13 bg-black/40 backdrop-blur-sm rounded-xl px-4 text-white border border-white/10 focus:outline-none input-ring relative z-10 placeholder:text-white/25"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-2.5 w-full">
                                <label className="text-white text-[13px] font-medium tracking-wide">Email Address</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full h-13 bg-black/40 backdrop-blur-sm rounded-xl px-4 text-white border border-white/10 focus:outline-none input-ring relative z-10 placeholder:text-white/25"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2.5 w-full mb-4">
                                <label className="text-white text-[13px] font-medium tracking-wide">Password</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={8}
                                        className="w-full h-13 bg-black/40 backdrop-blur-sm rounded-xl px-4 text-white border border-white/10 focus:outline-none input-ring relative z-10 placeholder:text-white/25"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-5 w-full mt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 btn-primary rounded-xl font-inter text-[15px] font-semibold text-white flex items-center justify-center disabled:cursor-not-allowed"
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
