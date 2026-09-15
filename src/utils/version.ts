/**
 * System Version & Update Detection Utility
 * Clean Ocean Maritime Operations System (COMOS)
 */

import { SystemVersionInfo } from '../types';

// The build version and timestamp baked into this client bundle
export const CURRENT_CLIENT_VERSION = '2.4.0';
export const CURRENT_CLIENT_BUILD_TIME = '2026-09-08T19:22:30.000Z';

/**
 * Compare two semver-like strings (e.g. "2.4.0" vs "2.4.1" or "v1.2.0")
 * Returns:
 * - negative number if v1 < v2 (v1 is older)
 * - 0 if equal
 * - positive number if v1 > v2 (v1 is newer)
 */
export function compareSemver(v1: string, v2: string): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean1 = String(v1).replace(/^v/i, '').trim();
  const clean2 = String(v2).replace(/^v/i, '').trim();

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] !== undefined ? parts1[i] : 0;
    const p2 = parts2[i] !== undefined ? parts2[i] : 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

/**
 * Determines if the client's currently loaded application version is older than the server's version.
 */
export function isClientVersionOlder(
  clientVer: string = CURRENT_CLIENT_VERSION,
  serverVer: string,
  clientBuild: string = CURRENT_CLIENT_BUILD_TIME,
  serverBuild?: string
): boolean {
  if (!serverVer) return false;

  const cmp = compareSemver(clientVer, serverVer);
  if (cmp < 0) {
    // Client semver is strictly lower than server semver (e.g. 2.3.9 < 2.4.0)
    return true;
  }

  // If major.minor.patch match, check build timestamp if provided
  if (cmp === 0 && serverBuild && clientBuild) {
    try {
      const clientTime = new Date(clientBuild).getTime();
      const serverTime = new Date(serverBuild).getTime();
      // If server build is newer by more than 30 seconds, client has an older build
      if (!isNaN(clientTime) && !isNaN(serverTime) && serverTime - clientTime > 30000) {
        return true;
      }
    } catch {
      // ignore date parsing error
    }
  }

  return false;
}

/**
 * Cleanly refreshes the browser window to load the latest application assets.
 */
export function refreshBrowserCleanly() {
  try {
    // Append a cache-busting timestamp or use location.reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.update();
        }
      });
    }
    // Hard reload
    window.location.reload();
  } catch {
    window.location.href = window.location.pathname + '?_t=' + Date.now();
  }
}
