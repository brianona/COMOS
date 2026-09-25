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
  BookOpen,
  Sparkles,
  Rows,
  Layers,
  ChevronRight,
  PenTool
} from 'lucide-react';

interface DocLegacyViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  title?: string;
  fileName?: string;
  onDownload?: () => void;
}

interface ParsedDocData {
  body: string;
  headers?: string;
  footers?: string;
  annotations?: string;
  textboxes?: string;
  paragraphs: string[];
  wordCount: number;
  charCount: number;
  fallback?: boolean;
}

// Structured Document Block types for high-fidelity Word layout
export type DocBlock = 
  | { type: 'heading'; text: string; level: 1 | 2 | 3 }
  | { type: 'table'; headers?: string[]; rows: string[][]; numCols: number }
  | { type: 'keyValueGrid'; items: { label: string; value: string }[] }
  | { type: 'signature'; items: { label: string; line?: string }[] }
  | { type: 'bullet'; marker: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'pageBreak' };

export const DocLegacyViewer: React.FC<DocLegacyViewerProps> = ({
  url,
  blob,
  arrayBuffer,
  title,
  fileName,
  onDownload
}) => {
  const displayTitle = title || fileName || 'Document.doc';
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
  const [viewMode, setViewMode] = useState<'paged' | 'flow'>('paged');

  // Client-side fallback extractor for binary CFBF / .doc stream / RTF
  const extractTextFromBinaryDoc = (buffer: ArrayBuffer): ParsedDocData => {
    const bytes = new Uint8Array(buffer);

    // 1. Check if it is an RTF document disguised as .doc
    try {
      const headerStr = String.fromCharCode(...Array.from(bytes.slice(0, 10)));
      if (headerStr.startsWith('{\\rtf')) {
        const fullStr = new TextDecoder('latin1').decode(buffer);
        const rtfCleaned = fullStr
          .replace(/\\page\b/gi, '\n[PAGE_BREAK]\n')
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

    // 2. Scan UTF-16LE text runs (Word 97-2004 primary character encoding)
    const utf16Chunks: string[] = [];
    let currentUtf16 = '';
    for (let i = 0; i < bytes.length - 1; i += 2) {
      const code = bytes[i] | (bytes[i + 1] << 8);
      if (code === 0x000c) {
        if (currentUtf16.trim().length >= 2) utf16Chunks.push(currentUtf16);
        utf16Chunks.push('\n[PAGE_BREAK]\n');
        currentUtf16 = '';
      } else if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || (code >= 160 && code <= 0x02AF)) {
        currentUtf16 += String.fromCharCode(code);
      } else {
        if (currentUtf16.length >= 3) {
          utf16Chunks.push(currentUtf16);
        }
        currentUtf16 = '';
      }
    }
    if (currentUtf16.length >= 3) {
      utf16Chunks.push(currentUtf16);
    }

    // Determine if UTF-16LE has high-quality document content
    const utf16TotalLen = utf16Chunks.reduce((acc, c) => acc + c.length, 0);
    let candidateChunks: string[] = [];

    if (utf16TotalLen > 150) {
      candidateChunks = utf16Chunks;
    } else {
      // 3. Fallback to 8-bit Latin-1 only if UTF-16 is empty
      let currentAscii = '';
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === 0x0c) {
          if (currentAscii.trim().length >= 2) candidateChunks.push(currentAscii);
          candidateChunks.push('\n[PAGE_BREAK]\n');
          currentAscii = '';
        } else if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9 || (b >= 160 && b <= 255)) {
          currentAscii += String.fromCharCode(b);
        } else {
          if (currentAscii.length >= 4) {
            candidateChunks.push(currentAscii);
          }
          currentAscii = '';
        }
      }
      if (currentAscii.length >= 4) {
        candidateChunks.push(currentAscii);
      }
    }

    // Filter and sanitize text paragraphs to prevent font tables & binary metadata leaking into latter pages
    const NOISE_FILTER = /^(Root Entry|WordDocument|1Table|0Table|Data|SummaryInformation|DocumentSummaryInformation|CompObj|ObjectPool|Microsoft Word Document|MSWordDoc|Word\.Document|StandardJet|Normal\.dotm?|Times New Roman|Calibri|Arial|Cambria|Wingdings|Symbol|Segoe UI|Courier New|Heading \d|Default Paragraph Font|Table Normal|Body Text|No List)/i;

    const rawLines = candidateChunks
      .flatMap(chunk => chunk.split(/[\r\n]+/))
      .map(s => s.trim())
      .filter(s => {
        if (s.length < 2) return false;
        if (s === '[PAGE_BREAK]') return true;
        if (NOISE_FILTER.test(s)) return false;
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
                  textboxes: data.textboxes || '',
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

  // Structured Block Parser: Converts flat paragraphs into semantic tables, headings, signatures, and grids
  const parsedBlocks = useMemo(() => {
    if (!docData || docData.paragraphs.length === 0) return [];

    const blocks: DocBlock[] = [];
    const paragraphs = docData.paragraphs;
    let i = 0;

    const isTabular = (text: string) => {
      const trimmed = text.trim();
      if (trimmed.includes('\t')) return true;
      // Also detect 2 or more column markers like " | " or double spaces between structured terms
      if (/\s{3,}/.test(trimmed) && trimmed.split(/\s{3,}/).length >= 2 && trimmed.length < 250) {
        return true;
      }
      return false;
    };

    const splitIntoCells = (text: string): string[] => {
      if (text.includes('\t')) {
        return text.split('\t').map(c => c.trim()).filter(Boolean);
      }
      return text.split(/\s{3,}/).map(c => c.trim()).filter(Boolean);
    };

    const isSignatureLine = (text: string) => {
      const lower = text.toLowerCase();
      const hasSigKeyword = /signature|signed|prepared by|approved by|reviewed by|chief engineer|master|superintendent|auditor|attendee/i.test(lower);
      const hasSigLine = /_{3,}|\.{4,}|date:|name:|rank:/i.test(lower);
      return hasSigKeyword || (hasSigLine && text.length < 120);
    };

    while (i < paragraphs.length) {
      const p = paragraphs[i].trim();

      // Explicit Page Break
      if (p === '[PAGE_BREAK]' || p === '\x0c' || p === '\f') {
        blocks.push({ type: 'pageBreak' });
        i++;
        continue;
      }

      // Check if this is a Signature Block (e.g. Master: ________ \t Chief Engineer: ________)
      if (isSignatureLine(p)) {
        const sigItems: { label: string; line?: string }[] = [];
        const cells = splitIntoCells(p);
        cells.forEach(cell => {
          const colonIdx = cell.indexOf(':');
          if (colonIdx !== -1) {
            sigItems.push({
              label: cell.substring(0, colonIdx).trim(),
              line: cell.substring(colonIdx + 1).trim()
            });
          } else {
            sigItems.push({ label: cell, line: '' });
          }
        });

        if (sigItems.length > 0) {
          blocks.push({ type: 'signature', items: sigItems });
          i++;
          continue;
        }
      }

      // Check for Table (Consecutive tabular rows)
      if (isTabular(p)) {
        const tableRows: string[][] = [];
        let maxCols = 0;

        while (i < paragraphs.length && isTabular(paragraphs[i].trim())) {
          const cells = splitIntoCells(paragraphs[i].trim());
          if (cells.length > 0) {
            tableRows.push(cells);
            if (cells.length > maxCols) maxCols = cells.length;
          }
          i++;
        }

        if (tableRows.length > 0 && maxCols >= 2) {
          // Normalize row column counts
          const normalizedRows = tableRows.map(row => {
            if (row.length < maxCols) {
              return [...row, ...Array(maxCols - row.length).fill('')];
            }
            return row;
          });

          // Check if row 0 looks like a table header
          const row0Text = normalizedRows[0].join(' ').toLowerCase();
          const looksLikeHeader = 
            /no\.?|item|description|area|action|status|remarks|target|date|name|rank|sign|qty|code|findings/i.test(row0Text) ||
            normalizedRows[0].every(c => c === c.toUpperCase() && c.length < 40);

          if (looksLikeHeader && normalizedRows.length > 1) {
            blocks.push({
              type: 'table',
              headers: normalizedRows[0],
              rows: normalizedRows.slice(1),
              numCols: maxCols
            });
          } else {
            blocks.push({
              type: 'table',
              rows: normalizedRows,
              numCols: maxCols
            });
          }
          continue;
        }
      }

      // Check for Key-Value grid (e.g. "Vessel Name: OCEAN \t Voyage: 24-A" or "Date: 2026-05-22")
      const kvMatches: { label: string; value: string }[] = [];
      const parts = p.split(/\t+|\s{3,}/);
      parts.forEach(part => {
        const m = part.trim().match(/^([A-Za-z0-9\s\/\.\-–]{2,35}):\s*(.+)$/);
        if (m) {
          kvMatches.push({ label: m[1].trim(), value: m[2].trim() });
        }
      });

      if (kvMatches.length > 0 && kvMatches.length === parts.length) {
        blocks.push({ type: 'keyValueGrid', items: kvMatches });
        i++;
        continue;
      }

      // Check for Section Headings
      const isHeading = 
        (p.length < 90 && /^[A-Z0-9\s\.\-–—:]{4,}$/.test(p)) ||
        (p.length < 80 && /^(SECTION|ARTICLE|CHAPTER|PART|FORM|CHECKLIST|REPORT|MEMORANDUM|ANNEX|SCHEDULE|AGENDA|MINUTES|SUMMARY|ACTION ITEMS?)\b/i.test(p)) ||
        (p.length < 75 && /^(\d+\.){1,3}\s+[A-Z]/i.test(p));

      if (isHeading) {
        blocks.push({ type: 'heading', text: p, level: p.length < 40 ? 1 : 2 });
        i++;
        continue;
      }

      // Check for Bullet points / Checklists
      const bulletMatch = p.match(/^([•\-\*–—\(\)\[\]\d+\.]{1,4})\s+(.+)$/);
      if (bulletMatch && /^[•\-\*–—]|^\d+\.|^\[[ xX]?\]|^\([0-9a-zA-Z]\)/.test(p)) {
        blocks.push({
          type: 'bullet',
          marker: bulletMatch[1].trim(),
          text: bulletMatch[2].trim()
        });
        i++;
        continue;
      }

      // Standard Paragraph
      blocks.push({ type: 'paragraph', text: p });
      i++;
    }

    return blocks;
  }, [docData]);

  // Height-based pagination algorithm: Prevents overflowing pages and guarantees balanced latter pages
  const virtualPages = useMemo(() => {
    if (parsedBlocks.length === 0) return [];

    const pages: DocBlock[][] = [];
    let currentPage: DocBlock[] = [];
    let currentHeight = 0;
    const MAX_PAGE_HEIGHT = 820; // Visual height budget for standard A4 printable sheet (px)

    const estimateBlockHeight = (block: DocBlock): number => {
      switch (block.type) {
        case 'pageBreak':
          return 9999;
        case 'heading':
          return 56;
        case 'signature':
          return 75;
        case 'keyValueGrid':
          return block.items.length > 2 ? 60 : 34;
        case 'bullet':
          return Math.max(26, Math.ceil(block.text.length / 75) * 22);
        case 'paragraph':
          return Math.max(24, Math.ceil(block.text.length / 85) * 20 + 12);
        case 'table':
          return (block.headers ? 40 : 0) + block.rows.length * 34 + 18;
      }
    };

    parsedBlocks.forEach(block => {
      if (block.type === 'pageBreak') {
        if (currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [];
          currentHeight = 0;
        }
        return;
      }

      const h = estimateBlockHeight(block);

      // If block is a large table that exceeds remaining page space
      if (block.type === 'table' && currentHeight + h > MAX_PAGE_HEIGHT && block.rows.length > 3) {
        const availableHeight = MAX_PAGE_HEIGHT - currentHeight - (block.headers ? 40 : 0);
        const rowsFit = Math.max(1, Math.floor(availableHeight / 34));

        if (rowsFit >= 2 && rowsFit < block.rows.length) {
          // Split table across pages cleanly
          const pageRows = block.rows.slice(0, rowsFit);
          const remainingRows = block.rows.slice(rowsFit);

          currentPage.push({
            type: 'table',
            headers: block.headers,
            rows: pageRows,
            numCols: block.numCols
          });
          pages.push(currentPage);

          // Continuation on next page with repeating headers
          currentPage = [{
            type: 'table',
            headers: block.headers,
            rows: remainingRows,
            numCols: block.numCols
          }];
          currentHeight = (block.headers ? 40 : 0) + remainingRows.length * 34 + 18;
          return;
        }
      }

      // If block exceeds page height, start new page
      if (currentHeight + h > MAX_PAGE_HEIGHT && currentPage.length > 0) {
        // Keep heading with next content (orphan protection)
        if (block.type === 'heading') {
          pages.push(currentPage);
          currentPage = [block];
          currentHeight = h;
          return;
        }

        pages.push(currentPage);
        currentPage = [block];
        currentHeight = h;
      } else {
        currentPage.push(block);
        currentHeight += h;
      }
    });

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }, [parsedBlocks]);

  // Match counter for search term
  const matchCount = useMemo(() => {
    if (!searchTerm.trim() || !docData) return 0;
    try {
      const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = docData.body.match(regex);
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }, [searchTerm, docData]);

  // Theme page styles
  const getThemeClasses = () => {
    switch (themeMode) {
      case 'warm':
        return {
          container: 'bg-stone-900/90',
          page: 'bg-[#fbf9f4] text-stone-900 border-stone-200/90 shadow-2xl'
        };
      case 'dark':
        return {
          container: 'bg-slate-950',
          page: 'bg-slate-900 text-slate-100 border-slate-700 shadow-2xl'
        };
      default:
        return {
          container: 'bg-slate-850/90',
          page: 'bg-white text-slate-900 border-slate-200/90 shadow-2xl'
        };
    }
  };

  // Dynamic typography styles based on themeMode to guarantee 100% legibility & high contrast
  const textStyles = useMemo(() => {
    switch (themeMode) {
      case 'dark':
        return {
          heading: 'text-white border-slate-700',
          keyLabel: 'text-blue-400 font-bold',
          keyValue: 'text-slate-100 font-medium',
          keyBorder: 'border-slate-800',
          bulletDot: 'bg-blue-400 text-blue-400',
          body: 'text-slate-200',
          headerBox: 'bg-blue-950/60 border-blue-800/80 text-blue-200',
          pageHeaderFooter: 'border-slate-800 text-slate-400',
          pageBg: '#0f172a',
          pageText: '#f8fafc',
          searchMark: 'bg-amber-400 text-slate-950 font-bold',
          tableHeaderBg: 'bg-slate-800 text-slate-100 border-slate-700',
          tableBorder: 'border-slate-700',
          tableCellBorder: 'border-slate-800',
          tableRowEven: 'bg-slate-900',
          tableRowOdd: 'bg-slate-850/50',
          sigLine: 'border-slate-700 text-slate-400',
          cardBg: 'bg-slate-850 border-slate-800'
        };
      case 'warm':
        return {
          heading: 'text-stone-900 border-stone-300',
          keyLabel: 'text-amber-900 font-bold',
          keyValue: 'text-stone-800 font-medium',
          keyBorder: 'border-stone-200/80',
          bulletDot: 'bg-amber-600 text-amber-700',
          body: 'text-stone-800',
          headerBox: 'bg-amber-50 border-amber-200 text-amber-950',
          pageHeaderFooter: 'border-stone-200 text-stone-500',
          pageBg: '#fbf9f4',
          pageText: '#1c1917',
          searchMark: 'bg-amber-300 text-amber-950 font-bold',
          tableHeaderBg: 'bg-[#f0e8dc] text-amber-950 border-stone-300',
          tableBorder: 'border-stone-300',
          tableCellBorder: 'border-stone-200',
          tableRowEven: 'bg-[#fbf9f4]',
          tableRowOdd: 'bg-[#f4ede3]/50',
          sigLine: 'border-stone-300 text-stone-600',
          cardBg: 'bg-[#f5efe6] border-stone-200'
        };
      case 'white':
      default:
        return {
          heading: 'text-slate-900 border-slate-200',
          keyLabel: 'text-slate-700 font-bold',
          keyValue: 'text-slate-900 font-medium',
          keyBorder: 'border-slate-200',
          bulletDot: 'bg-blue-600 text-blue-600',
          body: 'text-slate-800',
          headerBox: 'bg-blue-50/80 border-blue-100 text-blue-900',
          pageHeaderFooter: 'border-slate-200 text-slate-400',
          pageBg: '#ffffff',
          pageText: '#0f172a',
          searchMark: 'bg-amber-300 text-amber-950 font-bold',
          tableHeaderBg: 'bg-slate-100 text-slate-900 border-slate-300',
          tableBorder: 'border-slate-300',
          tableCellBorder: 'border-slate-200',
          tableRowEven: 'bg-white',
          tableRowOdd: 'bg-slate-50/70',
          sigLine: 'border-slate-300 text-slate-500',
          cardBg: 'bg-slate-50 border-slate-200'
        };
    }
  }, [themeMode]);

  // Helper to render text with search highlighting
  const renderTextWithHighlight = (text: string) => {
    if (!searchTerm.trim()) return text;
    const parts = text.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, idx) => {
      if (part.toLowerCase() === searchTerm.toLowerCase()) {
        return (
          <mark key={idx} className={`${textStyles.searchMark} px-1 rounded-xs`}>
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Render individual semantic blocks with authentic document styling
  const renderBlock = (block: DocBlock, idx: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <h4 
            key={idx} 
            className={`text-sm sm:text-base font-black pt-4 pb-2 border-b uppercase tracking-tight mt-4 first:mt-0 ${textStyles.heading}`}
          >
            {renderTextWithHighlight(block.text)}
          </h4>
        );

      case 'table':
        return (
          <div key={idx} className={`my-3.5 overflow-x-auto rounded-lg border shadow-xs ${textStyles.tableBorder}`}>
            <table className="w-full text-xs text-left border-collapse table-auto">
              {block.headers && block.headers.length > 0 && (
                <thead className={textStyles.tableHeaderBg}>
                  <tr>
                    {block.headers.map((h, cIdx) => (
                      <th 
                        key={cIdx} 
                        className={`px-3 py-2 font-bold uppercase tracking-wider text-[11px] border-r last:border-r-0 ${textStyles.tableCellBorder}`}
                      >
                        {renderTextWithHighlight(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className={`divide-y ${textStyles.tableCellBorder}`}>
                {block.rows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 1 ? textStyles.tableRowOdd : textStyles.tableRowEven}>
                    {row.map((cell, cIdx) => (
                      <td 
                        key={cIdx} 
                        className={`px-3 py-2 align-top text-xs border-r last:border-r-0 ${textStyles.tableCellBorder}`}
                      >
                        {renderTextWithHighlight(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'signature':
        return (
          <div key={idx} className={`my-4 p-3.5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${textStyles.cardBg}`}>
            {block.items.map((item, sIdx) => (
              <div key={sIdx} className="flex flex-col justify-end space-y-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${textStyles.keyLabel}`}>
                  {item.label}
                </span>
                <div className={`border-b-2 pt-4 flex justify-between items-end text-xs font-medium ${textStyles.sigLine}`}>
                  <span>{item.line || '_______________________'}</span>
                  <PenTool className="w-3.5 h-3.5 opacity-40 shrink-0 mb-0.5" />
                </div>
              </div>
            ))}
          </div>
        );

      case 'keyValueGrid':
        return (
          <div key={idx} className={`my-2 grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg border ${textStyles.cardBg}`}>
            {block.items.map((kv, kIdx) => (
              <div key={kIdx} className="flex items-baseline gap-2 text-xs">
                <span className={`shrink-0 font-bold ${textStyles.keyLabel}`}>{kv.label}:</span>
                <span className={`flex-1 font-medium ${textStyles.keyValue}`}>{renderTextWithHighlight(kv.value)}</span>
              </div>
            ))}
          </div>
        );

      case 'bullet':
        return (
          <div key={idx} className="flex items-start gap-2.5 py-1 pl-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${textStyles.bulletDot}`} />
            <p className={`leading-relaxed font-normal flex-1 text-left ${textStyles.body}`}>
              {renderTextWithHighlight(block.text)}
            </p>
          </div>
        );

      case 'paragraph':
        return (
          <p key={idx} className={`leading-relaxed font-normal my-2 text-left whitespace-pre-wrap ${textStyles.body}`}>
            {renderTextWithHighlight(block.text)}
          </p>
        );

      default:
        return null;
    }
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
              <span className="text-xs font-bold text-white truncate max-w-[280px] sm:max-w-md" title={displayTitle}>
                {displayTitle}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                Word (.DOC)
              </span>
            </div>
            {docData && (
              <p className="text-[11px] text-slate-400 font-medium">
                {docData.wordCount.toLocaleString()} words &bull; {docData.charCount.toLocaleString()} chars &bull; {virtualPages.length} {virtualPages.length === 1 ? 'page' : 'pages'}
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
          {/* View Mode Toggle: Paged vs Flow */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('paged')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                viewMode === 'paged' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Paged Document Layout (A4 format with page headers & footers)"
            >
              <Layers className="w-3 h-3" />
              <span>Pages</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('flow')}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                viewMode === 'flow' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Continuous Document Flow (Seamless reading for tables & forms)"
            >
              <Rows className="w-3 h-3" />
              <span>Flow</span>
            </button>
          </div>

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

          {/* Page Theme Options: Classic White (Default), Warm, Night */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5" title="Page Background Appearance">
            <button
              type="button"
              onClick={() => setThemeMode('white')}
              className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                themeMode === 'white'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Classic Solid White Page (Recommended for maximum readability)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300 shrink-0" />
              <span>White</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('warm')}
              className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                themeMode === 'warm'
                  ? 'bg-[#fbf9f4] text-stone-900 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Warm Paper Background"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#f4ece1] border border-amber-300 shrink-0" />
              <span>Warm</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                themeMode === 'dark'
                  ? 'bg-slate-850 text-white shadow-xs border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Night Mode Background"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-500 shrink-0" />
              <span>Dark</span>
            </button>
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
            {/* Paged Mode: Authentic A4 Sheets with headers, footers & proper height */}
            {viewMode === 'paged' ? (
              virtualPages.map((pageBlocks, pageIndex) => (
                <div 
                  key={pageIndex}
                  style={{
                    backgroundColor: textStyles.pageBg,
                    color: textStyles.pageText
                  }}
                  className={`w-full max-w-[820px] min-h-[1050px] p-8 sm:p-14 rounded-2xl border transition-all ${themeClasses.page} ${getFontFamilyClass()} ${getFontSizeClass()} ${getLineSpacingClass()} relative flex flex-col justify-between`}
                >
                  {/* Document Page Header */}
                  <div className={`border-b pb-3 mb-6 flex justify-between items-center text-[10px] uppercase tracking-wider select-none font-semibold ${textStyles.pageHeaderFooter}`}>
                    <span className="truncate max-w-xs">{displayTitle}</span>
                    <span>Page {pageIndex + 1} of {virtualPages.length}</span>
                  </div>

                  {/* Page Body Content */}
                  <div className="flex-1">
                    {pageIndex === 0 && docData.headers && (
                      <div className={`p-3.5 mb-5 rounded-xl border text-xs font-semibold ${textStyles.headerBox}`}>
                        {docData.headers}
                      </div>
                    )}

                    {pageBlocks.map((block, bIdx) => renderBlock(block, bIdx))}
                  </div>

                  {/* Page Footer */}
                  <div className={`border-t pt-4 mt-8 flex justify-between items-center text-[10px] select-none font-medium ${textStyles.pageHeaderFooter}`}>
                    <span className="truncate max-w-xs">
                      {docData.footers ? docData.footers.trim().split('\n')[0] : 'Microsoft Word Document Preview'}
                    </span>
                    <span>— {pageIndex + 1} of {virtualPages.length} —</span>
                  </div>
                </div>
              ))
            ) : (
              /* Flow Mode: Seamless, uninterrupted continuous layout for reading large tables & reports */
              <div 
                style={{
                  backgroundColor: textStyles.pageBg,
                  color: textStyles.pageText
                }}
                className={`w-full max-w-[860px] p-8 sm:p-14 rounded-2xl border transition-all ${themeClasses.page} ${getFontFamilyClass()} ${getFontSizeClass()} ${getLineSpacingClass()} relative flex flex-col`}
              >
                {/* Continuous Flow Header */}
                <div className={`border-b pb-3 mb-6 flex justify-between items-center text-[10px] uppercase tracking-wider select-none font-semibold ${textStyles.pageHeaderFooter}`}>
                  <span className="truncate max-w-sm">{displayTitle}</span>
                  <span>Continuous Flow &bull; {parsedBlocks.length} sections</span>
                </div>

                {docData.headers && (
                  <div className={`p-3.5 mb-5 rounded-xl border text-xs font-semibold ${textStyles.headerBox}`}>
                    {docData.headers}
                  </div>
                )}

                {/* Render all blocks seamlessly */}
                <div className="space-y-1">
                  {parsedBlocks.map((block, bIdx) => {
                    if (block.type === 'pageBreak') {
                      return (
                        <div key={bIdx} className="my-6 flex items-center gap-3">
                          <div className={`flex-1 border-t border-dashed ${textStyles.keyBorder}`} />
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold">
                            Section Break
                          </span>
                          <div className={`flex-1 border-t border-dashed ${textStyles.keyBorder}`} />
                        </div>
                      );
                    }
                    return renderBlock(block, bIdx);
                  })}
                </div>

                {/* Flow Footer */}
                <div className={`border-t pt-4 mt-8 flex justify-between items-center text-[10px] select-none font-medium ${textStyles.pageHeaderFooter}`}>
                  <span>{docData.footers ? docData.footers.trim().split('\n')[0] : 'End of Document'}</span>
                  <span>{docData.wordCount.toLocaleString()} words</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
