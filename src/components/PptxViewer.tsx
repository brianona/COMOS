import React, { useEffect, useState, useMemo } from 'react';
import JSZip from 'jszip';
import { 
  Presentation, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Download, 
  Search, 
  Loader2, 
  AlertTriangle,
  Play,
  Layers,
  FileImage
} from 'lucide-react';

interface SlideData {
  slideNumber: number;
  title: string;
  texts: string[];
  images: { name: string; url: string }[];
}

interface PptxViewerProps {
  url?: string;
  blob?: Blob;
  arrayBuffer?: ArrayBuffer;
  title?: string;
  onDownload?: () => void;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({
  url,
  blob,
  arrayBuffer,
  title,
  onDownload
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllSlides, setShowAllSlides] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const parsePptx = async () => {
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
                    reject(new Error(`Failed to load presentation blob (${xhr.status})`));
                  }
                };
                xhr.onerror = () => reject(new Error('Failed to load presentation stream'));
                xhr.send();
              });
            }
          } else {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to download presentation (${res.status})`);
            buffer = await res.arrayBuffer();
          }
        } else {
          throw new Error('No presentation data provided');
        }

        if (isCancelled || !buffer || buffer.byteLength === 0) {
          if (!buffer || buffer.byteLength === 0) {
            throw new Error('Presentation file is empty');
          }
          return;
        }

        const zip = await JSZip.loadAsync(buffer);
        
        // Extract media images
        const mediaMap: Record<string, string> = {};
        const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
        for (const mFile of mediaFiles) {
          try {
            const mBlob = await zip.files[mFile].async('blob');
            const mUrl = URL.createObjectURL(mBlob);
            const mName = mFile.split('/').pop() || mFile;
            mediaMap[mName] = mUrl;
          } catch (e) {
            console.error('Error loading media image:', e);
          }
        }

        // Find slide XML files
        const slideFiles = Object.keys(zip.files)
          .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/i))
          .sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            return numA - numB;
          });

        if (slideFiles.length === 0) {
          throw new Error('No slides found in this PowerPoint presentation.');
        }

        const parsedSlides: SlideData[] = [];
        const parser = new DOMParser();

        for (let i = 0; i < slideFiles.length; i++) {
          const sFile = slideFiles[i];
          const sXml = await zip.files[sFile].async('text');
          const doc = parser.parseFromString(sXml, 'application/xml');

          // Extract text runs <a:t>
          const textElements = Array.from(doc.getElementsByTagName('a:t'));
          const extractedTexts: string[] = [];
          let slideTitle = '';

          // Paragraphs
          const paragraphs = Array.from(doc.getElementsByTagName('a:p'));
          for (const p of paragraphs) {
            const pTexts = Array.from(p.getElementsByTagName('a:t'))
              .map(t => t.textContent || '')
              .join('');
            if (pTexts.trim()) {
              if (!slideTitle) {
                slideTitle = pTexts.trim();
              }
              extractedTexts.push(pTexts.trim());
            }
          }

          if (!slideTitle && extractedTexts.length > 0) {
            slideTitle = extractedTexts[0];
          }

          // Images for this slide
          const slideImages: { name: string; url: string }[] = [];
          // Check associated slide rels if any
          const relsPath = `ppt/slides/_rels/${sFile.split('/').pop()}.rels`;
          if (zip.files[relsPath]) {
            try {
              const relsXml = await zip.files[relsPath].async('text');
              const relsDoc = parser.parseFromString(relsXml, 'application/xml');
              const rels = Array.from(relsDoc.getElementsByTagName('Relationship'));
              for (const rel of rels) {
                const target = rel.getAttribute('Target') || '';
                if (target.includes('media/')) {
                  const mediaName = target.split('/').pop() || '';
                  if (mediaMap[mediaName]) {
                    slideImages.push({ name: mediaName, url: mediaMap[mediaName] });
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing slide rels:', e);
            }
          }

          parsedSlides.push({
            slideNumber: i + 1,
            title: slideTitle || `Slide ${i + 1}`,
            texts: extractedTexts,
            images: slideImages
          });
        }

        if (!isCancelled) {
          setSlides(parsedSlides);
          setCurrentSlideIndex(0);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('PPTX parse error:', err);
        if (!isCancelled) {
          setError(err.message || 'Failed to render PowerPoint presentation');
          setLoading(false);
        }
      }
    };

    parsePptx();

    return () => {
      isCancelled = true;
    };
  }, [url, blob, arrayBuffer]);

  const currentSlide = slides[currentSlideIndex];

  const filteredSlides = useMemo(() => {
    if (!searchTerm.trim()) return slides;
    const q = searchTerm.trim().toLowerCase();
    return slides.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.texts.some(t => t.toLowerCase().includes(q))
    );
  }, [slides, searchTerm]);

  return (
    <div 
      className={`flex flex-col h-full w-full bg-slate-900 text-slate-100 overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-[9999]' : 'relative'
      }`}
    >
      {/* Top Toolbar */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Presentation className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-200 truncate max-w-xs" title={title}>
            {title || 'PowerPoint Presentation'}
          </span>
          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-300 rounded text-[10px] font-bold tracking-wider uppercase border border-amber-500/20 hidden sm:inline">
            PowerPoint Preview
          </span>
        </div>

        {/* Center: Search & Slide Navigation */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search slides..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAllSlides((s) => !s)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-colors flex items-center gap-1 shrink-0 ${
              showAllSlides 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">{showAllSlides ? 'Slide View' : 'Grid View'}</span>
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
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
          </div>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors shadow-sm"
              title="Download PowerPoint Presentation"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Presentation View */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-950">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-sm font-medium text-slate-300">Loading PowerPoint slides...</p>
          </div>
        ) : error ? (
          <div className="max-w-md w-full mx-auto my-12 bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Cannot Preview Presentation</h4>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </button>
            )}
          </div>
        ) : showAllSlides ? (
          /* Grid View of all slides */
          <div className="flex-1 overflow-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSlides.map((slide, idx) => (
              <div
                key={slide.slideNumber}
                onClick={() => {
                  setCurrentSlideIndex(slide.slideNumber - 1);
                  setShowAllSlides(false);
                }}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 cursor-pointer transition-all shadow-lg hover:scale-[1.01] flex flex-col justify-between min-h-[220px]"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-slate-800 text-amber-300 font-mono text-[10px] font-bold rounded">
                      Slide {slide.slideNumber}
                    </span>
                    {slide.images.length > 0 && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <FileImage className="w-3 h-3 text-amber-400" />
                        {slide.images.length}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white line-clamp-2">{slide.title}</h4>
                  <div className="text-xs text-slate-400 space-y-1 line-clamp-4">
                    {slide.texts.slice(1, 4).map((t, i) => (
                      <p key={i} className="truncate">• {t}</p>
                    ))}
                  </div>
                </div>

                {slide.images.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
                    {slide.images.slice(0, 3).map((img, i) => (
                      <img
                        key={i}
                        src={img.url}
                        alt="Slide preview"
                        className="h-12 w-auto object-cover rounded border border-slate-700 bg-black/40"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Single Slide Inspector + Left Slide Deck Sidebar */
          <>
            {/* Left Slide Deck List */}
            <div className="w-full md:w-64 bg-slate-950 border-r border-slate-800 overflow-y-auto p-3 flex md:flex-col gap-2 shrink-0 max-h-40 md:max-h-none">
              {slides.map((s, idx) => {
                const isActive = idx === currentSlideIndex;
                return (
                  <button
                    key={s.slideNumber}
                    type="button"
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 shrink-0 w-44 md:w-full ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold text-amber-400">#{s.slideNumber}</span>
                      {s.images.length > 0 && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                          <FileImage className="w-2.5 h-2.5" /> {s.images.length}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold truncate">{s.title || `Slide ${s.slideNumber}`}</span>
                  </button>
                );
              })}
            </div>

            {/* Slide Stage */}
            <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-between bg-slate-900/60">
              {currentSlide && (
                <div 
                  className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6 transition-transform"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center'
                  }}
                >
                  {/* Slide header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <span className="px-3 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-mono font-bold">
                      Slide {currentSlide.slideNumber} of {slides.length}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">PowerPoint Slide Layout</span>
                  </div>

                  {/* Slide Title */}
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {currentSlide.title}
                  </h2>

                  {/* Slide Text Content */}
                  <div className="space-y-3 text-slate-200 text-sm sm:text-base leading-relaxed">
                    {currentSlide.texts.slice(1).map((paragraph, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-3">
                        <span className="text-amber-400 font-bold mt-1 text-xs">◆</span>
                        <p className="flex-1">{paragraph}</p>
                      </div>
                    ))}
                    {currentSlide.texts.length <= 1 && (
                      <p className="text-xs text-slate-500 italic">No additional bullet text on this slide.</p>
                    )}
                  </div>

                  {/* Slide Graphics / Media */}
                  {currentSlide.images.length > 0 && (
                    <div className="pt-4 border-t border-slate-800 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                        <FileImage className="w-4 h-4 text-amber-400" />
                        <span>Embedded Graphics ({currentSlide.images.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {currentSlide.images.map((img, iIdx) => (
                          <div key={iIdx} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center">
                            <img
                              src={img.url}
                              alt={`Graphic ${iIdx + 1}`}
                              className="max-h-64 w-auto object-contain rounded-lg"
                            />
                            <span className="text-[10px] font-mono text-slate-500 mt-2 truncate max-w-full">
                              {img.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Carousel Navigation */}
              <div className="mt-6 flex items-center justify-center gap-4 bg-slate-950/90 border border-slate-800 px-6 py-3 rounded-2xl shadow-xl">
                <button
                  type="button"
                  disabled={currentSlideIndex <= 0}
                  onClick={() => setCurrentSlideIndex(i => Math.max(0, i - 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <span className="text-xs font-mono font-bold text-slate-300 px-2">
                  {currentSlideIndex + 1} / {slides.length}
                </span>

                <button
                  type="button"
                  disabled={currentSlideIndex >= slides.length - 1}
                  onClick={() => setCurrentSlideIndex(i => Math.min(slides.length - 1, i + 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
