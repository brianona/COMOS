import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  RefreshCw, 
  X, 
  ArrowUpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ExternalLink 
} from 'lucide-react';
import { SystemVersionInfo } from '../types';
import { 
  CURRENT_CLIENT_VERSION, 
  CURRENT_CLIENT_BUILD_TIME, 
  isClientVersionOlder, 
  refreshBrowserCleanly 
} from '../utils/version';
import { realtimeSync } from '../services/realtimeSync';

interface SystemUpdateNotifierProps {
  // Optional callback or custom styling if needed
  className?: string;
}

export const SystemUpdateNotifier: React.FC<SystemUpdateNotifierProps> = ({ className }) => {
  const [serverVersion, setServerVersion] = useState<SystemVersionInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<number>(Date.now());

  // Check version against backend API
  const checkForUpdates = useCallback(async () => {
    try {
      // Append cache-buster query parameter to bypass browser/CDN caches
      const res = await fetch(`/api/system/version?_t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!res.ok) return;

      const data: SystemVersionInfo = await res.json();
      if (!data || !data.version) return;

      setServerVersion(data);
      setLastCheckedTime(Date.now());

      const older = isClientVersionOlder(
        CURRENT_CLIENT_VERSION,
        data.version,
        CURRENT_CLIENT_BUILD_TIME,
        data.buildTime
      );

      if (older || data.urgent) {
        setHasUpdate(true);
      } else {
        setHasUpdate(false);
      }
    } catch (err) {
      // Non-blocking network catch
      console.warn('System version check failed:', err);
    }
  }, []);

  // Initial check & interval polling
  useEffect(() => {
    checkForUpdates();

    // Check periodically every 60 seconds
    const interval = setInterval(() => {
      checkForUpdates();
    }, 60000);

    // Re-check when window regains visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkForUpdates);

    // Listen to realtime push events for system updates
    const unsubscribe = realtimeSync.subscribe(['system', 'system_version'], (event) => {
      if (event.domain === 'system' && (event.action === 'update' || event.table === 'system_version')) {
        if (event.meta && event.meta.version) {
          const serverInfo: SystemVersionInfo = {
            version: event.meta.version,
            buildTime: event.meta.buildTime || new Date().toISOString(),
            releaseNotes: event.meta.releaseNotes,
            urgent: !!event.meta.urgent,
          };
          setServerVersion(serverInfo);
          const older = isClientVersionOlder(
            CURRENT_CLIENT_VERSION,
            serverInfo.version,
            CURRENT_CLIENT_BUILD_TIME,
            serverInfo.buildTime
          );
          if (older || serverInfo.urgent) {
            setHasUpdate(true);
            setIsDismissed(false); // Re-open banner on new broadcast
          }
        } else {
          checkForUpdates();
        }
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkForUpdates);
      unsubscribe();
    };
  }, [checkForUpdates]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      refreshBrowserCleanly();
    }, 300);
  };

  if (!hasUpdate || !serverVersion) {
    return null;
  }

  return (
    <div className={`fixed z-[99999] pointer-events-none transition-all ${className || ''}`}>
      <AnimatePresence>
        {!isDismissed ? (
          <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white shadow-2xl border border-blue-500/40 p-5 backdrop-blur-xl"
            >
              {/* Subtle animated aura background */}
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl pointer-events-none animate-pulse" />
              <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 space-y-3.5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/20 text-cyan-300 border border-blue-400/30 shadow-inner">
                      <Sparkles className="w-5 h-5 text-cyan-300 animate-spin-slow" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold tracking-tight text-white">
                          System Update Available
                        </h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          New Version
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-200/70 font-medium">
                        COMOS has been updated with new improvements
                      </p>
                    </div>
                  </div>

                  {/* Close / Remind later button */}
                  <button
                    onClick={() => setIsDismissed(true)}
                    title="Remind me later"
                    className="p-1 rounded-lg text-blue-300/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Version comparison card */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-[10px] text-slate-400 font-sans uppercase">Your browser:</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-amber-300 font-bold">
                      v{CURRENT_CLIENT_VERSION}
                    </span>
                  </div>
                  <div className="text-blue-400 font-sans font-bold text-xs">→</div>
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <span className="text-[10px] text-blue-300 font-sans uppercase">Latest:</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-emerald-300 font-bold border border-blue-400/30">
                      v{serverVersion.version}
                    </span>
                  </div>
                </div>

                {/* Recommendation explanation */}
                <p className="text-xs text-blue-100/90 leading-relaxed">
                  Your browser is currently running an older version of COMOS. To avoid synchronization issues and ensure access to the latest certificate features, please <strong className="text-white font-semibold underline decoration-cyan-400/60 decoration-2 underline-offset-2">refresh your browser</strong> to update.
                </p>

                {/* Release notes summary if provided */}
                {serverVersion.releaseNotes && (
                  <div className="text-[11px] text-blue-200/80 bg-blue-900/30 rounded-lg p-2 border border-blue-400/20 max-h-24 overflow-y-auto">
                    <span className="font-semibold text-cyan-300">What's New: </span>
                    {serverVersion.releaseNotes}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing COMOS...' : 'Refresh Browser Now'}
                  </button>

                  <button
                    onClick={() => setIsDismissed(true)}
                    className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-blue-200 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    Later
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          /* Minimized persistent pill when user clicks 'Later' */
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-5 right-5 pointer-events-auto z-[99999]"
          >
            <div className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-slate-900/95 text-white border border-blue-500/50 shadow-2xl backdrop-blur-md">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Reloading...' : 'Update & Refresh'}</span>
              </button>

              <button
                onClick={() => setIsDismissed(false)}
                className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white cursor-pointer px-1"
                title="Click to view update details"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono font-medium">v{serverVersion.version} available</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
