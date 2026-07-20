import React, { useState, useEffect, useRef } from 'react';
import { Loader2, ZoomIn, ZoomOut, Download, RotateCcw, Maximize, Minimize } from 'lucide-react';

interface ImageViewerProps {
  url: string;
  title?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ url, title }) => {
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setLoading(false);
    };
    img.onerror = () => {
      setError('Failed to load image.');
      setLoading(false);
    };
  }, [url]);

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
  }, []);

  const handleFitToWidth = () => {
    if (!viewportRef.current || !imageRef.current) return;
    const containerWidth = viewportRef.current.clientWidth - 32; // subtracting padding
    const naturalWidth = imageRef.current.naturalWidth || 800;
    const newScale = containerWidth / naturalWidth;
    setScale(Number(Math.min(Math.max(newScale, 0.25), 5).toFixed(2)));
  };

  const handleFitToHeight = () => {
    if (!viewportRef.current || !imageRef.current) return;
    const containerHeight = viewportRef.current.clientHeight - 32;
    const naturalHeight = imageRef.current.naturalHeight || 600;
    const newScale = containerHeight / naturalHeight;
    setScale(Number(Math.min(Math.max(newScale, 0.25), 5).toFixed(2)));
  };

  const handleReset = () => {
    setScale(1.0);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
            Image Preview
          </span>
          
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
              onClick={handleFitToHeight}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              title="Fit to Height"
            >
              <Minimize className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Height</span>
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              title="100% Zoom"
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
          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-slate-700 rounded-lg transition-colors"
          title="Download Image"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>

      {/* Viewport with rotateX to put the horizontal scrollbar on top */}
      <div 
        ref={viewportRef}
        className="flex-1 overflow-auto p-4 bg-slate-900 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent flex justify-center items-start [transform:rotateX(180deg)]"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-500 m-auto [transform:rotateX(180deg)]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs font-medium">Loading Image...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center p-8 m-auto [transform:rotateX(180deg)]">
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
          <div 
            className="m-auto shadow-2xl shadow-black/50 bg-white rounded-sm overflow-hidden flex-shrink-0 transition-transform duration-250 ease-out origin-center"
            style={{ 
              transform: `scale(${scale}) rotateX(180deg)`,
              transformOrigin: 'center center'
            }}
          >
            <img 
              ref={imageRef}
              src={url} 
              alt={title || "Preview"} 
              className="block select-none"
              style={{
                pointerEvents: 'none'
              }}
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>
    </div>
  );
};
