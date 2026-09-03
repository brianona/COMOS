import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  Ship, Flag, FileText, AlertTriangle, Calendar, Plus, Users, UserPlus,
  LogOut, ChevronRight, Upload, MessageSquare, Search, Filter, RotateCcw,
  Check, CheckCircle2, CheckSquare, ListChecks, Clock, Trash2, File, X,
  Eye, EyeOff, Copy, Menu, Edit2, Settings, ChevronDown, ArrowUp, ArrowDown,
  ArrowLeft, Home, ArrowUpDown, AlertCircle, Mail, ExternalLink, History,
  RefreshCw, MapPin, Map as MapIcon, Activity, Anchor, Database, HardDrive,
  Cloud, Package, Save, Monitor, Laptop, Tag, Play, Pause, ChevronLeft,
  Shield, ShieldAlert, ShieldCheck, Compass, Navigation, Paperclip, Download,
  Droplets, Wrench, FlaskConical, Waves, Camera, Image, Fuel, Network, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, isBefore, addDays, parseISO } from "date-fns";
import { cn, getRoleLabel, getStatus, isFocOutsideLimits, isGeminiSupportedMimeType, MAX_FILE_SIZE, AUTO_FILL_ENABLED, recognizeCertText } from "../utils/helpers";
import { ConfirmModal, ChangePasswordModal } from "./Modals";
import { PDFViewer } from "./PDFViewer";
import { ImageViewer } from "./ImageViewer";
import { CrewListView, CrewEmploymentStatusView, AuditRegistryView } from "./CrewAndAudits";
import { AboutView } from "./AboutView";
import { TroubleReportView } from "./TroubleReport";
import { SparePartsRequisitionView } from "./SparePartsRequisition";
import { BunkerBDNView } from "./BunkerBDN";
import { LubeOilLDRView } from "./LubeOilLDR";
import { BunkerFuelAnalysisView } from "./BunkerFuelAnalysis";
import { LubeOilAnalysisView } from "./LubeOilAnalysis";
import { SMSView } from "./SMSView";
import { SMSOrderListView } from "./SMSOrderList";
import { SMSFindReportView } from "./SMSFindReportView";
import { GraphifyVisualizer } from "./GraphifyVisualizer";
import { AdminPanel } from "./AdminPanel";
import { RecycleBinView } from "./RecycleBinView";
import { DepartureView } from "./DepartureView";
import { ArrivalView } from "./ArrivalView";
import { NoonToNoonView } from "./NoonToNoonView";
import { OtherReportView } from "./OtherReportView";
import { FuelConsumptionView } from "./FuelConsumptionView";
import { SlideshowView } from "./SlideshowView";
import { VesselRoutingUserView } from "./VesselRoutingUserView";
import { Logo, LogoContainer, setCustomLogoUrl } from "./Logo";
import { NotificationToast } from "./NotificationToast";
import { SidebarContent } from "./Sidebar";
import { 
  COMMON_CERTIFICATES, CAT1_CERTS, CAT2_CERTS, CAT3_CERTS, 
  CAT4_CERTS, CAT5_CERTS, CAT6_CERTS, CAT7_CERTS, getViewTitle 
} from "../data/certificates";
import { 
  Team, User, Vessel, Certificate, DepartureReport, ArrivalReport, 
  NoonReport, OtherReport, Note, FileData, Notification, DBStatus, 
  ViewType, VesselFlag 
} from "../types";
import { 
  getDeviceId, isDeviceRegistered, formatDeviceIds, 
  healAndSyncDeviceId, requestStoragePersistence 
} from "../utils/deviceIdentifier";
import { useRealtimeAutoRefresh, useRealtimeStatus, realtimeSync } from "../services/realtimeSync";

