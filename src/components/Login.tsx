import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Ship, Lock, User as UserIcon, AlertCircle, RefreshCw, Database, 
  ExternalLink, KeyRound, X, Check, Copy, ChevronRight, Eye, EyeOff,
  AlertTriangle, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../utils/helpers";
import { Logo, LogoContainer } from "./Logo";
import { User, DBStatus } from "../types";
import { getDeviceId, isDeviceRegistered, formatDeviceIds } from "../utils/deviceIdentifier";

export const Login = ({ onLogin, dbStatus, onRefreshDb }: { onLogin: (token: string, user: User) => void, dbStatus: DBStatus | null, onRefreshDb?: () => Promise<any> }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      if (onRefreshDb) {
        await onRefreshDb();
      } else {
        await fetch("/api/db-status");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRetrying(false), 600);
    }
  };

  const handleCopyIp = (ip: string) => {
    if (!ip || ip === "Detecting..." || ip === "DISABLED") return;
    try {
      navigator.clipboard?.writeText(ip);
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dbStatus && !dbStatus.connected) {
      setError("Database is not connected. Please allow remote access in Hostinger or check configuration.");
      return;
    }
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (res.ok) {
          onLogin(data.token, data.user);
        } else {
          setError(data.error || data.details || "Login failed");
        }
      } else {
        setError(`Unexpected server response (${res.status})`);
      }
    } catch (err) {
      setError("Connection error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
      {dbStatus && !dbStatus.connected && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mb-6 bg-red-50 border border-red-200 p-4 rounded-2xl flex flex-col gap-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-red-800">Database Connection Required</h3>
                <p className="text-xs text-red-600 mt-1">{dbStatus.error || "Could not reach MySQL server (ETIMEDOUT)."}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-2.5 py-1 text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Test connection now"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRetrying && "animate-spin")} />
              <span>{isRetrying ? "Testing..." : "Retry"}</span>
            </button>
          </div>
          
          <div className="bg-white/70 p-3 rounded-xl border border-red-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2">Target Configuration</p>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-red-800">
              <div>Host: <span className="font-bold">{dbStatus.config?.host || "localhost"}</span></div>
              <div>Port: <span className="font-bold">{dbStatus.config?.port || 3306}</span></div>
              <div>User: <span className="font-bold">{dbStatus.config?.user || "root"}</span></div>
              <div>DB: <span className="font-bold">{dbStatus.config?.database || "vessel_cert"}</span></div>
              <div className="col-span-2 mt-1 pt-2 border-t border-red-200/50 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span>Port 3306 (MySQL):</span>
                  <span className={cn("font-bold px-1.5 py-0.5 rounded text-[9px]", dbStatus.tcpStatus === "OPEN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                    {dbStatus.tcpStatus || "Checking..."}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-red-200/40">
                  <span>App Outbound IP:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-red-900 bg-red-100/80 px-1.5 py-0.5 rounded">
                      {dbStatus.outboundIp || "34.96.48.60"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyIp(dbStatus.outboundIp || "34.96.48.60")}
                      className="px-1.5 py-0.5 bg-red-200/70 hover:bg-red-300/70 text-red-800 rounded text-[9px] font-bold transition-colors cursor-pointer"
                      title="Copy Outbound IP"
                    >
                      {copiedIp ? "OK Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {dbStatus.errorCode && (
              <div className="mt-2 pt-2 border-t border-red-200/50 text-[10px] text-red-800">
                Error Code: <span className="font-bold">{dbStatus.errorCode}</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-red-700 space-y-1.5 bg-red-100/40 p-2.5 rounded-xl border border-red-200/50">
            <p className="font-bold uppercase tracking-wider text-[10px] text-red-800">
              How to fix in Hostinger (Remote MySQL):
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-[10px] leading-relaxed">
              <li>Log in to <strong>Hostinger hPanel</strong> &rarr; <strong>Databases</strong> &rarr; <strong>Remote MySQL</strong>.</li>
              <li>In <em>IP (IPv4 or IPv6)</em>, enter <strong className="font-mono bg-red-200/60 px-1 rounded">%</strong> (or <span className="font-mono bg-red-200/60 px-1 rounded">{dbStatus.outboundIp || "34.96.48.60"}</span>).</li>
              <li>Select database: <strong className="font-mono">{dbStatus.config?.database || "u525815427_COMOS"}</strong> and click <strong>Create</strong>.</li>
              <li>Click <strong>Retry</strong> above once created &mdash; COMOS will connect instantly!</li>
            </ol>
          </div>
        </motion.div>
      )}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-blue-100"
      >
        <div className="flex items-center gap-4 mb-10">
          <LogoContainer 
            size="lg" 
            className="bg-white-600 border-none shadow-none" 
            iconClassName="text-white" 
          />
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-blue-600 leading-none">COMOS</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mt-1">COMI Monitoring System</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-800 transition-colors"
          >
            Sign In
          </button>
        </form>
      
      </motion.div>
    </div>
  );
};

const ConfirmModal: React.FC<{ 
  isOpen: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void 
}> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[210] overflow-hidden"
          >
            <div className="p-8">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={onCancel}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    onConfirm();
                    onCancel();
                  }}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

const ChangePasswordModal: React.FC<{
  isOpen: boolean,
  onClose: () => void,
  token: string,
  notify: (type: 'success' | 'error', message: string) => void
}> = ({ isOpen, onClose, token, notify }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      notify('error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      notify('error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        notify('success', 'Password changed successfully');
        onClose();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        notify('error', data.error || 'Failed to change password');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[210] overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Change Password</h3>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Current Password</label>
                  <input 
                    type="password" 
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">New Password</label>
                  <input 
                    type="password" 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Confirm New Password</label>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Changing...' : 'Update Password'}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};


