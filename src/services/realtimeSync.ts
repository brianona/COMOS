/**
 * Client-Side Realtime Long-Polling Service for COMOS
 * Synchronizes database mutations live without requiring full page refreshes.
 */
import { useEffect, useState, useRef } from 'react';

export interface RealtimeDbEvent {
  id: number;
  domain: string;
  action: string;
  table: string;
  timestamp: number;
  userId?: number | null;
  username?: string | null;
  meta?: any;
}

export type RealtimeStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

export interface RealtimeStatusState {
  status: RealtimeStatus;
  lastSyncTime: number | null;
  eventCount: number;
  currentVersion: number;
}

type EventCallback = (event: RealtimeDbEvent) => void;
type StatusCallback = (status: RealtimeStatusState) => void;

class RealtimeSyncService {
  private token: string | null = null;
  private currentVersion: number = 0;
  private isRunning: boolean = false;
  private hasConnectedOnce: boolean = false;
  private abortController: AbortController | null = null;
  private subscribers: Map<string, Set<EventCallback>> = new Map();
  private allSubscribers: Set<EventCallback> = new Set();
  private statusSubscribers: Set<StatusCallback> = new Set();
  private retryAttempts: number = 0;
  private retryTimer: any = null;
  private watchdogTimer: any = null;
  private status: RealtimeStatus = 'disconnected';
  private lastSyncTime: number | null = null;
  private totalEventsReceived: number = 0;

  constructor() {
    // Check initial token from localStorage
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        this.token = storedToken;
      }

      // Resume immediately on window focus / tab visibility
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.token) {
          this.triggerImmediatePoll();
        }
      });

      window.addEventListener('online', () => {
        if (this.token) {
          this.retryAttempts = 0;
          this.start();
        }
      });
    }
  }

  public setToken(token: string | null) {
    if (this.token === token && this.isRunning) return;
    this.token = token;
    if (token) {
      this.retryAttempts = 0;
      this.hasConnectedOnce = false;
      this.start();
    } else {
      this.stop();
    }
  }

  public getStatus(): RealtimeStatusState {
    return {
      status: this.status,
      lastSyncTime: this.lastSyncTime,
      eventCount: this.totalEventsReceived,
      currentVersion: this.currentVersion,
    };
  }

  private setStatus(newStatus: RealtimeStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifyStatusChange();
    }
  }

  private notifyStatusChange() {
    const state = this.getStatus();
    this.statusSubscribers.forEach(cb => {
      try { cb(state); } catch (e) {}
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comos:realtime_status', { detail: state }));
    }
  }

  public subscribeStatus(callback: StatusCallback): () => void {
    this.statusSubscribers.add(callback);
    callback(this.getStatus());
    return () => {
      this.statusSubscribers.delete(callback);
    };
  }

  public subscribe(domain: string | string[] | 'all', callback: EventCallback): () => void {
    if (domain === 'all') {
      this.allSubscribers.add(callback);
      return () => {
        this.allSubscribers.delete(callback);
      };
    }

    const domains = Array.isArray(domain) ? domain : [domain];
    domains.forEach(d => {
      const key = d.toLowerCase().trim();
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set());
      }
      this.subscribers.get(key)!.add(callback);
    });

    return () => {
      domains.forEach(d => {
        const key = d.toLowerCase().trim();
        const set = this.subscribers.get(key);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            this.subscribers.delete(key);
          }
        }
      });
    };
  }

  public triggerImmediatePoll() {
    if (!this.token || !this.isRunning) return;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.poll();
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.retryAttempts = 0;
    this.setStatus(this.hasConnectedOnce ? 'connected' : 'connecting');
    this.poll();
  }

  public stop() {
    this.isRunning = false;
    this.hasConnectedOnce = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.setStatus('disconnected');
  }

  private async poll() {
    if (!this.isRunning || !this.token) {
      this.setStatus('disconnected');
      return;
    }

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // Watchdog to prevent hanging connections if browser stalls
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => {
      if (this.isRunning && this.abortController) {
        this.abortController.abort();
      }
    }, 28000);

    try {
      if (this.retryAttempts > 0) {
        this.setStatus('reconnecting');
      } else if (this.hasConnectedOnce) {
        this.setStatus('connected');
      } else {
        this.setStatus('connecting');
      }

      const url = `/api/realtime/poll?version=${this.currentVersion}&timeout=20000`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Cache-Control': 'no-cache, no-store',
        },
        signal,
      });

      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          this.stop();
          return;
        }
        throw new Error(`Realtime poll returned HTTP ${res.status}`);
      }

      const data = await res.json();
      this.retryAttempts = 0;
      this.hasConnectedOnce = true;
      this.setStatus('connected');
      this.lastSyncTime = Date.now();

      if (data && typeof data.version === 'number') {
        this.currentVersion = Math.max(this.currentVersion, data.version);
      }

      if (data && Array.isArray(data.events) && data.events.length > 0) {
        this.totalEventsReceived += data.events.length;
        this.notifyStatusChange();
        this.dispatchEventBatch(data.events);
      }

      // Loop immediately to start next long-poll without delay
      if (this.isRunning) {
        this.poll();
      }
    } catch (err: any) {
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }

      if (err?.name === 'AbortError') {
        // Expected when restarting poll or unmounting
        return;
      }

      this.retryAttempts++;
      this.setStatus('reconnecting');

      // Exponential backoff up to 4 seconds
      const delay = Math.min(1000 * Math.pow(1.3, this.retryAttempts - 1), 4000);
      if (this.isRunning) {
        this.retryTimer = setTimeout(() => {
          if (this.isRunning) this.poll();
        }, delay);
      }
    }
  }

  private dispatchEventBatch(events: RealtimeDbEvent[]) {
    events.forEach(event => {
      // Global listeners
      this.allSubscribers.forEach(cb => {
        try { cb(event); } catch (e) { console.warn('Realtime subscriber error:', e); }
      });

      // Domain-specific listeners
      const domainKey = (event.domain || '').toLowerCase().trim();
      const domainSubs = this.subscribers.get(domainKey);
      if (domainSubs) {
        domainSubs.forEach(cb => {
          try { cb(event); } catch (e) { console.warn(`Realtime subscriber error for ${domainKey}:`, e); }
        });
      }

      // Table-specific listeners
      const tableKey = (event.table || '').toLowerCase().trim();
      if (tableKey && tableKey !== domainKey) {
        const tableSubs = this.subscribers.get(tableKey);
        if (tableSubs) {
          tableSubs.forEach(cb => {
            try { cb(event); } catch (e) { console.warn(`Realtime subscriber error for ${tableKey}:`, e); }
          });
        }
      }

      // Dispatch browser custom event for maximum modularity
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('comos:db_change', { detail: event }));
        if (domainKey) {
          window.dispatchEvent(new CustomEvent(`comos:db_change:${domainKey}`, { detail: event }));
        }
      }
    });
  }
}

