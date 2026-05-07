import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Ship, 
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
  Package,
  Save,
  Monitor,
  Play,
  Pause,
  ChevronLeft,
  Shield,
  ShieldAlert,
  Compass,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isBefore, addDays, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PDFViewer } from './components/PDFViewer';
import { OCRHighlightOverlay } from './components/OCRHighlightOverlay';

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

const DeviceRegistration = ({ user, token, onLogout }: { user: User, token: string, onLogout: () => void }) => {
  const [deviceCode, setDeviceCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'checking'>('idle');
  const [error, setError] = useState('');
  const deviceId = getDeviceId();

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/device/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.is_verified && data.device_id === deviceId) {
        window.location.reload(); // Reload to refresh user state
      } else if (data.has_pending_request) {
        setStatus('pending');
      }
    } catch (e) {}
  }, [token, deviceId]);

  useEffect(() => {
    // Generate a random 6-character code if not set
    if (!deviceCode) {
      setDeviceCode(Math.random().toString(36).substring(2, 8).toUpperCase());
    }
    
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [deviceCode, checkStatus]);

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
                Provide this code to your TEAM PIC or Admin to verify your device.
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

interface DeviceRegistrationRequest {
  id: number;
  user_id: number;
  username: string;
  vessel_name: string;
  device_code: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
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

const Logo = ({ className }: { className?: string }) => (
  <img 
    src="/logo.png" 
    alt="COMOS Logo" 
    className={cn("object-contain", className)}
    referrerPolicy="no-referrer"
    onError={(e) => {
      // Fallback to Ship icon if image fails to load
      e.currentTarget.style.display = 'none';
      const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
      if (fallback) (fallback as HTMLElement).style.display = 'block';
    }}
  />
);

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
      <Logo className="w-full h-full" />
      <div className="logo-fallback hidden">
        <Ship className={cn(
          iconClassName || "text-blue-600", 
          size === 'xs' ? "w-4 h-4" : size === 'sm' ? "w-6 h-6" : size === 'md' ? "w-8 h-8" : "w-12 h-12"
        )} />
      </div>
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

const fileToDataPart = async (file: File) => {
  return new Promise<{ inlineData: { data: string, mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const recognizeCertText = async (file: File) => {
  if (!isGeminiSupportedMimeType(file.type)) {
    console.warn(`OCR skipped: MIME type ${file.type} is not supported by Gemini multimodal input.`);
    return {};
  }
  const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
  const dataPart = await fileToDataPart(file);
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        dataPart,
        { text: `Extract certificate information with high precision for spatial alignment.
          For each field, return the extracted "value" and a "rect" object.
          
          SPATIAL COORDINATE RULES (0-1000 scale):
          - "rect": {"ymin": int, "xmin": int, "ymax": int, "xmax": int}
          - 0 is TOP, 1000 is BOTTOM. 0 is LEFT, 1000 is RIGHT.
          - CRITICAL: The rect MUST be a tight bounding box that matches the exact visual position of the text segments extracted as the "value".
          - Do NOT include labels (e.g., skip the "Name:" label and only rect the actual name content).
          - Vertical alignment: Ensure ymin and ymax tightly hug the text characters.
          
          FIELDS:
          - vessel_name: The official Vessel Name found on the document (e.g. "LIGNUM NETWORK").
          - cert_type: The title or type of the certificate (e.g. "Safety Management Certificate", "Class Certificate").
          - certificate_number: The unique certificate number.
          - date_issued: Issue date (YYYY-MM-DD).
          - expiration_date: Expiration date (YYYY-MM-DD).

          If a field is missing, return null for both value and rect.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vessel_name: { type: Type.STRING, nullable: true },
          vessel_rect: { 
            type: Type.OBJECT, 
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER }
            },
            description: "Bounding box of the vessel name value", 
            nullable: true 
          },
          cert_type: { type: Type.STRING, nullable: true },
          cert_type_rect: { 
            type: Type.OBJECT, 
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER }
            },
            description: "Bounding box of the certificate title", 
            nullable: true 
          },
          certificate_number: { type: Type.STRING, nullable: true },
          number_rect: { 
            type: Type.OBJECT, 
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER }
            },
            description: "Bounding box of the certificate number value", 
            nullable: true 
          },
          date_issued: { type: Type.STRING, description: "YYYY-MM-DD", nullable: true },
          issued_rect: { 
            type: Type.OBJECT, 
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER }
            },
            description: "Bounding box of the issue date value", 
            nullable: true 
          },
          expiration_date: { type: Type.STRING, description: "YYYY-MM-DD", nullable: true },
          expiration_rect: { 
            type: Type.OBJECT, 
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER }
            },
            description: "Bounding box of the expiration date value", 
            nullable: true 
          }
        }
      }
    }
  });
  
  try {
    const text = response.text || '';
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(jsonStr);
    console.log("Gemini OCR Result:", data);
    return data;
  } catch (e) {
    console.error("Failed to parse Gemini response:", e, response.text);
    return {};
  }
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
  view, setView, setIsSidebarOpen, user, isAdminTreeOpen, setIsAdminTreeOpen, onLogout, setIsChangePasswordOpen 
}: { 
  view: string, 
  setView: (v: any) => void, 
  setIsSidebarOpen: (v: boolean) => void, 
  user: User, 
  isAdminTreeOpen: boolean, 
  setIsAdminTreeOpen: (v: boolean) => void,
  onLogout: () => void,
  setIsChangePasswordOpen: (v: boolean) => void
}) => (
  <>
    <button 
      onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
      className="p-6 flex items-center gap-3 hover:opacity-80 transition-opacity text-left w-full"
    >
      <LogoContainer size="sm" className="border-none shadow-none" />
      <span className="font-bold text-lg tracking-tight text-blue-900">COMOS</span>
    </button>
    
    <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
      <button 
        onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
          view === 'dashboard' ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-800" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        <Clock className="w-4 h-4" /> Dashboard
      </button>
      {user.role !== 'vessel' && (
        <button 
          onClick={() => { setView('vessels'); setIsSidebarOpen(false); }}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
            view === 'vessels' ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-800" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
          )}
        >
          <Ship className="w-4 h-4" /> Vessels
        </button>
      )}
      <button 
        onClick={() => { setView('routing'); setIsSidebarOpen(false); }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
          view === 'routing' ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-800" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        <Compass className="w-4 h-4" /> Vessel Routing
      </button>
      {user.role === 'vessel' && (
        <>
          <button 
            onClick={() => { setView('departure'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              view === 'departure' ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-800" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
            )}
          >
            <Navigation className="w-4 h-4" /> Departure
          </button>
          <button 
            onClick={() => { setView('arrival'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              view === 'arrival' ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-800" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
            )}
          >
            <MapIcon className="w-4 h-4" /> Arrival
          </button>
          <button 
            onClick={() => { setView('noon_to_noon'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              view === 'noon_to_noon' ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-800" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
            )}
          >
            <Clock className="w-4 h-4" /> Noon to Noon
          </button>
          {user.role !== 'vessel' && (
            <button 
              onClick={() => { setView('fuel_consumption'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                view === 'fuel_consumption' ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-800" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
              )}
            >
              <Activity className="w-4 h-4" /> Fuel Consumption
            </button>
          )}
        </>
      )}
      {user.role === 'admin' || user.role === 'team_pic' || user.role === 'vessel' ? (
        <div className="space-y-1">
          <button 
            onClick={() => setIsAdminTreeOpen(!isAdminTreeOpen)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              view.startsWith('admin') ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
            )}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4" /> Admin Panel
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isAdminTreeOpen ? "rotate-180" : "")} />
          </button>
          
          <AnimatePresence>
            {isAdminTreeOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-4 space-y-1"
              >
                {user.role !== 'vessel' && (
                  <button 
                    onClick={() => { setView('admin_new_vessel'); setIsSidebarOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors",
                      view === 'admin_new_vessel' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                    )}
                  >
                    <Plus className="w-3 h-3" /> New Vessel
                  </button>
                )}
                <button 
                  onClick={() => { setView('admin_add_cert'); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors",
                    view === 'admin_add_cert' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                  )}
                >
                  <Plus className="w-3 h-3" /> Add Certificate
                </button>
                {user.role !== 'vessel' && (
                  <button 
                    onClick={() => { setView('admin_vessel_list'); setIsSidebarOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors",
                      view === 'admin_vessel_list' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                    )}
                  >
                    <Ship className="w-3 h-3" /> Vessel List
                  </button>
                )}
                <button 
                  onClick={() => { setView('admin_cert_list'); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors",
                    view === 'admin_cert_list' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                  )}
                >
                  <FileText className="w-3 h-3" /> Certificate List
                </button>
                <button 
                  onClick={() => { setView('admin'); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors",
                    view === 'admin' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                  )}
                >
                  <Settings className="w-3 h-3" /> All Admin Settings
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}
      <button 
        onClick={() => { setView('slideshow'); setIsSidebarOpen(false); }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
          view === 'slideshow' ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-800" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        <Monitor className="w-4 h-4" /> Slideshow
      </button>
    </nav>

    <div className="p-4 border-t border-blue-50">
      <button 
        onClick={() => { setIsChangePasswordOpen(true); setIsSidebarOpen(false); }}
        className="w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-xl hover:bg-blue-50 transition-colors text-left group"
      >
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 group-hover:bg-blue-200 transition-colors">
          {user.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{user.username}</p>
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{user.role}</p>
        </div>
        <Settings className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
      </button>
      <button 
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" /> Logout
      </button>
    </div>
  </>
);

const Dashboard = ({ user, token, onLogout }: { user: User, token: string, onLogout: () => void }) => {
  const [view, setView] = useState<'dashboard' | 'vessels' | 'routing' | 'admin' | 'slideshow' | 'departure' | 'arrival' | 'noon_to_noon' | 'fuel_consumption' | 'admin_vessel_list' | 'admin_cert_list' | 'admin_new_vessel' | 'admin_add_cert'>('dashboard');
  const [isAdminTreeOpen, setIsAdminTreeOpen] = useState(false);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [departureReports, setDepartureReports] = useState<DepartureReport[]>([]);
  const [arrivalReports, setArrivalReports] = useState<ArrivalReport[]>([]);
  const [noonReports, setNoonReports] = useState<NoonReport[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [newNote, setNewNote] = useState('');
  const [search, setSearch] = useState('');
  const [newExpDate, setNewExpDate] = useState('');
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [vesselCertSearch, setVesselCertSearch] = useState('');
  const [vesselSearch, setVesselSearch] = useState('');
  const [vesselSortField, setVesselSortField] = useState<'name' | 'team' | 'owner'>('name');
  const [vesselSortOrder, setVesselSortOrder] = useState<'asc' | 'desc'>('asc');
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
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
  const [ocrHighlights, setOcrHighlights] = useState<any[]>([]);
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
        cargo: v.cargo || ''
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
    setNotifications(prev => [...prev, { id, type, message }]);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const fetchData = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [certsRes, vesselsRes, teamsRes] = await Promise.all([
        fetch('/api/certificates', { headers }),
        fetch('/api/vessels', { headers }),
        fetch('/api/teams', { headers }),
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
          const text = await res.text();
          console.error(`Expected JSON for ${name} but got ${contentType}:`, text.substring(0, 100));
        }
      };

      await Promise.all([
        processResponse(certsRes, setCerts, 'certificates'),
        processResponse(vesselsRes, setVessels, 'vessels'),
        processResponse(teamsRes, setTeams, 'teams'),
      ]);
    } catch (err) {
      console.error('Failed to fetch data:', err);
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
      setOcrHighlights([]);
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
        const filesData = await filesRes.json();
        setFiles(filesData);
        // Set the latest file as the initial preview only if not refreshing or if none selected
        if (filesData.length > 0 && (!isRefresh || !previewFile)) {
          setPreviewFile([...filesData].sort((a: any, b: any) => b.id - a.id)[0]);
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

  const handleUpdateCert = async () => {
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
        notify('success', 'Certificate fields updated successfully');
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
    const formData = new FormData();
    formData.append('file', file);
    
    const isSupported = isGeminiSupportedMimeType(file.type);
    if (isSupported) {
      setIsRecognizing(true);
    }
    setOcrHighlights([]);
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
        
        const reader = new FileReader();
        reader.onload = (re) => {
          setTempPreviewUrl(re.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Fetch refreshed details
        fetchCertDetails(selectedCert, true);
        
        // 2. Perform OCR recognition
        if (isSupported) {
          try {
            const ocrData = await recognizeCertText(file);
            
            // Prepare highlights from the rects
            const highlights = [];
            const toArr = (r: any) => r ? [r.ymin, r.xmin, r.ymax, r.xmax] : null;

            if (ocrData.vessel_rect) highlights.push({ label: 'Vessel', rect: toArr(ocrData.vessel_rect), value: ocrData.vessel_name });
            if (ocrData.cert_type_rect) highlights.push({ label: 'Cert Name', rect: toArr(ocrData.cert_type_rect), value: ocrData.cert_type });
            if (ocrData.number_rect) highlights.push({ label: 'Cert No', rect: toArr(ocrData.number_rect), value: ocrData.certificate_number });
            if (ocrData.issued_rect) highlights.push({ label: 'Issued', rect: toArr(ocrData.issued_rect), value: ocrData.date_issued });
            if (ocrData.expiration_rect) highlights.push({ label: 'Expiry', rect: toArr(ocrData.expiration_rect), value: ocrData.expiration_date });
            
            setOcrHighlights(highlights);

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
              notify('success', 'Information recognized and autofilled. Bounding boxes are highlighted in the preview.');
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
        } else {
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
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch('/api/departure-reports', { headers });
      if (res.ok) {
        setDepartureReports(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch departure reports:', err);
    }
  }, [token]);

  const fetchArrivalReports = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch('/api/arrival-reports', { headers });
      if (res.ok) {
        setArrivalReports(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch arrival reports:', err);
    }
  }, [token]);

  const fetchNoonReports = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await fetch('/api/noon-reports', { headers });
      if (res.ok) {
        setNoonReports(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch noon reports:', err);
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
    if (view === 'fuel_consumption') {
      fetchDepartureReports();
      fetchArrivalReports();
    }
  }, [view, fetchDepartureReports, fetchArrivalReports, fetchNoonReports]);

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
          {view === 'dashboard' && (
            <div className="space-y-8">
              <header>
                <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Fleet Overview</h1>
                <p className="text-slate-500">Monitor certificate statuses and upcoming expirations.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-red-50 rounded-lg group-hover:scale-110 transition-transform"><AlertTriangle className="text-red-500 w-4 h-4" /></div>
                    <span className="text-xl font-bold text-slate-900">{certs.filter(c => getStatus(c.expiration_date) === 'expired').length}</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expired</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-orange-50 rounded-lg group-hover:scale-110 transition-transform"><Clock className="text-orange-500 w-4 h-4" /></div>
                    <span className="text-xl font-bold text-slate-900">{certs.filter(c => getStatus(c.expiration_date) === 'expiring soon').length}</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expiring soon</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-amber-50 rounded-lg group-hover:scale-110 transition-transform"><Clock className="text-amber-500 w-4 h-4" /></div>
                    <span className="text-xl font-bold text-slate-900">{certs.filter(c => getStatus(c.expiration_date) === 'expiring').length}</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expiring</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-blue-50 rounded-lg group-hover:scale-110 transition-transform"><CheckCircle2 className="text-blue-500 w-4 h-4" /></div>
                    <span className="text-xl font-bold text-slate-900">{certs.filter(c => getStatus(c.expiration_date) === 'active').length}</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valid</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-blue-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="font-bold text-slate-900">All Certificates</h2>
                  <div className="flex items-center gap-2">
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
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-blue-50/30 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        <th className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('vessel_name')}>
                          <div className="flex items-center">Vessel / Team {getSortIcon('vessel_name')}</div>
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => requestSort('name')}>
                          <div className="flex items-center">Certificate Name {getSortIcon('name')}</div>
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
                        <tr key={cert.id} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-6 py-4 font-medium text-sm">
                            {cert.vessel_id ? (
                              <button 
                                onClick={() => {
                                  const vessel = vessels.find(v => v.id === cert.vessel_id);
                                  if (vessel) setSelectedVessel(vessel);
                                }}
                                className="text-left hover:text-blue-600 hover:underline transition-colors"
                              >
                                {cert.vessel_name}
                              </button>
                            ) : (
                              <span className="text-blue-600 italic">Other ({cert.team_name})</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button 
                              onClick={() => fetchCertDetails(cert)}
                              className="text-left hover:text-blue-600 hover:underline transition-colors"
                            >
                              {cert.name}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono">
                            <button 
                              onClick={() => fetchCertDetails(cert)}
                              className="hover:text-blue-600 hover:underline transition-colors"
                            >
                              {cert.expiration_date}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => fetchCertDetails(cert)}
                              className="hover:opacity-80 transition-opacity"
                            >
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                getStatus(cert.expiration_date) === 'expired' ? "bg-red-100 text-red-700" :
                                getStatus(cert.expiration_date) === 'expiring soon' ? "bg-orange-100 text-orange-700" :
                                getStatus(cert.expiration_date) === 'expiring' ? "bg-amber-100 text-amber-700" :
                                "bg-blue-100 text-blue-700"
                              )}>
                                {getStatus(cert.expiration_date)}
                              </span>
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => fetchCertDetails(cert)}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
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
                    <select 
                      value={vesselSortField}
                      onChange={(e) => setVesselSortField(e.target.value as any)}
                      className="px-3 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                    >
                      <option value="name">Name</option>
                      <option value="team">Team</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button 
                      onClick={() => setVesselSortOrder(vesselSortOrder === 'asc' ? 'desc' : 'asc')}
                      className="p-2 bg-white border border-blue-100 hover:bg-blue-50 rounded-xl text-blue-600 transition-colors shadow-sm"
                      title={vesselSortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
                    >
                      {vesselSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {(user.role === 'admin' || user.role === 'team_pic') && (
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
                  .filter(v => v.name.toLowerCase().includes(vesselSearch.toLowerCase()))
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
                  <div key={vessel.id} className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
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
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-blue-50 pb-2 mb-2">
                        <span>Route Status</span>
                        <span className="text-blue-600">{vessel.route_status || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Next Port</span>
                        <span className="font-bold text-slate-900 truncate max-w-[120px]">{vessel.next_port || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Total Certificates</span>
                        <span className="font-bold text-slate-900">{certs.filter(c => c.vessel_id === vessel.id).length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Expiring/Expired</span>
                        <span className="text-red-500 font-bold">
                          {certs.filter(c => c.vessel_id === vessel.id && getStatus(c.expiration_date) !== 'active').length}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedVessel(vessel)}
                      className="w-full mt-6 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view.startsWith('admin') && (
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
              setTempPreviewUrl={setTempPreviewUrl}
              setOcrHighlights={setOcrHighlights}
              isRecognizing={isRecognizing}
              setIsRecognizing={setIsRecognizing}
              subView={view}
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
            />
          )}

          {view === 'noon_to_noon' && (
            <NoonToNoonView
              user={user}
              token={token}
              vessels={vessels}
              reports={noonReports}
              onRefresh={fetchNoonReports}
              notify={notify}
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
                            <th className="px-6 py-3 w-36">Status</th>
                            <th className="px-6 py-3 w-44">ETA / ATB (UTC)</th>
                            <th className="px-6 py-3 w-44">ETD / ATD (UTC)</th>
                            <th className="px-6 py-3 min-w-[350px]">Cargo</th>
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
                                  <input 
                                    type="text"
                                    value={form.route_status || ''}
                                    onChange={e => handleUpdateRoutingRow(v.id, 'route_status', e.target.value)}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    placeholder="Status"
                                  />
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
          )}

          {view === 'slideshow' && (
            <div className="h-[calc(100vh-64px)]">
              <SlideshowView vessels={vessels} certs={certs} token={token} />
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
                          <input 
                            type="text"
                            value={routeForm.route_status}
                            onChange={e => setRouteForm({...routeForm, route_status: e.target.value})}
                            placeholder="e.g. In Transit"
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
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
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">ETD / ATD (UTC)</label>
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
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ETD / ATD (UTC)</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.etd_atd ? selectedVessel.etd_atd.replace('T', ' ') : 'Not Set'}</p>
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
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">Certificate Summary</h3>
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
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vessel Certificates</h3>
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
                          <span className="font-bold text-sm text-slate-900">{cert.name}</span>
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

        {(selectedCert || previewFile) && (
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
                          href={tempPreviewUrl || `/api/files/${encodeURIComponent(previewFile.filename)}?token=${token}`}
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
                      const fileUrl = tempPreviewUrl || `/api/files/${encodeURIComponent(previewFile.filename)}?token=${token}`;

                      if (isImage) {
                        return (
                          <div className="relative group overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/30 h-[600px] flex items-center justify-center p-8 bg-grid-slate-100/5 backdrop-blur-sm">
                            <div className="relative inline-grid place-items-center max-w-full max-h-full shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
                              <img 
                                src={fileUrl} 
                                alt={previewFile.original_name} 
                                className="max-w-full max-h-full block w-auto h-auto rounded-sm ring-1 ring-black/5"
                                referrerPolicy="no-referrer"
                              />
                              {ocrHighlights.length > 0 && <OCRHighlightOverlay highlights={ocrHighlights} />}
                            </div>
                            <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <span className="text-white font-bold text-xs px-3 py-1.5 bg-blue-600/80 rounded-lg backdrop-blur-sm">Full Size View Available</span>
                            </div>
                          </div>
                        );
                      } else if (isPdf) {
                        return (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 overflow-hidden h-[600px] relative">
                            <PDFViewer 
                              url={fileUrl} 
                              title={previewFile.original_name} 
                              highlights={ocrHighlights}
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
                        onChange={(e) => setSelectedCert({...selectedCert, certificate_number: e.target.value})}
                        className="w-full px-4 py-2 bg-blue-50/50 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="N/A"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Date Issued</label>
                        <input 
                          type="date" 
                          value={selectedCert.date_issued || ''}
                          onChange={(e) => setSelectedCert({...selectedCert, date_issued: e.target.value})}
                          className="w-full px-4 py-2 bg-blue-50/50 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Expiration Date</label>
                        <input 
                          type="date" 
                          value={newExpDate}
                          onChange={(e) => setNewExpDate(e.target.value)}
                          className="w-full px-4 py-2 bg-blue-50/50 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleUpdateCert}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save All Changes
                    </button>
                  </div>
                )}

                {selectedCert && <div className="h-px bg-blue-50" />}

                {/* Files Section */}
                {selectedCert && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Documents</label>
                      <label className="cursor-pointer flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline">
                        <Upload className="w-3 h-3" /> Upload File
                        <input type="file" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>
                    <div className="space-y-2">
                    {files.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No documents uploaded yet.</p>
                    ) : (
                      files.map(file => (
                        <div 
                          key={file.id} 
                          onClick={() => {
                            setPreviewFile(file);
                            if (sidePanelContentRef.current) {
                              sidePanelContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl group cursor-pointer transition-all",
                            previewFile?.id === file.id ? "bg-blue-100 border-blue-200" : "bg-blue-50/50 hover:bg-blue-100/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <File className={cn("w-4 h-4", previewFile?.id === file.id ? "text-blue-600" : "text-slate-400")} />
                            <span className={cn("text-sm font-medium", previewFile?.id === file.id ? "text-blue-900" : "text-slate-900")}>{file.original_name}</span>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a 
                              href={`/api/files/${file.filename}?token=${token}`} 
                              target="_blank" 
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] font-bold text-blue-600 hover:underline px-2 py-1 bg-white rounded-lg shadow-sm"
                            >
                              Download
                            </a>
                            {(user?.role === 'admin' || user?.role === 'team_pic') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFile(file.id);
                                }}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete File"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
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
    </div>
  );
};

const SlideshowView = ({ vessels, certs, token }: { vessels: Vessel[], certs: Certificate[], token: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [cachedImages, setCachedImages] = useState<Record<number, string>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const slideDuration = 10000; // 10 seconds per slide

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
      if (isKioskMode && e.key === 'Escape') {
        exitKioskMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKioskMode]);

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
                  { icon: Clock, label: 'ETA / ATB (UTC)', value: vessel.eta_atb || 'NOT SET', color: 'amber' },
                  { icon: Anchor, label: 'ETD / ATD (UTC)', value: vessel.etd_atd || 'NOT SET', color: 'purple' },
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

            {/* Right Column: Urgent Certificates */}
            <div className="space-y-6 max-w-sm w-full">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 drop-shadow-md">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Urgent Certificates
                </h3>
              </div>

              <div className="space-y-2">
                {vesselCerts.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="p-12 text-center bg-black/40 rounded-3xl border border-white/10 border-dashed backdrop-blur-md"
                  >
                    <CheckCircle2 className="w-12 h-12 text-green-500/20 mx-auto mb-4" />
                    <p className="text-slate-300 italic">No expiring or expired certificates.</p>
                  </motion.div>
                ) : (
                  vesselCerts.map((cert, idx) => (
                    <motion.div 
                      key={cert.id} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + (idx * 0.05) }}
                      className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/10 hover:bg-black/60 transition-all backdrop-blur-md group/item"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="text-sm font-bold text-white truncate group-hover/item:text-blue-400 transition-colors">{cert.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Expires: {cert.expiration_date}</p>
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
          </motion.div>
        </AnimatePresence>
      </div>

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

const NoonToNoonView = ({ user, token, vessels, reports, onRefresh, notify }: { 
  user: User, 
  token: string, 
  vessels: Vessel[], 
  reports: NoonReport[],
  onRefresh: () => void,
  notify: (type: 'success' | 'error', message: string) => void
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
    voyage_number: ''
  };
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

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
        if (key === 'utc_date_time') {
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
      rob_mdo: String(report.rob_mdo)
    });
    setActiveTab('form');
  };

  const selectedVesselName = vessels.find(v => String(v.id) === String(form.vessel_id))?.name || 'Unknown Vessel';

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Noon to Noon</h1>
          <p className="text-slate-500">Track daily vessel position and fuel consumption.</p>
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Scanned ROB Report</label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-100/50 transition-colors">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-700">{file ? file.name : 'Upload Report'}</span>
                      <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
                      <span>Current ROB / FOC (Auto Computed)</span>
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
                          <div className="w-24 px-2 py-1.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center justify-center" title="Consumption based on previous report ROB">
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
        <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="px-6 py-4">Date & Time (UTC)</th>
                  <th className="px-6 py-4">Vessel</th>
                  <th className="px-6 py-4">Voyage</th>
                  <th className="px-6 py-4">Position</th>
                  <th className="px-6 py-4">DTG</th>
                  <th className="px-6 py-4">Cargo</th>
                  <th className="px-6 py-4">HSFO ROB</th>
                  <th className="px-6 py-4">Daily FOC (HSFO)</th>
                  <th className="px-6 py-4">Attachment</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-sm">
                {reports.map(report => (
                  <tr key={report.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono">{format(parseISO(report.utc_date_time), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 font-bold">{report.vessel_name}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{report.voyage_number || '-'}</td>
                    <td className="px-6 py-4 font-mono text-xs">{report.position_lat} / {report.position_long}</td>
                    <td className="px-6 py-4">{report.distance_to_go} nm</td>
                    <td className="px-6 py-4 uppercase text-[10px] font-bold text-slate-500">{report.cargo_status}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{report.rob_hsfo}</td>
                    <td className="px-6 py-4 font-mono text-blue-600">-{report.foc_hsfo}</td>
                    <td className="px-6 py-4">
                      {report.attachment_id && (
                        <a 
                          href={`/api/noon-attachments/${report.attachment_id}?token=${token}`}
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
                      <button 
                        onClick={() => handleEdit(report)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Report"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No noon reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const ArrivalView = ({ user, token, vessels, reports, departureReports, onRefresh, notify }: { 
  user: User, 
  token: string, 
  vessels: Vessel[], 
  reports: ArrivalReport[],
  departureReports: DepartureReport[],
  onRefresh: () => void,
  notify: (type: 'success' | 'error', message: string) => void
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

  const selectedVesselName = vessels.find(v => String(v.id) === String(form.vessel_id))?.name || 'Unknown Vessel';

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
                      <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
                      <span>Arr. ROB / FOC</span>
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
                          <div className="w-20 px-2 py-1.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center justify-center">
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
        <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="px-6 py-4">Date & Time (UTC)</th>
                  <th className="px-6 py-4">Vessel</th>
                  <th className="px-6 py-4">Voyage</th>
                  <th className="px-6 py-4">Port</th>
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
                {reports.map(report => (
                  <tr key={report.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono">{format(parseISO(report.utc_date_time), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 font-bold">{report.vessel_name}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{report.voyage_number || '-'}</td>
                    <td className="px-6 py-4">{report.arrival_port}</td>
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
                          href={`/api/arrival-attachments/${report.attachment_id}?token=${token}`}
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
                      <button 
                        onClick={() => handleEdit(report)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Report"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No arrival reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const DepartureView = ({ user, token, vessels, reports, onRefresh, notify }: { 
  user: User, 
  token: string, 
  vessels: Vessel[], 
  reports: DepartureReport[],
  onRefresh: () => void,
  notify: (type: 'success' | 'error', message: string) => void
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

  const selectedVesselName = vessels.find(v => String(v.id) === String(form.vessel_id))?.name || 'Unknown Vessel';

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
                      <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
                      <span>Dep. ROB / FOC</span>
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
                          <div className="w-20 px-2 py-1.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center justify-center">
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
        <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="px-6 py-4">Date & Time (UTC)</th>
                  <th className="px-6 py-4">Vessel</th>
                  <th className="px-6 py-4">Voyage</th>
                  <th className="px-6 py-4">Port</th>
                  <th className="px-6 py-4">Operation</th>
                  <th className="px-6 py-4">HSFO Departure</th>
                  <th className="px-6 py-4">FOC Port</th>
                  <th className="px-6 py-4">Attachment</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-sm">
                {reports.map(report => (
                  <tr key={report.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono">{format(parseISO(report.utc_date_time), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 font-bold">{report.vessel_name}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{report.voyage_number || '-'}</td>
                    <td className="px-6 py-4">{report.departure_port}</td>
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
                          href={`/api/departure-attachments/${report.attachment_id}?token=${token}`}
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
                      <button 
                        onClick={() => handleEdit(report)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Report"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No departure reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPanel = ({ 
  token, teams, vessels, certs, setCerts, onRefresh, notify,
  previewFile, setPreviewFile, setTempPreviewUrl, setOcrHighlights, isRecognizing, setIsRecognizing,
  subView
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
  setTempPreviewUrl: (url: string | null) => void,
  setOcrHighlights: (highlights: any[]) => void,
  isRecognizing: boolean,
  setIsRecognizing: (val: boolean) => void,
  subView?: string
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newVesselName, setNewVesselName] = useState('');
  const [newVesselTeam, setNewVesselTeam] = useState('');
  const [newVesselOwner, setNewVesselOwner] = useState('Nissen');
  const [newVesselPhoto, setNewVesselPhoto] = useState<File | null>(null);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [editingVesselPhoto, setEditingVesselPhoto] = useState<File | null>(null);
  const [newCertName, setNewCertName] = useState('');
  const [newCertVessel, setNewCertVessel] = useState('');
  const [newCertTeam, setNewCertTeam] = useState('');
  const [newCertExp, setNewCertExp] = useState('');
  const [newCertIssueDate, setNewCertIssueDate] = useState('');
  const [newCertNumber, setNewCertNumber] = useState('');
  // const [isRecognizing, setIsRecognizing] = useState(false); // Remove local state
  const [newCertAccessType, setNewCertAccessType] = useState<'office' | 'vessel' | 'any'>('office');
  const [newCertFile, setNewCertFile] = useState<File | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [deviceRequests, setDeviceRequests] = useState<DeviceRegistrationRequest[]>([]);
  const [adminTab, setAdminTab] = useState<'fleet' | 'users' | 'settings' | 'audit' | 'devices'>('fleet');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const itemsPerPage = 20;
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [vesselSearch, setVesselSearch] = useState('');
  const [vesselSortField, setVesselSortField] = useState<'name' | 'team' | 'owner'>('name');
  const [vesselSortOrder, setVesselSortOrder] = useState<'asc' | 'desc'>('asc');
  const [certSearch, setCertSearch] = useState('');
  const [certSortField, setCertSortField] = useState<'name' | 'vessel' | 'expiration_date'>('expiration_date');
  const [certSortOrder, setCertSortOrder] = useState<'asc' | 'desc'>('asc');
  const [systemTime, setSystemTime] = useState<{ time: string, timezone: string } | null>(null);
  const user = JSON.parse(atob(token.split('.')[1]));
  const isAdmin = user.role === 'admin';
  const isTeamPic = user.role === 'team_pic';
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
      const res = await fetch('/api/admin/device-requests', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setDeviceRequests(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch device requests:', err);
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

  // Add User State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user' | 'vessel' | 'team_pic'>('user');
  const [newUserTeams, setNewUserTeams] = useState<number[]>([]);
  const [newUserVessel, setNewUserVessel] = useState<number | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');

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

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    try {
      const res = await fetch('/api/admin/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          host: settings.SMTP_HOST,
          port: settings.SMTP_PORT,
          user: settings.SMTP_USER,
          pass: settings.SMTP_PASS,
          from: settings.SMTP_FROM
        }),
      });
      if (res.ok) {
        notify('success', 'SMTP test email sent successfully! Check your inbox.');
      } else {
        const data = await res.json();
        notify('error', `SMTP Test Failed: ${data.error}`);
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
        onRefresh();
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
            onRefresh();
          } else {
            notify('error', 'Failed to delete vessel');
          }
        } catch (err) {
          notify('error', 'Connection error occurred');
        }
      }
    });
  };

  const handleAddCert = async () => {
    const vesselId = editingCert ? editingCert.vessel_id : (isVessel ? user.vessel_id : newCertVessel);
    const teamId = editingCert ? editingCert.team_id : newCertTeam;
    const name = editingCert ? editingCert.name : newCertName;
    const certNumber = editingCert ? editingCert.certificate_number : newCertNumber;
    const issueDate = editingCert ? editingCert.date_issued : newCertIssueDate;
    const expDate = editingCert ? editingCert.expiration_date : newCertExp;
    const accessType = editingCert ? editingCert.access_type : (isVessel ? 'vessel' : newCertAccessType);

    if (!name || (!vesselId && !teamId) || !expDate) {
      notify('error', 'Certificate name, expiration date, and either a vessel or team are required');
      return;
    }
    try {
      const url = editingCert ? `/api/certificates/${editingCert.id}` : '/api/certificates';
      const method = editingCert ? 'PUT' : 'POST';
      
      let res;
      if (editingCert) {
        res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ 
            vessel_id: vesselId === 'all' ? 'all' : (vesselId ? Number(vesselId) : null), 
            team_id: teamId ? Number(teamId) : null,
            name: name, 
            certificate_number: certNumber,
            date_issued: issueDate,
            expiration_date: expDate,
            access_type: accessType
          }),
        });
      } else {
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
        }

        res = await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      if (res.ok) {
        notify('success', editingCert ? 'Certificate updated successfully' : 'Certificate(s) assigned successfully');
        if (editingCert) {
          setCerts(prev => prev.map(c => c.id === editingCert.id ? { ...c, expiration_date: expDate || c.expiration_date, date_issued: issueDate, certificate_number: certNumber, name: name || c.name } : c));
        }
        setNewCertName('');
        setNewCertNumber('');
        setNewCertIssueDate('');
        setNewCertExp('');
        setNewCertVessel('');
        setNewCertTeam('');
        setNewCertAccessType('office');
        setNewCertFile(null);
        setEditingCert(null);
        onRefresh();
      } else {
        notify('error', editingCert ? 'Failed to update certificate' : 'Failed to assign certificate');
      }
    } catch (err) {
      notify('error', 'Connection error occurred');
    }
  };

  const handleDeleteCert = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Certificate',
      message: 'Are you sure you want to delete this certificate?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/certificates/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            notify('success', 'Certificate deleted successfully');
            onRefresh();
          } else {
            notify('error', 'Failed to delete certificate');
          }
        } catch (err) {
          notify('error', 'Connection error occurred');
        }
      }
    });
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
          email: email
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
          </div>
        </header>
      )}

      {subView && subView !== 'admin' && (
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
            {subView === 'admin_new_vessel' && 'Add New Vessel'}
            {subView === 'admin_add_cert' && 'Add Certificate'}
            {subView === 'admin_vessel_list' && 'Vessel List'}
            {subView === 'admin_cert_list' && 'Certificate List'}
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
              (subView === 'admin_new_vessel' || subView === 'admin_add_cert') && "lg:grid-cols-1 max-w-2xl"
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
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Vessel Photo</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setNewVesselPhoto(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  <button 
                    onClick={handleAddVessel}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                  >
                    Add Vessel
                  </button>
                </div>
              </section>
            )}

            {/* Add Cert */}
            {((!subView || subView === 'admin') || subView === 'admin_add_cert') && (
              <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm h-full">
              <h2 className="font-bold mb-6 flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" /> Add Certificate to Vessel/Team
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
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Certificate Name</label>
                  <input 
                    type="text" 
                    placeholder="Certificate Name" 
                    value={newCertName}
                    onChange={(e) => setNewCertName(e.target.value)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Certificate Number</label>
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
                    <option value="vessel">Ship certificate</option>
                    {!isVessel && <option value="any">Any</option>}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Document (Optional)</label>
                    {isRecognizing && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 animate-pulse flex items-center gap-1">
                        <RefreshCw className="w-2 h-2 animate-spin" /> Recognizing...
                      </span>
                    )}
                  </div>
                  <input 
                    type="file" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0] || null;
                      setNewCertFile(file);
                      if (file) {
                        setIsRecognizing(true);
                        setOcrHighlights([]);
                        
                        // Set preview file (virtual)
                        setPreviewFile({
                          id: -1,
                          certificate_id: -1,
                          filename: file.name,
                          original_name: file.name,
                          upload_date: new Date().toISOString()
                        });

                        const reader = new FileReader();
                        reader.onload = (re) => {
                          setTempPreviewUrl(re.target?.result as string);
                        };
                        reader.readAsDataURL(file);

                        try {
                          const data = await recognizeCertText(file);
                          
                          // Prepare highlights
                          const highlights = [];
                          const toArr = (r: any) => r ? [r.ymin, r.xmin, r.ymax, r.xmax] : null;

                          if (data.vessel_rect) highlights.push({ label: 'Vessel', rect: toArr(data.vessel_rect), value: data.vessel_name });
                          if (data.cert_type_rect) highlights.push({ label: 'Cert Name', rect: toArr(data.cert_type_rect), value: data.cert_type });
                          if (data.number_rect) highlights.push({ label: 'Cert No', rect: toArr(data.number_rect), value: data.certificate_number });
                          if (data.issued_rect) highlights.push({ label: 'Issued', rect: toArr(data.issued_rect), value: data.date_issued });
                          if (data.expiration_rect) highlights.push({ label: 'Expiry', rect: toArr(data.expiration_rect), value: data.expiration_date });
                          
                          setOcrHighlights(highlights);

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
                    }}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {newCertFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewFile({
                          id: -1,
                          certificate_id: -1,
                          filename: newCertFile.name,
                          original_name: newCertFile.name,
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
                  Add Certificate
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Vessel List */}
      {((!subView || subView === 'admin') || subView === 'admin_vessel_list') && !isVessel && (
        <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm h-full">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold flex items-center gap-2 text-blue-900"><Ship className="w-5 h-5" /> Vessel List</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative w-32">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                      <input 
                        type="text" 
                        placeholder="Search..." 
                        value={vesselSearch}
                        onChange={(e) => setVesselSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-blue-50/50 border-none rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <select 
                      value={vesselSortField}
                      onChange={(e) => setVesselSortField(e.target.value as any)}
                      className="px-2 py-1.5 bg-blue-50/50 border-none rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="name">Name</option>
                      <option value="team">Team</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button 
                      onClick={() => setVesselSortOrder(vesselSortOrder === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 bg-blue-50/50 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                      title={vesselSortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
                    >
                      {vesselSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {[...vessels]
                    .filter(v => 
                      (v.name || '').toLowerCase().includes((vesselSearch || '').toLowerCase()) ||
                      (v.team_name && v.team_name.toLowerCase().includes((vesselSearch || '').toLowerCase()))
                    )
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
                    <div key={v.id} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl group">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
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
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <Ship className="w-4 h-4 text-blue-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{v.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{v.team_name || 'No Team'}</p>
                            <span className="text-slate-300">•</span>
                            <p className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              v.owner === 'Nissen' ? "text-purple-600" : "text-orange-600"
                            )}>{v.owner || 'Nissen'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingVessel(v)}
                          className="p-2 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteVessel(v.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
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

            {/* Cert List */}
            {((!subView || subView === 'admin') || subView === 'admin_cert_list') && (
              <section className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold flex items-center gap-2 text-blue-900"><FileText className="w-5 h-5" /> Certificate List</h2>
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
                  <div key={cert.id} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl group">
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
                      onClick={() => setEditingCert(cert)}
                      className="p-2 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {(isAdmin || isTeamPic) && (
                      <button 
                        onClick={() => handleDeleteCert(cert.id)}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
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
                <input 
                  type="password" 
                  placeholder="Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                />
                <input 
                  type="email" 
                  placeholder="Email Address (for Alerts)" 
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="grid grid-cols-2 gap-4">
                  <select 
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="user">User Role</option>
                    <option value="admin">Admin Role</option>
                    <option value="team_pic">Team PIC Role</option>
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
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{u.role}</p>
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

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">SMTP Email Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">SMTP Host</label>
                    <input 
                      type="text" 
                      placeholder="e.g. smtp.gmail.com" 
                      value={settings.SMTP_HOST || ''}
                      onChange={(e) => setSettings({...settings, SMTP_HOST: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">SMTP Port</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 587" 
                      value={settings.SMTP_PORT || ''}
                      onChange={(e) => setSettings({...settings, SMTP_PORT: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
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
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">SMTP User</label>
                    <input 
                      type="text" 
                      placeholder="e.g. user@example.com" 
                      value={settings.SMTP_USER || ''}
                      onChange={(e) => setSettings({...settings, SMTP_USER: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">SMTP Password</label>
                    <input 
                      type="password" 
                      placeholder="Enter password" 
                      value={settings.SMTP_PASS || ''}
                      onChange={(e) => setSettings({...settings, SMTP_PASS: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-4">
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
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Office Certificate Alert Schedule</h3>
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
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Ship Certificate Alert Schedule</h3>
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
                      <Mail className="w-5 h-5" /> Test SMTP & Send Alerts
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
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Sender Email (From)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. alerts@vesselcert.com" 
                      value={settings.SMTP_FROM || ''}
                      onChange={(e) => setSettings({...settings, SMTP_FROM: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
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
      )}

      {/* Modals */}
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
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[160] overflow-hidden"
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
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Vessel Photo (Optional)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setEditingVesselPhoto(e.target.files?.[0] || null)}
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
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[160] overflow-hidden"
              >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Edit Certificate</h3>
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
                        disabled={isVessel}
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
                        {!isVessel && <option value="">None</option>}
                        {vessels.filter(v => !isVessel || v.id === user.vessel_id).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Certificate Name</label>
                    <input 
                      type="text" 
                      placeholder="Certificate Name" 
                      value={editingCert.name}
                      onChange={(e) => setEditingCert({...editingCert, name: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Certificate Number</label>
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
                      disabled={isVessel}
                      onChange={(e) => setEditingCert({...editingCert, access_type: e.target.value as any})}
                      className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                    >
                      {!isVessel && <option value="office">Office Only</option>}
                      <option value="vessel">Ship certificate</option>
                      {!isVessel && <option value="any">Any</option>}
                    </select>
                  </div>
                  <button 
                    onClick={handleAddCert}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100"
                  >
                    Update Certificate
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}

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
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="team_pic">Team PIC</option>
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
                        <p className="text-[10px] text-blue-600 font-mono truncate max-w-[200px]">ID: {editingUser.device_id}</p>
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
    // Use user.device_id and user.is_verified from the user object set during handleLogin or loaded from localStorage
    if (!user.is_verified || user.device_id !== currentDeviceId) {
       return <DeviceRegistration user={user} token={token} onLogout={handleLogout} />;
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
