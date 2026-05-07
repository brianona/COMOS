import React from 'react';

interface Highlight {
  label: string;
  value: any;
  rect: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0-1000 range
}

export const OCRHighlightOverlay = ({ highlights }: { highlights: Highlight[] }) => {
  if (!highlights || highlights.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[40] overflow-visible w-full h-full">
      {highlights.map((h, i) => {
        if (!h.rect || !Array.isArray(h.rect) || h.rect.length !== 4) return null;
        
        // Gemini coordinates are [ymin, xmin, ymax, xmax] in 0-1000 scale
        // Normalize to ensure we always have positive dimensions and correct positioning
        const y_min = Math.min(h.rect[0], h.rect[2]);
        const y_max = Math.max(h.rect[0], h.rect[2]);
        const x_min = Math.min(h.rect[1], h.rect[3]);
        const x_max = Math.max(h.rect[1], h.rect[3]);
        
        // Use percentages for exact mapping to container (using 0.1% increments)
        const top = y_min / 10;
        const left = x_min / 10;
        const height = (y_max - y_min) / 10;
        const width = (x_max - x_min) / 10;

        // Skip invalid or clearly incorrect rects
        if (width < 0.1 || height < 0.1) return null;

        return (
          <div 
            key={i}
            className="absolute border-2 border-amber-500 bg-amber-500/20 rounded shadow-[0_0_15px_rgba(245,158,11,0.5)] group/highlight pointer-events-auto cursor-help transition-all duration-300 hover:bg-amber-500/40 hover:border-amber-300 hover:ring-2 hover:ring-white/30"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              height: `${height}%`,
              width: `${width}%`,
            }}
          >
            {/* Label Badge */}
            <div className="absolute top-0 left-0 -translate-y-full mb-1 bg-amber-600 text-white text-[8px] md:text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50 flex items-center gap-1.5 border border-amber-400">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              {h.label}
            </div>

            {/* Value Tooltip - Always visible on desktop if small, otherwise hover */}
            <div className="absolute top-full left-0 mt-1 bg-slate-900 text-white text-[9px] px-2 py-1 rounded shadow-xl backdrop-blur-md border border-slate-700 opacity-0 group-hover/highlight:opacity-100 transition-opacity duration-200 z-[60] min-w-max">
              <span className="text-amber-400 font-bold mr-1">EXTRACTED:</span>
              {String(h.value)}
            </div>

            {/* In-box visual aid (optional, but helps see orientation) */}
            <div className="absolute inset-0 border border-amber-300/30 rounded-[1px]" />
          </div>
        );
      })}
    </div>
  );
};
