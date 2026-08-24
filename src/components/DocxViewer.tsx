import React, { useEffect, useRef, useState } from 'react';
import mammoth from 'mammoth';
import { renderAsync } from 'docx-preview';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Loader2, 
  AlertTriangle, 
  FileText, 
  Search, 
  Printer, 
  Copy, 
  Check, 
  Download,
  Sparkles,
  Layout
} from 'lucide-react';

interface DocxViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  title?: string;
  onDownload?: () => void;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({
  url,
  blob,
  arrayBuffer,
  title,
  onDownload
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [viewEngine, setViewEngine] = useState<'mammoth' | 'layout'>('mammoth');
  const [mammothHtml, setMammothHtml] = useState<string>('');
  const [docBuffer, setDocBuffer] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadDocx = async () => {
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
              reader.onerror = () => reject(new Error('Failed to read blob'));
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
                xhr.onerror = () => reject(new Error('Failed to load Word document stream'));
                xhr.send();
              });
            }
          } else {
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`Failed to download Word document (${res.status} ${res.statusText})`);
            }
            buffer = await res.arrayBuffer();
          }
        } else {
          throw new Error('No document source provided');
        }

        if (isCancelled || !buffer || buffer.byteLength === 0) {
          if (!buffer || buffer.byteLength === 0) {
            throw new Error('Document buffer is empty');
          }
          return;
        }

        setDocBuffer(buffer);

        // Convert using Mammoth as primary high-performance engine
        try {
          const mammothResult = await mammoth.convertToHtml(
            { arrayBuffer: buffer },
            {
              convertImage: mammoth.images.dataUri,
              includeDefaultStyleMap: true
            }
          );
          if (!isCancelled) {
            setMammothHtml(mammothResult.value || '<p><em>(Empty document)</em></p>');
          }
        } catch (mammothErr: any) {
          console.warn('Mammoth conversion error, switching to layout renderer:', mammothErr);
          setViewEngine('layout');
        }

        if (!isCancelled) {
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Docx rendering error:', err);
        if (!isCancelled) {
          setError(err.message || 'Failed to render Word document');
          setLoading(false);
        }
      }
    };

    loadDocx();

    return () => {
      isCancelled = true;
    };
  }, [url, blob, arrayBuffer]);

  // Render layout mode if selected
  useEffect(() => {
    if (viewEngine !== 'layout' || !docBuffer || !containerRef.current) return;

    containerRef.current.innerHTML = '';
    renderAsync(docBuffer, containerRef.current, undefined, {
      className: 'docx-rendered-document',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      experimental: true,
      trimXmlDeclaration: true
    }).catch(err => {
      console.error('Layout render error:', err);
    });
  }, [viewEngine, docBuffer]);

  // Handle Search in rendered DOM
  useEffect(() => {
    if (!containerRef.current || loading || error) return;

    // Remove previous highlights
    const existingHighlights = containerRef.current.querySelectorAll('.docx-search-match');
    existingHighlights.forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });

    if (!searchTerm.trim()) {
      setMatchCount(null);
      return;
    }

    const query = searchTerm.trim().toLowerCase();
    let count = 0;

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const lower = text.toLowerCase();
        const index = lower.indexOf(query);
        if (index >= 0) {
          count++;
          const span = document.createElement('mark');
          span.className = 'docx-search-match bg-amber-300 text-slate-900 rounded px-0.5 font-bold';
          
          const before = text.substring(0, index);
          const match = text.substring(index, index + query.length);
          const after = text.substring(index + query.length);

          const afterNode = document.createTextNode(after);
          span.textContent = match;

          const parent = node.parentNode;
          if (parent) {
            parent.insertBefore(document.createTextNode(before), node);
            parent.insertBefore(span, node);
            parent.insertBefore(afterNode, node);
            parent.removeChild(node);
            walk(afterNode);
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE' && node.nodeName !== 'MARK') {
        Array.from(node.childNodes).forEach(walk);
      }
    };

    walk(containerRef.current);
    setMatchCount(count);
  }, [searchTerm, loading, error, viewEngine, mammothHtml]);

  const handleCopyAllText = () => {
    if (containerRef.current) {
      const text = containerRef.current.innerText;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (!containerRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${title || 'Word Document'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111; line-height: 1.6; }
            table { border-collapse: collapse; width: 100%; margin: 16px 0; }
            th, td { border: 1px solid #ccc; padding: 8px 12px; }
            th { background: #f4f4f4; font-weight: bold; }
            img { max-width: 100%; height: auto; }
            h1, h2, h3, h4, h5, h6 { color: #0f172a; margin-top: 1.2em; margin-bottom: 0.5em; }
            p { margin: 0.8em 0; }
            ul, ol { padding-left: 24px; }
          </style>
        </head>
        <body>
          ${containerRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  return (
    <div 
      ref={wrapperRef}
      className={`flex flex-col h-full w-full bg-slate-900 text-slate-100 overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-[9999]' : 'relative'
      }`}
    >
      {/* Toolbar */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0 flex-wrap">
        {/* Left: Document indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-200 truncate max-w-xs" title={title}>
            {title || 'Word Document (.docx)'}
          </span>
          <span className="px-2 py-0.5 bg-blue-500/15 text-blue-300 rounded text-[10px] font-bold tracking-wider uppercase border border-blue-500/20 hidden sm:inline flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-400" />
            Mammoth Engine
          </span>
        </div>

        {/* Center: Search */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1 focus:outline-none focus:border-blue-500"
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
          {matchCount !== null && (
            <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>

        {/* Right: Controls (Engine Toggle, Zoom, Copy, Print, Download, Fullscreen) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* View Mode Toggle */}
          <div className="hidden md:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setViewEngine('mammoth')}
              className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-colors ${
                viewEngine === 'mammoth' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mammoth HTML View"
            >
              <Sparkles className="w-3 h-3" />
              <span>Mammoth</span>
            </button>
            <button
              type="button"
              onClick={() => setViewEngine('layout')}
              className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-colors ${
                viewEngine === 'layout' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Paged Layout View"
            >
              <Layout className="w-3 h-3" />
              <span>Layout</span>
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
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-700 transition-colors"
              title="Reset Zoom (100%)"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyAllText}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 flex items-center gap-1"
            title="Copy all document text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 hidden sm:flex"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm"
              title="Download Word Document"
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

      {/* Main Document Content Area */}
      <div className="flex-1 overflow-auto bg-slate-800/80 p-4 sm:p-8 flex justify-center items-start">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-sm font-medium text-slate-300">Rendering Word document with Mammoth...</p>
          </div>
        ) : error ? (
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Cannot Preview Document</h4>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-md shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Download Document</span>
              </button>
            )}
          </div>
        ) : (
          <div
            className="transition-transform duration-100 origin-top bg-white text-slate-900 shadow-2xl rounded-xl p-8 sm:p-14 min-h-[600px] w-full max-w-4xl border border-slate-200/80 docx-container-styled"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              marginBottom: `${Math.max(0, (zoom - 100) * 8)}px`
            }}
          >
            {viewEngine === 'mammoth' ? (
              <div 
                ref={containerRef}
                className="mammoth-rendered-content prose prose-slate max-w-none text-slate-900 leading-relaxed font-sans"
                dangerouslySetInnerHTML={{ __html: mammothHtml }}
              />
            ) : (
              <div ref={containerRef} className="docx-body prose max-w-none text-slate-900" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

