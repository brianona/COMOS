import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Tag, RefreshCw, Clock, LogOut } from 'lucide-react';
import { cn } from '../utils/helpers';
import { getDeviceId, healAndSyncDeviceId } from '../utils/deviceIdentifier';
import { User } from '../types';

interface DeviceRegistrationProps {
  user: User;
  token: string;
  onLogout: () => void;
  onVerified: (isVerified: boolean, deviceId: string) => void;
}

export const DeviceRegistration: React.FC<DeviceRegistrationProps> = ({
  user,
  token,
  onLogout,
  onVerified
}) => {
  const [deviceCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [deviceLabel, setDeviceLabel] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'pending' | 'approved' | 'rejected'>('idle');
  const [error, setError] = useState('');
  const [isCheckingNow, setIsCheckingNow] = useState(false);

  const checkStatus = useCallback(async (isManual = false) => {
    if (isManual) setIsCheckingNow(true);
    const currentDeviceId = getDeviceId();
    try {
      const res = await fetch('/api/device/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Device-Id': currentDeviceId
        }
      });
      const data = await res.json();
      if (res.ok && data.is_verified) {
        setStatus('approved');
        const syncedId = healAndSyncDeviceId(data.device_id || user.device_id);
        onVerified(true, syncedId);
      } else if (res.ok && data.pending_request) {
        setStatus('pending');
      }
    } catch (e: any) {
      if (isManual) setError('Failed to verify status. Please try again.');
    } finally {
      if (isManual) setIsCheckingNow(false);
    }
  }, [token, user.device_id, onVerified]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => checkStatus(false), 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleRegister = async () => {
    setStatus('checking');
    setError('');
    const currentDeviceId = getDeviceId();
    try {
      const res = await fetch('/api/device/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_id: currentDeviceId,
          device_code: deviceCode,
          label: deviceLabel.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.already_registered) {
          const syncedId = healAndSyncDeviceId(data.device_id || user.device_id);
          onVerified(true, syncedId);
          return;
        }
        setStatus('pending');
      } else {
        setError(data.error || 'Failed to register device');
        setStatus('idle');
      }
    } catch (e: any) {
      setError(e.message);
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white overflow-hidden relative">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#1e40af,transparent_70%)]" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-blue-600/20 flex items-center justify-center mb-6 ring-1 ring-blue-500/30">
            <ShieldAlert className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Device Not Verified</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            This account is restricted to registered vessel devices. Please complete the registration process or ask Admin to approve.
          </p>
        </div>

        {status === 'idle' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50 text-center">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-4">Registration Code</span>
              <div className="flex items-center justify-center gap-3">
                {deviceCode.split('').map((char, i) => (
                  <div key={i} className="w-10 h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-xl font-bold text-white shadow-sm">
                    {char}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                  Device Name / Location (Optional)
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={deviceLabel}
                    onChange={(e) => setDeviceLabel(e.target.value)}
                    placeholder="e.g. Bridge Workstation, Captain PC"
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center italic">
                Provide this code to your Management or Admin to verify your device.
              </p>
              
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleRegister}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  Request Registration
                </button>
                <button
                  onClick={() => checkStatus(true)}
                  disabled={isCheckingNow}
                  className="px-4 py-3.5 bg-slate-700/70 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600/50 transition-all active:scale-95 flex items-center justify-center"
                  title="Check if Admin has approved"
                >
                  <RefreshCw className={cn("w-4 h-4", isCheckingNow && "animate-spin text-blue-400")} />
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'pending' && (
          <div className="space-y-8 py-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <Clock className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
            
            <div className="text-center space-y-3">
              <h3 className="text-xl font-bold text-blue-400">Verification Pending</h3>
              <p className="text-sm text-slate-400 leading-relaxed px-4">
                Your request has been sent to Admin. You will be redirected automatically once approved.
              </p>
              <div className="inline-block px-4 py-2 bg-blue-500/10 rounded-full text-[10px] font-bold text-blue-400 uppercase tracking-widest border border-blue-500/20">
                Code: {deviceCode}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => checkStatus(true)}
                disabled={isCheckingNow}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isCheckingNow && "animate-spin text-blue-400")} />
                {isCheckingNow ? 'Checking with Server...' : 'Check Approval Status Now'}
              </button>
              <button
                onClick={() => setStatus('idle')}
                className="w-full text-slate-500 hover:text-slate-300 text-xs font-bold py-2 transition-colors"
              >
                Cancel Request
              </button>
            </div>
          </div>
        )}

        <div className="mt-10 pt-8 border-t border-slate-700/50 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                {user.username[0].toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">{user.username}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Vessel Account</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-400/5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
