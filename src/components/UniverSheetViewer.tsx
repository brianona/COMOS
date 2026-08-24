import React, { useEffect, useId, useRef, useState } from 'react';
import { createUniver } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { LocaleType } from '@univerjs/core';
import * as XLSX from 'xlsx';
import { Loader2, AlertTriangle, Maximize2, Minimize2, Download, Table, RefreshCw } from 'lucide-react';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';
import '@univerjs/preset-sheets-core/lib/index.css';

interface UniverSheetViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  title?: string;
  embedded?: boolean;
  onDownload?: () => void;
}

// Convert SheetJS workbook into Univer IWorkbookData snapshot format
export function convertXlsxToUniverSnapshot(wb: XLSX.WorkBook, title?: string) {
  const sheets: Record<string, any> = {};
  const sheetOrder: string[] = [];

  wb.SheetNames.forEach((sheetName, index) => {
    const cleanId = `sheet_${index + 1}_${sheetName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    sheetOrder.push(cleanId);

    const ws = wb.Sheets[sheetName];
    if (!ws) {
      sheets[cleanId] = {
        id: cleanId,
        name: sheetName,
        tabColor: '',
        hidden: 0,
        rowCount: 200,
        columnCount: 30,
        cellData: {},
        mergeData: [],
        columnData: {},
        rowData: {},
        defaultRowHeight: 24,
        defaultColumnWidth: 88,
        showGridlines: 1,
        status: index === 0 ? 1 : 0
      };
      return;
    }

    const cellData: Record<number, Record<number, any>> = {};
    let actualMaxRow = 0;
    let actualMaxCol = 0;

    // Scan all keys to find all cell coordinates and true maximum bounds
    const cellKeys = Object.keys(ws).filter(k => !k.startsWith('!'));
    
    cellKeys.forEach((cellAddress) => {
      try {
        const { r: R, c: C } = XLSX.utils.decode_cell(cellAddress);
        if (R > actualMaxRow) actualMaxRow = R;
        if (C > actualMaxCol) actualMaxCol = C;

        const cell = ws[cellAddress];
        if (cell && cell.v !== undefined && cell.v !== null) {
          if (!cellData[R]) {
            cellData[R] = {};
          }

          let cellType = 1; // String default
          let cellValue: any = cell.v;

          if (cell.t === 'n') {
            cellType = 2; // Number
            cellValue = typeof cell.v === 'number' ? cell.v : Number(cell.v);
          } else if (cell.t === 'b') {
            cellType = 3; // Boolean
            cellValue = cell.v ? 1 : 0;
          } else if (cell.v instanceof Date) {
            cellType = 1;
            cellValue = cell.w || cell.v.toLocaleDateString();
          } else {
            cellType = 1;
            cellValue = String(cell.v);
          }

          const cellObj: any = {
            v: cellValue,
            t: cellType
          };

          if (cell.f) {
            const formulaStr = String(cell.f);
            cellObj.f = formulaStr.startsWith('=') ? formulaStr : `=${formulaStr}`;
          }

          cellData[R][C] = cellObj;
        }
      } catch {
        // Skip invalid cell addresses
      }
    });

    // Also factor in !ref if available
    if (ws['!ref']) {
      try {
        const refRange = XLSX.utils.decode_range(ws['!ref']);
        if (refRange.e.r > actualMaxRow) actualMaxRow = refRange.e.r;
        if (refRange.e.c > actualMaxCol) actualMaxCol = refRange.e.c;
      } catch {}
    }

    // Process merged cells
    const mergeData: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> = [];
    if (ws['!merges'] && Array.isArray(ws['!merges'])) {
      ws['!merges'].forEach((m) => {
        mergeData.push({
          startRow: m.s.r,
          endRow: m.e.r,
          startColumn: m.s.c,
          endColumn: m.e.c
        });
        if (m.e.r > actualMaxRow) actualMaxRow = m.e.r;
        if (m.e.c > actualMaxCol) actualMaxCol = m.e.c;
      });
    }

    // Process column widths
    const columnData: Record<number, { w?: number }> = {};
    if (ws['!cols'] && Array.isArray(ws['!cols'])) {
      ws['!cols'].forEach((col, cIdx) => {
        if (col && (col.wpx || col.wch)) {
          columnData[cIdx] = {
            w: col.wpx ? col.wpx : Math.round(col.wch! * 8.5)
          };
        }
      });
    }

    // Process row heights
    const rowData: Record<number, { h?: number }> = {};
    if (ws['!rows'] && Array.isArray(ws['!rows'])) {
      ws['!rows'].forEach((row, rIdx) => {
        if (row && (row.hpx || row.hpt)) {
          rowData[rIdx] = {
            h: row.hpx ? row.hpx : Math.round(row.hpt! * 1.33)
          };
        }
      });
    }

    sheets[cleanId] = {
      id: cleanId,
      name: sheetName,
      tabColor: '',
      hidden: 0,
      rowCount: Math.max(actualMaxRow + 100, 200),
      columnCount: Math.max(actualMaxCol + 15, 30),
      cellData,
      mergeData,
      columnData,
      rowData,
      defaultRowHeight: 24,
      defaultColumnWidth: 90,
      showGridlines: 1,
      zoomRatio: 1,
      status: index === 0 ? 1 : 0
    };
  });

  return {
    id: `univer_wb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: title || 'Spreadsheet',
    appVersion: '0.25.1',
    locale: LocaleType.EN_US,
    styles: {},
    sheets,
    sheetOrder: sheetOrder.length > 0 ? sheetOrder : ['sheet_1']
  };
}

export const UniverSheetViewer: React.FC<UniverSheetViewerProps> = ({
  url,
  blob,
  arrayBuffer,
  title,
  embedded = false,
  onDownload
}) => {
  const containerId = useId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const containerRef = useRef<HTMLDivElement>(null);
  const univerInstanceRef = useRef<{ univer: any; univerAPI: any } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeSheetCount, setActiveSheetCount] = useState<number>(0);

  const destroyUniver = () => {
    if (univerInstanceRef.current) {
      const instance = univerInstanceRef.current;
      univerInstanceRef.current = null;
      try {
        if (typeof instance.univer?.dispose === 'function') {
          instance.univer.dispose();
        } else if (typeof instance.univerAPI?.dispose === 'function') {
          instance.univerAPI.dispose();
        }
      } catch (e) {
        console.warn('Error disposing Univer instance:', e);
      }
    }
  };

  const triggerLayoutRecalculation = () => {
    const trigger = () => {
      window.dispatchEvent(new Event('resize'));
    };
    trigger();
    requestAnimationFrame(trigger);
    setTimeout(trigger, 50);
    setTimeout(trigger, 150);
    setTimeout(trigger, 300);
  };

  const loadSpreadsheet = async () => {
    setLoading(true);
    setError(null);

    try {
      let rawBuffer: ArrayBuffer | null = null;

      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        rawBuffer = arrayBuffer;
      } else if (blob && blob.size > 0) {
        rawBuffer = await blob.arrayBuffer();
      } else if (url) {
        if (url.startsWith('data:')) {
          const base64Data = url.split(',')[1];
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          rawBuffer = bytes.buffer;
        } else {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            rawBuffer = await res.arrayBuffer();
          } catch (fetchErr: any) {
            // XHR fallback
            rawBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', url, true);
              xhr.responseType = 'arraybuffer';
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve(xhr.response as ArrayBuffer);
                } else {
                  reject(new Error(`XHR HTTP ${xhr.status}`));
                }
              };
              xhr.onerror = () => reject(new Error('Network error downloading document'));
              xhr.send();
            });
          }
        }
      }

      if (!rawBuffer || rawBuffer.byteLength === 0) {
        throw new Error('Spreadsheet file contains no data or could not be loaded');
      }

      // Parse with SheetJS
      let wb: XLSX.WorkBook | null = null;
      try {
        wb = XLSX.read(rawBuffer, {
          type: 'array',
          cellFormula: true,
          cellStyles: true,
          cellDates: true
        });
      } catch (parseErr: any) {
        console.warn('Initial XLSX parse failed, trying binary fallback:', parseErr);
        wb = XLSX.read(rawBuffer, { type: 'binary' });
      }

      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('Unable to parse spreadsheet sheets or workbook is empty');
      }

      setActiveSheetCount(wb.SheetNames.length);
      const snapshot = convertXlsxToUniverSnapshot(wb, title || 'Spreadsheet');

      // Cleanup prior instance synchronously
      destroyUniver();

      const containerNode = containerRef.current;
      if (!containerNode) {
        throw new Error('Viewer mount container is not ready');
      }

      // Clear container DOM
      containerNode.innerHTML = '';

      // Create Univer instance
      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: UniverPresetSheetsCoreEnUS
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerNode,
            header: true,
            toolbar: true,
            formulaBar: true
          })
        ]
      });

      univerInstanceRef.current = { univer, univerAPI };

      // Initialize Workbook in Univer
      univerAPI.createWorkbook(snapshot);
      setLoading(false);

      // Force canvas layout recalculation after mounting
      triggerLayoutRecalculation();
    } catch (err: any) {
      console.error('Error loading XLSX in Univer:', err);
      setError(err.message || 'Failed to initialize Univer spreadsheet engine');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpreadsheet();

    return () => {
      destroyUniver();
    };
  }, [url, blob, arrayBuffer]);

  // Keep Univer canvas dimensions responsive to any container resize
  useEffect(() => {
    if (!containerRef.current) return;

    let resizeTimer: any = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    });

    observer.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, []);

  // Recalculate layout on fullscreen toggle
  useEffect(() => {
    triggerLayoutRecalculation();
  }, [isFullscreen]);

  if (embedded) {
    return (
      <div className="w-full h-full flex-1 min-h-0 flex flex-col relative bg-slate-900 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm font-medium text-slate-200">Initializing Univer Spreadsheet Engine...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center p-6 z-20">
            <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Spreadsheet Preview Error</h4>
                <p className="text-xs text-slate-400">{error}</p>
              </div>
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Spreadsheet</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Univer DOM Mount Node */}
        <div
          id={`univer_${containerId}`}
          ref={containerRef}
          className="w-full h-full flex-1 min-h-0 univer-container relative"
          style={{ width: '100%', height: '100%', minHeight: '0', position: 'relative' }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : 'w-full h-full min-h-0 flex-1'
      }`}
    >
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Table className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-200 truncate">{title || 'Spreadsheet'}</h3>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md shrink-0">
                Univer API
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {activeSheetCount > 0 ? `${activeSheetCount} Sheet${activeSheetCount > 1 ? 's' : ''}` : 'Excel Spreadsheet'} • Canvas Formula Engine
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadSpreadsheet}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
            title="Reload Spreadsheet"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm"
              title="Download Excel File"
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

      {/* Main Content Area */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden w-full h-full min-h-0 flex flex-col">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm font-medium text-slate-200">Initializing Univer Spreadsheet Engine...</p>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center p-6 z-20">
            <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Spreadsheet Preview Error</h4>
                <p className="text-xs text-slate-400">{error}</p>
              </div>
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Spreadsheet</span>
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Univer DOM Mount Node */}
        <div
          id={`univer_${containerId}`}
          ref={containerRef}
          className="w-full h-full flex-1 min-h-0 univer-container relative"
          style={{ width: '100%', height: '100%', minHeight: '0', position: 'relative' }}
        />
      </div>
    </div>
  );
};

