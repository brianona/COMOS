import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Plus, X, Search, Calendar, Fuel, Ship, 
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

interface BDNFile {
  name: string;
  size: string;
  dataUrl?: string;
}

export interface BDNLog {
  id: string;
  vesselId: string;
  vesselName: string;
  date: string;
  bdnNumber: string;
  fuelType: string;
  quantity?: string; // e.g. "350 MT"
  supplier?: string; // e.g. "Chevron Marine"
  viscosity?: string; // e.g. "380 cSt at 50°C"
  density?: string; // e.g. "985.0 kg/m³"
  sulfurContent?: string; // e.g. "0.48%"
  files?: BDNFile[];
}

interface BunkerBDNProps {
  vessels: Vessel[];
  currentUser: User;
  title?: string;
  storageKey?: string;
}

const COMMON_FUEL_TYPES = [
  'VLSFO (0.50% Max S)',
  'LSMGO (0.10% Max S)',
  'HSFO (3.50% Max S)',
  'ULSFO (0.10% Max S)',
  'MDO (0.50% Max S)',
  'Biofuel Blend (B30/B24)'
];

const INITIAL_BDN_LOGS: BDNLog[] = [
  {
    id: 'bdn-1',
    vesselId: '1',
    vesselName: 'Ocean Star',
    date: '2026-05-18',
    bdnNumber: 'BDN-SGP-98212',
    fuelType: 'VLSFO (0.50% Max S)',
    quantity: '350',
    supplier: 'Chevron Marine Fuel Supply',
    viscosity: '380 cSt at 50°C',
    density: '985.2 kg/m³',
    sulfurContent: '0.47%',
    files: [
      { name: 'BDN_OceanStar_98212.pdf', size: '180 KB' }
    ]
  },
  {
    id: 'bdn-2',
    vesselId: '2',
    vesselName: 'Pacific Glory',
    date: '2026-05-24',
    bdnNumber: 'BDN-ROT-88344',
    fuelType: 'LSMGO (0.10% Max S)',
    quantity: '85',
    supplier: 'Shell Marine Operations',
    viscosity: '12 cSt at 40°C',
    density: '845.0 kg/m³',
    sulfurContent: '0.08%',
    files: [
      { name: 'HSSE_Shell_BDN_88344.pdf', size: '210 KB' }
    ]
  },
  {
    id: 'bdn-3',
    vesselId: '3',
    vesselName: 'Atlantic Explorer',
    date: '2026-06-01',
    bdnNumber: 'BDN-HOU-12903',
    fuelType: 'HSFO (3.50% Max S)',
    quantity: '480',
    supplier: 'ExxonMobil Marine',
    viscosity: '500 cSt at 50°C',
    density: '991.5 kg/m³',
    sulfurContent: '3.12%',
    files: [
      { name: 'XOM_Bunker_Note_12903.pdf', size: '320 KB' }
    ]
  }
];

