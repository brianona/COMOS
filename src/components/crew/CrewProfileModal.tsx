import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  Anchor,
  Compass,
  Award,
  BookOpen,
  Activity,
  FileText,
  HeartHandshake,
  Save,
  Plus,
  Trash2,
  Upload,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Download,
  Eye,
  Lock,
  MessageSquare,
  Flag,
  CreditCard
} from 'lucide-react';
import { CrewProfile, CrewMemberItem, BasicInformation } from '../../types/crew';

interface VesselOption {
  id: number | string;
  name: string;
  team_id?: number | null;
}

interface CrewProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  crewItem?: CrewMemberItem | null;
  onSave: (savedCrew: Partial<CrewMemberItem>) => Promise<void>;
  onDelete?: (crewId: string) => Promise<void>;
  vessels: VesselOption[];
  canEdit: boolean;
  token?: string;
  currentUserRole?: string;
}

const SECTION_TABS = [
  { id: 'basic', label: 'Basic Info', icon: User },
  { id: 'contact', label: 'Contact', icon: Phone },
  { id: 'vessel', label: 'Vessel Assignment', icon: Anchor },
  { id: 'sea_service', label: 'Sea Service', icon: Compass },
  { id: 'travel_documents', label: 'Travel Documents', icon: ShieldCheck },
  { id: 'national_licenses', label: 'National Licenses', icon: Award },
  { id: 'flag_registry_licenses', label: 'Flag Registry Licenses', icon: Flag },
  { id: 'visa_details', label: 'Visa Details', icon: CreditCard },
  { id: 'training_certificates', label: 'Training Certificates', icon: BookOpen },
  { id: 'medical', label: 'Medical Fitness', icon: Activity },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'emergency', label: 'Emergency Contact', icon: HeartHandshake },
  { id: 'remarks', label: 'Remarks', icon: MessageSquare }
] as const;

type SectionId = typeof SECTION_TABS[number]['id'];

const MARITIME_RANKS = [
  'Master (Captain)',
  'Chief Officer',
  '2nd Officer',
  '3rd Officer',
  'Chief Engineer',
  '2nd Engineer',
  '3rd Engineer',
  '4th Engineer',
  'First Assistant Engineer',
  'Second Assistant Engineer',
  'Third Assistant Engineer',
  'Deck Cadet',
  'Engine Cadet',
  'Bosun',
  'Able Seaman (AB)',
  'Ordinary Seaman (OS)',
  'Oiler',
  'Chief Cook',
  'Messman'
];

