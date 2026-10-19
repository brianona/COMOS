import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isBefore, addDays, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const getRoleLabel = (role: string) => {
  switch (role) {
    case "admin": return "Admin";
    case "team_pic": return "Manager";
    case "user": return "Superintendent";
    case "vessel": return "Vessel";
    default: return role;
  }
};

export const getStatus = (date?: string | null) => {
  if (!date || date.trim() === '' || date.toLowerCase() === 'no expiration' || date.toLowerCase() === 'none' || date.toLowerCase() === 'n/a') {
    return "no expiration";
  }
  const exp = parseISO(date);
  if (isNaN(exp.getTime())) return "no expiration";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sixtyDays = addDays(today, 60);
  const thirtyDays = addDays(today, 30);

  if (isBefore(exp, today)) return "expired";
  if (isBefore(exp, thirtyDays)) return "expiring soon";
  if (isBefore(exp, sixtyDays)) return "expiring";
  return "active";
};

export const isCertExpiringOrExpired = (expirationDate?: string | null): boolean => {
  const status = getStatus(expirationDate);
  return status === 'expired' || status === 'expiring soon' || status === 'expiring';
};

export const isNewlyPosted = (
  cert: { created_at?: string | null; latest_file_upload?: string | null; date_issued?: string | null; id?: number },
  daysThreshold = 7,
  acknowledgedIds?: Set<number> | number[]
): boolean => {
  if (cert.id && acknowledgedIds) {
    const isAcked = acknowledgedIds instanceof Set ? acknowledgedIds.has(cert.id) : acknowledgedIds.includes(cert.id);
    if (isAcked) return false;
  }

  const now = Date.now();
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;

  if (cert.created_at) {
    const t = new Date(cert.created_at).getTime();
    if (!isNaN(t) && (now - t) <= thresholdMs && (now - t) >= -86400000) {
      return true;
    }
  }

  if (cert.latest_file_upload) {
    const t = new Date(cert.latest_file_upload).getTime();
    if (!isNaN(t) && (now - t) <= thresholdMs && (now - t) >= -86400000) {
      return true;
    }
  }

  return false;
};

export const isFocOutsideLimits = (focStr: string, minLimitStr?: string | null, maxLimitStr?: string | null) => {
  const foc = parseFloat(focStr);
  if (isNaN(foc) || foc <= 0) return false;
  const parseNumericLimit = (val?: string | null) => {
    if (!val) return null;
    const match = val.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  };
  const minLimit = parseNumericLimit(minLimitStr);
  const maxLimit = parseNumericLimit(maxLimitStr);
  if (minLimit !== null && foc < minLimit) return true;
  if (maxLimit !== null && foc > maxLimit) return true;
  return false;
};

export const isGeminiSupportedMimeType = (mimeType: string) => {
  const supported = [
    "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif",
    "application/pdf"
  ];
  return supported.includes(mimeType);
};

export const AUTO_FILL_ENABLED = false;

export const recognizeCertText = async (file: File) => {
  return {} as {
    date_issued?: string;
    certificate_number?: string;
    expiration_date?: string;
    vessel_name?: string;
    cert_type?: string;
  };
};

