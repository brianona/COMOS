import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Ship, Calendar, Plus, Upload, MessageSquare, Search, Filter, 
  RotateCcw, Check, CheckCircle2, CheckSquare, Clock, Trash2, File as FileIcon, X, Eye, 
  ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowUpDown, AlertCircle, 
  RefreshCw, MapPin, Activity, Anchor, Download, Droplets, Waves, 
  Camera, Image, Fuel, Info, Edit2, FileText
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
  const defaultForm = {
    vessel_id: String(user.vessel_id || (vessels[0]?.id ? String(vessels[0].id) : '')),
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

                {/* Beaufort Scale dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Beaufort Scale</label>
                  <select
                    value={form.wind_scale}
                    onChange={(e) => setForm({ ...form, wind_scale: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="">Select Beaufort Scale</option>
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
                                {report.swell_scale_21 ? ` &bull; ${report.swell_scale_21.split(' ')[0]}` : ''}
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

