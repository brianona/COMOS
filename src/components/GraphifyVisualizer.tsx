import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Network, Search, RefreshCw, ZoomIn, ZoomOut, Maximize2, 
  Layers, Database, Globe, FileCode, Box, ShieldAlert, 
  CheckCircle2, Copy, Download, ExternalLink, ArrowRight, 
  Sparkles, Code, Filter, Activity, X, Info
} from 'lucide-react';
import { GraphifyData, GraphNode, GraphEdge, GraphNodeType, ImpactAnalysis } from '../types/graphify';
import { defaultGraphEngine } from '../services/graphifyScanner';

interface GraphifyVisualizerProps {
  token: string;
  currentUser: any;
}

export const GraphifyVisualizer: React.FC<GraphifyVisualizerProps> = ({ token, currentUser }) => {
  const [graphData, setGraphData] = useState<GraphifyData>(() => defaultGraphEngine.getGraph());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [isImpactMode, setIsImpactMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'table' | 'impact'>('graph');

  // Canvas pan & zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Dragging node state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  // Simulation nodes state
  const [simNodes, setSimNodes] = useState<GraphNode[]>([]);

  // Fetch live graph from server on mount
  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/graphify/graph', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (e) {
      console.warn('Failed to load server graph, using local engine:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/graphify/rescan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGraphData(data.graph);
        if (selectedNode) {
          const updated = data.graph.nodes.find((n: GraphNode) => n.id === selectedNode.id);
          if (updated) setSelectedNode(updated);
        }
      }
    } catch (e) {
      console.error('Error rescanning:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  // Initialize node physics positions in clusters by type
  useEffect(() => {
    if (!graphData.nodes.length) return;

    const width = 1100;
    const height = 700;
    const centerX = width / 2;
    const centerY = height / 2;

    const typeAngleMap: Record<GraphNodeType, number> = {
      component: 0,
      route: Math.PI * 0.5,
      table: Math.PI,
      module: Math.PI * 1.5,
      type: Math.PI * 1.8,
    };

    const nodesWithPos = graphData.nodes.map((node, i) => {
      const baseAngle = typeAngleMap[node.type] || (i / graphData.nodes.length) * 2 * Math.PI;
      const radius = 220 + (i % 6) * 35;
      const angle = baseAngle + ((i % 5) - 2) * 0.18;

      return {
        ...node,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: node.type === 'module' ? 32 : node.type === 'component' ? 26 : node.type === 'table' ? 24 : 20,
      };
    });

    setSimNodes(nodesWithPos);
  }, [graphData]);

  // Simple gentle force simulation loop
  useEffect(() => {
    if (simNodes.length === 0) return;

    let animFrame: number;
    let iterations = 0;
    const maxIterations = 80;

    const tick = () => {
      if (iterations >= maxIterations) return;
      iterations++;

      setSimNodes(prevNodes => {
        const nextNodes = prevNodes.map(n => ({ ...n }));
        const nodeMap = new Map<string, GraphNode>(nextNodes.map(n => [n.id, n]));

        // 1. Repulsion between all nodes
        for (let i = 0; i < nextNodes.length; i++) {
          for (let j = i + 1; j < nextNodes.length; j++) {
            const a = nextNodes[i];
            const b = nextNodes[j];
            const dx = (b.x || 0) - (a.x || 0);
            const dy = (b.y || 0) - (a.y || 0);
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);

            const minDist = (a.radius || 20) + (b.radius || 20) + 40;
            if (dist < minDist) {
              const force = (minDist - dist) / dist * 0.08;
              if (a.id !== draggedNodeId) {
                a.x = (a.x || 0) - dx * force;
                a.y = (a.y || 0) - dy * force;
              }
              if (b.id !== draggedNodeId) {
                b.x = (b.x || 0) + dx * force;
                b.y = (b.y || 0) + dy * force;
              }
            }
          }
        }

        // 2. Attraction along edges
        graphData.edges.forEach(edge => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (source && target) {
            const dx = (target.x || 0) - (source.x || 0);
            const dy = (target.y || 0) - (source.y || 0);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const desiredDist = 130;
            const force = (dist - desiredDist) * 0.005;

            if (source.id !== draggedNodeId) {
              source.x = (source.x || 0) + (dx / dist) * force;
              source.y = (source.y || 0) + (dy / dist) * force;
            }
            if (target.id !== draggedNodeId) {
              target.x = (target.x || 0) - (dx / dist) * force;
              target.y = (target.y || 0) - (dy / dist) * force;
            }
          }
        });

        // 3. Center gravity pull
        const centerX = 550;
        const centerY = 350;
        nextNodes.forEach(n => {
          if (n.id !== draggedNodeId) {
            n.x = (n.x || 0) + (centerX - (n.x || 0)) * 0.004;
            n.y = (n.y || 0) + (centerY - (n.y || 0)) * 0.004;
          }
        });

        return nextNodes;
      });

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [graphData.edges, draggedNodeId]);

  // Handle node selection & impact analysis
  const handleSelectNode = (node: GraphNode) => {
    setSelectedNode(node);
    const impact = defaultGraphEngine.analyzeImpact(node.id);
    setImpactAnalysis(impact);
  };

  // Node coloring and icons helper
  const getNodeVisuals = (type: GraphNodeType) => {
    switch (type) {
      case 'component':
        return {
          bg: 'fill-purple-50 stroke-purple-400',
          activeBg: 'fill-purple-600 stroke-purple-800 text-white',
          badge: 'bg-purple-100 text-purple-800 border-purple-300',
          textColor: 'text-purple-700',
          colorHex: '#8b5cf6',
          icon: Box,
          label: 'Component'
        };
      case 'route':
        return {
          bg: 'fill-sky-50 stroke-sky-400',
          activeBg: 'fill-sky-600 stroke-sky-800 text-white',
          badge: 'bg-sky-100 text-sky-800 border-sky-300',
          textColor: 'text-sky-700',
          colorHex: '#0284c7',
          icon: Globe,
          label: 'API Route'
        };
      case 'table':
        return {
          bg: 'fill-emerald-50 stroke-emerald-400',
          activeBg: 'fill-emerald-600 stroke-emerald-800 text-white',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          textColor: 'text-emerald-700',
          colorHex: '#10b981',
          icon: Database,
          label: 'Database Table'
        };
      case 'module':
        return {
          bg: 'fill-amber-50 stroke-amber-400',
          activeBg: 'fill-amber-600 stroke-amber-800 text-white',
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          textColor: 'text-amber-700',
          colorHex: '#f59e0b',
          icon: FileCode,
          label: 'Module / Core'
        };
      case 'type':
        return {
          bg: 'fill-indigo-50 stroke-indigo-400',
          activeBg: 'fill-indigo-600 stroke-indigo-800 text-white',
          badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
          textColor: 'text-indigo-700',
          colorHex: '#6366f1',
          icon: Code,
          label: 'Type Model'
        };
    }
  };

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return simNodes.filter(node => {
      const matchesSearch = !searchQuery || 
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.description && node.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedType === 'all' || node.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [simNodes, searchQuery, selectedType]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  // Filtered edges
  const visibleEdges = useMemo(() => {
    return graphData.edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
  }, [graphData.edges, filteredNodeIds]);

  // Blast radius highlighted set
  const blastRadiusIds = useMemo(() => {
    if (!selectedNode || !isImpactMode || !impactAnalysis) return null;
    const set = new Set<string>();
    set.add(selectedNode.id);
    impactAnalysis.upstreamCallers.forEach(n => set.add(n.id));
    impactAnalysis.downstreamDependents.forEach(n => set.add(n.id));
    return set;
  }, [selectedNode, isImpactMode, impactAnalysis]);

  // Copy AI context markdown
  const handleCopyMarkdown = () => {
    const md = defaultGraphEngine.exportMarkdown();
    navigator.clipboard.writeText(md);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Download graphify.json
  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(graphData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graphify.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pan and zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform(prev => ({
      ...prev,
      k: Math.max(0.3, Math.min(3, prev.k * zoomFactor))
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    } else if (draggedNodeId) {
      setSimNodes(prev => prev.map(n => {
        if (n.id === draggedNodeId) {
          return {
            ...n,
            x: (e.clientX - transform.x) / transform.k,
            y: (e.clientY - transform.y) / transform.k
          };
        }
        return n;
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggedNodeId(null);
  };

  const resetViewport = () => {
    setTransform({ x: 0, y: 0, k: 1 });
  };

  const stats = graphData.stats;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 bottom-0 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/40 text-blue-300 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Graphify Architecture Engine
              </span>
              <span className="text-xs text-slate-400 font-mono">v{graphData.version}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Network className="w-8 h-8 text-blue-400" />
              Codebase Knowledge Graph
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Explore structural relationships across React components, Express REST API routes, MySQL database tables, and core system modules with instant blast radius simulation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleRescan}
              disabled={loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Rescan project AST and database schema"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Analyzing...' : 'Re-Scan Codebase'}</span>
            </button>

            <button
              onClick={handleCopyMarkdown}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
              title="Copy graph knowledge context for AI coding assistants"
            >
              {copySuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copySuccess ? 'Copied AI Context!' : 'Export AI Markdown'}</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download graphify.json"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Total Nodes</div>
            <div className="text-xl font-black text-white mt-0.5">{stats.totalNodes || 0}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-purple-300 text-[11px] font-bold uppercase tracking-wider">Components</div>
            <div className="text-xl font-black text-purple-200 mt-0.5">{stats.componentsCount || 0}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-sky-300 text-[11px] font-bold uppercase tracking-wider">API Routes</div>
            <div className="text-xl font-black text-sky-200 mt-0.5">{stats.routesCount || 0}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-emerald-300 text-[11px] font-bold uppercase tracking-wider">DB Tables</div>
            <div className="text-xl font-black text-emerald-200 mt-0.5">{stats.tablesCount || 0}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-amber-300 text-[11px] font-bold uppercase tracking-wider">Total Edges</div>
            <div className="text-xl font-black text-amber-200 mt-0.5">{stats.totalEdges || 0}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Project LOC</div>
            <div className="text-xl font-black text-white mt-0.5">~{(stats.totalLoc || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Views */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search components, endpoints, tables, or modules..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 flex-wrap">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              selectedType === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            All ({graphData.nodes.length})
          </button>

          <button
            onClick={() => setSelectedType('component')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedType === 'component'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            Components ({stats.componentsCount})
          </button>

          <button
            onClick={() => setSelectedType('route')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedType === 'route'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            API Routes ({stats.routesCount})
          </button>

          <button
            onClick={() => setSelectedType('table')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedType === 'table'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            DB Tables ({stats.tablesCount})
          </button>

          <button
            onClick={() => setSelectedType('module')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedType === 'module'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-700'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Core ({stats.modulesCount})
          </button>
        </div>

        {/* View Switcher & Blast Radius toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImpactMode(!isImpactMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              isImpactMode
                ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
            }`}
            title="Highlight blast radius and dependency chains for selected node"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Blast Radius Mode {isImpactMode ? 'ON' : 'OFF'}</span>
          </button>

          <div className="bg-slate-100 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Registry
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Workspace */}
      {viewMode === 'graph' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Force-directed SVG Graph Canvas */}
          <div className="lg:col-span-8 bg-slate-950 rounded-3xl border border-slate-800 shadow-xl overflow-hidden relative h-[650px]">
            {/* Canvas Zoom & Pan Controls */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-lg">
              <button
                onClick={() => setTransform(prev => ({ ...prev, k: Math.min(3, prev.k * 1.2) }))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTransform(prev => ({ ...prev, k: Math.max(0.3, prev.k / 1.2) }))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={resetViewport}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="Reset Camera"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Legend Overlay */}
            <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 text-[11px] text-slate-300 space-y-1.5 shadow-lg hidden sm:block">
              <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Graph Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span>Components ({stats.componentsCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>API Routes ({stats.routesCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>DB Tables ({stats.tablesCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Core Modules ({stats.modulesCount})</span>
              </div>
            </div>

            {/* Interactive SVG Canvas */}
            <svg
              ref={svgRef}
              className="w-full h-full cursor-grab active:cursor-grabbing select-none"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* Background Grid Pattern */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.75" strokeOpacity="0.6" />
                </pattern>
                <marker
                  id="arrow"
                  viewBox="0 -5 10 10"
                  refX="22"
                  refY="0"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M0,-5L10,0L0,5" fill="#475569" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 -5 10 10"
                  refX="22"
                  refY="0"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,-5L10,0L0,5" fill="#ef4444" />
                </marker>
              </defs>

              <rect width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
                {/* Render Edges */}
                {visibleEdges.map(edge => {
                  const sourceNode = simNodes.find(n => n.id === edge.source);
                  const targetNode = simNodes.find(n => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const isBlastEdge = blastRadiusIds && blastRadiusIds.has(edge.source) && blastRadiusIds.has(edge.target);
                  const isDimmed = blastRadiusIds && !isBlastEdge;

                  return (
                    <g key={edge.id}>
                      <line
                        x1={sourceNode.x || 0}
                        y1={sourceNode.y || 0}
                        x2={targetNode.x || 0}
                        y2={targetNode.y || 0}
                        stroke={isBlastEdge ? '#f43f5e' : '#334155'}
                        strokeWidth={isBlastEdge ? 2.5 : 1.2}
                        strokeDasharray={edge.type === 'calls_api' ? '4 2' : undefined}
                        opacity={isDimmed ? 0.15 : 0.85}
                        markerEnd={isBlastEdge ? 'url(#arrow-active)' : 'url(#arrow)'}
                      />
                    </g>
                  );
                })}

                {/* Render Nodes */}
                {filteredNodes.map(node => {
                  const visuals = getNodeVisuals(node.type);
                  const isSelected = selectedNode?.id === node.id;
                  const inBlastRadius = blastRadiusIds?.has(node.id);
                  const isDimmed = blastRadiusIds && !inBlastRadius;
                  const radius = node.radius || 24;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x || 0}, ${node.y || 0})`}
                      className="cursor-pointer transition-transform duration-75"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggedNodeId(node.id);
                      }}
                      onClick={() => handleSelectNode(node)}
                    >
                      {/* Pulse ring if selected or blast target */}
                      {(isSelected || (isImpactMode && inBlastRadius)) && (
                        <circle
                          r={radius + 8}
                          className="animate-ping opacity-25"
                          fill={inBlastRadius ? '#f43f5e' : visuals.colorHex}
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r={radius}
                        fill={isSelected ? visuals.colorHex : inBlastRadius ? '#e11d48' : '#0f172a'}
                        stroke={isSelected ? '#ffffff' : inBlastRadius ? '#fda4af' : visuals.colorHex}
                        strokeWidth={isSelected ? 3 : 2}
                        opacity={isDimmed ? 0.2 : 1}
                        className="transition-all hover:stroke-white hover:stroke-[3px]"
                      />

                      {/* Node Label Text */}
                      <text
                        dy={radius + 14}
                        textAnchor="middle"
                        fill={isDimmed ? '#475569' : '#e2e8f0'}
                        fontSize="11"
                        fontWeight={isSelected ? 'bold' : '500'}
                        className="pointer-events-none drop-shadow-sm font-sans"
                        opacity={isDimmed ? 0.3 : 1}
                      >
                        {node.name.length > 20 ? `${node.name.substring(0, 18)}...` : node.name}
                      </text>

                      {/* Small Type Icon Marker inside Circle */}
                      <text
                        dy="4"
                        textAnchor="middle"
                        fill={isSelected ? '#ffffff' : visuals.colorHex}
                        fontSize="10"
                        fontWeight="900"
                        className="pointer-events-none"
                      >
                        {node.type === 'component' ? 'UI' : node.type === 'route' ? 'API' : node.type === 'table' ? 'DB' : 'MOD'}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Node Inspector & Impact Panel */}
          <div className="lg:col-span-4 space-y-4">
            {selectedNode ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                {/* Node Title & Type Badge */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${getNodeVisuals(selectedNode.type).badge}`}>
                      {getNodeVisuals(selectedNode.type).label}
                    </span>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    {selectedNode.label}
                  </h3>
                  <div className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 truncate">
                    {selectedNode.file || selectedNode.name}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedNode.description || 'Core entity within COMOS fleet architecture.'}
                </p>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Incoming Callers</span>
                    <div className="text-base font-black text-slate-800">{selectedNode.inDegree || 0}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Outgoing Links</span>
                    <div className="text-base font-black text-slate-800">{selectedNode.outDegree || 0}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Centrality Index</span>
                    <div className="text-base font-black text-blue-600">{selectedNode.centrality || 0}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Est. Complexity</span>
                    <div className="text-base font-black text-indigo-600">{selectedNode.complexity || 0}/100</div>
                  </div>
                </div>

                {/* Blast Radius / Impact Analysis Box */}
                {impactAnalysis && (
                  <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-rose-900">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span>Blast Radius Risk</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        impactAnalysis.riskScore === 'Critical' ? 'bg-red-600 text-white' :
                        impactAnalysis.riskScore === 'High' ? 'bg-rose-600 text-white' :
                        impactAnalysis.riskScore === 'Medium' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                      }`}>
                        {impactAnalysis.riskScore} Risk
                      </span>
                    </div>

                    <div className="text-xs text-rose-800 space-y-1">
                      <div>• <strong>{impactAnalysis.blastRadiusCount}</strong> connected components/routes affected.</div>
                      {impactAnalysis.affectedTables.length > 0 && (
                        <div>• Direct database schema touchpoints: <strong>{impactAnalysis.affectedTables.map(t => t.name).join(', ')}</strong></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dependencies List */}
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    Outgoing Dependencies ({selectedNode.dependencies?.length || 0})
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {(selectedNode.dependencies || []).map(depId => {
                      const dep = graphData.nodes.find(n => n.id === depId);
                      if (!dep) return null;
                      const vis = getNodeVisuals(dep.type);
                      return (
                        <button
                          key={depId}
                          onClick={() => handleSelectNode(dep)}
                          className="w-full text-left p-2 bg-slate-50 hover:bg-blue-50/60 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors flex items-center justify-between text-xs cursor-pointer group"
                        >
                          <span className="font-semibold text-slate-700 group-hover:text-blue-700 truncate">{dep.label}</span>
                          <span className={`px-1.5 py-0.2 text-[9px] font-black rounded ${vis.badge}`}>{vis.label}</span>
                        </button>
                      );
                    })}
                    {(!selectedNode.dependencies || selectedNode.dependencies.length === 0) && (
                      <div className="text-xs text-slate-400 italic">No outgoing dependencies.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs text-center space-y-3 py-16">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Layers className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No Node Selected</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Click on any node in the graph or search above to view its dependency tree, callers, and blast radius impact.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Registry Table View */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Entity</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">File / Schema</th>
                  <th className="py-3.5 px-4 text-center">In-Degree</th>
                  <th className="py-3.5 px-4 text-center">Out-Degree</th>
                  <th className="py-3.5 px-4 text-center">Complexity</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNodes.map(node => {
                  const vis = getNodeVisuals(node.type);
                  return (
                    <tr key={node.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{node.label}</div>
                        <div className="text-[11px] text-slate-400">{node.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase ${vis.badge}`}>
                          {vis.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {node.file || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {node.inDegree || 0}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {node.outDegree || 0}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-600">
                        {node.complexity || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedNode(node);
                            setViewMode('graph');
                          }}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          View in Graph
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
