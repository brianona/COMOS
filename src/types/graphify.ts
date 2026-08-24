export type GraphNodeType = 'component' | 'route' | 'table' | 'module' | 'type';
export type GraphEdgeType = 'imports' | 'renders' | 'calls_api' | 'queries_table' | 'uses_type' | 'depends_on';

export interface GraphNode {
  id: string;
  name: string;
  label: string;
  type: GraphNodeType;
  file?: string;
  description?: string;
  loc?: number;
  tags?: string[];
  moduleGroup?: string;
  // Relationship helpers
  dependencies?: string[];
  dependents?: string[];
  queries?: string[];
  methods?: string[];
  // Metrics
  inDegree?: number;
  outDegree?: number;
  centrality?: number;
  complexity?: number;
  // Graph visual layout
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  radius?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
  weight?: number;
}

export interface GraphifyStats {
  totalNodes: number;
  totalEdges: number;
  componentsCount: number;
  routesCount: number;
  tablesCount: number;
  modulesCount: number;
  typesCount: number;
  totalLoc: number;
  lastScannedAt: string;
  density: number;
}

export interface GraphifyData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphifyStats;
  version: string;
}

export interface ImpactAnalysis {
  nodeId: string;
  node: GraphNode;
  upstreamCallers: GraphNode[];
  downstreamDependents: GraphNode[];
  affectedTables: GraphNode[];
  affectedRoutes: GraphNode[];
  riskScore: 'Low' | 'Medium' | 'High' | 'Critical';
  blastRadiusCount: number;
}
