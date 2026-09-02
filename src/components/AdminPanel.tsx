import React, { useState, useEffect, useCallback } from 'react';
import { 
  Ship, 
  FileText, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Flag, 
  Users, 
  HardDrive, 
  Mail, 
  ShieldCheck, 
  Key, 
  Server, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database, 
  Smartphone, 
  Shield, 
  Lock, 
  Send,
  Sliders,
  Activity,
  ChevronRight,
  UserCheck,
  Building2,
  ShieldAlert,
  Laptop,
  AlertTriangle,
  X
} from 'lucide-react';
import { format } from 'date-fns';

interface Vessel {
  id: number;
  name: string;
  imo?: string;
  flag?: string;
  built_year?: number;
  gross_tonnage?: number;
  deadweight?: number;
  team_id?: number;
  team_name?: string;
  has_photo?: boolean;
}

interface Team {
  id: number;
  name: string;
  description?: string;
}

interface Certificate {
  id: number;
  vessel_id?: number;
  team_id?: number;
  name: string;
  category?: string;
  certificate_number?: string;
  date_issued?: string;
  expiration_date: string;
  access_type?: 'office' | 'vessel' | 'any';
  vessel_name?: string;
  team_name?: string;
  file_name?: string;
}

interface UserAccount {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'vessel' | 'team_pic';
  team_ids: number[];
  vessel_id?: number | null;
  email?: string | null;
  device_id?: string | null;
  is_verified?: boolean;
  plain_password?: string | null;
}

interface VesselFlagItem {
  id: number;
  name: string;
}

interface StorageCategory {
  id: string;
  label: string;
  fileCount: number;
  totalBytes: number;
  formattedSize: string;
  b2Count: number;
}

interface StorageStatus {
  grandTotalFiles: number;
  grandTotalBytes: number;
  grandTotalB2Files: number;
  categories: StorageCategory[];
}

