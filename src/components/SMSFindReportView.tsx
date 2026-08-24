import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar, 
  Ship, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Eye, 
  X, 
  ChevronRight, 
  ChevronDown, 
  FolderArchive, 
  Layers, 
  Sparkles, 
  RefreshCw, 
  ExternalLink, 
  Check, 
  Building2, 
  Maximize2, 
  Minimize2, 
  FileCheck,
  FileSpreadsheet,
  FileCode,
  FileImage,
  FileQuestion,
  RotateCcw,
  Loader2,
  SlidersHorizontal,
  LayoutGrid,
  Table as TableIcon,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  CheckSquare,
  Square,
  ShieldCheck,
  Flag,
  File
} from 'lucide-react';
import JSZip from 'jszip';
import { PDFViewer } from './PDFViewer';
import { ImageViewer } from './ImageViewer';
import { DocxViewer } from './DocxViewer';
import { DocLegacyViewer } from './DocLegacyViewer';
import { ExcelViewer } from './ExcelViewer';
import { PptxViewer } from './PptxViewer';

export interface SMSOrderReportItem {
  id: number | string;
  orderId: string;
  orderLabel: string;
  orderDeadline: string;
  orderInstructions?: string;
  vesselId: string;
  vesselName: string;
  vesselFlag?: string | null;
  vesselType?: string | null;
  vesselOwner?: string | null;
  vesselTeamName?: string | null;
  formId: string;
  formCode: string;
  formDescription: string;
  category: string;
  type?: string;
  isHira?: boolean;
  fileName: string;
  fileSize: string;
  fileMimetype?: string;
  uploadedAt: string;
  uploadedBy?: string;
  checkedAt?: string | null;
  checkedBy?: string | null;
  isRead?: boolean;
}

interface SMSFindReportViewProps {
  vessels: any[];
  currentUser: any;
  token?: string;
  flags?: any[];
  onNavigateToOrder?: (orderId: string) => void;
}

