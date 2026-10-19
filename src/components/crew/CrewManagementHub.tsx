import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Anchor,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  UserCheck,
  UserX,
  FileText,
  Compass,
  ArrowRightLeft,
  X,
  Lock,
  ChevronDown,
  Download,
  Trash2
} from 'lucide-react';
import { CrewMemberItem, CrewProfile } from '../../types/crew';
import { CrewProfileModal } from './CrewProfileModal';

interface VesselOption {
  id: number | string;
  name: string;
  team_id?: number | null;
  type?: string;
  flag?: string;
}

interface CurrentUser {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'vessel' | 'team_pic';
  team_ids?: number[];
  vessel_id?: number | null;
}

interface CrewManagementHubProps {
  vessels: VesselOption[];
  token?: string;
  currentUser: CurrentUser;
  onNavigateToCandidateSearch?: () => void;
}

export const CrewManagementHub: React.FC<CrewManagementHubProps> = ({
  vessels,
  token,
  currentUser,
  onNavigateToCandidateSearch
}) => {
  const [crewMembers, setCrewMembers] = useState<CrewMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected vessel
  const isVesselUser = currentUser.role === 'vessel';
  const userVesselId = currentUser.vessel_id ? String(currentUser.vessel_id) : '';

  // Determine allowed vessels for selector
  const accessibleVessels = useMemo(() => {
    if (isVesselUser) {
      return vessels.filter(v => String(v.id) === userVesselId);
    }
    if (currentUser.role === 'team_pic') {
      const uTeams = (currentUser.team_ids || []).map(Number);
      return vessels.filter(v => v.team_id && uTeams.includes(Number(v.team_id)));
    }
    return vessels;
  }, [vessels, currentUser, isVesselUser, userVesselId]);

  const [selectedVesselId, setSelectedVesselId] = useState<string>(() => {
    if (isVesselUser && userVesselId) return userVesselId;
    if (accessibleVessels.length > 0) return String(accessibleVessels[0].id);
    return 'all';
  });

  // Table filters
  const [tableSearch, setTableSearch] = useState('');
  const [rankCategoryFilter, setRankCategoryFilter] = useState<'all' | 'deck' | 'engine' | 'catering'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'compliant' | 'warning' | 'expiring'>('all');

  // Modal states
  const [activeProfileCrew, setActiveProfileCrew] = useState<CrewMemberItem | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreatingCrew, setIsCreatingCrew] = useState(false);

  // Disembark Modal State
  const [disembarkingCrew, setDisembarkingCrew] = useState<CrewMemberItem | null>(null);
  const [finishedContract, setFinishedContract] = useState(true);
  const [disembarkRemarks, setDisembarkRemarks] = useState('');
  const [disembarkLoading, setDisembarkLoading] = useState(false);
  const [disembarkError, setDisembarkError] = useState<string | null>(null);

  // Pool Assign Quick Modal
  const [isPoolAssignModalOpen, setIsPoolAssignModalOpen] = useState(false);
  const [poolCandidates, setPoolCandidates] = useState<CrewMemberItem[]>([]);
  const [selectedPoolCrewId, setSelectedPoolCrewId] = useState('');
  const [poolAssignLoading, setPoolAssignLoading] = useState(false);

  // Contract Extension Modal State
  const [extendingCrew, setExtendingCrew] = useState<CrewMemberItem | null>(null);
  const [extensionMonths, setExtensionMonths] = useState<number>(1);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  // Delete Crew Profile State (Managers & Admins)
  const [crewToDelete, setCrewToDelete] = useState<CrewMemberItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canDeleteCrewProfile = currentUser.role === 'admin' || currentUser.role === 'team_pic';

  const fetchCrew = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crew-members', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load crew members.');
      const data = await res.json();
      setCrewMembers(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching crew list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrew();
  }, [token]);

  // Check if current user can manage the currently selected vessel's crew list
  const canManageCurrentVessel = useMemo(() => {
    if (currentUser.role === 'admin') return true;
    if (selectedVesselId === 'all') {
      return false; // must select a specific vessel to perform bulk additions
    }
    if (isVesselUser) {
      return selectedVesselId === userVesselId;
    }
    if (currentUser.role === 'team_pic' || currentUser.role === 'user') {
      const vesselObj = vessels.find(v => String(v.id) === selectedVesselId);
      if (!vesselObj || !vesselObj.team_id) return false;
      const uTeams = (currentUser.team_ids || []).map(Number);
      return uTeams.includes(Number(vesselObj.team_id));
    }
    return false;
  }, [currentUser, selectedVesselId, isVesselUser, userVesselId, vessels]);

  // Current vessel object
  const currentVessel = vessels.find(v => String(v.id) === selectedVesselId);

  // Filtered crew members for display
  const displayedCrew = useMemo(() => {
    return crewMembers.filter(m => {
      // Vessel filter
      if (selectedVesselId !== 'all') {
        if (String(m.vesselId) !== selectedVesselId) return false;
      }

      // Search keyword
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const mName = (m.name || '').toLowerCase().includes(q);
        const mRank = (m.rank || '').toLowerCase().includes(q);
        const mNat = (m.nationality || '').toLowerCase().includes(q);
        const mPass = (m.passportNo || '').toLowerCase().includes(q);
        const mBook = (m.seamanBookNo || '').toLowerCase().includes(q);
        if (!mName && !mRank && !mNat && !mPass && !mBook) return false;
      }

      // Department filter
      if (rankCategoryFilter !== 'all') {
        const r = (m.rank || '').toLowerCase();
        if (rankCategoryFilter === 'deck') {
          const isDeck = r.includes('master') || r.includes('captain') || r.includes('officer') || r.includes('bosun') || r.includes('seaman') || r.includes('deck') || r.includes('cadet');
          if (!isDeck) return false;
        } else if (rankCategoryFilter === 'engine') {
          const isEngine = r.includes('engineer') || r.includes('motorman') || r.includes('oiler') || r.includes('wiper') || r.includes('fitter') || r.includes('eto') || r.includes('electro');
          if (!isEngine) return false;
        } else if (rankCategoryFilter === 'catering') {
          const isCatering = r.includes('cook') || r.includes('messman') || r.includes('steward');
          if (!isCatering) return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'compliant' && m.status !== 'Compliant') return false;
        if (statusFilter === 'warning' && m.status !== 'Warning') return false;
        if (statusFilter === 'expiring') {
          if (!m.contractEndDate) return false;
          const end = new Date(m.contractEndDate).getTime();
          const now = Date.now();
          const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
          if (diffDays > 30 || diffDays < 0) return false;
        }
      }

      return true;
    });
  }, [crewMembers, selectedVesselId, tableSearch, rankCategoryFilter, statusFilter]);

  // Summary Metrics for current scope
  const stats = useMemo(() => {
    const list = selectedVesselId === 'all' 
      ? crewMembers.filter(c => c.vesselId && c.vesselId !== 'any' && c.vesselId !== 'all')
      : crewMembers.filter(c => String(c.vesselId) === selectedVesselId);

    const total = list.length;
    let officers = 0;
    let ratings = 0;
    let expiringSoon = 0;
    let medicalExpiring = 0;

    const now = Date.now();

    list.forEach(c => {
      const r = (c.rank || '').toLowerCase();
      if (r.includes('master') || r.includes('captain') || r.includes('officer') || r.includes('engineer') || r.includes('eto')) {
        officers++;
      } else {
        ratings++;
      }

      if (c.contractEndDate) {
        const diffDays = Math.ceil((new Date(c.contractEndDate).getTime() - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30 && diffDays >= 0) expiringSoon++;
      }

      if (c.nextMedicalExam) {
        const diffDays = Math.ceil((new Date(c.nextMedicalExam).getTime() - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 60 && diffDays >= 0) medicalExpiring++;
      }
    });

    const poolCount = crewMembers.filter(c => !c.vesselId || c.vesselId === 'any' || c.vesselId === 'all' || c.vesselId === 'pool').length;

    return { total, officers, ratings, expiringSoon, medicalExpiring, poolCount };
  }, [crewMembers, selectedVesselId]);

  // Open creation modal
  const handleCreateNewCrew = () => {
    if (!canManageCurrentVessel) return;
    const initialNewItem: Partial<CrewMemberItem> = {
      vesselId: selectedVesselId !== 'all' ? selectedVesselId : '',
      vesselName: currentVessel?.name || '',
      canEdit: true,
      status: 'Compliant',
      nationality: 'Filipino',
      rank: 'Able Seaman (AB)'
    };
    setActiveProfileCrew(initialNewItem as CrewMemberItem);
    setIsCreatingCrew(true);
    setIsProfileModalOpen(true);
  };

  // Open existing crew profile
  const handleOpenProfile = (crew: CrewMemberItem) => {
    setActiveProfileCrew(crew);
    setIsCreatingCrew(false);
    setIsProfileModalOpen(true);
  };

  // Extend contract handler (No alert() or prompt() calls)
  const handleExtendContract = (crew: CrewMemberItem) => {
    const currentDuration = crew.contractDuration || 6;
    const maxAllowedExtension = Math.max(0, 11 - currentDuration);
    setExtendingCrew(crew);
    setExtensionMonths(maxAllowedExtension > 0 ? 1 : 0);
    if (maxAllowedExtension === 0) {
      setExtendError(`Contract duration is currently at the maximum limit of 11 months (${currentDuration} months). In accordance with MLC 2006 regulations, contracts cannot exceed 11 months without sign-off.`);
    } else {
      setExtendError(null);
    }
  };

  // Delete crew profile handler (Managers & Admins only)
  const handleConfirmDeleteProfile = async () => {
    if (!crewToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/crew-members/${crewToDelete.id}/profile`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete crew member profile.');
      }
      setCrewMembers(prev => prev.filter(c => c.id !== crewToDelete.id));
      setToastMessage(`Crew profile for ${crewToDelete.name} has been deleted.`);
      setCrewToDelete(null);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete crew profile.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmExtension = async () => {
    if (!extendingCrew) return;
    const currentDuration = extendingCrew.contractDuration || 6;
    const maxAllowedExtension = Math.max(0, 11 - currentDuration);

    if (isNaN(extensionMonths) || extensionMonths <= 0) {
      setExtendError('Please enter a valid number of months.');
      return;
    }

    const newDuration = currentDuration + extensionMonths;
    if (newDuration > 11) {
      setExtendError(`Total contract duration including extension cannot exceed 11 months. (Current: ${currentDuration} mos + Extension: ${extensionMonths} mos = ${newDuration} mos. Max allowed: 11 mos).`);
      return;
    }

    const baseDateStr = extendingCrew.contractEndDate || new Date().toISOString().split('T')[0];
    const baseDate = new Date(baseDateStr);
    baseDate.setMonth(baseDate.getMonth() + extensionMonths);
    const newEndDate = baseDate.toISOString().split('T')[0];

    const newExtensionsCount = (extendingCrew.extensionsCount || 0) + 1;

    setExtendLoading(true);
    setExtendError(null);
    try {
      const updated = {
        ...extendingCrew,
        contractDuration: newDuration,
        contractEndDate: newEndDate,
        extensionsCount: newExtensionsCount
      };
      await handleSaveProfile(updated);
      setExtendingCrew(null);
    } catch (err: any) {
      setExtendError(err.message || 'Failed to extend contract.');
    } finally {
      setExtendLoading(false);
    }
  };

  // Save profile from modal
  const handleSaveProfile = async (saved: Partial<CrewMemberItem>) => {
    const isNew = isCreatingCrew || !saved.id;
    const url = isNew ? '/api/crew-members' : `/api/crew-members/${saved.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(saved)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save crew profile.');
    }

    await fetchCrew();
  };

  // Disembark handler
  const handleConfirmDisembark = async () => {
    if (!disembarkingCrew) return;
    setDisembarkLoading(true);
    setDisembarkError(null);
    try {
      const res = await fetch(`/api/crew-members/${disembarkingCrew.id}/disembark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          finishedContract,
          remarks: disembarkRemarks
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to disembark crew member.');
      }

      await fetchCrew();
      setDisembarkingCrew(null);
    } catch (err: any) {
      setDisembarkError(err.message || 'Disembarkation failed.');
    } finally {
      setDisembarkLoading(false);
    }
  };

  // Open pool assign modal
  const handleOpenPoolAssign = () => {
    const pool = crewMembers.filter(c => !c.vesselId || c.vesselId === 'any' || c.vesselId === 'all' || c.vesselId === 'pool');
    setPoolCandidates(pool);
    setSelectedPoolCrewId(pool.length > 0 ? pool[0].id : '');
    setIsPoolAssignModalOpen(true);
  };

  const handleExecutePoolAssign = async () => {
    if (!selectedPoolCrewId || !selectedVesselId || selectedVesselId === 'all') return;
    setPoolAssignLoading(true);
    try {
      const res = await fetch(`/api/crew-members/${selectedPoolCrewId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vesselId: selectedVesselId,
          signOnDate: new Date().toISOString().split('T')[0],
          contractDuration: 6
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to sign on pool candidate.');
      }

      await fetchCrew();
      setIsPoolAssignModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to assign candidate.');
    } finally {
      setPoolAssignLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Top Banner & Scope Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">Vessel Crew Management</h1>
                {isVesselUser ? (
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                    Vessel Station
                  </span>
                ) : currentUser.role === 'team_pic' ? (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    Manager
                  </span>
                ) : currentUser.role === 'user' ? (
                  <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                    Superintendent
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                    Administrator
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isVesselUser
                  ? `Authorized onboard crew list for ${currentVessel?.name || 'your assigned vessel'}.`
                  : currentUser.role === 'team_pic'
                    ? 'Manage crew lists for vessels under your manager team jurisdiction.'
                    : currentUser.role === 'user'
                      ? 'Manage crew lists for vessels under your superintendent team jurisdiction.'
                      : 'Manage active crew rosters, STCW compliance, and 9-part seafarer profiles across the fleet.'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {currentUser.role !== 'vessel' && onNavigateToCandidateSearch && (
              <button
                type="button"
                onClick={onNavigateToCandidateSearch}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-blue-600" /> Crew Search
              </button>
            )}

            {canManageCurrentVessel && (
              <>
                <button
                  type="button"
                  onClick={handleOpenPoolAssign}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4 text-slate-500" /> Sign On from Pool
                </button>

                <button
                  type="button"
                  onClick={handleCreateNewCrew}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Crew Member
                </button>
              </>
            )}
          </div>
        </div>

        {/* Vessel Switcher & Operational Status */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Active Vessel:</span>
            {isVesselUser ? (
              <div className="px-3 py-1.5 bg-slate-100 text-slate-900 rounded-lg text-xs font-bold flex items-center gap-2 border border-slate-200">
                <Anchor className="w-3.5 h-3.5 text-blue-600" />
                {currentVessel?.name || 'Assigned Vessel'}
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedVesselId}
                  onChange={e => setSelectedVesselId(e.target.value)}
                  className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                >
                  {currentUser.role === 'admin' && (
                    <option value="all">All Vessels ({vessels.length} Total Fleet)</option>
                  )}
                  {accessibleVessels.map(v => (
                    <option key={v.id} value={String(v.id)}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            )}

            {currentVessel?.type && (
              <span className="text-xs text-slate-500 font-medium">· {currentVessel.type}</span>
            )}
          </div>

          {/* Access status indicator */}
          <div className="text-xs flex items-center gap-2">
            {canManageCurrentVessel ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Authorized to Update Crew List
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Read-only mode for this vessel
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Onboard</span>
          <div className="text-xl font-black text-slate-900 mt-1">{stats.total}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Active seafarers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Deck Officers</span>
          <div className="text-xl font-black text-blue-600 mt-1">{stats.officers}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Command & bridge</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Ratings / Crew</span>
          <div className="text-xl font-black text-slate-700 mt-1">{stats.ratings}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Deck & engine hands</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Contract &lt; 30d</span>
          <div className={`text-xl font-black mt-1 ${stats.expiringSoon > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {stats.expiringSoon}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Requires relief plan</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Medical &lt; 60d</span>
          <div className={`text-xl font-black mt-1 ${stats.medicalExpiring > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {stats.medicalExpiring}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Upcoming PEME renewal</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Pool Reserve</span>
          <div className="text-xl font-black text-emerald-600 mt-1">{stats.poolCount}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Available off-duty</span>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Search onboard crew by name, rank, CDC..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Department filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setRankCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  rankCategoryFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Departments
              </button>
              <button
                type="button"
                onClick={() => setRankCategoryFilter('deck')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  rankCategoryFilter === 'deck' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Deck
              </button>
              <button
                type="button"
                onClick={() => setRankCategoryFilter('engine')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  rankCategoryFilter === 'engine' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Engine
              </button>
              <button
                type="button"
                onClick={() => setRankCategoryFilter('catering')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  rankCategoryFilter === 'catering' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Catering
              </button>
            </div>
          </div>
        </div>

        {/* Roster Table */}
        {loading ? (
          <div className="p-12 text-center">
            <Clock className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">Loading vessel crew list...</p>
          </div>
        ) : displayedCrew.length === 0 ? (
          <div className="p-12 text-center">
            <Anchor className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-slate-700">No crew members assigned</h3>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              {canManageCurrentVessel 
                ? 'Sign on an available candidate from the pool or add a new crew member to this vessel roster.'
                : 'No crew members currently onboard this vessel station.'}
            </p>
            {canManageCurrentVessel && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenPoolAssign}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Sign On from Pool
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewCrew}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Add New Crew
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Seafarer / Rank</th>
                  <th className="py-3 px-4">Nationality & CDC</th>
                  <th className="py-3 px-4">Sign-On Date</th>
                  <th className="py-3 px-4">Contract End</th>
                  <th className="py-3 px-4">Medical Expiry</th>
                  <th className="py-3 px-4">Compliance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCrew.map(c => {
                  const now = Date.now();
                  const end = c.contractEndDate ? new Date(c.contractEndDate).getTime() : 0;
                  const diffEndDays = end ? Math.ceil((end - now) / (1000 * 60 * 60 * 24)) : null;
                  const isExpiringSoon = diffEndDays !== null && diffEndDays <= 30 && diffEndDays >= 0;

                  // Permission check for this specific row
                  const rowCanEdit = c.canEdit;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Rank */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 shrink-0 overflow-hidden">
                            {c.photo ? (
                              <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleOpenProfile(c)}
                              className="font-bold text-slate-900 hover:text-blue-600 text-xs block text-left truncate cursor-pointer"
                            >
                              {c.name}
                            </button>
                            <span className="text-[11px] text-slate-500 font-semibold block">
                              {c.rank}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Nationality & CDC */}
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{c.nationality}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          CDC: {c.seamanBookNo || 'N/A'}
                        </div>
                      </td>

                      {/* Sign-on */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-medium">
                          {c.signOnDate || '—'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {c.contractDuration ? `${c.contractDuration} mos duration` : ''}
                        </div>
                      </td>

                      {/* Contract End */}
                      <td className="py-3 px-4">
                        <div className={`font-semibold ${isExpiringSoon ? 'text-amber-600 flex items-center gap-1' : 'text-slate-800'}`}>
                          {isExpiringSoon && <Clock className="w-3.5 h-3.5" />}
                          {c.contractEndDate || '—'}
                        </div>
                        {diffEndDays !== null && (
                          <div className="text-[10px] text-slate-400">
                            {diffEndDays < 0 ? 'Overdue for relief' : `${diffEndDays} days remaining`}
                          </div>
                        )}
                      </td>

                      {/* Medical Expiry */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-medium">
                          {c.nextMedicalExam || '—'}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          PEME Fit
                        </div>
                      </td>

                      {/* Compliance Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          c.status === 'Compliant'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : c.status === 'Warning'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {c.status}
                        </span>
                      </td>

                      {/* Row Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleExtendContract(c)}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Extend contract date to a latter date"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Extend
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenProfile(c)}
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Profile
                          </button>

                          {rowCanEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setDisembarkingCrew(c);
                                setFinishedContract(true);
                                setDisembarkRemarks('');
                                setDisembarkError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                              title="Sign off / disembark seafarer"
                            >
                              Sign Off
                            </button>
                          )}

                          {canDeleteCrewProfile && (
                            <button
                              type="button"
                              onClick={() => {
                                setCrewToDelete(c);
                                setDeleteError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              title="Delete crew profile (Managers and Admins only)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disembark Confirmation Modal */}
      {disembarkingCrew && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">Disembark & Sign Off Seafarer</h3>
              </div>
              <button
                type="button"
                onClick={() => setDisembarkingCrew(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {disembarkError && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{disembarkError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                You are about to sign off <strong className="text-slate-900">{disembarkingCrew.name}</strong> ({disembarkingCrew.rank}) from this vessel.
                This records their sea time in their service record and returns them to the global candidate pool.
              </p>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={finishedContract}
                  onChange={e => setFinishedContract(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="font-semibold text-slate-800">
                  Normal completion of contract (Finished Contract)
                </span>
              </label>

              {!finishedContract && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reason / Remarks for Early Disembarkation *
                  </label>
                  <textarea
                    rows={2}
                    value={disembarkRemarks}
                    onChange={e => setDisembarkRemarks(e.target.value)}
                    placeholder="e.g. Medical repatriation, compassionate leave, vessel drydock..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisembarkingCrew(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisembark}
                disabled={disembarkLoading || (!finishedContract && !disembarkRemarks.trim())}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                {disembarkLoading ? 'Processing...' : 'Confirm Sign Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pool Quick Sign-On Modal */}
      {isPoolAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Sign On Candidate from Pool</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPoolAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Deploy an available candidate from the company pool directly onto <strong>{currentVessel?.name}</strong>.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Available Candidate
                </label>
                {poolCandidates.length === 0 ? (
                  <p className="text-xs text-amber-600 italic">No candidates currently in the global pool.</p>
                ) : (
                  <select
                    value={selectedPoolCrewId}
                    onChange={e => setSelectedPoolCrewId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                  >
                    {poolCandidates.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.rank} ({c.nationality})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPoolAssignModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePoolAssign}
                disabled={poolAssignLoading || !selectedPoolCrewId || poolCandidates.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                {poolAssignLoading ? 'Signing On...' : 'Sign On to Vessel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Extension Modal */}
      {extendingCrew && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Extend Contract: {extendingCrew.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setExtendingCrew(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {extendError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{extendError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Rank:</span>
                  <span className="font-semibold">{extendingCrew.rank}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Duration:</span>
                  <span className="font-semibold">{extendingCrew.contractDuration || 6} months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current End Date:</span>
                  <span className="font-semibold">{extendingCrew.contractEndDate || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Max Allowed Total:</span>
                  <span className="font-semibold text-blue-600">11 months</span>
                </div>
              </div>

              {11 - (extendingCrew.contractDuration || 6) <= 0 ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Maximum Contract Duration Reached
                  </p>
                  <p className="text-[11px] text-amber-700">
                    This seafarer has completed {extendingCrew.contractDuration || 6} months onboard, reaching the regulatory 11-month maximum contract ceiling (MLC 2006). No further extension can be approved without disembarkation for rest.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Extension Duration (Months) *
                  </label>
                  <select
                    value={extensionMonths}
                    onChange={e => setExtensionMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                  >
                    {Array.from({ length: 11 - (extendingCrew.contractDuration || 6) }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>
                        +{m} {m === 1 ? 'Month' : 'Months'} (New total: {(extendingCrew.contractDuration || 6) + m} mos)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Total contract duration including extension cannot exceed 11 months.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExtendingCrew(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                {11 - (extendingCrew.contractDuration || 6) <= 0 ? 'Close' : 'Cancel'}
              </button>
              {11 - (extendingCrew.contractDuration || 6) > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmExtension}
                  disabled={extendLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {extendLoading ? 'Extending...' : 'Confirm Extension'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Crew Profile Modal (Managers & Admins only) */}
      {crewToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">Delete Crew Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setCrewToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteError && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Are you sure you want to permanently delete the crew profile of{' '}
                <strong className="text-slate-900">{crewToDelete.name}</strong> ({crewToDelete.rank})?
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <p className="font-semibold">Notice for Managers & Admins:</p>
                <p>
                  This action will soft-delete this crew member's profile, including their travel documents, national licenses, certificates, and onboard sea service history.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCrewToDelete(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProfile}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteLoading ? 'Deleting...' : 'Confirm Delete Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 9-Part Crew Profile Modal */}
      {isProfileModalOpen && (
        <CrewProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setActiveProfileCrew(null);
            setIsCreatingCrew(false);
          }}
          crewItem={activeProfileCrew}
          onSave={handleSaveProfile}
          onDelete={async (deletedId) => {
            setCrewMembers(prev => prev.filter(c => c.id !== deletedId));
            setIsProfileModalOpen(false);
            setActiveProfileCrew(null);
            setIsCreatingCrew(false);
            setToastMessage('Crew profile has been successfully deleted.');
            setTimeout(() => setToastMessage(null), 4000);
          }}
          vessels={vessels}
          canEdit={isCreatingCrew ? canManageCurrentVessel : Boolean(activeProfileCrew?.canEdit)}
          token={token}
          currentUserRole={currentUser.role}
        />
      )}

    </div>
  );
};
