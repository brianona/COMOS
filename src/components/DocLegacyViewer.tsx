import React, { useEffect, useMemo, useState } from 'react';
import { 
  FileText, 
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
  Type,
  AlignLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  Info
} from 'lucide-react';

interface DocLegacyViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  title?: string;
  onDownload?: () => void;
}

interface ParsedDocData {
  body: string;
  headers?: string;
  footers?: string;
  annotations?: string;
  paragraphs: string[];
  wordCount: number;
  charCount: number;
  fallback?: boolean;
}

export const DocLegacyViewer: React.FC<DocLegacyViewerProps> = ({
  url,
  blob,
  arrayBuffer,
  title = 'Document.doc',
  onDownload
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docData, setDocData] = useState<ParsedDocData | null>(null);
  const [zoom, setZoom] = useState(100);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [lineSpacing, setLineSpacing] = useState<'compact' | 'normal' | 'relaxed'>('normal');
  const [themeMode, setThemeMode] = useState<'white' | 'warm' | 'dark'>('white');
  const [activeTab, setActiveTab] = useState<'document' | 'raw' | 'details'>('document');

  // Client-side fallback extractor for binary CFBF / .doc stream / RTF
  const extractTextFromBinaryDoc = (buffer: ArrayBuffer): ParsedDocData => {
    const bytes = new Uint8Array(buffer);
    const textChunks: string[] = [];

    // Check if it is an RTF document masked as .doc
    try {
      const headerStr = String.fromCharCode(...Array.from(bytes.slice(0, 10)));
      if (headerStr.startsWith('{\\rtf')) {
        const fullStr = new TextDecoder('latin1').decode(buffer);
        // Strip RTF control words and formatting
        const rtfCleaned = fullStr
          .replace(/\\par[d]?\b/gi, '\n')
          .replace(/\\line\b/gi, '\n')
          .replace(/\\tab\b/gi, '\t')
          .replace(/\\'[0-9a-fA-F]{2}/g, match => {
            const code = parseInt(match.slice(2), 16);
            return String.fromCharCode(code);
          })
          .replace(/\\u([0-9]{2,5})\?/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
          .replace(/\\[a-zA-Z]+(-?\d+)?\s?/g, '')
          .replace(/[{}]/g, '')
          .split(/[\r\n]+/)
          .map(line => line.trim())
          .filter(line => line.length > 0);

        const body = rtfCleaned.join('\n\n');
        return {
          body,
          paragraphs: rtfCleaned,
          wordCount: body ? body.split(/\s+/).length : 0,
          charCount: body.length,
          fallback: true
        };
      }
    } catch (e) {
      console.warn('RTF detection skipped:', e);
    }

    // 1. Scan UTF-16LE text runs (Word 97-2004 primary character encoding in WordDocument stream)
    let currentUtf16 = '';
    for (let i = 0; i < bytes.length - 1; i += 2) {
      const code = bytes[i] | (bytes[i + 1] << 8);
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || (code >= 160 && code <= 0x02AF)) {
        currentUtf16 += String.fromCharCode(code);
      } else {
        if (currentUtf16.length >= 3) {
          textChunks.push(currentUtf16);
        }
        currentUtf16 = '';
      }
    }
    if (currentUtf16.length >= 3) {
      textChunks.push(currentUtf16);
    }

    // 2. Scan ASCII / Latin-1 8-bit text runs
    let currentAscii = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9 || (b >= 160 && b <= 255)) {
        currentAscii += String.fromCharCode(b);
      } else {
        if (currentAscii.length >= 4) {
          textChunks.push(currentAscii);
        }
        currentAscii = '';
      }
    }
    if (currentAscii.length >= 4) {
      textChunks.push(currentAscii);
    }

    // Filter and sanitize text paragraphs
    const OLE_NOISE = /^(Root Entry|WordDocument|1Table|0Table|Data|SummaryInformation|DocumentSummaryInformation|CompObj|ObjectPool|Microsoft Word Document|MSWordDoc|Word\.Document|StandardJet|Normal\.dotm?)/i;

    const rawLines = textChunks
      .flatMap(chunk => chunk.split(/[\r\n]+/))
      .map(s => s.trim())
      .filter(s => {
        if (s.length < 2) return false;
        if (OLE_NOISE.test(s)) return false;
        if (/^[^\w\s\(\)\[\]\{\}\.,:;'"\-\/]{4,}$/.test(s)) return false;
        return true;
      });

    // Deduplicate consecutive identical lines
    const paragraphs: string[] = [];
    rawLines.forEach(line => {
      if (paragraphs.length === 0 || paragraphs[paragraphs.length - 1] !== line) {
        paragraphs.push(line);
      }
    });

    const body = paragraphs.join('\n\n');
    return {
      body,
      paragraphs,
      wordCount: body ? body.split(/\s+/).length : 0,
      charCount: body.length,
      fallback: true
    };
  };

  useEffect(() => {
    let isCancelled = false;

    const parseDoc = async () => {
      setLoading(true);
      setError(null);

      try {
        let buffer: ArrayBuffer | null = null;
        let fileBlob: Blob | null = null;

        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          buffer = arrayBuffer;
          fileBlob = new Blob([buffer], { type: 'application/msword' });
        } else if (blob && blob.size > 0) {
          fileBlob = blob;
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
                xhr.onerror = () => reject(new Error('Failed to load document stream'));
                xhr.send();
              });
            }
          } else {
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`Failed to load document (${res.status} ${res.statusText})`);
            }
            buffer = await res.arrayBuffer();
          }
          if (buffer) {
            fileBlob = new Blob([buffer], { type: 'application/msword' });
          }
        } else {
          throw new Error('No document source provided');
        }

        if (isCancelled || !buffer || buffer.byteLength === 0) {
          if (!buffer || buffer.byteLength === 0) {
            throw new Error('Document file is empty');
          }
          return;
        }

        // Try server-side parser first
        let parsed: ParsedDocData | null = null;
        if (fileBlob) {
          try {
            const formData = new FormData();
            formData.append('file', fileBlob, title || 'file.doc');

            const serverRes = await fetch('/api/document/parse-doc', {
              method: 'POST',
              body: formData
            });

            if (serverRes.ok) {
              const data = await serverRes.json();
              if (data && data.success && data.paragraphs && data.paragraphs.length > 0) {
                parsed = {
                  body: data.body || '',
                  headers: data.headers || '',
                  footers: data.footers || '',
                  annotations: data.annotations || '',
                  paragraphs: data.paragraphs || [],
                  wordCount: data.wordCount || 0,
                  charCount: data.charCount || 0,
                  fallback: !!data.fallback
                };
              }
            }
          } catch (serverErr) {
            console.warn('Server doc parser unreachable, falling back to client-side binary decoder:', serverErr);
          }
        }

        // Fallback to client-side extraction
        if (!parsed || parsed.paragraphs.length === 0) {
          parsed = extractTextFromBinaryDoc(buffer);
        }

        if (!isCancelled) {
          if (!parsed.body && parsed.paragraphs.length === 0) {
            throw new Error('Could not extract readable text from this legacy .doc file. The file may be protected or empty.');
          }
          setDocData(parsed);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error parsing legacy .doc:', err);
        if (!isCancelled) {
          setError(err.message || 'Failed to preview Microsoft Word .doc file');
          setLoading(false);
        }
      }
    };

    parseDoc();

    return () => {
      isCancelled = true;
    };
  }, [url, blob, arrayBuffer, title]);

  const handleCopyText = async () => {
    if (!docData) return;
    try {
      await navigator.clipboard.writeText(docData.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Group paragraphs into virtual pages (approx 500 words per page)
  const virtualPages = useMemo(() => {
    if (!docData || docData.paragraphs.length === 0) return [];
    
    const pages: string[][] = [];
    let currentPage: string[] = [];
    let currentWords = 0;

    docData.paragraphs.forEach(para => {
      const words = para.split(/\s+/).length;
      if (currentWords + words > 450 && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [para];
        currentWords = words;
      } else {
        currentPage.push(para);
        currentWords += words;
      }
    });

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }, [docData]);

  // Match counter for search term
  const matchCount = useMemo(() => {
    if (!searchTerm.trim() || !docData) return 0;
    try {
      const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = docData.body.match(regex);
      return matches ? matches.length : 0;
    } catch (e) {
      return 0;
    }
  }, [searchTerm, docData]);

  // Helper to render formatted paragraph with search highlighting and heading styles
  const renderParagraph = (text: string, idx: number) => {
    const trimmed = text.trim();
    
    // Check if this looks like a section heading (short, all caps or title casing)
    const isHeading = 
      (trimmed.length < 80 && /^[A-Z0-9\s\.\-–—:]{4,}$/.test(trimmed)) ||
      (trimmed.length < 60 && /^(SECTION|ARTICLE|CHAPTER|PART|FORM|CHECKLIST|REPORT|MEMORANDUM|ANNEX|SCHEDULE)\s+[0-9A-Z\.\-]/i.test(trimmed));

    // Check if this looks like a key-value or bullet item
    const isBullet = /^[•\-\*–—\d+\.\)]\s+/.test(trimmed);
    const isKeyValue = /^([A-Za-z\s]{2,30}):\s*(.+)$/.test(trimmed);

    // Apply search highlighting
    let content: React.ReactNode = text;
    if (searchTerm.trim()) {
      const parts = text.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      content = parts.map((part, pIdx) => {
        if (part.toLowerCase() === searchTerm.toLowerCase()) {
          return (
            <mark key={pIdx} className="bg-amber-300 text-amber-950 font-bold px-1 rounded-xs">
              {part}
            </mark>
          );
        }
        return part;
      });
    }

    if (isHeading) {
      return (
        <h4 
          key={idx} 
          className="text-base sm:text-lg font-black text-slate-900 pt-5 pb-2 border-b border-slate-200 uppercase tracking-tight mt-4 first:mt-0"
        >
          {content}
        </h4>
      );
    }

    if (isKeyValue) {
      const match = trimmed.match(/^([A-Za-z\s]{2,30}):\s*(.+)$/);
      if (match && !searchTerm.trim()) {
        return (
          <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-1 py-1.5 border-b border-slate-100/80">
            <span className="font-bold text-slate-700 sm:w-1/3 shrink-0 text-xs">{match[1]}:</span>
            <span className="text-slate-800 font-medium flex-1 text-xs">{match[2]}</span>
          </div>
        );
      }
    }

    if (isBullet) {
      return (
        <div key={idx} className="flex items-start gap-2.5 py-1 pl-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-2" />
          <p className="text-slate-800 leading-relaxed font-normal flex-1">
            {content}
          </p>
        </div>
      );
    }

    return (
      <p key={idx} className="text-slate-800 leading-relaxed font-normal my-2.5 text-justify">
        {content}
      </p>
    );
  };

  // Font family styles
  const getFontFamilyClass = () => {
    switch (fontFamily) {
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono text-xs';
      default: return 'font-sans';
    }
  };

  // Font size styles
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default: return 'text-sm';
    }
  };

  // Line spacing styles
  const getLineSpacingClass = () => {
    switch (lineSpacing) {
      case 'compact': return 'leading-snug';
      case 'relaxed': return 'leading-loose';
      default: return 'leading-relaxed';
    }
  };

  // Theme page styles
  const getThemeClasses = () => {
    switch (themeMode) {
      case 'warm':
        return {
          container: 'bg-amber-950/20',
          page: 'bg-[#faf8f5] text-amber-950 border-amber-200/80 shadow-md shadow-amber-950/5'
        };
      case 'dark':
        return {
          container: 'bg-slate-950',
          page: 'bg-slate-900 text-slate-100 border-slate-800 shadow-xl'
        };
      default:
        return {
          container: 'bg-slate-800/80',
          page: 'bg-white text-slate-900 border-slate-200 shadow-xl'
        };
    }
  };

  const themeClasses = getThemeClasses();

  return (
    <div className={`flex flex-col h-full w-full bg-slate-900 text-slate-200 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate max-w-[280px] sm:max-w-md" title={title}>
                {title}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                Word 97-2004 (.DOC)
              </span>
            </div>
            {docData && (
              <p className="text-[11px] text-slate-400 font-medium">
                {docData.wordCount.toLocaleString()} words &bull; {docData.charCount.toLocaleString()} chars &bull; ~{virtualPages.length} {virtualPages.length === 1 ? 'page' : 'pages'}
                {docData.fallback && (
                  <span className="ml-2 text-amber-400 inline-flex items-center gap-1 font-semibold">
                    <Sparkles className="w-3 h-3" /> Direct Binary Stream
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            disabled={!docData || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Copy all document text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Text'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!docData || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-600/30 cursor-pointer"
              title="Download original .doc file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Secondary Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-900/95 border-b border-slate-800 text-xs shrink-0 select-none">
        {/* Search Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search document text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                &times;
              </button>
            )}
          </div>
          {searchTerm.trim() && (
            <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded-md shrink-0">
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>

        {/* View Layout & Formatting Options */}
        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-bold text-slate-300 min-w-[42px] text-center">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(200, z + 10))}
              className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors border-l border-slate-800 ml-0.5"
              title="Reset zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Typography selector */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setFontFamily('sans')}
              className={`px-2 py-1 text-[11px] font-medium rounded ${fontFamily === 'sans' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Sans
            </button>
            <button
              type="button"
              onClick={() => setFontFamily('serif')}
              className={`px-2 py-1 text-[11px] font-serif rounded ${fontFamily === 'serif' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Serif
            </button>
            <button
              type="button"
              onClick={() => setFontFamily('mono')}
              className={`px-2 py-1 text-[11px] font-mono rounded ${fontFamily === 'mono' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Mono
            </button>
          </div>

          {/* Page Theme */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setThemeMode('white')}
              className={`w-5 h-5 rounded bg-white border ${themeMode === 'white' ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-300'} transition-all`}
              title="Classic White Page"
            />
            <button
              type="button"
              onClick={() => setThemeMode('warm')}
              className={`w-5 h-5 rounded bg-[#f4ece1] border ${themeMode === 'warm' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-amber-300'} transition-all`}
              title="Warm Paper Page"
            />
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`w-5 h-5 rounded bg-slate-800 border ${themeMode === 'dark' ? 'border-blue-400 ring-2 ring-blue-400/30' : 'border-slate-700'} transition-all`}
              title="Night Mode"
            />
          </div>
        </div>
      </div>

      {/* Main Document Content Canvas */}
      <div className={`flex-1 overflow-auto p-4 sm:p-8 flex justify-center ${themeClasses.container}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4 my-auto">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-white">Extracting & Decoding Word Document...</p>
              <p className="text-xs text-slate-400">Parsing OLE2 Binary Structure (.doc format)</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 max-w-md my-auto bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">Unable to Preview .DOC File</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
            </div>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <Download className="w-4 h-4" /> Download & Open Locally
              </button>
            )}
          </div>
        ) : docData && (
          <div 
            className="flex flex-col items-center gap-8 w-full transition-transform duration-150 origin-top"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            {virtualPages.map((pageParagraphs, pageIndex) => (
              <div 
                key={pageIndex}
                className={`w-full max-w-[820px] min-h-[1050px] p-8 sm:p-14 rounded-2xl border transition-all ${themeClasses.page} ${getFontFamilyClass()} ${getFontSizeClass()} ${getLineSpacingClass()} relative flex flex-col justify-between`}
              >
                {/* Document Page Header (First page title or running header) */}
                <div className="border-b border-slate-200/80 pb-3 mb-6 flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider select-none font-semibold">
                  <span className="truncate max-w-xs">{title}</span>
                  <span>Page {pageIndex + 1} of {virtualPages.length}</span>
                </div>

                {/* Page Body Content */}
                <div className="flex-1">
                  {pageIndex === 0 && docData.headers && (
                    <div className="p-3 mb-4 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900 font-semibold italic">
                      {docData.headers}
                    </div>
                  )}

                  {pageParagraphs.map((para, pIdx) => renderParagraph(para, pIdx))}
                </div>

                {/* Page Footer */}
                <div className="border-t border-slate-200/80 pt-4 mt-8 flex justify-between items-center text-[10px] text-slate-400 select-none font-medium">
                  <span>Microsoft Word 97-2004 Document Preview</span>
                  <span>— {pageIndex + 1} —</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
