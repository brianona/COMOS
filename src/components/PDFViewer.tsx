import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Maximize, Minimize, RotateCcw } from 'lucide-react';

// Configure pdfjs worker to use local bundled worker via Vite ?url import
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
} catch (e) {
  console.warn('Could not set worker from url import, fallback to cdn/local:', e);
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '5.6.205'}/build/pdf.worker.min.mjs`;
}

interface PDFViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  title?: string;
  onDownload?: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url, blob, arrayBuffer, title, onDownload }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        let buffer: ArrayBuffer | null = null;

        // 1. ArrayBuffer provided directly
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          buffer = arrayBuffer.slice(0); // slice to prevent detached buffer
        } 
        // 2. Blob provided directly
        else if (blob && blob.size > 0) {
          try {
            buffer = await blob.arrayBuffer();
          } catch {
            buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as ArrayBuffer);
              reader.onerror = () => reject(new Error('Failed to read PDF blob'));
              reader.readAsArrayBuffer(blob);
            });
          }
        } 
        // 3. URL provided (blob:, data:, or http/relative URL)
        else if (url) {
          if (url.startsWith('blob:')) {
            try {
              const response = await fetch(url);
              if (!response.ok) throw new Error(`Blob status: ${response.status}`);
              buffer = await response.arrayBuffer();
            } catch (fetchErr) {
              // Fallback XHR for blob URL
              buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = () => {
                  if (xhr.status === 200 || xhr.status === 0) {
                    resolve(xhr.response);
                  } else {
                    reject(new Error(`Failed to load PDF via XHR (${xhr.status})`));
                  }
                };
                xhr.onerror = () => reject(new Error('Could not fetch PDF blob URL'));
                xhr.send();
              });
            }
          } else if (url.startsWith('data:')) {
            // Data URL
            const base64Index = url.indexOf(';base64,');
            if (base64Index !== -1) {
              const base64 = url.substring(base64Index + 8);
              const binaryStr = atob(base64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              buffer = bytes.buffer as ArrayBuffer;
            } else {
              const response = await fetch(url);
              buffer = await response.arrayBuffer();
            }
          } else {
            // HTTP or relative API URL
            const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || sessionStorage.getItem('token');
            const headers: Record<string, string> = {};
            if (token && (url.startsWith('/api/') || url.includes('/api/'))) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(url, { headers });
            if (!response.ok) {
              throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
            }
            buffer = await response.arrayBuffer();
          }
        } else {
          throw new Error('No PDF source provided');
        }

        if (isCancelled) return;

        if (!buffer || buffer.byteLength === 0) {
          throw new Error('PDF data is empty or invalid');
        }

        const data = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({
          data,
          cMapPacked: true,
        });
        const pdfDoc = await loadingTask.promise;

        if (!isCancelled) {
          setPdf(pdfDoc);
          setNumPages(pdfDoc.numPages);
          setPageNumber(1);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        let errorMessage = 'Failed to load PDF.';
        if (err?.message) {
          errorMessage += ` (${err.message})`;
        }
        if (err?.name === 'PasswordException') {
          errorMessage = 'This PDF is password protected.';
        } else if (err?.name === 'InvalidPDFException') {
          errorMessage = 'The file is not a valid PDF.';
        } else if (err?.name === 'MissingPDFException') {
          errorMessage = 'The PDF file is missing.';
        }
        
        if (!isCancelled) {
          setError(errorMessage);
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [url, blob, arrayBuffer]);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return;

      try {
        const page = await pdf.getPage(pageNumber);
        if (isCancelled || !canvasRef.current) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context || isCancelled) return;

        // Support crisp rendering on high-DPI displays
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 
          ? [outputScale, 0, 0, outputScale, 0, 0] 
          : undefined;

        const renderContext = {
          canvasContext: context,
          transform,
          viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdf, pageNumber, scale]);

  // Handle Ctrl/Cmd + Wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = 0.15;
        if (e.deltaY < 0) {
          setScale(prev => Math.min(prev + zoomFactor, 4));
        } else {
          setScale(prev => Math.max(prev - zoomFactor, 0.4));
        }
      }
    };

    const viewportEl = viewportRef.current;
    if (viewportEl) {
      viewportEl.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (viewportEl) {
        viewportEl.removeEventListener('wheel', handleWheel);
      }
    };
  }, [pdf]);

  const handleFitToWidth = async () => {
    if (!pdf || !viewportRef.current) return;
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = viewportRef.current.clientWidth - 48; // padding
      const newScale = containerWidth / viewport.width;
      setScale(Number(Math.min(Math.max(newScale, 0.4), 4).toFixed(2)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFitToPage = async () => {
    if (!pdf || !viewportRef.current) return;
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = viewportRef.current.clientWidth - 48;
      const containerHeight = viewportRef.current.clientHeight - 48;
      const scaleW = containerWidth / viewport.width;
      const scaleH = containerHeight / viewport.height;
      const newScale = Math.min(scaleW, scaleH);
      setScale(Number(Math.min(Math.max(newScale, 0.4), 4).toFixed(2)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetScale = () => {
    setScale(1.25);
  };

  const handleTriggerDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = title || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 overflow-hidden select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 text-slate-200 z-10 shrink-0">
        <div className="flex items-center gap-3">
          {/* Page navigation */}
          <div className="flex items-center gap-1 bg-slate-850 px-2 py-1 rounded-lg border border-slate-700/50">
            <button
              onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
              disabled={pageNumber <= 1 || loading}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium text-slate-300 px-1 whitespace-nowrap">
              {numPages > 0 ? `${pageNumber} / ${numPages}` : '...'}
            </span>
            <button
              onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
              disabled={pageNumber >= numPages || loading}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-850 px-1.5 py-1 rounded-lg border border-slate-700/50">
            <button
              onClick={() => setScale(prev => Math.max(prev - 0.2, 0.4))}
              disabled={loading}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom Out (Ctrl+Scroll)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium text-slate-300 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(prev => Math.min(prev + 0.2, 4))}
              disabled={loading}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom In (Ctrl+Scroll)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden md:block" />

          {/* Sizing Presets */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={handleFitToWidth}
              disabled={loading}
              className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
              title="Fit to Container Width"
            >
              <Maximize className="w-3.5 h-3.5" />
              <span>Width</span>
            </button>
            <button
              onClick={handleFitToPage}
              disabled={loading}
              className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
              title="Fit Full Page"
            >
              <Minimize className="w-3.5 h-3.5" />
              <span>Fit Page</span>
            </button>
            <button
              onClick={handleResetScale}
              disabled={loading}
              className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
              title="Reset Zoom to 125%"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {(url || onDownload) && (
            <button
              type="button"
              onClick={handleTriggerDownload}
              className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Viewport */}
      <div 
        ref={viewportRef}
        className="flex-1 overflow-auto p-4 md:p-6 flex justify-center items-start bg-slate-900/90 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400 m-auto py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs font-semibold">Rendering PDF page...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center p-8 m-auto max-w-sm">
            <div className="p-4 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
              <Download className="w-8 h-8 text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1">Preview Unavailable</p>
              <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
            </div>
            {(url || onDownload) && (
              <button
                type="button"
                onClick={handleTriggerDownload}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download to View</span>
              </button>
            )}
          </div>
        ) : (
          <div className="inline-block shadow-2xl shadow-black/80 bg-white rounded-sm overflow-hidden flex-shrink-0 my-auto">
            <canvas 
              ref={canvasRef} 
              className="block" 
            />
          </div>
        )}
      </div>
    </div>
  );
};
