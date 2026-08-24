import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Plus,
  Trash2,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { SMSForm } from './SMSView';

interface SMSFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: Partial<SMSForm>, editingId?: string) => Promise<void> | void;
  editingForm: SMSForm | null;
  selectedCategory: string;
  flags: Array<{ id: string | number; name: string }>;
  vesselsList: Array<{ id: string | number; name: string; flag?: string }>;
}

export const SMSFormModal: React.FC<SMSFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingForm,
  selectedCategory,
  flags,
  vesselsList,
}) => {
  if (!isOpen) return null;

  // Local Form Input States
  const [formCode, setFormCode] = useState(editingForm?.formCode || '');
  const [formType, setFormType] = useState<'Form' | 'Checklist'>(editingForm?.type || 'Form');
  const [formDate, setFormDate] = useState(editingForm?.formDate || '');
  const [description, setDescription] = useState(editingForm?.description || '');
  const [scope, setScope] = useState(editingForm?.scope || 'All Vessels');
  const [vesselType, setVesselType] = useState(editingForm?.vesselType || 'All Vessels');
  const [removeFilenameRestriction, setRemoveFilenameRestriction] = useState(
    Boolean(editingForm?.removeFilenameRestriction)
  );
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(
    editingForm?.allowedFileTypes || []
  );
  const [isHira, setIsHira] = useState(Boolean(editingForm?.isHira));
  const [isAcknowledgementRequired, setIsAcknowledgementRequired] = useState(
    Boolean(editingForm?.isAcknowledgementRequired)
  );
  const [selectedFlags, setSelectedFlags] = useState<string[]>(() => {
    if (!editingForm) return [];
    if (editingForm.scope && editingForm.scope !== 'All Vessels') {
      const matchedFlags = flags
        .map((f) => f.name)
        .filter((flagName) => editingForm.scope.includes(flagName));
      if (matchedFlags.length > 0) return matchedFlags;
      const matchedVessel = vesselsList.find((v) => v.name === editingForm.scope);
      if (matchedVessel && matchedVessel.flag) return [matchedVessel.flag];
    }
    return [];
  });

  // Template files state
  const [singleTemplate, setSingleTemplate] = useState<{
    name: string;
    data?: string;
    mimetype?: string;
    size?: number;
  } | null>(() => {
    if (editingForm?.template_file_name) {
      return {
        name: editingForm.template_file_name,
        data: editingForm.template_file_data,
        mimetype: editingForm.template_file_mimetype,
        size: editingForm.template_file_size,
      };
    }
    return null;
  });

  const [multiTemplates, setMultiTemplates] = useState<
    Array<{
      name: string;
      data?: string;
      mimetype?: string;
      size?: number;
    }>
  >(() => editingForm?.template_files || []);

  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync single vs multi when isHira changes
  useEffect(() => {
    if (isHira) {
      if (singleTemplate && multiTemplates.length === 0) {
        setMultiTemplates([singleTemplate]);
      }
    } else {
      if (multiTemplates.length > 0 && !singleTemplate) {
        setSingleTemplate(multiTemplates[0]);
      }
    }
  }, [isHira]);

  const getFlagsFormatted = (arr: string[]) => {
    if (arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    const initial = arr.slice(0, -1).join(', ');
    return `${initial}, and ${arr[arr.length - 1]}`;
  };

  const handleFlagCheckboxChange = (flagName: string, checked: boolean) => {
    let nextFlags: string[];
    if (checked) {
      nextFlags = selectedFlags.includes(flagName) ? selectedFlags : [...selectedFlags, flagName];
    } else {
      nextFlags = selectedFlags.filter((f) => f !== flagName);
    }
    setSelectedFlags(nextFlags);

    // Compute default scope based on flags
    let defaultScope = 'All Vessels';
    if (nextFlags.length === 1) {
      defaultScope = `All ${nextFlags[0]} Vessels`;
    } else if (nextFlags.length > 1) {
      defaultScope = `All ${getFlagsFormatted(nextFlags)} flags`;
    }

    const isCurrentVesselStillValid = vesselsList.some(
      (v) =>
        v.name === scope &&
        (nextFlags.length === 0 || nextFlags.includes(v.flag || ''))
    );

    const isGroupOption = scope.startsWith('All ');
    if (isGroupOption || !isCurrentVesselStillValid) {
      setScope(defaultScope);
    }
  };

  // Fast asynchronous File Reading
  const readFileAsDataUrl = (file: File): Promise<{
    name: string;
    data: string;
    mimetype: string;
    size: number;
  }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          name: file.name,
          data: e.target?.result as string,
          mimetype: file.type || 'application/octet-stream',
          size: file.size,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processIncomingFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsReadingFiles(true);
    setErrorMessage(null);

    try {
      if (isHira) {
        // Multiple templates mode
        const processed = await Promise.all(fileArray.map((f) => readFileAsDataUrl(f)));
        setMultiTemplates((prev) => [...prev, ...processed]);
      } else {
        // Single template mode (take first file)
        const firstFile = fileArray[0];
        const processed = await readFileAsDataUrl(firstFile);
        setSingleTemplate(processed);
      }
    } catch (err: any) {
      console.error('Error reading template file(s):', err);
      setErrorMessage('Failed to read one or more template files.');
    } finally {
      setIsReadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !description.trim()) {
      setErrorMessage('Form Code and Description are required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload: Partial<SMSForm> = {
        formCode: formCode.trim(),
        description: description.trim(),
        formDate: formDate.trim(),
        scope,
        vesselType,
        type: formType,
        removeFilenameRestriction,
        allowedFileTypes,
        isHira,
        isAcknowledgementRequired,
        template_file_name: singleTemplate?.name,
        template_file_data: singleTemplate?.data,
        template_file_mimetype: singleTemplate?.mimetype,
        template_file_size: singleTemplate?.size,
        template_files: isHira ? multiTemplates : undefined,
      };

      await onSave(payload, editingForm ? editingForm.id : undefined);
      onClose();
    } catch (err: any) {
      console.error('Error saving form definition:', err);
      setErrorMessage(err.message || 'Failed to save form definition.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'doc') {
      return <FileText className="w-4 h-4 text-blue-600 shrink-0" />;
    }
    if (ext === 'xlsx' || ext === 'xls') {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />;
    }
    if (ext === 'pdf') {
      return <FileText className="w-4 h-4 text-red-600 shrink-0" />;
    }
    return <FileIcon className="w-4 h-4 text-slate-600 shrink-0" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3.5 flex justify-between items-center shrink-0 shadow-xs">
          <div>
            <h3 className="text-sm font-black tracking-tight uppercase flex items-center gap-2">
              <span>{editingForm ? 'Edit Form / Checklist' : 'Add New Form / Checklist'}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                {formType}
              </span>
            </h3>
            <p className="text-[10px] text-blue-100/90 font-bold mt-0.5">
              Category: {selectedCategory}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3.5 text-xs font-semibold overflow-y-auto max-h-[calc(92vh-120px)]">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            {/* Row 1: Code, Type, Date */}
            <div className="grid grid-cols-12 gap-3 items-start">
              <div className="col-span-12 sm:col-span-5 space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Form Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COMI-SM-1-6"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800 font-bold"
                />
              </div>

              <div className="col-span-6 sm:col-span-3 space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Type
                </label>
                <div className="flex items-center gap-3 py-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs select-none">
                    <input
                      type="radio"
                      name="modalFormType"
                      value="Form"
                      checked={formType === 'Form'}
                      onChange={() => setFormType('Form')}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    Form
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs select-none">
                    <input
                      type="radio"
                      name="modalFormType"
                      value="Checklist"
                      checked={formType === 'Checklist'}
                      onChange={() => setFormType('Checklist')}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    Checklist
                  </label>
                </div>
              </div>

              <div className="col-span-6 sm:col-span-4 space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Form Date
                </label>
                <input
                  type="text"
                  placeholder="e.g. 28 November 2025"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800 font-semibold"
                />
              </div>
            </div>

            {/* Row 2: Description */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Describe the purpose, checklist requirements, or target..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800 leading-relaxed font-semibold text-xs"
              />
            </div>

            {/* Row 3: Vessel Scope & Vessel Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Vessel Scope
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-800 cursor-pointer"
                >
                  {selectedFlags.length === 0 || selectedFlags.length === flags.length ? (
                    <option value="All Vessels">All Vessels</option>
                  ) : selectedFlags.length === 1 ? (
                    <option value={`All ${selectedFlags[0]} Vessels`}>
                      All {selectedFlags[0]} Vessels
                    </option>
                  ) : (
                    <option value={`All ${getFlagsFormatted(selectedFlags)} flags`}>
                      All {getFlagsFormatted(selectedFlags)} flags
                    </option>
                  )}

                  {vesselsList
                    .filter(
                      (v) =>
                        selectedFlags.length === 0 ||
                        selectedFlags.includes(v.flag || '')
                    )
                    .map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Vessel Type
                </label>
                <select
                  value={vesselType}
                  onChange={(e) => setVesselType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-800 cursor-pointer"
                >
                  <option value="All Types">All Types</option>
                  <option value="Bulk Carrier">Bulk Carrier</option>
                  <option value="Container">Container</option>
                </select>
              </div>
            </div>

            {/* Row 4: Flags Scope & File Type Limit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Flags Scope */}
              <div className="space-y-1 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Flags Scope
                </label>
                <div className="grid grid-cols-2 gap-1 pt-0.5">
                  {flags.map((f) => {
                    const isChecked = selectedFlags.includes(f.name);
                    return (
                      <label
                        key={f.id}
                        className="flex items-center gap-1.5 cursor-pointer py-0.5 px-1.5 rounded hover:bg-slate-200/60 transition-colors text-slate-700 font-bold text-[11px] select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            handleFlagCheckboxChange(f.name, e.target.checked)
                          }
                          className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        {f.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* File Type Limit */}
              <div className="space-y-1 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  File Type Limit
                </label>
                <div className="flex flex-wrap gap-2.5 items-center pt-1">
                  {['Word', 'Excel', 'PDF'].map((ft) => (
                    <label
                      key={ft}
                      className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={allowedFileTypes.includes(ft)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAllowedFileTypes([...allowedFileTypes, ft]);
                          } else {
                            setAllowedFileTypes(
                              allowedFileTypes.filter((t) => t !== ft)
                            );
                          }
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      {ft}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 5: Form Template Upload Dropzone & Form Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              {/* Template File Dropzone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    {isHira
                      ? `Blank Templates (${multiTemplates.length})`
                      : 'Blank Form / Template'}
                  </label>
                  {isReadingFiles && (
                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </span>
                  )}
                </div>

                {isHira ? (
                  /* Multiple Templates View */
                  <div className="space-y-2">
                    {multiTemplates.length > 0 && (
                      <div className="max-h-28 overflow-y-auto space-y-1 p-1 bg-slate-50 rounded-xl border border-slate-200">
                        {multiTemplates.map((tf, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200 shadow-3xs gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {renderFileIcon(tf.name)}
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-slate-800 truncate">
                                  {tf.name}
                                </p>
                                {tf.size ? (
                                  <p className="text-[9px] text-slate-400 font-semibold">
                                    {formatFileSize(tf.size)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setMultiTemplates((prev) =>
                                  prev.filter((_, i) => i !== index)
                                );
                              }}
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition-all cursor-pointer shrink-0"
                              title="Remove File"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Multi Dropzone */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative border-2 border-dashed rounded-xl p-3 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-1.5 ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                          : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".docx,.doc,.xlsx,.xls,.pdf"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-700">
                          {isDragging ? 'Drop files here' : 'Add Template File(s)'}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">
                          Drag & drop or click (.docx, .xlsx, .pdf)
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single Template View */
                  <div>
                    {singleTemplate ? (
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-3xs">
                            {renderFileIcon(singleTemplate.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {singleTemplate.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {formatFileSize(singleTemplate.size) || 'Attached Template'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 hover:bg-slate-200/80 text-slate-500 hover:text-blue-600 rounded-lg transition-all cursor-pointer text-[10px] font-bold"
                            title="Replace File"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => setSingleTemplate(null)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                            title="Remove File"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".docx,.doc,.xlsx,.xls,.pdf"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-3.5 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-1.5 ${
                          isDragging
                            ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                            : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".docx,.doc,.xlsx,.xls,.pdf"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-700">
                            {isDragging ? 'Drop template file here' : 'Upload Blank Form / Template'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Drag & drop or click (.docx, .xlsx, .pdf)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Option Checkboxes */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-2">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Form Settings
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modalIsHira"
                    checked={isHira}
                    onChange={(e) => setIsHira(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <label
                    htmlFor="modalIsHira"
                    className="text-xs font-bold text-slate-800 cursor-pointer select-none"
                  >
                    Multiple Files (HIRA / Multi-parts)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modalRemoveFilenameRestriction"
                    checked={removeFilenameRestriction}
                    onChange={(e) => setRemoveFilenameRestriction(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label
                    htmlFor="modalRemoveFilenameRestriction"
                    className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                  >
                    Remove filename restriction
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modalIsAcknowledgementRequired"
                    checked={isAcknowledgementRequired}
                    onChange={(e) =>
                      setIsAcknowledgementRequired(e.target.checked)
                    }
                    className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label
                    htmlFor="modalIsAcknowledgementRequired"
                    className="text-xs font-bold text-amber-900 cursor-pointer select-none"
                  >
                    Acknowledgement Required
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 justify-end px-5 py-3 bg-slate-50/90 border-t border-slate-100 shrink-0 mt-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isReadingFiles}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl transition-all text-xs font-bold shadow-md shadow-blue-100 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Definition</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
