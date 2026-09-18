import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Ship, Calendar, Plus, Upload, MessageSquare, Search, Filter, 
  RotateCcw, Check, CheckCircle2, CheckSquare, Clock, Trash2, File as FileIcon, X, Eye, 
  ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowUpDown, AlertCircle, 
  RefreshCw, MapPin, Activity, Anchor, Download, Droplets, Waves, 
  Camera, Image, Fuel, Info, Edit2, FileText, Compass, Wind, Gauge, BarChart2, CheckCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, parseISO } from "date-fns";
import { cn, isFocOutsideLimits, isGeminiSupportedMimeType, MAX_FILE_SIZE } from "../utils/helpers";
import { ImageViewer } from "./ImageViewer";
import { User, Vessel, NoonReport } from "../types";

export const NoonToNoonView = ({ user, token, vessels, reports, onRefresh, notify, isLoading }: { 
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
  const initialVesselId = String(user.vessel_id || (vessels[0]?.id ? String(vessels[0].id) : ''));
  const initialVessel = vessels.find(v => String(v.id) === initialVesselId);
  const defaultForm = {
    vessel_id: initialVesselId,
    utc_date_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    position_long: '',
    position_lat: '',
    distance_to_go: '',
    cargo_status: 'ballast',
    report_type: (initialVessel?.route_status === 'At Anchor' || initialVessel?.route_status === 'Anchor') ? 'Anchorage' :
                 (initialVessel?.route_status === 'In Port' || initialVessel?.route_status === 'In port') ? 'At port' :
                 (initialVessel?.route_status || 'At sea'),
    rob_hsfo: '0',
    rob_lsfo: '0',
    rob_mgo: '0',
    rob_mdo: '0',
    voyage_number: '',
    weather_notation: '',
    weather_direction: '',
    swell_scale_21: '',
    wind_scale: '',
    wave_scale: '',
    weather_image: '',
    remarks: '',
    destination_port: initialVessel?.next_port || '',
    eta_utc: initialVessel?.eta_atb ? initialVessel.eta_atb.replace(' ', 'T').substring(0, 16) : '',
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

  const handleVesselChange = (newVesselId: string) => {
    const v = vessels.find(x => String(x.id) === newVesselId);
    setForm(prev => ({
      ...prev,
      vessel_id: newVesselId,
      ...(!editingId ? {
        destination_port: v?.next_port || '',
        eta_utc: v?.eta_atb ? v.eta_atb.replace(' ', 'T').substring(0, 16) : '',
        report_type: (v?.route_status === 'At Anchor' || v?.route_status === 'Anchor') ? 'Anchorage' :
                     (v?.route_status === 'In Port' || v?.route_status === 'In port') ? 'At port' :
                     (v?.route_status || 'At sea')
      } : {})
    }));
  };
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [vesselFilter, setVesselFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cargoStatusFilter, setCargoStatusFilter] = useState<string>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all');
  const [selectedReportForDetails, setSelectedReportForDetails] = useState<NoonReport | null>(null);
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
    return reports.filter(r => {
      if (vesselFilter !== '' && String(r.vessel_id) !== vesselFilter) return false;
      if (cargoStatusFilter !== 'all' && r.cargo_status?.toLowerCase() !== cargoStatusFilter.toLowerCase()) return false;
      if (reportTypeFilter !== 'all' && r.report_type?.toLowerCase() !== reportTypeFilter.toLowerCase()) return false;
      if (dateFilter) {
        let matchesExactDate = false;
        if (r.utc_date_time) {
          if (r.utc_date_time.startsWith(dateFilter)) {
            matchesExactDate = true;
          } else {
            try {
              const parsed = parseISO(r.utc_date_time);
              if (!isNaN(parsed.getTime())) {
                matchesExactDate = format(parsed, 'yyyy-MM-dd') === dateFilter;
              }
            } catch {
              matchesExactDate = r.utc_date_time.slice(0, 10) === dateFilter;
            }
          }
        }
        if (!matchesExactDate) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesVoyage = r.voyage_number?.toLowerCase().includes(q);
        const matchesPort = r.destination_port?.toLowerCase().includes(q);
        const matchesRemarks = r.remarks?.toLowerCase().includes(q);
        const matchesAgent = r.agent_details?.toLowerCase().includes(q);
        const matchesWeather = r.weather_notation?.toLowerCase().includes(q) || r.weather_direction?.toLowerCase().includes(q);
        const matchesVessel = r.vessel_name?.toLowerCase().includes(q);
        const matchesReportType = r.report_type?.toLowerCase().includes(q);

        let matchesDate = false;
        if (r.utc_date_time) {
          try {
            const parsed = parseISO(r.utc_date_time);
            if (!isNaN(parsed.getTime())) {
              const d1 = format(parsed, 'yyyy-MM-dd');
              const d2 = format(parsed, 'MMM dd, yyyy').toLowerCase();
              const d3 = format(parsed, 'MMMM dd, yyyy').toLowerCase();
              const d4 = format(parsed, 'MMM dd').toLowerCase();
              const d5 = format(parsed, 'dd MMM yyyy').toLowerCase();
              const d6 = format(parsed, 'yyyy-MM').toLowerCase();
              matchesDate = d1.includes(q) || d2.includes(q) || d3.includes(q) || d4.includes(q) || d5.includes(q) || d6.includes(q);
            }
          } catch {
            // fallback
          }
          if (!matchesDate) {
            matchesDate = r.utc_date_time.toLowerCase().includes(q);
          }
        }

        if (!matchesVoyage && !matchesPort && !matchesRemarks && !matchesAgent && !matchesWeather && !matchesVessel && !matchesDate && !matchesReportType) {
          return false;
        }
      }
      return true;
    });
  }, [reports, vesselFilter, cargoStatusFilter, reportTypeFilter, dateFilter, searchQuery]);

  const historyStats = React.useMemo(() => {
    if (!filteredReports || filteredReports.length === 0) {
      return { totalReports: 0, avgHsfo: '0.00', avgTotalFoc: '0.00', latestReport: null };
    }
    let totalHsfo = 0;
    let totalAllFoc = 0;
    filteredReports.forEach(r => {
      const h = Number(r.foc_hsfo || 0);
      const l = Number(r.foc_lsfo || 0);
      const mg = Number(r.foc_mgo || 0);
      const md = Number(r.foc_mdo || 0);
      totalHsfo += h;
      totalAllFoc += (h + l + mg + md);
    });
    const avgHsfo = (totalHsfo / filteredReports.length).toFixed(2);
    const avgTotalFoc = (totalAllFoc / filteredReports.length).toFixed(2);
    const sorted = [...filteredReports].sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime());
    return {
      totalReports: filteredReports.length,
      avgHsfo,
      avgTotalFoc,
      latestReport: sorted[0] || null
    };
  }, [filteredReports]);

  const foc_computation = React.useMemo(() => {
    // If no reports yet, we can't auto compute FOC relative to previous ROB
    if (!reports || reports.length === 0) {
      return { hsfo: '0.00', lsfo: '0.00', mgo: '0.00', mdo: '0.00', total: '0.00', baselineDate: null };
    }
    
    // Sort reports by date to find the previous one for THIS vessel
    const currentFormTime = form.utc_date_time ? new Date(form.utc_date_time).getTime() : Date.now();
    const vesselReports = reports
      .filter(r => String(r.vessel_id) === String(form.vessel_id) && r.id !== editingId)
      .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime());
    
    // Prioritize report strictly before the current report timestamp
    let prev = vesselReports.find(r => new Date(r.utc_date_time).getTime() < currentFormTime);
    if (!prev && vesselReports.length > 0) {
      prev = vesselReports[0];
    }
    
    if (!prev) {
      return { hsfo: '0.00', lsfo: '0.00', mgo: '0.00', mdo: '0.00', total: '0.00', baselineDate: null };
    }
    
    const current = {
      hsfo: parseFloat(form.rob_hsfo) || 0,
      lsfo: parseFloat(form.rob_lsfo) || 0,
      mgo: parseFloat(form.rob_mgo) || 0,
      mdo: parseFloat(form.rob_mdo) || 0,
    };
    
    const hsfo = Math.max(0, Number(prev.rob_hsfo || 0) - current.hsfo).toFixed(2);
    const lsfo = Math.max(0, Number(prev.rob_lsfo || 0) - current.lsfo).toFixed(2);
    const mgo = Math.max(0, Number(prev.rob_mgo || 0) - current.mgo).toFixed(2);
    const mdo = Math.max(0, Number(prev.rob_mdo || 0) - current.mdo).toFixed(2);
    const total = (parseFloat(hsfo) + parseFloat(lsfo) + parseFloat(mgo) + parseFloat(mdo)).toFixed(2);

    return {
      hsfo,
      lsfo,
      mgo,
      mdo,
      total,
      baselineDate: prev.utc_date_time,
      prevRob: {
        hsfo: prev.rob_hsfo,
        lsfo: prev.rob_lsfo,
        mgo: prev.rob_mgo,
        mdo: prev.rob_mdo,
      }
    };
  }, [form.rob_hsfo, form.rob_lsfo, form.rob_mgo, form.rob_mdo, form.vessel_id, form.utc_date_time, reports, editingId]);

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
          formData.append(key, String(val ?? ''));
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
      report_type: report.report_type || 'At sea',
      rob_hsfo: String(report.rob_hsfo),
      rob_lsfo: String(report.rob_lsfo),
      rob_mgo: String(report.rob_mgo),
      rob_mdo: String(report.rob_mdo),
      weather_notation: report.weather_notation || '',
      weather_direction: report.weather_direction || '',
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
                        onChange={(e) => handleVesselChange(e.target.value)}
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Report Type <span className="text-[10px] text-blue-500 font-normal lowercase">(syncs navigational status)</span>
                    </label>
                    <select 
                      value={form.report_type}
                      onChange={(e) => setForm({ ...form, report_type: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="At sea">At sea</option>
                      <option value="At port">At port</option>
                      <option value="Anchorage">Anchorage</option>
                      <option value="Drifting">Drifting</option>
                      <option value="Transiting">Transiting</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Destination Port <span className="text-[10px] text-blue-500 font-normal lowercase">(updates current route)</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Singapore"
                      value={form.destination_port}
                      onChange={(e) => setForm({ ...form, destination_port: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      ETA (UTC) <span className="text-[10px] text-blue-500 font-normal lowercase">(updates current route)</span>
                    </label>
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
                      const isOutside = isFocOutsideLimits(computedFoc, (form as any)[`charterer_min_${f.key}`], (form as any)[`charterer_max_${f.key}`]);
                      return (
                        <div key={f.key} className="grid grid-cols-12 gap-3 items-center bg-white p-2.5 rounded-xl border border-blue-100">
                          <div className="col-span-3">
                            <span className="text-sm font-bold text-slate-800">{f.label}</span>
                            {(form as any)[`charterer_min_${f.key}`] || (form as any)[`charterer_max_${f.key}`] ? (
                              <span className="block text-[10px] text-slate-400 font-medium">
                                Threshold: {(form as any)[`charterer_min_${f.key}`] || 0} - {(form as any)[`charterer_max_${f.key}`] || '∞'}
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
                    <div className="text-[11px] text-slate-500 font-medium italic pt-1 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>Auto-computed consumption is recorded directly in database and retrievable in the History tab.</span>
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
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-blue-600" />
                  Weather & Environmental Conditions
                </h4>
                <span className="text-xs font-medium text-slate-400">Record atmospheric, wind, and sea conditions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Weather Notation dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Weather Notation</label>
                  <select
                    value={form.weather_notation}
                    onChange={(e) => setForm({ ...form, weather_notation: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select Notation</option>
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

                {/* Wind Direction input box */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    Wind Direction
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="noon-wind-directions"
                      placeholder="e.g. NE, 045°, ESE"
                      value={form.weather_direction || ''}
                      onChange={(e) => setForm({ ...form, weather_direction: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase"
                    />
                    <datalist id="noon-wind-directions">
                      <option value="N">North (N)</option>
                      <option value="NNE">North-Northeast (NNE)</option>
                      <option value="NE">Northeast (NE)</option>
                      <option value="ENE">East-Northeast (ENE)</option>
                      <option value="E">East (E)</option>
                      <option value="ESE">East-Southeast (ESE)</option>
                      <option value="SE">Southeast (SE)</option>
                      <option value="SSE">South-Southeast (SSE)</option>
                      <option value="S">South (S)</option>
                      <option value="SSW">South-Southwest (SSW)</option>
                      <option value="SW">Southwest (SW)</option>
                      <option value="WSW">West-Southwest (WSW)</option>
                      <option value="W">West (W)</option>
                      <option value="WNW">West-Northwest (WNW)</option>
                      <option value="NW">Northwest (NW)</option>
                      <option value="NNW">North-Northwest (NNW)</option>
                      <option value="VARIABLE">Variable</option>
                    </datalist>
                  </div>
                </div>

                {/* Beaufort Scale dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-blue-600" />
                    Beaufort Scale
                  </label>
                  <select
                    value={form.wind_scale}
                    onChange={(e) => setForm({ ...form, wind_scale: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select Beaufort</option>
                    <option value="BF 0 - Calm (0~0.2 m/s)">BF 0 - Calm (0~0.2 m/s)</option>
                    <option value="BF 1 - Light Air (0.3~1.5 m/s)">BF 1 - Light Air (0.3~1.5 m/s)</option>
                    <option value="BF 2 - Light Breeze (1.6~3.3 m/s)">BF 2 - Light Breeze (1.6~3.3 m/s)</option>
                    <option value="BF 3 - Gentle Breeze (3.4~5.4 m/s)">BF 3 - Gentle Breeze (3.4~5.4 m/s)</option>
                    <option value="BF 4 - Moderate Breeze (5.5~7.9 m/s)">BF 4 - Moderate Breeze (5.5~7.9 m/s)</option>
                    <option value="BF 5 - Fresh Breeze (8.0~10.7 m/s)">BF 5 - Fresh Breeze (8.0~10.7 m/s)</option>
                    <option value="BF 6 - Strong Breeze (10.8~13.8 m/s)">BF 6 - Strong Breeze (10.8~13.8 m/s)</option>
                    <option value="BF 7 - Near Gale (13.9~17.1 m/s)">BF 7 - Near Gale (13.9~17.1 m/s)</option>
                    <option value="BF 8 - Gale (17.2~20.7 m/s)">BF 8 - Gale (17.2~20.7 m/s)</option>
                    <option value="BF 9 - Strong Gale (20.8~24.4 m/s)">BF 9 - Strong Gale (20.8~24.4 m/s)</option>
                    <option value="BF 10 - Storm (24.5~28.4 m/s)">BF 10 - Storm (24.5~28.4 m/s)</option>
                    <option value="BF 11 - Violent Storm (28.5~32.6 m/s)">BF 11 - Violent Storm (28.5~32.6 m/s)</option>
                    <option value="BF 12 - Hurricane (>=32.7 m/s)">BF 12 - Hurricane (&ge;32.7 m/s)</option>
                  </select>
                </div>

                {/* Swell Scale21 dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Swell Scale</label>
                  <select
                    value={form.swell_scale_21}
                    onChange={(e) => setForm({ ...form, swell_scale_21: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select Swell Scale</option>
                    <option value="No Swell">No Swell</option>
                    <option value="Low Swell - Short or Average">Low Swell - Short/Avg</option>
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

                {/* Wave Scale dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Wave Scale</label>
                  <select
                    value={form.wave_scale}
                    onChange={(e) => setForm({ ...form, wave_scale: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg Daily HSFO FOC</p>
                <p className="text-2xl font-black text-blue-700 mt-1 font-mono">{historyStats.avgHsfo} <span className="text-sm font-semibold">MT</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">Computed 24h average</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Fuel className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg Total Daily FOC</p>
                <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{historyStats.avgTotalFoc} <span className="text-sm font-semibold">MT</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">All fuel types combined</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Latest Report</p>
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

              {/* Report Type Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Type:</label>
                <select
                  value={reportTypeFilter}
                  onChange={(e) => setReportTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="At sea">At sea</option>
                  <option value="At port">At port</option>
                  <option value="Anchorage">Anchorage</option>
                  <option value="Drifting">Drifting</option>
                  <option value="Transiting">Transiting</option>
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
              {(vesselFilter || cargoStatusFilter !== 'all' || reportTypeFilter !== 'all' || dateFilter || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setVesselFilter('');
                    setCargoStatusFilter('all');
                    setReportTypeFilter('all');
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
                  placeholder="Search date, voyage, port, weather..."
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
                    <th className="px-5 py-3.5 whitespace-nowrap">Position & DTG</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Route & ETA (UTC)</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Weather & Wind Direction</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Auto-Computed FOC (24h)</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">ROB On Board</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredReports.map(report => {
                    const totalFoc = (
                      Number(report.foc_hsfo || 0) + 
                      Number(report.foc_lsfo || 0) + 
                      Number(report.foc_mgo || 0) + 
                      Number(report.foc_mdo || 0)
                    ).toFixed(2);
                    const isHsfoOutside = isFocOutsideLimits(String(report.foc_hsfo), report.charterer_min_hsfo, report.charterer_max_hsfo);

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
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
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
                                {report.cargo_status}
                              </span>
                              {report.report_type && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {report.report_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Position & DTG */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 font-mono text-xs text-slate-700 font-semibold">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                              <span>{report.position_lat} / {report.position_long}</span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <span className="font-medium">DTG:</span>
                              <strong className="font-mono font-bold text-slate-800">{report.distance_to_go} nm</strong>
                            </div>
                          </div>
                        </td>

                        {/* Route & ETA */}
                        <td className="px-5 py-4">
                          <div className="space-y-1 max-w-[180px]">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate" title={report.destination_port || 'No destination'}>
                              <Anchor className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span>{report.destination_port || '-'}</span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              ETA: {report.eta_utc ? format(parseISO(report.eta_utc), 'MMM dd, HH:mm') : '-'}
                            </div>
                            {report.agent_details && (
                              <div className="text-[10px] text-slate-400 truncate" title={report.agent_details}>
                                Agt: {report.agent_details}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Weather & Direction */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {report.weather_image && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage(report.weather_image || null);
                                }}
                                className="relative group/img flex-shrink-0 cursor-pointer"
                                title="Click to view full photo"
                              >
                                <img 
                                  src={report.weather_image} 
                                  className="w-10 h-10 object-cover rounded-lg border border-slate-200 group-hover/img:border-blue-500 transition-all shadow-sm"
                                  alt="Weather thumbnail"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/10 group-hover/img:bg-black/0 rounded-lg transition-all" />
                              </button>
                            )}
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {report.weather_notation ? (
                                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px]" title={report.weather_notation}>
                                    {report.weather_notation}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                                
                                {/* Wind Direction Badge */}
                                {report.weather_direction && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-bold tracking-wide" title={`Wind Direction: ${report.weather_direction}`}>
                                    <Compass className="w-3 h-3 text-blue-600" />
                                    {report.weather_direction}
                                  </span>
                                )}
                              </div>
                              {(report.wind_scale || report.swell_scale_21) && (
                                <div className="text-[10px] text-slate-500 font-medium">
                                  {report.wind_scale ? report.wind_scale.split(' - ')[0] : ''}
                                  {report.wind_scale && report.swell_scale_21 ? ' • ' : ''}
                                  {report.swell_scale_21 ? report.swell_scale_21.split(' - ')[0] : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Auto-Computed Fuel Consumption (FOC) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total FOC:</span>
                              <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-xs rounded-md shadow-sm">
                                {totalFoc} MT
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span 
                                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                                  isHsfoOutside 
                                    ? 'bg-red-100 text-red-700 border border-red-200' 
                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                }`} 
                                title={isHsfoOutside ? `HSFO FOC outside limit (${report.charterer_min_hsfo || '0'} - ${report.charterer_max_hsfo || '∞'})` : 'HSFO FOC within limit'}
                              >
                                HSFO: {report.foc_hsfo ?? '0.00'}
                              </span>
                              {Number(report.foc_lsfo || 0) > 0 && (
                                <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  LSFO: {report.foc_lsfo}
                                </span>
                              )}
                              {(Number(report.foc_mgo || 0) > 0 || Number(report.foc_mdo || 0) > 0) && (
                                <span className="font-mono text-[11px] font-semibold text-slate-500">
                                  {Number(report.foc_mgo || 0) > 0 ? `MGO: ${report.foc_mgo}` : ''}
                                  {Number(report.foc_mgo || 0) > 0 && Number(report.foc_mdo || 0) > 0 ? ' • ' : ''}
                                  {Number(report.foc_mdo || 0) > 0 ? `MDO: ${report.foc_mdo}` : ''}
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
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setSelectedReportForDetails(report)}
                              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="View Full Report Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Scanned Report Attachment */}
                            {report.attachment_id && (
                              <a 
                                href={new URL(`/api/noon-attachments/${report.attachment_id}?token=${token}`, window.location.href).href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                title={report.attachment_name ? `Download ${report.attachment_name}` : "Download Scanned Report"}
                              >
                                <FileText className="w-4 h-4" />
                              </a>
                            )}

                            {/* Edit */}
                            {canEditReport(report) && (
                              <button 
                                onClick={() => handleEdit(report)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                title="Edit Report"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete */}
                            {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
                              <button 
                                onClick={() => handleDelete(report.id)}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
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
                          <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Noon to Noon Reports...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Activity className="w-8 h-8 text-slate-300" />
                          <p className="text-sm font-bold text-slate-700">No matching noon reports found</p>
                          <p className="text-xs text-slate-400">Try adjusting your filters or search terms.</p>
                          {(vesselFilter || cargoStatusFilter !== 'all' || dateFilter || searchQuery) && (
                            <button
                              onClick={() => {
                                setVesselFilter('');
                                setCargoStatusFilter('all');
                                setDateFilter('');
                                setSearchQuery('');
                              }}
                              className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                            >
                              Reset all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Report Details Modal */}
      {selectedReportForDetails && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="relative bg-white max-w-3xl w-full rounded-3xl shadow-2xl border border-blue-100 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Ship className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-bold">{selectedReportForDetails.vessel_name}</h3>
                  {selectedReportForDetails.voyage_number && (
                    <span className="px-2.5 py-0.5 bg-slate-800 text-blue-300 rounded-lg text-xs font-mono font-bold">
                      {selectedReportForDetails.voyage_number}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    selectedReportForDetails.cargo_status === 'laden' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-amber-500 text-white'
                  }`}>
                    {selectedReportForDetails.cargo_status}
                  </span>
                  {selectedReportForDetails.report_type && (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-indigo-600 text-white">
                      {selectedReportForDetails.report_type}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(parseISO(selectedReportForDetails.utc_date_time), 'EEEE, MMMM dd, yyyy • HH:mm')} UTC
                </p>
              </div>

              <div className="flex items-center gap-2">
                {canEditReport(selectedReportForDetails) && (
                  <button
                    onClick={() => {
                      const rep = selectedReportForDetails;
                      setSelectedReportForDetails(null);
                      handleEdit(rep);
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl transition-all"
                    title="Edit Report"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedReportForDetails(null)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Navigation & Position Section */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Navigation & Route Status
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Latitude</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{selectedReportForDetails.position_lat}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Longitude</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{selectedReportForDetails.position_long}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Distance To Go</span>
                    <span className="font-mono font-bold text-blue-700 text-sm">{selectedReportForDetails.distance_to_go} nm</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Report Type</span>
                    <span className="font-bold text-indigo-700 text-sm">{selectedReportForDetails.report_type || 'At sea'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Destination</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedReportForDetails.destination_port || '-'}</span>
                  </div>
                </div>

                {(selectedReportForDetails.eta_utc || selectedReportForDetails.agent_details) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200/60 text-xs">
                    {selectedReportForDetails.eta_utc && (
                      <div>
                        <span className="text-slate-400 font-medium">Estimated Arrival (ETA):</span>{' '}
                        <strong className="font-mono text-slate-800">
                          {format(parseISO(selectedReportForDetails.eta_utc), 'MMM dd, yyyy • HH:mm')} UTC
                        </strong>
                      </div>
                    )}
                    {selectedReportForDetails.agent_details && (
                      <div>
                        <span className="text-slate-400 font-medium">Port Agent:</span>{' '}
                        <strong className="text-slate-800">{selectedReportForDetails.agent_details}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Auto-Computed Fuel Statistics & ROB Section */}
              <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-600" />
                    Fuel Statistics & Auto-Computed 24h Consumption
                  </h4>
                  <span className="px-2.5 py-1 bg-blue-600 text-white font-mono font-bold text-xs rounded-lg shadow-sm">
                    Total FOC: {(
                      Number(selectedReportForDetails.foc_hsfo || 0) + 
                      Number(selectedReportForDetails.foc_lsfo || 0) + 
                      Number(selectedReportForDetails.foc_mgo || 0) + 
                      Number(selectedReportForDetails.foc_mdo || 0)
                    ).toFixed(2)} MT
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs bg-white rounded-xl border border-blue-100 overflow-hidden">
                    <thead className="bg-blue-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Fuel Type</th>
                        <th className="px-4 py-2.5">Auto-Computed 24h FOC</th>
                        <th className="px-4 py-2.5">Remaining ROB</th>
                        <th className="px-4 py-2.5">Charterer Threshold</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {[
                        { 
                          label: 'HSFO', 
                          foc: selectedReportForDetails.foc_hsfo, 
                          rob: selectedReportForDetails.rob_hsfo, 
                          min: selectedReportForDetails.charterer_min_hsfo, 
                          max: selectedReportForDetails.charterer_max_hsfo 
                        },
                        { 
                          label: 'LSFO', 
                          foc: selectedReportForDetails.foc_lsfo, 
                          rob: selectedReportForDetails.rob_lsfo, 
                          min: selectedReportForDetails.charterer_min_lsfo, 
                          max: selectedReportForDetails.charterer_max_lsfo 
                        },
                        { 
                          label: 'MGO', 
                          foc: selectedReportForDetails.foc_mgo, 
                          rob: selectedReportForDetails.rob_mgo, 
                          min: selectedReportForDetails.charterer_min_mgo, 
                          max: selectedReportForDetails.charterer_max_mgo 
                        },
                        { 
                          label: 'MDO', 
                          foc: selectedReportForDetails.foc_mdo, 
                          rob: selectedReportForDetails.rob_mdo, 
                          min: selectedReportForDetails.charterer_min_mdo, 
                          max: selectedReportForDetails.charterer_max_mdo 
                        }
                      ].map(fuel => {
                        const isOutside = isFocOutsideLimits(String(fuel.foc), fuel.min, fuel.max);
                        return (
                          <tr key={fuel.label} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 font-bold text-slate-800">{fuel.label}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                              {fuel.foc ? `${fuel.foc} MT` : '0.00 MT'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-700">
                              {fuel.rob} MT
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
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Weather & Environmental Conditions Section */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Waves className="w-4 h-4 text-blue-600" />
                  Weather & Environmental Conditions
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Weather Notation</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedReportForDetails.weather_notation || '-'}</span>
                  </div>

                  {/* Wind Direction with Compass */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-blue-600" />
                      Wind Direction
                    </span>
                    {selectedReportForDetails.weather_direction ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold mt-0.5" title="Wind Direction">
                        <Compass className="w-3.5 h-3.5" />
                        {selectedReportForDetails.weather_direction}
                      </span>
                    ) : (
                      <span className="font-medium text-slate-400 text-sm">-</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5 text-blue-600" />
                      Beaufort Scale
                    </span>
                    <span className="font-medium text-slate-800 text-xs">{selectedReportForDetails.wind_scale || '-'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Swell / Wave</span>
                    <span className="font-medium text-slate-800 text-xs">
                      {selectedReportForDetails.swell_scale_21 || '-'} 
                      {selectedReportForDetails.wave_scale ? ` / ${selectedReportForDetails.wave_scale}` : ''}
                    </span>
                  </div>
                </div>

                {selectedReportForDetails.weather_image && (
                  <div className="mt-4 pt-3 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Weather Photo</span>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(selectedReportForDetails.weather_image || null)}
                      className="group inline-flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 hover:border-blue-500 transition-all text-left"
                    >
                      <img 
                        src={selectedReportForDetails.weather_image} 
                        className="w-16 h-16 object-cover rounded-lg shadow-sm" 
                        alt="Weather condition snapshot" 
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Click to view full snapshot</p>
                        <p className="text-[10px] text-slate-400">Captured at noon UTC</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Remarks & Scanned Attachment */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    Master & Engineer Remarks
                  </h4>
                  <p className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-200/60 whitespace-pre-wrap">
                    {selectedReportForDetails.remarks || 'No remarks provided for this report.'}
                  </p>
                </div>

                {selectedReportForDetails.attachment_id && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Scanned ROB Document
                    </h4>
                    <a 
                      href={new URL(`/api/noon-attachments/${selectedReportForDetails.attachment_id}?token=${token}`, window.location.href).href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      {selectedReportForDetails.attachment_name || 'Download Scanned Report'}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-400 font-medium">
                Report ID: #{selectedReportForDetails.id}
              </span>
              <button
                type="button"
                onClick={() => setSelectedReportForDetails(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Snapshot Image Preview */}
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

