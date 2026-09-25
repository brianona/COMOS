import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Download, 
  Eye, 
  X, 
  CheckSquare, 
  FolderArchive, 
  ExternalLink, 
  Check, 
  AlertTriangle, 
  Maximize2, 
  Minimize2, 
  FileImage, 
  Loader2, 
  Ship, 
  CheckCircle2, 
  RefreshCw, 
  FileSpreadsheet, 
  FileCode, 
  Copy 
} from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { ImageViewer } from './ImageViewer';
import { DocxViewer } from './DocxViewer';
import { DocLegacyViewer } from './DocLegacyViewer';
import { ExcelViewer } from './ExcelViewer';
import { PptxViewer } from './PptxViewer';

export interface PreviewModalState {
  isOpen: boolean;
  title: string;
  fileName: string;
  fileSize?: string;
  fileMimetype?: string;
  uploadId?: number;
  formId?: string;
  formCode?: string;
  vesselName?: string;
  subtitle?: string;
  isTemplate?: boolean;
  isRead?: boolean;
  replaceRequestedAt?: string | null;
  replaceRequestedBy?: string | null;
  replaceReason?: string | null;
  blobUrl?: string | null;
  blob?: Blob | null;
  arrayBuffer?: ArrayBuffer | null;
  textContent?: string | null;
  loading: boolean;
  error?: string | null;
}

