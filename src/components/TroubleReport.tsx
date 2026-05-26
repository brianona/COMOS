import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  X, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Trash2, 
  TrendingUp, 
  Activity, 
  CheckSquare, 
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Download,
  Info,
  Upload,
  Paperclip,
  Edit2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface TroubleReport {
  id: string;
  vesselId: string;
  vesselName: string;
  deficiencyNumber: string;
  dateFound: string;
  deficiency: string;
  classification: string;
  subClassification?: string;
  othersDetail?: string;
  status: 'Submitted' | 'In Progress' | 'Resolved';
  actionTaken?: string;
  dateResolved?: string;
  reporterName: string;
  pmsCode?: string;
  rectificationFile?: {
    name: string;
    size: number;
    type: string;
    dataUrl?: string;
  };
  comiFile?: {
    name: string;
    size: number;
    type: string;
    dataUrl?: string;
  };
}

const INITIAL_REPORTS: TroubleReport[] = [
  {
    id: 'tr_1',
    vesselId: '1',
    vesselName: 'Clean Ocean Horizon',
    deficiencyNumber: 'DF-COH-082',
    dateFound: '2026-05-18',
    deficiency: 'Main Engine Exhaust Gas Valve No. 4 high temperature alert triggered during standard passage operation. Initial sensor readings indicated erratic temperature fluctuations between 340°C and 490°C.',
    classification: 'Malfunction (Hull / Machinery / Equipment)',
    subClassification: 'Noncritical',
    status: 'Resolved',
    actionTaken: 'Inspected exhaust valve sensor wiring. Identified loose connector pin. Rewired socket connection, applied anti-moisture sealant, and tested. Temperature readings stabilized at 390°C.',
    dateResolved: '2026-05-19',
    reporterName: 'Chief Engineer John Doe',
    pmsCode: 'ME-EXH-04'
  },
  {
    id: 'tr_2',
    vesselId: '2',
    vesselName: 'Pacific Breeze',
    deficiencyNumber: 'DN-PB-121',
    dateFound: '2026-05-20',
    deficiency: 'External ISM Audit noted minor logging inconsistency in the Bilge Separator record book. The recorded bilge discharge duration showed 2.5 hours, whereas PMS system guidelines recommended completing discharges in under 2 hours.',
    classification: 'Non conformity (Internal / External / Survey Audit)',
    status: 'In Progress',
    actionTaken: 'Awaiting corrective instructions from Class inspector and Chief Officer. Currently drafting revised training module for junior engineers on OWS logs.',
    reporterName: 'Captain Robert Smith',
    pmsCode: 'ENV-OWS-01'
  },
  {
    id: 'tr_3',
    vesselId: '3',
    vesselName: 'Polar Star',
    deficiencyNumber: 'DF-PS-094',
    dateFound: '2026-05-21',
    deficiency: 'Local port state inspection (AMSA) noted light bulb failure on the starboard side navigation light deck cluster. Recommended immediate replacement before sailing clearance.',
    classification: 'PSC / USCG / AMSA',
    status: 'Resolved',
    actionTaken: 'Fitted heavy-duty marine grade 220V LED bulb and resealed the IP67 waterproof junction box. Inspected voltage delivery and verified operational status with PSC officer.',
    dateResolved: '2026-05-22',
    reporterName: 'Chief Officer Arthur Pendelton',
    pmsCode: 'NAV-LGT-02'
  }
];