export const realtimeSync = new RealtimeSyncService();

/**
 * React Hook to subscribe to specific database domains.
 */
export function useRealtimeDb(
  domains: string | string[] | 'all',
  onEvent: (event: RealtimeDbEvent) => void,
  deps: any[] = []
) {
  const savedCallback = useRef(onEvent);
  useEffect(() => {
    savedCallback.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const unsubscribe = realtimeSync.subscribe(domains, (event) => {
      savedCallback.current(event);
    });
    return () => unsubscribe();
  }, [Array.isArray(domains) ? domains.join(',') : domains, ...deps]);
}

/**
 * React Hook to auto-refresh data when database domain updates occur, with built-in debouncing.
 */
export function useRealtimeAutoRefresh(
  domains: string | string[],
  refreshFn: () => void | Promise<any>,
  debounceMs: number = 300,
  deps: any[] = []
) {
  const savedFn = useRef(refreshFn);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    savedFn.current = refreshFn;
  }, [refreshFn]);

  useEffect(() => {
    const handleEvent = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          savedFn.current();
        } catch (e) {
          console.warn('Realtime auto-refresh error:', e);
        }
      }, debounceMs);
    };

    const unsubscribe = realtimeSync.subscribe(domains, handleEvent);

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [Array.isArray(domains) ? domains.join(',') : domains, debounceMs, ...deps]);
}

/**
 * React Hook to observe realtime connection status.
 */
export function useRealtimeStatus() {
  const [statusState, setStatusState] = useState<RealtimeStatusState>(() => realtimeSync.getStatus());

  useEffect(() => {
    return realtimeSync.subscribeStatus((newState) => {
      setStatusState(newState);
    });
  }, []);

  return statusState;
}
