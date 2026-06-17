import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  X, 
  UserCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  Eye, 
  Trash2, 
  Edit2, 
  Sliders,
  ChevronRight,
  TrendingUp,
  FileText
} from 'lucide-react';

// Definitions
export interface CrewMember {
  id: string;
  name: string;
  rank: string;
  nationality: string;
  signOnDate: string;
  passportNo: string;
  seamanBookNo: string;
  status: 'Compliant' | 'Warning' | 'Expired';
  contractDuration: number; // in months
  nextMedicalExam: string; // ISO date
  nextSafetyTraining: string; // ISO date
  vesselId: string;
}

export interface AuditRecord {
  id: string;
  type: 'Internal Audit' | 'External Audit' | 'PSC Inspection' | 'Vetting Inspection' | 'VIR' | 'Navigational Audit';
  vesselId: string;
  date: string;
  inspectorName: string;
  inspectorOrganization: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue';
  findingsCount: number;
  scope: string;
}

export interface NonConformity {
  id: string;
  auditId: string;
  vesselId: string;
  sourceType: 'Internal' | 'External' | 'PSC' | 'Vetting';
  category: 'Safety' | 'Environmental' | 'Navigational' | 'Operational' | 'Maintenance';
  description: string;
  raisedDate: string;
  dueDate: string;
  closeoutDate?: string;
  status: 'Open' | 'Closed' | 'Overdue';
  actionPlan: string;
  inspectorName: string;
}

// Mock Initial data
const INITIAL_CREW: CrewMember[] = [
  {
    id: 'c1',
    name: 'Alex Thorne',
    rank: 'Master (Captain)',
    nationality: 'British',
    signOnDate: '2026-02-15',
    passportNo: 'UKP992831',
    seamanBookNo: 'SB883712',
    status: 'Compliant',
    contractDuration: 4,
    nextMedicalExam: '2027-02-15',
    nextSafetyTraining: '2028-04-10',
    vesselId: 'any'
  },
  {
    id: 'c2',
    name: 'Nikolai Volkov',
    rank: 'Chief Engineer',
    nationality: 'Ukrainian',
    signOnDate: '2025-11-20',
    passportNo: 'UAP118274',
    seamanBookNo: 'SB227419',
    status: 'Warning',
    contractDuration: 6,
    nextMedicalExam: '2026-06-05', // close to expiring soon (Current date: May 2026)
    nextSafetyTraining: '2026-09-12',
    vesselId: 'any'
  },
  {
    id: 'c3',
    name: 'Sanjay Mehta',
    rank: 'Chief Officer',
    nationality: 'Indian',
    signOnDate: '2026-01-10',
    passportNo: 'INP554627',
    seamanBookNo: 'SB110928',
    status: 'Compliant',
    contractDuration: 6,
    nextMedicalExam: '2027-01-10',
    nextSafetyTraining: '2029-05-20',
    vesselId: 'any'
  },
  {
    id: 'c4',
    name: 'Carlos Santos',
    rank: 'Second Engineer',
    nationality: 'Brazilian',
    signOnDate: '2026-03-01',
    passportNo: 'BRP448371',
    seamanBookNo: 'SB992831',
    status: 'Compliant',
    contractDuration: 5,
    nextMedicalExam: '2027-03-01',
    nextSafetyTraining: '2028-11-15',
    vesselId: 'any'
  },
  {
    id: 'c5',
    name: 'Chen Wei',
    rank: 'Second Officer',
    nationality: 'Chinese',
    signOnDate: '2025-08-15',
    passportNo: 'CNP661128',
    seamanBookNo: 'SB442831',
    status: 'Expired',
    contractDuration: 9,
    nextMedicalExam: '2026-04-15', // already expired in April 2026
    nextSafetyTraining: '2027-08-15',
    vesselId: 'any'
  },
  {
    id: 'c6',
    name: 'Mateo Silva',
    rank: 'Chief Cook',
    nationality: 'Filipino',
    signOnDate: '2026-02-01',
    passportNo: 'PHP552839',
    seamanBookNo: 'SB334621',
    status: 'Compliant',
    contractDuration: 8,
    nextMedicalExam: '2027-02-01',
    nextSafetyTraining: '2029-02-01',
    vesselId: 'any'
  }
];

