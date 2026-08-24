import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Loader2
} from 'lucide-react';
import JSZip from 'jszip';
import { validateFileAgainstForm } from '../utils/smsValidation';
import { PDFViewer } from './PDFViewer';
import { ImageViewer } from './ImageViewer';
import { DocxViewer } from './DocxViewer';
import { DocLegacyViewer } from './DocLegacyViewer';
import { ExcelViewer } from './ExcelViewer';
import { PptxViewer } from './PptxViewer';
import { SMSDirectUploadModal } from './SMSDirectUploadModal';

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

interface PreviewModalState {
  isOpen: boolean;
  title: string;
  fileName: string;
  fileSize?: string;
  fileMimetype?: string;
  uploadId?: number;
  formId?: string;
  formCode?: string;
  vesselName?: string;
  isTemplate?: boolean;
  isRead?: boolean;
  blobUrl?: string | null;
  blob?: Blob | null;
  arrayBuffer?: ArrayBuffer | null;
  textContent?: string | null;
  loading: boolean;
  error?: string | null;
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
}

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
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Document Inline Preview Modal state
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);

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

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 7000);
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
        setOrders(data);
        // If an order is currently open in detail modal, refresh it
        if (selectedOrderForInspection) {
          const updated = data.find((o: SMSOrder) => o.id === selectedOrderForInspection.id);
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

  // Unique Teams and Types for filtering
  const teams = useMemo(() => {
    const set = new Set<string>();
    vessels.forEach(v => {
      if (v.team_name) set.add(v.team_name);
    });
    return Array.from(set).sort();
  }, [vessels]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
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
          const userVesselStatus = order.vesselProgress?.status || 'Pending';
          if (statusFilter === 'Completed' && userVesselStatus !== 'Completed') return false;
          if (statusFilter === 'Pending' && userVesselStatus !== 'Pending') return false;
          if (statusFilter === 'Overdue' && (order.overallStatus !== 'Overdue' || userVesselStatus === 'Completed')) return false;
        } else {
          if (statusFilter !== order.overallStatus) return false;
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
  }, [orders, searchQuery, statusFilter, vesselFilter, teamFilter, isVesselUser, isManagementOrAdmin, vessels]);

  // Quick statistics
  const stats = useMemo(() => {
    const total = orders.length;
    if (isVesselUser) {
      const completed = orders.filter(o => o.vesselProgress?.status === 'Completed').length;
      const pending = total - completed;
      const overdue = orders.filter(o => o.overallStatus === 'Overdue' && o.vesselProgress?.status !== 'Completed').length;
      return { total, completed, pending, overdue };
    } else {
      const completed = orders.filter(o => o.overallStatus === 'Completed').length;
      const inProgress = orders.filter(o => o.overallStatus === 'In Progress').length;
      const pending = orders.filter(o => o.overallStatus === 'Pending').length;
      const overdue = orders.filter(o => o.overallStatus === 'Overdue').length;
      return { total, completed, inProgress, pending, overdue };
    }
  }, [orders, isVesselUser]);

  // Unread uploads count across all orders for the logged on management user
  const totalUncheckedCount = useMemo(() => {
    if (isVesselUser) return 0;
    let count = 0;
    orders.forEach(o => {
      (o.uploads || []).forEach(u => {
        if (!u.is_read && !u.checked_at) count++;
      });
    });
    return count;
  }, [orders, isVesselUser]);

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
  const handleDownloadZip = (orderId: string, label: string, vesselId?: string) => {
    const url = `/api/sms/orders/${orderId}/download-zip${vesselId ? `?vessel_id=${vesselId}` : ''}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('No files available or download failed');
        return res.blob();
      })
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${label.replace(/[^a-zA-Z0-9_-]/g, '_')}_Uploads.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        showToast('ZIP archive downloaded successfully.');
      })
      .catch(err => {
        showToast(err.message, 'error');
      });
  };

  // Download Single Uploaded File
  const handleDownloadUpload = (uploadId: number, fileName: string) => {
    fetch(`/api/sms/orders/download-upload/${uploadId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('File download failed');
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
        window.URL.revokeObjectURL(blobUrl);
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
      const matchedForm = availableForms.find(f => f.id === formId || f.formCode === formCode);
      const targetId = matchedForm?.id || formId || formCode;

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
      const matchedForm = availableForms.find(f => f.id === formId || f.formCode === formCode);
      const targetId = matchedForm?.id || formId || formCode;

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
      window.URL.revokeObjectURL(blobUrl);
      showToast(`Template for ${formCode} downloaded.`);
    } catch (err: any) {
      showToast(err.message || 'Error downloading template', 'error');
    }
  };

  // Download All Blank Templates for an Order (ZIP)
  const handleDownloadOrderTemplatesZip = async (orderId: string, orderLabel: string) => {
    try {
      showToast('Preparing template files package...', 'info');
      const res = await fetch(`/api/sms/orders/${orderId}/download-templates-zip`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to download templates package');
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${orderLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}_Form_Templates.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      showToast(`All templates for "${orderLabel}" downloaded successfully.`);
    } catch (err: any) {
      showToast(err.message || 'Error downloading templates ZIP', 'error');
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

  // Upload handler for vessel with strict SMS Reporting-style Validation Checker
  const handleFileUpload = async (orderId: string, formItem: OrderItem, files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    // If Multiple Files is not enabled for this form, strictly allow only 1 file
    if (!formItem.is_hira && fileList.length > 1) {
      const reason = `Form "${formItem.form_code}" only accepts a single file upload because "Multiple Files" is not enabled. Please select only 1 file.`;
      setUploadErrorMessage(reason);
      setLastFailedUpload({
        type: 'single',
        orderId,
        formItem,
        files: fileList,
        fileNames: fileList.map(f => f.name),
        totalSize: formatFilesTotalSize(fileList),
        timestamp: Date.now(),
        errorMessage: reason
      });
      showToast(reason, 'error');
      return;
    }

    setUploadProgress(true);
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
        const reason = valResult.reason || `File "${file.name}" failed verification for ${formItem.form_code}.`;
        setUploadErrorMessage(reason);
        setLastFailedUpload({
          type: 'single',
          orderId,
          formItem,
          files: fileList,
          fileNames: fileList.map(f => f.name),
          totalSize: formatFilesTotalSize(fileList),
          timestamp: Date.now(),
          errorMessage: reason
        });
        showToast(reason, 'error');
        return;
      }
    }

    setUploadValidationMessage('File verified successfully! Uploading...');

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }

    // Target vessel info
    const currentVessel = vessels.find(v => String(v.id) === String(currentUser.vessel_id)) || {
      id: currentUser.vessel_id || 'v1',
      name: currentUser.username
    };

    formData.append('vessel_id', String(currentVessel.id));
    formData.append('vessel_name', currentVessel.name);
    formData.append('form_id', formItem.form_id);
    formData.append('form_code', formItem.form_code);

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
        showToast(`Successfully uploaded ${result.uploadedCount} verified file(s) for ${formItem.form_code}!`);
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
  const handleBulkUpload = async (order: SMSOrder, files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadProgress(true);
    setUploadErrorMessage(null);
    setUploadDetailedErrors([]);
    setUploadValidationMessage('Scanning and checking files against order checklist requirements...');

    try {
      const currentVessel = vessels.find(v => String(v.id) === String(currentUser.vessel_id)) || {
        id: currentUser.vessel_id || 'v1',
        name: currentUser.username
      };

      let rawFilesList: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.zip')) {
          const zip = new JSZip();
          const unzipped = await zip.loadAsync(file);
          const zipFilePromises: Promise<File>[] = [];

          unzipped.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
              zipFilePromises.push(
                zipEntry.async('blob').then(blob => {
                  const subFileName = relativePath.split('/').pop() || relativePath;
                  return new File([blob], subFileName, { type: blob.type });
                })
              );
            }
          });

          const extractedFiles = await Promise.all(zipFilePromises);
          rawFilesList = [...rawFilesList, ...extractedFiles];
        } else {
          rawFilesList.push(file);
        }
      }

      if (rawFilesList.length === 0) {
        showToast('No files found in package.', 'info');
        return;
      }

      const filesToProcess: { file: File; targetForm: OrderItem }[] = [];
      const validationErrors: string[] = [];

      for (const file of rawFilesList) {
        // Find best matching order requirement by form code prefix or text
        const cleanName = file.name.trim().toUpperCase();
        let matched = order.items.find(item => {
          const cleanCode = item.form_code.trim().toUpperCase();
          if (cleanName.startsWith(cleanCode)) return true;
          return false;
        });

        if (!matched) {
          matched = order.items.find(item => {
            const cleanCode = item.form_code.trim().toUpperCase();
            return cleanName.includes(cleanCode);
          });
        }

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
        const valResult = await validateFileAgainstForm(file, {
          form_id: matched.form_id,
          form_code: matched.form_code,
          description: matched.description,
          form_date: matched.form_date,
          is_hira: matched.is_hira,
          remove_filename_restriction: matched.remove_filename_restriction,
          allowed_file_types: matched.allowed_file_types
        });

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

      // Group valid files by form_id to send
      const grouped = new Map<string, { formItem: OrderItem; files: File[] }>();
      filesToProcess.forEach(({ file, targetForm }) => {
        if (!grouped.has(targetForm.form_id)) {
          grouped.set(targetForm.form_id, { formItem: targetForm, files: [] });
        }
        const currentGroup = grouped.get(targetForm.form_id)!;
        if (!targetForm.is_hira && currentGroup.files.length >= 1) {
          validationErrors.push(`"${file.name}": Skipped because form "${targetForm.form_code}" only accepts 1 file (Multiple Files is not enabled).`);
          return;
        }
        currentGroup.files.push(file);
      });

      let totalUploaded = 0;
      for (const [, { formItem, files }] of grouped) {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        formData.append('vessel_id', String(currentVessel.id));
        formData.append('vessel_name', currentVessel.name);
        formData.append('form_id', formItem.form_id);
        formData.append('form_code', formItem.form_code);

        const res = await fetch(`/api/sms/orders/${order.id}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          totalUploaded += files.length;
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
        showToast(`Bulk upload complete! Successfully verified and uploaded ${totalUploaded} file(s).`);
      }
      await fetchOrders(true);
      onStatusRefresh?.();
    } catch (e: any) {
      const errStr = 'Bulk upload error: ' + e.message;
      setUploadErrorMessage(errStr);
      setLastFailedUpload({
        type: 'bulk',
        orderId: order.id,
        order,
        files: Array.from(files),
        fileNames: Array.from(files).map(f => f.name),
        totalSize: formatFilesTotalSize(Array.from(files)),
        timestamp: Date.now(),
        errorMessage: errStr
      });
      showToast(errStr, 'error');
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
      await handleFileUpload(failed.orderId, failed.formItem, failed.files);
    } else if (failed.type === 'bulk' && failed.order) {
      await handleBulkUpload(failed.order, failed.files);
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
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> :
           toastMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" /> :
           <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-44 h-44 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider mb-1 border border-blue-200/50">
            <CheckSquare className="w-3 h-3 text-blue-600" />
            SMS Order List
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            Safety Management System (SMS) - Order List
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            {isVesselUser
              ? 'View requested SMS reporting order packages assigned to your vessel, monitor deadlines, and submit verified completed checklists and documents.'
              : 'Create targeted checklist and form submission orders for vessels, monitor fleet compliance progress, download uploaded archives, and manage reusable order templates.'}
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0 flex-wrap">
          <button
            onClick={() => { setRefreshing(true); fetchOrders(true); }}
            disabled={refreshing}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-colors flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
            title="Refresh Order List"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Upload Without Order Button - Available to all vessels and management */}
          <button
            onClick={() => setIsDirectUploadModalOpen(true)}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl transition-all shadow-xs hover:shadow-md flex items-center gap-2 text-xs font-black tracking-wide cursor-pointer"
            title="Upload completed SMS checklists, inspection reports or voyage documents directly without an office order"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Upload Without Order</span>
          </button>

          {isManagementOrAdmin && (
            <>
              {totalUncheckedCount > 0 && (
                <button
                  onClick={handleMarkAllOrdersChecked}
                  className="px-3.5 py-2.5 text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 rounded-2xl border border-amber-300/80 transition-all shadow-xs flex items-center gap-2 text-xs font-black tracking-wide"
                  title="Mark all pending vessel uploads across all orders as read for your account"
                >
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                  <span>Mark All Read ({totalUncheckedCount})</span>
                </button>
              )}

              <button
                onClick={() => setIsTemplatesModalOpen(true)}
                className="px-3.5 py-2.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 transition-all shadow-xs flex items-center gap-2 text-xs font-bold"
              >
                <BookmarkPlus className="w-4 h-4 text-blue-600" />
                <span>Templates</span>
              </button>

              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-xs font-black tracking-wide"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Order List</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload Failed Notification Banner with Direct Retry Action */}
      {lastFailedUpload && (
        <div className="bg-rose-50 border-2 border-rose-300/80 rounded-2xl p-4.5 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-black text-rose-900 uppercase tracking-wide">
                    Upload Failed ({lastFailedUpload.type === 'bulk' ? 'Bulk Upload' : lastFailedUpload.formItem?.form_code || 'Form Item'})
                  </h4>
                  <span className="px-2 py-0.5 bg-rose-200/70 text-rose-900 rounded-md text-[10px] font-black">
                    {lastFailedUpload.fileNames.length} file(s) • {lastFailedUpload.totalSize}
                  </span>
                </div>
                <p className="text-xs text-rose-800 font-medium leading-relaxed break-words">
                  {lastFailedUpload.errorMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                disabled={uploadProgress}
                onClick={handleRetryUpload}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-xs font-black tracking-wide flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
                title="Retry the previous upload immediately"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${uploadProgress ? 'animate-spin' : ''}`} />
                <span>{uploadProgress ? 'Retrying Upload...' : 'Retry Upload'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLastFailedUpload(null);
                  setUploadErrorMessage(null);
                  setUploadDetailedErrors([]);
                }}
                className="p-2 text-rose-600 hover:text-rose-900 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                title="Dismiss failure notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI / Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Total Orders</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800">{stats.total}</div>
          <div className="text-[11px] text-slate-500 font-medium">
            {isVesselUser ? 'Assigned to your vessel' : 'Active fleet orders'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.completed}</div>
          <div className="text-[11px] text-emerald-600 font-medium">
            {isVesselUser ? 'All files submitted' : 'Fully submitted vessels'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.pending}</div>
          <div className="text-[11px] text-amber-600 font-medium">
            Awaiting required uploads
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Overdue</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700">{stats.overdue}</div>
          <div className="text-[11px] text-rose-600 font-medium">
            Past specified deadline
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isVesselUser ? "Search orders by label, form code or instructions..." : "Search orders by label, vessel, form code, or created by..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            {['All', 'Pending', 'Completed', 'Overdue'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Vessel Filter (Non-Vessel Only) */}
          {isManagementOrAdmin && (
            <select
              value={vesselFilter}
              onChange={(e) => setVesselFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Vessels</option>
              {vessels.map(v => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
          )}

          {/* Team Filter (Non-Vessel Only) */}
          {isManagementOrAdmin && teams.length > 0 && (
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Teams</option>
              {teams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Order List Display */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading SMS order packages...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-4">
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto">
            <CheckSquare className="w-7 h-7 stroke-[1.8]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-800">No SMS Orders Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || statusFilter !== 'All' || vesselFilter !== 'All' || teamFilter !== 'All'
                ? 'No orders match your current filter criteria. Try adjusting the search term or status filter.'
                : isVesselUser
                ? 'There are currently no active SMS form orders assigned to your vessel.'
                : 'No SMS order lists have been created yet. Click "Create Order List" above to dispatch requirements to vessels.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            <button
              onClick={() => setIsDirectUploadModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload Files Without Order
            </button>
            {isManagementOrAdmin && (
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create First Order
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredOrders.map((order) => {
            const isDeadlinePassed = order.deadlineDate && new Date(order.deadlineDate) < new Date(new Date().setHours(0, 0, 0, 0));
            const totalForms = order.items?.length || 0;
            
            // Vessel progress calculation
            const myVesselProgress = isVesselUser ? order.vesselProgress : null;
            const submittedCount = isVesselUser 
              ? (myVesselProgress?.submittedCount || 0)
              : order.vessels.filter(v => v.status === 'Completed').length;
            const totalTarget = isVesselUser ? totalForms : order.vessels.length;
            const percent = totalTarget > 0 ? Math.min(100, Math.round((submittedCount / totalTarget) * 100)) : 0;
            const isFullyCompleted = isVesselUser 
              ? (myVesselProgress?.status === 'Completed' || (totalForms > 0 && (myVesselProgress?.submittedCount || 0) >= totalForms))
              : order.overallStatus === 'Completed';

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-2xs hover:shadow-sm hover:border-slate-200 transition-all p-5 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Label, Due date, creator */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-800 tracking-tight truncate">
                        {order.label}
                      </h3>

                      {/* Status Badges */}
                      {order.id.startsWith('ord_direct_') && (
                        <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200/80 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <FolderPlus className="w-3 h-3 text-teal-600" />
                          Direct Submission
                        </span>
                      )}

                      {isFullyCompleted ? (
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Completed
                        </span>
                      ) : isDeadlinePassed ? (
                        <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          Overdue
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pending Submission
                        </span>
                      )}

                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Deadline: {order.deadlineDate}
                      </span>
                    </div>

                    {order.instructions && (
                      <p className="text-xs text-slate-600 line-clamp-1 leading-relaxed">
                        <span className="font-bold text-slate-700">Instructions:</span> {order.instructions}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium flex-wrap pt-0.5">
                      <span>Created by <strong className="text-slate-600">{order.createdByName}</strong></span>
                      <span>•</span>
                      <span>Assigned to <strong className="text-slate-700">{order.vessels.length} vessel(s)</strong></span>
                      <span>•</span>
                      <span><strong className="text-slate-700">{totalForms} forms/checklists</strong> required</span>
                    </div>
                  </div>

                  {/* Right Column: Progress & Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    {/* Progress Indicator */}
                    <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 min-w-[170px] space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold">
                        <span className="text-slate-500 uppercase tracking-wide">
                          {isVesselUser ? 'Your Progress' : 'Vessel Completion'}
                        </span>
                        <span className={isFullyCompleted ? 'text-emerald-700' : 'text-blue-700'}>
                          {submittedCount} / {totalTarget} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isFullyCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedOrderForInspection(order);
                          if (order.vessels.length > 0) {
                            setActiveVesselTabInDetail(order.vessels[0].vessel_name);
                          }
                        }}
                        className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black tracking-wide transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isVesselUser ? 'Open & Upload' : 'View Details'}</span>
                      </button>

                      {isManagementOrAdmin && (order.uploads || []).some(u => !u.is_read && !u.checked_at) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkOrderChecked(order.id);
                          }}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold tracking-wide transition-colors flex items-center gap-1.5 shadow-2xs border border-amber-300"
                          title="Mark all uploaded files in this order as read for your account"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                          <span className="hidden sm:inline">Mark Read</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDownloadOrderTemplatesZip(order.id, order.label)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold tracking-wide transition-colors flex items-center gap-1.5 shadow-2xs border border-slate-200"
                        title="Download all blank form templates for this order in ZIP"
                      >
                        <FolderDown className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Templates</span>
                      </button>

                      {isManagementOrAdmin && (
                        <>
                          <button
                            onClick={() => handleDownloadZip(order.id, order.label)}
                            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                            title="Download all vessel uploads in ZIP"
                          >
                            <FolderDown className="w-4 h-4 text-slate-600" />
                          </button>

                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setIsCreateModalOpen(true);
                            }}
                            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                            title="Edit Order"
                          >
                            <Edit3 className="w-4 h-4 text-slate-600" />
                          </button>

                          <button
                            onClick={() => requestDeleteOrder(order.id, order.label)}
                            className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors"
                            title="Delete Order"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-preview tags: Forms & Vessel Badges */}
                <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 flex-wrap">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Required Forms:</span>
                    {order.items.slice(0, 6).map((item, idx) => {
                      const itemUploaded = isVesselUser 
                        ? (order.uploads || []).some(u => (u.form_id === item.form_id || u.form_code === item.form_code))
                        : false;

                      return (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewTemplate(item.form_id, item.form_code, item.template_file_name);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors inline-flex items-center gap-1 cursor-pointer group/badge ${
                            itemUploaded
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/80 hover:border-emerald-300'
                              : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200/60 hover:border-blue-300'
                          }`}
                          title={`Click to view/preview template for ${item.form_code}: ${item.description}${itemUploaded ? ' (Uploaded)' : ' (Pending Upload)'}`}
                        >
                          {itemUploaded && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                          <span>{item.form_code}</span>
                          <Eye className="w-2.5 h-2.5 text-slate-400 group-hover/badge:text-blue-600 transition-colors" />
                        </button>
                      );
                    })}
                    {order.items.length > 6 && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold">
                        +{order.items.length - 6} more
                      </span>
                    )}
                  </div>

                  {!isVesselUser && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vessels:</span>
                      {order.vessels.slice(0, 4).map((v, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            v.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {v.vessel_name} ({v.submittedCount || 0}/{totalForms})
                        </span>
                      ))}
                      {order.vessels.length > 4 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold">
                          +{order.vessels.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 0: INLINE DOCUMENT & TEMPLATE VIEWER */}
      {previewModal?.isOpen && (
        <DocumentPreviewModal
          modal={previewModal}
          onClose={handleClosePreviewModal}
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
          isVesselUser={isVesselUser}
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
          onDownloadZip={handleDownloadZip}
          onDownloadUpload={handleDownloadUpload}
          onDownloadTemplate={handleDownloadTemplate}
          onDownloadOrderTemplatesZip={handleDownloadOrderTemplatesZip}
          onPreviewUpload={handlePreviewUpload}
          onPreviewTemplate={handlePreviewTemplate}
          onDeleteUpload={requestDeleteUpload}
          onFileUpload={handleFileUpload}
          onBulkUpload={handleBulkUpload}
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
        />
      )}

      {/* MODAL 2: ORDER CREATION / EDIT WIZARD (Admin / Management) */}
      {isCreateModalOpen && (
        <CreateOrEditOrderModal
          editingOrder={editingOrder}
          availableForms={availableForms}
          vessels={vessels}
          templates={templates}
          token={token}
          currentUser={currentUser}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingOrder(null);
          }}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setEditingOrder(null);
            fetchOrders();
            fetchTemplates();
            showToast(editingOrder ? 'Order list updated successfully!' : 'New order list dispatched to target vessels!');
          }}
        />
      )}

      {/* MODAL 3: REUSABLE TEMPLATES MANAGER */}
      {isTemplatesModalOpen && (
        <TemplatesManagerModal
          templates={templates}
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
            showToast(`Successfully uploaded ${count} file(s) without order! Package registered in Order List.`, 'success');
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: CONFIRMATION MODAL
// ==========================================
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
// SUBCOMPONENT: DOCUMENT PREVIEW MODAL
// ==========================================
interface DocumentPreviewModalProps {
  modal: PreviewModalState;
  onClose: () => void;
  onDownload: () => void;
  onMarkRead?: () => void;
  isManagementOrAdmin?: boolean;
  token?: string;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  modal,
  onClose,
  onDownload,
  onMarkRead,
  isManagementOrAdmin = false,
  token
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [wrapText, setWrapText] = useState(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fileNameLower = modal.fileName.toLowerCase();
  const mimeLower = (modal.fileMimetype || '').toLowerCase();

  const isPdf = fileNameLower.endsWith('.pdf') || mimeLower.includes('pdf');
  const isImage = 
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(fileNameLower) || 
    mimeLower.startsWith('image/');
  const isDocx = fileNameLower.endsWith('.docx') || mimeLower.includes('officedocument.wordprocessingml.document');
  const isDoc = 
    fileNameLower.endsWith('.doc') || 
    fileNameLower.endsWith('.dot') || 
    fileNameLower.endsWith('.rtf') ||
    mimeLower.includes('msword') || 
    (mimeLower.includes('word') && !isDocx);
  const isExcel = /\.(xlsx?|ods|csv|tsv|xlsm|xlsb)$/i.test(fileNameLower) || mimeLower.includes('spreadsheet') || mimeLower.includes('excel') || mimeLower.includes('csv');
  const isPptx = /\.(pptx?|odp)$/i.test(fileNameLower) || mimeLower.includes('presentation') || mimeLower.includes('powerpoint');
  const isWord = isDocx || isDoc;
  const isArchive = /\.(zip|rar|7z|tar|gz|bz2)$/i.test(fileNameLower) || mimeLower.includes('zip') || mimeLower.includes('tar');
  const isTextOrCsv = (modal.textContent !== null && modal.textContent !== undefined) && !isExcel;

  const filteredTextLines = useMemo(() => {
    if (!modal.textContent) return [];
    const lines = modal.textContent.split('\n');
    if (!searchTerm) {
      return lines.map((text, idx) => ({ lineNum: idx + 1, text, matches: false }));
    }
    const q = searchTerm.toLowerCase();
    return lines.map((text, idx) => ({
      lineNum: idx + 1,
      text,
      matches: text.toLowerCase().includes(q)
    }));
  }, [modal.textContent, searchTerm]);

  const totalLines = modal.textContent ? modal.textContent.split('\n').length : 0;
  const matchCount = useMemo(() => {
    if (!searchTerm || !modal.textContent) return 0;
    return filteredTextLines.filter(l => l.matches).length;
  }, [filteredTextLines, searchTerm, modal.textContent]);

  const handleCopyText = () => {
    if (modal.textContent) {
      navigator.clipboard.writeText(modal.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[9995] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div 
        className={`bg-slate-900 text-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800/80 flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen 
            ? 'w-screen h-screen fixed inset-0 rounded-none z-[9996]' 
            : 'w-full max-w-6xl h-[92vh] max-h-[920px]'
        }`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          {/* Left info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isPdf ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
              isImage ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              isWord ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              isExcel ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
              isTextOrCsv ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}>
              {isPdf && <FileText className="w-5 h-5" />}
              {isImage && <FileImage className="w-5 h-5" />}
              {isWord && <FileText className="w-5 h-5" />}
              {isExcel && <FileSpreadsheet className="w-5 h-5" />}
              {isTextOrCsv && <FileCode className="w-5 h-5" />}
              {!isPdf && !isImage && !isWord && !isExcel && !isTextOrCsv && <FileText className="w-5 h-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate max-w-md" title={modal.fileName}>
                  {modal.fileName}
                </h3>
                {modal.fileSize && (
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 shrink-0">
                    {modal.fileSize}
                  </span>
                )}
                {modal.isTemplate ? (
                  <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
                    Official Template
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
                    Vessel Submission
                  </span>
                )}
                {modal.formCode && (
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-md text-[10px] font-mono font-bold shrink-0">
                    {modal.formCode}
                  </span>
                )}
                {modal.vesselName && (
                  <span className="px-2 py-0.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-md text-[10px] font-bold shrink-0 flex items-center gap-1">
                    <Ship className="w-2.5 h-2.5" />
                    <span>{modal.vesselName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!modal.isTemplate && isManagementOrAdmin && (
              modal.isRead ? (
                <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 hidden sm:flex">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Read by You</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onMarkRead}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-emerald-500/20 text-amber-300 hover:text-emerald-300 border border-amber-500/40 hover:border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Mark as read by your account"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Mark Read</span>
                </button>
              )
            )}

            {modal.blobUrl && (
              <a
                href={modal.blobUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer hidden md:flex"
                title="Open document in a separate browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Tab</span>
              </a>
            )}

            <button
              type="button"
              onClick={onDownload}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
              title="Download a copy of this document to your device"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors border border-slate-700 cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-xl transition-colors border border-slate-700 cursor-pointer"
              title="Close Viewer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-950">
          {modal.loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <p className="text-sm font-bold text-slate-300">Loading document preview...</p>
              <p className="text-xs text-slate-500">Preparing file stream for inline view</p>
            </div>
          ) : modal.error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Unable to View Document</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{modal.error}</p>
              </div>
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Download File Instead</span>
              </button>
            </div>
          ) : isPdf && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <PDFViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined}
                arrayBuffer={modal.arrayBuffer || undefined}
                title={modal.title} 
                onDownload={onDownload}
              />
            </div>
          ) : isImage && modal.blobUrl ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ImageViewer url={modal.blobUrl} title={modal.title} />
            </div>
          ) : isDocx && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <DocxViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined} 
                arrayBuffer={modal.arrayBuffer || undefined} 
                title={modal.title} 
                onDownload={onDownload} 
              />
            </div>
          ) : isDoc && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <DocLegacyViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined} 
                arrayBuffer={modal.arrayBuffer || undefined} 
                title={modal.title} 
                onDownload={onDownload} 
              />
            </div>
          ) : isExcel && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ExcelViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined} 
                arrayBuffer={modal.arrayBuffer || undefined} 
                title={modal.title} 
                onDownload={onDownload} 
              />
            </div>
          ) : isPptx && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <PptxViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined} 
                arrayBuffer={modal.arrayBuffer || undefined} 
                title={modal.title} 
                onDownload={onDownload} 
              />
            </div>
          ) : isTextOrCsv && modal.textContent !== null ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
              {/* Text toolbar */}
              <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {totalLines} lines • {modal.textContent.length.toLocaleString()} characters
                  </span>
                  {searchTerm && (
                    <span className="text-emerald-400 font-bold text-[11px]">
                      {matchCount} match{matchCount === 1 ? '' : 'es'} found
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search text..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1 w-44 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setWrapText(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      wrapText ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Wrap
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Text content viewer */}
              <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 select-text">
                <table className="w-full border-collapse">
                  <tbody>
                    {filteredTextLines.map(({ lineNum, text, matches }) => (
                      <tr 
                        key={lineNum}
                        className={`hover:bg-slate-800/50 ${matches ? 'bg-amber-500/15' : ''}`}
                      >
                        <td className="pr-4 py-0.5 text-right text-slate-600 select-none font-mono text-[11px] w-12 align-top">
                          {lineNum}
                        </td>
                        <td className={`py-0.5 text-slate-200 font-mono text-xs ${wrapText ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                          {text || ' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Office / Word / Excel / Archive document inspector */
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900">
              <div className="max-w-lg w-full bg-slate-950 rounded-3xl p-8 border border-slate-800 text-center space-y-6 shadow-2xl">
                <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center border shadow-inner ${
                  isWord ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                  isExcel ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' :
                  isArchive ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                  'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                }`}>
                  {isWord && <FileText className="w-10 h-10" />}
                  {isExcel && <FileSpreadsheet className="w-10 h-10" />}
                  {isArchive && <FolderArchive className="w-10 h-10" />}
                  {!isWord && !isExcel && !isArchive && <FileText className="w-10 h-10" />}
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white break-all">{modal.fileName}</h3>
                  <p className="text-xs text-slate-400">
                    {isWord && 'Microsoft Word Document'}
                    {isExcel && 'Microsoft Excel / Spreadsheet Document'}
                    {isArchive && 'Compressed Archive Package'}
                    {!isWord && !isExcel && !isArchive && (modal.fileMimetype || 'Document File')}
                    {modal.fileSize && ` • ${modal.fileSize}`}
                  </p>
                </div>

                <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800/80 text-left text-xs space-y-2">
                  {modal.formCode && (
                    <div className="flex justify-between items-center text-slate-400">
                      <span>SMS Form Code:</span>
                      <span className="font-mono font-bold text-slate-200">{modal.formCode}</span>
                    </div>
                  )}
                  {modal.vesselName && (
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Vessel Name:</span>
                      <span className="font-bold text-slate-200">{modal.vesselName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Document Type:</span>
                    <span className="font-bold text-slate-200">{modal.isTemplate ? 'Official Blank Template' : 'Vessel Uploaded Form'}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onDownload}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download to Open & Edit</span>
                  </button>

                  {modal.blobUrl && (
                    <a
                      href={modal.blobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open in Browser</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
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
  onFileUpload: (orderId: string, formItem: OrderItem, files: FileList | File[]) => void;
  onBulkUpload: (order: SMSOrder, files: FileList | File[]) => void;
  uploadProgress: boolean;
  uploadValidationMessage?: string | null;
  uploadErrorMessage?: string | null;
  uploadDetailedErrors?: string[];
  lastFailedUpload?: FailedUploadInfo | null;
  onRetryUpload?: () => void;
  onClearUploadError?: () => void;
  onMarkOrderChecked?: (orderId: string, vesselId?: string) => void;
  onMarkSingleUploadChecked?: (uploadId: number) => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isVesselUser,
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
  uploadProgress,
  uploadValidationMessage,
  uploadErrorMessage,
  uploadDetailedErrors,
  lastFailedUpload,
  onRetryUpload,
  onClearUploadError,
  onMarkOrderChecked,
  onMarkSingleUploadChecked
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active target vessel for display
  const activeVessel = isVesselUser 
    ? (order.vessels.find(v => String(v.vessel_id) === String(currentUser.vessel_id) || v.vessel_name === currentUser.username) || order.vessels[0])
    : (order.vessels.find(v => v.vessel_name === activeVesselTab) || order.vessels[0]);

  // Uploads for the active vessel
  const vesselUploads = (order.uploads || []).filter(u => 
    activeVessel && (String(u.vessel_id) === String(activeVessel.vessel_id) || u.vessel_name === activeVessel.vessel_name)
  );

  const totalRequired = order.items.length;
  const distinctUploaded = new Set(vesselUploads.map(u => u.form_id || u.form_code)).size;
  const isVesselDone = totalRequired > 0 && distinctUploaded >= totalRequired;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onBulkUpload(order, e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {order.id.startsWith('ord_direct_') ? (
                <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200/80 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <FolderPlus className="w-3 h-3 text-teal-600" />
                  Direct Submission (No Order)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-[10px] font-black uppercase tracking-wider">
                  SMS Order Package
                </span>
              )}
              {isVesselDone ? (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Completed
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Pending Upload
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {order.label}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1 font-bold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Deadline: {order.deadlineDate}
              </span>
              <span>•</span>
              <span>Issued by: <strong>{order.createdByName}</strong></span>
              {activeVessel && (
                <>
                  <span>•</span>
                  <span>B2 Folder: <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">sms_orders/{order.label.replace(/[^a-zA-Z0-9_-]/g, '_')}_{activeVessel.vessel_name.replace(/[^a-zA-Z0-9_-]/g, '_')}_{order.deadlineDate}</code></span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isVesselUser && vesselUploads.some(u => !u.is_read && !u.checked_at) && (
              <button
                onClick={() => onMarkOrderChecked?.(order.id, activeVessel ? activeVessel.vessel_id : undefined)}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-300/80 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                title={`Mark all uploads for ${activeVessel?.vessel_name || 'this vessel'} as read for your account`}
              >
                <CheckSquare className="w-4 h-4 text-amber-600" />
                <span className="hidden sm:inline">Mark Read</span>
              </button>
            )}
            <button
              onClick={() => onDownloadOrderTemplatesZip(order.id, order.label)}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200/70 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Download all official blank templates for this order (ZIP)"
            >
              <FolderDown className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Templates (ZIP)</span>
            </button>
            <button
              onClick={() => onDownloadZip(order.id, order.label, activeVessel ? activeVessel.vessel_id : undefined)}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Download all vessel uploads as ZIP"
            >
              <FolderDown className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Uploads ZIP</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Validation Error Banner (Prominently displayed inside the modal) */}
          {(uploadErrorMessage || (uploadDetailedErrors && uploadDetailedErrors.length > 0)) && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4.5 space-y-2.5 animate-in fade-in duration-150 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-900 uppercase tracking-wide">
                      Document Verification / File Mismatch Error
                    </h4>
                    {uploadErrorMessage && (
                      <p className="text-xs text-rose-800 font-semibold mt-0.5 leading-relaxed">
                        {uploadErrorMessage}
                      </p>
                    )}
                  </div>
                </div>
                {onClearUploadError && (
                  <button
                    type="button"
                    onClick={onClearUploadError}
                    className="text-rose-400 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100 transition-colors shrink-0"
                    title="Dismiss error notice"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {uploadDetailedErrors && uploadDetailedErrors.length > 0 && (
                <div className="bg-white/80 rounded-xl p-3.5 border border-rose-200/80 space-y-1.5 text-xs text-rose-900">
                  <div className="text-[10px] font-black uppercase text-rose-700 tracking-wider">
                    Rejected File Details ({uploadDetailedErrors.length}):
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] font-medium leading-relaxed max-h-40 overflow-y-auto pr-1">
                    {uploadDetailedErrors.map((err, i) => (
                      <li key={i} className="text-rose-800">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Retry Button in Error Banner */}
              {lastFailedUpload && onRetryUpload && (
                <div className="pt-1 flex items-center justify-between gap-3 border-t border-rose-200/60">
                  <div className="text-[11px] text-rose-800 font-medium">
                    Previous upload attempt had <strong className="font-bold">{lastFailedUpload.fileNames.length} file(s)</strong> ({lastFailedUpload.totalSize}).
                  </div>
                  <button
                    type="button"
                    disabled={uploadProgress}
                    onClick={onRetryUpload}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-xs font-black tracking-wide flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${uploadProgress ? 'animate-spin' : ''}`} />
                    <span>{uploadProgress ? 'Retrying Upload...' : `Retry Upload (${lastFailedUpload.fileNames.length} files)`}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Validation Progress Notice */}
          {uploadProgress && uploadValidationMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in duration-150">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
              <div className="space-y-0.5">
                <span className="text-xs font-black text-blue-900">Document Verification in Progress</span>
                <p className="text-xs text-blue-700">{uploadValidationMessage}</p>
              </div>
            </div>
          )}

          {/* Instructions Notice Banner */}
          {order.instructions && (
            <div className="bg-blue-50/70 border border-blue-200/70 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide">Submission Instructions &amp; Requirements</h4>
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                  {order.instructions}
                </p>
              </div>
            </div>
          )}

          {/* Non-Vessel User Vessel Tabs */}
          {!isVesselUser && order.vessels.length > 1 && (
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Select Vessel Inspection Tab ({order.vessels.length} Target Vessels):
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {order.vessels.map((v) => {
                  const isDone = (v.submittedCount || 0) >= totalRequired && totalRequired > 0;
                  const isActive = activeVessel?.vessel_name === v.vessel_name;

                  return (
                    <button
                      key={v.vessel_id}
                      onClick={() => setActiveVesselTab(v.vessel_name)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Ship className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{v.vessel_name}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                        isActive ? 'bg-white/20 text-white' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {v.submittedCount || 0}/{totalRequired}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bulk Drag-and-Drop Uploader (Available to Vessel Users) */}
          {isVesselUser && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center space-y-2 relative overflow-hidden ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.01]' 
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onBulkUpload(order, e.target.files);
                  }
                }}
              />
              <div className="w-12 h-12 bg-white shadow-2xs rounded-2xl flex items-center justify-center mx-auto text-blue-600 border border-slate-100">
                <Upload className={`w-6 h-6 ${uploadProgress ? 'animate-bounce text-blue-600' : ''}`} />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-black text-slate-800">
                  {uploadProgress ? 'Checking & uploading documents...' : 'Bulk Drag & Drop Files or ZIP Package'}
                </p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Drop scanned checklists, reports or a pre-compiled ZIP folder here. The system validates form code, description, dates, and allowed file formats automatically.
                </p>
              </div>
              <button
                type="button"
                disabled={uploadProgress}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors inline-flex items-center gap-1.5"
              >
                <FolderArchive className="w-3.5 h-3.5 text-blue-600" />
                Browse &amp; Upload Files
              </button>
            </div>
          )}

          {/* Form Requirements & Uploaded Files Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Required SMS Forms &amp; Checklist Items ({order.items.length})
              </h3>
              <span className="text-xs font-bold text-slate-600">
                Status: <strong className={isVesselDone ? 'text-emerald-600' : 'text-amber-600'}>{distinctUploaded} of {totalRequired} Uploaded</strong>
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {order.items.map((formItem, idx) => {
                const itemUploads = vesselUploads.filter(u => u.form_id === formItem.form_id || u.form_code === formItem.form_code);
                const hasUploaded = itemUploads.length > 0;

                return (
                  <div
                    key={idx}
                    className={`p-4.5 transition-colors space-y-3 ${
                      hasUploaded
                        ? 'bg-emerald-50/35 hover:bg-emerald-50/55 border-l-4 border-l-emerald-500'
                        : 'bg-amber-50/20 hover:bg-amber-50/40 border-l-4 border-l-amber-400'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Upload Status Badge */}
                          {hasUploaded ? (
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300/80 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Uploaded ({itemUploads.length})
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-amber-100/70 text-amber-800 border border-amber-300/70 rounded-md text-[10px] font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pending Upload
                            </span>
                          )}

                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/50 rounded-md text-[11px] font-black">
                            {formItem.form_code}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {formItem.category}
                          </span>
                          {formItem.form_date && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-md text-[10px] font-bold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-emerald-600" />
                              Date: {formItem.form_date}
                            </span>
                          )}
                          {formItem.is_hira && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md text-[10px] font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              Multiple Files Allowed
                            </span>
                          )}
                          {formItem.allowed_file_types && formItem.allowed_file_types.length > 0 && (
                            <span className="text-[10px] text-slate-400 font-bold">
                              Allowed: {formItem.allowed_file_types.join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-snug">
                          {formItem.description}
                        </p>
                      </div>

                      {/* Actions for this specific form: View/Download Template + Upload */}
                      <div className="shrink-0 flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onPreviewTemplate(formItem.form_id, formItem.form_code, formItem.template_file_name)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 rounded-xl text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-2xs transition-colors border border-indigo-200/80 cursor-pointer"
                          title={`View blank template for ${formItem.form_code} in browser without downloading`}
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>View Template</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDownloadTemplate(formItem.form_id, formItem.form_code, formItem.template_file_name)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-2xs transition-colors border border-slate-200 cursor-pointer"
                          title={`Download official blank template for ${formItem.form_code}`}
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          <span>Download Template</span>
                        </button>

                        {isVesselUser && lastFailedUpload && lastFailedUpload.type === 'single' && lastFailedUpload.formItem && (lastFailedUpload.formItem.form_id === formItem.form_id || lastFailedUpload.formItem.form_code === formItem.form_code) && (
                          <button
                            type="button"
                            disabled={uploadProgress}
                            onClick={() => onRetryUpload?.()}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-xs font-black tracking-wide flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            title="Retry uploading previous file(s) for this form"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${uploadProgress ? 'animate-spin' : ''}`} />
                            <span>Retry ({lastFailedUpload.fileNames.length})</span>
                          </button>
                        )}

                        {isVesselUser && (
                          <label className="cursor-pointer px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black tracking-wide flex items-center gap-1.5 shadow-2xs transition-colors" title={formItem.is_hira ? 'Upload one or more files for this form' : hasUploaded ? 'Replace existing file' : 'Upload file for this form'}>
                            <Upload className="w-3.5 h-3.5" />
                            <span>{hasUploaded && !formItem.is_hira ? 'Replace File' : formItem.is_hira ? 'Upload File(s)' : 'Upload File'}</span>
                            <input
                              type="file"
                              multiple={Boolean(formItem.is_hira)}
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  onFileUpload(order.id, formItem, e.target.files);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Uploaded File List for this item */}
                    {hasUploaded ? (
                      <div className="bg-white rounded-xl p-3 border border-emerald-200/80 space-y-2 shadow-2xs">
                        <div className="text-[10px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Uploaded Document ({itemUploads.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {itemUploads.map((up) => (
                            <div
                              key={up.id}
                              className="bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-200/60 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span className="font-bold text-slate-800 truncate" title={up.file_name}>
                                  {up.file_name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                                  ({up.file_size})
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
                                  by {up.uploaded_by} • {new Date(up.uploaded_at).toLocaleDateString()}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {up.is_read || up.checked_at ? (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300/80 rounded-md text-[10px] font-black flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Read</span>
                                  </span>
                                ) : !isVesselUser ? (
                                  <button
                                    type="button"
                                    onClick={() => onMarkSingleUploadChecked?.(up.id)}
                                    className="px-2.5 py-1 bg-amber-100 hover:bg-emerald-100 text-amber-900 hover:text-emerald-900 border border-amber-300 hover:border-emerald-400 rounded-lg text-[10px] font-black flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                    title="Mark this uploaded document as read for your account"
                                  >
                                    <CheckSquare className="w-3 h-3 text-amber-700" />
                                    <span>Mark Read</span>
                                  </button>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-medium">
                                    Pending Review
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onPreviewUpload(up.id, up.file_name, up.file_mimetype, formItem.form_code, activeVessel?.vessel_name, up.is_read || Boolean(up.checked_at))}
                                  className="px-2.5 py-1 text-slate-700 hover:text-blue-700 hover:bg-blue-50 bg-white border border-slate-200/80 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                  title="View document in browser without downloading"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                                  <span>View</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onDownloadUpload(up.id, up.file_name)}
                                  className="p-1.5 text-slate-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Download this file"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                {isVesselUser && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteUpload(up.id, up.file_name)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete uploaded file"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50/60 rounded-xl px-3 py-2.5 border border-amber-200/60 text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>File yet to be uploaded for this requirement.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Progress: <strong className="text-slate-800">{distinctUploaded} of {totalRequired} forms verified</strong>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black tracking-wide transition-colors"
          >
            Close Workspace
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

  // Vessel Selection state
  const [selectedVesselIds, setSelectedVesselIds] = useState<string[]>(
    editingOrder?.vessels?.map(v => String(v.vessel_id)) || []
  );

  // Forms Selection state
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>(
    editingOrder?.items?.map(i => i.form_id) || []
  );

  // Per-form Multiple Files (is_hira) customization state
  const [formMultipleFiles, setFormMultipleFiles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (editingOrder?.items) {
      editingOrder.items.forEach(item => {
        initial[item.form_id] = Boolean(item.is_hira);
      });
    }
    return initial;
  });

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
    setSelectedFormIds(tpl.itemFormIds);
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
      const selectedVesselObjects = vessels
        .filter(v => selectedVesselIds.includes(String(v.id)))
        .map(v => ({ vessel_id: String(v.id), vessel_name: v.name }));

      const selectedFormObjects = availableForms
        .filter(f => selectedFormIds.includes(f.id))
        .map(f => {
          const isMultiple = formMultipleFiles[f.id] !== undefined
            ? formMultipleFiles[f.id]
            : Boolean(f.isHira);
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
        });

      const payload = {
        id: editingOrder?.id || undefined,
        label,
        deadlineDate,
        instructions,
        vessels: selectedVesselObjects,
        items: selectedFormObjects
      };

      const res = await fetch('/api/sms/orders', {
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
                    const form = availableForms.find(f => f.id === fId);
                    if (!form) return null;
                    const isMulti = formMultipleFiles[form.id] !== undefined
                      ? formMultipleFiles[form.id]
                      : Boolean(form.isHira);

                    return (
                      <div
                        key={form.id}
                        className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-md text-[10px] font-black shrink-0">
                            {form.formCode}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate" title={form.description}>
                            {form.description}
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
                                  [form.id]: e.target.checked
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
                              setSelectedFormIds(prev => prev.filter(id => id !== form.id));
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
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {templates.length === 0 ? (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <BookmarkPlus className="w-8 h-8 mx-auto stroke-[1.5]" />
              <p className="text-xs font-bold">No saved order templates yet.</p>
              <p className="text-[11px]">When creating an order list, check "Save this form list as a reusable Order Template" to reuse it anytime.</p>
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