export const Dashboard = ({ user, token, onLogout }: { user: User, token: string, onLogout: () => void }) => {
  const [view, setRawView] = useState<ViewType>('dashboard');
  const [viewHistory, setViewHistory] = useState<ViewType[]>([]);

  const setView = useCallback((newView: ViewType | ((prev: ViewType) => ViewType)) => {
    setRawView(currentView => {
      const targetView = typeof newView === 'function' ? newView(currentView) : newView;
      if (targetView !== currentView) {
        setViewHistory(prev => {
          if (prev.length > 0 && prev[prev.length - 1] === currentView) return prev;
          return [...prev, currentView].slice(-30);
        });
        try {
          if (window.location.hash !== '#' + targetView) {
            window.history.pushState({ view: targetView }, '', '#' + targetView);
          }
        } catch (e) {}
      }
      return targetView;
    });
  }, []);

  const handleGoBack = useCallback(() => {
    setViewHistory(prev => {
      if (prev.length === 0) {
        setRawView('dashboard');
        return prev;
      }
      const lastView = prev[prev.length - 1];
      setRawView(lastView);
      try {
        if (window.location.hash !== '#' + lastView) {
          window.history.pushState({ view: lastView }, '', '#' + lastView);
        }
      } catch (e) {}
      return prev.slice(0, prev.length - 1);
    });
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const hashView = window.location.hash.replace('#', '') as ViewType;
      if (hashView && hashView !== view) {
        setRawView(hashView);
      } else if (event.state?.view) {
        setRawView(event.state.view as ViewType);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);
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
  const [certVesselFilter, setCertVesselFilter] = useState('');
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
  const [pendingAckCount, setPendingAckCount] = useState<number>(0);
  const [smsSidebarStatus, setSmsSidebarStatus] = useState<{
    statusColor: 'red' | 'orange' | 'normal';
    urgentCount: number;
    uncheckedCount: number;
    replaceRequestedCount?: number;
    pendingFilesCount?: number;
    hasUrgentDeadline?: boolean;
    hasUncheckedUploads?: boolean;
    hasReplaceRequests?: boolean;
  }>({
    statusColor: 'normal',
    urgentCount: 0,
    uncheckedCount: 0,
    replaceRequestedCount: 0,
    pendingFilesCount: 0
  });

  const fetchSmsSidebarStatus = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    try {
      const res = await fetch('/api/sms/orders/sidebar-status', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setSmsSidebarStatus({
          statusColor: data.statusColor || 'normal',
          urgentCount: Number(data.urgentCount) || 0,
          uncheckedCount: Number(data.uncheckedCount) || 0,
          replaceRequestedCount: Number(data.replaceRequestedCount) || 0,
          pendingFilesCount: Number(data.pendingFilesCount) || 0,
          hasUrgentDeadline: Boolean(data.hasUrgentDeadline),
          hasUncheckedUploads: Boolean(data.hasUncheckedUploads),
          hasReplaceRequests: Boolean(data.hasReplaceRequests)
        });
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('Note on fetching SMS order sidebar status:', e?.message || e);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSmsSidebarStatus(controller.signal);
    const interval = setInterval(() => {
      fetchSmsSidebarStatus(controller.signal);
    }, 25000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchSmsSidebarStatus]);

  const fetchPendingAck = useCallback(async (signal?: AbortSignal) => {
    if (!token || user?.role === 'vessel') return;
    try {
      const [uploadsRes, formsRes] = await Promise.all([
        fetch('/api/sms/uploads', { headers: { 'Authorization': `Bearer ${token}` }, signal }),
        fetch('/api/sms/forms', { headers: { 'Authorization': `Bearer ${token}` }, signal })
      ]);

      const uploadsType = uploadsRes.headers.get('content-type') || '';
      const formsType = formsRes.headers.get('content-type') || '';
      if (!uploadsRes.ok || !formsRes.ok || !uploadsType.includes('application/json') || !formsType.includes('application/json')) return;

      const uploadsData = await uploadsRes.json();
      const formsData = await formsRes.json();

      const isAdmin = user?.role === 'admin';
      const userTeamIds = Array.isArray(user?.team_ids) ? user.team_ids.map(Number) : [];

      const teamVessels = (!isAdmin && userTeamIds.length > 0)
        ? vessels.filter((v: any) => v.team_id != null && userTeamIds.includes(Number(v.team_id)))
        : vessels;

      const sortedForms = [...formsData].sort((a: any, b: any) => (b.formCode?.length || 0) - (a.formCode?.length || 0));

      const getMatchedForm = (up: any) => {
        const cleanFileName = (up.fileName || '').trim().toUpperCase();
        for (const f of sortedForms) {
          const cleanCode = (f.formCode || '').trim().toUpperCase();
          if (!cleanCode) continue;
          if (cleanFileName.startsWith(cleanCode)) {
            if (cleanFileName.length > cleanCode.length) {
              const nextChar = cleanFileName[cleanCode.length];
              if (/^[A-Z0-9]$/.test(nextChar)) continue;
            }
            return f;
          }
          if (cleanFileName.includes(cleanCode)) return f;
          const normFile = cleanFileName.replace(/[^A-Z0-9]/g, '');
          const normCode = cleanCode.replace(/[^A-Z0-9]/g, '');
          if (normCode && normCode.length >= 4 && normFile.includes(normCode)) return f;
        }
        return null;
      };

      const count = uploadsData.filter((up: any) => {
        if (!isAdmin && userTeamIds.length > 0) {
          const isFromTeam = teamVessels.some((v: any) =>
            String(v.id) === String(up.vesselId) ||
            (v.name && up.vesselName && v.name.toUpperCase() === up.vesselName.toUpperCase())
          );
          if (!isFromTeam) return false;
        }

        const matchedForm = getMatchedForm(up);
        const ackForms = formsData.filter((f: any) => f.isAcknowledgementRequired);
        const cleanFile = (up.fileName || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        let requiresAck = false;

        if (matchedForm && matchedForm.isAcknowledgementRequired) {
          requiresAck = true;
        } else if (ackForms.some((f: any) => {
          const cleanCode = (f.formCode || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
          return cleanCode && cleanCode.length >= 4 && cleanFile.includes(cleanCode);
        })) {
          requiresAck = true;
        } else {
          const cat = up.category;
          if (cat && formsData.filter((f: any) => f.category === cat).some((f: any) => f.isAcknowledgementRequired)) {
            requiresAck = true;
          }
        }

        if (!requiresAck) return false;

        const isAcknowledged = Boolean(up.isAcknowledged || up.ackFileName);
        return !isAcknowledged;
      }).length;

      setPendingAckCount(count);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('Note on fetching pending acknowledgement count:', e?.message || e);
    }
  }, [token, user?.role, user?.team_ids, vessels]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPendingAck(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchPendingAck]);
  
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [editingVesselPhoto, setEditingVesselPhoto] = useState<File | null>(null);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [newCertFile, setNewCertFile] = useState<File | null>(null);

  const [routeForm, setRouteForm] = useState({
    next_port: '',
    route_status: '',
    eta_atb: '',
    etd_atd: '',
    cargo: '',
    shackles: ''
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
  const [routingSearch, setRoutingSearch] = useState('');
  const [routingStatusFilter, setRoutingStatusFilter] = useState('');
  const [routingOwnerFilter, setRoutingOwnerFilter] = useState('');
  const [routingLoadingFilter, setRoutingLoadingFilter] = useState('');
  const [savingVesselId, setSavingVesselId] = useState<number | null>(null);
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
      
      const isLadenBallast = v.route_status === 'Laden' || v.route_status === 'Ballast';
      const defaultLoadingStatus = v.loading_status || (isLadenBallast ? v.route_status : '');
      const defaultRouteStatus = isLadenBallast ? '' : (v.route_status || '');

      initialForm[v.id] = {
        next_port: v.next_port || latestArrival?.arrival_port || '',
        route_status: defaultRouteStatus,
        shackles: v.shackles != null ? String(v.shackles) : '',
        loading_status: defaultLoadingStatus,
        eta_atb: v.eta_atb || '',
        etb: v.etb || '',
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

  const handleSaveSingleRouting = async (vesselId: number) => {
    setSavingVesselId(vesselId);
    try {
      const data = routingForm[vesselId];
      const res = await fetch(`/api/vessels/${vesselId}/route`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        notify('success', `Vessel routing saved successfully`);
        fetchData();
      } else {
        notify('error', `Failed to save vessel routing`);
      }
    } catch (err) {
      notify('error', `Error saving vessel routing`);
    } finally {
      setSavingVesselId(null);
    }
  };

  const isVesselModified = useCallback((v: Vessel) => {
    const form = routingForm[v.id];
    if (!form) return false;
    const origShackles = v.shackles != null ? String(v.shackles) : '';
    const formShackles = form.shackles != null ? String(form.shackles) : '';
    return (
      (form.next_port || '') !== (v.next_port || '') ||
      (form.route_status || '') !== (v.route_status || '') ||
      formShackles !== origShackles ||
      (form.loading_status || '') !== (v.loading_status || '') ||
      (form.eta_atb || '') !== (v.eta_atb || '') ||
      (form.etb || '') !== (v.etb || '') ||
      (form.etd_atd || '') !== (v.etd_atd || '') ||
      (form.cargo || '') !== (v.cargo || '') ||
      (form.operation_type || '') !== (v.operation_type || '') ||
      (form.remark_from_vessel || '') !== (v.remark_from_vessel || '')
    );
  }, [routingForm]);

  const modifiedVesselsCount = React.useMemo(() => {
    return vessels.filter(v => isVesselModified(v)).length;
  }, [vessels, isVesselModified]);

  const routingMetrics = React.useMemo(() => {
    let atSea = 0;
    let inPort = 0;
    let atAnchor = 0;
    let drifting = 0;

    vessels.forEach(v => {
      const form = routingForm[v.id];
      const status = form?.route_status || v.route_status || '';
      if (status === 'At sea') atSea++;
      else if (status === 'In Port' || status === 'In port') inPort++;
      else if (status === 'At Anchor' || status === 'Anchor') atAnchor++;
      else if (status === 'Drifting') drifting++;
    });

    return { total: vessels.length, atSea, inPort, atAnchor, drifting };
  }, [vessels, routingForm]);

  const filteredGroupedVessels = React.useMemo(() => {
    const groups: Record<string, Vessel[]> = {};
    
    vessels.forEach(v => {
      const form = routingForm[v.id] || {};
      const owner = v.owner || 'Other';
      const currentStatus = form.route_status || v.route_status || '';
      const currentLoading = form.loading_status || v.loading_status || '';
      const currentPort = form.next_port || v.next_port || '';
      const currentCargo = form.cargo || v.cargo || '';

      if (routingSearch) {
        const q = routingSearch.toLowerCase();
        const matchName = v.name.toLowerCase().includes(q);
        const matchPort = currentPort.toLowerCase().includes(q);
        const matchCargo = currentCargo.toLowerCase().includes(q);
        const matchTeam = (v.team_name || '').toLowerCase().includes(q);
        if (!matchName && !matchPort && !matchCargo && !matchTeam) return;
      }

      if (routingStatusFilter) {
        if (routingStatusFilter === 'At Anchor') {
          if (currentStatus !== 'At Anchor' && currentStatus !== 'Anchor') return;
        } else if (currentStatus !== routingStatusFilter) {
          return;
        }
      }

      if (routingOwnerFilter && owner !== routingOwnerFilter) return;

      if (routingLoadingFilter && currentLoading !== routingLoadingFilter) return;

      if (!groups[owner]) groups[owner] = [];
      groups[owner].push(v);
    });

    const sortedOwners = Object.keys(groups).sort((a, b) => {
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
  }, [vessels, routingForm, routingSearch, routingStatusFilter, routingOwnerFilter, routingLoadingFilter]);

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
      formData.append('fleet_status', editingVessel.fleet_status || 'In Active Fleet');
      formData.append('flag', editingVessel.flag || '');
      formData.append('type', editingVessel.type || 'Bulk Carrier');
      formData.append('email', editingVessel.email || '');
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
    if (!token) return;
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
        fetch('/api/certificates', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/vessels', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
        fetch('/api/teams', { headers }).catch(e => ({ ok: false, status: 500, headers: new Headers() } as any)),
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
        if (!res || !res.ok) {
          console.warn(`Fetch ${name} failed with status ${res?.status}`);
          return;
        }
        const contentType = res.headers ? res.headers.get('content-type') : null;
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await res.json();
            if (Array.isArray(data)) {
              setter(data);
            } else if (data && typeof data === "object" && !data.error) {
              setter(data);
            }
          } catch (e) {
            console.warn(`Failed to parse JSON for ${name}:`, e);
          }
        } else {
          console.warn(`Fetch ${name} returned non-JSON content-type: ${contentType}`);
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

  useEffect(() => {
    if (token) {
      realtimeSync.setToken(token);
    }
  }, [token]);

  const realtimeStatus = useRealtimeStatus();

  // Long-polling Realtime Database Auto-Sync
  useRealtimeAutoRefresh(
    [
      'vessels', 'flags', 'teams', 'users', 'certificates',
      'departure_reports', 'arrival_reports', 'noon_reports', 'other_reports',
      'trouble_reports', 'spare_requisitions', 'crew_members', 'audits', 'settings'
    ],
    () => {
      fetchData();
    },
    400,
    [fetchData]
  );

  useRealtimeAutoRefresh(
    ['sms_orders', 'sms_uploads', 'sms_forms', 'sms_periods'],
    () => {
      fetchSmsSidebarStatus();
      fetchPendingAck();
    },
    400,
    [fetchSmsSidebarStatus, fetchPendingAck]
  );

  const fetchCertDetails = async (cert: Certificate, isRefresh = false) => {
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
    if (certVesselFilter) {
      if (certVesselFilter === 'OTHER') {
        if (c.vessel_id || c.vessel_name) return false;
      } else {
        const selVessel = vessels.find(v => String(v.id) === certVesselFilter);
        const match = (c.vessel_id && String(c.vessel_id) === certVesselFilter) ||
                      (selVessel && c.vessel_name && c.vessel_name.toLowerCase() === selVessel.name.toLowerCase());
        if (!match) return false;
      }
    }
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
      <div className="lg:hidden bg-white border-b border-blue-100 p-3.5 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
        <div className="flex items-center gap-2">
          {(viewHistory.length > 0 || view !== 'dashboard') && (
            <button 
              onClick={handleGoBack}
              className="px-2.5 py-1.5 bg-slate-900 text-white hover:bg-blue-600 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <button 
            onClick={() => setView('dashboard')}
            className="flex items-center gap-2"
          >
            <LogoContainer size="xs" className="border-none shadow-none" />
            <span className="font-bold text-blue-900 tracking-tight">COMOS</span>
          </button>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-slate-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
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
          pendingAckCount={pendingAckCount}
          smsSidebarStatus={smsSidebarStatus}
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
                  pendingAckCount={pendingAckCount}
                  smsSidebarStatus={smsSidebarStatus}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* Universal Navigation & Back Bar */}
          <div className="mb-6 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 sticky top-2 z-30">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleGoBack}
                disabled={viewHistory.length === 0 && view === 'dashboard'}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer select-none shrink-0",
                  (viewHistory.length > 0 || view !== 'dashboard')
                    ? "bg-slate-900 text-white hover:bg-blue-600 shadow-xs active:scale-95 hover:shadow-md"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
                )}
                title={viewHistory.length > 0 ? `Go back to ${getViewTitle(viewHistory[viewHistory.length - 1])}` : "Go back"}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
                {viewHistory.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black">
                    {viewHistory.length}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium min-w-0 truncate">
                <button 
                  onClick={() => setView('dashboard')}
                  className="hover:text-blue-600 hover:underline flex items-center gap-1.5 text-slate-700 font-extrabold shrink-0"
                >
                  <Home className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline">Fleet Dashboard</span>
                </button>

                {view !== 'dashboard' && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span className="font-extrabold text-blue-900 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100 truncate">
                      {getViewTitle(view)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Realtime Long-Polling Live Status Badge */}
              <div 
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all select-none",
                  realtimeStatus.status === 'connected'
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : realtimeStatus.status === 'connecting'
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : realtimeStatus.status === 'reconnecting'
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                )}
                title={
                  realtimeStatus.status === 'connected'
                    ? `Live Database Sync Active (Version ${realtimeStatus.currentVersion})`
                    : realtimeStatus.status === 'connecting'
                    ? "Connecting to live database stream..."
                    : realtimeStatus.status === 'reconnecting'
                    ? "Reconnecting to live database stream..."
                    : "Realtime sync offline"
                }
              >
                <span 
                  className={cn(
                    "w-2 h-2 rounded-full",
                    realtimeStatus.status === 'connected' ? "bg-emerald-500 animate-pulse" :
                    realtimeStatus.status === 'connecting' ? "bg-blue-500 animate-pulse" :
                    realtimeStatus.status === 'reconnecting' ? "bg-amber-500 animate-ping" : "bg-slate-400"
                  )} 
                />
                <span className="text-[11px] font-extrabold tracking-tight">
                  {realtimeStatus.status === 'connected' ? 'Live' : 
                   realtimeStatus.status === 'connecting' ? 'Connecting...' :
                   realtimeStatus.status === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
                </span>
              </div>

              {viewHistory.length > 0 && (
                <span className="hidden md:inline text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  Previous: <strong className="text-slate-800">{getViewTitle(viewHistory[viewHistory.length - 1])}</strong>
                </span>
              )}

              {view !== 'dashboard' && (
                <button
                  onClick={() => setView('dashboard')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-extrabold transition-colors border border-blue-100 cursor-pointer"
                  title="Return to Main Dashboard"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              )}
            </div>
          </div>
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

                {/* 4. Expiring Crew Contracts KPI */}
                <div 
                  onClick={() => setView('crew_list')}
                  className="bg-white p-5 rounded-2xl border border-blue-50 hover:border-blue-200 hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all flex flex-col justify-between group"
                >
                  {(() => {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    let criticalCount = 0;
                    let warningCount = 0;

                    (crewMembers || []).forEach(c => {
                      const isAssigned = c.vesselId && c.vesselId !== 'any' && c.vesselId !== 'all';
                      const hasActiveContract = c.contractEndDate && c.contractEndDate !== '';
                      if (isAssigned && hasActiveContract) {
                        const endDate = new Date(c.contractEndDate);
                        if (!isNaN(endDate.getTime())) {
                          endDate.setHours(0, 0, 0, 0);
                          const diffDays = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                          const hasExtension = typeof c.extensionsCount === 'number' && c.extensionsCount > 0;
                          if (diffDays < 30) {
                            criticalCount++;
                          } else if (hasExtension || diffDays < 120) {
                            warningCount++;
                          }
                        }
                      }
                    });

                    const totalExpiring = criticalCount + warningCount;

                    return (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn(
                            "p-2.5 rounded-xl transition-all",
                            criticalCount > 0 ? "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white" : "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white"
                          )}>
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black text-slate-800 tracking-tight leading-none block">{totalExpiring}</span>
                            <span className="text-[9px] text-red-500 font-bold uppercase mt-0.5 block">{criticalCount} Urgent</span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Crew Contracts</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{warningCount} Warning (&lt;120d)</p>
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
                            vessels.slice(0, 10).map(v => {
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
                                          etb: v.etb || '',
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

                  {/* Expiring Crew Contracts Tracker */}
                  <div className="bg-white rounded-2xl border border-blue-100/70 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-bold text-slate-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-amber-500" />
                          Expiring Crew Contracts
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Crew contracts expiring soon (&lt; 120 Days)</p>
                      </div>
                      <button 
                        onClick={() => setView('crew_list')}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        All Crew
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);

                        const expiringMembers = (crewMembers || []).filter(c => {
                          const isAssigned = c.vesselId && c.vesselId !== 'any' && c.vesselId !== 'all';
                          const hasActiveContract = c.contractEndDate && c.contractEndDate !== '';
                          if (!isAssigned || !hasActiveContract) return false;
                          
                          const endDate = new Date(c.contractEndDate);
                          if (isNaN(endDate.getTime())) return false;
                          endDate.setHours(0, 0, 0, 0);
                          
                          const diffDays = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                          const hasExtension = typeof c.extensionsCount === 'number' && c.extensionsCount > 0;
                          return diffDays < 120 || hasExtension;
                        }).sort((a, b) => new Date(a.contractEndDate).getTime() - new Date(b.contractEndDate).getTime());

                        if (expiringMembers.length === 0) {
                          return (
                            <div className="bg-blue-50/30 p-4 rounded-xl text-center border border-blue-100/30">
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                              <p className="text-xs text-slate-500 font-semibold">All crew contracts are active and valid</p>
                            </div>
                          );
                        }

                        return expiringMembers.slice(0, 4).map(c => {
                          const endDate = new Date(c.contractEndDate);
                          endDate.setHours(0, 0, 0, 0);
                          const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          const isCritical = diffDays < 30;
                          const vesselObj = vessels.find(v => String(v.id) === String(c.vesselId));

                          return (
                            <div 
                              key={c.id} 
                              onClick={() => setView('crew_list')}
                              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100/60 cursor-pointer transition-all flex items-center justify-between gap-2 group"
                            >
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 text-xs truncate group-hover:text-blue-600 transition-colors">{c.name}</h3>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 leading-none">{c.rank} &bull; {vesselObj?.name || 'Vessel'}</div>
                                <div className="text-[9px] font-medium text-slate-500 font-mono mt-1">Contract End: {c.contractEndDate}</div>
                              </div>
                              <span className={cn(
                                "shrink-0 inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                isCritical ? "bg-red-50 text-red-700 border-red-100" : "bg-amber-50 text-amber-700 border-amber-100"
                              )}>
                                {isCritical ? (diffDays <= 0 ? 'Expired' : `${diffDays}d left`) : `${diffDays}d left`}
                              </span>
                            </div>
                          );
                        });
                      })()}
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
                    <select
                      value={certVesselFilter}
                      onChange={(e) => setCertVesselFilter(e.target.value)}
                      className="px-3 py-2 bg-blue-50/50 border border-blue-100/50 rounded-lg text-xs font-bold uppercase text-slate-700 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="">All Vessels</option>
                      {vessels.map(v => (
                        <option key={v.id} value={String(v.id)}>{v.name}</option>
                      ))}
                      <option value="OTHER">Other / Shore Office</option>
                    </select>
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
                                  if (vessel) {
                                    setSelectedVessel(vessel);
                                    setView('vessel_details');
                                  }
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
                    onClick={() => {
                      setSelectedVessel(vessel);
                      setView('vessel_details');
                    }}
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
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <span className={cn(
                            "inline-block px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                            vessel.owner === 'Nissen' ? "bg-purple-50 text-purple-700" : "bg-orange-50 text-orange-700"
                          )}>
                            {vessel.owner || 'Nissen'}
                          </span>
                          <span className={cn(
                            "inline-block px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                            (vessel.fleet_status || 'In Active Fleet') === 'In Active Fleet' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-600 border border-slate-200"
                          )}>
                            {vessel.fleet_status || 'In Active Fleet'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Fleet Status</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-bold",
                          (vessel.fleet_status || 'In Active Fleet') === 'In Active Fleet' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                        )}>
                          {vessel.fleet_status || 'In Active Fleet'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Flag</span>
                        <span className="font-bold text-slate-900">{vessel.flag || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Email Address</span>
                        <span className="font-bold text-slate-900 truncate max-w-[180px]" title={vessel.email || ''}>{vessel.email || 'N/A'}</span>
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
                          setView('vessel_details');
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

          {view === 'vessel_details' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Header Navigation Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-blue-100 shadow-xs">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('vessels')}
                    className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors flex items-center gap-1.5 font-bold text-xs"
                    title="Back to Vessels"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Vessels</span>
                  </button>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                      {(selectedVessel || vessels[0])?.name || 'Vessel Details'}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                      Dedicated Vessel Profile, Operational Status, Reports & Action Shortcuts
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Vessel Switcher Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">Switch Vessel:</span>
                    <select 
                      value={selectedVessel?.id ? String(selectedVessel.id) : (vessels[0]?.id ? String(vessels[0].id) : '')}
                      onChange={(e) => {
                        const v = vessels.find(item => String(item.id) === e.target.value);
                        if (v) setSelectedVessel(v);
                      }}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
                    >
                      {vessels.map(v => (
                        <option key={v.id} value={String(v.id)}>{v.name} ({v.team_name || 'No Team'})</option>
                      ))}
                    </select>
                  </div>

                  {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (selectedVessel || vessels[0]) && (
                    <button 
                      onClick={() => setEditingVessel(selectedVessel || vessels[0])}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const v = selectedVessel || vessels[0];
                if (!v) {
                  return (
                    <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                      <Ship className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-slate-800">No Vessel Selected</h3>
                      <p className="text-sm text-slate-500 mt-1">Please select a vessel from the list.</p>
                      <button onClick={() => setView('vessels')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
                        Go to Vessels List
                      </button>
                    </div>
                  );
                }

                const vCerts = certs.filter(c => c.vessel_id === v.id);
                const latestNoon = [...noonReports].filter(r => r.vessel_id === v.id).sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime())[0];
                const latestDep = [...departureReports].filter(r => r.vessel_id === v.id).sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime())[0];
                const latestArr = [...arrivalReports].filter(r => r.vessel_id === v.id).sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime())[0];

                return (
                  <div className="space-y-8">
                    {/* Vessel Hero Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
                      <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-12">
                        <Ship className="w-72 h-72 text-white" />
                      </div>

                      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                          {v.has_photo ? (
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-white/20 bg-white/10 shrink-0 shadow-lg">
                              <img 
                                src={`/api/vessels/${v.id}/photo?token=${token}&t=${Date.now()}`} 
                                alt={v.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-blue-600/30 border border-white/20 flex items-center justify-center shrink-0 shadow-lg">
                              <Ship className="w-10 h-10 text-white" />
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-200 border border-blue-400/30">
                                {v.team_name || 'Unassigned Team'}
                              </span>
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                                v.owner === 'Nissen' ? "bg-purple-500/20 text-purple-200 border border-purple-400/30" : "bg-orange-500/20 text-orange-200 border border-orange-400/30"
                              )}>
                                Owner: {v.owner || 'Nissen'}
                              </span>
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                                (v.fleet_status || 'In Active Fleet') === 'In Active Fleet' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" : "bg-slate-500/20 text-slate-300 border border-slate-400/30"
                              )}>
                                {v.fleet_status || 'In Active Fleet'}
                              </span>
                            </div>

                            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">{v.name}</h2>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-blue-200/80 font-medium">
                              <span className="flex items-center gap-1.5"><Flag className="w-3.5 h-3.5 text-blue-400" /> Flag: <strong className="text-white">{v.flag || 'N/A'}</strong></span>
                              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-blue-400" /> Email: <strong className="text-white">{v.email ? <a href={`mailto:${v.email}`} className="hover:underline text-blue-200">{v.email}</a> : 'N/A'}</strong></span>
                              <span className="flex items-center gap-1.5"><Anchor className="w-3.5 h-3.5 text-blue-400" /> Type: <strong className="text-white">{v.type || 'Bulk Carrier'}</strong></span>
                              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-blue-400" /> Built: <strong className="text-white">{v.date_built || 'N/A'}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Primary Actions in Hero */}
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                          <button 
                            onClick={() => {
                              setSelectedVessel(v);
                              setView('noon_to_noon');
                            }}
                            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-blue-900/50"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Submit Noon Report</span>
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedVessel(v);
                              setView('departure');
                            }}
                            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm border border-white/15 transition-all"
                          >
                            <Navigation className="w-4 h-4 text-sky-400" />
                            <span>Departure Report</span>
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedVessel(v);
                              setView('arrival');
                            }}
                            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm border border-white/15 transition-all"
                          >
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            <span>Arrival Report</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Shortcuts Section */}
                    <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600" /> Action Shortcuts & Quick Services
                          </h3>
                          <p className="text-xs text-slate-500">Instant access to vessel reports, requisitions, fuel analyses, and audits</p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
                          12 Shortcuts
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                        <button 
                          onClick={() => { setSelectedVessel(v); setView('noon_to_noon'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-white border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-blue-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <FileText className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">Noon to Noon Report</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Submit daily noon position, weather, and fuel log</p>
                        </button>

                        <button 
                          onClick={() => { setSelectedVessel(v); setView('departure'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-sky-50/80 to-white border border-sky-100 hover:border-sky-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-sky-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <Navigation className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-sky-600 transition-colors">Departure Report</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Record port departure, drafts, and cargo status</p>
                        </button>

                        <button 
                          onClick={() => { setSelectedVessel(v); setView('arrival'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-emerald-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <Anchor className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-600 transition-colors">Arrival Report</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Log port arrival, pilot, anchorage & operations</p>
                        </button>

                        <button 
                          onClick={() => { setView('lube_oil_ldr'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-white border border-indigo-100 hover:border-indigo-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-indigo-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <Droplets className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">Lube Oil LDR</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Daily lube oil consumption logs & soundings</p>
                        </button>

                        <button 
                          onClick={() => { setView('lube_oil_analysis'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/80 to-white border border-purple-100 hover:border-purple-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-purple-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <FlaskConical className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-purple-600 transition-colors">Lube Oil Analysis</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Laboratory oil sample test reports & water ppm</p>
                        </button>

                        <button 
                          onClick={() => { setView('bunker_bdn'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 to-white border border-amber-100 hover:border-amber-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-amber-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <Fuel className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-amber-600 transition-colors">Bunker BDN</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Bunker delivery notes & fuel specifications</p>
                        </button>

                        <button 
                          onClick={() => { setView('bunker_fuel_analysis'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-orange-50/80 to-white border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-orange-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <FlaskConical className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-orange-600 transition-colors">Fuel Analysis</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Fuel testing results, viscosity & flashpoint</p>
                        </button>

                        <button 
                          onClick={() => { setView('defects_5_2'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/80 to-white border border-rose-100 hover:border-rose-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-rose-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <Wrench className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-rose-600 transition-colors">Trouble Reports</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Report machinery defect, hull issues & rectification</p>
                        </button>

                        <button 
                          onClick={() => { setView('spare_requisition_ship'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-cyan-50/80 to-white border border-cyan-100 hover:border-cyan-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-cyan-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <Package className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-cyan-600 transition-colors">Spare Requisitions</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Request technical spares & track RFQ approvals</p>
                        </button>

                        <button 
                          onClick={() => { setView('crew_list'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/80 to-white border border-teal-100 hover:border-teal-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-teal-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <Users className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-teal-600 transition-colors">Crew & Audits</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Onboard crew matrix, internal/external audits</p>
                        </button>

                        <button 
                          onClick={() => { setView('sms'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-slate-50/80 to-white border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-slate-800 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-slate-700 transition-colors">SMS Manuals</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Safety Management System procedures & checklists</p>
                        </button>

                        <button 
                          onClick={() => { setView('fuel_consumption'); }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-white border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-blue-700 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                            <Activity className="w-5 h-5" />
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors">Fuel Analytics</h4>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">Historical speed, voyage performance & fuel chart</p>
                        </button>
                      </div>
                    </div>

                    {/* Main 2-Column Dashboard Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left Column (7 cols): Route & Recent Reports */}
                      <div className="lg:col-span-7 space-y-8">
                        {/* Route & Navigational Status */}
                        <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm space-y-6">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                                <Compass className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="text-base font-extrabold text-slate-900">Current Route & Navigational Status</h3>
                                <p className="text-xs text-slate-500">Live voyage positioning, schedule, and cargo information</p>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                if (isEditingRoute) {
                                  handleUpdateRoute();
                                } else {
                                  const latestArrival = [...arrivalReports]
                                    .filter(r => r.vessel_id === v.id)
                                    .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime())[0];
                                    
                                  setRouteForm({
                                    next_port: v.next_port || latestArrival?.arrival_port || '',
                                    route_status: v.route_status === 'Anchor' ? 'At Anchor' : (v.route_status || ''),
                                    loading_status: v.loading_status || '',
                                    operation_type: v.operation_type || '',
                                    eta_atb: v.eta_atb || '',
                                    etb: v.etb || '',
                                    etd_atd: v.etd_atd || '',
                                    cargo: v.cargo || '',
                                    shackles: v.shackles != null ? String(v.shackles) : '',
                                    remark_from_vessel: v.remark_from_vessel || ''
                                  });
                                  setIsEditingRoute(true);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors shadow-xs"
                            >
                              {isEditingRoute ? <><Save className="w-4 h-4" /> Save Route Changes</> : <><Edit2 className="w-4 h-4" /> Edit Route</>}
                            </button>
                          </div>

                          {isEditingRoute ? (
                            <div className="space-y-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Destination / Next Port</label>
                                <input 
                                  type="text"
                                  value={routeForm.next_port}
                                  onChange={e => setRouteForm({...routeForm, next_port: e.target.value})}
                                  placeholder="e.g. Singapore"
                                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Navigational Status</label>
                                  <select 
                                    value={routeForm.route_status}
                                    onChange={e => setRouteForm({...routeForm, route_status: e.target.value})}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                                  >
                                    <option value="">Select Status</option>
                                    <option value="At sea">At sea</option>
                                    <option value="In Port">In Port</option>
                                    <option value="At Anchor">At Anchor</option>
                                    <option value="Drifting">Drifting</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading Status</label>
                                  <select 
                                    value={routeForm.loading_status}
                                    onChange={e => setRouteForm({...routeForm, loading_status: e.target.value})}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                                  >
                                    <option value="">Select Loading</option>
                                    <option value="Laden">Laden</option>
                                    <option value="Ballast">Ballast</option>
                                  </select>
                                </div>
                              </div>

                              {(routeForm.route_status === 'At Anchor' || routeForm.route_status === 'Anchor') && (
                                <div className="space-y-1">
                                  <label className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                                    <Anchor className="w-3.5 h-3.5 text-amber-600" />
                                    No. of Shackles
                                  </label>
                                  <input 
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={routeForm.shackles}
                                    onChange={e => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setRouteForm({...routeForm, shackles: val});
                                    }}
                                    placeholder="Enter shackles"
                                    className="w-full px-4 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20"
                                  />
                                </div>
                              )}

                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Operation Type</label>
                                <select 
                                  value={routeForm.operation_type}
                                  onChange={e => setRouteForm({...routeForm, operation_type: e.target.value})}
                                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                                >
                                  <option value="">Select Operation</option>
                                  <option value="LOADING">LOADING</option>
                                  <option value="DISCHARGING">DISCHARGING</option>
                                  <option value="BUNKERING">BUNKERING</option>
                                  <option value="ship-to-ship cargo operation">SHIP-TO-SHIP</option>
                                  <option value="Others">Others</option>
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">ETA (UTC)</label>
                                  <input 
                                    type="datetime-local"
                                    value={routeForm.eta_atb ? routeForm.eta_atb.replace(' ', 'T').substring(0, 16) : ''}
                                    onChange={e => setRouteForm({...routeForm, eta_atb: e.target.value.replace('T', ' ')})}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">ETB (UTC)</label>
                                  <input 
                                    type="datetime-local"
                                    value={routeForm.etb ? routeForm.etb.replace(' ', 'T').substring(0, 16) : ''}
                                    onChange={e => setRouteForm({...routeForm, etb: e.target.value.replace('T', ' ')})}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">ETD / ATD (UTC)</label>
                                <input 
                                  type="datetime-local"
                                  value={routeForm.etd_atd ? routeForm.etd_atd.replace(' ', 'T').substring(0, 16) : ''}
                                  onChange={e => setRouteForm({...routeForm, etd_atd: e.target.value.replace('T', ' ')})}
                                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Cargo Details</label>
                                <input 
                                  type="text"
                                  value={routeForm.cargo}
                                  onChange={e => setRouteForm({...routeForm, cargo: e.target.value})}
                                  placeholder="e.g. Iron Ore / 75,000 MT"
                                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Vessel Remark</label>
                                <textarea 
                                  rows={5}
                                  value={routeForm.remark_from_vessel}
                                  onChange={e => setRouteForm({...routeForm, remark_from_vessel: e.target.value})}
                                  placeholder="Enter vessel remarks..."
                                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 resize-y"
                                />
                              </div>

                              <div className="flex items-center gap-3 pt-2">
                                <button 
                                  onClick={handleUpdateRoute}
                                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                                >
                                  Save Changes
                                </button>
                                <button 
                                  onClick={() => setIsEditingRoute(false)}
                                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Destination / Next Port</span>
                                <span className="text-sm font-extrabold text-slate-900 block">{v.next_port || 'Not Set'}</span>
                              </div>

                              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Navigational Status</span>
                                <span className="text-sm font-extrabold text-slate-900 block">
                                  {v.route_status === 'Anchor' ? 'At Anchor' : (v.route_status || 'Not Set')}
                                  {(v.route_status === 'At Anchor' || v.route_status === 'Anchor') && v.shackles && (
                                    <span className="block text-xs font-bold text-amber-700 mt-0.5">
                                      Shackles: {v.shackles}
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Loading Status</span>
                                <span className="text-sm font-extrabold text-slate-900 block">{v.loading_status || 'Not Set'}</span>
                              </div>

                              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Operation Type</span>
                                <span className="text-sm font-extrabold text-slate-900 block">{v.operation_type || 'Not Set'}</span>
                              </div>

                              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">ETA / ETB (UTC)</span>
                                <span className="text-xs font-extrabold text-slate-900 block">ETA: {v.eta_atb ? v.eta_atb.replace('T', ' ') : 'Not Set'}</span>
                                {v.etb && <span className="text-xs font-bold text-slate-700 block mt-0.5">ETB: {v.etb.replace('T', ' ')}</span>}
                              </div>

                              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">ETD / ATD (UTC)</span>
                                <span className="text-xs font-extrabold text-slate-900 block">{v.etd_atd ? v.etd_atd.replace('T', ' ') : 'Not Set'}</span>
                              </div>

                              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1 md:col-span-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cargo Details</span>
                                <span className="text-xs font-extrabold text-slate-900 block">{v.cargo || 'No cargo information recorded'}</span>
                              </div>

                              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1 md:col-span-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Vessel Remarks</span>
                                <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap">{v.remark_from_vessel || 'No remarks provided'}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Recent Operational Logs */}
                        <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm space-y-6">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                                <History className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="text-base font-extrabold text-slate-900">Latest Operational Reports</h3>
                                <p className="text-xs text-slate-500">Most recent voyage reports logged for {v.name}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {/* Latest Noon Report */}
                            <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="p-1.5 bg-blue-600 text-white rounded-lg text-xs font-extrabold">NOON</span>
                                  <span className="text-xs font-extrabold text-slate-900">Latest Noon Report</span>
                                </div>
                                {latestNoon ? (
                                  <span className="text-[10px] font-bold text-slate-500">{latestNoon.utc_date_time ? format(parseISO(latestNoon.utc_date_time), 'yyyy-MM-dd HH:mm UTC') : ''}</span>
                                ) : (
                                  <span className="text-[10px] font-medium text-slate-400">No reports</span>
                                )}
                              </div>

                              {latestNoon ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Position</span>
                                    <span className="font-bold text-slate-800">{latestNoon.position_lat || 'N/A'}, {latestNoon.position_long || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Beaufort / Wind</span>
                                    <span className="font-bold text-slate-800">{latestNoon.wind_scale || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Distance To Go</span>
                                    <span className="font-bold text-slate-800">{latestNoon.distance_to_go || 'N/A'} NM</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Cargo Status</span>
                                    <span className="font-bold text-slate-800 capitalize">{latestNoon.cargo_status || 'N/A'}</span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No noon reports filed yet for this vessel.</p>
                              )}
                            </div>

                            {/* Latest Departure / Arrival */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="p-4 rounded-2xl bg-sky-50/40 border border-sky-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-extrabold text-sky-900 flex items-center gap-1">
                                    <Navigation className="w-3.5 h-3.5 text-sky-600" /> Latest Departure
                                  </span>
                                  {latestDep && <span className="text-[10px] text-slate-500 font-bold">{latestDep.port}</span>}
                                </div>
                                {latestDep ? (
                                  <div className="text-xs text-slate-700 space-y-0.5 pt-1">
                                    <p><strong className="text-slate-900">UTC:</strong> {latestDep.utc_date_time ? format(parseISO(latestDep.utc_date_time), 'yyyy-MM-dd HH:mm') : ''}</p>
                                    <p><strong className="text-slate-900">Next Port:</strong> {latestDep.next_port || 'N/A'}</p>
                                    <p><strong className="text-slate-900">Cargo:</strong> {latestDep.cargo || 'N/A'}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic pt-1">No departure report available.</p>
                                )}
                              </div>

                              <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                                    <Anchor className="w-3.5 h-3.5 text-emerald-600" /> Latest Arrival
                                  </span>
                                  {latestArr && <span className="text-[10px] text-slate-500 font-bold">{latestArr.arrival_port}</span>}
                                </div>
                                {latestArr ? (
                                  <div className="text-xs text-slate-700 space-y-0.5 pt-1">
                                    <p><strong className="text-slate-900">UTC:</strong> {latestArr.utc_date_time ? format(parseISO(latestArr.utc_date_time), 'yyyy-MM-dd HH:mm') : ''}</p>
                                    <p><strong className="text-slate-900">Operation:</strong> {latestArr.operation_type || 'N/A'}</p>
                                    <p><strong className="text-slate-900">Cargo:</strong> {latestArr.cargo || 'N/A'}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic pt-1">No arrival report available.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column (5 cols): Specs, Charterer Fuel Limits, Certificates */}
                      <div className="lg:col-span-5 space-y-8">
                        {/* Technical Specifications */}
                        <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm space-y-5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                              <Shield className="w-5 h-5 text-blue-600" /> Vessel Specifications
                            </h3>
                            <span className="text-xs font-bold text-slate-500">{v.type || 'Bulk Carrier'}</span>
                          </div>

                          <div className="space-y-3 text-xs">
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Flag</span>
                              <span className="font-extrabold text-slate-900">{v.flag || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Email Address</span>
                              <span className="font-extrabold text-slate-900">{v.email ? <a href={`mailto:${v.email}`} className="text-blue-600 hover:underline">{v.email}</a> : 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Team Name</span>
                              <span className="font-extrabold text-slate-900">{v.team_name || 'Unassigned'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Owner</span>
                              <span className="font-extrabold text-slate-900">{v.owner || 'Nissen'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Fleet Status</span>
                              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", (v.fleet_status || 'In Active Fleet') === 'In Active Fleet' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                                {v.fleet_status || 'In Active Fleet'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Date Built</span>
                              <span className="font-extrabold text-slate-900">{v.date_built || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Min Fuel Consumption</span>
                              <span className="font-extrabold text-slate-900">{v.min_fuel_consumption || 'N/A'} MT/day</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-slate-500 font-medium">Max Fuel Consumption</span>
                              <span className="font-extrabold text-slate-900">{v.max_fuel_consumption || 'N/A'} MT/day</span>
                            </div>
                          </div>

                          {/* Charterer Fuel Limits Section */}
                          {(v.charterer_min_hsfo || v.charterer_max_hsfo || v.charterer_min_lsfo || v.charterer_max_lsfo || v.charterer_min_mgo || v.charterer_max_mgo) && (
                            <div className="pt-3 border-t border-slate-100 space-y-3">
                              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Charterer Fuel Consumption Limits</h4>
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                  <span className="text-[9px] font-bold text-slate-400 block uppercase">HSFO Range</span>
                                  <span className="font-bold text-slate-800">{v.charterer_min_hsfo || '0'} - {v.charterer_max_hsfo || '0'} MT</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                  <span className="text-[9px] font-bold text-slate-400 block uppercase">LSFO Range</span>
                                  <span className="font-bold text-slate-800">{v.charterer_min_lsfo || '0'} - {v.charterer_max_lsfo || '0'} MT</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                  <span className="text-[9px] font-bold text-slate-400 block uppercase">MGO Range</span>
                                  <span className="font-bold text-slate-800">{v.charterer_min_mgo || '0'} - {v.charterer_max_mgo || '0'} MT</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                  <span className="text-[9px] font-bold text-slate-400 block uppercase">MDO Range</span>
                                  <span className="font-bold text-slate-800">{v.charterer_min_mdo || '0'} - {v.charterer_max_mdo || '0'} MT</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Certificates & Service Reports */}
                        <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm space-y-5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                              <FileText className="w-5 h-5 text-blue-600" /> Certificates & Reports
                            </h3>
                            <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg">
                              {vCerts.length} total
                            </span>
                          </div>

                          {/* Certificate Stats */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/60 text-center">
                              <span className="block text-lg font-extrabold text-slate-900">{vCerts.length}</span>
                              <span className="text-[9px] font-bold uppercase text-slate-400">Total</span>
                            </div>
                            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/60 text-center">
                              <span className="block text-lg font-extrabold text-amber-600">
                                {vCerts.filter(c => getStatus(c.expiration_date) === 'expiring' || getStatus(c.expiration_date) === 'expiring soon').length}
                              </span>
                              <span className="text-[9px] font-bold uppercase text-amber-600">Expiring</span>
                            </div>
                            <div className="p-3 bg-red-50/50 rounded-xl border border-red-100/60 text-center">
                              <span className="block text-lg font-extrabold text-red-600">
                                {vCerts.filter(c => getStatus(c.expiration_date) === 'expired').length}
                              </span>
                              <span className="text-[9px] font-bold uppercase text-red-500">Expired</span>
                            </div>
                          </div>

                          {/* Search Certificates */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              type="text"
                              placeholder="Search certificates..."
                              value={vesselCertSearch}
                              onChange={e => setVesselCertSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                            />
                          </div>

                          {/* Certificate Items List */}
                          <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                            {(() => {
                              const filtered = vCerts
                                .filter(c => c.name.toLowerCase().includes(vesselCertSearch.toLowerCase()))
                                .sort((a, b) => {
                                  const statusOrder = { 'expired': 0, 'expiring soon': 1, 'expiring': 2, 'active': 3 };
                                  const statusA = getStatus(a.expiration_date);
                                  const statusB = getStatus(b.expiration_date);
                                  return statusOrder[statusA] - statusOrder[statusB];
                                });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <p className="text-xs text-slate-400 font-medium">No certificates or service reports found for this vessel.</p>
                                  </div>
                                );
                              }

                              return filtered.map(cert => (
                                <div 
                                  key={cert.id}
                                  onClick={() => fetchCertDetails(cert)}
                                  className="p-3.5 bg-slate-50/60 hover:bg-blue-50/40 border border-slate-100 hover:border-blue-200 rounded-2xl transition-all cursor-pointer group flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <h5 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{cert.name}</h5>
                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>Exp: {cert.expiration_date}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                                      getStatus(cert.expiration_date) === 'expired' ? "bg-red-100 text-red-700" :
                                      getStatus(cert.expiration_date) === 'expiring soon' ? "bg-orange-100 text-orange-700" :
                                      getStatus(cert.expiration_date) === 'expiring' ? "bg-amber-100 text-amber-700" :
                                      "bg-emerald-100 text-emerald-700"
                                    )}>
                                      {getStatus(cert.expiration_date)}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {view.startsWith('admin') && view !== 'admin_recycle_bin' && (
            <AdminPanel 
              token={token} 
              user={user}
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
              onViewVesselDetails={(v) => { setSelectedVessel(v); setView('vessel_details'); }}
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
              <div className="space-y-6">
                {/* Routing Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vessel Routing</h1>
                      <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-100">
                        {vessels.length} Vessels
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Manage navigational status, port schedules, and cargo details across all fleet operations.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {modifiedVesselsCount > 0 && (
                      <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200/80 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>{modifiedVesselsCount} Unsaved {modifiedVesselsCount === 1 ? 'Change' : 'Changes'}</span>
                      </div>
                    )}
                    <button 
                      onClick={handleSaveAllRouting}
                      disabled={isSavingAll}
                      className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md shadow-blue-500/10 disabled:opacity-50"
                    >
                      {isSavingAll ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save All Changes
                    </button>
                  </div>
                </header>

                {/* Fleet Quick Metrics Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <button
                    onClick={() => setRoutingStatusFilter('')}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-all text-left",
                      !routingStatusFilter
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div>
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", !routingStatusFilter ? "text-slate-300" : "text-slate-400")}>Total Fleet</p>
                      <p className="text-lg font-black mt-0.5">{routingMetrics.total}</p>
                    </div>
                    <Ship className={cn("w-5 h-5 opacity-70", !routingStatusFilter ? "text-white" : "text-slate-400")} />
                  </button>

                  <button
                    onClick={() => setRoutingStatusFilter(routingStatusFilter === 'At sea' ? '' : 'At sea')}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-all text-left",
                      routingStatusFilter === 'At sea'
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-700 border-blue-100 hover:border-blue-300 hover:bg-blue-50/50"
                    )}
                  >
                    <div>
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", routingStatusFilter === 'At sea' ? "text-blue-100" : "text-blue-600")}>At Sea</p>
                      <p className="text-lg font-black mt-0.5">{routingMetrics.atSea}</p>
                    </div>
                    <Navigation className={cn("w-5 h-5 opacity-80", routingStatusFilter === 'At sea' ? "text-white" : "text-blue-500")} />
                  </button>

                  <button
                    onClick={() => setRoutingStatusFilter(routingStatusFilter === 'In Port' ? '' : 'In Port')}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-all text-left",
                      routingStatusFilter === 'In Port'
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-700 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50"
                    )}
                  >
                    <div>
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", routingStatusFilter === 'In Port' ? "text-emerald-100" : "text-emerald-600")}>In Port</p>
                      <p className="text-lg font-black mt-0.5">{routingMetrics.inPort}</p>
                    </div>
                    <Anchor className={cn("w-5 h-5 opacity-80", routingStatusFilter === 'In Port' ? "text-white" : "text-emerald-500")} />
                  </button>

                  <button
                    onClick={() => setRoutingStatusFilter(routingStatusFilter === 'At Anchor' ? '' : 'At Anchor')}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-all text-left",
                      routingStatusFilter === 'At Anchor'
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-white text-slate-700 border-amber-100 hover:border-amber-300 hover:bg-amber-50/50"
                    )}
                  >
                    <div>
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", routingStatusFilter === 'At Anchor' ? "text-amber-100" : "text-amber-600")}>At Anchor</p>
                      <p className="text-lg font-black mt-0.5">{routingMetrics.atAnchor}</p>
                    </div>
                    <Anchor className={cn("w-5 h-5 opacity-80", routingStatusFilter === 'At Anchor' ? "text-white" : "text-amber-500")} />
                  </button>

                  <button
                    onClick={() => setRoutingStatusFilter(routingStatusFilter === 'Drifting' ? '' : 'Drifting')}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-all text-left",
                      routingStatusFilter === 'Drifting'
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white text-slate-700 border-purple-100 hover:border-purple-300 hover:bg-purple-50/50"
                    )}
                  >
                    <div>
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", routingStatusFilter === 'Drifting' ? "text-purple-100" : "text-purple-600")}>Drifting</p>
                      <p className="text-lg font-black mt-0.5">{routingMetrics.drifting}</p>
                    </div>
                    <Compass className={cn("w-5 h-5 opacity-80", routingStatusFilter === 'Drifting' ? "text-white" : "text-purple-500")} />
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-white p-4 rounded-2xl border border-blue-100/80 shadow-xs flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input 
                      type="text"
                      value={routingSearch}
                      onChange={e => setRoutingSearch(e.target.value)}
                      placeholder="Search vessel name, next port, cargo..."
                      className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                    {routingSearch && (
                      <button 
                        onClick={() => setRoutingSearch('')} 
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Owner Filter */}
                    <div className="relative">
                      <select 
                        value={routingOwnerFilter}
                        onChange={e => setRoutingOwnerFilter(e.target.value)}
                        className="px-3 py-2 pr-8 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-blue-500 outline-none cursor-pointer appearance-none"
                      >
                        <option value="">All Fleet Owners</option>
                        {groupedVessels.sortedOwners.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Navigational Status Filter */}
                    <div className="relative">
                      <select 
                        value={routingStatusFilter}
                        onChange={e => setRoutingStatusFilter(e.target.value)}
                        className="px-3 py-2 pr-8 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-blue-500 outline-none cursor-pointer appearance-none"
                      >
                        <option value="">All Navigational Statuses</option>
                        <option value="At sea">At sea</option>
                        <option value="In Port">In Port</option>
                        <option value="At Anchor">At Anchor</option>
                        <option value="Drifting">Drifting</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Loading Status Filter */}
                    <div className="relative">
                      <select 
                        value={routingLoadingFilter}
                        onChange={e => setRoutingLoadingFilter(e.target.value)}
                        className="px-3 py-2 pr-8 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-blue-500 outline-none cursor-pointer appearance-none"
                      >
                        <option value="">All Loading Statuses</option>
                        <option value="Laden">Laden</option>
                        <option value="Ballast">Ballast</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {(routingSearch || routingStatusFilter || routingOwnerFilter || routingLoadingFilter) && (
                      <button 
                        onClick={() => {
                          setRoutingSearch('');
                          setRoutingStatusFilter('');
                          setRoutingOwnerFilter('');
                          setRoutingLoadingFilter('');
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Content */}
                <div className="space-y-6">
                  {filteredGroupedVessels.sortedOwners.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                        <Filter className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">No vessels match your filters</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">Try clearing your search term or adjusting filter options to view vessel routes.</p>
                      <button 
                        onClick={() => {
                          setRoutingSearch('');
                          setRoutingStatusFilter('');
                          setRoutingOwnerFilter('');
                          setRoutingLoadingFilter('');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Clear All Filters
                      </button>
                    </div>
                  ) : (
                    filteredGroupedVessels.sortedOwners.map(owner => (
                      <div key={owner} className="bg-white rounded-2xl border border-blue-100 shadow-xs overflow-hidden">
                        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-blue-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h2 className={cn(
                              "text-xs font-black uppercase tracking-widest",
                              owner === 'Nissen' ? "text-purple-700" : "text-orange-700"
                            )}>
                              {owner} Fleet
                            </h2>
                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full shadow-xs border border-slate-200/60">
                              {filteredGroupedVessels.groups[owner].length} {filteredGroupedVessels.groups[owner].length === 1 ? 'Vessel' : 'Vessels'}
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100/60 border-b border-blue-100 text-[10px] uppercase font-bold tracking-wider text-slate-500 sticky top-0 z-10 backdrop-blur-md">
                                <th className="px-5 py-3 min-w-[220px]">Vessel</th>
                                <th className="px-5 py-3 min-w-[220px]">Destination & Nav Status</th>
                                <th className="px-5 py-3 min-w-[220px]">Operation & Cargo</th>
                                <th className="px-5 py-3 min-w-[220px]">Schedule / Timings (UTC)</th>
                                <th className="px-5 py-3 min-w-[220px]">Vessel Remark</th>
                                <th className="px-4 py-3 min-w-[100px] text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredGroupedVessels.groups[owner].map(v => {
                                const form = routingForm[v.id] || {};
                                const modified = isVesselModified(v);
                                const currentNavStatus = form.route_status || '';
                                const currentLoadStatus = form.loading_status || '';

                                return (
                                  <tr 
                                    key={v.id} 
                                    className={cn(
                                      "group transition-colors",
                                      modified ? "bg-amber-50/30 hover:bg-amber-50/50 border-l-4 border-l-amber-500" : "hover:bg-blue-50/20"
                                    )}
                                  >
                                    {/* Vessel Name & Info */}
                                    <td className="px-5 py-3.5">
                                      <div className="flex items-center gap-3">
                                        {v.has_photo ? (
                                          <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200/80 shrink-0 shadow-xs">
                                            <img 
                                              src={`/api/vessels/${v.id}/photo?token=${token}&t=${Date.now()}`} 
                                              alt={v.name}
                                              className="w-full h-full object-cover"
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                        ) : (
                                          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                            <Ship className="w-4 h-4 text-blue-600" />
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-900 truncate leading-snug">{v.name}</p>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{v.team_name || 'Fleet'}</p>
                                          {modified && (
                                            <div className="mt-1">
                                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200/80 rounded shrink-0">
                                                Unsaved
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Destination / Next Port & Nav Status */}
                                    <td className="px-5 py-3.5 min-w-[210px]">
                                      <div className="space-y-2">
                                        <div>
                                          <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Next Port</label>
                                          <input 
                                            type="text"
                                            value={form.next_port || ''}
                                            onChange={e => handleUpdateRoutingRow(v.id, 'next_port', e.target.value)}
                                            className="w-full px-2.5 py-1.5 bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="Enter next port..."
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Nav Status</label>
                                          <select 
                                            value={currentNavStatus}
                                            onChange={e => handleUpdateRoutingRow(v.id, 'route_status', e.target.value)}
                                            className={cn(
                                              "w-full px-2.5 py-1.5 border rounded-xl text-xs font-bold outline-none cursor-pointer transition-all",
                                              currentNavStatus === 'At sea' ? "bg-blue-50 text-blue-800 border-blue-200" :
                                              currentNavStatus === 'In Port' ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                                              (currentNavStatus === 'At Anchor' || currentNavStatus === 'Anchor') ? "bg-amber-50 text-amber-800 border-amber-200" :
                                              currentNavStatus === 'Drifting' ? "bg-purple-50 text-purple-800 border-purple-200" :
                                              "bg-slate-50 text-slate-700 border-slate-200"
                                            )}
                                          >
                                            <option value="" className="bg-white text-slate-700 font-medium">Select Nav Status</option>
                                            <option value="At sea" className="bg-white text-slate-800 font-medium">At sea</option>
                                            <option value="In Port" className="bg-white text-slate-800 font-medium">In Port</option>
                                            <option value="At Anchor" className="bg-white text-slate-800 font-medium">At Anchor</option>
                                            <option value="Drifting" className="bg-white text-slate-800 font-medium">Drifting</option>
                                          </select>

                                          {(currentNavStatus === 'At Anchor' || currentNavStatus === 'Anchor') && (
                                            <div className="pt-1">
                                              <div className="flex items-center gap-1 mb-0.5">
                                                <Anchor className="w-3 h-3 text-amber-600" />
                                                <label className="text-[9px] font-bold uppercase text-amber-700">No. of shackles</label>
                                              </div>
                                              <input 
                                                type="number"
                                                step="1"
                                                min="0"
                                                value={form.shackles || ''}
                                                onChange={e => {
                                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                                  handleUpdateRoutingRow(v.id, 'shackles', val);
                                                }}
                                                placeholder="Shackles"
                                                className="w-full px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500/20 outline-none"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Operation & Cargo */}
                                    <td className="px-5 py-3.5 min-w-[220px]">
                                      <div className="space-y-2">
                                        <div>
                                          <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Loading Status</label>
                                          <select 
                                            value={currentLoadStatus}
                                            onChange={e => handleUpdateRoutingRow(v.id, 'loading_status', e.target.value)}
                                            className={cn(
                                              "w-full px-2.5 py-1.5 border rounded-xl text-xs font-bold outline-none cursor-pointer transition-all",
                                              currentLoadStatus === 'Laden' ? "bg-sky-50 text-sky-800 border-sky-200" :
                                              currentLoadStatus === 'Ballast' ? "bg-teal-50 text-teal-800 border-teal-200" :
                                              "bg-slate-50 text-slate-700 border-slate-200"
                                            )}
                                          >
                                            <option value="" className="bg-white text-slate-700 font-medium">Select Loading</option>
                                            <option value="Laden" className="bg-white text-slate-800 font-medium">Laden</option>
                                            <option value="Ballast" className="bg-white text-slate-800 font-medium">Ballast</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Operation Type</label>
                                          <select 
                                            value={form.operation_type || ''}
                                            onChange={e => handleUpdateRoutingRow(v.id, 'operation_type', e.target.value)}
                                            className="w-full px-2.5 py-1.5 bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                                          >
                                            <option value="">Select Operation</option>
                                            <option value="LOADING">LOADING</option>
                                            <option value="DISCHARGING">DISCHARGING</option>
                                            <option value="BUNKERING">BUNKERING</option>
                                            <option value="ship-to-ship cargo operation">SHIP-TO-SHIP</option>
                                            <option value="Others">Others</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Cargo Details</label>
                                          <input 
                                            type="text"
                                            value={form.cargo || ''}
                                            onChange={e => handleUpdateRoutingRow(v.id, 'cargo', e.target.value)}
                                            className="w-full px-2.5 py-1.5 bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="Cargo details..."
                                          />
                                        </div>
                                      </div>
                                    </td>

                                    {/* Schedule / Timings (ETA / ETB / ETD) */}
                                    <td className="px-5 py-3.5 min-w-[220px]">
                                      <div className="space-y-2">
                                        <div>
                                          <span className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">ETA (Arrival)</span>
                                          <input 
                                            type="datetime-local"
                                            value={form.eta_atb ? form.eta_atb.replace(' ', 'T').substring(0, 16) : ''}
                                            onChange={e => handleUpdateRoutingRow(v.id, 'eta_atb', e.target.value.replace('T', ' '))}
                                            className="w-full px-2.5 py-1 bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                          />
                                        </div>
                                        <div>
                                          <span className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">ETB (Berthing)</span>
                                          <input 
                                            type="datetime-local"
                                            value={form.etb ? form.etb.replace(' ', 'T').substring(0, 16) : ''}
                                            onChange={e => handleUpdateRoutingRow(v.id, 'etb', e.target.value.replace('T', ' '))}
                                            className="w-full px-2.5 py-1 bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                          />
                                        </div>
                                        <div>
                                          <span className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">ETD / ATD (Departure)</span>
                                          <input 
                                            type="datetime-local"
                                            value={form.etd_atd ? form.etd_atd.replace(' ', 'T').substring(0, 16) : ''}
                                            onChange={e => handleUpdateRoutingRow(v.id, 'etd_atd', e.target.value.replace('T', ' '))}
                                            className="w-full px-2.5 py-1 bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                          />
                                        </div>
                                      </div>
                                    </td>

                                    {/* Vessel Remark */}
                                    <td className="px-5 py-3.5">
                                      <textarea 
                                        rows={5}
                                        value={form.remark_from_vessel || ''}
                                        onChange={e => handleUpdateRoutingRow(v.id, 'remark_from_vessel', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-y"
                                        placeholder="Remarks..."
                                      />
                                    </td>

                                    {/* Row Save Action */}
                                    <td className="px-4 py-3.5 text-center">
                                      {modified ? (
                                        <button 
                                          onClick={() => handleSaveSingleRouting(v.id)}
                                          disabled={savingVesselId === v.id}
                                          className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs shadow-amber-500/20"
                                          title="Save changes for this vessel"
                                        >
                                          {savingVesselId === v.id ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                          ) : (
                                            <Save className="w-3.5 h-3.5" />
                                          )}
                                          <span>Save</span>
                                        </button>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                          <Check className="w-3 h-3 text-emerald-500" />
                                          Synced
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
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

          {view === 'sms_overview' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <SMSView 
                vessels={vessels} 
                currentUser={user} 
                token={token} 
                mode="overview" 
                flags={flags} 
                onPendingAckCountChange={setPendingAckCount}
                onNavigateMode={(targetMode) => {
                  if (targetMode === 'management') setView('sms');
                  else if (targetMode === 'overview') setView('sms_overview');
                }}
              />
            </div>
          )}

          {view === 'sms' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <SMSView 
                vessels={vessels} 
                currentUser={user} 
                token={token} 
                mode="management" 
                flags={flags} 
                onPendingAckCountChange={setPendingAckCount}
                onNavigateMode={(targetMode) => {
                  if (targetMode === 'management') setView('sms');
                  else if (targetMode === 'overview') setView('sms_overview');
                }}
              />
            </div>
          )}

          {view === 'sms_order_list' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <SMSOrderListView 
                vessels={vessels} 
                currentUser={user} 
                token={token} 
                flags={flags} 
                onStatusRefresh={fetchSmsSidebarStatus}
              />
            </div>
          )}

          {view === 'sms_find_report' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <SMSFindReportView 
                vessels={vessels} 
                currentUser={user} 
                token={token} 
                flags={flags}
                onNavigateToOrder={(orderId) => {
                  setView('sms_order_list');
                }}
              />
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

          {view === 'graphify' && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <GraphifyVisualizer 
                token={token} 
                currentUser={user} 
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
          {false && selectedVessel && (
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
                      <span className="text-slate-300">&bull;</span>
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
                            route_status: selectedVessel.route_status === 'Anchor' ? 'At Anchor' : (selectedVessel.route_status || ''),
                            loading_status: selectedVessel.loading_status || '',
                            operation_type: selectedVessel.operation_type || '',
                            eta_atb: selectedVessel.eta_atb || '',
                            etb: selectedVessel.etb || '',
                            etd_atd: selectedVessel.etd_atd || '',
                            cargo: selectedVessel.cargo || '',
                            shackles: selectedVessel.shackles != null ? String(selectedVessel.shackles) : '',
                            remark_from_vessel: selectedVessel.remark_from_vessel || ''
                          });
                          setIsEditingRoute(true);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-100 rounded-lg text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-xs"
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
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Navigational Status</label>
                          <select 
                            value={routeForm.route_status}
                            onChange={e => setRouteForm({...routeForm, route_status: e.target.value})}
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-medium text-slate-800"
                          >
                            <option value="">Select Status</option>
                            <option value="At sea">At sea</option>
                            <option value="In Port">In Port</option>
                            <option value="At Anchor">At Anchor</option>
                            <option value="Drifting">Drifting</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Loading Status</label>
                          <select 
                            value={routeForm.loading_status}
                            onChange={e => setRouteForm({...routeForm, loading_status: e.target.value})}
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-medium text-slate-800"
                          >
                            <option value="">Select Loading</option>
                            <option value="Laden">Laden</option>
                            <option value="Ballast">Ballast</option>
                          </select>
                        </div>
                      </div>

                      {(routeForm.route_status === 'At Anchor' || routeForm.route_status === 'Anchor') && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-amber-700 ml-1 flex items-center gap-1">
                            <Anchor className="w-3 h-3 text-amber-600" />
                            No. of Shackles
                          </label>
                          <input 
                            type="number"
                            step="1"
                            min="0"
                            value={routeForm.shackles}
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setRouteForm({...routeForm, shackles: val});
                            }}
                            placeholder="Enter shackles"
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500/20 outline-none font-bold text-slate-800"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Operation Type</label>
                        <select 
                          value={routeForm.operation_type}
                          onChange={e => setRouteForm({...routeForm, operation_type: e.target.value})}
                          className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-medium text-slate-800"
                        >
                          <option value="">Select Operation</option>
                          <option value="LOADING">LOADING</option>
                          <option value="DISCHARGING">DISCHARGING</option>
                          <option value="BUNKERING">BUNKERING</option>
                          <option value="ship-to-ship cargo operation">SHIP-TO-SHIP</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">ETA (UTC)</label>
                          <input 
                            type="datetime-local"
                            value={routeForm.eta_atb ? routeForm.eta_atb.replace(' ', 'T').substring(0, 16) : ''}
                            onChange={e => setRouteForm({...routeForm, eta_atb: e.target.value.replace('T', ' ')})}
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">ETB (UTC)</label>
                          <input 
                            type="datetime-local"
                            value={routeForm.etb ? routeForm.etb.replace(' ', 'T').substring(0, 16) : ''}
                            onChange={e => setRouteForm({...routeForm, etb: e.target.value.replace('T', ' ')})}
                            className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 font-semibold"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">ETD / ATD (UTC)</label>
                        <input 
                          type="datetime-local"
                          value={routeForm.etd_atd ? routeForm.etd_atd.replace(' ', 'T').substring(0, 16) : ''}
                          onChange={e => setRouteForm({...routeForm, etd_atd: e.target.value.replace('T', ' ')})}
                          className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 font-semibold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Cargo Details</label>
                        <input 
                          type="text"
                          value={routeForm.cargo}
                          onChange={e => setRouteForm({...routeForm, cargo: e.target.value})}
                          placeholder="e.g. Crude Oil / 50,000 MT"
                          className="w-full px-3 py-1.5 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Vessel Remark</label>
                        <textarea 
                          rows={5}
                          value={routeForm.remark_from_vessel}
                          onChange={e => setRouteForm({...routeForm, remark_from_vessel: e.target.value})}
                          placeholder="Remarks from vessel..."
                          className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 resize-y"
                        />
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
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Nav Status</p>
                          <p className="text-xs font-bold text-slate-900">
                            {selectedVessel.route_status === 'Anchor' ? 'At Anchor' : (selectedVessel.route_status || 'Not Set')}
                            {(selectedVessel.route_status === 'At Anchor' || selectedVessel.route_status === 'Anchor') && selectedVessel.shackles && (
                              <span className="block text-[10px] font-normal text-amber-700 mt-0.5">
                                Shackles: {selectedVessel.shackles}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-sky-100 rounded-lg shrink-0"><Ship className="w-3.5 h-3.5 text-sky-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Loading Status</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.loading_status || 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg shrink-0"><Compass className="w-3.5 h-3.5 text-indigo-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Operation Type</p>
                          <p className="text-xs font-bold text-slate-900">{selectedVessel.operation_type || 'Not Set'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg shrink-0"><Clock className="w-3.5 h-3.5 text-amber-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ETA / ETB (UTC)</p>
                          <p className="text-xs font-bold text-slate-900">ETA: {selectedVessel.eta_atb ? selectedVessel.eta_atb.replace('T', ' ') : 'Not Set'}</p>
                          {selectedVessel.etb && (
                            <p className="text-xs font-bold text-slate-700 mt-0.5">ETB: {selectedVessel.etb.replace('T', ' ')}</p>
                          )}
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
                      <div className="flex items-start gap-3 col-span-2">
                        <div className="p-2 bg-slate-100 rounded-lg shrink-0"><FileText className="w-3.5 h-3.5 text-slate-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Vessel Remark</p>
                          <p className="text-xs font-medium text-slate-800">{selectedVessel.remark_from_vessel || 'No remarks provided'}</p>
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
                        <div className="p-2 bg-emerald-100 rounded-lg shrink-0"><Shield className="w-3.5 h-3.5 text-emerald-600" /></div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Fleet Status</p>
                          <span className={cn(
                            "inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5",
                            (selectedVessel.fleet_status || 'In Active Fleet') === 'In Active Fleet' ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                          )}>
                            {selectedVessel.fleet_status || 'In Active Fleet'}
                          </span>
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
                    <div className="grid grid-cols-2 gap-4">
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
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Fleet Status</label>
                        <select 
                          value={editingVessel.fleet_status || 'In Active Fleet'}
                          onChange={(e) => setEditingVessel({...editingVessel, fleet_status: e.target.value as any})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="In Active Fleet">In Active Fleet</option>
                          <option value="Out of Management">Out of Management</option>
                        </select>
                      </div>
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
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                      <input 
                        type="email" 
                        placeholder="e.g. vessel@shipping.com" 
                        value={editingVessel.email || ''}
                        onChange={(e) => setEditingVessel({...editingVessel, email: e.target.value})}
                        className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                      />
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
                      {user.role === 'vessel' ? (
                        <div className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm text-slate-700 font-medium">
                          Ship Certificate/Service Report
                        </div>
                      ) : (
                        <select 
                          value={editingCert.access_type}
                          onChange={(e) => setEditingCert({...editingCert, access_type: e.target.value as any})}
                          className="w-full px-4 py-2 bg-blue-50/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="office">Office Only</option>
                          <option value="vessel">Ship Certificate/Service Report</option>
                          <option value="any">Any</option>
                        </select>
                      )}
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

