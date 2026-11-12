"use client";
import BrandMark from "@/components/BrandMark";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
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
                window.postMessage({ type: 'BAITLOCK_LOGIN', token: loginData.access_token }, window.location.origin);
                router.push('/dashboard');
            } else {
                router.push('/login');
            }
        } catch {
            setError("Network error. Is the server running?");
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
                        Create your account
                    </h1>
                    <p className="text-sm text-muted-foreground mb-8 text-center">
                        Join Baitlock and shield your traffic in minutes.
                    </p>

                    <div className="w-full surface-panel p-7">
                        <form className="flex flex-col gap-5 w-full" onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>

                            {error && <div className="text-destructive text-sm font-medium text-center bg-destructive/10 py-2.5 px-3.5 rounded-lg border border-destructive/25">{error}</div>}

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-[13px] font-medium text-foreground">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full h-11 input-base px-3.5 text-sm"
                                />
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-[13px] font-medium text-foreground">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-11 input-base px-3.5 text-sm"
                                />
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                                <label className="text-[13px] font-medium text-foreground">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-11 input-base px-3.5 text-sm"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between w-full mt-1 gap-4">
                                <Link href="/login" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium">
                                    Already have an account? Sign in
                                </Link>

                                <button type="submit" disabled={loading} className="w-full sm:w-auto px-6 h-11 btn-primary rounded-lg text-sm font-medium">
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
