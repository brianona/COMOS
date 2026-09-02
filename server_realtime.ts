/**
 * Server-side Long-Polling Realtime Engine for COMOS (Clean Ocean Maritime Operations System)
 * Enables live database change synchronization across all connected browser clients without manual refreshing.
 */
import express from 'express';

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

export interface RealtimeSubscriber {
  id: string;
  res: express.Response;
  user?: any;
  lastVersion: number;
  domains?: string[];
  timeout: NodeJS.Timeout;
  createdAt: number;
}

export class RealtimeEngine {
  private currentVersion = 1;
  private eventHistory: RealtimeDbEvent[] = [];
  private maxHistorySize = 1000;
  private subscribers = new Map<string, RealtimeSubscriber>();
  private batchTimer: NodeJS.Timeout | null = null;
  private pendingBroadcastQueue: RealtimeDbEvent[] = [];

  constructor() {
    // Keep initial baseline version at 1
    this.currentVersion = 1;
  }

  public getVersion(): number {
    return this.currentVersion;
  }

  public getSubscriberCount(): number {
    return this.subscribers.size;
  }

  public getEventsSince(sinceVersion: number, filterDomains?: string[]): RealtimeDbEvent[] {
    const list = this.eventHistory.filter(e => e.id > sinceVersion);
    if (!filterDomains || filterDomains.length === 0 || filterDomains.includes('all')) {
      return list;
    }
    const filterSet = new Set(filterDomains.map(d => d.toLowerCase().trim()));
    return list.filter(e => filterSet.has(e.domain.toLowerCase()) || filterSet.has(e.table.toLowerCase()));
  }

  /**
   * Broadcast a database mutation event to all active long-polling listeners.
   */
  public notifyChange(event: Omit<RealtimeDbEvent, 'id' | 'timestamp'>) {
    const fullEvent: RealtimeDbEvent = {
      ...event,
      id: ++this.currentVersion,
      timestamp: Date.now()
    };

    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.splice(0, this.eventHistory.length - this.maxHistorySize);
    }

    this.pendingBroadcastQueue.push(fullEvent);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushSubscribers();
      }, 40); // 40ms debounce to bundle multi-row batch executions into a single response
    }
  }

  private flushSubscribers() {
    this.batchTimer = null;
    this.pendingBroadcastQueue = [];

    if (this.subscribers.size === 0) return;

    for (const [subId, sub] of Array.from(this.subscribers.entries())) {
      try {
        const matchingEvents = this.getEventsSince(sub.lastVersion, sub.domains);
        if (matchingEvents.length > 0) {
          clearTimeout(sub.timeout);
          this.subscribers.delete(subId);
          if (!sub.res.headersSent) {
            sub.res.json({
              version: this.currentVersion,
              events: matchingEvents,
              timestamp: Date.now()
            });
          }
        }
      } catch (err) {
        this.subscribers.delete(subId);
      }
    }
  }

  /**
   * Register or immediately respond to a long-poll request from a client.
   */
  public registerSubscriber(
    id: string,
    res: express.Response,
    user: any,
    lastVersion: number,
    domains?: string[],
    timeoutMs: number = 20000
  ) {
    // If this is an initial handshake from a client (version === 0), respond immediately with current version
    if (lastVersion === 0) {
      return res.json({
        version: this.currentVersion,
        events: [],
        handshake: true,
        timestamp: Date.now()
      });
    }

    // If client version is behind current database state, deliver immediately
    const immediateEvents = this.getEventsSince(lastVersion, domains);
    if (immediateEvents.length > 0) {
      return res.json({
        version: this.currentVersion,
        events: immediateEvents,
        timestamp: Date.now()
      });
    }

    // Otherwise, hold the request connection open until a new change occurs or timeout expires
    const safeTimeoutMs = Math.max(1000, Math.min(timeoutMs, 25000));
    const timeout = setTimeout(() => {
      this.subscribers.delete(id);
      if (!res.headersSent) {
        res.json({
          version: this.currentVersion,
          events: [],
          keepAlive: true,
          timestamp: Date.now()
        });
      }
    }, safeTimeoutMs);

    this.subscribers.set(id, {
      id,
      res,
      user,
      lastVersion,
      domains,
      timeout,
      createdAt: Date.now()
    });
  }

  public removeSubscriber(id: string) {
    const sub = this.subscribers.get(id);
    if (sub) {
      clearTimeout(sub.timeout);
      this.subscribers.delete(id);
    }
  }
}