export const BunkerBDNView: React.FC<BunkerBDNProps> = ({
  vessels,
  currentUser,
  title = "Bunker Delivery Note (BDN) Registry",
  storageKey = "comos_bunker_bdn_logs"
}) => {
  const isVesselUser = currentUser?.role === 'vessel' && currentUser?.vessel_id;
  const isAdminOrPic = currentUser?.role === 'admin' || currentUser?.role === 'team_pic';
  const userVesselId = isVesselUser ? String(currentUser.vessel_id) : null;
  const allowedVessels = isVesselUser 
    ? vessels.filter(v => String(v.id) === String(currentUser.vessel_id))
    : vessels;

  // State initialization
  const [logs, setLogs] = useState<BDNLog[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse BDN logs from storage:", e);
      }
    }
    return INITIAL_BDN_LOGS;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(logs));
  }, [logs, storageKey]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVesselFilter, setSelectedVesselFilter] = useState<string>(userVesselId || 'all');
  const [selectedFuelFilter, setSelectedFuelFilter] = useState('all');

  // Form State for creating a new log
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({
    vesselId: userVesselId || (vessels[0] ? String(vessels[0].id) : ''),
    date: new Date().toISOString().split('T')[0],
    bdnNumber: '',
    fuelType: ''
  });
  const [formFiles, setFormFiles] = useState<{ name: string; size: string; dataUrl?: string }[]>([]);

  // Form State for editing an existing log
  const [editingLog, setEditingLog] = useState<BDNLog | null>(null);
  const [editFormData, setEditFormData] = useState({
    vesselId: '',
    date: '',
    bdnNumber: '',
    fuelType: ''
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
      (log.bdnNumber && log.bdnNumber.toLowerCase().includes(query)) ||
      (log.vesselName && log.vesselName.toLowerCase().includes(query)) ||
      (log.supplier && log.supplier.toLowerCase().includes(query)) ||
      (log.fuelType && log.fuelType.toLowerCase().includes(query));

    // Fuel Type Filter
    const matchesFuel = selectedFuelFilter === 'all' || (log.fuelType && log.fuelType.includes(selectedFuelFilter));

    return matchesVessel && matchesSearch && matchesFuel;
  });

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bdnNumber.trim()) {
      alert("Please provide a BDN Number.");
      return;
    }

    const selectedVessel = vessels.find(v => String(v.id) === String(formData.vesselId));
    const newLog: BDNLog = {
      id: `bdn-${Date.now()}`,
      vesselId: formData.vesselId,
      vesselName: selectedVessel ? selectedVessel.name : 'Unknown Vessel',
      date: formData.date,
      bdnNumber: formData.bdnNumber.trim(),
      fuelType: formData.fuelType.trim(),
      files: formFiles.length > 0 ? formFiles : undefined
    };

    setLogs([newLog, ...logs]);
    
    // Clear Form
    setFormData({
      vesselId: userVesselId || (vessels[0] ? String(vessels[0].id) : ''),
      date: new Date().toISOString().split('T')[0],
      bdnNumber: '',
      fuelType: ''
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

  // Delete BDN record
  const handleDeleteLog = (id: string) => {
    if (window.confirm("Are you sure you want to delete this BDN entry?")) {
      setLogs(logs.filter(log => log.id !== id));
    }
  };

  // Start Editing a BDN log
  const handleStartEdit = (log: BDNLog) => {
    setEditingLog(log);
    setEditFormData({
      vesselId: log.vesselId,
      date: log.date,
      bdnNumber: log.bdnNumber,
      fuelType: log.fuelType || ''
    });
    setEditFormFiles(log.files || []);
  };

  // Handle Edit Form Submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    if (!editFormData.bdnNumber.trim()) {
      alert("Please provide a BDN Number.");
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
          bdnNumber: editFormData.bdnNumber.trim(),
          fuelType: editFormData.fuelType.trim(),
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
      {/* Visual Header Banner - Sleek Amber/Copper theme */}
      <div className="bg-gradient-to-r from-[#2c1d11] to-[#120a05] text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg border border-amber-900/30 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-2 flex-1">
          <div className="bg-amber-500/20 text-amber-100 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold w-max uppercase tracking-wider font-mono">
            Bunker Operations and Compliance
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <Fuel className="w-7 h-7 text-amber-500" /> {title}
          </h1>
          <p className="text-amber-200/70 text-sm max-w-xl leading-relaxed font-medium">
            Maintain and audit accurate reports of Bunker Delivery Notes. Verify fuel specs, quantity bunkered, and sulfur limits for environmental compliance registers.
          </p>
        </div>

        <button 
          onClick={() => setShowFormModal(true)}
          className="relative z-20 shrink-0 self-start md:self-center bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs tracking-tight uppercase px-5 py-3.5 rounded-2xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-amber-900/20"
        >
          <Plus className="w-4 h-4" /> Log Bunker BDN
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-3xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[260px]">
          {/* Search BDN */}
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by BDN#, Supplier, Specs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 bg-slate-50/50"
            />
          </div>

          {/* Vessel select filter (Hidden or locked if vessel user) */}
          {!userVesselId && (
            <div className="flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={selectedVesselFilter}
                onChange={(e) => setSelectedVesselFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 bg-white"
              >
                <option value="all">All Vessels</option>
                {vessels.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Fuel type filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedFuelFilter}
              onChange={(e) => setSelectedFuelFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 bg-white"
            >
              <option value="all">Fule Type: All</option>
              <option value="VLSFO">VLSFO</option>
              <option value="LSMGO">LSMGO</option>
              <option value="HSFO">HSFO</option>
              <option value="Biofuel">Biofuel</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-bold text-slate-450 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          Total Logs: <span className="text-amber-700 font-extrabold">{filteredLogs.length}</span>
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
                className="bg-white border border-slate-150 shadow-sm rounded-2xl hover:shadow-md hover:border-amber-500/40 transition-all flex flex-col justify-between overflow-hidden cursor-pointer group"
                onClick={() => handleStartEdit(log)}
                title="Click to edit BDN log"
              >
                {/* Header tag */}
                <div className="p-5 border-b border-slate-100/70 bg-gradient-to-br from-slate-50 to-white relative">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-100 uppercase tracking-tight">
                        <Ship className="w-3 h-3" /> {log.vesselName}
                      </span>
                      <h3 className="text-xs font-black text-slate-400 font-mono tracking-wide uppercase pt-1">
                        BDN REF: {log.bdnNumber}
                      </h3>
                    </div>
 
                    {/* Delete capability for admin, team PIC, or if same vessel user */}
                    {(isAdminOrPic || (isVesselUser && String(log.vesselId) === userVesselId)) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLog(log.id);
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
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Bunkered Date</span>
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-450" /> {log.date}
                      </div>
                    </div>
                    <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-100/50">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Fuel Oil Grade</span>
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 mt-0.5">
                        <Fuel className="w-3.5 h-3.5 text-amber-600" /> {log.fuelType ? log.fuelType.split(' ')[0] : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {log.quantity && (
                      <div className="flex justify-between items-center text-xs border-b border-dashed border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Supply Volume:</span>
                        <span className="font-black text-slate-700">{log.quantity}</span>
                      </div>
                    )}
                    {log.supplier && (
                      <div className="flex justify-between items-center text-xs border-b border-dashed border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Supplier / Tanker:</span>
                        <span className="font-semibold text-slate-600 truncate max-w-[150px]" title={log.supplier}>{log.supplier}</span>
                      </div>
                    )}
                  </div>

                  {/* Chemical & Lab specifications */}
                  {hasExtraSpecs && (
                    <div className="p-3 bg-amber-50/20 border border-amber-100/30 rounded-xl space-y-1.5">
                      <div className="text-[9px] font-black uppercase text-amber-800/80 tracking-wider flex items-center gap-1">
                        <Compass className="w-3 h-3" /> Lab Verified Specifications
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-650">
                        {log.viscosity && (
                          <div className="bg-white/80 rounded p-1 text-center border border-amber-100/10">
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Visc.</span>
                            <span className="font-bold text-slate-800">{log.viscosity.split(' ')[0]}</span>
                          </div>
                        )}
                        {log.density && (
                          <div className="bg-white/80 rounded p-1 text-center border border-amber-100/10">
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Density</span>
                            <span className="font-bold text-slate-800">{log.density.split(' ')[0]}</span>
                          </div>
                        )}
                        {log.sulfurContent && (
                          <div className="bg-white/80 rounded p-1 text-center border border-amber-100/10">
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Sulfur</span>
                            <span className="font-bold text-rose-700">{log.sulfurContent}</span>
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
                    <span className="text-[11px] font-bold text-slate-350 italic">No BDN attachments linked</span>
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
          <Fuel className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">No BDN Records Found</h3>
          <p className="text-xs text-slate-400 mt-2 font-medium">No bunker delivery note matches the active search query or filters. Click &quot;Log Bunker BDN&quot; above to add one.</p>
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
              <div className="bg-[#2c1d11] text-white px-6 py-5 flex items-center justify-between border-b border-amber-950/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500 shadow-3xs border border-amber-500/10">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm tracking-wide uppercase">Register Bunker Delivery Note</h2>
                    <p className="text-[10px] text-amber-200/60 font-semibold uppercase tracking-wider">Log official bunkering files</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFormModal(false)}
                  className="p-1 px-1.5 hover:bg-white/10 rounded-lg text-amber-200 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Visual Alert Info */}
                <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-200/35 text-[11px] text-amber-900 font-medium leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Ensure all documented properties precisely mirror the signed Bunker Delivery Note (BDN) received from the barge. This data serves as official regulatory proof.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ship Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Ship Name / Vessel</label>
                    <select 
                      value={formData.vesselId}
                      onChange={(e) => setFormData({ ...formData, vesselId: e.target.value })}
                      disabled={!!userVesselId}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 disabled:bg-slate-100 disabled:opacity-85"
                    >
                      {allowedVessels.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bunkering Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Bunkering Date</label>
                    <input 
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50"
                    />
                  </div>

                  {/* BDN Number */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">BDN Document Number</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. BDN-HOU-20120"
                      value={formData.bdnNumber}
                      onChange={(e) => setFormData({ ...formData, bdnNumber: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50"
                    />
                  </div>

                  {/* Fuel Type */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Fuel Type</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. VLSFO (0.50% Max S)"
                      value={formData.fuelType}
                      onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50"
                    />
                  </div>
                </div>

                {/* File Attachment Upload */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Attach Signed BDN PDF / Scan</label>
                  
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
                    <div className="py-4 border-2 border-dashed border-slate-200 hover:border-amber-450 hover:bg-amber-50/10 rounded-2xl text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5">
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
                    className="p-3 px-6 bg-[#2c1d11] hover:bg-[#1a110a] text-white text-xs font-black rounded-xl transition-colors shadow-md shrink-0 uppercase tracking-wider cursor-pointer"
                  >
                    Save BDN Record
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
              <div className="bg-[#2c1d11] text-white px-6 py-5 flex items-center justify-between border-b border-amber-950/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500 shadow-3xs border border-amber-500/10">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm tracking-wide uppercase">Edit Bunker Delivery Note</h2>
                    <p className="text-[10px] text-amber-200/60 font-semibold uppercase tracking-wider">Modify registered bunkering record</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingLog(null)}
                  className="p-1 px-1.5 hover:bg-white/10 rounded-lg text-amber-200 hover:text-white transition-colors cursor-pointer"
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
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 disabled:bg-slate-100 disabled:opacity-85"
                    >
                      {allowedVessels.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bunkering Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Bunkering Date</label>
                    <input 
                      type="date"
                      required
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50"
                    />
                  </div>

                  {/* BDN Number */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">BDN Document Number</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. BDN-HOU-20120"
                      value={editFormData.bdnNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, bdnNumber: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50"
                    />
                  </div>

                  {/* Fuel Type */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Fuel Type</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. VLSFO (0.50% Max S)"
                      value={editFormData.fuelType}
                      onChange={(e) => setEditFormData({ ...editFormData, fuelType: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50"
                    />
                  </div>
                </div>

                {/* File Attachment Upload */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block ml-0.5">Attach Signed BDN PDF / Scan</label>
                  
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
                    <div className="py-4 border-2 border-dashed border-slate-200 hover:border-amber-450 hover:bg-amber-50/10 rounded-2xl text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5">
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
                    className="p-3 px-6 bg-[#2c1d11] hover:bg-[#1a110a] text-white text-xs font-black rounded-xl transition-colors shadow-md shrink-0 uppercase tracking-wider cursor-pointer"
                  >
                    Update BDN Record
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
                    BDN Document Payload • {previewFile.size}
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
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-400 mb-4 mx-auto border border-amber-500/10">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold">{previewFile.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">Size: {previewFile.size}</p>
                  <p className="text-xs text-amber-250/70 mt-4 leading-relaxed font-semibold">This demo reference note does not contain file payloads inside standard localStorage cache. You can verify system integration by uploading a new signed BDN.</p>
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
