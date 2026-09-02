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
    case "team_pic": return "Management";
    case "user": return "PIC";
    case "vessel": return "Vessel";
    default: return role;
  }
};

export const getStatus = (date: string) => {
  if (!date) return "unknown";
  const exp = parseISO(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sixtyDays = addDays(today, 60);
  const thirtyDays = addDays(today, 30);

  if (isBefore(exp, today)) return "expired";
  if (isBefore(exp, thirtyDays)) return "expiring soon";
  if (isBefore(exp, sixtyDays)) return "expiring";
  return "active";
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
