import React, { useState } from "react";
import { 
  Ship, Calendar, Plus, MessageSquare, Search, Filter, RotateCcw, 
  Trash2, X, ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowUpDown, 
  AlertCircle, RefreshCw, MapPin, Activity, Anchor, Droplets, Fuel, Info,
  CheckCircle2, Edit2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, parseISO } from "date-fns";
import { cn } from "../utils/helpers";
import { User, Vessel, OtherReport } from "../types";

export const OtherReportView = ({ user, token, vessels, reports, onRefresh, notify, isLoading }: { 
  user: User, 
  token: string, 
  vessels: Vessel[], 
  reports: OtherReport[],
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
    port: '',
    eu_uk_status: 'No',
    position_long: '',
    position_lat: '',
    operation_type: 'LOADING',
    cargo_status: 'ballast',
    rob_type: 'Drop Anchor',
    rob_hsfo: '0',
    rob_lsfo: '0',
    rob_mgo: '0',
    rob_mdo: '0',
    rob_fw: '0'
  };
  const [form, setForm] = useState(defaultForm);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [vesselFilter, setVesselFilter] = useState<string>('');

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => vesselFilter === '' || String(r.vessel_id) === vesselFilter);
  }, [reports, vesselFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingId ? `/api/other-reports/${editingId}` : '/api/other-reports';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...form,
          utc_date_time: form.utc_date_time.replace('T', ' ')
        })
      });

      if (res.ok) {
        notify('success', `Other report ${editingId ? 'updated' : 'submitted'} successfully`);
        setForm(defaultForm);
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

  const isLatestReport = (report: OtherReport) => {
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

  const canEditReport = (report: OtherReport) => {
    if (user.role !== 'vessel') return true;
    if (!isLatestReport(report)) return false;
    const reportTime = new Date(report.created_at).getTime();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return reportTime >= twentyFourHoursAgo;
  };

  const handleEdit = (report: OtherReport) => {
    setEditingId(report.id);
    setForm({
      vessel_id: String(report.vessel_id),
      voyage_number: report.voyage_number || '',
      utc_date_time: report.utc_date_time.slice(0, 16),
      port: report.port,
      eu_uk_status: report.eu_uk_status,
      position_long: report.position_long,
      position_lat: report.position_lat,
      operation_type: report.operation_type,
      cargo_status: report.cargo_status,
      rob_type: report.rob_type,
      rob_hsfo: String(report.rob_hsfo),
      rob_lsfo: String(report.rob_lsfo),
      rob_mgo: String(report.rob_mgo),
      rob_mdo: String(report.rob_mdo),
      rob_fw: String(report.rob_fw)
    });
    setActiveTab('form');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      const res = await fetch(`/api/other-reports/${id}`, {
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

  const selectedVesselName = vessels.find(v => String(v.id) === String(form.vessel_id))?.name || 'Unknown Vessel';

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Other Report</h1>
          <p className="text-slate-500">Submit and track other vessel events.</p>
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Port</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Enter port name"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: e.target.value })}
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
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                    </select>
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
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ROB Event Type</label>
                  <select 
                    value={form.rob_type}
                    onChange={(e) => setForm({ ...form, rob_type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="Drop Anchor">Drop Anchor</option>
                    <option value="Anchor Aweigh">Anchor Aweigh</option>
                    <option value="Start Drifting">Start Drifting</option>
                    <option value="End Drifting">End Drifting</option>
                    <option value="POB">POB</option>
                    <option value="P. OFF">P. OFF</option>
                    <option value="Start Shifting">Start Shifting</option>
                    <option value="End Shifting">End Shifting</option>
                  </select>
                </div>

                <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Fuel Statistics & Consumption
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">
                      <span>Fuel Type</span>
                      <span>ROB</span>
                    </div>
                    {[
                      { key: 'hsfo', label: 'HSFO', rob: 'rob_hsfo' },
                      { key: 'lsfo', label: 'LSFO', rob: 'rob_lsfo' },
                      { key: 'mgo', label: 'MGO', rob: 'rob_mgo' },
                      { key: 'mdo', label: 'MDO', rob: 'rob_mdo' },
                    ].map(f => (
                      <div key={f.key} className="grid grid-cols-2 gap-4 items-center">
                        <span className="text-sm font-bold text-slate-700">{f.label}</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={(form as any)[f.rob]}
                          onChange={(e) => setForm({ ...form, [f.rob]: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                        />
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-4 items-center pt-2 border-t border-blue-100">
                      <span className="text-sm font-bold text-slate-700">FW</span>
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
                Submit Other Report
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
                    <th className="px-6 py-4">Port</th>
                    <th className="px-6 py-4">EU/UK Status</th>
                    <th className="px-6 py-4">Operation</th>
                    <th className="px-6 py-4">Event Type</th>
                    <th className="px-6 py-4">HSFO ROB</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-sm">
                  {filteredReports.map(report => (
                  <tr key={report.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono">{format(parseISO(report.utc_date_time), 'MMM dd, HH:mm')}</td>
                    <td className="px-6 py-4 font-bold">{report.vessel_name}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{report.voyage_number || '-'}</td>
                    <td className="px-6 py-4">{report.port}</td>
                    <td className="px-6 py-4 uppercase text-[10px] font-bold text-slate-500">{report.eu_uk_status}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">
                        {report.operation_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">{report.rob_type}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{report.rob_hsfo}</td>
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
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Marine Voyage Reports...</span>
                      </div>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
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

