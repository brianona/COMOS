import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  X, 
  Upload, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Truck, 
  AlertTriangle, 
  Download, 
  Eye, 
  Calendar, 
  Anchor, 
  Paperclip, 
  Info,
  Check,
  ChevronRight,
  User,
  MapPin,
  Trash2
} from 'lucide-react';

interface RequisitionItem {
  id: string;
  partNumber: string;
  name: string;
  maker: string;
  quantity: number;
  unit: string;
}

export interface SparePartsRequisition {
  id: string;
  requisitionRef: string;
  vesselId: string;
  status: 'Draft' | 'Pending Review' | 'Approved' | 'In Transit' | 'Delivered';
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  dateRequested: string;
  targetPort: string;
  eta: string;
  remarks: string;
  items: RequisitionItem[];
  documentName?: string;
  documentDataUrl?: string;
  documentSize?: string;
  trackingNumber?: string;
}

interface SparePartsRequisitionProps {
  vessels: any[];
  currentUser?: {
    id: number;
    username: string;
    role: 'admin' | 'user' | 'vessel' | 'team_pic';
    team_ids: number[];
    vessel_id?: number | null;
    email?: string;
  } | null;
}

const INITIAL_REQUISITIONS: SparePartsRequisition[] = [
  {
    id: 'req-1',
    requisitionRef: 'REQ-2026-001',
    vesselId: '1',
    status: 'In Transit',
    priority: 'High',
    dateRequested: '2026-05-10',
    targetPort: 'Singapore',
    eta: '2026-05-25',
    remarks: 'Main Engine Cylinder Head O-Rings and gaskets required for routine maintenance.',
    items: [
      { id: 'item-1', partNumber: 'ME-CO-010', name: 'O-Ring Cylinder Head', maker: 'MAN B&W', quantity: 12, unit: 'Pcs' },
      { id: 'item-2', partNumber: 'ME-GK-412', name: 'Gasket Exhaust Valve', maker: 'MAN B&W', quantity: 6, unit: 'Pcs' }
    ],
    documentName: 'ME_Cylinder_Head_Spares_V1.pdf',
    documentSize: '1.2 MB',
    trackingNumber: 'XDY-27192-SIN'
  },
  {
    id: 'req-2',
    requisitionRef: 'REQ-2026-002',
    vesselId: '2',
    status: 'Pending Review',
    priority: 'Emergency',
    dateRequested: '2026-05-18',
    targetPort: 'Rotterdam',
    eta: '2026-06-02',
    remarks: 'Emergency replenishment of hydraulic pump spares due to secondary line leakage.',
    items: [
      { id: 'item-3', partNumber: 'HY-PP-092', name: 'Hydraulic Seals Kit', maker: 'Rexroth', quantity: 2, unit: 'Set' },
      { id: 'item-4', partNumber: 'HY-VLV-11', name: 'Solenoid Directional Valve', maker: 'Rexroth', quantity: 1, unit: 'Pc' }
    ],
    documentName: 'Hydraulic_Pump_Req_Rotterdam.pdf',
    documentSize: '840 KB'
  },
  {
    id: 'req-3',
    requisitionRef: 'REQ-2026-003',
    vesselId: '3',
    status: 'Approved',
    priority: 'Medium',
    dateRequested: '2026-05-15',
    targetPort: 'Houston',
    eta: '2026-06-10',
    remarks: 'Purifier overhaul spares scheduled for next major drydock planning.',
    items: [
      { id: 'item-5', partNumber: 'PF-BRG-201', name: 'Bowl Spindle Bearing', maker: 'Alfa Laval', quantity: 4, unit: 'Pcs' }
    ],
    documentName: 'AlfaLaval_Purifier_Overhaul_Req.xlsx',
    documentSize: '320 KB'
  }
];

