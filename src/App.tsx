import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Ship, 
  Flag,
  FileText, 
  AlertTriangle, 
  Calendar, 
  Plus, 
  Users, 
  UserPlus,
  LogOut, 
  ChevronRight, 
  Upload, 
  MessageSquare,
  Search,
  CheckCircle2,
  CheckSquare,
  Clock,
  Trash2,
  File,
  X,
  Eye,
  Menu,
  Edit2,
  Settings,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertCircle,
  Mail,
  ExternalLink,
  History,
  RefreshCw,
  MapPin,
  Map as MapIcon,
  Activity,
  Anchor,
  Database,
  Cloud,
  Package,
  Save,
  Monitor,
  Play,
  Pause,
  ChevronLeft,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Compass,
  Navigation,
  Paperclip,
  Download,
  Droplets,
  Wrench,
  FlaskConical,
  Waves,
  Camera,
  Image,
  Fuel,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isBefore, addDays, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PDFViewer } from './components/PDFViewer';
import { ImageViewer } from './components/ImageViewer';
import { CrewListView, CrewEmploymentStatusView, AuditRegistryView } from './components/CrewAndAudits';
import { AboutView } from './components/AboutView';
import { TroubleReportView } from './components/TroubleReport';
import { SparePartsRequisitionView } from './components/SparePartsRequisition';
import { BunkerBDNView } from './components/BunkerBDN';
import { LubeOilLDRView } from './components/LubeOilLDR';
import { BunkerFuelAnalysisView } from './components/BunkerFuelAnalysis';
import { LubeOilAnalysisView } from './components/LubeOilAnalysis';
import { SMSView } from './components/SMSView';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getDeviceId = () => {
  let deviceId = localStorage.getItem('comos_device_id');
  if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('comos_device_id', deviceId);
  }
  return deviceId;
};

const isDeviceRegistered = (registeredIds: string | null | undefined, currentId: string) => {
  if (!registeredIds) return false;
  if (registeredIds.startsWith('[') && registeredIds.endsWith(']')) {
    try {
      const arr = JSON.parse(registeredIds);
      if (Array.isArray(arr)) {
        return arr.includes(currentId);
      }
    } catch (e) {}
  }
  return registeredIds.split(',').map(s => s.trim()).includes(currentId);
};

const formatDeviceIds = (device_id: string | null | undefined) => {
  if (!device_id) return '-';
  if (device_id.startsWith('[') && device_id.endsWith(']')) {
    try {
      const arr = JSON.parse(device_id);
      if (Array.isArray(arr)) {
        return arr.join(', ');
      }
    } catch (e) {}
  }
  return device_id;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const DeviceRegistration = ({ user, token, onLogout, onVerified }: { user: User, token: string, onLogout: () => void, onVerified: (isVerified: boolean, deviceId: string) => void }) => {
  const [deviceCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'checking'>('idle');
  const [error, setError] = useState('');
  const deviceId = getDeviceId();

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/device/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.is_verified && isDeviceRegistered(data.device_id, deviceId)) {
        onVerified(true, deviceId);
      } else if (data.has_pending_request) {
        setStatus('pending');
      }
    } catch (e) {}
  }, [token, deviceId, onVerified]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000); // Check every 15s instead of 30s for better UX
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleRegister = async () => {
    setStatus('checking');
    setError('');
    try {
      const res = await fetch('/api/device/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_id: deviceId,
          device_code: deviceCode
        })
      });
      if (res.ok) {
        setStatus('pending');
      } else {
        const data = await res.json();
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
            This account is restricted to registered vessel devices. Please complete the registration process.
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
              <p className="text-xs text-slate-500 text-center italic">
                Provide this code to your Management or Admin to verify your device.
              </p>
              
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
                  {error}
                </div>
              )}

              <button
                onClick={handleRegister}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Request Registration
              </button>
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

            <button
              onClick={() => setStatus('idle')}
              className="w-full text-slate-500 hover:text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel Request
            </button>
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

// --- Types ---
interface Team {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'vessel' | 'team_pic';
  team_ids: number[];
  vessel_id?: number | null;
  email?: string;
  device_id?: string | null;
  is_verified?: boolean;
}

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'admin': return 'Admin';
    case 'team_pic': return 'Management';
    case 'user': return 'PIC';
    case 'vessel': return 'Vessel';
    default: return role;
  }
};

interface DeviceRegistrationRequest {
  id: number;
  user_id: number;
  username: string;
  vessel_name: string;
  device_code: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface RegisteredDevice {
  id: number;
  username: string;
  device_id: string;
  is_verified: boolean;
  vessel_name: string | null;
}

interface Vessel {
  id: number;
  name: string;
  team_id: number;
  team_name?: string;
  owner?: 'Nissen' | 'Goodwill';
  has_photo?: boolean;
  next_port?: string | null;
  route_status?: string | null;
  eta_atb?: string | null;
  etd_atd?: string | null;
  cargo?: string | null;
  operation_type?: string | null;
  remark_from_vessel?: string | null;
  flag?: string | null;
  type?: 'Bulk Carrier' | 'Container';
  date_built?: string | null;
  min_fuel_consumption?: string | null;
  max_fuel_consumption?: string | null;
  charterer_min_hsfo?: string | null;
  charterer_max_hsfo?: string | null;
  charterer_min_lsfo?: string | null;
  charterer_max_lsfo?: string | null;
  charterer_min_mgo?: string | null;
  charterer_max_mgo?: string | null;
  charterer_min_mdo?: string | null;
  charterer_max_mdo?: string | null;
}

interface VesselFlag {
  id: number;
  name: string;
}

interface Certificate {
  id: number;
  vessel_id: number | null;
  team_id: number;
  vessel_name: string | null;
  team_name: string;
  owner?: 'Nissen' | 'Goodwill' | null;
  name: string;
  expiration_date: string;
  date_issued?: string | null;
  certificate_number?: string | null;
  access_type: 'office' | 'vessel' | 'any';
  has_file?: boolean;
}

interface DepartureReport {
  id: number;
  vessel_id: number;
  user_id: number;
  voyage_number: string;
  utc_date_time: string;
  departure_port: string;
  eu_uk_status: string;
  position_long: string;
  position_lat: string;
  operation_type: string;
  cargo_status: string;
  rob_type: string;
  rob_hsfo: number;
  rob_lsfo: number;
  rob_mgo: number;
  rob_mdo: number;
  rob_fw: number;
  foc_port_hsfo: number;
  foc_port_lsfo: number;
  foc_port_mgo: number;
  foc_port_mdo: number;
  attachment_id?: number | null;
  created_at: string;
  vessel_name?: string;
  attachment_name?: string;
}

interface ArrivalReport {
  id: number;
  vessel_id: number;
  user_id: number;
  voyage_number: string;
  utc_date_time: string;
  arrival_port: string;
  eu_uk_status: string;
  position_long: string;
  position_lat: string;
  operation_type: string;
  cargo_status: string;
  total_time_at_sea: string;
  total_distance: string;
  rob_type: string;
  rob_hsfo: number;
  rob_lsfo: number;
  rob_mgo: number;
  rob_mdo: number;
  rob_fw: number;
  foc_sea_hsfo: number;
  foc_sea_lsfo: number;
  foc_sea_mgo: number;
  foc_sea_mdo: number;
  agent_detail: string;
  attachment_id?: number | null;
  created_at: string;
  vessel_name?: string;
  attachment_name?: string;
}

interface NoonReport {
  id: number;
  vessel_id: number;
  user_id: number;
  voyage_number: string;
  utc_date_time: string;
  position_long: string;
  position_lat: string;
  distance_to_go: string;
  cargo_status: string;
  rob_hsfo: number;
  rob_lsfo: number;
  rob_mgo: number;
  rob_mdo: number;
  foc_hsfo: number;
  foc_lsfo: number;
  foc_mgo: number;
  foc_mdo: number;
  created_at: string;
  vessel_name?: string;
  attachment_id?: number;
  attachment_name?: string;
  weather_notation?: string | null;
  swell_scale_21?: string | null;
  wind_scale?: string | null;
  wave_scale?: string | null;
  weather_image?: string | null;
  remarks?: string | null;
  destination_port?: string | null;
  eta_utc?: string | null;
  agent_details?: string | null;
  charterer_min_hsfo?: string | null;
  charterer_max_hsfo?: string | null;
  charterer_min_lsfo?: string | null;
  charterer_max_lsfo?: string | null;
  charterer_min_mgo?: string | null;
  charterer_max_mgo?: string | null;
  charterer_min_mdo?: string | null;
  charterer_max_mdo?: string | null;
}

interface OtherReport {
  id: number;
  vessel_id: number;
  user_id: number;
  voyage_number: string;
  utc_date_time: string;
  port: string;
  eu_uk_status: string;
  position_long: string;
  position_lat: string;
  operation_type: string;
  cargo_status: string;
  rob_type: string;
  rob_hsfo: number;
  rob_lsfo: number;
  rob_mgo: number;
  rob_mdo: number;
  rob_fw: number;
  foc_port_hsfo: number;
  foc_port_lsfo: number;
  foc_port_mgo: number;
  foc_port_mdo: number;
  created_at: string;
  vessel_name?: string;
}

const getStatus = (date: string) => {
  if (!date) return 'unknown';
  const exp = parseISO(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const sixtyDays = addDays(today, 60);
  const thirtyDays = addDays(today, 30);
  
  if (isBefore(exp, today)) return 'expired';
  if (isBefore(exp, thirtyDays)) return 'expiring soon';
  if (isBefore(exp, sixtyDays)) return 'expiring';
  return 'active';
};

const isFocOutsideLimits = (focStr: string, minLimitStr?: string | null, maxLimitStr?: string | null) => {
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

interface Note {
  id: number;
  certificate_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}

interface FileData {
  id: number;
  certificate_id: number;
  filename: string;
  original_name: string;
  mimetype?: string;
  file_type: 'certificate' | 'supporting';
  upload_date: string;
}

interface Notification {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface DBStatus {
  connected: boolean;
  error: string | null;
  errorCode?: string | null;
  tcpStatus?: string;
  webStatus?: string;
  outboundIp?: string;
  config?: any;
}

let customLogoUrlGlobal: string | null = null;
const logoListeners = new Set<(url: string | null) => void>();

export const getCustomLogoUrl = () => customLogoUrlGlobal;
export const setCustomLogoUrl = (url: string | null) => {
  customLogoUrlGlobal = url;
  logoListeners.forEach(listener => listener(url));
};

export const useCustomLogo = () => {
  const [logo, setLogo] = useState<string | null>(customLogoUrlGlobal);
  useEffect(() => {
    const listener = (newUrl: string | null) => setLogo(newUrl);
    logoListeners.add(listener);
    return () => {
      logoListeners.delete(listener);
    };
  }, []);
  return logo;
};

const Logo = ({ className, iconClassName }: { className?: string; iconClassName?: string }) => {
  const customLogo = useCustomLogo();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [customLogo]);

  if (hasError) {
    return (
      <Ship className={cn(iconClassName || "text-blue-600", className)} />
    );
  }

  return (
    <img 
      src={customLogo || "/logo.png"} 
      alt="COMOS Logo" 
      className={cn("object-contain", className)}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
};

const LogoContainer = ({ size = 'md', className, iconClassName }: { size?: 'sm' | 'md' | 'lg' | 'xs', className?: string, iconClassName?: string }) => {
  const sizes = {
    xs: "w-8 h-8 p-1",
    sm: "w-12 h-12 p-1.5",
    md: "w-16 h-16 p-2",
    lg: "w-24 h-24 p-3"
  };
  
  return (
    <div className={cn(
      "bg-white rounded-xl shadow-sm border border-blue-50 flex items-center justify-center overflow-hidden transition-all duration-300", 
      sizes[size], 
      size === 'lg' && "rounded-2xl", 
      className
    )}>
      <Logo className="w-full h-full" iconClassName={iconClassName} />
    </div>
  );
};

const isGeminiSupportedMimeType = (mimeType: string) => {
  const supported = [
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf'
  ];
  return supported.includes(mimeType);
};

const AUTO_FILL_ENABLED = false; // Set to false to temporarily disable the Gemini OCR certificate auto-fill feature

const recognizeCertText = async (file: File) => {
  if (!isGeminiSupportedMimeType(file.type)) {
    console.warn(`OCR skipped: MIME type ${file.type} is not supported by Gemini multimodal input.`);
    return {};
  }

  // Generate a robust unique cache key for this file
  const cacheKey = `comos_ocr_v2_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}_${file.size}_${file.lastModified}`;
  
  // 1. Check local cache
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      console.log("OCR Result retrieved instantly from client-side cache:", parsed);
      return parsed;
    }
  } catch (err) {
    console.warn("Error reading from OCR cache:", err);
  }

  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);

  let response: Response | null = null;
  let retries = 2; // Retry twice on transient API failures
  let delayMs = 1500;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        break; // Success!
      }

