import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Maximize, Minimize, RotateCcw } from 'lucide-react';

// Set worker source - use unpkg for better reliability and match the version exactly
const PDF_JS_VERSION = '5.6.205';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
  title?: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch the PDF data manually with the token in headers
        // This is more reliable than letting pdf.js handle the fetch
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setPageNumber(1);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        let errorMessage = 'Failed to load PDF.';
        if (err.message) {
          errorMessage += ` (${err.message})`;
        }
        if (err.name === 'PasswordException') {
          errorMessage = 'This PDF is password protected.';
        } else if (err.name === 'InvalidPDFException') {
          errorMessage = 'The file is not a valid PDF.';
        } else if (err.name === 'MissingPDFException') {
          errorMessage = 'The PDF file is missing.';
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    };

    loadPdf();
  }, [url]);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return;

      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdf, pageNumber, scale]);

  // Handle Ctrl/Cmd + Wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = 0.1;
        if (e.deltaY < 0) {
          // Zoom In
          setScale(prev => Math.min(prev + zoomFactor, 5));
        } else {
          // Zoom Out
          setScale(prev => Math.max(prev - zoomFactor, 0.25));
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
      const containerWidth = viewportRef.current.clientWidth - 32; // subtracting padding
      const newScale = containerWidth / viewport.width;
      setScale(Number(Math.min(Math.max(newScale, 0.25), 5).toFixed(2)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFitToPage = async () => {
    if (!pdf || !viewportRef.current) return;
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = viewportRef.current.clientWidth - 32;
      const containerHeight = viewportRef.current.clientHeight - 32;
      const scaleW = containerWidth / viewport.width;
      const scaleH = containerHeight / viewport.height;
      const newScale = Math.min(scaleW, scaleH);
      setScale(Number(Math.min(Math.max(newScale, 0.25), 5).toFixed(2)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetScale = () => {
    setScale(1.5);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
              disabled={pageNumber <= 1}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
              Page {pageNumber} / {numPages}
            </span>
            <button
              onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
              disabled={pageNumber >= numPages}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="h-4 w-px bg-slate-700" />
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScale(prev => Math.max(prev - 0.25, 0.25))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Zoom Out (Ctrl+Scroll)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold text-slate-400 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(prev => Math.min(prev + 0.25, 5))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Zoom In (Ctrl+Scroll)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Sizing Presets */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleFitToWidth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              title="Fit to Width"
            >
              <Maximize className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Width</span>
            </button>
            <button
              onClick={handleFitToPage}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              title="Fit to Page"
            >
              <Minimize className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fit Page</span>
            </button>
            <button
              onClick={handleResetScale}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          title="Download PDF"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>

      {/* Viewport */}
      <div 
        ref={viewportRef}
        className="flex-1 overflow-auto p-4 flex justify-center items-start bg-slate-900 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-500 m-auto">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs font-medium">Rendering PDF...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center p-8 m-auto">
            <div className="p-4 bg-red-500/10 rounded-full">
              <Download className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1">Preview Unavailable</p>
              <p className="text-xs text-slate-400 max-w-[200px]">{error}</p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
            >
              Download to View
            </a>
          </div>
        ) : (
          <div className="relative inline-grid place-items-center shadow-2xl shadow-black/50 m-auto bg-white rounded-sm overflow-hidden flex-shrink-0">
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