/**
 * Extracts table and domain from raw SQL query strings.
 */
export const extractTableAndDomainFromSql = (sql: any): { table: string; domain: string; verb: string } | null => {
  try {
    const sqlStr = typeof sql === 'string' ? sql : (sql && sql.sql) ? sql.sql : String(sql || '');
    const cleanSql = sqlStr.replace(/\s+/g, ' ').trim();
    const match = cleanSql.match(/^([A-Za-z]+)\s+(?:INTO\s+|FROM\s+)?`?([a-zA-Z0-9_]+)`?/i);
    if (!match) return null;
    const verb = match[1].toUpperCase();
    if (!['INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(verb)) return null;

    let rawTable = (match[2] || '').toLowerCase().replace(/[`"']/g, '');
    if (rawTable === 'into' || rawTable === 'from') {
      const secondMatch = cleanSql.match(/^([A-Za-z]+)\s+(?:INTO|FROM)\s+`?([a-zA-Z0-9_]+)`?/i);
      if (secondMatch && secondMatch[2]) {
        rawTable = secondMatch[2].toLowerCase().replace(/[`"']/g, '');
      }
    }

    // Skip internal or high-frequency telemetry tables
    if (!rawTable || rawTable === 'audit_logs' || rawTable === 'sessions' || rawTable === 'system') {
      return null;
    }

    let domain = 'system';
    if (rawTable.startsWith('sms_order_upload') || rawTable === 'sms_order_uploads' || rawTable === 'sms_uploads') {
      domain = 'sms_uploads';
    } else if (rawTable.startsWith('sms_order') || rawTable === 'sms_orders' || rawTable === 'sms_order_items' || rawTable === 'sms_order_vessels' || rawTable === 'sms_order_templates' || rawTable === 'sms_order_upload_reads') {
      domain = 'sms_orders';
    } else if (rawTable.startsWith('sms_form') || rawTable === 'sms_forms') {
      domain = 'sms_forms';
    } else if (rawTable.startsWith('sms_submission_period') || rawTable.startsWith('sms_period')) {
      domain = 'sms_periods';
    } else if (rawTable.includes('departure_report')) {
      domain = 'departure_reports';
    } else if (rawTable.includes('arrival_report')) {
      domain = 'arrival_reports';
    } else if (rawTable.includes('noon_report')) {
      domain = 'noon_reports';
    } else if (rawTable.includes('other_report')) {
      domain = 'other_reports';
    } else if (rawTable.includes('fuel_analysis_report') || rawTable.includes('bunker_bdn_report') || rawTable.startsWith('bunker')) {
      domain = 'bunkers';
    } else if (rawTable.includes('lube_oil')) {
      domain = 'lube_oil';
    } else if (rawTable.startsWith('trouble_report')) {
      domain = 'trouble_reports';
    } else if (rawTable.startsWith('spare_requisition')) {
      domain = 'spare_requisitions';
    } else if (rawTable.startsWith('crew_member')) {
      domain = 'crew_members';
    } else if (rawTable.startsWith('audit_finding') || rawTable.startsWith('audit_record') || rawTable.startsWith('audit')) {
      domain = 'audits';
    } else if (rawTable.startsWith('certificate')) {
      domain = 'certificates';
    } else if (rawTable === 'vessels' || rawTable.startsWith('vessel')) {
      domain = 'vessels';
    } else if (rawTable === 'flags' || rawTable.startsWith('flag')) {
      domain = 'flags';
    } else if (rawTable === 'teams' || rawTable.startsWith('team')) {
      domain = 'teams';
    } else if (rawTable === 'users' || rawTable.startsWith('user') || rawTable.startsWith('device_reg')) {
      domain = 'users';
    } else if (rawTable === 'settings') {
      domain = 'settings';
    } else {
      domain = rawTable;
    }

    return { table: rawTable, domain, verb };
  } catch (err) {
    return null;
  }
};

export const globalRealtimeEngine = new RealtimeEngine();
