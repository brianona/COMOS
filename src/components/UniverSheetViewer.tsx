import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Loader2, 
  AlertTriangle, 
  Maximize2, 
  Minimize2, 
  Download, 
  Table, 
  RefreshCw, 
  Columns3,
  Search,
  ZoomIn,
  ZoomOut,
  Copy,
  Check
} from 'lucide-react';

interface UniverSheetViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  title?: string;
  embedded?: boolean;
  autoFit?: boolean;
  onDownload?: () => void;
}

export function convertXlsxToUniverSnapshot(wb: XLSX.WorkBook, title?: string, autoFit: boolean = true) {
  return wb;
}

export const UniverSheetViewer: React.FC<UniverSheetViewerProps> = ({
  url,
  blob,
  arrayBuffer,
  title,
  embedded = false,
  autoFit = true,
  onDownload
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(100);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadWorkbook = async () => {
      setLoading(true);
      setError(null);
      try {
        let dataBuffer: ArrayBuffer;
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          dataBuffer = arrayBuffer;
        } else if (blob) {
          dataBuffer = await blob.arrayBuffer();
        } else if (url) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
          dataBuffer = await res.arrayBuffer();
        } else {
          throw new Error('No data provided for Excel viewer');
        }

        const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true, cellStyles: true });
        if (isMounted) {
          setWorkbook(wb);
          if (wb.SheetNames.length > 0) {
            setActiveSheet(wb.SheetNames[0]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to render spreadsheet');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadWorkbook();
    return () => {
      isMounted = false;
    };
  }, [url, blob, arrayBuffer]);

  const sheetData = useMemo(() => {
    if (!workbook || !activeSheet || !workbook.Sheets[activeSheet]) return [];
    const ws = workbook.Sheets[activeSheet];
    return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  }, [workbook, activeSheet]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return sheetData;
    const q = searchQuery.toLowerCase();
    return sheetData.filter(row => 
      row.some(cell => String(cell || '').toLowerCase().includes(q))
    );
  }, [sheetData, searchQuery]);

  const handleCopy = () => {
    if (!workbook || !activeSheet) return;
    const ws = workbook.Sheets[activeSheet];
    const csv = XLSX.utils.sheet_to_csv(ws);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (workbook) {
      XLSX.writeFile(workbook, `${title || 'Spreadsheet'}.xlsx`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-600">Loading Excel Spreadsheet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-sm">Spreadsheet Viewer Error</h3>
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden h-full max-h-[85vh]">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-slate-800 truncate max-w-xs">{title || 'Spreadsheet View'}</span>
          <span className="text-[10px] text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full font-medium">
            {filteredRows.length} Rows
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search in sheet..."
              className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 w-36 sm:w-48"
            />
          </div>

          <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(60, z - 10))}
              className="p-1 hover:bg-slate-100 text-slate-600"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] font-bold text-slate-600">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(150, z + 10))}
              className="p-1 hover:bg-slate-100 text-slate-600"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg transition-colors"
            title="Copy sheet as CSV"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
            title="Download Spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Sheet Tabs */}
      {workbook && workbook.SheetNames.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 border-b border-slate-200 overflow-x-auto text-xs">
          {workbook.SheetNames.map(sheetName => (
            <button
              key={sheetName}
              type="button"
              onClick={() => setActiveSheet(sheetName)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeSheet === sheetName
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}

      {/* Grid Content */}
      <div 
        className="flex-1 overflow-auto p-4 bg-slate-50/50"
        style={{ fontSize: `${(zoom / 100) * 12}px` }}
      >
        {filteredRows.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Columns3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-semibold">No data found in this sheet.</p>
          </div>
        ) : (
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full border-collapse border border-slate-200 bg-white shadow-xs rounded-lg overflow-hidden">
              <tbody>
                {filteredRows.map((row, rIdx) => (
                  <tr 
                    key={rIdx} 
                    className={rIdx === 0 ? 'bg-slate-100/80 font-bold text-slate-800' : 'hover:bg-blue-50/30 text-slate-700'}
                  >
                    <td className="w-10 px-2 py-1.5 text-center text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200 select-none">
                      {rIdx + 1}
                    </td>
                    {row.map((cell, cIdx) => (
                      <td 
                        key={cIdx} 
                        className="px-3 py-1.5 border border-slate-200 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs"
                      >
                        {cell != null ? String(cell) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default UniverSheetViewer;
