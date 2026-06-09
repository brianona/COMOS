import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Plus, X, Search, Calendar, Waves, Ship, 
  Trash2, Download, Eye, Upload, Filter, Compass, 
  Tag, ShieldAlert, Check
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

interface LDRFile {
  name: string;
  size: string;
  dataUrl?: string;
}

export interface LDRLog {
  id: string;
  vesselId: string;
  vesselName: string;
  date: string;
  ldrNumber: string;
  productType: string;
  quantity?: string; // e.g. "5 MT" or "4000 L"
  supplier?: string; // e.g. "Shell Marine"
  viscosity?: string; // e.g. "120 cSt at 40°C"
  density?: string; // e.g. "890.0 kg/m³"
  sulfurContent?: string; // e.g. "0.15%"
  files?: LDRFile[];
}

interface LubeOilLDRProps {
  vessels: Vessel[];
  currentUser: User;
  title?: string;
  storageKey?: string;
}

const COMMON_PRODUCT_TYPES = [
  'System Oil (SAE 30)',
  'Cylinder Oil (SAE 50)',
  'Trunk Piston Engine Oil (TPEO)',
  'Auxiliary Engine Lube Oil',
  'Stern Tube Lube Oil',
  'Hydraulic Lube Oil'
];

const INITIAL_LDR_LOGS: LDRLog[] = [
  {
    id: 'ldr-1',
    vesselId: '1',
    vesselName: 'Ocean Star',
    date: '2026-05-20',
    ldrNumber: 'LDR-SGP-77211',
    productType: 'Cylinder Oil (SAE 50)',
    quantity: '12',
    supplier: 'Shell Marine Lube Supplies',
    viscosity: '145 cSt at 40°C',
    density: '895.0 kg/m³',
    sulfurContent: '1.20%',
    files: [
      { name: 'LDR_OceanStar_77211.pdf', size: '142 KB' }
    ]
  },
  {
    id: 'ldr-2',
    vesselId: '2',
    vesselName: 'Pacific Glory',
    date: '2026-05-28',
    ldrNumber: 'LDR-ROT-66120',
    productType: 'System Oil (SAE 30)',
    quantity: '8',
    supplier: 'Chevron Marine Lubricants',
    viscosity: '105 cSt at 40°C',
    density: '888.2 kg/m³',
    sulfurContent: '0.85%',
    files: [
      { name: 'LDR_PacGlory_66120.pdf', size: '195 KB' }
    ]
  }
];