      // If unauthorized or bad request, don't retry
      if (response.status === 401 || response.status === 400 || response.status === 403) {
        break;
      }
    } catch (fetchErr) {
      if (attempt === retries + 1) {
        throw fetchErr;
      }
    }

    if (attempt <= retries) {
      console.warn(`OCR client-side request attempt ${attempt} failed or timed out. Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  if (!response || !response.ok) {
    const errData = await response?.json().catch(() => ({})).then(data => data || {});
    throw new Error(errData.error || 'Failed to analyze document.');
  }

  const data = await response.json();
  console.log("OCR Result from server:", data);

  // 2. Store in local cache for instant future retrieval
  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (cacheStoreErr) {
    console.warn("Failed to save OCR result to cache:", cacheStoreErr);
  }

  return data;
};

// --- Components ---

const NotificationToast: React.FC<{ notification: Notification, onClose: (id: number) => void }> = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border min-w-[300px] mb-3",
        notification.type === 'success' 
          ? "bg-white border-blue-100 text-blue-800" 
          : notification.type === 'info'
            ? "bg-white border-slate-100 text-slate-800"
            : "bg-white border-red-100 text-red-800"
      )}
    >
      {notification.type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-blue-500" />
      ) : notification.type === 'info' ? (
        <AlertCircle className="w-5 h-5 text-slate-400" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500" />
      )}
      <p className="text-sm font-medium flex-1">{notification.message}</p>
      <button onClick={() => onClose(notification.id)} className="p-1 hover:bg-blue-50 rounded-lg transition-colors">
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </motion.div>
  );
};

const Login = ({ onLogin, dbStatus }: { onLogin: (token: string, user: User) => void, dbStatus: DBStatus | null }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dbStatus && !dbStatus.connected) {
      setError('Database is not connected. Please check configuration.');
      return;
    }
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          onLogin(data.token, data.user);
        } else {
          setError(data.error || data.details || 'Login failed');
        }
      } else {
        setError(`Unexpected server response (${res.status})`);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
      {dbStatus && !dbStatus.connected && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mb-6 bg-red-50 border border-red-200 p-4 rounded-2xl flex flex-col gap-3"
        >
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-800">Database Connection Error</h3>
              <p className="text-xs text-red-600 mt-1">{dbStatus.error || 'Could not connect to MySQL server.'}</p>
            </div>
          </div>
          
          <div className="bg-white/50 p-3 rounded-xl border border-red-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2">Current Configuration</p>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-red-700">
              <div>Host: <span className="font-bold">{dbStatus.config?.host || 'localhost'}</span></div>
              <div>Port: <span className="font-bold">{dbStatus.config?.port || 3306}</span></div>
              <div>User: <span className="font-bold">{dbStatus.config?.user || 'root'}</span></div>
              <div>DB: <span className="font-bold">{dbStatus.config?.database || 'vessel_cert'}</span></div>
              <div className="col-span-2 mt-1 pt-1 border-t border-red-100/30 flex flex-col gap-1">
                <div>Port 3306 (MySQL): <span className={cn("font-bold", dbStatus.tcpStatus === 'OPEN' ? "text-green-600" : "text-red-700")}>
                  {dbStatus.tcpStatus || 'Checking...'}
                </span></div>
                <div>Port 80 (Web): <span className={cn("font-bold", dbStatus.webStatus === 'REACHABLE' ? "text-green-600" : "text-red-700")}>
                  {dbStatus.webStatus || 'Checking...'}
                </span></div>
                <div className="mt-1 pt-1 border-t border-red-100/20 text-[10px] opacity-70">
                  App Outbound IP: <span className="font-mono font-bold">{dbStatus.outboundIp || 'Detecting...'}</span>
                </div>
              </div>
            </div>
            {dbStatus.errorCode && (
              <div className="mt-2 pt-2 border-t border-red-100 text-[10px] text-red-800">
                Error Code: <span className="font-bold">{dbStatus.errorCode}</span>
              </div>
            )}
          </div>

          <div className="text-[10px] text-red-500 space-y-1">
            <p className="font-bold uppercase tracking-wider">Troubleshooting:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><span className="font-bold">ETIMEDOUT:</span> The server is not responding. This is usually a <span className="font-bold">Firewall</span> issue.
                <ul className="list-disc pl-4 mt-1 opacity-80">
                  <li>Double-check if <span className="font-bold">cleanocean.com.ph</span> is the correct DB host. Some hosts use <span className="font-bold">mysql.cleanocean.com.ph</span> or an IP.</li>
                  <li>Verify that port <span className="font-bold">3306</span> is open on your server.</li>
                  <li>Some shared hosts block remote MySQL entirely for security. You may need to contact their support.</li>
                </ul>
              </li>
              <li><span className="font-bold">Remote MySQL Allowlist:</span> You mentioned adding <span className="font-bold">%</span>. Ensure it was added to the <span className="font-bold">correct database user</span> and not just the account.</li>
              <li><span className="font-bold">ECONNREFUSED:</span> Usually means the DB isn't running on that port or host.</li>
              <li><span className="font-bold">ER_ACCESS_DENIED_ERROR:</span> Check your username and password.</li>
            </ul>
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
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mt-1">Fleet Management</p>
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
              placeholder="••••••••"
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


const SidebarContent = ({ 
  view, setView, setIsSidebarOpen, user, isAdminTreeOpen, setIsAdminTreeOpen, isVoyageReportOpen, setIsVoyageReportOpen, isMonitoringOpen, setIsMonitoringOpen, isDefectsOpen, setIsDefectsOpen, isSparePartsOpen, setIsSparePartsOpen, isBunkerOpen, setIsBunkerOpen, isLubeOilOpen, setIsLubeOilOpen, isStoreChemicalsOpen, setIsStoreChemicalsOpen, isCrewOpen, setIsCrewOpen, isAuditsOpen, setIsAuditsOpen, isCertificatesOpen, setIsCertificatesOpen, onLogout, setIsChangePasswordOpen 
}: { 
  view: string, 
  setView: (v: any) => void, 
  setIsSidebarOpen: (v: boolean) => void, 
  user: User, 
  isAdminTreeOpen: boolean, 
  setIsAdminTreeOpen: (v: boolean) => void,
  isVoyageReportOpen: boolean,
  setIsVoyageReportOpen: (v: boolean) => void,
  isMonitoringOpen: boolean,
  setIsMonitoringOpen: (v: boolean) => void,
  isDefectsOpen: boolean,
  setIsDefectsOpen: (v: boolean) => void,
  isSparePartsOpen: boolean,
  setIsSparePartsOpen: (v: boolean) => void,
  isBunkerOpen: boolean,
  setIsBunkerOpen: (v: boolean) => void,
  isLubeOilOpen: boolean,
  setIsLubeOilOpen: (v: boolean) => void,
  isStoreChemicalsOpen: boolean,
  setIsStoreChemicalsOpen: (v: boolean) => void,
  isCrewOpen: boolean,
  setIsCrewOpen: (v: boolean) => void,
  isAuditsOpen: boolean,
  setIsAuditsOpen: (v: boolean) => void,
  isCertificatesOpen: boolean,
  setIsCertificatesOpen: (v: boolean) => void,
  onLogout: () => void,
  setIsChangePasswordOpen: (v: boolean) => void
}) => {
  const [isSmsReportingOpen, setIsSmsReportingOpen] = React.useState(false);
  // Beautiful interactive helper styling functions
  const getTopLevelClass = (active: boolean) => cn(
    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-left cursor-pointer",
    active 
      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10 hover:bg-blue-700" 
      : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
  );

  const getCategoryToggleClass = (active: boolean, isOpen: boolean) => cn(
    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-left cursor-pointer",
    active 
      ? "bg-blue-50/70 text-blue-700 font-bold" 
      : isOpen
        ? "text-slate-800 bg-slate-50"
        : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
  );

  const getSubItemClass = (active: boolean) => cn(
    "w-full flex items-center gap-3 pl-9 pr-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 text-left relative cursor-pointer",
    active 
      ? "bg-blue-50/50 text-blue-700 font-black border-l-2 border-blue-600 pl-[34px]" 
      : "text-slate-500 hover:bg-slate-50/40 hover:text-blue-600 hover:pl-[38px]"
  );

  return (
    <>
      <button 
        onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
        className="p-6 flex items-center gap-3 hover:opacity-80 transition-opacity text-left w-full cursor-pointer"
      >
        <LogoContainer size="sm" className="border-none shadow-none" />
        <span className="font-bold text-lg tracking-tight text-blue-900">COMOS</span>
      </button>
      
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {/* Core Navigation Section */}
        <button 
          onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
          className={getTopLevelClass(view === 'dashboard')}
        >
          <Clock className="w-4 h-4" /> Dashboard
        </button>

        {user.role !== 'vessel' && (
          <button 
            onClick={() => { setView('vessels'); setIsSidebarOpen(false); }}
            className={getTopLevelClass(view === 'vessels')}
          >
            <Ship className="w-4 h-4" /> Vessels
          </button>
        )}

        <button 
          onClick={() => { setView('routing'); setIsSidebarOpen(false); }}
          className={getTopLevelClass(view === 'routing')}
        >
          <Compass className="w-4 h-4" /> Vessel Routing
        </button>

        {/* Voyage Report collapsible */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsVoyageReportOpen(!isVoyageReportOpen)}
            className={getCategoryToggleClass(
              ['departure', 'arrival', 'noon_to_noon', 'other_report'].includes(view),
              isVoyageReportOpen
            )}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4" /> Voyage Report
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isVoyageReportOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isVoyageReportOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('noon_to_noon'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'noon_to_noon')}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" /> Noon to Noon
                </button>
                <button 
                  onClick={() => { setView('arrival'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'arrival')}
                >
                  <MapIcon className="w-3.5 h-3.5 shrink-0" /> Arrival
                </button>
                <button 
                  onClick={() => { setView('departure'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'departure')}
                >
                  <Navigation className="w-3.5 h-3.5 shrink-0" /> Departure
                </button>
                <button 
                  onClick={() => { setView('other_report'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'other_report')}
                >
                  <File className="w-3.5 h-3.5 shrink-0" /> Other Report
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Monitoring & Operations group (Fully flattened child items for exceptional usability!) */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsMonitoringOpen(!isMonitoringOpen)}
            className={getCategoryToggleClass(
              ['defects_5_2', 'spare_requisition_ship', 'bunker_bdn', 'bunker_fuel_analysis', 'lube_oil_ldr', 'lube_oil_analysis', 'store_chemical_requisition'].includes(view),
              isMonitoringOpen
            )}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4" /> Operations &amp; Monitoring
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isMonitoringOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isMonitoringOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('defects_5_2'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'defects_5_2')}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" /> Defects &amp; Troubles
                </button>

                <button 
                  onClick={() => { setView('spare_requisition_ship'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(['spare_requisition_ship', 'spare_quotation_pic', 'spare_logistic_pic', 'spare_delivery_note_ship'].includes(view))}
                >
                  <Package className="w-3.5 h-3.5 shrink-0" /> Spare Requisitions
                </button>

                <button 
                  onClick={() => { setView('bunker_bdn'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'bunker_bdn')}
                >
                  <Fuel className="w-3.5 h-3.5 shrink-0" /> Bunker BDN Logs
                </button>

                <button 
                  onClick={() => { setView('bunker_fuel_analysis'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'bunker_fuel_analysis')}
                >
                  <Droplets className="w-3.5 h-3.5 shrink-0 text-sky-500" /> Fuel Lab Analysis
                </button>

                <button 
                  onClick={() => { setView('lube_oil_ldr'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'lube_oil_ldr')}
                >
                  <Waves className="w-3.5 h-3.5 shrink-0 text-blue-400" /> Lube Oil LDR
                </button>

                <button 
                  onClick={() => { setView('lube_oil_analysis'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'lube_oil_analysis')}
                >
                  <Activity className="w-3.5 h-3.5 shrink-0" /> Lube Oil Analysis
                </button>

                <button 
                  onClick={() => { setView('store_chemical_requisition'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'store_chemical_requisition')}
                >
                  <FlaskConical className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> Store &amp; Chemicals
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Certificates Group - Now elevated to top-level category for immediate action */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsCertificatesOpen(!isCertificatesOpen)}
            className={getCategoryToggleClass(
              ['admin_add_cert', 'admin_cert_list'].includes(view),
              isCertificatesOpen
            )}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4" /> Certificates &amp; Reports
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isCertificatesOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isCertificatesOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('admin_add_cert'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'admin_add_cert')}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" /> Add Cert/Report
                </button>
                <button 
                  onClick={() => { setView('admin_cert_list'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'admin_cert_list')}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" /> Service Report Registry
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Crew Group */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsCrewOpen(!isCrewOpen)}
            className={getCategoryToggleClass(
              user.role === 'vessel' ? ['crew_list'].includes(view) : ['crew_list', 'crew_compliance'].includes(view),
              isCrewOpen
            )}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4" /> Crew Management
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isCrewOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isCrewOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('crew_list'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'crew_list')}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" /> Onboard Crew
                </button>
                {user.role !== 'vessel' && (
                  <button 
                    onClick={() => { setView('crew_compliance'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'crew_compliance')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> Crew Pool List
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Audits Group */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsAuditsOpen(!isAuditsOpen)}
            className={getCategoryToggleClass(
              ['audit_list', 'audit_internal', 'audit_external', 'audit_vir', 'audit_navigational'].includes(view),
              isAuditsOpen
            )}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4" /> Audits &amp; Inspections
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isAuditsOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isAuditsOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('audit_list'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_list')}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Audit Registry
                </button>
                <button 
                  onClick={() => { setView('audit_internal'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_internal')}
                >
                  <CheckSquare className="w-3.5 h-3.5 shrink-0" /> Internal Audit
                </button>
                <button 
                  onClick={() => { setView('audit_external'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_external')}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" /> External Audit
                </button>
                <button 
                  onClick={() => { setView('audit_vir'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_vir')}
                >
                  <Search className="w-3.5 h-3.5 shrink-0" /> VIR Report
                </button>
                <button 
                  onClick={() => { setView('audit_navigational'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_navigational')}
                >
                  <Compass className="w-3.5 h-3.5 shrink-0 text-blue-500" /> Navigational Audit
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SMS Group */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsSmsReportingOpen(!isSmsReportingOpen)}
            className={getCategoryToggleClass(
              view === 'sms' || view === 'sms_reporting',
              isSmsReportingOpen
            )}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4" /> SMS
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isSmsReportingOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isSmsReportingOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                {user.role !== 'vessel' && (
                  <button 
                    onClick={() => { setView('sms'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'sms')}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" /> SMS Management
                  </button>
                )}
                {(user.role === 'vessel' || user.role === 'admin' || user.role === 'user' || user.role === 'team_pic') && (
                  <button 
                    onClick={() => { setView('sms_reporting'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'sms_reporting')}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" /> SMS Reporting
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Administration panel */}
        {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
          <div className="space-y-1">
            <button 
              onClick={() => setIsAdminTreeOpen(!isAdminTreeOpen)}
              className={getCategoryToggleClass(
                view.startsWith('admin'),
                isAdminTreeOpen
              )}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4" /> Admin Panel
              </div>
              <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isAdminTreeOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
            </button>
            
            <AnimatePresence>
              {isAdminTreeOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-1 space-y-1"
                >
                  <button 
                    onClick={() => { setView('admin_new_vessel'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'admin_new_vessel')}
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" /> New Vessel
                  </button>
                  <button 
                    onClick={() => { setView('admin_vessel_list'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'admin_vessel_list')}
                  >
                    <Ship className="w-3.5 h-3.5 shrink-0" /> Vessel List
                  </button>
                  <button 
                    onClick={() => { setView('admin'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'admin')}
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0" /> Admin Settings
                  </button>
                  <button 
                    onClick={() => { setView('admin_recycle_bin'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'admin_recycle_bin')}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" /> Recycle Bin
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {user.role !== 'vessel' && (
          <button 
            onClick={() => { setView('slideshow'); setIsSidebarOpen(false); }}
            className={getTopLevelClass(view === 'slideshow')}
          >
            <Monitor className="w-4 h-4" /> Slideshow
          </button>
        )}

        <button 
          onClick={() => { setView('about'); setIsSidebarOpen(false); }}
          className={getTopLevelClass(view === 'about')}
        >
          <Info className="w-4 h-4" /> About COMOS
        </button>
      </nav>

      <div className="p-4 border-t border-slate-100 bg-white/80 backdrop-blur-md">
        <button 
          onClick={() => { setIsChangePasswordOpen(true); setIsSidebarOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 group-hover:bg-blue-200 transition-colors">
            {user.username[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate text-slate-800">{user.username}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{getRoleLabel(user.role)}</p>
          </div>
          <Settings className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50/70 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </>
  );
};

const Dashboard = ({ user, token, onLogout }: { user: User, token: string, onLogout: () => void }) => {
  const [view, setView] = useState<'dashboard' | 'vessels' | 'routing' | 'admin' | 'slideshow' | 'departure' | 'arrival' | 'noon_to_noon' | 'fuel_consumption' | 'admin_vessel_list' | 'admin_cert_list' | 'admin_new_vessel' | 'admin_add_cert' | 'other_report' | 'admin_recycle_bin' | 'defects_5_2' | 'defects_1_6' | 'spare_requisition_ship' | 'spare_quotation_pic' | 'spare_logistic_pic' | 'spare_delivery_note_ship' | 'bunker_bdn' | 'bunker_fuel_analysis' | 'lube_oil_analysis' | 'lube_oil_requisition' | 'lube_oil_ldr' | 'store_requisition' | 'chemical_requisition' | 'store_chemical_requisition' | 'crew_list' | 'crew_compliance' | 'audit_list' | 'audit_internal' | 'audit_external' | 'audit_vir' | 'audit_navigational' | 'about' | 'sms' | 'sms_reporting'>('dashboard');
  const [isAdminTreeOpen, setIsAdminTreeOpen] = useState(false);
  const [isVoyageReportOpen, setIsVoyageReportOpen] = useState(false);
  const [isMonitoringOpen, setIsMonitoringOpen] = useState(false);
  const [isDefectsOpen, setIsDefectsOpen] = useState(false);
  const [isSparePartsOpen, setIsSparePartsOpen] = useState(false);
  const [isBunkerOpen, setIsBunkerOpen] = useState(false);
  const [isLubeOilOpen, setIsLubeOilOpen] = useState(false);
  const [isStoreChemicalsOpen, setIsStoreChemicalsOpen] = useState(false);
  const [isCrewOpen, setIsCrewOpen] = useState(false);
  const [isAuditsOpen, setIsAuditsOpen] = useState(false);
  const [isCertificatesOpen, setIsCertificatesOpen] = useState(false);
  
  const [loadingStates, setLoadingStates] = useState({
    global: false,
    departure: false,
    arrival: false,
    noon: false,
    other: false,
  });

  const getLatestArrivalOperationType = (vesselId: number) => {
    const reports = arrivalReports
      .filter(r => r.vessel_id === vesselId)
      .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime());
    return reports.length > 0 ? reports[0].operation_type : 'N/A';
  };

  const [certs, setCerts] = useState<Certificate[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [flags, setFlags] = useState<VesselFlag[]>([]);
  const [departureReports, setDepartureReports] = useState<DepartureReport[]>([]);
  const [arrivalReports, setArrivalReports] = useState<ArrivalReport[]>([]);
  const [noonReports, setNoonReports] = useState<NoonReport[]>([]);
  const [otherReports, setOtherReports] = useState<OtherReport[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [crewMembers, setCrewMembers] = useState<any[]>([]);
  const [auditRecords, setAuditRecords] = useState<any[]>([]);
  const [nonConformities, setNonConformities] = useState<any[]>([]);
  const [troubleReports, setTroubleReports] = useState<any[]>([]);
  const [spareRequisitions, setSpareRequisitions] = useState<any[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [newNote, setNewNote] = useState('');
  const [search, setSearch] = useState('');
  const [newExpDate, setNewExpDate] = useState('');
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [vesselCertSearch, setVesselCertSearch] = useState('');
  const [vesselSearch, setVesselSearch] = useState('');
  const [vesselFilterTeam, setVesselFilterTeam] = useState('');
  const [vesselFilterOwner, setVesselFilterOwner] = useState('');
  const [vesselSortField, setVesselSortField] = useState<'name' | 'team' | 'owner'>('name');
  const [vesselSortOrder, setVesselSortOrder] = useState<'asc' | 'desc'>('asc');
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [editingVesselPhoto, setEditingVesselPhoto] = useState<File | null>(null);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [newCertFile, setNewCertFile] = useState<File | null>(null);

  const [routeForm, setRouteForm] = useState({
    next_port: '',
    route_status: '',
    eta_atb: '',
    etd_atd: '',
    cargo: ''
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Certificate | 'status', direction: 'asc' | 'desc' } | null>({ key: 'expiration_date', direction: 'asc' });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [routingForm, setRoutingForm] = useState<Record<number, Partial<Vessel>>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [uploadFileType, setUploadFileType] = useState<'certificate' | 'supporting'>('certificate');
  const [tempPreviewUrl, setTempPreviewUrl] = useState<string | null>(null);
  const sidePanelContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Correctly initialize routing form when vessels change
    const initialForm: Record<number, Partial<Vessel>> = {};
    vessels.forEach(v => {
      // Find latest arrival port for this vessel to use as autofill for next_port if empty
      const latestArrival = [...arrivalReports]
        .filter(r => r.vessel_id === v.id)
        .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime())[0];
      
      initialForm[v.id] = {
        next_port: v.next_port || latestArrival?.arrival_port || '',
        route_status: v.route_status || '',
        eta_atb: v.eta_atb || '',
        etd_atd: v.etd_atd || '',
        cargo: v.cargo || '',
        operation_type: v.operation_type || latestArrival?.operation_type || '',
        remark_from_vessel: v.remark_from_vessel || ''
      };
    });
    setRoutingForm(initialForm);
  }, [vessels, arrivalReports]);

  const handleUpdateRoutingRow = (vesselId: number, field: string, value: string) => {
    setRoutingForm(prev => ({
      ...prev,
      [vesselId]: {
        ...prev[vesselId],
        [field]: value
      }
    }));
  };

  const handleSaveAllRouting = async () => {
    setIsSavingAll(true);
    let successCount = 0;
    let failCount = 0;

    const savePromises = Object.entries(routingForm).map(async ([id, data]) => {
      try {
        const res = await fetch(`/api/vessels/${id}/route`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch (err) {
        failCount++;
      }
    });

    await Promise.all(savePromises);
    
    if (successCount > 0) {
      notify('success', `Updated ${successCount} vessels successfully`);
      fetchData();
    }
    if (failCount > 0) {
      notify('error', `Failed to update ${failCount} vessels`);
    }
    setIsSavingAll(false);
  };

  const handleUpdateVessel = async () => {
    if (!editingVessel || !editingVessel.name) {
      notify('error', 'Vessel name is required');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('name', editingVessel.name);
      formData.append('team_id', editingVessel.team_id ? String(editingVessel.team_id) : '');
      formData.append('owner', editingVessel.owner || 'Nissen');
      formData.append('flag', editingVessel.flag || '');
      formData.append('type', editingVessel.type || 'Bulk Carrier');
      formData.append('date_built', editingVessel.date_built || '');
      formData.append('min_fuel_consumption', editingVessel.min_fuel_consumption || '');
      formData.append('max_fuel_consumption', editingVessel.max_fuel_consumption || '');
      if (editingVesselPhoto) {
        formData.append('photo', editingVesselPhoto);
      }

      const res = await fetch(`/api/vessels/${editingVessel.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        notify('success', 'Vessel updated successfully');
        setEditingVessel(null);
        setEditingVesselPhoto(null);
        fetchData();
      } else {
        const data = await res.json();
        notify('error', data.error || 'Failed to update vessel');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleDeleteVessel = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Vessel',
      message: 'Are you sure you want to delete this vessel? This will also delete all associated certificates.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/vessels/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            notify('success', 'Vessel deleted successfully');
            fetchData();
          } else {
            notify('error', 'Failed to delete vessel');
          }
        } catch (err) {
          notify('error', 'Connection error occurred');
        }
      }
    });
  };

  const handleUpdateCert = async () => {
    if (!editingCert || !editingCert.name || !editingCert.expiration_date) {
      notify('error', 'Certificate/Service Report name and expiration date are required');
      return;
    }
    try {
      const res = await fetch(`/api/certificates/${editingCert.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          vessel_id: editingCert.vessel_id, 
          team_id: editingCert.team_id,
          name: editingCert.name, 
          certificate_number: editingCert.certificate_number,
          date_issued: editingCert.date_issued,
          expiration_date: editingCert.expiration_date,
          access_type: editingCert.access_type
        }),
      });

      if (res.ok) {
        notify('success', 'Certificate/Service Report updated successfully');
        setEditingCert(null);
        fetchData();
      } else {
        notify('error', 'Failed to update certificate');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleDeleteCert = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Certificate/Service Report',
      message: 'Are you sure you want to delete this certificate/service report?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/certificates/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            notify('success', 'Certificate/Service Report deleted successfully');
            fetchData();
          } else {
            notify('error', 'Failed to delete certificate/service report');
          }
        } catch (err) {
          notify('error', 'Connection error occurred');
        }
      }
    });
  };

  const groupedVessels = React.useMemo(() => {
    const groups: Record<string, Vessel[]> = {};
    vessels.forEach(v => {
      const owner = v.owner || 'Other';
      if (!groups[owner]) groups[owner] = [];
      groups[owner].push(v);
    });

    const sortedOwners = Object.keys(groups).sort((a, b) => {
      // Prioritize Nissen and Goodwill if they exist
      const priority = { 'Nissen': 1, 'Goodwill': 2 };
      const pA = priority[a as keyof typeof priority] || 99;
      const pB = priority[b as keyof typeof priority] || 99;
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    });

    sortedOwners.forEach(owner => {
      groups[owner].sort((a, b) => {
        const teamA = a.team_name || '';
        const teamB = b.team_name || '';
        const teamComp = teamA.localeCompare(teamB);
        if (teamComp !== 0) return teamComp;
        return a.name.localeCompare(b.name);
      });
    });

    return { sortedOwners, groups };
  }, [vessels]);

  const notesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedCert) {
      scrollToBottom();
    }
  }, [notes, selectedCert]);

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setNotifications(prev => {
      const next = [...prev, { id, type, message }];
      // Limit the number of toast messages to at most 3
      if (next.length > 3) {
        return next.slice(next.length - 3);
      }
      return next;
    });
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const fetchData = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, global: true }));
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [
        certsRes,
        vesselsRes,
        teamsRes,
        flagsRes,
        crewRes,
        auditsRes,
        ncRes,
        troubleRes,
        spareRes,
        depRes,
        arrRes,
        noonRes,
        otherRes,
      ] = await Promise.all([
        fetch('/api/certificates', { headers }),
        fetch('/api/vessels', { headers }),
        fetch('/api/teams', { headers }),
        fetch('/api/flags', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/crew-members', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/audit-records', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/non-conformities', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/trouble-reports', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/spare-parts-requisitions', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/departure-reports', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/arrival-reports', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/noon-reports', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/other-reports', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
      ]);
      
      const processResponse = async (res: Response, setter: (data: any) => void, name: string) => {
        if (!res.ok) {
          console.warn(`Fetch ${name} failed with status ${res.status}`);
          return;
        }
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await res.json();
            setter(data);
          } catch (e) {
            console.error(`Failed to parse JSON for ${name}:`, e);
          }
        } else {
          try {
            const text = await res.text();
            console.error(`Expected JSON for ${name} but got ${contentType}:`, text.substring(0, 100));
          } catch (e) {}
        }
      };

      await Promise.all([
        processResponse(certsRes, setCerts, 'certificates'),
        processResponse(vesselsRes, setVessels, 'vessels'),
        processResponse(teamsRes, setTeams, 'teams'),
        processResponse(flagsRes, setFlags, 'flags'),
        processResponse(crewRes, setCrewMembers, 'crew'),
        processResponse(auditsRes, setAuditRecords, 'audits'),
        processResponse(ncRes, setNonConformities, 'nonconformities'),
        processResponse(troubleRes, setTroubleReports, 'troublereports'),
        processResponse(spareRes, setSpareRequisitions, 'sparerequisitions'),
        processResponse(depRes, setDepartureReports, 'departurereports'),
        processResponse(arrRes, setArrivalReports, 'arrivalreports'),
        processResponse(noonRes, setNoonReports, 'noonreports'),
        processResponse(otherRes, setOtherReports, 'otherreports'),
      ]);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, global: false }));
    }
  }, [token]);

  const handleUpdateRoute = async () => {
    if (!selectedVessel) return;
    try {
      const res = await fetch(`/api/vessels/${selectedVessel.id}/route`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(routeForm)
      });
      if (res.ok) {
        notify('success', 'Vessel route updated');
        setIsEditingRoute(false);
        fetchData();
        // Update selected vessel in state to reflect changes immediately
        setSelectedVessel({
          ...selectedVessel,
          ...routeForm
        });
      } else {
        const data = await res.json();
        notify('error', data.error || 'Failed to update route');
      }
    } catch (err) {
      notify('error', 'Connection error');
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchCertDetails = async (cert: Certificate, isRefresh = false) => {
    setSelectedVessel(null);
    if (!isRefresh) {
      setTempPreviewUrl(null);
      setPreviewFile(null);
    }
    setSelectedCert(cert);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [notesRes, filesRes] = await Promise.all([
        fetch(`/api/certificates/${cert.id}/notes`, { headers }),
        fetch(`/api/certificates/${cert.id}/files`, { headers }),
      ]);
      
      if (notesRes.ok && notesRes.headers.get('content-type')?.includes('application/json')) {
        setNotes(await notesRes.json());
      }
      if (filesRes.ok && filesRes.headers.get('content-type')?.includes('application/json')) {
        const filesData: FileData[] = await filesRes.json();
        setFiles(filesData);
        // Latest Certificate files should always be pinned as the default display.
        if (filesData.length > 0 && (!isRefresh || !previewFile)) {
          const certFiles = filesData.filter(f => f.file_type === 'certificate');
          if (certFiles.length > 0) {
            setPreviewFile([...certFiles].sort((a, b) => b.id - a.id)[0]);
          } else {
            setPreviewFile([...filesData].sort((a, b) => b.id - a.id)[0]);
          }
        } else if (filesData.length === 0) {
          setPreviewFile(null);
        }
      }
      
      setSelectedCert(cert);
      setNewExpDate(cert.expiration_date);
    } catch (err) {
      console.error('Failed to fetch cert details:', err);
    }
  };

  const handleSidePanelUpdateCert = async () => {
    if (!selectedCert || !newExpDate) return;
    try {
      const res = await fetch(`/api/certificates/${selectedCert.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          expiration_date: newExpDate,
          date_issued: selectedCert.date_issued,
          certificate_number: selectedCert.certificate_number
        }),
      });
      if (res.ok) {
        notify('success', 'Certificate/Service Report fields updated successfully');
        setCerts(prev => prev.map(c => c.id === selectedCert.id ? { 
          ...c, 
          expiration_date: newExpDate,
          date_issued: selectedCert.date_issued,
          certificate_number: selectedCert.certificate_number
        } : c));
        fetchData();
        setSelectedCert({ 
          ...selectedCert, 
          expiration_date: newExpDate,
          date_issued: selectedCert.date_issued,
          certificate_number: selectedCert.certificate_number
        });
      } else {
        notify('error', 'Failed to update certificate');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleAddNote = async () => {
    if (!newNote || !selectedCert) return;
    try {
      const res = await fetch(`/api/certificates/${selectedCert.id}/notes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ content: newNote }),
      });
      if (res.ok) {
        setNewNote('');
        fetchCertDetails(selectedCert);
      } else {
        notify('error', 'Failed to add note');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedCert) return;
    const file = e.target.files[0];

    if (file.size > MAX_FILE_SIZE) {
      notify('error', 'File is too large (max 20MB)');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', uploadFileType);
    
    const isSupported = isGeminiSupportedMimeType(file.type);
    if (isSupported) {
      setIsRecognizing(true);
    }
    setTempPreviewUrl(null);
    try {
      // 1. Upload the file
      const res = await fetch(`/api/certificates/${selectedCert.id}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (res.ok) {
        const result = await res.json();
        notify('success', 'File uploaded successfully');
        
        // Show local preview immediately
        setPreviewFile(result); // Set the preview to the newly uploaded file details
        if (sidePanelContentRef.current) {
          sidePanelContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        const blobUrl = URL.createObjectURL(file);
        setTempPreviewUrl(blobUrl);

        // Fetch refreshed details
        fetchCertDetails(selectedCert, true);
        
        // 2. Perform OCR recognition
        if (AUTO_FILL_ENABLED && isSupported && uploadFileType === 'certificate') {
          try {
            const ocrData = await recognizeCertText(file);
            
            if (ocrData.date_issued || ocrData.certificate_number || ocrData.expiration_date || ocrData.vessel_name || ocrData.cert_type) {
              const updatedCert = {
                ...selectedCert,
                certificate_number: ocrData.certificate_number || selectedCert.certificate_number,
                date_issued: ocrData.date_issued || selectedCert.date_issued,
                expiration_date: ocrData.expiration_date || selectedCert.expiration_date,
                name: ocrData.cert_type || selectedCert.name,
              };
              
              // If we recognized a vessel name, try to find matching vessel if not already matched
              if (ocrData.vessel_name && !selectedCert.vessel_id) {
                const normalizedVesselName = ocrData.vessel_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const matchedVessel = vessels.find(v => v.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedVesselName);
                if (matchedVessel) {
                  updatedCert.vessel_id = matchedVessel.id;
                  updatedCert.vessel_name = matchedVessel.name;
                }
              }

              setSelectedCert(updatedCert);
              setNewExpDate(updatedCert.expiration_date);
              notify('success', 'Information recognized and autofilled. Please verify the fields.');
            } else {
              notify('info', 'Document uploaded, but no relevant certificate fields were recognized for autofill.');
            }
          } catch (ocrErr: any) {
            console.error("OCR Auto-fill failed:", ocrErr);
            const errMsg = ocrErr?.message || "";
            if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
              notify('error', 'AI Quota Exceeded: The system hit its free-tier limit. Please wait a moment or fill manually.');
            } else {
              notify('info', 'Automated recognition failed. You can still enter details manually.');
            }
          }
        } else if (AUTO_FILL_ENABLED && uploadFileType === 'certificate') {
          notify('info', 'OCR text recognition is not supported for this file type.');
        }
      } else {
        notify('error', 'Failed to upload file');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!selectedCert) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            notify('success', 'File deleted successfully');
            fetchCertDetails(selectedCert);
          } else {
            const data = await res.json();
            notify('error', data.error || 'Failed to delete file');
          }
        } catch (err) {
          notify('error', 'Connection error occurred');
        }
      }
    });
  };


  const filteredCerts = certs.filter(c => {
    const s = (search || '').toLowerCase();
    return (c.name || '').toLowerCase().includes(s) || 
           (c.vessel_name || '').toLowerCase().includes(s) ||
           (c.team_name || '').toLowerCase().includes(s) ||
           (c.owner || '').toLowerCase().includes(s);
  });

  const sortedCerts = React.useMemo(() => {
    let sortableItems = [...filteredCerts];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'status') {
          const sA = getStatus(a.expiration_date);
          const sB = getStatus(b.expiration_date);
          const statusOrder = { 'expired': 0, 'expiring soon': 1, 'expiring': 2, 'active': 3 };
          const cmp = statusOrder[sA as keyof typeof statusOrder] - statusOrder[sB as keyof typeof statusOrder];
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        } else if (sortConfig.key === 'vessel_name') {
          aValue = a.vessel_name || a.team_name || '';
          bValue = b.vessel_name || b.team_name || '';
        } else {
          aValue = a[sortConfig.key as keyof Certificate] || '';
          bValue = b[sortConfig.key as keyof Certificate] || '';
        }

        const cmp = String(aValue).localeCompare(String(bValue));
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }
    return sortableItems;
  }, [filteredCerts, sortConfig]);

  const requestSort = (key: keyof Certificate | 'status') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Certificate | 'status') => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" /> 
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  const expiringCerts = certs.filter(c => getStatus(c.expiration_date) !== 'active');

  const fetchDepartureReports = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, departure: true }));
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch('/api/departure-reports', { headers });
      if (res.ok) {
        setDepartureReports(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch departure reports:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, departure: false }));
    }
  }, [token]);

  const fetchArrivalReports = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, arrival: true }));
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch('/api/arrival-reports', { headers });
      if (res.ok) {
        setArrivalReports(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch arrival reports:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, arrival: false }));
    }
  }, [token]);

  const fetchVessels = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch('/api/vessels', { headers });
      if (res.ok) {
        setVessels(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch vessels:', err);
    }
  }, [token]);

  const fetchNoonReports = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, noon: true }));
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch('/api/noon-reports', { headers });
      if (res.ok) {
        setNoonReports(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch noon reports:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, noon: false }));
    }
  }, [token]);

  const fetchOtherReports = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, other: true }));
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch('/api/other-reports', { headers });
      if (res.ok) {
        setOtherReports(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch other reports:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, other: false }));
    }
  }, [token]);

  useEffect(() => {
    if (view === 'departure') {
      fetchDepartureReports();
    }
    if (view === 'arrival') {
      fetchArrivalReports();
    }
    if (view === 'noon_to_noon') {
      fetchNoonReports();
    }
    if (view === 'other_report') {
      fetchOtherReports();
    }
    if (view === 'fuel_consumption') {
      fetchDepartureReports();
      fetchArrivalReports();
    }
    if (view === 'slideshow') {
      fetchDepartureReports();
      fetchArrivalReports();
      fetchNoonReports();
      fetchOtherReports();
    }
    if (view === 'routing') {
      fetchArrivalReports();
    }
  }, [view, fetchDepartureReports, fetchArrivalReports, fetchNoonReports, fetchOtherReports]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative">
      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-white border-b border-blue-100 p-4 flex items-center justify-between sticky top-0 z-40">
        <button 
          onClick={() => setView('dashboard')}
          className="flex items-center gap-2"
        >
          <LogoContainer size="xs" className="border-none shadow-none" />
          <span className="font-bold text-blue-900 tracking-tight">COMOS</span>
        </button>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-slate-500 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-blue-100 flex-col h-screen sticky top-0">
        <SidebarContent 
          view={view} 
          setView={setView} 
          setIsSidebarOpen={setIsSidebarOpen} 
          user={user} 
          isAdminTreeOpen={isAdminTreeOpen} 
          setIsAdminTreeOpen={setIsAdminTreeOpen}
          isVoyageReportOpen={isVoyageReportOpen}
          setIsVoyageReportOpen={setIsVoyageReportOpen}
          isMonitoringOpen={isMonitoringOpen}
          setIsMonitoringOpen={setIsMonitoringOpen}
          isDefectsOpen={isDefectsOpen}
          setIsDefectsOpen={setIsDefectsOpen}
          isSparePartsOpen={isSparePartsOpen}
          setIsSparePartsOpen={setIsSparePartsOpen}
          isBunkerOpen={isBunkerOpen}
          setIsBunkerOpen={setIsBunkerOpen}
          isLubeOilOpen={isLubeOilOpen}
          setIsLubeOilOpen={setIsLubeOilOpen}
          isStoreChemicalsOpen={isStoreChemicalsOpen}
          setIsStoreChemicalsOpen={setIsStoreChemicalsOpen}
          isCrewOpen={isCrewOpen}
          setIsCrewOpen={setIsCrewOpen}
          isAuditsOpen={isAuditsOpen}
          setIsAuditsOpen={setIsAuditsOpen}
          isCertificatesOpen={isCertificatesOpen}
          setIsCertificatesOpen={setIsCertificatesOpen}
          onLogout={onLogout}
          setIsChangePasswordOpen={setIsChangePasswordOpen}
        />
      </aside>


      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-blue-50">
                <div className="flex items-center gap-2">
                  <LogoContainer size="xs" />
                  <span className="font-bold text-blue-900">Navigation</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <SidebarContent 
                  view={view} 
                  setView={setView} 
                  setIsSidebarOpen={setIsSidebarOpen} 
                  user={user} 
                  isAdminTreeOpen={isAdminTreeOpen} 
                  setIsAdminTreeOpen={setIsAdminTreeOpen}
                  isVoyageReportOpen={isVoyageReportOpen}
                  setIsVoyageReportOpen={setIsVoyageReportOpen}
                  isMonitoringOpen={isMonitoringOpen}
                  setIsMonitoringOpen={setIsMonitoringOpen}
                  isDefectsOpen={isDefectsOpen}
                  setIsDefectsOpen={setIsDefectsOpen}
                  isSparePartsOpen={isSparePartsOpen}
                  setIsSparePartsOpen={setIsSparePartsOpen}
                  isBunkerOpen={isBunkerOpen}
                  setIsBunkerOpen={setIsBunkerOpen}
                  isLubeOilOpen={isLubeOilOpen}
                  setIsLubeOilOpen={setIsLubeOilOpen}
                  isStoreChemicalsOpen={isStoreChemicalsOpen}
                  setIsStoreChemicalsOpen={setIsStoreChemicalsOpen}
                  isCrewOpen={isCrewOpen}
                  setIsCrewOpen={setIsCrewOpen}
                  isAuditsOpen={isAuditsOpen}
                  setIsAuditsOpen={setIsAuditsOpen}
                  isCertificatesOpen={isCertificatesOpen}
                  setIsCertificatesOpen={setIsCertificatesOpen}
                  onLogout={onLogout}
                  setIsChangePasswordOpen={setIsChangePasswordOpen}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {Object.values(loadingStates).some(Boolean) && (
            <div className="mb-6 bg-blue-50/75 border border-blue-100/60 rounded-2xl p-4 flex items-center justify-between shadow-xs animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Database className="w-4 h-4 text-blue-600 animate-pulse shrink-0" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-blue-950 tracking-wider uppercase">Loading database content...</h4>
                  <p className="text-[10px] text-blue-600/80 font-bold mt-0.5">Fetching latest vessel statistics, logs, and report registries from the cloud database.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-blue-100/70 border border-blue-200/40 px-3 py-1.5 rounded-xl text-[10px] font-black text-blue-700 tracking-tight leading-none uppercase select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping shrink-0" />
                Sync Active
              </div>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="space-y-8">
              {/* Top Welcome & Control Header */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle_at_100%_0%,#3b82f6,transparent_60%)] opacity-30 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-blue-200 text-xs font-black uppercase tracking-widest mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live Fleet Telemetry Portal
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white mb-2">Fleet Command & Control</h1>
                    <p className="text-blue-100/70 text-sm max-w-xl">
                      Welcome back, <span className="text-white font-bold">{user.username}</span>. You have administrative PIC oversight for assigned vessels, compliance documents, technical defect management, and logistics reports.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button 
                      onClick={() => fetchData()}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all backdrop-blur-md border border-white/10"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", loadingStates.global && "animate-spin")} />
                      Refresh Data
                    </button>
                    <button 
                      onClick={() => setView('vessels')}
                      className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                    >
                      <Ship className="w-3.5 h-3.5" />
                      Manage Vessels
                    </button>
                  </div>
                </div>
              </div>

              {/* Bento Grid Metrics Indicator */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* 1. Vessels List KPI */}
                <div 
                  onClick={() => setView('vessels')}
                  className="bg-white p-5 rounded-2xl border border-blue-50 hover:border-blue-200 hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Ship className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-black text-slate-800 tracking-tight">{vessels.length}</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fleet Vessels</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Core registered vessels</p>
                  </div>
                </div>

                {/* 2. Expired / Expiring Certs KPI */}
                <div 
                  onClick={() => {
                    const el = document.getElementById('certs-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-white p-5 rounded-2xl border border-blue-50 hover:border-blue-200 hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all flex flex-col justify-between group"
                >
                  {(() => {
                    const expired = certs.filter(c => getStatus(c.expiration_date) === 'expired').length;
                    const expiring = certs.filter(c => getStatus(c.expiration_date) === 'expiring soon' || getStatus(c.expiration_date) === 'expiring').length;
                    return (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn(
                            "p-2.5 rounded-xl transition-all", 
                            expired > 0 ? "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white" : "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white"
                          )}>
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black text-slate-800 tracking-tight leading-none block">{expired + expiring}</span>
                            <span className="text-[9px] text-red-500 font-bold uppercase mt-0.5 block">{expired} Urgent</span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Certificates</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{expiring} Expiry Warning</p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 3. Defects (Trouble Reports) KPI */}
                <div 
                  onClick={() => setView('defects_5_2')}
                  className="bg-white p-5 rounded-2xl border border-blue-50 hover:border-blue-200 hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all flex flex-col justify-between group"
                >
                  {(() => {
                    const activeDefects = troubleReports.filter(r => r.status !== 'Resolved').length;
                    return (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
                            <Wrench className="w-5 h-5" />
                          </div>
                          <span className="text-2xl font-black text-slate-800 tracking-tight">{activeDefects}</span>
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Defects</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium font-semibold">Unresolved reports</p>
                        </div>
                      </>
                    );
                  })()}
                </div>


                {/* 5. Pending Requisitions KPI */}
                <div 
                  onClick={() => setView('spare_requisition_ship')}
                  className="bg-white p-5 rounded-2xl border border-blue-50 hover:border-blue-200 hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all flex flex-col justify-between group"
                >
                  {(() => {
                    const reqCount = spareRequisitions.filter(r => r.status === 'Pending Review' || r.status === 'Draft').length;
                    return (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            <Package className="w-5 h-5" />
                          </div>
                          <span className="text-2xl font-black text-slate-800 tracking-tight">{reqCount}</span>
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Spare Requisitions</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">In review or draft</p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 6. Audits & Inspections KPI */}
                <div 
                  onClick={() => setView('audit_list')}
                  className="bg-white p-5 rounded-2xl border border-blue-50 hover:border-blue-200 hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all flex flex-col justify-between group"
                >
                  {(() => {
                    const pendingAudits = (auditRecords || []).filter(a => a.status === 'Scheduled' || a.status === 'In Progress' || a.status === 'Overdue').length;
                    return (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <span className="text-2xl font-black text-slate-800 tracking-tight">{pendingAudits}</span>
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Audits</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Scheduled & Overdue</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Master Dashboard Split Layout (2/3 vs 1/3) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* WIDER LEFT PANEL: Operations & Timeline trackers */}
                <div className="xl:col-span-2 space-y-6">
                  {/* Fleet Tracking Panel */}
                  <div className="bg-white rounded-2xl border border-blue-100/70 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-blue-50/50 flex items-center justify-between">
                      <div>
                        <h2 className="font-bold text-slate-900 flex items-center gap-2">
                          <Anchor className="w-4 h-4 text-blue-500" />
                          Fleet Dispatch & Routing Status
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Real-time routing logs from vessels</p>
                      </div>
                      <button 
                        onClick={() => setView('routing')}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                      >
                        Manage Routing <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-sans">
                        <thead>
                          <tr className="bg-blue-50/35 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                            <th className="px-5 py-3">Vessel / Team</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Target Destination / ETA</th>
                            <th className="px-5 py-3">Cargo Spec</th>
                            <th className="px-5 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50/40">
                          {vessels.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-xs font-medium">
                                No vessel registration found.
                              </td>
                            </tr>
                          ) : (
                            vessels.slice(0, 5).map(v => {
                              const routeStatusColors: Record<string, string> = {
                                'Underway': 'bg-emerald-50 text-emerald-700 border-emerald-100',
                                'At Port': 'bg-blue-50 text-blue-700 border-blue-100',
                                'Anchored': 'bg-amber-50 text-amber-700 border-amber-100',
                                'Drifting': 'bg-indigo-50 text-indigo-700 border-indigo-100',
                                'Standby': 'bg-purple-50 text-purple-700 border-purple-100',
                              };
                              return (
                                <tr key={v.id} className="hover:bg-blue-50/20 transition-colors">
                                  <td className="px-5 py-4">
                                    <div className="font-bold text-slate-800 text-sm leading-tight">{v.name}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{v.team_name} ({v.owner || 'Nissen'})</div>
                                  </td>
                                  <td className="px-5 py-4">
                                    <span className={cn(
                                      "inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold",
                                      routeStatusColors[v.route_status || ''] || 'bg-slate-50 text-slate-600 border-slate-100'
                                    )}>
                                      {v.route_status || 'Standby'}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="font-semibold text-slate-700 text-xs flex items-center gap-1">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                      {v.next_port || 'Not Scheduled'}
                                    </div>
                                    <div className="text-[10px] font-medium text-slate-500 font-mono mt-0.5">
                                      {v.eta_atb ? `ETA: ${v.eta_atb}` : 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 text-xs font-medium text-slate-600">
                                    {v.cargo || 'Ballast'}
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <button 
                                      onClick={() => {
                                        setSelectedVessel(v);
                                        setRouteForm({
                                          next_port: v.next_port || '',
                                          route_status: v.route_status || '',
                                          eta_atb: v.eta_atb || '',
                                          etd_atd: v.etd_atd || '',
                                          cargo: v.cargo || ''
                                        });
                                        setIsEditingRoute(true);
                                      }}
                                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                                    >
                                      Edit Route
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Operational Voyage Timeline Log */}
                  <div className="bg-white rounded-2xl border border-blue-100/70 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-blue-50/50 flex items-center justify-between">
                      <div>
                        <h2 className="font-bold text-slate-900 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-500" />
                          Vessel Voyage & Operations Timeline
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Chronological timeline of arrival, departure, and noon-to-noon logs</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setView('noon_to_noon')}
                          className="px-2 py-1 hover:bg-slate-50 rounded text-[10px] font-bold text-slate-500"
                        >
                          Noon
                        </button>
                        <span className="text-slate-200">|</span>
                        <button 
                          onClick={() => setView('arrival')}
                          className="px-2 py-1 hover:bg-slate-50 rounded text-[10px] font-bold text-slate-500"
                        >
                          Arrivals
                        </button>
                        <span className="text-slate-200">|</span>
                        <button 
                          onClick={() => setView('departure')}
                          className="px-2 py-1 hover:bg-slate-50 rounded text-[10px] font-bold text-slate-500"
                        >
                          Departures
                        </button>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="relative border-l-2 border-blue-50 pl-4 space-y-6">
                        {(() => {
                          const compiledReports = [
                            ...departureReports.map(r => ({ ...r, type: 'Departure', iconColor: 'bg-indigo-50 text-indigo-600', text: `Departed ${r.departure_port || 'Unknown'} for ${r.next_port || 'Unknown'}`, date: r.utc_date_time || r.atd_utc || r.created_at || '' })),
                            ...arrivalReports.map(r => ({ ...r, type: 'Arrival', iconColor: 'bg-emerald-50 text-emerald-600', text: `Arrived at ${r.arrival_port || 'Unknown'} (${r.operation_type || 'Cargo Ops'})`, date: r.utc_date_time || r.atb_utc || r.created_at || '' })),
                            ...noonReports.map(r => ({ ...r, type: 'Noon-to-Noon', iconColor: 'bg-amber-50 text-amber-600', text: `Noon-to-Noon report submitted (Speed: ${r.speed_over_ground || 'N/A'} kts)`, date: r.utc_date_time || r.created_at || '' })),
                            ...otherReports.map(r => ({ ...r, type: 'Other Report', iconColor: 'bg-slate-50 text-slate-600', text: `Other report submitted: ${r.subject || 'Technical File'}`, date: r.utc_date_time || r.created_at || '' }))
                          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

                          if (compiledReports.length === 0) {
                            return <p className="text-slate-400 text-xs italic text-center py-4">No voyage reports submitted recently.</p>;
                          }

                          return compiledReports.map((report, i) => (
                            <div key={i} className="relative group">
                              <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white ring-4 ring-blue-50 group-hover:scale-125 transition-transform animate-none" />
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pl-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs shrink-0">{report.vessel_name}</span>
                                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider", report.iconColor)}>
                                      {report.type}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 text-xs mt-1 font-medium">{report.text}</p>
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400 font-mono text-left md:text-right shrink-0">
                                  {report.date ? format(new Date(report.date), 'yyyy-MM-dd HH:mm') : 'N/A'}
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SIDEBAR RIGHT PANEL: Compliance Alerts, Defects & Requisitions */}
                <div className="xl:col-span-1 space-y-6">
                  {/* Urgent Compliance Tracker */}
                  <div className="bg-white rounded-2xl border border-blue-100/70 shadow-sm p-5 space-y-4">
                    <div>
                      <h2 className="font-bold text-slate-900 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                        Urgent Certificate Renewals
                      </h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Certificates expired or renewing in &lt; 90 Days</p>
                    </div>

                    <div className="space-y-3">
                      {certs.filter(c => getStatus(c.expiration_date) !== 'active').length === 0 ? (
                        <div className="bg-blue-50/30 p-4 rounded-xl text-center border border-blue-100/30">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                          <p className="text-xs text-slate-500 font-semibold">All certificates are healthy and compliant</p>
                        </div>
                      ) : (
                        certs.filter(c => getStatus(c.expiration_date) !== 'active').slice(0, 4).map(c => {
                          const status = getStatus(c.expiration_date);
                          return (
                            <div 
                              key={c.id} 
                              onClick={() => fetchCertDetails(c)}
                              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100/60 cursor-pointer transition-all flex items-center justify-between gap-2 group"
                            >
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 text-xs truncate group-hover:text-blue-600 transition-colors">{c.name}</h3>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 leading-none">{c.vessel_name || 'Vessel'}</div>
                                <div className="text-[9px] font-medium text-slate-500 font-mono mt-1">Exp: {c.expiration_date}</div>
                              </div>
                              <span className={cn(
                                "shrink-0 inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                status === 'expired' ? "bg-red-50 text-red-700 border-red-100" :
                                "bg-amber-50 text-amber-700 border-amber-100"
                              )}>
                                {status}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Active Defect Deficiency Tracker */}
                  <div className="bg-white rounded-2xl border border-blue-100/70 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-bold text-slate-900 flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-orange-500" />
                          Unresolved Technical Defects
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Active technical vessel damage logs</p>
                      </div>
                      <button 
                        onClick={() => setView('defects_5_2')}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        All
                      </button>
                    </div>

                    <div className="space-y-3">
                      {troubleReports.filter(r => r.status !== 'Resolved').length === 0 ? (
                        <p className="text-slate-400 text-xs italic text-center py-2">No active defects recorded.</p>
                      ) : (
                        troubleReports.filter(r => r.status !== 'Resolved').slice(0, 3).map(r => (
                          <div 
                            key={r.id} 
                            onClick={() => setView('defects_5_2')}
                            className="p-3 bg-blue-50/20 hover:bg-blue-50/50 rounded-xl border border-blue-100/30 cursor-pointer transition-all space-y-1.5"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-bold text-slate-800 text-xs line-clamp-1">{r.deficiency}</h3>
                              <span className={cn(
                                "shrink-0 inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide",
                                r.status === 'Submitted' ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-orange-50 text-orange-700 border border-orange-100"
                              )}>
                                {r.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-500 font-semibold uppercase">
                              <span>Vessel: {r.vesselName}</span>
                              <span className="font-mono text-[8px] text-slate-400 font-normal">PMS: {r.pmsCode || 'N/A'}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* High Priority Spare Parts Requisitions */}
                  <div className="bg-white rounded-2xl border border-blue-100/70 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-bold text-slate-900 flex items-center gap-2">
                          <Package className="w-4 h-4 text-purple-500" />
                          Urgent Parts Logistics
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">High/Emergency priority requisitions</p>
                      </div>
                      <button 
                        onClick={() => setView('spare_requisition_ship')}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        All
                      </button>
                    </div>

                    <div className="space-y-3">
                      {spareRequisitions.filter(r => r.priority === 'High' || r.priority === 'Emergency').length === 0 ? (
                        <p className="text-slate-400 text-xs italic text-center py-2">No urgent spare parts requests.</p>
                      ) : (
                        spareRequisitions.filter(r => r.priority === 'High' || r.priority === 'Emergency').slice(0, 3).map(r => (
                          <div 
                            key={r.id} 
                            onClick={() => setView('spare_requisition_ship')}
                            className="p-3 bg-purple-50/15 hover:bg-purple-50/30 rounded-xl border border-purple-100/20 cursor-pointer transition-all space-y-1"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-xs text-slate-800">{r.requisitionRef}</span>
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 font-black rounded text-[8px] uppercase tracking-wide">
                                {r.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-1">{r.remarks || 'No remarks provided'}</p>
                            <div className="text-[9px] text-slate-400 font-semibold uppercase flex justify-between">
                              <span>Port: {r.targetPort || 'TBD'}</span>
                              <span>ETA: {r.eta || 'N/A'}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible / Database panel containing original Certificates List */}
              <div id="certs-section" className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-blue-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      Certificates & Service Reports Registry
                    </h2>
                    <p className="text-[10px] font-black uppercase text-slate-400 mt-0.5">Fully searchable global compliance registry</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Search certificates..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-blue-50/50 p-1 rounded-xl border border-blue-100/50">
                      <select 
                        value={sortConfig?.key || 'expiration_date'}
                        onChange={(e) => requestSort(e.target.value as any)}
                        className="bg-transparent border-none text-[10px] font-bold uppercase tracking-wider text-slate-600 focus:ring-0 cursor-pointer px-2"
                      >
                        <option value="name">Name</option>
                        <option value="vessel_name">Vessel</option>
                        <option value="expiration_date">Exp. Date</option>
                        <option value="status">Status</option>
                      </select>
                      <button 
                        onClick={() => requestSort(sortConfig?.key || 'expiration_date')}
                        className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                      >
                        {sortConfig?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left font-sans">
                    <thead>
                      <tr className="bg-blue-50/30 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        <th className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('vessel_name')}>
                          <div className="flex items-center">Vessel / Team {getSortIcon('vessel_name')}</div>
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('name')}>
                          <div className="flex items-center">Certificate/Service Report Name {getSortIcon('name')}</div>
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('expiration_date')}>
                          <div className="flex items-center">Expiration Date {getSortIcon('expiration_date')}</div>
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('status')}>
                          <div className="flex items-center">Status {getSortIcon('status')}</div>
                        </th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {sortedCerts.map(cert => (
                        <tr 
                          key={cert.id} 
                          className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                          onClick={() => fetchCertDetails(cert)}
                        >
                          <td className="px-6 py-4 font-medium text-sm">
                            {cert.vessel_id ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const vessel = vessels.find(v => v.id === cert.vessel_id);
                                  if (vessel) setSelectedVessel(vessel);
                                }}
                                className="text-left hover:text-blue-600 hover:underline transition-colors animate-none"
                              >
                                {cert.vessel_name}
                              </button>
                            ) : (
                              <span className="text-blue-600 italic">Other ({cert.team_name})</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {cert.name}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-600">
                            {cert.expiration_date}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              getStatus(cert.expiration_date) === 'expired' ? "bg-red-100 text-red-700" :
                              getStatus(cert.expiration_date) === 'expiring soon' ? "bg-orange-100 text-orange-700" :
                              getStatus(cert.expiration_date) === 'expiring' ? "bg-amber-100 text-amber-700" :
                              "bg-blue-100 text-blue-700"
                            )}>
                              {getStatus(cert.expiration_date)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                                <>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCert(cert);
                                    }}
                                    className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors animate-none"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCert(cert.id);
                                    }}
                                    className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors animate-none"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchCertDetails(cert);
                                }}
                                className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors animate-none"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === 'vessels' && (
            <div className="space-y-8">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Vessels</h1>
                  <p className="text-slate-500">Manage your assigned fleet and their certificates.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Search vessels..." 
                      value={vesselSearch}
                      onChange={(e) => setVesselSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-blue-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                    />
                  </div>
                  
                  {/* Team Filter */}
                  <select 
                    value={vesselFilterTeam}
                    onChange={(e) => setVesselFilterTeam(e.target.value)}
                    className="px-3 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                  >
                    <option value="">All Teams</option>
                    {teams.map(t => (
                      <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                  </select>

                  {/* Owner Filter */}
                  <select 
                    value={vesselFilterOwner}
                    onChange={(e) => setVesselFilterOwner(e.target.value)}
                    className="px-3 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                  >
                    <option value="">All Owners</option>
                    <option value="Nissen">Nissen</option>
                    <option value="Goodwill">Goodwill</option>
                  </select>

                  <div className="h-4 w-[1px] bg-blue-100 hidden sm:block" />

                  {/* Sort By Field */}
                  <select 
                    value={vesselSortField}
                    onChange={(e) => setVesselSortField(e.target.value as any)}
                    className="px-3 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                  >
                    <option value="name">Sort: Name</option>
                    <option value="team">Sort: Team</option>
                    <option value="owner">Sort: Owner</option>
                  </select>
                  
                  <button 
                    onClick={() => setVesselSortOrder(vesselSortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-white border border-blue-100 hover:bg-blue-50 rounded-xl text-blue-600 transition-colors shadow-sm"
                    title={vesselSortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
                  >
                    {vesselSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </button>

                  {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                    <button 
                      onClick={() => setView('admin')}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" /> Add Vessel
                    </button>
                  )}
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...vessels]
                  .filter(v => {
                    const matchesSearch = v.name.toLowerCase().includes(vesselSearch.toLowerCase());
                    const matchesTeam = vesselFilterTeam === '' || String(v.team_id) === vesselFilterTeam;
                    const matchesOwner = vesselFilterOwner === '' || v.owner === vesselFilterOwner;
                    return matchesSearch && matchesTeam && matchesOwner;
                  })
                  .sort((a, b) => {
                    let valA = '';
                    let valB = '';
                    if (vesselSortField === 'name') {
                      valA = a.name || '';
                      valB = b.name || '';
                    } else if (vesselSortField === 'team') {
                      valA = a.team_name || '';
                      valB = b.team_name || '';
                    } else if (vesselSortField === 'owner') {
                      valA = a.owner || '';
                      valB = b.owner || '';
                    }
                    const cmp = valA.localeCompare(valB);
                    return vesselSortOrder === 'asc' ? cmp : -cmp;
                  })
                  .map(vessel => (
                  <div 
                    key={vessel.id} 
                    className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md cursor-pointer hover:border-blue-200 transition-all"
                    onClick={() => setSelectedVessel(vessel)}
                  >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3 min-w-0">
                          {vessel.has_photo ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-blue-100 shrink-0">
                              <img 
                                src={`/api/vessels/${vessel.id}/photo?token=${token}&t=${Date.now()}`} 
                                alt={vessel.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <LogoContainer size="md" />
                          )}
                          <h3 className="text-lg font-bold text-slate-900 truncate">{vessel.name}</h3>
                        </div>
                      <div className="text-right shrink-0">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{vessel.team_name}</span>
                        <span className={cn(
                          "inline-block mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                          vessel.owner === 'Nissen' ? "bg-purple-50 text-purple-700" : "bg-orange-50 text-orange-700"
                        )}>
                          {vessel.owner || 'Nissen'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Flag</span>
                        <span className="font-bold text-slate-900">{vessel.flag || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Type</span>
                        <span className="font-bold text-slate-900">{vessel.type || 'Bulk Carrier'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Date Built</span>
                        <span className="font-bold text-slate-900">{vessel.date_built || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Min Fuel Consumption</span>
                        <span className="font-bold text-slate-900">{vessel.min_fuel_consumption || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Max Fuel Consumption</span>
                        <span className="font-bold text-slate-900">{vessel.max_fuel_consumption || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Total Certificates/Service Reports</span>
                        <span className="font-bold text-slate-900">{certs.filter(c => c.vessel_id === vessel.id).length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Expiring/Expired</span>
                        <span className="text-red-500 font-bold">
                          {certs.filter(c => c.vessel_id === vessel.id && getStatus(c.expiration_date) !== 'active').length}
                        </span>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVessel(vessel);
                        }}
                        className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                      >
                        Details
                      </button>
                      {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingVessel(vessel);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVessel(vessel.id);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view.startsWith('admin') && view !== 'admin_recycle_bin' && (
            <AdminPanel 
              token={token} 
              teams={teams} 
              vessels={vessels} 
              certs={certs} 
              setCerts={setCerts}
              onRefresh={fetchData} 
              notify={notify}
              previewFile={previewFile}
              setPreviewFile={setPreviewFile}
              tempPreviewUrl={tempPreviewUrl}
              setTempPreviewUrl={setTempPreviewUrl}
              isRecognizing={isRecognizing}
              setIsRecognizing={setIsRecognizing}
              subView={view}
              editingVessel={editingVessel}
              setEditingVessel={setEditingVessel}
              editingVesselPhoto={editingVesselPhoto}
              setEditingVesselPhoto={setEditingVesselPhoto}
              handleUpdateVessel={handleUpdateVessel}
              handleDeleteVessel={handleDeleteVessel}
              editingCert={editingCert}
              setEditingCert={setEditingCert}
              newCertFile={newCertFile}
              setNewCertFile={setNewCertFile}
              handleUpdateCert={handleUpdateCert}
              handleDeleteCert={handleDeleteCert}
              confirmDialog={confirmDialog}
              setConfirmDialog={setConfirmDialog}
              uploadFileType={uploadFileType}
              setUploadFileType={setUploadFileType}
              fetchCertDetails={fetchCertDetails}
              setSelectedVessel={setSelectedVessel}
              flags={flags}
              setFlags={setFlags}
            />
          )}

          {view === 'admin_recycle_bin' && (
            <RecycleBinView
              token={token}
              notify={notify}
            />
          )}

          {view === 'departure' && (
            <DepartureView
              user={user}
              token={token}
              vessels={vessels}
              reports={departureReports}
              onRefresh={fetchDepartureReports}
              notify={notify}
              isLoading={loadingStates.departure}
            />
          )}

          {view === 'arrival' && (
            <ArrivalView
              user={user}
              token={token}
              vessels={vessels}
              reports={arrivalReports}
              departureReports={departureReports}
              onRefresh={fetchArrivalReports}
              notify={notify}
              isLoading={loadingStates.arrival}
            />
          )}

          {view === 'other_report' && (
            <OtherReportView
              user={user}
              token={token}
              vessels={vessels}
              reports={otherReports}
              onRefresh={fetchOtherReports}
              notify={notify}
              isLoading={loadingStates.other}
            />
          )}

          {view === 'noon_to_noon' && (
            <NoonToNoonView
              user={user}
              token={token}
              vessels={vessels}
              reports={noonReports}
              onRefresh={async () => {
                await fetchNoonReports();
                await fetchVessels();
              }}
              notify={notify}
              isLoading={loadingStates.noon}
            />
          )}

          {view === 'fuel_consumption' && (
            <FuelConsumptionView
              vessels={vessels}
              departureReports={departureReports}
              arrivalReports={arrivalReports}
            />
          )}

          {view === 'routing' && (
            user.role === 'vessel' && vessels.length > 0 ? (
              <VesselRoutingUserView 
                vessel={vessels[0]}
                form={routingForm[vessels[0].id] || {}}
                updating={isSavingAll}
                onUpdateRow={handleUpdateRoutingRow}
                onSave={handleSaveAllRouting}
                latestOperationType={getLatestArrivalOperationType(vessels[0].id)}
              />
            ) : (
              <div className="space-y-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Vessel Routing</h1>
                    <p className="text-slate-500">Update destination, status, and ETA for all assigned vessels in one place.</p>
                  </div>
                  <button 
                    onClick={handleSaveAllRouting}
                    disabled={isSavingAll}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {isSavingAll ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save All Changes
                  </button>
                </header>

                <div className="space-y-6">
                  {groupedVessels.sortedOwners.map(owner => (
                    <div key={owner} className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 bg-slate-50 border-b border-blue-100 flex items-center justify-between">
                        <h2 className={cn(
                          "text-sm font-black uppercase tracking-widest",
                          owner === 'Nissen' ? "text-purple-600" : "text-orange-600"
                        )}>
                          {owner}
                        </h2>
                        <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-blue-50">
                          {groupedVessels.groups[owner].length} Vessels
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-blue-50/10 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                              <th className="px-6 py-3 min-w-[200px]">Vessel</th>
                              <th className="px-6 py-3 min-w-[200px]">Destination / Next Port</th>
                              <th className="px-6 py-3 w-52">Status</th>
                              <th className="px-6 py-3 w-40">Operation Type</th>
                              <th className="px-6 py-3 w-44">ETA / ATB (UTC)</th>
                              <th className="px-6 py-3 w-44">ETD/ATD at Arrival (UTC)</th>
                              <th className="px-6 py-3 min-w-[350px]">Cargo</th>
                              <th className="px-6 py-3 min-w-[300px]">Remark from Vessel</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {groupedVessels.groups[owner].map(v => {
                              const form = routingForm[v.id] || {};
                              return (
                                <tr key={v.id} className="hover:bg-blue-50/20 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      {v.has_photo ? (
                                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-blue-100 shrink-0">
                                          <img 
                                            src={`/api/vessels/${v.id}/photo?token=${token}&t=${Date.now()}`} 
                                            alt={v.name}
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                        </div>
                                      ) : (
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                          <Ship className="w-4 h-4 text-blue-600" />
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-sm font-bold text-slate-900 leading-tight">{v.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{v.team_name}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="text"
                                      value={form.next_port || ''}
                                      onChange={e => handleUpdateRoutingRow(v.id, 'next_port', e.target.value)}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      placeholder="Next Port"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <select 
                                      value={form.route_status || ''}
                                      onChange={e => handleUpdateRoutingRow(v.id, 'route_status', e.target.value)}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
                                    >
                                      <option value="">Select Status</option>
                                      <option value="Laden">Laden</option>
                                      <option value="Ballast">Ballast</option>
                                    </select>
                                  </td>
                                  <td className="px-6 py-4">
                                    <select 
                                      value={form.operation_type || ''}
                                      onChange={e => handleUpdateRoutingRow(v.id, 'operation_type', e.target.value)}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
                                    >
                                      <option value="">Select Operation</option>
                                      <option value="LOADING">LOADING</option>
                                      <option value="DISCHARGING">DISCHARGING</option>
                                      <option value="BUNKERING">BUNKERING</option>
                                      <option value="ship-to-ship cargo operation">SHIP-TO-SHIP CARGO OPERATION</option>
                                      <option value="Others">Others</option>
                                    </select>
                                  </td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="datetime-local"
                                      value={form.eta_atb ? form.eta_atb.replace(' ', 'T').substring(0, 16) : ''}
                                      onChange={e => handleUpdateRoutingRow(v.id, 'eta_atb', e.target.value.replace('T', ' '))}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="datetime-local"
                                      value={form.etd_atd ? form.etd_atd.replace(' ', 'T').substring(0, 16) : ''}
                                      onChange={e => handleUpdateRoutingRow(v.id, 'etd_atd', e.target.value.replace('T', ' '))}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="text"
                                      value={form.cargo || ''}
                                      onChange={e => handleUpdateRoutingRow(v.id, 'cargo', e.target.value)}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      placeholder="Cargo"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="text"
                                      value={form.remark_from_vessel || ''}
                                      onChange={e => handleUpdateRoutingRow(v.id, 'remark_from_vessel', e.target.value)}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      placeholder="Remark from Vessel"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {view === 'slideshow' && user.role !== 'vessel' && (
            <div className="h-[calc(100vh-64px)]">
              <SlideshowView 
                vessels={vessels} 
                certs={certs} 
                token={token} 
                arrivalReports={arrivalReports}
                departureReports={departureReports}
                noonReports={noonReports}
                otherReports={otherReports}
              />
            </div>
          )}

          {view === 'about' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <AboutView />
            </div>
          )}

          {view === 'sms' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <SMSView vessels={vessels} currentUser={user} token={token} mode="management" flags={flags} />
            </div>
          )}

          {view === 'sms_reporting' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <SMSView vessels={vessels} currentUser={user} token={token} mode="reporting" flags={flags} />
            </div>
          )}

          {view === 'crew_list' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <CrewListView vessels={vessels} token={token} currentUser={user} />
            </div>
          )}

          {view === 'crew_compliance' && user.role !== 'vessel' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <CrewEmploymentStatusView vessels={vessels} token={token} currentUser={user} />
            </div>
          )}

          {view === 'audit_list' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <AuditRegistryView vessels={vessels} token={token} currentUser={user} />
            </div>
          )}

          {view === 'audit_internal' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <AuditRegistryView vessels={vessels} prefilteredType="Internal Audit" token={token} currentUser={user} />
            </div>
          )}

          {view === 'audit_external' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <AuditRegistryView vessels={vessels} prefilteredType="External Audit" token={token} currentUser={user} />
            </div>
          )}

          {view === 'audit_vir' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <AuditRegistryView vessels={vessels} prefilteredType="VIR" token={token} currentUser={user} />
            </div>
          )}

          {view === 'audit_navigational' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <AuditRegistryView vessels={vessels} prefilteredType="Navigational Audit" token={token} currentUser={user} />
            </div>
          )}

          {view === 'defects_5_2' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <TroubleReportView vessels={vessels} currentUser={user} token={token} />
            </div>
          )}

          {view === 'spare_requisition_ship' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <SparePartsRequisitionView vessels={vessels} currentUser={user} token={token} />
            </div>
          )}

          {view === 'store_chemical_requisition' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <SparePartsRequisitionView 
                vessels={vessels} 
                currentUser={user} 
                title="Store and Chemical Requisition" 
                storageKey="comos_store_chemical_requisitions" 
                token={token}
              />
            </div>
          )}

          {view === 'bunker_bdn' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <BunkerBDNView 
                vessels={vessels} 
                currentUser={user} 
                token={token}
              />
            </div>
          )}

          {view === 'lube_oil_ldr' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <LubeOilLDRView 
                vessels={vessels} 
                currentUser={user} 
                token={token}
              />
            </div>
          )}

          {view === 'bunker_fuel_analysis' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <BunkerFuelAnalysisView 
                vessels={vessels} 
                currentUser={user} 
                token={token}
              />
            </div>
          )}

          {view === 'lube_oil_analysis' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <LubeOilAnalysisView 
                vessels={vessels} 
                currentUser={user} 
                token={token}
              />
            </div>
          )}

          {['defects_1_6', 'spare_quotation_pic', 'spare_logistic_pic', 'spare_delivery_note_ship', 'lube_oil_requisition'].includes(view) && (
            <div className="bg-white p-12 rounded-3xl border border-blue-100 shadow-sm flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
               <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                 {view.startsWith('defects') ? <AlertTriangle className="w-10 h-10 text-blue-600" /> : 
                  view.startsWith('spare') ? <Package className="w-10 h-10 text-blue-600" /> : 
                  view.startsWith('lube_oil') ? <Waves className="w-10 h-10 text-blue-600" /> :
                  view.includes('requisition') && view.includes('store') ? <Package className="w-10 h-10 text-blue-600" /> :
                  view.includes('chemical') ? <FlaskConical className="w-10 h-10 text-blue-600" /> :
                  <Droplets className="w-10 h-10 text-blue-600" />}
               </div>
               <h2 className="text-2xl font-bold text-slate-900 mb-2">
                 {view.toUpperCase().replace(/_/g, ' ')}
               </h2>
               <p className="text-slate-500 max-w-md">
                 This module is currently under development. The detailed features and report forms for <b>{view.replace(/_/g, ' ')}</b> will be implemented soon.
               </p>
               <button 
                 onClick={() => setView('dashboard')}
                 className="mt-8 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
               >
                 Back to Dashboard
               </button>
            </div>
          )}
        </div>
      </main>

      {/* Portals */}
      {createPortal(
        <div className="fixed inset-0 z-[1000] pointer-events-none">
          <div className="absolute bottom-0 right-0 p-6 flex flex-col items-end gap-3">
            <AnimatePresence>
              {notifications.map(n => (
                <NotificationToast key={n.id} notification={n} onClose={removeNotification} />
              ))}
            </AnimatePresence>
          </div>
        </div>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {selectedVessel && (
            <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setSelectedVessel(null);
                    setIsEditingRoute(false);
                  }}
                  className="fixed inset-0 bg-blue-900/20 backdrop-blur-sm z-[150]"
                />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="fixed right-0 top-0 bottom-0 w-[500px] bg-white z-[160] shadow-2xl flex flex-col"
              >
              <div className="p-6 border-b border-blue-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LogoContainer size="sm" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedVessel.name}</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">{selectedVessel.team_name}</span>
                      <span className="text-slate-300">•</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        selectedVessel.owner === 'Nissen' ? "text-purple-600" : "text-orange-600"
                      )}>
                        {selectedVessel.owner || 'Nissen'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => {
                  setSelectedVessel(null);
                  setVesselCertSearch('');
                  setIsEditingRoute(false);
                }} className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 space-y-8">
                {/* Route Details */}
                <section className="bg-blue-50/30 p-5 rounded-2xl border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Route Details</h3>
                    <button 
                      onClick={() => {
                        if (isEditingRoute) {
                          handleUpdateRoute();
                        } else {
                          const latestArrival = [...arrivalReports]
                            .filter(r => r.vessel_id === selectedVessel.id)
                            .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime())[0];
                            
                          setRouteForm({
                            next_port: selectedVessel.next_port || latestArrival?.arrival_port || '',
                            route_status: selectedVessel.route_status || '',
                            eta_atb: selectedVessel.eta_atb || '',
                            etd_atd: selectedVessel.etd_atd || '',
                            cargo: selectedVessel.cargo || ''
                          });
                          setIsEditingRoute(true);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-100 rounded-lg text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                    >
                      {isEditingRoute ? <><Save className="w-3 h-3" /> Save Changes</> : <><Edit2 className="w-3 h-3" /> Edit Route</>}
                    </button>
                  </div>

                  {isEditingRoute ? (
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Destination / Next Port</label>
                        <input 
                          type="text"
                          value={routeForm.next_port}
                          onChange={e => setRouteForm({...routeForm, next_port: e.target.value})}
                          placeholder="e.g. Singapore"
                          className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Status</label>
                          <select 
                            value={routeForm.route_status}
                            onChange={e => setRouteForm({...routeForm, route_status: e.target.value})}
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                          >
                            <option value="">Select Status</option>
                            <option value="At sea">At sea</option>
                            <option value="In port">In port</option>
                            <option value="Anchor">Anchor</option>
                            <option value="Drifting">Drifting</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Cargo</label>
                          <input 
                            type="text"
                            value={routeForm.cargo}
                            onChange={e => setRouteForm({...routeForm, cargo: e.target.value})}
                            placeholder="e.g. Crude Oil"
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">ETA / ATB (UTC)</label>
                          <input 
                            type="datetime-local"
                            value={routeForm.eta_atb ? routeForm.eta_atb.replace(' ', 'T').substring(0, 16) : ''}
                            onChange={e => setRouteForm({...routeForm, eta_atb: e.target.value.replace('T', ' ')})}
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">ETD/ATD at Arrival (UTC)</label>
                          <input 
                            type="datetime-local"
                            value={routeForm.etd_atd ? routeForm.etd_atd.replace(' ', 'T').substring(0, 16) : ''}
                            onChange={e => setRouteForm({...routeForm, etd_atd: e.target.value.replace('T', ' ')})}
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsEditingRoute(false)}
                        className="mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 text-center underline"
                      >
                        Cancel Editing
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg shrink-0"><MapPin className="w-3.5 h-3.5 text-blue-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Next Port</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.next_port || 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg shrink-0"><Activity className="w-3.5 h-3.5 text-green-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.route_status || 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg shrink-0"><Clock className="w-3.5 h-3.5 text-amber-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ETA / ATB (UTC)</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.eta_atb ? selectedVessel.eta_atb.replace('T', ' ') : 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg shrink-0"><Anchor className="w-3.5 h-3.5 text-purple-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ETD/ATD at Arrival (UTC)</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.etd_atd ? selectedVessel.etd_atd.replace('T', ' ') : 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-pink-100 rounded-lg shrink-0"><Flag className="w-3.5 h-3.5 text-pink-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Flag</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.flag || 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-teal-100 rounded-lg shrink-0"><Calendar className="w-3.5 h-3.5 text-teal-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Date Built</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.date_built || 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg shrink-0"><Fuel className="w-3.5 h-3.5 text-blue-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Min Fuel Cons.</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.min_fuel_consumption || 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg shrink-0"><Fuel className="w-3.5 h-3.5 text-blue-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Max Fuel Cons.</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.max_fuel_consumption || 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 col-span-2">
                        <div className="p-2 bg-orange-100 rounded-lg shrink-0"><Package className="w-3.5 h-3.5 text-orange-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cargo Details</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.cargo || 'No cargo information'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Certificate Summary */}
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">Certificate/Service Report Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-center">
                      <span className="block text-lg font-bold text-slate-900">
                        {certs.filter(c => c.vessel_id === selectedVessel.id).length}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                    </div>
                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 text-center">
                      <span className="block text-lg font-bold text-amber-600">
                        {certs.filter(c => c.vessel_id === selectedVessel.id && getStatus(c.expiration_date) === 'expiring').length}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400">Expiring</span>
                    </div>
                    <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100/50 text-center">
                      <span className="block text-lg font-bold text-red-600">
                        {certs.filter(c => c.vessel_id === selectedVessel.id && getStatus(c.expiration_date) === 'expired').length}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-red-400">Expired</span>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vessel Certificates/Service Reports</h3>
                    <div className="relative">
                      <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search certificates..."
                        value={vesselCertSearch}
                        onChange={(e) => setVesselCertSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-blue-50/50 border border-blue-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
                      />
                    </div>
                  </div>
                <div className="space-y-3">
                  {(() => {
                    const filteredCerts = certs
                      .filter(c => c.vessel_id === selectedVessel.id)
                      .filter(c => c.name.toLowerCase().includes(vesselCertSearch.toLowerCase()))
                      .sort((a, b) => {
                        const statusOrder = { 'expired': 0, 'expiring soon': 1, 'expiring': 2, 'active': 3 };
                        const statusA = getStatus(a.expiration_date);
                        const statusB = getStatus(b.expiration_date);
                        return statusOrder[statusA] - statusOrder[statusB];
                      });

                    if (filteredCerts.length === 0) {
                      return (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">No certificates found matching your search.</p>
                        </div>
                      );
                    }

                    return filteredCerts.map(cert => (
                      <div 
                        key={cert.id} 
                        onClick={() => {
                          setSelectedVessel(null);
                          setVesselCertSearch('');
                          fetchCertDetails(cert);
                        }}
                        className="p-4 bg-blue-50/30 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-white hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{cert.name}</span>
                            {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCert(cert);
                                  }}
                                  className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                  title="Edit Certificate/Service Report"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCert(cert.id);
                                  }}
                                  className="p-1 hover:bg-red-100 rounded text-red-600"
                                  title="Delete Certificate/Service Report"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                            getStatus(cert.expiration_date) === 'expired' ? "bg-red-50 text-red-700" :
                            getStatus(cert.expiration_date) === 'expiring soon' ? "bg-orange-50 text-orange-700" :
                            getStatus(cert.expiration_date) === 'expiring' ? "bg-amber-50 text-amber-700" :
                            "bg-blue-50 text-blue-700"
                          )}>
                            {getStatus(cert.expiration_date)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>Expires: {cert.expiration_date}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                </section>
              </div>
            </motion.div>
          </>
        )}

        {(selectedCert || (previewFile && view !== 'admin_add_cert')) && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedCert(null);
                setPreviewFile(null);
              }}
              className="fixed inset-0 bg-blue-900/30 z-[150]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full md:w-[700px] bg-white z-[170] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-blue-50 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedCert ? selectedCert.name : "Document Preview"}</h2>
                  <p className="text-sm text-slate-500">{selectedCert ? selectedCert.vessel_name : "Autofill Preview"}</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedCert(null);
                    setPreviewFile(null);
                  }} 
                  className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div 
                ref={sidePanelContentRef}
                className="flex-1 overflow-auto p-6 space-y-8 custom-scrollbar"
              >
                {/* File Preview Section - Primary Focus */}
                {previewFile && (
                  <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Document Preview</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                          {previewFile.original_name}
                        </span>
                        <a 
                          href={tempPreviewUrl || new URL(`/api/files/${encodeURIComponent(previewFile.filename)}?token=${token}`, window.location.href).href}
                          target="_blank" 
                          rel="noreferrer"
                          className="p-1 hover:bg-blue-50 rounded text-blue-400 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    {(() => {
                      const ext = previewFile.original_name.split('.').pop()?.toLowerCase();
                      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
                      const isPdf = ext === 'pdf';
                      const fileUrl = tempPreviewUrl || new URL(`/api/files/${encodeURIComponent(previewFile.filename)}?token=${token}`, window.location.href).href;

                      if (isImage) {
                        return (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 overflow-hidden h-[calc(100vh-200px)] max-h-[85vh] min-h-[500px] relative">
                            <ImageViewer 
                              url={fileUrl} 
                              title={previewFile.original_name} 
                            />
                          </div>
                        );
                      } else if (isPdf) {
                        return (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 overflow-hidden h-[calc(100vh-200px)] max-h-[85vh] min-h-[500px] relative">
                            <PDFViewer 
                              url={fileUrl} 
                              title={previewFile.original_name} 
                            />
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-8 rounded-2xl border border-dashed border-blue-200 bg-blue-50/30 flex flex-col items-center justify-center text-center gap-3">
                            <File className="w-8 h-8 text-blue-300" />
                            <p className="text-xs text-slate-500">Preview not available for this file type.<br/><span className="font-mono font-bold text-blue-600">{previewFile.original_name}</span></p>
                            <a 
                              href={fileUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                            >
                              Download to view
                            </a>
                          </div>
                        );
                      }
                    })()}
                  </section>
                )}

                {/* Info Section */}
                {selectedCert && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Details</label>
                      {isRecognizing && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 animate-pulse flex items-center gap-1">
                          <RefreshCw className="w-2 h-2 animate-spin" /> Analyzing Document...
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Cert Number</label>
                      <input 
                        type="text" 
                        value={selectedCert.certificate_number || ''}
                        readOnly={!(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user')}
                        onChange={(e) => setSelectedCert({...selectedCert, certificate_number: e.target.value})}
                        className="w-full px-4 py-2 bg-blue-50/50 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500/20 read-only:opacity-70"
                        placeholder="N/A"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Date Issued</label>
                        <input 
                          type="date" 
                          value={selectedCert.date_issued || ''}
                          readOnly={!(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user')}
                          onChange={(e) => setSelectedCert({...selectedCert, date_issued: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500/20 read-only:opacity-70"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Expiration Date</label>
                        <input 
                          type="date" 
                          value={newExpDate}
                          readOnly={!(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user')}
                          onChange={(e) => setNewExpDate(e.target.value)}
                          className="w-full px-4 py-2 bg-blue-50/50 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500/20 read-only:opacity-70"
                        />
                      </div>
                    </div>
                    {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                      <button 
                        onClick={handleSidePanelUpdateCert}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Save All Changes
                      </button>
                    )}
                  </div>
                )}

                {selectedCert && <div className="h-px bg-blue-50" />}

                {/* Files Section */}
                {selectedCert && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Documents</label>
                        <div className="flex items-center gap-2 mt-1">
                          <button 
                            onClick={() => setUploadFileType('certificate')}
                            className={cn(
                              "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm",
                              uploadFileType === 'certificate' ? "bg-blue-600 text-white shadow-blue-100" : "bg-slate-50 text-slate-400 hover:bg-white hover:text-slate-600 border border-slate-100"
                            )}
                          >
                            Certificate/Service Report
                          </button>
                          <button 
                            onClick={() => setUploadFileType('supporting')}
                            className={cn(
                              "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm",
                              uploadFileType === 'supporting' ? "bg-blue-600 text-white shadow-blue-100" : "bg-slate-50 text-slate-400 hover:bg-white hover:text-slate-600 border border-slate-100"
                            )}
                          >
                            Supporting
                          </button>
                        </div>
                      </div>
                      <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold hover:bg-blue-100 transition-colors shadow-sm self-end">
                        <Upload className="w-3 h-3" /> Upload {uploadFileType === 'certificate' ? 'Cert/Repo' : 'File'}
                        <input type="file" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>
                    
                    <div className="space-y-6">
                    {files.length === 0 ? (
                      <p className="text-sm text-slate-400 italic px-1">No documents uploaded yet.</p>
                    ) : (
                      <>
                        {/* Certificate Files (Latest Pinned) */}
                        {files.some(f => f.file_type === 'certificate') && (
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2 ml-1">
                              Certificate/Service Report History
                              <div className="flex-1 h-px bg-blue-50" />
                            </h4>
                            {files.filter(f => f.file_type === 'certificate').sort((a,b) => b.id - a.id).map((file, idx) => (
                              <div 
                                key={file.id} 
                                onClick={() => {
                                  setTempPreviewUrl(null);
                                  setPreviewFile(file);
                                  if (sidePanelContentRef.current) {
                                    sidePanelContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-xl group cursor-pointer transition-all border",
                                  previewFile?.id === file.id 
                                    ? "bg-blue-50/50 border-blue-200 shadow-sm" 
                                    : "bg-white border-slate-100 hover:border-blue-100 hover:bg-blue-50/20"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn(
                                    "p-1.5 rounded-lg shrink-0",
                                    idx === 0 ? "bg-blue-600 text-white shadow-sm" : "bg-blue-50 text-blue-400"
                                  )}>
                                    <File className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={cn("text-xs font-bold truncate", previewFile?.id === file.id ? "text-blue-900" : "text-slate-900")}>
                                        {file.original_name}
                                      </span>
                                      {idx === 0 && (
                                        <span className="shrink-0 px-1.5 py-0.5 bg-blue-600 text-white text-[7px] font-black uppercase tracking-tighter rounded-full">LATEST</span>
                                      )}
                                    </div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                                      {new Date(file.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <a 
                                    href={new URL(`/api/files/${file.filename}?token=${token}`, window.location.href).href} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                                    title="Download"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                  {(user?.role === 'admin' || user?.role === 'team_pic' || user?.role === 'user') && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFile(file.id);
                                      }}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Supporting Files */}
                        {files.some(f => f.file_type === 'supporting') && (
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-2 ml-1">
                              Supporting Documents
                              <div className="flex-1 h-px bg-purple-50" />
                            </h4>
                            {files.filter(f => f.file_type === 'supporting').sort((a,b) => b.id - a.id).map(file => (
                              <div 
                                key={file.id} 
                                onClick={() => {
                                  setTempPreviewUrl(null);
                                  setPreviewFile(file);
                                  if (sidePanelContentRef.current) {
                                    sidePanelContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-xl group cursor-pointer transition-all border",
                                  previewFile?.id === file.id 
                                    ? "bg-purple-50/50 border-purple-200 shadow-sm" 
                                    : "bg-white border-slate-100 hover:border-purple-100 hover:bg-purple-50/20"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="p-1.5 bg-purple-50 text-purple-400 rounded-lg shrink-0">
                                    <Paperclip className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className={cn("text-xs font-bold truncate block", previewFile?.id === file.id ? "text-purple-900" : "text-slate-900")}>
                                      {file.original_name}
                                    </span>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                                      {new Date(file.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <a 
                                    href={new URL(`/api/files/${file.filename}?token=${token}`, window.location.href).href} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-600 transition-colors"
                                    title="Download"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                  {(user?.role === 'admin' || user?.role === 'team_pic' || user?.role === 'user') && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFile(file.id);
                                      }}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}

                {/* Notes History */}
                {selectedCert && (
                  <section>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">Notes & Communication</label>
                    <div className="space-y-4">
                      {notes.length === 0 ? (
                        <div className="py-8 flex flex-col items-center justify-center text-slate-400 italic">
                          <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-sm">No notes yet.</p>
                        </div>
                      ) : (
                        notes.map(note => {
                          const isOwn = note.user_id === user.id;
                          return (
                            <div 
                              key={note.id} 
                              className={cn(
                                "flex flex-col max-w-[90%]",
                                isOwn ? "ml-auto items-end" : "mr-auto items-start"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1 px-1">
                                {!isOwn && <span className="text-[10px] font-bold text-slate-900">{note.username}</span>}
                                <span className="text-[10px] text-slate-400">{format(parseISO(note.created_at), 'MMM d, HH:mm')}</span>
                              </div>
                              <div className={cn(
                                "p-3 rounded-2xl text-sm shadow-sm",
                                isOwn 
                                  ? "bg-blue-600 text-white rounded-tr-none" 
                                  : "bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200"
                              )}>
                                {note.content}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={notesEndRef} />
                    </div>
                  </section>
                )}
              </div>

              {/* Pinned Input At Bottom */}
              {selectedCert && (
                <div className="p-6 border-t border-blue-50 bg-white">
                  <div className="flex gap-2 p-1">
                    <input 
                      type="text" 
                      placeholder="Add a note..." 
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddNote();
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                    <button 
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      className={cn(
                        "p-3 rounded-xl transition-all shadow-lg flex items-center justify-center",
                        newNote.trim() 
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100" 
                          : "bg-slate-100 text-slate-300 shadow-none cursor-not-allowed"
                      )}
                    >
                      <MessageSquare className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )}

      <ChangePasswordModal 
        isOpen={isChangePasswordOpen} 
        onClose={() => setIsChangePasswordOpen(false)} 
        token={token} 
        notify={notify} 
      />

      <ConfirmModal 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Lifted Modals for Vessel and Certificate Editing */}
      {createPortal(
        <AnimatePresence>
          {editingVessel && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingVessel(null)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-md:max-w-[95%] max-w-md bg-white rounded-3xl shadow-2xl z-[160] overflow-hidden"
              >
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Edit Vessel</h3>
                    <button onClick={() => setEditingVessel(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Vessel Name</label>
                      <input 
                        type="text" 
                        placeholder="Vessel Name" 
                        value={editingVessel.name}
                        onChange={(e) => setEditingVessel({...editingVessel, name: e.target.value})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Team Assignment</label>
                      <select 
                        value={editingVessel.team_id || ''}
                        onChange={(e) => setEditingVessel({...editingVessel, team_id: Number(e.target.value)})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select Team</option>
                        {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Owner</label>
                      <select 
                        value={editingVessel.owner || 'Nissen'}
                        onChange={(e) => setEditingVessel({...editingVessel, owner: e.target.value as any})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="Nissen">Nissen</option>
                        <option value="Goodwill">Goodwill</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Type</label>
                      <select 
                        value={editingVessel.type || 'Bulk Carrier'}
                        onChange={(e) => setEditingVessel({...editingVessel, type: e.target.value as 'Bulk Carrier' | 'Container'})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="Bulk Carrier">Bulk Carrier</option>
                        <option value="Container">Container</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Flag</label>
                        <select 
                          value={editingVessel.flag || ''}
                          onChange={(e) => setEditingVessel({...editingVessel, flag: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Select Flag</option>
                          {flags.map(f => (
                            <option key={f.id} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Date Built</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 2024-05-10" 
                          value={editingVessel.date_built || ''}
                          onChange={(e) => setEditingVessel({...editingVessel, date_built: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Min Fuel Consumption</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 15.5 MT" 
                          value={editingVessel.min_fuel_consumption || ''}
                          onChange={(e) => setEditingVessel({...editingVessel, min_fuel_consumption: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Max Fuel Consumption</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 25.0 MT" 
                          value={editingVessel.max_fuel_consumption || ''}
                          onChange={(e) => setEditingVessel({...editingVessel, max_fuel_consumption: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Vessel Photo (Optional)</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file && file.size > MAX_FILE_SIZE) {
                            notify('error', 'File is too large (max 20MB)');
                            e.target.value = '';
                            return;
                          }
                          setEditingVesselPhoto(file);
                        }}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                    <button 
                      onClick={handleUpdateVessel}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                    >
                      Update Vessel
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}

          {editingCert && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingCert(null)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-md:max-w-[95%] max-w-md bg-white rounded-3xl shadow-2xl z-[160] overflow-hidden"
              >
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Edit Certificate/Service Report</h3>
                    <button onClick={() => setEditingCert(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Vessel</label>
                        <select 
                          value={editingCert.vessel_id || ''}
                          disabled={user.role === 'vessel'}
                          onChange={(e) => {
                            const val = e.target.value;
                            const vessel = vessels.find(v => v.id === Number(val));
                            setEditingCert({
                              ...editingCert, 
                              vessel_id: val ? Number(val) : null,
                              team_id: vessel ? vessel.team_id : (val === '' ? '' : editingCert.team_id) as any
                            });
                          }}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                        >
                          {user.role !== 'vessel' && <option value="">None</option>}
                          {vessels.filter(v => user.role !== 'vessel' || v.id === user.vessel_id).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Team</label>
                        <select 
                          value={editingCert.team_id || ''}
                          onChange={(e) => setEditingCert({...editingCert, team_id: Number(e.target.value)})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!!editingCert.vessel_id}
                        >
                          <option value="">Select Team</option>
                          {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Certificate/Service Report Name</label>
                      <input 
                        type="text" 
                        placeholder="Certificate/Service Report Name" 
                        value={editingCert.name}
                        onChange={(e) => setEditingCert({...editingCert, name: e.target.value})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Certificate/Service Report Number</label>
                      <input 
                        type="text" 
                        placeholder="Cert #" 
                        value={editingCert.certificate_number || ''}
                        onChange={(e) => setEditingCert({...editingCert, certificate_number: e.target.value})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Date Issued</label>
                        <input 
                          type="date" 
                          value={editingCert.date_issued || ''}
                          onChange={(e) => setEditingCert({...editingCert, date_issued: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Expiration Date</label>
                        <input 
                          type="date" 
                          value={editingCert.expiration_date}
                          onChange={(e) => setEditingCert({...editingCert, expiration_date: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Access Type</label>
                      <select 
                        value={editingCert.access_type}
                        disabled={user.role === 'vessel'}
                        onChange={(e) => setEditingCert({...editingCert, access_type: e.target.value as any})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                      >
                        {user.role !== 'vessel' && <option value="office">Office Only</option>}
                        <option value="vessel">Ship Certificate/Service Report</option>
                        {user.role !== 'vessel' && <option value="any">Any</option>}
                      </select>
                    </div>
                    <button 
                      onClick={handleUpdateCert}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                    >
                      Update Certificate/Service Report
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

const parseCoordinate = (coordStr: string, isLat: boolean): number | null => {
  if (!coordStr) return null;
  let clean = coordStr.toUpperCase().trim();
  
  // Determine sign based on cardinal directions
  let isNegative = false;
  if (clean.includes('S') || clean.includes('W')) {
    isNegative = true;
  }
  
  if (clean.startsWith('-')) {
    isNegative = true;
    clean = clean.substring(1);
  } else if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }
  
  // Strip cardinal direction letters from start/end
  clean = clean.replace(/^[NSWE]/g, '').replace(/[NSWE]$/g, '').trim();

  // 1. Check if the remaining string is a direct decimal degree (a clean float)
  const floatRegex = /^[0-9]+(?:\.[0-9]+)?$/;
  if (floatRegex.test(clean)) {
    const parsedVal = parseFloat(clean);
    if (!isNaN(parsedVal)) {
      const dotIdx = clean.indexOf('.');
      const integerPart = dotIdx !== -1 ? clean.substring(0, dotIdx) : clean;
      
      const threshold = isLat ? 2 : 3;
      // If integer part length is greater than threshold OR value is out of decimal degree bounds,
      // it looks like unseparated degrees-minutes (e.g. 1234.56 or 10324.56)
      const looksLikeDM = integerPart.length > threshold || (isLat && parsedVal > 90) || (!isLat && parsedVal > 180);

      if (!looksLikeDM) {
        let val = parsedVal;
        if (isNegative) val = -val;
        if (isLat && val >= -90 && val <= 90) return val;
        if (!isLat && val >= -180 && val <= 180) return val;
      }
    }
  }

  // 2. Fallback parsing for other styles (e.g. separated DM/DMS, or unseparated padded DM)
  const spaced = clean.replace(/[^0-9.]/g, ' ').trim();
  const parts = spaced.split(/\s+/).map(p => parseFloat(p)).filter(p => !isNaN(p));
  
  if (parts.length === 0) return null;
  
  let decimal = 0;
  
  if (parts.length === 1) {
    // Single number with separators? Or unseparated DM like "1234.56" or "10324.56"
    const originalDigits = clean.replace(/[^0-9.]/g, '').trim();
    const dotIdx = originalDigits.indexOf('.');
    const integerPart = dotIdx !== -1 ? originalDigits.substring(0, dotIdx) : originalDigits;
    const decimalPart = dotIdx !== -1 ? originalDigits.substring(dotIdx) : '';
    
    let degLen = isLat ? 2 : 3;
    if (!isLat && integerPart.length <= 4) {
      degLen = 2;
    }
    
    if (integerPart.length > degLen) {
      const degStr = integerPart.substring(0, degLen);
      const minStr = integerPart.substring(degLen) + decimalPart;
      const deg = parseFloat(degStr);
      const min = parseFloat(minStr);
      if (!isNaN(deg) && !isNaN(min)) {
        decimal = deg + (min / 60);
      } else {
        decimal = parts[0];
      }
    } else {
      decimal = parts[0];
    }
  } else if (parts.length === 2) {
    decimal = parts[0] + (parts[1] / 60);
  } else if (parts.length >= 3) {
    decimal = parts[0] + (parts[1] / 60) + (parts[2] / 3600);
  }
  
  if (isNegative) {
    decimal = -decimal;
  }
  
  // Validation bounds check
  if (isLat) {
    if (decimal < -90 || decimal > 90) return null;
  } else {
    if (decimal < -180 || decimal > 180) return null;
  }
  
  return decimal;
};

const SlideshowMap = ({ latStr, lonStr, vesselName }: { latStr: string, lonStr: string, vesselName: string }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(!!(window as any).L);

  const parsedLat = parseCoordinate(latStr, true);
  const parsedLon = parseCoordinate(lonStr, false);

  // Poll or verify that globally injected Leaflet is fully parsed by the browser
  useEffect(() => {
    if ((window as any).L) {
      setLeafletReady(true);
      return;
    }

    const interval = setInterval(() => {
      if ((window as any).L) {
        setLeafletReady(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!leafletReady || parsedLat === null || parsedLon === null || !mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    let map: any = null;

    try {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }

      map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true
      }).setView([parsedLat, parsedLon], 1);
      
      leafletInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 3,
        className: 'map-tiles-load'
      }).addTo(map);

      const customIcon = L.divIcon({
        className: 'custom-marine-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-blue-500/40 rounded-full animate-ping"></div>
            <div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-xl relative z-10"></div>
          </div>
        `,
        iconSize: [32, 32]
      });

      L.marker([parsedLat, parsedLon], { icon: customIcon }).addTo(map);

      // Force instant sizing recalculation and another one shortly after layouts finalize
      map.invalidateSize();
      const delayInval = setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 50);

      return () => {
        clearTimeout(delayInval);
      };
    } catch (e) {
      console.warn("Leaflet instantiation issue:", e);
    }

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, [leafletReady, parsedLat, parsedLon, vesselName, latStr, lonStr]);

  if (parsedLat === null || parsedLon === null) {
    return (
      <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center bg-black/40 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-md">
        <MapIcon className="w-10 h-10 text-slate-500 mb-2 animate-bounce" />
        <p className="text-slate-400 font-bold text-sm">NO VALID LOCATION COORDINATES FOUND</p>
        <p className="text-slate-500 text-xs mt-1">Check recent voyage reports for lat/long</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[200px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
      <style>{`
        .leaflet-container {
          background: #0b1329 !important;
          color: #f8fafc !important;
          font-family: inherit;
        }
        .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(95%);
        }
        .leaflet-pane {
          z-index: 1 !important;
        }
        .leaflet-top, .leaflet-bottom {
          z-index: 2 !important;
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full z-10" />
      <div className="absolute bottom-4 right-4 z-[400] bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex flex-col pointer-events-none text-right font-mono text-[9px] text-slate-300">
        <span>Lat: {latStr}</span>
        <span>Long: {lonStr}</span>
      </div>
    </div>
  );
};

const SlideshowView = ({ 
  vessels, 
  certs, 
  token, 
  arrivalReports,
  departureReports,
  noonReports,
  otherReports
}: { 
  vessels: Vessel[], 
  certs: Certificate[], 
  token: string, 
  arrivalReports: ArrivalReport[],
  departureReports: DepartureReport[],
  noonReports: NoonReport[],
  otherReports: OtherReport[]
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [cachedImages, setCachedImages] = useState<Record<number, string>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const slideDuration = 20000; // 20 seconds per slide

  const getLatestArrivalOperationType = (vesselId: number) => {
    const reports = (arrivalReports || [])
      .filter(r => r.vessel_id === vesselId)
      .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime());
    return reports.length > 0 ? reports[0].operation_type : 'N/A';
  };

  const getLatestVesselPosition = (vesselId: number) => {
    const allReports: { utc_date_time: string, position_lat: string, position_long: string, type: string }[] = [];
    
    (arrivalReports || []).filter(r => r.vessel_id === vesselId).forEach(r => {
      if (r.position_lat && r.position_long) {
        allReports.push({ utc_date_time: r.utc_date_time, position_lat: r.position_lat, position_long: r.position_long, type: 'Arrival' });
      }
    });
    (departureReports || []).filter(r => r.vessel_id === vesselId).forEach(r => {
      if (r.position_lat && r.position_long) {
        allReports.push({ utc_date_time: r.utc_date_time, position_lat: r.position_lat, position_long: r.position_long, type: 'Departure' });
      }
    });
    (noonReports || []).filter(r => r.vessel_id === vesselId).forEach(r => {
      if (r.position_lat && r.position_long) {
        allReports.push({ utc_date_time: r.utc_date_time, position_lat: r.position_lat, position_long: r.position_long, type: 'Noon' });
      }
    });
    (otherReports || []).filter(r => r.vessel_id === vesselId).forEach(r => {
      if (r.position_lat && r.position_long) {
        allReports.push({ utc_date_time: r.utc_date_time, position_lat: r.position_lat, position_long: r.position_long, type: 'Other' });
      }
    });

    allReports.sort((a, b) => {
      const timeA = new Date(a.utc_date_time).getTime();
      const timeB = new Date(b.utc_date_time).getTime();
      return timeB - timeA;
    });

    return allReports[0] || null;
  };

  // Preload all vessel images into local cache (Blob URLs)
  useEffect(() => {
    const preloadImages = async () => {
      const cache: Record<number, string> = {};
      
      const loadPromises = vessels
        .filter(v => v.has_photo)
        .map(async (v) => {
          try {
            const response = await fetch(`/api/vessels/${v.id}/photo?token=${token}`);
            if (response.ok) {
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              cache[v.id] = objectUrl;
            }
          } catch (error) {
            console.error(`Failed to preload image for vessel ${v.name}:`, error);
          }
        });

      await Promise.all(loadPromises);
      setCachedImages(cache);
    };

    if (vessels.length > 0) {
      preloadImages();
    }

    // Cleanup Blob URLs on unmount
    return () => {
      setCachedImages(prev => {
        Object.values(prev).forEach(url => URL.revokeObjectURL(url as string));
        return {};
      });
    };
  }, [vessels, token]);

  useEffect(() => {
    if (isPaused || vessels.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % vessels.length);
    }, slideDuration);
    return () => clearInterval(timer);
  }, [isPaused, vessels.length]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      if (!isFS && isKioskMode) {
        setIsKioskMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isKioskMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target && 
        (target.tagName === 'INPUT' || 
         target.tagName === 'TEXTAREA' || 
         target.isContentEditable)
      ) {
        return;
      }

      if (isKioskMode && e.key === 'Escape') {
        exitKioskMode();
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex(prev => (prev + 1) % vessels.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex(prev => (prev - 1 + vessels.length) % vessels.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKioskMode, vessels.length]);

  const enterKioskMode = () => {
    setIsKioskMode(true);
    setIsPaused(false);
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable kiosk mode fullscreen: ${err.message}`);
      });
    }
  };

  const exitKioskMode = () => {
    setIsKioskMode(false);
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  if (vessels.length === 0) return (
    <div className="flex-1 flex items-center justify-center p-12 text-slate-400 italic">
      No vessels available for slideshow.
    </div>
  );

  const vessel = vessels[currentIndex];
  const lastPos = getLatestVesselPosition(vessel.id);
  const latStr = lastPos ? lastPos.position_lat : '';
  const lonStr = lastPos ? lastPos.position_long : '';
  const vesselCerts = certs.filter(c => c.vessel_id === vessel.id && getStatus(c.expiration_date) !== 'active')
    .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime())
    .slice(0, 10);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex-1 flex flex-col bg-slate-900 text-white overflow-hidden shadow-2xl border border-slate-800 relative group",
        isFullscreen ? "h-screen w-screen rounded-none border-none" : "h-full rounded-3xl"
      )}
    >
      {/* Animated Background with Cross-fade */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={vessel.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{
              backgroundImage: vessel.has_photo 
                ? `url(${cachedImages[vessel.id] || `/api/vessels/${vessel.id}/photo?token=${token}`})` 
                : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        </AnimatePresence>
      </div>

      {/* Lighter Dark Overlay for Maximum Visibility */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/40 via-transparent to-slate-950/40" />

      {/* Slideshow Header */}
      {!isKioskMode && (
        <div className="relative p-6 bg-slate-900/20 border-b border-white/5 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/80 rounded-2xl shadow-lg shadow-blue-900/20">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Fleet Slideshow</h2>
              <p className="text-slate-300 text-xs uppercase font-bold tracking-widest drop-shadow-md">Vessel {currentIndex + 1} of {vessels.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentIndex((prev) => (prev - 1 + vessels.length) % vessels.length)}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="p-3 bg-blue-600/80 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
            </button>
            <button 
              onClick={() => setCurrentIndex((prev) => (prev + 1) % vessels.length)}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button 
              onClick={enterKioskMode}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white"
              title="Enter Kiosk Mode (Locked Fullscreen)"
            >
              <Shield className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Kiosk Mode Exit Button (Hidden/Floating) */}
      {isKioskMode && (
        <div className="absolute top-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
          <button 
            onClick={exitKioskMode}
            className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 text-white/50 hover:text-white rounded-full border border-white/10 backdrop-blur-md text-xs font-bold transition-all"
          >
            <ShieldAlert className="w-4 h-4" /> Exit Kiosk Mode
          </button>
        </div>
      )}

      {/* Slide Content */}
      <div className="relative flex-1 p-8 flex flex-col lg:flex-row justify-between gap-12 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${vessel.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col lg:flex-row justify-between gap-12 w-full"
          >
            {/* Left Column: Vessel Info & Route */}
            <div className="space-y-8 max-w-2xl w-full">
              <div className="flex items-center gap-6">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="p-4 bg-blue-600/30 rounded-3xl border border-blue-500/40 backdrop-blur-md"
                >
                  <Ship className="w-12 h-12 text-blue-300" />
                </motion.div>
                <div>
                  <motion.h1 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-6xl font-black tracking-tighter text-white mb-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                  >
                    {vessel.name}
                  </motion.h1>
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center gap-3"
                  >
                    <span className="px-3 py-1 bg-black/40 rounded-full text-sm font-bold text-white border border-white/20 backdrop-blur-md">{vessel.team_name}</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md",
                      vessel.owner === 'Nissen' ? "bg-purple-600/40 text-purple-100 border border-purple-500/50" : "bg-orange-600/40 text-orange-100 border border-orange-500/50"
                    )}>
                      {vessel.owner || 'Nissen'}
                    </span>
                  </motion.div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: MapPin, label: 'Next Port', value: vessel.next_port || 'NOT SET', color: 'blue' },
                  { icon: Activity, label: 'Status', value: vessel.route_status || 'NOT SET', color: 'green' },
                  { icon: Compass, label: 'Operation Type', value: vessel.operation_type || getLatestArrivalOperationType(vessel.id), color: 'indigo' },
                  { icon: Clock, label: 'ETA / ATB (UTC)', value: vessel.eta_atb || 'NOT SET', color: 'amber' },
                  { icon: Anchor, label: 'ETD/ATD at Arrival (UTC)', value: vessel.etd_atd || 'NOT SET', color: 'purple' },
                  { icon: Package, label: 'Cargo', value: vessel.cargo || 'NO CARGO INFORMATION', color: 'orange', full: true }
                ].map((item, idx) => (
                  <motion.div 
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + (idx * 0.1) }}
                    className={cn(
                      "bg-black/40 p-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl",
                      item.full && "col-span-full"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("p-1.5 rounded-lg", `bg-${item.color}-500/30`)}>
                        <item.icon className={cn("w-4 h-4", `text-${item.color}-300`)} />
                      </div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300">{item.label}</h3>
                    </div>
                    <p className={cn("font-bold text-white", item.full ? "text-sm" : "text-lg truncate")}>{item.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Column: Urgent Certificates & Vessel Map */}
            <div className="space-y-6 max-w-sm w-full flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 drop-shadow-md">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Urgent Certificates/Service Reports
                  </h3>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {vesselCerts.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="p-8 text-center bg-black/40 rounded-3xl border border-white/10 border-dashed backdrop-blur-md"
                    >
                      <CheckCircle2 className="w-10 h-10 text-green-500/20 mx-auto mb-2" />
                      <p className="text-slate-300 italic text-xs">No expiring or expired certificates.</p>
                    </motion.div>
                  ) : (
                    vesselCerts.map((cert, idx) => (
                      <motion.div 
                        key={cert.id} 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + (idx * 0.05) }}
                        className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/10 hover:bg-black/60 transition-all backdrop-blur-md group/item font-sans"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="text-sm font-bold text-white truncate group-hover/item:text-blue-400 transition-colors">{cert.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 font-mono">Expires: {cert.expiration_date}</p>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 shadow-lg",
                          getStatus(cert.expiration_date) === 'expired' ? "bg-red-600/60 text-white border border-red-500/50" : 
                          getStatus(cert.expiration_date) === 'expiring soon' ? "bg-orange-600/60 text-white border border-orange-500/50" :
                          "bg-amber-600/60 text-white border border-amber-500/50"
                        )}>
                          {getStatus(cert.expiration_date)}
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Location Map Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 drop-shadow-md">
                   <Compass className="w-4 h-4 text-blue-400" /> Location Map
                </h3>
                <div className="h-[220px]">
                  <SlideshowMap latStr={latStr} lonStr={lonStr} vesselName={vessel.name} />
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Ticker Tape */}
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(100vw, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 12s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
      
      {vessel.remark_from_vessel && vessel.remark_from_vessel.trim() ? (
        <div className="relative bg-slate-950/90 border-t border-white/10 backdrop-blur-md px-6 py-2.5 overflow-hidden flex items-center z-20 h-11 select-none">
          <div className="w-full overflow-hidden whitespace-nowrap">
            <div className="animate-marquee whitespace-nowrap text-sm font-semibold tracking-wide text-blue-100/90">
              {vessel.remark_from_vessel}
            </div>
          </div>
        </div>
      ) : null}

      {/* Progress Bar */}
      <div className="relative h-1.5 bg-white/10 w-full overflow-hidden">
        <motion.div 
          key={currentIndex}
          initial={{ width: 0 }}
          animate={{ width: isPaused ? '0%' : '100%' }}
          transition={{ duration: slideDuration / 1000, ease: "linear" }}
          className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        />
      </div>
    </div>
  );
};

const FuelConsumptionView = ({ vessels, departureReports, arrivalReports }: { 
  vessels: Vessel[], 
  departureReports: DepartureReport[],
  arrivalReports: ArrivalReport[]
}) => {
  const consumptionData = React.useMemo(() => {
    return vessels.map(vessel => {
      const vDepartures = departureReports.filter(r => r.vessel_id === vessel.id);
      const vArrivals = arrivalReports.filter(r => r.vessel_id === vessel.id);

      const totalPortHsfo = vDepartures.reduce((acc, r) => acc + (r.foc_port_hsfo || 0), 0);
      const totalPortLsfo = vDepartures.reduce((acc, r) => acc + (r.foc_port_lsfo || 0), 0);
      const totalPortMgo = vDepartures.reduce((acc, r) => acc + (r.foc_port_mgo || 0), 0);
      const totalPortMdo = vDepartures.reduce((acc, r) => acc + (r.foc_port_mdo || 0), 0);

      const totalSeaHsfo = vArrivals.reduce((acc, r) => acc + (r.foc_sea_hsfo || 0), 0);
      const totalSeaLsfo = vArrivals.reduce((acc, r) => acc + (r.foc_sea_lsfo || 0), 0);
      const totalSeaMgo = vArrivals.reduce((acc, r) => acc + (r.foc_sea_mgo || 0), 0);
      const totalSeaMdo = vArrivals.reduce((acc, r) => acc + (r.foc_sea_mdo || 0), 0);

      return {
        vesselName: vessel.name,
        hsfo: (totalPortHsfo + totalSeaHsfo).toFixed(2),
        lsfo: (totalPortLsfo + totalSeaLsfo).toFixed(2),
        mgo: (totalPortMgo + totalSeaMgo).toFixed(2),
        mdo: (totalPortMdo + totalSeaMdo).toFixed(2),
        total: (totalPortHsfo + totalSeaHsfo + totalPortLsfo + totalSeaLsfo + totalPortMgo + totalSeaMgo + totalPortMdo + totalSeaMdo).toFixed(2)
      };
    });
  }, [vessels, departureReports, arrivalReports]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Fuel Consumption</h1>
        <p className="text-slate-500">Aggregated fuel consumption data from all reports.</p>
      </header>

      <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="px-6 py-4">Vessel Name</th>
                <th className="px-6 py-4 text-right">Total HSFO (mt)</th>
                <th className="px-6 py-4 text-right">Total LSFO (mt)</th>
                <th className="px-6 py-4 text-right">Total MGO (mt)</th>
                <th className="px-6 py-4 text-right">Total MDO (mt)</th>
                <th className="px-6 py-4 text-right">Grand Total (mt)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {consumptionData.map((data, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{data.vesselName}</td>
                  <td className="px-6 py-4 font-mono text-sm text-right">{data.hsfo}</td>
                  <td className="px-6 py-4 font-mono text-sm text-right">{data.lsfo}</td>
                  <td className="px-6 py-4 font-mono text-sm text-right">{data.mgo}</td>
                  <td className="px-6 py-4 font-mono text-sm text-right">{data.mdo}</td>
                  <td className="px-6 py-4 font-mono text-sm font-bold text-blue-600 text-right">{data.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const NoonToNoonView = ({ user, token, vessels, reports, onRefresh, notify, isLoading }: { 
  user: User, 
  token: string, 
  vessels: Vessel[], 
  reports: NoonReport[],
  onRefresh: () => void,
  notify: (type: 'success' | 'error', message: string) => void,
  isLoading?: boolean
  }) => {
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const defaultForm = {
    vessel_id: String(user.vessel_id || ''),
    utc_date_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    position_long: '',
    position_lat: '',
    distance_to_go: '',
    cargo_status: 'ballast',
    rob_hsfo: '0',
    rob_lsfo: '0',
    rob_mgo: '0',
    rob_mdo: '0',
    voyage_number: '',
    weather_notation: '',
    swell_scale_21: '',
    wind_scale: '',
    wave_scale: '',
    weather_image: '',
    remarks: '',
    destination_port: '',
    eta_utc: '',
    agent_details: '',
    charterer_min_hsfo: '',
    charterer_max_hsfo: '',
    charterer_min_lsfo: '',
    charterer_max_lsfo: '',
    charterer_min_mgo: '',
    charterer_max_mgo: '',
    charterer_min_mdo: '',
    charterer_max_mdo: ''
  };
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [vesselFilter, setVesselFilter] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isThresholdEditing, setIsThresholdEditing] = useState(false);

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  const fetchChatMessages = useCallback(async () => {
    if (!form.vessel_id) return;
    setIsLoadingChat(true);
    try {
      const res = await fetch(`/api/vessels/${form.vessel_id}/threshold-chat`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setChatMessages(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch threshold chat:', err);
    } finally {
      setIsLoadingChat(false);
    }
  }, [form.vessel_id, token]);

  useEffect(() => {
    if (form.vessel_id) {
      fetchChatMessages();
    } else {
      setChatMessages([]);
    }
  }, [form.vessel_id, fetchChatMessages]);

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.vessel_id) {
      notify('error', 'Please select a vessel first');
      return;
    }
    if (!newChatMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      const res = await fetch(`/api/vessels/${form.vessel_id}/threshold-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message_text: newChatMessage })
      });
      if (res.ok) {
        setNewChatMessage('');
        fetchChatMessages();
      } else {
        const errData = await res.json();
        notify('error', errData.error || 'Failed to send message');
      }
    } catch (err) {
      notify('error', 'Error sending message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  React.useEffect(() => {
    if (!editingId && form.vessel_id) {
      const selectedVessel = vessels.find(v => String(v.id) === String(form.vessel_id));
      if (selectedVessel) {
        setForm(f => ({
          ...f,
          charterer_min_hsfo: selectedVessel.charterer_min_hsfo || '',
          charterer_max_hsfo: selectedVessel.charterer_max_hsfo || '',
          charterer_min_lsfo: selectedVessel.charterer_min_lsfo || '',
          charterer_max_lsfo: selectedVessel.charterer_max_lsfo || '',
          charterer_min_mgo: selectedVessel.charterer_min_mgo || '',
          charterer_max_mgo: selectedVessel.charterer_max_mgo || '',
          charterer_min_mdo: selectedVessel.charterer_min_mdo || '',
          charterer_max_mdo: selectedVessel.charterer_max_mdo || ''
        }));
      }
    }
  }, [form.vessel_id, editingId, vessels]);

  const handleSaveThresholds = async () => {
    if (!form.vessel_id) {
      notify('error', 'Please select a vessel first');
      return;
    }

    try {
      const resVessel = await fetch(`/api/vessels/${form.vessel_id}/charterer-thresholds`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          charterer_min_hsfo: form.charterer_min_hsfo,
          charterer_max_hsfo: form.charterer_max_hsfo,
          charterer_min_lsfo: form.charterer_min_lsfo,
          charterer_max_lsfo: form.charterer_max_lsfo,
          charterer_min_mgo: form.charterer_min_mgo,
          charterer_max_mgo: form.charterer_max_mgo,
          charterer_min_mdo: form.charterer_min_mdo,
          charterer_max_mdo: form.charterer_max_mdo
        })
      });

      if (!resVessel.ok) {
        const error = await resVessel.json();
        throw new Error(error.error || 'Failed to save vessel thresholds');
      }

      if (editingId) {
        const resReport = await fetch(`/api/noon-reports/${editingId}/charterer-thresholds`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            charterer_min_hsfo: form.charterer_min_hsfo,
            charterer_max_hsfo: form.charterer_max_hsfo,
            charterer_min_lsfo: form.charterer_min_lsfo,
            charterer_max_lsfo: form.charterer_max_lsfo,
            charterer_min_mgo: form.charterer_min_mgo,
            charterer_max_mgo: form.charterer_max_mgo,
            charterer_min_mdo: form.charterer_min_mdo,
            charterer_max_mdo: form.charterer_max_mdo
          })
        });

        if (!resReport.ok) {
          const error = await resReport.json();
          throw new Error(error.error || 'Failed to save report thresholds');
        }
      }

      notify('success', 'Charterer thresholds saved successfully');
      setIsThresholdEditing(false);
      onRefresh();
    } catch (err: any) {
      notify('error', err.message || 'Failed to save thresholds');
    }
  };

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => vesselFilter === '' || String(r.vessel_id) === vesselFilter);
  }, [reports, vesselFilter]);

  const foc_computation = React.useMemo(() => {
    // If no reports yet, we can't auto compute FOC relative to previous ROB
    if (reports.length === 0) return { hsfo: '0.00', lsfo: '0.00', mgo: '0.00', mdo: '0.00' };
    
    // Sort reports by date to find the previous one for THIS vessel
    const vesselReports = reports
      .filter(r => String(r.vessel_id) === String(form.vessel_id) && r.id !== editingId)
      .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime());
    
    if (vesselReports.length === 0) return { hsfo: '0.00', lsfo: '0.00', mgo: '0.00', mdo: '0.00' };
    
    const prev = vesselReports[0]; // Most recent
    const current = {
      hsfo: parseFloat(form.rob_hsfo) || 0,
      lsfo: parseFloat(form.rob_lsfo) || 0,
      mgo: parseFloat(form.rob_mgo) || 0,
      mdo: parseFloat(form.rob_mdo) || 0,
    };
    
    return {
      hsfo: Math.max(0, prev.rob_hsfo - current.hsfo).toFixed(2),
      lsfo: Math.max(0, prev.rob_lsfo - current.lsfo).toFixed(2),
      mgo: Math.max(0, prev.rob_mgo - current.mgo).toFixed(2),
      mdo: Math.max(0, prev.rob_mdo - current.mdo).toFixed(2),
    };
  }, [form, reports, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingId ? `/api/noon-reports/${editingId}` : '/api/noon-reports';
      const method = editingId ? 'PUT' : 'POST';

      if (!file && !editingId) {
        notify('error', 'Please attach the scanned ROB report');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if ((key === 'utc_date_time' || key === 'eta_utc') && val) {
          formData.append(key, String(val).replace('T', ' '));
        } else {
          formData.append(key, String(val));
        }
      });
      
      formData.append('foc_hsfo', foc_computation.hsfo);
      formData.append('foc_lsfo', foc_computation.lsfo);
      formData.append('foc_mgo', foc_computation.mgo);
      formData.append('foc_mdo', foc_computation.mdo);

      if (file) {
        formData.append('report_file', file);
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        notify('success', `Noon report ${editingId ? 'updated' : 'submitted'} successfully`);
        setForm(defaultForm);
        setFile(null);
        setEditingId(null);
        onRefresh();
        setActiveTab('history');
      } else {
        const error = await res.json();
        notify('error', error.error || `Failed to ${editingId ? 'update' : 'submit'} report`);
      }
    } catch (err) {
      notify('error', 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const isLatestReport = (report: NoonReport) => {
    const vesselReports = (reports || []).filter(r => r.vessel_id === report.vessel_id);
    if (vesselReports.length === 0) return false;
    const sorted = [...vesselReports].sort((a, b) => {
      const timeB = new Date(b.utc_date_time).getTime();
      const timeA = new Date(a.utc_date_time).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id - a.id;
    });
    return sorted[0]?.id === report.id;
  };

  const canEditReport = (report: NoonReport) => {
    if (user.role !== 'vessel') return true;
    if (!isLatestReport(report)) return false;
    const reportTime = new Date(report.created_at).getTime();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return reportTime >= twentyFourHoursAgo;
  };

  const handleEdit = (report: NoonReport) => {
    setEditingId(report.id);
    setForm({
      vessel_id: String(report.vessel_id),
      voyage_number: report.voyage_number || '',
      utc_date_time: report.utc_date_time.slice(0, 16),
      position_long: report.position_long,
      position_lat: report.position_lat,
      distance_to_go: report.distance_to_go,
      cargo_status: report.cargo_status,
      rob_hsfo: String(report.rob_hsfo),
      rob_lsfo: String(report.rob_lsfo),
      rob_mgo: String(report.rob_mgo),
      rob_mdo: String(report.rob_mdo),
      weather_notation: report.weather_notation || '',
      swell_scale_21: report.swell_scale_21 || '',
      wind_scale: report.wind_scale || '',
      wave_scale: report.wave_scale || '',
      weather_image: report.weather_image || '',
      remarks: report.remarks || '',
      destination_port: report.destination_port || '',
      eta_utc: report.eta_utc ? report.eta_utc.slice(0, 16) : '',
      agent_details: report.agent_details || '',
      charterer_min_hsfo: report.charterer_min_hsfo || '',
      charterer_max_hsfo: report.charterer_max_hsfo || '',
      charterer_min_lsfo: report.charterer_min_lsfo || '',
      charterer_max_lsfo: report.charterer_max_lsfo || '',
      charterer_min_mgo: report.charterer_min_mgo || '',
      charterer_max_mgo: report.charterer_max_mgo || '',
      charterer_min_mdo: report.charterer_min_mdo || '',
      charterer_max_mdo: report.charterer_max_mdo || ''
    });
    setActiveTab('form');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      const res = await fetch(`/api/noon-reports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify('success', 'Report deleted successfully');
        onRefresh();
      } else {
        const error = await res.json();
        notify('error', error.error || 'Failed to delete report');
      }
    } catch (err) {
      notify('error', 'Connection error');
    }
  };

  const currentVessel = vessels.find(v => String(v.id) === String(form.vessel_id));
  const selectedVesselName = currentVessel?.name || 'Unknown Vessel';

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Noon to Noon</h1>
          <p className="text-slate-500">Track daily vessel position and fuel consumption.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button 
            onClick={() => { setActiveTab('form'); setEditingId(null); setForm(defaultForm); setIsThresholdEditing(false); }}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              activeTab === 'form' && !editingId
                ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            New Report
          </button>
          {editingId && (
            <div className="px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700 mx-1">
              Editing: {editingId}
            </div>
          )}
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              activeTab === 'history' 
                ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            History
          </button>
        </div>
      </header>

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Vessel</label>
                    {user.role === 'vessel' && user.vessel_id ? (
                      <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900">
                        {selectedVesselName}
                      </div>
                    ) : (
                      <select
                        value={form.vessel_id}
                        onChange={(e) => setForm({ ...form, vessel_id: e.target.value })}
                        required
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="">Select Vessel</option>
                        {vessels.map(v => (
                          <option key={v.id} value={String(v.id)}>{v.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Voyage Number</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. V-001"
                      value={form.voyage_number}
                      onChange={(e) => setForm({ ...form, voyage_number: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">UTC Date & Time</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={form.utc_date_time}
                      onChange={(e) => setForm({ ...form, utc_date_time: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Cargo Status</label>
                    <select 
                      value={form.cargo_status}
                      onChange={(e) => setForm({ ...form, cargo_status: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="ballast">Ballast</option>
                      <option value="laden">Laden</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Longitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 121.0 E"
                      value={form.position_long}
                      onChange={(e) => setForm({ ...form, position_long: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Latitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 14.5 N"
                      value={form.position_lat}
                      onChange={(e) => setForm({ ...form, position_lat: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Distance to Go (nm)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 500"
                      value={form.distance_to_go}
                      onChange={(e) => setForm({ ...form, distance_to_go: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Cargo Status</label>
                    <select 
                      value={form.cargo_status}
                      onChange={(e) => setForm({ ...form, cargo_status: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="ballast">BALLAST</option>
                      <option value="laden">LADEN</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Destination Port</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Singapore"
                      value={form.destination_port}
                      onChange={(e) => setForm({ ...form, destination_port: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ETA (UTC)</label>
                    <input 
                      type="datetime-local" 
                      value={form.eta_utc}
                      onChange={(e) => setForm({ ...form, eta_utc: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Agent Details</label>
                  <textarea 
                    placeholder="Enter local agent contact details, address, etc."
                    value={form.agent_details || ''}
                    onChange={(e) => setForm({ ...form, agent_details: e.target.value })}
                    className="w-full px-4 text-slate-900 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none h-20 placeholder-slate-400 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Remarks</label>
                  <textarea 
                    placeholder="Enter any notes or remarks..."
                    value={form.remarks || ''}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    className="w-full px-4 text-slate-900 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none h-20 placeholder-slate-400 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Scanned ROB Report</label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-100/50 transition-colors">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-700">{file ? file.name : 'Upload Report'}</span>
                      <input type="file" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f && f.size > MAX_FILE_SIZE) {
                          notify('error', 'File is too large (max 20MB)');
                          e.target.value = '';
                          return;
                        }
                        setFile(f);
                      }} />
                    </label>
                    {file && (
                      <button onClick={() => setFile(null)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Fuel Statistics & Consumption (Noon-to-Noon)
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                      <span>Fuel Type</span>
                      <div>
                        <span>Current ROB / Consumption based on previous report ROB</span>
                        {currentVessel && (
                          <span className="block text-blue-600 text-[9px] font-bold mt-0.5 normal-case tracking-normal">
                            Vessel Limit: {currentVessel.min_fuel_consumption || 'N/A'} - {currentVessel.max_fuel_consumption || 'N/A'}
                          </span>
                        )}
                      </div>
                    </div>
                    {[
                      { key: 'hsfo', label: 'HSFO', rob: 'rob_hsfo' },
                      { key: 'lsfo', label: 'LSFO', rob: 'rob_lsfo' },
                      { key: 'mgo', label: 'MGO', rob: 'rob_mgo' },
                      { key: 'mdo', label: 'MDO', rob: 'rob_mdo' },
                    ].map(f => (
                      <div key={f.key} className="grid grid-cols-2 gap-4 items-center">
                        <span className="text-sm font-bold text-slate-700">{f.label}</span>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            step="0.01"
                            value={(form as any)[f.rob]}
                            onChange={(e) => setForm({ ...form, [f.rob]: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                          />
                          <div 
                            className={`w-24 px-2 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center whitespace-nowrap ${
                              isFocOutsideLimits((foc_computation as any)[f.key], (form as any)[`charterer_min_${f.key}`], (form as any)[`charterer_max_${f.key}`])
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-blue-100 text-blue-700'
                            }`} 
                            title={`Consumption based on previous report ROB (Charterer Threshold: ${(form as any)[`charterer_min_${f.key}`] || 'N/A'} - ${(form as any)[`charterer_max_${f.key}`] || 'N/A'})`}
                          >
                            {(foc_computation as any)[f.key]}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="text-[10px] text-slate-400 italic px-2">
                      * FOC is auto-computed based on previous report's ROB.
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100 mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-blue-600" />
                      Consumption Threshold as per Charterer
                    </h4>
                    {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isThresholdEditing) {
                            handleSaveThresholds();
                          } else {
                            setIsThresholdEditing(true);
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm border ${
                          isThresholdEditing 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                        }`}
                      >
                        {isThresholdEditing ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Save
                          </>
                        ) : (
                          <>
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                      <span>Fuel Type</span>
                      <span>Min Threshold</span>
                      <span>Max Threshold</span>
                    </div>
                    {[
                      { key: 'hsfo', label: 'HSFO', minKey: 'charterer_min_hsfo', maxKey: 'charterer_max_hsfo' },
                      { key: 'lsfo', label: 'LSFO', minKey: 'charterer_min_lsfo', maxKey: 'charterer_max_lsfo' },
                      { key: 'mgo', label: 'MGO', minKey: 'charterer_min_mgo', maxKey: 'charterer_max_mgo' },
                      { key: 'mdo', label: 'MDO', minKey: 'charterer_min_mdo', maxKey: 'charterer_max_mdo' },
                    ].map(f => {
                      const canEdit = (user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && isThresholdEditing;
                      return (
                        <div key={f.key} className="grid grid-cols-3 gap-4 items-center">
                          <span className="text-sm font-bold text-slate-700">{f.label}</span>
                          <input 
                            type="text" 
                            value={(form as any)[f.minKey] || ''}
                            disabled={!canEdit}
                            placeholder={!canEdit ? 'N/A' : 'Min'}
                            onChange={(e) => setForm({ ...form, [f.minKey]: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-blue-200 disabled:bg-slate-50 disabled:text-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                          />
                          <input 
                            type="text" 
                            value={(form as any)[f.maxKey] || ''}
                            disabled={!canEdit}
                            placeholder={!canEdit ? 'N/A' : 'Max'}
                            onChange={(e) => setForm({ ...form, [f.maxKey]: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-blue-200 disabled:bg-slate-50 disabled:text-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                          />
                        </div>
                      );
                    })}
                    {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && !isThresholdEditing && (
                      <div className="text-[10px] text-blue-500 font-medium px-2">
                        * Click the "Edit" button to change threshold values.
                      </div>
                    )}

                    {/* Threshold Chat Box */}
                    <div className="mt-6 pt-6 border-t border-blue-100">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                          Threshold Discussion Board
                        </h5>
                        <button
                          type="button"
                          onClick={() => fetchChatMessages()}
                          className="p-1.5 hover:bg-blue-100/50 rounded-lg text-blue-600 transition-colors cursor-pointer"
                          title="Refresh chat"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Chat Message List */}
                      <div className="bg-white/80 rounded-xl p-3 border border-blue-100 max-h-56 overflow-y-auto space-y-2.5 mb-3">
                        {isLoadingChat ? (
                          <div className="text-center py-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            Loading discussion...
                          </div>
                        ) : chatMessages.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400 italic">
                            No messages yet. Send a message to discuss these threshold settings.
                          </div>
                        ) : (
                          chatMessages.map((msg) => {
                            const isMe = String(msg.author_id) === String(user.id);
                            return (
                              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-center gap-1.5 mb-0.5 text-[10px]">
                                  <span className="font-extrabold text-slate-700">{msg.author_name}</span>
                                  <span className="text-slate-400">
                                    {format(new Date(msg.created_at), 'MMM dd, HH:mm')}
                                  </span>
                                </div>
                                <div className={`px-3 py-1.5 rounded-lg text-xs max-w-[85%] break-words font-medium shadow-sm ${
                                  isMe 
                                    ? 'bg-blue-600 text-white rounded-tr-none font-semibold' 
                                    : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                                }`}>
                                  {msg.message_text}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Chat Message Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={form.vessel_id ? "Type a message regarding thresholds..." : "Select a vessel to chat"}
                          disabled={!form.vessel_id || isSendingMessage}
                          value={newChatMessage}
                          onChange={(e) => setNewChatMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendChatMessage();
                          }}
                          className="flex-1 px-3 py-2 text-xs bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none font-bold placeholder:font-normal placeholder:text-slate-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendChatMessage()}
                          disabled={!form.vessel_id || isSendingMessage || !newChatMessage.trim()}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm border border-blue-700"
                        >
                          {isSendingMessage ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Weather Conditions Section */}
            <div className="border-t border-slate-100 pt-8 mt-6">
              <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                <Waves className="w-4 h-4 text-blue-600" />
                Weather Conditions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Weather Notation dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Weather Notation</label>
                  <select
                    value={form.weather_notation}
                    onChange={(e) => setForm({ ...form, weather_notation: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="">Select Weather Notation</option>
                    <option value="Blue Sky (Cloud 0~2)">Blue Sky (Cloud 0~2)</option>
                    <option value="Fine but Cloudy (Cloud 3~7)">Fine but Cloudy (Cloud 3~7)</option>
                    <option value="Cloudy (8~10)">Cloudy (8~10)</option>
                    <option value="Drizzling rain">Drizzling rain</option>
                    <option value="Fog">Fog</option>
                    <option value="Gloom">Gloom</option>
                    <option value="Hail">Hail</option>
                    <option value="Lightning">Lightning</option>
                    <option value="Mist">Mist</option>
                    <option value="Overcast (Cloud 10)">Overcast (Cloud 10)</option>
                    <option value="Passing Showers">Passing Showers</option>
                    <option value="Squalls">Squalls</option>
                    <option value="Rain">Rain</option>
                    <option value="Snow">Snow</option>
                    <option value="Thunder">Thunder</option>
                    <option value="Ugly threatening wr.">Ugly threatening wr.</option>
                    <option value="Visibility">Visibility</option>
                    <option value="Dew">Dew</option>
                    <option value="Haze">Haze</option>
                  </select>
                </div>

                {/* Swell Scale21 dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Swell Scale</label>
                  <select
                    value={form.swell_scale_21}
                    onChange={(e) => setForm({ ...form, swell_scale_21: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="">Select Swell Scale</option>
                    <option value="No Swell">No Swell</option>
                    <option value="Low Swell - Short or Average">Low Swell - Short or Average</option>
                    <option value="Low Swell - Long">Low Swell - Long</option>
                    <option value="Moderate - Short">Moderate - Short</option>
                    <option value="Moderate - Average">Moderate - Average</option>
                    <option value="Moderate - Long">Moderate - Long</option>
                    <option value="Heavy Swell - Short">Heavy Swell - Short</option>
                    <option value="Heavy Swell - Average">Heavy Swell - Average</option>
                    <option value="Heavy Swell - Long">Heavy Swell - Long</option>
                    <option value="Confused Swell">Confused Swell</option>
                  </select>
                </div>

                {/* Wind Scale dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Wind Scale</label>
                  <select
                    value={form.wind_scale}
                    onChange={(e) => setForm({ ...form, wind_scale: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="">Select Wind Scale</option>
                    <option value="Calm 0~0.2m/sec">Calm 0~0.2m/sec</option>
                    <option value="Light Air 0.3~1.5m/sec">Light Air 0.3~1.5m/sec</option>
                    <option value="Light Breeze 1.6~3.3m/sec">Light Breeze 1.6~3.3m/sec</option>
                    <option value="Gentle Breeze 3.4~5.4m/sec">Gentle Breeze 3.4~5.4m/sec</option>
                    <option value="Moderate Breeze 5.5~7.9m/sec">Moderate Breeze 5.5~7.9m/sec</option>
                    <option value="Fresh Breeze 8.0~10.7m/sec">Fresh Breeze  8.0~10.7m/sec</option>
                    <option value="Strong Breeze 10.8~13.8m/sec">Strong Breeze 10.8~13.8m/sec</option>
                    <option value="Near Gale 13.9~17.1m/sec">Near Gale 13.9~17.1m/sec</option>
                    <option value="Gale 17.2 ~24.4m/sec">Gale 17.2 ~24.4m/sec</option>
                    <option value="Strong Gale 20.8~24.4m/sec">Strong Gale 20.8~24.4m/sec</option>
                    <option value="Storm 24.5 ~ 28.4m/sec">Storm 24.5 ~ 28.4m/sec</option>
                    <option value="Violent Storm 28.5~32.6m/sec">Violent Storm 28.5~32.6m/sec</option>
                    <option value="Hurricane 32.7m/sec">Hurricane 32.7m/sec</option>
                  </select>
                </div>

                {/* Wave Scale dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Wave Scale</label>
                  <select
                    value={form.wave_scale}
                    onChange={(e) => setForm({ ...form, wave_scale: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="">Select Wave Scale</option>
                    <option value="Calm (Classy)">Calm (Classy)</option>
                    <option value="Calm (Rippled)">Calm (Rippled)</option>
                    <option value="Smooth (Wavelets)">Smooth (Wavelets)</option>
                    <option value="Slight">Slight</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Rough">Rough</option>
                    <option value="Very rough">Very rough</option>
                    <option value="High">High</option>
                    <option value="Very High">Very High</option>
                    <option value="Phenomenal">Phenomenal</option>
                  </select>
                </div>
              </div>

              {/* Weather Photo component */}
              <div className="mt-6 bg-slate-50/20 border border-slate-100 p-5 rounded-2xl">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Weather Conditions Photo (Optional)</label>
                {form.weather_image ? (
                  <div className="relative inline-block rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white p-1.5 transition-all">
                    <img 
                      src={form.weather_image} 
                      className="max-h-64 rounded-xl object-contain" 
                      alt="Weather Conditions Photo" 
                      referrerPolicy="no-referrer" 
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, weather_image: '' })}
                      className="absolute top-4 right-4 p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-4 h-4" /> Remove Photo
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-start max-w-xl">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-100/50 hover:border-blue-400/50 transition-all">
                      <div className="flex flex-col items-center justify-center pt-4 pb-4 px-4 text-center">
                        <Camera className="w-8 h-8 text-blue-500 mb-2" />
                        <p className="text-sm font-bold text-slate-700">Click to upload weather snapshot</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, JPEG, WEBP up to 5MB</p>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0];
                          if (selectedFile) {
                            if (selectedFile.size > 5 * 1024 * 1024) {
                              alert("File is too large! Maximum limit is 5MB.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setForm(prev => ({ ...prev, weather_image: reader.result as string }));
                            };
                            reader.readAsDataURL(selectedFile);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t border-slate-100">
              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl text-base font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-200 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Submit Noon Report
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end px-6">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter Vessel:</label>
              <select 
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="">All Vessels</option>
                {vessels.map(v => (
                  <option key={v.id} value={String(v.id)}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="px-6 py-4">Date & Time (UTC)</th>
                    <th className="px-6 py-4">Vessel</th>
                    <th className="px-6 py-4">Voyage</th>
                    <th className="px-6 py-4">Position</th>
                    <th className="px-6 py-4">Destination</th>
                    <th className="px-6 py-4">ETA (UTC)</th>
                    <th className="px-6 py-4">Agent</th>
                    <th className="px-6 py-4">DTG</th>
                    <th className="px-6 py-4">Cargo</th>
                    <th className="px-6 py-4">Weather</th>
                    <th className="px-6 py-4 animate-pulse-subtle">Remarks</th>
                    <th className="px-6 py-4">HSFO ROB</th>
                    <th className="px-6 py-4">Daily FOC (HSFO)</th>
                    <th className="px-6 py-4">Attachment</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-sm">
                  {filteredReports.map(report => (
                  <tr key={report.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono">{format(parseISO(report.utc_date_time), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 font-bold">{report.vessel_name}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{report.voyage_number || '-'}</td>
                    <td className="px-6 py-4 font-mono text-xs">{report.position_lat} / {report.position_long}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{report.destination_port || '-'}</td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {report.eta_utc ? format(parseISO(report.eta_utc), 'MMM dd, HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 text-xs max-w-[150px] truncate" title={report.agent_details || ''}>
                      {report.agent_details || '-'}
                    </td>
                    <td className="px-6 py-4">{report.distance_to_go} nm</td>
                    <td className="px-6 py-4 uppercase text-[10px] font-bold text-slate-500">{report.cargo_status}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {report.weather_image && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(report.weather_image || null)}
                            className="relative group cursor-pointer flex-shrink-0"
                            title="Click to view full photo"
                          >
                            <img 
                              src={report.weather_image} 
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 group-hover:border-blue-500 transition-all shadow-sm"
                              alt="Weather thumbnail"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 rounded-lg transition-all" />
                          </button>
                        )}
                        {report.weather_notation ? (
                          <div className="space-y-0.5 max-w-[150px]">
                            <div className="text-xs font-semibold text-slate-800 truncate" title={`Notation: ${report.weather_notation}`}>
                              {report.weather_notation}
                            </div>
                            {(report.wind_scale || report.swell_scale_21 || report.wave_scale) && (
                              <div className="text-[10px] text-slate-400 font-medium truncate" title={`Swell: ${report.swell_scale_21 || ''} | Wind: ${report.wind_scale || ''} | Wave: ${report.wave_scale || ''}`}>
                                {report.wind_scale ? `${report.wind_scale.split(' ')[0]}` : ''}
                                {report.swell_scale_21 ? ` • ${report.swell_scale_21.split(' ')[0]}` : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          !report.weather_image && <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-[150px] truncate" title={report.remarks || ''}>
                      {report.remarks || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{report.rob_hsfo}</td>
                    <td className={`px-6 py-4 font-mono font-bold ${
                      isFocOutsideLimits(String(report.foc_hsfo), report.charterer_min_hsfo, report.charterer_max_hsfo)
                        ? 'text-red-600'
                        : 'text-blue-600'
                    }`} title={isFocOutsideLimits(String(report.foc_hsfo), report.charterer_min_hsfo, report.charterer_max_hsfo) ? `Outside Charterer Threshold (${report.charterer_min_hsfo || 'N/A'} - ${report.charterer_max_hsfo || 'N/A'})` : `Charterer Threshold: ${report.charterer_min_hsfo || 'N/A'} - ${report.charterer_max_hsfo || 'N/A'}`}>
                      -{report.foc_hsfo}
                    </td>
                    <td className="px-6 py-4">
                      {report.attachment_id && (
                        <a 
                          href={new URL(`/api/noon-attachments/${report.attachment_id}?token=${token}`, window.location.href).href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-blue-600 hover:underline font-bold"
                        >
                          <FileText className="w-4 h-4" />
                          {report.attachment_name || 'View Report'}
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {canEditReport(report) && (
                          <button 
                            onClick={() => handleEdit(report)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Report"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                          <button 
                            onClick={() => handleDelete(report.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Noon to Noon Reports...</span>
                      </div>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No noon reports found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

    {previewImage && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in">
        <div className="relative bg-white max-w-4xl w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center border-b border-slate-800">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Waves className="w-5 h-5 text-blue-400" />
              Weather Conditions Snapshot
            </h3>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="p-1.5 hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-y-auto">
            <img 
              src={previewImage} 
              className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md" 
              alt="Full Weather Snapshot" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="bg-slate-50 px-6 py-4 flex justify-end">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-all cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

const OtherReportView = ({ user, token, vessels, reports, onRefresh, notify, isLoading }: { 
  user: User, 
  token: string, 
  vessels: Vessel[], 
  reports: OtherReport[],
  onRefresh: () => void,
  notify: (type: 'success' | 'error', message: string) => void,
  isLoading?: boolean
}) => {
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const defaultForm = {
    vessel_id: String(user.vessel_id || ''),
    voyage_number: '',
    utc_date_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    port: '',
    eu_uk_status: 'No',
    position_long: '',
    position_lat: '',
    operation_type: 'LOADING',
    cargo_status: 'ballast',
    rob_type: 'Drop Anchor',
    rob_hsfo: '0',
    rob_lsfo: '0',
    rob_mgo: '0',
    rob_mdo: '0',
    rob_fw: '0'
  };
  const [form, setForm] = useState(defaultForm);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [vesselFilter, setVesselFilter] = useState<string>('');

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => vesselFilter === '' || String(r.vessel_id) === vesselFilter);
  }, [reports, vesselFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingId ? `/api/other-reports/${editingId}` : '/api/other-reports';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...form,
          utc_date_time: form.utc_date_time.replace('T', ' ')
        })
      });

      if (res.ok) {
        notify('success', `Other report ${editingId ? 'updated' : 'submitted'} successfully`);
        setForm(defaultForm);
        setEditingId(null);
        onRefresh();
        setActiveTab('history');
      } else {
        const error = await res.json();
        notify('error', error.error || `Failed to ${editingId ? 'update' : 'submit'} report`);
      }
    } catch (err) {
      notify('error', 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const isLatestReport = (report: OtherReport) => {
    const vesselReports = (reports || []).filter(r => r.vessel_id === report.vessel_id);
    if (vesselReports.length === 0) return false;
    const sorted = [...vesselReports].sort((a, b) => {
      const timeB = new Date(b.utc_date_time).getTime();
      const timeA = new Date(a.utc_date_time).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id - a.id;
    });
    return sorted[0]?.id === report.id;
  };

  const canEditReport = (report: OtherReport) => {
    if (user.role !== 'vessel') return true;
    if (!isLatestReport(report)) return false;
    const reportTime = new Date(report.created_at).getTime();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return reportTime >= twentyFourHoursAgo;
  };

  const handleEdit = (report: OtherReport) => {
    setEditingId(report.id);
    setForm({
      vessel_id: String(report.vessel_id),
      voyage_number: report.voyage_number || '',
      utc_date_time: report.utc_date_time.slice(0, 16),
      port: report.port,
      eu_uk_status: report.eu_uk_status,
      position_long: report.position_long,
      position_lat: report.position_lat,
      operation_type: report.operation_type,
      cargo_status: report.cargo_status,
      rob_type: report.rob_type,
      rob_hsfo: String(report.rob_hsfo),
      rob_lsfo: String(report.rob_lsfo),
      rob_mgo: String(report.rob_mgo),
      rob_mdo: String(report.rob_mdo),
      rob_fw: String(report.rob_fw)
    });
    setActiveTab('form');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      const res = await fetch(`/api/other-reports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify('success', 'Report deleted successfully');
        onRefresh();
      } else {
        const error = await res.json();
        notify('error', error.error || 'Failed to delete report');
      }
    } catch (err) {
      notify('error', 'Connection error');
    }
  };

  const selectedVesselName = vessels.find(v => String(v.id) === String(form.vessel_id))?.name || 'Unknown Vessel';

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Other Report</h1>
          <p className="text-slate-500">Submit and track other vessel events.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button 
            onClick={() => { setActiveTab('form'); setEditingId(null); setForm(defaultForm); }}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              activeTab === 'form' && !editingId
                ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            New Report
          </button>
          {editingId && (
            <div className="px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700 mx-1">
              Editing: {editingId}
            </div>
          )}
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              activeTab === 'history' 
                ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            History
          </button>
        </div>
      </header>

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Vessel</label>
                    <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900">
                      {selectedVesselName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Voyage Number</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. V-001"
                      value={form.voyage_number}
                      onChange={(e) => setForm({ ...form, voyage_number: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">UTC Date & Time</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={form.utc_date_time}
                      onChange={(e) => setForm({ ...form, utc_date_time: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Port</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Enter port name"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Longitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 121.0 E"
                      value={form.position_long}
                      onChange={(e) => setForm({ ...form, position_long: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Latitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 14.5 N"
                      value={form.position_lat}
                      onChange={(e) => setForm({ ...form, position_lat: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">EU/UK Status</label>
                    <select 
                      value={form.eu_uk_status}
                      onChange={(e) => setForm({ ...form, eu_uk_status: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="No">No</option>
                      <option value="EU">EU</option>
                      <option value="UK">UK</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Operation Type</label>
                    <select 
                      value={form.operation_type}
                      onChange={(e) => setForm({ ...form, operation_type: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="LOADING">LOADING</option>
                      <option value="DISCHARGING">DISCHARGING</option>
                      <option value="BUNKERING">BUNKERING</option>
                      <option value="ship-to-ship cargo operation">SHIP-TO-SHIP CARGO OPERATION</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Cargo Status</label>
                    <select 
                      value={form.cargo_status}
                      onChange={(e) => setForm({ ...form, cargo_status: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="ballast">BALLAST</option>
                      <option value="laden">LADEN</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ROB Event Type</label>
                  <select 
                    value={form.rob_type}
                    onChange={(e) => setForm({ ...form, rob_type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="Drop Anchor">Drop Anchor</option>
                    <option value="Anchor Aweigh">Anchor Aweigh</option>
                    <option value="Start Drifting">Start Drifting</option>
                    <option value="End Drifting">End Drifting</option>
                    <option value="POB">POB</option>
                    <option value="P. OFF">P. OFF</option>
                    <option value="Start Shifting">Start Shifting</option>
                    <option value="End Shifting">End Shifting</option>
                  </select>
                </div>

                <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Fuel Statistics & Consumption
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                      <span>Fuel Type</span>
                      <span>ROB</span>
                    </div>
                    {[
                      { key: 'hsfo', label: 'HSFO', rob: 'rob_hsfo' },
                      { key: 'lsfo', label: 'LSFO', rob: 'rob_lsfo' },
                      { key: 'mgo', label: 'MGO', rob: 'rob_mgo' },
                      { key: 'mdo', label: 'MDO', rob: 'rob_mdo' },
                    ].map(f => (
                      <div key={f.key} className="grid grid-cols-2 gap-4 items-center">
                        <span className="text-sm font-bold text-slate-700">{f.label}</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={(form as any)[f.rob]}
                          onChange={(e) => setForm({ ...form, [f.rob]: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                        />
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-4 items-center pt-2 border-t border-blue-100">
                      <span className="text-sm font-bold text-slate-700">FW</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={form.rob_fw}
                        onChange={(e) => setForm({ ...form, rob_fw: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t border-slate-100">
              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl text-base font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-200 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Submit Other Report
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end px-6">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter Vessel:</label>
              <select 
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="">All Vessels</option>
                {vessels.map(v => (
                  <option key={v.id} value={String(v.id)}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="px-6 py-4">Date & Time (UTC)</th>
                    <th className="px-6 py-4">Vessel</th>
                    <th className="px-6 py-4">Voyage</th>
                    <th className="px-6 py-4">Port</th>
                    <th className="px-6 py-4">EU/UK Status</th>
                    <th className="px-6 py-4">Operation</th>
                    <th className="px-6 py-4">Event Type</th>
                    <th className="px-6 py-4">HSFO ROB</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-sm">
                  {filteredReports.map(report => (
                  <tr key={report.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono">{format(parseISO(report.utc_date_time), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 font-bold">{report.vessel_name}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{report.voyage_number || '-'}</td>
                    <td className="px-6 py-4">{report.port}</td>
                    <td className="px-6 py-4 uppercase text-[10px] font-bold text-slate-500">{report.eu_uk_status}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">
                        {report.operation_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">{report.rob_type}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{report.rob_hsfo}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEditReport(report) && (
                          <button 
                            onClick={() => handleEdit(report)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Report"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                          <button 
                            onClick={() => handleDelete(report.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Marine Voyage Reports...</span>
                      </div>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No reports found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

const ArrivalView = ({ user, token, vessels, reports, departureReports, onRefresh, notify, isLoading }: { 
  user: User, 
  token: string, 
  vessels: Vessel[], 
  reports: ArrivalReport[],
  departureReports: DepartureReport[],
  onRefresh: () => void,
  notify: (type: 'success' | 'error', message: string) => void,
  isLoading?: boolean
}) => {
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const defaultForm = {
    vessel_id: String(user.vessel_id || ''),
    voyage_number: '',
    utc_date_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    arrival_port: '',
    eu_uk_status: 'No',
    position_long: '',
    position_lat: '',
    operation_type: 'LOADING',
    cargo_status: 'ballast',
    total_time_at_sea: '',
    total_distance: '',
    rob_type: 'EOSP',
    rob_hsfo: '0',
    rob_lsfo: '0',
    rob_mgo: '0',
    rob_mdo: '0',
    rob_fw: '0',
    departure_hsfo: '0',
    departure_lsfo: '0',
    departure_mgo: '0',
    departure_mdo: '0',
    agent_detail: 'FILLIN'
  };
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [vesselFilter, setVesselFilter] = useState<string>('');

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => vesselFilter === '' || String(r.vessel_id) === vesselFilter);
  }, [reports, vesselFilter]);

  useEffect(() => {
    if (departureReports && form.vessel_id && !editingId) {
      const vesselDepartures = departureReports
        .filter(r => String(r.vessel_id) === String(form.vessel_id))
        .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime());

      if (vesselDepartures.length > 0) {
        const latest = vesselDepartures[0];
        
        let timeAtSea = "";
        try {
          const departureDate = new Date(latest.utc_date_time);
          const arrivalDate = new Date(form.utc_date_time);
          
          if (!isNaN(departureDate.getTime()) && !isNaN(arrivalDate.getTime())) {
            const diffMs = arrivalDate.getTime() - departureDate.getTime();
            if (diffMs > 0) {
              const decimalHours = diffMs / (1000 * 60 * 60);
              timeAtSea = `${decimalHours.toFixed(1)}h`;
            }
          }
        } catch (e) {
          console.error("Error computing time at sea:", e);
        }

        setForm(prev => ({
          ...prev,
          departure_hsfo: String(latest.rob_hsfo),
          departure_lsfo: String(latest.rob_lsfo),
          departure_mgo: String(latest.rob_mgo),
          departure_mdo: String(latest.rob_mdo),
          total_time_at_sea: timeAtSea || prev.total_time_at_sea
        }));
      }
    }
  }, [form.vessel_id, form.utc_date_time, departureReports, editingId]);

  const foc_computation = React.useMemo(() => {
    const departure = {
      hsfo: parseFloat(form.departure_hsfo) || 0,
      lsfo: parseFloat(form.departure_lsfo) || 0,
      mgo: parseFloat(form.departure_mgo) || 0,
      mdo: parseFloat(form.departure_mdo) || 0,
    };
    const arrival = {
      hsfo: parseFloat(form.rob_hsfo) || 0,
      lsfo: parseFloat(form.rob_lsfo) || 0,
      mgo: parseFloat(form.rob_mgo) || 0,
      mdo: parseFloat(form.rob_mdo) || 0,
    };
    return {
      hsfo: Math.max(0, departure.hsfo - arrival.hsfo).toFixed(2),
      lsfo: Math.max(0, departure.lsfo - arrival.lsfo).toFixed(2),
      mgo: Math.max(0, departure.mgo - arrival.mgo).toFixed(2),
      mdo: Math.max(0, departure.mdo - arrival.mdo).toFixed(2),
    };
  }, [form]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingId ? `/api/arrival-reports/${editingId}` : '/api/arrival-reports';
      const method = editingId ? 'PUT' : 'POST';
      
      if (!file && !editingId) {
        notify('error', 'Please attach the scanned ROB report');
        setLoading(false);
        return;
      }
      
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'utc_date_time') {
          formData.append(key, String(val).replace('T', ' '));
        } else {
          formData.append(key, String(val));
        }
      });
      
      formData.append('foc_sea_hsfo', foc_computation.hsfo);
      formData.append('foc_sea_lsfo', foc_computation.lsfo);
      formData.append('foc_sea_mgo', foc_computation.mgo);
      formData.append('foc_sea_mdo', foc_computation.mdo);

      if (file) {
        formData.append('report_file', file);
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        notify('success', `Arrival report ${editingId ? 'updated' : 'submitted'} successfully`);
        setForm(defaultForm);
        setFile(null);
        setEditingId(null);
        onRefresh();
        setActiveTab('history');
      } else {
        const error = await res.json();
        notify('error', error.error || `Failed to ${editingId ? 'update' : 'submit'} report`);
      }
    } catch (err) {
      notify('error', 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const isLatestReport = (report: ArrivalReport) => {
    const vesselReports = (reports || []).filter(r => r.vessel_id === report.vessel_id);
    if (vesselReports.length === 0) return false;
    const sorted = [...vesselReports].sort((a, b) => {
      const timeB = new Date(b.utc_date_time).getTime();
      const timeA = new Date(a.utc_date_time).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id - a.id;
    });
    return sorted[0]?.id === report.id;
  };

  const canEditReport = (report: ArrivalReport) => {
    if (user.role !== 'vessel') return true;
    if (!isLatestReport(report)) return false;
    const reportTime = new Date(report.created_at).getTime();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return reportTime >= twentyFourHoursAgo;
  };

  const handleEdit = (report: ArrivalReport) => {
    setEditingId(report.id);
    setForm({
      vessel_id: String(report.vessel_id),
      voyage_number: report.voyage_number || '',
      utc_date_time: report.utc_date_time.slice(0, 16),
      arrival_port: report.arrival_port,
      eu_uk_status: report.eu_uk_status,
      position_long: report.position_long,
      position_lat: report.position_lat,
      operation_type: report.operation_type,
      cargo_status: report.cargo_status,
      total_time_at_sea: report.total_time_at_sea,
      total_distance: report.total_distance,
      rob_type: report.rob_type,
      rob_hsfo: String(report.rob_hsfo),
      rob_lsfo: String(report.rob_lsfo),
      rob_mgo: String(report.rob_mgo),
      rob_mdo: String(report.rob_mdo),
      rob_fw: String(report.rob_fw),
      departure_hsfo: String(report.rob_hsfo + report.foc_sea_hsfo), // Approx from report
      departure_lsfo: String(report.rob_lsfo + report.foc_sea_lsfo),
      departure_mgo: String(report.rob_mgo + report.foc_sea_mgo),
      departure_mdo: String(report.rob_mdo + report.foc_sea_mdo),
      agent_detail: report.agent_detail
    });
    setActiveTab('form');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      const res = await fetch(`/api/arrival-reports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify('success', 'Report deleted successfully');
        onRefresh();
      } else {
        const error = await res.json();
        notify('error', error.error || 'Failed to delete report');
      }
    } catch (err) {
      notify('error', 'Connection error');
    }
  };

  const currentVessel = vessels.find(v => String(v.id) === String(form.vessel_id));
  const selectedVesselName = currentVessel?.name || 'Unknown Vessel';

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Arrival</h1>
          <p className="text-slate-500">Submit and track vessel arrival reports.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button 
            onClick={() => { setActiveTab('form'); setEditingId(null); setForm(defaultForm); }}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              activeTab === 'form' && !editingId
                ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            New Report
          </button>
          {editingId && (
            <div className="px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700 mx-1">
              Editing: {editingId}
            </div>
          )}
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              activeTab === 'history' 
                ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            History
          </button>
        </div>
      </header>

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Vessel</label>
                    <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900">
                      {selectedVesselName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Voyage Number</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. V-001"
                      value={form.voyage_number}
                      onChange={(e) => setForm({ ...form, voyage_number: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">UTC Date & Time</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={form.utc_date_time}
                      onChange={(e) => setForm({ ...form, utc_date_time: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Arrival Port</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Enter port name"
                      value={form.arrival_port}
                      onChange={(e) => setForm({ ...form, arrival_port: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Longitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 121.0 E"
                      value={form.position_long}
                      onChange={(e) => setForm({ ...form, position_long: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Latitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 14.5 N"
                      value={form.position_lat}
                      onChange={(e) => setForm({ ...form, position_lat: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">EU/UK Status</label>
                    <select 
                      value={form.eu_uk_status}
                      onChange={(e) => setForm({ ...form, eu_uk_status: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="No">No</option>
                      <option value="EU">EU</option>
                      <option value="UK">UK</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Operation Type</label>
                    <select 
                      value={form.operation_type}
                      onChange={(e) => setForm({ ...form, operation_type: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="LOADING">LOADING</option>
                      <option value="DISCHARGING">DISCHARGING</option>
                      <option value="BUNKERING">BUNKERING</option>
                      <option value="ship-to-ship cargo operation">SHIP-TO-SHIP CARGO OPERATION</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Cargo Status</label>
                    <select 
                      value={form.cargo_status}
                      onChange={(e) => setForm({ ...form, cargo_status: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="ballast">BALLAST</option>
                      <option value="laden">LADEN</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Time at Sea</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 12d 5h"
                      value={form.total_time_at_sea}
                      onChange={(e) => setForm({ ...form, total_time_at_sea: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Distance (nm)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 3500"
                      value={form.total_distance}
                      onChange={(e) => setForm({ ...form, total_distance: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Agent Detail Status</label>
                  <select 
                    value={form.agent_detail === 'TBA' ? 'TBA' : 'FILLIN'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm({ ...form, agent_detail: val === 'TBA' ? 'TBA' : '' });
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="FILLIN">FILLIN (Enter Details)</option>
                    <option value="TBA">TBA</option>
                  </select>
                </div>

                {form.agent_detail !== 'TBA' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Agent Details</label>
                    <textarea 
                      placeholder="Paste agent contact details here..."
                      value={form.agent_detail === 'FILLIN' ? '' : form.agent_detail}
                      onChange={(e) => setForm({ ...form, agent_detail: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ROB Event Type</label>
                  <select 
                    value={form.rob_type}
                    onChange={(e) => setForm({ ...form, rob_type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="EOSP">EOSP</option>
                    <option value="dropanchore">DROP ANCHOR</option>
                    <option value="fistline">FIRST LINE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Scanned ROB Report</label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-100/50 transition-colors">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-700">{file ? file.name : 'Upload Report'}</span>
                      <input type="file" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f && f.size > MAX_FILE_SIZE) {
                          notify('error', 'File is too large (max 20MB)');
                          e.target.value = '';
                          return;
                        }
                        setFile(f);
                      }} />
                    </label>
                    {file && (
                      <button onClick={() => setFile(null)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Fuel Statistics & Consumption (At Sea)
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                      <span>Fuel Type</span>
                      <span>Dep. ROB</span>
                      <div>
                        <span>Arr. ROB / Consumption based on previous report ROB</span>
                        {currentVessel && (
                          <span className="block text-blue-600 text-[9px] font-bold mt-0.5 normal-case tracking-normal">
                            Vessel Limit: {currentVessel.min_fuel_consumption || 'N/A'} - {currentVessel.max_fuel_consumption || 'N/A'}
                          </span>
                        )}
                      </div>
                    </div>
                    {[
                      { key: 'hsfo', label: 'HSFO', departure: 'departure_hsfo', rob: 'rob_hsfo' },
                      { key: 'lsfo', label: 'LSFO', departure: 'departure_lsfo', rob: 'rob_lsfo' },
                      { key: 'mgo', label: 'MGO', departure: 'departure_mgo', rob: 'rob_mgo' },
                      { key: 'mdo', label: 'MDO', departure: 'departure_mdo', rob: 'rob_mdo' },
                    ].map(f => (
                      <div key={f.key} className="grid grid-cols-3 gap-4 items-center">
                        <span className="text-sm font-bold text-slate-700">{f.label}</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={(form as any)[f.departure]}
                          onChange={(e) => setForm({ ...form, [f.departure]: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            step="0.01"
                            value={(form as any)[f.rob]}
                            onChange={(e) => setForm({ ...form, [f.rob]: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                          />
                          <div 
                            className={`w-20 px-2 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center whitespace-nowrap ${
                              isFocOutsideLimits((foc_computation as any)[f.key], currentVessel?.min_fuel_consumption, currentVessel?.max_fuel_consumption)
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                            title={`Consumption based on previous report ROB (Vessel Limit: ${currentVessel?.min_fuel_consumption || 'N/A'} - ${currentVessel?.max_fuel_consumption || 'N/A'})`}
                          >
                            {(foc_computation as any)[f.key]}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-3 gap-4 items-center pt-2 border-t border-blue-100">
                      <span className="text-sm font-bold text-slate-700">FW</span>
                      <div />
                      <input 
                        type="number" 
                        step="0.01"
                        value={form.rob_fw}
                        onChange={(e) => setForm({ ...form, rob_fw: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t border-slate-100">
              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl text-base font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-200 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Submit Arrival Report
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end px-6">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter Vessel:</label>
              <select 
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="">All Vessels</option>
                {vessels.map(v => (
                  <option key={v.id} value={String(v.id)}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="px-6 py-4">Date & Time (UTC)</th>
                    <th className="px-6 py-4">Vessel</th>
                    <th className="px-6 py-4">Voyage</th>
                    <th className="px-6 py-4">Port</th>
                    <th className="px-6 py-4">EU/UK Status</th>
                    <th className="px-6 py-4">Sea Time</th>
                    <th className="px-6 py-4">Distance</th>
                    <th className="px-6 py-4">HSFO Arrival</th>
                    <th className="px-6 py-4">FOC Sea</th>
                    <th className="px-6 py-4">Agent Detail</th>
                    <th className="px-6 py-4">Attachment</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-sm">
                  {filteredReports.map(report => (
                  <tr key={report.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono">{format(parseISO(report.utc_date_time), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 font-bold">{report.vessel_name}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{report.voyage_number || '-'}</td>
                    <td className="px-6 py-4">{report.arrival_port}</td>
                    <td className="px-6 py-4 uppercase text-[10px] font-bold text-slate-500">{report.eu_uk_status}</td>
                    <td className="px-6 py-4">{report.total_time_at_sea}</td>
                    <td className="px-6 py-4">{report.total_distance} nm</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{report.rob_hsfo}</td>
                    <td className="px-6 py-4 font-mono text-blue-600">-{report.foc_sea_hsfo}</td>
                    <td className="px-6 py-4">
                      <span className="truncate max-w-[150px] block" title={report.agent_detail}>
                        {report.agent_detail}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {report.attachment_id && (
                        <a 
                          href={new URL(`/api/arrival-attachments/${report.attachment_id}?token=${token}`, window.location.href).href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-blue-600 hover:underline font-bold"
                        >
                          <FileText className="w-4 h-4" />
                          {report.attachment_name || 'View Report'}
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEditReport(report) && (
                          <button 
                            onClick={() => handleEdit(report)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Report"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                          <button 
                            onClick={() => handleDelete(report.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Vessel Arrival Reports...</span>
                      </div>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No arrival reports found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

const RecycleBinView = ({ token, notify }: { token: string, notify: (type: 'success' | 'error' | 'info', message: string) => void }) => {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('vessels');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/recycle-bin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        notify('error', 'Failed to fetch recycle bin items');
      }
    } catch (e) {
      notify('error', 'Failed to fetch recycle bin items');
    } finally {
      setLoading(false);
    }
  }, [token, notify]);

  useEffect(() => {
    fetchDeleted();
  }, [fetchDeleted]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const handleRestore = async (type: string, idOrIds: number | number[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;
    try {
      const res = await fetch('/api/admin/recycle-bin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, ids })
      });
      if (res.ok) {
        notify('success', `Successfully restored ${ids.length} item(s)`);
        setSelectedIds(prev => prev.filter(selected => !ids.includes(selected)));
        fetchDeleted();
      } else {
        const error = await res.json();
        notify('error', error.error || 'Failed to restore item(s)');
      }
    } catch (e) {
      notify('error', 'Failed to restore item(s)');
    }
  };

  const handlePermanentDelete = async (type: string, idOrIds: number | number[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;
    
    const message = ids.length === 1 
      ? 'Are you sure you want to PERMANENTLY delete this item? This cannot be undone.'
      : `Are you sure you want to PERMANENTLY delete these ${ids.length} items? This cannot be undone.`;
      
    if (!window.confirm(message)) return;
    
    try {
      const res = await fetch('/api/admin/recycle-bin/permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, ids })
      });
      if (res.ok) {
        notify('success', `Permanently deleted ${ids.length} item(s)`);
        setSelectedIds(prev => prev.filter(selected => !ids.includes(selected)));
        fetchDeleted();
      } else {
        const error = await res.json();
        notify('error', error.error || 'Failed to delete item(s) permanently');
      }
    } catch (e) {
      notify('error', 'Failed to delete item(s) permanently');
    }
  };

  const tabs = [
    { id: 'vessels', label: 'Vessels', icon: Ship },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'certificates', label: 'Certificates/Service Reports', icon: FileText },
    { id: 'files', label: 'Files', icon: File },
    { id: 'departure_reports', label: 'Departure', icon: Navigation },
    { id: 'arrival_reports', label: 'Arrival', icon: MapIcon },
    { id: 'noon_reports', label: 'Noon', icon: Clock },
    { id: 'other_reports', label: 'Other', icon: File },
    { id: 'fuel_analysis_reports', label: 'Fuel Analysis', icon: Fuel },
    { id: 'lube_oil_ldr_reports', label: 'Lube Oil LDR', icon: FlaskConical },
    { id: 'lube_oil_analysis_reports', label: 'Lube Oil Analysis', icon: FlaskConical },
    { id: 'bunker_bdn_reports', label: 'Bunker BDN', icon: Fuel },
    { id: 'crew_members', label: 'Crew', icon: Users },
    { id: 'audit_records', label: 'Audits', icon: Shield },
    { id: 'non_conformities', label: 'Non-Conformities', icon: AlertTriangle },
    { id: 'trouble_reports', label: 'Trouble Reports', icon: Wrench },
    { id: 'spare_parts_requisitions', label: 'Requisitions', icon: Package }
  ];

  const currentItems = data[activeTab] || [];
  const allCurrentSelected = currentItems.length > 0 && currentItems.every(item => selectedIds.includes(item.id));
  const someCurrentSelected = currentItems.some(item => selectedIds.includes(item.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = [...selectedIds];
      currentItems.forEach(item => {
        if (!newSelected.includes(item.id)) {
          newSelected.push(item.id);
        }
      });
      setSelectedIds(newSelected);
    } else {
      const itemIds = currentItems.map(item => item.id);
      setSelectedIds(prev => prev.filter(id => !itemIds.includes(id)));
    }
  };

  const handleSelectItem = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(itemId => itemId !== id));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Recycle Bin</h1>
          <p className="text-slate-500">View and restore soft-deleted items or permanently remove them from the system.</p>
        </div>
        <button 
          onClick={fetchDeleted}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
        </button>
      </header>

      <div className="flex border-b border-slate-100 gap-1 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = data[tab.id]?.length || 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                activeTab === tab.id 
                  ? "border-blue-600 text-blue-600 bg-blue-50/50" 
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                activeTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-900">{selectedIds.length} item(s) selected</p>
              <p className="text-xs text-blue-600">Choose an action to perform on all selected items in this tab.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => handleRestore(activeTab, selectedIds)}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restore Selected
            </button>
            <button
              onClick={() => handlePermanentDelete(activeTab, selectedIds)}
              className="flex items-center gap-2 px-3.5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" /> Permanently Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition font-bold"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p className="font-medium">Loading deleted items...</p>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <Trash2 className="w-12 h-12 opacity-20" />
            <p className="font-medium text-lg">Your recycle bin for {tabs.find(t => t.id === activeTab)?.label} is empty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 w-12 text-center">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      checked={allCurrentSelected}
                      ref={el => {
                        if (el) {
                          el.indeterminate = someCurrentSelected && !allCurrentSelected;
                        }
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Item Details</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Deleted At</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <tr 
                      key={item.id} 
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors group",
                        isSelected && "bg-blue-50/10"
                      )}
                    >
                      <td className="px-6 py-4 text-center w-12">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          checked={isSelected}
                          onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {activeTab === 'vessels' && item.name}
                            {activeTab === 'users' && item.username}
                            {activeTab === 'certificates' && item.name}
                            {activeTab === 'files' && item.original_name}
                            {activeTab.includes('report') && `${item.vessel_name || 'Generic'} - ${item.voyage_number ? 'Voyage ' + item.voyage_number : 'Report ID ' + item.id}`}
                            {activeTab === 'crew_members' && `${item.first_name || ''} ${item.last_name || ''}`}
                            {activeTab === 'audit_records' && `Audit by ${item.lead_auditor || 'Unknown'}`}
                            {activeTab === 'non_conformities' && `NC - ${item.description ? (item.description.length > 40 ? item.description.substring(0, 40) + '...' : item.description) : 'No Description'}`}
                            {activeTab === 'trouble_reports' && `Trouble: ${item.subject || 'No Subject'}`}
                            {activeTab === 'spare_parts_requisitions' && `Requisition: ${item.requisition_no || 'Requisition ID ' + item.id}`}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {activeTab === 'vessels' && `Owner: ${item.owner}`}
                            {activeTab === 'users' && `Role: ${getRoleLabel(item.role)}`}
                            {activeTab === 'certificates' && `Vessel: ${item.vessel_name || 'Generic'}`}
                            {activeTab === 'files' && `Certificate: ${item.certificate_name}`}
                            {activeTab.includes('report') && (item.utc_date_time || item.date) && `Date: ${format(new Date(item.utc_date_time || item.date), 'MMM dd, yyyy')}`}
                            {activeTab === 'crew_members' && `Rank: ${item.rank || 'N/A'}`}
                            {activeTab === 'audit_records' && `Auditor: ${item.lead_auditor || 'N/A'}`}
                            {activeTab === 'non_conformities' && `Vessel: ${item.vessel_name || 'Generic'}`}
                            {activeTab === 'trouble_reports' && `Category: ${item.category || 'N/A'} | Status: ${item.status || 'N/A'}`}
                            {activeTab === 'spare_parts_requisitions' && `Status: ${item.status || 'N/A'}`}
                            ID: {item.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500 font-medium font-mono">
                          {item.deleted_at ? format(new Date(item.deleted_at), 'MMM dd, yyyy HH:mm') : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleRestore(activeTab, item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
                          >
                            <RefreshCw className="w-3 h-3" /> Restore
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(activeTab, item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" /> Permanent Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};


const VesselRoutingUserView = ({ 
  vessel, 
  form, 
  updating, 
  onUpdateRow, 
  onSave,
  latestOperationType
}: { 
  vessel: Vessel, 
  form: any, 
  updating: boolean, 
  onUpdateRow: (id: number, field: string, value: any) => void,
  onSave: () => void,
  latestOperationType: string
}) => {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Vessel Routing</h1>
          <p className="text-slate-500">Update destination, navigational status, scheduling, and cargo details for your vessel.</p>
        </div>
        <button 
          onClick={onSave}
          disabled={updating}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
        >
          {updating ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Current Changes
        </button>
      </header>

      <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
        {/* Vessel Quick Info Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 p-6 border-b border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
              <Ship className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{vessel.name}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">{vessel.team_name || 'Vessel Fleet'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-blue-50/80">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Live Route Syncing</span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Next Destination / Port Calls</label>
                <div className="relative">
                  <Anchor className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input 
                    type="text"
                    value={form.next_port || ''}
                    onChange={e => onUpdateRow(vessel.id, 'next_port', e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="Enter next port..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Current Navigational Status</label>
                <div className="relative">
                  <Activity className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select 
                    value={form.route_status || ''}
                    onChange={e => onUpdateRow(vessel.id, 'route_status', e.target.value)}
                    className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">SELECT STATUS...</option>
                    <option value="Laden">Laden</option>
                    <option value="Ballast">Ballast</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Operation Type</label>
                <div className="relative">
                  <Activity className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select 
                    value={form.operation_type || ''}
                    onChange={e => onUpdateRow(vessel.id, 'operation_type', e.target.value)}
                    className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">SELECT OPERATION TYPE...</option>
                    <option value="LOADING">LOADING</option>
                    <option value="DISCHARGING">DISCHARGING</option>
                    <option value="BUNKERING">BUNKERING</option>
                    <option value="ship-to-ship cargo operation">SHIP-TO-SHIP CARGO OPERATION</option>
                    <option value="Others">Others</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">ETA / ATB (Arrival Schedule UTC)</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input 
                    type="datetime-local"
                    value={form.eta_atb ? form.eta_atb.replace(' ', 'T').substring(0, 16) : ''}
                    onChange={e => onUpdateRow(vessel.id, 'eta_atb', e.target.value.replace('T', ' '))}
                    className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">ETD / ATD at Arrival (UTC)</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input 
                    type="datetime-local"
                    value={form.etd_atd ? form.etd_atd.replace(' ', 'T').substring(0, 16) : ''}
                    onChange={e => onUpdateRow(vessel.id, 'etd_atd', e.target.value.replace('T', ' '))}
                    className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Cargo Logistics & Operational Remarks</label>
                <div className="relative">
                  <Package className="w-4 h-4 text-slate-400 absolute left-4 top-3 pointer-events-none" />
                  <textarea 
                    value={form.cargo || ''}
                    onChange={e => onUpdateRow(vessel.id, 'cargo', e.target.value)}
                    rows={3}
                    className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none leading-relaxed"
                    placeholder="Describe cargo status and other remarks..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Remark from Vessel</label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-slate-400 absolute left-4 top-3 pointer-events-none" />
                  <textarea 
                    value={form.remark_from_vessel || ''}
                    onChange={e => onUpdateRow(vessel.id, 'remark_from_vessel', e.target.value)}
                    rows={2}
                    className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none leading-relaxed"
                    placeholder="Enter custom remarks or announcements which will scroll across the bottom of the slideshow slide..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Verification Alert Banner */}
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-blue-100 shadow-sm shrink-0">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-xs font-bold text-blue-800/80 leading-relaxed max-w-xl">
                Verification Protocol: Please double-check all destination codes and operational statuses before saving.
              </p>
            </div>
            <button 
              type="button"
              onClick={onSave}
              disabled={updating}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 shadow-sm disabled:opacity-50"
            >
              Update Voyage Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DepartureView = ({ user, token, vessels, reports, onRefresh, notify, isLoading }: { 
  user: User, 
  token: string, 
  vessels: Vessel[], 
  reports: DepartureReport[],
  onRefresh: () => void,
  notify: (type: 'success' | 'error', message: string) => void,
  isLoading?: boolean
}) => {
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const defaultForm = {
    vessel_id: String(user.vessel_id || ''),
    voyage_number: '',
    utc_date_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    departure_port: '',
    eu_uk_status: 'No',
    position_long: '',
    position_lat: '',
    operation_type: 'LOADING',
    cargo_status: 'ballast',
    rob_type: 'lastline',
    rob_hsfo: '0',
    rob_lsfo: '0',
    rob_mgo: '0',
    rob_mdo: '0',
    rob_fw: '0',
    arrival_hsfo: '0',
    arrival_lsfo: '0',
    arrival_mgo: '0',
    arrival_mdo: '0'
  };
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [vesselFilter, setVesselFilter] = useState<string>('');

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => vesselFilter === '' || String(r.vessel_id) === vesselFilter);
  }, [reports, vesselFilter]);

  const foc_computation = React.useMemo(() => {
    const arrival = {
      hsfo: parseFloat(form.arrival_hsfo) || 0,
      lsfo: parseFloat(form.arrival_lsfo) || 0,
      mgo: parseFloat(form.arrival_mgo) || 0,
      mdo: parseFloat(form.arrival_mdo) || 0,
    };
    const departure = {
      hsfo: parseFloat(form.rob_hsfo) || 0,
      lsfo: parseFloat(form.rob_lsfo) || 0,
      mgo: parseFloat(form.rob_mgo) || 0,
      mdo: parseFloat(form.rob_mdo) || 0,
    };
    return {
      hsfo: Math.max(0, arrival.hsfo - departure.hsfo).toFixed(2),
      lsfo: Math.max(0, arrival.lsfo - departure.lsfo).toFixed(2),
      mgo: Math.max(0, arrival.mgo - departure.mgo).toFixed(2),
      mdo: Math.max(0, arrival.mdo - departure.mdo).toFixed(2),
    };
  }, [form]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingId ? `/api/departure-reports/${editingId}` : '/api/departure-reports';
      const method = editingId ? 'PUT' : 'POST';

      if (!file && !editingId) {
        notify('error', 'Please attach the scanned ROB report');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'utc_date_time') {
          formData.append(key, String(val).replace('T', ' '));
        } else {
          formData.append(key, String(val));
        }
      });
      
      // Append computed values as well
      formData.append('foc_port_hsfo', foc_computation.hsfo);
      formData.append('foc_port_lsfo', foc_computation.lsfo);
      formData.append('foc_port_mgo', foc_computation.mgo);
      formData.append('foc_port_mdo', foc_computation.mdo);

      if (file) {
        formData.append('report_file', file);
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        notify('success', `Departure report ${editingId ? 'updated' : 'submitted'} successfully`);
        setForm(defaultForm);
        setFile(null);
        setEditingId(null);
        onRefresh();
        setActiveTab('history');
      } else {
        const error = await res.json();
        notify('error', error.error || `Failed to ${editingId ? 'update' : 'submit'} report`);
      }
    } catch (err) {
      notify('error', 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const isLatestReport = (report: DepartureReport) => {
    const vesselReports = (reports || []).filter(r => r.vessel_id === report.vessel_id);
    if (vesselReports.length === 0) return false;
    const sorted = [...vesselReports].sort((a, b) => {
      const timeB = new Date(b.utc_date_time).getTime();
      const timeA = new Date(a.utc_date_time).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id - a.id;
    });
    return sorted[0]?.id === report.id;
  };

  const canEditReport = (report: DepartureReport) => {
    if (user.role !== 'vessel') return true;
    if (!isLatestReport(report)) return false;
    const reportTime = new Date(report.created_at).getTime();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return reportTime >= twentyFourHoursAgo;
  };

  const handleEdit = (report: DepartureReport) => {
    setEditingId(report.id);
    setForm({
      vessel_id: String(report.vessel_id),
      voyage_number: report.voyage_number || '',
      utc_date_time: report.utc_date_time.slice(0, 16),
      departure_port: report.departure_port,
      eu_uk_status: report.eu_uk_status,
      position_long: report.position_long,
      position_lat: report.position_lat,
      operation_type: report.operation_type,
      cargo_status: report.cargo_status,
      rob_type: report.rob_type,
      rob_hsfo: String(report.rob_hsfo),
      rob_lsfo: String(report.rob_lsfo),
      rob_mgo: String(report.rob_mgo),
      rob_mdo: String(report.rob_mdo),
      rob_fw: String(report.rob_fw),
      arrival_hsfo: String(report.rob_hsfo + report.foc_port_hsfo), // Approx
      arrival_lsfo: String(report.rob_lsfo + report.foc_port_lsfo),
      arrival_mgo: String(report.rob_mgo + report.foc_port_mgo),
      arrival_mdo: String(report.rob_mdo + report.foc_port_mdo)
    });
    setActiveTab('form');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      const res = await fetch(`/api/departure-reports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify('success', 'Report deleted successfully');
        onRefresh();
      } else {
        const error = await res.json();
        notify('error', error.error || 'Failed to delete report');
      }
    } catch (err) {
      notify('error', 'Connection error');
    }
  };

  const currentVessel = vessels.find(v => String(v.id) === String(form.vessel_id));
  const selectedVesselName = currentVessel?.name || 'Unknown Vessel';

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Departure</h1>
          <p className="text-slate-500">Submit and track vessel departure reports.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button 
            onClick={() => { setActiveTab('form'); setEditingId(null); setForm(defaultForm); }}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              activeTab === 'form' && !editingId
                ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            New Report
          </button>
          {editingId && (
            <div className="px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700 mx-1">
              Editing: {editingId}
            </div>
          )}
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              activeTab === 'history' 
                ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            History
          </button>
        </div>
      </header>

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Vessel</label>
                    <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900">
                      {selectedVesselName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Voyage Number</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. V-001"
                      value={form.voyage_number}
                      onChange={(e) => setForm({ ...form, voyage_number: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">UTC Date & Time</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={form.utc_date_time}
                      onChange={(e) => setForm({ ...form, utc_date_time: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Departure Port</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Enter port name"
                      value={form.departure_port}
                      onChange={(e) => setForm({ ...form, departure_port: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Longitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 121.0 E"
                      value={form.position_long}
                      onChange={(e) => setForm({ ...form, position_long: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Latitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 14.5 N"
                      value={form.position_lat}
                      onChange={(e) => setForm({ ...form, position_lat: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">EU/UK Status</label>
                    <select 
                      value={form.eu_uk_status}
                      onChange={(e) => setForm({ ...form, eu_uk_status: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="No">No</option>
                      <option value="EU">EU</option>
                      <option value="UK">UK</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Operation Type</label>
                    <select 
                      value={form.operation_type}
                      onChange={(e) => setForm({ ...form, operation_type: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="LOADING">LOADING</option>
                      <option value="DISCHARGING">DISCHARGING</option>
                      <option value="BUNKERING">BUNKERING</option>
                      <option value="ship-to-ship cargo operation">SHIP-TO-SHIP CARGO OPERATION</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Cargo Status</label>
                    <select 
                      value={form.cargo_status}
                      onChange={(e) => setForm({ ...form, cargo_status: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="ballast">BALLAST</option>
                      <option value="laden">LADEN</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ROB Event Type</label>
                  <select 
                    value={form.rob_type}
                    onChange={(e) => setForm({ ...form, rob_type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="lastline">LAST LINE</option>
                    <option value="anchoraweigh">ANCHOR AWEIGH</option>
                    <option value="sosp">SOSP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Scanned ROB Report</label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-100/50 transition-colors">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-700">{file ? file.name : 'Upload Report'}</span>
                      <input type="file" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f && f.size > MAX_FILE_SIZE) {
                          notify('error', 'File is too large (max 20MB)');
                          e.target.value = '';
                          return;
                        }
                        setFile(f);
                      }} />
                    </label>
                    {file && (
                      <button onClick={() => setFile(null)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Fuel Statistics & Consumption
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                      <span>Fuel Type</span>
                      <span>Arrival ROB</span>
                      <div>
                        <span>Dep. ROB / Consumption based on previous report ROB</span>
                        {currentVessel && (
                          <span className="block text-blue-600 text-[9px] font-bold mt-0.5 normal-case tracking-normal">
                            Vessel Limit: {currentVessel.min_fuel_consumption || 'N/A'} - {currentVessel.max_fuel_consumption || 'N/A'}
                          </span>
                        )}
                      </div>
                    </div>
                    {[
                      { key: 'hsfo', label: 'HSFO', arrival: 'arrival_hsfo', rob: 'rob_hsfo' },
                      { key: 'lsfo', label: 'LSFO', arrival: 'arrival_lsfo', rob: 'rob_lsfo' },
                      { key: 'mgo', label: 'MGO', arrival: 'arrival_mgo', rob: 'rob_mgo' },
                      { key: 'mdo', label: 'MDO', arrival: 'arrival_mdo', rob: 'rob_mdo' },
                    ].map(f => (
                      <div key={f.key} className="grid grid-cols-3 gap-4 items-center">
                        <span className="text-sm font-bold text-slate-700">{f.label}</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={(form as any)[f.arrival]}
                          onChange={(e) => setForm({ ...form, [f.arrival]: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            step="0.01"
                            value={(form as any)[f.rob]}
                            onChange={(e) => setForm({ ...form, [f.rob]: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                          />
                          <div 
                            className={`w-20 px-2 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center whitespace-nowrap ${
                              isFocOutsideLimits((foc_computation as any)[f.key], currentVessel?.min_fuel_consumption, currentVessel?.max_fuel_consumption)
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                            title={`Consumption based on previous report ROB (Vessel Limit: ${currentVessel?.min_fuel_consumption || 'N/A'} - ${currentVessel?.max_fuel_consumption || 'N/A'})`}
                          >
                            {(foc_computation as any)[f.key]}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-3 gap-4 items-center pt-2 border-t border-blue-100">
                      <span className="text-sm font-bold text-slate-700">FW</span>
                      <div />
                      <input 
                        type="number" 
                        step="0.01"
                        value={form.rob_fw}
                        onChange={(e) => setForm({ ...form, rob_fw: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t border-slate-100">
              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl text-base font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-200 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Submit Departure Report
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end px-6">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter Vessel:</label>
              <select 
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="">All Vessels</option>
                {vessels.map(v => (
                  <option key={v.id} value={String(v.id)}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="px-6 py-4">Date & Time (UTC)</th>
                    <th className="px-6 py-4">Vessel</th>
                    <th className="px-6 py-4">Voyage</th>
                    <th className="px-6 py-4">Port</th>
                    <th className="px-6 py-4">EU/UK Status</th>
                    <th className="px-6 py-4">Operation</th>
                    <th className="px-6 py-4">HSFO Departure</th>
                    <th className="px-6 py-4">FOC Port</th>
                    <th className="px-6 py-4">Attachment</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-sm">
                  {filteredReports.map(report => (
                  <tr key={report.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono">{format(parseISO(report.utc_date_time), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 font-bold">{report.vessel_name}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{report.voyage_number || '-'}</td>
                    <td className="px-6 py-4">{report.departure_port}</td>
                    <td className="px-6 py-4 uppercase text-[10px] font-bold text-slate-500">{report.eu_uk_status}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">
                        {report.operation_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{report.rob_hsfo}</td>
                    <td className="px-6 py-4 font-mono text-blue-600">-{report.foc_port_hsfo}</td>
                    <td className="px-6 py-4">
                      {report.attachment_id && (
                        <a 
                          href={new URL(`/api/departure-attachments/${report.attachment_id}?token=${token}`, window.location.href).href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-blue-600 hover:underline font-bold"
                        >
                          <FileText className="w-4 h-4" />
                          {report.attachment_name || 'View Report'}
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {canEditReport(report) && (
                          <button 
                            onClick={() => handleEdit(report)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Report"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                          <button 
                            onClick={() => handleDelete(report.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Vessel Departure Reports...</span>
                      </div>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No departure reports found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

const AdminPanel = ({ 
  token, teams, vessels, certs, setCerts, onRefresh, notify,
  previewFile, setPreviewFile, tempPreviewUrl, setTempPreviewUrl, isRecognizing, setIsRecognizing,
  subView,
  editingVessel, setEditingVessel, editingVesselPhoto, setEditingVesselPhoto, handleUpdateVessel, handleDeleteVessel,
  editingCert, setEditingCert, newCertFile, setNewCertFile, handleUpdateCert, handleDeleteCert,
  confirmDialog, setConfirmDialog,
  uploadFileType, setUploadFileType,
  fetchCertDetails,
  setSelectedVessel,
  flags,
  setFlags
}: { 
  token: string, 
  teams: Team[], 
  vessels: Vessel[], 
  certs: Certificate[],
  setCerts: React.Dispatch<React.SetStateAction<Certificate[]>>,
  onRefresh: () => void,
  notify: (type: 'success' | 'error' | 'info', message: string) => void,
  previewFile: FileData | null,
  setPreviewFile: (file: FileData | null) => void,
  tempPreviewUrl: string | null,
  setTempPreviewUrl: (url: string | null) => void,
  isRecognizing: boolean,
  setIsRecognizing: (val: boolean) => void,
  subView?: string,
  editingVessel: Vessel | null,
  setEditingVessel: (v: Vessel | null) => void,
  editingVesselPhoto: File | null,
  setEditingVesselPhoto: (f: File | null) => void,
  handleUpdateVessel: () => Promise<void>,
  handleDeleteVessel: (id: number) => Promise<void>,
  editingCert: Certificate | null,
  setEditingCert: (c: Certificate | null) => void,
  newCertFile: File | null,
  setNewCertFile: (f: File | null) => void,
  handleUpdateCert: () => Promise<void>,
  handleDeleteCert: (id: number) => Promise<void>,
  confirmDialog: any,
  setConfirmDialog: any,
  uploadFileType: 'certificate' | 'supporting',
  setUploadFileType: (type: 'certificate' | 'supporting') => void,
  fetchCertDetails: (cert: Certificate, isRefresh?: boolean) => Promise<void>,
  setSelectedVessel: (v: Vessel | null) => void,
  flags: VesselFlag[],
  setFlags: React.Dispatch<React.SetStateAction<VesselFlag[]>>
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newVesselName, setNewVesselName] = useState('');
  const [newVesselTeam, setNewVesselTeam] = useState('');
  const [newVesselOwner, setNewVesselOwner] = useState('Nissen');
  const [newVesselFlag, setNewVesselFlag] = useState('');
  const [newVesselType, setNewVesselType] = useState<'Bulk Carrier' | 'Container'>('Bulk Carrier');
  const [newVesselDateBuilt, setNewVesselDateBuilt] = useState('');
  const [newVesselMinFuel, setNewVesselMinFuel] = useState('');
  const [newVesselMaxFuel, setNewVesselMaxFuel] = useState('');
  const [newVesselPhoto, setNewVesselPhoto] = useState<File | null>(null);
  const [newCertName, setNewCertName] = useState('');
  const [newCertVessel, setNewCertVessel] = useState('');
  const [newCertTeam, setNewCertTeam] = useState('');
  const [newCertExp, setNewCertExp] = useState('');
  const [newCertIssueDate, setNewCertIssueDate] = useState('');
  const [newCertNumber, setNewCertNumber] = useState('');
  const [newCertAccessType, setNewCertAccessType] = useState<'office' | 'vessel' | 'any'>('office');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deviceRequests, setDeviceRequests] = useState<DeviceRegistrationRequest[]>([]);
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [deviceToRemove, setDeviceToRemove] = useState<number | null>(null);
  const [adminTab, setAdminTab] = useState<'fleet' | 'users' | 'settings' | 'audit' | 'devices' | 'flags'>('fleet');
  const [editingFlagId, setEditingFlagId] = useState<number | null>(null);
  const [editingFlagName, setEditingFlagName] = useState('');
  const [newFlagName, setNewFlagName] = useState('');
  const [flagSearch, setFlagSearch] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const itemsPerPage = 20;
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [vesselSearch, setVesselSearch] = useState('');
  const [adminVesselFilterTeam, setAdminVesselFilterTeam] = useState('');
  const [adminVesselFilterOwner, setAdminVesselFilterOwner] = useState('');
  const [vesselSortField, setVesselSortField] = useState<'name' | 'team' | 'owner'>('name');
  const [vesselSortOrder, setVesselSortOrder] = useState<'asc' | 'desc'>('asc');
  const [certSearch, setCertSearch] = useState('');
  const [certSortField, setCertSortField] = useState<'name' | 'vessel' | 'expiration_date'>('expiration_date');
  const [certSortOrder, setCertSortOrder] = useState<'asc' | 'desc'>('asc');
  const [systemTime, setSystemTime] = useState<{ time: string, timezone: string } | null>(null);
  const user = JSON.parse(atob(token.split('.')[1]));
  const isAdmin = user.role === 'admin';
  const isTeamPic = user.role === 'team_pic' || user.role === 'user';
  const isVessel = user.role === 'vessel';

  const fetchSystemTime = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system-time', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSystemTime(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch system time:', err);
    }
  }, [token]);

  useEffect(() => {
    if (adminTab === 'settings') {
      fetchSystemTime();
      const interval = setInterval(fetchSystemTime, 30000);
      return () => clearInterval(interval);
    }
  }, [adminTab, fetchSystemTime]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.APP_LOGO) {
          setCustomLogoUrl(data.APP_LOGO);
        } else {
          setCustomLogoUrl(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, [token]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setAuditLogs(await res.json());
        setAuditPage(1);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  }, [token]);

  const fetchDeviceRequests = useCallback(async () => {
    try {
      const [reqRes, regRes] = await Promise.all([
        fetch('/api/admin/device-requests', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/registered-devices', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (reqRes.ok) setDeviceRequests(await reqRes.json());
      if (regRes.ok) setRegisteredDevices(await regRes.json());
    } catch (err) {
      console.error('Failed to fetch device data:', err);
    }
  }, [token]);

  useEffect(() => {
    if (adminTab === 'devices') {
      fetchDeviceRequests();
    }
  }, [adminTab, fetchDeviceRequests]);

  useEffect(() => {
    if (adminTab === 'audit') {
      fetchAuditLogs();
    }
  }, [adminTab, fetchAuditLogs]);

  useEffect(() => {
    if (isVessel && user.vessel_id && vessels.length > 0) {
      const v = vessels.find(v => v.id === user.vessel_id);
      if (v) {
        setNewCertVessel(String(v.id));
        setNewCertTeam(String(v.team_id));
        setNewCertAccessType('vessel');
      }
    }
  }, [isVessel, user.vessel_id, vessels]);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user' | 'vessel' | 'team_pic'>('user');
  const [newUserTeams, setNewUserTeams] = useState<number[]>([]);
  const [newUserVessel, setNewUserVessel] = useState<number | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserNotify, setNewUserNotify] = useState(true);

  const handleAddFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlagName.trim()) return;
    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFlagName.trim() })
      });
      if (res.ok) {
        const added = await res.json();
        setFlags(prev => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
        setNewFlagName('');
        notify('success', `Flag "${added.name}" added successfully.`);
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to add flag.');
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to add flag.');
    }
  };

  const handleUpdateFlag = async (id: number) => {
    if (!editingFlagName.trim()) return;
    try {
      const res = await fetch(`/api/flags/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editingFlagName.trim() })
      });
      if (res.ok) {
        setFlags(prev => prev.map(f => f.id === id ? { ...f, name: editingFlagName.trim() } : f).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingFlagId(null);
        setEditingFlagName('');
        notify('success', 'Flag updated successfully.');
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to update flag.');
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to update flag.');
    }
  };

  const handleDeleteFlag = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this flag? This might affect vessels with this flag assigned.')) return;
    try {
      const res = await fetch(`/api/flags/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setFlags(prev => prev.filter(f => f.id !== id));
        notify('success', 'Flag removed successfully.');
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to remove flag.');
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove flag.');
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, [token]);

  const handleGenerateGuide = useCallback(async (tokens: any) => {
    setIsGeneratingGuide(true);
    try {
      const res = await fetch('/api/google/generate-guide', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tokens })
      });
      if (res.ok) {
        const data = await res.json();
        notify('success', 'User Guide generated successfully!');
        window.open(data.url, '_blank');
      } else {
        const data = await res.json();
        notify('error', `Failed to generate guide: ${data.error}`);
      }
    } catch (err) {
      notify('error', 'Connection error while generating guide');
    } finally {
      setIsGeneratingGuide(false);
    }
  }, [token]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        handleGenerateGuide(event.data.tokens);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleGenerateGuide]);

  const initiateGoogleAuth = async () => {
    try {
      const res = await fetch('/api/auth/google/url', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, 'google_auth', 'width=600,height=700');
      } else {
        const data = await res.json();
        notify('error', data.error || 'Failed to initiate Google Auth');
      }
    } catch (err) {
      notify('error', 'Connection error while initiating auth');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSettings();
  }, [fetchUsers, fetchSettings]);

  const handleUpdateSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        notify('success', 'Settings updated successfully');
      } else {
        notify('error', 'Failed to update settings');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleVerifyDevice = async (requestId: number, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/admin/verify-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ request_id: requestId, status }),
      });
      if (res.ok) {
        notify('success', `Request ${status} successfully`);
        fetchDeviceRequests();
        fetchUsers(); // Refresh users list too
      } else {
        notify('error', `Failed to ${status} request`);
      }
    } catch (err) {
      notify('error', 'Connection error');
    }
  };

  const handleRemoveDevice = async (userId: number) => {
    try {
      const res = await fetch('/api/admin/remove-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      if (res.ok) {
        notify('success', 'Device registration removed');
        setDeviceToRemove(null);
        fetchDeviceRequests();
        fetchUsers();
      } else {
        notify('error', data.error || 'Failed to remove device');
      }
    } catch (err) {
      notify('error', 'Connection error');
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    try {
      const res = await fetch('/api/admin/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          resend_api_key: settings.RESEND_API_KEY,
          from: settings.SMTP_FROM
        }),
      });
      if (res.ok) {
        notify('success', 'Resend test email sent successfully! Check your inbox.');
      } else {
        const data = await res.json();
        notify('error', `Resend Test Failed: ${data.error}`);
      }
    } catch (err) {
      notify('error', 'Connection error during SMTP test');
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleAddVessel = async () => {
    if (!newVesselName) {
      notify('error', 'Vessel name is required');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('name', newVesselName);
      formData.append('team_id', newVesselTeam ? String(newVesselTeam) : '');
      formData.append('owner', newVesselOwner);
      formData.append('flag', newVesselFlag);
      formData.append('type', newVesselType);
      formData.append('date_built', newVesselDateBuilt);
      formData.append('min_fuel_consumption', newVesselMinFuel);
      formData.append('max_fuel_consumption', newVesselMaxFuel);
      if (newVesselPhoto) {
        formData.append('photo', newVesselPhoto);
      }

      const res = await fetch('/api/vessels', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        notify('success', 'Vessel added successfully');
        setNewVesselName('');
        setNewVesselTeam('');
        setNewVesselOwner('Nissen');
        setNewVesselFlag('');
        setNewVesselType('Bulk Carrier');
        setNewVesselDateBuilt('');
        setNewVesselMinFuel('');
        setNewVesselMaxFuel('');
        setNewVesselPhoto(null);
        onRefresh();
      } else {
        const data = await res.json();
        notify('error', data.error || 'Failed to add vessel');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleAddCert = async () => {
    const vesselId = isVessel ? user.vessel_id : newCertVessel;
    const teamId = newCertTeam;
    const name = newCertName;
    const certNumber = newCertNumber;
    const issueDate = newCertIssueDate;
    const expDate = newCertExp;
    const accessType = isVessel ? 'vessel' : newCertAccessType;

    if (!name || (!vesselId && !teamId) || !expDate) {
      notify('error', 'Certificate name, expiration date, and either a vessel or team are required');
      return;
    }
    try {
      const url = '/api/certificates';
      const method = 'POST';
      
      let res;
      const formData = new FormData();
      formData.append('vessel_id', vesselId === 'all' ? 'all' : (vesselId ? String(vesselId) : ''));
      formData.append('team_id', teamId ? String(teamId) : '');
      formData.append('name', name);
      formData.append('certificate_number', certNumber || '');
      formData.append('date_issued', issueDate || '');
      formData.append('expiration_date', expDate);
      formData.append('access_type', accessType);
      if (newCertFile) {
        formData.append('file', newCertFile);
        formData.append('file_type', uploadFileType);
      }

      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        notify('success', 'Certificate/Service Report(s) assigned successfully');
        setNewCertName('');
        setNewCertNumber('');
        setNewCertIssueDate('');
        setNewCertExp('');
        setNewCertVessel('');
        setNewCertTeam('');
        setNewCertAccessType('office');
        setNewCertFile(null);
        setPreviewFile(null);
        setTempPreviewUrl(null);
        onRefresh();
      } else {
        notify('error', 'Failed to assign certificate/service report');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleAddUser = async () => {
    const username = editingUser ? editingUser.username : newUsername;
    const role = editingUser ? editingUser.role : newUserRole;
    const teamIds = editingUser ? editingUser.team_ids : newUserTeams;
    const vesselId = editingUser ? editingUser.vessel_id : newUserVessel;
    const email = editingUser ? editingUser.email : newUserEmail;

    if (!username || (!newPassword && !editingUser)) {
      notify('error', 'Username and password are required');
      return;
    }
    if (!editingUser && newUserNotify && !email) {
      notify('error', 'Email address is required when notification is checked');
      return;
    }
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          username: username, 
          password: newPassword || undefined, 
          role: role, 
          team_ids: teamIds,
          vessel_id: role === 'vessel' ? (vesselId ? Number(vesselId) : null) : null,
          email: email,
          notify: editingUser ? false : newUserNotify,
          device_id: editingUser ? editingUser.device_id : null,
          is_verified: editingUser ? !!editingUser.is_verified : false
        }),
      });
      if (res.ok) {
        notify('success', editingUser ? 'User updated successfully' : 'User created successfully');
        setNewUsername('');
        setNewPassword('');
        setNewUserRole('user');
        setNewUserTeams([]);
        setNewUserVessel(null);
        setNewUserEmail('');
        setNewUserNotify(true);
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        notify('error', data.error || 'Failed to save user');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleDeleteUser = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            notify('success', 'User deleted successfully');
            fetchUsers();
          } else {
            notify('error', 'Failed to delete user');
          }
        } catch (err) {
          notify('error', 'Connection error occurred');
        }
      }
    });
  };

  const toggleUserTeam = async (user: User, teamId: number) => {
    const newTeamIds = user.team_ids.includes(teamId)
      ? user.team_ids.filter(id => id !== teamId)
      : [...user.team_ids, teamId];
    
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: user.username, team_ids: newTeamIds, role: user.role }),
      });
      if (res.ok) {
        notify('success', 'User team assignments updated');
        fetchUsers();
      } else {
        notify('error', 'Failed to update user teams');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  return (
    <div className="space-y-12">
      {(!subView || subView === 'admin') && (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">
              {isVessel ? 'Vessel Management' : 'Admin Control Panel'}
            </h1>
            <p className="text-slate-500">
              {isVessel ? 'Manage your vessel certificates.' : 'Manage fleet, users, and system configuration.'}
            </p>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button 
              onClick={() => setAdminTab('fleet')}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                adminTab === 'fleet' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              {isVessel ? 'My Vessel' : 'Fleet & Certs'}
            </button>
            {isAdmin && (
              <button 
                onClick={() => setAdminTab('users')}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                  adminTab === 'users' 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                User Management
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => setAdminTab('settings')}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                  adminTab === 'settings' 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                System Settings
              </button>
            )}
            {(isAdmin || isTeamPic) && (
              <button 
                onClick={() => setAdminTab('devices')}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2",
                  adminTab === 'devices' 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                Device Registration
                {deviceRequests.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full leading-none">
                    {deviceRequests.length}
                  </span>
                )}
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => setAdminTab('audit')}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                  adminTab === 'audit' 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                Audit Logs
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => setAdminTab('flags')}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                  adminTab === 'flags' 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-700" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                Flag Management
              </button>
            )}
          </div>
        </header>
      )}

      {subView && subView !== 'admin' && (
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
            {subView === 'admin_new_vessel' && 'Add New Vessel'}
            {subView === 'admin_add_cert' && 'Add Certificate/Service Report'}
            {subView === 'admin_vessel_list' && 'Vessel List'}
            {subView === 'admin_cert_list' && 'Certificate/Service Report List'}
          </h1>
          <p className="text-slate-500">
            {subView === 'admin_new_vessel' && 'Register a new vessel to the fleet.'}
            {subView === 'admin_add_cert' && 'Assign a new certificate to a vessel or team.'}
            {subView === 'admin_vessel_list' && 'Manage all vessels in your fleet.'}
            {subView === 'admin_cert_list' && 'View and manage all vessel certificates.'}
          </p>
        </header>
      )}

      {(adminTab === 'fleet' || (subView && subView.startsWith('admin_'))) && (
        <div className="space-y-8">
          {(!subView || subView === 'admin' || subView === 'admin_new_vessel' || subView === 'admin_add_cert') && (
            <div className={cn(
              "grid grid-cols-1 lg:grid-cols-2 gap-8",
              (subView === 'admin_new_vessel' || (subView === 'admin_add_cert' && !newCertFile)) && "lg:grid-cols-1 max-w-2xl",
              (subView === 'admin_add_cert' && newCertFile) && "max-w-none w-full"
            )}>
              {/* Add Vessel */}
              {((!subView || subView === 'admin') || subView === 'admin_new_vessel') && !isVessel && (
                <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm h-full">
                <h2 className="font-bold mb-6 flex items-center gap-2 text-blue-900">
                  <Ship className="w-5 h-5" /> Add New Vessel
                </h2>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Vessel Name" 
                    value={newVesselName}
                    onChange={(e) => setNewVesselName(e.target.value)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                  <select 
                    value={newVesselTeam}
                    onChange={(e) => setNewVesselTeam(e.target.value)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Team</option>
                    {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select 
                    value={newVesselOwner}
                    onChange={(e) => setNewVesselOwner(e.target.value)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Nissen">Nissen</option>
                    <option value="Goodwill">Goodwill</option>
                  </select>
                  <select 
                    value={newVesselType}
                    onChange={(e) => setNewVesselType(e.target.value as 'Bulk Carrier' | 'Container')}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Bulk Carrier">Bulk Carrier</option>
                    <option value="Container">Container</option>
                  </select>
                  <div className="grid grid-cols-2 gap-4">
                    <select 
                      value={newVesselFlag}
                      onChange={(e) => setNewVesselFlag(e.target.value)}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    >
                      <option value="">Select Flag</option>
                      {flags.map(f => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                    <input 
                      type="text" 
                      placeholder="Date Built (e.g. 2024-05-10)" 
                      value={newVesselDateBuilt}
                      onChange={(e) => setNewVesselDateBuilt(e.target.value)}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Min Fuel Consumption" 
                      value={newVesselMinFuel}
                      onChange={(e) => setNewVesselMinFuel(e.target.value)}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                    <input 
                      type="text" 
                      placeholder="Max Fuel Consumption" 
                      value={newVesselMaxFuel}
                      onChange={(e) => setNewVesselMaxFuel(e.target.value)}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Vessel Photo</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file && file.size > MAX_FILE_SIZE) {
                          notify('error', 'File is too large (max 20MB)');
                          e.target.value = '';
                          return;
                        }
                        setNewVesselPhoto(file);
                      }}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddVessel}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                >
                  Add Vessel
                </button>
              </section>
            )}

            {/* Add Cert */}
            {subView === 'admin_add_cert' && (
              <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm h-full">
              <h2 className="font-bold mb-6 flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" /> Add Certificate/Service Report to Vessel/Team
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <select 
                    value={isVessel ? user.vessel_id : newCertVessel}
                    disabled={isVessel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewCertVessel(val);
                      if (val && val !== 'all') {
                        const vessel = vessels.find(v => v.id === Number(val));
                        if (vessel) setNewCertTeam(String(vessel.team_id));
                      } else {
                        setNewCertTeam('');
                      }
                    }}
                    className="px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    {!isVessel && <option value="">Select Vessel (Optional)</option>}
                    {!isVessel && <option value="all">All Vessels</option>}
                    {vessels.filter(v => !isVessel || v.id === user.vessel_id).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>

                  <select 
                    value={newCertTeam}
                    onChange={(e) => setNewCertTeam(e.target.value)}
                    className="px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!!newCertVessel}
                  >
                    <option value="">Select Team</option>
                    {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Certificate/Service Report Name</label>
                  <input 
                    type="text" 
                    placeholder="Certificate/Service Report Name" 
                    value={newCertName}
                    onChange={(e) => setNewCertName(e.target.value)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Certificate/Service Report Number</label>
                  <input 
                    type="text" 
                    placeholder="Cert #" 
                    value={newCertNumber}
                    onChange={(e) => setNewCertNumber(e.target.value)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Date Issued</label>
                    <input 
                      type="date" 
                      value={newCertIssueDate}
                      onChange={(e) => setNewCertIssueDate(e.target.value)}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Expiration Date</label>
                    <input 
                      type="date" 
                      value={newCertExp}
                      onChange={(e) => setNewCertExp(e.target.value)}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Access Type</label>
                  <select 
                    value={isVessel ? 'vessel' : newCertAccessType}
                    disabled={isVessel}
                    onChange={(e) => setNewCertAccessType(e.target.value as any)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    {!isVessel && <option value="office">Office Only</option>}
                    <option value="vessel">Ship Certificate/Service Report</option>
                    {!isVessel && <option value="any">Any</option>}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Document (Optional)</label>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setUploadFileType('certificate')}
                        className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-colors",
                          uploadFileType === 'certificate' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                        )}
                      >
                        Cert
                      </button>
                      <button 
                        type="button"
                        onClick={() => setUploadFileType('supporting')}
                        className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-colors",
                          uploadFileType === 'supporting' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                        )}
                      >
                        Support
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input 
                      type="file" 
                      onChange={async (e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > MAX_FILE_SIZE) {
                        notify('error', 'File is too large (max 20MB)');
                        e.target.value = '';
                        return;
                      }
                      setNewCertFile(file);
                      if (file) {
                        const isSupported = isGeminiSupportedMimeType(file.type);
                        if (AUTO_FILL_ENABLED && isSupported && uploadFileType === 'certificate') {
                          setIsRecognizing(true);
                        }
                        
                        // Set preview file (virtual)
                        setPreviewFile({
                          id: -1,
                          certificate_id: -1,
                          filename: file.name,
                          original_name: file.name,
                          file_type: uploadFileType,
                          upload_date: new Date().toISOString()
                        });

                        const blobUrl = URL.createObjectURL(file);
                        setTempPreviewUrl(blobUrl);

                        if (AUTO_FILL_ENABLED && isSupported && uploadFileType === 'certificate') {
                          try {
                            const data = await recognizeCertText(file);
                            
                            if (data.cert_type) setNewCertName(data.cert_type);
                            if (data.certificate_number) setNewCertNumber(data.certificate_number);
                            if (data.date_issued) setNewCertIssueDate(data.date_issued);
                            if (data.expiration_date) setNewCertExp(data.expiration_date);
                            
                            // Try to match vessel name to select it in the dropdown
                            if (data.vessel_name && !newCertVessel) {
                              const normalizedVesselName = data.vessel_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                              const matchedVessel = vessels.find(v => v.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedVesselName);
                              if (matchedVessel) {
                                setNewCertVessel(String(matchedVessel.id));
                                setNewCertTeam(String(matchedVessel.team_id));
                              }
                            }

                            notify('success', 'Document recognized. Please verify the autofilled fields.');
                          } catch (err) {
                            console.error("OCR failed", err);
                            notify('error', 'Failed to recognize document text');
                          } finally {
                            setIsRecognizing(false);
                          }
                        }
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {isRecognizing && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                    </div>
                  )}
                </div>
                  {newCertFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewFile({
                          id: -1,
                          certificate_id: -1,
                          filename: newCertFile.name,
                          original_name: newCertFile.name,
                          file_type: uploadFileType,
                          upload_date: new Date().toISOString()
                        });
                      }}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 transition-colors ml-1 mt-1"
                    >
                      <Eye className="w-3 h-3" /> Preview Selected File
                    </button>
                  )}
                </div>
                <button 
                  onClick={handleAddCert}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                >
                  Add Certificate/Service Report
                </button>
              </div>
            </section>
          )}

          {subView === 'admin_add_cert' && newCertFile && (
            <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-blue-50 pb-3">
                <div>
                  <h2 className="font-bold text-blue-900 flex items-center gap-2">
                    <Eye className="w-5 h-5" /> Document Preview
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 truncate max-w-[250px]" title={newCertFile.name}>
                    {newCertFile.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isRecognizing && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Auto-filling...
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNewCertFile(null);
                      setPreviewFile(null);
                      setTempPreviewUrl(null);
                    }}
                    className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Remove File
                  </button>
                </div>
              </div>
              
              <div className="h-[calc(100vh-250px)] max-h-[85vh] min-h-[500px] overflow-hidden rounded-xl border border-blue-50 bg-slate-50 relative">
                {(() => {
                  const ext = newCertFile.name.split('.').pop()?.toLowerCase();
                  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
                  const isPdf = ext === 'pdf';
                  
                  if (isImage && tempPreviewUrl) {
                    return (
                      <div className="w-full h-full">
                        <ImageViewer 
                          url={tempPreviewUrl} 
                          title={newCertFile.name} 
                        />
                      </div>
                    );
                  } else if (isPdf && tempPreviewUrl) {
                    return (
                      <div className="w-full h-full">
                        <PDFViewer 
                          url={tempPreviewUrl} 
                          title={newCertFile.name} 
                        />
                      </div>
                    );
                  } else {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 gap-3">
                        <File className="w-12 h-12 text-blue-300" />
                        <p className="text-xs text-slate-500">
                          Preview not available for this file type.<br/>
                          <span className="font-mono font-bold text-blue-600">{newCertFile.name}</span>
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Vessel List */}
      {((!subView || subView === 'admin') || subView === 'admin_vessel_list') && !isVessel && (
        <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm h-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="font-bold flex items-center gap-2 text-blue-900 text-lg">
              <Ship className="w-5 h-5" /> Vessel List
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search input */}
              <div className="relative w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input 
                  type="text" 
                  placeholder="Search vessels..." 
                  value={vesselSearch}
                  onChange={(e) => setVesselSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-blue-50/50 border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Team Filter */}
              <select 
                value={adminVesselFilterTeam}
                onChange={(e) => setAdminVesselFilterTeam(e.target.value)}
                className="px-2.5 py-1.5 bg-blue-50/50 border border-blue-100 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Teams</option>
                {teams.map(t => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>

              {/* Owner Filter */}
              <select 
                value={adminVesselFilterOwner}
                onChange={(e) => setAdminVesselFilterOwner(e.target.value)}
                className="px-2.5 py-1.5 bg-blue-50/50 border border-blue-100 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Owners</option>
                <option value="Nissen">Nissen</option>
                <option value="Goodwill">Goodwill</option>
              </select>

              <div className="h-4 w-[1px] bg-blue-100 hidden sm:block" />

              {/* Sort field */}
              <select 
                value={vesselSortField}
                onChange={(e) => setVesselSortField(e.target.value as any)}
                className="px-2.5 py-1.5 bg-blue-50/50 border border-blue-100 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="name">Sort: Name</option>
                <option value="team">Sort: Team</option>
                <option value="owner">Sort: Owner</option>
              </select>

              {/* Sort Order */}
              <button 
                onClick={() => setVesselSortOrder(vesselSortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 bg-blue-50/50 hover:bg-blue-100 rounded-lg border border-blue-100 text-blue-600 transition-colors"
                title={vesselSortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
              >
                {vesselSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2">
            {[...vessels]
              .filter(v => {
                const matchesSearch = (v.name || '').toLowerCase().includes(vesselSearch.toLowerCase());
                const matchesTeam = adminVesselFilterTeam === '' || String(v.team_id) === adminVesselFilterTeam;
                const matchesOwner = adminVesselFilterOwner === '' || v.owner === adminVesselFilterOwner;
                return matchesSearch && matchesTeam && matchesOwner;
              })
              .sort((a, b) => {
                let valA = '';
                let valB = '';
                if (vesselSortField === 'name') {
                  valA = a.name || '';
                  valB = b.name || '';
                } else if (vesselSortField === 'team') {
                  valA = a.team_name || '';
                  valB = b.team_name || '';
                } else if (vesselSortField === 'owner') {
                  valA = a.owner || '';
                  valB = b.owner || '';
                }
                const cmp = valA.localeCompare(valB);
                return vesselSortOrder === 'asc' ? cmp : -cmp;
              })
              .map(v => (
              <div 
                key={v.id} 
                className="bg-slate-50/50 hover:bg-white p-5 rounded-2xl border border-blue-50 hover:border-blue-200 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group relative"
                onClick={() => setSelectedVessel(v)}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {v.has_photo ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-blue-100 shrink-0">
                          <img 
                            src={`/api/vessels/${v.id}/photo?token=${token}&t=${Date.now()}`} 
                            alt={v.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                          <Ship className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate" title={v.name}>{v.name}</h4>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest truncate">{v.team_name || 'No Team'}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
                      v.owner === 'Nissen' ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {v.owner || 'Nissen'}
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span>Flag:</span>
                      <span className="font-bold text-slate-700">{v.flag || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-bold text-slate-700">{v.type || 'Bulk Carrier'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Built:</span>
                      <span className="font-bold text-slate-700">{v.date_built || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Fuel:</span>
                      <span className="font-bold text-slate-700">{v.min_fuel_consumption || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Fuel:</span>
                      <span className="font-bold text-slate-700">{v.max_fuel_consumption || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold">ID: {v.id}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVessel(v);
                      }}
                      className="p-1.5 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                      title="Edit Vessel"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {(isAdmin || isTeamPic) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVessel(v.id);
                        }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete Vessel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

            {/* Cert List */}
            {subView === 'admin_cert_list' && (
              <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold flex items-center gap-2 text-blue-900"><FileText className="w-5 h-5" /> Certificate/Service Report List</h2>
                <div className="flex items-center gap-2">
                  <div className="relative w-32">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      value={certSearch}
                      onChange={(e) => setCertSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-blue-50/50 border-none rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <select 
                    value={certSortField}
                    onChange={(e) => setCertSortField(e.target.value as any)}
                    className="px-2 py-1.5 bg-blue-50/50 border-none rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="name">Name</option>
                    <option value="vessel">Vessel</option>
                    <option value="expiration_date">Exp. Date</option>
                  </select>
                  <button 
                    onClick={() => setCertSortOrder(certSortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1.5 bg-blue-50/50 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                    title={certSortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
                  >
                    {certSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {[...certs]
                  .filter(c => {
                    if (isVessel) return c.vessel_id === user.vessel_id;
                    return true;
                  })
                  .filter(c => {
                    const s = (certSearch || '').toLowerCase();
                    return (c.name || '').toLowerCase().includes(s) ||
                           (c.vessel_name && (c.vessel_name || '').toLowerCase().includes(s)) ||
                           (c.team_name && (c.team_name || '').toLowerCase().includes(s)) ||
                           (c.owner && (c.owner || '').toLowerCase().includes(s));
                  })
                  .sort((a, b) => {
                    let valA = '';
                    let valB = '';
                    if (certSortField === 'name') {
                      valA = a.name || '';
                      valB = b.name || '';
                    } else if (certSortField === 'vessel') {
                      valA = a.vessel_name || a.team_name || '';
                      valB = b.vessel_name || b.team_name || '';
                    } else if (certSortField === 'expiration_date') {
                      valA = a.expiration_date || '';
                      valB = b.expiration_date || '';
                    }
                    const cmp = valA.localeCompare(valB);
                    return certSortOrder === 'asc' ? cmp : -cmp;
                  })
                  .map(cert => (
                  <div 
                    key={cert.id} 
                    className="flex items-center justify-between p-3 bg-blue-50/50 hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-100 rounded-xl group cursor-pointer transition-all"
                    onClick={() => fetchCertDetails(cert)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{cert.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          {cert.vessel_name || `Team: ${cert.team_name}`}
                        </p>
                        {cert.certificate_number && (
                          <>
                            <span className="text-slate-300">•</span>
                            <p className="text-[10px] text-blue-600 font-bold">{cert.certificate_number}</p>
                          </>
                        )}
                        {cert.date_issued && (
                          <>
                            <span className="text-slate-300">•</span>
                            <p className="text-[10px] text-slate-400">Issued: {cert.date_issued}</p>
                          </>
                        )}
                        <span className="text-slate-300">•</span>
                        <p className="text-[10px] text-slate-400 font-mono">Expires: {cert.expiration_date}</p>
                        <span className="text-slate-300">•</span>
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                          getStatus(cert.expiration_date) === 'expired' ? "bg-red-100 text-red-700" :
                          getStatus(cert.expiration_date) === 'expiring soon' ? "bg-orange-100 text-orange-700" :
                          getStatus(cert.expiration_date) === 'expiring' ? "bg-amber-100 text-amber-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {getStatus(cert.expiration_date)}
                        </span>
                      </div>
                    </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCert(cert);
                      }}
                      className="p-2 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors animate-none"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {(isAdmin || isTeamPic) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCert(cert.id);
                        }}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors animate-none"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {adminTab === 'users' && (!subView || subView === 'admin') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Management */}
          <div className="space-y-8">
            <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
              <h2 className="font-bold mb-6 flex items-center gap-2 text-blue-900">
                <UserPlus className="w-5 h-5" /> Add New User
              </h2>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Username" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder="Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
                      let pass = '';
                      for (let i = 0; i < 10; i++) {
                        pass += chars.charAt(Math.floor(Math.random() * chars.length));
                      }
                      setNewPassword(pass);
                    }}
                    className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    Generate Random Password
                  </button>
                </div>
                <input 
                  type="email" 
                  placeholder="Email Address (for Alerts & Notifications)" 
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                />
                <label className="flex items-start gap-2 pt-1 px-1 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={newUserNotify}
                    onChange={(e) => setNewUserNotify(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-700 font-medium leading-relaxed">
                    Notify newly created user via email containing their username and initial password (access via https://comos.cc)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <select 
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="user">PIC Role</option>
                    <option value="admin">Admin Role</option>
                    <option value="team_pic">Management Role</option>
                    <option value="vessel">Vessel Role</option>
                  </select>
                  {newUserRole === 'vessel' && (
                    <select 
                      value={newUserVessel || ''}
                      onChange={(e) => setNewUserVessel(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Assign Vessel</option>
                      {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Team Affiliations (Office Users Only)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                      <label key={t.id} className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                        <input 
                          type="checkbox"
                          checked={newUserTeams.includes(t.id)}
                          disabled={newUserRole === 'vessel'}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...newUserTeams, t.id]
                              : newUserTeams.filter(id => id !== t.id);
                            setNewUserTeams(newIds);
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="text-xs text-slate-700">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleAddUser}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                >
                  Add User
                </button>
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
              <h2 className="font-bold mb-6 flex items-center gap-2 text-blue-900"><Users className="w-5 h-5" /> User List</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl group">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{u.username}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{getRoleLabel(u.role)}</p>
                        {u.role === 'vessel' && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border",
                              u.is_verified 
                                ? "bg-green-100 text-green-700 border-green-200" 
                                : "bg-orange-100 text-orange-700 border-orange-200"
                            )}>
                              {u.is_verified ? 'Verified' : 'Unverified'}
                            </span>
                          </>
                        )}
                        <span className="text-slate-300">•</span>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          {u.team_ids.length > 0 
                            ? u.team_ids.map(tid => teams.find(t => t.id === tid)?.name).filter(Boolean).join(', ')
                            : 'No Teams'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingUser(u);
                          setNewPassword('');
                          setNewUserEmail(u.email || '');
                        }}
                        className="p-2 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {adminTab === 'settings' && (!subView || subView === 'admin') && (
        <div className="max-w-2xl mx-auto">
          <section className="bg-white p-8 rounded-3xl border border-blue-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3 text-blue-900">
                <Settings className="w-6 h-6" /> System Configuration
              </h2>
              {systemTime && (
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Time (GMT+8)</p>
                  <div className="flex items-center gap-2 text-blue-600">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs font-mono font-bold">{systemTime.time}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-8">
              {/* Application Logo Setting */}
              <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Current Logo Preview */}
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Logo</p>
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-blue-100 flex items-center justify-center overflow-hidden p-2">
                      <Logo className="w-full h-full" />
                    </div>
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-3 text-center sm:text-left">
                    <div>
                      <h3 className="text-sm font-bold text-blue-900 mb-1 flex items-center justify-center sm:justify-start gap-2">
                        <Image className="w-4 h-4" /> Application Logo
                      </h3>
                      <p className="text-xs text-slate-500">
                        Customize the logo displayed in the login screen, sidebar, and dashboard.
                        Supports PNG, JPG, or SVG format (Max 5MB).
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                      <label className="px-4 py-2 bg-blue-600 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-100 hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 active:scale-95">
                        <Upload className="w-4 h-4" />
                        Upload Custom Logo
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              notify('error', 'Logo image size must be less than 5MB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const base64String = reader.result as string;
                              setSettings(prev => ({
                                ...prev,
                                APP_LOGO: base64String
                              }));
                              setCustomLogoUrl(base64String);
                              notify('info', 'New logo chosen. Click "Save Configuration" at the bottom to apply.');
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>

                      {settings.APP_LOGO && (
                        <button
                          type="button"
                          onClick={() => {
                            setSettings(prev => {
                              const next = { ...prev };
                              delete next.APP_LOGO;
                              return next;
                            });
                            setCustomLogoUrl(null);
                            notify('info', 'Logo reset. Click "Save Configuration" at the bottom to apply.');
                          }}
                          className="px-4 py-2 bg-white text-red-600 hover:bg-red-50 border border-red-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Reset to Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
                       <FileText className="w-4 h-4" /> Application Documentation
                    </h3>
                    <p className="text-xs text-slate-500">
                      Create a comprehensive User Guide directly in your Google Drive. 
                      This will generate a Google Doc with system instructions.
                    </p>
                  </div>
                  <button 
                    onClick={initiateGoogleAuth}
                    disabled={isGeneratingGuide}
                    className="shrink-0 px-6 py-2.5 bg-white text-blue-600 border border-blue-200 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingGuide ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create Google Doc Guide
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Backblaze B2 Storage Settings */}
              <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                <h3 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-blue-600" /> Backblaze B2 Cloud Storage
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Configure Backblaze B2 Cloud Storage to persist all uploaded files, certificates, photos, and service reports securely off-site.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Key ID (B2_APPLICATION_KEY_ID)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 005..." 
                      value={settings.B2_APPLICATION_KEY_ID || ''}
                      onChange={(e) => setSettings({...settings, B2_APPLICATION_KEY_ID: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Application Key (B2_APPLICATION_KEY)</label>
                    <input 
                      type="password" 
                      placeholder="e.g. K005..." 
                      value={settings.B2_APPLICATION_KEY || ''}
                      onChange={(e) => setSettings({...settings, B2_APPLICATION_KEY: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Bucket Name (B2_BUCKET_NAME)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. comos-storage" 
                      value={settings.B2_BUCKET_NAME || ''}
                      onChange={(e) => setSettings({...settings, B2_BUCKET_NAME: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">S3-Compatible Endpoint (B2_ENDPOINT)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. s3.us-east-005.backblazeb2.com" 
                      value={settings.B2_ENDPOINT || ''}
                      onChange={(e) => setSettings({...settings, B2_ENDPOINT: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!settings.B2_APPLICATION_KEY_ID || !settings.B2_APPLICATION_KEY || !settings.B2_BUCKET_NAME || !settings.B2_ENDPOINT) {
                        notify('error', 'Please fill in all Backblaze B2 settings before testing connection.');
                        return;
                      }
                      try {
                        const res = await fetch('/api/admin/test-b2', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            B2_APPLICATION_KEY_ID: settings.B2_APPLICATION_KEY_ID,
                            B2_APPLICATION_KEY: settings.B2_APPLICATION_KEY,
                            B2_BUCKET_NAME: settings.B2_BUCKET_NAME,
                            B2_ENDPOINT: settings.B2_ENDPOINT,
                          })
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          notify('success', 'Successfully connected to Backblaze B2 bucket!');
                        } else {
                          notify('error', `Connection failed: ${data.error || 'Check settings'}`);
                        }
                      } catch (err: any) {
                        notify('error', `Network error testing B2: ${err.message}`);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Test B2 Connection
                  </button>
                  <span className="text-[10px] text-slate-400">
                    Saves automatically when you click the "Save Configuration" button at the bottom.
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Email Alerts Settings (Resend API)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Resend API Key</label>
                    <input 
                      type="password" 
                      placeholder="re_..." 
                      value={settings.RESEND_API_KEY || ''}
                      onChange={(e) => setSettings({...settings, RESEND_API_KEY: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="px-1 text-[10px] text-slate-400">Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">resend.com</a></p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Destination Email (Alerts)</label>
                    <input 
                      type="email" 
                      placeholder="e.g. alerts@example.com" 
                      value={settings.DESTINATION_EMAIL || ''}
                      onChange={(e) => setSettings({...settings, DESTINATION_EMAIL: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Sender Email (From)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. alerts@vesselcert.com" 
                      value={settings.SMTP_FROM || ''}
                      onChange={(e) => setSettings({...settings, SMTP_FROM: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="px-1 text-[10px] text-slate-400">Must be a verified domain in Resend</p>
                  </div>
                  <div className="flex items-center gap-3 pt-4 md:col-span-2">
                    <input 
                      type="checkbox" 
                      id="enable_alerts"
                      checked={settings.ENABLE_EMAIL_ALERTS !== 'false'}
                      onChange={(e) => setSettings({...settings, ENABLE_EMAIL_ALERTS: e.target.checked ? 'true' : 'false'})}
                      className="w-4 h-4 text-blue-600 bg-blue-50 border-blue-200 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="enable_alerts" className="text-sm font-bold text-slate-700 cursor-pointer">
                      Enable Automated Email Alerts
                    </label>
                  </div>

                  <div className="pt-6 border-t border-blue-50 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Office Certificate/Service Report Alert Schedule</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Schedule Type</label>
                        <select 
                          value={settings.ALERT_SCHEDULE_TYPE || 'interval'}
                          onChange={(e) => setSettings({...settings, ALERT_SCHEDULE_TYPE: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="interval">Every X Hours</option>
                          <option value="time">Specific Time of Day</option>
                        </select>
                      </div>

                      {settings.ALERT_SCHEDULE_TYPE === 'time' ? (
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Delivery Times (HH:mm)</label>
                          <div className="space-y-2">
                            {(settings.ALERT_TIME || '08:00').split(',').map((time, index) => (
                              <div key={index} className="flex gap-2">
                                <input 
                                  type="time" 
                                  value={time}
                                  onChange={(e) => {
                                    const times = (settings.ALERT_TIME || '08:00').split(',');
                                    times[index] = e.target.value;
                                    setSettings({...settings, ALERT_TIME: times.join(',')});
                                  }}
                                  className="flex-1 px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                                />
                                {(settings.ALERT_TIME || '08:00').split(',').length > 1 && (
                                  <button 
                                    onClick={() => {
                                      const times = (settings.ALERT_TIME || '08:00').split(',');
                                      times.splice(index, 1);
                                      setSettings({...settings, ALERT_TIME: times.join(',')});
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove time"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button 
                              onClick={() => {
                                const times = (settings.ALERT_TIME || '08:00').split(',');
                                times.push('12:00');
                                setSettings({...settings, ALERT_TIME: times.join(',')});
                              }}
                              className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 px-1 py-1 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Add Another Time
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Interval (Hours)</label>
                          <input 
                            type="number" 
                            min="1"
                            max="720"
                            value={settings.ALERT_INTERVAL_HOURS || '24'}
                            onChange={(e) => setSettings({...settings, ALERT_INTERVAL_HOURS: e.target.value})}
                            className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-blue-50 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Ship Certificate/Service Report Alert Schedule</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Schedule Type</label>
                        <select 
                          value={settings.VESSEL_ALERT_SCHEDULE_TYPE || 'interval'}
                          onChange={(e) => setSettings({...settings, VESSEL_ALERT_SCHEDULE_TYPE: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="interval">Every X Hours</option>
                          <option value="time">Specific Time of Day</option>
                        </select>
                      </div>

                      {settings.VESSEL_ALERT_SCHEDULE_TYPE === 'time' ? (
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Delivery Times (HH:mm)</label>
                          <div className="space-y-2">
                            {(settings.VESSEL_ALERT_TIME || '08:00').split(',').map((time, index) => (
                              <div key={index} className="flex gap-2">
                                <input 
                                  type="time" 
                                  value={time}
                                  onChange={(e) => {
                                    const times = (settings.VESSEL_ALERT_TIME || '08:00').split(',');
                                    times[index] = e.target.value;
                                    setSettings({...settings, VESSEL_ALERT_TIME: times.join(',')});
                                  }}
                                  className="flex-1 px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                                />
                                {(settings.VESSEL_ALERT_TIME || '08:00').split(',').length > 1 && (
                                  <button 
                                    onClick={() => {
                                      const times = (settings.VESSEL_ALERT_TIME || '08:00').split(',');
                                      times.splice(index, 1);
                                      setSettings({...settings, VESSEL_ALERT_TIME: times.join(',')});
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove time"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button 
                              onClick={() => {
                                const times = (settings.VESSEL_ALERT_TIME || '08:00').split(',');
                                times.push('12:00');
                                setSettings({...settings, VESSEL_ALERT_TIME: times.join(',')});
                              }}
                              className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 px-1 py-1 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Add Another Time
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Interval (Hours)</label>
                          <input 
                            type="number" 
                            min="1"
                            max="720"
                            value={settings.VESSEL_ALERT_INTERVAL_HOURS || '24'}
                            onChange={(e) => setSettings({...settings, VESSEL_ALERT_INTERVAL_HOURS: e.target.value})}
                            className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-blue-50">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/admin/test-email', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          const data = await res.json();
                          if (res.ok) {
                            notify('success', data.message);
                          } else {
                            notify('error', data.error || 'Failed to test email.');
                          }
                        } catch (e) {
                          notify('error', 'Network error while testing email.');
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-200 active:scale-95"
                    >
                      <Mail className="w-5 h-5" /> Test Resend & Send Alerts
                    </button>
                    <p className="mt-2 text-xs text-slate-400">
                      This will send a test email to <b>{settings.DESTINATION_EMAIL || 'IT@cleanocean.com.ph'}</b> and trigger an immediate expiration check.
                    </p>
                  </div>

                  <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Last Alert Status</h4>
                    <p className="text-sm text-slate-600 font-mono break-words">
                      {settings.LAST_ALERT_LOG || 'No log available.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-blue-50 flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleUpdateSettings}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                >
                  Save Configuration
                </button>
                <button 
                  onClick={handleTestSmtp}
                  disabled={isTestingSmtp}
                  className="flex-1 py-3 bg-white text-blue-600 border border-blue-200 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {isTestingSmtp ? 'Testing...' : 'Send Test Email'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {adminTab === 'audit' && (!subView || subView === 'admin') && (
        <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-blue-50 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-3 text-blue-900">
              <History className="w-6 h-6" /> System Audit Logs
            </h2>
            <button 
              onClick={fetchAuditLogs}
              className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Action</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No audit logs found.</td>
                  </tr>
                ) : (
                  auditLogs.slice((auditPage - 1) * itemsPerPage, auditPage * itemsPerPage).map(log => (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-900">{log.username || 'System'}</span>
                        <p className="text-[10px] text-slate-400">ID: {log.user_id || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          log.action.startsWith('CREATE') ? "bg-green-100 text-green-700" :
                          log.action.startsWith('DELETE') ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {auditLogs.length > itemsPerPage && (
            <div className="px-6 py-4 border-t border-blue-50 flex items-center justify-between bg-white">
              <div className="text-xs text-slate-400">
                Showing {((auditPage - 1) * itemsPerPage) + 1} to {Math.min(auditPage * itemsPerPage, auditLogs.length)} of {auditLogs.length} entries
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setAuditPage(prev => Math.max(1, prev - 1))}
                  disabled={auditPage === 1}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center px-4 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg">
                  Page {auditPage} of {Math.ceil(auditLogs.length / itemsPerPage)}
                </div>
                <button 
                  onClick={() => setAuditPage(prev => Math.min(Math.ceil(auditLogs.length / itemsPerPage), prev + 1))}
                  disabled={auditPage >= Math.ceil(auditLogs.length / itemsPerPage)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {adminTab === 'devices' && (!subView || subView === 'admin') && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-blue-50 flex items-center justify-between bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold flex items-center gap-3 text-blue-900">
                <Shield className="w-6 h-6" /> Device Registration Requests
              </h2>
              <button 
                onClick={fetchDeviceRequests}
                className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                title="Refresh Requests"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="px-6 py-4">Vessel / User</th>
                    <th className="px-6 py-4">Device Code</th>
                    <th className="px-6 py-4">Device ID</th>
                    <th className="px-6 py-4">Requested At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {deviceRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No pending device registration requests found.
                      </td>
                    </tr>
                  ) : (
                    deviceRequests.map(req => (
                      <tr key={req.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{req.vessel_name || 'No Vessel Assigned'}</p>
                          <p className="text-xs text-slate-500">User: {req.username}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-black rounded-lg font-mono tracking-widest">
                            {req.device_code}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-[10px] text-slate-400 max-w-[150px] truncate">
                          {req.device_id}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {format(parseISO(req.created_at), 'MMM dd, yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleVerifyDevice(req.id, 'approved')}
                              className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition-colors shadow-md shadow-green-100"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleVerifyDevice(req.id, 'rejected')}
                              className="px-4 py-2 bg-white text-red-500 border border-red-100 text-xs font-bold rounded-xl hover:bg-red-50 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-blue-50 bg-white">
              <h2 className="text-xl font-bold flex items-center gap-3 text-blue-900">
                <CheckCircle2 className="w-6 h-6 text-green-500" /> Registered Devices
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="px-6 py-4">Vessel / User</th>
                    <th className="px-6 py-4">Device ID</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {registeredDevices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No registered devices found.
                      </td>
                    </tr>
                  ) : (
                    registeredDevices.map(device => (
                      <tr key={device.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{device.vessel_name || 'No Vessel Assigned'}</p>
                          <p className="text-xs text-slate-500">User: {device.username}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-[10px] text-slate-400 max-w-[250px] truncate" title={formatDeviceIds(device.device_id)}>
                          {formatDeviceIds(device.device_id)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            Verified
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {deviceToRemove === device.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRemoveDevice(device.id)}
                                className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 shadow-sm transition-all"
                              >
                                Confirm Delete
                              </button>
                              <button
                                onClick={() => setDeviceToRemove(null)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeviceToRemove(device.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors group"
                              title="Remove Device Registration"
                            >
                              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {adminTab === 'flags' && (!subView || subView === 'admin') && (
        <div className="space-y-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add Flag Card */}
            <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm h-fit">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Add New Flag
              </h3>
              <form onSubmit={handleAddFlag} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Flag Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. United Kingdom"
                    value={newFlagName}
                    onChange={(e) => setNewFlagName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/20 transition-all text-slate-800 font-semibold"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
                >
                  Create Flag
                </button>
              </form>
            </div>

            {/* List Flags Card */}
            <div className="bg-white rounded-3xl border border-blue-100 shadow-sm md:col-span-2 overflow-hidden">
              <div className="p-6 border-b border-blue-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-3 text-blue-900">
                    <Flag className="w-6 h-6 text-blue-600" /> Flag List
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Manage the available flags used by vessels.</p>
                </div>
                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search flags..."
                    value={flagSearch}
                    onChange={(e) => setFlagSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/20 w-full sm:w-48"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Flag Name</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {flags.filter(f => f.name.toLowerCase().includes(flagSearch.toLowerCase())).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium">
                          No flags found.
                        </td>
                      </tr>
                    ) : (
                      flags
                        .filter(f => f.name.toLowerCase().includes(flagSearch.toLowerCase()))
                        .map(f => (
                          <tr key={f.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">
                              #{f.id}
                            </td>
                            <td className="px-6 py-4">
                              {editingFlagId === f.id ? (
                                <input
                                  type="text"
                                  value={editingFlagName}
                                  onChange={(e) => setEditingFlagName(e.target.value)}
                                  className="px-3 py-1.5 bg-blue-50/50 border border-blue-200 rounded-lg text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full max-w-xs"
                                  autoFocus
                                />
                              ) : (
                                <span className="font-bold text-slate-800">{f.name}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {editingFlagId === f.id ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateFlag(f.id)}
                                      className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingFlagId(null);
                                        setEditingFlagName('');
                                      }}
                                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingFlagId(f.id);
                                        setEditingFlagName(f.name);
                                      }}
                                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors group"
                                      title="Edit Flag"
                                    >
                                      <Edit2 className="w-4 h-4 group-hover:text-blue-600 transition-colors" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteFlag(f.id)}
                                      className="p-2 text-slate-500 hover:bg-red-50 rounded-lg transition-colors group"
                                      title="Remove Flag"
                                    >
                                      <Trash2 className="w-4 h-4 group-hover:text-red-600 transition-colors" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {editingUser && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setEditingUser(null);
                  setNewPassword('');
                }}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[160] overflow-hidden"
              >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Edit User</h3>
                  <button onClick={() => {
                    setEditingUser(null);
                    setNewPassword('');
                  }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Username</label>
                    <input 
                      type="text" 
                      placeholder="Username" 
                      value={editingUser.username}
                      onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">New Password (Optional)</label>
                    <input 
                      type="password" 
                      placeholder="Leave blank to keep current"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      value={editingUser.email || ''}
                      onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Role</label>
                      <select 
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="user">PIC</option>
                        <option value="admin">Admin</option>
                        <option value="team_pic">Management</option>
                        <option value="vessel">Vessel</option>
                      </select>
                    </div>
                    {editingUser.role === 'vessel' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Assigned Vessel</label>
                        <select 
                          value={editingUser.vessel_id || ''}
                          onChange={(e) => setEditingUser({...editingUser, vessel_id: e.target.value ? Number(e.target.value) : null})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">None</option>
                          {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {editingUser.role === 'vessel' && editingUser.is_verified && (
                    <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-blue-900">Device Verified</p>
                        <p className="text-[10px] text-blue-600 font-mono truncate max-w-[200px]" title={formatDeviceIds(editingUser.device_id)}>ID: {formatDeviceIds(editingUser.device_id)}</p>
                      </div>
                      <button
                        onClick={() => setEditingUser({ ...editingUser, is_verified: false, device_id: null })}
                        className="text-[10px] font-bold text-red-600 hover:underline"
                      >
                        Reset Device
                      </button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Team Affiliations</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                        <label key={t.id} className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                          <input 
                            type="checkbox"
                            checked={editingUser.team_ids.includes(t.id)}
                            disabled={editingUser.role === 'vessel'}
                            onChange={(e) => {
                              const newIds = e.target.checked 
                                ? [...editingUser.team_ids, t.id]
                                : editingUser.team_ids.filter(id => id !== t.id);
                              setEditingUser({...editingUser, team_ids: newIds});
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                          />
                          <span className="text-xs text-slate-700">{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={handleAddUser}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                  >
                    Update User
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )}

      <ConfirmModal 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);

  useEffect(() => {
    const checkDB = async () => {
      try {
        const res = await fetch('/api/db-status');
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setDbStatus(prev => {
            if (prev && prev.connected === data.connected && prev.error === data.error) return prev;
            return data;
          });
        } else {
          // If it's a 200 with HTML, it's likely the "Starting Server" warmup page
          if (res.ok && contentType && contentType.includes('text/html')) {
             setDbStatus({ connected: false, error: 'Server is starting up...' } as any);
             return;
          }
          const text = await res.text();
          console.error(`Failed to check DB status: ${res.status} ${res.statusText}`, text.slice(0, 500));
          if (res.status === 404) {
             setDbStatus({ connected: false, error: 'API route /api/db-status not found. Server might be starting...' } as any);
          } else {
             setDbStatus({ connected: false, error: `Server error ${res.status}: ${res.statusText}` } as any);
          }
        }
      } catch (e: any) {
        console.error('Failed to check DB status (Network Error):', e);
        setDbStatus({ connected: false, error: `Network error: ${e.message}` } as any);
      }
    };
    checkDB();
    const interval = setInterval(checkDB, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchPublicSettings = async () => {
      try {
        const res = await fetch('/api/public-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.APP_LOGO) {
            setCustomLogoUrl(data.APP_LOGO);
          }
        }
      } catch (err) {
        console.error('Failed to fetch public logo setting:', err);
      }
    };
    fetchPublicSettings();
  }, []);

  useEffect(() => {
    if (user?.role === 'vessel' && token) {
      const verifyDeviceStatus = async () => {
        try {
          const res = await fetch('/api/device/status', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const currentDeviceId = getDeviceId();
            // If server state is different from local state, update it
            if (user.is_verified !== data.is_verified || user.device_id !== data.device_id) {
              setUser(prev => {
                if (!prev) return null;
                const updated = { ...prev, is_verified: data.is_verified, device_id: data.device_id };
                localStorage.setItem('user', JSON.stringify(updated));
                return updated;
              });
            }
          }
        } catch (e) {
          console.error('Device status sync error:', e);
        }
      };

      const interval = setInterval(verifyDeviceStatus, 20000); // Sync every 20s
      return () => clearInterval(interval);
    }
  }, [user?.role, user?.is_verified, user?.device_id, token]);

  const handleLogin = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (!token || !user) {
    return <Login onLogin={handleLogin} dbStatus={dbStatus} />;
  }

  // Vessel Device Verification Check
  if (user.role === 'vessel') {
    const currentDeviceId = getDeviceId();
    if (!user.is_verified || !isDeviceRegistered(user.device_id, currentDeviceId)) {
       return (
         <DeviceRegistration 
           user={user} 
           token={token} 
           onLogout={handleLogout} 
           onVerified={(verified, devId) => {
             const updated = { ...user, is_verified: verified, device_id: devId };
             localStorage.setItem('user', JSON.stringify(updated));
             setUser(updated);
           }}
         />
       );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {dbStatus && !dbStatus.connected && (
        <div className="bg-red-600 text-white text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          DATABASE DISCONNECTED: Application is in read-only/degraded mode. Check MySQL configuration.
        </div>
      )}
      <Dashboard user={user} token={token} onLogout={handleLogout} />
    </div>
  );
}
