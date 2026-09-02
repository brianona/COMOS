/**
 * Multi-Tier Resilient Device Identifier & Hardware Fingerprinting Utility
 * Specially optimized to prevent false de-registrations in Microsoft Edge,
 * Chromium Tracking Prevention, and browsers with "Clear browsing data on close" policies.
 */

// Simple, fast 64-bit non-cryptographic FNV-1a hash function
function fnv1a64(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code >> 8), 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`;
}

/**
 * Generate a deterministic hardware & browser profile hash.
 * This signature remains stable even if localStorage, cookies, and cache are cleared.
 */
export function getDeterministicHardwareFingerprint(): string {
  if (typeof window === 'undefined') return 'fp_server_node';

  const components: string[] = [];

  try {
    // 1. Screen and display metrics
    components.push(`screen:${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);
    components.push(`avail:${window.screen.availWidth}x${window.screen.availHeight}`);
    components.push(`dpr:${window.devicePixelRatio || 1}`);

    // 2. Hardware profile
    components.push(`cores:${navigator.hardwareConcurrency || 4}`);
    if ('deviceMemory' in navigator) {
      components.push(`ram:${(navigator as any).deviceMemory}`);
    }
    components.push(`plat:${navigator.platform || ''}`);
    if ('userAgentData' in navigator && (navigator as any).userAgentData?.platform) {
      components.push(`uad_plat:${(navigator as any).userAgentData.platform}`);
    }

    // 3. Timezone and localization
    try {
      components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    } catch (e) {
      components.push(`tz_offset:${new Date().getTimezoneOffset()}`);
    }
    components.push(`lang:${(navigator.languages || [navigator.language || 'en']).join(',')}`);

    // 4. WebGL GPU vendor & renderer
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl && gl instanceof WebGLRenderingContext) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
          components.push(`gl_vendor:${vendor}`);
          components.push(`gl_renderer:${renderer}`);
        }
      }
    } catch (e) {
      // Ignore if WebGL blocked
    }

    // 5. 2D Canvas rendering signature
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial', 'Segoe UI', sans-serif";
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 200, 40);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('COMOS-FLEET-SECURE-ID', 10, 8);
        ctx.fillStyle = 'rgba(236, 72, 153, 0.7)';
        ctx.fillText('COMOS-FLEET-SECURE-ID', 12, 10);
        const dataUri = canvas.toDataURL();
        components.push(`canvas:${fnv1a64(dataUri.slice(-100))}`);
      }
    } catch (e) {
      // Ignore if canvas blocked
    }
  } catch (err) {
    console.warn('Fingerprint collection warning:', err);
  }

  const rawSignature = components.join('||');
  const hash = fnv1a64(rawSignature);
  return `fp_${hash}`;
}

// Cookie storage helpers with long expiration (10 years)
const COOKIE_NAME = 'comos_device_id';
const STORAGE_KEY = 'comos_device_id';
const IDB_DB_NAME = 'comos_sec_db';
const IDB_STORE_NAME = 'device_store';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  try {
    // 10 years expiration
    const maxAge = 10 * 365 * 24 * 60 * 60;
    const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch (e) {}
}

// In-memory runtime fallback
declare global {
  interface Window {
    __COMOS_DEVICE_ID__?: string;
  }
}

// IndexedDB async persistence helper
function saveToIndexedDB(id: string) {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  try {
    const req = window.indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).put(id, 'device_id');
    };
  } catch (e) {}
}

/**
 * Ask the browser (e.g. Edge) not to clear this site's storage during cleanup.
 */
export function requestStoragePersistence() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

/**
 * Extract fingerprint hash component from any device ID string.
 * Example: "dev_93j2a1_fp_e8a3b91c7f4211a0" -> "e8a3b91c7f4211a0"
 */
export function extractFingerprintFromId(deviceId: string | null | undefined): string | null {
  if (!deviceId || typeof deviceId !== 'string') return null;
  const match = deviceId.match(/fp_([a-fA-F0-9]+)/);
  return match ? match[1].toLowerCase() : null;
}

export interface RegisteredDeviceItem {
  id: string;
  label: string;
  created_at?: string;
}

/**
 * Parse structured list of registered devices (with label and id).
 */
export function parseRegisteredDeviceList(registeredIds: string | null | undefined): RegisteredDeviceItem[] {
  if (!registeredIds || typeof registeredIds !== 'string') return [];
  
  const trimmed = registeredIds.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any, index: number) => {
          if (typeof item === 'string') {
            return {
              id: item,
              label: `Device ${index + 1}`
            };
          }
          if (item && typeof item === 'object' && item.id) {
            return {
              id: String(item.id),
              label: item.label ? String(item.label) : `Device ${index + 1}`,
              created_at: item.created_at
            };
          }
          return null;
        }).filter(Boolean) as RegisteredDeviceItem[];
      }
    } catch (e) {}
  }
  
  return trimmed.split(',').map((s, index) => ({
    id: s.trim(),
    label: `Device ${index + 1}`
  })).filter(d => Boolean(d.id));
}

/**
 * Get all individual registered device IDs from a raw device_id string (JSON or CSV).
 */
