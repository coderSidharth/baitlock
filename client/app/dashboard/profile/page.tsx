"use client";
import { User, Mail, Shield, Key, ShieldCheck, Smartphone, Save, Trash2, Lock, Eye, EyeOff, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { errorMessage, apiError, API_BASE_URL, API_V1_URL } from "@/lib/api";

export default function ProfilePage() {
  const [originalEmail, setOriginalEmail] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);
  const [sessions, setSessions] = useState<{id: number, ip_address: string, created_at: string}[]>([]);

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const requestProfile = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { window.location.href = '/login'; return null; }
    const res = await fetch(`${API_V1_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('isLoggedIn');
      window.location.href = '/login';
      return null;
    }
    if (!res.ok) throw new Error(`Profile request failed (${res.status})`);
    const profile = await res.json();
    const sessionsRes = await fetch(`${API_V1_URL}/auth/sessions`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    const sessions = sessionsRes?.ok ? await sessionsRes.json() : [];
    return { profile, sessions };
  }, []);

  const applyProfile = useCallback((data: Awaited<ReturnType<typeof requestProfile>>) => {
    if (data) {
      setEmail(data.profile.email || "");
      setOriginalEmail(data.profile.email || "");
      setFullName(data.profile.full_name || "");
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    }
    setLoading(false);
  }, []);

  const profileError = useCallback((error: unknown) => {
    console.warn("Profile load failed:", errorMessage(error));
    setStatusMessage({ type: 'error', text: `Could not load your profile from ${API_BASE_URL}. Please retry.` });
    setLoading(false);
  }, []);

  const fetchProfile = () => requestProfile().then(applyProfile).catch(profileError);
  useEffect(() => {
    let active = true;
    requestProfile().then(data => { if (active) applyProfile(data); }).catch(error => { if (active) profileError(error); });
    return () => { active = false; };
  }, [requestProfile, applyProfile, profileError]);

  const handleSaveChanges = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch(`${API_V1_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          full_name: fullName,
          current_password: currentPassword || undefined
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setEmail(updated.email || email);
        setOriginalEmail(updated.email || email);
        setCurrentPassword("");
        setFullName(updated.full_name || fullName);
        setStatusMessage({ type: 'success', text: 'Profile changes saved successfully!' });
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMessage({ type: 'error', text: apiError(errData.detail, 'Failed to update profile.') });
      }
    } catch (e: unknown) {
      console.warn("Failed to save profile:", errorMessage(e));
      setStatusMessage({ type: 'error', text: 'Network error saving changes. Please check if the backend is running.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const payload: Record<string, string> = {
        password: newPassword
      };
      if (currentPassword) {
        payload.current_password = currentPassword;
      }

      const res = await fetch(`${API_V1_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('isLoggedIn');
        window.postMessage({ type: 'BAITLOCK_LOGOUT' }, window.location.origin);
        setPasswordSuccess("Password updated. Please sign in again.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          window.location.href = "/login";
          setShowPasswordModal(false);
          setPasswordSuccess(null);
          setStatusMessage({
            type: 'success',
            text: 'Security credentials updated: Password successfully changed.'
          });
        }, 1200);
      } else {
        const errData = await res.json().catch(() => ({}));
        setPasswordError(apiError(errData.detail, "Failed to update password."));
      }
    } catch (err: unknown) {
      console.warn("Password change error:", errorMessage(err));
      setPasswordError("Network error. Please make sure the backend server is reachable.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_V1_URL}/auth/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: deletePassword })
      });
      if (res.ok) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('isLoggedIn');
        window.postMessage({ type: 'BAITLOCK_LOGOUT' }, window.location.origin);
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
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">User Profile</h1>
          <p className="text-muted-foreground text-sm">Manage your account credentials, security settings, and active sessions.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveChanges}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg btn-primary text-sm font-medium cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </header>

      {statusMessage && (
        <div className={`mb-6 p-4 rounded-lg flex items-center justify-between border ${
          statusMessage.type === 'success'
            ? 'bg-success/10 border-success/30 text-success'
            : statusMessage.type === 'warning'
            ? 'bg-warning/10 border-warning/30 text-warning'
            : 'bg-destructive/10 border-destructive/30 text-destructive'
        }`}>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 shrink-0" />
            <span className="text-sm">{statusMessage.text}</span>
          </div>
          {statusMessage.type === 'warning' && (
            <button
              onClick={() => { setLoading(true); setStatusMessage(null); fetchProfile(); }}
              className="px-3 py-1 text-xs font-semibold rounded-md bg-warning/15 hover:bg-warning/25 border border-warning/30 transition-colors"
            >
              Retry Connection
            </button>
          )}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto custom-scrollbar pb-10 fade-in">

        {/* Left Column - Personal Info */}
        <div className="lg:col-span-5 2xl:col-span-4 flex flex-col gap-5">
          <div className="surface-panel p-6 flex flex-col h-full">

            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">{loading ? "Loading..." : (fullName || "Admin User")}</h3>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Baitlock Administrator</span>
              </div>
            </div>

            <div className="space-y-5 flex-1">
              <div className="space-y-2">
                <label className="text-[13px] text-muted-foreground font-medium">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    placeholder="Enter your full name"
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full input-base py-2.5 pl-10 pr-4 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] text-muted-foreground font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    placeholder="admin@baitlock.local"
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full input-base py-2.5 pl-10 pr-4 text-sm"
                  />
                </div>
              </div>

              {email !== originalEmail && (
                <label className="block text-sm">Current password to change email
                  <input type="password" autoComplete="current-password" value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)} className="w-full input-base p-2 mt-2" />
                </label>
              )}
              <div className="space-y-2">
                <label className="text-[13px] text-muted-foreground font-medium">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value="••••••••••••"
                    readOnly
                    className="w-full input-base py-2.5 pl-10 pr-24 text-sm cursor-not-allowed text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordError(null);
                      setPasswordSuccess(null);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setShowPasswordModal(true);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-primary hover:underline px-2 py-1 rounded transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Security & Settings */}
        <div className="lg:col-span-7 2xl:col-span-8 flex flex-col gap-5">

          {/* Active Sessions */}
          <div className="surface-panel p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Active Sessions</h3>
                <p className="text-sm text-muted-foreground">{sessions.length} device{sessions.length === 1 ? '' : 's'} logged in.</p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {sessions.map(s => (
                <div key={s.id} className="flex justify-between items-center bg-muted/40 hover:bg-muted border border-border p-3.5 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-mono text-sm text-foreground">{s.ip_address}</div>
                      <div className="text-xs text-muted-foreground">Session started on {new Date(s.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/25 rounded-md text-xs font-medium text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" /> Active
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-center p-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  No active sessions found.
                </div>
              )}
            </div>
          </div>

          {/* Security Settings */}
          <div className="surface-panel p-6">
            <h3 className="text-lg font-semibold tracking-tight mb-5">Security Settings</h3>

            <div className="w-full">
              <div className="p-5 rounded-lg border border-destructive/25 bg-destructive/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 border border-destructive/20">
                    <Trash2 className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-base mb-1">Delete Account</h4>
                    <p className="text-sm text-muted-foreground">Permanently remove your account and all associated data.</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <button onClick={() => setShowDeleteModal(true)} className="text-sm font-medium text-destructive border border-destructive/30 px-5 py-2.5 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer whitespace-nowrap w-full md:w-auto">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form role="dialog" aria-modal="true" aria-labelledby="delete-title" className="surface-panel p-6 w-full max-w-md space-y-4"
            onSubmit={e => { e.preventDefault(); handleDeleteAccount(); }}>
            <h2 id="delete-title" className="text-lg font-semibold">Permanently delete your account?</h2>
            <p>This removes your account and associated data. Enter your current password to confirm.</p>
            <label className="block">Current password
              <input autoFocus required type="password" autoComplete="current-password" value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)} className="w-full input-base p-2 mt-2" />
            </label>
            <button type="button" className="btn-secondary p-2 mr-3" onClick={() => { setShowDeleteModal(false); setDeletePassword(""); }}>Cancel</button>
            <button type="submit" className="btn-destructive p-2">Delete permanently</button>
          </form>
        </div>
      )}
      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-panel p-6 sm:p-7 fade-in shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Change Password</h3>
                  <p className="text-xs text-muted-foreground">Update your account credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error & Success Messages */}
            {passwordError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/25 text-success text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Current Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={currentPassword}
                    required
                    placeholder="Enter your current password"
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full input-base py-2.5 pl-10 pr-4 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    placeholder="Minimum 8 characters"
                    required
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full input-base py-2.5 pl-10 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirmPassword}
                    placeholder="Re-enter new password"
                    required
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full input-base py-2.5 pl-10 pr-4 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-2 text-sm font-medium rounded-lg btn-primary cursor-pointer flex items-center gap-2"
                >
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