export interface DocumentPreviewModalProps {
  modal: PreviewModalState;
  onClose: () => void;
  onDownload?: () => void;
  onMarkRead?: () => void;
  onRequestReplacement?: (uploadId: number, fileName: string) => void;
  onCancelReplacementRequest?: (uploadId: number) => void;
  isManagementOrAdmin?: boolean;
  token?: string;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  modal,
  onClose,
  onDownload,
  onMarkRead,
  onRequestReplacement,
  onCancelReplacementRequest,
  isManagementOrAdmin = false,
  token
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [wrapText, setWrapText] = useState(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fileNameLower = (modal.fileName || '').toLowerCase();
  const mimeLower = (modal.fileMimetype || '').toLowerCase();

  const isPdf = fileNameLower.endsWith('.pdf') || mimeLower.includes('pdf');
  const isImage = 
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(fileNameLower) || 
    mimeLower.startsWith('image/');
  const isDocx = fileNameLower.endsWith('.docx') || mimeLower.includes('officedocument.wordprocessingml.document');
  const isDoc = 
    fileNameLower.endsWith('.doc') || 
    fileNameLower.endsWith('.dot') || 
    fileNameLower.endsWith('.rtf') ||
    mimeLower.includes('msword') || 
    (mimeLower.includes('word') && !isDocx);
  const isExcel = /\.(xlsx?|ods|csv|tsv|xlsm|xlsb)$/i.test(fileNameLower) || mimeLower.includes('spreadsheet') || mimeLower.includes('excel') || mimeLower.includes('csv');
  const isPptx = /\.(pptx?|odp)$/i.test(fileNameLower) || mimeLower.includes('presentation') || mimeLower.includes('powerpoint');
  const isWord = isDocx || isDoc;
  const isArchive = /\.(zip|rar|7z|tar|gz|bz2)$/i.test(fileNameLower) || mimeLower.includes('zip') || mimeLower.includes('tar');
  const isTextOrCsv = (modal.textContent !== null && modal.textContent !== undefined) && !isExcel;

  const filteredTextLines = useMemo(() => {
    if (!modal.textContent) return [];
    const lines = modal.textContent.split('\n');
    if (!searchTerm) {
      return lines.map((text, idx) => ({ lineNum: idx + 1, text, matches: false }));
    }
    const q = searchTerm.toLowerCase();
    return lines.map((text, idx) => ({
      lineNum: idx + 1,
      text,
      matches: text.toLowerCase().includes(q)
    }));
  }, [modal.textContent, searchTerm]);

  const totalLines = modal.textContent ? modal.textContent.split('\n').length : 0;
  const matchCount = useMemo(() => {
    if (!searchTerm || !modal.textContent) return 0;
    return filteredTextLines.filter(l => l.matches).length;
  }, [filteredTextLines, searchTerm, modal.textContent]);

  const handleCopyText = () => {
    if (modal.textContent) {
      navigator.clipboard.writeText(modal.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTriggerDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (modal.blobUrl) {
      const a = document.createElement('a');
      a.href = modal.blobUrl;
      a.download = modal.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-[9995] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div 
        className={`bg-slate-900 text-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800/80 flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen 
            ? 'w-screen h-screen fixed inset-0 rounded-none z-[9996]' 
            : 'w-full max-w-6xl h-[92vh] max-h-[920px]'
        }`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          {/* Left info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isPdf ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
              isImage ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              isWord ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              isExcel ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
              isTextOrCsv ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}>
              {isPdf && <FileText className="w-5 h-5" />}
              {isImage && <FileImage className="w-5 h-5" />}
              {isWord && <FileText className="w-5 h-5" />}
              {isExcel && <FileSpreadsheet className="w-5 h-5" />}
              {isTextOrCsv && <FileCode className="w-5 h-5" />}
              {!isPdf && !isImage && !isWord && !isExcel && !isTextOrCsv && <FileText className="w-5 h-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate max-w-md" title={modal.fileName}>
                  {modal.fileName}
                </h3>
                {modal.fileSize && (
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 shrink-0">
                    {modal.fileSize}
                  </span>
                )}
                {modal.isTemplate ? (
                  <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
                    Official Template
                  </span>
                ) : modal.subtitle ? (
                  <span className="px-2 py-0.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
                    {modal.subtitle}
                  </span>
                ) : modal.formCode ? (
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
                    Vessel Submission
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
                    Attachment
                  </span>
                )}
                {modal.formCode && (
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-md text-[10px] font-mono font-bold shrink-0">
                    {modal.formCode}
                  </span>
                )}
                {modal.vesselName && (
                  <span className="px-2 py-0.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-md text-[10px] font-bold shrink-0 flex items-center gap-1">
                    <Ship className="w-2.5 h-2.5" />
                    <span>{modal.vesselName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!modal.isTemplate && isManagementOrAdmin && onMarkRead && (
              modal.isRead ? (
                <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 hidden sm:flex">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Read by You</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onMarkRead}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-emerald-500/20 text-amber-300 hover:text-emerald-300 border border-amber-500/40 hover:border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Mark as read by your account"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Mark Read</span>
                </button>
              )
            )}

            {!modal.isTemplate && isManagementOrAdmin && modal.uploadId && (
              modal.replaceRequestedAt ? (
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1" title={modal.replaceReason || "Revision requested"}>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Revision Requested</span>
                  </span>
                  {onCancelReplacementRequest && (
                    <button
                      type="button"
                      onClick={() => onCancelReplacementRequest(modal.uploadId!)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                      title="Cancel revision request"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              ) : (
                onRequestReplacement && (
                  <button
                    type="button"
                    onClick={() => onRequestReplacement(modal.uploadId!, modal.fileName)}
                    className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title="Request vessel to replace this file"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                    <span>Request Revision</span>
                  </button>
                )
              )
            )}

            {modal.blobUrl && (
              <a
                href={modal.blobUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer hidden md:flex"
                title="Open document in a separate browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Tab</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleTriggerDownload}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
              title="Download a copy of this document to your device"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors border border-slate-700 cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-xl transition-colors border border-slate-700 cursor-pointer"
              title="Close Viewer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-950">
          {modal.loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <p className="text-sm font-bold text-slate-300">Loading document preview...</p>
              <p className="text-xs text-slate-500">Preparing file stream for inline view</p>
            </div>
          ) : modal.error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Unable to View Document</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{modal.error}</p>
              </div>
              <button
                type="button"
                onClick={handleTriggerDownload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Download File Instead</span>
              </button>
            </div>
          ) : isPdf && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <PDFViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined}
                arrayBuffer={modal.arrayBuffer || undefined}
                title={modal.title} 
                onDownload={handleTriggerDownload}
              />
            </div>
          ) : isImage && modal.blobUrl ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ImageViewer url={modal.blobUrl} title={modal.title} />
            </div>
          ) : isDocx && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <DocxViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined} 
                arrayBuffer={modal.arrayBuffer || undefined} 
                title={modal.title} 
                onDownload={handleTriggerDownload} 
              />
            </div>
          ) : isDoc && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <DocLegacyViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined} 
                arrayBuffer={modal.arrayBuffer || undefined} 
                title={modal.title} 
                onDownload={handleTriggerDownload} 
              />
            </div>
          ) : isExcel && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ExcelViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined} 
                arrayBuffer={modal.arrayBuffer || undefined} 
                title={modal.title} 
                onDownload={handleTriggerDownload} 
              />
            </div>
          ) : isPptx && (modal.blobUrl || modal.blob || modal.arrayBuffer) ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <PptxViewer 
                url={modal.blobUrl || undefined} 
                blob={modal.blob || undefined} 
                arrayBuffer={modal.arrayBuffer || undefined} 
                title={modal.title} 
                onDownload={handleTriggerDownload} 
              />
            </div>
          ) : isTextOrCsv && modal.textContent !== null ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
              {/* Text toolbar */}
              <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {totalLines} lines • {modal.textContent.length.toLocaleString()} characters
                  </span>
                  {searchTerm && (
                    <span className="text-emerald-400 font-bold text-[11px]">
                      {matchCount} match{matchCount === 1 ? '' : 'es'} found
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search text..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1 w-44 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setWrapText(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      wrapText ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Wrap
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Text content viewer */}
              <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 select-text">
                <table className="w-full border-collapse">
                  <tbody>
                    {filteredTextLines.map(({ lineNum, text, matches }) => (
                      <tr 
                        key={lineNum}
                        className={`hover:bg-slate-800/50 ${matches ? 'bg-amber-500/15' : ''}`}
                      >
                        <td className="pr-4 py-0.5 text-right text-slate-600 select-none font-mono text-[11px] w-12 align-top">
                          {lineNum}
                        </td>
                        <td className={`py-0.5 text-slate-200 font-mono text-xs ${wrapText ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                          {text || ' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Office / Word / Excel / Archive document inspector */
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900">
              <div className="max-w-lg w-full bg-slate-950 rounded-3xl p-8 border border-slate-800 text-center space-y-6 shadow-2xl">
                <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center border shadow-inner ${
                  isWord ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                  isExcel ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' :
                  isArchive ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                  'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                }`}>
                  {isWord && <FileText className="w-10 h-10" />}
                  {isExcel && <FileSpreadsheet className="w-10 h-10" />}
                  {isArchive && <FolderArchive className="w-10 h-10" />}
                  {!isWord && !isExcel && !isArchive && <FileText className="w-10 h-10" />}
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white break-all">{modal.fileName}</h3>
                  <p className="text-xs text-slate-400">
                    {isWord && 'Microsoft Word Document'}
                    {isExcel && 'Microsoft Excel / Spreadsheet Document'}
                    {isArchive && 'Compressed Archive Package'}
                    {!isWord && !isExcel && !isArchive && (modal.fileMimetype || 'Document File')}
                    {modal.fileSize && ` • ${modal.fileSize}`}
                  </p>
                </div>

                <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800/80 text-left text-xs space-y-2">
                  {modal.formCode && (
                    <div className="flex justify-between items-center text-slate-400">
                      <span>SMS Form Code:</span>
                      <span className="font-mono font-bold text-slate-200">{modal.formCode}</span>
                    </div>
                  )}
                  {modal.vesselName && (
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Vessel Name:</span>
                      <span className="font-bold text-slate-200">{modal.vesselName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Document Type:</span>
                    <span className="font-bold text-slate-200">{modal.isTemplate ? 'Official Blank Template' : (modal.subtitle || 'Vessel Uploaded Form')}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTriggerDownload}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download to Open & Edit</span>
                  </button>

                  {modal.blobUrl && (
                    <a
                      href={modal.blobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open in Browser</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
