"use client";
import BrandMark from "@/components/BrandMark";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { API_V1_URL, apiError } from '@/lib/api';

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
                    const message = apiError(data.detail, 'Registration failed');
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
                    window.postMessage({ type: 'BAITLOCK_LOGIN', token: loginData.access_token }, window.location.origin);
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
                    const message = apiError(data.detail, 'Invalid credentials');
                    setError(message);
                    setLoading(false);
                    return;
                }
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('isLoggedIn', 'true');
                window.postMessage({ type: 'BAITLOCK_LOGIN', token: data.access_token }, window.location.origin);
                router.push('/dashboard');
            }
        } catch {
            setError('Could not connect to server. Make sure the backend is running.');
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col w-full min-h-screen bg-background text-foreground fade-in">
            <header className="flex justify-between items-center w-full px-6 sm:px-8 py-5">
                <Link href="/" className="flex items-center gap-2.5">
                    <BrandMark />
                    <span className="text-lg font-semibold tracking-tight">Baitlock</span>
                </Link>
                <ThemeToggle />
            </header>

            <main className="flex-1 flex items-center justify-center px-4 pb-16">
                <div className="flex flex-col items-center w-full max-w-sm">
                    <h1 className="text-[28px] font-semibold tracking-tight mb-1.5 text-center">
                        {isRegister ? 'Create your account' : 'Welcome back'}
                    </h1>
                    <p className="text-sm text-muted-foreground mb-8 text-center">
                        {isRegister ? 'Set up your Baitlock security console.' : 'Sign in to your Baitlock security console.'}
                    </p>

                    <div className="w-full surface-panel p-7">
                        <form className="flex flex-col gap-5 w-full" onSubmit={handleSubmit}>

                            {/* Error / Success messages */}
                            {error && (
                                <div className="px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-sm font-medium">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="px-3.5 py-2.5 rounded-lg bg-success/10 border border-success/25 text-success text-sm font-medium">
                                    {success}
                                </div>
                            )}

                            {/* Full Name (register only) */}
                            {isRegister && (
                                <div className="flex flex-col gap-2 w-full">
                                    <label className="text-[13px] font-medium text-foreground">Full Name</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full h-11 input-base px-3.5 text-sm"
                                    />
                                </div>
                            )}

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-[13px] font-medium text-foreground">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className="w-full h-11 input-base px-3.5 text-sm"
                                />
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-[13px] font-medium text-foreground">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                    className="w-full h-11 input-base px-3.5 text-sm"
                                />
                            </div>

                            <div className="flex flex-col items-center gap-4 w-full mt-1">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-11 btn-primary rounded-lg text-sm font-medium flex items-center justify-center disabled:cursor-not-allowed"
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
                                    className="text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium"
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
