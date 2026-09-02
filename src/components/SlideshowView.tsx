import React, { useState, useEffect, useRef } from "react";
import { 
  ChevronLeft, ChevronRight, Play, Pause, Ship, Navigation, Activity, 
  MapPin, Compass, Waves, Droplets, Fuel, Clock, AlertCircle, Camera, CheckSquare,
  Map as MapIcon, Monitor, Shield, ShieldAlert, Anchor, Package, AlertTriangle, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, parseISO } from "date-fns";
import { cn, parseCoordinate, getStatus } from "../utils/helpers";
import { Vessel, NoonReport, Certificate, ArrivalReport, DepartureReport, OtherReport } from "../types";

const SlideshowMap = ({ latStr, lonStr, vesselName }: { latStr: string, lonStr: string, vesselName: string }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(!!(window as any).L);

  const parsedLat = parseCoordinate(latStr, true);
  const parsedLon = parseCoordinate(lonStr, false);

  // Poll or verify that globally injected Leaflet is fully parsed by the browser
  useEffect(() => {
    if ((window as any).L) {
      setLeafletReady(true);
      return;
    }

    const interval = setInterval(() => {
      if ((window as any).L) {
        setLeafletReady(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!leafletReady || parsedLat === null || parsedLon === null || !mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    let map: any = null;

    try {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }

      map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true
      }).setView([parsedLat, parsedLon], 1);
      
      leafletInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 3,
        className: 'map-tiles-load'
      }).addTo(map);

      const customIcon = L.divIcon({
        className: 'custom-marine-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-blue-500/40 rounded-full animate-ping"></div>
            <div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-xl relative z-10"></div>
          </div>
        `,
        iconSize: [32, 32]
      });

      L.marker([parsedLat, parsedLon], { icon: customIcon }).addTo(map);

      // Force instant sizing recalculation and another one shortly after layouts finalize
      map.invalidateSize();
      const delayInval = setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 50);

      return () => {
        clearTimeout(delayInval);
      };
    } catch (e) {
      console.warn("Leaflet instantiation issue:", e);
    }

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, [leafletReady, parsedLat, parsedLon, vesselName, latStr, lonStr]);

  if (parsedLat === null || parsedLon === null) {
    return (
      <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center bg-black/40 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-md">
        <MapIcon className="w-10 h-10 text-slate-500 mb-2 animate-bounce" />
        <p className="text-slate-400 font-bold text-sm">NO VALID LOCATION COORDINATES FOUND</p>
        <p className="text-slate-500 text-xs mt-1">Check recent voyage reports for lat/long</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[200px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
      <style>{`
        .leaflet-container {
          background: #0b1329 !important;
          color: #f8fafc !important;
          font-family: inherit;
        }
        .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(95%);
        }
        .leaflet-pane {
          z-index: 1 !important;
        }
        .leaflet-top, .leaflet-bottom {
          z-index: 2 !important;
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full z-10" />
      <div className="absolute bottom-4 right-4 z-[400] bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex flex-col pointer-events-none text-right font-mono text-[9px] text-slate-300">
        <span>Lat: {latStr}</span>
        <span>Long: {lonStr}</span>
      </div>
    </div>
  );
};

export const SlideshowView = ({ 
  vessels, 
  certs, 
  token, 
  arrivalReports,
  departureReports,
  noonReports,
  otherReports
}: { 
  vessels: Vessel[], 
  certs: Certificate[], 
  token: string, 
  arrivalReports: ArrivalReport[],
  departureReports: DepartureReport[],
  noonReports: NoonReport[],
  otherReports: OtherReport[]
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [cachedImages, setCachedImages] = useState<Record<number, string>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const slideDuration = 20000; // 20 seconds per slide

  const getLatestArrivalOperationType = (vesselId: number) => {
    const reports = (arrivalReports || [])
      .filter(r => r.vessel_id === vesselId)
      .sort((a, b) => new Date(b.utc_date_time).getTime() - new Date(a.utc_date_time).getTime());
    return reports.length > 0 ? reports[0].operation_type : 'N/A';
  };

  const getLatestVesselPosition = (vesselId: number) => {
    const allReports: { utc_date_time: string, position_lat: string, position_long: string, type: string }[] = [];
    
    (arrivalReports || []).filter(r => r.vessel_id === vesselId).forEach(r => {
      if (r.position_lat && r.position_long) {
        allReports.push({ utc_date_time: r.utc_date_time, position_lat: r.position_lat, position_long: r.position_long, type: 'Arrival' });
      }
    });
    (departureReports || []).filter(r => r.vessel_id === vesselId).forEach(r => {
      if (r.position_lat && r.position_long) {
        allReports.push({ utc_date_time: r.utc_date_time, position_lat: r.position_lat, position_long: r.position_long, type: 'Departure' });
      }
    });
    (noonReports || []).filter(r => r.vessel_id === vesselId).forEach(r => {
      if (r.position_lat && r.position_long) {
        allReports.push({ utc_date_time: r.utc_date_time, position_lat: r.position_lat, position_long: r.position_long, type: 'Noon' });
      }
    });
    (otherReports || []).filter(r => r.vessel_id === vesselId).forEach(r => {
      if (r.position_lat && r.position_long) {
        allReports.push({ utc_date_time: r.utc_date_time, position_lat: r.position_lat, position_long: r.position_long, type: 'Other' });
      }
    });

    allReports.sort((a, b) => {
      const timeA = new Date(a.utc_date_time).getTime();
      const timeB = new Date(b.utc_date_time).getTime();
      return timeB - timeA;
    });

    return allReports[0] || null;
  };

  // Preload all vessel images into local cache (Blob URLs)
  useEffect(() => {
    const preloadImages = async () => {
      const cache: Record<number, string> = {};
      
      const loadPromises = vessels
        .filter(v => v.has_photo)
        .map(async (v) => {
          try {
            const response = await fetch(`/api/vessels/${v.id}/photo?token=${token}`);
            if (response.ok) {
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              cache[v.id] = objectUrl;
            }
          } catch (error) {
            console.error(`Failed to preload image for vessel ${v.name}:`, error);
          }
        });

      await Promise.all(loadPromises);
      setCachedImages(cache);
    };

    if (vessels.length > 0) {
      preloadImages();
    }

    // Cleanup Blob URLs on unmount
    return () => {
      setCachedImages(prev => {
        Object.values(prev).forEach(url => URL.revokeObjectURL(url as string));
        return {};
      });
    };
  }, [vessels, token]);

  useEffect(() => {
    if (isPaused || vessels.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % vessels.length);
    }, slideDuration);
    return () => clearInterval(timer);
  }, [isPaused, vessels.length]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      if (!isFS && isKioskMode) {
        setIsKioskMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isKioskMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target && 
        (target.tagName === 'INPUT' || 
         target.tagName === 'TEXTAREA' || 
         target.isContentEditable)
      ) {
        return;
      }

      if (isKioskMode && e.key === 'Escape') {
        exitKioskMode();
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex(prev => (prev + 1) % vessels.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex(prev => (prev - 1 + vessels.length) % vessels.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKioskMode, vessels.length]);

  const enterKioskMode = () => {
    setIsKioskMode(true);
    setIsPaused(false);
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable kiosk mode fullscreen: ${err.message}`);
      });
    }
  };

  const exitKioskMode = () => {
    setIsKioskMode(false);
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  if (vessels.length === 0) return (
    <div className="flex-1 flex items-center justify-center p-12 text-slate-400 italic">
      No vessels available for slideshow.
    </div>
  );

  const vessel = vessels[currentIndex];
  const lastPos = getLatestVesselPosition(vessel.id);
  const latStr = lastPos ? lastPos.position_lat : '';
  const lonStr = lastPos ? lastPos.position_long : '';
  const vesselCerts = certs.filter(c => c.vessel_id === vessel.id && getStatus(c.expiration_date) !== 'active')
    .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime())
    .slice(0, 10);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex-1 flex flex-col bg-slate-900 text-white overflow-hidden shadow-2xl border border-slate-800 relative group",
        isFullscreen ? "h-screen w-screen rounded-none border-none" : "h-full rounded-3xl"
      )}
    >
      {/* Animated Background with Cross-fade */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={vessel.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{
              backgroundImage: vessel.has_photo 
                ? `url(${cachedImages[vessel.id] || `/api/vessels/${vessel.id}/photo?token=${token}`})` 
                : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        </AnimatePresence>
      </div>

      {/* Lighter Dark Overlay for Maximum Visibility */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/40 via-transparent to-slate-950/40" />

      {/* Slideshow Header */}
      {!isKioskMode && (
        <div className="relative p-6 bg-slate-900/20 border-b border-white/5 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/80 rounded-2xl shadow-lg shadow-blue-900/20">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Fleet Slideshow</h2>
              <p className="text-slate-300 text-xs uppercase font-bold tracking-widest drop-shadow-md">Vessel {currentIndex + 1} of {vessels.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentIndex((prev) => (prev - 1 + vessels.length) % vessels.length)}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="p-3 bg-blue-600/80 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
            </button>
            <button 
              onClick={() => setCurrentIndex((prev) => (prev + 1) % vessels.length)}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button 
              onClick={enterKioskMode}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white"
              title="Enter Kiosk Mode (Locked Fullscreen)"
            >
              <Shield className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Kiosk Mode Exit Button (Hidden/Floating) */}
      {isKioskMode && (
        <div className="absolute top-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
          <button 
            onClick={exitKioskMode}
            className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 text-white/50 hover:text-white rounded-full border border-white/10 backdrop-blur-md text-xs font-bold transition-all"
          >
            <ShieldAlert className="w-4 h-4" /> Exit Kiosk Mode
          </button>
        </div>
      )}

      {/* Slide Content */}
      <div className="relative flex-1 p-8 flex flex-col lg:flex-row justify-between gap-12 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${vessel.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col lg:flex-row justify-between gap-12 w-full"
          >
            {/* Left Column: Vessel Info & Route */}
            <div className="space-y-8 max-w-2xl w-full">
              <div className="flex items-center gap-6">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="p-4 bg-blue-600/30 rounded-3xl border border-blue-500/40 backdrop-blur-md"
                >
                  <Ship className="w-12 h-12 text-blue-300" />
                </motion.div>
                <div>
                  <motion.h1 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-6xl font-black tracking-tighter text-white mb-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                  >
                    {vessel.name}
                  </motion.h1>
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center gap-3"
                  >
                    <span className="px-3 py-1 bg-black/40 rounded-full text-sm font-bold text-white border border-white/20 backdrop-blur-md">{vessel.team_name}</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md",
                      vessel.owner === 'Nissen' ? "bg-purple-600/40 text-purple-100 border border-purple-500/50" : "bg-orange-600/40 text-orange-100 border border-orange-500/50"
                    )}>
                      {vessel.owner || 'Nissen'}
                    </span>
                  </motion.div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: MapPin, label: 'Next Port', value: vessel.next_port || 'NOT SET', color: 'blue' },
                  { icon: Activity, label: 'Status', value: vessel.route_status || 'NOT SET', color: 'green' },
                  { icon: Compass, label: 'Operation Type', value: vessel.operation_type || getLatestArrivalOperationType(vessel.id), color: 'indigo' },
                  { icon: Clock, label: 'ETA / ATB (UTC)', value: vessel.eta_atb || 'NOT SET', color: 'amber' },
                  { icon: Anchor, label: 'ETD/ATD at Arrival (UTC)', value: vessel.etd_atd || 'NOT SET', color: 'purple' },
                  { icon: Package, label: 'Cargo', value: vessel.cargo || 'NO CARGO INFORMATION', color: 'orange', full: true }
                ].map((item, idx) => (
                  <motion.div 
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + (idx * 0.1) }}
                    className={cn(
                      "bg-black/40 p-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl",
                      item.full && "col-span-full"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("p-1.5 rounded-lg", `bg-${item.color}-500/30`)}>
                        <item.icon className={cn("w-4 h-4", `text-${item.color}-300`)} />
                      </div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300">{item.label}</h3>
                    </div>
                    <p className={cn("font-bold text-white", item.full ? "text-sm" : "text-lg truncate")}>{item.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Column: Urgent Certificates & Vessel Map */}
            <div className="space-y-6 max-w-sm w-full flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 drop-shadow-md">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Urgent Certificates/Service Reports
                  </h3>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {vesselCerts.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="p-8 text-center bg-black/40 rounded-3xl border border-white/10 border-dashed backdrop-blur-md"
                    >
                      <CheckCircle2 className="w-10 h-10 text-green-500/20 mx-auto mb-2" />
                      <p className="text-slate-300 italic text-xs">No expiring or expired certificates.</p>
                    </motion.div>
                  ) : (
                    vesselCerts.map((cert, idx) => (
                      <motion.div 
                        key={cert.id} 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + (idx * 0.05) }}
                        className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/10 hover:bg-black/60 transition-all backdrop-blur-md group/item font-sans"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="text-sm font-bold text-white truncate group-hover/item:text-blue-400 transition-colors">{cert.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 font-mono">Expires: {cert.expiration_date}</p>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 shadow-lg",
                          getStatus(cert.expiration_date) === 'expired' ? "bg-red-600/60 text-white border border-red-500/50" : 
                          getStatus(cert.expiration_date) === 'expiring soon' ? "bg-orange-600/60 text-white border border-orange-500/50" :
                          "bg-amber-600/60 text-white border border-amber-500/50"
                        )}>
                          {getStatus(cert.expiration_date)}
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Location Map Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 drop-shadow-md">
                   <Compass className="w-4 h-4 text-blue-400" /> Location Map
                </h3>
                <div className="h-[220px]">
                  <SlideshowMap latStr={latStr} lonStr={lonStr} vesselName={vessel.name} />
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Ticker Tape */}
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(100vw, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 12s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
      
      {vessel.remark_from_vessel && vessel.remark_from_vessel.trim() ? (
        <div className="relative bg-slate-950/90 border-t border-white/10 backdrop-blur-md px-6 py-2.5 overflow-hidden flex items-center z-20 h-11 select-none">
          <div className="w-full overflow-hidden whitespace-nowrap">
            <div className="animate-marquee whitespace-nowrap text-sm font-semibold tracking-wide text-blue-100/90">
              {vessel.remark_from_vessel}
            </div>
          </div>
        </div>
      ) : null}

      {/* Progress Bar */}
      <div className="relative h-1.5 bg-white/10 w-full overflow-hidden">
        <motion.div 
          key={currentIndex}
          initial={{ width: 0 }}
          animate={{ width: isPaused ? '0%' : '100%' }}
          transition={{ duration: slideDuration / 1000, ease: "linear" }}
          className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        />
      </div>
    </div>
  );
};

