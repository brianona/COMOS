import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  User,
  Anchor,
  Compass,
  Award,
  Activity,
  CheckCircle2,
  Clock,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
  ChevronRight,
  UserCheck,
  X,
  AlertCircle,
  FileText,
  Trash2
} from 'lucide-react';
import { CandidateItem, CrewMemberItem } from '../../types/crew';
import { CrewProfileModal } from './CrewProfileModal';
import { calculateCrewAge } from '../../utils/helpers';

interface VesselOption {
  id: number | string;
  name: string;
  team_id?: number | null;
}

interface CurrentUser {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'vessel' | 'team_pic';
  team_ids?: number[];
  vessel_id?: number | null;
}

interface VesselCandidateSearchProps {
  vessels: VesselOption[];
  token?: string;
  currentUser: CurrentUser;
}

export const VesselCandidateSearch: React.FC<VesselCandidateSearchProps> = ({
  vessels,
  token,
  currentUser
}) => {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRank, setSelectedRank] = useState('all');
  const [selectedAvailability, setSelectedAvailability] = useState('all');
  const [selectedNationality, setSelectedNationality] = useState('all');
  const [minSeaMonths, setMinSeaMonths] = useState<number>(0);

  // Profile modal state
  const [inspectingCandidate, setInspectingCandidate] = useState<CrewMemberItem | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Quick Assignment Modal state
  const [assigningCandidate, setAssigningCandidate] = useState<CandidateItem | null>(null);
  const [assignVesselId, setAssignVesselId] = useState('');
  const [assignSignOnDate, setAssignSignOnDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignDuration, setAssignDuration] = useState(6);
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Delete Candidate Profile State (Managers & Admins)
  const [candidateToDelete, setCandidateToDelete] = useState<CandidateItem | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canDeleteCandidate = currentUser.role === 'admin' || currentUser.role === 'team_pic';

  const handleConfirmDeleteCandidate = async () => {
    if (!candidateToDelete) return;
    setDeletingCandidate(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/crew-members/${candidateToDelete.id}/profile`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete candidate profile.');
      }
      setCandidates(prev => prev.filter(c => c.id !== candidateToDelete.id));
      setToastMessage(`Profile for ${candidateToDelete.name} has been deleted.`);
      setCandidateToDelete(null);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete candidate profile.');
    } finally {
      setDeletingCandidate(false);
    }
  };

  // Determine which vessels the current user can assign crew to
  const assignableVessels = vessels.filter(v => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'team_pic' || currentUser.role === 'user') {
      const uTeams = (currentUser.team_ids || []).map(Number);
      return v.team_id && uTeams.includes(Number(v.team_id));
    }
    return false;
  });

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crew-candidates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access restricted: Crew searching is only available to ashore and operations staff.');
        }
        throw new Error('Failed to load vessel candidates.');
      }
      const data = await res.json();
      setCandidates(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching candidates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.role !== 'vessel') {
      fetchCandidates();
    }
  }, [token, currentUser.role]);

  // Non-vessel security boundary
  if (currentUser.role === 'vessel') {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800">Crew Search Restricted</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Crew searching and crew pool sourcing are restricted to shore-based personnel, Managers, and Superintendents.
          Vessel accounts can view and manage their onboard crew list under Onboard Crew.
        </p>
      </div>
    );
  }

  // Filter logic
  const filteredCandidates = candidates.filter(c => {
    // Search keyword
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (c.name || '').toLowerCase().includes(term);
      const matchRank = (c.rank || '').toLowerCase().includes(term);
      const matchPassport = (c.passportNo || '').toLowerCase().includes(term);
      const matchSeaman = (c.seamanBookNo || '').toLowerCase().includes(term);
      const matchNat = (c.nationality || '').toLowerCase().includes(term);
      if (!matchName && !matchRank && !matchPassport && !matchSeaman && !matchNat) return false;
    }

    // Rank filter
    if (selectedRank !== 'all' && c.rank !== selectedRank) {
      return false;
    }

    // Availability filter
    if (selectedAvailability !== 'all') {
      const isAssigned = c.vesselId && c.vesselId !== 'any' && c.vesselId !== 'all' && c.vesselId !== 'pool';
      if (selectedAvailability === 'available' && isAssigned) return false;
      if (selectedAvailability === 'onboard' && !isAssigned) return false;
      if (selectedAvailability === 'on_leave' && c.availabilityStatus !== 'on_leave') return false;
    }

    // Nationality filter
    if (selectedNationality !== 'all' && c.nationality !== selectedNationality) {
      return false;
    }

    // Min sea experience
    if (minSeaMonths > 0 && (c.totalSeaMonths || 0) < minSeaMonths) {
      return false;
    }

    return true;
  });

  // Extract ranks for dropdown
  const uniqueRanks = Array.from(new Set(candidates.map(c => c.rank).filter(Boolean)));
  const uniqueNationalities = Array.from(new Set(candidates.map(c => c.nationality).filter(Boolean)));

  const handleOpenAssignModal = (cand: CandidateItem) => {
    setAssigningCandidate(cand);
    setAssignVesselId(assignableVessels.length > 0 ? String(assignableVessels[0].id) : '');
    setAssignSignOnDate(new Date().toISOString().split('T')[0]);
    setAssignDuration(6);
    setAssignError(null);
    setAssignSuccess(null);
  };

  const handleExecuteAssign = async () => {
    if (!assigningCandidate || !assignVesselId) return;
    setAssigningLoading(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/crew-members/${assigningCandidate.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vesselId: assignVesselId,
          signOnDate: assignSignOnDate,
          contractDuration: assignDuration,
          rank: assigningCandidate.rank
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign candidate to vessel.');
      }

      setAssignSuccess(`Successfully deployed ${assigningCandidate.name} to ${data.vesselName || 'vessel'}!`);
      // Refresh candidate list
      await fetchCandidates();
      setTimeout(() => {
        setAssigningCandidate(null);
      }, 1200);
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign candidate.');
    } finally {
      setAssigningLoading(false);
    }
  };

  const openProfileModal = (cand: CandidateItem) => {
    const asCrewItem: CrewMemberItem = {
      ...cand,
      canEdit: true, // Non-vessel users can edit profile
      status: (cand.status as any) || 'Compliant',
      contractDuration: 6
    };
    setInspectingCandidate(asCrewItem);
    setIsProfileModalOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-bold text-slate-900">Vessel Crew Search</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Search and filter maritime candidate profiles by rank, sea time experience, certification, and readiness date.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/70">
              {filteredCandidates.length} Candidates Found
            </span>
            {currentUser.role === 'team_pic' && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/80">
                Manager Fleet: {assignableVessels.length} Vessels
              </span>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Keyword search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by candidate name, passport, CDC, or skill..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          {/* Rank filter */}
          <div>
            <select
              value={selectedRank}
              onChange={e => setSelectedRank(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="all">All Ranks & Positions</option>
              {uniqueRanks.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Availability status */}
          <div>
            <select
              value={selectedAvailability}
              onChange={e => setSelectedAvailability(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="all">All Availability</option>
              <option value="available">Available in Pool</option>
              <option value="on_leave">On Leave / Standby</option>
              <option value="onboard">Currently Onboard</option>
            </select>
          </div>

          {/* Sea experience filter */}
          <div>
            <select
              value={minSeaMonths}
              onChange={e => setMinSeaMonths(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value={0}>Any Sea Experience</option>
              <option value={6}>6+ Months Sea Time</option>
              <option value={12}>12+ Months Sea Time</option>
              <option value={24}>24+ Months Sea Time</option>
              <option value={36}>36+ Months Sea Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Candidate Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Clock className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600">Loading candidate directory...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-slate-700">No candidates match your criteria</h3>
          <p className="text-[11px] text-slate-400 mt-1">Try clearing filters or broadening search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map(cand => {
            const isAssigned = cand.vesselId && cand.vesselId !== 'any' && cand.vesselId !== 'all' && cand.vesselId !== 'pool';
            const seaRecords = cand.profileData?.seaService || [];
            const licenseRecords = cand.profileData?.nationalLicenses || [];
            const pemeStatus = cand.profileData?.medicalCertification?.pemeStatus || 'Fit for Sea Duty';
            const notForRehire = cand.profileData?.remarksSection?.notForRehire || false;

            return (
              <div
                key={cand.id}
                className={`rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 ${
                  notForRehire
                    ? 'bg-rose-50 border-rose-300 hover:border-rose-400 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                {/* Header row */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 overflow-hidden shrink-0">
                        {cand.photo ? (
                          <img src={cand.photo} alt={cand.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate" title={cand.name}>
                          {cand.name}
                        </h3>
                        <p className="text-xs font-semibold text-blue-600 truncate">{cand.rank}</p>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{cand.nationality}</span>
                          <span>·</span>
                          <span>{cand.passportNo || 'No Passport'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill & Not For Rehire Badge */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {notForRehire && (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white shadow-2xs">
                          Not For Rehire
                        </span>
                      )}
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        isAssigned
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : cand.availabilityStatus === 'on_leave'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isAssigned ? (cand.vesselName || 'Onboard') : 'Available'}
                      </span>
                    </div>
                  </div>

                  {/* Highlights & Qualifications */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 text-xs">
                    {(() => {
                      const bdate = cand.birthdate || cand.profileData?.basicInfo?.birthdate;
                      const cage = calculateCrewAge(bdate);
                      return cage !== null ? (
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Age & Birthdate
                          </span>
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {cage} yrs {bdate ? `(${bdate})` : ''}
                          </span>
                        </div>
                      ) : null;
                    })()}

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Compass className="w-3.5 h-3.5 text-slate-400" /> Total Sea Time
                      </span>
                      <span className="font-bold text-slate-800">
                        {cand.totalSeaMonths > 0 ? `${cand.totalSeaMonths} Months` : 'Entry Level'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Activity className="w-3.5 h-3.5 text-slate-400" /> Medical Fitness
                      </span>
                      <span className={`font-semibold ${
                        pemeStatus === 'Fit for Sea Duty' ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        {pemeStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Award className="w-3.5 h-3.5 text-slate-400" /> Verified Certs
                      </span>
                      <span className="font-semibold text-slate-700">
                        {licenseRecords.length} Licenses
                      </span>
                    </div>

                    {cand.contactNumber && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
                        </span>
                        <span className="font-mono text-slate-700">{cand.contactNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openProfileModal(cand)}
                    className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer text-center"
                  >
                    View Full Profile
                  </button>

                  {(() => {
                    const cEndDate = cand.profileData?.vesselAssignment?.contractEndDate;
                    const hasActiveContract = isAssigned || (cEndDate && new Date(cEndDate).getTime() > Date.now());
                    return (
                      <button
                        type="button"
                        disabled={Boolean(hasActiveContract)}
                        onClick={() => handleOpenAssignModal(cand)}
                        className={`py-2 px-3 font-semibold text-xs rounded-xl shadow-xs transition-colors text-center flex items-center gap-1.5 ${
                          hasActiveContract 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                        }`}
                        title={hasActiveContract ? 'Cannot assign: Crew member has an active contract or is currently onboard/assigned' : 'Assign to Vessel'}
                      >
                        <Anchor className="w-3.5 h-3.5" /> Assign to Vessel
                      </button>
                    );
                  })()}

                  {canDeleteCandidate && (
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateToDelete(cand);
                        setDeleteError(null);
                      }}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                      title="Delete Candidate Profile (Managers & Admins only)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Vessel Assignment Modal */}
      {assigningCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Anchor className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Assign Candidate to Vessel</h3>
              </div>
              <button
                type="button"
                onClick={() => setAssigningCandidate(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignError && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            {assignSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{assignSuccess}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500">Candidate:</span>
                <span className="font-bold text-slate-900 ml-1.5">{assigningCandidate.name}</span>
                <span className="text-slate-400 font-medium ml-1">({assigningCandidate.rank})</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Vessel *
                </label>
                {assignableVessels.length === 0 ? (
                  <p className="text-xs text-rose-600">No vessels available under your team permissions.</p>
                ) : (
                  <select
                    value={assignVesselId}
                    onChange={e => setAssignVesselId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                  >
                    {assignableVessels.map(v => (
                      <option key={v.id} value={String(v.id)}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                )}
                {currentUser.role === 'team_pic' && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Showing vessels assigned to your team fleet.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sign-On Date
                  </label>
                  <input
                    type="date"
                    value={assignSignOnDate}
                    onChange={e => setAssignSignOnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={assignDuration}
                    onChange={e => setAssignDuration(Number(e.target.value) || 6)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssigningCandidate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAssign}
                disabled={assigningLoading || !assignVesselId || assignableVessels.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                {assigningLoading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Candidate Profile Modal (Managers & Admins only) */}
      {candidateToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">Delete Candidate Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setCandidateToDelete(null)}
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
                Are you sure you want to permanently delete the candidate profile of{' '}
                <strong className="text-slate-900">{candidateToDelete.name}</strong> ({candidateToDelete.rank})?
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <p className="font-semibold">Notice for Managers & Admins:</p>
                <p>
                  This action removes this candidate from the available crew pool, along with their recorded certificates, licenses, and profile data.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCandidateToDelete(null)}
                disabled={deletingCandidate}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCandidate}
                disabled={deletingCandidate}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingCandidate ? 'Deleting...' : 'Confirm Delete Profile'}
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

      {/* Full Crew Profile Modal */}
      {isProfileModalOpen && (
        <CrewProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setInspectingCandidate(null);
          }}
          crewItem={inspectingCandidate}
          onSave={async (saved) => {
            // Send update
            if (inspectingCandidate?.id) {
              await fetch(`/api/crew-members/${inspectingCandidate.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(saved)
              });
              await fetchCandidates();
            }
          }}
          onDelete={async (deletedId) => {
            setCandidates(prev => prev.filter(c => c.id !== deletedId));
            setIsProfileModalOpen(false);
            setInspectingCandidate(null);
            setToastMessage('Candidate profile has been successfully deleted.');
            setTimeout(() => setToastMessage(null), 4000);
          }}
          vessels={vessels}
          canEdit={true}
          token={token}
          currentUserRole={currentUser.role}
        />
      )}

    </div>
  );
};
