import React, { useState, useEffect } from "react";
import { 
  Ship, Calendar, Plus, Upload, MessageSquare, Search, Filter, 
  RotateCcw, Check, CheckCircle, CheckCircle2, Clock, Trash2, File as FileIcon, X, ChevronDown, ArrowUp, 
  ArrowDown, ArrowLeft, ArrowUpDown, AlertCircle, RefreshCw, MapPin, 
  Activity, Anchor, Download, Droplets, Fuel, Info, FileText, Edit2,
  Eye, Navigation, Compass, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, parseISO } from "date-fns";
import { cn, MAX_FILE_SIZE, isFocOutsideLimits } from "../utils/helpers";
import { User, Vessel, DepartureReport, ArrivalReport } from "../types";

export const ArrivalView = ({ user, token, vessels, reports, departureReports, onRefresh, notify, isLoading }: { 
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
    vessel_id: String(user.vessel_id || (vessels[0]?.id ? String(vessels[0].id) : '')),
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
    foc_sea_hsfo: '0',
    foc_sea_lsfo: '0',
    foc_sea_mgo: '0',
    foc_sea_mdo: '0',
    departure_hsfo: '0',
    departure_lsfo: '0',
    departure_mgo: '0',
    departure_mdo: '0',
    departure_fw: '0',
    charterer_min_hsfo: '',
    charterer_max_hsfo: '',
    charterer_min_lsfo: '',
    charterer_max_lsfo: '',
    charterer_min_mgo: '',
    charterer_max_mgo: '',
    charterer_min_mdo: '',
    charterer_max_mdo: '',
    agent_detail: 'FILLIN'
  };
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [vesselFilter, setVesselFilter] = useState<string>('');
  const [cargoStatusFilter, setCargoStatusFilter] = useState<string>('all');
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReportForDetails, setSelectedReportForDetails] = useState<ArrivalReport | null>(null);

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => {
      // Vessel filter
      if (vesselFilter !== '' && String(r.vessel_id) !== vesselFilter) return false;

      // Cargo status filter
      if (cargoStatusFilter !== 'all' && (r.cargo_status || '').toLowerCase() !== cargoStatusFilter.toLowerCase()) {
        return false;
      }

      // Operation type filter
      if (operationTypeFilter !== 'all') {
        const op = (r.operation_type || '').toUpperCase();
        if (!op.includes(operationTypeFilter.toUpperCase())) {
          return false;
        }
      }

      // Date filter
      if (dateFilter) {
        try {
          const reportDate = format(parseISO(r.utc_date_time), 'yyyy-MM-dd');
          if (reportDate !== dateFilter) return false;
        } catch (e) {
          if (!r.utc_date_time.startsWith(dateFilter)) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesVoyage = (r.voyage_number || '').toLowerCase().includes(q);
        const matchesPort = (r.arrival_port || '').toLowerCase().includes(q);
        const matchesVessel = (r.vessel_name || '').toLowerCase().includes(q);
        const matchesAgent = (r.agent_detail || '').toLowerCase().includes(q);
        const matchesCargo = (r.cargo || '').toLowerCase().includes(q);
        const matchesCargoStatus = (r.cargo_status || '').toLowerCase().includes(q);
        const matchesOp = (r.operation_type || '').toLowerCase().includes(q);
        const matchesRobType = (r.rob_type || '').toLowerCase().includes(q);
        const matchesEuUk = (r.eu_uk_status || '').toLowerCase().includes(q);

        let matchesDate = false;
        try {
          matchesDate = format(parseISO(r.utc_date_time), 'MMM dd, yyyy').toLowerCase().includes(q);
        } catch (e) {
          matchesDate = r.utc_date_time.toLowerCase().includes(q);
        }

        if (!matchesVoyage && !matchesPort && !matchesVessel && !matchesAgent && !matchesCargo && !matchesCargoStatus && !matchesOp && !matchesRobType && !matchesEuUk && !matchesDate) {
          return false;
        }
      }

      return true;
    });
  }, [reports, vesselFilter, cargoStatusFilter, operationTypeFilter, dateFilter, searchQuery]);

  const historyStats = React.useMemo(() => {
    if (!filteredReports || filteredReports.length === 0) {
      return { totalReports: 0, avgSeaHsfo: '0.00', avgTotalSeaFoc: '0.00', totalDistance: '0', latestReport: null };
    }
    let totalHsfo = 0;
    let totalAllFoc = 0;
    let totalDist = 0;
    filteredReports.forEach(r => {
      const h = Number(r.foc_sea_hsfo || 0);
      const l = Number(r.foc_sea_lsfo || 0);
      const mg = Number(r.foc_sea_mgo || 0);
      const md = Number(r.foc_sea_mdo || 0);
      totalHsfo += h;
      totalAllFoc += (h + l + mg + md);
      totalDist += Number(r.total_distance || 0);
    });
    const avgSeaHsfo = (totalHsfo / filteredReports.length).toFixed(2);
    const avgTotalSeaFoc = (totalAllFoc / filteredReports.length).toFixed(2);
    const totalDistance = totalDist.toLocaleString(undefined, { maximumFractionDigits: 1 });
    const latestReport = filteredReports[0] || null;

    return {
      totalReports: filteredReports.length,
      avgSeaHsfo,
      avgTotalSeaFoc,
      totalDistance,
      latestReport
    };
  }, [filteredReports]);

  useEffect(() => {
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

        setForm(prev => {
          const newDepHsfo = String(latest.rob_hsfo ?? 0);
          const newDepLsfo = String(latest.rob_lsfo ?? 0);
          const newDepMgo = String(latest.rob_mgo ?? 0);
          const newDepMdo = String(latest.rob_mdo ?? 0);

          const curFocHsfo = parseFloat(prev.foc_sea_hsfo) || 0;
          const curFocLsfo = parseFloat(prev.foc_sea_lsfo) || 0;
          const curFocMgo = parseFloat(prev.foc_sea_mgo) || 0;
          const curFocMdo = parseFloat(prev.foc_sea_mdo) || 0;

          const curRobHsfo = parseFloat(prev.rob_hsfo) || 0;
          const curRobLsfo = parseFloat(prev.rob_lsfo) || 0;
          const curRobMgo = parseFloat(prev.rob_mgo) || 0;
          const curRobMdo = parseFloat(prev.rob_mdo) || 0;

          const nextRobHsfo = (curRobHsfo === 0 && curFocHsfo === 0) 
            ? newDepHsfo 
            : (curRobHsfo === 0 ? String(Math.max(0, parseFloat(newDepHsfo) - curFocHsfo).toFixed(2)) : prev.rob_hsfo);
          const nextRobLsfo = (curRobLsfo === 0 && curFocLsfo === 0) 
            ? newDepLsfo 
            : (curRobLsfo === 0 ? String(Math.max(0, parseFloat(newDepLsfo) - curFocLsfo).toFixed(2)) : prev.rob_lsfo);
          const nextRobMgo = (curRobMgo === 0 && curFocMgo === 0) 
            ? newDepMgo 
            : (curRobMgo === 0 ? String(Math.max(0, parseFloat(newDepMgo) - curFocMgo).toFixed(2)) : prev.rob_mgo);
          const nextRobMdo = (curRobMdo === 0 && curFocMdo === 0) 
            ? newDepMdo 
            : (curRobMdo === 0 ? String(Math.max(0, parseFloat(newDepMgo) - curFocMdo).toFixed(2)) : prev.rob_mdo);

          return {
            ...prev,
            departure_hsfo: newDepHsfo,
            departure_lsfo: newDepLsfo,
            departure_mgo: newDepMgo,
            departure_mdo: newDepMdo,
            rob_hsfo: nextRobHsfo,
            rob_lsfo: nextRobLsfo,
            rob_mgo: nextRobMgo,
            rob_mdo: nextRobMdo,
            total_time_at_sea: timeAtSea || prev.total_time_at_sea
          };
        });
      }
    }
  }, [form.vessel_id, form.utc_date_time, departureReports, editingId]);

  const foc_computation = React.useMemo(() => {
    const currentFormTime = form.utc_date_time ? new Date(form.utc_date_time).getTime() : Date.now();
    const vesselDepartures = (departureReports || [])
      .filter(r => String(r.vessel_id) === String(form.vessel_id))
      .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime());

    let prev = vesselDepartures.find(r => new Date(r.utc_date_time).getTime() < currentFormTime);
    if (!prev && vesselDepartures.length > 0) {
      prev = vesselDepartures[0];
    }

    const baselineHsfo = (parseFloat(form.departure_hsfo) || 0) || Number(prev?.rob_hsfo || 0);
    const baselineLsfo = (parseFloat(form.departure_lsfo) || 0) || Number(prev?.rob_lsfo || 0);
    const baselineMgo = (parseFloat(form.departure_mgo) || 0) || Number(prev?.rob_mgo || 0);
    const baselineMdo = (parseFloat(form.departure_mdo) || 0) || Number(prev?.rob_mdo || 0);

    const current = {
      hsfo: parseFloat(form.rob_hsfo) || 0,
      lsfo: parseFloat(form.rob_lsfo) || 0,
      mgo: parseFloat(form.rob_mgo) || 0,
      mdo: parseFloat(form.rob_mdo) || 0,
    };

    const hsfo = Math.max(0, baselineHsfo - current.hsfo).toFixed(2);
    const lsfo = Math.max(0, baselineLsfo - current.lsfo).toFixed(2);
    const mgo = Math.max(0, baselineMgo - current.mgo).toFixed(2);
    const mdo = Math.max(0, baselineMdo - current.mdo).toFixed(2);
    const total = (parseFloat(hsfo) + parseFloat(lsfo) + parseFloat(mgo) + parseFloat(mdo)).toFixed(2);

    return {
      hsfo,
      lsfo,
      mgo,
      mdo,
      total,
      baselineDate: prev?.utc_date_time || null,
      prevRob: {
        hsfo: baselineHsfo,
        lsfo: baselineLsfo,
        mgo: baselineMgo,
        mdo: baselineMdo,
      }
    };
  }, [form.rob_hsfo, form.rob_lsfo, form.rob_mgo, form.rob_mdo, form.departure_hsfo, form.departure_lsfo, form.departure_mgo, form.departure_mdo, form.vessel_id, form.utc_date_time, departureReports]);

  const handleAutoComputeRob = () => {
    setForm(prev => ({
      ...prev,
      rob_hsfo: Math.max(0, (parseFloat(prev.departure_hsfo) || 0) - (parseFloat(prev.foc_sea_hsfo) || 0)).toFixed(2),
      rob_lsfo: Math.max(0, (parseFloat(prev.departure_lsfo) || 0) - (parseFloat(prev.foc_sea_lsfo) || 0)).toFixed(2),
      rob_mgo: Math.max(0, (parseFloat(prev.departure_mgo) || 0) - (parseFloat(prev.foc_sea_mgo) || 0)).toFixed(2),
      rob_mdo: Math.max(0, (parseFloat(prev.departure_mdo) || 0) - (parseFloat(prev.foc_sea_mdo) || 0)).toFixed(2),
    }));
  };

  const handleFocChange = (fuelKey: 'hsfo' | 'lsfo' | 'mgo' | 'mdo', val: string) => {
    const depKey = `departure_${fuelKey}` as keyof typeof form;
    const robKey = `rob_${fuelKey}` as keyof typeof form;
    const focKey = `foc_sea_${fuelKey}` as keyof typeof form;
    
    const depVal = parseFloat(form[depKey] as string) || 0;
    const focVal = parseFloat(val) || 0;
    const newRob = Math.max(0, depVal - focVal).toFixed(2);
    
    setForm(prev => ({
      ...prev,
      [focKey]: val,
      [robKey]: newRob
    }));
  };

  const handleRobChange = (fuelKey: 'hsfo' | 'lsfo' | 'mgo' | 'mdo', val: string) => {
    const depKey = `departure_${fuelKey}` as keyof typeof form;
    const robKey = `rob_${fuelKey}` as keyof typeof form;
    const focKey = `foc_sea_${fuelKey}` as keyof typeof form;
    
    const depVal = parseFloat(form[depKey] as string) || 0;
    const robVal = parseFloat(val) || 0;
    const newFoc = Math.max(0, depVal - robVal).toFixed(2);
    
    setForm(prev => ({
      ...prev,
      [robKey]: val,
      [focKey]: newFoc
    }));
  };

  const handleDepartureChange = (fuelKey: 'hsfo' | 'lsfo' | 'mgo' | 'mdo', val: string) => {
    const depKey = `departure_${fuelKey}` as keyof typeof form;
    const robKey = `rob_${fuelKey}` as keyof typeof form;
    const focKey = `foc_sea_${fuelKey}` as keyof typeof form;
    
    const depVal = parseFloat(val) || 0;
    const focVal = parseFloat(form[focKey] as string) || 0;
    const newRob = Math.max(0, depVal - focVal).toFixed(2);
    
    setForm(prev => ({
      ...prev,
      [depKey]: val,
      [robKey]: newRob
    }));
  };

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
      
      // Auto-compute final ROB and FOC values to ensure database persistence
      const calculatedRobHsfo = form.rob_hsfo || '0';
      const calculatedRobLsfo = form.rob_lsfo || '0';
      const calculatedRobMgo = form.rob_mgo || '0';
      const calculatedRobMdo = form.rob_mdo || '0';

      const calculatedFocHsfo = foc_computation.hsfo;
      const calculatedFocLsfo = foc_computation.lsfo;
      const calculatedFocMgo = foc_computation.mgo;
      const calculatedFocMdo = foc_computation.mdo;

      formData.set('rob_hsfo', String(calculatedRobHsfo));
      formData.set('rob_lsfo', String(calculatedRobLsfo));
      formData.set('rob_mgo', String(calculatedRobMgo));
      formData.set('rob_mdo', String(calculatedRobMdo));
      formData.set('rob_fw', String(form.rob_fw || 0));

      formData.set('foc_sea_hsfo', String(calculatedFocHsfo));
      formData.set('foc_sea_lsfo', String(calculatedFocLsfo));
      formData.set('foc_sea_mgo', String(calculatedFocMgo));
      formData.set('foc_sea_mdo', String(calculatedFocMdo));

      formData.set('departure_hsfo', String(foc_computation.prevRob.hsfo));
      formData.set('departure_lsfo', String(foc_computation.prevRob.lsfo));
      formData.set('departure_mgo', String(foc_computation.prevRob.mgo));
      formData.set('departure_mdo', String(foc_computation.prevRob.mdo));

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
      foc_sea_hsfo: String(report.foc_sea_hsfo ?? 0),
      foc_sea_lsfo: String(report.foc_sea_lsfo ?? 0),
      foc_sea_mgo: String(report.foc_sea_mgo ?? 0),
      foc_sea_mdo: String(report.foc_sea_mdo ?? 0),
      departure_hsfo: String(Number(report.rob_hsfo || 0) + Number(report.foc_sea_hsfo || 0)),
      departure_lsfo: String(Number(report.rob_lsfo || 0) + Number(report.foc_sea_lsfo || 0)),
      departure_mgo: String(Number(report.rob_mgo || 0) + Number(report.foc_sea_mgo || 0)),
      departure_mdo: String(Number(report.rob_mdo || 0) + Number(report.foc_sea_mdo || 0)),
      departure_fw: '0',
      charterer_min_hsfo: (report as any).charterer_min_hsfo || '',
      charterer_max_hsfo: (report as any).charterer_max_hsfo || '',
      charterer_min_lsfo: (report as any).charterer_min_lsfo || '',
      charterer_max_lsfo: (report as any).charterer_max_lsfo || '',
      charterer_min_mgo: (report as any).charterer_min_mgo || '',
      charterer_max_mgo: (report as any).charterer_max_mgo || '',
      charterer_min_mdo: (report as any).charterer_min_mdo || '',
      charterer_max_mdo: (report as any).charterer_max_mdo || '',
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
                    {user.role === 'vessel' && user.vessel_id ? (
                      <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900">
                        {selectedVesselName}
                      </div>
                    ) : (
                      <select
                        value={form.vessel_id}
                        onChange={(e) => setForm({ ...form, vessel_id: e.target.value })}
                        required
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Latitude</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 14.5 N"
                      value={form.position_lat}
                      onChange={(e) => setForm({ ...form, position_lat: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
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
                      <option value="Discharging and Loading">Discharging and Loading</option>
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

                <div>
                  <label id="lbl-rob-type" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ROB Event Type</label>
                  <select 
                    id="select-rob-type"
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
                  <label id="lbl-scanned-rob" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Scanned ROB Report</label>
                  <div className="flex items-center gap-3">
                    <label id="btn-upload-report-label" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-100/50 transition-colors">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-700">{file ? file.name : 'Upload Report'}</span>
                      <input id="input-report-file" type="file" className="hidden" onChange={(e) => {
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
                      <button id="btn-remove-report-file" onClick={() => setFile(null)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50/40 p-6 rounded-2xl border border-blue-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      Fuel Statistics & Auto-Computed Consumption (24h)
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total FOC:</span>
                      <span className="px-2.5 py-1 bg-blue-600 text-white font-mono font-bold text-xs rounded-lg shadow-sm">
                        {foc_computation.total} MT
                      </span>
                    </div>
                  </div>

                  {foc_computation.baselineDate ? (
                    <div className="mb-4 px-3.5 py-2 bg-blue-100/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        Baseline ROB from: <strong className="font-bold">{format(parseISO(foc_computation.baselineDate), 'MMM dd, HH:mm')} UTC</strong>
                      </span>
                      <span className="text-[11px] text-blue-700 font-semibold hidden md:inline">
                        Auto-computed: (Prior ROB - Current ROB)
                      </span>
                    </div>
                  ) : (
                    <div className="mb-4 px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Initial report for vessel: baseline ROB will be established upon submission.</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                      <div className="col-span-3">Fuel Type</div>
                      <div className="col-span-5">Current ROB (MT)</div>
                      <div className="col-span-4 text-right">Auto-Computed FOC (MT)</div>
                    </div>

                    {[
                      { key: 'hsfo', label: 'HSFO', rob: 'rob_hsfo' },
                      { key: 'lsfo', label: 'LSFO', rob: 'rob_lsfo' },
                      { key: 'mgo', label: 'MGO', rob: 'rob_mgo' },
                      { key: 'mdo', label: 'MDO', rob: 'rob_mdo' },
                    ].map(f => {
                      const computedFoc = (foc_computation as any)[f.key];
                      const isOutside = isFocOutsideLimits(
                        computedFoc, 
                        (form as any)[`charterer_min_${f.key}`] || currentVessel?.min_fuel_consumption, 
                        (form as any)[`charterer_max_${f.key}`] || currentVessel?.max_fuel_consumption
                      );
                      return (
                        <div key={f.key} className="grid grid-cols-12 gap-3 items-center bg-white p-2.5 rounded-xl border border-blue-100">
                          <div className="col-span-3">
                            <span className="text-sm font-bold text-slate-800">{f.label}</span>
                            {(form as any)[`charterer_min_${f.key}`] || (form as any)[`charterer_max_${f.key}`] || currentVessel?.min_fuel_consumption || currentVessel?.max_fuel_consumption ? (
                              <span className="block text-[10px] text-slate-400 font-medium">
                                Threshold: {(form as any)[`charterer_min_${f.key}`] || currentVessel?.min_fuel_consumption || 0} - {(form as any)[`charterer_max_${f.key}`] || currentVessel?.max_fuel_consumption || '∞'}
                              </span>
                            ) : null}
                          </div>
                          <div className="col-span-5">
                            <input 
                              type="number" 
                              step="0.01"
                              value={(form as any)[f.rob]}
                              onChange={(e) => setForm({ ...form, [f.rob]: e.target.value })}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-blue-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="col-span-4 flex items-center justify-end">
                            <div 
                              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg flex items-center gap-1 shadow-sm whitespace-nowrap ${
                                isOutside
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`} 
                              title={`Auto-computed FOC: ${computedFoc} MT`}
                            >
                              <span>{computedFoc} MT</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="grid grid-cols-12 gap-3 items-center bg-white p-2.5 rounded-xl border border-blue-100">
                      <div className="col-span-3">
                        <span className="text-sm font-bold text-slate-800">FW</span>
                        <span className="block text-[10px] text-slate-400 font-medium">Fresh Water</span>
                      </div>
                      <div className="col-span-5">
                        <input 
                          type="number" 
                          step="0.01"
                          value={form.rob_fw}
                          onChange={(e) => setForm({ ...form, rob_fw: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-blue-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-4 flex items-center justify-end">
                        <span className="text-xs text-slate-400 italic">ROB Only</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium italic pt-1 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>Auto-computed consumption is recorded directly in database and retrievable in the History tab.</span>
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
        <div className="space-y-6">
          {/* Executive Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Reports Logged</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{historyStats.totalReports}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {vesselFilter ? 'For selected vessel' : 'Across all fleet vessels'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg Sea HSFO FOC</p>
                <p className="text-2xl font-black text-blue-700 mt-1 font-mono">{historyStats.avgSeaHsfo} <span className="text-sm font-semibold">MT</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">Computed sea passage average</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Fuel className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg Total Sea FOC</p>
                <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{historyStats.avgTotalSeaFoc} <span className="text-sm font-semibold">MT</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">All fuel types combined</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Latest Arrival</p>
                {historyStats.latestReport ? (
                  <>
                    <p className="text-sm font-bold text-slate-900 mt-1 truncate max-w-[150px]">
                      {historyStats.latestReport.vessel_name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {format(parseISO(historyStats.latestReport.utc_date_time), 'MMM dd, HH:mm')} UTC
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-slate-400 mt-1">No reports logged</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Vessel Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Ship className="w-3.5 h-3.5 text-blue-600" />
                  Vessel:
                </label>
                <select 
                  value={vesselFilter}
                  onChange={(e) => setVesselFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="">All Vessels ({reports.length})</option>
                  {vessels.map(v => {
                    const count = reports.filter(r => String(r.vessel_id) === String(v.id)).length;
                    return (
                      <option key={v.id} value={String(v.id)}>{v.name} ({count})</option>
                    );
                  })}
                </select>
              </div>

              {/* Cargo Status Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cargo:</label>
                <select
                  value={cargoStatusFilter}
                  onChange={(e) => setCargoStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none uppercase"
                >
                  <option value="all">All Statuses</option>
                  <option value="ballast">Ballast</option>
                  <option value="laden">Laden</option>
                </select>
              </div>

              {/* Operation Type Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Operation:</label>
                <select
                  value={operationTypeFilter}
                  onChange={(e) => setOperationTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="all">All Operations</option>
                  <option value="LOADING">Loading</option>
                  <option value="DISCHARGING">Discharging</option>
                  <option value="DISCHARGING AND LOADING">Discharging & Loading</option>
                  <option value="BUNKERING">Bunkering</option>
                  <option value="ANCHORAGE">Anchorage</option>
                  <option value="WAITING FOR BERTH">Waiting for Berth</option>
                  <option value="REPAIRS / DRYDOCK">Repairs / Drydock</option>
                </select>
              </div>

              {/* Search by Date */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Date:
                </label>
                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`px-3 py-1.5 bg-slate-50 border rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer ${
                      dateFilter
                        ? 'border-blue-500 bg-blue-50/60 text-blue-900 pr-7 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                    title="Filter reports by date"
                  />
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => setDateFilter('')}
                      className="absolute right-1.5 p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      title="Clear date filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Reset All Filters Button */}
              {(vesselFilter || cargoStatusFilter !== 'all' || operationTypeFilter !== 'all' || dateFilter || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setVesselFilter('');
                    setCargoStatusFilter('all');
                    setOperationTypeFilter('all');
                    setDateFilter('');
                    setSearchQuery('');
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search date, voyage, port, cargo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
              </span>
            </div>
          </div>

          {/* History Data Table */}
          <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    <th className="px-5 py-3.5 whitespace-nowrap">Date & Vessel</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Arrival Port & Status</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Sea Passage & Position</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Auto-Computed Sea FOC</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Remaining ROB</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Report Doc</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredReports.map(report => {
                    const totalSeaFoc = (
                      Number(report.foc_sea_hsfo || 0) + 
                      Number(report.foc_sea_lsfo || 0) + 
                      Number(report.foc_sea_mgo || 0) + 
                      Number(report.foc_sea_mdo || 0)
                    ).toFixed(2);
                    const vessel = vessels.find(v => Number(v.id) === Number(report.vessel_id));
                    const isHsfoOutside = isFocOutsideLimits(
                      String(report.foc_sea_hsfo), 
                      (report as any).charterer_min_hsfo || vessel?.charterer_min_hsfo, 
                      (report as any).charterer_max_hsfo || vessel?.charterer_max_hsfo
                    );

                    return (
                      <tr 
                        key={report.id} 
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedReportForDetails(report)}
                      >
                        {/* Date & Vessel */}
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-900">
                              <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              {format(parseISO(report.utc_date_time), 'MMM dd, yyyy')}
                              <span className="text-slate-400 font-normal">
                                {format(parseISO(report.utc_date_time), 'HH:mm')} UTC
                              </span>
                            </div>
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                              <span>{report.vessel_name}</span>
                              {report.voyage_number && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-mono font-semibold">
                                  {report.voyage_number}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                report.cargo_status === 'laden' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {report.cargo_status || 'ballast'}
                              </span>
                              {report.operation_type && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {report.operation_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Arrival Port & Status */}
                        <td className="px-5 py-4">
                          <div className="space-y-1 max-w-[190px]">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate" title={report.arrival_port || 'No port'}>
                              <Anchor className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span>{report.arrival_port || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                report.eu_uk_status === 'Yes' 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                EU/UK: {report.eu_uk_status || 'No'}
                              </span>
                              {report.atb_utc && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  ATB: {format(parseISO(report.atb_utc), 'MMM dd, HH:mm')}
                                </span>
                              )}
                            </div>
                            {report.agent_detail && report.agent_detail !== 'FILLIN' && (
                              <div className="text-[10px] text-slate-400 truncate" title={report.agent_detail}>
                                Agt: {report.agent_detail}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Sea Passage & Position */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            {(report.position_lat || report.position_long) ? (
                              <div className="flex items-center gap-1 font-mono text-xs text-slate-700 font-semibold">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                <span>{report.position_lat || '-'} / {report.position_long || '-'}</span>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 font-mono">No coordinates</div>
                            )}
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                              <Navigation className="w-3 h-3 text-blue-500 flex-shrink-0" />
                              <span className="font-medium">Sea:</span>
                              <strong className="font-mono font-bold text-slate-800">{report.total_time_at_sea || '0h'}</strong>
                              <span className="text-slate-300">•</span>
                              <strong className="font-mono font-bold text-blue-700">{report.total_distance ? `${report.total_distance} nm` : '0 nm'}</strong>
                            </div>
                            {report.rob_type && (
                              <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">
                                {report.rob_type}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Auto-Computed Fuel Consumption (Sea) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sea FOC:</span>
                              <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-xs rounded-md shadow-sm">
                                {totalSeaFoc} MT
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span 
                                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                                  isHsfoOutside 
                                    ? 'bg-red-100 text-red-700 border border-red-200' 
                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                }`} 
                                title={isHsfoOutside ? `HSFO Sea FOC outside limit` : 'HSFO Sea FOC within limit'}
                              >
                                HSFO: {report.foc_sea_hsfo ?? '0.00'}
                              </span>
                              {Number(report.foc_sea_lsfo || 0) > 0 && (
                                <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  LSFO: {report.foc_sea_lsfo}
                                </span>
                              )}
                              {(Number(report.foc_sea_mgo || 0) > 0 || Number(report.foc_sea_mdo || 0) > 0) && (
                                <span className="font-mono text-[11px] font-semibold text-slate-500">
                                  {Number(report.foc_sea_mgo || 0) > 0 ? `MGO: ${report.foc_sea_mgo}` : ''}
                                  {Number(report.foc_sea_mgo || 0) > 0 && Number(report.foc_sea_mdo || 0) > 0 ? ' • ' : ''}
                                  {Number(report.foc_sea_mdo || 0) > 0 ? `MDO: ${report.foc_sea_mdo}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Remaining ROB */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="space-y-0.5 font-mono text-xs">
                            <div className="font-bold text-slate-900">
                              HSFO: <span className="text-blue-700">{report.rob_hsfo} MT</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              LSFO: {report.rob_lsfo} • MGO: {report.rob_mgo}
                            </div>
                            {(Number(report.rob_mdo || 0) > 0 || Number(report.rob_fw || 0) > 0) && (
                              <div className="text-[10px] text-slate-400">
                                {Number(report.rob_mdo || 0) > 0 ? `MDO: ${report.rob_mdo} ` : ''}
                                {Number(report.rob_mdo || 0) > 0 && Number(report.rob_fw || 0) > 0 ? '• ' : ''}
                                {Number(report.rob_fw || 0) > 0 ? `FW: ${report.rob_fw} MT` : ''}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Report Doc */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {report.attachment_id ? (
                            <a
                              href={`/api/files/${report.attachment_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-bold transition-colors shadow-xs border border-blue-100"
                              title={`Download: ${report.attachment_name || 'Report Document'}`}
                            >
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate max-w-[120px]">{report.attachment_name || 'View Doc'}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">None</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Full Report Details */}
                            <button
                              type="button"
                              onClick={() => setSelectedReportForDetails(report)}
                              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="View Full Report Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canEditReport(report) && (
                              <button 
                                type="button"
                                onClick={() => handleEdit(report)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                title="Edit Report"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                              <button 
                                type="button"
                                onClick={() => handleDelete(report.id)}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                title="Delete Report"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                          <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Arrival Reports...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No reports found matching your criteria.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Arrival Report Detailed Inspection Modal (Identical architecture to Noon-to-Noon) */}
      <AnimatePresence>
        {selectedReportForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                    <Anchor className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-900">
                        {selectedReportForDetails.vessel_name} - Arrival Report
                      </h3>
                      {selectedReportForDetails.voyage_number && (
                        <span className="px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-md text-xs font-mono font-bold">
                          {selectedReportForDetails.voyage_number}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        selectedReportForDetails.cargo_status === 'laden' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedReportForDetails.cargo_status || 'ballast'}
                      </span>
                      {selectedReportForDetails.operation_type && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {selectedReportForDetails.operation_type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      {format(parseISO(selectedReportForDetails.utc_date_time), 'MMMM dd, yyyy • HH:mm')} UTC
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReportForDetails(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  title="Close inspection"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Port & Sea Passage Status Section */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Anchor className="w-4 h-4 text-blue-600" />
                    Arrival Port & Passage Navigation
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Arrival Port</span>
                      <span className="font-bold text-slate-800 text-sm">{selectedReportForDetails.arrival_port || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">EU / UK Status</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-bold ${
                        selectedReportForDetails.eu_uk_status === 'Yes' 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : 'bg-slate-200/80 text-slate-700'
                      }`}>
                        {selectedReportForDetails.eu_uk_status || 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Event / ROB Type</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">{selectedReportForDetails.rob_type || 'EOSP'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Actual Berthing (ATB)</span>
                      <span className="font-mono font-bold text-blue-700 text-sm">
                        {selectedReportForDetails.atb_utc ? format(parseISO(selectedReportForDetails.atb_utc), 'MMM dd, HH:mm') : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Latitude</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">{selectedReportForDetails.position_lat || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Longitude</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">{selectedReportForDetails.position_long || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Time at Sea</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{selectedReportForDetails.total_time_at_sea || '0h'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Steamed Distance</span>
                      <span className="font-mono font-bold text-blue-700 text-sm">{selectedReportForDetails.total_distance ? `${selectedReportForDetails.total_distance} nm` : '0 nm'}</span>
                    </div>
                  </div>

                  {(selectedReportForDetails.agent_detail || selectedReportForDetails.cargo) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200/60 text-xs">
                      {selectedReportForDetails.agent_detail && selectedReportForDetails.agent_detail !== 'FILLIN' && (
                        <div>
                          <span className="text-slate-400 font-medium">Port Agent Details:</span>{' '}
                          <strong className="text-slate-800">{selectedReportForDetails.agent_detail}</strong>
                        </div>
                      )}
                      {selectedReportForDetails.cargo && (
                        <div>
                          <span className="text-slate-400 font-medium">Cargo Description:</span>{' '}
                          <strong className="text-slate-800">{selectedReportForDetails.cargo}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Auto-Computed Fuel Statistics & ROB Section */}
                <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-blue-600" />
                      Fuel Statistics & Auto-Computed Sea Consumption
                    </h4>
                    <span className="px-2.5 py-1 bg-blue-600 text-white font-mono font-bold text-xs rounded-lg shadow-sm">
                      Total Sea FOC: {(
                        Number(selectedReportForDetails.foc_sea_hsfo || 0) + 
                        Number(selectedReportForDetails.foc_sea_lsfo || 0) + 
                        Number(selectedReportForDetails.foc_sea_mgo || 0) + 
                        Number(selectedReportForDetails.foc_sea_mdo || 0)
                      ).toFixed(2)} MT
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs bg-white rounded-xl border border-blue-100 overflow-hidden">
                      <thead className="bg-blue-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Fuel Type</th>
                          <th className="px-4 py-2.5">Auto-Computed Sea FOC</th>
                          <th className="px-4 py-2.5">Arrival ROB</th>
                          <th className="px-4 py-2.5">Charterer Threshold</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-50">
                        {(() => {
                          const v = vessels.find(item => Number(item.id) === Number(selectedReportForDetails.vessel_id));
                          const fuels = [
                            { 
                              label: 'HSFO', 
                              foc: selectedReportForDetails.foc_sea_hsfo, 
                              rob: selectedReportForDetails.rob_hsfo, 
                              min: (selectedReportForDetails as any).charterer_min_hsfo || v?.charterer_min_hsfo, 
                              max: (selectedReportForDetails as any).charterer_max_hsfo || v?.charterer_max_hsfo 
                            },
                            { 
                              label: 'LSFO', 
                              foc: selectedReportForDetails.foc_sea_lsfo, 
                              rob: selectedReportForDetails.rob_lsfo, 
                              min: (selectedReportForDetails as any).charterer_min_lsfo || v?.charterer_min_lsfo, 
                              max: (selectedReportForDetails as any).charterer_max_lsfo || v?.charterer_max_lsfo 
                            },
                            { 
                              label: 'MGO', 
                              foc: selectedReportForDetails.foc_sea_mgo, 
                              rob: selectedReportForDetails.rob_mgo, 
                              min: (selectedReportForDetails as any).charterer_min_mgo || v?.charterer_min_mgo, 
                              max: (selectedReportForDetails as any).charterer_max_mgo || v?.charterer_max_mgo 
                            },
                            { 
                              label: 'MDO', 
                              foc: selectedReportForDetails.foc_sea_mdo, 
                              rob: selectedReportForDetails.rob_mdo, 
                              min: (selectedReportForDetails as any).charterer_min_mdo || v?.charterer_min_mdo, 
                              max: (selectedReportForDetails as any).charterer_max_mdo || v?.charterer_max_mdo 
                            }
                          ];

                          return fuels.map(fuel => {
                            const isOutside = isFocOutsideLimits(String(fuel.foc), fuel.min, fuel.max);
                            return (
                              <tr key={fuel.label} className="hover:bg-slate-50/60">
                                <td className="px-4 py-2.5 font-bold text-slate-800">{fuel.label}</td>
                                <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                                  {fuel.foc ? `${fuel.foc} MT` : '0.00 MT'}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-slate-700">
                                  {fuel.rob ?? 0} MT
                                </td>
                                <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                                  {fuel.min || fuel.max ? `${fuel.min || 0} - ${fuel.max || '∞'}` : 'N/A'}
                                </td>
                                <td className="px-4 py-2.5">
                                  {fuel.min || fuel.max ? (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isOutside 
                                        ? 'bg-red-100 text-red-700' 
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {isOutside ? 'Exceeded' : 'Within Limits'}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fresh Water & Technical Data Section */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-blue-600" />
                    Fresh Water & Passage Performance
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Fresh Water ROB</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {selectedReportForDetails.rob_fw ? `${selectedReportForDetails.rob_fw} MT` : '0 MT'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Steaming Time</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {selectedReportForDetails.total_time_at_sea || '0h'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Passage Distance</span>
                      <span className="font-mono font-bold text-blue-700 text-sm">
                        {selectedReportForDetails.total_distance ? `${selectedReportForDetails.total_distance} nm` : '0 nm'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attached Document Section */}
                {selectedReportForDetails.attachment_id && (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Attached Arrival Documentation
                    </h4>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {selectedReportForDetails.attachment_name || 'Arrival Report Attachment'}
                          </p>
                          <p className="text-[11px] text-slate-400">Attached file verification</p>
                        </div>
                      </div>
                      <a
                        href={`/api/files/${selectedReportForDetails.attachment_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedReportForDetails(null)}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close Inspection
                </button>
                {canEditReport(selectedReportForDetails) && (
                  <button
                    type="button"
                    onClick={() => {
                      const rep = selectedReportForDetails;
                      setSelectedReportForDetails(null);
                      handleEdit(rep);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit This Report
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