export const CrewProfileModal: React.FC<CrewProfileModalProps> = ({
  isOpen,
  onClose,
  crewItem,
  onSave,
  onDelete,
  vessels,
  canEdit,
  token,
  currentUserRole
}) => {
  if (!isOpen) return null;

  const isCreating = !crewItem || !crewItem.id;

  const initialProfile: CrewProfile = crewItem?.profileData || {
    basicInfo: {
      firstName: crewItem?.name ? crewItem.name.split(' ')[0] : '',
      middleName: '',
      lastName: crewItem?.name ? crewItem.name.split(' ').slice(1).join(' ') : '',
      rank: crewItem?.rank || 'Able Seaman (AB)',
      nationality: crewItem?.nationality || 'Filipino',
      gender: 'Male',
      maritalStatus: 'Single',
      birthdate: crewItem?.birthdate || '',
      placeOfBirth: '',
      passportNo: crewItem?.passportNo || '',
      passportExpiry: '',
      seamanBookNo: crewItem?.seamanBookNo || '',
      seamanBookExpiry: '',
      photo: crewItem?.photo || '',
      weightKg: crewItem?.profileData?.basicInfo?.weightKg || '',
      heightCm: crewItem?.profileData?.basicInfo?.heightCm || '',
      bmi: crewItem?.profileData?.basicInfo?.bmi || ''
    },
    contactInfo: {
      phone: crewItem?.contactNumber || '',
      secondaryPhone: '',
      email: crewItem?.email || '',
      skypeOrMessaging: '',
      address: {
        street: '',
        city: '',
        provinceState: '',
        country: crewItem?.nationality || 'Philippines',
        postalCode: ''
      }
    },
    vesselAssignment: {
      currentVesselId: crewItem?.vesselId || '',
      vesselName: crewItem?.vesselName || '',
      status: crewItem?.vesselId ? 'Onboard' : 'Available',
      signOnDate: crewItem?.signOnDate || '',
      contractDuration: crewItem?.contractDuration || 6,
      contractEndDate: crewItem?.contractEndDate || '',
      extensionsCount: crewItem?.extensionsCount || 0,
      relieverName: '',
      remarks: crewItem?.siComments || ''
    },
    seaService: [],
    nationalLicenses: crewItem?.profileData?.nationalLicenses || [],
    training: [],
    medicalCertification: {
      pemeStatus: 'Fit for Sea Duty',
      examDate: '',
      expiryDate: crewItem?.nextMedicalExam || '',
      clinicName: '',
      doctorName: '',
      restrictionsRemarks: '',
      drugAlcoholDate: '',
      drugAlcoholResult: 'Negative',
      vaccinations: []
    },
    documents: [],
    travelDocuments: crewItem?.profileData?.travelDocuments || [],
    emergencyContact: {
      nextOfKinName: '',
      relationship: 'Spouse',
      phonePrimary: '',
      phoneSecondary: '',
      email: '',
      address: ''
    },
    remarksSection: crewItem?.profileData?.remarksSection || {
      comments: [],
      notForRehire: false
    }
  };

  const [activeTab, setActiveTab] = useState<SectionId>('basic');
  const [profile, setProfile] = useState<CrewProfile>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Delete Profile State (for Managers and Admins)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDeleteProfile = (currentUserRole === 'admin' || currentUserRole === 'team_pic') && !isCreating && !!crewItem?.id;

  const handleDeleteProfile = async () => {
    if (!crewItem?.id) return;
    setDeletingProfile(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/crew-members/${crewItem.id}/profile`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete crew member profile');
      }
      if (onDelete) {
        await onDelete(crewItem.id);
      }
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete profile');
    } finally {
      setDeletingProfile(false);
    }
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const commentObj = {
      id: 'com_' + Math.random().toString(36).substring(2, 9),
      authorName: currentUserRole === 'admin' ? 'Administrator' : currentUserRole === 'team_pic' ? 'Manager' : 'Superintendent',
      authorRole: currentUserRole || 'shore',
      date: new Date().toISOString().split('T')[0],
      comment: newCommentText.trim()
    };
    const currentRemarks = profile.remarksSection || { comments: [], notForRehire: false };
    setProfile(prev => ({
      ...prev,
      remarksSection: {
        ...currentRemarks,
        comments: [commentObj, ...currentRemarks.comments]
      }
    }));
    setNewCommentText('');
  };

  const handleRemoveComment = (commentId: string) => {
    const currentRemarks = profile.remarksSection || { comments: [], notForRehire: false };
    setProfile(prev => ({
      ...prev,
      remarksSection: {
        ...currentRemarks,
        comments: currentRemarks.comments.filter(c => c.id !== commentId)
      }
    }));
  };

  const handleToggleNotForRehire = (checked: boolean) => {
    const currentRemarks = profile.remarksSection || { comments: [], notForRehire: false };
    setProfile(prev => ({
      ...prev,
      remarksSection: {
        ...currentRemarks,
        notForRehire: checked
      }
    }));
  };

  // Helper updater
  const updateSection = <K extends keyof CrewProfile>(key: K, data: Partial<CrewProfile[K]>) => {
    if (!canEdit) return;
    setProfile(prev => ({
      ...prev,
      [key]: Array.isArray(prev[key]) ? data : { ...(prev[key] as object), ...(data as object) }
    }));
  };

  const updateBasicInfo = (data: Partial<BasicInformation>) => {
    if (!canEdit) return;
    setProfile(prev => {
      const nextBasic = { ...prev.basicInfo, ...data };
      const w = parseFloat(String(nextBasic.weightKg ?? ''));
      const h = parseFloat(String(nextBasic.heightCm ?? ''));
      if (!isNaN(w) && !isNaN(h) && h > 0) {
        const heightM = h / 100;
        nextBasic.bmi = (w / (heightM * heightM)).toFixed(1);
      }
      return {
        ...prev,
        basicInfo: nextBasic
      };
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Str = reader.result as string;
        updateSection('basicInfo', { photo: base64Str });
      };
      reader.readAsDataURL(file);
    }
  };

  // Sea service handlers
  const addSeaService = () => {
    if (!canEdit) return;
    const newEntry = {
      id: 'sea_' + Math.random().toString(36).substring(2, 9),
      vesselName: '',
      vesselType: 'Bulk Carrier',
      dwtGrt: '50,000 DWT',
      engineTypePower: '',
      rank: profile.basicInfo.rank || 'Officer',
      signOnDate: '',
      signOffDate: '',
      durationMonths: 6,
      flag: 'Panama',
      companyManning: '',
      reasonForSignOff: 'Finished contract'
    };
    setProfile(prev => ({
      ...prev,
      seaService: [newEntry, ...prev.seaService]
    }));
  };

  const removeSeaService = (id: string) => {
    if (!canEdit) return;
    setProfile(prev => ({
      ...prev,
      seaService: prev.seaService.filter(s => s.id !== id)
    }));
  };

  // National License handlers
  const addNationalLicense = () => {
    if (!canEdit) return;
    const newLic = {
      id: 'nlic_' + Math.random().toString(36).substring(2, 9),
      documentName: 'National License',
      rank: profile.basicInfo.rank || 'Officer',
      documentNumber: '',
      issuedDate: new Date().toISOString().split('T')[0],
      revalidationDate: '',
      expirationDate: '',
      placeOfIssue: '',
      issuingAuthority: '',
      remarks: ''
    };
    setProfile(prev => ({
      ...prev,
      nationalLicenses: [newLic, ...(prev.nationalLicenses || [])]
    }));
  };

  const removeNationalLicense = (id: string) => {
    if (!canEdit) return;
    setProfile(prev => ({
      ...prev,
      nationalLicenses: (prev.nationalLicenses || []).filter(l => l.id !== id)
    }));
  };

  // Flag Registry License handlers
  const addFlagRegistryLicense = () => {
    if (!canEdit) return;
    const newRecord = {
      id: 'frl_' + Math.random().toString(36).substring(2, 9),
      flagRegistry: '',
      rank: '',
      documentNumber: '',
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
    };
    setProfile(prev => ({
      ...prev,
      flagRegistryLicenses: [newRecord, ...(prev.flagRegistryLicenses || [])]
    }));
  };

  const removeFlagRegistryLicense = (id: string) => {
    if (!canEdit) return;
    setProfile(prev => ({
      ...prev,
      flagRegistryLicenses: (prev.flagRegistryLicenses || []).filter(l => l.id !== id)
    }));
  };
  
  // Visa Detail handlers
  const addVisaDetail = () => {
    if (!canEdit) return;
    const newRecord = {
      id: 'vis_' + Math.random().toString(36).substring(2, 9),
      status: '',
      country: '',
      type: '',
      number: '',
    };
    setProfile(prev => ({
      ...prev,
      visaDetails: [newRecord, ...(prev.visaDetails || [])]
    }));
  };

  const removeVisaDetail = (id: string) => {
    if (!canEdit) return;
    setProfile(prev => ({
      ...prev,
      visaDetails: (prev.visaDetails || []).filter(l => l.id !== id)
    }));
  };

  // Training Certificate handlers
  const addTrainingCertificate = () => {
    if (!canEdit) return;
    const newRecord = {
      id: 'trc_' + Math.random().toString(36).substring(2, 9),
      courseMarina: '',
      certNumber: '',
      issueDate: new Date().toISOString().split('T')[0],
      trainingCenter: '',
      placeOfIssue: '',
    };
    setProfile(prev => ({
      ...prev,
      trainingCertificates: [newRecord, ...(prev.trainingCertificates || [])]
    }));
  };

  const removeTrainingCertificate = (id: string) => {
    if (!canEdit) return;
    setProfile(prev => ({
      ...prev,
      trainingCertificates: (prev.trainingCertificates || []).filter(l => l.id !== id)
    }));
  };

  // Vaccination handlers
  const addVaccination = () => {
    if (!canEdit) return;
    const newVac = {
      id: 'vac_' + Math.random().toString(36).substring(2, 9),
      name: 'Yellow Fever',
      dateGiven: new Date().toISOString().split('T')[0],
      expiryDate: 'Lifetime',
      batchNo: ''
    };
    const currentVac = profile.medicalCertification.vaccinations || [];
    setProfile(prev => ({
      ...prev,
      medicalCertification: {
        ...prev.medicalCertification,
        vaccinations: [...currentVac, newVac]
      }
    }));
  };

  const removeVaccination = (idx: number) => {
    if (!canEdit) return;
    const currentVac = profile.medicalCertification.vaccinations || [];
    setProfile(prev => ({
      ...prev,
      medicalCertification: {
        ...prev.medicalCertification,
        vaccinations: currentVac.filter((_, i) => i !== idx)
      }
    }));
  };

  // Document upload handler
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const fileData = reader.result as string;
      const newDoc = {
        id: 'doc_' + Math.random().toString(36).substring(2, 9),
        documentType: docType,
        documentName: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        fileUrl: fileData,
        uploadedAt: new Date().toISOString().split('T')[0]
      };

      setProfile(prev => ({
        ...prev,
        documents: [newDoc, ...prev.documents]
      }));

      // If we have an existing crew member ID, upload directly to server as well
      if (crewItem?.id && token) {
        try {
          await fetch(`/api/crew-members/${crewItem.id}/documents`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              docName: newDoc.documentName,
              docType: newDoc.documentType,
              fileName: newDoc.fileName,
              fileSize: newDoc.fileSize,
              fileData: fileData
            })
          });
        } catch (err) {
          console.error('Doc direct upload error:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = async (docId: string) => {
    if (!canEdit) return;
    setProfile(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.id !== docId)
    }));

    if (crewItem?.id && token && docId.startsWith('cdoc_')) {
      try {
        await fetch(`/api/crew-members/${crewItem.id}/documents/${docId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Doc delete error:', err);
      }
    }
  };

  const addTravelDocument = () => {
    if (!canEdit) return;
    const newTD = {
      id: 'tdoc_' + Math.random().toString(36).substring(2, 9),
      documentName: 'Passport',
      documentNumber: '',
      issuedDate: new Date().toISOString().split('T')[0],
      revalidatedDate: '',
      expirationDate: '',
      placeOfIssue: '',
      issuingAuthority: '',
      remarks: ''
    };
    setProfile(prev => ({
      ...prev,
      travelDocuments: [newTD, ...(prev.travelDocuments || [])]
    }));
  };

  const removeTravelDocument = (id: string) => {
    if (!canEdit) return;
    setProfile(prev => ({
      ...prev,
      travelDocuments: (prev.travelDocuments || []).filter(t => t.id !== id)
    }));
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const fullName = `${profile.basicInfo.firstName} ${profile.basicInfo.lastName}`.trim();
      if (!fullName) {
        throw new Error('Please enter the crew member first and last name.');
      }
      if (!profile.basicInfo.rank) {
        throw new Error('Please select a rank.');
      }

      const assignedVessel = vessels.find(v => String(v.id) === String(profile.vesselAssignment.currentVesselId));
      const updatedVesselName = assignedVessel ? assignedVessel.name : profile.vesselAssignment.vesselName;

      const updatedPayload: Partial<CrewMemberItem> = {
        id: crewItem?.id,
        name: fullName,
        rank: profile.basicInfo.rank,
        nationality: profile.basicInfo.nationality,
        signOnDate: profile.vesselAssignment.signOnDate || undefined,
        passportNo: profile.basicInfo.passportNo || 'N/A',
        seamanBookNo: profile.basicInfo.seamanBookNo || 'N/A',
        status: crewItem?.status || 'Compliant',
        contractDuration: profile.vesselAssignment.contractDuration || 6,
        nextMedicalExam: profile.medicalCertification.expiryDate || undefined,
        nextSafetyTraining: profile.nationalLicenses?.find(c => c.documentName.toLowerCase().includes('safety'))?.expirationDate || undefined,
        vesselId: profile.vesselAssignment.currentVesselId || '',
        vesselName: updatedVesselName,
        birthdate: profile.basicInfo.birthdate || undefined,
        contactNumber: profile.contactInfo.phone || '',
        email: profile.contactInfo.email || '',
        photo: profile.basicInfo.photo || '',
        hiringStatus: crewItem?.hiringStatus || 'for rehire',
        availabilityStatus: profile.vesselAssignment.currentVesselId ? 'onboard' : 'available',
        siComments: profile.vesselAssignment.remarks || '',
        extensionsCount: profile.vesselAssignment.extensionsCount || 0,
        contractEndDate: profile.vesselAssignment.contractEndDate || undefined,
        profileData: {
          ...profile,
          vesselAssignment: {
            ...profile.vesselAssignment,
            vesselName: updatedVesselName
          }
        }
      };

      await onSave(updatedPayload);
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save crew profile.');
    } finally {
      setSaving(false);
    }
  };

  const assignedVesselObj = vessels.find(v => String(v.id) === String(profile.vesselAssignment.currentVesselId));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 overflow-hidden">
              {profile.basicInfo.photo ? (
                <img src={profile.basicInfo.photo} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {profile.basicInfo.firstName || profile.basicInfo.lastName 
                    ? `${profile.basicInfo.firstName} ${profile.basicInfo.lastName}` 
                    : isCreating ? 'New Crew Profile' : 'Crew Member Profile'}
                </h2>
                {!canEdit && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    <Lock className="w-3 h-3 text-slate-400" /> Read-only
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span className="font-semibold text-slate-700">{profile.basicInfo.rank || 'Unassigned Rank'}</span>
                <span>·</span>
                <span>{assignedVesselObj ? assignedVesselObj.name : 'In Crew Pool'}</span>
                <span>·</span>
                <span>{profile.basicInfo.nationality || 'Filipino'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Read-only Alert Banner if cannot edit */}
        {!canEdit && (
          <div className="bg-amber-50/80 border-b border-amber-200/80 px-6 py-2.5 flex items-center gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Read-only access:</strong> You are viewing this crew member's profile in view mode. Vessel users may only update crew on their assigned vessel, and Managers or Superintendents may only update crew on vessels within their assigned team.
            </span>
          </div>
        )}

        {saveError && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 bg-white px-6 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max py-2">
            {SECTION_TABS
              .filter(tab => currentUserRole !== 'vessel' || tab.id !== 'remarks')
              .map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* 1. BASIC INFORMATION */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="flex items-start gap-6 flex-col sm:flex-row">
                {/* Photo Preview & Upload */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-28 h-28 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                    {profile.basicInfo.photo ? (
                      <img src={profile.basicInfo.photo} alt="Crew" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-slate-300" />
                    )}
                    {canEdit && (
                      <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-semibold">
                        <Upload className="w-4 h-4 mb-1" />
                        Upload Photo
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                  {canEdit && (
                    <label className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer">
                      Change Photo
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  )}
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">First Name *</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.basicInfo.firstName}
                      onChange={e => updateSection('basicInfo', { firstName: e.target.value })}
                      placeholder="e.g. John"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Middle Name</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.basicInfo.middleName || ''}
                      onChange={e => updateSection('basicInfo', { middleName: e.target.value })}
                      placeholder="e.g. Santos"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Last Name *</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.basicInfo.lastName}
                      onChange={e => updateSection('basicInfo', { lastName: e.target.value })}
                      placeholder="e.g. Dela Cruz"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Rank / Position *</label>
                    <select
                      disabled={!canEdit}
                      value={profile.basicInfo.rank}
                      onChange={e => updateSection('basicInfo', { rank: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                    >
                      {MARITIME_RANKS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Nationality</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.basicInfo.nationality}
                      onChange={e => updateSection('basicInfo', { nationality: e.target.value })}
                      placeholder="e.g. Filipino, Ukrainian, Indian"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Date of Birth</label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={profile.basicInfo.birthdate || ''}
                      onChange={e => updateSection('basicInfo', { birthdate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Place of Birth</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.basicInfo.placeOfBirth || ''}
                      onChange={e => updateSection('basicInfo', { placeOfBirth: e.target.value })}
                      placeholder="e.g. Manila, Philippines"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Gender</label>
                    <select
                      disabled={!canEdit}
                      value={profile.basicInfo.gender || 'Male'}
                      onChange={e => updateSection('basicInfo', { gender: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Marital Status</label>
                    <select
                      disabled={!canEdit}
                      value={profile.basicInfo.maritalStatus || 'Single'}
                      onChange={e => updateSection('basicInfo', { maritalStatus: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      disabled={!canEdit}
                      value={profile.basicInfo.weightKg || ''}
                      onChange={e => updateBasicInfo({ weightKg: e.target.value })}
                      placeholder="e.g. 75"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Height (cm)</label>
                    <input
                      type="number"
                      step="1"
                      disabled={!canEdit}
                      value={profile.basicInfo.heightCm || ''}
                      onChange={e => updateBasicInfo({ heightCm: e.target.value })}
                      placeholder="e.g. 175"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">BMI (Body Mass Index)</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.basicInfo.bmi || ''}
                      onChange={e => updateBasicInfo({ bmi: e.target.value })}
                      placeholder="Auto-calculated"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-slate-50 font-semibold text-blue-700"
                    />
                  </div>
                </div>
              </div>

              {/* Identity & Travel Documents */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Passport & Seaman's Book</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Passport Number</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.basicInfo.passportNo}
                      onChange={e => updateSection('basicInfo', { passportNo: e.target.value })}
                      placeholder="e.g. P1234567A"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Passport Expiry</label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={profile.basicInfo.passportExpiry || ''}
                      onChange={e => updateSection('basicInfo', { passportExpiry: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Seaman's Book / CDC No.</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.basicInfo.seamanBookNo}
                      onChange={e => updateSection('basicInfo', { seamanBookNo: e.target.value })}
                      placeholder="e.g. SB-994821"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Seaman's Book Expiry</label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={profile.basicInfo.seamanBookExpiry || ''}
                      onChange={e => updateSection('basicInfo', { seamanBookExpiry: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CONTACT INFORMATION */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Primary Mobile / Phone *</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={profile.contactInfo.phone}
                    onChange={e => updateSection('contactInfo', { phone: e.target.value })}
                    placeholder="+63 917 123 4567"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Secondary / Landline</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={profile.contactInfo.secondaryPhone || ''}
                    onChange={e => updateSection('contactInfo', { secondaryPhone: e.target.value })}
                    placeholder="+63 2 8123 4567"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    disabled={!canEdit}
                    value={profile.contactInfo.email}
                    onChange={e => updateSection('contactInfo', { email: e.target.value })}
                    placeholder="seafarer@example.com"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Skype / WhatsApp / Messaging</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={profile.contactInfo.skypeOrMessaging || ''}
                    onChange={e => updateSection('contactInfo', { skypeOrMessaging: e.target.value })}
                    placeholder="live:seafarer_contact"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Residential Address</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Street Address</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.contactInfo.address?.street || ''}
                      onChange={e => updateSection('contactInfo', { 
                        address: { ...(profile.contactInfo.address || {}), street: e.target.value } 
                      })}
                      placeholder="123 Ocean Boulevard, Unit 4B"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">City / Municipality</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.contactInfo.address?.city || ''}
                      onChange={e => updateSection('contactInfo', { 
                        address: { ...(profile.contactInfo.address || {}), city: e.target.value } 
                      })}
                      placeholder="Pasay City"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Province / State</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.contactInfo.address?.provinceState || ''}
                      onChange={e => updateSection('contactInfo', { 
                        address: { ...(profile.contactInfo.address || {}), provinceState: e.target.value } 
                      })}
                      placeholder="Metro Manila"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Country</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.contactInfo.address?.country || ''}
                      onChange={e => updateSection('contactInfo', { 
                        address: { ...(profile.contactInfo.address || {}), country: e.target.value } 
                      })}
                      placeholder="Philippines"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Postal Code</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.contactInfo.address?.postalCode || ''}
                      onChange={e => updateSection('contactInfo', { 
                        address: { ...(profile.contactInfo.address || {}), postalCode: e.target.value } 
                      })}
                      placeholder="1300"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. VESSEL ASSIGNMENT */}
          {activeTab === 'vessel' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-2 mb-3">
                  <Anchor className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Current Assignment & Deployment</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Assigned Vessel</label>
                    <select
                      disabled={!canEdit}
                      value={profile.vesselAssignment.currentVesselId || ''}
                      onChange={e => {
                        const vId = e.target.value;
                        const vObj = vessels.find(v => String(v.id) === String(vId));
                        updateSection('vesselAssignment', {
                          currentVesselId: vId,
                          vesselName: vObj ? vObj.name : '',
                          status: vId ? 'Onboard' : 'Available'
                        });
                      }}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                    >
                      <option value="">-- Unassigned (Global Candidate Pool) --</option>
                      {vessels.map(v => (
                        <option key={v.id} value={String(v.id)}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Deployment Status</label>
                    <select
                      disabled={!canEdit}
                      value={profile.vesselAssignment.status || 'Available'}
                      onChange={e => updateSection('vesselAssignment', { status: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                    >
                      <option value="Onboard">Onboard</option>
                      <option value="Available">Available (In Pool)</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Standby">Standby</option>
                      <option value="Debriefing">Debriefing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Sign-On Date</label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={profile.vesselAssignment.signOnDate || ''}
                      onChange={e => updateSection('vesselAssignment', { signOnDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Contract Duration (Months)</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      disabled={!canEdit}
                      value={profile.vesselAssignment.contractDuration || 6}
                      onChange={e => {
                        const dur = Number(e.target.value) || 6;
                        let endDate = profile.vesselAssignment.contractEndDate;
                        if (profile.vesselAssignment.signOnDate) {
                          const d = new Date(profile.vesselAssignment.signOnDate);
                          d.setMonth(d.getMonth() + dur);
                          endDate = d.toISOString().split('T')[0];
                        }
                        updateSection('vesselAssignment', { contractDuration: dur, contractEndDate: endDate });
                      }}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Contract End Date</label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={profile.vesselAssignment.contractEndDate || ''}
                      onChange={e => updateSection('vesselAssignment', { contractEndDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Contract Extensions</label>
                    <input
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={profile.vesselAssignment.extensionsCount || 0}
                      onChange={e => updateSection('vesselAssignment', { extensionsCount: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Planned Reliever / Replacement</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.vesselAssignment.relieverName || ''}
                      onChange={e => updateSection('vesselAssignment', { relieverName: e.target.value })}
                      placeholder="e.g. 2/O Carlos Mendoza"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Superintendent / Assignment Remarks</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.vesselAssignment.remarks || ''}
                      onChange={e => updateSection('vesselAssignment', { remarks: e.target.value })}
                      placeholder="e.g. Excellent record, priority for promotion"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. SEA SERVICE */}
          {activeTab === 'sea_service' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Sea Service & Voyage History</h3>
                  <p className="text-[11px] text-slate-500">Record of verified maritime sea time across commercial vessels.</p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addSeaService}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Sea Record
                  </button>
                )}
              </div>

              {profile.seaService.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No sea service records listed yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Add past vessel assignments to compute total sea time for candidate ranking.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.seaService.map((rec, idx) => (
                    <div key={rec.id || idx} className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <Compass className="w-3.5 h-3.5 text-blue-600" /> Sea Service #{profile.seaService.length - idx}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeSeaService(rec.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Remove sea record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Vessel Name</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={rec.vesselName}
                            onChange={e => {
                              const copy = [...profile.seaService];
                              copy[idx] = { ...copy[idx], vesselName: e.target.value };
                              setProfile(prev => ({ ...prev, seaService: copy }));
                            }}
                            placeholder="MV Ocean Mariner"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Vessel Type</label>
                          <select
                            disabled={!canEdit}
                            value={rec.vesselType}
                            onChange={e => {
                              const copy = [...profile.seaService];
                              copy[idx] = { ...copy[idx], vesselType: e.target.value };
                              setProfile(prev => ({ ...prev, seaService: copy }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 bg-white"
                          >
                            <option value="Bulk Carrier">Bulk Carrier</option>
                            <option value="Container Vessel">Container Vessel</option>
                            <option value="Oil Tanker">Oil Tanker</option>
                            <option value="Chemical Tanker">Chemical Tanker</option>
                            <option value="LNG/LPG Carrier">LNG/LPG Carrier</option>
                            <option value="General Cargo">General Cargo</option>
                            <option value="Ro-Ro / Pure Car Carrier">Ro-Ro / Car Carrier</option>
                            <option value="Offshore / Tug">Offshore / Tug</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">DWT / GRT</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={rec.dwtGrt || ''}
                            onChange={e => {
                              const copy = [...profile.seaService];
                              copy[idx] = { ...copy[idx], dwtGrt: e.target.value };
                              setProfile(prev => ({ ...prev, seaService: copy }));
                            }}
                            placeholder="55,000 DWT"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Rank Served</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={rec.rank}
                            onChange={e => {
                              const copy = [...profile.seaService];
                              copy[idx] = { ...copy[idx], rank: e.target.value };
                              setProfile(prev => ({ ...prev, seaService: copy }));
                            }}
                            placeholder="Chief Officer"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Sign-On Date</label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={rec.signOnDate}
                            onChange={e => {
                              const copy = [...profile.seaService];
                              copy[idx] = { ...copy[idx], signOnDate: e.target.value };
                              setProfile(prev => ({ ...prev, seaService: copy }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Sign-Off Date</label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={rec.signOffDate}
                            onChange={e => {
                              const copy = [...profile.seaService];
                              copy[idx] = { ...copy[idx], signOffDate: e.target.value };
                              setProfile(prev => ({ ...prev, seaService: copy }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Duration (Months)</label>
                          <input
                            type="number"
                            min={1}
                            max={36}
                            disabled={!canEdit}
                            value={rec.durationMonths || 6}
                            onChange={e => {
                              const copy = [...profile.seaService];
                              copy[idx] = { ...copy[idx], durationMonths: Number(e.target.value) || 0 };
                              setProfile(prev => ({ ...prev, seaService: copy }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Manning / Owner</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={rec.companyManning || ''}
                            onChange={e => {
                              const copy = [...profile.seaService];
                              copy[idx] = { ...copy[idx], companyManning: e.target.value };
                              setProfile(prev => ({ ...prev, seaService: copy }));
                            }}
                            placeholder="Pacific Marine Agency"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TRAVEL DOCUMENTS */}
          {activeTab === 'travel_documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Travel Documents Records</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Record passports, seafarer identification record books, visas, and other travel documents.</p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addTravelDocument}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Travel Document
                  </button>
                )}
              </div>

              {(!profile.travelDocuments || profile.travelDocuments.length === 0) ? (
                <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No travel documents recorded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Click "Add Travel Document" to record passports, seaman books, etc.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.travelDocuments.map((doc) => (
                    <div key={doc.id} className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{doc.documentName || 'Unnamed Document'}</span>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeTravelDocument(doc.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Travel Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Document Name *</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={doc.documentName}
                            onChange={e => {
                              const val = e.target.value;
                              setProfile(prev => ({
                                ...prev,
                                travelDocuments: (prev.travelDocuments || []).map(d => d.id === doc.id ? { ...d, documentName: val } : d)
                              }));
                            }}
                            placeholder="e.g. Passport, Seaman's Book"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Document Number *</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={doc.documentNumber}
                            onChange={e => {
                              const val = e.target.value;
                              setProfile(prev => ({
                                ...prev,
                                travelDocuments: (prev.travelDocuments || []).map(d => d.id === doc.id ? { ...d, documentNumber: val } : d)
                              }));
                            }}
                            placeholder="e.g. P1234567A"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Issued Date</label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={doc.issuedDate}
                            onChange={e => {
                              const val = e.target.value;
                              setProfile(prev => ({
                                ...prev,
                                travelDocuments: (prev.travelDocuments || []).map(d => d.id === doc.id ? { ...d, issuedDate: val } : d)
                              }));
                            }}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Revalidated Date</label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={doc.revalidatedDate || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setProfile(prev => ({
                                ...prev,
                                travelDocuments: (prev.travelDocuments || []).map(d => d.id === doc.id ? { ...d, revalidatedDate: val } : d)
                              }));
                            }}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expiration Date *</label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={doc.expirationDate}
                            onChange={e => {
                              const val = e.target.value;
                              setProfile(prev => ({
                                ...prev,
                                travelDocuments: (prev.travelDocuments || []).map(d => d.id === doc.id ? { ...d, expirationDate: val } : d)
                              }));
                            }}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Place of Issue</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={doc.placeOfIssue}
                            onChange={e => {
                              const val = e.target.value;
                              setProfile(prev => ({
                                ...prev,
                                travelDocuments: (prev.travelDocuments || []).map(d => d.id === doc.id ? { ...d, placeOfIssue: val } : d)
                              }));
                            }}
                            placeholder="e.g. Manila, Philippines"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Issuing Authority</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={doc.issuingAuthority}
                            onChange={e => {
                              const val = e.target.value;
                              setProfile(prev => ({
                                ...prev,
                                travelDocuments: (prev.travelDocuments || []).map(d => d.id === doc.id ? { ...d, issuingAuthority: val } : d)
                              }));
                            }}
                            placeholder="e.g. DFA / MARINA"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        <div className="sm:col-span-2 md:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Remarks</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={doc.remarks || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setProfile(prev => ({
                                ...prev,
                                travelDocuments: (prev.travelDocuments || []).map(d => d.id === doc.id ? { ...d, remarks: val } : d)
                              }));
                            }}
                            placeholder="Additional notes..."
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NATIONAL LICENSES */}
          {activeTab === 'national_licenses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">National Licenses & Endorsements</h3>
                  <p className="text-[11px] text-slate-500">Record national licenses, certificates of competency, and endorsements.</p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addNationalLicense}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add National License
                  </button>
                )}
              </div>

              {(!profile.nationalLicenses || profile.nationalLicenses.length === 0) ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No national licenses recorded.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Click "Add National License" to record licenses, CoC, etc.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.nationalLicenses.map((lic, idx) => (
                    <div key={lic.id || idx} className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <Award className="w-3.5 h-3.5 text-blue-600" /> National License #{idx + 1}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeNationalLicense(lic.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Remove national license"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Document Name *</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={lic.documentName}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], documentName: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            placeholder="e.g. Certificate of Competency"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Rank *</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={lic.rank}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], rank: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            placeholder="e.g. Master / Chief Officer"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Document Number *</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={lic.documentNumber}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], documentNumber: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            placeholder="e.g. LIC-123456"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Issued Date</label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={lic.issuedDate}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], issuedDate: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Revalidation Date</label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={lic.revalidationDate || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], revalidationDate: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Expiration Date *</label>
                          <input
                            type="date"
                            disabled={!canEdit}
                            value={lic.expirationDate}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], expirationDate: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Place of Issue</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={lic.placeOfIssue}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], placeOfIssue: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            placeholder="e.g. Manila, Philippines"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Issuing Authority</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={lic.issuingAuthority}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], issuingAuthority: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            placeholder="e.g. MARINA / PRC"
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>

                        <div className="sm:col-span-2 md:col-span-3">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Remarks</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={lic.remarks || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const copy = [...(profile.nationalLicenses || [])];
                              copy[idx] = { ...copy[idx], remarks: val };
                              setProfile(prev => ({ ...prev, nationalLicenses: copy }));
                            }}
                            placeholder="Additional notes..."
                            className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6. FLAG REGISTRY LICENSES */}
          {activeTab === 'flag_registry_licenses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Flag Registry Licenses</h3>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addFlagRegistryLicense}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add License
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {(profile.flagRegistryLicenses || []).map((lic, idx) => (
                  <div key={lic.id || idx} className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <Flag className="w-3.5 h-3.5 text-blue-600" /> License #{idx + 1}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeFlagRegistryLicense(lic.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[
                        { label: 'Flag Registry', key: 'flagRegistry' },
                        { label: 'Flag Docs', key: 'flagDocs' },
                        { label: 'Rank', key: 'rank' },
                        { label: 'Number', key: 'documentNumber' },
                      ].map(field => (
                        <div key={field.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{field.label}</label>
                            <input type="text" disabled={!canEdit} value={(lic as any)[field.key] || ''} onChange={e => {
                                const copy = [...(profile.flagRegistryLicenses || [])];
                                copy[idx] = { ...copy[idx], [field.key]: e.target.value };
                                setProfile(prev => ({ ...prev, flagRegistryLicenses: copy }));
                            }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                        </div>
                      ))}
                      {[
                        { label: 'Applied', key: 'appliedDate', type: 'date' },
                        { label: 'Issue', key: 'issueDate', type: 'date' },
                        { label: 'Expiry', key: 'expiryDate', type: 'date' },
                      ].map(field => (
                        <div key={field.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{field.label}</label>
                            <input type={field.type} disabled={!canEdit} value={(lic as any)[field.key] || ''} onChange={e => {
                                const copy = [...(profile.flagRegistryLicenses || [])];
                                copy[idx] = { ...copy[idx], [field.key]: e.target.value };
                                setProfile(prev => ({ ...prev, flagRegistryLicenses: copy }));
                            }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                        </div>
                      ))}
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Remarks</label>
                        <input type="text" disabled={!canEdit} value={lic.remarks || ''} onChange={e => {
                            const copy = [...(profile.flagRegistryLicenses || [])];
                            copy[idx] = { ...copy[idx], remarks: e.target.value };
                            setProfile(prev => ({ ...prev, flagRegistryLicenses: copy }));
                        }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. VISA DETAILS */}
          {activeTab === 'visa_details' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Visa Details</h3>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addVisaDetail}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Visa
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {(profile.visaDetails || []).map((visa, idx) => (
                  <div key={visa.id || idx} className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Visa #{idx + 1}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeVisaDetail(visa.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[
                        { label: 'Status', key: 'status' },
                        { label: 'Country', key: 'country' },
                        { label: 'Type', key: 'type' },
                        { label: 'Number', key: 'number' },
                      ].map(field => (
                        <div key={field.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{field.label}</label>
                            <input type="text" disabled={!canEdit} value={(visa as any)[field.key] || ''} onChange={e => {
                                const copy = [...(profile.visaDetails || [])];
                                copy[idx] = { ...copy[idx], [field.key]: e.target.value };
                                setProfile(prev => ({ ...prev, visaDetails: copy }));
                            }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                        </div>
                      ))}
                      {[
                        { label: 'Appointment', key: 'appointmentDate', type: 'date' },
                        { label: 'Time', key: 'time', type: 'time' },
                        { label: 'Issue', key: 'issueDate', type: 'date' },
                        { label: 'Expiry', key: 'expiryDate', type: 'date' },
                      ].map(field => (
                        <div key={field.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{field.label}</label>
                            <input type={field.type} disabled={!canEdit} value={(visa as any)[field.key] || ''} onChange={e => {
                                const copy = [...(profile.visaDetails || [])];
                                copy[idx] = { ...copy[idx], [field.key]: e.target.value };
                                setProfile(prev => ({ ...prev, visaDetails: copy }));
                            }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                        </div>
                      ))}
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Remarks</label>
                        <input type="text" disabled={!canEdit} value={visa.remarks || ''} onChange={e => {
                            const copy = [...(profile.visaDetails || [])];
                            copy[idx] = { ...copy[idx], remarks: e.target.value };
                            setProfile(prev => ({ ...prev, visaDetails: copy }));
                        }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. TRAINING CERTIFICATES */}
          {activeTab === 'training_certificates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Training Certificates</h3>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addTrainingCertificate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Certificate
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {(profile.trainingCertificates || []).map((trc, idx) => (
                  <div key={trc.id || idx} className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Certificate #{idx + 1}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeTrainingCertificate(trc.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[
                        { label: 'Course (MARINA)', key: 'courseMarina' },
                        { label: 'Cert Number', key: 'certNumber' },
                        { label: 'Training Center', key: 'trainingCenter' },
                        { label: 'Place of Issue', key: 'placeOfIssue' },
                      ].map(field => (
                        <div key={field.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{field.label}</label>
                            <input type="text" disabled={!canEdit} value={(trc as any)[field.key] || ''} onChange={e => {
                                const copy = [...(profile.trainingCertificates || [])];
                                copy[idx] = { ...copy[idx], [field.key]: e.target.value };
                                setProfile(prev => ({ ...prev, trainingCertificates: copy }));
                            }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                        </div>
                      ))}
                      {[
                        { label: 'Issue', key: 'issueDate', type: 'date' },
                        { label: 'Revalidate', key: 'revalidateDate', type: 'date' },
                      ].map(field => (
                        <div key={field.key}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{field.label}</label>
                            <input type={field.type} disabled={!canEdit} value={(trc as any)[field.key] || ''} onChange={e => {
                                const copy = [...(profile.trainingCertificates || [])];
                                copy[idx] = { ...copy[idx], [field.key]: e.target.value };
                                setProfile(prev => ({ ...prev, trainingCertificates: copy }));
                            }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                        </div>
                      ))}
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Remarks</label>
                        <input type="text" disabled={!canEdit} value={trc.remarks || ''} onChange={e => {
                            const copy = [...(profile.trainingCertificates || [])];
                            copy[idx] = { ...copy[idx], remarks: e.target.value };
                            setProfile(prev => ({ ...prev, trainingCertificates: copy }));
                        }} className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* 7. MEDICAL CERTIFICATION */}
          {activeTab === 'medical' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pre-Employment Medical Exam (PEME)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Medical Fitness Status *</label>
                    <select
                      disabled={!canEdit}
                      value={profile.medicalCertification.pemeStatus}
                      onChange={e => updateSection('medicalCertification', { pemeStatus: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                    >
                      <option value="Fit for Sea Duty">Fit for Sea Duty</option>
                      <option value="Fit with Restrictions">Fit with Restrictions</option>
                      <option value="Unfit">Unfit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Examination Date</label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={profile.medicalCertification.examDate || ''}
                      onChange={e => updateSection('medicalCertification', { examDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Medical Certificate Expiry *</label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={profile.medicalCertification.expiryDate || ''}
                      onChange={e => updateSection('medicalCertification', { expiryDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Accredited Clinic / Hospital</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.medicalCertification.clinicName || ''}
                      onChange={e => updateSection('medicalCertification', { clinicName: e.target.value })}
                      placeholder="Supercare Medical Services"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Examining Physician / Doctor</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.medicalCertification.doctorName || ''}
                      onChange={e => updateSection('medicalCertification', { doctorName: e.target.value })}
                      placeholder="Dr. Ronald Cruz, MD"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Drug & Alcohol Screen Date</label>
                    <input
                      type="date"
                      disabled={!canEdit}
                      value={profile.medicalCertification.drugAlcoholDate || ''}
                      onChange={e => updateSection('medicalCertification', { drugAlcoholDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Drug & Alcohol Result</label>
                    <select
                      disabled={!canEdit}
                      value={profile.medicalCertification.drugAlcoholResult || 'Negative'}
                      onChange={e => updateSection('medicalCertification', { drugAlcoholResult: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                    >
                      <option value="Negative">Negative (Passed)</option>
                      <option value="Positive">Positive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Restrictions / Visual Aids</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.medicalCertification.restrictionsRemarks || ''}
                      onChange={e => updateSection('medicalCertification', { restrictionsRemarks: e.target.value })}
                      placeholder="e.g. Corrective lenses required"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Vaccinations Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Vaccinations & Inoculations</h3>
                    <p className="text-[11px] text-slate-500">Yellow Fever, COVID-19, Cholera, Tetanus, Typhoid.</p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={addVaccination}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Vaccine
                    </button>
                  )}
                </div>

                {(!profile.medicalCertification.vaccinations || profile.medicalCertification.vaccinations.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No vaccines recorded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {profile.medicalCertification.vaccinations.map((vac, vIdx) => (
                      <div key={vIdx} className="p-3 rounded-lg border border-slate-200 bg-white flex items-start justify-between gap-2 text-xs">
                        <div className="space-y-1 min-w-0 flex-1">
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={vac.name}
                            onChange={e => {
                              const copy = [...(profile.medicalCertification.vaccinations || [])];
                              copy[vIdx] = { ...copy[vIdx], name: e.target.value };
                              updateSection('medicalCertification', { vaccinations: copy });
                            }}
                            placeholder="Vaccine Name"
                            className="font-bold text-slate-800 w-full border-b border-transparent focus:border-blue-400 focus:outline-none"
                          />
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>Given:</span>
                            <input
                              type="date"
                              disabled={!canEdit}
                              value={vac.dateGiven}
                              onChange={e => {
                                const copy = [...(profile.medicalCertification.vaccinations || [])];
                                copy[vIdx] = { ...copy[vIdx], dateGiven: e.target.value };
                                updateSection('medicalCertification', { vaccinations: copy });
                              }}
                              className="border-b border-transparent focus:border-blue-400 focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>Batch:</span>
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={vac.batchNo || ''}
                              onChange={e => {
                                const copy = [...(profile.medicalCertification.vaccinations || [])];
                                copy[vIdx] = { ...copy[vIdx], batchNo: e.target.value };
                                updateSection('medicalCertification', { vaccinations: copy });
                              }}
                              placeholder="Batch #"
                              className="font-mono border-b border-transparent focus:border-blue-400 focus:outline-none"
                            />
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeVaccination(vIdx)}
                            className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Uploaded Documents & Scans</h3>
                  <p className="text-[11px] text-slate-500">Passports, Seaman's Books, STCW Certificates, Visas, Medical Reports (PDF, JPG, PNG).</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs">
                      <Upload className="w-3.5 h-3.5" /> Upload Document
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={e => handleDocUpload(e, 'General Document')}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {profile.documents.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No documents attached.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Upload scanned copies of seafarer credentials for compliance checks.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.documents.map((doc, idx) => (
                    <div key={doc.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between gap-3 text-xs transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-800 truncate" title={doc.documentName || doc.fileName}>
                            {doc.documentName || doc.fileName}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{doc.documentType}</span>
                            {doc.fileSize && <span>· {doc.fileSize}</span>}
                            {doc.uploadedAt && <span>· {doc.uploadedAt}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            download={doc.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Download document"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {crewItem?.id && doc.id.startsWith('cdoc_') && (
                          <a
                            href={`/api/crew-members/${crewItem.id}/documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeDoc(doc.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 9. EMERGENCY CONTACT */}
          {activeTab === 'emergency' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-2 mb-3">
                  <HeartHandshake className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Primary Next of Kin / Emergency Contact</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name *</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.emergencyContact.nextOfKinName}
                      onChange={e => updateSection('emergencyContact', { nextOfKinName: e.target.value })}
                      placeholder="e.g. Maria Dela Cruz"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Relationship *</label>
                    <select
                      disabled={!canEdit}
                      value={profile.emergencyContact.relationship || 'Spouse'}
                      onChange={e => updateSection('emergencyContact', { relationship: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 bg-white"
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Parent (Father / Mother)">Parent (Father / Mother)</option>
                      <option value="Sibling (Brother / Sister)">Sibling (Brother / Sister)</option>
                      <option value="Son / Daughter">Son / Daughter</option>
                      <option value="Legal Guardian">Legal Guardian</option>
                      <option value="Other Relative">Other Relative</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Primary Phone / Mobile *</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.emergencyContact.phonePrimary}
                      onChange={e => updateSection('emergencyContact', { phonePrimary: e.target.value })}
                      placeholder="+63 918 765 4321"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Secondary Phone</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.emergencyContact.phoneSecondary || ''}
                      onChange={e => updateSection('emergencyContact', { phoneSecondary: e.target.value })}
                      placeholder="+63 2 8999 1234"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Emergency Residential Address</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={profile.emergencyContact.address || ''}
                      onChange={e => updateSection('emergencyContact', { address: e.target.value })}
                      placeholder="Barangay San Antonio, Pasig City, Philippines"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 10. REMARKS & PERFORMANCE */}
          {activeTab === 'remarks' && currentUserRole !== 'vessel' && (
            <div className="space-y-6">
              {/* Not For Rehire Checkbox */}
              <div className={`p-4 rounded-xl border ${profile.remarksSection?.notForRehire ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200/80'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${profile.remarksSection?.notForRehire ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Not For Rehire Status</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">When checked, this crew member is flagged as Not For Rehire and highlighted red in Crew Search.</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={profile.remarksSection?.notForRehire || false}
                      onChange={e => handleToggleNotForRehire(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                    <span className="ml-3 text-xs font-bold text-slate-700">
                      {profile.remarksSection?.notForRehire ? 'NOT FOR REHIRE (ACTIVE)' : 'Eligible for Rehire'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Performance Remarks Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Shore & Management Performance Remarks</h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {profile.remarksSection?.comments?.length || 0} Comments
                  </span>
                </div>

                {currentUserRole === 'vessel' ? (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                    Note: Performance remarks and comments can be added and managed by shore-based non-vessel users.
                  </div>
                ) : canEdit ? (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Add Performance Remark / Comment</label>
                    <textarea
                      rows={3}
                      value={newCommentText}
                      onChange={e => setNewCommentText(e.target.value)}
                      placeholder="Type comment regarding crew's performance, conduct, or evaluation..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddComment}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        Add Remark
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Comments List */}
                <div className="space-y-3 pt-2">
                  {(!profile.remarksSection?.comments || profile.remarksSection.comments.length === 0) ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No performance remarks recorded yet.
                    </div>
                  ) : (
                    profile.remarksSection.comments.map(c => (
                      <div key={c.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-xs">{c.authorName}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase tracking-wider">{c.authorRole}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span>{c.date}</span>
                            {canEdit && currentUserRole !== 'vessel' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveComment(c.id)}
                                className="text-rose-500 hover:text-rose-700 p-1"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500">
              {profile.basicInfo.rank} · {assignedVesselObj ? assignedVesselObj.name : 'In Pool'}
            </div>
            {canDeleteProfile && (
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
                disabled={deletingProfile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                title="Delete this crew member profile (Managers and Admins only)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Profile
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Delete Crew Profile Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">Delete Crew Member Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
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
                Are you sure you want to delete the crew profile of{' '}
                <strong className="text-slate-900">
                  {profile.basicInfo.firstName} {profile.basicInfo.lastName || crewItem?.name}
                </strong>{' '}
                ({profile.basicInfo.rank || crewItem?.rank})?
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <p className="font-semibold">Notice for Managers & Admins:</p>
                <p>
                  This action removes this crew profile, travel documents, national licenses, training certificates, and service records from the active fleet.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingProfile}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProfile}
                disabled={deletingProfile}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingProfile ? 'Deleting...' : 'Confirm Delete Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