export function parseRegisteredDeviceIds(registeredIds: string | null | undefined): string[] {
  return parseRegisteredDeviceList(registeredIds).map(d => d.id);
}

/**
 * Check if the current device matches any of the registered device IDs.
 * Supports:
 * 1. Exact ID match (legacy and new formats)
 * 2. Hardware / Browser fingerprint match (recovers Edge users when localStorage is cleared)
 */
export function isDeviceRegistered(registeredIds: string | null | undefined, currentId: string): boolean {
  if (!registeredIds || !currentId) return false;
  
  const list = parseRegisteredDeviceIds(registeredIds);
  if (list.length === 0) return false;

  // 1. Direct exact match
  if (list.includes(currentId)) {
    return true;
  }

  // 2. Hardware / Browser fingerprint match
  const currentFp = extractFingerprintFromId(currentId) || extractFingerprintFromId(getDeterministicHardwareFingerprint());
  if (currentFp) {
    for (const regId of list) {
      const regFp = extractFingerprintFromId(regId);
      if (regFp && regFp === currentFp) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Format registered device IDs for clean administration display.
 */
export function formatDeviceIds(device_id: string | null | undefined): string {
  if (!device_id) return '-';
  const list = parseRegisteredDeviceList(device_id);
  if (list.length === 0) return device_id;

  return list.map((dev) => {
    const fp = extractFingerprintFromId(dev.id);
    const shortFp = fp ? ` [FP:${fp.slice(0, 6)}]` : '';
    const cleanId = dev.id.length > 20 ? `${dev.id.slice(0, 18)}...` : dev.id;
    return `${dev.label}: ${cleanId}${shortFp}`;
  }).join(' | ');
}

/**
 * Retrieves or generates a persistent multi-tier device ID.
 * Persists across localStorage, document.cookie (10yr), IndexedDB, and memory.
 * Employs hardware fingerprint suffix `_fp_<hash>` to survive complete storage wipes in Microsoft Edge.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_node';

  requestStoragePersistence();

  let foundId: string | null = null;

  // 1. Check window in-memory cache
  if (window.__COMOS_DEVICE_ID__) {
    foundId = window.__COMOS_DEVICE_ID__;
  }

  // 2. Check localStorage
  if (!foundId) {
    try {
      foundId = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
  }

  // 3. Check document.cookie (resilient against localStorage wipe)
  if (!foundId) {
    foundId = getCookie(COOKIE_NAME);
  }

  // 4. Check sessionStorage
  if (!foundId) {
    try {
      foundId = sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {}
  }

  const currentFp = getDeterministicHardwareFingerprint();

  // If ID was found, ensure it includes hardware fingerprint; if not, enrich it
  if (foundId) {
    // If legacy ID without fingerprint, keep it or append fingerprint
    if (!foundId.includes('_fp_')) {
      foundId = `${foundId}_${currentFp}`;
    }
  } else {
    // 5. Generate a brand new resilient ID with deterministic fingerprint
    const randomSeed = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    foundId = `dev_${randomSeed}_${currentFp}`;
  }

  // Multi-tier synchronized save
  try {
    localStorage.setItem(STORAGE_KEY, foundId);
  } catch (e) {}

  try {
    sessionStorage.setItem(STORAGE_KEY, foundId);
  } catch (e) {}

  setCookie(COOKIE_NAME, foundId);
  saveToIndexedDB(foundId);
  window.__COMOS_DEVICE_ID__ = foundId;

  return foundId;
}

/**
 * Self-healing helper:
 * If the vessel user's server record has an approved device whose fingerprint matches
 * this browser's hardware fingerprint, automatically heal the local device ID to match
 * the approved device ID so the user is never interrupted.
 */
export function healAndSyncDeviceId(userDeviceId: string | null | undefined): string {
  const currentDeviceId = getDeviceId();
  if (!userDeviceId) return currentDeviceId;

  const list = parseRegisteredDeviceIds(userDeviceId);
  if (list.length === 0) return currentDeviceId;

  // If already directly registered, all good
  if (list.includes(currentDeviceId)) {
    return currentDeviceId;
  }

  // Check if any registered device ID has the exact same fingerprint as this browser
  const currentFp = extractFingerprintFromId(currentDeviceId) || extractFingerprintFromId(getDeterministicHardwareFingerprint());
  if (currentFp) {
    const matchingApprovedId = list.find(regId => {
      const regFp = extractFingerprintFromId(regId);
      return regFp && regFp === currentFp;
    });

    if (matchingApprovedId) {
      // Heal local storage tiers to use the approved ID
      try {
        localStorage.setItem(STORAGE_KEY, matchingApprovedId);
        sessionStorage.setItem(STORAGE_KEY, matchingApprovedId);
        setCookie(COOKIE_NAME, matchingApprovedId);
        saveToIndexedDB(matchingApprovedId);
        window.__COMOS_DEVICE_ID__ = matchingApprovedId;
        console.log('[COMOS Device Security] Auto-healed device registration via matching hardware profile.');
      } catch (e) {}
      return matchingApprovedId;
    }
  }

  return currentDeviceId;
}
