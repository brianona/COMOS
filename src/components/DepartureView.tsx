import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Send, 
  Search, 
  History, 
  PlusCircle, 
  Download, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  CheckCircle2, 
  Ship, 
  Anchor, 
  Compass, 
  Calendar, 
  Clock, 
  MapPin, 
  Fuel, 
  X,
  Upload,
  RefreshCw,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

interface Vessel {
  id: number;
  name: string;
  team_id?: number;
  team_name?: string;
  has_photo?: boolean;
}

interface User {
  id: number;
  username: string;
  role: string;
  vessel_id?: number;
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

interface DepartureViewProps {
  user: User;
  token: string;
  vessels: Vessel[];
  reports: DepartureReport[];
  onRefresh: () => void;
  notify: (type: 'success' | 'error', message: string) => void;
  isLoading?: boolean;
}

export const DepartureView: React.FC<DepartureViewProps> = ({
  user,
  token,
  vessels,
  reports,
  onRefresh,
  notify,
  isLoading
}) => {
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [vesselFilter, setVesselFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const defaultForm = {
    vessel_id: String(user.vessel_id || (vessels[0]?.id ? String(vessels[0].id) : '')),
    voyage_number: '',
    utc_date_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    departure_port: '',
    eu_uk_status: 'No',
    position_long: '',
    position_lat: '',
    operation_type: 'DEPARTURE',
    cargo_status: 'laden',
    rob_type: 'BOSP',
    rob_hsfo: '0',
    rob_lsfo: '0',
    rob_mgo: '0',
    rob_mdo: '0',
    rob_fw: '0',
    foc_port_hsfo: '0',
    foc_port_lsfo: '0',
    foc_port_mgo: '0',
    foc_port_mdo: '0'
  };

  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);

  const filteredReports = useMemo(() => {
    return (reports || []).filter(r => {
      const matchesVessel = vesselFilter === '' || String(r.vessel_id) === vesselFilter;
      const matchesSearch = searchQuery === '' || 
        (r.vessel_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.departure_port || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.voyage_number || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesVessel && matchesSearch;
    });
  }, [reports, vesselFilter, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingId ? `/api/departure-reports/${editingId}` : '/api/departure-reports';
      const method = editingId ? 'PUT' : 'POST';

      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      if (file) {
        formData.append('report_file', file);
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        notify('success', editingId ? 'Departure report updated successfully' : 'Departure report submitted successfully');
        setForm(defaultForm);
        setFile(null);
        setEditingId(null);
        setActiveTab('history');
        onRefresh();
      } else {
        const data = await res.json();
        notify('error', data.error || 'Failed to save departure report');
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (report: DepartureReport) => {
    setEditingId(report.id);
    setForm({
      vessel_id: String(report.vessel_id),
      voyage_number: report.voyage_number || '',
      utc_date_time: report.utc_date_time ? format(new Date(report.utc_date_time), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      departure_port: report.departure_port || '',
      eu_uk_status: report.eu_uk_status || 'No',
      position_long: report.position_long || '',
      position_lat: report.position_lat || '',
      operation_type: report.operation_type || 'DEPARTURE',
      cargo_status: report.cargo_status || 'laden',
      rob_type: report.rob_type || 'BOSP',
      rob_hsfo: String(report.rob_hsfo || 0),
      rob_lsfo: String(report.rob_lsfo || 0),
      rob_mgo: String(report.rob_mgo || 0),
      rob_mdo: String(report.rob_mdo || 0),
      rob_fw: String(report.rob_fw || 0),
      foc_port_hsfo: String(report.foc_port_hsfo || 0),
      foc_port_lsfo: String(report.foc_port_lsfo || 0),
      foc_port_mgo: String(report.foc_port_mgo || 0),
      foc_port_mdo: String(report.foc_port_mdo || 0)
    });
    setFile(null);
    setActiveTab('form');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to move this departure report to the recycle bin?')) {
      return;
    }
    try {
      const res = await fetch(`/api/departure-reports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify('success', 'Departure report moved to recycle bin');
        onRefresh();
      } else {
        const data = await res.json();
        notify('error', data.error || 'Failed to delete report');
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    }
  };

  return (
    <div className="space-y-6" id="departure-view-container">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs" id="departure-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Departure Reports</h1>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-100">
              {reports?.length || 0} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Log departure times, ROB status, bunker figures, and port consumption for fleet vessels.
          </p>
        </div>

        <div className="flex items-center gap-2" id="departure-tab-buttons">
          <button
            type="button"
            id="tab-new-departure"
            onClick={() => {
              if (editingId) {
                setEditingId(null);
                setForm(defaultForm);
              }
              setActiveTab('form');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'form'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{editingId ? 'Edit Report' : 'New Report'}</span>
          </button>
          <button
            type="button"
            id="tab-departure-history"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Report History</span>
          </button>
          <button
            type="button"
            id="btn-refresh-departure"
            onClick={onRefresh}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-6" id="departure-form">
          <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Ship className="w-4 h-4 text-blue-600" />
              General Voyage & Port Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Vessel</label>
                <select
                  value={form.vessel_id}
                  onChange={e => setForm({ ...form, vessel_id: e.target.value })}
                  disabled={user.role === 'vessel'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  required
                >
                  <option value="">Select Vessel</option>
                  {vessels.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Voyage Number</label>
                <input
                  type="text"
                  value={form.voyage_number}
                  onChange={e => setForm({ ...form, voyage_number: e.target.value })}
                  placeholder="e.g. 024W"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">UTC Date & Time</label>
                <input
                  type="datetime-local"
                  value={form.utc_date_time}
                  onChange={e => setForm({ ...form, utc_date_time: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Departure Port</label>
                <input
                  type="text"
                  value={form.departure_port}
                  onChange={e => setForm({ ...form, departure_port: e.target.value })}
                  placeholder="e.g. Singapore, Rotterdam"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">EU/UK Status</label>
                <select
                  value={form.eu_uk_status}
                  onChange={e => setForm({ ...form, eu_uk_status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Cargo Condition</label>
                <select
                  value={form.cargo_status}
                  onChange={e => setForm({ ...form, cargo_status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                >
                  <option value="laden">Laden</option>
                  <option value="ballast">Ballast</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Latitude</label>
                <input
                  type="text"
                  value={form.position_lat}
                  onChange={e => setForm({ ...form, position_lat: e.target.value })}
                  placeholder="e.g. 01° 15' N"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Longitude</label>
                <input
                  type="text"
                  value={form.position_long}
                  onChange={e => setForm({ ...form, position_long: e.target.value })}
                  placeholder="e.g. 103° 51' E"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* ROB at Departure */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-500" />
              Remaining On Board (ROB) at Departure (Metric Tonnes)
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">HSFO (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.rob_hsfo}
                  onChange={e => setForm({ ...form, rob_hsfo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">LSFO (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.rob_lsfo}
                  onChange={e => setForm({ ...form, rob_lsfo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">MGO (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.rob_mgo}
                  onChange={e => setForm({ ...form, rob_mgo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">MDO (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.rob_mdo}
                  onChange={e => setForm({ ...form, rob_mdo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">FW (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.rob_fw}
                  onChange={e => setForm({ ...form, rob_fw: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Port Consumption (FOC in Port) */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Compass className="w-4 h-4 text-teal-600" />
              Port Fuel Oil Consumption (FOC in Port)
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Port HSFO FOC (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.foc_port_hsfo}
                  onChange={e => setForm({ ...form, foc_port_hsfo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Port LSFO FOC (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.foc_port_lsfo}
                  onChange={e => setForm({ ...form, foc_port_lsfo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Port MGO FOC (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.foc_port_mgo}
                  onChange={e => setForm({ ...form, foc_port_mgo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Port MDO FOC (MT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.foc_port_mdo}
                  onChange={e => setForm({ ...form, foc_port_mdo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Attachment and Actions */}
          <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              Scanned Report / Attachment (PDF, Images, Excel)
            </h2>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <input
                type="file"
                id="departure-file-upload"
                onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(defaultForm);
                    setActiveTab('history');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{editingId ? 'Update Departure Report' : 'Submit Departure Report'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-4" id="departure-history-table">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by vessel, port, or voyage..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <select
              value={vesselFilter}
              onChange={e => setVesselFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="">All Vessels</option>
              {vessels.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                  <th className="py-3 px-4">Date & Time (UTC)</th>
                  <th className="py-3 px-4">Vessel</th>
                  <th className="py-3 px-4">Voyage</th>
                  <th className="py-3 px-4">Port</th>
                  <th className="py-3 px-4">EU/UK</th>
                  <th className="py-3 px-4">HSFO Dep.</th>
                  <th className="py-3 px-4">LSFO Dep.</th>
                  <th className="py-3 px-4">Attachment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No departure reports found.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {r.utc_date_time ? format(new Date(r.utc_date_time), 'yyyy-MM-dd HH:mm') : '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-700">
                        {r.vessel_name || vessels.find(v => v.id === r.vessel_id)?.name || `Vessel #${r.vessel_id}`}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{r.voyage_number || '-'}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{r.departure_port || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.eu_uk_status === 'Yes' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {r.eu_uk_status || 'No'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{r.rob_hsfo != null ? `${r.rob_hsfo} MT` : '-'}</td>
                      <td className="py-3 px-4 text-slate-700">{r.rob_lsfo != null ? `${r.rob_lsfo} MT` : '-'}</td>
                      <td className="py-3 px-4">
                        {r.attachment_id ? (
                          <a
                            href={`/api/departure-attachments/${r.attachment_id}?token=${token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View File</span>
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(r)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'management') && (
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
    </div>
  );
};