export const parseCoordinate = (coordStr: string, isLat: boolean): number | null => {
  if (!coordStr) return null;
  let clean = coordStr.toUpperCase().trim();

  // Determine sign based on cardinal directions
  let isNegative = false;
  if (clean.includes("S") || clean.includes("W")) {
    isNegative = true;
  }

  if (clean.startsWith("-")) {
    isNegative = true;
    clean = clean.substring(1);
  } else if (clean.startsWith("+")) {
    clean = clean.substring(1);
  }

  // Remove cardinal letters and non-essential chars
  clean = clean.replace(/[NSEW°'"]/g, " ").trim();
  const parts = clean.split(/[\s:]+/).filter(Boolean);

  if (parts.length === 0) return null;

  try {
    let degrees = 0;
    if (parts.length === 1) {
      degrees = parseFloat(parts[0]);
    } else if (parts.length === 2) {
      const d = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      degrees = d + m / 60;
    } else if (parts.length >= 3) {
      const d = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      const s = parseFloat(parts[2]);
      degrees = d + m / 60 + s / 3600;
    }

    if (isNaN(degrees)) return null;

    if (isNegative && degrees > 0) {
      degrees = -degrees;
    }

    if (isLat && (degrees < -90 || degrees > 90)) return null;
    if (!isLat && (degrees < -180 || degrees > 180)) return null;

    return degrees;
  } catch (e) {
    return null;
  }
};

export interface NoonSpeedResult {
  speed: number | null; // knots (nautical miles per hour)
  speedFormatted: string; // e.g. "14.7 kts" or "-"
  hoursElapsed: number | null;
  distCovered: number | null; // nautical miles
  prevReportDate?: string | null;
  prevReportDtg?: string | number | null;
  isNewVoyageOrPort?: boolean;
}

/**
 * Computes average vessel speed in knots (nautical miles per hour)
 * by comparing distance to go (DTG) and UTC time between the recent and previous noon reports.
 */
export function computeNoonReportAvgSpeed(
  currentReport: {
    id?: number;
    vessel_id?: number | string;
    vessel_name?: string;
    utc_date_time?: string;
    distance_to_go?: string | number | null;
    destination_port?: string | null;
    voyage_number?: string | null;
  },
  allReports: Array<{
    id?: number;
    vessel_id?: number | string;
    vessel_name?: string;
    utc_date_time?: string;
    distance_to_go?: string | number | null;
    destination_port?: string | null;
    voyage_number?: string | null;
  }>
): NoonSpeedResult {
  if (!currentReport || !currentReport.utc_date_time || !allReports || allReports.length === 0) {
    return { speed: null, speedFormatted: '-', hoursElapsed: null, distCovered: null };
  }

  const parseDtg = (val: string | number | null | undefined): number | null => {
    if (val === null || val === undefined) return null;
    const clean = String(val).replace(/,/g, '').replace(/[^0-9.]/g, '').trim();
    if (!clean) return null;
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  };

  const currDtg = parseDtg(currentReport.distance_to_go);
  const currTime = new Date(currentReport.utc_date_time).getTime();
  if (isNaN(currTime) || currDtg === null) {
    return { speed: null, speedFormatted: '-', hoursElapsed: null, distCovered: null };
  }

  // Filter reports belonging to the exact same vessel
  const vesselReports = allReports.filter(r => {
    if (currentReport.id && r.id === currentReport.id) return false;
    if (currentReport.vessel_id && r.vessel_id) {
      return String(r.vessel_id) === String(currentReport.vessel_id);
    }
    if (currentReport.vessel_name && r.vessel_name) {
      return r.vessel_name.toLowerCase().trim() === currentReport.vessel_name.toLowerCase().trim();
    }
    return false;
  });

  if (vesselReports.length === 0) {
    return { speed: null, speedFormatted: '-', hoursElapsed: null, distCovered: null };
  }

  // Find reports chronologically before the current report
  const priorReports = vesselReports
    .map(r => ({
      report: r,
      time: new Date(r.utc_date_time || '').getTime()
    }))
    .filter(item => !isNaN(item.time) && (item.time < currTime || (item.time === currTime && (item.report.id || 0) < (currentReport.id || 0))))
    .sort((a, b) => b.time - a.time); // Nearest prior report first

  if (priorReports.length === 0) {
    return { speed: null, speedFormatted: '-', hoursElapsed: null, distCovered: null };
  }

  const prev = priorReports[0].report;
  const prevTime = priorReports[0].time;
  const prevDtg = parseDtg(prev.distance_to_go);

  if (prevDtg === null) {
    return { speed: null, speedFormatted: '-', hoursElapsed: null, distCovered: null };
  }

  const hoursElapsed = (currTime - prevTime) / (1000 * 60 * 60);
  if (hoursElapsed <= 0) {
    return { speed: null, speedFormatted: '-', hoursElapsed: null, distCovered: null };
  }

  // As vessel proceeds along its route toward destination port, DTG decreases.
  // Distance covered = Previous DTG - Current DTG.
  const distCovered = prevDtg - currDtg;

  // If distance to go increased, the vessel is on a different voyage leg or heading to a new port
  if (distCovered < 0) {
    return {
      speed: null,
      speedFormatted: '-',
      hoursElapsed,
      distCovered,
      prevReportDate: prev.utc_date_time,
      prevReportDtg: prev.distance_to_go,
      isNewVoyageOrPort: true
    };
  }

  // Calculate speed: distance run in nautical miles divided by hours elapsed (knots)
  const speed = distCovered / hoursElapsed;

  // Commercial cargo and container vessels operate within 0 to 30 knots.
  // If speed exceeds 40 knots, DTG changed due to a destination/voyage change.
  if (speed > 40) {
    return {
      speed: null,
      speedFormatted: '-',
      hoursElapsed,
      distCovered,
      prevReportDate: prev.utc_date_time,
      prevReportDtg: prev.distance_to_go,
      isNewVoyageOrPort: true
    };
  }

  return {
    speed,
    speedFormatted: `${speed.toFixed(1)} kts`,
    hoursElapsed,
    distCovered,
    prevReportDate: prev.utc_date_time,
    prevReportDtg: prev.distance_to_go,
    isNewVoyageOrPort: false
  };
}
