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
  FileText,
  MessageSquare,
  Send,
  Upload,
  Ship,
  Compass,
  ClipboardList,
  Paperclip,
  Download,
  Anchor,
  History
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'vessel' | 'team_pic';
  team_ids: number[];
  vessel_id?: number | null;
}

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
  contractEndDate?: string;
  extensionsCount?: number;
  nextMedicalExam: string; // ISO date
  nextSafetyTraining: string; // ISO date
  vesselId: string;
  birthdate?: string;
  contactNumber?: string;
  photo?: string;
  hiringStatus?: string;
  siComments?: string;
}

export interface CrewHistoryEntry {
  id: string;
  crewId: string;
  vesselId: string;
  vesselName: string;
  rank: string;
  signOnDate: string;
  disembarkDate: string;
  remarks: string;
  ageAtContract?: number | string;
  contactAtContract?: string;
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
    nationality: 'Filipino',
    signOnDate: '2026-02-15',
    passportNo: 'UKP992831',
    seamanBookNo: 'SB883712',
    status: 'Compliant',
    contractDuration: 4,
    nextMedicalExam: '2027-02-15',
    nextSafetyTraining: '2028-04-10',
    vesselId: 'any',
    birthdate: '1981-08-14',
    contactNumber: '+1 (206) 555-0143',
    photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&q=80',
    hiringStatus: 'for rehire',
    siComments: 'Excellent master captain, exceptional navigation logs, and handles adverse weather flawlessly.'
  },
  {
    id: 'c2',
    name: 'Nikolai Volkov',
    rank: 'Chief Engineer',
    nationality: 'Filipino',
    signOnDate: '2025-11-20',
    passportNo: 'UAP118274',
    seamanBookNo: 'SB227419',
    status: 'Warning',
    contractDuration: 6,
    nextMedicalExam: '2026-06-05', // close to expiring soon (Current date: May 2026)
    nextSafetyTraining: '2026-09-12',
    vesselId: 'any',
    birthdate: '1979-05-22',
    contactNumber: '+380 (44) 555-3814',
    photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&q=80',
    hiringStatus: 'for debriefing',
    siComments: 'Strong engineering performance, although needs debrief on fuel consumption logs for last run.'
  },
  {
    id: 'c3',
    name: 'Sanjay Mehta',
    rank: 'Chief Officer',
    nationality: 'Filipino',
    signOnDate: '2026-01-10',
    passportNo: 'INP554627',
    seamanBookNo: 'SB110928',
    status: 'Compliant',
    contractDuration: 6,
    nextMedicalExam: '2027-01-10',
    nextSafetyTraining: '2029-05-20',
    vesselId: 'any',
    birthdate: '1988-12-10',
    contactNumber: '+91 (22) 5555-8321',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&q=80',
    hiringStatus: 'for rehire',
    siComments: 'Very proactive mate, maintains safety drills diligently.'
  },
  {
    id: 'c4',
    name: 'Carlos Santos',
    rank: 'Second Engineer',
    nationality: 'Filipino',
    signOnDate: '2026-03-01',
    passportNo: 'BRP448371',
    seamanBookNo: 'SB992831',
    status: 'Compliant',
    contractDuration: 5,
    nextMedicalExam: '2027-03-01',
    nextSafetyTraining: '2028-11-15',
    vesselId: 'any',
    birthdate: '1992-03-15',
    contactNumber: '+55 (21) 95555-1291',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&q=80',
    hiringStatus: 'for rehire',
    siComments: 'Technically gifted engineer, keeps excellent records of main engine parameters.'
  },
  {
    id: 'c5',
    name: 'Chen Wei',
    rank: 'Second Officer',
    nationality: 'Filipino',
    signOnDate: '2025-08-15',
    passportNo: 'CNP661128',
    seamanBookNo: 'SB442831',
    status: 'Expired',
    contractDuration: 9,
    nextMedicalExam: '2026-04-15', // already expired in April 2026
    nextSafetyTraining: '2027-08-15',
    vesselId: 'any',
    birthdate: '1994-07-30',
    contactNumber: '+86 (10) 555-2741',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80',
    hiringStatus: 'not for rehire',
    siComments: 'Disregarded voyage plan twice. Recommend NOT to rehire.'
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
    vesselId: 'any',
    birthdate: '1985-11-04',
    contactNumber: '+63 (2) 555-9382',
    photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&q=80',
    hiringStatus: 'for rehire',
    siComments: 'Great culinary skills, takes excellent care of galley inventory and hygiene.'
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

export const calculateAge = (birthdateStr?: string): number | string => {
  if (!birthdateStr) return 'N/A';
  const birth = new Date(birthdateStr);
  if (isNaN(birth.getTime())) return 'N/A';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const getContractHighlightClass = (contractEndDateStr?: string, extensionsCount?: number): string => {
  if (!contractEndDateStr) return 'hover:bg-slate-50';
  const endDate = new Date(contractEndDateStr);
  if (isNaN(endDate.getTime())) return 'hover:bg-slate-50';
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  const hasExtension = typeof extensionsCount === 'number' && extensionsCount > 0;
  
  if (diffDays < 30) {
    return 'bg-red-50 hover:bg-red-100/80 transition-colors';
  } else if (hasExtension || diffDays < 120) {
    return 'bg-amber-50 hover:bg-amber-100/80 transition-colors';
  }
  return 'hover:bg-slate-50';
};

export const calculateOnboardDuration = (signOnDateStr?: string): string => {
  if (!signOnDateStr) return 'N/A';
  const startDate = new Date(signOnDateStr);
  if (isNaN(startDate.getTime())) return 'N/A';
  const endDate = new Date();
  
  if (startDate > endDate) {
    return '0 months - 0 days';
  }
  
  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();
  
  if (days < 0) {
    const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    days += prevMonth.getDate();
    months--;
  }
  
  if (months < 0) {
    months += 12;
    years--;
  }
  
  const totalMonths = (years * 12) + months;
  const monthLabel = totalMonths === 1 ? 'month' : 'months';
  const dayLabel = days === 1 ? 'day' : 'days';
  
  return `${totalMonths} ${monthLabel} - ${days} ${dayLabel}`;
};

// 1. Crew ListView Component
export const CrewListView = ({ vessels, token, currentUser }: { vessels: any[], token?: string, currentUser?: User }) => {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Find activeUser with fallback to localStorage
  const activeUser = (() => {
    if (currentUser) return currentUser;
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();
  const isVesselUser = activeUser?.role === 'vessel' && activeUser?.vessel_id;
  const isAdminOrPic = activeUser?.role === 'admin' || activeUser?.role === 'team_pic' || activeUser?.role === 'user';
  const userVesselId = isVesselUser ? String(activeUser.vessel_id) : '';

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
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

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
  const [filterVessel, setFilterVessel] = useState(() => {
    return isVesselUser ? userVesselId : 'All';
  });

  useEffect(() => {
    if (isVesselUser && userVesselId) {
      setFilterVessel(userVesselId);
    }
  }, [isVesselUser, userVesselId]);

  // Form State
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null);
  const [signOnMode, setSignOnMode] = useState<'idle' | 'select' | 'new'>('idle');
  
  // Pool view states
  const [poolSearch, setPoolSearch] = useState('');
  const [poolRankFilter, setPoolRankFilter] = useState('');
  const [poolSortConfig, setPoolSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [viewingProfile, setViewingProfile] = useState<CrewMember | null>(null);

  // Crew History States
  const [profileTab, setProfileTab] = useState<'info' | 'history'>('info');
  const [crewHistory, setCrewHistory] = useState<CrewHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Disembark Dialogue Box States
  const [showDisembarkDialog, setShowDisembarkDialog] = useState(false);
  const [disembarkingCrew, setDisembarkingCrew] = useState<CrewMember | null>(null);
  const [disembarkStep, setDisembarkStep] = useState<'confirm' | 'reason'>('confirm');
  const [disembarkReason, setDisembarkReason] = useState('');

  // Assign Crew Dialogue Box States
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningCrew, setAssigningCrew] = useState<CrewMember | null>(null);
  const [assignSignOnDate, setAssignSignOnDate] = useState('');
  const [assignContractDuration, setAssignContractDuration] = useState('6');
  const [assignVesselId, setAssignVesselId] = useState('');

  const fetchCrewHistory = async (crewId: string) => {
    if (!token) {
      const saved = localStorage.getItem('comos_crew_history');
      const allHistory: CrewHistoryEntry[] = saved ? JSON.parse(saved) : [];
      setCrewHistory(allHistory.filter(h => h.crewId === crewId).reverse());
      return;
    }
    setHistoryLoading(true);
    try {
      const resp = await fetch(`/api/crew-members/${crewId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setCrewHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch crew history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (viewingProfile) {
      fetchCrewHistory(viewingProfile.id);
      setProfileTab('info');
    } else {
      setCrewHistory([]);
    }
  }, [viewingProfile, token]);

  const executeDisembark = async (member: CrewMember, finishedContract: boolean, disembarkRemarks: string) => {
    if (token) {
      try {
        const resp = await fetch(`/api/crew-members/${member.id}/disembark`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ finishedContract, remarks: disembarkRemarks })
        });
        if (resp.ok) {
          fetchCrew();
          setViewingProfile(null);
          handleCloseModal();
        } else {
          alert('Failed to disembark crew member');
        }
      } catch (err) {
        console.error('Error disembarking crew member:', err);
      }
    } else {
      // Offline fallback
      const historyId = 'ch_' + Math.random().toString(36).substring(2, 11);
      const disembarkDate = new Date().toISOString().split('T')[0];
      const signOnDate = member.signOnDate || '';
      const vName = getVesselName(member.vesselId) || 'Unassigned';

      let ageAtContractVal: number | string = 'N/A';
      if (member.birthdate && signOnDate) {
        const bdate = new Date(member.birthdate);
        const sdate = new Date(signOnDate);
        let age = sdate.getFullYear() - bdate.getFullYear();
        const mDiff = sdate.getMonth() - bdate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && sdate.getDate() < bdate.getDate())) {
          age--;
        }
        ageAtContractVal = age;
      }

      const newHistoryEntry: CrewHistoryEntry = {
        id: historyId,
        crewId: member.id,
        vesselId: member.vesselId || '',
        vesselName: vName,
        rank: member.rank,
        signOnDate: signOnDate,
        disembarkDate: disembarkDate,
        remarks: disembarkRemarks,
        ageAtContract: ageAtContractVal,
        contactAtContract: member.contactNumber || ''
      };

      const savedHistory = localStorage.getItem('comos_crew_history');
      const allHistory: CrewHistoryEntry[] = savedHistory ? JSON.parse(savedHistory) : [];
      allHistory.push(newHistoryEntry);
      localStorage.setItem('comos_crew_history', JSON.stringify(allHistory));

      const updatedMember: CrewMember = {
        ...member,
        vesselId: '',
        signOnDate: '',
        contractEndDate: '',
        extensionsCount: 0
      };

      saveCrewFallback(crew.map(m => m.id === member.id ? updatedMember : m));
      setViewingProfile(null);
      handleCloseModal();
    }
  };

  const openAssignPrompt = (member: CrewMember) => {
    setAssigningCrew(member);
    setAssignSignOnDate(new Date().toISOString().split('T')[0]); // Default to today
    setAssignContractDuration('6'); // Default to 6 months
    setAssignVesselId(isVesselUser ? userVesselId : (formData.vesselId || ''));
    setShowAssignDialog(true);
  };

  const handlePoolSort = (key: string) => {
    setPoolSortConfig(prev => {
        if (prev?.key === key) {
            return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { key, direction: 'asc' };
    });
  }

  const filteredSortedCrew = React.useMemo(() => {
    if (isVesselUser && !poolSearch.trim()) {
      return [];
    }
    let filtered = crew.filter(c => 
        (String(c.vesselId) === 'all' || String(c.vesselId) === 'any' || !c.vesselId) &&
        (c.name.toLowerCase().includes(poolSearch.toLowerCase()) || c.rank.toLowerCase().includes(poolSearch.toLowerCase())) &&
        (poolRankFilter === '' || c.rank === poolRankFilter)
    );

    if (poolSortConfig) {
        filtered.sort((a, b) => {
            let valA: any = poolSortConfig.key === 'birthdate' ? calculateAge(a.birthdate) : a[poolSortConfig.key as keyof CrewMember];
            let valB: any = poolSortConfig.key === 'birthdate' ? calculateAge(b.birthdate) : b[poolSortConfig.key as keyof CrewMember];
            
            if (valA === undefined) valA = '';
            if (valB === undefined) valB = '';

            if (valA < valB) return poolSortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return poolSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return filtered;
  }, [crew, poolSearch, poolRankFilter, poolSortConfig]);

  const ranks = React.useMemo(() => Array.from(new Set(crew.map(c => c.rank))), [crew]);

  const [formData, setFormData] = useState({
    name: '',
    rank: '',
    birthdate: '',
    contactNumber: '',
    signOnDate: '',
    contractDuration: '',
    contractEndDate: '',
    vesselId: isVesselUser ? userVesselId : '',
    photo: '',
    extensionMonths: '0'
  });

  const calculateEndDate = (startDate: string, durationMonths: string) => {
      if (!startDate || !durationMonths) return '';
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + parseInt(durationMonths));
      return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (formData.signOnDate && formData.contractDuration) {
      const totalMonths = Number(formData.contractDuration) + Number(formData.extensionMonths || 0);
      setFormData(prev => ({...prev, contractEndDate: calculateEndDate(formData.signOnDate, String(totalMonths))}));
    }
  }, [formData.signOnDate, formData.contractDuration, formData.extensionMonths]);

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCrew(null);
    setViewingProfile(null);
    setSignOnMode('idle');
    setFormData({
      name: '',
      rank: '',
      birthdate: '',
      contactNumber: '',
      signOnDate: '',
      contractDuration: '',
      contractEndDate: '',
      vesselId: isVesselUser ? userVesselId : '',
      photo: '',
      extensionMonths: '0'
    });
  };

  const saveCrewFallback = (newCrewList: CrewMember[]) => {
    setCrew(newCrewList);
    if (!token) {
      localStorage.setItem('comos_crew_list', JSON.stringify(newCrewList));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rank) return;

    if (editingCrew) {
      // Edit flow
      const extM = Number(formData.extensionMonths || 0);
      const originalDuration = Number(formData.contractDuration) || 0;
      const newDuration = originalDuration + extM;
      const newExtensionsCount = (editingCrew.extensionsCount || 0) + (extM > 0 ? 1 : 0);
      const finalEndDate = calculateEndDate(formData.signOnDate, String(newDuration));

      const updatedCrew: CrewMember = {
        ...editingCrew,
        name: formData.name,
        rank: formData.rank,
        signOnDate: formData.signOnDate || '',
        contractDuration: newDuration,
        contractEndDate: finalEndDate || formData.contractEndDate || '',
        vesselId: isVesselUser ? userVesselId : (formData.vesselId || ''),
        birthdate: formData.birthdate || '',
        contactNumber: formData.contactNumber || '',
        photo: formData.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80',
        extensionsCount: newExtensionsCount
      };

      if (token) {
        try {
          const resp = await fetch(`/api/crew-members/${editingCrew.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedCrew)
          });
          if (resp.ok) {
            fetchCrew();
          } else {
            const err = await resp.json();
            alert(`Failed to update crew: ${err.error || 'Server error'}`);
          }
        } catch (err) {
          console.error('Failed to update crew member:', err);
        }
      } else {
        saveCrewFallback(crew.map(c => c.id === editingCrew.id ? updatedCrew : c));
      }
    } else {
      // Create flow
      const newCrew: CrewMember = {
        id: 'c_' + Date.now(),
        name: formData.name,
        rank: formData.rank,
        nationality: 'Filipino',
        signOnDate: formData.signOnDate || '',
        passportNo: 'N/A',
        seamanBookNo: 'N/A',
        status: 'Compliant',
        contractDuration: formData.contractDuration ? Number(formData.contractDuration) : 0,
        contractEndDate: formData.contractEndDate || '',
        nextMedicalExam: '',
        nextSafetyTraining: '',
        vesselId: isVesselUser ? userVesselId : (formData.vesselId || ''),
        birthdate: formData.birthdate || '',
        contactNumber: formData.contactNumber || '',
        photo: formData.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80',
        hiringStatus: 'for rehire',
        siComments: '',
        extensionsCount: 0
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
    }

    handleCloseModal();
  };

  const handleEditClick = (member: CrewMember) => {
    setEditingCrew(member);
    setFormData({
      name: member.name || '',
      rank: member.rank || '',
      birthdate: member.birthdate || '',
      contactNumber: member.contactNumber || '',
      signOnDate: member.signOnDate || '',
      contractDuration: member.contractDuration ? String(member.contractDuration) : '',
      contractEndDate: member.contractEndDate || '',
      vesselId: String(member.vesselId || ''),
      photo: member.photo || '',
      extensionMonths: '0'
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this crew member from the vessel onboard list?')) return;
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
      const updated = crew.map(c => {
        if (c.id === id) {
          return {
            ...c,
            vesselId: '',
            signOnDate: '',
            contractEndDate: '',
            contractDuration: 0,
            extensionsCount: 0
          };
        }
        return c;
      });
      saveCrewFallback(updated);
    }
  };

  const filteredCrew = crew.filter(member => {
    // List only crews that are currently assigned to a vessel and have an active contract
    const isAssigned = member.vesselId && member.vesselId !== 'any' && member.vesselId !== 'all';
    const hasActiveContract = member.contractEndDate && member.contractEndDate !== '';
    if (!isAssigned || !hasActiveContract) return false;

    const matchesSearch = member.name.toLowerCase().includes(search.toLowerCase()) || 
                          member.rank.toLowerCase().includes(search.toLowerCase());
    const matchesRank = filterRank === 'All' || member.rank === filterRank;
    const matchesStatus = filterStatus === 'All' || member.status === filterStatus;
    
    const effectiveVesselId = isVesselUser ? userVesselId : filterVessel;
    const matchesVessel = effectiveVesselId === 'All' || String(member.vesselId) === String(effectiveVesselId);
    return matchesSearch && matchesRank && matchesStatus && matchesVessel;
  });

  const vesselCrewOnly = isVesselUser 
    ? crew.filter(c => String(c.vesselId) === String(userVesselId))
    : crew;

  const getVesselName = (id: string) => {
    if (id === 'all' || id === 'any') return 'Global Pool / Unassigned';
    const found = vessels.find(v => String(v.id) === id);
    return found ? found.name : 'Unknown Vessel';
  };

  return (
    <div className="space-y-6">
      {/* Visual Header Banner - Sleek Blue/Indigo theme */}
      <div className="bg-gradient-to-r from-[#172554] to-[#0f172a] text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg border border-blue-900/30 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-2 flex-1">
          <div className="bg-blue-500/20 text-blue-100 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-semibold w-max uppercase tracking-wider font-mono">
            Vessel Crew Monitoring & Compliance
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-400" /> Onboard Crew List
          </h1>
          <p className="text-blue-200/70 text-sm max-w-xl leading-relaxed font-medium">
            Manage crew personnel details, service status, assign vessels, and track active contracts onboard the operational fleet.
          </p>
        </div>

        <button 
          onClick={() => {
            setEditingCrew(null);
            setSignOnMode(isVesselUser ? 'select' : 'idle');
            setFormData({
              name: '',
              rank: '',
              nationality: 'Filipino',
              passportNo: '',
              seamanBookNo: '',
              status: 'Compliant',
              birthdate: '',
              contactNumber: '',
              signOnDate: '',
              contractDuration: '',
              nextMedicalExam: '',
              nextSafetyTraining: '',
              vesselId: isVesselUser ? userVesselId : '',
              photo: ''
            });
            setShowModal(true);
          }}
          className="relative z-20 shrink-0 self-start md:self-center bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs tracking-tight uppercase px-5 py-3.5 rounded-2xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-blue-900/20"
        >
          <Plus className="w-4 h-4" /> Sign On Crew
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50/50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase font-mono">Total Crew Onboard</p>
            <h3 className="text-xl font-bold text-slate-850 mt-0.5">{vesselCrewOnly.length} Crew</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50/50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100/30">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase font-mono">Fully Compliant</p>
            <h3 className="text-xl font-bold text-emerald-700 mt-0.5">{vesselCrewOnly.filter(c => c.status === 'Compliant').length} Active</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50/50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase font-mono">Expiring & Warning</p>
            <h3 className="text-xl font-bold text-amber-700 mt-0.5">{vesselCrewOnly.filter(c => c.status !== 'Compliant').length} Alert</h3>
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
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 bg-slate-50/50"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={filterRank}
              onChange={(e) => setFilterRank(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 bg-white"
            >
              <option value="All">All Ranks</option>
              <option value="Master (Captain)">Master (Captain)</option>
              <option value="Chief Officer">Chief Officer</option>
              <option value="Second Officer">Second Officer</option>
              <option value="Chief Engineer">Chief Engineer</option>
              <option value="Second Engineer">Second Engineer</option>
              <option value="Chief Cook">Chief Cook</option>
            </select>
          </div>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 bg-white"
          >
            <option value="All">All Compliance</option>
            <option value="Compliant">Compliant</option>
            <option value="Warning">Warning</option>
            <option value="Expired">Expired</option>
          </select>

          {!isVesselUser && (
            <div className="flex items-center gap-1">
              <Ship className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={filterVessel}
                onChange={(e) => setFilterVessel(e.target.value)}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 bg-white"
              >
                <option value="All">All Vessels</option>
                {vessels.map(v => (
                  <option key={v.id} value={String(v.id)}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Crew Member</th>
                <th className="px-6 py-4">Duty Rank</th>
                <th className="px-6 py-4">Birthdate & Age</th>
                <th className="px-6 py-4">Assigned Vessel</th>
                <th className="px-6 py-4">Sign On Details</th>
                <th className="px-6 py-4">Onboard Duration</th>
                <th className="px-6 py-4">Contract End</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Crew Registry from Database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCrew.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                    No crew members found matching filters.
                  </td>
                </tr>
              ) : (
                filteredCrew.map(member => {
                  const rowClass = getContractHighlightClass(member.contractEndDate, member.extensionsCount);
                  return (
                    <tr key={member.id} className={`${rowClass} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={member.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80'} 
                          alt={member.name} 
                          className="w-10 h-10 rounded-full object-cover border border-slate-100 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{member.name}</div>
                          <div className="text-xs text-slate-400">ID: {member.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {member.rank}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                      <div>Born: {member.birthdate || 'N/A'}</div>
                      <div className="text-slate-400">Age: {member.birthdate ? calculateAge(member.birthdate) : 'N/A'} yrs</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                      {getVesselName(member.vesselId)}
                    </td>
                    <td className="px-6 py-4 text-xs space-y-0.5">
                      {member.signOnDate ? (
                        <>
                          <div className="font-semibold text-slate-600 font-semibold">On: {member.signOnDate}</div>
                           <div className="text-slate-400">Duration: {member.contractDuration || 'N/A'} Months</div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic font-semibold">Unassigned (No Sign-on)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                      {member.signOnDate ? (
                        <div className="font-semibold text-slate-600">{calculateOnboardDuration(member.signOnDate)}</div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs space-y-0.5 font-semibold text-slate-500">
                      {member.contractEndDate ? (
                        <>
                          <div className="font-semibold text-slate-600">{member.contractEndDate}</div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Extensions: {member.extensionsCount || 0}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => {
                            setViewingProfile(member);
                            setShowModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="View Profile Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!isVesselUser && isAdminOrPic && (
                          <button 
                            onClick={() => handleEditClick(member)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Edit Crew"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {!isVesselUser && (
                          <button 
                            onClick={() => handleDelete(member.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remove Crew"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-150 flex items-center justify-between bg-gradient-to-r from-slate-900 to-blue-950 text-white">
              <div className="space-y-0.5">
                <h2 className="text-base font-black tracking-tight flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-blue-400" /> {
                    viewingProfile ? 'Crew Member Profile' :
                    editingCrew ? 'Edit Crew Profile' :
                    'Sign On Crew Personnel'
                  }
                </h2>
                <p className="text-[10px] text-blue-200/70 font-medium tracking-wide">
                  {
                    viewingProfile ? 'Detailed personnel profile, contract terms, and remarks.' :
                    editingCrew ? 'Modify personnel assignment, contract terms, or bio details.' :
                    'Register new crew members or select from the global talent pool.'
                  }
                </p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-xl transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            

            {signOnMode === 'idle' && !editingCrew && !viewingProfile && (
              <div className={`p-6 grid gap-4 ${isVesselUser ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                <button 
                  onClick={() => setSignOnMode('select')}
                  className="group flex flex-col items-center text-center p-6 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/60 hover:border-blue-200 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-200/80 text-blue-600 rounded-xl flex items-center justify-center mb-4 transition-colors">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm mb-1">Select from Pool</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Assign an active, unassigned crew member from the global pool to a vessel.
                  </p>
                </button>

                {!isVesselUser && (
                  <button 
                    onClick={() => setSignOnMode('new')}
                    className="group flex flex-col items-center text-center p-6 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 hover:border-indigo-200 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-indigo-100 group-hover:bg-indigo-200/80 text-indigo-600 rounded-xl flex items-center justify-center mb-4 transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">Register New</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Create a brand new crew profile with certifications and personal details.
                    </p>
                  </button>
                )}
              </div>
            )}
            
            {(signOnMode === 'new' || editingCrew) && !viewingProfile && (
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
                {!editingCrew && (
                  <button 
                    type="button" 
                    onClick={() => setSignOnMode('idle')}
                    className="text-xs text-blue-600 font-extrabold hover:underline mb-2 inline-flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to selection
                  </button>
                )}
                
                {/* Section 1: Personal Profile */}
                <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <div className="border-b border-slate-200/60 pb-1.5 flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Personal Profile</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Photo Drag & Drop / File Upload */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Crew Profile Photo</label>
                      {formData.photo ? (
                        <div className="relative w-28 h-28 mx-auto rounded-full group overflow-hidden border-2 border-blue-500 shadow-md">
                          <img 
                            src={formData.photo} 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                          />
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, photo: ''})}
                            className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        </div>
                      ) : (
                        <div 
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          className={`h-28 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-3 transition-all relative ${
                            dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
                          }`}
                        >
                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                          <p className="text-xs font-bold text-slate-600 text-center">
                            Drag & drop photo here, or <span className="text-blue-600 underline cursor-pointer">browse</span>
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Supports JPEG, PNG format</p>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileChange}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" 
                            id="photoUploadInput"
                          />
                        </div>
                      )}
                    </div>
    
                    {/* Full name */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g. Alex Thorne"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:bg-white bg-white transition-all duration-200"
                      />
                    </div>
    
                    {/* Duty Rank */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Duty Rank</label>
                      <select 
                        value={formData.rank}
                        onChange={(e) => setFormData({...formData, rank: e.target.value})}
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all duration-200"
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
    
                    {/* Contact number */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Number</label>
                      <input 
                        type="text" 
                        value={formData.contactNumber}
                        onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
                        placeholder="e.g. +1 555-0143"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:bg-white bg-white transition-all duration-200"
                      />
                    </div>
    
                    {/* Birthdate */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Birthdate</label>
                      <input 
                        type="date" 
                        value={formData.birthdate}
                        onChange={(e) => setFormData({...formData, birthdate: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:bg-white bg-white transition-all duration-200"
                      />
                    </div>
    
                    {/* Age (Auto-computed) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Age (Auto-computed)</label>
                      <input 
                        type="text" 
                        readOnly
                        disabled
                        value={formData.birthdate ? `${calculateAge(formData.birthdate)} years old` : 'Enter birthdate...'}
                        className="w-full px-3 py-2 border border-slate-100 bg-slate-50/50 rounded-lg text-sm text-slate-500 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Contract & Assignment */}
                <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <div className="border-b border-slate-200/60 pb-1.5 flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-indigo-600 rounded-full" />
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contract & Assignment</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Sign on date */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sign On Date <span className="text-[9px] text-slate-400 normal-case font-normal">(Optional)</span></label>
                      <input 
                        type="date" 
                        value={formData.signOnDate}
                        onChange={(e) => setFormData({...formData, signOnDate: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:bg-white bg-white transition-all duration-200"
                      />
                    </div>
    
                     {/* Contract duration */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contract Duration (Months)</label>
                      <select
                        value={formData.contractDuration}
                        onChange={(e) => setFormData({...formData, contractDuration: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all duration-200"
                      >
                          <option value="">Select duration...</option>
                          <option value="6">6 Months</option>
                          <option value="9">9 Months</option>
                      </select>
                    </div>
                    
                    {/* Contract end date */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contract End Date</label>
                      <input 
                        type="date" 
                        readOnly
                        disabled
                        value={formData.contractEndDate}
                        className="w-full px-3 py-2 border border-slate-100 bg-slate-50/50 rounded-lg text-sm text-slate-500 font-bold"
                      />
                    </div>
    
                    {/* Assigned Vessel */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Vessel Assignment <span className="text-[9px] text-slate-400 normal-case font-normal">(Optional)</span></label>
                      <select
                        value={formData.vesselId}
                        onChange={(e) => setFormData({...formData, vesselId: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all duration-200"
                        disabled={isVesselUser}
                      >
                        <option value="">Select Vessel / Unassigned</option>
                        {vessels.map(v => (
                          <option key={v.id} value={String(v.id)}>{v.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Contract Extensions (Only shown when editing onboard crew) */}
                    {editingCrew && (
                      <div className="col-span-2 grid grid-cols-2 gap-4 border-t border-slate-150 pt-3 mt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Conducted Extensions
                          </label>
                          <div className="px-3 py-2 border border-slate-100 bg-slate-50/50 rounded-lg text-sm text-slate-600 font-bold flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md text-xs font-black">
                              {editingCrew.extensionsCount || 0}
                            </span>
                            Extensions Conducted
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Extend Contract By
                          </label>
                          <select
                            value={formData.extensionMonths}
                            onChange={(e) => setFormData({...formData, extensionMonths: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all duration-200 text-blue-700 font-bold"
                          >
                            <option value="0">No Extension</option>
                            <option value="1">+1 Month</option>
                            <option value="2">+2 Months</option>
                            <option value="3">+3 Months</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-100 cursor-pointer"
                  >
                    {editingCrew ? 'Save Changes' : 'Register'}
                  </button>
                </div>
              </form>
            )}
            
            {signOnMode === 'select' && !viewingProfile && (
              <div className="p-6 flex flex-col gap-4 h-[70vh]">
                 <div className="flex items-center justify-between border-b pb-3 mb-1">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" /> Select Crew from Global Pool
                    </h3>
                    {!isVesselUser && (
                      <button 
                        onClick={() => setSignOnMode('idle')} 
                        className="text-xs text-blue-600 font-extrabold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        ← Back
                      </button>
                    )}
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                   <input
                     type="text"
                     placeholder="Search name/rank..."
                     value={poolSearch}
                     onChange={(e) => setPoolSearch(e.target.value)}
                     className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
                   />
                   <select 
                     value={poolRankFilter} 
                     onChange={(e) => setPoolRankFilter(e.target.value)}
                     className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
                   >
                     <option value="">All Ranks</option>
                     {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                   </select>
                   {!isVesselUser && (
                     <select
                       value={formData.vesselId}
                       onChange={(e) => setFormData({...formData, vesselId: e.target.value})}
                       className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500 text-slate-700 font-medium"
                     >
                       <option value="">Assign Target Vessel...</option>
                       {vessels.map(v => (
                         <option key={v.id} value={String(v.id)}>{v.name}</option>
                       ))}
                     </select>
                   )}
                 </div>

                 <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-white border-b border-slate-150 shadow-xs z-10">
                            <tr>
                                {isVesselUser && (
                                  <th className="px-3 py-2.5 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">Picture</th>
                                )}
                                <th className="px-3 py-2.5 cursor-pointer hover:bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]" onClick={() => handlePoolSort('name')}>Name</th>
                                <th className="px-3 py-2.5 cursor-pointer hover:bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]" onClick={() => handlePoolSort('birthdate')}>Age</th>
                                <th className="px-3 py-2.5 cursor-pointer hover:bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]" onClick={() => handlePoolSort('rank')}>Rank</th>
                                {!isVesselUser && (
                                  <th className="px-3 py-2.5 cursor-pointer hover:bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]" onClick={() => handlePoolSort('hiringStatus')}>Status</th>
                                )}
                                <th className="px-3 py-2.5 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                           {filteredSortedCrew.length === 0 ? (
                             <tr>
                               <td colSpan={5} className="text-center py-8 text-slate-400 font-medium italic">
                                 {isVesselUser && !poolSearch.trim() 
                                   ? 'Start typing in the search field to find crew members to sign on.' 
                                   : 'No unassigned crew found in pool matching criteria.'}
                               </td>
                             </tr>
                           ) : (
                             filteredSortedCrew.map(c => (
                               <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                                  {isVesselUser && (
                                    <td className="px-3 py-2.5">
                                      <img 
                                        src={c.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80'} 
                                        alt={c.name} 
                                        className="w-8 h-8 rounded-full object-cover border border-slate-100 flex-shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                    </td>
                                  )}
                                  <td className="px-3 py-2.5 font-bold text-slate-800">{c.name}</td>
                                  <td className="px-3 py-2.5 text-slate-600 font-medium">{calculateAge(c.birthdate)} yrs</td>
                                  <td className="px-3 py-2.5 text-blue-600 font-semibold">{c.rank}</td>
                                  {!isVesselUser && (
                                    <td className="px-3 py-2.5">
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                                        {c.hiringStatus || 'Available'}
                                      </span>
                                    </td>
                                  )}
                                  <td className="px-3 py-2.5 text-right">
                                      <div className="flex gap-1.5 justify-end">
                                          {!isVesselUser && (
                                            <button 
                                              onClick={() => setViewingProfile(c)} 
                                              className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors cursor-pointer"
                                              title="View Profile"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          {!isVesselUser && isAdminOrPic && (
                                            <button 
                                              onClick={() => {
                                                setSignOnMode('idle');
                                                handleEditClick(c);
                                              }} 
                                              className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors cursor-pointer"
                                              title="Edit Profile"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <button 
                                              onClick={() => openAssignPrompt(c)}
                                              className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                                              title="Assign Crew"
                                          >
                                            <UserCheck className="w-3.5 h-3.5" />
                                          </button>
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
            
            {viewingProfile && (
              <div className="p-6 flex flex-col h-[70vh]">
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" /> Crew Member Profile
                  </h3>
                  {signOnMode === 'select' && (
                    <button 
                      onClick={() => setViewingProfile(null)} 
                      className="text-xs text-blue-600 font-extrabold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      ← Back to Pool
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                  {/* Badge card */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-center">
                    <div className="relative">
                      {viewingProfile.photo ? (
                        <img src={viewingProfile.photo} alt={viewingProfile.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-2xl border-4 border-white shadow-md">
                          {viewingProfile.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                      <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white ${
                        viewingProfile.status === 'Compliant' ? 'bg-emerald-500' : viewingProfile.status === 'Warning' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                    </div>
                    
                    <div className="text-center sm:text-left space-y-1">
                      <h4 className="text-lg font-black text-slate-800 leading-tight">{viewingProfile.name}</h4>
                      <p className="text-sm font-semibold text-blue-600">{viewingProfile.rank}</p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1.5">
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">
                          {viewingProfile.status || 'Active'}
                        </span>
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                          {viewingProfile.hiringStatus || 'Available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tab Selector */}
                  <div className="flex border-b border-slate-200">
                    <button
                      onClick={() => setProfileTab('info')}
                      className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
                        profileTab === 'info'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Credentials & Notes
                    </button>
                    <button
                      onClick={() => setProfileTab('history')}
                      className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
                        profileTab === 'history'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Onboard History
                    </button>
                  </div>

                  {/* Tab Content: Credentials & Notes */}
                  {profileTab === 'info' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Contact Number</span>
                        <span className="text-sm font-bold text-slate-700">{viewingProfile.contactNumber || 'N/A'}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Passport Number</span>
                        <span className="text-sm font-mono font-bold text-slate-700">{viewingProfile.passportNo || 'N/A'}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Seaman Book No</span>
                        <span className="text-sm font-mono font-bold text-slate-700">{viewingProfile.seamanBookNo || 'N/A'}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Age</span>
                        <span className="text-sm font-bold text-slate-700">{viewingProfile.birthdate ? `${calculateAge(viewingProfile.birthdate)} yrs` : 'N/A'}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Contract Duration</span>
                        <span className="text-sm font-bold text-slate-700">{viewingProfile.contractDuration ? `${viewingProfile.contractDuration} Months` : 'N/A'}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Contract Extensions</span>
                        <span className="text-sm font-bold text-blue-600 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-blue-100 rounded text-xs font-black">{viewingProfile.extensionsCount || 0}</span> extensions
                        </span>
                      </div>
                      
                      <div className="col-span-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">SI Remarks / Notes</span>
                        <p className="text-xs text-slate-600 leading-relaxed font-semibold bg-white p-2.5 rounded-lg border border-slate-100">
                          {viewingProfile.siComments || 'No Superintendent remarks or instructions recorded for this crew member.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tab Content: Onboard History */}
                  {profileTab === 'history' && (
                    <div className="space-y-4">
                      {historyLoading ? (
                        <div className="text-center py-8 text-slate-400 text-xs font-bold animate-pulse">
                          Loading onboard history...
                        </div>
                      ) : crewHistory.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No historical disembarkations or previous assignments on record for this crew member.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {crewHistory.map((h, idx) => (
                            <div key={h.id || idx} className="bg-white border border-slate-100 p-3.5 rounded-xl shadow-xs hover:border-slate-200 transition-all flex flex-col gap-2 relative">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
                                  <Ship className="w-3.5 h-3.5 text-slate-400" /> {h.vesselName}
                                </span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                  {h.rank}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-medium">
                                <div>
                                  <span className="text-slate-400 font-bold block text-[9px] uppercase">Sign On</span>
                                  {h.signOnDate || 'N/A'}
                                </div>
                                <div>
                                  <span className="text-slate-400 font-bold block text-[9px] uppercase">Disembark</span>
                                  {h.disembarkDate || 'N/A'}
                                </div>
                                <div>
                                  <span className="text-slate-400 font-bold block text-[9px] uppercase">Age At Contract</span>
                                  <span className="font-bold text-slate-700">{h.ageAtContract ? `${h.ageAtContract} yrs` : 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-bold block text-[9px] uppercase">Contact At Contract</span>
                                  <span className="font-bold text-slate-700">{h.contactAtContract || 'N/A'}</span>
                                </div>
                              </div>
                              <div className="bg-slate-50/50 px-2.5 py-1.5 rounded-lg border border-slate-100/50 text-[11px] text-slate-600">
                                <span className="font-bold text-slate-400 block text-[9px] uppercase mb-0.5">Remarks / Reason</span>
                                {h.remarks}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Action in profile view */}
                <div className="border-t border-slate-100 pt-4 mt-2 flex justify-end gap-2">
                  <button 
                    onClick={() => {
                      if (signOnMode === 'select') {
                        setViewingProfile(null);
                      } else {
                        handleCloseModal();
                      }
                    }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Close Profile
                  </button>
                  {viewingProfile.vesselId && viewingProfile.vesselId !== 'all' && viewingProfile.vesselId !== 'any' && !isVesselUser && isAdminOrPic && (
                    <button
                      onClick={() => {
                        setDisembarkingCrew(viewingProfile);
                        setDisembarkStep('confirm');
                        setDisembarkReason('');
                        setShowDisembarkDialog(true);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Anchor className="w-3.5 h-3.5" /> Disembark Crew
                    </button>
                  )}
                  {!isVesselUser && isAdminOrPic && (
                    <button
                      onClick={() => {
                        const memberToEdit = viewingProfile;
                        setViewingProfile(null);
                        setSignOnMode('idle');
                        handleEditClick(memberToEdit);
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                    </button>
                  )}
                  {signOnMode === 'select' && (
                    <button 
                      onClick={() => openAssignPrompt(viewingProfile)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Assign Crew
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Yes/No/Cancel Disembark Confirmation Dialog */}
      {showDisembarkDialog && disembarkingCrew && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[1050]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50 text-rose-900">
              <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
                <Anchor className="w-4 h-4 text-rose-600 animate-pulse" /> Confirm Disembarkation
              </h3>
              <button 
                onClick={() => setShowDisembarkDialog(false)}
                className="p-1 hover:bg-rose-100 rounded-lg text-rose-700 transition-colors cursor-pointer"
              >
                <span className="text-sm font-bold">✕</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {disembarkStep === 'confirm' ? (
                <>
                  <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                    Has <span className="text-slate-900 font-black">{disembarkingCrew.name}</span> finished their contract?
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={() => {
                        executeDisembark(disembarkingCrew, true, 'Finished Contract');
                        setShowDisembarkDialog(false);
                      }}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Yes, Finished
                    </button>
                    <button
                      onClick={() => {
                        setDisembarkStep('reason');
                      }}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-100 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      No, Custom Reason
                    </button>
                    <button
                      onClick={() => setShowDisembarkDialog(false)}
                      className="py-2.5 px-4 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">Disembarkation Reason / Contract Remarks</label>
                    <textarea
                      value={disembarkReason}
                      onChange={(e) => setDisembarkReason(e.target.value)}
                      placeholder="e.g. Compassionate leave, medical sign-off, or other instructions..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
                      rows={3}
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setDisembarkStep('confirm')}
                      className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        const finalReason = disembarkReason.trim() || 'Unfinished Contract - Disembarked';
                        executeDisembark(disembarkingCrew, false, finalReason);
                        setShowDisembarkDialog(false);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-100 cursor-pointer"
                    >
                      Submit & Disembark
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Crew Details Confirmation Dialog */}
      {showAssignDialog && assigningCrew && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[1050]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50 text-blue-900">
              <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600 animate-pulse" /> Sign On Contract Details
              </h3>
              <button 
                onClick={() => setShowAssignDialog(false)}
                className="p-1 hover:bg-blue-100 rounded-lg text-blue-700 transition-colors cursor-pointer"
              >
                <span className="text-sm font-bold">✕</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                  {assigningCrew.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 leading-tight">{assigningCrew.name}</h4>
                  <p className="text-xs font-semibold text-blue-600">{assigningCrew.rank}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Vessel Assignment */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Assigned Vessel</label>
                  {isVesselUser ? (
                    <div className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-xl font-bold flex items-center gap-1.5">
                      <Ship className="w-4 h-4 text-slate-400" />
                      {vessels.find(v => String(v.id) === String(userVesselId))?.name || 'Your Vessel'}
                    </div>
                  ) : (
                    <select
                      value={assignVesselId}
                      onChange={(e) => setAssignVesselId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
                    >
                      <option value="">Select Target Vessel...</option>
                      {vessels.map(v => (
                        <option key={v.id} value={String(v.id)}>{v.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Sign On Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Sign On Contract Date</label>
                  <input
                    type="date"
                    value={assignSignOnDate}
                    onChange={(e) => setAssignSignOnDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
                    required
                  />
                </div>

                {/* Contract Duration */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Contract Duration (Months)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={assignContractDuration}
                    onChange={(e) => setAssignContractDuration(e.target.value)}
                    placeholder="e.g. 6"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAssignDialog(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!assignSignOnDate || !assignContractDuration || (!isVesselUser && !assignVesselId)}
                  onClick={async () => {
                    const finalVesselId = isVesselUser ? userVesselId : assignVesselId;
                    if (!finalVesselId) {
                      alert('Please select a vessel first');
                      return;
                    }
                    const contractEndDateStr = calculateEndDate(assignSignOnDate, assignContractDuration);
                    const updatedMember = {
                      ...assigningCrew,
                      vesselId: finalVesselId,
                      signOnDate: assignSignOnDate,
                      contractDuration: Number(assignContractDuration) || 0,
                      contractEndDate: contractEndDateStr,
                      extensionsCount: 0
                    };

                    if (token) {
                      try {
                        const resp = await fetch(`/api/crew-members/${assigningCrew.id}`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify(updatedMember)
                        });
                        if (resp.ok) {
                          fetchCrew();
                          setShowAssignDialog(false);
                          setViewingProfile(null);
                          handleCloseModal();
                        } else {
                          alert('Failed to assign crew member');
                        }
                      } catch (err) {
                        console.error('Error assigning crew member:', err);
                      }
                    } else {
                      saveCrewFallback(crew.map(member => member.id === assigningCrew.id ? updatedMember : member));
                      setShowAssignDialog(false);
                      setViewingProfile(null);
                      handleCloseModal();
                    }
                  }}
                  className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Submit & Sign On
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// 2. Crew Employment Status View Component
export const CrewEmploymentStatusView = ({ vessels, token, currentUser }: { vessels: any[], token?: string, currentUser?: User }) => {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);

  // Assign Crew Dialogue Box States
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningCrew, setAssigningCrew] = useState<CrewMember | null>(null);
  const [assignSignOnDate, setAssignSignOnDate] = useState('');
  const [assignContractDuration, setAssignContractDuration] = useState('6');
  const [assignVesselId, setAssignVesselId] = useState('');

  const calculateEndDate = (startDate: string, durationMonths: string) => {
    if (!startDate || !durationMonths) return '';
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + parseInt(durationMonths));
    return date.toISOString().split('T')[0];
  };

  const openAssignPrompt = (member: CrewMember) => {
    setAssigningCrew(member);
    setAssignSignOnDate(new Date().toISOString().split('T')[0]); // Default to today
    setAssignContractDuration('6'); // Default to 6 months
    setAssignVesselId(isVesselUser ? userVesselId : '');
    setShowAssignDialog(true);
  };

  // Crew History States for Pool List view
  const [profileTab, setProfileTab] = useState<'info' | 'history'>('info');
  const [crewHistory, setCrewHistory] = useState<CrewHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCrewHistory = async (crewId: string) => {
    if (!token) {
      const saved = localStorage.getItem('comos_crew_history');
      const allHistory: CrewHistoryEntry[] = saved ? JSON.parse(saved) : [];
      setCrewHistory(allHistory.filter(h => h.crewId === crewId).reverse());
      return;
    }
    setHistoryLoading(true);
    try {
      const resp = await fetch(`/api/crew-members/${crewId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setCrewHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch crew history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCrew) {
      fetchCrewHistory(selectedCrew.id);
      setProfileTab('info');
    } else {
      setCrewHistory([]);
    }
  }, [selectedCrew, token]);

  // Find activeUser with fallback to localStorage
  const activeUser = (() => {
    if (currentUser) return currentUser;
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();
  const isVesselUser = activeUser?.role === 'vessel' && activeUser?.vessel_id;
  const userVesselId = isVesselUser ? String(activeUser.vessel_id) : '';
  const isAdminOrPic = activeUser?.role === 'admin' || activeUser?.role === 'team_pic' || activeUser?.role === 'user';

  // States for updating Superintendent (SI) comments & Hiring status
  const [isEditing, setIsEditing] = useState(false);
  const [editComments, setEditComments] = useState('');
  const [editHiringStatus, setEditHiringStatus] = useState<'for rehire' | 'not for rehire' | 'for debriefing'>('for rehire');

  // Profile editing state
  const [editingProfileCrew, setEditingProfileCrew] = useState<CrewMember | null>(null);
  const [profileFormData, setProfileFormData] = useState({
    name: '',
    rank: '',
    nationality: 'Filipino',
    birthdate: '',
    contactNumber: '',
    passportNo: '',
    seamanBookNo: '',
    photo: '',
    vesselId: '',
    signOnDate: '',
    contractDuration: 0,
    contractEndDate: '',
    hiringStatus: 'for rehire' as 'for rehire' | 'not for rehire' | 'for debriefing',
    siComments: '',
    extensionsCount: 0
  });

  const handleEditProfileClick = (member: CrewMember) => {
    setEditingProfileCrew(member);
    setProfileFormData({
      name: member.name || '',
      rank: member.rank || '',
      nationality: member.nationality || 'Filipino',
      birthdate: member.birthdate || '',
      contactNumber: member.contactNumber || '',
      passportNo: member.passportNo || '',
      seamanBookNo: member.seamanBookNo || '',
      photo: member.photo || '',
      vesselId: member.vesselId || '',
      signOnDate: member.signOnDate || '',
      contractDuration: member.contractDuration || 0,
      contractEndDate: member.contractEndDate || '',
      hiringStatus: member.hiringStatus || 'for rehire',
      siComments: member.siComments || '',
      extensionsCount: member.extensionsCount || 0
    });
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfileCrew) return;

    let finalEndDate = profileFormData.contractEndDate;
    if (profileFormData.signOnDate && profileFormData.contractDuration) {
      const date = new Date(profileFormData.signOnDate);
      date.setMonth(date.getMonth() + Number(profileFormData.contractDuration));
      finalEndDate = date.toISOString().split('T')[0];
    }

    const updatedCrew: CrewMember = {
      ...editingProfileCrew,
      name: profileFormData.name,
      rank: profileFormData.rank,
      nationality: profileFormData.nationality || 'Filipino',
      birthdate: profileFormData.birthdate,
      contactNumber: profileFormData.contactNumber,
      passportNo: profileFormData.passportNo,
      seamanBookNo: profileFormData.seamanBookNo,
      photo: profileFormData.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80',
      vesselId: profileFormData.vesselId,
      signOnDate: profileFormData.signOnDate,
      contractDuration: Number(profileFormData.contractDuration) || 0,
      contractEndDate: finalEndDate,
      hiringStatus: profileFormData.hiringStatus,
      siComments: profileFormData.siComments,
      extensionsCount: Number(profileFormData.extensionsCount) || 0
    };

    if (token) {
      try {
        const resp = await fetch(`/api/crew-members/${editingProfileCrew.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedCrew)
        });
        if (resp.ok) {
          fetchCrew();
          setEditingProfileCrew(null);
          if (selectedCrew && selectedCrew.id === editingProfileCrew.id) {
            setSelectedCrew(updatedCrew);
          }
        } else {
          const err = await resp.json();
          alert(`Failed to update profile: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to update crew profile:', err);
      }
    } else {
      const updatedList = crew.map(c => c.id === editingProfileCrew.id ? updatedCrew : c);
      setCrew(updatedList);
      localStorage.setItem('comos_crew_list', JSON.stringify(updatedList));
      setEditingProfileCrew(null);
      if (selectedCrew && selectedCrew.id === editingProfileCrew.id) {
        setSelectedCrew(updatedCrew);
      }
    }
  };

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [filterHiringStatus, setFilterHiringStatus] = useState('All');
  const [filterVessel, setFilterVessel] = useState(() => {
    return isVesselUser ? userVesselId : 'All';
  });

  useEffect(() => {
    if (isVesselUser && userVesselId) {
      setFilterVessel(userVesselId);
    }
  }, [isVesselUser, userVesselId]);

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
      console.error('Failed to fetch crew for employment status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrew();
  }, [token]);

  const handleUpdateEmployment = async (crewId: string) => {
    const updated = crew.map(c => {
      if (c.id === crewId) {
        return {
          ...c,
          siComments: editComments,
          hiringStatus: editHiringStatus
        };
      }
      return c;
    });

    setCrew(updated);
    if (!token) {
      localStorage.setItem('comos_crew_list', JSON.stringify(updated));
    } else {
      try {
        const item = updated.find(c => c.id === crewId);
        if (item) {
          await fetch(`/api/crew-members/${crewId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item)
          });
        }
      } catch (err) {
        console.error('Failed to update crew employment:', err);
      }
    }
    
    // update current detail modal reference
    if (selectedCrew && selectedCrew.id === crewId) {
      setSelectedCrew(prev => prev ? {
        ...prev,
        siComments: editComments,
        hiringStatus: editHiringStatus
      } : null);
    }
    setIsEditing(false);
  };

  const getVesselName = (id?: string) => {
    if (!id || id === 'all' || id === 'any') return 'Global Pool / Unassigned';
    const v = vessels.find(v => String(v.id) === String(id));
    return v ? v.name : 'Unknown Vessel';
  };

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

  const filteredCrew = crew.filter(member => {
    // 1. Search matching name or rank
    const matchesSearch = 
      (member.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (member.rank || '').toLowerCase().includes(search.toLowerCase());
    
    // 2. Hiring status filter
    const matchesHiringStatus = 
      filterHiringStatus === 'All' || 
      (member.hiringStatus || 'for rehire') === filterHiringStatus;
    
    // 3. Vessel filter
    const effectiveVesselId = isVesselUser ? userVesselId : filterVessel;
    const matchesVessel = 
      effectiveVesselId === 'All' || 
      (effectiveVesselId === 'all' && (!member.vesselId || member.vesselId === 'all')) ||
      String(member.vesselId) === String(effectiveVesselId);
      
    return matchesSearch && matchesHiringStatus && matchesVessel;
  });

  const vesselCrewOnly = isVesselUser 
    ? crew.filter(c => String(c.vesselId) === String(userVesselId))
    : crew;

  return (
    <div className="space-y-6">
      {/* Visual Header Banner - Sleek Dark Navy theme */}
      <div className="bg-gradient-to-r from-[#0f172a] to-[#1e1b4b] text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-lg border border-indigo-950/30 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-2 flex-1">
          <div className="bg-indigo-500/20 text-indigo-100 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-semibold w-max uppercase tracking-wider font-mono">
            Appraisals & Superintendent Audits
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-indigo-400" /> Crew Pool List
          </h1>
          <p className="text-indigo-200/70 text-sm max-w-xl leading-relaxed font-medium">
            Monitor crew background assessments, superintendent evaluations, active contract extensions, and next rehire availability registers.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50/50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100/30">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase font-mono">Assessed Fleet Crew</p>
            <h3 className="text-xl font-bold text-slate-850 mt-0.5">{vesselCrewOnly.length} Evaluated</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50/50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase font-mono">Approved for Rehire</p>
            <h3 className="text-xl font-bold text-emerald-700 mt-0.5">{vesselCrewOnly.filter(c => (c.hiringStatus || 'for rehire') === 'for rehire').length} Active</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50/50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase font-mono font-semibold">Pending Debriefing</p>
            <h3 className="text-xl font-bold text-amber-700 mt-0.5">{vesselCrewOnly.filter(c => c.hiringStatus === 'for debriefing').length} Crew</h3>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search appraised crew by name, duty rank..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 bg-slate-50/50"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={filterHiringStatus}
              onChange={(e) => setFilterHiringStatus(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="for rehire">For Rehire</option>
              <option value="for debriefing">For Debriefing</option>
              <option value="not for rehire">Not For Rehire</option>
            </select>
          </div>

          {!isVesselUser && (
            <div className="flex items-center gap-1">
              <Ship className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={filterVessel}
                onChange={(e) => setFilterVessel(e.target.value)}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 bg-white"
              >
                <option value="All">All Vessels</option>
                <option value="all">Global Pool</option>
                {vessels.map(v => (
                  <option key={v.id} value={String(v.id)}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Appraisal Records...</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50/75 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 px-6">Crew Member</th>
                  <th className="p-4 px-6">Assigned Vessel</th>
                  <th className="p-4 px-6">Age / Contact</th>
                  <th className="p-4 px-6">Employment Status</th>
                  <th className="p-4 px-6">SI Remarks</th>
                  <th className="p-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCrew.map(member => (
                  <tr 
                    key={member.id}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedCrew(member);
                      setEditComments(member.siComments || '');
                      setEditHiringStatus(member.hiringStatus || 'for rehire');
                      setIsEditing(false);
                    }}
                  >
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-3">
                        <img 
                          src={member.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80'} 
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-100 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {member.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 font-semibold">
                            <span>{member.rank}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 px-6 text-sm">
                      <span className="font-semibold text-slate-700">{getVesselName(member.vesselId)}</span>
                    </td>
                    <td className="p-4 px-6 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-700">
                          {member.birthdate ? `${calculateAge(member.birthdate)} yrs` : 'N/A'}
                        </p>
                        <p className="text-slate-400 font-mono text-[11px]">
                          {member.contactNumber || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 px-6">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        member.hiringStatus === 'for rehire' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        member.hiringStatus === 'for debriefing' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {member.hiringStatus || 'for rehire'}
                      </span>
                    </td>
                    <td className="p-4 px-6 text-xs max-w-xs">
                      <p className="text-slate-500 truncate italic" title={member.siComments}>
                        {member.siComments ? `"${member.siComments}"` : 'No comments registered'}
                      </p>
                    </td>
                    <td className="p-4 px-6 text-right">
                      <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCrew(member);
                            setEditComments(member.siComments || '');
                            setEditHiringStatus(member.hiringStatus || 'for rehire');
                            setIsEditing(false);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                          title="View File"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        {!isVesselUser && isAdminOrPic && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProfileClick(member);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCrew.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-slate-400 font-semibold italic">
                      No appraisal records found matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Slideover Modal */}
      {selectedCrew && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999]">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-100 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Crew Member File</h2>
              <button 
                onClick={() => setSelectedCrew(null)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable File Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Profile Block */}
              <div className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <img 
                  src={selectedCrew.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80'} 
                  alt={selectedCrew.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md mb-3"
                  referrerPolicy="no-referrer"
                />
                <h3 className="text-lg font-bold text-slate-900">{selectedCrew.name}</h3>
                <p className="text-sm font-semibold text-blue-600 mt-0.5">{selectedCrew.rank}</p>
                <p className="text-xs text-slate-400 mt-1">ID: {selectedCrew.id}</p>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setProfileTab('info')}
                  className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    profileTab === 'info'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Crew File Details
                </button>
                <button
                  onClick={() => setProfileTab('history')}
                  className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    profileTab === 'history'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Onboard History
                </button>
              </div>

              {profileTab === 'info' && (
                <>
                  {/* Record Summary */}
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Service Alignment</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Most Recent Vessel</span>
                        <span className="text-slate-800">{getVesselName(selectedCrew.vesselId)}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Age</span>
                        <span className="text-slate-800">
                          {selectedCrew.birthdate ? `${calculateAge(selectedCrew.birthdate)} yrs` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Contact Number</span>
                        <span className="text-slate-800 font-mono">{selectedCrew.contactNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Hiring Status</span>
                        <div>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            selectedCrew.hiringStatus === 'for rehire' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            selectedCrew.hiringStatus === 'for debriefing' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {selectedCrew.hiringStatus || 'for rehire'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contract Terms & Extensions */}
                  <div className="space-y-4 pt-2">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contract & Extensions</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Sign On Date</span>
                        <span className="text-slate-700">{selectedCrew.signOnDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Contract End Date</span>
                        <span className="text-blue-600 font-bold">{selectedCrew.contractEndDate || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Contract Duration</span>
                        <span className="text-slate-700">{selectedCrew.contractDuration ? `${selectedCrew.contractDuration} Months` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1">Extensions Conducted</span>
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-black">
                            {selectedCrew.extensionsCount || 0}
                          </span>
                          Extensions Conducted
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SI Comments */}
                  <div className="space-y-3 pt-2">
                    <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Superintendent Remarks</h4>
                      {!isEditing && (
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Update Remarks
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-150">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Employment Status</label>
                          <select 
                            value={editHiringStatus}
                            onChange={(e) => setEditHiringStatus(e.target.value as any)}
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs"
                          >
                            <option value="for rehire">for rehire</option>
                            <option value="not for rehire">not for rehire</option>
                            <option value="for debriefing">for debriefing</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Comments from SI</label>
                          <textarea
                            rows={3}
                            value={editComments}
                            onChange={(e) => setEditComments(e.target.value)}
                            placeholder="Type professional comments..."
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2 text-xs">
                          <button 
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-semibold"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleUpdateEmployment(selectedCrew.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold"
                          >
                            Save File
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100 text-xs text-slate-700 leading-relaxed italic">
                        {selectedCrew.siComments ? `"${selectedCrew.siComments}"` : "No Comments registered from SI. Please update remarks to register appraisal reports."}
                      </div>
                    )}
                  </div>
                </>
              )}

              {profileTab === 'history' && (
                <div className="space-y-4">
                  {historyLoading ? (
                    <div className="text-center py-8 text-slate-400 text-xs font-bold animate-pulse">
                      Loading onboard history...
                    </div>
                  ) : crewHistory.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No historical disembarkations or previous assignments on record for this crew member.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                      {crewHistory.map((h, idx) => (
                        <div key={h.id || idx} className="bg-white border border-slate-100 p-3.5 rounded-xl shadow-xs hover:border-slate-200 transition-all flex flex-col gap-2 relative">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
                              <Ship className="w-3.5 h-3.5 text-slate-400" /> {h.vesselName}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                              {h.rank}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-medium">
                            <div>
                              <span className="text-slate-400 font-bold block text-[9px] uppercase">Sign On</span>
                              {h.signOnDate || 'N/A'}
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block text-[9px] uppercase">Disembark</span>
                              {h.disembarkDate || 'N/A'}
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block text-[9px] uppercase">Age</span>
                              <span className="font-bold text-slate-700">{h.ageAtContract ? `${h.ageAtContract} yrs` : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block text-[9px] uppercase">Contact</span>
                              <span className="font-bold text-slate-700">{h.contactAtContract || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="bg-slate-50/50 px-2.5 py-1.5 rounded-lg border border-slate-100/50 text-[11px] text-slate-600">
                            <span className="font-bold text-slate-400 block text-[9px] uppercase mb-0.5">Disembark Reason</span>
                            {h.remarks || 'No disembarkation comments registered.'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-2">
              {!isVesselUser && isAdminOrPic && (
                <>
                  <button 
                    onClick={() => openAssignPrompt(selectedCrew)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100 flex items-center gap-1.5 cursor-pointer animate-in fade-in"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Sign On Crew
                  </button>
                  <button 
                    onClick={() => {
                      const memberToEdit = selectedCrew;
                      setSelectedCrew(null);
                      handleEditProfileClick(memberToEdit);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-100 flex items-center gap-1.5 cursor-pointer animate-in fade-in"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                </>
              )}
              <button 
                onClick={() => setSelectedCrew(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition-colors shadow-md shadow-slate-200 cursor-pointer"
              >
                Close File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfileCrew && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-amber-400" /> Edit Crew Profile
                </h3>
                <p className="text-slate-300 text-xs mt-0.5 font-medium">
                  Update personal credentials, documents, and contract parameters for <span className="font-bold text-white">{editingProfileCrew.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setEditingProfileCrew(null)}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleProfileSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Photo & Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200/60 relative group">
                  <img 
                    src={profileFormData.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80'} 
                    alt="Preview"
                    className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md mb-3"
                    referrerPolicy="no-referrer"
                  />
                  <div className="w-full space-y-2">
                    <div className="flex flex-col items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => document.getElementById('profilePhotoUploadInput')?.click()}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload Photo
                      </button>
                      <input 
                        type="file" 
                        id="profilePhotoUploadInput"
                        accept="image/*"
                        onChange={handleProfilePhotoChange}
                        className="hidden" 
                      />
                      {profileFormData.photo && (
                        <button 
                          type="button"
                          onClick={() => setProfileFormData({...profileFormData, photo: ''})}
                          className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5 text-center">or paste Photo URL</label>
                      <input 
                        type="text" 
                        value={profileFormData.photo.startsWith('data:') ? 'Uploaded Image (Base64 data)' : profileFormData.photo}
                        onChange={(e) => {
                          if (!e.target.value.startsWith('Uploaded Image')) {
                            setProfileFormData({...profileFormData, photo: e.target.value});
                          }
                        }}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:border-indigo-500 text-slate-700 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={profileFormData.name}
                      onChange={(e) => setProfileFormData({...profileFormData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Rank</label>
                    <select
                      required
                      value={profileFormData.rank}
                      onChange={(e) => setProfileFormData({...profileFormData, rank: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white text-slate-700 font-semibold"
                    >
                      <option value="">Select Rank...</option>
                      {['Master', 'Chief Officer', '2nd Officer', '3rd Officer', 'Chief Engineer', '2nd Engineer', '3rd Engineer', '4th Engineer', 'Electrical Engineer', 'Bosun', 'AB', 'OS', 'Fitter', 'Oiler', 'Wiper', 'Cook', 'Messman'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal Credentials */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b pb-1.5 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" /> Personal Credentials &amp; Travel Docs
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Birthdate</label>
                    <input 
                      type="date" 
                      value={profileFormData.birthdate ? profileFormData.birthdate.substring(0, 10) : ''}
                      onChange={(e) => setProfileFormData({...profileFormData, birthdate: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Passport Number</label>
                    <input 
                      type="text" 
                      value={profileFormData.passportNo}
                      onChange={(e) => setProfileFormData({...profileFormData, passportNo: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Seaman's Book No</label>
                    <input 
                      type="text" 
                      value={profileFormData.seamanBookNo}
                      onChange={(e) => setProfileFormData({...profileFormData, seamanBookNo: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Contact Number</label>
                    <input 
                      type="text" 
                      value={profileFormData.contactNumber}
                      onChange={(e) => setProfileFormData({...profileFormData, contactNumber: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Employment Status</label>
                    <select 
                      value={profileFormData.hiringStatus}
                      onChange={(e) => setProfileFormData({...profileFormData, hiringStatus: e.target.value as any})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="for rehire">for rehire</option>
                      <option value="not for rehire">not for rehire</option>
                      <option value="for debriefing">for debriefing</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Assignment & Contract */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest border-b pb-1.5 flex items-center gap-1.5">
                  <Ship className="w-3.5 h-3.5" /> Fleet Assignment &amp; Contract Terms
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Assigned Vessel</label>
                    <select 
                      value={profileFormData.vesselId}
                      onChange={(e) => setProfileFormData({...profileFormData, vesselId: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white text-slate-700 font-semibold"
                    >
                      <option value="">Global Pool / Unassigned</option>
                      {vessels.map(v => (
                        <option key={v.id} value={String(v.id)}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Sign On Date</label>
                    <input 
                      type="date" 
                      value={profileFormData.signOnDate ? profileFormData.signOnDate.substring(0, 10) : ''}
                      onChange={(e) => setProfileFormData({...profileFormData, signOnDate: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Contract Duration (Months)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={profileFormData.contractDuration}
                      onChange={(e) => setProfileFormData({...profileFormData, contractDuration: Number(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white text-blue-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Contract End Date</label>
                    <input 
                      type="date" 
                      value={profileFormData.contractEndDate ? profileFormData.contractEndDate.substring(0, 10) : ''}
                      onChange={(e) => setProfileFormData({...profileFormData, contractEndDate: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white font-semibold text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Contract Extensions</label>
                    <input 
                      type="number" 
                      min="0"
                      value={profileFormData.extensionsCount}
                      onChange={(e) => setProfileFormData({...profileFormData, extensionsCount: Number(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white font-semibold text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* SI Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Superintendent Remarks / SI Notes</label>
                <textarea
                  rows={3}
                  value={profileFormData.siComments}
                  onChange={(e) => setProfileFormData({...profileFormData, siComments: e.target.value})}
                  placeholder="Record Superintendent's remarks, appraisal summary, and professional comments..."
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              {/* Footer buttons */}
              <div className="border-t border-slate-100 pt-5 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setEditingProfileCrew(null)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Crew Details Confirmation Dialog */}
      {showAssignDialog && assigningCrew && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[1050]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50 text-blue-900">
              <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600 animate-pulse" /> Sign On Contract Details
              </h3>
              <button 
                onClick={() => setShowAssignDialog(false)}
                className="p-1 hover:bg-blue-100 rounded-lg text-blue-700 transition-colors cursor-pointer"
              >
                <span className="text-sm font-bold">✕</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                  {assigningCrew.name ? assigningCrew.name.split(' ').map(n => n[0]).join('') : ''}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 leading-tight">{assigningCrew.name}</h4>
                  <p className="text-xs font-semibold text-blue-600">{assigningCrew.rank}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Vessel Assignment */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Assigned Vessel</label>
                  {isVesselUser ? (
                    <div className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-xl font-bold flex items-center gap-1.5">
                      <Ship className="w-4 h-4 text-slate-400" />
                      {vessels.find(v => String(v.id) === String(userVesselId))?.name || 'Your Vessel'}
                    </div>
                  ) : (
                    <select
                      value={assignVesselId}
                      onChange={(e) => setAssignVesselId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold text-slate-800"
                    >
                      <option value="">Select Target Vessel...</option>
                      {vessels.map(v => (
                        <option key={v.id} value={String(v.id)}>{v.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Sign On Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Sign On Contract Date</label>
                  <input
                    type="date"
                    value={assignSignOnDate}
                    onChange={(e) => setAssignSignOnDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold text-slate-800"
                    required
                  />
                </div>

                {/* Contract Duration */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Contract Duration (Months)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={assignContractDuration}
                    onChange={(e) => setAssignContractDuration(e.target.value)}
                    placeholder="e.g. 6"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignDialog(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!assignSignOnDate || !assignContractDuration || (!isVesselUser && !assignVesselId)}
                  onClick={async () => {
                    const finalVesselId = isVesselUser ? userVesselId : assignVesselId;
                    if (!finalVesselId) {
                      alert('Please select a vessel first');
                      return;
                    }
                    const contractEndDateStr = calculateEndDate(assignSignOnDate, assignContractDuration);
                    const updatedMember = {
                      ...assigningCrew,
                      vesselId: finalVesselId,
                      signOnDate: assignSignOnDate,
                      contractDuration: Number(assignContractDuration) || 0,
                      contractEndDate: contractEndDateStr,
                      extensionsCount: 0
                    };

                    if (token) {
                      try {
                        const resp = await fetch(`/api/crew-members/${assigningCrew.id}`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify(updatedMember)
                        });
                        if (resp.ok) {
                          fetchCrew();
                          setShowAssignDialog(false);
                          setSelectedCrew(null);
                        } else {
                          alert('Failed to assign crew member');
                        }
                      } catch (err) {
                        console.error('Error assigning crew member:', err);
                      }
                    } else {
                      const updatedList = crew.map(member => member.id === assigningCrew.id ? updatedMember : member);
                      setCrew(updatedList);
                      localStorage.setItem('comos_crew_list', JSON.stringify(updatedList));
                      setShowAssignDialog(false);
                      setSelectedCrew(null);
                    }
                  }}
                  className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Submit & Sign On
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// 3. Audit Registry View Component
export const AuditRegistryView = ({ vessels, prefilteredType, token, currentUser }: { vessels: any[], prefilteredType?: string, token?: string, currentUser?: User }) => {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [isEditingAudit, setIsEditingAudit] = useState(false);
  const [editAuditData, setEditAuditData] = useState<AuditRecord | null>(null);

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

  const handleUpdateAudit = async (updatedAudit: AuditRecord) => {
    if (token) {
      try {
        const resp = await fetch(`/api/audit-records/${updatedAudit.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedAudit)
        });
        if (resp.ok) {
          fetchAudits();
          setSelectedDetailAudit(updatedAudit);
          setIsEditingAudit(false);
          setEditAuditData(null);
        } else {
          const err = await resp.json();
          alert(`Failed to update audit: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to update audit:', err);
      }
    } else {
      const updatedList = audits.map(a => a.id === updatedAudit.id ? updatedAudit : a);
      saveAuditsFallback(updatedList);
      setSelectedDetailAudit(updatedAudit);
      setIsEditingAudit(false);
      setEditAuditData(null);
    }
  };

  const [filterVessel, setFilterVessel] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showModal, setShowModal] = useState(false);

  // Reset filters and sync form data type when prefilteredType changes
  useEffect(() => {
    setFilterVessel('All');
    setFilterStatus('All');
  }, [prefilteredType]);

  useEffect(() => {
    if (showModal) {
      setFormData(prev => ({
        ...prev,
        type: prefilteredType || 'Internal Audit'
      }));
    }
  }, [showModal, prefilteredType]);

  const [selectedDetailAudit, setSelectedDetailAudit] = useState<AuditRecord | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);

  const handleUploadReport = async (file: File) => {
    if (!selectedDetailAudit) return;
    setUploadingReport(true);
    if (token) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const resp = await fetch(`/api/audit-records/${selectedDetailAudit.id}/report`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        if (resp.ok) {
          const data = await resp.json();
          const updated = { ...selectedDetailAudit, reportFileName: data.reportFileName };
          setAudits(prev => prev.map(a => a.id === selectedDetailAudit.id ? updated : a));
          setSelectedDetailAudit(updated);
        } else {
          alert('Failed to upload report file');
        }
      } catch (e) {
        console.error(e);
        alert('An error occurred during upload.');
      } finally {
        setUploadingReport(false);
      }
    } else {
      const updated = { ...selectedDetailAudit, reportFileName: file.name };
      setAudits(prev => {
        const next = prev.map(a => a.id === selectedDetailAudit.id ? updated : a);
        localStorage.setItem('comos_audits_list', JSON.stringify(next));
        return next;
      });
      setSelectedDetailAudit(updated);
      setUploadingReport(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!selectedDetailAudit) return;
    if (!window.confirm('Are you sure you want to delete this report file?')) return;
    if (token) {
      try {
        const resp = await fetch(`/api/audit-records/${selectedDetailAudit.id}/report`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (resp.ok) {
          const updated = { ...selectedDetailAudit, reportFileName: undefined };
          setAudits(prev => prev.map(a => a.id === selectedDetailAudit.id ? updated : a));
          setSelectedDetailAudit(updated);
        } else {
          alert('Failed to delete report file');
        }
      } catch (e) {
        console.error(e);
        alert('An error occurred during deletion.');
      }
    } else {
      const updated = { ...selectedDetailAudit, reportFileName: undefined };
      setAudits(prev => {
        const next = prev.map(a => a.id === selectedDetailAudit.id ? updated : a);
        localStorage.setItem('comos_audits_list', JSON.stringify(next));
        return next;
      });
      setSelectedDetailAudit(updated);
    }
  };

  const [selectedAuditComments, setSelectedAuditComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  const fetchComments = async (auditId: string) => {
    if (!token) {
      const saved = localStorage.getItem(`comos_audit_comments_${auditId}`);
      setSelectedAuditComments(saved ? JSON.parse(saved) : []);
      return;
    }
    setCommentsLoading(true);
    try {
      const resp = await fetch(`/api/audit-records/${auditId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setSelectedAuditComments(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDetailAudit) {
      fetchComments(selectedDetailAudit.id);
    }
  }, [selectedDetailAudit?.id, token]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetailAudit || !newCommentText.trim()) return;

    if (token) {
      try {
        const resp = await fetch(`/api/audit-records/${selectedDetailAudit.id}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ commentText: newCommentText })
        });
        if (resp.ok) {
          const added = await resp.json();
          setSelectedAuditComments(prev => [...prev, added]);
          setNewCommentText('');
        } else {
          const err = await resp.json();
          alert(`Failed to add comment: ${err.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to post comment:', err);
      }
    } else {
      const newComment = {
        id: 'c_' + Date.now(),
        auditId: selectedDetailAudit.id,
        author: 'Local Inspector',
        authorEmail: 'inspector@example.com',
        commentText: newCommentText,
        createdAt: new Date().toISOString()
      };
      const updated = [...selectedAuditComments, newComment];
      setSelectedAuditComments(updated);
      localStorage.setItem(`comos_audit_comments_${selectedDetailAudit.id}`, JSON.stringify(updated));
      setNewCommentText('');
    }
  };



  // Form State
  const [formData, setFormData] = useState({
    type: prefilteredType || 'Internal Audit',
    date: '',
    inspectorName: '',
    inspectorOrganization: '',
    scope: '',
    vesselId: 'all',
    status: 'Scheduled',
    findingsCount: 0
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
      status: formData.status as any,
      findingsCount: Number(formData.findingsCount) || 0,
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
      type: prefilteredType || 'Internal Audit',
      date: '',
      inspectorName: '',
      inspectorOrganization: '',
      scope: '',
      vesselId: 'all',
      status: 'Scheduled',
      findingsCount: 0
    });
  };

  const filteredAudits = audits.filter(audit => {
    const matchesType = prefilteredType ? audit.type === prefilteredType : true;
    const matchesVessel = filterVessel === 'All' || audit.vesselId === filterVessel;
    const matchesStatus = filterStatus === 'All' || audit.status === filterStatus;
    return matchesType && matchesVessel && matchesStatus;
  });

  const getVesselName = (id: string) => {
    if (id === 'all' || id === 'any') return 'Universal Fleet';
    const found = vessels.find(v => String(v.id) === id);
    return found ? found.name : 'Unknown Vessel';
  };

  const isAdminOrPic = currentUser?.role === 'admin' || currentUser?.role === 'team_pic' || currentUser?.role === 'user';

  // Get dynamic header configuration based on view/prefilteredType
  const getHeaderInfo = () => {
    switch (prefilteredType) {
      case 'Internal Audit':
        return {
          title: 'Internal Audits',
          description: 'Track and manage internal safety management and environmental compliance audits.',
          icon: <FileText className="w-6 h-6 text-blue-600" />
        };
      case 'External Audit':
        return {
          title: 'External Audits',
          description: 'Record and review official third-party and classification society statutory audits.',
          icon: <ShieldCheck className="w-6 h-6 text-blue-600" />
        };
      case 'VIR':
        return {
          title: 'Vessel Inspection Reports (VIR)',
          description: 'Manage physical vessel condition surveys and routine compliance inspections.',
          icon: <ClipboardList className="w-6 h-6 text-blue-600" />
        };
      case 'Navigational Audit':
        return {
          title: 'Navigational Audits',
          description: 'Monitor navigational bridge procedures, watchkeeping standards, and bridge checklists.',
          icon: <Compass className="w-6 h-6 text-blue-600" />
        };
      default:
        return {
          title: 'Audit Registry',
          description: 'Comprehensive registry of all fleet surveys, audits, and statutory inspections.',
          icon: <ShieldCheck className="w-6 h-6 text-blue-600" />
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            {header.icon} {header.title}
          </h1>
          <p className="text-sm text-slate-500">{header.description}</p>
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
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{filteredAudits.length} Surveys</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Completed</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
            {filteredAudits.filter(a => a.status === 'Completed').length} Audits
          </h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Scheduled Surveys</p>
          <h3 className="text-2xl font-extrabold text-blue-600 mt-1">
            {filteredAudits.filter(a => a.status === 'Scheduled' || a.status === 'In Progress').length} Pending
          </h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Overdue Tasks</p>
          <h3 className="text-2xl font-extrabold text-red-600 mt-1">
            {filteredAudits.filter(a => a.status === 'Overdue').length} Overdue
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
            value={filterVessel}
            onChange={(e) => setFilterVessel(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none text-slate-700 font-medium"
          >
            <option value="All">All Vessels</option>
            {vessels.map(v => (
              <option key={v.id} value={String(v.id)}>{v.name}</option>
            ))}
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none text-slate-700 font-medium"
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Audits & Inspections from Database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic font-medium">
                    No matching audit records or inspections registered yet.
                  </td>
                </tr>
              ) : (
                filteredAudits.map(audit => (
                  <tr 
                    key={audit.id} 
                    onClick={() => setSelectedDetailAudit(audit)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    title="Click to view details and comments"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{audit.type}</div>
                        {['Internal Audit', 'External Audit', 'VIR', 'Navigational Audit'].includes(audit.type) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold">
                            <MessageSquare className="w-3 h-3" /> View & Comment
                          </span>
                        )}
                        {audit.reportFileName && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold" title={`Report file attached: ${audit.reportFileName}`}>
                            <Paperclip className="w-3 h-3" /> Report Attached
                          </span>
                        )}
                      </div>
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
                ))
              )}
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
                    disabled={!!prefilteredType}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800 ${
                      prefilteredType ? "bg-slate-50 border-slate-150 text-slate-400 cursor-not-allowed font-semibold" : ""
                    }`}
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
                <div className="col-span-2 font-medium">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Organization / Society</label>
                  <input 
                    type="text"
                    value={formData.inspectorOrganization}
                    onChange={(e) => setFormData({...formData, inspectorOrganization: e.target.value})}
                    placeholder="e.g. DNV Classification Society / Paris MOU PSC"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Audit Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Deficiencies / Findings Found</label>
                  <input 
                    type="number"
                    min="0"
                    value={formData.findingsCount}
                    onChange={(e) => setFormData({...formData, findingsCount: Math.max(0, parseInt(e.target.value) || 0)})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-800"
                    placeholder="0"
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
      )}      {/* Audit Detail & Comments Modal */}
      {selectedDetailAudit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Audit Details & Comments</h2>
                  <p className="text-[11px] text-slate-500 font-medium font-mono">Record ID: {selectedDetailAudit.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdminOrPic && !isEditingAudit && (
                  <button
                    onClick={() => {
                      setIsEditingAudit(true);
                      setEditAuditData({ ...selectedDetailAudit });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition-all shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Entry
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSelectedDetailAudit(null);
                    setSelectedAuditComments([]);
                    setNewCommentText('');
                    setIsEditingAudit(false);
                    setEditAuditData(null);
                  }}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split Content layout */}
            <div className="grid grid-cols-1 md:grid-cols-5 flex-1 overflow-hidden min-h-0">
              {/* Left Column: Audit Info Details (Editable or Static) */}
              {isEditingAudit && editAuditData ? (
                <div className="md:col-span-2 p-6 bg-slate-50 border-r border-slate-150 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 mb-3">
                    <h3 className="text-sm font-bold text-slate-900">Edit Audit Information</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 font-mono">Editing Mode</span>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Audit Type</label>
                    <select
                      value={editAuditData.type}
                      onChange={(e) => setEditAuditData({ ...editAuditData, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800"
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
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Conducted Date</label>
                    <input
                      type="date"
                      value={editAuditData.date}
                      onChange={(e) => setEditAuditData({ ...editAuditData, date: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Vessel Coverage</label>
                    <select
                      value={editAuditData.vesselId}
                      onChange={(e) => setEditAuditData({ ...editAuditData, vesselId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800"
                    >
                      <option value="all">Universal Fleet (All Vessels)</option>
                      {vessels.map(v => (
                        <option key={v.id} value={String(v.id)}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Lead Inspector</label>
                    <input
                      type="text"
                      value={editAuditData.inspectorName}
                      onChange={(e) => setEditAuditData({ ...editAuditData, inspectorName: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Organization / Society</label>
                    <input
                      type="text"
                      value={editAuditData.inspectorOrganization}
                      onChange={(e) => setEditAuditData({ ...editAuditData, inspectorOrganization: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Status</label>
                      <select
                        value={editAuditData.status}
                        onChange={(e) => setEditAuditData({ ...editAuditData, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800"
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Deficiencies</label>
                      <input
                        type="number"
                        min="0"
                        value={editAuditData.findingsCount}
                        onChange={(e) => setEditAuditData({ ...editAuditData, findingsCount: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Scope description</label>
                    <textarea
                      value={editAuditData.scope}
                      onChange={(e) => setEditAuditData({ ...editAuditData, scope: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-800 h-20 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-200 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingAudit(false);
                        setEditAuditData(null);
                      }}
                      className="flex-1 py-2 text-center border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateAudit(editAuditData)}
                      className="flex-1 py-2 text-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2 p-6 bg-slate-50/50 border-r border-slate-150 overflow-y-auto space-y-5">
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold leading-none ${
                      selectedDetailAudit.status === 'Completed' ? 'bg-green-50 text-green-700 border border-green-200/50' :
                      selectedDetailAudit.status === 'Overdue' ? 'bg-red-50 text-red-700 border border-red-200/50' :
                      selectedDetailAudit.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                      'bg-blue-50 text-blue-700 border border-blue-200/50'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        selectedDetailAudit.status === 'Completed' ? 'bg-green-500' :
                        selectedDetailAudit.status === 'Overdue' ? 'bg-red-500' :
                        selectedDetailAudit.status === 'In Progress' ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`} />
                      {selectedDetailAudit.status}
                    </span>
                    
                    <h3 className="text-xl font-bold text-slate-900 mt-2.5 leading-snug">{selectedDetailAudit.type}</h3>
                    <div className="flex items-center gap-1.5 text-slate-400 mt-1 font-mono text-xs font-semibold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Conducted on: {selectedDetailAudit.date}</span>
                    </div>
                  </div>

                  <div className="space-y-3.5 border-t border-slate-150 pt-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vessel Coverage</h4>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{getVesselName(selectedDetailAudit.vesselId)}</p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Lead Inspector</h4>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{selectedDetailAudit.inspectorName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{selectedDetailAudit.inspectorOrganization}</p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Findings / Deficiencies</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-extrabold ${
                          selectedDetailAudit.findingsCount > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {selectedDetailAudit.findingsCount} Deficiencies Found
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Scope Checklist</h4>
                      <p className="text-xs text-slate-600 bg-white p-3 border border-slate-200/60 rounded-xl mt-1.5 leading-relaxed shadow-xs">
                        {selectedDetailAudit.scope || 'No scope details configured for this registered regulatory audit.'}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">Audit Report File</h4>
                      {selectedDetailAudit.reportFileName ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-xs font-semibold text-slate-700 truncate">{selectedDetailAudit.reportFileName}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={token ? `/api/audit-records/${selectedDetailAudit.id}/report?token=${encodeURIComponent(token)}` : '#'}
                                download={selectedDetailAudit.reportFileName}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 px-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-105 text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" /> View / Download
                              </a>
                              <button
                                onClick={handleDeleteReport}
                                className="p-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                title="Delete report file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-5 text-center shadow-xs flex flex-col items-center justify-center gap-2">
                          <Upload className="w-6 h-6 text-slate-400" />
                          <div>
                            <p className="text-xs font-semibold text-slate-600">No report file uploaded yet</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Upload a PDF or document summary</p>
                          </div>
                          <label className="mt-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1 shadow-sm">
                            <Paperclip className="w-3.5 h-3.5" />
                            {uploadingReport ? 'Uploading...' : 'Browse File'}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff"
                              disabled={uploadingReport}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUploadReport(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Right Column: Comments section */}
              <div className="md:col-span-3 flex flex-col overflow-hidden bg-white">
                {/* Comments Header */}
                <div className="px-6 py-3 bg-slate-50/30 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    <h4 className="text-xs font-black text-slate-700 tracking-wider uppercase">
                      Comments & Logs ({selectedAuditComments.length})
                    </h4>
                  </div>
                  {['Internal Audit', 'External Audit', 'VIR', 'Navigational Audit'].includes(selectedDetailAudit.type) ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">Comments Enabled</span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold italic">Standard view mode</span>
                  )}
                </div>

                {/* Scrollable comments list */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {commentsLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                      <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Retrieving comments...</span>
                    </div>
                  ) : selectedAuditComments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <MessageSquare className="w-6 h-6 text-slate-300" />
                      </div>
                      <h5 className="text-xs font-bold text-slate-700">No comments posted yet</h5>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-normal">
                        {['Internal Audit', 'External Audit', 'VIR', 'Navigational Audit'].includes(selectedDetailAudit.type) ? 
                          'Be the first to share notes or regulatory logs on this audit registry entry below.' :
                          'Comments are read-only or disabled for general survey checklists.'
                        }
                      </p>
                    </div>
                  ) : (
                    selectedAuditComments.map((comment, index) => {
                      const initials = comment.author ? comment.author.split(' ').map((n: any) => n[0]).join('').substring(0, 2).toUpperCase() : 'AU';
                      // format timestamp elegantly
                      const dateStr = comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() + ' ' + new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
                      return (
                        <div key={comment.id || index} className="flex gap-3 group animate-in slide-in-from-bottom-2 duration-155">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-black text-xs text-slate-600 shrink-0 border border-slate-200 uppercase">
                            {initials}
                          </div>
                          <div className="flex-1 bg-slate-50/65 border border-slate-150/50 p-3 rounded-2xl">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-800 leading-none">{comment.author}</span>
                              <span className="text-[10px] text-slate-400 font-mono font-bold leading-none">{dateStr}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">{comment.commentText}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Comment Form input */}
                {['Internal Audit', 'External Audit', 'VIR', 'Navigational Audit'].includes(selectedDetailAudit.type) ? (
                  <form onSubmit={handleAddComment} className="p-4 border-t border-slate-150 flex gap-2 bg-slate-50/40">
                    <input 
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Write a comment or regulatory observation..."
                      className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-800"
                    />
                    <button 
                      type="submit" 
                      disabled={!newCommentText.trim()}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center animate-pulse"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="p-4 border-t border-slate-150 text-center bg-slate-50/20">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none">
                      Comments restricted to Internal, External, VIR, and Navigational Audits.
                    </p>
                  </div>
                )}
              </div>
            </div>
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 font-bold tracking-wider uppercase animate-pulse">Retrieving Non-Conformities database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredNcs.length === 0 ? (
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
