import React, { useState, useEffect } from "react";
import { 
  Ship, Calendar, Plus, Upload, MessageSquare, Search, Filter, 
  RotateCcw, Check, CheckCircle2, Clock, Trash2, File as FileIcon, X, ChevronDown, ArrowUp, 
  ArrowDown, ArrowLeft, ArrowUpDown, AlertCircle, RefreshCw, MapPin, 
  Activity, Anchor, Download, Droplets, Fuel, Info, FileText, Edit2
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
                    <th className="px-6 py-4">Arr. Port</th>
                    <th className="px-6 py-4">EU/UK Status</th>
                    <th className="px-6 py-4">Operation</th>
                    <th className="px-6 py-4">Event Type</th>
                    <th className="px-6 py-4">HSFO ROB</th>
                    <th className="px-6 py-4">Sea FOC (HSFO)</th>
                    <th className="px-6 py-4">Report Doc</th>
                    <th className="px-6 py-4 text-right">Actions</th>
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
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">
                          {report.operation_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">{report.rob_type}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">{report.rob_hsfo}</td>
                      <td className="px-6 py-4 font-mono font-bold text-blue-700">{report.foc_sea_hsfo}</td>
                      <td className="px-6 py-4">
                        {report.attachment_id ? (
                          <a
                            href={`/api/files/${report.attachment_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-bold transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{report.attachment_name || 'View Doc'}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
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
                      <td colSpan={11} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                          <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Arrival Reports...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-slate-400 font-medium">
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

