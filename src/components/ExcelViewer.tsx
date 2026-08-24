import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Download, 
  Copy, 
  Check, 
  Printer, 
  Loader2, 
  AlertTriangle,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles
} from 'lucide-react';
import { UniverSheetViewer } from './UniverSheetViewer';

interface ExcelViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  title?: string;
  onDownload?: () => void;
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({
  url,
  blob,
  arrayBuffer,
  title,
  onDownload
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [zoom, setZoom] = useState(100);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hideEmptyRows, setHideEmptyRows] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number; val: any } | null>(null);
  const [excelViewMode, setExcelViewMode] = useState<'univer' | 'grid' | 'document'>('univer');

  useEffect(() => {
    let isCancelled = false;

    const loadWorkbook = async () => {
      setLoading(true);
      setError(null);

      try {
        let buffer: ArrayBuffer | null = null;

        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          buffer = arrayBuffer;
        } else if (blob && blob.size > 0) {
          try {
            buffer = await blob.arrayBuffer();
          } catch {
            buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as ArrayBuffer);
              reader.onerror = () => reject(new Error('Failed to read blob data'));
              reader.readAsArrayBuffer(blob);
            });
          }
        } else if (url) {
          if (url.startsWith('blob:')) {
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error(`Status ${res.status}`);
              buffer = await res.arrayBuffer();
            } catch {
              buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = () => {
                  if (xhr.status === 200 || xhr.status === 0) {
                    resolve(xhr.response);
                  } else {
                    reject(new Error(`Failed to load blob via XHR (${xhr.status})`));
                  }
                };
                xhr.onerror = () => reject(new Error('Failed to fetch spreadsheet resource'));
                xhr.send();
              });
            }
          } else {
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`Failed to load Excel file (${res.status} ${res.statusText})`);
            }
            buffer = await res.arrayBuffer();
          }
        } else {
          throw new Error('No spreadsheet source provided');
        }

        if (isCancelled || !buffer || buffer.byteLength === 0) {
          if (!buffer || buffer.byteLength === 0) {
            throw new Error('Spreadsheet file is empty');
          }
          return;
        }

        let wb: XLSX.WorkBook | null = null;
        
        // Pass 1: Standard rich parse
        try {
          wb = XLSX.read(buffer, {
            type: 'array',
            cellFormula: true,
            cellHTML: true,
            cellStyles: true,
            cellDates: true
          });
        } catch (firstErr) {
          console.warn('Pass 1 rich parse failed, attempting Pass 2 raw binary mode:', firstErr);
        }

        // Pass 2: Raw binary parse for legacy BIFF .xls
        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
          try {
            wb = XLSX.read(new Uint8Array(buffer), {
              type: 'array',
              raw: true,
              dense: false
            });
          } catch (secondErr) {
            console.warn('Pass 2 raw parse failed, attempting Pass 3 text/csv/tsv decode:', secondErr);
          }
        }

        // Pass 3: Text fallback for tab-separated or csv masked as xls
        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
          try {
            const decoder = new TextDecoder('utf-8');
            const textStr = decoder.decode(buffer);
            wb = XLSX.read(textStr, { type: 'string' });
          } catch (thirdErr) {
            console.warn('Pass 3 string decode failed:', thirdErr);
          }
        }

        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
          throw new Error('This workbook contains no visible worksheets or is not a supported spreadsheet format');
        }

        if (!isCancelled) {
          setWorkbook(wb);
          setActiveSheetName(wb.SheetNames[0]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error loading Excel workbook:', err);
        if (!isCancelled) {
          setError(err.message || 'Failed to read Excel spreadsheet');
          setLoading(false);
        }
      }
    };

    loadWorkbook();

    return () => {
      isCancelled = true;
    };
  }, [url, blob, arrayBuffer]);

  // Convert column index (0-indexed) to Excel column name (A, B, ..., Z, AA, AB, ...)
  const colToLetter = (colIndex: number): string => {
    let temp = colIndex;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // Parse active sheet into matrix
  const sheetData = useMemo(() => {
    if (!workbook || !activeSheetName) return { rows: [], maxCols: 0, range: null };

    const worksheet = workbook.Sheets[activeSheetName];
    if (!worksheet) return { rows: [], maxCols: 0, range: null };

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: true,
      raw: false
    });

    let maxCols = range.e.c + 1;
    rawRows.forEach((r) => {
      if (r && r.length > maxCols) maxCols = r.length;
    });

    // Ensure rectangular matrix
    const normalizedRows = rawRows.map((row, rIdx) => {
      const fullRow = Array.from({ length: maxCols }, (_, cIdx) => {
        const cellVal = row && row[cIdx] !== undefined ? row[cIdx] : '';
        return cellVal;
      });
      return {
        rowIndex: rIdx + 1,
        cells: fullRow,
        isEmpty: fullRow.every((c) => c === '' || c === null || c === undefined)
      };
    });

    return {
      rows: normalizedRows,
      maxCols,
      range
    };
  }, [workbook, activeSheetName]);

  // Filter rows based on search term & hide empty toggle
  const filteredRows = useMemo(() => {
    let result = sheetData.rows;

    if (hideEmptyRows) {
      result = result.filter((r) => !r.isEmpty);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((r) =>
        r.cells.some((cellVal) => String(cellVal || '').toLowerCase().includes(q))
      );
    }

    return result;
  }, [sheetData.rows, hideEmptyRows, searchTerm]);

  const matchStats = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const q = searchTerm.trim().toLowerCase();
    let count = 0;
    sheetData.rows.forEach((r) => {
      r.cells.forEach((c) => {
        if (String(c || '').toLowerCase().includes(q)) count++;
      });
    });
    return count;
  }, [sheetData.rows, searchTerm]);

  const handleCopySheetAsCSV = () => {
    if (!workbook || !activeSheetName) return;
    const worksheet = workbook.Sheets[activeSheetName];
    if (!worksheet) return;
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    if (!workbook || !activeSheetName) return;
    const worksheet = workbook.Sheets[activeSheetName];
    if (!worksheet) return;
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'Spreadsheet'}_${activeSheetName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className={`flex flex-col h-full w-full bg-slate-900 text-slate-100 overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-[9999]' : 'relative'
      }`}
    >
      {/* Top Main Toolbar */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0 flex-wrap">
        {/* Left: Document info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-200 truncate max-w-xs" title={title}>
            {title || 'Excel Spreadsheet'}
          </span>
          <span className="px-2 py-0.5 bg-teal-500/15 text-teal-300 rounded text-[10px] font-bold tracking-wider uppercase border border-teal-500/20 hidden sm:inline">
            {(title || '').toLowerCase().endsWith('.xls')
              ? 'Excel 97-2004 (.XLS)'
              : (title || '').toLowerCase().endsWith('.csv')
              ? 'CSV Spreadsheet'
              : 'Excel Workbook (.XLSX)'}
          </span>
        </div>

        {/* Center: Search & Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search spreadsheet cells..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1 focus:outline-none focus:border-teal-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
          {matchStats !== null && (
            <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">
              {matchStats} {matchStats === 1 ? 'cell match' : 'cell matches'}
            </span>
          )}

          <button
            type="button"
            onClick={() => setHideEmptyRows((h) => !h)}
            className={`px-2 py-1 rounded-lg border text-xs font-bold transition-colors flex items-center gap-1 shrink-0 ${
              hideEmptyRows 
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle hiding completely empty rows"
          >
            <Filter className="w-3 h-3" />
            <span className="hidden md:inline">Hide Blanks</span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setExcelViewMode('univer')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors ${
                excelViewMode === 'univer' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Univer API Canvas Engine (Full Excel Spreadsheet)"
            >
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span>Univer</span>
            </button>
            <button
              type="button"
              onClick={() => setExcelViewMode('grid')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors ${
                excelViewMode === 'grid' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Fast Data Grid View"
            >
              <TableIcon className="w-3 h-3" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setExcelViewMode('document')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors ${
                excelViewMode === 'document' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Formatted Document Table View"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Document</span>
            </button>
          </div>

          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] font-bold text-slate-300 min-w-10 text-center">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(180, z + 10))}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-700 transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopySheetAsCSV}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 flex items-center gap-1"
            title="Copy current sheet as CSV text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              const rowsHtml = filteredRows.map(r => 
                `<tr>${r.cells.map(c => `<td>${c !== undefined && c !== null ? String(c) : ''}</td>`).join('')}</tr>`
              ).join('');
              printWindow.document.write(`
                <html>
                  <head>
                    <title>${title || 'Spreadsheet'} - ${activeSheetName}</title>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #111; }
                      h2 { margin-bottom: 12px; color: #0f172a; }
                      table { border-collapse: collapse; width: 100%; font-size: 12px; }
                      td, th { border: 1px solid #cbd5e1; padding: 6px 10px; }
                      tr:nth-child(even) { background-color: #f8fafc; }
                    </style>
                  </head>
                  <body>
                    <h2>${title || 'Spreadsheet'} — ${activeSheetName}</h2>
                    <table><tbody>${rowsHtml}</tbody></table>
                  </body>
                </html>
              `);
              printWindow.document.close();
              printWindow.focus();
              setTimeout(() => {
                printWindow.print();
                printWindow.close();
              }, 400);
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 hidden sm:flex"
            title="Print Worksheet"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 hidden sm:flex items-center gap-1"
            title="Export this sheet to CSV file"
          >
            <TableIcon className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-[11px] font-bold">CSV</span>
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="p-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors shadow-sm"
              title="Download original spreadsheet file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Formula / Active Cell Value Bar */}
      {excelViewMode !== 'univer' && (
        <div className="px-4 py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center gap-3 text-xs font-mono shrink-0">
          <div className="px-2 py-0.5 bg-slate-800 text-teal-300 border border-slate-700 rounded font-bold min-w-14 text-center">
            {selectedCell ? `${colToLetter(selectedCell.c)}${selectedCell.r}` : 'A1'}
          </div>
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-0.5 text-slate-300 truncate select-text">
            {selectedCell ? String(selectedCell.val ?? '') : (sheetData.rows[0]?.cells[0] ? String(sheetData.rows[0].cells[0]) : '')}
          </div>
          <div className="text-[11px] text-slate-500 font-sans hidden sm:block">
            {filteredRows.length.toLocaleString()} rows • {sheetData.maxCols} cols
          </div>
        </div>
      )}

      {/* Grid Content Area */}
      <div className={`flex-1 relative bg-slate-950 min-h-0 ${excelViewMode === 'univer' ? 'flex flex-col overflow-hidden' : 'overflow-auto'}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            <p className="text-sm font-medium text-slate-300">Parsing Excel spreadsheet...</p>
          </div>
        ) : error ? (
          <div className="max-w-md w-full mx-auto my-12 bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Cannot Preview Spreadsheet</h4>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Download Spreadsheet</span>
              </button>
            )}
          </div>
        ) : excelViewMode === 'univer' ? (
          <div className="w-full h-full flex-1 min-h-0 bg-slate-900 flex flex-col relative overflow-hidden">
            <UniverSheetViewer
              url={url}
              blob={blob}
              arrayBuffer={arrayBuffer}
              title={title}
              embedded={true}
              onDownload={onDownload}
            />
          </div>
        ) : excelViewMode === 'document' ? (
          <div className="flex justify-center p-6 sm:p-10 bg-slate-900 min-h-full">
            <div 
              className="bg-white text-slate-900 shadow-2xl rounded-xl p-8 sm:p-12 w-full max-w-5xl transition-transform origin-top border border-slate-200 select-text"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                marginBottom: `${Math.max(0, (zoom - 100) * 8)}px`
              }}
            >
              <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{title || 'Spreadsheet'}</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Sheet: <span className="font-bold text-teal-700">{activeSheetName}</span></p>
                </div>
                <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold border border-teal-200">
                  {filteredRows.length} Rows
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <tbody>
                    {filteredRows.map((row, rIdx) => {
                      const isHeader = rIdx === 0;
                      return (
                        <tr 
                          key={row.rowIndex} 
                          className={isHeader ? 'bg-slate-100 font-bold text-slate-900' : rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                        >
                          {row.cells.map((cellVal: any, colIdx: number) => {
                            const strVal = String(cellVal ?? '');
                            const isMatch = searchTerm.trim() && strVal.toLowerCase().includes(searchTerm.trim().toLowerCase());
                            return (
                              <td 
                                key={colIdx} 
                                className={`border border-slate-300 px-3 py-2 align-top break-words ${
                                  isMatch ? 'bg-amber-200 text-slate-900 font-bold' : ''
                                }`}
                              >
                                {strVal || <span className="text-slate-300">-</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="inline-block min-w-full p-2 select-text"
            style={{ fontSize: `${Math.round(12 * (zoom / 100))}px` }}
          >
            <table className="border-collapse border border-slate-700 text-slate-200 w-max bg-slate-900">
              <thead>
                <tr className="bg-slate-950 sticky top-0 z-10 shadow-xs">
                  {/* Corner box */}
                  <th className="border border-slate-700/80 bg-slate-950 px-2 py-1 text-slate-500 font-mono text-[11px] font-bold text-center w-12 sticky left-0 z-20">
                    #
                  </th>
                  {/* Column Letters (A, B, C...) */}
                  {Array.from({ length: sheetData.maxCols }, (_, colIdx) => (
                    <th
                      key={colIdx}
                      className="border border-slate-700/80 bg-slate-950 px-3 py-1 text-slate-400 font-mono text-[11px] font-bold text-center min-w-[90px]"
                    >
                      {colToLetter(colIdx)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.rowIndex} className="hover:bg-slate-800/60 transition-colors">
                    {/* Row Number */}
                    <td className="border border-slate-700/80 bg-slate-950 px-2 py-1 text-slate-500 font-mono text-[11px] font-bold text-center sticky left-0 z-10 select-none">
                      {row.rowIndex}
                    </td>
                    {/* Cells */}
                    {row.cells.map((cellVal: any, colIdx: number) => {
                      const strVal = String(cellVal ?? '');
                      const isSelected = selectedCell?.r === row.rowIndex && selectedCell?.c === colIdx;
                      const isMatch = searchTerm.trim() && strVal.toLowerCase().includes(searchTerm.trim().toLowerCase());

                      return (
                        <td
                          key={colIdx}
                          onClick={() => setSelectedCell({ r: row.rowIndex, c: colIdx, val: cellVal })}
                          className={`border border-slate-700/60 px-3 py-1.5 transition-colors cursor-cell align-top whitespace-pre-wrap break-words max-w-sm ${
                            isSelected
                              ? 'bg-teal-500/25 ring-2 ring-teal-400 z-1 text-white font-medium'
                              : isMatch
                              ? 'bg-amber-500/30 text-amber-200 font-bold'
                              : 'text-slate-200'
                          }`}
                        >
                          {strVal || <span className="text-transparent select-none">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sheet Tabs Footer */}
      {excelViewMode !== 'univer' && workbook && workbook.SheetNames && workbook.SheetNames.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0 overflow-x-auto text-xs">
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {workbook.SheetNames.map((name) => {
              const isActive = name === activeSheetName;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setActiveSheetName(name);
                    setSelectedCell(null);
                  }}
                  className={`px-3 py-1 rounded-md font-bold text-xs transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                    isActive
                      ? 'bg-teal-600 text-white border-teal-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                  }`}
                >
                  <TableIcon className="w-3 h-3" />
                  <span>{name}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 font-mono hidden md:block shrink-0">
            {workbook.SheetNames.length} sheet{workbook.SheetNames.length === 1 ? '' : 's'} in workbook
          </div>
        </div>
      )}
    </div>
  );
};
