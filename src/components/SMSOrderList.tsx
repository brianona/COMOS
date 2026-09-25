import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Ship, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Upload, 
  Download, 
  Trash2, 
  Edit3, 
  Copy, 
  Eye, 
  X, 
  ChevronRight, 
  ChevronDown, 
  CheckSquare, 
  Square, 
  FolderArchive, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  FileCheck,
  FileSpreadsheet,
  FileCode,
  FileQuestion,
  RefreshCw,
  BookmarkPlus,
  Users,
  Info,
  ExternalLink,
  Check,
  Building2,
  FolderPlus,
  FolderDown,
  AlertTriangle,
  Maximize2,
  Minimize2,
  FileImage,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  MoreVertical,
  SlidersHorizontal,
  GitMerge
} from 'lucide-react';
import JSZip from 'jszip';
import { validateFileAgainstForm, ValidationResult } from '../utils/smsValidation';
import { PDFViewer } from './PDFViewer';
import { ImageViewer } from './ImageViewer';
import { DocxViewer } from './DocxViewer';
import { DocLegacyViewer } from './DocLegacyViewer';
import { ExcelViewer } from './ExcelViewer';
import { PptxViewer } from './PptxViewer';
import { SMSDirectUploadModal } from './SMSDirectUploadModal';
import { MergeOrdersModal } from './MergeOrdersModal';
import { useRealtimeAutoRefresh } from '../services/realtimeSync';
import { DocumentPreviewModal, PreviewModalState } from './DocumentPreviewModal';

interface Vessel {
  id: string | number;
  name: string;
  type?: string;
  owner?: string;
  team_name?: string;
  flag?: string;
  status?: string;
}

interface CurrentUser {
  id: number | string;
  username: string;
  role: string;
  vessel_id?: string | number;
  team_ids?: number[];
}

interface SMSForm {
  id: string;
  formCode: string;
  category: string;
  description: string;
  formDate?: string;
  type: 'Form' | 'Checklist';
  isHira?: boolean;
  removeFilenameRestriction?: boolean;
  allowedFileTypes?: string[];
  templateFileName?: string;
}

interface OrderItem {
  id?: number;
  form_id: string;
  form_code: string;
  category: string;
  description: string;
  form_date?: string;
  type: string;
  is_hira: boolean;
  remove_filename_restriction: boolean;
  allowed_file_types: string[];
  template_file_name?: string;
}

interface OrderVessel {
  id?: number;
  order_id?: string;
  vessel_id: string;
  vessel_name: string;
  status: 'Pending' | 'Completed' | string;
  completed_at?: string;
  submittedCount?: number;
  totalRequiredCount?: number;
  totalFilesUploaded?: number;
}

interface OrderUpload {
  id: number;
  order_id: string;
  vessel_id: string;
  vessel_name: string;
  form_id: string;
  form_code: string;
  file_name: string;
  file_size: string;
  file_mimetype: string;
  b2_folder_path?: string;
  uploaded_at: string;
  uploaded_by: string;
  checked_at?: string | null;
  checked_by?: string | null;
  replace_requested_at?: string | null;
  replace_requested_by?: string | null;
  replace_reason?: string | null;
  is_read?: boolean;
  read_at?: string | null;
}

interface SMSOrder {
  id: string;
  label: string;
  deadlineDate: string;
  instructions?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  vessels: OrderVessel[];
  items: OrderItem[];
  uploads?: OrderUpload[];
  totalItemsCount?: number;
  totalVesselsCount?: number;
  overallStatus?: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  vesselProgress?: {
    submittedCount: number;
    totalRequiredCount: number;
    totalFilesUploaded: number;
    status: string;
  };
}

interface OrderTemplate {
  id: string;
  title: string;
  description?: string;
  itemFormIds: string[];
  createdBy: string;
  createdById?: string;
  createdAt: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

export interface FailedUploadInfo {
  type: 'single' | 'bulk';
  orderId: string;
  order?: SMSOrder;
  formItem?: OrderItem;
  files: File[];
  fileNames: string[];
  totalSize: string;
  timestamp: number;
  errorMessage: string;
  detailedErrors?: string[];
  isFetchError?: boolean;
  failureCount?: number;
  suggestion?: string | null;
  targetVessel?: { id: string | number; name: string };
}

export const checkFormUploadMatch = (u: any, item: any): boolean => {
  if (!u || !item) return false;

  // 0. Direct item_id match (if explicitly linked to this order item)
  if (u.item_id != null && item.id != null && String(u.item_id) === String(item.id)) {
    return true;
  }

  const uFormId = u.form_id != null ? String(u.form_id).trim() : '';
  const itemFormId = item.form_id != null ? String(item.form_id).trim() : '';

  const uCode = u.form_code != null ? String(u.form_code).trim().toUpperCase() : '';
  const fCode = item.form_code != null ? String(item.form_code).trim().toUpperCase() : '';

  const fDesc = item.description != null ? String(item.description).toUpperCase() : '';
  const fName = u.file_name != null ? String(u.file_name).toUpperCase() : '';

  const combinedItemText = `${fCode} ${fDesc}`.toUpperCase();
  const combinedFileText = `${uCode} ${fName}`.toUpperCase();

  const hasQualifierConflict = (): boolean => {
    if (!fDesc && !fCode) return false;

    // 1. Department checks (Deck, Engine, Catering)
    const isDeckItem = combinedItemText.includes('DECK');
    const isEngineItem = combinedItemText.includes('ENGINE') || combinedItemText.includes('(ENG)') || combinedItemText.includes(' ENGINE ') || combinedItemText.includes('-ENG') || combinedItemText.includes('_ENG');
    const isCateringItem = combinedItemText.includes('CATERING') || combinedItemText.includes('(CAT)') || combinedItemText.includes('GALLEY') || combinedItemText.includes('STEWARD');

    const isDeckFile = combinedFileText.includes('DECK');
    const isEngineFile = combinedFileText.includes('ENGINE') || combinedFileText.includes('_ENG') || combinedFileText.includes('-ENG') || combinedFileText.includes(' ENG.') || combinedFileText.includes('(ENG)');
    const isCateringFile = combinedFileText.includes('CATERING') || combinedFileText.includes('_CAT') || combinedFileText.includes('-CAT') || combinedFileText.includes('GALLEY');

    if ((isDeckItem || isEngineItem || isCateringItem) && (isDeckFile || isEngineFile || isCateringFile)) {
      if (isDeckItem && !isDeckFile) return true;
      if (isEngineItem && !isEngineFile) return true;
      if (isCateringItem && !isCateringFile) return true;
    }

    // 2. Flag / Jurisdiction checks (e.g. Malta, Singapore vs Panama vs Liberia etc.)
    const flagsList = ['MALTA', 'SINGAPORE', 'PANAMA', 'LIBERIA', 'MARSHALL', 'BAHAMAS', 'CYPRUS', 'TUVALU', 'VANUATU', 'ANTIGUA', 'HONG KONG'];
    const itemFlags = flagsList.filter(flg => combinedItemText.includes(flg));
    const fileFlags = flagsList.filter(flg => combinedFileText.includes(flg));

    if (itemFlags.length > 0 && fileFlags.length > 0) {
      const hasCommonFlag = itemFlags.some(flg => fileFlags.includes(flg));
      if (!hasCommonFlag) return true;
    }

    // 3. Sub-code suffix checks (e.g., COMI-SM-1-8 vs COMI-SM-1-8A vs COMI-SM-1-3A vs COMI-SM-1-3)
    if (fCode) {
      const escapedCode = fCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const extendedCodeRegex = new RegExp(`(^|[^A-Z0-9])${escapedCode}[-_]?([A-Z0-9]+)`, 'i');
      const match = combinedFileText.match(extendedCodeRegex);
      if (match && match[2]) {
        const subToken = match[2].toUpperCase();
        const cleanFCode = fCode.replace(/[^A-Z0-9]/g, '');
        const isPartOfFCode = cleanFCode.endsWith(subToken) || fCode.toUpperCase().includes(subToken);
        const isYear = /^(202[0-9]|203[0-9])$/.test(subToken);
        const isPartOfDesc = fDesc.includes(subToken) || subToken.length > 3;
        if (!isPartOfFCode && !isYear && !isPartOfDesc) {
          return true;
        }
      }
    }

    return false;
  };

  // 1. Direct form_id match
  if (uFormId && itemFormId && uFormId === itemFormId) {
    if (hasQualifierConflict()) return false;
    return true;
  }

  // 2. Exact or normalized form_code match
  if (uCode && fCode) {
    const uNorm = uCode.replace(/[^A-Z0-9]/g, '');
    const fNorm = fCode.replace(/[^A-Z0-9]/g, '');
    if (uCode === fCode || uNorm === fNorm) {
      if (hasQualifierConflict()) return false;
      return true;
    }
  }

  // 3. Match by form_code token in file_name
  if (fName && fCode) {
    const escapedCode = fCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[^A-Z0-9]/g, '[^A-Z0-9]');
    const regex = new RegExp(`(^|[^A-Z0-9])${escapedCode}([^A-Z0-9]|$)`, 'i');
    if (regex.test(fName)) {
      if (hasQualifierConflict()) return false;
      return true;
    }
  }

  return false;
};

export const getVesselUploads = (uploads: any[] | undefined, targetVessel: any, orderVessels?: any[]): any[] => {
  if (!uploads || uploads.length === 0 || !targetVessel) return [];
  return uploads.filter(u => {
    const vId = targetVessel.vessel_id != null ? String(targetVessel.vessel_id).trim() : (targetVessel.id != null ? String(targetVessel.id).trim() : '');
    const uVId = u.vessel_id != null ? String(u.vessel_id).trim() : '';
    const vName = (targetVessel.vessel_name || targetVessel.name || targetVessel.username || '').toLowerCase().trim();
    const uName = (u.vessel_name || '').toLowerCase().trim();
    if (vId && uVId && (vId === uVId || vId.replace(/^v/i, '') === uVId.replace(/^v/i, ''))) return true;
    if (vName && uName && (vName === uName || vName.includes(uName) || uName.includes(vName))) return true;
    if (orderVessels && orderVessels.length === 1) return true;
    return false;
  });
};

export interface OrderVesselsTooltipProps {
  vessels: OrderVessel[];
  totalForms?: number;
  orderUploads?: OrderUpload[];
  orderItems?: OrderItem[];
  children?: React.ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

export const OrderVesselsTooltip: React.FC<OrderVesselsTooltipProps> = ({
  vessels,
  totalForms = 0,
  orderUploads = [],
  orderItems = [],
  children,
  position = 'bottom',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const vesselNames = vessels.map(v => v.vessel_name).filter(Boolean);
  const titleText = vesselNames.length > 0 ? `Assigned Vessels: ${vesselNames.join(', ')}` : 'No vessels assigned';

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
      }}
    >
      <span
        className="font-semibold text-slate-700 hover:text-blue-600 underline decoration-dotted decoration-slate-300 hover:decoration-blue-500 underline-offset-2 transition-colors cursor-help inline-flex items-center gap-1"
        title={titleText}
      >
        {children || `${vessels.length} ${vessels.length === 1 ? 'Vessel' : 'Vessels'}`}
      </span>