export const SMSFindReportView: React.FC<SMSFindReportViewProps> = ({
  vessels = [],
  currentUser,
  token,
  flags = [],
  onNavigateToOrder
}) => {
  const [reports, setReports] = useState<SMSOrderReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [vesselFilter, setVesselFilter] = useState('All');
  const [orderFilter, setOrderFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [formCodeFilter, setFormCodeFilter] = useState('All');
  const [fileTypeFilter, setFileTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Checked' | 'Pending'>('All');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | '90days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'uploaded_at' | 'vessel' | 'form_code' | 'order' | 'file_size'>('uploaded_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-Selection
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  // Document Preview Modal
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    fileName: string;
    fileSize: string;
    fileMimetype: string;
    uploadId: number | string;
    formCode?: string;
    vesselName?: string;
    orderLabel?: string;
    blobUrl?: string;
    arrayBuffer?: ArrayBuffer;
    isLoading?: boolean;
  } | null>(null);

  // Order Details Modal
  const [orderDetailModal, setOrderDetailModal] = useState<{
    isOpen: boolean;
    orderId: string;
    orderLabel: string;
    orderDeadline: string;
    instructions?: string;
    vesselName?: string;
    formCode?: string;
  } | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isVesselUser = currentUser?.role === 'vessel';
  const isAdminOrManagement = currentUser?.role === 'admin' || currentUser?.role === 'management' || currentUser?.role === 'team_pic';

  // Filter accessible vessels
  const userTeamIds: number[] = useMemo(() => {
    return Array.isArray(currentUser?.team_ids) ? currentUser.team_ids.map(Number) : [];
  }, [currentUser?.team_ids]);

  const accessibleVessels = useMemo(() => {
    if (isVesselUser && currentUser?.vessel_id) {
      return vessels.filter(v => String(v.id) === String(currentUser.vessel_id));
    }
    if (!isAdminOrManagement && userTeamIds.length > 0) {
      return vessels.filter(v => v.team_id != null && userTeamIds.includes(Number(v.team_id)));
    }
    return vessels;
  }, [vessels, isVesselUser, isAdminOrManagement, currentUser?.vessel_id, userTeamIds]);

  // Helper text normalizer (strips MV/M.V./punctuation/spaces for resilient vessel and order matching)
  const normalizeText = (text: string) => {
    return (text || '')
      .toLowerCase()
      .replace(/^m\/?v\.?\s+/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  // Helper vessel matching function
  const matchesVesselFilter = (repVesselName: string, repVesselId: string | number | undefined, filterVal: string) => {
    if (!filterVal || filterVal === 'All') return true;

    const fTrim = filterVal.trim();
    const fNorm = normalizeText(fTrim);
    const rTrim = (repVesselName || '').trim();
    const rNorm = normalizeText(rTrim);

    // 1. Direct ID match
    if (repVesselId && String(repVesselId) === fTrim) return true;

    // 2. Direct string match
    if (rTrim.toLowerCase() === fTrim.toLowerCase()) return true;

    // 3. Normalized match (handles MV Aquagrace vs Aquagrace, case, spaces, symbols)
    if (fNorm && rNorm && (fNorm === rNorm || fNorm.includes(rNorm) || rNorm.includes(fNorm))) return true;

    // 4. Match against catalog vessels
    const matchedVessel = vessels.find(v => 
      String(v.id) === fTrim || 
      (v.name && v.name.trim().toLowerCase() === fTrim.toLowerCase()) ||
      normalizeText(v.name) === fNorm
    );
    if (matchedVessel) {
      if (repVesselId && String(repVesselId) === String(matchedVessel.id)) return true;
      const catNorm = normalizeText(matchedVessel.name);
      if (catNorm && rNorm && (catNorm === rNorm || catNorm.includes(rNorm) || rNorm.includes(catNorm))) return true;
    }

    return false;
  };

  // Helper order matching function
  const matchesOrderFilter = (repOrderId: string, repOrderLabel: string, filterVal: string) => {
    if (!filterVal || filterVal === 'All') return true;
    const fTrim = filterVal.trim();
    if (repOrderId === fTrim) return true;
    if (repOrderLabel.toLowerCase().trim() === fTrim.toLowerCase()) return true;
    const fNorm = normalizeText(fTrim);
    const oNorm = normalizeText(repOrderLabel);
    if (fNorm && oNorm && (fNorm === oNorm || fNorm.includes(oNorm) || oNorm.includes(fNorm))) return true;
    return false;
  };

  // Fetch Reports
  const fetchReports = async () => {
    try {
      setLoading(true);
      let loaded: SMSOrderReportItem[] = [];

      // 1. Primary API call to /api/sms/order-reports
      if (token) {
        try {
          const res = await fetch('/api/sms/order-reports', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              loaded = data;
            }
          }
        } catch (apiErr) {
          console.warn('Could not fetch from /api/sms/order-reports:', apiErr);
        }
      }

      // 2. Fallback / Auxiliary check against /api/sms/orders
      if (loaded.length === 0 && token) {
        try {
          const resOrders = await fetch('/api/sms/orders', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resOrders.ok) {
            const ordersData = await resOrders.json();
            if (Array.isArray(ordersData)) {
              const aggregated: SMSOrderReportItem[] = [];
              ordersData.forEach((o: any) => {
                (o.uploads || []).forEach((u: any, idx: number) => {
                  const itemMatch = (o.items || []).find((it: any) => it.form_id === u.form_id || it.form_code === u.form_code);
                  const vesselMatch = (o.vessels || []).find((v: any) => String(v.vessel_id) === String(u.vessel_id) || v.vessel_name === u.vessel_name);
                  aggregated.push({
                    id: u.id || `up_${o.id}_${idx}`,
                    orderId: o.id,
                    orderLabel: o.label || 'SMS Order',
                    orderDeadline: o.deadlineDate || o.deadline_date || '',
                    orderInstructions: o.instructions || '',
                    vesselId: u.vessel_id || vesselMatch?.vessel_id || '',
                    vesselName: u.vessel_name || vesselMatch?.vessel_name || 'Vessel',
                    vesselFlag: u.vessel_flag || undefined,
                    vesselType: u.vessel_type || undefined,
                    vesselOwner: u.vessel_owner || undefined,
                    vesselTeamName: u.vessel_team_name || undefined,
                    formId: u.form_id || itemMatch?.form_id || '',
                    formCode: u.form_code || itemMatch?.form_code || 'COMI-SM-1-1',
                    formDescription: itemMatch?.description || u.file_name || 'Safety Report',
                    category: itemMatch?.category || '1. Monthly',
                    type: itemMatch?.type || 'Form',
                    isHira: Boolean(itemMatch?.is_hira),
                    fileName: u.file_name || 'Report.pdf',
                    fileSize: u.file_size || '1.2 MB',
                    fileMimetype: u.file_mimetype || 'application/pdf',
                    uploadedAt: u.uploaded_at || new Date().toISOString(),
                    uploadedBy: u.uploaded_by || 'Vessel User',
                    checkedAt: u.checked_at || null,
                    checkedBy: u.checked_by || null,
                    isRead: Boolean(u.is_read || u.checked_at)
                  });
                });
              });
              if (aggregated.length > 0) {
                loaded = aggregated;
              }
            }
          }
        } catch (ordersErr) {
          console.warn('Could not fetch from /api/sms/orders fallback:', ordersErr);
        }
      }

      // 3. Offline / LocalStorage fallback
      if (loaded.length === 0) {
        const savedOrders = localStorage.getItem('comos_sms_orders');
        if (savedOrders) {
          const parsed = JSON.parse(savedOrders);
          const aggregated: SMSOrderReportItem[] = [];
          parsed.forEach((o: any) => {
            (o.uploads || []).forEach((u: any, idx: number) => {
              const itemMatch = (o.items || []).find((it: any) => it.form_id === u.form_id || it.form_code === u.form_code);
              aggregated.push({
                id: u.id || `up_local_${o.id}_${idx}`,
                orderId: o.id,
                orderLabel: o.label || 'SMS Order',
                orderDeadline: o.deadlineDate || o.deadline_date || '',
                orderInstructions: o.instructions || '',
                vesselId: u.vessel_id || u.vesselId || '',
                vesselName: u.vessel_name || u.vesselName || 'Vessel',
                formId: u.form_id || u.formId || '',
                formCode: u.form_code || u.formCode || itemMatch?.form_code || 'COMI-SM-1-1',
                formDescription: itemMatch?.description || u.file_name || 'Safety Report',
                category: itemMatch?.category || '1. Monthly',
                type: itemMatch?.type || 'Form',
                isHira: Boolean(itemMatch?.is_hira),
                fileName: u.file_name || u.fileName || 'Report.pdf',
                fileSize: u.file_size || u.fileSize || '1.2 MB',
                fileMimetype: u.file_mimetype || 'application/pdf',
                uploadedAt: u.uploaded_at || u.uploadedAt || new Date().toISOString(),
                uploadedBy: u.uploaded_by || u.uploadedBy || 'Vessel User',
                checkedAt: u.checked_at || null,
                checkedBy: u.checked_by || null,
                isRead: Boolean(u.is_read || u.checked_at)
              });
            });
          });
          loaded = aggregated;
        }
      }

      setReports(loaded);
    } catch (e) {
      console.error('Failed to fetch SMS order reports:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    showToast('SMS reports synchronized.');
  };

  // Distinct vessels for filter dropdown (combines catalog and all submitted reports)
  const distinctVesselsList = useMemo(() => {
    const vesselMap = new Map<string, { id: string; name: string; flag?: string; type?: string }>();

    // 1. Add catalog vessels
    accessibleVessels.forEach(v => {
      if (v.name) {
        vesselMap.set(v.name.toLowerCase().trim(), {
          id: String(v.id),
          name: v.name,
          flag: v.flag,
          type: v.type
        });
      }
    });

    // 2. Add vessels that appear in reports
    reports.forEach(r => {
      if (r.vesselName) {
        const key = r.vesselName.toLowerCase().trim();
        if (!vesselMap.has(key)) {
          vesselMap.set(key, {
            id: String(r.vesselId || key),
            name: r.vesselName,
            flag: r.vesselFlag || undefined,
            type: r.vesselType || undefined
          });
        }
      }
    });

    return Array.from(vesselMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [accessibleVessels, reports]);

  // Extract distinct available filter options
  const distinctOrders = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    reports.forEach(r => {
      if (r.orderId && !map.has(r.orderId)) {
        map.set(r.orderId, { id: r.orderId, label: r.orderLabel });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [reports]);

  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    reports.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [reports]);

  const distinctFormCodes = useMemo(() => {
    const map = new Map<string, string>();
    reports.forEach(r => {
      if (r.formCode) {
        map.set(r.formCode, r.formDescription);
      }
    });
    return Array.from(map.entries()).map(([code, desc]) => ({ code, desc })).sort((a, b) => a.code.localeCompare(b.code));
  }, [reports]);

  // Determine file extension & categorize
  const getFileCategory = (fileName: string) => {
    const lower = (fileName || '').toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'excel';
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'word';
    if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'powerpoint';
    if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) return 'archive';
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) return 'image';
    return 'other';
  };

  const getFileIcon = (fileName: string, className: string = "w-4 h-4") => {
    const type = getFileCategory(fileName);
    switch (type) {
      case 'pdf':
        return <FileCheck className={`${className} text-rose-600`} />;
      case 'excel':
        return <FileSpreadsheet className={`${className} text-emerald-600`} />;
      case 'word':
        return <FileText className={`${className} text-blue-600`} />;
      case 'powerpoint':
        return <FileCode className={`${className} text-amber-600`} />;
      case 'archive':
        return <FolderArchive className={`${className} text-purple-600`} />;
      case 'image':
        return <FileImage className={`${className} text-sky-600`} />;
      default:
        return <File className={`${className} text-slate-500`} />;
    }
  };

  // Helper date filtering
  const matchesDateFilter = (uploadedAtStr: string) => {
    if (datePreset === 'all') return true;
    if (!uploadedAtStr) return false;

    const date = new Date(uploadedAtStr);
    if (isNaN(date.getTime())) return true;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (datePreset === 'today') {
      return date >= todayStart;
    }
    if (datePreset === '7days') {
      const past7 = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= past7;
    }
    if (datePreset === '30days') {
      const past30 = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      return date >= past30;
    }
    if (datePreset === '90days') {
      const past90 = new Date(todayStart.getTime() - 90 * 24 * 60 * 60 * 1000);
      return date >= past90;
    }
    if (datePreset === 'custom') {
      if (customStartDate) {
        const start = new Date(customStartDate);
        if (date < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
      return true;
    }
    return true;
  };

  // Main Filtered and Sorted Dataset
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // Vessel User RBAC
      if (isVesselUser && currentUser?.vessel_id) {
        const vId = String(currentUser.vessel_id);
        const vName = currentUser.username || '';
        if (String(r.vesselId) !== vId && r.vesselName.toLowerCase() !== vName.toLowerCase()) {
          return false;
        }
      }

      // Vessel Filter
      if (vesselFilter !== 'All') {
        if (!matchesVesselFilter(r.vesselName, r.vesselId, vesselFilter)) {
          return false;
        }
      }

      // Order Filter
      if (orderFilter !== 'All') {
        if (!matchesOrderFilter(r.orderId, r.orderLabel, orderFilter)) {
          return false;
        }
      }

      // Category Filter
      if (categoryFilter !== 'All' && r.category !== categoryFilter) {
        return false;
      }

      // Form Code Filter
      if (formCodeFilter !== 'All' && r.formCode !== formCodeFilter) {
        return false;
      }

      // File Type Filter
      if (fileTypeFilter !== 'All') {
        const cat = getFileCategory(r.fileName);
        if (cat !== fileTypeFilter) return false;
      }

      // Status Filter
      if (statusFilter === 'Checked' && !r.checkedAt && !r.isRead) {
        return false;
      }
      if (statusFilter === 'Pending' && (r.checkedAt || r.isRead)) {
        return false;
      }

      // Date Range Filter
      if (!matchesDateFilter(r.uploadedAt)) {
        return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesFile = (r.fileName || '').toLowerCase().includes(q);
        const matchesCode = (r.formCode || '').toLowerCase().includes(q);
        const matchesDesc = (r.formDescription || '').toLowerCase().includes(q);
        const matchesVessel = (r.vesselName || '').toLowerCase().includes(q);
        const matchesOrder = (r.orderLabel || '').toLowerCase().includes(q);
        const matchesUser = (r.uploadedBy || '').toLowerCase().includes(q);
        const matchesCategory = (r.category || '').toLowerCase().includes(q);

        if (!matchesFile && !matchesCode && !matchesDesc && !matchesVessel && !matchesOrder && !matchesUser && !matchesCategory) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'uploaded_at') {
        const timeA = new Date(a.uploadedAt).getTime() || 0;
        const timeB = new Date(b.uploadedAt).getTime() || 0;
        comparison = timeA - timeB;
      } else if (sortBy === 'vessel') {
        comparison = a.vesselName.localeCompare(b.vesselName);
      } else if (sortBy === 'form_code') {
        comparison = a.formCode.localeCompare(b.formCode);
      } else if (sortBy === 'order') {
        comparison = a.orderLabel.localeCompare(b.orderLabel);
      } else if (sortBy === 'file_size') {
        const parseSize = (s: string) => {
          const num = parseFloat(s) || 0;
          if (s.toLowerCase().includes('mb')) return num * 1024;
          return num;
        };
        comparison = parseSize(a.fileSize) - parseSize(b.fileSize);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [
    reports,
    searchQuery,
    vesselFilter,
    orderFilter,
    categoryFilter,
    formCodeFilter,
    fileTypeFilter,
    statusFilter,
    datePreset,
    customStartDate,
    customEndDate,
    sortBy,
    sortOrder,
    isVesselUser,
    currentUser
  ]);

  // Metrics computation
  const metrics = useMemo(() => {
    const totalCount = filteredReports.length;
    const distinctVessels = new Set(filteredReports.map(r => r.vesselName)).size;
    const distinctOrderCount = new Set(filteredReports.map(r => r.orderId)).size;
    
    let totalMegabytes = 0;
    filteredReports.forEach(r => {
      const s = r.fileSize || '';
      const num = parseFloat(s);
      if (!isNaN(num)) {
        if (s.toLowerCase().includes('mb')) totalMegabytes += num;
        else if (s.toLowerCase().includes('kb')) totalMegabytes += num / 1024;
        else totalMegabytes += num / (1024 * 1024);
      }
    });

    const formattedSize = totalMegabytes >= 1024 
      ? `${(totalMegabytes / 1024).toFixed(2)} GB` 
      : `${totalMegabytes.toFixed(1)} MB`;

    const checkedCount = filteredReports.filter(r => r.checkedAt || r.isRead).length;
    const pendingCount = totalCount - checkedCount;

    return { totalCount, distinctVessels, distinctOrderCount, formattedSize, checkedCount, pendingCount };
  }, [filteredReports]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (vesselFilter !== 'All') count++;
    if (orderFilter !== 'All') count++;
    if (categoryFilter !== 'All') count++;
    if (formCodeFilter !== 'All') count++;
    if (fileTypeFilter !== 'All') count++;
    if (statusFilter !== 'All') count++;
    if (datePreset !== 'all') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [vesselFilter, orderFilter, categoryFilter, formCodeFilter, fileTypeFilter, statusFilter, datePreset, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setVesselFilter('All');
    setOrderFilter('All');
    setCategoryFilter('All');
    setFormCodeFilter('All');
    setFileTypeFilter('All');
    setStatusFilter('All');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    showToast('Filters cleared.');
  };

  // Multi-Selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredReports.length && filteredReports.length > 0) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<number | string>();
      filteredReports.forEach(r => next.add(r.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: number | string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Single File Download
  const handleDownloadSingleFile = (uploadId: number | string, fileName: string) => {
    showToast(`Downloading ${fileName}...`, 'info');
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
        showToast(`Downloaded ${fileName} successfully.`);
      })
      .catch(err => {
        showToast(err.message || 'Download error', 'error');
      });
  };

  // Batch Download selected or filtered files
  const handleBatchDownload = async (onlySelected: boolean = true) => {
    const targetReports = onlySelected 
      ? filteredReports.filter(r => selectedIds.has(r.id)) 
      : filteredReports;

    if (targetReports.length === 0) {
      showToast('No reports selected to download.', 'error');
      return;
    }

    setIsBatchDownloading(true);
    showToast(`Preparing ZIP archive for ${targetReports.length} report file(s)...`, 'info');

    try {
      const uploadIds = targetReports.map(r => r.id).filter(id => typeof id === 'number' || !String(id).startsWith('up_local'));

      if (token && uploadIds.length > 0) {
        const res = await fetch('/api/sms/order-reports/download-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ uploadIds })
        });

        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          const timestamp = new Date().toISOString().slice(0, 10);
          link.download = `SMS_Reports_Export_${timestamp}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
          showToast(`Successfully downloaded ${targetReports.length} reports in ZIP package.`);
          setIsBatchDownloading(false);
          return;
        }
      }

      // Client-side ZIP assembly fallback
      const zip = new JSZip();
      const sanitize = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');

      for (const rep of targetReports) {
        try {
          const res = await fetch(`/api/sms/orders/download-upload/${rep.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const blob = await res.blob();
            const orderFolder = sanitize(rep.orderLabel || 'SMS_Order');
            const vesselFolder = sanitize(rep.vesselName || 'Vessel');
            zip.folder(`${orderFolder}/${vesselFolder}`)?.file(rep.fileName, blob);
          }
        } catch (e) {
          console.warn(`Could not fetch file for ${rep.fileName}:`, e);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const blobUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `SMS_Reports_Package_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      showToast(`Downloaded ${targetReports.length} report(s) in ZIP archive.`);
    } catch (err: any) {
      console.error('Batch download error:', err);
      showToast('Error creating ZIP archive: ' + err.message, 'error');
    } finally {
      setIsBatchDownloading(false);
    }
  };

  // Mark selected files as checked / reviewed
  const handleMarkSelectedAsChecked = async () => {
    if (selectedIds.size === 0) return;
    showToast(`Marking ${selectedIds.size} report(s) as reviewed...`, 'info');

    try {
      for (const id of Array.from(selectedIds)) {
        if (token && typeof id === 'number') {
          await fetch(`/api/sms/orders/upload/${id}/check`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }

      setReports(prev => prev.map(r => {
        if (selectedIds.has(r.id)) {
          return { ...r, isRead: true, checkedAt: new Date().toISOString(), checkedBy: currentUser?.username || 'Management' };
        }
        return r;
      }));

      showToast(`Marked ${selectedIds.size} file(s) as checked.`);
      setSelectedIds(new Set());
    } catch (e) {
      showToast('Error marking reports as reviewed', 'error');
    }
  };

  // Document Preview Handler
  const handlePreview = async (report: SMSOrderReportItem) => {
    if (previewModal?.blobUrl) {
      window.URL.revokeObjectURL(previewModal.blobUrl);
    }

    setPreviewModal({
      isOpen: true,
      title: report.fileName,
      fileName: report.fileName,
      fileSize: report.fileSize,
      fileMimetype: report.fileMimetype || '',
      uploadId: report.id,
      formCode: report.formCode,
      vesselName: report.vesselName,
      orderLabel: report.orderLabel,
      isLoading: true
    });

    try {
      const res = await fetch(`/api/sms/orders/view-upload/${report.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not load document preview');

      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const blobUrl = window.URL.createObjectURL(blob);

      setPreviewModal(prev => prev ? {
        ...prev,
        blobUrl,
        arrayBuffer,
        fileMimetype: blob.type || prev.fileMimetype,
        isLoading: false
      } : null);

      // Auto mark read if management
      if (!isVesselUser && (!report.isRead || !report.checkedAt)) {
        fetch(`/api/sms/orders/upload/${report.id}/check`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});

        setReports(prev => prev.map(r => r.id === report.id ? { ...r, isRead: true, checkedAt: new Date().toISOString(), checkedBy: currentUser?.username || 'You' } : r));
      }
    } catch (e: any) {
      showToast('Preview error: ' + e.message, 'error');
      setPreviewModal(null);
    }
  };

  const closePreviewModal = () => {
    if (previewModal?.blobUrl) {
      window.URL.revokeObjectURL(previewModal.blobUrl);
    }
    setPreviewModal(null);
  };

  const formatDateString = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getRelativeTimeString = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);

      if (diffDays > 30) return '';
      if (diffDays > 0) return `${diffDays}d ago`;
      if (diffHrs > 0) return `${diffHrs}h ago`;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins > 0) return `${diffMins}m ago`;
      return 'Just now';
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  Find SMS Report
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                    Order List Submissions
                  </span>
                </h1>
                <p className="text-xs font-semibold text-slate-500">
                  Search, filter, and inspect safety management reports and forms submitted by vessels across all order lists.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh SMS Reports"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                isFilterExpanded || activeFiltersCount > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center leading-none">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isFilterExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid / Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Export / Download All Button */}
            <button
              onClick={() => handleBatchDownload(false)}
              disabled={filteredReports.length === 0 || isBatchDownloading}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-500/15 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBatchDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export All ({filteredReports.length})</span>
            </button>
          </div>
        </div>

        {/* Primary Search Bar */}
        <div className="mt-5 relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by file name, form code (e.g. COMI-SM-1-1), description, vessel name, order title, uploader..."
              className="w-full pl-11 pr-24 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable Advanced Filters Drawer */}
        {isFilterExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 animate-in slide-in-from-top-2 duration-200">
            {/* Vessel Filter */}
            {!isVesselUser && (
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Target Vessel
                </label>
                <select
                  value={vesselFilter}
                  onChange={(e) => setVesselFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                >
                  <option value="All">All Vessels ({distinctVesselsList.length})</option>
                  {distinctVesselsList.map(v => (
                    <option key={v.id || v.name} value={v.name || String(v.id)}>
                      {v.name} {v.flag ? `(${v.flag})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Order List Filter */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                SMS Order List
              </label>
              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="All">All Order Lists ({distinctOrders.length})</option>
                {distinctOrders.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* SMS Category Filter */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                Category / Frequency
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="All">All Categories</option>
                {distinctCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Form Code Filter */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                Form Code
              </label>
              <select
                value={formCodeFilter}
                onChange={(e) => setFormCodeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="All">All Form Codes ({distinctFormCodes.length})</option>
                {distinctFormCodes.map(f => (
                  <option key={f.code} value={f.code}>
                    {f.code} - {f.desc.slice(0, 30)}{f.desc.length > 30 ? '...' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* File Format Filter */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                File Type
              </label>
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="All">All File Types</option>
                <option value="pdf">PDF Documents (.pdf)</option>
                <option value="excel">Excel Spreadsheets (.xlsx, .xls, .csv)</option>
                <option value="word">Word Documents (.docx, .doc)</option>
                <option value="image">Photos / Images (.png, .jpg)</option>
              </select>
            </div>

            {/* Review Status Filter */}
            {!isVesselUser && (
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Review Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Checked">Reviewed / Checked</option>
                  <option value="Pending">Pending Review / Unchecked</option>
                </select>
              </div>
            )}

            {/* Upload Date Range Preset */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                Upload Date Range
              </label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Past 7 Days</option>
                <option value="30days">Past 30 Days</option>
                <option value="90days">Past 3 Months</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>

            {/* Custom Date Inputs */}
            {datePreset === 'custom' && (
              <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">From Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">To Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Filter Chips Row */}
        {activeFiltersCount > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">
              Active Filters:
            </span>

            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
                Keyword: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-blue-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {vesselFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
                Vessel: {vesselFilter}
                <button onClick={() => setVesselFilter('All')} className="hover:text-blue-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {orderFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200">
                Order: {distinctOrders.find(o => o.id === orderFilter)?.label || orderFilter}
                <button onClick={() => setOrderFilter('All')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {categoryFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                Category: {categoryFilter}
                <button onClick={() => setCategoryFilter('All')} className="hover:text-emerald-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {formCodeFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-200">
                Form: {formCodeFilter}
                <button onClick={() => setFormCodeFilter('All')} className="hover:text-purple-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {fileTypeFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">
                Type: {fileTypeFilter.toUpperCase()}
                <button onClick={() => setFileTypeFilter('All')} className="hover:text-amber-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {statusFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg text-xs font-bold border border-sky-200">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('All')} className="hover:text-sky-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {datePreset !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                Date: {datePreset}
                <button onClick={() => setDatePreset('all')} className="hover:text-slate-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-xs font-black text-rose-600 hover:text-rose-700 ml-auto transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reports Found</div>
            <div className="text-xl font-black text-slate-900">{metrics.totalCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Ship className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vessels</div>
            <div className="text-xl font-black text-slate-900">{metrics.distinctVessels}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Order Lists</div>
            <div className="text-xl font-black text-slate-900">{metrics.distinctOrderCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FolderArchive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total File Volume</div>
            <div className="text-xl font-black text-slate-900">{metrics.formattedSize}</div>
          </div>
        </div>
      </div>

      {/* Floating Batch Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-30 bg-slate-900 text-white rounded-2xl p-3.5 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
              {selectedIds.size}
            </div>
            <span className="text-xs font-extrabold text-slate-200">
              {selectedIds.size} report file{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBatchDownload(true)}
              disabled={isBatchDownloading}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isBatchDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download Selected (.ZIP)</span>
            </button>

            {isAdminOrManagement && (
              <button
                onClick={handleMarkSelectedAsChecked}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark as Reviewed</span>
              </button>
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-16 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs font-bold text-slate-500">Loading submitted SMS reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-16 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Search className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">No matching SMS reports found</h3>
            <p className="text-xs font-semibold text-slate-400 max-w-md mt-1">
              Try modifying your search keywords, clearing filters, or checking back once vessels have submitted files for active order lists.
            </p>
          </div>
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-extrabold hover:bg-blue-100 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider border-b border-slate-700 select-none">
                  <th className="px-4 py-3.5 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="p-1 rounded hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                      title={selectedIds.size === filteredReports.length ? 'Deselect All' : 'Select All'}
                    >
                      {selectedIds.size === filteredReports.length && filteredReports.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th 
                    onClick={() => {
                      if (sortBy === 'vessel') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('vessel'); setSortOrder('asc'); }
                    }}
                    className="px-4 py-3.5 w-[16%] cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Vessel</span>
                      {sortBy === 'vessel' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => {
                      if (sortBy === 'form_code') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('form_code'); setSortOrder('asc'); }
                    }}
                    className="px-4 py-3.5 w-[14%] cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Form Code</span>
                      {sortBy === 'form_code' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />)}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 w-[24%]">
                    <span>Description & File Name</span>
                  </th>
                  <th 
                    onClick={() => {
                      if (sortBy === 'order') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('order'); setSortOrder('asc'); }
                    }}
                    className="px-4 py-3.5 w-[16%] cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Order List</span>
                      {sortBy === 'order' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => {
                      if (sortBy === 'uploaded_at') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('uploaded_at'); setSortOrder('desc'); }
                    }}
                    className="px-4 py-3.5 w-[16%] cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Uploaded</span>
                      {sortBy === 'uploaded_at' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />)}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 w-[14%] text-center">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold bg-white">
                {filteredReports.map((rep) => {
                  const isSelected = selectedIds.has(rep.id);
                  const isReviewed = Boolean(rep.checkedAt || rep.isRead);

                  return (
                    <tr 
                      key={rep.id} 
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggleSelectRow(rep.id)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>

                      {/* Vessel */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-lg text-xs font-extrabold border border-slate-200 inline-flex items-center gap-1">
                              🚢 {rep.vesselName}
                            </span>
                            {rep.vesselFlag && (
                              <span className="text-[10px] text-slate-400 font-bold">
                                [{rep.vesselFlag}]
                              </span>
                            )}
                          </div>
                          {rep.vesselTeamName && (
                            <span className="text-[10px] text-slate-400 font-normal pl-1">
                              {rep.vesselTeamName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Form Code */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-mono font-black text-blue-900 bg-blue-50/70 px-2 py-0.5 rounded-md border border-blue-100">
                            {rep.formCode}
                          </span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                            {rep.category}
                          </span>
                        </div>
                      </td>

                      {/* Form Description & File Name */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <p className="text-slate-800 font-bold leading-tight break-words line-clamp-2">
                            {rep.formDescription}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                            {getFileIcon(rep.fileName, "w-3.5 h-3.5 shrink-0")}
                            <span className="truncate max-w-[240px] text-slate-700 font-bold" title={rep.fileName}>
                              {rep.fileName}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                              {rep.fileSize}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Order List */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            type="button"
                            onClick={() => setOrderDetailModal({
                              isOpen: true,
                              orderId: rep.orderId,
                              orderLabel: rep.orderLabel,
                              orderDeadline: rep.orderDeadline,
                              instructions: rep.orderInstructions,
                              vesselName: rep.vesselName,
                              formCode: rep.formCode
                            })}
                            className="text-xs font-extrabold text-blue-700 hover:text-blue-900 hover:underline text-left line-clamp-1 cursor-pointer"
                            title={rep.orderLabel}
                          >
                            {rep.orderLabel}
                          </button>
                          {rep.orderDeadline && (
                            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Due: {rep.orderDeadline}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Upload Date */}
                      <td className="px-4 py-3.5 text-slate-600">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-800">
                            {formatDateString(rep.uploadedAt)}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            {getRelativeTimeString(rep.uploadedAt) && (
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                {getRelativeTimeString(rep.uploadedAt)}
                              </span>
                            )}
                            <span>by {rep.uploadedBy || rep.vesselName}</span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Preview Button */}
                          <button
                            type="button"
                            onClick={() => handlePreview(rep)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer"
                            title="View / Preview Document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download Button */}
                          <button
                            type="button"
                            onClick={() => handleDownloadSingleFile(rep.id, rep.fileName)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Order Details Button */}
                          <button
                            type="button"
                            onClick={() => setOrderDetailModal({
                              isOpen: true,
                              orderId: rep.orderId,
                              orderLabel: rep.orderLabel,
                              orderDeadline: rep.orderDeadline,
                              instructions: rep.orderInstructions,
                              vesselName: rep.vesselName,
                              formCode: rep.formCode
                            })}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                            title="View Order Details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID / CARD VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((rep) => {
            const isSelected = selectedIds.has(rep.id);
            const isReviewed = Boolean(rep.checkedAt || rep.isRead);

            return (
              <div
                key={rep.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all space-y-3.5 flex flex-col justify-between ${
                  isSelected ? 'border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-100 hover:border-blue-200'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        {getFileIcon(rep.fileName, "w-4 h-4")}
                      </div>
                      <div>
                        <span className="font-mono font-black text-blue-900 text-xs">
                          {rep.formCode}
                        </span>
                        <div className="text-[10px] font-extrabold text-slate-400">
                          {rep.category}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleSelectRow(rep.id)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Form Description */}
                  <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2 mt-3">
                    {rep.formDescription}
                  </h4>

                  {/* File name & size */}
                  <p className="text-[11px] font-semibold text-slate-500 truncate mt-1" title={rep.fileName}>
                    {rep.fileName}
                  </p>

                  {/* Metadata Badges */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-slate-400">Vessel:</span>
                      <span className="font-bold text-slate-800">🚢 {rep.vesselName}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-slate-400">Order:</span>
                      <button
                        onClick={() => setOrderDetailModal({
                          isOpen: true,
                          orderId: rep.orderId,
                          orderLabel: rep.orderLabel,
                          orderDeadline: rep.orderDeadline,
                          instructions: rep.orderInstructions,
                          vesselName: rep.vesselName,
                          formCode: rep.formCode
                        })}
                        className="font-bold text-blue-700 hover:underline truncate max-w-[170px] text-right cursor-pointer"
                        title={rep.orderLabel}
                      >
                        {rep.orderLabel}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-slate-400">Uploaded:</span>
                      <span className="font-semibold text-slate-600">{formatDateString(rep.uploadedAt)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-slate-400">Size:</span>
                      <span className="font-semibold text-slate-600">{rep.fileSize}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => handlePreview(rep)}
                    className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleDownloadSingleFile(rep.id, rep.fileName)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  {getFileIcon(previewModal.fileName, "w-4 h-4 text-white")}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">
                    {previewModal.fileName}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                    {previewModal.formCode && <span>Form: {previewModal.formCode}</span>}
                    {previewModal.vesselName && <span>• 🚢 {previewModal.vesselName}</span>}
                    {previewModal.orderLabel && <span>• {previewModal.orderLabel}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSingleFile(previewModal.uploadId, previewModal.fileName)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={closePreviewModal}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content / Document Renderer */}
            <div className="flex-1 bg-slate-900 overflow-hidden relative flex flex-col w-full h-full min-h-0">
              {previewModal.isLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 gap-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs font-bold text-slate-500">Loading document preview...</p>
                </div>
              ) : previewModal.blobUrl ? (
                (() => {
                  const lowerName = previewModal.fileName.toLowerCase();

                  if (lowerName.endsWith('.pdf')) {
                    return (
                      <div className="w-full h-full flex-1 min-h-0 flex flex-col">
                        <PDFViewer 
                          url={previewModal.blobUrl} 
                          blob={previewModal.blob}
                          arrayBuffer={previewModal.arrayBuffer}
                          title={previewModal.fileName}
                          onDownload={() => handleDownloadSingleFile(previewModal.uploadId, previewModal.fileName)}
                        />
                      </div>
                    );
                  }

                  if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp')) {
                    return (
                      <div className="w-full h-full flex-1 min-h-0 flex flex-col">
                        <ImageViewer url={previewModal.blobUrl} title={previewModal.fileName} />
                      </div>
                    );
                  }

                  if (lowerName.endsWith('.docx') && previewModal.arrayBuffer) {
                    return (
                      <div className="w-full h-full flex-1 min-h-0 flex flex-col">
                        <DocxViewer arrayBuffer={previewModal.arrayBuffer} fileName={previewModal.fileName} />
                      </div>
                    );
                  }

                  if (lowerName.endsWith('.doc') && previewModal.arrayBuffer) {
                    return (
                      <div className="w-full h-full flex-1 min-h-0 flex flex-col">
                        <DocLegacyViewer arrayBuffer={previewModal.arrayBuffer} fileName={previewModal.fileName} />
                      </div>
                    );
                  }

                  if ((lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) && previewModal.arrayBuffer) {
                    return (
                      <div className="w-full h-full flex-1 min-h-0 flex flex-col">
                        <ExcelViewer arrayBuffer={previewModal.arrayBuffer} title={previewModal.fileName} />
                      </div>
                    );
                  }

                  if ((lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')) && previewModal.arrayBuffer) {
                    return (
                      <div className="w-full h-full flex-1 min-h-0 flex flex-col">
                        <PptxViewer arrayBuffer={previewModal.arrayBuffer} fileName={previewModal.fileName} />
                      </div>
                    );
                  }

                  // Default Fallback
                  return (
                    <div className="text-center p-8 space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                        <FolderArchive className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800">Preview not available for this file type</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          You can download and view <b>{previewModal.fileName}</b> directly on your device.
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadSingleFile(previewModal.uploadId, previewModal.fileName)}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Download File
                      </button>
                    </div>
                  );
                })()
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ORDER CONTEXT MODAL */}
      {orderDetailModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden space-y-5 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{orderDetailModal.orderLabel}</h3>
                  <p className="text-xs text-slate-400 font-semibold">SMS Order List Requirement Details</p>
                </div>
              </div>
              <button
                onClick={() => setOrderDetailModal(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-400 uppercase text-[10px]">Deadline:</span>
                <span className="font-black text-slate-800 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  {orderDetailModal.orderDeadline || 'No deadline'}
                </span>
              </div>

              {orderDetailModal.vesselName && (
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-400 uppercase text-[10px]">Submitting Vessel:</span>
                  <span className="font-bold text-slate-800">🚢 {orderDetailModal.vesselName}</span>
                </div>
              )}

              {orderDetailModal.formCode && (
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-400 uppercase text-[10px]">Target Form:</span>
                  <span className="font-mono font-bold text-blue-700">{orderDetailModal.formCode}</span>
                </div>
              )}

              {orderDetailModal.instructions && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="font-extrabold text-slate-400 uppercase text-[10px] block mb-1">
                    Management Instructions:
                  </span>
                  <p className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                    {orderDetailModal.instructions}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {onNavigateToOrder && (
                <button
                  onClick={() => {
                    const oId = orderDetailModal.orderId;
                    setOrderDetailModal(null);
                    onNavigateToOrder(oId);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/15"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Order List</span>
                </button>
              )}
              <button
                onClick={() => setOrderDetailModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[300] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-3 text-xs font-bold animate-in slide-in-from-bottom-3 duration-200">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