const INITIAL_AUDITS: AuditRecord[] = [
  {
    id: 'a1',
    type: 'Internal Audit',
    vesselId: 'all',
    date: '2026-03-10',
    inspectorName: 'Capt. Thomas Miller',
    inspectorOrganization: 'HSEQ Marine Dept',
    status: 'Completed',
    findingsCount: 1,
    scope: 'Safety Management System, Pollution Prevention, Navigation Audit'
  },
  {
    id: 'a2',
    type: 'PSC Inspection',
    vesselId: 'all',
    date: '2026-04-12',
    inspectorName: 'Jan de Vries',
    inspectorOrganization: 'Rotterdam Port State Control',
    status: 'Completed',
    findingsCount: 2,
    scope: 'Paris MOU Inspection Campaign, Safety Equipment, Machinery checks'
  },
  {
    id: 'a3',
    type: 'External Audit',
    vesselId: 'all',
    date: '2026-05-10',
    inspectorName: 'Marcus Lindman',
    inspectorOrganization: 'DNV Classification Society',
    status: 'Completed',
    findingsCount: 0,
    scope: 'Safety Management Certificate Renewal Audit, ISPS Audit'
  },
  {
    id: 'a4',
    type: 'Vetting Inspection',
    vesselId: 'all',
    date: '2026-06-15',
    inspectorName: 'Shell Vetting Representative',
    inspectorOrganization: 'SIRE Vetting Division',
    status: 'Scheduled',
    findingsCount: 0,
    scope: 'SIRE 2.0 Inspection Program, Tanker Standard Compliance'
  },
  {
    id: 'a5',
    type: 'External Audit',
    vesselId: 'all',
    date: '2026-05-01',
    inspectorName: 'G. Petersen',
    inspectorOrganization: 'DNV Classification Society',
    status: 'Overdue', // Target was early May, flag survey overdue
    findingsCount: 0,
    scope: 'Annual Classification & Machinery Survey'
  },
  {
    id: 'a6',
    type: 'VIR',
    vesselId: 'all',
    date: '2026-05-18',
    inspectorName: 'Capt. Hiroshi Tanaka',
    inspectorOrganization: 'ClassNK Inspector',
    status: 'Completed',
    findingsCount: 1,
    scope: 'Vessel Inspection Report, Cargo Gear, Hatch Cover watertightness'
  },
  {
    id: 'a7',
    type: 'Navigational Audit',
    vesselId: 'all',
    date: '2026-05-20',
    inspectorName: 'Capt. Robert Vance',
    inspectorOrganization: 'Marine Safety Advisory',
    status: 'In Progress',
    findingsCount: 0,
    scope: 'Navigational Safety Audit, Bridge Team Management, ECDIS compliance check'
  }
];

const INITIAL_NCS: NonConformity[] = [
  {
    id: 'nc1',
    auditId: 'a2',
    vesselId: 'all',
    sourceType: 'PSC',
    category: 'Safety',
    description: 'Emergency fire pump suction valve stiff to operate during emergency tests.',
    raisedDate: '2026-04-12',
    dueDate: '2026-05-12',
    closeoutDate: '2026-05-10',
    status: 'Closed',
    actionPlan: 'Valve dismantled, cleaned of rust, greased, and re-tested to satisfaction of Master.',
    inspectorName: 'Jan de Vries'
  },
  {
    id: 'nc2',
    auditId: 'a1',
    vesselId: 'all',
    sourceType: 'Internal',
    category: 'Operational',
    description: 'Oil Record Book missing official entry for Bilge water disposal pump test.',
    raisedDate: '2026-03-10',
    dueDate: '2026-04-10',
    closeoutDate: '2026-03-15',
    status: 'Closed',
    actionPlan: 'Chief Engineer logged entry and verified bilge water oil discharge monitor logging record.',
    inspectorName: 'Capt. Thomas Miller'
  },
  {
    id: 'nc3',
    auditId: 'a2',
    vesselId: 'all',
    sourceType: 'PSC',
    category: 'Operational',
    description: 'Weekly safety drills records missing signatures of launching crew.',
    raisedDate: '2026-04-12',
    dueDate: '2026-06-15',
    status: 'Open',
    actionPlan: 'Launching crew to undergo briefing; files being populated with missed safety briefings.',
    inspectorName: 'Jan de Vries'
  },
  {
    id: 'nc4',
    auditId: 'a5',
    vesselId: 'all',
    sourceType: 'External',
    category: 'Maintenance',
    description: 'Emergency exit illumination indicator blown in the steering gear compartment room.',
    raisedDate: '2026-05-01',
    dueDate: '2026-05-20', // Overdue since 2026-05-21
    status: 'Overdue',
    actionPlan: 'Procuring explosion-proof LED light fixture and testing Emergency lighting supply circuit.',
    inspectorName: 'G. Petersen'
  }
];