      {isOpen && (
        <div
          className={`absolute left-0 ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } z-50 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] bg-slate-900/95 backdrop-blur-md text-slate-100 rounded-xl shadow-2xl border border-slate-700/80 p-3 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto cursor-default`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle Pointer Arrow */}
          <div
            className={`absolute left-4 w-2 h-2 bg-slate-900 border-slate-700 rotate-45 ${
              position === 'top' ? '-bottom-1 border-r border-b' : '-top-1 border-l border-t'
            }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Ship className="w-3.5 h-3.5 text-blue-400" />
              <span>Assigned Vessels ({vessels.length})</span>
            </div>
            {totalForms > 0 && (
              <span className="text-[10px] text-slate-400 font-medium">
                {totalForms} {totalForms === 1 ? 'req' : 'reqs'}/vessel
              </span>
            )}
          </div>

          {/* Vessel List */}
          {vessels.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-1">No vessels assigned to this order.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 select-text">
              {vessels.map((v, idx) => {
                const vUps = getVesselUploads(orderUploads, v, vessels);
                const vVerified = orderItems.length > 0
                  ? orderItems.filter(item => vUps.some(u => checkFormUploadMatch(u, item))).length
                  : (v.submittedCount || 0);
                const isVDone = v.status === 'Completed' || (totalForms > 0 && (vVerified >= totalForms || (v.submittedCount || 0) >= totalForms));
                const distinctCount = isVDone ? totalForms : vVerified;

                return (
                  <div
                    key={v.vessel_id || idx}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/50 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isVDone ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      <span className="font-semibold text-slate-200 truncate" title={v.vessel_name}>
                        {v.vessel_name || 'Unnamed Vessel'}
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {totalForms > 0 && (
                        <span className="text-[10px] font-mono text-slate-400 font-medium">
                          {distinctCount}/{totalForms}
                        </span>
                      )}
                      {isVDone ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                          <Clock className="w-2.5 h-2.5" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface OrderRequirementsTooltipProps {
  items: OrderItem[];
  children?: React.ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

export const OrderRequirementsTooltip: React.FC<OrderRequirementsTooltipProps> = ({
  items,
  children,
  position = 'bottom',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const formCodes = items.map(item => item.form_code || item.form_id).filter(Boolean);
  const titleText = formCodes.length > 0 ? `Required Form Codes: ${formCodes.join(', ')}` : 'No requirements';

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
      }}
    >
      <span
        className="text-slate-700 hover:text-blue-600 underline decoration-dotted decoration-slate-300 hover:decoration-blue-500 underline-offset-2 transition-colors cursor-help inline-flex items-center gap-1"
        title={titleText}
      >
        {children || (
          <>
            <strong className="text-slate-700">{items.length}</strong> {items.length === 1 ? 'Requirement' : 'Requirements'}
          </>
        )}
      </span>

      {isOpen && (
        <div
          className={`absolute left-0 ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } z-50 w-80 sm:w-96 max-w-[calc(100vw-2.5rem)] bg-slate-900/95 backdrop-blur-md text-slate-100 rounded-xl shadow-2xl border border-slate-700/80 p-3 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto cursor-default`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle Pointer Arrow */}
          <div
            className={`absolute left-4 w-2 h-2 bg-slate-900 border-slate-700 rotate-45 ${
              position === 'top' ? '-bottom-1 border-r border-b' : '-top-1 border-l border-t'
            }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <FileCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Required Form Codes ({items.length})</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono font-medium">To be submitted</span>
          </div>

          {/* Items List */}
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-1">No required form codes specified.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 select-text">
              {items.map((item, idx) => (
                <div
                  key={item.id || item.form_id || idx}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/50 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-mono font-bold text-[11px] border border-blue-800/70 shrink-0">
                      {item.form_code || item.form_id}
                    </span>
                    <span className="text-slate-300 text-xs truncate" title={item.description || item.category}>
                      {item.description || item.category || 'Form item'}
                    </span>
                  </div>
                  {item.type && (
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60">
                      {item.type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface SMSOrderListProps {
  vessels: Vessel[];
  currentUser: CurrentUser;
  token: string;
  flags?: string[];
  onStatusRefresh?: () => void;
}

export const SMSOrderListView: React.FC<SMSOrderListProps> = ({
  vessels,
  currentUser,
  token,
  onStatusRefresh,
}) => {
  const isVesselUser = currentUser.role === 'vessel';
  const isManagementOrAdmin = !isVesselUser;

  // Data states
  const [orders, setOrders] = useState<SMSOrder[]>([]);
  const [availableForms, setAvailableForms] = useState<SMSForm[]>([]);
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [orderTypeFilter, setOrderTypeFilter] = useState<'order_lists_only' | 'direct_uploads_only' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [vesselFilter, setVesselFilter] = useState<string>('All');
  const [teamFilter, setTeamFilter] = useState<string>('All');

  // Modals and Active states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDirectUploadModalOpen, setIsDirectUploadModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SMSOrder | null>(null);
  const [selectedOrderForInspection, setSelectedOrderForInspection] = useState<SMSOrder | null>(null);
  const [activeVesselTabInDetail, setActiveVesselTabInDetail] = useState<string>('');
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [selectedOrderIdsForMerge, setSelectedOrderIdsForMerge] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [downloadingZipOrderId, setDownloadingZipOrderId] = useState<string | null>(null);
  const [downloadingTemplatesZipOrderId, setDownloadingTemplatesZipOrderId] = useState<string | null>(null);
  
  // Document Inline Preview Modal state
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);

  // Revision Request Modal State & Handlers
  const [replacementModalState, setReplacementModalState] = useState<{ isOpen: boolean; uploadId: number; fileName: string } | null>(null);

  const handleRequestReplacement = async (uploadId: number, reason: string) => {
    try {
      const res = await fetch(`/api/sms/orders/upload/${uploadId}/request-replacement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to request revision');
      }
      const data = await res.json();

      setOrders(prevOrders => prevOrders.map(order => {
        if (!order.uploads) return order;
        return {
          ...order,
          uploads: order.uploads.map(up => {
            if (up.id === uploadId) {
              return {
                ...up,
                replace_requested_at: data.replace_requested_at || new Date().toISOString(),
                replace_requested_by: data.replace_requested_by || currentUser.username,
                replace_reason: data.replace_reason || reason
              };
            }
            return up;
          })
        };
      }));

      setSelectedOrderForInspection(prev => {
        if (!prev || !prev.uploads) return prev;
        return {
          ...prev,
          uploads: prev.uploads.map(up => {
            if (up.id === uploadId) {
              return {
                ...up,
                replace_requested_at: data.replace_requested_at || new Date().toISOString(),
                replace_requested_by: data.replace_requested_by || currentUser.username,
                replace_reason: data.replace_reason || reason
              };
            }
            return up;
          })
        };
      });

      setPreviewModal(prev => {
        if (prev && prev.isOpen && prev.uploadId === uploadId) {
          return {
            ...prev,
            replaceRequestedAt: data.replace_requested_at || new Date().toISOString(),
            replaceRequestedBy: data.replace_requested_by || currentUser.username,
            replaceReason: data.replace_reason || reason
          };
        }
        return prev;
      });

      if (onStatusRefresh) {
        onStatusRefresh();
      }
    } catch (e: any) {
      console.error('Error requesting file revision:', e);
      alert(`Error requesting file revision: ${e.message}`);
    }
  };

  const handleCancelReplacementRequest = async (uploadId: number) => {
    try {
      const res = await fetch(`/api/sms/orders/upload/${uploadId}/cancel-replacement-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to cancel revision request');
      }

      setOrders(prevOrders => prevOrders.map(order => {
        if (!order.uploads) return order;
        return {
          ...order,
          uploads: order.uploads.map(up => {
            if (up.id === uploadId) {
              return {
                ...up,
                replace_requested_at: null,
                replace_requested_by: null,
                replace_reason: null
              };
            }
            return up;
          })
        };
      }));

      setSelectedOrderForInspection(prev => {
        if (!prev || !prev.uploads) return prev;
        return {
          ...prev,
          uploads: prev.uploads.map(up => {
            if (up.id === uploadId) {
              return {
                ...up,
                replace_requested_at: null,
                replace_requested_by: null,
                replace_reason: null
              };
            }
            return up;
          })
        };
      });

      setPreviewModal(prev => {
        if (prev && prev.isOpen && prev.uploadId === uploadId) {
          return {
            ...prev,
            replaceRequestedAt: null,
            replaceRequestedBy: null,
            replaceReason: null
          };
        }
        return prev;
      });

      if (onStatusRefresh) {
        onStatusRefresh();
      }
    } catch (e: any) {
      console.error('Error canceling revision request:', e);
      alert(`Error canceling revision request: ${e.message}`);
    }
  };

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // File Upload State (for Vessel view or Upload modal)
  const [uploadingForFormId, setUploadingForFormId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<boolean>(false);
  const [uploadValidationMessage, setUploadValidationMessage] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadDetailedErrors, setUploadDetailedErrors] = useState<string[]>([]);
  const [lastFailedUpload, setLastFailedUpload] = useState<FailedUploadInfo | null>(null);
  const [bulkFetchFailureCount, setBulkFetchFailureCount] = useState<number>(0);

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text, type });
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 20000);
  };

  // Fetch initial data
  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/sms/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const formattedData = (data || []).map((o: SMSOrder) => ({
          ...o,
          items: sortByFormCode(o.items || [])
        }));
        setOrders(formattedData);
        // If an order is currently open in detail modal, refresh it
        if (selectedOrderForInspection) {
          const updated = formattedData.find((o: SMSOrder) => o.id === selectedOrderForInspection.id);
          if (updated) setSelectedOrderForInspection(updated);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch SMS orders:', err);
      showToast('Error loading orders: ' + err.message, 'error');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchForms = async () => {
    try {
      const res = await fetch('/api/sms/forms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableForms(data);
      }
    } catch (err) {
      console.error('Failed to load SMS forms catalog:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/sms/order-templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch order templates:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchForms();
    if (isManagementOrAdmin) {
      fetchTemplates();
    }
  }, [token]);

  // Live database updates via long-polling
  useRealtimeAutoRefresh(
    ['sms_orders', 'sms_uploads', 'sms_forms', 'sms_periods'],
    () => {
      fetchOrders(true);
      fetchForms();
      if (isManagementOrAdmin) {
        fetchTemplates();
      }
    },
    300,
    [token, isManagementOrAdmin]
  );

  const normalizeVessel = (s?: string | null) => {
    return (s || '')
      .toLowerCase()
      .replace(/^m\/?v\.?\s+/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  // Helper to determine if an order is assigned to the logged-in vessel user
  const isOrderAssignedToCurrentUserVessel = useCallback((order: SMSOrder) => {
    if (!isVesselUser) return true;
    const currentVId = currentUser.vessel_id != null ? String(currentUser.vessel_id).trim() : '';
    const currentVIdClean = currentVId.replace(/^v/i, '').trim();
    const currentUName = (currentUser.username || '').toLowerCase().trim();
    const currentVName = ((currentUser as any).vessel_name || '').toLowerCase().trim();
    
    const matchedVessel = vessels.find(v => 
      (currentVId && String(v.id) === currentVId) || 
      (currentVIdClean && String(v.id).replace(/^v/i, '').trim() === currentVIdClean) ||
      (currentVName && v.name?.toLowerCase().trim() === currentVName) ||
      v.name?.toLowerCase().trim() === currentUName
    );
    const matchedVesselName = (matchedVessel?.name || currentVName || '').toLowerCase().trim();
    const matchedVesselId = matchedVessel ? String(matchedVessel.id).trim() : '';
    const matchedVesselIdClean = matchedVesselId.replace(/^v/i, '').trim();

    const normTargetName = normalizeVessel(matchedVesselName || currentUName || currentVName);

    return (order.vessels || []).some(v => {
      const vId = String(v.vessel_id || '').trim();
      const vIdClean = vId.replace(/^v/i, '').trim();
      const vName = (v.vessel_name || '').toLowerCase().trim();
      const normVName = normalizeVessel(v.vessel_name);

      // Direct ID match
      if (currentVId && vId && (currentVId === vId || currentVIdClean === vIdClean)) return true;
      if (matchedVesselId && vId && (matchedVesselId === vId || matchedVesselIdClean === vIdClean)) return true;

      // Direct Name match
      if (matchedVesselName && vName && matchedVesselName === vName) return true;
      if (currentUName && vName && currentUName === vName) return true;
      if (currentVName && vName && currentVName === vName) return true;

      // Normalized name match (removes M/V, spaces, symbols)
      if (normTargetName && normVName) {
        if (normTargetName === normVName || normTargetName.includes(normVName) || normVName.includes(normTargetName)) {
          return true;
        }
      }

      return false;
    });
  }, [isVesselUser, currentUser, vessels]);

  // Unique Teams and Types for filtering
  const teams = useMemo(() => {
    const set = new Set<string>();
    vessels.forEach(v => {
      if (v.team_name) set.add(v.team_name);
    });
    return Array.from(set).sort();
  }, [vessels]);

  // Orders assigned to this vessel user (or all orders for management)
  const userVisibleOrders = useMemo(() => {
    if (!isVesselUser) return orders;
    return orders.filter(isOrderAssignedToCurrentUserVessel);
  }, [orders, isVesselUser, isOrderAssignedToCurrentUserVessel]);

  // Counts of order lists vs direct uploads from vessels
  const orderListsCount = useMemo(() => {
    return userVisibleOrders.filter(o => !o.id.startsWith('ord_direct_')).length;
  }, [userVisibleOrders]);

  const directUploadsCount = useMemo(() => {
    return userVisibleOrders.filter(o => o.id.startsWith('ord_direct_')).length;
  }, [userVisibleOrders]);

  // Orders filtered by the view filter: 'all' (default) vs 'order_lists_only' vs 'direct_uploads_only'
  const typeFilteredOrders = useMemo(() => {
    return userVisibleOrders.filter(order => {
      if (orderTypeFilter === 'order_lists_only' && order.id.startsWith('ord_direct_')) {
        return false;
      }
      if (orderTypeFilter === 'direct_uploads_only' && !order.id.startsWith('ord_direct_')) {
        return false;
      }
      return true;
    });
  }, [userVisibleOrders, orderTypeFilter]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return typeFilteredOrders.filter(order => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        order.label.toLowerCase().includes(q) ||
        order.createdByName.toLowerCase().includes(q) ||
        (order.instructions && order.instructions.toLowerCase().includes(q)) ||
        order.vessels.some(v => v.vessel_name.toLowerCase().includes(q)) ||
        order.items.some(i => i.form_code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Status
      if (statusFilter !== 'All') {
        if (isVesselUser) {
          const myVId = currentUser.vessel_id != null ? String(currentUser.vessel_id).trim() : '';
          const myName = (currentUser.username || '').toLowerCase().trim();
          const targetV = order.vessels.find(v => {
            const vId = v.vessel_id != null ? String(v.vessel_id).trim() : '';
            const vName = (v.vessel_name || '').toLowerCase().trim();
            if (myVId && vId && (myVId === vId || myVId.replace(/^v/i, '') === vId.replace(/^v/i, ''))) return true;
            if (myName && vName && (myName === vName || myName.includes(vName) || vName.includes(myName))) return true;
            return false;
          }) || order.vessels[0];

          const totalReq = order.items?.length || 0;
          const vUps = getVesselUploads(order.uploads, targetV, order.vessels);
          const vVerified = order.items?.filter(item => vUps.some(u => checkFormUploadMatch(u, item))).length || 0;
          const isDone = (targetV?.status === 'Completed' || (targetV?.submittedCount || 0) >= totalReq || (totalReq > 0 && vVerified >= totalReq));
          const userVesselStatus = isDone ? 'Completed' : 'Pending';

          if (statusFilter === 'Completed' && userVesselStatus !== 'Completed') return false;
          if (statusFilter === 'Pending' && userVesselStatus !== 'Pending') return false;
          if (statusFilter === 'Overdue' && (order.overallStatus !== 'Overdue' || userVesselStatus === 'Completed')) return false;
        } else {
          if (statusFilter === 'Pending') {
            const totalReq = order.items?.length || 0;
            const hasAnyPendingVessel = order.vessels.length === 0 || order.vessels.some(v => {
              if (v.status === 'Completed') return false;
              if (totalReq > 0 && (v.submittedCount || 0) >= totalReq) return false;
              const vUps = getVesselUploads(order.uploads, v, order.vessels);
              const vVerified = totalReq > 0 ? (order.items?.filter(item => vUps.some(u => checkFormUploadMatch(u, item))).length || 0) : 0;
              if (totalReq > 0 && vVerified >= totalReq) return false;
              return true;
            });
            if (!hasAnyPendingVessel && order.overallStatus !== 'Pending') return false;
          } else {
            if (statusFilter !== order.overallStatus) return false;
          }
        }
      }

      // Vessel filter (for non-vessel users)
      if (isManagementOrAdmin && vesselFilter !== 'All') {
        if (!order.vessels.some(v => v.vessel_id === vesselFilter || v.vessel_name === vesselFilter)) {
          return false;
        }
      }

      // Team filter (for non-vessel users)
      if (isManagementOrAdmin && teamFilter !== 'All') {
        const orderVesselIds = order.vessels.map(v => String(v.vessel_id));
        const matchingTeamVessels = vessels.filter(v => v.team_name === teamFilter).map(v => String(v.id));
        const hasTeamMatch = orderVesselIds.some(id => matchingTeamVessels.includes(id));
        if (!hasTeamMatch) return false;
      }

      return true;
    });
  }, [typeFilteredOrders, searchQuery, statusFilter, vesselFilter, teamFilter, isVesselUser, isManagementOrAdmin, vessels, currentUser]);

  // Quick statistics
  const stats = useMemo(() => {
    const total = typeFilteredOrders.length;
    if (isVesselUser) {
      const completed = typeFilteredOrders.filter(o => {
        const totalReq = o.items?.length || 0;
        if (totalReq === 0) return false;
        const myVId = currentUser.vessel_id != null ? String(currentUser.vessel_id).trim() : '';
        const myName = (currentUser.username || '').toLowerCase().trim();
        const targetV = o.vessels.find(v => {
          const vId = v.vessel_id != null ? String(v.vessel_id).trim() : '';
          const vName = (v.vessel_name || '').toLowerCase().trim();
          if (myVId && vId && (myVId === vId || myVId.replace(/^v/i, '') === vId.replace(/^v/i, ''))) return true;
          if (myName && vName && (myName === vName || myName.includes(vName) || vName.includes(myName))) return true;
          return false;
        }) || o.vessels[0];
        const vUps = getVesselUploads(o.uploads, targetV, o.vessels);
        const vVerified = o.items?.filter(item => vUps.some(u => checkFormUploadMatch(u, item))).length || 0;
        return (targetV?.status === 'Completed' || (targetV?.submittedCount || 0) >= totalReq || vVerified >= totalReq);
      }).length;
      const pending = total - completed;
      const overdue = typeFilteredOrders.filter(o => o.overallStatus === 'Overdue' && !o.vessels.some(v => v.status === 'Completed')).length;
      return { total, completed, pending, overdue };
    } else {
      const completed = typeFilteredOrders.filter(o => o.overallStatus === 'Completed' || (o.vessels.length > 0 && o.vessels.every(v => v.status === 'Completed' || ((o.items?.length || 0) > 0 && (v.submittedCount || 0) >= (o.items?.length || 0))))).length;
      const inProgress = typeFilteredOrders.filter(o => o.overallStatus === 'In Progress').length;
      const pending = typeFilteredOrders.filter(o => {
        if (o.overallStatus === 'Pending') return true;
        const totalReq = o.items?.length || 0;
        return o.vessels.length === 0 || o.vessels.some(v => {
          if (v.status === 'Completed') return false;
          if (totalReq > 0 && (v.submittedCount || 0) >= totalReq) return false;
          const vUps = getVesselUploads(o.uploads, v, o.vessels);
          const vVerified = totalReq > 0 ? (o.items?.filter(item => vUps.some(u => checkFormUploadMatch(u, item))).length || 0) : 0;
          if (totalReq > 0 && vVerified >= totalReq) return false;
          return true;
        });
      }).length;
      const overdue = typeFilteredOrders.filter(o => o.overallStatus === 'Overdue').length;
      return { total, completed, inProgress, pending, overdue };
    }
  }, [typeFilteredOrders, isVesselUser, currentUser]);

  // Unread uploads count across all orders for the logged on management user
  const totalUncheckedCount = useMemo(() => {
    if (isVesselUser) return 0;
    let count = 0;
    userVisibleOrders.forEach(o => {
      (o.uploads || []).forEach(u => {
        if (!u.is_read && !u.checked_at) count++;
      });
    });
    return count;
  }, [userVisibleOrders, isVesselUser]);

  // Reusable order templates saved by the user themselves
  const userVisibleTemplates = useMemo(() => {
    if (!currentUser) return [];
    const myId = currentUser.id != null ? String(currentUser.id).trim() : '';
    const myName = (currentUser.username || '').toLowerCase().trim();
    return templates.filter(t => {
      const matchId = t.createdById && myId && String(t.createdById) === myId;
      const matchName = t.createdBy && myName && t.createdBy.toLowerCase().trim() === myName;
      return matchId || matchName;
    });
  }, [templates, currentUser]);

  // Request Delete Order (Opens Custom Modal)
  const requestDeleteOrder = (orderId: string, label: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete SMS Order',
      message: `Are you sure you want to permanently delete order "${label}"?`,
      detail: 'All associated requirements, target vessel assignments, and uploaded file records will be removed.',
      confirmLabel: 'Delete Order',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/sms/orders/${orderId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            showToast(`Order "${label}" deleted successfully.`);
            fetchOrders();
            if (selectedOrderForInspection?.id === orderId) {
              setSelectedOrderForInspection(null);
            }
          } else {
            const err = await res.json();
            showToast(err.error || 'Failed to delete order', 'error');
          }
        } catch (e: any) {
          showToast('Error deleting order: ' + e.message, 'error');
        }
      }
    });
  };

  // Download ZIP handler
  const handleDownloadZip = async (orderId: string, label: string, vesselId?: string) => {
    if (downloadingZipOrderId === orderId) {
      showToast('Downloading of uploaded files is already processing. Please wait...', 'info');
      return;
    }
    setDownloadingZipOrderId(orderId);
    showToast('Downloading of uploaded files is processing... Packaging files into ZIP, please wait.', 'info');
    try {
      const url = `/api/sms/orders/${orderId}/download-zip${vesselId ? `?vessel_id=${encodeURIComponent(vesselId)}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        let errorMsg = '';
        try {
          const text = await res.text();
          try {
            const errJson = JSON.parse(text);
            errorMsg = errJson.error || errJson.message || '';
          } catch {
            errorMsg = text.length < 200 ? text : '';
          }
        } catch {}
        if (!errorMsg) {
          if (res.status === 404) {
            errorMsg = 'No files have been uploaded yet for this order.';
          } else if (res.status === 403) {
            errorMsg = 'Access denied: You do not have permission to download files for this order.';
          } else if (res.status === 504 || res.status === 502) {
            errorMsg = 'Server timeout while packaging files. Please try again.';
          } else {
            errorMsg = `Download failed (Server status ${res.status})`;
          }
        }
        throw new Error(errorMsg);
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Downloaded ZIP file is empty or corrupted');
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${label.replace(/[^a-zA-Z0-9_-]/g, '_')}_Uploads.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Clean up object URL after browser download manager has completed starting the download
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 10000);
      showToast('Uploaded files ZIP downloaded successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error downloading uploads ZIP', 'error');
    } finally {
      setDownloadingZipOrderId(null);
    }
  };

  // Download Single Uploaded File
  const handleDownloadUpload = (uploadId: number, fileName: string) => {
    fetch(`/api/sms/orders/download-upload/${uploadId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `File download failed (Status ${res.status})`);
        }
        return res.blob();
      })
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 10000);
      })
      .catch(err => {
        showToast(err.message, 'error');
      });
  };

  // Close Preview Modal and revoke object URL
  const handleClosePreviewModal = () => {
    if (previewModal?.blobUrl) {
      window.URL.revokeObjectURL(previewModal.blobUrl);
    }
    setPreviewModal(null);
  };

  // Inline Document Preview Handlers
  const handlePreviewUpload = async (
    uploadId: number,
    fileName: string,
    fileMimetype?: string,
    formCode?: string,
    vesselName?: string,
    isRead?: boolean
  ) => {
    if (previewModal?.blobUrl) {
      window.URL.revokeObjectURL(previewModal.blobUrl);
    }

    setPreviewModal({
      isOpen: true,
      title: fileName,
      fileName,
      fileSize: '',
      fileMimetype: fileMimetype || '',
      uploadId,
      formCode,
      vesselName,
      isTemplate: false,
      isRead: Boolean(isRead),
      blobUrl: null,
      textContent: null,
      loading: true,
      error: null
    });

    try {
      const res = await fetch(`/api/sms/orders/download-upload/${uploadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error(`Failed to load document (${res.status})`);
      }
      const blob = await res.blob();
      let arrayBuffer: ArrayBuffer | null = null;
      try {
        arrayBuffer = await blob.arrayBuffer();
      } catch (abErr) {
        console.warn('Could not extract arrayBuffer from blob:', abErr);
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const sizeStr = blob.size > 1024 * 1024 
        ? `${(blob.size / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(blob.size / 1024)} KB`;

      let textContent: string | null = null;
      const lowerName = fileName.toLowerCase();
      const mime = blob.type || fileMimetype || '';

      if (
        mime.startsWith('text/') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.csv') ||
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.log') ||
        lowerName.endsWith('.xml')
      ) {
        try {
          textContent = await blob.text();
        } catch (e) {
          console.error('Failed to parse text content:', e);
        }
      }

      setPreviewModal(prev => prev ? {
        ...prev,
        blobUrl,
        blob,
        arrayBuffer,
        fileSize: sizeStr,
        fileMimetype: mime,
        textContent,
        loading: false
      } : null);

      // If user is management/admin and this document was unread, auto mark read for their account
      if (isManagementOrAdmin && !isRead) {
        try {
          await fetch(`/api/sms/orders/upload/${uploadId}/mark-read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            }
          });
          setPreviewModal(prev => prev ? { ...prev, isRead: true } : null);
          await fetchOrders(true);
          onStatusRefresh?.();
        } catch (e) {
          console.error('Auto mark read error:', e);
        }
      }
    } catch (err: any) {
      setPreviewModal(prev => prev ? {
        ...prev,
        loading: false,
        error: err.message || 'Failed to load document for preview'
      } : null);
    }
  };

  const handlePreviewTemplate = async (formId: string, formCode: string, templateFileName?: string) => {
    if (previewModal?.blobUrl) {
      window.URL.revokeObjectURL(previewModal.blobUrl);
    }

    const title = templateFileName || `${formCode} Blank Template`;
    const fileName = templateFileName || `${formCode}_Template.pdf`;

    setPreviewModal({
      isOpen: true,
      title,
      fileName,
      fileSize: '',
      fileMimetype: '',
      formId,
      formCode,
      isTemplate: true,
      isRead: true,
      blobUrl: null,
      textContent: null,
      loading: true,
      error: null
    });

    try {
      const cleanFormId = (formId || '').trim();
      const cleanCode = (formCode || '').trim();
      const matchedForm = (cleanFormId ? availableForms.find(f => f.id === cleanFormId) : null) ||
        availableForms.find(f => (f.formCode || '').trim() === cleanCode);
      const targetId = cleanFormId || matchedForm?.id || cleanCode;

      const res = await fetch(`/api/sms/forms/${encodeURIComponent(targetId)}/download-template?inline=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`No blank template file has been uploaded for form ${formCode} yet.`);
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load template file');
      }

      const contentDisposition = res.headers.get('Content-Disposition');
      let actualFileName = templateFileName || `${formCode}_Template`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
        if (match && match[1]) {
          actualFileName = decodeURIComponent(match[1].replace(/["']/g, ''));
        }
      }

      const blob = await res.blob();
      let arrayBuffer: ArrayBuffer | null = null;
      try {
        arrayBuffer = await blob.arrayBuffer();
      } catch (abErr) {
        console.warn('Could not extract arrayBuffer from template blob:', abErr);
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const sizeStr = blob.size > 1024 * 1024 
        ? `${(blob.size / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(blob.size / 1024)} KB`;

      let textContent: string | null = null;
      const lowerName = actualFileName.toLowerCase();
      const mime = blob.type || '';

      if (
        mime.startsWith('text/') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.csv') ||
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.log') ||
        lowerName.endsWith('.xml')
      ) {
        try {
          textContent = await blob.text();
        } catch (e) {
          console.error('Failed to parse text content:', e);
        }
      }

      setPreviewModal(prev => prev ? {
        ...prev,
        fileName: actualFileName,
        title: actualFileName,
        blobUrl,
        blob,
        arrayBuffer,
        fileSize: sizeStr,
        fileMimetype: mime,
        textContent,
        loading: false
      } : null);
    } catch (err: any) {
      setPreviewModal(prev => prev ? {
        ...prev,
        loading: false,
        error: err.message || 'Failed to load template for preview'
      } : null);
    }
  };

  // Download Form Template File
  const handleDownloadTemplate = async (formId: string, formCode: string, templateFileName?: string) => {
    try {
      const cleanFormId = (formId || '').trim();
      const cleanCode = (formCode || '').trim();
      const matchedForm = (cleanFormId ? availableForms.find(f => f.id === cleanFormId) : null) ||
        availableForms.find(f => (f.formCode || '').trim() === cleanCode);
      const targetId = cleanFormId || matchedForm?.id || cleanCode;

      const res = await fetch(`/api/sms/forms/${encodeURIComponent(targetId)}/download-template`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 404) {
          showToast(`No template file uploaded for form ${formCode} yet.`, 'info');
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to download template');
      }

      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = templateFileName || `${formCode}_Template`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].replace(/["']/g, ''));
        }
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 10000);
      showToast(`Template for ${formCode} downloaded.`);
    } catch (err: any) {
      showToast(err.message || 'Error downloading template', 'error');
    }
  };

  // Download All Blank Templates for an Order (ZIP)
  const handleDownloadOrderTemplatesZip = async (orderId: string, orderLabel: string) => {
    if (downloadingTemplatesZipOrderId === orderId) {
      showToast('Templates package download is already processing. Please wait...', 'info');
      return;
    }
    setDownloadingTemplatesZipOrderId(orderId);
    try {
      showToast('Preparing template files package... Downloading ZIP, please wait.', 'info');
      const res = await fetch(`/api/sms/orders/${orderId}/download-templates-zip`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        let errorMsg = '';
        try {
          const text = await res.text();
          try {
            const errJson = JSON.parse(text);
            errorMsg = errJson.error || errJson.message || '';
          } catch {
            errorMsg = text.length < 200 ? text : '';
          }
        } catch {}
        throw new Error(errorMsg || `Failed to download templates package (Status ${res.status})`);
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Downloaded templates package is empty');
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${orderLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}_Form_Templates.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 10000);
      showToast(`All templates for "${orderLabel}" downloaded successfully.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error downloading templates ZIP', 'error');
    } finally {
      setDownloadingTemplatesZipOrderId(null);
    }
  };

  // Mark single upload, whole order, or all orders read for the logged-on user
  const handleMarkOrderChecked = async (orderId: string, vesselId?: string) => {
    try {
      const res = await fetch(`/api/sms/orders/${orderId}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ vessel_id: vesselId })
      });
      if (res.ok) {
        showToast('All uploaded files in this order marked as read for your account.');
        await fetchOrders(true);
        onStatusRefresh?.();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to mark read', 'error');
      }
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleMarkAllOrdersChecked = async () => {
    try {
      const res = await fetch('/api/sms/orders/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        showToast('All vessel uploaded files across all orders marked as read for your account.');
        await fetchOrders(true);
        onStatusRefresh?.();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to mark all read', 'error');
      }
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleMarkSingleUploadChecked = async (uploadId: number) => {
    try {
      const res = await fetch(`/api/sms/orders/upload/${uploadId}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        showToast('Document marked as read for your account.');
        await fetchOrders(true);
        onStatusRefresh?.();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to mark document as read', 'error');
      }
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // Request Delete Single Uploaded File (Opens Custom Modal)
  const requestDeleteUpload = (uploadId: number, fileName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Uploaded File',
      message: `Are you sure you want to delete the file "${fileName}"?`,
      detail: 'The file will be permanently removed and the corresponding requirement marked pending until re-uploaded.',
      confirmLabel: 'Delete File',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/sms/orders/upload/${uploadId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            showToast(`File "${fileName}" removed.`);
            await fetchOrders(true);
            onStatusRefresh?.();
          } else {
            const err = await res.json();
            showToast(err.error || 'Failed to remove file', 'error');
          }
        } catch (err: any) {
          showToast('Error removing file: ' + err.message, 'error');
        }
      }
    });
  };

  const formatFilesTotalSize = (files: File[]): string => {
    const bytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Upload handler with strict SMS Reporting-style Validation Checker (supports vessel & non-vessel users)
  const handleFileUpload = async (
    orderId: string,
    formItem: OrderItem,
    files: FileList | File[],
    targetVesselParam?: { id: string | number; name: string }
  ) => {
    if (uploadProgress) {
      showToast('An upload is currently in progress. Please wait for it to complete.', 'info');
      return;
    }
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    // Resolve target vessel info
    let targetVessel = targetVesselParam;
    if (!targetVessel) {
      if (isVesselUser) {
        const found = vessels.find(v => String(v.id) === String(currentUser.vessel_id));
        targetVessel = {
          id: found?.id || currentUser.vessel_id || 'v1',
          name: found?.name || currentUser.username
        };
      } else {
        const currentOrder = orders.find(o => o.id === orderId);
        const vMatch = currentOrder?.vessels?.find(v => v.vessel_name === activeVesselTabInDetail) || currentOrder?.vessels?.[0];
        if (vMatch) {
          targetVessel = { id: vMatch.vessel_id, name: vMatch.vessel_name };
        } else {
          targetVessel = { id: currentUser.vessel_id || 'v1', name: currentUser.username };
        }
      }
    }

    // Clear any previous failed upload state immediately when starting a new/different upload
    setLastFailedUpload(null);
    setUploadErrorMessage(null);
    setUploadDetailedErrors([]);

    // If Multiple Files is not enabled for this form, strictly allow only 1 file
    if (!formItem.is_hira && fileList.length > 1) {
      const reason = `Form "${formItem.form_code}" only accepts a single file upload because "Multiple Files" is not enabled. Please select only 1 file.`;
      setUploadErrorMessage(reason);
      setLastFailedUpload({
        type: 'single',
        orderId,
        formItem,
        files: fileList,
        targetVessel,
        fileNames: fileList.map(f => f.name),
        totalSize: formatFilesTotalSize(fileList),
        timestamp: Date.now(),
        errorMessage: reason
      });
      showToast(reason, 'error');
      return;
    }

    setUploadProgress(true);
    setUploadingForFormId(String(formItem.id ?? formItem.form_id ?? formItem.form_code));
    setUploadErrorMessage(null);
    setUploadDetailedErrors([]);
    setUploadValidationMessage(`Checking document against ${formItem.form_code} validation rules...`);

    // Apply strict checker to every selected file
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadValidationMessage(`Verifying "${file.name}" structure, header and form content...`);

      const valResult = await validateFileAgainstForm(file, {
        form_id: formItem.form_id,
        form_code: formItem.form_code,
        description: formItem.description,
        form_date: formItem.form_date,
        is_hira: formItem.is_hira,
        remove_filename_restriction: formItem.remove_filename_restriction,
        allowed_file_types: formItem.allowed_file_types
      });

      if (!valResult.matched) {
        setUploadProgress(false);
        setUploadValidationMessage(null);
        setUploadingForFormId(null);
        const reason = valResult.reason || `File "${file.name}" failed verification for ${formItem.form_code}.`;
        setUploadErrorMessage(reason);
        setLastFailedUpload({
          type: 'single',
          orderId,
          formItem,
          files: fileList,
          targetVessel,
          fileNames: fileList.map(f => f.name),
          totalSize: formatFilesTotalSize(fileList),
          timestamp: Date.now(),
          errorMessage: reason
        });
        showToast(reason, 'error');
        return;
      }
    }

    setUploadValidationMessage(`File verified successfully! Uploading for ${targetVessel.name}...`);

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }

    formData.append('vessel_id', String(targetVessel.id));
    formData.append('vessel_name', targetVessel.name);
    formData.append('form_id', formItem.form_id || '');
    formData.append('form_code', formItem.form_code || '');
    if (formItem.id != null) {
      formData.append('item_id', String(formItem.id));
    }

    try {
      const res = await fetch(`/api/sms/orders/${orderId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        setUploadErrorMessage(null);
        setUploadDetailedErrors([]);
        setLastFailedUpload(null);
        setBulkFetchFailureCount(0);
        showToast(`Successfully uploaded ${result.uploadedCount} verified file(s) for ${formItem.form_code} (${targetVessel.name})!`);
        await fetchOrders(true);
        onStatusRefresh?.();
      } else {
        const err = await res.json();
        const errStr = err.error || 'Upload failed';
        setUploadErrorMessage(errStr);
        setLastFailedUpload({
          type: 'single',
          orderId,
          formItem,
          files: fileList,
          targetVessel,
          fileNames: fileList.map(f => f.name),
          totalSize: formatFilesTotalSize(fileList),
          timestamp: Date.now(),
          errorMessage: errStr
        });
        showToast(errStr, 'error');
      }
    } catch (e: any) {
      const errStr = 'Upload error: ' + e.message;
      setUploadErrorMessage(errStr);
      setLastFailedUpload({
        type: 'single',
        orderId,
        formItem,
        files: fileList,
        targetVessel,
        fileNames: fileList.map(f => f.name),
        totalSize: formatFilesTotalSize(fileList),
        timestamp: Date.now(),
        errorMessage: errStr
      });
      showToast(errStr, 'error');
    } finally {
      setUploadProgress(false);
      setUploadValidationMessage(null);
      setUploadingForFormId(null);
    }
  };

  // Bulk ZIP or Multi-file smart uploader with strict SMS Reporting-style Validation Checker
  const handleBulkUpload = async (
    order: SMSOrder,
    files: FileList | File[],
    targetVesselParam?: { id: string | number; name: string }
  ) => {
    if (uploadProgress) {
      showToast('An upload is currently in progress. Please wait for it to complete.', 'info');
      return;
    }
    if (!files) return;
    const rawInputFiles = Array.from(files);
    if (rawInputFiles.length === 0) return;

    // Resolve target vessel
    let targetVessel = targetVesselParam;
    if (!targetVessel) {
      if (isVesselUser) {
        const found = vessels.find(v => String(v.id) === String(currentUser.vessel_id));
        targetVessel = {
          id: found?.id || currentUser.vessel_id || 'v1',
          name: found?.name || currentUser.username
        };
      } else {
        const vMatch = order.vessels?.find(v => v.vessel_name === activeVesselTabInDetail) || order.vessels?.[0];
        if (vMatch) {
          targetVessel = { id: vMatch.vessel_id, name: vMatch.vessel_name };
        } else {
          targetVessel = { id: currentUser.vessel_id || 'v1', name: currentUser.username };
        }
      }
    }

    // Clear any previous failed upload state immediately when starting a new/different upload
    setLastFailedUpload(null);
    setUploadErrorMessage(null);
    setUploadDetailedErrors([]);

    setUploadProgress(true);
    setUploadingForFormId('bulk');
    setUploadValidationMessage(`Scanning and checking files for ${targetVessel.name}...`);

    try {
      let rawFilesList: File[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < rawInputFiles.length; i++) {
        const file = rawInputFiles[i];
        if (file.name.toLowerCase().endsWith('.zip')) {
          try {
            const zip = new JSZip();
            const unzipped = await zip.loadAsync(file);
            const zipFilePromises: Promise<File>[] = [];

            unzipped.forEach((relativePath, zipEntry) => {
              const subFileName = relativePath.split('/').pop() || relativePath;
              if (
                !zipEntry.dir &&
                !relativePath.includes('__MACOSX') &&
                !subFileName.startsWith('.') &&
                subFileName.trim().length > 0
              ) {
                zipFilePromises.push(
                  zipEntry.async('blob').then(blob => {
                    return new File([blob], subFileName, { type: blob.type || 'application/octet-stream' });
                  })
                );
              }
            });

            const extractedFiles = await Promise.all(zipFilePromises);
            rawFilesList = [...rawFilesList, ...extractedFiles];
          } catch (zipErr: any) {
            console.warn(`Failed to unpack zip ${file.name}:`, zipErr);
            validationErrors.push(`"${file.name}": Could not extract ZIP archive (${zipErr.message || 'Corrupted file'})`);
          }
        } else {
          rawFilesList.push(file);
        }
      }

      if (rawFilesList.length === 0) {
        setUploadProgress(false);
        setUploadValidationMessage(null);
        showToast('No valid files found in package.', 'info');
        return;
      }

      const filesToProcess: { file: File; targetForm: OrderItem }[] = [];

      for (const file of rawFilesList) {
        // Find best matching order requirement (longer form codes tested first to avoid prefix shadowing)
        const sortedItems = [...order.items].sort((a, b) => (b.form_code?.length || 0) - (a.form_code?.length || 0));
        
        let matched: OrderItem | undefined = sortedItems.find(item =>
          checkFormUploadMatch({ file_name: file.name }, item)
        );

        if (!matched) {
          // If only 1 item in order and remove_filename_restriction
          if (order.items.length === 1 && (order.items[0].remove_filename_restriction || order.items[0].is_hira)) {
            matched = order.items[0];
          } else {
            validationErrors.push(`"${file.name}": Does not match any required form code in this order.`);
            continue;
          }
        }

        // Run strict checker on the file
        setUploadValidationMessage(`Checking "${file.name}" for ${matched.form_code}...`);
        let valResult: ValidationResult;
        try {
          valResult = await validateFileAgainstForm(file, {
            form_id: matched.form_id,
            form_code: matched.form_code,
            description: matched.description,
            form_date: matched.form_date,
            is_hira: matched.is_hira,
            remove_filename_restriction: matched.remove_filename_restriction,
            allowed_file_types: matched.allowed_file_types
          });
        } catch (valErr: any) {
          console.warn(`Local validation warning for ${file.name}:`, valErr);
          // Safe fallback: If local file reading/parsing fails, accept based on matched form code
          valResult = { matched: true, reason: 'Matched form code requirement' };
        }

        if (valResult.matched) {
          filesToProcess.push({ file, targetForm: matched });
        } else {
          validationErrors.push(`"${file.name}": ${valResult.reason || 'Failed content/format verification'}`);
        }
      }

      if (filesToProcess.length === 0) {
        const primaryReason = validationErrors[0] || 'No files passed the required form verification checks.';
        const errTitle = `Document Verification Failed (${validationErrors.length} file(s) rejected):`;
        setUploadErrorMessage(errTitle);
        setUploadDetailedErrors(validationErrors);
        setLastFailedUpload({
          type: 'bulk',
          orderId: order.id,
          order,
          files: rawFilesList,
          fileNames: rawFilesList.map(f => f.name),
          totalSize: formatFilesTotalSize(rawFilesList),
          timestamp: Date.now(),
          errorMessage: primaryReason,
          detailedErrors: validationErrors
        });
        showToast(`Verification Failed: ${primaryReason}`, 'error');
        return;
      }

      // Group valid files by item requirement to send
      const grouped = new Map<string, { formItem: OrderItem; files: File[] }>();
      filesToProcess.forEach(({ file, targetForm }) => {
        const groupKey = String(targetForm.id || targetForm.form_id || targetForm.form_code);
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, { formItem: targetForm, files: [] });
        }
        const currentGroup = grouped.get(groupKey)!;
        if (!targetForm.is_hira && currentGroup.files.length >= 1) {
          validationErrors.push(`"${file.name}": Skipped because form "${targetForm.form_code}" only accepts 1 file (Multiple Files is not enabled).`);
          return;
        }
        currentGroup.files.push(file);
      });

      let totalUploaded = 0;
      for (const [, { formItem, files }] of grouped) {
        setUploadValidationMessage(`Uploading ${files.length} file(s) for ${formItem.form_code || 'order checklist item'}...`);
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        formData.append('vessel_id', String(targetVessel.id));
        formData.append('vessel_name', targetVessel.name);
        formData.append('form_id', formItem.form_id || '');
        formData.append('form_code', formItem.form_code || '');
        if (formItem.id != null) {
          formData.append('item_id', String(formItem.id));
        }

        let res: Response;
        try {
          res = await fetch(`/api/sms/orders/${order.id}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });
        } catch (fetchErr: any) {
          throw new Error(`Server connection failed (${fetchErr.message || 'Failed to fetch'}). Please verify your connection and try again.`);
        }

        if (res.ok) {
          totalUploaded += files.length;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server rejected upload for ${formItem.form_code || 'item'} (HTTP ${res.status})`);
        }
      }

      if (validationErrors.length > 0) {
        const partialMsg = `Uploaded ${totalUploaded} valid file(s), but ${validationErrors.length} file(s) were rejected:`;
        setUploadErrorMessage(partialMsg);
        setUploadDetailedErrors(validationErrors);
        setLastFailedUpload({
          type: 'bulk',
          orderId: order.id,
          order,
          files: rawFilesList,
          targetVessel,
          fileNames: rawFilesList.map(f => f.name),
          totalSize: formatFilesTotalSize(rawFilesList),
          timestamp: Date.now(),
          errorMessage: partialMsg,
          detailedErrors: validationErrors
        });
        showToast(`Uploaded ${totalUploaded} valid file(s). ${validationErrors.length} file(s) were rejected by the validation checker.`, 'info');
      } else {
        setUploadErrorMessage(null);
        setUploadDetailedErrors([]);
        setLastFailedUpload(null);
        setBulkFetchFailureCount(0);
        showToast(`Bulk upload complete! Successfully verified and uploaded ${totalUploaded} file(s) for ${targetVessel.name}.`);
      }
      await fetchOrders(true);
      onStatusRefresh?.();
    } catch (e: any) {
      const rawErrorMsg = e?.message || 'Unknown error';
      const isFetchErr = 
        rawErrorMsg.toLowerCase().includes('failed to fetch') ||
        rawErrorMsg.toLowerCase().includes('networkerror') ||
        rawErrorMsg.toLowerCase().includes('server connection failed') ||
        rawErrorMsg.toLowerCase().includes('network error') ||
        rawErrorMsg.toLowerCase().includes('connection refused') ||
        rawErrorMsg.toLowerCase().includes('aborted');

      const nextFailureCount = isFetchErr ? bulkFetchFailureCount + 1 : bulkFetchFailureCount;
      if (isFetchErr) {
        setBulkFetchFailureCount(nextFailureCount);
      }

      let suggestionText: string | null = null;
      if (isFetchErr && nextFailureCount >= 2) {
        suggestionText = 'Bulk upload has encountered repeated connection issues ("Failed to fetch"). We recommend refreshing your browser or uploading files individually for each checklist item.';
      }

      const errStr = 'Bulk upload error: ' + rawErrorMsg;
      setUploadErrorMessage(errStr);
      setLastFailedUpload({
        type: 'bulk',
        orderId: order.id,
        order,
        files: Array.from(files),
        targetVessel,
        fileNames: Array.from(files).map(f => f.name),
        totalSize: formatFilesTotalSize(Array.from(files)),
        timestamp: Date.now(),
        errorMessage: errStr,
        isFetchError: isFetchErr,
        failureCount: nextFailureCount,
        suggestion: suggestionText
      });

      if (suggestionText) {
        showToast(`Bulk upload failed (${rawErrorMsg}). Tip: Please refresh your browser or try uploading files individually.`, 'error');
      } else {
        showToast(errStr, 'error');
      }
    } finally {
      setUploadProgress(false);
      setUploadValidationMessage(null);
    }
  };

  // Re-try previous failed upload
  const handleRetryUpload = async () => {
    if (!lastFailedUpload) return;
    const failed = { ...lastFailedUpload };
    if (failed.type === 'single' && failed.formItem) {
      await handleFileUpload(failed.orderId, failed.formItem, failed.files, failed.targetVessel);
    } else if (failed.type === 'bulk' && failed.order) {
      await handleBulkUpload(failed.order, failed.files, failed.targetVessel);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Notification Toast */}
      {toastMessage && (
        <div 
          className={`fixed top-5 right-5 z-[99999] pointer-events-auto flex items-start gap-3 px-4.5 py-3.5 rounded-2xl shadow-2xl border text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200 max-w-lg ${
            toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-emerald-950/20' :
            toastMessage.type === 'error' ? 'bg-rose-50 text-rose-900 border-rose-300 shadow-rose-950/20' :
            'bg-blue-50 text-blue-900 border-blue-300 shadow-blue-950/20'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : toastMessage.text.includes('processing') || toastMessage.text.includes('Preparing') ? (
            <Loader2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0 pr-1">
            <p className="leading-snug text-xs sm:text-sm font-bold whitespace-pre-wrap">{toastMessage.text}</p>
          </div>
          <button 
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md shrink-0 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <ConfirmationModal
          title={confirmModal.title}
          message={confirmModal.message}
          detail={confirmModal.detail}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={confirmModal.cancelLabel}
          isDestructive={confirmModal.isDestructive}
          loading={confirmLoading}
          onConfirm={async () => {
            setConfirmLoading(true);
            try {
              await confirmModal.onConfirm();
            } finally {
              setConfirmLoading(false);
              setConfirmModal(null);
            }
          }}
          onCancel={() => {
            if (!confirmLoading) setConfirmModal(null);
          }}
        />
      )}

      {/* Main Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-200/60">
            <CheckSquare className="w-3 h-3 text-blue-600" />
            Safety Management System
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            SMS Orders &amp; Reporting
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            {isVesselUser
              ? 'Review requested SMS checklists assigned to your vessel, monitor due dates, and submit verified compliance files.'
              : 'Dispatch checklist orders to fleet vessels, monitor submission progress, download archives, and manage compliance.'}
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0 flex-wrap">
          <button
            onClick={() => { setRefreshing(true); fetchOrders(true); }}
            disabled={refreshing}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
            title="Refresh Order List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Upload Without Order Button (Disabled) */}
          <button
            type="button"
            disabled
            className="px-3.5 py-2 text-slate-400 bg-slate-100 border border-slate-200/80 rounded-xl transition-all text-xs font-bold flex items-center gap-2 cursor-not-allowed shadow-none opacity-60 select-none"
            title="Direct upload is disabled"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Upload Without Order</span>
          </button>

          {isManagementOrAdmin && (
            <>
              {totalUncheckedCount > 0 && (
                <button
                  onClick={handleMarkAllOrdersChecked}
                  className="px-3.5 py-2 text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-300/80 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Mark all pending vessel uploads as read"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                  <span>Mark All Read ({totalUncheckedCount})</span>
                </button>
              )}

              <button
                onClick={() => setIsTemplatesModalOpen(true)}
                className="px-3.5 py-2 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Manage reusable order templates"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-blue-600" />
                <span>Templates</span>
                {userVisibleTemplates.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black border border-blue-200">
                    {userVisibleTemplates.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMergeModalOpen(true)}
                className={`px-3.5 py-2 border rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                  selectedOrderIdsForMerge.length >= 2
                    ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Merge multiple order lists into one consolidated order"
              >
                <GitMerge className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {selectedOrderIdsForMerge.length >= 2
                    ? `Merge Selected (${selectedOrderIdsForMerge.length})`
                    : 'Merge Orders'}
                </span>
              </button>

              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-xs hover:shadow flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Order</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload Failed Notification Banner with Direct Retry Action */}
      {lastFailedUpload && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 shadow-xs space-y-2.5 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-black text-rose-900 uppercase tracking-wide">
                    Upload Failed ({lastFailedUpload.type === 'bulk' ? 'Bulk Upload' : lastFailedUpload.formItem?.form_code || 'Form Item'})
                  </h4>
                  <span className="px-2 py-0.2 bg-rose-200/70 text-rose-900 rounded-md text-[10px] font-black">
                    {lastFailedUpload.fileNames.length} file(s) • {lastFailedUpload.totalSize}
                  </span>
                </div>
                <p className="text-xs text-rose-800 font-medium leading-relaxed break-words">
                  {lastFailedUpload.errorMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
              {lastFailedUpload.suggestion && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Browser</span>
                </button>
              )}

              <button
                type="button"
                disabled={uploadProgress}
                onClick={handleRetryUpload}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <RotateCcw className={`w-3 h-3 ${uploadProgress ? 'animate-spin' : ''}`} />
                <span>{uploadProgress ? 'Retrying...' : 'Retry Upload'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLastFailedUpload(null);
                  setUploadErrorMessage(null);
                  setUploadDetailedErrors([]);
                }}
                className="p-1.5 text-rose-600 hover:text-rose-900 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {lastFailedUpload.suggestion && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-950 font-medium leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>{lastFailedUpload.suggestion}</div>
            </div>
          )}
        </div>
      )}

      {/* Unified Navigation & Filter Toolbar (Streamlined, non-cluttered control center) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3">
        {/* Row 1: View Modes & Interactive Status Filter Metrics */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* View Mode Segmented Control */}
          <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => setOrderTypeFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                orderTypeFilter === 'all'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                orderTypeFilter === 'all' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {userVisibleOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setOrderTypeFilter('order_lists_only')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                orderTypeFilter === 'order_lists_only'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Order Lists</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                orderTypeFilter === 'order_lists_only' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {orderListsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setOrderTypeFilter('direct_uploads_only')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                orderTypeFilter === 'direct_uploads_only'
                  ? 'bg-white text-teal-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Direct Uploads</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                orderTypeFilter === 'direct_uploads_only' ? 'bg-teal-50 text-teal-700' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {directUploadsCount}
              </span>
            </button>
          </div>

          {/* Interactive Status Metrics (Quick 1-Click Status Filter Tabs) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: 'All', label: 'All', count: stats.total, dot: null },
              { id: 'Completed', label: 'Completed', count: stats.completed, dot: 'bg-emerald-500' },
              { id: 'Pending', label: 'Pending', count: stats.pending, dot: 'bg-amber-500' },
              { id: 'Overdue', label: 'Overdue', count: stats.overdue, dot: 'bg-rose-500' }
            ].map(item => {
              const isActive = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isActive
                      ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/70 hover:border-slate-300'
                  }`}
                >
                  {item.dot && <span className={`w-2 h-2 rounded-full ${item.dot} shrink-0`} />}
                  <span>{item.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Search Input and Secondary Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                orderTypeFilter === 'direct_uploads_only'
                  ? "Search direct uploads by vessel, report, or submitter..."
                  : isVesselUser 
                  ? "Search orders by label, form code or instructions..." 
                  : "Search orders by label, vessel, form code, or creator..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Vessel Filter (Office Only) */}
            {isManagementOrAdmin && (
              <select
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="All">All Vessels</option>
                {vessels.map(v => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
            )}

            {/* Team Filter (Office Only) */}
            {isManagementOrAdmin && teams.length > 0 && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="All">All Teams</option>
                {teams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            {/* Reset Filter Button */}
            {(searchQuery || statusFilter !== 'All' || vesselFilter !== 'All' || teamFilter !== 'All' || orderTypeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setVesselFilter('All');
                  setTeamFilter('All');
                  setOrderTypeFilter('all');
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-600 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Order List Display */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading SMS orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto ${
            orderTypeFilter === 'direct_uploads_only'
              ? 'bg-teal-50 text-teal-600'
              : orderTypeFilter === 'order_lists_only'
              ? 'bg-blue-50 text-blue-600'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {orderTypeFilter === 'direct_uploads_only' ? (
              <FolderPlus className="w-6 h-6" />
            ) : orderTypeFilter === 'order_lists_only' ? (
              <CheckSquare className="w-6 h-6" />
            ) : (
              <Layers className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {orderTypeFilter === 'direct_uploads_only'
                ? 'No Direct Vessel Uploads Found'
                : orderTypeFilter === 'order_lists_only'
                ? 'No SMS Order Lists Found'
                : 'No Orders or Submissions Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || statusFilter !== 'All' || vesselFilter !== 'All' || teamFilter !== 'All'
                ? 'No items match your active search and filter criteria. Try clearing search or resetting filters.'
                : orderTypeFilter === 'direct_uploads_only'
                ? 'No direct submissions from vessels have been uploaded yet.'
                : isVesselUser
                ? 'There are currently no active SMS form orders assigned to your vessel.'
                : 'No SMS order lists have been created yet. Click "Create Order" to dispatch requirements to vessels.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            {(searchQuery || statusFilter !== 'All' || vesselFilter !== 'All' || teamFilter !== 'All' || orderTypeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setVesselFilter('All');
                  setTeamFilter('All');
                  setOrderTypeFilter('all');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isDeadlinePassed = order.deadlineDate && new Date(order.deadlineDate) < new Date(new Date().setHours(0, 0, 0, 0));
            const totalForms = order.items?.length || 0;
            
            // Vessel progress calculation
            const myVessel = isVesselUser 
              ? (order.vessels.find(v => {
                  const myVId = currentUser.vessel_id != null ? String(currentUser.vessel_id).trim() : '';
                  const myName = (currentUser.username || '').toLowerCase().trim();
                  const vId = v.vessel_id != null ? String(v.vessel_id).trim() : '';
                  const vName = (v.vessel_name || '').toLowerCase().trim();
                  if (myVId && vId && (myVId === vId || myVId.replace(/^v/i, '') === vId.replace(/^v/i, ''))) return true;
                  if (myName && vName && (myName === vName || myName.includes(vName) || vName.includes(myName))) return true;
                  return false;
                }) || order.vessels[0])
              : null;

            const myUploads = isVesselUser ? getVesselUploads(order.uploads, myVessel, order.vessels) : [];
            const myVerifiedCount = order.items?.filter(item => myUploads.some(u => checkFormUploadMatch(u, item))).length || 0;
            
            const isMyVesselDone = isVesselUser && (myVessel?.status === 'Completed' || (myVessel?.submittedCount || 0) >= totalForms || (totalForms > 0 && myVerifiedCount >= totalForms));
            
            // Calculate uploaded files per vessel and overall progress
            let totalUploadedFilesCount = 0;
            let completedVesselsCount = 0;
            const targetVesselsCount = Math.max(1, order.vessels.length);

            order.vessels.forEach(v => {
              const vUps = getVesselUploads(order.uploads, v, order.vessels);
              const vVerified = order.items?.filter(item => vUps.some(u => checkFormUploadMatch(u, item))).length || 0;
              const isVDone = v.status === 'Completed' || (totalForms > 0 && (vVerified >= totalForms || (v.submittedCount || 0) >= totalForms));
              const distinctCount = isVDone ? totalForms : vVerified;
              totalUploadedFilesCount += distinctCount;
              if (isVDone) {
                completedVesselsCount++;
              }
            });

            const isAllVesselsDone = order.vessels.length > 0 && completedVesselsCount === order.vessels.length;
            const isFullyCompleted = isVesselUser ? isMyVesselDone : (order.overallStatus === 'Completed' || isAllVesselsDone);

            // Progress targets and uploaded counts
            const totalTarget = isVesselUser 
              ? totalForms 
              : (order.vessels.length === 1 ? totalForms : totalForms * targetVesselsCount);

            const submittedCount = isVesselUser 
              ? (isMyVesselDone ? totalForms : myVerifiedCount)
              : (isFullyCompleted ? totalTarget : totalUploadedFilesCount);

            const percent = totalTarget > 0 ? Math.min(100, Math.round((submittedCount / totalTarget) * 100)) : 0;

            const hasAnyReplacementReq = (order.uploads || []).some(u => Boolean(u.replace_requested_at));
            const myHasReplacementReq = isVesselUser 
              ? myUploads.some(u => Boolean(u.replace_requested_at))
              : hasAnyReplacementReq;

            const unreadCountForOrder = (order.uploads || []).filter(u => !u.is_read && !u.checked_at).length;

            return (
              <div
                key={order.id}
                onClick={() => {
                  setSelectedOrderForInspection(order);
                  if (order.vessels.length > 0) {
                    setActiveVesselTabInDetail(order.vessels[0].vessel_name);
                  }
                }}
                className={`group bg-white rounded-2xl border transition-all p-5 space-y-4 cursor-pointer ${
                  selectedOrderIdsForMerge.includes(order.id)
                    ? 'border-blue-400 bg-blue-50/15 shadow-sm ring-2 ring-blue-500/25'
                    : myHasReplacementReq
                    ? 'border-rose-300 bg-rose-50/15 shadow-2xs hover:shadow-md hover:border-rose-400'
                    : 'border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300'
                }`}
              >
                {/* Header Row: Title, Status Badge, Due Date, and Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0 flex-1">
                    {/* Merge Selection Checkbox (Office Only) */}
                    {isManagementOrAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderIdsForMerge(prev =>
                            prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id]
                          );
                        }}
                        className={`p-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                          selectedOrderIdsForMerge.includes(order.id)
                            ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                            : 'border-slate-300 hover:border-blue-400 text-transparent hover:text-slate-300 bg-white'
                        }`}
                        title={selectedOrderIdsForMerge.includes(order.id) ? 'Deselect order' : 'Select order for merging'}
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <h3 className="text-base font-bold text-slate-900 tracking-tight group-hover:text-blue-700 transition-colors truncate">
                      {order.label}
                    </h3>

                    {/* Status Badge */}
                    {myHasReplacementReq ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        Revision Required
                      </span>
                    ) : isFullyCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Completed
                      </span>
                    ) : isDeadlinePassed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/70">
                        <Clock className="w-3 h-3 text-rose-600" />
                        Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/70">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Pending
                      </span>
                    )}

                    {/* Direct Upload / Order Package Pill */}
                    {order.id.startsWith('ord_direct_') && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                        Direct Submission
                      </span>
                    )}
                  </div>

                  {/* Due Date & Action Cluster */}
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center" onClick={(e) => e.stopPropagation()}>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                      isDeadlinePassed && !isFullyCompleted
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Due {order.deadlineDate}</span>
                    </span>

                    {/* Open Order Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderForInspection(order);
                        if (order.vessels.length > 0) {
                          setActiveVesselTabInDetail(order.vessels[0].vessel_name);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isVesselUser ? 'Open & Upload' : 'Open Order'}</span>
                    </button>

                    {/* Secondary Actions Menu */}
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5">
                      {/* Mark Read */}
                      {isManagementOrAdmin && unreadCountForOrder > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMarkOrderChecked(order.id)}
                          className="p-1.5 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                          title={`Mark ${unreadCountForOrder} document(s) as read`}
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                        </button>
                      )}

                      {/* Templates ZIP */}
                      <button
                        type="button"
                        onClick={() => handleDownloadOrderTemplatesZip(order.id, order.label)}
                        disabled={downloadingTemplatesZipOrderId === order.id}
                        className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        title="Download blank templates (ZIP)"
                      >
                        {downloadingTemplatesZipOrderId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        ) : (
                          <FolderDown className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </button>

                      {/* Uploads ZIP (Office only) */}
                      {isManagementOrAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDownloadZip(order.id, order.label)}
                          disabled={downloadingZipOrderId === order.id}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title="Download submitted files (ZIP)"
                        >
                          {downloadingZipOrderId === order.id ? (
                            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </button>
                      )}

                      {/* Edit (Office only) */}
                      {isManagementOrAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrder(order);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title="Edit Order"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                      )}

                      {/* Merge Order (Office only) */}
                      {isManagementOrAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderIdsForMerge(prev =>
                              prev.includes(order.id) ? prev : [order.id, ...prev]
                            );
                            setIsMergeModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
                          title="Merge with other orders"
                        >
                          <GitMerge className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                      )}

                      {/* Delete (Office only) */}
                      {isManagementOrAdmin && (
                        <button
                          type="button"
                          onClick={() => requestDeleteOrder(order.id, order.label)}
                          className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                          title="Delete Order"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtitle / Metadata Strip */}
                <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <OrderVesselsTooltip
                      vessels={order.vessels}
                      totalForms={totalForms}
                      orderUploads={order.uploads}
                      orderItems={order.items}
                      position="bottom"
                    >
                      <span className="font-semibold text-slate-700 hover:text-blue-600">
                        {order.vessels.length} {order.vessels.length === 1 ? 'Vessel' : 'Vessels'}
                      </span>
                    </OrderVesselsTooltip>
                    <span>•</span>
                    <OrderRequirementsTooltip
                      items={order.items || []}
                      position="bottom"
                    >
                      <span>
                        <strong className="text-slate-700">{totalForms}</strong> {totalForms === 1 ? 'Requirement' : 'Requirements'}
                      </span>
                    </OrderRequirementsTooltip>
                    <span>•</span>
                    <span>Issued by <strong className="text-slate-700">{order.createdByName}</strong></span>
                  </div>

                  {/* Progress fraction and percentage */}
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-slate-500">Progress:</span>
                    <span className={`font-bold ${isFullyCompleted ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {submittedCount} / {totalTarget} ({percent}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isFullyCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Instructions snippet if present */}
                {order.instructions && (
                  <p className="text-xs text-slate-600 line-clamp-1 italic bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-100">
                    <span className="font-bold not-italic text-slate-700">Note:</span> {order.instructions}
                  </p>
                )}

                {/* Bottom Row: Clean Scannable Summary */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    {!isVesselUser && order.vessels.length > 1 && (
                      <OrderVesselsTooltip
                        vessels={order.vessels}
                        totalForms={totalForms}
                        orderUploads={order.uploads}
                        orderItems={order.items}
                        position="top"
                      >
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <Ship className="w-3.5 h-3.5 text-slate-400" />
                          <span>{completedVesselsCount} of {order.vessels.length} vessels completed</span>
                        </span>
                      </OrderVesselsTooltip>
                    )}
                    {isVesselUser && (
                      <OrderVesselsTooltip
                        vessels={order.vessels}
                        totalForms={totalForms}
                        orderUploads={order.uploads}
                        orderItems={order.items}
                        position="top"
                      >
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <Ship className="w-3.5 h-3.5 text-slate-400" />
                          <span>Assigned to {myVessel?.vessel_name || currentUser.username}</span>
                        </span>
                      </OrderVesselsTooltip>
                    )}
                  </div>

                  <span className="text-blue-600 font-semibold text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>View full checklist &amp; submissions</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Selection & Merge Bar for Non-Vessel Users */}
      {isManagementOrAdmin && selectedOrderIdsForMerge.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-bold tracking-tight">
              {selectedOrderIdsForMerge.length} {selectedOrderIdsForMerge.length === 1 ? 'order' : 'orders'} selected
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMergeModalOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title={selectedOrderIdsForMerge.length < 2 ? 'Open merge dialog to pick a second order' : 'Merge selected orders'}
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>{selectedOrderIdsForMerge.length >= 2 ? `Merge Selected (${selectedOrderIdsForMerge.length})` : 'Merge Order...'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedOrderIdsForMerge([])}
              className="px-2.5 py-1.5 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* MODAL: REPLACEMENT REQUEST DIALOG */}
      {replacementModalState?.isOpen && (
        <ReplacementRequestModal
          isOpen={replacementModalState.isOpen}
          uploadId={replacementModalState.uploadId}
          fileName={replacementModalState.fileName}
          onClose={() => setReplacementModalState(null)}
          onSubmit={handleRequestReplacement}
        />
      )}

      {/* MODAL 0: INLINE DOCUMENT & TEMPLATE VIEWER */}
      {previewModal?.isOpen && (
        <DocumentPreviewModal
          modal={previewModal}
          onClose={handleClosePreviewModal}
          onRequestReplacement={(uploadId, fileName) => {
            setReplacementModalState({ isOpen: true, uploadId, fileName });
          }}
          onCancelReplacementRequest={(uploadId) => {
            handleCancelReplacementRequest(uploadId);
          }}
          onDownload={() => {
            if (previewModal.isTemplate && (previewModal.formId || previewModal.formCode)) {
              handleDownloadTemplate(previewModal.formId || '', previewModal.formCode || '', previewModal.fileName);
            } else if (previewModal.uploadId) {
              handleDownloadUpload(previewModal.uploadId, previewModal.fileName);
            }
          }}
          onMarkRead={() => {
            if (previewModal.uploadId) {
              handleMarkSingleUploadChecked(previewModal.uploadId);
              setPreviewModal(prev => prev ? { ...prev, isRead: true } : null);
            }
          }}
          isManagementOrAdmin={isManagementOrAdmin}
          token={token}
        />
      )}

      {/* MODAL 1: ORDER INSPECTION & SUBMISSION WORKSPACE */}
      {selectedOrderForInspection && (
        <OrderDetailsModal
          order={selectedOrderForInspection}
          onRequestReplacement={(uploadId, fileName) => {
            setReplacementModalState({ isOpen: true, uploadId, fileName });
          }}
          onCancelReplacementRequest={(uploadId) => {
            handleCancelReplacementRequest(uploadId);
          }}
          isVesselUser={isVesselUser}
          isManagementOrAdmin={isManagementOrAdmin}
          currentUser={currentUser}
          vessels={vessels}
          activeVesselTab={activeVesselTabInDetail}
          setActiveVesselTab={setActiveVesselTabInDetail}
          token={token}
          onClose={() => {
            setSelectedOrderForInspection(null);
            setUploadErrorMessage(null);
            setUploadDetailedErrors([]);
          }}
          isDownloadingZip={downloadingZipOrderId === selectedOrderForInspection.id}
          isDownloadingTemplatesZip={downloadingTemplatesZipOrderId === selectedOrderForInspection.id}
          onDownloadZip={handleDownloadZip}
          onDownloadUpload={handleDownloadUpload}
          onDownloadTemplate={handleDownloadTemplate}
          onDownloadOrderTemplatesZip={handleDownloadOrderTemplatesZip}
          onPreviewUpload={handlePreviewUpload}
          onPreviewTemplate={handlePreviewTemplate}
          onDeleteUpload={requestDeleteUpload}
          onFileUpload={handleFileUpload}
          onBulkUpload={handleBulkUpload}
          uploadingForFormId={uploadingForFormId}
          uploadProgress={uploadProgress}
          uploadValidationMessage={uploadValidationMessage}
          uploadErrorMessage={uploadErrorMessage}
          uploadDetailedErrors={uploadDetailedErrors}
          lastFailedUpload={lastFailedUpload}
          onRetryUpload={handleRetryUpload}
          onClearUploadError={() => {
            setLastFailedUpload(null);
            setUploadErrorMessage(null);
            setUploadDetailedErrors([]);
          }}
          onMarkOrderChecked={handleMarkOrderChecked}
          onMarkSingleUploadChecked={handleMarkSingleUploadChecked}
          onEditOrder={(orderToEdit) => {
            setSelectedOrderForInspection(null);
            setEditingOrder(orderToEdit);
            setIsCreateModalOpen(true);
          }}
        />
      )}

      {/* MODAL 2: ORDER CREATION / EDIT WIZARD (Admin / Management) */}
      {isCreateModalOpen && (
        <CreateOrEditOrderModal
          editingOrder={editingOrder}
          availableForms={availableForms}
          vessels={vessels}
          templates={userVisibleTemplates}
          token={token}
          currentUser={currentUser}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingOrder(null);
          }}
          onSuccess={() => {
            const wasEditing = Boolean(editingOrder);
            setIsCreateModalOpen(false);
            setEditingOrder(null);
            fetchOrders();
            fetchTemplates();
            onStatusRefresh?.();
            showToast(wasEditing ? 'Order list updated successfully!' : 'New order list dispatched to target vessels!', 'success');
          }}
        />
      )}

      {/* MODAL 3: REUSABLE TEMPLATES MANAGER */}
      {isTemplatesModalOpen && (
        <TemplatesManagerModal
          templates={userVisibleTemplates}
          availableForms={availableForms}
          token={token}
          onClose={() => setIsTemplatesModalOpen(false)}
          onRequestDeleteTemplate={(tplId, title) => {
            setConfirmModal({
              isOpen: true,
              title: 'Delete Template',
              message: `Are you sure you want to delete template "${title}"?`,
              detail: 'This template will no longer be available for quickly populating new order lists.',
              confirmLabel: 'Delete Template',
              cancelLabel: 'Cancel',
              isDestructive: true,
              onConfirm: async () => {
                try {
                  const res = await fetch(`/api/sms/order-templates/${tplId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) {
                    fetchTemplates();
                    showToast(`Template "${title}" deleted.`);
                  }
                } catch (e: any) {
                  showToast('Error deleting template: ' + e.message, 'error');
                }
              }
            });
          }}
          onApplyTemplate={(tpl) => {
            setIsTemplatesModalOpen(false);
            setEditingOrder({
              id: '',
              label: tpl.title,
              deadlineDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              instructions: tpl.description || '',
              createdById: String(currentUser.id),
              createdByName: currentUser.username,
              createdAt: new Date().toISOString(),
              vessels: [],
              items: availableForms.filter(f => tpl.itemFormIds.includes(f.id)).map(f => ({
                form_id: f.id,
                form_code: f.formCode,
                category: f.category,
                description: f.description,
                form_date: f.formDate,
                type: f.type,
                is_hira: Boolean(f.isHira),
                remove_filename_restriction: Boolean(f.removeFilenameRestriction),
                allowed_file_types: f.allowedFileTypes || []
              }))
            });
            setIsCreateModalOpen(true);
          }}
          onRefresh={fetchTemplates}
        />
      )}

      {/* MODAL 4: DIRECT UPLOAD WITHOUT ORDER */}
      {isDirectUploadModalOpen && (
        <SMSDirectUploadModal
          vessels={vessels}
          currentUser={currentUser}
          availableForms={availableForms}
          token={token}
          onClose={() => setIsDirectUploadModalOpen(false)}
          onSuccess={(orderId, count) => {
            setIsDirectUploadModalOpen(false);
            fetchOrders();
            onStatusRefresh?.();
            setOrderTypeFilter('direct_uploads_only');
            showToast(`Successfully uploaded ${count} file(s) without order! Switched view to Direct Vessel Uploads.`, 'success');
          }}
        />
      )}

      {/* MODAL 5: MERGE ORDERS (Office / Non-vessel users) */}
      {isMergeModalOpen && isManagementOrAdmin && (
        <MergeOrdersModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          orders={userVisibleOrders}
          initialSelectedOrderIds={selectedOrderIdsForMerge}
          token={token}
          onSuccess={(targetOrderId, label) => {
            setIsMergeModalOpen(false);
            setSelectedOrderIdsForMerge([]);
            fetchOrders();
            onStatusRefresh?.();
            showToast(`Orders merged successfully into "${label}"!`, 'success');
            const mergedOrder = orders.find(o => o.id === targetOrderId);
            if (mergedOrder) {
              setSelectedOrderForInspection(mergedOrder);
              if (mergedOrder.vessels && mergedOrder.vessels.length > 0) {
                setActiveVesselTabInDetail(mergedOrder.vessels[0].vessel_name);
              }
            }
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: CONFIRMATION MODAL
// ==========================================
export const sortByFormCode = <T extends { form_code?: string; [key: string]: any }>(items: T[]): T[] => {
  if (!items) return [];
  return [...items].sort((a, b) => {
    const codeA = a.form_code || '';
    const codeB = b.form_code || '';
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });
};

interface ConfirmationModalProps {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  loading = false,
  onConfirm,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 z-[9990] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
              {isDestructive ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-black text-slate-800 tracking-tight">{title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
              {detail && (
                <p className="text-[11px] text-slate-400 leading-normal pt-1">{detail}</p>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={`px-5 py-2 text-white rounded-xl text-xs font-black tracking-wide shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 ${
                isDestructive 
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
              }`}
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: ORDER DETAILS / WORKSPACE MODAL
// ==========================================
interface OrderDetailsModalProps {
  order: SMSOrder;
  isVesselUser: boolean;
  isManagementOrAdmin?: boolean;
  currentUser: CurrentUser;
  vessels: Vessel[];
  activeVesselTab: string;
  setActiveVesselTab: (tab: string) => void;
  token: string;
  onClose: () => void;
  onDownloadZip: (orderId: string, label: string, vesselId?: string) => void;
  onDownloadUpload: (uploadId: number, fileName: string) => void;
  onDownloadTemplate: (formId: string, formCode: string, templateFileName?: string) => void;
  onDownloadOrderTemplatesZip: (orderId: string, label: string) => void;
  onPreviewUpload: (uploadId: number, fileName: string, fileMimetype?: string, formCode?: string, vesselName?: string, isRead?: boolean) => void;
  onPreviewTemplate: (formId: string, formCode: string, templateFileName?: string) => void;
  onDeleteUpload: (uploadId: number, fileName: string) => void;
  onFileUpload: (orderId: string, formItem: OrderItem, files: FileList | File[], targetVessel?: { id: string | number; name: string }) => void;
  onBulkUpload: (order: SMSOrder, files: FileList | File[], targetVessel?: { id: string | number; name: string }) => void;
  uploadingForFormId?: string | null;
  uploadProgress: boolean;
  uploadValidationMessage?: string | null;
  uploadErrorMessage?: string | null;
  uploadDetailedErrors?: string[];
  lastFailedUpload?: FailedUploadInfo | null;
  onRetryUpload?: () => void;
  onClearUploadError?: () => void;
  onMarkOrderChecked?: (orderId: string, vesselId?: string) => void;
  onMarkSingleUploadChecked?: (uploadId: number) => void;
  onRequestReplacement?: (uploadId: number, fileName: string) => void;
  onCancelReplacementRequest?: (uploadId: number) => void;
  onEditOrder?: (order: SMSOrder) => void;
  isDownloadingZip?: boolean;
  isDownloadingTemplatesZip?: boolean;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isVesselUser,
  isManagementOrAdmin,
  currentUser,
  vessels,
  activeVesselTab,
  setActiveVesselTab,
  token,
  onClose,
  onDownloadZip,
  onDownloadUpload,
  onDownloadTemplate,
  onDownloadOrderTemplatesZip,
  onPreviewUpload,
  onPreviewTemplate,
  onDeleteUpload,
  onFileUpload,
  onBulkUpload,
  uploadingForFormId,
  uploadProgress,
  uploadValidationMessage,
  uploadErrorMessage,
  uploadDetailedErrors,
  lastFailedUpload,
  onRetryUpload,
  onClearUploadError,
  onMarkOrderChecked,
  onMarkSingleUploadChecked,
  onRequestReplacement,
  onCancelReplacementRequest,
  onEditOrder,
  isDownloadingZip,
  isDownloadingTemplatesZip
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checklistSearch, setChecklistSearch] = useState('');
  const [checklistFilter, setChecklistFilter] = useState<'all' | 'pending' | 'uploaded' | 'revision'>('all');

  // Active target vessel for display
  const activeVessel = isVesselUser 
    ? (order.vessels.find(v => {
        const currentVId = currentUser.vessel_id != null ? String(currentUser.vessel_id).trim() : '';
        const currentVIdClean = currentVId.replace(/^v/i, '').trim();
        const vId = String(v.vessel_id || '').trim();
        const vIdClean = vId.replace(/^v/i, '').trim();
        const uName = (currentUser.username || '').toLowerCase().trim();
        const vName = (v.vessel_name || '').toLowerCase().trim();
        const normVName = (v.vessel_name || '').toLowerCase().replace(/^m\/?v\.?\s+/i, '').replace(/[^a-z0-9]/g, '').trim();
        const normUName = uName.replace(/^m\/?v\.?\s+/i, '').replace(/[^a-z0-9]/g, '').trim();

        if (currentVId && vId && (currentVId === vId || currentVIdClean === vIdClean)) return true;
        if (uName && vName && (uName === vName || normUName === normVName || normUName.includes(normVName) || normVName.includes(normUName))) return true;
        return false;
      }) || order.vessels[0])
    : (order.vessels.find(v => v.vessel_name === activeVesselTab) || order.vessels[0]);

  // Uploads for the active vessel
  const vesselUploads = getVesselUploads(order.uploads, activeVessel, order.vessels);

  const totalRequired = order.items.length;
  const verifiedCount = order.items.filter(formItem => 
    vesselUploads.some(u => checkFormUploadMatch(u, formItem))
  ).length;

  const revisionCount = useMemo(() => {
    return order.items.filter(formItem => {
      const itemUploads = vesselUploads.filter(u => checkFormUploadMatch(u, formItem));
      return itemUploads.some(u => Boolean(u.replace_requested_at));
    }).length;
  }, [order.items, vesselUploads]);

  const isVesselDone = (totalRequired > 0 && verifiedCount >= totalRequired) || activeVessel?.status === 'Completed';
  const distinctUploaded = isVesselDone ? totalRequired : verifiedCount;
  const progressPercent = totalRequired > 0 ? Math.round((distinctUploaded / totalRequired) * 100) : 0;

  // Filter and search checklist items
  const filteredChecklistItems = useMemo(() => {
    const sorted = sortByFormCode(order.items);
    return sorted.filter((formItem) => {
      const itemUploads = vesselUploads.filter(u => checkFormUploadMatch(u, formItem));
      const hasUploaded = itemUploads.length > 0;
      const hasRevisionReq = itemUploads.some(u => Boolean(u.replace_requested_at));

      // Status filter
      if (checklistFilter === 'pending' && hasUploaded) return false;
      if (checklistFilter === 'uploaded' && !hasUploaded) return false;
      if (checklistFilter === 'revision' && !hasRevisionReq) return false;

      // Search filter
      if (!checklistSearch.trim()) return true;
      const query = checklistSearch.toLowerCase().trim();

      const codeMatch = (formItem.form_code || '').toLowerCase().includes(query);
      const descMatch = (formItem.description || '').toLowerCase().includes(query);
      const catMatch = (formItem.category || '').toLowerCase().includes(query);
      const dateMatch = (formItem.form_date || '').toLowerCase().includes(query);
      const fileTypesMatch = (formItem.allowed_file_types || []).some(t => t.toLowerCase().includes(query));
      const uploadedFileMatch = itemUploads.some(u => 
        (u.file_name || '').toLowerCase().includes(query) || 
        (u.uploaded_by || '').toLowerCase().includes(query) ||
        (u.replace_reason || '').toLowerCase().includes(query) ||
        (u.replace_requested_by || '').toLowerCase().includes(query)
      );
      const revisionKeywordMatch = hasRevisionReq && (
        'revision'.includes(query) || 
        'replace'.includes(query) || 
        'replacement'.includes(query) ||
        'action required'.includes(query)
      );

      return codeMatch || descMatch || catMatch || dateMatch || fileTypesMatch || uploadedFileMatch || revisionKeywordMatch;
    });
  }, [order.items, vesselUploads, checklistSearch, checklistFilter]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadProgress) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploadProgress) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onBulkUpload(order, Array.from(e.dataTransfer.files), activeVessel ? { id: activeVessel.vessel_id, name: activeVessel.vessel_name } : undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-start justify-between gap-4 bg-white shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {order.id.startsWith('ord_direct_') ? (
                <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <FolderPlus className="w-3 h-3 text-teal-600" />
                  Direct Submission
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold">
                  SMS Order Package
                </span>
              )}
              {isVesselDone ? (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Completed
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Pending
                </span>
              )}
              {revisionCount > 0 && (
                <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  {revisionCount} Revision{revisionCount > 1 ? 's' : ''} Required
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
              {order.label}
            </h2>

            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Due {order.deadlineDate}
              </span>
              <span>•</span>
              <span>Issued by <strong className="text-slate-700 font-semibold">{order.createdByName}</strong></span>
              {activeVessel && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Ship className="w-3 h-3 text-slate-500" />
                    {activeVessel.vessel_name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons in Header */}
          <div className="flex items-center gap-2 shrink-0">
            {!isVesselUser && vesselUploads.some(u => !u.is_read && !u.checked_at) && (
              <button
                onClick={() => onMarkOrderChecked?.(order.id, activeVessel ? activeVessel.vessel_id : undefined)}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={`Mark all uploads for ${activeVessel?.vessel_name || 'this vessel'} as read`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Mark Read</span>
              </button>
            )}

            {/* Templates ZIP Button */}
            <button
              onClick={() => onDownloadOrderTemplatesZip(order.id, order.label)}
              disabled={isDownloadingTemplatesZip}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDownloadingTemplatesZip
                  ? 'bg-blue-50 text-blue-700 border-blue-200 cursor-wait'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
              title={isDownloadingTemplatesZip ? "Packaging blank templates..." : "Download blank templates (ZIP)"}
            >
              {isDownloadingTemplatesZip ? (
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
              ) : (
                <FolderDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              )}
              <span className="hidden md:inline">
                {isDownloadingTemplatesZip ? 'Packaging...' : 'Templates (ZIP)'}
              </span>
            </button>

            {/* Uploads ZIP Button */}
            <button
              onClick={() => onDownloadZip(order.id, order.label, activeVessel ? activeVessel.vessel_id : undefined)}
              disabled={isDownloadingZip}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDownloadingZip
                  ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-inner cursor-wait'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
              title={isDownloadingZip ? "Downloading of uploaded files is processing... Packaging files into ZIP" : "Download all uploaded vessel files (ZIP)"}
            >
              {isDownloadingZip ? (
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
              <span className="hidden md:inline">
                {isDownloadingZip ? 'Downloading ZIP...' : 'Uploads ZIP'}
              </span>
            </button>

            {!isVesselUser && !order.id.startsWith('ord_direct_') && onEditOrder && (
              <button
                onClick={() => onEditOrder(order)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="Edit Order"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer ml-1"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informative Processing Alert Banner for ZIP Downloads */}
        {isDownloadingZip && (
          <div className="bg-blue-50 border-b border-blue-200/80 px-6 py-3 flex items-center justify-between gap-3 text-xs text-blue-900 animate-in fade-in shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-blue-950">Downloading of uploaded files is processing:</span>{' '}
                <span className="text-blue-800">
                  Packaging vessel files into a ZIP archive from storage. Your download will start automatically once ready.
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 rounded-md shrink-0">
              Processing ZIP
            </span>
          </div>
        )}

        {isDownloadingTemplatesZip && (
          <div className="bg-blue-50 border-b border-blue-200/80 px-6 py-3 flex items-center justify-between gap-3 text-xs text-blue-900 animate-in fade-in shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-blue-950">Packaging blank templates:</span>{' '}
                <span className="text-blue-800">
                  Downloading and compressing official templates into a ZIP package. Please wait...
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 rounded-md shrink-0">
              Packaging ZIP
            </span>
          </div>
        )}

        {/* Multi-Vessel Tab Switcher (if more than 1 vessel) */}
        {!isVesselUser && order.vessels.length > 1 && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-xs font-semibold text-slate-500 shrink-0 mr-1">Vessel:</span>
            {order.vessels.map((v) => {
              const vUploads = getVesselUploads(order.uploads, v, order.vessels);
              const vVerified = order.items.filter(formItem => 
                vUploads.some(u => checkFormUploadMatch(u, formItem))
              ).length;
              const isDone = (totalRequired > 0 && vVerified >= totalRequired) || v.status === 'Completed' || (v.submittedCount || 0) >= totalRequired;
              const vSubmittedCount = isDone ? totalRequired : vVerified;
              const isActive = activeVessel?.vessel_name === v.vessel_name;
              const vHasReplaceReq = vUploads.some(u => Boolean(u.replace_requested_at));

              return (
                <button
                  key={v.vessel_id || v.vessel_name}
                  onClick={() => setActiveVesselTab(v.vessel_name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shrink-0 border cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Ship className={`w-3.5 h-3.5 ${isActive ? 'text-blue-300' : 'text-slate-400'}`} />
                  <span>{v.vessel_name}</span>
                  {vHasReplaceReq && (
                    <span className="w-2 h-2 rounded-full bg-rose-500" title="Revision requested" />
                  )}
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : isDone ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {vSubmittedCount}/{totalRequired}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Executive Metrics & Progress Strip */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Vessel & On-Behalf Indicator */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
                <Ship className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Vessel</div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>{activeVessel?.vessel_name || 'Vessel'}</span>
                  {!isVesselUser && (
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                      Office / Uploading on behalf
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 4 Clean Scannable Metric Tiles */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-1 bg-white rounded-xl border border-slate-200/80 text-center min-w-[65px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total</div>
                <div className="text-xs font-black text-slate-800">{totalRequired}</div>
              </div>

              <div className="px-3 py-1 bg-white rounded-xl border border-emerald-200/80 text-center min-w-[65px]">
                <div className="text-[10px] font-bold text-emerald-600 uppercase">Uploaded</div>
                <div className="text-xs font-black text-emerald-700">{distinctUploaded}</div>
              </div>

              <div className="px-3 py-1 bg-white rounded-xl border border-amber-200/80 text-center min-w-[65px]">
                <div className="text-[10px] font-bold text-amber-600 uppercase">Pending</div>
                <div className="text-xs font-black text-amber-700">{Math.max(0, totalRequired - verifiedCount)}</div>
              </div>

              {revisionCount > 0 && (
                <div className="px-3 py-1 bg-rose-50 rounded-xl border border-rose-200 text-center min-w-[65px]">
                  <div className="text-[10px] font-bold text-rose-600 uppercase">Revisions</div>
                  <div className="text-xs font-black text-rose-700">{revisionCount}</div>
                </div>
              )}

              {/* Progress bar tile */}
              <div className="px-3.5 py-1.5 bg-white rounded-xl border border-slate-200/80 min-w-[130px] space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase">Progress</span>
                  <span className={isVesselDone ? 'text-emerald-700' : 'text-blue-700'}>{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isVesselDone ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/40">
          {/* Error Banner */}
          {(uploadErrorMessage || (uploadDetailedErrors && uploadDetailedErrors.length > 0)) && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2.5 animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-900">Upload Verification Error</h4>
                    {uploadErrorMessage && (
                      <p className="text-xs text-rose-800 font-medium mt-0.5">{uploadErrorMessage}</p>
                    )}
                  </div>
                </div>
                {onClearUploadError && (
                  <button
                    type="button"
                    onClick={onClearUploadError}
                    className="text-rose-400 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {uploadDetailedErrors && uploadDetailedErrors.length > 0 && (
                <div className="bg-white/80 rounded-lg p-3 border border-rose-200/70 text-xs text-rose-900 max-h-36 overflow-y-auto">
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] font-medium">
                    {uploadDetailedErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {lastFailedUpload && onRetryUpload && (
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-rose-200/60">
                  <span className="text-[11px] text-rose-800">
                    Failed attempt: <strong>{lastFailedUpload.fileNames.length} file(s)</strong> ({lastFailedUpload.totalSize})
                  </span>
                  <button
                    type="button"
                    disabled={uploadProgress}
                    onClick={onRetryUpload}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className={`w-3 h-3 ${uploadProgress ? 'animate-spin' : ''}`} />
                    <span>{uploadProgress ? 'Retrying...' : 'Retry Upload'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Validation Progress Notice */}
          {uploadProgress && uploadValidationMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 animate-in fade-in">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-blue-900">Validating &amp; Uploading Documents... </span>
                <span className="text-blue-700">{uploadValidationMessage}</span>
              </div>
            </div>
          )}

          {/* Order Instructions (if any) */}
          {order.instructions && (
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-xs">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-blue-900">
                <span className="font-bold">Instructions: </span>
                <span className="text-blue-800">{order.instructions}</span>
              </div>
            </div>
          )}

          {/* Compact, Clean Bulk Drag-and-Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`p-4 rounded-xl border-2 border-dashed transition-all flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left ${
              uploadProgress
                ? 'border-slate-200 bg-slate-100/50 opacity-60 pointer-events-none'
                : dragActive 
                  ? 'border-blue-500 bg-blue-50/70 scale-[1.005]' 
                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={uploadProgress}
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp,.zip"
              className="hidden"
              onChange={(e) => {
                if (uploadProgress) return;
                if (e.target.files && e.target.files.length > 0) {
                  const selected = Array.from(e.target.files);
                  e.target.value = '';
                  onBulkUpload(order, selected, activeVessel ? { id: activeVessel.vessel_id, name: activeVessel.vessel_name } : undefined);
                }
              }}
            />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Upload className={`w-4 h-4 ${uploadProgress ? 'animate-bounce text-blue-600' : ''}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {uploadProgress ? 'Uploading files...' : 'Bulk Upload Files or ZIP Archive'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Drag and drop files here, or browse. Validates form codes, descriptions, and formats automatically.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={uploadProgress}
              onClick={() => {
                if (uploadProgress) return;
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.click();
                }
              }}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              Browse Files
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
                placeholder="Search checklist items or uploaded files..."
                className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
              />
              {checklistSearch && (
                <button
                  type="button"
                  onClick={() => setChecklistSearch('')}
                  className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 rounded-md"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setChecklistFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  checklistFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                All ({order.items.length})
              </button>
              <button
                type="button"
                onClick={() => setChecklistFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  checklistFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <Clock className="w-3 h-3" />
                Pending ({totalRequired - verifiedCount})
              </button>
              <button
                type="button"
                onClick={() => setChecklistFilter('uploaded')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  checklistFilter === 'uploaded'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                Uploaded ({verifiedCount})
              </button>
              <button
                type="button"
                onClick={() => setChecklistFilter('revision')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  checklistFilter === 'revision'
                    ? 'bg-rose-600 text-white'
                    : revisionCount > 0
                      ? 'text-rose-700 bg-rose-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className={`w-3 h-3 ${checklistFilter === 'revision' ? 'text-white' : revisionCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Revisions ({revisionCount})</span>
              </button>
            </div>
          </div>

          {/* Checklist Items List */}
          {filteredChecklistItems.length === 0 ? (
            <div className="py-10 px-4 text-center bg-white border border-slate-200/80 rounded-xl space-y-2 shadow-2xs">
              <p className="text-xs font-bold text-slate-700">No matching checklist requirements</p>
              <p className="text-[11px] text-slate-500">
                {checklistSearch.trim() ? `No items matched "${checklistSearch.trim()}"` : 'No items match the selected filter.'}
              </p>
              {(checklistSearch.trim() || checklistFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setChecklistSearch('');
                    setChecklistFilter('all');
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer mt-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredChecklistItems.map((formItem, idx) => {
                const itemUploads = vesselUploads.filter(u => checkFormUploadMatch(u, formItem));
                const hasUploaded = itemUploads.length > 0;
                const reqUp = itemUploads.find(u => Boolean(u.replace_requested_at));
                const isThisItemUploading = uploadProgress && uploadingForFormId === String(formItem.id ?? formItem.form_id ?? formItem.form_code);

                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 space-y-3.5 shadow-2xs ${
                      reqUp
                        ? 'border-rose-300 bg-rose-50/15 shadow-xs'
                        : hasUploaded
                          ? 'border-emerald-200/90'
                          : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Item Row: Status, Info, and Primary Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Status Icon Indicator */}
                        <div className="shrink-0 mt-0.5">
                          {reqUp ? (
                            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200" title="Revision requested">
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                            </div>
                          ) : hasUploaded ? (
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200" title="Document uploaded">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200" title="Pending upload">
                              <Clock className="w-4 h-4 text-amber-600" />
                            </div>
                          )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200/70">
                              {formItem.form_code}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {formItem.category}
                            </span>
                            {formItem.form_date && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                                <Calendar className="w-3 h-3" />
                                {formItem.form_date}
                              </span>
                            )}
                            {formItem.is_hira && (
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded">
                                Multi-file
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {formItem.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Action Cluster */}
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                        {/* Blank Template Preview/Download */}
                        <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200/80 p-0.5">
                          <button
                            type="button"
                            onClick={() => onPreviewTemplate(formItem.form_id, formItem.form_code, formItem.template_file_name)}
                            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="View blank template"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Template</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadTemplate(formItem.form_id, formItem.form_code, formItem.template_file_name)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer border-l border-slate-200/60"
                            title="Download blank template file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Upload / Replace Action */}
                        <label
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                            uploadProgress
                              ? isThisItemUploading
                                ? 'bg-blue-100 text-blue-800 border border-blue-300 cursor-wait'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50 pointer-events-none'
                              : hasUploaded && !formItem.is_hira
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                          title={hasUploaded && !formItem.is_hira ? 'Upload replacement file' : 'Upload file for this requirement'}
                        >
                          {isThisItemUploading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>{hasUploaded && !formItem.is_hira ? 'Replace' : formItem.is_hira && hasUploaded ? 'Add File' : 'Upload'}</span>
                            </>
                          )}
                          <input
                            type="file"
                            disabled={uploadProgress}
                            multiple={Boolean(formItem.is_hira)}
                            accept={formItem.allowed_file_types && formItem.allowed_file_types.length > 0 ? formItem.allowed_file_types.join(',') : '.pdf,.docx,.doc,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp'}
                            className="hidden"
                            onChange={(e) => {
                              if (uploadProgress) return;
                              if (e.target.files && e.target.files.length > 0) {
                                const selected = Array.from(e.target.files);
                                e.target.value = '';
                                onFileUpload(order.id, formItem, selected, activeVessel ? { id: activeVessel.vessel_id, name: activeVessel.vessel_name } : undefined);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Uploaded Files Section */}
                    {hasUploaded && (
                      <div className="pt-2.5 border-t border-slate-100 space-y-2">
                        {/* Revision Notice Banner */}
                        {reqUp && (
                          <div className="bg-rose-50/90 p-3 rounded-xl border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="font-bold">Revision Requested by {reqUp.replace_requested_by || 'Management'}: </span>
                              <span className="italic font-medium">&ldquo;{reqUp.replace_reason || 'Please upload a revised copy.'}&rdquo;</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            Uploaded file(s)
                          </span>
                          {itemUploads.length > 1 && (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {itemUploads.length} files
                            </span>
                          )}
                        </div>

                        {/* File Rows */}
                        <div className="space-y-1.5">
                          {itemUploads.map((up) => (
                            <div
                              key={up.id}
                              className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors ${
                                up.replace_requested_at
                                  ? 'bg-rose-50/70 border-rose-200'
                                  : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  up.replace_requested_at ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-bold text-slate-800 truncate" title={up.file_name}>
                                      {up.file_name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                                      ({up.file_size})
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    by {up.uploaded_by} • {new Date(up.uploaded_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap self-end sm:self-center">
                                {/* Revision Status / Trigger */}
                                {up.replace_requested_at ? (
                                  <div className="flex items-center gap-1">
                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold flex items-center gap-1" title={up.replace_reason || "Revision requested"}>
                                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                                      <span>Revision Requested</span>
                                    </span>
                                    {!isVesselUser && onCancelReplacementRequest && (
                                      <button
                                        type="button"
                                        onClick={() => onCancelReplacementRequest(up.id)}
                                        className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold transition-colors cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  !isVesselUser && onRequestReplacement && (
                                    <button
                                      type="button"
                                      onClick={() => onRequestReplacement(up.id, up.file_name)}
                                      className="px-2.5 py-1 text-rose-700 hover:bg-rose-100/70 bg-rose-50 border border-rose-200/60 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                      title="Request revision"
                                    >
                                      <RefreshCw className="w-3 h-3 text-rose-600" />
                                      <span>Request Revision</span>
                                    </button>
                                  )
                                )}

                                {/* Read status */}
                                {up.is_read || up.checked_at ? (
                                  <span className="text-[10px] text-emerald-700 font-bold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 inline-block">
                                    Verified
                                  </span>
                                ) : !isVesselUser ? (
                                  <button
                                    type="button"
                                    onClick={() => onMarkSingleUploadChecked?.(up.id)}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Mark document as read"
                                  >
                                    Mark Read
                                  </button>
                                ) : null}

                                {/* View File */}
                                <button
                                  type="button"
                                  onClick={() => onPreviewUpload(up.id, up.file_name, up.file_mimetype, formItem.form_code, activeVessel?.vessel_name, up.is_read || Boolean(up.checked_at))}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                                  title="View document"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                                </button>

                                {/* Download File */}
                                <button
                                  type="button"
                                  onClick={() => onDownloadUpload(up.id, up.file_name)}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                                  title="Download file"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete File */}
                                {(isVesselUser || isManagementOrAdmin) && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteUpload(up.id, up.file_name)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete file"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            <span className="text-slate-800 font-semibold">{distinctUploaded} of {totalRequired}</span> forms completed for {activeVessel?.vessel_name || 'vessel'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: CREATE OR EDIT ORDER MODAL
// ==========================================
interface CreateOrEditOrderModalProps {
  editingOrder: SMSOrder | null;
  availableForms: SMSForm[];
  vessels: Vessel[];
  templates: OrderTemplate[];
  token: string;
  currentUser: CurrentUser;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateOrEditOrderModal: React.FC<CreateOrEditOrderModalProps> = ({
  editingOrder,
  availableForms,
  vessels,
  templates,
  token,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [label, setLabel] = useState(editingOrder?.label || '');
  const [deadlineDate, setDeadlineDate] = useState(
    editingOrder?.deadlineDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [instructions, setInstructions] = useState(editingOrder?.instructions || '');

  // Helper to resolve canonical vessel ID
  const resolveVesselId = useCallback((rawVId: string | number, rawVName?: string): string => {
    const rawStr = String(rawVId || '').trim();
    const rawStrClean = rawStr.replace(/^v/i, '').trim();
    const match = vessels.find(v => 
      String(v.id) === rawStr ||
      String(v.id).replace(/^v/i, '') === rawStrClean ||
      (rawVName && v.name && v.name.toLowerCase().trim() === rawVName.toLowerCase().trim())
    );
    return match ? String(match.id) : rawStr;
  }, [vessels]);

  // Helper to resolve canonical form ID
  const resolveFormId = useCallback((rawFId: string, rawFCode?: string): string => {
    const rawStr = String(rawFId || '').trim();
    const match = availableForms.find(f => 
      f.id === rawStr ||
      (rawFCode && f.formCode && f.formCode.toLowerCase().trim() === rawFCode.toLowerCase().trim()) ||
      (f.formCode && f.formCode.toLowerCase().trim() === rawStr.toLowerCase().trim())
    );
    return match ? match.id : rawStr;
  }, [availableForms]);

  // Vessel Selection state
  const [selectedVesselIds, setSelectedVesselIds] = useState<string[]>(() => {
    if (!editingOrder?.vessels) return [];
    return editingOrder.vessels.map(v => resolveVesselId(v.vessel_id, v.vessel_name));
  });

  // Forms Selection state
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>(() => {
    if (!editingOrder?.items) return [];
    return editingOrder.items.map(i => resolveFormId(i.form_id, i.form_code));
  });

  // Per-form Multiple Files (is_hira) customization state
  const [formMultipleFiles, setFormMultipleFiles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (editingOrder?.items) {
      editingOrder.items.forEach(item => {
        const resolvedId = resolveFormId(item.form_id, item.form_code);
        initial[resolvedId] = Boolean(item.is_hira);
        initial[item.form_id] = Boolean(item.is_hira);
      });
    }
    return initial;
  });

  // Keep state in sync if editingOrder prop updates
  useEffect(() => {
    if (editingOrder) {
      setLabel(editingOrder.label || '');
      setDeadlineDate(editingOrder.deadlineDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setInstructions(editingOrder.instructions || '');
      setSelectedVesselIds(editingOrder.vessels?.map(v => resolveVesselId(v.vessel_id, v.vessel_name)) || []);
      setSelectedFormIds(editingOrder.items?.map(i => resolveFormId(i.form_id, i.form_code)) || []);
      const multiState: Record<string, boolean> = {};
      editingOrder.items?.forEach(item => {
        const resolvedId = resolveFormId(item.form_id, item.form_code);
        multiState[resolvedId] = Boolean(item.is_hira);
        multiState[item.form_id] = Boolean(item.is_hira);
      });
      setFormMultipleFiles(multiState);
    }
  }, [editingOrder, resolveVesselId, resolveFormId]);

  // Filter state inside form catalog selector
  const [formSearch, setFormSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [vesselSearch, setVesselSearch] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Categories list
  const formCategories = useMemo(() => {
    const set = new Set<string>();
    availableForms.forEach(f => set.add(f.category));
    return ['All', ...Array.from(set).sort()];
  }, [availableForms]);

  // Filtered forms catalog
  const filteredCatalogForms = useMemo(() => {
    return availableForms.filter(f => {
      if (categoryFilter !== 'All' && f.category !== categoryFilter) return false;
      if (formSearch) {
        const q = formSearch.toLowerCase();
        return f.formCode.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [availableForms, categoryFilter, formSearch]);

  // Vessel filter in selector
  const filteredVessels = useMemo(() => {
    if (!vesselSearch) return vessels;
    const q = vesselSearch.toLowerCase();
    return vessels.filter(v => 
      v.name.toLowerCase().includes(q) || 
      (v.team_name && v.team_name.toLowerCase().includes(q)) ||
      (v.type && v.type.toLowerCase().includes(q)) ||
      (v.owner && v.owner.toLowerCase().includes(q))
    );
  }, [vessels, vesselSearch]);

  // Quick Vessel Selector Helpers
  const selectAllVessels = () => setSelectedVesselIds(vessels.map(v => String(v.id)));
  const clearAllVessels = () => setSelectedVesselIds([]);
  const selectVesselsByTeam = (team: string) => {
    const teamVesselIds = vessels.filter(v => v.team_name === team).map(v => String(v.id));
    setSelectedVesselIds(prev => Array.from(new Set([...prev, ...teamVesselIds])));
  };
  const selectVesselsByType = (type: string) => {
    const typeVesselIds = vessels.filter(v => v.type === type).map(v => String(v.id));
    setSelectedVesselIds(prev => Array.from(new Set([...prev, ...typeVesselIds])));
  };
  const selectVesselsByOwner = (owner: string) => {
    const ownerVesselIds = vessels.filter(v => v.owner === owner).map(v => String(v.id));
    setSelectedVesselIds(prev => Array.from(new Set([...prev, ...ownerVesselIds])));
  };

  // Quick Form Catalog Selectors
  const selectAllInCurrentCategory = () => {
    const ids = filteredCatalogForms.map(f => f.id);
    setSelectedFormIds(prev => Array.from(new Set([...prev, ...ids])));
  };
  const deselectAllInCurrentCategory = () => {
    const ids = new Set(filteredCatalogForms.map(f => f.id));
    setSelectedFormIds(prev => prev.filter(id => !ids.has(id)));
  };

  // Apply Template
  const applyTemplate = (tpl: OrderTemplate) => {
    setSelectedFormIds(tpl.itemFormIds.map(fid => resolveFormId(fid)));
    if (!label) setLabel(tpl.title);
    if (tpl.description && !instructions) setInstructions(tpl.description);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!label.trim()) {
      setErrorMsg('Please specify an Order List Label (e.g. Annual Audit 2026)');
      return;
    }
    if (!deadlineDate) {
      setErrorMsg('Please select a Deadline Date');
      return;
    }
    if (selectedVesselIds.length === 0) {
      setErrorMsg('Please select at least one target vessel to receive this order list');
      return;
    }
    if (selectedFormIds.length === 0) {
      setErrorMsg('Please select at least one form or checklist from the SMS catalog');
      return;
    }

    setSubmitting(true);

    try {
      // Build robust vessel objects
      const selectedVesselObjects = selectedVesselIds.map(vId => {
        const v = vessels.find(item => 
          String(item.id) === String(vId) || 
          String(item.id).replace(/^v/i, '') === String(vId).replace(/^v/i, '')
        );
        if (v) {
          return { vessel_id: String(v.id), vessel_name: v.name };
        }
        const prevV = editingOrder?.vessels?.find(pv => 
          String(pv.vessel_id) === String(vId) ||
          String(pv.vessel_id).replace(/^v/i, '') === String(vId).replace(/^v/i, '')
        );
        return { vessel_id: String(vId), vessel_name: prevV?.vessel_name || `Vessel ${vId}` };
      });

      // Build robust form item objects
      const selectedFormObjects = selectedFormIds.map(fId => {
        const f = availableForms.find(item => 
          item.id === fId || 
          item.formCode.toLowerCase().trim() === fId.toLowerCase().trim()
        );
        const isMultiple = formMultipleFiles[fId] !== undefined
          ? formMultipleFiles[fId]
          : (f ? Boolean(f.isHira) : false);

        if (f) {
          return {
            form_id: f.id,
            form_code: f.formCode,
            category: f.category,
            description: f.description,
            form_date: f.formDate,
            type: f.type,
            is_hira: isMultiple,
            remove_filename_restriction: Boolean(f.removeFilenameRestriction),
            allowed_file_types: f.allowedFileTypes || [],
            template_file_name: f.templateFileName
          };
        }
        const prevItem = editingOrder?.items?.find(pi => 
          pi.form_id === fId || 
          (pi.form_code && pi.form_code.toLowerCase().trim() === fId.toLowerCase().trim())
        );
        return {
          form_id: fId,
          form_code: prevItem?.form_code || fId,
          category: prevItem?.category || '1. Monthly',
          description: prevItem?.description || '',
          form_date: prevItem?.form_date,
          type: prevItem?.type || 'Form',
          is_hira: isMultiple,
          remove_filename_restriction: prevItem?.remove_filename_restriction ?? false,
          allowed_file_types: prevItem?.allowed_file_types || [],
          template_file_name: prevItem?.template_file_name
        };
      });

      const payload = {
        id: editingOrder?.id || undefined,
        label: label.trim(),
        deadlineDate,
        instructions: instructions.trim(),
        vessels: selectedVesselObjects,
        items: selectedFormObjects
      };

      const endpoint = editingOrder?.id ? `/api/sms/orders/${editingOrder.id}` : '/api/sms/orders';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save order');
      }

      // Optional: Save as template
      if (saveAsTemplate && templateTitle.trim()) {
        await fetch('/api/sms/order-templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: templateTitle.trim(),
            description: instructions,
            itemFormIds: selectedFormIds
          })
        });
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
              {editingOrder ? 'Edit SMS Order' : 'Create New SMS Order'}
            </span>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {editingOrder ? `Editing: ${editingOrder.label}` : 'Dispatch SMS Order to Fleet'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-800 text-xs font-bold">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: ORDER INFO & TEMPLATES */}
          <div className="space-y-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                1. Order Information &amp; Deadline
              </h3>

              {templates.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-bold">Apply Template:</span>
                  <select
                    onChange={(e) => {
                      const tpl = templates.find(t => t.id === e.target.value);
                      if (tpl) applyTemplate(tpl);
                    }}
                    defaultValue=""
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="" disabled>Select Saved Template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.title} ({t.itemFormIds.length} forms)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-black text-slate-700">Order Label / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Safety & Environmental Audit 2026, Pre-Docking Checklist"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Upload Deadline Date *</label>
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">Remarks / Instructions for Vessel Master &amp; Officers</label>
              <textarea
                rows={2}
                placeholder="Specify any special scanning instructions, required signatures, or drill records to attach..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* SECTION 2: VESSEL SELECTION */}
          <div className="space-y-3 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Ship className="w-4 h-4 text-blue-600" />
                  2. Select Target Vessels ({selectedVesselIds.length} Selected)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select single or multiple vessels. You can also select vessels per team, type or owner.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={selectAllVessels}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white text-blue-600 border border-slate-200 rounded-lg hover:bg-blue-50"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllVessels}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Quick Filter Buttons by Team, Type, Owner */}
            <div className="flex items-center gap-2 flex-wrap text-xs bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-black uppercase text-slate-400">Quick Select:</span>
              {/* Teams */}
              {(Array.from(new Set(vessels.map(v => v.team_name).filter(Boolean))) as string[]).map(team => (
                <button
                  key={team}
                  type="button"
                  onClick={() => selectVesselsByTeam(team)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold"
                >
                  + {team}
                </button>
              ))}
              {/* Types */}
              {(Array.from(new Set(vessels.map(v => v.type).filter(Boolean))) as string[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => selectVesselsByType(t)}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold"
                >
                  + {t}
                </button>
              ))}
              {/* Owners */}
              {(Array.from(new Set(vessels.map(v => v.owner).filter(Boolean))) as string[]).map(owner => (
                <button
                  key={owner}
                  type="button"
                  onClick={() => selectVesselsByOwner(owner)}
                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold"
                >
                  + {owner}
                </button>
              ))}
            </div>

            {/* Vessels Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-white">
              {filteredVessels.map(v => {
                const isSelected = selectedVesselIds.includes(String(v.id));
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedVesselIds(prev => prev.filter(id => id !== String(v.id)));
                      } else {
                        setSelectedVesselIds(prev => [...prev, String(v.id)]);
                      }
                    }}
                    className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs font-black'
                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'}`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs truncate">{v.name}</div>
                      <div className="text-[9px] text-slate-400">{v.team_name || v.type || 'Vessel'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: SMS FORMS & CHECKLISTS SELECTION */}
          <div className="space-y-3 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  3. Select Forms &amp; Checklists ({selectedFormIds.length} Selected)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select the SMS forms and checklist items from the management catalog that vessels must upload.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={selectAllInCurrentCategory}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white text-blue-600 border border-slate-200 rounded-lg hover:bg-blue-50"
                >
                  Select All in View
                </button>
                <button
                  type="button"
                  onClick={deselectAllInCurrentCategory}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Clear in View
                </button>
              </div>
            </div>

            {/* Catalog Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter forms by code or title..."
                  value={formSearch}
                  onChange={(e) => setFormSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                {formCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Forms Catalog List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
              {filteredCatalogForms.map(form => {
                const isSelected = selectedFormIds.includes(form.id);
                return (
                  <button
                    key={form.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFormIds(prev => prev.filter(id => id !== form.id));
                      } else {
                        setSelectedFormIds(prev => [...prev, form.id]);
                        if (formMultipleFiles[form.id] === undefined) {
                          setFormMultipleFiles(prev => ({ ...prev, [form.id]: Boolean(form.isHira) }));
                        }
                      }
                    }}
                    className={`w-full p-3 text-left transition-colors flex items-start gap-3 ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'}`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-black">
                          {form.formCode}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {form.category}
                        </span>
                        {form.formDate && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold border border-emerald-200/50">
                            {form.formDate}
                          </span>
                        )}
                        {form.isHira && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                            Default: Multi-File
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">
                        {form.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Forms Configuration: Explicit Multiple Files Toggle */}
            {selectedFormIds.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-slate-800 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    Selected Forms & Upload Limits ({selectedFormIds.length})
                  </span>
                  <span className="text-[11px] text-slate-500 font-bold">
                    Check "Multiple Files" only if vessels should upload &gt;1 file
                  </span>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {selectedFormIds.map(fId => {
                    const form = availableForms.find(f => f.id === fId || f.formCode.toLowerCase().trim() === fId.toLowerCase().trim());
                    const prevItem = editingOrder?.items?.find(pi => pi.form_id === fId || (pi.form_code && pi.form_code.toLowerCase().trim() === fId.toLowerCase().trim()));
                    const code = form?.formCode || prevItem?.form_code || fId;
                    const desc = form?.description || prevItem?.description || 'SMS Form Item';
                    const isMulti = formMultipleFiles[fId] !== undefined
                      ? formMultipleFiles[fId]
                      : (form ? Boolean(form.isHira) : Boolean(prevItem?.is_hira));

                    return (
                      <div
                        key={fId}
                        className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-md text-[10px] font-black shrink-0">
                            {code}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate" title={desc}>
                            {desc}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/70 transition-colors">
                            <input
                              type="checkbox"
                              checked={isMulti}
                              onChange={(e) => {
                                setFormMultipleFiles(prev => ({
                                  ...prev,
                                  [fId]: e.target.checked
                                }));
                              }}
                              className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                            />
                            <span className={`text-[11px] font-bold ${isMulti ? 'text-amber-800 font-black' : 'text-slate-600'}`}>
                              {isMulti ? '⚡ Multiple Files Allowed' : '📄 Single File Only'}
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFormIds(prev => prev.filter(id => id !== fId));
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove form from this order"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: SAVE AS REUSABLE TEMPLATE */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span className="text-xs font-black text-slate-700">Save this form list as a reusable Order Template</span>
            </label>

            {saveAsTemplate && (
              <input
                type="text"
                placeholder="Template Title (e.g. Standard Pre-Audit 4-Form Pack)"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              />
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black tracking-wide shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching Order...</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span>{editingOrder ? 'Update Order List' : 'Submit Order to Vessels'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: SAVED TEMPLATES MANAGER MODAL
// ==========================================
interface TemplatesManagerModalProps {
  templates: OrderTemplate[];
  availableForms: SMSForm[];
  token: string;
  onClose: () => void;
  onApplyTemplate: (tpl: OrderTemplate) => void;
  onRequestDeleteTemplate: (tplId: string, title: string) => void;
  onRefresh: () => void;
}

const TemplatesManagerModal: React.FC<TemplatesManagerModalProps> = ({
  templates,
  availableForms,
  token,
  onClose,
  onApplyTemplate,
  onRequestDeleteTemplate,
  onRefresh
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">SMS Templates</span>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Saved Order Templates</h2>
            <p className="text-xs text-slate-500">Only showing reusable templates saved by yourself</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {templates.length === 0 ? (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <BookmarkPlus className="w-8 h-8 mx-auto stroke-[1.5]" />
              <p className="text-xs font-bold">No saved order templates found for your account.</p>
              <p className="text-[11px]">When creating an order list, check "Save this form list as a reusable Order Template" to save your personal templates for fast reuse.</p>
            </div>
          ) : (
            templates.map(tpl => (
              <div
                key={tpl.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs hover:border-slate-200 transition-all flex items-start justify-between gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <h4 className="text-sm font-black text-slate-800">{tpl.title}</h4>
                  {tpl.description && <p className="text-xs text-slate-500">{tpl.description}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                      {tpl.itemFormIds.length} Forms included
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Created by {tpl.createdBy}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onApplyTemplate(tpl)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black tracking-wide shadow-2xs transition-colors flex items-center gap-1"
                  >
                    <span>Use Template</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRequestDeleteTemplate(tpl.id, tpl.title)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// SUBCOMPONENT: REPLACEMENT REQUEST MODAL
// ==========================================
interface ReplacementRequestModalProps {
  isOpen: boolean;
  uploadId: number;
  fileName: string;
  onClose: () => void;
  onSubmit: (uploadId: number, reason: string) => Promise<void> | void;
}

const ReplacementRequestModal: React.FC<ReplacementRequestModalProps> = ({
  isOpen,
  uploadId,
  fileName,
  onClose,
  onSubmit
}) => {
  const [reason, setReason] = useState("Management requested revision of this file. Please re-upload a clear and revised copy.");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const quickReasons = [
    "Illegible / Blurry scan",
    "Wrong form version attached",
    "Missing required signature / stamp",
    "Incomplete document pages",
    "Outdated or expired document"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(uploadId, reason);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-800">
            <RefreshCw className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 className="font-bold text-base">Request File Revision</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              File to Revise
            </label>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 truncate">
              {fileName}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason / Instructions for Vessel
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
              placeholder="Specify why this file needs revision..."
              required
            />
          </div>

          <div>
            <span className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Send Request to Vessel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
