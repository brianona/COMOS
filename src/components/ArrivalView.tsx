import React, { useState, useEffect } from "react";
import { 
  Ship, Calendar, Plus, Upload, MessageSquare, Search, Filter, 
  RotateCcw, Check, CheckCircle, CheckCircle2, Clock, Trash2, File as FileIcon, X, ChevronDown, ArrowUp, 
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

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => vesselFilter === '' || String(r.vessel_id) === vesselFilter);
  }, [reports, vesselFilter]);

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