export const LubeOilLDRView: React.FC<LubeOilLDRProps> = ({
  vessels,
  currentUser,
  title = "Lube Oil Delivery Receipt (LDR) Registry",
  storageKey = "comos_lube_oil_ldr_logs"
}) => {
  const isVesselUser = currentUser?.role === 'vessel' && currentUser?.vessel_id;
  const isAdminOrPic = currentUser?.role === 'admin' || currentUser?.role === 'team_pic';
  const userVesselId = isVesselUser ? String(currentUser.vessel_id) : null;
  const allowedVessels = isVesselUser 
    ? vessels.filter(v => String(v.id) === String(currentUser.vessel_id))
    : vessels;

  // State initialization
  const [logs, setLogs] = useState<LDRLog[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse LDR logs from storage:", e);
      }
    }
    return INITIAL_LDR_LOGS;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(logs));
  }, [logs, storageKey]);

  // Delete State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVesselFilter, setSelectedVesselFilter] = useState<string>(userVesselId || 'all');
  const [selectedProductFilter, setSelectedProductFilter] = useState('all');

  // Form State for creating a new log
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({
    vesselId: userVesselId || (vessels[0] ? String(vessels[0].id) : ''),
    date: new Date().toISOString().split('T')[0],
    ldrNumber: '',
    productType: '',
    quantity: ''
  });
  const [formFiles, setFormFiles] = useState<{ name: string; size: string; dataUrl?: string }[]>([]);

  // Form State for editing an existing log
  const [editingLog, setEditingLog] = useState<LDRLog | null>(null);
  const [editFormData, setEditFormData] = useState({
    vesselId: '',
    date: '',
    ldrNumber: '',
    productType: '',
    quantity: ''
  });
  const [editFormFiles, setEditFormFiles] = useState<{ name: string; size: string; dataUrl?: string }[]>([]);

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
      (log.ldrNumber && log.ldrNumber.toLowerCase().includes(query)) ||
      (log.vesselName && log.vesselName.toLowerCase().includes(query)) ||
      (log.supplier && log.supplier.toLowerCase().includes(query)) ||
      (log.productType && log.productType.toLowerCase().includes(query));

    // Product Type Filter
    const matchesProduct = selectedProductFilter === 'all' || (log.productType && log.productType.includes(selectedProductFilter));

    return matchesVessel && matchesSearch && matchesProduct;
  });

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ldrNumber.trim()) {
      alert("Please provide an LDR Number.");
      return;
    }

    const selectedVessel = vessels.find(v => String(v.id) === String(formData.vesselId));
    const newLog: LDRLog = {
      id: `ldr-${Date.now()}`,
      vesselId: formData.vesselId,
      vesselName: selectedVessel ? selectedVessel.name : 'Unknown Vessel',
      date: formData.date,
      ldrNumber: formData.ldrNumber.trim(),
      productType: formData.productType.trim(),
      quantity: formData.quantity.trim() ? `${formData.quantity.trim()} MT` : undefined,
      files: formFiles.length > 0 ? formFiles : undefined
    };

    setLogs([newLog, ...logs]);
    
    // Clear Form
    setFormData({
      vesselId: userVesselId || (vessels[0] ? String(vessels[0].id) : ''),
      date: new Date().toISOString().split('T')[0],
      ldrNumber: '',
      productType: '',
      quantity: ''
    });
    setFormFiles([]);
    setShowFormModal(false);
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

  // Delete LDR record
  const handleDeleteLog = (id: string) => {
    setLogs(logs.filter(log => log.id !== id));
  };

  // Start Editing an LDR log
  const handleStartEdit = (log: LDRLog) => {
    setEditingLog(log);
    // Strip " MT" or "MT" from the end for easier numeric editing if present
    const cleanQty = log.quantity ? log.quantity.replace(/\s*MT\s*$/i, '') : '';
    setEditFormData({
      vesselId: log.vesselId,
      date: log.date,
      ldrNumber: log.ldrNumber,
      productType: log.productType || '',
      quantity: cleanQty
    });
    setEditFormFiles(log.files || []);
  };

  // Handle Edit Form Submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    if (!editFormData.ldrNumber.trim()) {
      alert("Please provide an LDR Number.");
      return;
    }

    const selectedVessel = vessels.find(v => String(v.id) === String(editFormData.vesselId));
    const updatedLogs = logs.map(log => {
      if (log.id === editingLog.id) {
        return {
          ...log,
          vesselId: editFormData.vesselId,
          vesselName: selectedVessel ? selectedVessel.name : 'Unknown Vessel',
          date: editFormData.date,
          ldrNumber: editFormData.ldrNumber.trim(),
          productType: editFormData.productType.trim(),
          quantity: editFormData.quantity.trim() ? `${editFormData.quantity.trim()} MT` : undefined,
          files: editFormFiles.length > 0 ? editFormFiles : undefined
        };
      }
      return log;
    });

    setLogs(updatedLogs);
    setEditingLog(null);
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
    <div className="space-y-6">
      {/* Visual Header Banner - Sleek Blue/Indigo theme */}
      <div className="bg-gradient-to-r from-[#172554] to-[#0f172a] text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg border border-blue-900/30 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-2 flex-1">
          <div className="bg-blue-500/20 text-blue-100 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-semibold w-max uppercase tracking-wider font-mono">
            Lube Oil Operations and Compliance
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <Waves className="w-7 h-7 text-blue-400" /> {title}
          </h1>
          <p className="text-blue-200/70 text-sm max-w-xl leading-relaxed font-medium">
            Maintain and audit accurate reports of Lube Oil Delivery Receipts. Verify product specs, quantity delivered, and clean handling registers.
          </p>
        </div>

        <button 
          onClick={() => setShowFormModal(true)}
          className="relative z-20 shrink-0 self-start md:self-center bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs tracking-tight uppercase px-5 py-3.5 rounded-2xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-blue-900/20"
        >
          <Plus className="w-4 h-4" /> Log Lube Oil LDR
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-3xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[260px]">
          {/* Search LDR */}
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by LDR#, Supplier, Specs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 bg-slate-50/50"
            />
          </div>

          {/* Vessel select filter (Hidden or locked if vessel user) */}
          {!userVesselId && (
            <div className="flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={selectedVesselFilter}
                onChange={(e) => setSelectedVesselFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 bg-white"
              >
                <option value="all">All Vessels</option>
                {vessels.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Product Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 bg-white"
            >
              <option value="all">Product Type: All</option>
              <option value="Cylinder">Cylinder Oil</option>
              <option value="System">System Oil</option>
              <option value="Engine">Engine Oil</option>
              <option value="Hydraulic">Hydraulic Oil</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-bold text-slate-450 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          Total Logs: <span className="text-blue-700 font-extrabold">{filteredLogs.length}</span>
        </div>
      </div>

      {/* Main List Grid */}
      {filteredLogs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLogs.map(log => {
            const hasExtraSpecs = log.viscosity || log.density || log.sulfurContent;
            return (
              <motion.div 
                key={log.id} 
                layoutId={log.id}
                className="bg-white border border-slate-150 shadow-sm rounded-2xl hover:shadow-md hover:border-blue-500/40 transition-all flex flex-col justify-between overflow-hidden cursor-pointer group relative"
                onClick={() => {
                  if (confirmDeleteId === log.id) return;
                  handleStartEdit(log);
                }}
                title={confirmDeleteId === log.id ? undefined : "Click to edit LDR log"}
              >
                {/* Deletion Confirmation Overlay */}
                <AnimatePresence>
                  {confirmDeleteId === log.id && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute inset-0 bg-slate-950/95 backdrop-blur-xs z-20 p-5 flex flex-col justify-between text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-2 mt-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-550 flex items-center justify-center mx-auto mb-3">
                          <Trash2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-extrabold uppercase tracking-wide text-white">Delete LDR Record?</h4>
                        <p className="text-xs font-semibold text-slate-400 max-w-[220px] mx-auto">
                          This will permanently remove the record for <span className="text-red-400 font-bold">{log.ldrNumber}</span>.
                        </p>
                      </div>
                      <div className="flex gap-2.5 mt-auto">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 py-2.5 rounded-xl border border-slate-700 text-xs text-slate-300 font-bold hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteLog(log.id);
                            setConfirmDeleteId(null);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold transition-colors cursor-pointer shadow-md"
                        >
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Header tag */}
                <div className="p-5 border-b border-slate-100/70 bg-gradient-to-br from-slate-50 to-white relative">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black text-blue-800 bg-blue-50 border border-blue-100 uppercase tracking-tight">
                        <Ship className="w-3 h-3" /> {log.vesselName}
                      </span>
                      <h3 className="text-xs font-black text-slate-400 font-mono tracking-wide uppercase pt-1">
                        LDR REF: {log.ldrNumber}
                      </h3>
                    </div>
 
                    {/* Delete capability for admin, team PIC, or if same vessel user */}
                    {(isAdminOrPic || (isVesselUser && String(log.vesselId) === userVesselId)) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(log.id);
                        }}
                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-100 shrink-0 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Core contents */}
                <div className="p-5 space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-100/50">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Delivery Date</span>
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-450" /> {log.date}
                      </div>
                    </div>
                    <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-100/50">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Product Type</span>
                      <div className="flex items-center gap-1.5 text-xs font-black text-blue-800 mt-0.5">
                        <Waves className="w-3.5 h-3.5 text-blue-600" /> {log.productType ? log.productType.split(' ')[0] : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {log.quantity && (
                      <div className="flex justify-between items-center text-xs border-b border-dashed border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Delivered Mass / Weight:</span>
                        <span className="font-black text-slate-700">{log.quantity.endsWith('MT') ? log.quantity : `${log.quantity} MT`}</span>
                      </div>
                    )}
                    {log.supplier && (
                      <div className="flex justify-between items-center text-xs border-b border-dashed border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Supplier:</span>
                        <span className="font-semibold text-slate-600 truncate max-w-[150px]" title={log.supplier}>{log.supplier}</span>
                      </div>
                    )}
                  </div>

                  {/* Lab specifications */}
                  {hasExtraSpecs && (
                    <div className="p-3 bg-blue-50/20 border border-blue-100/30 rounded-xl space-y-1.5">
                      <div className="text-[9px] font-black uppercase text-blue-800/80 tracking-wider flex items-center gap-1">
                        <Compass className="w-3 h-3" /> Technical Specifications
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-650">
                        {log.viscosity && (
                          <div className="bg-white/80 rounded p-1 text-center border border-blue-100/10">
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Visc.</span>
                            <span className="font-bold text-slate-800">{log.viscosity.split(' ')[0]}</span>
                          </div>
                        )}
                        {log.density && (
                          <div className="bg-white/80 rounded p-1 text-center border border-blue-100/10">
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Density</span>
                            <span className="font-bold text-slate-800">{log.density.split(' ')[0]}</span>
                          </div>
                        )}
                        {log.sulfurContent && (
                          <div className="bg-white/80 rounded p-1 text-center border border-blue-100/10">
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Sulfur</span>
                            <span className="font-bold text-blue-700">{log.sulfurContent}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Document preview section */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                  {log.files && log.files.length > 0 ? (
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate" title={log.files[0].name}>
                        {log.files[0].name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-350 italic">No LDR attachments linked</span>
                  )}

                  {log.files && log.files.length > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {log.files[0].dataUrl && (
                        <a 
                          href={log.files[0].dataUrl}
                          download={log.files[0].name}
                          className="p-1 px-1.5 bg-white text-blue-600 rounded border border-blue-100 hover:bg-blue-50 hover:text-blue-700 transition-colors text-[10px] font-black flex items-center gap-0.5"
                          title="Download PDF"
                        >
                          <Download className="w-3 h-3" /> Get
                        </a>
                      )}
                      <button 
                        onClick={() => setPreviewFile(log.files![0])}
                        className="p-1 px-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded transition-colors text-[10px] flex items-center gap-0.5 cursor-pointer shadow-3xs"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-12 text-center max-w-lg mx-auto">
          <Waves className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">No LDR Records Found</h3>
          <p className="text-xs text-slate-400 mt-2 font-medium">No Lube Oil delivery receipt matches the active search query or filters. Click &quot;Log Lube Oil LDR&quot; above to add one.</p>
        </div>
      )}

      {/* Record Creation Modal Form */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="bg-[#172554] text-white px-6 py-5 flex items-center justify-between border-b border-blue-950/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shadow-3xs border border-blue-500/10">
                    <Waves className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm tracking-wide uppercase">Register Lube Oil Delivery Receipt</h2>
                    <p className="text-[10px] text-blue-200/60 font-semibold uppercase tracking-wider">Log official Lube oil files (LDR)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFormModal(false)}
                  className="p-1 px-1.5 hover:bg-white/10 rounded-lg text-blue-200 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Visual Alert Info */}
                <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-200/35 text-[11px] text-blue-900 font-medium leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Ensure all documented properties precisely mirror the signed Lube Oil Delivery Receipt (LDR) received. This data serves as official compliance proof.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ship Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Ship Name / Vessel</label>
                    <select 
                      value={formData.vesselId}
                      onChange={(e) => setFormData({ ...formData, vesselId: e.target.value })}
                      disabled={!!userVesselId}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 disabled:bg-slate-100 disabled:opacity-85"
                    >
                      {allowedVessels.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Delivery Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Delivery Date</label>
                    <input 
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
                    />
                  </div>

                  {/* LDR Number */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">LDR Document Number</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. LDR-SGP-10332"
                      value={formData.ldrNumber}
                      onChange={(e) => setFormData({ ...formData, ldrNumber: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
                    />
                  </div>

                  {/* Product Type */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Product Type</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Cylinder Oil (SAE 50)"
                      value={formData.productType}
                      onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
                    />
                  </div>

                  {/* Weight / Mass of Fuel */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Mass / Weight (Metric Tons)</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 15"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
                    />
                  </div>
                </div>

                {/* File Attachment Upload */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Attach Signed LDR PDF / Scan</label>
                  
                  {formFiles.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {formFiles.map((file, fIdx) => (
                        <div key={fIdx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-700 truncate" title={file.name}>{file.name}</span>
                            <span className="text-[10px] text-slate-405 font-bold">({file.size})</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveFormFile(fIdx)}
                            className="p-1 text-slate-350 hover:text-red-500 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <input 
                      type="file" 
                      multiple
                      accept=".pdf,image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="py-4 border-2 border-dashed border-slate-200 hover:border-blue-450 hover:bg-blue-50/10 rounded-2xl text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5">
                      <Upload className="w-5 h-5 text-slate-400" />
                      <div className="text-xs font-black text-slate-600">Select File or Drag &amp; Drop here</div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Supports PDF, JPG, PNG</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="p-3 px-5 text-xs text-slate-500 font-extrabold hover:bg-slate-50 rounded-xl transition-colors shrink-0 uppercase tracking-wider border border-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="p-3 px-6 bg-[#172554] hover:bg-[#0f172a] text-white text-xs font-black rounded-xl transition-colors shadow-md shrink-0 uppercase tracking-wider cursor-pointer"
                  >
                    Save LDR Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Edit Modal Form */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="bg-[#172554] text-white px-6 py-5 flex items-center justify-between border-b border-blue-950/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shadow-3xs border border-blue-500/10">
                    <Waves className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm tracking-wide uppercase">Edit Lube Oil Delivery Receipt</h2>
                    <p className="text-[10px] text-blue-200/60 font-semibold uppercase tracking-wider">Modify registered delivery record</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingLog(null)}
                  className="p-1 px-1.5 hover:bg-white/10 rounded-lg text-blue-200 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ship Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Ship Name / Vessel</label>
                    <select 
                      value={editFormData.vesselId}
                      onChange={(e) => setEditFormData({ ...editFormData, vesselId: e.target.value })}
                      disabled={!!userVesselId}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 disabled:bg-slate-100 disabled:opacity-85"
                    >
                      {allowedVessels.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Delivery Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Delivery Date</label>
                    <input 
                      type="date"
                      required
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
                    />
                  </div>

                  {/* LDR Number */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">LDR Document Number</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. LDR-SGP-10332"
                      value={editFormData.ldrNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, ldrNumber: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
                    />
                  </div>

                  {/* Product Type */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Product Type</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Cylinder Oil (SAE 50)"
                      value={editFormData.productType}
                      onChange={(e) => setEditFormData({ ...editFormData, productType: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
                    />
                  </div>

                  {/* Weight / Mass of Fuel */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Mass / Weight (Metric Tons)</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 15"
                      value={editFormData.quantity}
                      onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
                    />
                  </div>
                </div>

                {/* File Attachment Upload */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Attach Signed LDR PDF / Scan</label>
                  
                  {editFormFiles.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {editFormFiles.map((file, fIdx) => (
                        <div key={fIdx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-700 truncate" title={file.name}>{file.name}</span>
                            <span className="text-[10px] text-slate-405 font-bold">({file.size})</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveEditFormFile(fIdx)}
                            className="p-1 text-slate-350 hover:text-red-500 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <input 
                      type="file" 
                      multiple
                      accept=".pdf,image/*"
                      onChange={handleEditFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="py-4 border-2 border-dashed border-slate-200 hover:border-blue-450 hover:bg-blue-50/10 rounded-2xl text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5">
                      <Upload className="w-5 h-5 text-slate-400" />
                      <div className="text-xs font-black text-slate-600">Select File or Drag &amp; Drop here</div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Supports PDF, JPG, PNG</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setEditingLog(null)}
                    className="p-3 px-5 text-xs text-slate-500 font-extrabold hover:bg-slate-50 rounded-xl transition-colors shrink-0 uppercase tracking-wider border border-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="p-3 px-6 bg-[#172554] hover:bg-[#0f172a] text-white text-xs font-black rounded-xl transition-colors shadow-md shrink-0 uppercase tracking-wider cursor-pointer"
                  >
                    Update LDR Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Previewer Dialog Overlay */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-between p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
            {/* Header toolbar */}
            <div className="flex items-center justify-between text-white pb-4 w-full border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-blue-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black truncate max-w-[280px] sm:max-w-md" title={previewFile.name}>
                    {previewFile.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    LDR Document Payload • {previewFile.size}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewFile(null)}
                className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content canvas */}
            <div className="flex-1 flex items-center justify-center overflow-hidden my-6 w-full">
              {previewFile.dataUrl ? (
                previewFile.dataUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(previewFile.name) ? (
                  <img 
                    src={previewFile.dataUrl} 
                    alt={previewFile.name} 
                    className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl border border-white/5"
                  />
                ) : previewFile.dataUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(previewFile.name) ? (
                  <object 
                    data={previewFile.dataUrl} 
                    type="application/pdf"
                    className="w-full h-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl"
                  >
                    <div className="text-center text-white p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-md">
                      <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                      <h4 className="text-sm font-bold truncate">{previewFile.name}</h4>
                      <p className="text-xs text-slate-400 mt-2">Your current environment does not support direct PDF sandbox execution. Please retrieve the document below.</p>
                      <a 
                        href={previewFile.dataUrl} 
                        download={previewFile.name}
                        className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" /> Direct Download
                      </a>
                    </div>
                  </object>
                ) : (
                  <div className="text-center text-white p-12 bg-slate-900/40 border border-white/10 rounded-3xl max-w-md shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 mx-auto border border-blue-500/10">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold truncate max-w-xs">{previewFile.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">Size: {previewFile.size}</p>
                    <p className="text-xs text-slate-400 mt-4 leading-relaxed">No direct inline preview is present for this binary type. You can retrieve its structure by downloading.</p>
                    <a 
                      href={previewFile.dataUrl} 
                      download={previewFile.name}
                      className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" /> Download File
                    </a>
                  </div>
                )
              ) : (
                <div className="text-center text-white p-12 bg-slate-900/40 border border-white/10 rounded-3xl max-w-md shadow-2xl">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center text-blue-400 mb-4 mx-auto border border-blue-500/10">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold">{previewFile.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">Size: {previewFile.size}</p>
                  <p className="text-xs text-blue-250/70 mt-4 leading-relaxed font-semibold">This demo reference note does not contain file payloads inside standard localStorage cache. You can verify system integration by uploading a new signed LDR.</p>
                </div>
              )}
            </div>

            {/* Footer action tools */}
            <div className="flex items-center justify-center gap-4 shrink-0 w-full pt-4 border-t border-white/10">
              {previewFile.dataUrl && (
                <a 
                  href={previewFile.dataUrl}
                  download={previewFile.name}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Download Official Document
                </a>
              )}
              <button 
                onClick={() => setPreviewFile(null)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
