import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  X, 
  Upload, 
  FileText, 
  Download, 
  Eye, 
  Calendar, 
  Anchor, 
  Paperclip, 
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Lock
} from 'lucide-react';

interface RequisitionItem {
  id: string;
  partNumber: string;
  name: string;
  maker: string;
  quantity: number;
  unit: string;
}

interface FileDoc {
  name: string;
  size: string;
  dataUrl?: string;
  uploadedAt?: number;
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

  // New requested state fields supporting multi-file uploads
  subject?: string;
  requisitionFiles?: FileDoc[];

  quotationPoNumber?: string;
  quotationDate?: string;
  quotationFiles?: FileDoc[];

  invoicePoNumber?: string;
  invoiceDate?: string;
  invoiceFiles?: FileDoc[];

  deliveryNotePoNumber?: string;
  deliveryNoteDate?: string;
  deliveryNoteFiles?: FileDoc[];

  messages?: Array<{
    id: string;
    sender: string;
    text: string;
    timestamp: string;
  }>;
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
  title?: string;
  storageKey?: string;
  token?: string;
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
    remarks: 'Main Engine Cylinder Head O-Rings and gaskets overhaul',
    subject: 'Main Engine Cylinder Head O-Rings and gaskets overhaul',
    items: [
      { id: 'item-1', partNumber: 'ME-CO-010', name: 'O-Ring Cylinder Head', maker: 'MAN B&W', quantity: 12, unit: 'Pcs' },
      { id: 'item-2', partNumber: 'ME-GK-412', name: 'Gasket Exhaust Valve', maker: 'MAN B&W', quantity: 6, unit: 'Pcs' }
    ],
    documentName: 'ME_Cylinder_Head_Spares_V1.pdf',
    documentSize: '1.2 MB',
    requisitionFiles: [
      {
        name: 'ME_Cylinder_Head_Spares_V1.pdf',
        size: '1.2 MB'
      }
    ],
    quotationPoNumber: 'PO-2026-441-ME',
    quotationDate: '2026-05-12',
    quotationFiles: [
      {
        name: 'OEM_MAN_Parts_Quotation.pdf',
        size: '640 KB'
      }
    ],
    invoicePoNumber: 'PO-2026-441-ME',
    invoiceDate: '2026-05-14',
    invoiceFiles: [
      {
        name: 'MAN_B&W_Invoice_Paid.pdf',
        size: '410 KB'
      }
    ],
    deliveryNotePoNumber: 'PO-2026-441-ME',
    deliveryNoteDate: '2026-05-20',
    deliveryNoteFiles: [
      {
        name: 'Singapore_Port_Delivery_Note.pdf',
        size: '350 KB'
      }
    ],
    messages: [
      { id: 'm1', sender: 'Chief Engineer', text: 'Spares urgently required before the Singapore canal transit.', timestamp: '2026-05-10 09:30' },
      { id: 'm2', sender: 'Superintendent', text: 'Quotation approved and PO dispatched. Please confirm delivery details once received.', timestamp: '2026-05-12 14:15' }
    ],
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
    remarks: 'Emergency replenishment of hydraulic pump spares',
    subject: 'Emergency hydraulic pump spares for steering gear system',
    items: [
      { id: 'item-3', partNumber: 'HY-PP-092', name: 'Hydraulic Seals Kit', maker: 'Rexroth', quantity: 2, unit: 'Set' },
      { id: 'item-4', partNumber: 'HY-VLV-11', name: 'Solenoid Directional Valve', maker: 'Rexroth', quantity: 1, unit: 'Pc' }
    ],
    documentName: 'Hydraulic_Pump_Req_Rotterdam.pdf',
    documentSize: '840 KB',
    requisitionFiles: [
      {
        name: 'Hydraulic_Pump_Req_Rotterdam.pdf',
        size: '840 KB'
      }
    ],
    messages: [
      { id: 'm3', sender: 'Chief Engineer', text: 'Steering gear port side has high leakages. Emergency spares needed.', timestamp: '2026-05-18 11:22' }
    ]
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
    remarks: 'Purifier overhaul spares scheduled for next major drydock planning',
    subject: 'Purifier unit overhaul replacement spare parts pack',
    items: [
      { id: 'item-5', partNumber: 'PF-BRG-201', name: 'Bowl Spindle Bearing', maker: 'Alfa Laval', quantity: 4, unit: 'Pcs' }
    ],
    documentName: 'AlfaLaval_Purifier_Overhaul_Req.xlsx',
    documentSize: '320 KB',
    requisitionFiles: [
      {
        name: 'AlfaLaval_Purifier_Overhaul_Req.xlsx',
        size: '320 KB'
      }
    ],
    quotationPoNumber: 'PO-8827-C',
    quotationDate: '2026-05-16',
    quotationFiles: [
      {
        name: 'Alfa_Laval_Houston_Quote.pdf',
        size: '220 KB'
      }
    ],
    messages: [
      { id: 'm4', sender: 'Superintendent', text: 'Spares cleared for transit planning. Delivery to Houston scheduled.', timestamp: '2026-05-17 16:40' }
    ]
  }
];

interface CommunicationLogSectionProps {
  req: SparePartsRequisition;
  currentUser: any;
  vessels: any[];
  msgText: string;
  setMsgText: (val: string) => void;
  sendNewMessage: (reqId: string) => void;
}

