"use client";
import { User, Mail, Shield, Bell, Key, ShieldCheck, HardDrive, Smartphone, Save, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<{id: number, ip_address: string, created_at: string}[]>([]);
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const token = localStorage.getItem('access_token');
        if (!token) {
          setLoading(false);
          window.location.href = '/login';
          return;
        }

        const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setEmail(data.email);
          setFullName(data.full_name || "Admin User");
        }
        
        const sessionsRes = await fetch(`${apiUrl}/api/v1/auth/sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (sessionsRes.ok) {
          const sData = await sessionsRes.json();
          setSessions(sData);
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('isLoggedIn');
        window.postMessage({ type: 'BAITLOCK_LOGOUT' }, '*');
        window.location.href = '/';
      } else {
        alert("Failed to delete account");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting account");
    }
  };

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-10 fade-in">
        <h2 className="font-cormorant text-[48px] md:text-[64px] leading-14.5 md:leading-19.5 font-bold tracking-tight mb-4 md:mb-0">
          User Profile
        </h2>
        <div className="flex items-center gap-4 mb-4">
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-linear-to-r from-[#003882] to-[#0048A6] text-white font-inter text-sm font-medium hover:brightness-110 transition-all border border-white/10 shadow-[0_0_12px_rgba(0,30,100,0.4)] cursor-pointer">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 min-h-0 overflow-y-auto custom-scrollbar pb-10 fade-in">
        
        {/* Left Column - Personal Info */}
        <div className="lg:col-span-5 2xl:col-span-4 flex flex-col gap-6">
          <div className="rounded-[9px] p-6 lg:p-8 relative overflow-hidden group shadow-xl flex flex-col h-full"
            style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}>
            
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-20 h-20 rounded-full bg-linear-to-tr from-blue-600 to-indigo-500 p-[2px] shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                <div className="w-full h-full bg-[#001430] rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="font-inter text-2xl font-bold text-white tracking-tight">{loading ? "Loading..." : fullName}</h3>
              </div>
            </div>

            <div className="space-y-6 relative z-10 flex-1">
              <div className="space-y-2">
                <label className="text-[13px] text-white/50 font-inter uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1E2022]/40 border border-white/10 rounded-md py-2.5 pl-11 pr-4 text-white font-inter focus:outline-none focus:border-blue-500/50 focus:bg-[#1E2022]/60 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] text-white/50 font-inter uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input 
                    type="password" 
                    value="••••••••••••"
                    readOnly
                    className="w-full bg-[#1E2022]/40 border border-white/10 rounded-md py-2.5 pl-11 pr-4 text-white font-inter cursor-not-allowed opacity-70"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 hover:text-blue-300 font-inter">
                    Change
                  </button>
                </div>
              </div>
            </div>
            
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-600/10 blur-3xl rounded-full" />
          </div>
        </div>

        {/* Right Column - Security & Settings */}
        <div className="lg:col-span-7 2xl:col-span-8 flex flex-col gap-6">
          
          {/* Active Sessions */}
          <div className="rounded-[9px] p-6 lg:p-8 relative overflow-hidden shadow-xl"
            style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}>
            <div className="flex items-center gap-3 mb-6">
              <Smartphone className="w-8 h-8 text-white/80" />
              <div>
                <h3 className="font-cormorant font-bold text-[28px] leading-8.5 tracking-tight">Active Sessions</h3>
                <p className="text-sm text-white/60 font-inter">{sessions.length} device{sessions.length === 1 ? '' : 's'} logged in.</p>
              </div>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {sessions.map(s => (
                <div key={s.id} className="flex justify-between items-center bg-[#1E2022]/40 hover:bg-[#1E2022]/60 border border-white/5 p-4 rounded-lg transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Smartphone className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white/90">{s.ip_address}</div>
                      <div className="text-xs text-white/50 font-inter">Session started on {new Date(s.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs font-mono text-green-400">
                    Active
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-center p-6 text-white/40 italic text-sm border border-white/5 rounded-lg border-dashed">
                  No active sessions found.
                </div>
              )}
            </div>
          </div>

          {/* Security Settings */}
          <div className="rounded-[9px] p-6 lg:p-8 relative overflow-hidden shadow-xl"
            style={{ background: "linear-gradient(156.55deg, #00214D -46.3%, #001C40 114.03%)" }}>
            <h3 className="font-cormorant font-bold text-[28px] leading-8.5 tracking-tight mb-6">Security Settings</h3>
            
            <div className="w-full">
              <div className="p-5 rounded-lg border border-red-500/20 bg-red-500/5 backdrop-blur-sm transition-all hover:bg-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 mt-1 md:mt-0">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white/90 text-lg mb-1">Delete Account</h4>
                    <p className="text-sm text-white/60 font-inter">Permanently remove your account and all associated data.</p>
                  </div>
                </div>
                <div className="mt-2 md:mt-0 shrink-0">
                  <button onClick={handleDeleteAccount} className="text-sm font-medium text-red-400 border border-red-500/30 px-5 py-2.5 rounded hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap w-full md:w-auto">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