// 1. Crew ListView Component
export const CrewListView = ({ vessels, token }: { vessels: any[], token?: string }) => {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCrew = async () => {
    if (!token) {
      const saved = localStorage.getItem('comos_crew_list');
      setCrew(saved ? JSON.parse(saved) : INITIAL_CREW);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/crew-members', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setCrew(data);
      }
    } catch (err) {
      console.error('Failed to fetch crew:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrew();
  }, [token]);

  const [search, setSearch] = useState('');
  const [filterRank, setFilterRank] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [filterVessel, setFilterVessel] = useState('All');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    rank: '',
    nationality: '',
    signOnDate: '',
    passportNo: '',
    seamanBookNo: '',
    contractDuration: 6,
    nextMedicalExam: '',
    nextSafetyTraining: '',
    vesselId: 'all'
  });

  const saveCrewFallback = (newCrewList: CrewMember[]) => {
    setCrew(newCrewList);
    if (!token) {
      localStorage.setItem('comos_crew_list', JSON.stringify(newCrewList));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rank) return;

    // Calculate status depending on medical exam and safety training (just some basic demo helper logic)
    let status: 'Compliant' | 'Warning' | 'Expired' = 'Compliant';
    const now = new Date('2026-05-21'); // Current local mock time date context
    const medDate = new Date(formData.nextMedicalExam || '2027-01-01');
    const safetyDate = new Date(formData.nextSafetyTraining || '2027-01-01');

    if (medDate < now || safetyDate < now) {
      status = 'Expired';
    } else {
      const diffMed = medDate.getTime() - now.getTime();
      const diffSafety = safetyDate.getTime() - now.getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (diffMed < thirtyDays || diffSafety < thirtyDays) {
        status = 'Warning';
      }
    }

    const newCrew: CrewMember = {
      id: 'c_' + Date.now(),
      name: formData.name,
      rank: formData.rank,
      nationality: formData.nationality || 'Unknown',
      signOnDate: formData.signOnDate || new Date().toISOString().split('T')[0],
      passportNo: formData.passportNo || 'N/A',
      seamanBookNo: formData.seamanBookNo || 'N/A',
      status,
      contractDuration: Number(formData.contractDuration),
      nextMedicalExam: formData.nextMedicalExam || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
      nextSafetyTraining: formData.nextSafetyTraining || new Date(Date.now() + 500*24*60*60*1000).toISOString().split('T')[0],
      vesselId: formData.vesselId
    };

    if (token) {
      try {
        const resp = await fetch('/api/crew-members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newCrew)
        });
        if (resp.ok) {
          fetchCrew();
        } else {
          const err = await resp.json();
          alert(`Failed to save crew: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to post crew:', err);
      }
    } else {
      saveCrewFallback([newCrew, ...crew]);
    }

    setShowModal(false);
    setFormData({
      name: '',
      rank: '',
      nationality: '',
      signOnDate: '',
      passportNo: '',
      seamanBookNo: '',
      contractDuration: 6,
      nextMedicalExam: '',
      nextSafetyTraining: '',
      vesselId: 'all'
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this crew member?')) return;
    if (token) {
      try {
        const resp = await fetch(`/api/crew-members/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
          fetchCrew();
        }
      } catch (err) {
        console.error('Failed to delete crew member:', err);
      }
    } else {
      saveCrewFallback(crew.filter(c => c.id !== id));
    }
  };

  const filteredCrew = crew.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(search.toLowerCase()) || 
                          member.rank.toLowerCase().includes(search.toLowerCase()) ||
                          member.nationality.toLowerCase().includes(search.toLowerCase());
    const matchesRank = filterRank === 'All' || member.rank === filterRank;
    const matchesStatus = filterStatus === 'All' || member.status === filterStatus;
    const matchesVessel = filterVessel === 'All' || member.vesselId === filterVessel;
    return matchesSearch && matchesRank && matchesStatus && matchesVessel;
  });

  const getVesselName = (id: string) => {
    if (id === 'all' || id === 'any') return 'Global Pool / Unassigned';
    const found = vessels.find(v => String(v.id) === id);
    return found ? found.name : 'Unknown Vessel';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Crew List Onboard
          </h1>
          <p className="text-sm text-slate-500">Manage crew details, service status, and contract records.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-100 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Sign On Crew
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Crew Onboard</p>
            <h3 className="text-xl font-bold text-slate-800">{crew.length} Crew</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Fully Compliant</p>
            <h3 className="text-xl font-bold text-green-700">{crew.filter(c => c.status === 'Compliant').length} Active</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Expiring & Warning</p>
            <h3 className="text-xl font-bold text-amber-700">{crew.filter(c => c.status !== 'Compliant').length} Alert</h3>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search crew by name, duty rank..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select 
            value={filterRank}
            onChange={(e) => setFilterRank(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Ranks</option>
            <option value="Master (Captain)">Master (Captain)</option>
            <option value="Chief Officer">Chief Officer</option>
            <option value="Second Officer">Second Officer</option>
            <option value="Chief Engineer">Chief Engineer</option>
            <option value="Second Engineer">Second Engineer</option>
            <option value="Chief Cook">Chief Cook</option>
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Compliance</option>
            <option value="Compliant">Compliant</option>
            <option value="Warning">Warning</option>
            <option value="Expired">Expired</option>
          </select>

          <select 
            value={filterVessel}
            onChange={(e) => setFilterVessel(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Vessels</option>
            <option value="all">Global Pool</option>
            {vessels.map(v => (
              <option key={v.id} value={String(v.id)}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Crew Name</th>
                <th className="px-6 py-4">Rank / Nationality</th>
                <th className="px-6 py-4">Vessel/Service</th>
                <th className="px-6 py-4">Contracts & Sign On</th>
                <th className="px-6 py-4">Passport & Seaman Book</th>
                <th className="px-6 py-4">Compliance Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredCrew.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    No crew members found matching filters.
                  </td>
                </tr>
              ) : (
                filteredCrew.map(member => (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {member.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{member.rank}</div>
                      <div className="text-xs text-slate-400">{member.nationality}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {getVesselName(member.vesselId)}
                    </td>
                    <td className="px-6 py-4 text-xs space-y-0.5">
                      <div className="font-semibold text-slate-600">On: {member.signOnDate}</div>
                      <div className="text-slate-400">Duration: {member.contractDuration} Months</div>
                    </td>
                    <td className="px-6 py-4 text-xs space-y-0.5 font-mono text-slate-500">
                      <div>Passport: {member.passportNo}</div>
                      <div>Seaman Book: {member.seamanBookNo}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        member.status === 'Compliant' ? 'bg-green-50 text-green-700' :
                        member.status === 'Warning' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {member.status === 'Compliant' && <CheckCircle className="w-3.5 h-3.5" />}
                        {member.status === 'Warning' && <AlertTriangle className="w-3.5 h-3.5" />}
                        {member.status === 'Expired' && <AlertCircle className="w-3.5 h-3.5" />}
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleDelete(member.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remove Crew"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Sign On New Crew Member
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-150 rounded-lg hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Sanjay Mehta"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Duty Rank</label>
                  <select 
                    value={formData.rank}
                    onChange={(e) => setFormData({...formData, rank: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select Rank...</option>
                    <option value="Master (Captain)">Master (Captain)</option>
                    <option value="Chief Officer">Chief Officer</option>
                    <option value="Second Officer">Second Officer</option>
                    <option value="Third Officer">Third Officer</option>
                    <option value="Chief Engineer">Chief Engineer</option>
                    <option value="Second Engineer">Second Engineer</option>
                    <option value="Third Engineer">Third Engineer</option>
                    <option value="Chief Cook">Chief Cook</option>
                    <option value="Able Seaman (AB)">Able Seaman (AB)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nationality</label>
                  <input 
                    type="text" 
                    value={formData.nationality}
                    onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    placeholder="e.g. Indian"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Passport No.</label>
                  <input 
                    type="text" 
                    value={formData.passportNo}
                    onChange={(e) => setFormData({...formData, passportNo: e.target.value})}
                    placeholder="e.g. INP55428"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Seaman Book No.</label>
                  <input 
                    type="text" 
                    value={formData.seamanBookNo}
                    onChange={(e) => setFormData({...formData, seamanBookNo: e.target.value})}
                    placeholder="e.g. SB12918"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sign On Date</label>
                  <input 
                    type="date" 
                    value={formData.signOnDate}
                    onChange={(e) => setFormData({...formData, signOnDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contract Duration (Months)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="12"
                    value={formData.contractDuration}
                    onChange={(e) => setFormData({...formData, contractDuration: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Vessel Assignment</label>
                  <select
                    value={formData.vesselId}
                    onChange={(e) => setFormData({...formData, vesselId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="all">Global Pool / Unassigned</option>
                    {vessels.map(v => (
                      <option key={v.id} value={String(v.id)}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-bold text-blue-700 tracking-wider mb-2">Mandatory Certificates</h4>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Medical Exam Expiry</label>
                  <input 
                    type="date" 
                    value={formData.nextMedicalExam}
                    onChange={(e) => setFormData({...formData, nextMedicalExam: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Safety Training Expiry</label>
                  <input 
                    type="date" 
                    value={formData.nextSafetyTraining}
                    onChange={(e) => setFormData({...formData, nextSafetyTraining: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
                >
                  Register Onboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


// 2. Crew Compliance View Component
export const CrewComplianceView = ({ vessels, token }: { vessels: any[], token?: string }) => {
  const [crew, setCrew] = useState<CrewMember[]>([]);

  useEffect(() => {
    const fetchCrew = async () => {
      if (!token) {
        const saved = localStorage.getItem('comos_crew_list');
        setCrew(saved ? JSON.parse(saved) : INITIAL_CREW);
        return;
      }
      try {
        const resp = await fetch('/api/crew-members', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          setCrew(data);
        }
      } catch (err) {
        console.error('Failed to fetch crew for compliance:', err);
      }
    };
    fetchCrew();
  }, [token]);

  const now = new Date('2026-05-21'); // Current mock date context

  // Identify expiring items within 30 days
  const expiringMed = crew.filter(c => {
    const d = new Date(c.nextMedicalExam);
    const diff = d.getTime() - now.getTime();
    return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  });

  const expiringSafety = crew.filter(c => {
    const d = new Date(c.nextSafetyTraining);
    const diff = d.getTime() - now.getTime();
    return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  });

  const expiredMedOrSafety = crew.filter(c => {
    const med = new Date(c.nextMedicalExam);
    const safety = new Date(c.nextSafetyTraining);
    return med < now || safety < now;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-green-600" /> Crew Compliance & Status
        </h1>
        <p className="text-sm text-slate-500">Track professional endorsements, marine certifications, and mandatory compliance audits.</p>
      </div>

      {/* Compliance Overview Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medical Compliant</span>
            <span className="p-1 px-1.5 text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 rounded-md">Pass</span>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800">
              {Math.round((crew.filter(c => new Date(c.nextMedicalExam) >= now).length / crew.length) * 100)}%
            </h2>
            <p className="text-xs text-slate-500 mt-1">Valid marine fitness exams.</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Safety Endorsed</span>
            <span className="p-1 px-1.5 text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 rounded-md">Pass</span>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800">
              {Math.round((crew.filter(c => new Date(c.nextSafetyTraining) >= now).length / crew.length) * 100)}%
            </h2>
            <p className="text-xs text-slate-500 mt-1">Valid STCW basic safety modules.</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Expiring (30 Days)</span>
            <span className="p-1 px-1.5 text-[10px] uppercase font-bold text-amber-700 bg-amber-50 rounded-md">Attention</span>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800">
              {expiringMed.length + expiringSafety.length} Alert
            </h2>
            <p className="text-xs text-slate-500 mt-1">Contracts requiring review.</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Expired Status</span>
            <span className="p-1 px-1.5 text-[10px] uppercase font-bold text-red-700 bg-red-50 rounded-md">Critical</span>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-red-600">
              {expiredMedOrSafety.length} Expired
            </h2>
            <p className="text-xs text-slate-500 mt-1">Requires immediate replacement.</p>
          </div>
        </div>
      </div>

      {/* Warning Panels if any */}
      {expiredMedOrSafety.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-red-800 text-sm">Critical Certification Deficiencies Onboard</h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              The following crew members are currently working onboard with expired medical certificates or STCW safety training records. This poses a compliance hazard for Port State Controls and vessel classification status.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {expiredMedOrSafety.map(c => (
                <span key={c.id} className="bg-white px-2.5 py-1 rounded-lg text-xs font-semibold text-red-800 shadow-xs border border-red-200">
                  {c.name} ({c.rank})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Certificate Timelines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Medical Exams Tracking */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" /> Medical Fitness Certifications
          </h2>
          <div className="divide-y divide-slate-100">
            {crew.map(c => {
              const date = new Date(c.nextMedicalExam);
              const isExpired = date < now;
              const isWarning = !isExpired && (date.getTime() - now.getTime()) <= 30 * 24 * 60 * 60 * 1000;
              return (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{c.name}</h4>
                    <p className="text-xs text-slate-400">{c.rank}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-mono font-bold ${
                      isExpired ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {c.nextMedicalExam}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isExpired ? 'EXPIRED' : isWarning ? 'EXPIRING SOON' : 'Valid'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Safety Training STCW Tracking */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" /> STCW Basic Safety Training
          </h2>
          <div className="divide-y divide-slate-100">
            {crew.map(c => {
              const date = new Date(c.nextSafetyTraining);
              const isExpired = date < now;
              const isWarning = !isExpired && (date.getTime() - now.getTime()) <= 30 * 24 * 60 * 60 * 1000;
              return (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{c.name}</h4>
                    <p className="text-xs text-slate-400">{c.rank}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-mono font-bold ${
                      isExpired ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {c.nextSafetyTraining}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isExpired ? 'EXPIRED' : isWarning ? 'EXPIRING SOON' : 'Valid'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};


// 3. Audit Registry View Component
export const AuditRegistryView = ({ vessels, prefilteredType, token }: { vessels: any[], prefilteredType?: string, token?: string }) => {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAudits = async () => {
    if (!token) {
      const saved = localStorage.getItem('comos_audits_list');
      setAudits(saved ? JSON.parse(saved) : INITIAL_AUDITS);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/audit-records', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setAudits(data);
      }
    } catch (err) {
      console.error('Failed to fetch audits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, [token]);

  const [filterType, setFilterType] = useState(prefilteredType || 'All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showModal, setShowModal] = useState(false);

  // Sync state if prefilteredType changes
  useEffect(() => {
    if (prefilteredType) {
      setFilterType(prefilteredType);
    } else {
      setFilterType('All');
    }
  }, [prefilteredType]);

  // Form State
  const [formData, setFormData] = useState({
    type: 'Internal Audit',
    date: '',
    inspectorName: '',
    inspectorOrganization: '',
    scope: '',
    vesselId: 'all'
  });

  const saveAuditsFallback = (newAudits: AuditRecord[]) => {
    setAudits(newAudits);
    if (!token) {
      localStorage.setItem('comos_audits_list', JSON.stringify(newAudits));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.inspectorName || !formData.date) return;

    const newAudit: AuditRecord = {
      id: 'a_' + Date.now(),
      type: formData.type as any,
      vesselId: formData.vesselId,
      date: formData.date,
      inspectorName: formData.inspectorName,
      inspectorOrganization: formData.inspectorOrganization || 'Classification Society',
      status: 'Scheduled',
      findingsCount: 0,
      scope: formData.scope || 'General Safety compliance audit'
    };

    if (token) {
      try {
        const resp = await fetch('/api/audit-records', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newAudit)
        });
        if (resp.ok) {
          fetchAudits();
        } else {
          const err = await resp.json();
          alert(`Failed to save audit: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to post audit:', err);
      }
    } else {
      saveAuditsFallback([newAudit, ...audits]);
    }

    setShowModal(false);
    setFormData({
      type: 'Internal Audit',
      date: '',
      inspectorName: '',
      inspectorOrganization: '',
      scope: '',
      vesselId: 'all'
    });
  };

  const filteredAudits = audits.filter(audit => {
    const matchesType = filterType === 'All' || audit.type === filterType;
    const matchesStatus = filterStatus === 'All' || audit.status === filterStatus;
    return matchesType && matchesStatus;
  });

  const getVesselName = (id: string) => {
    if (id === 'all' || id === 'any') return 'Universal Fleet';
    const found = vessels.find(v => String(v.id) === id);
    return found ? found.name : 'Unknown Vessel';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" /> Fleet Audits & Inspections
          </h1>
          <p className="text-sm text-slate-500">Record regulatory surveys, Port State Controls, Class Audits, and Vetting Inspections.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-100 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Schedule Audit
        </button>
      </div>

      {/* Grid statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Audits</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{audits.length} Surveys</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Completed</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
            {audits.filter(a => a.status === 'Completed').length} Audits
          </h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Scheduled Surveys</p>
          <h3 className="text-2xl font-extrabold text-blue-600 mt-1">
            {audits.filter(a => a.status === 'Scheduled' || a.status === 'In Progress').length} Pending
          </h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Overdue Tasks</p>
          <h3 className="text-2xl font-extrabold text-red-600 mt-1">
            {audits.filter(a => a.status === 'Overdue').length} Overdue
          </h3>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 items-center">
        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
          <Sliders className="w-4 h-4" /> Filter By:
        </div>
        <div className="flex gap-2">
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none"
          >
            <option value="All">All Types</option>
            <option value="Internal Audit">Internal Audit</option>
            <option value="External Audit">External Audit</option>
            <option value="PSC Inspection">PSC Inspection</option>
            <option value="Vetting Inspection">Vetting Inspection</option>
            <option value="VIR">VIR</option>
            <option value="Navigational Audit">Navigational Audit</option>
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Table details */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Audit Type & Date</th>
                <th className="px-6 py-4">Inspector Details</th>
                <th className="px-6 py-4">Vessel Coverage</th>
                <th className="px-6 py-4">Audit Scope</th>
                <th className="px-6 py-4">Non-Conformities</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredAudits.map(audit => (
                <tr key={audit.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{audit.type}</div>
                    <div className="text-xs font-mono font-semibold text-slate-400 mt-0.5">{audit.date}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{audit.inspectorName}</div>
                    <div className="text-xs text-slate-400">{audit.inspectorOrganization}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                    {getVesselName(audit.vesselId)}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                    {audit.scope}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      audit.findingsCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                    }`}>
                      {audit.findingsCount} Deficiencies
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      audit.status === 'Completed' ? 'bg-green-50 text-green-700' :
                      audit.status === 'Overdue' ? 'bg-red-50 text-red-700' :
                      audit.status === 'In Progress' ? 'bg-amber-50 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {audit.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" /> Schedule Survey or Audit
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-150 rounded-lg text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Audit Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="Internal Audit">Internal Audit</option>
                    <option value="External Audit">External Audit</option>
                    <option value="PSC Inspection">PSC Inspection</option>
                    <option value="Vetting Inspection">Vetting Inspection</option>
                    <option value="VIR">VIR</option>
                    <option value="Navigational Audit">Navigational Audit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Audit Date</label>
                  <input 
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Lead Inspector name</label>
                  <input 
                    type="text"
                    required
                    value={formData.inspectorName}
                    onChange={(e) => setFormData({...formData, inspectorName: e.target.value})}
                    placeholder="e.g. Marcus Lindman"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Organization / Society</label>
                  <input 
                    type="text"
                    value={formData.inspectorOrganization}
                    onChange={(e) => setFormData({...formData, inspectorOrganization: e.target.value})}
                    placeholder="e.g. DNV Classification Society / Paris MOU PSC"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Scope description</label>
                  <textarea 
                    value={formData.scope}
                    onChange={(e) => setFormData({...formData, scope: e.target.value})}
                    placeholder="e.g. Life-saving appliances survey, pollution manual checks..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Vessel</label>
                  <select 
                    value={formData.vesselId}
                    onChange={(e) => setFormData({...formData, vesselId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="all">Universal Fleet (All Vessels)</option>
                    {vessels.map(v => (
                      <option key={v.id} value={String(v.id)}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
                >
                  Schedule Survey
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


// 4. Non-Conformity Tracker View Component
export const NonConformityTrackerView = ({ vessels, token }: { vessels: any[], token?: string }) => {
  const [ncs, setNcs] = useState<NonConformity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNcs = async () => {
    if (!token) {
      const saved = localStorage.getItem('comos_ncs_list');
      setNcs(saved ? JSON.parse(saved) : INITIAL_NCS);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/non-conformities', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setNcs(data);
      }
    } catch (err) {
      console.error('Failed to fetch NCs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNcs();
  }, [token]);

  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    sourceType: 'Internal',
    category: 'Safety',
    description: '',
    raisedDate: '',
    dueDate: '',
    actionPlan: '',
    inspectorName: '',
    vesselId: 'all'
  });

  const saveNcsFallback = (newNcs: NonConformity[]) => {
    setNcs(newNcs);
    if (!token) {
      localStorage.setItem('comos_ncs_list', JSON.stringify(newNcs));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.dueDate) return;

    const newNc: NonConformity = {
      id: 'nc_' + Date.now(),
      auditId: 'adhoc',
      vesselId: formData.vesselId,
      sourceType: formData.sourceType as any,
      category: formData.category as any,
      description: formData.description,
      raisedDate: formData.raisedDate || new Date().toISOString().split('T')[0],
      dueDate: formData.dueDate,
      status: 'Open',
      actionPlan: formData.actionPlan || 'Corrective action plan pending detail reviews.',
      inspectorName: formData.inspectorName || 'HSEQ Manager'
    };

    if (token) {
      try {
        const resp = await fetch('/api/non-conformities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newNc)
        });
        if (resp.ok) {
          fetchNcs();
        } else {
          const err = await resp.json();
          alert(`Failed to save non-conformity: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to post non-conformity:', err);
      }
    } else {
      saveNcsFallback([newNc, ...ncs]);
    }

    setShowModal(false);
    setFormData({
      sourceType: 'Internal',
      category: 'Safety',
      description: '',
      raisedDate: '',
      dueDate: '',
      actionPlan: '',
      inspectorName: '',
      vesselId: 'all'
    });
  };

  const handleCloseout = async (id: string) => {
    const action = prompt('Enter closeout action/corrective comments:');
    if (action === null) return; // cancel

    const itemToClose = ncs.find(item => item.id === id);
    if (!itemToClose) return;

    const updatedItem = {
      ...itemToClose,
      status: 'Closed' as const,
      closeoutDate: new Date().toISOString().split('T')[0],
      actionPlan: action || itemToClose.actionPlan
    };

    if (token) {
      try {
        const resp = await fetch(`/api/non-conformities/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedItem)
        });
        if (resp.ok) {
          fetchNcs();
        } else {
          const err = await resp.json();
          alert(`Failed to closeout non-conformity: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to close NC:', err);
      }
    } else {
      setNcs(ncs.map(item => item.id === id ? updatedItem : item));
    }
  };

  const filteredNcs = ncs.filter(nc => {
    const matchesCategory = filterCategory === 'All' || nc.category === filterCategory;
    const matchesSource = filterSource === 'All' || nc.sourceType === filterSource;
    const matchesStatus = filterStatus === 'All' || nc.status === filterStatus;
    return matchesCategory && matchesSource && matchesStatus;
  });

  const getVesselName = (id: string) => {
    if (id === 'all' || id === 'any') return 'Universal Fleet';
    const found = vessels.find(v => String(v.id) === id);
    return found ? found.name : 'Unknown Vessel';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" /> Non-Conformity Tracker
          </h1>
          <p className="text-sm text-slate-500">Record deficiencies, trigger correction workflows, and manage audit findings closeouts.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-100 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Raise Defect / Finding
        </button>
      </div>

      {/* Stats summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-red-50/50 p-4 rounded-xl border border-red-150 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-red-500 font-bold uppercase tracking-wider">Active Open NCs</p>
            <h3 className="text-xl font-extrabold text-red-700">
              {ncs.filter(n => n.status === 'Open').length} Findings
            </h3>
          </div>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-150 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-amber-500 font-bold uppercase tracking-wider">Overdue Corrective Actions</p>
            <h3 className="text-xl font-extrabold text-amber-700 font-mono">
              {ncs.filter(n => n.status === 'Overdue').length} Critical
            </h3>
          </div>
        </div>

        <div className="bg-green-50/50 p-4 rounded-xl border border-green-150 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-green-500 font-bold uppercase tracking-wider">Resolved Findings</p>
            <h3 className="text-xl font-extrabold text-green-700">
              {ncs.filter(n => n.status === 'Closed').length} Closed
            </h3>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
          <Sliders className="w-4 h-4" /> Filters:
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Safety">Safety</option>
            <option value="Environmental">Environmental</option>
            <option value="Navigational">Navigational</option>
            <option value="Operational">Operational</option>
            <option value="Maintenance">Maintenance</option>
          </select>

          <select 
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none"
          >
            <option value="All">All Origins</option>
            <option value="Internal">Internal Audit</option>
            <option value="External">External Registry</option>
            <option value="PSC">PSC Inspection</option>
            <option value="Vetting">Vetting Audit</option>
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Table details */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Finding Details</th>
                <th className="px-6 py-4">Vessel</th>
                <th className="px-6 py-4">Timeline (Raised / Due)</th>
                <th className="px-6 py-4">Inspector & Origin</th>
                <th className="px-6 py-4">Closeout / Action Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredNcs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">No Non-Conformity reports matching filters.</td>
                </tr>
              ) : (
                filteredNcs.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 max-w-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-widest bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-slate-800 text-xs leading-relaxed font-medium">{item.description}</p>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                      {getVesselName(item.vesselId)}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      <div>Raised: {item.raisedDate}</div>
                      <div className={`mt-0.5 font-bold ${item.status === 'Overdue' ? 'text-red-600' : 'text-slate-500'}`}>
                        Due: {item.dueDate}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{item.inspectorName}</div>
                      <div className="text-xs text-slate-400">Via {item.sourceType} Inspection</div>
                    </td>
                    <td className="px-6 py-4 text-xs max-w-xs">
                      <p className="text-slate-500 italic leading-relaxed">{item.actionPlan}</p>
                      {item.closeoutDate && (
                        <div className="text-[10px] text-green-600 font-bold mt-1 uppercase font-mono">
                          Closed Date: {item.closeoutDate}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        item.status === 'Closed' ? 'bg-green-50 text-green-700' :
                        item.status === 'Overdue' ? 'bg-red-50 text-red-700 font-bold animate-pulse' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.status !== 'Closed' && (
                        <button 
                          onClick={() => handleCloseout(item.id)}
                          className="flex items-center gap-1 mx-auto px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Resolve NC
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NC Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Raise New Non-Conformity or Finding
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-150 rounded-lg text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Origin Inspection Type</label>
                  <select 
                    value={formData.sourceType}
                    onChange={(e) => setFormData({...formData, sourceType: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="Internal">Internal Audit</option>
                    <option value="External">External Registry</option>
                    <option value="PSC">PSC Inspection</option>
                    <option value="Vetting">Vetting Campaign</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Defect Category</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="Safety">Safety</option>
                    <option value="Environmental">Environmental</option>
                    <option value="Navigational">Navigational</option>
                    <option value="Operational">Operational</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filing Officer / Auditor</label>
                  <input 
                    type="text"
                    required
                    value={formData.inspectorName}
                    onChange={(e) => setFormData({...formData, inspectorName: e.target.value})}
                    placeholder="e.g. Chief Mate / HSEQ Officer"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filing Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe the discrepancy clearly..."
                    rows={3}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date Raised</label>
                  <input 
                    type="date"
                    value={formData.raisedDate}
                    onChange={(e) => setFormData({...formData, raisedDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Closeout Date (Due)</label>
                  <input 
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Audited Vessel</label>
                  <select 
                    value={formData.vesselId}
                    onChange={(e) => setFormData({...formData, vesselId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="all">Universal Fleet (All Vessels)</option>
                    {vessels.map(v => (
                      <option key={v.id} value={String(v.id)}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Corrective Action Plan Outline</label>
                  <textarea 
                    value={formData.actionPlan}
                    onChange={(e) => setFormData({...formData, actionPlan: e.target.value})}
                    placeholder="Outline immediate temporary or permanent action steps..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
                >
                  File Defect / Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
