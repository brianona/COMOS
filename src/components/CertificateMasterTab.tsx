import React, { useState, useMemo } from 'react';
import {
  Award,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  RefreshCw,
  Tags,
  Filter,
  Layers,
  X,
  Check,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  FolderPlus,
  AlertCircle
} from 'lucide-react';
import { CertificateDefinition, CertificateCategory } from '../types';
import { cleanCertificateName, compareCertificatesNumerically, getCategoryMinCertNumber } from '../data/certificates';

interface CertificateMasterTabProps {
  token: string;
  user?: any;
  notify: (type: 'success' | 'error', message: string) => void;
  certDefinitions: CertificateDefinition[];
  certCategories: CertificateCategory[];
  loadingCertDefs: boolean;
  fetchCertDefinitions: () => void;
  fetchCertCategories: () => void;
}

export const CertificateMasterTab: React.FC<CertificateMasterTabProps> = ({
  token,
  user,
  notify,
  certDefinitions,
  certCategories,
  loadingCertDefs,
  fetchCertDefinitions,
  fetchCertCategories
}) => {
  const isNonVessel = user?.role !== 'vessel';

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [validityFilter, setValidityFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  // Modal: Add / Edit Certificate Definition
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<CertificateDefinition | null>(null);
  const [certForm, setCertForm] = useState({
    name: '',
    category: 'Class & Statutory',
    is_valid: true,
    description: ''
  });
  const [isSavingCert, setIsSavingCert] = useState(false);

  // Modal: Manage Categories
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCat, setEditingCat] = useState<CertificateCategory | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [isSyncingDefaults, setIsSyncingDefaults] = useState(false);
  const [isCleaningNames, setIsCleaningNames] = useState(false);

  // Categories list options
  const categoryNames = useMemo(() => {
    let list = certCategories.map(c => c.name);
    if (list.length === 0) {
      list = [
        'Class & Statutory',
        'Environmental',
        'Cargo Gear & Operations',
        'Surveys & Inspections',
        'Safety & Security',
        'Plans, Manuals & Procedures',
        'Trading & Port',
        'Other'
      ];
    }
    return list.slice().sort((a, b) => {
      const minA = getCategoryMinCertNumber(a, certDefinitions);
      const minB = getCategoryMinCertNumber(b, certDefinitions);
      if (minA !== minB) return minA - minB;
      return a.localeCompare(b);
    });
  }, [certCategories, certDefinitions]);

  // Filtered List - strictly arranged in numerical order (1.1, 1.2 ... 7.11)
  const filteredCerts = useMemo(() => {
    return certDefinitions
      .filter(cert => {
        // Search filter
        const matchesSearch =
          searchTerm.trim() === '' ||
          cert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cert.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (cert.description || '').toLowerCase().includes(searchTerm.toLowerCase());

        // Category filter
        const matchesCat = selectedCategory === 'all' || cert.category === selectedCategory;

        // Validity filter
        const matchesValidity =
          validityFilter === 'all' ||
          (validityFilter === 'valid' && cert.is_valid) ||
          (validityFilter === 'invalid' && !cert.is_valid);

        return matchesSearch && matchesCat && matchesValidity;
      })
      .slice()
      .sort((a, b) => compareCertificatesNumerically(a.name, b.name));
  }, [certDefinitions, searchTerm, selectedCategory, validityFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = certDefinitions.length;
    const valid = certDefinitions.filter(c => c.is_valid).length;
    const invalid = total - valid;
    const totalCats = certCategories.length || categoryNames.length;
    return { total, valid, invalid, totalCats };
  }, [certDefinitions, certCategories, categoryNames]);

  // Category Color Map for Badges
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Class & Statutory':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Safety & Security':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Environmental':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Trading & Port':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Cargo Gear & Operations':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Surveys & Inspections':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Plans, Manuals & Procedures':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Open Create Certificate Modal
  const handleOpenCreateModal = () => {
    setEditingCert(null);
    setCertForm({
      name: '',
      category: categoryNames[0] || 'Class & Statutory',
      is_valid: true,
      description: ''
    });
    setIsCertModalOpen(true);
  };

  // Open Edit Certificate Modal
  const handleOpenEditModal = (cert: CertificateDefinition) => {
    setEditingCert(cert);
    setCertForm({
      name: cert.name,
      category: cert.category,
      is_valid: cert.is_valid,
      description: cert.description || ''
    });
    setIsCertModalOpen(true);
  };

  // Save Certificate (Create or Update)
  const handleSaveCert = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = cleanCertificateName(certForm.name.trim());
    if (!cleanedName) {
      notify('error', 'Certificate name is required');
      return;
    }
    if (!certForm.category.trim()) {
      notify('error', 'Category is required');
      return;
    }

    const payload = {
      ...certForm,
      name: cleanedName
    };

    setIsSavingCert(true);
    try {
      if (editingCert) {
        // Update
        const res = await fetch(`/api/certificate-definitions/${editingCert.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          notify('success', `Certificate "${cleanedName}" updated successfully`);
          setIsCertModalOpen(false);
          fetchCertDefinitions();
          fetchCertCategories();
        } else {
          const err = await res.json();
          notify('error', err.error || 'Failed to update certificate definition');
        }
      } else {
        // Create
        const res = await fetch('/api/certificate-definitions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          notify('success', `Certificate "${cleanedName}" added to master registry`);
          setIsCertModalOpen(false);
          fetchCertDefinitions();
          fetchCertCategories();
        } else {
          const err = await res.json();
          notify('error', err.error || 'Failed to add certificate definition');
        }
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    } finally {
      setIsSavingCert(false);
    }
  };

  // Toggle Validity
  const handleToggleValidity = async (cert: CertificateDefinition) => {
    if (!isNonVessel) {
      notify('error', 'Only shore administrators can modify certificate validity');
      return;
    }

    const nextState = !cert.is_valid;
    try {
      const res = await fetch(`/api/certificate-definitions/${cert.id}/validity`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_valid: nextState })
      });

      if (res.ok) {
        notify('success', `Certificate "${cert.name}" marked as ${nextState ? 'VALID' : 'INVALID'}`);
        fetchCertDefinitions();
        fetchCertCategories();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to update validity status');
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // Delete Certificate
  const handleDeleteCert = async (cert: CertificateDefinition) => {
    if (!isNonVessel) {
      notify('error', 'Only shore administrators can delete certificate definitions');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove "${cert.name}" from the certificate master list?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/certificate-definitions/${cert.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        notify('success', `Certificate "${cert.name}" moved to recycle bin`);
        fetchCertDefinitions();
        fetchCertCategories();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to delete certificate definition');
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      notify('error', 'Category name is required');
      return;
    }

    setIsSavingCat(true);
    try {
      const res = await fetch('/api/certificate-categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newCatName.trim(),
          description: newCatDesc.trim() || null
        })
      });

      if (res.ok) {
        notify('success', `Category "${newCatName.trim()}" created successfully`);
        setNewCatName('');
        setNewCatDesc('');
        fetchCertCategories();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to create category');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsSavingCat(false);
    }
  };

  // Update Category
  const handleUpdateCategory = async (catId: number) => {
    if (!editingCatName.trim()) {
      notify('error', 'Category name cannot be blank');
      return;
    }

    setIsSavingCat(true);
    try {
      const res = await fetch(`/api/certificate-categories/${catId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingCatName.trim(),
          description: editingCatDesc.trim() || null
        })
      });

      if (res.ok) {
        notify('success', `Category updated successfully`);
        setEditingCat(null);
        fetchCertCategories();
        fetchCertDefinitions();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to update category');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsSavingCat(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: CertificateCategory) => {
    if (!isNonVessel) return;
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/certificate-categories/${cat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        notify('success', `Category "${cat.name}" deleted`);
        fetchCertCategories();
        fetchCertDefinitions();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to delete category');
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // Sync Standard IMO Defaults
  const handleSyncDefaults = async () => {
    if (!isNonVessel) return;
    if (
      !window.confirm(
        'This will synchronize the certificate master list with standard IMO, SOLAS, MARPOL, and ISM conventions. Existing certificates and categories will be preserved. Proceed?'
      )
    ) {
      return;
    }

    setIsSyncingDefaults(true);
    try {
      const res = await fetch('/api/certificate-definitions/seed-defaults', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        notify('success', data.message || 'Default IMO certificates successfully synchronized');
        fetchCertDefinitions();
        fetchCertCategories();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to synchronize defaults');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsSyncingDefaults(false);
    }
  };

  // Strip trailing "Class" and "Flag"
  const handleCleanNames = async () => {
    if (!isNonVessel) return;
    setIsCleaningNames(true);
    try {
      const res = await fetch('/api/certificate-definitions/clean-names', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        notify('success', data.message || 'Certificate names cleaned successfully');
        fetchCertDefinitions();
        fetchCertCategories();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to clean certificate names');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsCleaningNames(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Certificate Names & Categories Master</h3>
              <p className="text-xs text-slate-500">
                Manage valid certificate names and statutory categories. Valid items populate the "Add Cert/Report" dropdown for vessel reporting.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls for Non-Vessel Users */}
        <div className="flex items-center gap-2 flex-wrap">
          {isNonVessel && (
            <>
              <button
                type="button"
                onClick={handleSyncDefaults}
                disabled={isSyncingDefaults}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Populate with standard IMO / SOLAS / MARPOL conventions"
              >
                <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isSyncingDefaults ? 'animate-spin' : ''}`} />
                <span>Sync IMO Standards</span>
              </button>

              <button
                type="button"
                onClick={handleCleanNames}
                disabled={isCleaningNames}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Remove trailing 'Class' or 'Flag' suffixes from all certificate names"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isCleaningNames ? 'animate-spin text-blue-600' : ''}`} />
                <span>Clean Suffixes</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Tags className="w-3.5 h-3.5 text-slate-500" />
                <span>Manage Categories ({certCategories.length})</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Certificate</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              fetchCertDefinitions();
              fetchCertCategories();
            }}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loadingCertDefs ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role Notice if Vessel User */}
      {!isNonVessel && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Read-only access:</strong> Vessel accounts can view valid certificate definitions. Modifications and validity toggling are restricted to Shore Management (Admin & Team PIC).
          </span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Award className="w-3 h-3 text-blue-500" /> Total Definitions
          </div>
          <div className="text-xl font-black text-slate-800 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-400">Registered certificate names</div>
        </div>

        <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Valid in Dropdown
          </div>
          <div className="text-xl font-black text-emerald-700 mt-1">{stats.valid}</div>
          <div className="text-[11px] text-emerald-600/80">Available for vessel upload</div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-slate-400" /> Inactive / Deprecated
          </div>
          <div className="text-xl font-black text-slate-600 mt-1">{stats.invalid}</div>
          <div className="text-[11px] text-slate-400">Hidden from upload dropdown</div>
        </div>

        <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/60">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1">
            <Tags className="w-3 h-3 text-blue-500" /> Categories
          </div>
          <div className="text-xl font-black text-blue-700 mt-1">{stats.totalCats}</div>
          <div className="text-[11px] text-blue-600/80">Statutory groups</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search certificate name, category or description..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 outline-none transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
            >
              <option value="all">All Categories ({certDefinitions.length})</option>
              {categoryNames.map(cat => {
                const count = certDefinitions.filter(c => c.category === cat).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Validity Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            <button
              type="button"
              onClick={() => setValidityFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                validityFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setValidityFilter('valid')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                validityFilter === 'valid'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" /> Valid
            </button>
            <button
              type="button"
              onClick={() => setValidityFilter('invalid')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                validityFilter === 'invalid'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <XCircle className="w-3 h-3" /> Inactive
            </button>
          </div>
        </div>
      </div>

      {/* Categories Quick-Pills Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({certDefinitions.length})
        </button>
        {categoryNames.map(cat => {
          const catCount = certDefinitions.filter(c => c.category === cat).length;
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat} <span className="opacity-70 font-normal">({catCount})</span>
            </button>
          );
        })}
      </div>

      {/* Certificates Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4">Certificate Name</th>
                <th className="py-3 px-4">Statutory Category</th>
                <th className="py-3 px-4 text-center">Validity Status</th>
                <th className="py-3 px-4">Convention / Notes</th>
                {isNonVessel && <th className="py-3 px-4 text-right w-28">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingCertDefs ? (
                <tr>
                  <td colSpan={isNonVessel ? 6 : 5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading certificate definitions...
                  </td>
                </tr>
              ) : filteredCerts.length === 0 ? (
                <tr>
                  <td colSpan={isNonVessel ? 6 : 5} className="py-12 text-center text-slate-400">
                    <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No certificate definitions found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchTerm || selectedCategory !== 'all' || validityFilter !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'Click "Add Certificate" or "Sync IMO Standards" to populate the master list.'}
                    </p>
                    {isNonVessel && (
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenCreateModal}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer"
                        >
                          Add New Certificate
                        </button>
                        <button
                          type="button"
                          onClick={handleSyncDefaults}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                        >
                          Sync IMO Standards
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCerts.map((cert, index) => (
                  <tr
                    key={cert.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      !cert.is_valid ? 'bg-slate-50/40 text-slate-500' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center text-slate-400 font-medium">{index + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <Award className={`w-3.5 h-3.5 shrink-0 ${cert.is_valid ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{cert.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(
                          cert.category
                        )}`}
                      >
                        {cert.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleValidity(cert)}
                        disabled={!isNonVessel}
                        title={isNonVessel ? 'Click to toggle validity status' : 'Validity set by shore admin'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                          isNonVessel ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                        } ${
                          cert.is_valid
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {cert.is_valid ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Valid</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={cert.description || ''}>
                      {cert.description || <span className="text-slate-300 italic">None</span>}
                    </td>
                    {isNonVessel && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cert)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Certificate Definition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCert(cert)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Certificate Definition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>
          Showing <strong>{filteredCerts.length}</strong> of <strong>{certDefinitions.length}</strong> certificate definitions
        </span>
        <span className="text-[11px] text-slate-400">
          * Valid certificates will automatically display in the Add Cert dropdown list
        </span>
      </div>

      {/* ========================================================
          MODAL 1: ADD / EDIT CERTIFICATE DEFINITION
         ======================================================== */}
      {isCertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Award className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingCert ? 'Edit Certificate Definition' : 'Add Certificate Name'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCertModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCert} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Certificate Name *</label>
                <input
                  type="text"
                  required
                  value={certForm.name}
                  onChange={e => setCertForm({ ...certForm, name: e.target.value })}
                  placeholder="e.g. Safety Management Certificate (SMC)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">Category *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCertModalOpen(false);
                      setIsCategoryModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    + Manage Categories
                  </button>
                </div>
                <select
                  value={certForm.category}
                  onChange={e => setCertForm({ ...certForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                >
                  {categoryNames.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Validity Toggle */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Valid Certificate</div>
                  <div className="text-[11px] text-slate-500">
                    If enabled, this certificate is selectable in the Add Cert dropdown for vessels.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCertForm({ ...certForm, is_valid: !certForm.is_valid })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    certForm.is_valid ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      certForm.is_valid ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Convention / Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={certForm.description}
                  onChange={e => setCertForm({ ...certForm, description: e.target.value })}
                  placeholder="e.g. Mandatory under SOLAS Chapter IX & ISM Code"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCertModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCert || !certForm.name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingCert && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{editingCert ? 'Save Changes' : 'Create Certificate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: MANAGE CATEGORIES
         ======================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Tags className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Certificate Categories Manager</h3>
                  <p className="text-xs text-slate-500">Add, rename, or organize statutory certificate categories.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCat(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add Category Form */}
            {isNonVessel && (
              <form onSubmit={handleCreateCategory} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add New Category</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="Category name (e.g. Crew Licensing)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-blue-500 outline-none"
                  />
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={e => setNewCatDesc(e.target.value)}
                    placeholder="Description / Remarks (Optional)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingCat || !newCatName.trim()}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Category</span>
                  </button>
                </div>
              </form>
            )}

            {/* Categories List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <div className="text-xs font-bold text-slate-600">Existing Categories ({certCategories.length})</div>
              {certCategories.map(cat => (
                <div
                  key={cat.id}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2"
                >
                  {editingCat?.id === cat.id ? (
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={e => setEditingCatName(e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-white border border-blue-400 rounded-lg text-xs font-bold text-slate-900 outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCategory(cat.id)}
                          className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCat(null)}
                          className="p-1 bg-slate-300 text-slate-700 rounded-md hover:bg-slate-400 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editingCatDesc}
                        onChange={e => setEditingCatDesc(e.target.value)}
                        placeholder="Description"
                        className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{cat.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-600">
                            {cat.cert_count ?? certDefinitions.filter(c => c.category === cat.name).length} certs
                          </span>
                        </div>
                        {cat.description && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{cat.description}</p>}
                      </div>

                      {isNonVessel && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCat(cat);
                              setEditingCatName(cat.name);
                              setEditingCatDesc(cat.description || '');
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCat(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