export const SparePartsRequisitionView: React.FC<SparePartsRequisitionProps> = ({ vessels, currentUser }) => {
  const isVesselUser = currentUser?.role === 'vessel' && currentUser?.vessel_id;
  const userVesselId = isVesselUser ? String(currentUser.vessel_id) : null;
  const allowedVessels = isVesselUser 
    ? vessels.filter(v => String(v.id) === String(currentUser.vessel_id))
    : vessels;

  const [requisitions, setRequisitions] = useState<SparePartsRequisition[]>(() => {
    const saved = localStorage.getItem('comos_spare_requisitions');
    return saved ? JSON.parse(saved) : INITIAL_REQUISITIONS;
  });

  const [activeTab, setActiveTab] = useState<'All' | 'Pending Review' | 'Approved' | 'In Transit' | 'Delivered'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVessel, setFilterVessel] = useState(() => isVesselUser ? String(currentUser.vessel_id) : 'All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [selectedReq, setSelectedReq] = useState<SparePartsRequisition | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    vesselId: isVesselUser ? String(currentUser.vessel_id) : (vessels[0]?.id?.toString() || '1'),
    requisitionRef: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Emergency',
    targetPort: '',
    eta: '',
    remarks: ''
  });

  const [formItems, setFormItems] = useState<Omit<RequisitionItem, 'id'>[]>([
    { partNumber: '', name: '', maker: '', quantity: 1, unit: 'Pcs' }
  ]);

  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    dataUrl?: string;
  } | null>(null);

  // Admin and Team PIC transition state fields
  const [tempTrackingNumber, setTempTrackingNumber] = useState('');
  const [tempEta, setTempEta] = useState('');

  useEffect(() => {
    if (userVesselId) {
      setFilterVessel(userVesselId);
      setFormData(prev => ({ ...prev, vesselId: userVesselId }));
    }
  }, [userVesselId]);

  useEffect(() => {
    localStorage.setItem('comos_spare_requisitions', JSON.stringify(requisitions));
  }, [requisitions]);

  const addFormItemRow = () => {
    setFormItems(prev => [...prev, { partNumber: '', name: '', maker: '', quantity: 1, unit: 'Pcs' }]);
  };

  const removeFormItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormItemChange = (index: number, field: keyof Omit<RequisitionItem, 'id'>, value: any) => {
    setFormItems(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const updateRequisitionStatus = (id: string, newStatus: SparePartsRequisition['status']) => {
    setRequisitions(prev => prev.map(r => {
      if (r.id === id) {
        const updated: SparePartsRequisition = {
          ...r,
          status: newStatus
        };
        if (newStatus === 'In Transit' && tempTrackingNumber) {
          updated.trackingNumber = tempTrackingNumber;
        }
        if (tempEta) {
          updated.eta = tempEta;
        }
        return updated;
      }
      return r;
    }));

    setSelectedReq(prev => {
      if (prev && prev.id === id) {
        const updated = { ...prev, status: newStatus };
        if (newStatus === 'In Transit' && tempTrackingNumber) {
          updated.trackingNumber = tempTrackingNumber;
        }
        if (tempEta) {
          updated.eta = tempEta;
        }
        return updated;
      }
      return prev;
    });

    setTempTrackingNumber('');
    setTempEta('');
  };

  const deleteRequisition = (id: string) => {
    if (window.confirm('Are you sure you want to delete this requisition? This action is irreversible.')) {
      setRequisitions(prev => prev.filter(r => r.id !== id));
      setSelectedReq(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${(file.size / 1024).toFixed(0)} KB`;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFile({
        name: file.name,
        size: sizeStr,
        dataUrl: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadedFile) {
      alert('Please upload/attach the requisition document from the vessel.');
      return;
    }

    const newRef = formData.requisitionRef || `REQ-${new Date().getFullYear()}-${String(requisitions.length + 101).padStart(3, '0')}`;

    const itemsWithIds: RequisitionItem[] = formItems
      .filter(item => item.name.trim() !== '')
      .map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        ...item
      }));

    const newReq: SparePartsRequisition = {
      id: `req-${Date.now()}`,
      requisitionRef: newRef,
      vesselId: formData.vesselId,
      status: 'Pending Review',
      priority: formData.priority,
      dateRequested: new Date().toISOString().split('T')[0],
      targetPort: formData.targetPort || 'Pending Port Confirmation',
      eta: formData.eta || '',
      remarks: formData.remarks,
      items: itemsWithIds,
      documentName: uploadedFile.name,
      documentSize: uploadedFile.size,
      documentDataUrl: uploadedFile.dataUrl
    };

    setRequisitions(prev => [newReq, ...prev]);
    setShowFormModal(false);

    // Reset Form Fields
    setFormData({
      vesselId: userVesselId || vessels[0]?.id?.toString() || '1',
      requisitionRef: '',
      priority: 'Medium',
      targetPort: '',
      eta: '',
      remarks: ''
    });
    setFormItems([{ partNumber: '', name: '', maker: '', quantity: 1, unit: 'Pcs' }]);
    setUploadedFile(null);
  };

  // Restrict to accessible reports
  const accessibleRequisitions = isVesselUser 
    ? requisitions.filter(r => String(r.vesselId) === userVesselId)
    : requisitions;

  const filteredRequisitions = accessibleRequisitions.filter(r => {
    const matchesTab = activeTab === 'All' || r.status === activeTab;
    const matchesVessel = filterVessel === 'All' || r.vesselId === filterVessel;
    const matchesPriority = filterPriority === 'All' || r.priority === filterPriority;

    const matchesSearch = 
      r.requisitionRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.remarks.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.items.some(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.maker.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesTab && matchesVessel && matchesPriority && matchesSearch;
  });

  const stats = {
    total: (filterVessel === 'All' ? accessibleRequisitions : accessibleRequisitions.filter(r => r.vesselId === filterVessel)).length,
    pending: (filterVessel === 'All' ? accessibleRequisitions : accessibleRequisitions.filter(r => r.vesselId === filterVessel)).filter(r => r.status === 'Pending Review').length,
    approved: (filterVessel === 'All' ? accessibleRequisitions : accessibleRequisitions.filter(r => r.vesselId === filterVessel)).filter(r => r.status === 'Approved').length,
    inTransit: (filterVessel === 'All' ? accessibleRequisitions : accessibleRequisitions.filter(r => r.vesselId === filterVessel)).filter(r => r.status === 'In Transit').length,
    delivered: (filterVessel === 'All' ? accessibleRequisitions : accessibleRequisitions.filter(r => r.vesselId === filterVessel)).filter(r => r.status === 'Delivered').length,
    severe: (filterVessel === 'All' ? accessibleRequisitions : accessibleRequisitions.filter(r => r.vesselId === filterVessel)).filter(r => ['High', 'Emergency'].includes(r.priority)).length
  };

  return (
    <div className="space-y-6">
      {/* Visual Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-700 text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg border border-indigo-500/10">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-80 h-32 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 space-y-2">
          <div className="bg-blue-500/30 text-blue-100 px-3 py-1 rounded-full text-xs font-semibold w-max uppercase tracking-wider">
            Vessel Supply Chain
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Spare Parts Requisition</h1>
          <p className="text-blue-100/90 text-sm max-w-2xl leading-relaxed">
            Upload shipboard requisition records, specify materials/machinery spares, plan port deliveries, and monitor supply chains to ensure engine reliability.
          </p>
        </div>

        <button
          onClick={() => setShowFormModal(true)}
          className="absolute right-6 bottom-6 md:right-8 md:bottom-8 bg-white hover:bg-slate-50 text-indigo-700 font-extrabold text-xs tracking-tight uppercase px-5 py-3 rounded-2xl transition-all shadow-md shadow-indigo-900/10 active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Requisition
        </button>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Requests', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Pending Review', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50/40' },
          { label: 'Approved Order', value: stats.approved, color: 'text-blue-600', bg: 'bg-blue-50/40' },
          { label: 'In Transit', value: stats.inTransit, color: 'text-indigo-600', bg: 'bg-indigo-50/40' },
          { label: 'Delivered', value: stats.delivered, color: 'text-emerald-700', bg: 'bg-emerald-50/40' },
          { label: 'Critical / High', value: stats.severe, color: 'text-rose-600', bg: 'bg-rose-50/35' },
        ].map((item, idx) => (
          <div key={idx} className={`${item.bg} p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between`}>
            <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block">{item.label}</span>
            <span className={`text-2xl font-black mt-2 ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Control Panel Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {(['All', 'Pending Review', 'Approved', 'In Transit', 'Delivered'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-tight transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab === 'All' ? 'All Statuses' : tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full md:w-auto md:min-w-[480px]">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search spare parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 font-semibold text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Vessel Selector / Filter status */}
          <select
            value={filterVessel}
            onChange={(e) => setFilterVessel(e.target.value)}
            disabled={!!isVesselUser}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-75"
          >
            {!isVesselUser && <option value="All">All Vessels</option>}
            {allowedVessels.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Priorities</option>
            <option value="Low">Low Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="High">High Priority</option>
            <option value="Emergency">Emergency Priority</option>
          </select>
        </div>
      </div>

      {/* Requisitions List */}
      <div className="space-y-3">
          {filteredRequisitions.length === 0 ? (
            <div className="p-12 bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl text-center">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-bold text-sm">No Requisitions Found</p>
              <p className="text-slate-400 text-xs mt-1">Try resetting the filters or upload a new vessel document.</p>
            </div>
          ) : (
            filteredRequisitions.map(req => {
              const reqVesselName = vessels.find(v => String(v.id) === String(req.vesselId))?.name || 'Unknown';
              
              const priorityStyles = {
                Low: 'bg-slate-50 text-slate-500 border-slate-100',
                Medium: 'bg-blue-50 text-blue-600 border-blue-100/50',
                High: 'bg-amber-50 text-amber-600 border-amber-100/50',
                Emergency: 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse'
              };

              const statusStyles = {
                Draft: 'bg-slate-100 text-slate-600',
                'Pending Review': 'bg-amber-100 text-amber-800',
                Approved: 'bg-blue-100 text-blue-800',
                'In Transit': 'bg-indigo-100 text-indigo-800',
                Delivered: 'bg-emerald-100 text-emerald-800'
              };

              return (
                <div 
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer ${
                    selectedReq?.id === req.id 
                      ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-md' 
                      : 'border-slate-100 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-blue-600 tracking-tight">{req.requisitionRef}</span>
                        <div className="h-1 w-1 bg-slate-300 rounded-full" />
                        <span className="text-[10px] font-black uppercase text-slate-400">{reqVesselName}</span>
                      </div>
                      <h3 className="text-xs font-extrabold text-slate-700 max-w-md line-clamp-1">
                        {req.remarks || `${req.items.length} materials requested`}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black border uppercase px-2 py-0.5 rounded-lg ${priorityStyles[req.priority]}`}>
                        {req.priority}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg ${statusStyles[req.status]}`}>
                        {req.status}
                      </span>
                    </div>
                  </div>

                  {/* List of high-level sub-items */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-4">
                    {req.items.slice(0, 3).map(item => (
                      <span key={item.id} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded-md font-medium border border-slate-100">
                        {item.name} ({item.quantity} {item.unit})
                      </span>
                    ))}
                    {req.items.length > 3 && (
                      <span className="text-[10px] font-bold text-slate-400 px-1">
                        +{req.items.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-4 pt-4 border-t border-slate-100/80">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" /> Req: {req.dateRequested}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-300" /> Port: {req.targetPort}
                      </span>
                    </div>

                    {req.documentName && (
                      <span className="flex items-center gap-1 text-slate-400 font-bold">
                        <Paperclip className="w-3 h-3" /> {req.documentName}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Requisition Details Overlay Modal */}
        {selectedReq && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden my-8 animate-in zoom-in-95 duration-200">
              {/* Card Banner Header */}
              <div className="bg-slate-900 text-white p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg">
                    Requisition Card
                  </span>
                  <div className="flex items-center gap-2">
                    {currentUser?.role !== 'vessel' && (
                      <button 
                        onClick={() => {
                          deleteRequisition(selectedReq.id);
                          setSelectedReq(null);
                        }}
                        className="p-1 px-2.5 bg-rose-600 hover:bg-rose-700 transition-colors text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedReq(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black tracking-tight text-white">{selectedReq.requisitionRef}</h2>
                    <span className="h-1 w-1 bg-slate-600 rounded-full" />
                    <span className="text-xs font-semibold text-slate-300">
                      {vessels.find(v => String(v.id) === String(selectedReq.vesselId))?.name || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Requested Date: {selectedReq.dateRequested}</span>
                </div>
              </div>

              {/* Scrollable Modal Content */}
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-150/40">
                {/* Status Section */}
                <div className="p-6 bg-slate-50/50">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-4">Progress Chain</span>
                  <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1">
                    {(['Pending Review', 'Approved', 'In Transit', 'Delivered'] as const).map((step, idx) => {
                      const stepStatusOrder = ['Pending Review', 'Approved', 'In Transit', 'Delivered'];
                      const currentIdx = stepStatusOrder.indexOf(selectedReq.status);
                      const stepIdx = stepStatusOrder.indexOf(step);

                      const isDone = stepIdx < currentIdx;
                      const isCurrent = stepIdx === currentIdx;

                      return (
                        <div key={step} className="flex flex-col items-center flex-1 min-w-[50px]">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                            isDone ? 'bg-emerald-500 text-white' :
                            isCurrent ? 'bg-blue-600 text-white animate-pulse' :
                            'bg-slate-200 text-slate-500'
                          }`}>
                            {isDone ? <Check className="w-4 h-4" /> : (idx + 1)}
                          </div>
                          <span className={`text-[10px] mt-2 font-bold tracking-tight text-center ${
                            isCurrent ? 'text-blue-600' :
                            isDone ? 'text-emerald-600' :
                            'text-slate-400'
                          }`}>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Items Breakdown */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Itemized Spares ({selectedReq.items.length})</span>
                    <Package className="w-4 h-4 text-slate-300" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
                    {selectedReq.items.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-700 font-extrabold">{item.name}</span>
                            {item.partNumber && (
                              <span className="text-[8px] font-mono bg-slate-200/60 font-medium text-slate-600 px-1 rounded">
                                P/N: {item.partNumber}
                              </span>
                            )}
                          </div>
                          {item.maker && <span className="text-[10px] text-slate-400 block mt-0.5">Maker: {item.maker}</span>}
                        </div>

                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-black shrink-0 text-[11px]">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details & Port */}
                <div className="p-6 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Target Port</span>
                      <span className="font-extrabold text-slate-700 mt-1 block flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" /> {selectedReq.targetPort}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Est. Delivery / Arrival</span>
                      <span className="font-extrabold text-slate-700 mt-1 block flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" /> {selectedReq.eta || 'Pending Schedule'}
                      </span>
                    </div>
                  </div>

                  {selectedReq.trackingNumber && (
                    <div className="p-3.5 bg-indigo-50/30 border border-indigo-100 rounded-xl">
                      <span className="text-[10px] font-black text-indigo-700 uppercase block">Tracking / Logistic Reference</span>
                      <span className="font-mono text-xs font-bold text-indigo-700 block mt-1">{selectedReq.trackingNumber}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Request Remarks / Instructions</span>
                    <p className="text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-150/50 leading-relaxed mt-1 text-xs">
                      {selectedReq.remarks || 'No remarks provided.'}
                    </p>
                  </div>
                </div>

                {/* Verified Requisition File From Vessel */}
                {selectedReq.documentName && (
                  <div className="p-6 space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Original Ship Document</span>
                    
                    <div className="flex items-center justify-between p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100/60 rounded-xl flex items-center justify-center text-blue-600">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 max-w-[140px] md:max-w-[200px]">
                          <span className="text-xs font-black text-slate-700 block truncate">{selectedReq.documentName}</span>
                          <span className="text-[10px] text-slate-400 font-extrabold block uppercase mt-0.5">{selectedReq.documentSize}</span>
                        </div>
                      </div>

                      <div className="flex gap-1.5">
                        {selectedReq.documentDataUrl && (
                          <a 
                            href={selectedReq.documentDataUrl} 
                            download={selectedReq.documentName}
                            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer text-slate-600"
                            title="Download document"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        
                        {selectedReq.documentDataUrl && (
                          <button
                            onClick={() => {
                              const newTab = window.open();
                              if (newTab) {
                                newTab.document.write(`<iframe src="${selectedReq.documentDataUrl}" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`);
                              }
                            }}
                            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer text-slate-600"
                            title="View document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Supply Chain Controls */}
                {currentUser?.role !== 'vessel' && (
                  <div className="p-6 bg-slate-50/80 space-y-4">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Superintendent Pipeline Control</span>
                    </div>

                    <div className="space-y-3">
                      {selectedReq.status === 'Pending Review' && (
                        <button
                          onClick={() => updateRequisitionStatus(selectedReq.id, 'Approved')}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Review & Approve Order
                        </button>
                      )}

                      {selectedReq.status === 'Approved' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Log Logistics Tracking No. (e.g. DHL-291C)"
                            value={tempTrackingNumber}
                            onChange={(e) => setTempTrackingNumber(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button
                            onClick={() => updateRequisitionStatus(selectedReq.id, 'In Transit')}
                            disabled={!tempTrackingNumber}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Truck className="w-4 h-4" /> Dispatch - Set In Transit
                          </button>
                        </div>
                      )}

                      {selectedReq.status === 'In Transit' && (
                        <button
                          onClick={() => updateRequisitionStatus(selectedReq.id, 'Delivered')}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Finalize Delivery & Close-out
                        </button>
                      )}

                      {selectedReq.status === 'Delivered' && (
                        <div className="p-3 bg-emerald-50 text-emerald-800 text-[11px] font-semibold rounded-xl text-center flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed and Delivered to Vessel
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 bg-slate-50 border-t border-slate-150/40">
                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100/50 text-slate-500 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Requisition Document Upload & Creator Modal Form */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white p-6 justify-between flex items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">Store & Spares Form</span>
                <h2 className="text-lg font-black mt-1">Record Spare Parts Requisition</h2>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="text-white/80 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Form Upper Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Requested Vessel</span>
                  <select
                    value={formData.vesselId}
                    onChange={(e) => setFormData(p => ({ ...p, vesselId: e.target.value }))}
                    disabled={!!isVesselUser}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 disabled:opacity-75 disabled:bg-slate-100"
                  >
                    {allowedVessels.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Requisition Ref. No (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. REQ-2026-XYZ (Leave blank for auto-gen)"
                    value={formData.requisitionRef}
                    onChange={(e) => setFormData(p => ({ ...p, requisitionRef: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-700 bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1 col-span-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider font-sans">Priority Level</span>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(p => ({ ...p, priority: e.target.value as any }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50"
                  >
                    <option value="Low">Low - routine storage</option>
                    <option value="Medium">Medium - wear & tear scheduled</option>
                    <option value="High">High - critical safety margin</option>
                    <option value="Emergency">Emergency - secondary system failure</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Target delivery port</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Singapore Port, Rotterdam Terminal"
                    value={formData.targetPort}
                    onChange={(e) => setFormData(p => ({ ...p, targetPort: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-700 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Document upload box */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Req Document from Vessel (MANDATORY PDF/XLSX)</span>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50/20' 
                      : uploadedFile 
                        ? 'border-emerald-300 bg-emerald-50/10' 
                        : 'border-slate-200 hover:border-slate-350 bg-slate-50/30'
                  }`}
                >
                  <input
                    type="file"
                    id="req-file-input"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileInput}
                    accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg"
                  />
                  
                  {uploadedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-700">{uploadedFile.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Size: {uploadedFile.size} - Ready to submit</p>
                      </div>
                      <span className="text-[9px] font-sans font-extrabold text-blue-600 mt-2 bg-blue-50 px-2 py-0.5 rounded uppercase">Click or Drag to replace file</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">Drag & Drop Requisition Document</p>
                        <p className="text-[10px] text-slate-400">PDF, Excel spreadsheet or scanned purchase sheet</p>
                      </div>
                      <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] font-extrabold rounded-lg shadow-2xs mt-1">Browse Ship Files</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Items list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Required Materials / Spare Parts</span>
                  <button
                    type="button"
                    onClick={addFormItemRow}
                    className="px-3 py-1 bg-blue-52 bg-blue-50 hover:bg-blue-100 text-blue-600 font-extrabold text-[10px] rounded-lg cursor-pointer transition-colors"
                  >
                    + Add Spare Item
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {formItems.map((item, index) => (
                    <div key={index} className="flex gap-2.5 items-center bg-slate-50/50 p-3 rounded-xl border border-slate-150/40 relative group">
                      <div className="grid grid-cols-12 gap-2 flex-1">
                        {/* Part No */}
                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="Part Number"
                            value={item.partNumber}
                            onChange={(e) => handleFormItemChange(index, 'partNumber', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
                          />
                        </div>

                        {/* Item Name */}
                        <div className="col-span-4">
                          <input
                            type="text"
                            required
                            placeholder="Spare Name / Description *"
                            value={item.name}
                            onChange={(e) => handleFormItemChange(index, 'name', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                          />
                        </div>

                        {/* Maker */}
                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="Maker/Machinery"
                            value={item.maker}
                            onChange={(e) => handleFormItemChange(index, 'maker', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
                          />
                        </div>

                        {/* Qty */}
                        <div className="col-span-2 flex gap-1 items-center">
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleFormItemChange(index, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-center focus:outline-none"
                          />
                          <select
                            value={item.unit}
                            onChange={(e) => handleFormItemChange(index, 'unit', e.target.value)}
                            className="px-1 py-1.5 bg-white border border-slate-250 border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none text-slate-600"
                          >
                            <option value="Pcs">Pcs</option>
                            <option value="Set">Set</option>
                            <option value="Mtrs">Mtrs</option>
                            <option value="Kgs">Kgs</option>
                            <option value="Sets">Sets</option>
                          </select>
                        </div>
                      </div>

                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFormItemRow(index)}
                          className="p-1 px-2.5 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:border-rose-200 hover:text-rose-600 rounded-xl transition-all cursor-pointer text-slate-400 self-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks block */}
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Instructions or superintendent remarks</span>
                <textarea
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))}
                  placeholder="e.g. Include specific certifications requirements, supplier coordinates, or priority justifications..."
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none text-slate-600 h-20 resize-none"
                />
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100/50 text-slate-500 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-colors shadow-md shadow-blue-100 flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