interface DeviceRequest {
  id: number;
  user_id: number;
  username: string;
  vessel_name?: string;
  device_code: string;
  device_id: string;
  label?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface RegisteredDeviceItem {
  id: number;
  username: string;
  device_id: string;
  is_verified: boolean;
  vessel_name: string | null;
}

interface AuditLogItem {
  id: number;
  user_id: number;
  username: string;
  action: string;
  details: string;
  created_at: string;
}

interface AdminPanelProps {
  token: string;
  user?: any;
  teams: Team[];
  vessels: Vessel[];
  certs: Certificate[];
  setCerts?: React.Dispatch<React.SetStateAction<Certificate[]>>;
  onRefresh: () => void;
  notify: (type: 'success' | 'error', message: string) => void;
  previewFile: File | null;
  setPreviewFile: (f: File | null) => void;
  tempPreviewUrl: string | null;
  setTempPreviewUrl: (u: string | null) => void;
  isRecognizing: boolean;
  setIsRecognizing: (r: boolean) => void;
  subView: string;
  editingVessel: Vessel | null;
  setEditingVessel: (v: Vessel | null) => void;
  editingVesselPhoto: File | null;
  setEditingVesselPhoto: (f: File | null) => void;
  handleUpdateVessel: () => void;
  handleDeleteVessel: (id: number) => void;
  editingCert: Certificate | null;
  setEditingCert: (c: Certificate | null) => void;
  newCertFile: File | null;
  setNewCertFile: (f: File | null) => void;
  handleUpdateCert: () => void;
  handleDeleteCert: (id: number) => void;
  confirmDialog: any;
  setConfirmDialog: (d: any) => void;
  uploadFileType: string;
  setUploadFileType: (t: string) => void;
  fetchCertDetails: (id: number) => void;
  setSelectedVessel: (v: Vessel | null) => void;
  onViewVesselDetails: (v: Vessel) => void;
  flags?: any[];
  setFlags?: React.Dispatch<React.SetStateAction<any[]>>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  token,
  user,
  teams,
  vessels,
  certs,
  onRefresh,
  notify,
  subView,
  editingVessel,
  setEditingVessel,
  handleUpdateVessel,
  handleDeleteVessel,
  editingCert,
  setEditingCert,
  handleUpdateCert,
  handleDeleteCert,
  onViewVesselDetails,
  flags = [],
  setFlags
}) => {
  // Active tab inside Admin Settings (when subView === 'admin')
  const [activeTab, setActiveTab] = useState<'users' | 'flags' | 'storage' | 'notifications' | 'devices' | 'logs'>('users');

  // ==========================================
  // 1. Users State & Management
  // ==========================================
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [showPlainPasswords, setShowPlainPasswords] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState<number | null>(null);

  // User Modal State (Create / Edit)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user' | 'vessel' | 'team_pic',
    vessel_id: '',
    team_ids: [] as number[],
    email: '',
    notify: false,
    is_verified: true
  });
  const [isSavingUser, setIsSavingUser] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    if (subView === 'admin' && activeTab === 'users') {
      fetchUsers();
    }
  }, [subView, activeTab, fetchUsers]);

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      password: Math.random().toString(36).slice(-8) + 'A1!',
      role: 'user',
      vessel_id: '',
      team_ids: teams[0] ? [teams[0].id] : [],
      email: '',
      notify: true,
      is_verified: true
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: UserAccount) => {
    setEditingUser(u);
    setUserFormData({
      username: u.username,
      password: '',
      role: u.role,
      vessel_id: u.vessel_id ? String(u.vessel_id) : '',
      team_ids: u.team_ids || [],
      email: u.email || '',
      notify: false,
      is_verified: u.is_verified ?? true
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.username.trim()) {
      notify('error', 'Username is required');
      return;
    }
    if (!editingUser && !userFormData.password.trim()) {
      notify('error', 'Password is required for new accounts');
      return;
    }

    setIsSavingUser(true);
    try {
      if (editingUser) {
        // Update user
        const payload: any = {
          username: userFormData.username.trim(),
          role: userFormData.role,
          vessel_id: userFormData.vessel_id ? Number(userFormData.vessel_id) : null,
          team_ids: userFormData.team_ids,
          email: userFormData.email.trim() || null,
          is_verified: userFormData.is_verified ? 1 : 0
        };
        if (userFormData.password.trim()) {
          payload.password = userFormData.password.trim();
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          notify('success', `User "${userFormData.username}" updated successfully`);
          setIsUserModalOpen(false);
          fetchUsers();
        } else {
          const err = await res.json();
          notify('error', err.error || 'Failed to update user');
        }
      } else {
        // Create user
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: userFormData.username.trim(),
            password: userFormData.password.trim(),
            role: userFormData.role,
            vessel_id: userFormData.vessel_id ? Number(userFormData.vessel_id) : null,
            team_ids: userFormData.team_ids,
            email: userFormData.email.trim() || null,
            notify: userFormData.notify
          })
        });

        if (res.ok) {
          notify('success', `User "${userFormData.username}" created successfully`);
          setIsUserModalOpen(false);
          fetchUsers();
        } else {
          const err = await res.json();
          notify('error', err.error || 'Failed to create user');
        }
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user account "${username}"?`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify('success', `User "${username}" deleted`);
        fetchUsers();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to delete user');
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    }
  };

  // ==========================================
  // 2. Flags State & Management
  // ==========================================
  const [flagList, setFlagList] = useState<VesselFlagItem[]>([]);
  const [newFlagName, setNewFlagName] = useState('');
  const [editingFlagId, setEditingFlagId] = useState<number | null>(null);
  const [editingFlagName, setEditingFlagName] = useState('');
  const [isSavingFlag, setIsSavingFlag] = useState(false);

  const fetchFlags = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/flags', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFlagList(data);
        if (setFlags) {
          setFlags(data);
        }
      }
    } catch (err: any) {
      console.error('Error fetching flags:', err);
    }
  }, [token, setFlags]);

  useEffect(() => {
    if (subView === 'admin' && activeTab === 'flags') {
      fetchFlags();
    }
  }, [subView, activeTab, fetchFlags]);

  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlagName.trim()) return;
    setIsSavingFlag(true);
    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newFlagName.trim() })
      });
      if (res.ok) {
        notify('success', `Flag state "${newFlagName}" added`);
        setNewFlagName('');
        fetchFlags();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to add flag');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsSavingFlag(false);
    }
  };

  const handleUpdateFlag = async (id: number) => {
    if (!editingFlagName.trim()) return;
    try {
      const res = await fetch(`/api/flags/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editingFlagName.trim() })
      });
      if (res.ok) {
        notify('success', 'Flag state updated');
        setEditingFlagId(null);
        fetchFlags();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to update flag');
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleDeleteFlag = async (id: number, name: string) => {
    if (!window.confirm(`Delete flag state "${name}"?`)) return;
    try {
      const res = await fetch(`/api/flags/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify('success', `Flag "${name}" removed`);
        fetchFlags();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to delete flag');
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // ==========================================
  // 3. System Settings (Email & Cloud Storage)
  // ==========================================
  const [settingsData, setSettingsData] = useState<Record<string, string>>({
    resend_api_key: '',
    SMTP_FROM: 'onboarding@resend.dev',
    ENABLE_EMAIL_ALERTS: 'true',
    ALERT_DAYS: '30,60,90',
    ALERT_SCHEDULE_TYPE: 'interval',
    ALERT_INTERVAL_HOURS: '24',
    ALERT_TIME: '08:00',
    VESSEL_ALERT_SCHEDULE_TYPE: 'interval',
    VESSEL_ALERT_INTERVAL_HOURS: '24',
    VESSEL_ALERT_TIME: '08:00',
    B2_APPLICATION_KEY_ID: '',
    B2_APPLICATION_KEY: '',
    B2_BUCKET_NAME: '',
    B2_ENDPOINT: ''
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isTestingB2, setIsTestingB2] = useState(false);

  // Storage breakdown status
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettingsData(prev => ({ ...prev, ...data }));
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  }, [token]);

  const fetchStorageStatus = useCallback(async () => {
    if (!token) return;
    setLoadingStorage(true);
    try {
      const res = await fetch('/api/admin/storage-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStorageStatus(data);
      }
    } catch (err: any) {
      console.error('Error fetching storage status:', err);
    } finally {
      setLoadingStorage(false);
    }
  }, [token]);

  useEffect(() => {
    if (subView === 'admin') {
      if (activeTab === 'storage' || activeTab === 'notifications') {
        fetchSettings();
      }
      if (activeTab === 'storage') {
        fetchStorageStatus();
      }
    }
  }, [subView, activeTab, fetchSettings, fetchStorageStatus]);

  const handleSaveSystemSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsData)
      });
      if (res.ok) {
        notify('success', 'System settings saved successfully');
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to save settings');
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingSmtp(true);
    try {
      const res = await fetch('/api/admin/test-smtp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resend_api_key: settingsData.resend_api_key,
          from: settingsData.SMTP_FROM
        })
      });
      if (res.ok) {
        notify('success', 'Test email dispatched successfully! Check your inbox.');
      } else {
        const err = await res.json();
        notify('error', err.error || 'Test email failed');
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleTestB2 = async () => {
    if (!settingsData.B2_APPLICATION_KEY_ID || !settingsData.B2_APPLICATION_KEY || !settingsData.B2_BUCKET_NAME || !settingsData.B2_ENDPOINT) {
      notify('error', 'Please fill in all Backblaze B2 credentials before testing');
      return;
    }
    setIsTestingB2(true);
    try {
      const res = await fetch('/api/admin/test-b2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          B2_APPLICATION_KEY_ID: settingsData.B2_APPLICATION_KEY_ID,
          B2_APPLICATION_KEY: settingsData.B2_APPLICATION_KEY,
          B2_BUCKET_NAME: settingsData.B2_BUCKET_NAME,
          B2_ENDPOINT: settingsData.B2_ENDPOINT
        })
      });
      if (res.ok) {
        notify('success', 'Backblaze B2 connection test passed with write & delete verification!');
      } else {
        const err = await res.json();
        notify('error', err.error || 'B2 connection test failed');
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    } finally {
      setIsTestingB2(false);
    }
  };

  // ==========================================
  // 4. Device Management
  // ==========================================
  const [deviceRequests, setDeviceRequests] = useState<DeviceRequest[]>([]);
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [editingDeviceLabelId, setEditingDeviceLabelId] = useState<string | null>(null);
  const [deviceLabelInput, setDeviceLabelInput] = useState('');

  // Device Revoke Modal state
  const [deviceRevokeModal, setDeviceRevokeModal] = useState<{
    userId: number;
    vesselName: string;
    deviceId?: string;
    deviceLabel?: string;
    devices?: Array<{ id: string; label?: string }>;
  } | null>(null);
  const [isRevokingDevice, setIsRevokingDevice] = useState(false);

  const fetchDevices = useCallback(async () => {
    if (!token) return;
    setLoadingDevices(true);
    try {
      const [reqsRes, regRes] = await Promise.all([
        fetch('/api/admin/device-requests', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/registered-devices', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (reqsRes.ok) {
        setDeviceRequests(await reqsRes.json());
      }
      if (regRes.ok) {
        setRegisteredDevices(await regRes.json());
      }
    } catch (err: any) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  }, [token]);

  useEffect(() => {
    if (subView === 'admin' && activeTab === 'devices') {
      fetchDevices();
    }
  }, [subView, activeTab, fetchDevices]);

  const handleVerifyDevice = async (requestId: number, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/admin/verify-device', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ request_id: requestId, status })
      });
      if (res.ok) {
        notify('success', `Device request ${status}`);
        fetchDevices();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to update device status');
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const handleOpenRevokeDeviceModal = (
    userItem: RegisteredDeviceItem,
    deviceId?: string,
    deviceLabel?: string,
    devicesList?: Array<{ id: string; label?: string }>
  ) => {
    setDeviceRevokeModal({
      userId: userItem.id,
      vesselName: userItem.vessel_name || userItem.username || `User #${userItem.id}`,
      deviceId,
      deviceLabel,
      devices: devicesList
    });
  };

  const handleConfirmRevokeDevice = async () => {
    if (!deviceRevokeModal) return;
    setIsRevokingDevice(true);
    try {
      const res = await fetch('/api/admin/remove-device', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id: deviceRevokeModal.userId, 
          device_id: deviceRevokeModal.deviceId 
        })
      });
      if (res.ok) {
        const data = await res.json();
        notify('success', data.message || 'Device authorization revoked');
        setDeviceRevokeModal(null);
        fetchDevices();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to revoke device authorization');
      }
    } catch (err: any) {
      notify('error', err.message || 'Failed to revoke device authorization');
    } finally {
      setIsRevokingDevice(false);
    }
  };

  const handleUpdateDeviceLabel = async (userId: number, deviceId: string) => {
    if (!deviceLabelInput.trim()) return;
    try {
      const res = await fetch('/api/admin/update-device-label', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId, device_id: deviceId, label: deviceLabelInput.trim() })
      });
      if (res.ok) {
        notify('success', 'Device label updated');
        setEditingDeviceLabelId(null);
        setDeviceLabelInput('');
        fetchDevices();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to update label');
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // ==========================================
  // 5. Audit Logs
  // ==========================================
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearch, setLogSearch] = useState('');

  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [token]);

  useEffect(() => {
    if (subView === 'admin' && activeTab === 'logs') {
      fetchAuditLogs();
    }
  }, [subView, activeTab, fetchAuditLogs]);

  // ==========================================
  // Vessel & Cert Creation Form States
  // ==========================================
  const flagOptions = flags.map(f => typeof f === 'string' ? f : f.name);
  const [newVessel, setNewVessel] = useState({
    name: '',
    imo: '',
    flag: flagOptions[0] || 'Panama',
    built_year: new Date().getFullYear(),
    gross_tonnage: '',
    deadweight: '',
    team_id: teams[0]?.id ? String(teams[0].id) : ''
  });
  const [newVesselPhoto, setNewVesselPhoto] = useState<File | null>(null);
  const [isSubmittingVessel, setIsSubmittingVessel] = useState(false);

  const [newCert, setNewCert] = useState({
    name: '',
    category: 'Class & Statutory',
    certificate_number: '',
    date_issued: '',
    expiration_date: '',
    vessel_id: vessels[0]?.id ? String(vessels[0].id) : '',
    team_id: '',
    access_type: 'any'
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [isSubmittingCert, setIsSubmittingCert] = useState(false);

  const [vesselSearch, setVesselSearch] = useState('');
  const [certSearch, setCertSearch] = useState('');

  const handleCreateVessel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingVessel(true);
    try {
      const res = await fetch('/api/vessels', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newVessel,
          team_id: newVessel.team_id ? Number(newVessel.team_id) : null,
          gross_tonnage: newVessel.gross_tonnage ? Number(newVessel.gross_tonnage) : null,
          deadweight: newVessel.deadweight ? Number(newVessel.deadweight) : null
        })
      });

      if (res.ok) {
        const created = await res.json();
        if (newVesselPhoto && created.id) {
          const photoData = new FormData();
          photoData.append('photo', newVesselPhoto);
          await fetch(`/api/vessels/${created.id}/photo`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: photoData
          });
        }
        notify('success', 'Vessel created successfully');
        setNewVessel({
          name: '',
          imo: '',
          flag: flagOptions[0] || 'Panama',
          built_year: new Date().getFullYear(),
          gross_tonnage: '',
          deadweight: '',
          team_id: teams[0]?.id ? String(teams[0].id) : ''
        });
        setNewVesselPhoto(null);
        onRefresh();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to create vessel');
      }
    } catch (e: any) {
      notify('error', e.message || 'Network error');
    } finally {
      setIsSubmittingVessel(false);
    }
  };

  const handleCreateCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCert.expiration_date) {
      notify('error', 'Expiration date is required');
      return;
    }
    setIsSubmittingCert(true);
    try {
      const formData = new FormData();
      Object.entries(newCert).forEach(([k, v]) => {
        if (v) formData.append(k, String(v));
      });
      if (certFile) {
        formData.append('file', certFile);
      }

      const res = await fetch('/api/certificates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        notify('success', 'Certificate added successfully');
        setNewCert({
          name: '',
          category: 'Class & Statutory',
          certificate_number: '',
          date_issued: '',
          expiration_date: '',
          vessel_id: vessels[0]?.id ? String(vessels[0].id) : '',
          team_id: '',
          access_type: 'any'
        });
        setCertFile(null);
        onRefresh();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to add certificate');
      }
    } catch (e: any) {
      notify('error', e.message || 'Network error');
    } finally {
      setIsSubmittingCert(false);
    }
  };

  const filteredVessels = vessels.filter(v => 
    v.name.toLowerCase().includes(vesselSearch.toLowerCase()) ||
    (v.imo || '').toLowerCase().includes(vesselSearch.toLowerCase())
  );

  const filteredCerts = certs.filter(c => 
    c.name.toLowerCase().includes(certSearch.toLowerCase()) ||
    (c.certificate_number || '').toLowerCase().includes(certSearch.toLowerCase()) ||
    (c.vessel_name || '').toLowerCase().includes(certSearch.toLowerCase())
  );

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = 
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredLogs = auditLogs.filter(l => 
    l.username.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
    (l.details || '').toLowerCase().includes(logSearch.toLowerCase())
  );

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6" id="admin-panel">
      {/* ==========================================
          SUBVIEW 1: Add New Vessel
         ========================================== */}
      {subView === 'admin_new_vessel' && (
        <form onSubmit={handleCreateVessel} className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add New Fleet Vessel</h2>
              <p className="text-xs text-slate-500">Register a vessel into fleet monitoring and certificate tracking.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Vessel Name *</label>
              <input
                type="text"
                required
                value={newVessel.name}
                onChange={e => setNewVessel({ ...newVessel, name: e.target.value })}
                placeholder="e.g. CD HUELVA"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">IMO Number</label>
              <input
                type="text"
                value={newVessel.imo}
                onChange={e => setNewVessel({ ...newVessel, imo: e.target.value })}
                placeholder="e.g. 9482930"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Flag State</label>
              <select
                value={newVessel.flag}
                onChange={e => setNewVessel({ ...newVessel, flag: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              >
                {(flagOptions.length > 0 ? flagOptions : ['Panama', 'Marshall Islands', 'Liberia', 'Singapore', 'Malta', 'Cyprus']).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Assigned Technical Team</label>
              <select
                value={newVessel.team_id}
                onChange={e => setNewVessel({ ...newVessel, team_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              >
                <option value="">Unassigned</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Built Year</label>
              <input
                type="number"
                value={newVessel.built_year}
                onChange={e => setNewVessel({ ...newVessel, built_year: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Gross Tonnage (GT)</label>
              <input
                type="number"
                value={newVessel.gross_tonnage}
                onChange={e => setNewVessel({ ...newVessel, gross_tonnage: e.target.value })}
                placeholder="e.g. 21000"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Vessel Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setNewVesselPhoto(e.target.files ? e.target.files[0] : null)}
              className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmittingVessel}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingVessel ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Save & Register Vessel</span>
            </button>
          </div>
        </form>
      )}

      {/* ==========================================
          SUBVIEW 2: Vessel List
         ========================================== */}
      {subView === 'admin_vessel_list' && (
        <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Fleet Vessel Management</h2>
              <p className="text-xs text-slate-500">Edit vessel specifications, flags, and technical assignments.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vesselSearch}
                onChange={e => setVesselSearch(e.target.value)}
                placeholder="Search vessels..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                  <th className="py-3 px-4">Vessel Name</th>
                  <th className="py-3 px-4">IMO</th>
                  <th className="py-3 px-4">Flag</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVessels.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-blue-700">
                      <button
                        type="button"
                        onClick={() => onViewVesselDetails(v)}
                        className="hover:underline text-left cursor-pointer"
                      >
                        {v.name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{v.imo || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{v.flag || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{v.team_name || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-slate-600">{v.built_year || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingVessel(v)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVessel(v.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          SUBVIEW 3: Add Certificate
         ========================================== */}
      {subView === 'admin_add_cert' && (
        <form onSubmit={handleCreateCert} className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Upload / Add Certificate</h2>
              <p className="text-xs text-slate-500">Attach vessel statutory and trading certificates for validity tracking.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Vessel *</label>
              <select
                value={newCert.vessel_id}
                onChange={e => setNewCert({ ...newCert, vessel_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              >
                <option value="">Fleet-wide / Office</option>
                {vessels.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Certificate Name *</label>
              <input
                type="text"
                required
                value={newCert.name}
                onChange={e => setNewCert({ ...newCert, name: e.target.value })}
                placeholder="e.g. Safety Management Certificate (SMC)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Certificate Number</label>
              <input
                type="text"
                value={newCert.certificate_number}
                onChange={e => setNewCert({ ...newCert, certificate_number: e.target.value })}
                placeholder="e.g. SMC-2026-004"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Category</label>
              <select
                value={newCert.category}
                onChange={e => setNewCert({ ...newCert, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              >
                <option value="Class & Statutory">Class & Statutory</option>
                <option value="Trading & Port">Trading & Port</option>
                <option value="Safety & Security">Safety & Security</option>
                <option value="Environmental">Environmental</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Date Issued</label>
              <input
                type="date"
                value={newCert.date_issued}
                onChange={e => setNewCert({ ...newCert, date_issued: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Expiration Date *</label>
              <input
                type="date"
                required
                value={newCert.expiration_date}
                onChange={e => setNewCert({ ...newCert, expiration_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Certificate Document (PDF / Scanned File)</label>
            <input
              type="file"
              onChange={e => setCertFile(e.target.files ? e.target.files[0] : null)}
              className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmittingCert}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingCert ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Save Certificate</span>
            </button>
          </div>
        </form>
      )}

      {/* ==========================================
          SUBVIEW 4: Certificate List
         ========================================== */}
      {subView === 'admin_cert_list' && (
        <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Certificate Repository</h2>
              <p className="text-xs text-slate-500">Overview of all active certificates across the entire fleet.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={certSearch}
                onChange={e => setCertSearch(e.target.value)}
                placeholder="Search certificates..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                  <th className="py-3 px-4">Certificate Name</th>
                  <th className="py-3 px-4">Vessel</th>
                  <th className="py-3 px-4">Cert #</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCerts.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{c.name}</td>
                    <td className="py-3 px-4 text-blue-700 font-semibold">{c.vessel_name || 'Fleet'}</td>
                    <td className="py-3 px-4 text-slate-600">{c.certificate_number || '-'}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {c.expiration_date ? format(new Date(c.expiration_date), 'yyyy-MM-dd') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingCert(c)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCert(c.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          SUBVIEW 5: ADMIN SETTINGS HUB (Default / 'admin')
         ========================================== */}
      {(subView === 'admin' || !['admin_new_vessel', 'admin_vessel_list', 'admin_add_cert', 'admin_cert_list'].includes(subView)) && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 rounded-2xl text-white shadow-sm border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-400/20">
                  <Sliders className="w-5 h-5" />
                </div>
                <h1 className="text-lg font-bold tracking-tight">System & Administration Settings</h1>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl">
                Configure user credentials, fleet maritime flag state registries, Backblaze B2 cloud storage, automated alert schedules, device authorizations, and audit trails.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'users') fetchUsers();
                  if (activeTab === 'flags') fetchFlags();
                  if (activeTab === 'storage') { fetchSettings(); fetchStorageStatus(); }
                  if (activeTab === 'notifications') fetchSettings();
                  if (activeTab === 'devices') fetchDevices();
                  if (activeTab === 'logs') fetchAuditLogs();
                  notify('success', 'Admin data refreshed');
                }}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border border-white/10"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Accounts ({usersList.length || '•'})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('flags')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'flags'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Flag States ({flagList.length || flagOptions.length || '•'})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('storage')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'storage'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Cloud & B2 Storage</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'notifications'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email & Alert Schedules</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('devices')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'devices'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Device Security {deviceRequests.length > 0 && <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-extrabold">{deviceRequests.length}</span>}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit Logs</span>
            </button>
          </div>

          {/* TAB 1: USERS MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    Fleet & Office User Accounts
                  </h3>
                  <p className="text-xs text-slate-500">Manage user accounts, roles, access permissions, and vessel assignments.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPlainPasswords(!showPlainPasswords)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {showPlainPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPlainPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenCreateUser}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User Account</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search by username, email..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role:</span>
                  <select
                    value={userRoleFilter}
                    onChange={e => setUserRoleFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Administrators</option>
                    <option value="team_pic">Team PIC / Managers</option>
                    <option value="user">Technical PICs / Users</option>
                    <option value="vessel">Vessel Accounts</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                {loadingUsers ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">Loading user database...</span>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Assigned Entity</th>
                        <th className="py-3 px-4">Password</th>
                        <th className="py-3 px-4">Device Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredUsers.map(u => {
                        const assignedVessel = vessels.find(v => v.id === u.vessel_id);
                        const assignedTeamNames = (u.team_ids || [])
                          .map(tid => teams.find(t => t.id === tid)?.name)
                          .filter(Boolean)
                          .join(', ');

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  u.role === 'admin' ? 'bg-rose-100 text-rose-700' :
                                  u.role === 'team_pic' ? 'bg-amber-100 text-amber-800' :
                                  u.role === 'vessel' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {u.username[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{u.username}</p>
                                  {u.email && <p className="text-[11px] text-slate-400">{u.email}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                u.role === 'admin' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                u.role === 'team_pic' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                u.role === 'vessel' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {u.role === 'team_pic' ? 'Team PIC' : u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {u.role === 'vessel' ? (
                                <span className="font-semibold text-blue-700 flex items-center gap-1">
                                  <Ship className="w-3 h-3 text-blue-500" />
                                  {assignedVessel?.name || 'Unassigned Vessel'}
                                </span>
                              ) : assignedTeamNames ? (
                                <span className="font-medium text-slate-700">{assignedTeamNames}</span>
                              ) : (
                                <span className="text-slate-400 italic">All Fleet / Global</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {showPlainPasswords && u.plain_password ? (
                                <div className="flex items-center gap-1.5 font-mono text-[11px] bg-slate-100 px-2 py-1 rounded-md text-slate-700 max-w-fit">
                                  <span>{u.plain_password}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(u.plain_password || '');
                                      setCopiedUserId(u.id);
                                      setTimeout(() => setCopiedUserId(null), 2000);
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                                    title="Copy Password"
                                  >
                                    {copiedUserId === u.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono tracking-widest text-[11px]">••••••••</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {u.role === 'vessel' ? (
                                u.is_verified ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                                    <CheckCircle2 className="w-3 h-3" /> Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold">
                                    <Clock className="w-3 h-3" /> Unverified
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit User"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FLAG STATES */}
          {activeTab === 'flags' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-blue-600" />
                    Maritime Flag Administration Registries
                  </h3>
                  <p className="text-xs text-slate-500">Add or manage maritime flags available for fleet vessel assignment.</p>
                </div>
              </div>

              {/* Add Flag Form */}
              <form onSubmit={handleCreateFlag} className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  required
                  value={newFlagName}
                  onChange={e => setNewFlagName(e.target.value)}
                  placeholder="e.g. Marshall Islands, Panama..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={isSavingFlag || !newFlagName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Flag</span>
                </button>
              </form>

              {/* Flags Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {flagList.map(f => (
                  <div key={f.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2">
                    {editingFlagId === f.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingFlagName}
                          onChange={e => setEditingFlagName(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-blue-400 rounded-lg text-xs font-bold text-slate-900 outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateFlag(f.id)}
                          className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFlagId(null)}
                          className="p-1 bg-slate-300 text-slate-700 rounded-md hover:bg-slate-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-slate-800">{f.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFlagId(f.id);
                              setEditingFlagName(f.name);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                            title="Edit Flag"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFlag(f.id, f.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                            title="Delete Flag"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: STORAGE & B2 */}
          {activeTab === 'storage' && (
            <div className="space-y-6">
              {/* Storage Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tracked Files</span>
                    <Database className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {storageStatus?.grandTotalFiles?.toLocaleString() || '0'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Across all fleet certificates and SMS submissions</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Storage Consumed</span>
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {storageStatus ? formatBytes(storageStatus.grandTotalBytes) : '0 B'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Document binaries & cloud objects</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Backblaze B2 Migrated</span>
                    <Server className="w-4 h-4 text-purple-600" />
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {storageStatus?.grandTotalB2Files?.toLocaleString() || '0'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Offloaded to S3-compatible cloud storage</p>
                </div>
              </div>

              {/* B2 Configuration Form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Server className="w-4 h-4 text-purple-600" />
                    Backblaze B2 Cloud Object Storage Configuration
                  </h3>
                  <p className="text-xs text-slate-500">Configure remote cloud storage credentials to offload fleet files and reduce database size.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Application Key ID *</label>
                    <input
                      type="text"
                      value={settingsData.B2_APPLICATION_KEY_ID || ''}
                      onChange={e => setSettingsData({ ...settingsData, B2_APPLICATION_KEY_ID: e.target.value })}
                      placeholder="e.g. 00548a39df789a..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Application Key (Secret) *</label>
                    <input
                      type="password"
                      value={settingsData.B2_APPLICATION_KEY || ''}
                      onChange={e => setSettingsData({ ...settingsData, B2_APPLICATION_KEY: e.target.value })}
                      placeholder="e.g. K005..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Bucket Name *</label>
                    <input
                      type="text"
                      value={settingsData.B2_BUCKET_NAME || ''}
                      onChange={e => setSettingsData({ ...settingsData, B2_BUCKET_NAME: e.target.value })}
                      placeholder="e.g. comos-fleet-storage"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Endpoint URL / Region *</label>
                    <input
                      type="text"
                      value={settingsData.B2_ENDPOINT || ''}
                      onChange={e => setSettingsData({ ...settingsData, B2_ENDPOINT: e.target.value })}
                      placeholder="e.g. s3.us-east-005.backblazeb2.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleTestB2}
                    disabled={isTestingB2}
                    className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isTestingB2 ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                    <span>Test B2 Cloud Connection</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSystemSettings}
                    disabled={isSavingSettings}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    {isSavingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save B2 Storage Settings</span>
                  </button>
                </div>
              </div>

              {/* Categories breakdown table */}
              {storageStatus && storageStatus.categories && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Module Storage Distribution</h4>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                          <th className="py-2.5 px-4">Category / Module</th>
                          <th className="py-2.5 px-4">Files</th>
                          <th className="py-2.5 px-4">Total Size</th>
                          <th className="py-2.5 px-4">B2 Cloud Objects</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {storageStatus.categories.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-bold text-slate-800">{c.label}</td>
                            <td className="py-2.5 px-4 text-slate-600">{c.fileCount}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-700">{c.formattedSize}</td>
                            <td className="py-2.5 px-4 text-purple-700 font-medium">{c.b2Count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EMAIL & ALERT SCHEDULES */}
          {activeTab === 'notifications' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  Email Service & Expiration Alert Dispatcher
                </h3>
                <p className="text-xs text-slate-500">Configure Resend API credentials, sender identities, and automated notification schedules for expiring certificates.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Resend API Key</label>
                  <input
                    type="password"
                    value={settingsData.resend_api_key || ''}
                    onChange={e => setSettingsData({ ...settingsData, resend_api_key: e.target.value })}
                    placeholder="re_xxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave empty to use RESEND_API_KEY from environment secrets</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Sender Email ("From" header)</label>
                  <input
                    type="email"
                    value={settingsData.SMTP_FROM || ''}
                    onChange={e => setSettingsData({ ...settingsData, SMTP_FROM: e.target.value })}
                    placeholder="e.g. notifications@cleanocean.com.ph"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Alert Milestones (Days before expiry)</label>
                  <input
                    type="text"
                    value={settingsData.ALERT_DAYS || ''}
                    onChange={e => setSettingsData({ ...settingsData, ALERT_DAYS: e.target.value })}
                    placeholder="e.g. 30, 60, 90, 180"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Enable Automated Dispatch</label>
                  <select
                    value={settingsData.ENABLE_EMAIL_ALERTS || 'true'}
                    onChange={e => setSettingsData({ ...settingsData, ENABLE_EMAIL_ALERTS: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  >
                    <option value="true">Enabled (Send automated expiration alerts)</option>
                    <option value="false">Disabled (Pause automated alerts)</option>
                  </select>
                </div>
              </div>

              {/* Schedules Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Office Alerts Schedule
                  </h4>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Schedule Mode</label>
                    <select
                      value={settingsData.ALERT_SCHEDULE_TYPE || 'interval'}
                      onChange={e => setSettingsData({ ...settingsData, ALERT_SCHEDULE_TYPE: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                    >
                      <option value="interval">Interval Based (Every X hours)</option>
                      <option value="time">Daily Time of Day (e.g. 08:00)</option>
                    </select>
                  </div>
                  {settingsData.ALERT_SCHEDULE_TYPE === 'time' ? (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Dispatch Time (24h format)</label>
                      <input
                        type="text"
                        value={settingsData.ALERT_TIME || '08:00'}
                        onChange={e => setSettingsData({ ...settingsData, ALERT_TIME: e.target.value })}
                        placeholder="08:00"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Interval (Hours)</label>
                      <input
                        type="number"
                        value={settingsData.ALERT_INTERVAL_HOURS || '24'}
                        onChange={e => setSettingsData({ ...settingsData, ALERT_INTERVAL_HOURS: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5 text-blue-600" />
                    Vessel Alerts Schedule
                  </h4>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Schedule Mode</label>
                    <select
                      value={settingsData.VESSEL_ALERT_SCHEDULE_TYPE || 'interval'}
                      onChange={e => setSettingsData({ ...settingsData, VESSEL_ALERT_SCHEDULE_TYPE: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                    >
                      <option value="interval">Interval Based (Every X hours)</option>
                      <option value="time">Daily Time of Day (e.g. 08:00)</option>
                    </select>
                  </div>
                  {settingsData.VESSEL_ALERT_SCHEDULE_TYPE === 'time' ? (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Dispatch Time (24h format)</label>
                      <input
                        type="text"
                        value={settingsData.VESSEL_ALERT_TIME || '08:00'}
                        onChange={e => setSettingsData({ ...settingsData, VESSEL_ALERT_TIME: e.target.value })}
                        placeholder="08:00"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Interval (Hours)</label>
                      <input
                        type="number"
                        value={settingsData.VESSEL_ALERT_INTERVAL_HOURS || '24'}
                        onChange={e => setSettingsData({ ...settingsData, VESSEL_ALERT_INTERVAL_HOURS: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={isTestingSmtp}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isTestingSmtp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Test Email</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveSystemSettings}
                  disabled={isSavingSettings}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  {isSavingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Email & Alert Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: DEVICE SECURITY */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              {/* Header with quick refresh & count */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Device Security & Hardware Binding
                  </h2>
                  <p className="text-xs text-slate-500">Manage vessel bridge terminal bindings, review connection requests, and control remote machine access.</p>
                </div>
                <button
                  type="button"
                  onClick={fetchDevices}
                  disabled={loadingDevices}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDevices ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Pending Requests */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      Pending Vessel Device Authorization Requests
                    </h3>
                    <p className="text-xs text-slate-500">Approve or reject remote vessel bridge computers requesting device binding.</p>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-extrabold">
                    {deviceRequests?.length || 0} Pending
                  </span>
                </div>

                {(!deviceRequests || deviceRequests.length === 0) ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No pending vessel device authorization requests.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                          <th className="py-2.5 px-4">Vessel / User</th>
                          <th className="py-2.5 px-4">Device Code</th>
                          <th className="py-2.5 px-4">Device ID</th>
                          <th className="py-2.5 px-4">Requested At</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deviceRequests.map(r => {
                          let formattedDate = '-';
                          if (r.created_at) {
                            try {
                              const d = new Date(r.created_at);
                              if (!isNaN(d.getTime())) {
                                formattedDate = format(d, 'yyyy-MM-dd HH:mm');
                              }
                            } catch (e) {
                              formattedDate = String(r.created_at);
                            }
                          }

                          return (
                            <tr key={r.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-bold text-blue-700">{r.vessel_name || r.username || 'Unknown Vessel'}</td>
                              <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{r.device_code || '-'}</td>
                              <td className="py-2.5 px-4 font-mono text-slate-500">{r.device_id ? `${String(r.device_id).slice(0, 16)}...` : '-'}</td>
                              <td className="py-2.5 px-4 text-slate-600">{formattedDate}</td>
                              <td className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyDevice(r.id, 'approved')}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyDevice(r.id, 'rejected')}
                                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Reject
                                  </button>
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

              {/* Registered Devices */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      Authorized Registered Fleet Devices
                    </h3>
                    <p className="text-xs text-slate-500">Active hardware and bridge workstations bound to vessel accounts.</p>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-extrabold">
                    {registeredDevices?.length || 0} Registered
                  </span>
                </div>

                {(!registeredDevices || registeredDevices.length === 0) ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No authorized fleet devices currently registered.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                          <th className="py-2.5 px-4">Vessel / User</th>
                          <th className="py-2.5 px-4">Device Details & Label</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4 text-right">Revoke / Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {registeredDevices.map(d => {
                          let parsedDevices: Array<{ id: string; label?: string }> = [];
                          try {
                            if (Array.isArray(d.device_id)) {
                              parsedDevices = d.device_id.map((item: any) => typeof item === 'object' && item !== null ? item : { id: String(item), label: 'Device' });
                            } else if (typeof d.device_id === 'string' && d.device_id.trim().startsWith('[')) {
                              const parsed = JSON.parse(d.device_id);
                              if (Array.isArray(parsed)) {
                                parsedDevices = parsed.map((item: any) => typeof item === 'object' && item !== null ? item : { id: String(item), label: 'Device' });
                              } else {
                                parsedDevices = [{ id: d.device_id, label: 'Default Device' }];
                              }
                            } else if (d.device_id) {
                              parsedDevices = [{ id: String(d.device_id), label: 'Default Device' }];
                            } else {
                              parsedDevices = [{ id: `dev-${d.id}`, label: 'Authorized Device' }];
                            }
                          } catch (e) {
                            parsedDevices = [{ id: String(d.device_id || `dev-${d.id}`), label: 'Device' }];
                          }

                          return (
                            <tr key={d.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-bold text-slate-900">{d.vessel_name || d.username || `User #${d.id}`}</td>
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  {parsedDevices.map((p, pIdx) => {
                                    const safeId = p.id || `dev-${pIdx}`;
                                    const safeLabel = p.label || 'Vessel Workstation';
                                    const isEditing = editingDeviceLabelId === safeId;

                                    return (
                                      <div key={safeId} className="flex items-center gap-2">
                                        {isEditing ? (
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="text"
                                              value={deviceLabelInput}
                                              onChange={e => setDeviceLabelInput(e.target.value)}
                                              className="px-2 py-0.5 bg-white border border-blue-400 rounded text-xs font-semibold outline-none"
                                              placeholder="e.g. Master PC"
                                              autoFocus
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateDeviceLabel(d.id, safeId)}
                                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs cursor-pointer"
                                              title="Save label"
                                            >
                                              <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingDeviceLabelId(null)}
                                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs cursor-pointer"
                                              title="Cancel"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-800">{safeLabel}</span>
                                            <span className="font-mono text-[10px] text-slate-400">
                                              ({safeId.length > 12 ? `${safeId.slice(0, 12)}...` : safeId})
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingDeviceLabelId(safeId);
                                                setDeviceLabelInput(safeLabel);
                                              }}
                                              className="p-0.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                                              title="Rename device label"
                                            >
                                              <Edit className="w-3 h-3" />
                                            </button>
                                            {parsedDevices.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => handleOpenRevokeDeviceModal(d, safeId, safeLabel, parsedDevices)}
                                                className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                                                title={`Revoke authorization for ${safeLabel} only`}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                                  <ShieldCheck className="w-3 h-3" /> Bound & Active
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRevokeDeviceModal(d, undefined, undefined, parsedDevices)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Revoke Access
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    System Administrative Audit Logs
                  </h3>
                  <p className="text-xs text-slate-500">Live immutable record of administrative actions, user changes, and settings modifications.</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    placeholder="Search logs..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.slice(0, 200).map(l => (
                      <tr key={l.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                          {l.created_at ? format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-800">{l.username}</td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            {l.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{l.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          MODAL: Create / Edit User Account
         ========================================== */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingUser ? `Edit User: ${editingUser.username}` : 'Create New User Account'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure role access, vessel binding, and team assignments.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={userFormData.username}
                  onChange={e => setUserFormData({ ...userFormData, username: e.target.value })}
                  placeholder="e.g. jdoe or CD_HUELVA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">
                    {editingUser ? 'New Password (leave blank to keep existing)' : 'Password *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = Math.random().toString(36).slice(-8) + 'A1!';
                      setUserFormData({ ...userFormData, password: gen });
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Generate Random
                  </button>
                </div>
                <input
                  type="text"
                  required={!editingUser}
                  value={userFormData.password}
                  onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Enter secure password'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Account Role *</label>
                  <select
                    value={userFormData.role}
                    onChange={e => {
                      const newRole = e.target.value as any;
                      setUserFormData({ ...userFormData, role: newRole });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  >
                    <option value="user">Technical PIC / Superintendent</option>
                    <option value="admin">Administrator</option>
                    <option value="team_pic">Team PIC / Manager</option>
                    <option value="vessel">Vessel Account</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    {userFormData.role === 'vessel' ? 'Assigned Vessel *' : 'Vessel Association (Optional)'}
                  </label>
                  <select
                    value={userFormData.vessel_id}
                    onChange={e => {
                      const vId = e.target.value;
                      const selectedV = vessels.find(v => String(v.id) === vId);
                      setUserFormData({
                        ...userFormData,
                        vessel_id: vId,
                        email: selectedV?.email || userFormData.email
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  >
                    <option value="">None / Office-wide</option>
                    {vessels.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="e.g. superintendent@cleanocean.com.ph"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* Team assignment checkboxes */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">Assigned Technical Teams</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {teams.map(t => {
                    const isChecked = userFormData.team_ids.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setUserFormData({ ...userFormData, team_ids: [...userFormData.team_ids, t.id] });
                            } else {
                              setUserFormData({ ...userFormData, team_ids: userFormData.team_ids.filter(id => id !== t.id) });
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {!editingUser && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={userFormData.notify}
                    onChange={e => setUserFormData({ ...userFormData, notify: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Dispatch Welcome Notification Email with Login Credentials</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSavingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingUser ? 'Save Changes' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: Revoke Device Authorization
         ========================================== */}
      {deviceRevokeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-xs">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {deviceRevokeModal.deviceId ? 'Revoke Device Access' : 'Revoke Hardware Authorization'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {deviceRevokeModal.deviceId 
                      ? 'Unbind specific workstation terminal' 
                      : 'Disconnect authorized vessel bridge terminal(s)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isRevokingDevice}
                onClick={() => setDeviceRevokeModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Vessel / Account</span>
                  <span className="text-xs font-black text-slate-900">{deviceRevokeModal.vesselName}</span>
                </div>

                {deviceRevokeModal.deviceId ? (
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Target Device</span>
                    <div className="text-right">
                      <span className="text-xs font-bold text-rose-700 block">{deviceRevokeModal.deviceLabel || 'Workstation'}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {deviceRevokeModal.deviceId.length > 20 
                          ? `${deviceRevokeModal.deviceId.slice(0, 20)}...` 
                          : deviceRevokeModal.deviceId}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-200/60 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Registered Devices</span>
                      <span className="text-xs font-bold text-slate-700">{deviceRevokeModal.devices?.length || 1} Device(s)</span>
                    </div>
                    {deviceRevokeModal.devices && deviceRevokeModal.devices.length > 0 && (
                      <div className="space-y-1 pt-0.5">
                        {deviceRevokeModal.devices.map((dev, idx) => (
                          <div key={dev.id || idx} className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <Laptop className="w-3.5 h-3.5 text-slate-400" />
                              {dev.label || 'Vessel Device'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {dev.id ? `${dev.id.slice(0, 14)}...` : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-900 leading-relaxed">
                  {deviceRevokeModal.deviceId ? (
                    <>
                      Revoking access will immediately unbind <strong className="font-bold">"{deviceRevokeModal.deviceLabel || 'this device'}"</strong>. The workstation terminal will be logged out and cannot access the system until re-authorized.
                    </>
                  ) : (
                    <>
                      Revoking access will disconnect all hardware bindings for <strong className="font-bold">{deviceRevokeModal.vesselName}</strong>. Active sessions will terminate immediately and will require administrator approval to reconnect.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isRevokingDevice}
                onClick={() => setDeviceRevokeModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isRevokingDevice}
                onClick={handleConfirmRevokeDevice}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isRevokingDevice ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Revoking...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Revoke Access</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