interface TroubleReportViewProps {
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

export const TroubleReportView: React.FC<TroubleReportViewProps> = ({ vessels, currentUser }) => {
  const isVesselUser = currentUser?.role === 'vessel' && currentUser?.vessel_id;
  const userVesselId = isVesselUser ? String(currentUser.vessel_id) : null;
  const allowedVessels = isVesselUser 
    ? vessels.filter(v => String(v.id) === String(currentUser.vessel_id))
    : vessels;

  const [reports, setReports] = useState<TroubleReport[]>(() => {
    const saved = localStorage.getItem('comos_trouble_reports');
    return saved ? JSON.parse(saved) : INITIAL_REPORTS;
  });

  const [activeTab, setActiveTab] = useState<'all' | 'Submitted' | 'In Progress' | 'Resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVessel, setFilterVessel] = useState(() => isVesselUser ? String(currentUser.vessel_id) : 'All');
  const [filterClass, setFilterClass] = useState('All');
  const [selectedReport, setSelectedReport] = useState<TroubleReport | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  // Required COMI-SM-5-2 Upload State
  const [newReportComiFile, setNewReportComiFile] = useState<{ name: string; size: number; type: string; dataUrl?: string } | null>(null);
  const [newReportComiDragActive, setNewReportComiDragActive] = useState(false);

  // Rectification states
  const [rectifyingReportId, setRectifyingReportId] = useState<string | null>(null);
  const [rectificationActions, setRectificationActions] = useState('');
  const [rectificationFile, setRectificationFile] = useState<{ name: string; size: number; type: string; dataUrl?: string } | null>(null);
  const [rectificationDate, setRectificationDate] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Inline action editing states
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editedActionText, setEditedActionText] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    vesselId: isVesselUser ? String(currentUser.vessel_id) : (vessels[0]?.id?.toString() || '1'),
    deficiencyNumber: '',
    dateFound: new Date().toISOString().split('T')[0],
    deficiency: '',
    classification: 'Incident / Casualty',
    subClassification: '', // 'Critical' | 'Noncritical' | 'Off hire' | ''
    othersDetail: '',
    reporterName: '',
    pmsCode: ''
  });

  useEffect(() => {
    if (userVesselId) {
      setFilterVessel(userVesselId);
      setFormData(prev => ({ ...prev, vesselId: userVesselId }));
    }
  }, [userVesselId]);

  useEffect(() => {
    localStorage.setItem('comos_trouble_reports', JSON.stringify(reports));
  }, [reports]);

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.deficiencyNumber.trim()) {
      alert('Please fill out the deficiency number.');
      return;
    }
    if (!formData.deficiency.trim()) {
      alert('Please fill out the deficiency description.');
      return;
    }
    if (!newReportComiFile) {
      alert('Please upload the required COMI-SM-5-2 document.');
      return;
    }

    const selectedVessel = vessels.find(v => v.id.toString() === formData.vesselId) || vessels[0];
    
    const newReport: TroubleReport = {
      id: 'tr_' + Date.now(),
      vesselId: formData.vesselId,
      vesselName: selectedVessel?.name || 'Unknown Vessel',
      deficiencyNumber: formData.deficiencyNumber.trim(),
      dateFound: formData.dateFound,
      deficiency: formData.deficiency,
      classification: formData.classification,
      subClassification: formData.classification === 'Malfunction (Hull / Machinery / Equipment)' ? formData.subClassification : undefined,
      othersDetail: formData.classification === 'Others: (please specify)' ? formData.othersDetail : undefined,
      status: 'Submitted',
      reporterName: formData.reporterName || 'Officer on Duty',
      pmsCode: formData.pmsCode || 'GEN-DEF-' + Math.floor(100 + Math.random() * 900),
      comiFile: newReportComiFile
    };

    setReports([newReport, ...reports]);
    setShowFormModal(false);
    setNewReportComiFile(null);
    
    // Reset form
    setFormData({
      vesselId: userVesselId || vessels[0]?.id?.toString() || '1',
      deficiencyNumber: '',
      dateFound: new Date().toISOString().split('T')[0],
      deficiency: '',
      classification: 'Incident / Casualty',
      subClassification: '',
      othersDetail: '',
      reporterName: '',
      pmsCode: ''
    });
  };

  const handleDeleteReport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this trouble report?')) {
      setReports(reports.filter(r => r.id !== id));
      if (selectedReport?.id === id) {
        setSelectedReport(null);
      }
    }
  };

  const handleResolveReport = (id: string) => {
    if (currentUser?.role === 'vessel') {
      alert('Vessel users are not authorized to resolve trouble reports.');
      return;
    }
    const reportVal = reports.find(r => r.id === id);
    setRectifyingReportId(id);
    setRectificationActions(reportVal?.actionTaken || '');
    setRectificationFile(null);
    setRectificationDate(new Date().toISOString().split('T')[0]);
  };

  const handleSaveActionTaken = (id: string, actionText: string) => {
    setReports(reports.map(r => {
      if (r.id === id) {
        return {
          ...r,
          actionTaken: actionText
        };
      }
      return r;
    }));

    if (selectedReport?.id === id) {
      setSelectedReport(prev => prev ? {
        ...prev,
        actionTaken: actionText
      } : null);
    }
    setEditingActionId(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setRectificationFile({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRectification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rectifyingReportId) return;
    if (!rectificationActions.trim()) {
      alert('Please enter correct actions taken.');
      return;
    }
    if (!rectificationDate) {
      alert('Please enter the date resolved.');
      return;
    }
    if (!rectificationFile) {
      alert('Please upload a deficiency rectification confirmation file.');
      return;
    }

    setReports(reports.map(r => {
      if (r.id === rectifyingReportId) {
        return {
          ...r,
          status: 'Resolved',
          actionTaken: rectificationActions.trim(),
          dateResolved: rectificationDate,
          rectificationFile: rectificationFile
        };
      }
      return r;
    }));

    if (selectedReport?.id === rectifyingReportId) {
      setSelectedReport(prev => prev ? {
        ...prev,
        status: 'Resolved',
        actionTaken: rectificationActions.trim(),
        dateResolved: rectificationDate,
        rectificationFile: rectificationFile
      } : null);
    }

    setRectifyingReportId(null);
    setRectificationActions('');
    setRectificationFile(null);
    setRectificationDate('');
  };

  const handleStartInvestigation = (id: string) => {
    setReports(reports.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: 'In Progress'
        };
      }
      return r;
    }));

    if (selectedReport?.id === id) {
      setSelectedReport(prev => prev ? { ...prev, status: 'In Progress' } : null);
    }
  };

  // Base reports accessible by the current user
  const accessibleReports = isVesselUser
    ? reports.filter(r => String(r.vesselId) === userVesselId)
    : reports;

  // Filtering
  const filteredReports = accessibleReports.filter(r => {
    const matchesTab = activeTab === 'all' || r.status === activeTab;
    const matchesVessel = filterVessel === 'All' || r.vesselId === filterVessel;
    const matchesClass = filterClass === 'All' || r.classification === filterClass;
    
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      r.deficiency.toLowerCase().includes(term) ||
      (r.deficiencyNumber && r.deficiencyNumber.toLowerCase().includes(term)) ||
      r.vesselName.toLowerCase().includes(term) ||
      r.classification.toLowerCase().includes(term) ||
      (r.subClassification && r.subClassification.toLowerCase().includes(term)) ||
      (r.pmsCode && r.pmsCode.toLowerCase().includes(term)) ||
      r.reporterName.toLowerCase().includes(term);

    return matchesTab && matchesVessel && matchesClass && matchesSearch;
  });

  const stats = {
    total: (filterVessel === 'All' ? accessibleReports : accessibleReports.filter(r => r.vesselId === filterVessel)).length,
    submitted: (filterVessel === 'All' ? accessibleReports : accessibleReports.filter(r => r.vesselId === filterVessel)).filter(r => r.status === 'Submitted').length,
    inProgress: (filterVessel === 'All' ? accessibleReports : accessibleReports.filter(r => r.vesselId === filterVessel)).filter(r => r.status === 'In Progress').length,
    resolved: (filterVessel === 'All' ? accessibleReports : accessibleReports.filter(r => r.vesselId === filterVessel)).filter(r => r.status === 'Resolved').length,
    malfunctions: (filterVessel === 'All' ? accessibleReports : accessibleReports.filter(r => r.vesselId === filterVessel)).filter(r => r.classification === 'Malfunction (Hull / Machinery / Equipment)').length,
    nonConformities: (filterVessel === 'All' ? accessibleReports : accessibleReports.filter(r => r.vesselId === filterVessel)).filter(r => r.classification.startsWith('Non conformity')).length
  };

  const classificationOptions = [
    'Incident / Casualty',
    'Human Injury',
    'Hazardous Occurrence (Near miss)',
    'Malfunction (Hull / Machinery / Equipment)',
    'Non conformity (Internal / External / Survey Audit)',
    'PSC / USCG / AMSA',
    'Vessel Inspection (Office Staff / Auditor)',
    'Flagstate / Port State / Rightship Deficiencies',
    'Others: (please specify)'
  ];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'In Progress':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-100';
    }
  };

  return (
    <div className="space-y-6" id="trouble-report-component">
      {/* Top Banner Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 to-blue-800 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-10">
          <AlertTriangle className="w-96 h-96" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="bg-blue-500/30 text-blue-100 px-3 py-1 rounded-full text-xs font-semibold w-max uppercase tracking-wider">
            Defects Management
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Trouble Reports</h1>
          <p className="text-blue-100/90 text-sm max-w-2xl">
            Record, classify and monitor marine deficiencies, incidents, malfunctions or PSC observations across fleet vessels. Ensuring safety code compliance and swift close-out.
          </p>
        </div>
        <button
          onClick={() => setShowFormModal(true)}
          className="flex items-center justify-center gap-2 bg-white text-blue-700 px-5 py-3 rounded-xl font-bold hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98] transition-all relative z-10 shadow-sm"
        >
          <Plus className="w-5 h-5" /> File New Report
        </button>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Logs', value: stats.total, color: 'text-slate-900', bg: 'bg-white' },
          { label: 'Submitted', value: stats.submitted, color: 'text-blue-600', bg: 'bg-blue-50/50' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50/30' },
          { label: 'Resolved Only', value: stats.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50/30' },
          { label: 'Malfunctions', value: stats.malfunctions, color: 'text-rose-600', bg: 'bg-rose-50/20' },
          { label: 'Audits/PSC Logs', value: stats.nonConformities + (filterVessel === 'All' ? accessibleReports : accessibleReports.filter(r => r.vesselId === filterVessel)).filter(r => r.classification.includes('PSC')).length, color: 'text-indigo-600', bg: 'bg-indigo-50/20' },
        ].map((item, idx) => (
          <div key={idx} className={`${item.bg} p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between`}>
            <span className="text-xs font-semibold text-slate-500 tracking-tight uppercase">{item.label}</span>
            <span className={`text-2xl font-black mt-2 ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search deficiency code, description, vessel name or reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Select boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:w-96">
            <select
              value={filterVessel}
              onChange={(e) => setFilterVessel(e.target.value)}
              disabled={!!isVesselUser}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 font-medium focus:ring-2 focus:ring-blue-500/20 disabled:opacity-75 disabled:bg-slate-100"
            >
              {!isVesselUser && <option value="All">All Vessels</option>}
              {allowedVessels.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>

            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 font-medium focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Classifications</option>
              {classificationOptions.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab filters */}
        <div className="flex border-b border-slate-100">
          {(['all', 'Submitted', 'In Progress', 'Resolved'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all relative capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'All Active Logs' : tab}
              {activeTab === tab && (
                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col gap-3.5">
        {filteredReports.length === 0 ? (
          <div className="bg-white p-16 text-center rounded-3xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No Trouble Reports Found</h3>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              No reports matched your active filter or search queries. Select another vessel category or file a new deficiency log above.
            </p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:border-blue-300 hover:shadow-md hover:scale-[1.005] active:scale-[0.995] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 text-left"
            >
              {/* Vessel Name, Ref Code & State Meta */}
              <div className="flex flex-col gap-1 md:w-1/4 shrink-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {report.deficiencyNumber && (
                    <span className="font-bold text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md" title="Deficiency Number">
                      {report.deficiencyNumber}
                    </span>
                  )}
                  <span className="font-semibold text-[10px] text-slate-500 font-mono tracking-tight bg-slate-100 px-2 py-0.5 rounded-md" title="Equipment Ref Code">
                    {report.pmsCode}
                  </span>
                </div>
                
                <span className="text-slate-900 font-extrabold text-[13px] tracking-tight hover:text-blue-600 transition-colors mt-1.5 block">
                  {report.vesselName}
                </span>

                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium bg-slate-50 px-1.5 py-0.5 rounded-md" title="Date Found">
                    <Calendar className="w-3" /> Found: {report.dateFound}
                  </span>
                  {report.status === 'Resolved' && report.dateResolved && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-md" title="Date Resolved">
                      <CheckCircle className="w-3 h-3 text-emerald-600" /> Resolved: {report.dateResolved}
                    </span>
                  )}
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${getStatusBadgeClass(report.status)}`}>
                    {report.status}
                  </span>
                </div>
              </div>

              {/* Classification and Deficiency Text Area */}
              <div className="flex-1 min-w-0 md:px-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-800 leading-snug">
                    {report.classification}
                  </h3>
                  {report.subClassification && (
                    <span className="text-rose-500 text-[10px] font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 shrink-0">
                      {report.subClassification}
                    </span>
                  )}
                </div>

                <p className="text-slate-500 text-xs mt-2 line-clamp-2 leading-relaxed font-medium">
                  {report.deficiency}
                </p>
              </div>

              {/* Reporter, Attachments & Action Controls */}
              <div className="flex flex-wrap items-center justify-between md:justify-end gap-3.5 border-t border-slate-50 md:border-t-0 pt-3 md:pt-0 shrink-0 md:w-1/4">
                <div className="flex flex-col text-left md:text-right hidden sm:flex">
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Reporter</span>
                  <strong className="text-xs text-slate-650 font-bold truncate max-w-[120px]">{report.reporterName}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {report.actionTaken && (
                      <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5" title="Action corrective steps logged">
                        <CheckCircle className="w-2.5 h-2.5" /> Settled
                      </span>
                    )}
                    {report.rectificationFile && (
                      <span className="text-slate-500 bg-slate-100 border border-slate-200/50 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5" title={`${report.rectificationFile.name} attached`}>
                        <Paperclip className="w-2.5 h-2.5 text-blue-500 shrink-0" /> Close Doc
                      </span>
                    )}
                    {report.comiFile && (
                      <span className="text-indigo-600 bg-indigo-50/70 border border-indigo-150 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5" title="Required COMI-SM-5-2 uploaded">
                        <FileText className="w-2.5 h-2.5 text-indigo-500 shrink-0" /> COMI-SM-5-2
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleDeleteReport(report.id, e)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors"
                      title="Delete Report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="text-blue-550 font-bold hover:underline pl-1 text-xs flex items-center gap-0.5 bg-blue-50/50 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-blue-600">
                      View <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL - CREATION FORM */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-3xl shadow-xl border border-slate-100 overflow-hidden"
            >
              {/* Modal Banner Header */}
              <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500 px-2 py-0.5 rounded">Trouble Report Form</span>
                  <h2 className="text-xl font-black">Record Marine Trouble Report</h2>
                </div>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="bg-blue-500/30 hover:bg-blue-500/50 p-2 rounded-xl text-blue-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content body */}
              <form onSubmit={handleCreateReport} className="p-6 md:p-8 space-y-5 overflow-y-auto max-h-[80vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Vessel */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Vessel</label>
                    <select
                      value={formData.vesselId}
                      onChange={(e) => setFormData(formData => ({ ...formData, vesselId: e.target.value }))}
                      disabled={!!isVesselUser}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 bg-slate-50 disabled:opacity-75 disabled:bg-slate-100"
                    >
                      {allowedVessels.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Occurrence Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Found or Occurrence</label>
                    <input
                      type="date"
                      value={formData.dateFound}
                      onChange={(e) => setFormData(formData => ({ ...formData, dateFound: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 bg-slate-50"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Reporter name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reporter Rank / Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Chief Officer John Doe"
                      value={formData.reporterName}
                      onChange={(e) => setFormData(formData => ({ ...formData, reporterName: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 bg-slate-50"
                      required
                    />
                  </div>

                  {/* Deficiency Number */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deficiency Number (Required)</label>
                    <input
                      type="text"
                      placeholder="e.g. DN-2026-004"
                      value={formData.deficiencyNumber}
                      onChange={(e) => setFormData(formData => ({ ...formData, deficiencyNumber: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 bg-slate-50 font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ref PMS label Code */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PMS Item / Equipment Ref Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. ME-VALVE-04 or AUX-GEN-1"
                      value={formData.pmsCode}
                      onChange={(e) => setFormData(formData => ({ ...formData, pmsCode: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 bg-slate-50"
                    />
                  </div>
                </div>

                {/* Deficiency TextBox */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deficiency Description (Text Box)</label>
                  <textarea
                    rows={4}
                    placeholder="Provide detailed information regarding the defect, physical finding, causality, alarm trip levels, or observation specs..."
                    value={formData.deficiency}
                    onChange={(e) => setFormData(formData => ({ ...formData, deficiency: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 bg-slate-50 leading-relaxed font-sans"
                    required
                  />
                  <span className="text-[10px] text-slate-400 font-medium">Please avoid vague explanations. Mention specific parameters, temperatures, logs or values if known.</span>
                </div>

                {/* Radio Buttons Panel - CLASSIFICATION OF DEFICIENCY */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Classification of Deficiency (Exclusive Choice)</label>
                  
                  {/* Styled Radio Option Matrix - Layout inspired by the picture */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 pb-3">
                    {/* Left Hand Column */}
                    <div className="space-y-3">
                      {/* Option 1 */}
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <input
                          type="radio"
                          name="classification"
                          value="Incident / Casualty"
                          checked={formData.classification === 'Incident / Casualty'}
                          onChange={() => setFormData(formData => ({ ...formData, classification: 'Incident / Casualty' }))}
                          className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">Incident / Casualty</span>
                      </label>

                      {/* Option 2 */}
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <input
                          type="radio"
                          name="classification"
                          value="Human Injury"
                          checked={formData.classification === 'Human Injury'}
                          onChange={() => setFormData(formData => ({ ...formData, classification: 'Human Injury' }))}
                          className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">Human Injury</span>
                      </label>

                      {/* Option 3 */}
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <input
                          type="radio"
                          name="classification"
                          value="Hazardous Occurrence (Near miss)"
                          checked={formData.classification === 'Hazardous Occurrence (Near miss)'}
                          onChange={() => setFormData(formData => ({ ...formData, classification: 'Hazardous Occurrence (Near miss)' }))}
                          className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">Hazardous Occurrence (Near miss)</span>
                      </label>

                      {/* Option 4: Malfunction Nested Radio block */}
                      <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2.5">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="classification"
                            value="Malfunction (Hull / Machinery / Equipment)"
                            checked={formData.classification === 'Malfunction (Hull / Machinery / Equipment)'}
                            onChange={() => setFormData(formData => ({ 
                              ...formData, 
                              classification: 'Malfunction (Hull / Machinery / Equipment)',
                              subClassification: formData.subClassification || 'Critical'
                            }))}
                            className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Malfunction (Hull / Machinery / Equipment)</span>
                        </label>

                        {/* MALFUNCTION SUB CHOICE GRID */}
                        <AnimatePresence>
                          {formData.classification === 'Malfunction (Hull / Machinery / Equipment)' && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pl-7 space-y-2 pt-1 border-l-2 border-blue-500 ml-2"
                            >
                              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Sub-Type Category</span>
                              <div className="flex flex-wrap gap-4">
                                {['Critical', 'Noncritical', 'Off hire'].map((subOpt) => (
                                  <label key={subOpt} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="subClassification"
                                      value={subOpt}
                                      checked={formData.subClassification === subOpt}
                                      onChange={() => setFormData(formData => ({ ...formData, subClassification: subOpt }))}
                                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs font-semibold text-slate-600">{subOpt}</span>
                                  </label>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Right Hand Column */}
                    <div className="space-y-3">
                      {/* Option 5 */}
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <input
                          type="radio"
                          name="classification"
                          value="Non conformity (Internal / External / Survey Audit)"
                          checked={formData.classification === 'Non conformity (Internal / External / Survey Audit)'}
                          onChange={() => setFormData(formData => ({ ...formData, classification: 'Non conformity (Internal / External / Survey Audit)' }))}
                          className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">Non conformity (Internal / External / Survey Audit)</span>
                      </label>

                      {/* Option 6 */}
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <input
                          type="radio"
                          name="classification"
                          value="PSC / USCG / AMSA"
                          checked={formData.classification === 'PSC / USCG / AMSA'}
                          onChange={() => setFormData(formData => ({ ...formData, classification: 'PSC / USCG / AMSA' }))}
                          className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">PSC / USCG / AMSA</span>
                      </label>

                      {/* Option 7 */}
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <input
                          type="radio"
                          name="classification"
                          value="Vessel Inspection (Office Staff / Auditor)"
                          checked={formData.classification === 'Vessel Inspection (Office Staff / Auditor)'}
                          onChange={() => setFormData(formData => ({ ...formData, classification: 'Vessel Inspection (Office Staff / Auditor)' }))}
                          className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">Vessel Inspection (Office Staff / Auditor)</span>
                      </label>

                      {/* Option 8 */}
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <input
                          type="radio"
                          name="classification"
                          value="Flagstate / Port State / Rightship Deficiencies"
                          checked={formData.classification === 'Flagstate / Port State / Rightship Deficiencies'}
                          onChange={() => setFormData(formData => ({ ...formData, classification: 'Flagstate / Port State / Rightship Deficiencies' }))}
                          className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">Flagstate / Port State / Rightship Deficiencies</span>
                      </label>

                      {/* Option 9: Others with text specification */}
                      <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="classification"
                            value="Others: (please specify)"
                            checked={formData.classification === 'Others: (please specify)'}
                            onChange={() => setFormData(formData => ({ ...formData, classification: 'Others: (please specify)' }))}
                            className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Others: (please specify)</span>
                        </label>
                        
                        <AnimatePresence>
                          {formData.classification === 'Others: (please specify)' && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pl-7 pt-1"
                            >
                              <input
                                type="text"
                                placeholder="Specify deficiency classification details..."
                                value={formData.othersDetail}
                                onChange={(e) => setFormData(formData => ({ ...formData, othersDetail: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                                required
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COMI-SM-5-2 Required Upload */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                    COMI-SM-5-2 Form / Document <span className="text-rose-500 font-bold">* Required</span>
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium -mt-1 mb-2">
                    Please upload the mandatory COMI-SM-5-2 form to register this new defect trouble report.
                  </p>
                  
                  <div
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setNewReportComiDragActive(true); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setNewReportComiDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setNewReportComiDragActive(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setNewReportComiDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        const file = e.dataTransfer.files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          setNewReportComiFile({
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            dataUrl: reader.result as string
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      newReportComiDragActive 
                        ? 'border-indigo-500 bg-indigo-50/50' 
                        : newReportComiFile 
                          ? 'border-emerald-500 bg-emerald-50/15' 
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                    onClick={() => document.getElementById('new-report-comi-file-input')?.click()}
                  >
                    <input
                      id="new-report-comi-file-input"
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onload = () => {
                            setNewReportComiFile({
                              name: file.name,
                              size: file.size,
                              type: file.type,
                              dataUrl: reader.result as string
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      accept="image/*,application/pdf,.xlsx,.csv,.xls,.doc,.docx"
                    />

                    {newReportComiFile ? (
                      <div className="space-y-2 flex flex-col items-center">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 line-clamp-1">{newReportComiFile.name}</p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                            {Math.round(newReportComiFile.size / 1024)} KB • Click or drag to change file
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 flex flex-col items-center">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-650 rounded-2xl flex items-center justify-center">
                          <Upload className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">
                            <span className="text-indigo-600 hover:underline">Click to upload COMI-SM-5-2 document</span> or drag & drop here
                          </p>
                          <p className="text-[9px] font-semibold text-slate-400 mt-1">
                            PDF, Word, Excel, or Images are accepted
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Bottom Submission controls */}
                <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFormModal(false);
                      setNewReportComiFile(null);
                    }}
                    className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newReportComiFile}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      newReportComiFile
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100 cursor-pointer transition-transform active:scale-95'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL - DETAIL VIEW & ACTION FORM */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header Banner - colored by status */}
              <div className={`p-6 text-white flex items-center justify-between ${
                selectedReport.status === 'Resolved' ? "bg-emerald-600" :
                selectedReport.status === 'In Progress' ? "bg-amber-500" :
                "bg-blue-600"
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-black/15 px-2 py-0.5 rounded">
                      Report Review
                    </span>
                    {selectedReport.pmsCode && (
                      <span className="text-[10px] font-mono tracking-relaxed font-bold bg-white/15 px-2 py-0.5 rounded" title="PMS Equipment Code">
                        Ref: {selectedReport.pmsCode}
                      </span>
                    )}
                    {selectedReport.deficiencyNumber && (
                      <span className="text-[10px] font-mono tracking-relaxed font-black bg-white/25 px-2 py-0.5 rounded" title="Deficiency ID Number">
                        No. {selectedReport.deficiencyNumber}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black mt-1 text-white truncate max-w-md">{selectedReport.vesselName}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full bg-white/15 border border-white/20">
                    {selectedReport.status}
                  </span>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="hover:bg-white/25 p-2 rounded-xl text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Modal Area */}
              <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
                {/* Meta Matrix */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl text-xs border border-slate-100">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">Occurrence Date</span>
                    <strong className="text-slate-700 font-extrabold flex items-center gap-1.5 mt-1">
                      <Calendar className="w-4 h-4 text-blue-500 shrink-0" /> {selectedReport.dateFound}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">Logged By</span>
                    <strong className="text-slate-700 font-extrabold flex items-center gap-1.5 mt-1">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" /> {selectedReport.reporterName}
                    </strong>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <span className="text-slate-400 block mb-0.5 font-semibold uppercase tracking-wider text-[9px]">System Report ID</span>
                    <strong className="text-slate-500 font-mono text-[10px] block mt-1 bg-slate-200/50 px-1.5 py-0.5 rounded max-w-fit">
                      {selectedReport.id}
                    </strong>
                  </div>
                </div>

                {/* Classification info card */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Deficiency Classification</span>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
                    <span className="text-xs font-black text-blue-900 block leading-snug">{selectedReport.classification}</span>
                    {selectedReport.subClassification && (
                      <span className="inline-block mt-2 bg-rose-50 border border-rose-200 text-rose-700 font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Criticality Category: {selectedReport.subClassification}
                      </span>
                    )}
                    {selectedReport.othersDetail && (
                      <div className="mt-2 text-xs border-t border-blue-100 pt-2 text-blue-800">
                        <strong className="font-semibold block mb-0.5">Specified Detail:</strong>
                        <p className="font-mono bg-white p-2 rounded-xl text-slate-700 border border-blue-100">{selectedReport.othersDetail}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description of Deficiency */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Description of Deficiency</span>
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                    <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap font-medium">{selectedReport.deficiency}</p>
                  </div>
                </div>

                {/* Required COMI-SM-5-2 Document */}
                {selectedReport.comiFile && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Required COMI-SM-5-2 Document</span>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-605 rounded-xl flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-indigo-600 font-bold" />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-black text-slate-800 truncate">{selectedReport.comiFile.name}</p>
                          <p className="text-[10px] font-semibold text-slate-400">
                            {(selectedReport.comiFile.size / 1024).toFixed(1)} KB • COMI-SM-5-2 Required Document
                          </p>
                        </div>
                      </div>
                      {selectedReport.comiFile.dataUrl && (
                        <a
                          href={selectedReport.comiFile.dataUrl}
                          download={selectedReport.comiFile.name}
                          className="bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 text-indigo-600 rounded-xl transition-colors shrink-0 flex items-center gap-1.5 text-xs font-bold shadow-sm"
                        >
                          <Download className="w-4 h-4 text-indigo-600" /> Download
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Taken & Mitigations */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Corrective Plan / Action Taken to Resolve</span>
                    {selectedReport.status !== 'Submitted' && editingActionId !== selectedReport.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingActionId(selectedReport.id);
                          setEditedActionText(selectedReport.actionTaken || '');
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors bg-blue-50/50 hover:bg-blue-100/70 px-2.5 py-1 rounded-lg"
                      >
                        <Edit2 className="w-3 h-3" /> {selectedReport.actionTaken ? 'Edit Action Plan' : 'Add Action Plan'}
                      </button>
                    )}
                  </div>

                  {editingActionId === selectedReport.id ? (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                      <textarea
                        value={editedActionText}
                        onChange={(e) => setEditedActionText(e.target.value)}
                        placeholder="Detail the actions taken, repairs made, parts replaced, or investigation findings..."
                        className="w-full h-24 p-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 resize-none leading-relaxed"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingActionId(null)}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100/50 text-slate-500 rounded-lg text-[10px] font-extrabold transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveActionTaken(selectedReport.id, editedActionText)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold transition-colors shadow-sm shadow-blue-100 flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Save Action Plan
                        </button>
                      </div>
                    </div>
                  ) : selectedReport.actionTaken ? (
                    <div className="space-y-3">
                      <div className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100/50 text-slate-700 text-xs leading-relaxed whitespace-pre-wrap flex gap-3">
                        <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="w-full text-left">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-emerald-150/10">
                            <strong className="text-emerald-800 font-black">Mitigation Logged:</strong>
                            {selectedReport.dateResolved && (
                              <span className="text-[10px] bg-emerald-100/50 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-emerald-700" /> Resolved: {selectedReport.dateResolved}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-700">{selectedReport.actionTaken}</p>
                        </div>
                      </div>

                      {/* Attached confirm file */}
                      {selectedReport.rectificationFile && (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                              <Paperclip className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-black text-slate-800 truncate">{selectedReport.rectificationFile.name}</p>
                              <p className="text-[10px] font-semibold text-slate-400">
                                {(selectedReport.rectificationFile.size / 1024).toFixed(1)} KB • {selectedReport.rectificationFile.type || 'Document'}
                              </p>
                            </div>
                          </div>
                          {selectedReport.rectificationFile.dataUrl && (
                            <a
                              href={selectedReport.rectificationFile.dataUrl}
                              download={selectedReport.rectificationFile.name}
                              className="bg-white border border-slate-200 hover:bg-slate-50 p-2 rounded-xl text-blue-600 transition-colors shrink-0 flex items-center gap-1.5 text-xs font-bold shadow-sm"
                            >
                              <Download className="w-4 h-4" /> Download
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ) : selectedReport.status === 'In Progress' ? (
                    <div className="p-4 bg-blue-50/30 border border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center text-center py-6 gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Activity className="w-5 h-5 text-blue-550" />
                      </div>
                      <div className="max-w-xs">
                        <p className="text-xs font-bold text-slate-700">Investigation In Progress</p>
                        <p className="text-[10px] text-slate-500 mt-1">Specify an action plan or log temporary mitigation steps now.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingActionId(selectedReport.id);
                          setEditedActionText('');
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] rounded-xl transition-colors shadow-xs cursor-pointer"
                      >
                        + Create Action Plan
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50/40 rounded-2xl border border-dashed border-slate-200 text-center py-6 text-xs text-slate-400 flex flex-col items-center">
                      <Clock className="w-6 h-6 text-slate-300 mb-2" />
                      No action plan or corrective actions registered yet. Action required to complete form and achieve compliance.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="bg-slate-50 p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-colors"
                >
                  Close Review
                </button>

                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {selectedReport.status === 'Submitted' && (
                    <button
                      onClick={() => handleStartInvestigation(selectedReport.id)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Activity className="w-3.5 h-3.5" /> Start Investigation
                    </button>
                  )}
                  {selectedReport.status !== 'Resolved' && currentUser?.role !== 'vessel' && (
                    <button
                      onClick={() => handleResolveReport(selectedReport.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-100"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Declare Resolved
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const text = `TROUBLE REPORT RESOLUTION DOCUMENT\nReport Ref: ${selectedReport.pmsCode}\nDeficiency Number: ${selectedReport.deficiencyNumber || 'N/A'}\nVessel: ${selectedReport.vesselName}\nDate: ${selectedReport.dateFound}\nCategory: ${selectedReport.classification}\n\nDEFICIENCY:\n${selectedReport.deficiency}\n\nCORRECTIVE PLANS & ACTIONS:\n${selectedReport.actionTaken || 'Pending Completion'}`;
                      const blob = new Blob([text], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `trouble-report-${selectedReport.pmsCode}.txt`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-white"
                  >
                    <Download className="w-3.5 h-3.5" /> Export TXT
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL - RECTIFICATION RESOLVE FORM */}
        {rectifyingReportId && (() => {
          const reportToRectify = reports.find(r => r.id === rectifyingReportId);
          if (!reportToRectify) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-xl shadow-xl border border-slate-100 overflow-hidden"
              >
                {/* Header Band */}
                <div className="bg-emerald-600 p-6 text-white flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-700/30 px-2.5 py-0.5 rounded">
                      Compliance Form
                    </span>
                    <h2 className="text-xl font-black text-white">Declare Deficiency Resolved</h2>
                  </div>
                  <button
                    onClick={() => setRectifyingReportId(null)}
                    className="hover:bg-white/20 p-2 rounded-xl text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Elements */}
                <form onSubmit={handleSubmitRectification} className="p-6 md:p-8 space-y-5 text-left">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-200 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]" title="Ref No.">
                        {reportToRectify.pmsCode}
                      </span>
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 font-bold px-1.5 py-0.5 rounded text-[10px]" title="Deficiency No.">
                        {reportToRectify.deficiencyNumber}
                      </span>
                    </div>
                    <p className="font-extrabold text-slate-800 text-sm mt-1">{reportToRectify.vesselName}</p>
                    <div className="text-slate-500 font-semibold leading-relaxed italic bg-white border border-slate-100 p-3 rounded-xl mt-2 max-h-24 overflow-y-auto">
                      "{reportToRectify.deficiency}"
                    </div>
                  </div>

                  {/* Actions Taken Form Field */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Actions Taken & Mitigation Measures (Required)</label>
                      <span className="text-[10px] text-rose-500 font-bold">Mandatory</span>
                    </div>
                    <textarea
                      placeholder="Specify comprehensive corrective action details and modifications made to rectify this deficiency..."
                      value={rectificationActions}
                      onChange={(e) => setRectificationActions(e.target.value)}
                      className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-600 bg-slate-50 font-bold resize-none"
                      required
                    />
                  </div>

                  {/* Date Resolved Form Field */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Date Resolved (Required)</label>
                      <span className="text-[10px] text-rose-500 font-bold">Mandatory</span>
                    </div>
                    <input
                      type="date"
                      value={rectificationDate}
                      onChange={(e) => setRectificationDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-600 bg-slate-50 font-bold"
                      required
                    />
                  </div>

                  {/* Drag and Drop Zone */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Confirmation Document / Verification File (Required)</label>
                      <span className="text-[10px] text-rose-500 font-bold">Mandatory</span>
                    </div>
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                        dragActive 
                          ? 'border-blue-500 bg-blue-50/50' 
                          : rectificationFile 
                            ? 'border-emerald-500 bg-emerald-50/20' 
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-300'
                      }`}
                      onClick={() => document.getElementById('rectification-file-input')?.click()}
                    >
                      <input
                        id="rectification-file-input"
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*,application/pdf,.xlsx,.csv,.xls,.doc,.docx"
                      />

                      {rectificationFile ? (
                        <div className="space-y-2 flex flex-col items-center">
                          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 line-clamp-1">{rectificationFile.name}</p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              {Math.round(rectificationFile.size / 1024)} KB • Click or drag to change file
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 flex flex-col items-center">
                          <div className="w-12 h-12 bg-slate-200/65 text-slate-500 rounded-2xl flex items-center justify-center">
                            <Upload className="w-6 h-6 text-slate-550" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-700">Drag & drop verification file here</p>
                            <p className="text-[10px] text-slate-400 mt-1">or click to choose file (PDF, Images, Excel, Docs)</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission Buttons */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setRectifyingReportId(null)}
                      className="px-5 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!rectificationActions.trim() || !rectificationDate || !rectificationFile}
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 text-white ${
                        rectificationActions.trim() && rectificationDate && rectificationFile 
                          ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-sm shadow-emerald-100'
                          : 'bg-slate-150 text-slate-400 bg-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" /> Resolve & Verify Deficiency
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