const CommunicationLogSection: React.FC<CommunicationLogSectionProps> = ({
  req,
  currentUser,
  vessels = [],
  msgText,
  setMsgText,
  sendNewMessage,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    const timeout = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timeout);
  }, [req.messages]);

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-3xs space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <MessageSquare className="w-4 h-4 text-slate-400" />
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Communication & Activity Logs</h4>
      </div>

      {/* Chat Messages Log */}
      <div 
        ref={scrollContainerRef}
        className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 scroll-smooth"
      >
        {(!req.messages || req.messages.length === 0) ? (
          <p className="text-xs text-slate-400 font-semibold italic text-center py-3">No log records or messages logged yet. Use the command box below to post update logs.</p>
        ) : (
          req.messages.map(msg => {
            const isSystem = msg.sender === 'System Log';
            if (isSystem) {
              return (
                <div key={msg.id} className="flex items-center justify-center p-2 my-1 bg-slate-50 border border-slate-150 rounded-xl px-4 py-1.5 w-max mx-auto text-[10px] font-extrabold text-slate-500 gap-1.5 shadow-3xs">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                  <span>{msg.text}</span>
                  <span className="text-[9px] text-slate-400 font-extrabold">• {msg.timestamp}</span>
                </div>
              );
            }

            const isMe = msg.sender === (currentUser?.role === 'vessel' 
              ? ((vessels || []).find((v: any) => String(v.id) === String(currentUser.vessel_id))?.name || 'Vessel')
              : (currentUser?.username || 'Superintendent'));

            return (
              <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 mb-0.5">
                  <span>{msg.sender}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-3xs ${
                  isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Msg Input Area */}
      <div className="flex items-center gap-2 pt-2">
        <input
          type="text"
          placeholder="Post update details or type message..."
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendNewMessage(req.id);
            }
          }}
          className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 placeholder-slate-450 bg-slate-50"
        />
        <button
          onClick={() => sendNewMessage(req.id)}
          className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer transition-colors active:scale-95 flex items-center justify-center shrink-0"
          title="Post Log Message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const SparePartsRequisitionView: React.FC<SparePartsRequisitionProps> = ({ 
  vessels = [], 
  currentUser,
  title = "Spare Parts Requisition Board",
  storageKey = "comos_spare_requisitions",
  token
}) => {
  const isVesselUser = currentUser?.role === 'vessel' && currentUser?.vessel_id;
  const isAdminOrPic = currentUser?.role === 'admin' || currentUser?.role === 'team_pic';
  const userVesselId = isVesselUser ? String(currentUser.vessel_id) : null;
  const allowedVessels = isVesselUser 
    ? (vessels || []).filter(v => String(v.id) === String(currentUser.vessel_id))
    : (vessels || []);

  const [requisitions, setRequisitions] = useState<SparePartsRequisition[]>([]);
  const [loading, setLoading] = useState(false);

  // Secure file pointer helper URL resolver
  const getFileUrl = (url: string | undefined) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    if (token) {
      const glue = url.includes('?') ? '&' : '?';
      return `${url}${glue}token=${encodeURIComponent(token)}`;
    }
    return url;
  };

  const fetchRequisitions = async () => {
    if (!token) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const normed = parsed.map((r: any) => {
            const norm: SparePartsRequisition = { ...r };
            if (r.requisitionFile && !r.requisitionFiles) {
              norm.requisitionFiles = [r.requisitionFile];
            }
            if (r.quotationFile && !r.quotationFiles) {
              norm.quotationFiles = [r.quotationFile];
            }
            if (r.invoiceFile && !r.invoiceFiles) {
              norm.invoiceFiles = [r.invoiceFile];
            }
            if (r.deliveryNoteFile && !r.deliveryNoteFiles) {
              norm.deliveryNoteFiles = [r.deliveryNoteFile];
            }
            norm.requisitionFiles = norm.requisitionFiles || [];
            norm.quotationFiles = norm.quotationFiles || [];
            norm.invoiceFiles = norm.invoiceFiles || [];
            norm.deliveryNoteFiles = norm.deliveryNoteFiles || [];
            return norm;
          });
          setRequisitions(normed);
          return;
        } catch (e) {
          console.error(e);
        }
      }
      const initial = storageKey === 'comos_spare_requisitions' ? INITIAL_REQUISITIONS : [
        {
          id: 'sc-1',
          requisitionRef: 'REQ-SC-2026-001',
          vesselId: '1',
          status: 'In Transit',
          priority: 'Medium',
          dateRequested: '2026-05-12',
          targetPort: 'Singapore',
          eta: '2026-05-28',
          remarks: 'Cabin stores, safety hand cleaners, and engine room degreaser chemicals.',
          subject: 'Monthly Stores & Chemical Replenishment',
          items: [
            { id: 'sc-item-1', partNumber: 'SC-CAB-01', name: 'Hand Soap (Heavy Duty)', maker: 'Unitor', quantity: 10, unit: 'Cans' },
            { id: 'sc-item-2', partNumber: 'SC-CHM-05', name: 'Oil & Degreaser Chemical', maker: 'Wilhelmsen', quantity: 5, unit: 'Drums' }
          ],
          documentName: 'Stores_Chemicals_Req_May2026.pdf',
          documentSize: '450 KB',
          requisitionFiles: [
            {
              name: 'Stores_Chemicals_Req_May2026.pdf',
              size: '450 KB'
            }
          ],
          messages: []
        }
      ];
      setRequisitions(initial as any);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/spare-parts-requisitions?storageKey=${encodeURIComponent(storageKey)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setRequisitions(data);
      }
    } catch (err) {
      console.error('Failed to fetch requisitions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, [token, storageKey]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVessel, setFilterVessel] = useState(() => isVesselUser ? String(currentUser.vessel_id) : 'All');
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [msgTexts, setMsgTexts] = useState<{ [reqId: string]: string }>({});
  const [previewFile, setPreviewFile] = useState<{ name: string; size: string; dataUrl?: string } | null>(null);

  // Input creation form states
  const [formData, setFormData] = useState({
    vesselId: isVesselUser ? String(currentUser.vessel_id) : (vessels[0]?.id?.toString() || '1'),
    dateRequested: new Date().toISOString().split('T')[0],
    subject: '',
    requisitionRef: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Emergency',
    targetPort: '',
    remarks: ''
  });

  const [uploadedFiles, setUploadedFiles] = useState<{
    name: string;
    size: string;
    dataUrl?: string;
  }[]>([]);

  useEffect(() => {
    if (userVesselId) {
      setFilterVessel(userVesselId);
      setFormData(prev => ({ ...prev, vesselId: userVesselId }));
    }
  }, [userVesselId]);

  useEffect(() => {
    try {
      const sanitized = JSON.stringify(requisitions, (key, value) => {
        if (typeof value === 'string' && (key.toLowerCase().includes('dataurl') || key.toLowerCase().includes('base64') || value.startsWith('data:'))) {
          if (value.length > 200) {
            return "[omitted base64 payload]";
          }
        }
        return value;
      });
      localStorage.setItem(storageKey, sanitized);
    } catch (err) {
      console.warn("localStorage quota exceeded, skipped local persistence of requisitions list:", err);
    }
  }, [requisitions, storageKey]);

  const handleFileDropGeneral = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processCreationFiles = (filesList: FileList | null) => {
    if (!filesList) return;
    const filesArray = Array.from(filesList);
    const baseTime = Date.now();
    filesArray.forEach((file, index) => {
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(file.size / 1024).toFixed(0)} KB`;

      const reader = new FileReader();
      reader.onload = () => {
        setUploadedFiles(prev => {
          const newList = [
            ...prev,
            {
              name: file.name,
              size: sizeStr,
              dataUrl: reader.result as string,
              uploadedAt: baseTime + index
            }
          ];
          return newList.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const updateRequisitionField = async (id: string, updates: Partial<SparePartsRequisition>) => {
    const currentReq = requisitions.find(r => r.id === id);
    if (!currentReq) return;
    const updated = { ...currentReq, ...updates };

    if (token) {
      try {
        const resp = await fetch(`/api/spare-parts-requisitions/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updated)
        });
        if (resp.ok) {
          fetchRequisitions();
        } else {
          const err = await resp.json();
          alert(`Failed to update requisition: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to update requisition:', err);
      }
    } else {
      setRequisitions(prev => prev.map(r => r.id === id ? updated : r));
    }
  };

  const addFileToSection = (reqId: string, section: 'requisitionFiles' | 'quotationFiles' | 'invoiceFiles' | 'deliveryNoteFiles', file: File) => {
    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${(file.size / 1024).toFixed(0)} KB`;

    const reader = new FileReader();
    reader.onload = () => {
      const currentReq = requisitions.find(r => r.id === reqId);
      if (!currentReq) return;

      const currentList = currentReq[section] || [];
      const updatedList = [
        ...currentList,
        {
          name: file.name,
          size: sizeStr,
          dataUrl: reader.result as string,
          uploadedAt: Date.now()
        }
      ];
      updatedList.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
      updateRequisitionField(reqId, { [section]: updatedList });
    };
    reader.readAsDataURL(file);
  };

  const removeFileFromSection = (reqId: string, section: 'requisitionFiles' | 'quotationFiles' | 'invoiceFiles' | 'deliveryNoteFiles', fileIndex: number) => {
    const currentReq = requisitions.find(r => r.id === reqId);
    if (!currentReq) return;

    const currentList = currentReq[section] || [];
    const updatedList = currentList.filter((_, idx) => idx !== fileIndex);
    updateRequisitionField(reqId, { [section]: updatedList });
  };

  const deleteRequisition = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this requisition? This action is irreversible.')) return;

    if (token) {
      try {
        const resp = await fetch(`/api/spare-parts-requisitions/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
          fetchRequisitions();
          if (expandedReqId === id) {
            setExpandedReqId(null);
          }
        } else {
          const err = await resp.json();
          alert(`Failed to delete requisition: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to delete requisition:', err);
      }
    } else {
      setRequisitions(prev => prev.filter(r => r.id !== id));
      if (expandedReqId === id) {
        setExpandedReqId(null);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadedFiles.length === 0) {
      setFormError('Please upload at least one requisition or ship document using the file upload button.');
      return;
    }
    setFormError(null);

    const newRef = formData.requisitionRef || `REQ-${new Date().getFullYear()}-${String(requisitions.length + 101).padStart(3, '0')}`;
    const finalSubject = formData.subject || `Requisition ${newRef}`;

    const newReq: SparePartsRequisition = {
      id: `req-${Date.now()}`,
      requisitionRef: newRef,
      vesselId: formData.vesselId,
      status: 'Pending Review',
      priority: formData.priority,
      dateRequested: formData.dateRequested,
      targetPort: formData.targetPort || 'Pending Port Confirmation',
      eta: '',
      remarks: formData.remarks,
      subject: finalSubject,
      items: [],
      documentName: uploadedFiles[0]?.name || '',
      documentSize: uploadedFiles[0]?.size || '',
      documentDataUrl: uploadedFiles[0]?.dataUrl || '',
      requisitionFiles: uploadedFiles,
      messages: []
    };

    if (token) {
      try {
        const resp = await fetch(`/api/spare-parts-requisitions?storageKey=${encodeURIComponent(storageKey)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newReq)
        });
        if (resp.ok) {
          fetchRequisitions();
        } else {
          const err = await resp.json();
          alert(`Failed to create requisition: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to post requisition:', err);
      }
    } else {
      setRequisitions(prev => [newReq, ...prev]);
    }

    setShowFormModal(false);

    // Reset fields
    setFormData({
      vesselId: userVesselId || vessels[0]?.id?.toString() || '1',
      dateRequested: new Date().toISOString().split('T')[0],
      subject: '',
      requisitionRef: '',
      priority: 'Medium',
      targetPort: '',
      remarks: ''
    });
    setUploadedFiles([]);
  };

  const sendNewMessage = async (reqId: string) => {
    const text = msgTexts[reqId] || '';
    if (!text.trim()) return;

    const currentReq = requisitions.find(r => r.id === reqId);
    if (!currentReq) return;

    const senderRoleName = currentUser?.role === 'vessel' 
      ? (vessels.find(v => String(v.id) === String(currentUser.vessel_id))?.name || 'Vessel')
      : (currentUser?.username || 'Superintendent');

    const newMsg = {
      id: `m-${Date.now()}`,
      sender: senderRoleName,
      text: text,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    const updatedMessages = [...(currentReq.messages || []), newMsg];
    await updateRequisitionField(reqId, { messages: updatedMessages });
    setMsgTexts(prev => ({ ...prev, [reqId]: '' }));
  };

  // Filter logic
  const accessibleRequisitions = isVesselUser 
    ? requisitions.filter(r => String(r.vesselId) === userVesselId)
    : requisitions;

  const filteredRequisitions = accessibleRequisitions.filter(r => {
    const matchesVessel = filterVessel === 'All' || r.vesselId === filterVessel;
    const finalSubject = r.subject || r.remarks || '';
    const reqVesselName = vessels.find(v => String(v.id) === String(r.vesselId))?.name || '';
    
    const matchesSearch = 
      r.requisitionRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finalSubject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reqVesselName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesVessel && matchesSearch;
  });

  const isStoreChemicals = storageKey === 'comos_store_chemical_requisitions';

  return (
    <div className="space-y-6">
      {/* Visual Header Banner */}
      <div className={`bg-gradient-to-r text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg border flex flex-col md:flex-row md:items-center md:justify-between gap-6 ${
        isStoreChemicals 
          ? 'from-teal-950 to-emerald-900 border-teal-850/50' 
          : 'from-slate-900 to-slate-800 border-slate-700/50'
      }`}>
        <div className={`absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
          isStoreChemicals ? 'bg-emerald-500/10' : 'bg-blue-500/10'
        }`} />
        
        <div className="relative z-10 space-y-2 flex-1">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold w-max uppercase tracking-wider font-mono ${
            isStoreChemicals 
              ? 'bg-emerald-500/30 text-emerald-100' 
              : 'bg-blue-500/30 text-blue-100'
          }`}>
            {isStoreChemicals ? 'Store & Chemical Pipeline' : 'Supply Pipeline Manager'}
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            {title}
          </h1>
          <p className="text-slate-300 text-sm max-w-xl leading-relaxed font-medium">
            {isStoreChemicals 
              ? 'Easily manage life-cycles of shipboard consumables and chemical orders. Track quotations, safety listings, and delivery notes.'
              : 'Easily manage life-cycles of shipboard marine machinery orders. Track quotations, purchase accounts, and final delivery receipts inline.'}
          </p>
        </div>

        <button
          onClick={() => setShowFormModal(true)}
          className={`relative z-20 shrink-0 self-start md:self-center text-white font-extrabold text-xs tracking-tight uppercase px-5 py-3 rounded-2xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer hover:shadow-lg ${
            isStoreChemicals 
              ? 'bg-emerald-600 hover:bg-emerald-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <Plus className="w-4 h-4" /> Log New Requisition
        </button>
      </div>

      {/* Filter and Control Panel bar */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Requisition Fleet Overview</label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full md:w-auto md:min-w-[480px]">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by vessel, reference, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Vessel Selector */}
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
        </div>
      </div>

      {/* Requisitions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin mb-4" />
            <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">
              Retrieving {isStoreChemicals ? 'Store & Chemical Requisitions' : 'Spare Parts Requisitions'}...
            </span>
          </div>
        ) : filteredRequisitions.length === 0 ? (
          <div className="p-12 bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-bold text-sm">No Requisitions Found</p>
            <p className="text-slate-400 text-xs mt-1">Reset your filters or add a new log to see results.</p>
          </div>
        ) : (
          filteredRequisitions.map(req => {
            const reqVesselName = vessels.find(v => String(v.id) === String(req.vesselId))?.name || 'Unknown Vessel';
            const reqSubject = req.subject || req.remarks || 'No Subject Defined';
            const isExpanded = expandedReqId === req.id;

            return (
              <div 
                key={req.id} 
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isExpanded 
                    ? 'border-blue-500 ring-4 ring-blue-500/5 shadow-md' 
                    : 'border-slate-100 hover:border-slate-200 shadow-sm'
                }`}
              >
                {/* Minimized View Header (Always Visible) */}
                <div 
                  onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-white hover:bg-slate-50/10 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span 
                      id={`vessel-badge-${req.id}`}
                      className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-black rounded-lg uppercase tracking-tight flex items-center gap-1 shrink-0"
                    >
                      <Anchor className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {reqVesselName}
                    </span>
                    <span 
                      id={`date-badge-${req.id}`}
                      className="text-slate-500 text-xs font-extrabold flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150"
                    >
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {req.dateRequested}
                    </span>
                    <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-tight border ${
                      req.priority === 'Emergency' ? 'bg-red-50 text-red-700 border-red-200' :
                      req.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      req.priority === 'Medium' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {req.priority}
                    </span>
                    <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-tight border ${
                      req.status === 'Draft' || req.status === 'Pending Review' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      req.status === 'Approved' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      req.status === 'In Transit' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <div className="flex-1 md:px-4 text-slate-800 text-sm font-bold tracking-tight">
                    {reqSubject}
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-auto">
                    {(isAdminOrPic || (isVesselUser && String(req.vesselId) === userVesselId) || !currentUser) && (
                      <button
                        onClick={(e) => deleteRequisition(req.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer mr-1"
                        title="Delete Requisition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <span className="text-blue-600 text-xs font-extrabold flex items-center gap-1">
                      {isExpanded ? (
                        <>Collapse <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>Expand <ChevronDown className="w-4 h-4" /></>
                      )}
                    </span>
                  </div>
                </div>

                {/* Expanded Sections (Visible only when expandedReqId === req.id) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-55 p-5 md:p-6 space-y-6">
                    {/* Interactive Pipeline State Bar */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in duration-300">
                      <div className="space-y-1 md:max-w-xs">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Current Status & Stage</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg border uppercase tracking-tight ${
                            req.status === 'Draft' || req.status === 'Pending Review' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            req.status === 'Approved' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            req.status === 'In Transit' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {req.status}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs font-extrabold text-slate-500">Ref: {req.requisitionRef}</span>
                        </div>
                      </div>

                      {/* Interactive Steps */}
                      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap flex-1 justify-end max-w-2xl">
                        {(['Pending Review', 'Approved', 'In Transit', 'Delivered'] as const).map((st, sIdx) => {
                          const stages = ['Pending Review', 'Approved', 'In Transit', 'Delivered'];
                          const currentIdx = stages.indexOf(req.status);
                          const thisIdx = stages.indexOf(st);
                          const isDone = thisIdx <= currentIdx;
                          const isActive = st === req.status;

                          let colorClass = "bg-slate-50/50 text-slate-400 border-slate-205";
                          if (isDone) {
                            if (st === 'Pending Review') colorClass = "bg-blue-50 text-blue-700 border-blue-200";
                            else if (st === 'Approved') colorClass = "bg-amber-50 text-amber-700 border-amber-200";
                            else if (st === 'In Transit') colorClass = "bg-purple-50 text-purple-700 border-purple-200";
                            else colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                          }

                          return (
                            <button
                              key={st}
                              onClick={() => {
                                updateRequisitionField(req.id, { status: st });
                                const senderName = currentUser?.role === 'vessel' 
                                  ? (vessels.find(v => String(v.id) === String(currentUser.vessel_id))?.name || 'Vessel')
                                  : (currentUser?.username || 'Superintendent');
                                const logMsg = {
                                  id: `msg-${Date.now()}`,
                                  sender: 'System Log',
                                  text: `${senderName} updated status to "${st}"`,
                                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
                                };
                                const updatedMessages = [...(req.messages || []), logMsg];
                                updateRequisitionField(req.id, { messages: updatedMessages });
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-[11px] font-black tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 shrink-0 ${colorClass} ${
                                isActive ? 'ring-2 ring-offset-1' : ''
                              } ${
                                isActive && st === 'Pending Review' ? 'ring-blue-500/30 font-black' :
                                isActive && st === 'Approved' ? 'ring-amber-500/30 font-black' :
                                isActive && st === 'In Transit' ? 'ring-purple-500/30 font-black' :
                                isActive && st === 'Delivered' ? 'ring-emerald-500/30 font-black' : ''
                              } hover:scale-[1.02] active:scale-[0.98]`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isDone 
                                  ? (st === 'Pending Review' ? 'bg-blue-500' :
                                     st === 'Approved' ? 'bg-amber-500' :
                                     st === 'In Transit' ? 'bg-purple-500' : 'bg-emerald-500')
                                  : 'bg-slate-300'
                              } ${isActive ? 'animate-ping' : ''}`} />
                              {st === 'Pending Review' ? 'Requisition' :
                               st === 'Approved' ? 'Quotation' :
                               st === 'In Transit' ? 'Logistics' : 'Delivery'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* The Horizontal Split (4 Columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Section 1: Requisition */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-lg flex flex-col justify-between space-y-4 transition-all duration-200">
                        <div className="space-y-3.5">
                          <h3 id={`req-sec-header-${req.id}`} className="text-xs font-black text-blue-800 bg-blue-50/70 border border-blue-100/80 px-3 py-2 rounded-lg uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              Requisition
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          </h3>

                          <div className="space-y-2.5 text-xs">
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Vessel Name</span>
                              <span className="font-extrabold text-slate-800 mt-0.5 block">{reqVesselName}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Date Requested</span>
                                <input 
                                  type="date" 
                                  value={req.dateRequested || ''} 
                                  onChange={(e) => updateRequisitionField(req.id, { dateRequested: e.target.value })}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 bg-slate-50 mt-1"
                                />
                              </div>

                              <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Importance</span>
                                <select 
                                  value={req.priority} 
                                  onChange={(e) => {
                                    const newPriority = e.target.value as 'Low' | 'Medium' | 'High' | 'Emergency';
                                    updateRequisitionField(req.id, { priority: newPriority });
                                    const senderName = currentUser?.role === 'vessel' 
                                      ? (vessels.find(v => String(v.id) === String(currentUser.vessel_id))?.name || 'Vessel')
                                      : (currentUser?.username || 'Superintendent');
                                    const logMsg = {
                                      id: `msg-${Date.now()}`,
                                      sender: 'System Log',
                                      text: `${senderName} changed importance level to "${newPriority}"`,
                                      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
                                    };
                                    const updatedMessages = [...(req.messages || []), logMsg];
                                    updateRequisitionField(req.id, { messages: updatedMessages });
                                  }}
                                  className={`w-full px-2 py-1.5 border rounded-lg text-xs font-extrabold focus:outline-none focus:ring-2 mt-1 cursor-pointer ${
                                    req.priority === 'Emergency' ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500/10' :
                                    req.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200 focus:ring-orange-500/10' :
                                    req.priority === 'Medium' ? 'bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-500/10' :
                                    'bg-slate-50 text-slate-600 border-slate-200 focus:ring-slate-500/10'
                                  }`}
                                >
                                  <option value="Low" className="bg-white text-slate-800">Low</option>
                                  <option value="Medium" className="bg-white text-slate-800">Medium</option>
                                  <option value="High" className="bg-white text-slate-800">High</option>
                                  <option value="Emergency" className="bg-white text-slate-800">Emergency</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Subject</span>
                              <textarea 
                                value={req.subject || ''} 
                                onChange={(e) => updateRequisitionField(req.id, { subject: e.target.value })}
                                placeholder="Enter subject/summary..."
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 bg-slate-50 mt-1 h-16 resize-none leading-normal"
                              />
                            </div>
                          </div>
                        </div>

                        {/* File Upload / View for Section 1 */}
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Attachments ({(req.requisitionFiles || []).length})</span>
                          
                          {(req.requisitionFiles && req.requisitionFiles.length > 0) ? (
                            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                              {req.requisitionFiles.map((f, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/60 text-xs font-bold text-slate-600 space-y-1.5 shadow-3xs">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span className="truncate text-slate-700 font-extrabold" title={f.name}>{f.name}</span>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => removeFileFromSection(req.id, 'requisitionFiles', idx)}
                                      className="text-slate-400 hover:text-red-500 p-0.5 shrink-0 hover:bg-slate-200/50 rounded transition-colors"
                                      title="Remove attachment"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold px-1 border-t border-slate-100/60 pt-1">
                                    <span>{f.size}</span>
                                    <div className="flex gap-2">
                                      {f.dataUrl && (
                                        <a 
                                          href={getFileUrl(f.dataUrl)} 
                                          download={f.name}
                                          className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                                        >
                                          <Download className="w-2.5 h-2.5" /> Get
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setPreviewFile(f)}
                                        className="text-slate-500 hover:text-slate-700 font-black flex items-center gap-0.5"
                                      >
                                        <Eye className="w-2.5 h-2.5" /> View
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic font-semibold">No files uploaded</p>
                          )}

                          <div className="relative">
                            <input 
                              type="file" 
                              multiple
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(e) => {
                                if (e.target.files) {
                                  Array.from(e.target.files).forEach((file: File) => {
                                    addFileToSection(req.id, 'requisitionFiles', file);
                                  });
                                }
                              }}
                            />
                            <div className="w-full py-1.5 px-3 border border-dashed border-slate-200 hover:border-blue-500 rounded-lg text-center text-[10px] font-black text-slate-550 cursor-pointer flex items-center justify-center gap-1 transition-all bg-slate-50/50 hover:bg-white">
                              <Upload className="w-3 h-3 text-slate-400" /> + Add File
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Quotation */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-lg flex flex-col justify-between space-y-4 transition-all duration-200">
                        <div className="space-y-3.5">
                          <h3 id={`quote-sec-header-${req.id}`} className="text-xs font-black text-amber-800 bg-amber-50/70 border border-amber-100/80 px-3 py-2 rounded-lg uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Quotation
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          </h3>

                          <div className="space-y-2.5 text-xs">
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">PO Number</span>
                              <input 
                                type="text" 
                                placeholder={isAdminOrPic ? "Enter PO Number..." : "Not specified"}
                                value={req.quotationPoNumber || ''} 
                                onChange={(e) => updateRequisitionField(req.id, { quotationPoNumber: e.target.value })}
                                disabled={!isAdminOrPic}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 bg-slate-50 mt-1 disabled:opacity-75 disabled:cursor-not-allowed"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Date</span>
                              <input 
                                type="date" 
                                value={req.quotationDate || ''} 
                                onChange={(e) => updateRequisitionField(req.id, { quotationDate: e.target.value })}
                                disabled={!isAdminOrPic}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 bg-slate-50 mt-1 disabled:opacity-75 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                        </div>

                        {/* File upload for Quotation */}
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Attachments ({(req.quotationFiles || []).length})</span>
                          
                          {!isAdminOrPic ? (
                            <div className="p-3 bg-red-50/45 rounded-xl border border-red-100/30 text-center space-y-1">
                              <Lock className="w-3.5 h-3.5 text-red-500 mx-auto" />
                              <p className="text-[10px] text-red-700 font-extrabold uppercase tracking-wider">Restricted Access</p>
                              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                Quotation attachments restrictively paired to Admin and PIC users.
                              </p>
                            </div>
                          ) : (
                            <>
                              {(req.quotationFiles && req.quotationFiles.length > 0) ? (
                                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                                  {req.quotationFiles.map((f, idx) => (
                                    <div key={idx} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/60 text-xs font-bold text-slate-600 space-y-1.5 shadow-3xs">
                                      <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                          <span className="truncate text-slate-700 font-extrabold" title={f.name}>{f.name}</span>
                                        </div>
                                        {isAdminOrPic && (
                                          <button 
                                            type="button"
                                            onClick={() => removeFileFromSection(req.id, 'quotationFiles', idx)}
                                            className="text-slate-400 hover:text-red-500 p-0.5 shrink-0 hover:bg-slate-200/50 rounded transition-colors"
                                            title="Remove attachment"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold px-1 border-t border-slate-100/60 pt-1">
                                        <span>{f.size}</span>
                                        <div className="flex gap-2">
                                          {f.dataUrl && (
                                            <a 
                                              href={getFileUrl(f.dataUrl)} 
                                              download={f.name}
                                              className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                                            >
                                              <Download className="w-2.5 h-2.5" /> Get
                                            </a>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => setPreviewFile(f)}
                                            className="text-slate-500 hover:text-slate-700 font-black flex items-center gap-0.5"
                                          >
                                            <Eye className="w-2.5 h-2.5" /> View
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 italic font-semibold">No files uploaded</p>
                              )}

                              {isAdminOrPic && (
                                <div className="relative">
                                  <input 
                                    type="file" 
                                    multiple
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => {
                                      if (e.target.files) {
                                        Array.from(e.target.files).forEach((file: File) => {
                                          addFileToSection(req.id, 'quotationFiles', file);
                                        });
                                      }
                                    }}
                                  />
                                  <div className="w-full py-1.5 px-3 border border-dashed border-slate-200 hover:border-blue-500 rounded-lg text-center text-[10px] font-black text-slate-550 cursor-pointer flex items-center justify-center gap-1 transition-all bg-slate-50/50 hover:bg-white">
                                    <Upload className="w-3 h-3 text-slate-400" /> + Add File
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Invoice */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-lg flex flex-col justify-between space-y-4 transition-all duration-200">
                        <div className="space-y-3.5">
                          <h3 id={`invoice-sec-header-${req.id}`} className="text-xs font-black text-purple-800 bg-purple-50/70 border border-purple-100/80 px-3 py-2 rounded-lg uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              Invoice
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                          </h3>

                          <div className="space-y-2.5 text-xs">
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">PO Number</span>
                              <input 
                                type="text" 
                                placeholder={isAdminOrPic ? "Enter PO Number..." : "Not specified"}
                                value={req.invoicePoNumber || ''} 
                                onChange={(e) => updateRequisitionField(req.id, { invoicePoNumber: e.target.value })}
                                disabled={!isAdminOrPic}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 bg-slate-50 mt-1 disabled:opacity-75 disabled:cursor-not-allowed"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Date</span>
                              <input 
                                type="date" 
                                value={req.invoiceDate || ''} 
                                onChange={(e) => updateRequisitionField(req.id, { invoiceDate: e.target.value })}
                                disabled={!isAdminOrPic}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 bg-slate-50 mt-1 disabled:opacity-75 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                        </div>

                        {/* File upload for Invoice */}
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Attachments ({(req.invoiceFiles || []).length})</span>
                          
                          {(req.invoiceFiles && req.invoiceFiles.length > 0) ? (
                            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                              {req.invoiceFiles.map((f, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/60 text-xs font-bold text-slate-600 space-y-1.5 shadow-3xs">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span className="truncate text-slate-700 font-extrabold" title={f.name}>{f.name}</span>
                                    </div>
                                    {isAdminOrPic && (
                                      <button 
                                        type="button"
                                        onClick={() => removeFileFromSection(req.id, 'invoiceFiles', idx)}
                                        className="text-slate-400 hover:text-red-500 p-0.5 shrink-0 hover:bg-slate-200/50 rounded transition-colors"
                                        title="Remove attachment"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold px-1 border-t border-slate-100/60 pt-1">
                                    <span>{f.size}</span>
                                    <div className="flex gap-2">
                                      {f.dataUrl && (
                                        <a 
                                          href={getFileUrl(f.dataUrl)} 
                                          download={f.name}
                                          className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                                        >
                                          <Download className="w-2.5 h-2.5" /> Get
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setPreviewFile(f)}
                                        className="text-slate-500 hover:text-slate-700 font-black flex items-center gap-0.5"
                                      >
                                        <Eye className="w-2.5 h-2.5" /> View
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic font-semibold">No files uploaded</p>
                          )}

                          {isAdminOrPic && (
                            <div className="relative">
                              <input 
                                type="file" 
                                multiple
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  if (e.target.files) {
                                    Array.from(e.target.files).forEach((file: File) => {
                                      addFileToSection(req.id, 'invoiceFiles', file);
                                    });
                                  }
                                }}
                              />
                              <div className="w-full py-1.5 px-3 border border-dashed border-slate-200 hover:border-blue-500 rounded-lg text-center text-[10px] font-black text-slate-550 cursor-pointer flex items-center justify-center gap-1 transition-all bg-slate-50/50 hover:bg-white">
                                <Upload className="w-3 h-3 text-slate-400" /> + Add File
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 4: Delivery Note */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-lg flex flex-col justify-between space-y-4 transition-all duration-200">
                        <div className="space-y-3.5">
                          <h3 id={`delivery-sec-header-${req.id}`} className="text-xs font-black text-emerald-800 bg-emerald-50/70 border border-emerald-100/80 px-3 py-2 rounded-lg uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Delivery Note
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          </h3>

                          <div className="space-y-2.5 text-xs">
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">PO Number</span>
                              <input 
                                type="text" 
                                placeholder="Enter PO Number..."
                                value={req.deliveryNotePoNumber || ''} 
                                onChange={(e) => updateRequisitionField(req.id, { deliveryNotePoNumber: e.target.value })}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 bg-slate-50 mt-1"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Date</span>
                              <input 
                                type="date" 
                                value={req.deliveryNoteDate || ''} 
                                onChange={(e) => updateRequisitionField(req.id, { deliveryNoteDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 bg-slate-50 mt-1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* File upload for Delivery Note */}
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Attachments ({(req.deliveryNoteFiles || []).length})</span>
                          
                          {(req.deliveryNoteFiles && req.deliveryNoteFiles.length > 0) ? (
                            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                              {req.deliveryNoteFiles.map((f, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/60 text-xs font-bold text-slate-600 space-y-1.5 shadow-3xs">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span className="truncate text-slate-700 font-extrabold" title={f.name}>{f.name}</span>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => removeFileFromSection(req.id, 'deliveryNoteFiles', idx)}
                                      className="text-slate-400 hover:text-red-500 p-0.5 shrink-0 hover:bg-slate-200/50 rounded transition-colors"
                                      title="Remove attachment"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold px-1 border-t border-slate-100/60 pt-1">
                                    <span>{f.size}</span>
                                    <div className="flex gap-2">
                                      {f.dataUrl && (
                                        <a 
                                          href={getFileUrl(f.dataUrl)} 
                                          download={f.name}
                                          className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                                        >
                                          <Download className="w-2.5 h-2.5" /> Get
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setPreviewFile(f)}
                                        className="text-slate-500 hover:text-slate-700 font-black flex items-center gap-0.5"
                                      >
                                        <Eye className="w-2.5 h-2.5" /> View
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic font-semibold">No files uploaded</p>
                          )}

                          <div className="relative">
                            <input 
                              type="file" 
                              multiple
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(e) => {
                                if (e.target.files) {
                                  Array.from(e.target.files).forEach((file: File) => {
                                    addFileToSection(req.id, 'deliveryNoteFiles', file);
                                  });
                                }
                              }}
                            />
                            <div className="w-full py-1.5 px-3 border border-dashed border-slate-200 hover:border-blue-500 rounded-lg text-center text-[10px] font-black text-slate-550 cursor-pointer flex items-center justify-center gap-1 transition-all bg-slate-50/50 hover:bg-white">
                              <Upload className="w-3 h-3 text-slate-400" /> + Add File
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section: Messaging Area */}
                    <CommunicationLogSection
                      req={req}
                      currentUser={currentUser}
                      vessels={vessels}
                      msgText={msgTexts[req.id] || ''}
                      setMsgText={(val) => setMsgTexts(prev => ({ ...prev, [req.id]: val }))}
                      sendNewMessage={sendNewMessage}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Creation Modal Form */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 justify-between flex items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-lg">Store & Spares Form</span>
                <h2 className="text-lg font-black mt-1">Record Spare Parts Requisition</h2>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="text-white/80 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>            {/* Form body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-4 bg-red-50 text-red-650 border border-red-150 rounded-2xl text-xs font-bold flex items-start gap-2.5 shadow-3xs animate-in fade-in slide-in-from-top-2 duration-150">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span className="leading-normal">{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Vessel Name *</span>
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
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Date *</span>
                  <input
                    type="date"
                    required
                    value={formData.dateRequested}
                    onChange={(e) => setFormData(p => ({ ...p, dateRequested: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-700 bg-slate-50"
                  />
                </div>

                <div className="space-y-1 col-span-1 md:col-span-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Subject *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Heavy sea hydraulic lines rebuild components"
                    value={formData.subject}
                    onChange={(e) => setFormData(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-750 bg-slate-50"
                  />
                </div>
              </div>

              {/* Upload box */}
              <div className="space-y-1.5" onDragOver={handleFileDropGeneral}>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Upload file/s *</span>
                <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-6 text-center transition-all cursor-pointer bg-slate-50/50">
                  <input 
                    type="file" 
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files) {
                        processCreationFiles(e.target.files);
                      }
                    }}
                    accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.doc,.docx"
                  />
                  {uploadedFiles && uploadedFiles.length > 0 ? (
                    <div className="space-y-2">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-1">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-black text-slate-700">{uploadedFiles.length} file(s) selected:</p>
                      <ul className="text-[10px] text-slate-550 list-disc list-inside space-y-0.5 text-left max-w-xs mx-auto overflow-hidden text-ellipsis">
                        {uploadedFiles.map((file, idx) => (
                          <li key={idx} className="truncate">{file.name} ({file.size})</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Click to upload spreadsheet or requisition sheet</p>
                      <p className="text-[10px] text-slate-400 font-semibold">Supports PDF, XLSX files up to 25MB each</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setShowFormModal(false);
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-colors shadow-md flex items-center gap-1 cursor-pointer"
                >
                  Save Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 shadow-3xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-800 truncate" title={previewFile.name}>
                    {previewFile.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                    Attachment Preview • {previewFile.size}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto bg-slate-50 flex flex-col">
              {previewFile.dataUrl ? (
                previewFile.dataUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(previewFile.name) ? (
                  <div className="flex-1 p-6 flex items-center justify-center min-h-[350px]">
                    <img 
                      src={getFileUrl(previewFile.dataUrl)} 
                      alt={previewFile.name} 
                      className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md border border-slate-100 animate-in fade-in zoom-in-95 duration-300"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : previewFile.dataUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(previewFile.name) ? (
                  <div className="flex-1 h-[60vh] md:h-[65vh] flex flex-col">
                    <object 
                      data={getFileUrl(previewFile.dataUrl)} 
                      type="application/pdf" 
                      className="w-full h-full"
                    >
                      <div className="flex flex-col items-center justify-center h-full p-12 text-center text-slate-500">
                        <FileText className="w-12 h-12 text-slate-330 mb-3" />
                        <span className="text-sm font-bold text-slate-700">PDF Preview</span>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto mb-4">Your browser does not display static PDFs directly inside inline wrappers. You can download and inspect the file structure locally.</p>
                        <a 
                          href={getFileUrl(previewFile.dataUrl)} 
                          download={previewFile.name}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5" /> Download File
                        </a>
                      </div>
                    </object>
                  </div>
                ) : (
                  /* Standard document fallback */
                  <div className="flex-1 p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 shadow-3xs">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 truncate max-w-md">{previewFile.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">File Size: {previewFile.size}</p>
                    <p className="text-xs text-slate-500 mt-4 max-w-md">No direct inline preview is available for this file type. Please click the button below to download and view.</p>
                    
                    <a 
                      href={getFileUrl(previewFile.dataUrl)} 
                      download={previewFile.name}
                      className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" /> Download File
                    </a>
                  </div>
                )
              ) : (
                /* No dataUrl fallback representing default mock templates */
                <div className="flex-1 p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4 shadow-3xs">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">{previewFile.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">Mock Template Reference File</p>
                  <p className="text-xs text-slate-500 mt-4 max-w-md">This default template reference has no active binary payload to preview on-screen. You can retrieve its structure by downloading.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
              >
                Close Window
              </button>
              {previewFile.dataUrl && (
                <a
                  href={getFileUrl(previewFile.dataUrl)}
                  download={previewFile.name}
                  className="px-5 py-2.5 hover:opacity-90 bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
