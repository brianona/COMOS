import React from 'react';
import { DocxViewer } from './DocxViewer';
import { DocLegacyViewer } from './DocLegacyViewer';
import { ExcelViewer } from './ExcelViewer';
import { PptxViewer } from './PptxViewer';
import { PDFViewer } from './PDFViewer';
import { ImageViewer } from './ImageViewer';
import { AlertTriangle, Download, FileText, FileSpreadsheet, Presentation } from 'lucide-react';

interface UniversalDocumentViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  fileName: string;
  fileMimetype?: string;
  textContent?: string | null;
  onDownload?: () => void;
}

export const OfficeViewer: React.FC<UniversalDocumentViewerProps> = ({
  url,
  blob,
  arrayBuffer,
  fileName,
  fileMimetype = '',
  textContent,
  onDownload
}) => {
  const nameLower = fileName.toLowerCase();
  const mimeLower = fileMimetype.toLowerCase();

  // 1. PDF
  if (nameLower.endsWith('.pdf') || mimeLower.includes('pdf')) {
    return <PDFViewer url={url} blob={blob} arrayBuffer={arrayBuffer} title={fileName} />;
  }

  // 2. Microsoft Word Modern (.docx)
  if (nameLower.endsWith('.docx') || mimeLower.includes('officedocument.wordprocessingml.document')) {
    return (
      <DocxViewer
        url={url}
        blob={blob}
        arrayBuffer={arrayBuffer}
        title={fileName}
        onDownload={onDownload}
      />
    );
  }

  // 3. Microsoft Word Legacy (.doc, .rtf)
  if (
    nameLower.endsWith('.doc') || 
    nameLower.endsWith('.dot') || 
    nameLower.endsWith('.rtf') ||
    mimeLower.includes('msword') ||
    (mimeLower.includes('word') && !nameLower.endsWith('.docx'))
  ) {
    return (
      <DocLegacyViewer
        url={url}
        blob={blob}
        arrayBuffer={arrayBuffer}
        title={fileName}
        onDownload={onDownload}
      />
    );
  }

  // 4. Microsoft Excel (.xlsx, .xls, .csv, .ods, .tsv, .xlsm, .xlsb)
  if (
    nameLower.endsWith('.xlsx') ||
    nameLower.endsWith('.xls') ||
    nameLower.endsWith('.xlsm') ||
    nameLower.endsWith('.xlsb') ||
    nameLower.endsWith('.csv') ||
    nameLower.endsWith('.ods') ||
    nameLower.endsWith('.tsv') ||
    mimeLower.includes('spreadsheet') ||
    mimeLower.includes('excel') ||
    mimeLower.includes('csv')
  ) {
    return (
      <ExcelViewer
        url={url}
        blob={blob}
        arrayBuffer={arrayBuffer}
        title={fileName}
        onDownload={onDownload}
      />
    );
  }

  // 5. Microsoft PowerPoint (.pptx, .ppt)
  if (
    nameLower.endsWith('.pptx') ||
    nameLower.endsWith('.ppt') ||
    mimeLower.includes('presentation') ||
    mimeLower.includes('powerpoint')
  ) {
    return (
      <PptxViewer
        url={url}
        blob={blob}
        arrayBuffer={arrayBuffer}
        title={fileName}
        onDownload={onDownload}
      />
    );
  }

  // 6. Images
  if (
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(nameLower) ||
    mimeLower.startsWith('image/')
  ) {
    if (url) {
      return <ImageViewer url={url} title={fileName} />;
    }
  }

  // Legacy Word .doc fallback or unsupported office format with helpful guidance
  if (nameLower.endsWith('.doc')) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 text-center">
        <div className="max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white break-all">{fileName}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This document is saved in the legacy binary Word format (<code>.doc</code>). Modern web preview works best with standard Office Open XML (<code>.docx</code>).
            </p>
          </div>
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Download & Open in Word</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Generic document fallback
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 text-center">
      <div className="max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center mx-auto">
          <FileText className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white break-all">{fileName}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Preview is not directly supported for this format in browser. You can download the file directly to your computer.
          </p>
        </div>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-lg shadow-blue-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Download File</span>
          </button>
        )}
      </div>
    </div>
  );
};
