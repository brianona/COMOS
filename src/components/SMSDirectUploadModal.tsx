import React, { useState, useMemo, useRef } from 'react';
import {
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  FileQuestion,
  Ship,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Loader2,
  Trash2,
  Sparkles,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';

interface Vessel {
  id: string | number;
  name: string;
  type?: string;
  owner?: string;
  team_name?: string;
  flag?: string;
  status?: string;
}

interface CurrentUser {
  id: number | string;
  username: string;
  role: string;
  vessel_id?: string | number;
  team_ids?: number[];
}

interface SMSForm {
  id: string;
  formCode: string;
  category: string;
  description: string;
  formDate?: string;
  type: 'Form' | 'Checklist';
  isHira?: boolean;
  removeFilenameRestriction?: boolean;
  allowedFileTypes?: string[];
  templateFileName?: string;
}

interface SMSDirectUploadModalProps {
  vessels: Vessel[];
  currentUser: CurrentUser;
  availableForms: SMSForm[];
  token: string;
  onClose: () => void;
  onSuccess: (orderId: string, count: number) => void;
}

export const SMSDirectUploadModal: React.FC<SMSDirectUploadModalProps> = ({
  vessels,
  currentUser,
  availableForms,
  token,
  onClose,
  onSuccess
}) => {
  const isVesselUser = currentUser.role === 'vessel';

  // Determine initial vessel
  const initialVessel = useMemo(() => {
    if (isVesselUser) {
      return (
        vessels.find((v) => String(v.id) === String(currentUser.vessel_id)) || {
          id: currentUser.vessel_id || 'v1',
          name: currentUser.username
        }
      );
    }
    return vessels[0] || { id: 'v1', name: 'Fleet Vessel' };
  }, [isVesselUser, vessels, currentUser]);

  const [selectedVesselId, setSelectedVesselId] = useState<string>(String(initialVessel.id));
  const [selectedVesselName, setSelectedVesselName] = useState<string>(initialVessel.name);

  // Month & Year for default title
  const currentMonthYear = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, []);

  const [submissionTitle, setSubmissionTitle] = useState<string>(
    `Direct Submission - ${initialVessel.name} (${currentMonthYear})`
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('5. Occasional');
  const [selectedFormCode, setSelectedFormCode] = useState<string>('auto');
  const [notes, setNotes] = useState<string>('');
  
  // Files state
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle vessel change for management users
  const handleVesselChange = (vId: string) => {
    setSelectedVesselId(vId);
    const found = vessels.find((v) => String(v.id) === vId);
    if (found) {
      setSelectedVesselName(found.name);
      setSubmissionTitle(`Direct Submission - ${found.name} (${currentMonthYear})`);
    }
  };

  // Grouped categories from available forms
  const categories = useMemo(() => {
    const set = new Set<string>();
    availableForms.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    const arr = Array.from(set);
    if (!arr.includes('5. Occasional')) arr.push('5. Occasional');
    if (!arr.includes('General / Ad-hoc')) arr.push('General / Ad-hoc');
    return arr;
  }, [availableForms]);

  // Forms filtered by category (for formCode selector)
  const categoryForms = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'General / Ad-hoc') {
      return availableForms;
    }
    return availableForms.filter((f) => f.category === selectedCategory);
  }, [availableForms, selectedCategory]);

  // Helper to detect form code for a file
  const detectFormForFile = (fileName: string) => {
    if (selectedFormCode && selectedFormCode !== 'auto') {
      const explicit = availableForms.find((f) => f.formCode === selectedFormCode);
      if (explicit) return explicit.formCode;
    }
    const lower = fileName.toLowerCase();
    const matched = availableForms.find((f) => {
      if (!f.formCode) return false;
      const codeLower = f.formCode.toLowerCase();
      return lower.startsWith(codeLower) || lower.includes(codeLower);
    });
    return matched ? matched.formCode : null;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Total size of all attached files
  const totalFilesSize = useMemo(() => {
    const bytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    return formatFileSize(bytes);
  }, [files]);

  // File input handler
  const handleFilesSelected = (newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles);
    if (incoming.length === 0) return;

    // Filter out duplicates by name and size
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const uniqueIncoming = incoming.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
      return [...prev, ...uniqueIncoming];
    });
    setErrorMessage(null);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return <FileText className="w-5 h-5 text-rose-600" />;
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
      return <FileImage className="w-5 h-5 text-purple-600" />;
    }
    return <FileQuestion className="w-5 h-5 text-slate-500" />;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setErrorMessage('Please select or drag at least one file to upload.');
      return;
    }

    if (!submissionTitle.trim()) {
      setErrorMessage('Please provide a submission title / package name.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgressText(`Uploading ${files.length} file(s) to company database...`);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('vessel_id', selectedVesselId);
    formData.append('vessel_name', selectedVesselName);
    formData.append('label', submissionTitle.trim());
    formData.append('category', selectedCategory);
    formData.append('instructions', notes.trim() || 'Uploaded directly by vessel without a prior company order.');
    if (selectedFormCode && selectedFormCode !== 'auto') {
      formData.append('form_code', selectedFormCode);
      const matchedForm = availableForms.find((f) => f.formCode === selectedFormCode);
      if (matchedForm) {
        formData.append('form_id', matchedForm.id);
      }
    }

    try {
      const res = await fetch('/api/sms/orders/without-order', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        onSuccess(result.orderId, result.uploadedCount || files.length);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Upload failed. Please check your files and try again.');
        setIsUploading(false);
      }
    } catch (err: any) {
      setErrorMessage('Network error during upload: ' + err.message);
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FolderPlus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider mb-0.5 border border-emerald-400/20">
                <Sparkles className="w-2.5 h-2.5" />
                Vessel Self-Submission
              </div>
              <h3 className="text-lg font-black tracking-tight text-white">
                Upload Files Without Order
              </h3>
              <p className="text-xs text-emerald-100/70 font-medium">
                Submit completed checklists, unscheduled drill records, or voyage files directly.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors relative z-10 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vessel Selector / Display */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-emerald-600" />
                Vessel
              </label>
              {isVesselUser ? (
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{selectedVesselName}</span>
                  <span className="ml-auto text-[10px] text-slate-400 uppercase font-semibold">Assigned Vessel</span>
                </div>
              ) : (
                <select
                  value={selectedVesselId}
                  onChange={(e) => handleVesselChange(e.target.value)}
                  disabled={isUploading}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {vessels.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.name} {v.flag ? `(${v.flag})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Category / Section
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={isUploading}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submission Package Title */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Submission Title / Package Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={submissionTitle}
              onChange={(e) => setSubmissionTitle(e.target.value)}
              placeholder="e.g., Occasional Forms - Emergency Drill & Bunker Survey"
              disabled={isUploading}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          {/* Optional Specific Form Code */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Target Checklist / Form Code (Optional)
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Leave on Auto-detect for multi-form packages</span>
            </div>
            <select
              value={selectedFormCode}
              onChange={(e) => setSelectedFormCode(e.target.value)}
              disabled={isUploading}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="auto">✨ Auto-detect Form Codes from file names / General files</option>
              {categoryForms.map((f) => (
                <option key={f.id} value={f.formCode}>
                  {f.formCode} - {f.description} ({f.category})
                </option>
              ))}
            </select>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Master's Remarks / Submission Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide any additional context for the office superintendent regarding these uploaded files..."
              disabled={isUploading}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          {/* File Drag & Drop Zone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Attach Report Files <span className="text-rose-500">*</span>
              </label>
              {files.length > 0 && (
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {files.length} file(s) selected ({totalFilesSize})
                </span>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) {
                  handleFilesSelected(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/60 scale-[1.005]'
                  : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/80 bg-slate-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp,.zip"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFilesSelected(e.target.files);
                }}
              />
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-2.5 shadow-xs">
                <Upload className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h4 className="text-sm font-black text-slate-800 mb-1">
                Drag &amp; drop files here, or <span className="text-emerald-700 underline">browse files</span>
              </h4>
              <p className="text-[11px] text-slate-500 font-medium max-w-md mx-auto">
                Supports PDF documents, Excel spreadsheets (.xlsx, .xls), Word files (.docx), photos (.jpg, .png), and ZIP archives.
              </p>
            </div>

            {/* Selected Files List */}
            {files.length > 0 && (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 rounded-2xl border border-slate-100 p-2 bg-slate-50/50">
                {files.map((file, idx) => {
                  const detectedCode = detectFormForFile(file.name);
                  return (
                    <div
                      key={`${file.name}_${idx}`}
                      className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 group hover:border-emerald-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                          {getFileIcon(file.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 font-semibold">
                            <span>{formatFileSize(file.size)}</span>
                            {detectedCode ? (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-black">
                                Matched: {detectedCode}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                General / Ad-hoc
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(idx);
                        }}
                        disabled={isUploading}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{isVesselUser ? 'Package will be submitted directly to office management.' : 'Package will appear in Order List and Find SMS Report instantly.'}</span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isUploading || files.length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black tracking-wide shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadProgressText || 'Uploading...'}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 stroke-[2.5]" />
                    <span>Upload {files.length > 0 ? `${files.length} File(s)` : ''} Without Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
