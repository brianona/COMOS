import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Plus, X, Search, Calendar, Droplet, Ship, 
  Trash2, Download, Eye, Upload, Filter, Compass, 
  ShieldAlert, Check, CheckCircle2, AlertTriangle, HelpCircle, Waves, Pencil
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Vessel {
  id: number;
  name: string;
  team_id: number;
  team_name?: string;
}

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'vessel' | 'team_pic';
  vessel_id?: number | null;
}

interface AnalysisFile {
  id?: string;
  name: string;
  size: string;
  dataUrl?: string;
}

export interface LubeOilAnalysisLog {
  id: string;
  vesselId: string;
  vesselName: string;
  date: string;
  machinerySampled: string;
  viscosity?: string;
  waterContent?: string;
  tbn?: string;
  insolubles?: string;
  status: 'Pass' | 'Fail' | 'Pending';
  remarks?: string;
  files?: AnalysisFile[];
}

interface LubeOilAnalysisProps {
  vessels: Vessel[];
  currentUser: User;
  token: string;
  title?: string;
}

export const LubeOilAnalysisView: React.FC<LubeOilAnalysisProps> = ({
  vessels = [],
  currentUser,
  token,
  title = "Lube Oil Analysis Registry"
}) => {
  const isVesselUser = currentUser?.role === 'vessel' && currentUser?.vessel_id;
  const isAdminOrPic = currentUser?.role === 'admin' || currentUser?.role === 'team_pic';
  const userVesselId = isVesselUser ? String(currentUser.vessel_id) : null;
  const allowedVessels = isVesselUser 
    ? (vessels || []).filter(v => String(v.id) === String(currentUser.vessel_id))
    : (vessels || []);

  // State initialization
  const [logs, setLogs] = useState<LubeOilAnalysisLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lube-oil-analysis-reports', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Failed to load logs from server:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const getFileUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    return `${url}?token=${encodeURIComponent(token)}`;
  };

  // Delete State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVesselFilter, setSelectedVesselFilter] = useState<string>(userVesselId || 'all');

  // Form State for creating a new log
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({
    vesselId: userVesselId || (vessels && vessels[0] ? String(vessels[0].id) : ''),
    date: new Date().toISOString().split('T')[0],
    machinerySampled: '',
    viscosity: '',
    waterContent: '',
    tbn: '',
    insolubles: '',
    status: 'Pending' as 'Pass' | 'Fail' | 'Pending',
    remarks: ''
  });
  const [formFiles, setFormFiles] = useState<{ name: string; size: string; dataUrl?: string }[]>([]);

  // Form State for editing an existing log
  const [editingLog, setEditingLog] = useState<LubeOilAnalysisLog | null>(null);
  const [editFormData, setEditFormData] = useState({
    vesselId: '',
    date: '',
    machinerySampled: '',
    viscosity: '',
    waterContent: '',
    tbn: '',
    insolubles: '',
    status: 'Pending' as 'Pass' | 'Fail' | 'Pending',
    remarks: ''
  });
  const [editFormFiles, setEditFormFiles] = useState<{ id?: string; name: string; size: string; dataUrl?: string }[]>([]);

  // Preview Modal State
  const [previewFile, setPreviewFile] = useState<{ name: string; size: string; dataUrl?: string } | null>(null);

  // Filter logs list
  const filteredLogs = logs.filter(log => {
    // Vessel Filter
    const matchesVessel = selectedVesselFilter === 'all' 
      ? (!isVesselUser || String(log.vesselId) === userVesselId)
      : String(log.vesselId) === selectedVesselFilter;

    // Search Query
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query === '' || 
      (log.machinerySampled && log.machinerySampled.toLowerCase().includes(query)) ||
      (log.vesselName && log.vesselName.toLowerCase().includes(query));

    return matchesVessel && matchesSearch;
  });

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.machinerySampled.trim()) {
      alert("Please provide the machinery sampled.");
      return;
    }

    const payload = {
      vesselId: formData.vesselId,
      date: formData.date,
      machinerySampled: formData.machinerySampled.trim(),
      viscosity: undefined,
      waterContent: undefined,
      tbn: undefined,
      insolubles: undefined,
      status: 'Pending',
      remarks: formData.remarks.trim() || undefined,
      files: formFiles.length > 0 ? formFiles : []
    };

    fetch('/api/lube-oil-analysis-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (res.ok) {
        fetchLogs();
        // Clear Form
        setFormData({
          vesselId: userVesselId || (vessels && vessels[0] ? String(vessels[0].id) : ''),
          date: new Date().toISOString().split('T')[0],
          machinerySampled: '',
          viscosity: '',
          waterContent: '',
          tbn: '',
          insolubles: '',
          status: 'Pending',
          remarks: ''
        });
        setFormFiles([]);
        setShowFormModal(false);
      } else {
        alert("Failed to save report to server.");
      }
    })
    .catch(err => {
      console.error(err);
      alert("Error saving report.");
    });
  };

  // Handle File upload in create form
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = () => {
        const sizeKB = Math.round(file.size / 1024);
        setFormFiles(prev => [...prev, {
          name: file.name,
          size: `${sizeKB > 1000 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB'}`,
          dataUrl: reader.result as string
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove uploaded file from create form
  const handleRemoveFormFile = (index: number) => {
    setFormFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Delete Lube Oil Analysis record
  const handleDeleteLog = (id: string) => {
    fetch(`/api/lube-oil-analysis-reports/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      if (res.ok) {
        fetchLogs();
      } else {
        alert("Failed to delete report.");
      }
    })
    .catch(err => {
      console.error(err);
      alert("Error deleting report.");
    });
  };

  // Start Editing an Analysis log
  const handleStartEdit = (log: LubeOilAnalysisLog) => {
    setEditingLog(log);
    setEditFormData({
      vesselId: log.vesselId,
      date: log.date,
      machinerySampled: log.machinerySampled,
      viscosity: '',
      waterContent: '',
      tbn: '',
      insolubles: '',
      status: 'Pending',
      remarks: log.remarks || ''
    });
    setEditFormFiles(log.files || []);
  };

  // Handle Edit Form Submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    if (!editFormData.machinerySampled.trim()) {
      alert("Please provide the machinery sampled.");
      return;
    }

    const payload = {
      vesselId: editFormData.vesselId,
      date: editFormData.date,
      machinerySampled: editFormData.machinerySampled.trim(),
      viscosity: undefined,
      waterContent: undefined,
      tbn: undefined,
      insolubles: undefined,
      status: 'Pending',
      remarks: editFormData.remarks.trim() || undefined,
      files: editFormFiles
    };

    fetch(`/api/lube-oil-analysis-reports/${editingLog.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (res.ok) {
        fetchLogs();
        setEditingLog(null);
      } else {
        alert("Failed to update report.");
      }
    })
    .catch(err => {
      console.error(err);
      alert("Error updating report.");
    });
  };

  // Handle File upload in edit form
  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = () => {
        const sizeKB = Math.round(file.size / 1024);
        setEditFormFiles(prev => [...prev, {
          name: file.name,
          size: `${sizeKB > 1000 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB'}`,
          dataUrl: reader.result as string
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove uploaded file from edit form
  const handleRemoveEditFormFile = (index: number) => {
    setEditFormFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8" id="lube-analysis-module">
      {/* Header section with clean, Swiss visual cues */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-blue-600 uppercase">
            <Waves className="w-3.5 h-3.5" /> Machinery Condition Monitoring
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            {title}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Registry to submit, evaluate, and track laboratory analysis reports of machinery lubricants.
          </p>
        </div>
        
        <div>
          <button
            onClick={() => setShowFormModal(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black tracking-wider uppercase rounded-xl shadow-lg shadow-blue-100 transition-all hover:shadow-blue-200 active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Submit Analysis Report
          </button>
        </div>
      </div>

      {/* Filters HUD bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Search Input */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search machinery sampled, reports, or values..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 text-slate-800 text-xs border border-transparent rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium placeholder:text-slate-400"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
          {/* Vessel select */}
          {!isVesselUser && (
            <div className="relative min-w-[140px] flex-1 md:flex-none">
              <select
                value={selectedVesselFilter}
                onChange={(e) => setSelectedVesselFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-transparent text-xs font-bold text-slate-700 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
              >
                <option value="all">🚢 All Ship Names</option>
                {allowedVessels.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Table view / grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin mb-4" />
          <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Laboratory Reports...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">No analysis logs found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Try adjusting your search parameters, changing selected filters, or filing a new evaluation report.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Ship Name</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Evaluation Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Machinery Sampled</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Analysis Result</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/55 transition-colors group">
                    {/* Ship Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                          <Ship className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">{log.vesselName}</p>
                          <p className="text-[10px] font-medium text-slate-400">ID: {log.vesselId}</p>
                        </div>
                      </div>
                    </td>

                    {/* Evaluation Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {log.date}
                      </div>
                    </td>

                    {/* Machinery Sampled */}
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <div>
                          <span className="px-2.5 py-1 bg-slate-100 rounded-md text-[10px] uppercase font-black tracking-normal text-slate-700">
                            {log.machinerySampled}
                          </span>
                        </div>
                        {log.remarks && (
                          <p className="text-[10px] text-slate-500 font-medium max-w-xs italic bg-slate-50 p-1 px-1.5 rounded border border-slate-100 line-clamp-2" title={log.remarks}>
                            {log.remarks}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Analysis Result (Uploaded Files) */}
                    <td className="px-6 py-4">
                      {log.files && log.files.length > 0 ? (
                        <div className="space-y-1">
                          {log.files.map((file, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-1.5 text-xs">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <button
                                onClick={() => setPreviewFile(file)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-semibold truncate text-[11px] max-w-[140px]"
                                title={file.name}
                              >
                                {file.name}
                              </button>
                              <span className="text-[10px] text-slate-400 shrink-0 font-medium">({file.size})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No attachments</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEdit(log)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                          title="Edit Report"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        
                        {confirmDeleteId === log.id ? (
                          <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100">
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase rounded"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(log.id)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Delete Log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE SUBMISSION MODAL */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFormModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white w-full max-w-xl rounded-2xl border border-slate-100 shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">Submit Lub oil Analysis</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Laboratory report logging</p>
                </div>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Vessel Select */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                    Ship name
                  </label>
                  {isVesselUser ? (
                    <input
                      type="text"
                      disabled
                      value={currentUser.username.toUpperCase()}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-500 rounded-xl"
                    />
                  ) : (
                    <select
                      value={formData.vesselId}
                      onChange={(e) => setFormData({ ...formData, vesselId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-transparent rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    >
                      {allowedVessels.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Grid for Date and Machinery */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Date of Analysis
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>

                  {/* Machinery Sampled */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Machinery Sampled
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Main Engine, Aux Generator No 1"
                      value={formData.machinerySampled}
                      onChange={(e) => setFormData({ ...formData, machinerySampled: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Remarks Field */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                    Remarks / Comments
                  </label>
                  <textarea
                    placeholder="Enter any notes, laboratory remarks, or comments..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
                  />
                </div>

                {/* Upload analysis result and files */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                    Upload analysis result
                  </label>
                  
                  {/* Drop zone styling */}
                  <div className="relative border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-500 transition-colors bg-slate-50/50 hover:bg-blue-50/5 flex flex-col items-center justify-center p-6 text-center">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-slate-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-700">Drag files here or click to browse</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PDF or chemical specification scan files</span>
                  </div>

                  {/* Attachment list */}
                  {formFiles.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {formFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="font-bold text-slate-700 truncate max-w-[200px]">{file.name}</p>
                              <p className="text-[10px] text-slate-400">{file.size}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFormFile(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Panel */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black tracking-wider uppercase rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black tracking-wider uppercase rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Save Report
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingLog(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white w-full max-w-xl rounded-2xl border border-slate-100 shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">Edit lube oil analysis</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Report registry modification</p>
                </div>
                <button
                  onClick={() => setEditingLog(null)}
                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Vessel Select */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                    Ship name
                  </label>
                  {isVesselUser ? (
                    <input
                      type="text"
                      disabled
                      value={currentUser.username.toUpperCase()}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-500 rounded-xl"
                    />
                  ) : (
                    <select
                      value={editFormData.vesselId}
                      onChange={(e) => setEditFormData({ ...editFormData, vesselId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-transparent rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    >
                      {vessels.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Grid for Date and Machinery */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Date of Analysis
                    </label>
                    <input
                      type="date"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>

                  {/* Machinery Sampled */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Machinery Sampled
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Main Engine, Aux Generator No 1"
                      value={editFormData.machinerySampled}
                      onChange={(e) => setEditFormData({ ...editFormData, machinerySampled: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Remarks Field */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                    Remarks / Comments
                  </label>
                  <textarea
                    placeholder="Enter any notes, laboratory remarks, or comments..."
                    value={editFormData.remarks}
                    onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
                  />
                </div>

                {/* Upload analysis result and files */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                    Upload analysis result
                  </label>
                  
                  {/* Drop zone styling */}
                  <div className="relative border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-500 transition-colors bg-slate-50/50 hover:bg-blue-50/5 flex flex-col items-center justify-center p-6 text-center">
                    <input
                      type="file"
                      multiple
                      onChange={handleEditFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-slate-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-700">Drag files here or click to browse</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PDF or chemical specification scan files</span>
                  </div>

                  {/* Attachment list */}
                  {editFormFiles.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {editFormFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="font-bold text-slate-700 truncate max-w-[200px]">{file.name}</p>
                              <p className="text-[10px] text-slate-400">{file.size}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditFormFile(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Panel */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingLog(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black tracking-wider uppercase rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black tracking-wider uppercase rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Update Report
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FILE PREVIEW MODAL */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewFile(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-2xl border border-slate-100 shadow-2xl relative z-10 flex flex-col h-[85vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-800 truncate max-w-[320px] md:max-w-md" title={previewFile.name}>
                      {previewFile.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">SIZE: {previewFile.size}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {previewFile.dataUrl && (
                    <a
                      href={getFileUrl(previewFile.dataUrl)}
                      download={previewFile.name}
                      referrerPolicy="no-referrer"
                      className="px-3.5 py-1.5 hover:bg-blue-50 hover:text-blue-700 border border-transparent rounded-lg text-xs font-black tracking-wider uppercase transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* View Content Frame */}
              <div className="flex-1 bg-slate-100/40 relative overflow-hidden flex flex-col justify-between">
                {previewFile.dataUrl ? (
                  previewFile.dataUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(previewFile.name) ? (
                    <div className="flex-1 p-6 flex items-center justify-center overflow-auto">
                      <img 
                        src={getFileUrl(previewFile.dataUrl)} 
                        alt={previewFile.name} 
                        className="max-h-full max-w-full rounded-xl object-contain shadow-md border border-slate-100"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : previewFile.dataUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(previewFile.name) ? (
                    <div className="flex-grow h-full w-full flex flex-col">
                      <object 
                        data={getFileUrl(previewFile.dataUrl)} 
                        type="application/pdf" 
                        className="w-full h-full border-none"
                      >
                        <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                          <FileText className="w-12 h-12 text-slate-300 mb-2" />
                          <span className="text-sm font-bold text-slate-700">PDF Reader Unavailable Inline</span>
                          <a 
                            href={getFileUrl(previewFile.dataUrl)} 
                            download={previewFile.name}
                            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-lg transition-all"
                          >
                            Download PDF to inspect
                          </a>
                        </div>
                      </object>
                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
                      <FileText className="w-12 h-12 text-slate-300 mb-3" />
                      <span className="text-sm font-bold text-slate-700">Alternative File Format</span>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs mb-4">You may download and run this file configuration offline.</p>
                      <a 
                        href={getFileUrl(previewFile.dataUrl)} 
                        download={previewFile.name}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase rounded-lg transition-all"
                      >
                        Download Asset File
                      </a>
                    </div>
                  )
                ) : (
                  <div className="flex-1 p-6 flex items-center justify-center text-slate-400 text-xs italic">
                    Binary or mock document format matches default test suite references.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
