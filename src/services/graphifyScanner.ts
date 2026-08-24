import { GraphifyData, GraphNode, GraphEdge, GraphifyStats, ImpactAnalysis } from '../types/graphify';

export class GraphifyEngine {
  private data: GraphifyData;

  constructor(initialData?: GraphifyData) {
    this.data = initialData || this.generateDefaultGraph();
  }

  public getGraph(): GraphifyData {
    return this.data;
  }

  public setGraph(data: GraphifyData): void {
    this.data = data;
  }

  public calculateMetrics(): void {
    const nodeMap = new Map<string, GraphNode>();
    this.data.nodes.forEach(n => {
      n.inDegree = 0;
      n.outDegree = 0;
      n.dependencies = [];
      n.dependents = [];
      nodeMap.set(n.id, n);
    });

    this.data.edges.forEach(edge => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);

      if (source && target) {
        source.outDegree = (source.outDegree || 0) + 1;
        target.inDegree = (target.inDegree || 0) + 1;

        if (!source.dependencies?.includes(target.id)) {
          source.dependencies?.push(target.id);
        }
        if (!target.dependents?.includes(source.id)) {
          target.dependents?.push(source.id);
        }
      }
    });

    // Centrality and complexity
    const maxDegree = Math.max(1, ...this.data.nodes.map(n => (n.inDegree || 0) + (n.outDegree || 0)));
    this.data.nodes.forEach(n => {
      const totalDegree = (n.inDegree || 0) + (n.outDegree || 0);
      n.centrality = Number((totalDegree / maxDegree).toFixed(2));
      n.complexity = Math.min(100, Math.round(((n.loc || 50) / 30) + (totalDegree * 4)));
    });

    // Stats
    const totalNodes = this.data.nodes.length;
    const totalEdges = this.data.edges.length;
    const possibleEdges = totalNodes > 1 ? (totalNodes * (totalNodes - 1)) : 1;

    this.data.stats = {
      totalNodes,
      totalEdges,
      componentsCount: this.data.nodes.filter(n => n.type === 'component').length,
      routesCount: this.data.nodes.filter(n => n.type === 'route').length,
      tablesCount: this.data.nodes.filter(n => n.type === 'table').length,
      modulesCount: this.data.nodes.filter(n => n.type === 'module').length,
      typesCount: this.data.nodes.filter(n => n.type === 'type').length,
      totalLoc: this.data.nodes.reduce((acc, n) => acc + (n.loc || 0), 0),
      lastScannedAt: new Date().toISOString(),
      density: Number((totalEdges / possibleEdges).toFixed(4)),
    };
  }

  public analyzeImpact(nodeId: string): ImpactAnalysis | null {
    const node = this.data.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const visitedUpstream = new Set<string>();
    const upstreamNodes: GraphNode[] = [];

    const traceUpstream = (currentId: string) => {
      const incomingEdges = this.data.edges.filter(e => e.target === currentId);
      for (const edge of incomingEdges) {
        if (!visitedUpstream.has(edge.source)) {
          visitedUpstream.add(edge.source);
          const src = this.data.nodes.find(n => n.id === edge.source);
          if (src) {
            upstreamNodes.push(src);
            traceUpstream(src.id);
          }
        }
      }
    };
    traceUpstream(nodeId);

    const visitedDownstream = new Set<string>();
    const downstreamNodes: GraphNode[] = [];

    const traceDownstream = (currentId: string) => {
      const outgoingEdges = this.data.edges.filter(e => e.source === currentId);
      for (const edge of outgoingEdges) {
        if (!visitedDownstream.has(edge.target)) {
          visitedDownstream.add(edge.target);
          const tgt = this.data.nodes.find(n => n.id === edge.target);
          if (tgt) {
            downstreamNodes.push(tgt);
            traceDownstream(tgt.id);
          }
        }
      }
    };
    traceDownstream(nodeId);

    const affectedTables = [...upstreamNodes, ...downstreamNodes, node].filter(n => n.type === 'table');
    const affectedRoutes = [...upstreamNodes, ...downstreamNodes, node].filter(n => n.type === 'route');
    const blastRadiusCount = visitedUpstream.size + visitedDownstream.size;

    let riskScore: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
    if (blastRadiusCount > 12 || affectedTables.length > 3) riskScore = 'Critical';
    else if (blastRadiusCount > 6 || affectedTables.length > 1) riskScore = 'High';
    else if (blastRadiusCount > 2) riskScore = 'Medium';

    return {
      nodeId,
      node,
      upstreamCallers: upstreamNodes,
      downstreamDependents: downstreamNodes,
      affectedTables,
      affectedRoutes,
      riskScore,
      blastRadiusCount,
    };
  }

  public exportMarkdown(): string {
    const stats = this.data.stats;
    let md = `# Graphify Knowledge Graph: COMOS Vessel Management System\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n`;
    md += `**Architecture Summary:**\n`;
    md += `- **Total Graph Nodes:** ${stats.totalNodes}\n`;
    md += `- **Connected Edges:** ${stats.totalEdges}\n`;
    md += `- **Components:** ${stats.componentsCount}\n`;
    md += `- **API Routes:** ${stats.routesCount}\n`;
    md += `- **Database Tables:** ${stats.tablesCount}\n`;
    md += `- **Modules / Utilities:** ${stats.modulesCount}\n`;
    md += `- **Code Complexity LOC:** ~${stats.totalLoc.toLocaleString()} lines\n\n`;

    md += `## 1. Components & Views\n`;
    this.data.nodes.filter(n => n.type === 'component').forEach(c => {
      md += `### ${c.name} (\`${c.file || 'src'}\`)\n`;
      md += `- **Description:** ${c.description || 'Core UI View component'}\n`;
      md += `- **API Dependencies:** ${(c.dependencies || []).filter(d => d.startsWith('route_')).map(r => `\`${r.replace('route_', '')}\``).join(', ') || 'None'}\n`;
      md += `- **Sub-Components:** ${(c.dependencies || []).filter(d => d.startsWith('comp_')).map(r => `\`${r.replace('comp_', '')}\``).join(', ') || 'None'}\n\n`;
    });

    md += `## 2. API Routes & Endpoints\n`;
    this.data.nodes.filter(n => n.type === 'route').forEach(r => {
      md += `- **\`${r.name}\`**: ${r.description || 'Express endpoint'} | **Queries Tables:** ${(r.dependencies || []).filter(d => d.startsWith('table_')).map(t => `\`${t.replace('table_', '')}\``).join(', ') || 'None'}\n`;
    });

    md += `\n## 3. Database Tables & Schemas\n`;
    this.data.nodes.filter(n => n.type === 'table').forEach(t => {
      md += `- **\`${t.name}\`**: ${t.description || 'Database schema entity'} (Referenced by ${t.inDegree || 0} routes/components)\n`;
    });

    return md;
  }

  public generateDefaultGraph(): GraphifyData {
    const nodes: GraphNode[] = [
      // Core Modules
      { id: 'mod_server', name: 'server.ts', label: 'Express Backend Server', type: 'module', file: 'server.ts', loc: 8200, description: 'Main backend Express server handling authentication, MySQL connection pool, S3/B2 file storage, and REST APIs.', moduleGroup: 'Core Backend' },
      { id: 'mod_app', name: 'App.tsx', label: 'Main React Application', type: 'module', file: 'src/App.tsx', loc: 14590, description: 'Top-level client state container, navigation orchestrator, dashboard layout, and routing logic.', moduleGroup: 'Core Frontend' },
      { id: 'mod_main', name: 'main.tsx', label: 'Client Entry Point', type: 'module', file: 'src/main.tsx', loc: 30, description: 'React 18+ DOM bootstrap, global CSS loading, and strict mode mounting.', moduleGroup: 'Core Frontend' },

      // UI Components
      { id: 'comp_sms_orders', name: 'SMSOrderList.tsx', label: 'SMS Order List View', type: 'component', file: 'src/components/SMSOrderList.tsx', loc: 2680, description: 'Interactive SMS order dispatch, checklist tracking, batch packaging, vessel uploads, and real-time sidebar status indicators.', moduleGroup: 'SMS Management' },
      { id: 'comp_sms_view', name: 'SMSView.tsx', label: 'SMS Manuals & Procedures', type: 'component', file: 'src/components/SMSView.tsx', loc: 1850, description: 'SMS procedures, incident reporting, circular distribution, and acknowledgment tracking.', moduleGroup: 'SMS Management' },
      { id: 'comp_crew_audits', name: 'CrewAndAudits.tsx', label: 'Crew & Audits Hub', type: 'component', file: 'src/components/CrewAndAudits.tsx', loc: 4800, description: 'Crew matrix, compliance monitoring, employment registry, internal/external audits, VIR, and navigational inspection reports.', moduleGroup: 'Crew & Audits' },
      { id: 'comp_trouble_report', name: 'TroubleReport.tsx', label: 'Trouble & Defects View', type: 'component', file: 'src/components/TroubleReport.tsx', loc: 1420, description: 'Engine/deck trouble reporting, technical defect logs (1.6 & 5.2), root cause analysis, and corrective actions.', moduleGroup: 'Technical & Defects' },
      { id: 'comp_spare_parts', name: 'SparePartsRequisition.tsx', label: 'Spare Parts Requisition', type: 'component', file: 'src/components/SparePartsRequisition.tsx', loc: 2950, description: 'Vessel spare parts requests, PIC quotations, logistics tracking, delivery notes, and inventory status.', moduleGroup: 'Procurement & Spares' },
      { id: 'comp_bunker_bdn', name: 'BunkerBDN.tsx', label: 'Bunker BDN Logs', type: 'component', file: 'src/components/BunkerBDN.tsx', loc: 980, description: 'Bunker delivery notes, fuel grade specifications, quantity logs, and supplier tracking.', moduleGroup: 'Bunker & Fuel' },
      { id: 'comp_bunker_fuel', name: 'BunkerFuelAnalysis.tsx', label: 'Fuel Lab Analysis', type: 'component', file: 'src/components/BunkerFuelAnalysis.tsx', loc: 1100, description: 'Lab testing results, flashpoint, viscosity, sulfur content, and compliance thresholds.', moduleGroup: 'Bunker & Fuel' },
      { id: 'comp_lube_analysis', name: 'LubeOilAnalysis.tsx', label: 'Lube Oil Analysis', type: 'component', file: 'src/components/LubeOilAnalysis.tsx', loc: 1250, description: 'Main Engine & Auxiliary Engine lube oil laboratory analysis, iron/wear metrics, and alert triggers.', moduleGroup: 'Lube Oil' },
      { id: 'comp_lube_ldr', name: 'LubeOilLDR.tsx', label: 'Lube Oil LDR Logs', type: 'component', file: 'src/components/LubeOilLDR.tsx', loc: 860, description: 'Daily lube oil consumption logs, cylinder feed rates, and stock monitoring.', moduleGroup: 'Lube Oil' },
      { id: 'comp_pdf_viewer', name: 'PDFViewer.tsx', label: 'Secure PDF Document Viewer', type: 'component', file: 'src/components/PDFViewer.tsx', loc: 420, description: 'Embedded inline PDF renderer with zoom, multi-page navigation, and secure file streaming.', moduleGroup: 'Utilities' },
      { id: 'comp_image_viewer', name: 'ImageViewer.tsx', label: 'High-Res Image Viewer', type: 'component', file: 'src/components/ImageViewer.tsx', loc: 310, description: 'Lightbox modal with pan, rotate, zoom, and image inspection tools.', moduleGroup: 'Utilities' },
      { id: 'comp_about_view', name: 'AboutView.tsx', label: 'About COMOS Portal', type: 'component', file: 'src/components/AboutView.tsx', loc: 240, description: 'System metadata, release notes, vessel fleet summary, and developer information.', moduleGroup: 'Information' },
      { id: 'comp_graphify', name: 'GraphifyVisualizer.tsx', label: 'Graphify Architecture Explorer', type: 'component', file: 'src/components/GraphifyVisualizer.tsx', loc: 1200, description: 'Interactive force-directed codebase knowledge graph, dependency visualizer, and blast radius impact simulator.', moduleGroup: 'Architecture' },

      // API Endpoints
      { id: 'route_sms_orders', name: '/api/sms/orders', label: 'SMS Orders API', type: 'route', file: 'server.ts', description: 'Fetch, create, edit, and delete SMS fleet orders with form requirements.', moduleGroup: 'SMS API' },
      { id: 'route_sms_sidebar_status', name: '/api/sms/orders/sidebar-status', label: 'SMS Sidebar Status API', type: 'route', file: 'server.ts', description: 'Calculates urgent deadline proximity and unchecked upload alerts for sidebar notification badges.', moduleGroup: 'SMS API' },
      { id: 'route_sms_upload', name: '/api/sms/orders/upload', label: 'SMS Order Upload API', type: 'route', file: 'server.ts', description: 'Multi-part file upload handler with B2/S3 sync and automated completion re-evaluation.', moduleGroup: 'SMS API' },
      { id: 'route_sms_checked', name: '/api/sms/orders/:id/mark-checked', label: 'Mark Checked API', type: 'route', file: 'server.ts', description: 'Marks vessel uploads as verified by office/management personnel.', moduleGroup: 'SMS API' },
      { id: 'route_vessels', name: '/api/vessels', label: 'Vessel Fleet API', type: 'route', file: 'server.ts', description: 'Fleet registry, IMO numbers, vessel specs, and team assignments.', moduleGroup: 'Fleet API' },
      { id: 'route_certificates', name: '/api/certificates', label: 'Certificates API', type: 'route', file: 'server.ts', description: 'Statutory vessel certificates, expiration tracking, survey dates, and alert calculations.', moduleGroup: 'Certificates API' },
      { id: 'route_auth', name: '/api/auth/login', label: 'Authentication API', type: 'route', file: 'server.ts', description: 'JWT authentication, bcrypt password validation, and user role provisioning.', moduleGroup: 'Auth API' },
      { id: 'route_crews', name: '/api/crews', label: 'Crew Registry API', type: 'route', file: 'server.ts', description: 'Onboard and ashore crew members, rank matrices, and contract dates.', moduleGroup: 'Crew API' },
      { id: 'route_audits', name: '/api/audits', label: 'Audits & Inspections API', type: 'route', file: 'server.ts', description: 'Internal, external, VIR, and navigational audit findings and corrective actions.', moduleGroup: 'Audits API' },
      { id: 'route_defects', name: '/api/defects', label: 'Technical Defects API', type: 'route', file: 'server.ts', description: 'Machinery breakdown tickets, root cause records, and spare allocations.', moduleGroup: 'Defects API' },
      { id: 'route_spares', name: '/api/spares', label: 'Spare Parts & Requisitions API', type: 'route', file: 'server.ts', description: 'Spare part procurement workflow, quotation approvals, and logistics notes.', moduleGroup: 'Spares API' },
      { id: 'route_bunkers', name: '/api/bunkers', label: 'Bunker & Fuel API', type: 'route', file: 'server.ts', description: 'Bunker delivery logs, lab test analyses, and sulfur content verifications.', moduleGroup: 'Bunker API' },
      { id: 'route_lube', name: '/api/lube', label: 'Lube Oil & LDR API', type: 'route', file: 'server.ts', description: 'Lube oil laboratory test data, consumption logs, and cylinder wear trends.', moduleGroup: 'Lube API' },
      { id: 'route_graphify', name: '/api/graphify/graph', label: 'Graphify Engine API', type: 'route', file: 'server.ts', description: 'Serves the live project knowledge graph, dependency AST nodes, and impact calculations.', moduleGroup: 'Graphify API' },

      // Database Tables
      { id: 'table_sms_orders', name: 'sms_orders', label: 'SMS Orders Table', type: 'table', file: 'MySQL Schema', description: 'Stores dispatch orders, deadline dates, instructions, and creator information.', moduleGroup: 'Database' },
      { id: 'table_sms_order_uploads', name: 'sms_order_uploads', label: 'SMS Order Uploads Table', type: 'table', file: 'MySQL Schema', description: 'Tracks all vessel uploaded documents, file metadata, B2 paths, and checked status.', moduleGroup: 'Database' },
      { id: 'table_sms_order_items', name: 'sms_order_items', label: 'SMS Order Items Table', type: 'table', file: 'MySQL Schema', description: 'Required checklist forms, allowed file extensions, and template associations.', moduleGroup: 'Database' },
      { id: 'table_sms_order_vessels', name: 'sms_order_vessels', label: 'SMS Order Vessels Table', type: 'table', file: 'MySQL Schema', description: 'Assigned vessels per order and completion timestamps.', moduleGroup: 'Database' },
      { id: 'table_sms_order_templates', name: 'sms_order_templates', label: 'SMS Order Templates Table', type: 'table', file: 'MySQL Schema', description: 'Reusable order configurations and preset checklist combinations.', moduleGroup: 'Database' },
      { id: 'table_vessels', name: 'vessels', label: 'Vessels Table', type: 'table', file: 'MySQL Schema', description: 'Vessel master records, flags, build years, gross tonnage, and fleet groups.', moduleGroup: 'Database' },
      { id: 'table_certificates', name: 'certificates', label: 'Certificates Table', type: 'table', file: 'MySQL Schema', description: 'Class and statutory certificates with expiration dates and file references.', moduleGroup: 'Database' },
      { id: 'table_users', name: 'users', label: 'Users Table', type: 'table', file: 'MySQL Schema', description: 'User credentials, roles (admin, user, team_pic, vessel), and permissions.', moduleGroup: 'Database' },
      { id: 'table_crew_members', name: 'crew_members', label: 'Crew Members Table', type: 'table', file: 'MySQL Schema', description: 'Crew profiles, nationalities, ranks, embarkation/disembarkation dates.', moduleGroup: 'Database' },
      { id: 'table_audits', name: 'audits', label: 'Audits Table', type: 'table', file: 'MySQL Schema', description: 'Audit reports, findings, closing dates, and auditor details.', moduleGroup: 'Database' },
      { id: 'table_trouble_reports', name: 'trouble_reports', label: 'Trouble Reports Table', type: 'table', file: 'MySQL Schema', description: 'Machinery issues, critical alerts, photos, and resolution plans.', moduleGroup: 'Database' },
      { id: 'table_spare_requisitions', name: 'spare_requisitions', label: 'Spare Requisitions Table', type: 'table', file: 'MySQL Schema', description: 'Part requisition orders, part numbers, quantities, and delivery status.', moduleGroup: 'Database' },
      { id: 'table_audit_logs', name: 'audit_logs', label: 'System Audit Logs Table', type: 'table', file: 'MySQL Schema', description: 'Security audit trail of user actions, file deletions, and status modifications.', moduleGroup: 'Database' },

      // Types & Interfaces
      { id: 'type_vessel', name: 'Vessel', label: 'Vessel Interface', type: 'type', file: 'src/App.tsx', description: 'TypeScript interface defining vessel attributes and team associations.', moduleGroup: 'Types' },
      { id: 'type_sms_order', name: 'SMSOrder', label: 'SMSOrder Interface', type: 'type', file: 'src/components/SMSOrderList.tsx', description: 'TypeScript interface modeling SMS orders, checklist items, and vessel uploads.', moduleGroup: 'Types' },
      { id: 'type_user', name: 'User', label: 'User Interface', type: 'type', file: 'src/App.tsx', description: 'TypeScript interface for authenticated user session and RBAC roles.', moduleGroup: 'Types' },
    ];

    const edges: GraphEdge[] = [
      // App imports / renders Components
      { id: 'e1', source: 'mod_app', target: 'comp_sms_orders', type: 'renders', label: 'mounts view' },
      { id: 'e2', source: 'mod_app', target: 'comp_sms_view', type: 'renders', label: 'mounts view' },
      { id: 'e3', source: 'mod_app', target: 'comp_crew_audits', type: 'renders', label: 'mounts view' },
      { id: 'e4', source: 'mod_app', target: 'comp_trouble_report', type: 'renders', label: 'mounts view' },
      { id: 'e5', source: 'mod_app', target: 'comp_spare_parts', type: 'renders', label: 'mounts view' },
      { id: 'e6', source: 'mod_app', target: 'comp_bunker_bdn', type: 'renders', label: 'mounts view' },
      { id: 'e7', source: 'mod_app', target: 'comp_bunker_fuel', type: 'renders', label: 'mounts view' },
      { id: 'e8', source: 'mod_app', target: 'comp_lube_analysis', type: 'renders', label: 'mounts view' },
      { id: 'e9', source: 'mod_app', target: 'comp_lube_ldr', type: 'renders', label: 'mounts view' },
      { id: 'e10', source: 'mod_app', target: 'comp_about_view', type: 'renders', label: 'mounts view' },
      { id: 'e11', source: 'mod_app', target: 'comp_graphify', type: 'renders', label: 'mounts view' },
      { id: 'e12', source: 'mod_main', target: 'mod_app', type: 'imports', label: 'boots React' },

      // Utility usages
      { id: 'e13', source: 'comp_sms_orders', target: 'comp_pdf_viewer', type: 'renders', label: 'displays PDF' },
      { id: 'e14', source: 'comp_spare_parts', target: 'comp_pdf_viewer', type: 'renders', label: 'displays PDF' },
      { id: 'e15', source: 'comp_trouble_report', target: 'comp_image_viewer', type: 'renders', label: 'previews photo' },

      // Component API Calls
      { id: 'e16', source: 'comp_sms_orders', target: 'route_sms_orders', type: 'calls_api', label: 'GET / POST / DELETE' },
      { id: 'e17', source: 'comp_sms_orders', target: 'route_sms_upload', type: 'calls_api', label: 'POST file' },
      { id: 'e18', source: 'comp_sms_orders', target: 'route_sms_checked', type: 'calls_api', label: 'POST check' },
      { id: 'e19', source: 'mod_app', target: 'route_sms_sidebar_status', type: 'calls_api', label: 'polls notification status' },
      { id: 'e20', source: 'mod_app', target: 'route_vessels', type: 'calls_api', label: 'loads fleet' },
      { id: 'e21', source: 'mod_app', target: 'route_certificates', type: 'calls_api', label: 'loads certs' },
      { id: 'e22', source: 'mod_app', target: 'route_auth', type: 'calls_api', label: 'authenticates' },
      { id: 'e23', source: 'comp_crew_audits', target: 'route_crews', type: 'calls_api', label: 'manages crew' },
      { id: 'e24', source: 'comp_crew_audits', target: 'route_audits', type: 'calls_api', label: 'manages audits' },
      { id: 'e25', source: 'comp_trouble_report', target: 'route_defects', type: 'calls_api', label: 'submits report' },
      { id: 'e26', source: 'comp_spare_parts', target: 'route_spares', type: 'calls_api', label: 'submits requisition' },
      { id: 'e27', source: 'comp_bunker_bdn', target: 'route_bunkers', type: 'calls_api', label: 'logs BDN' },
      { id: 'e28', source: 'comp_bunker_fuel', target: 'route_bunkers', type: 'calls_api', label: 'fetches lab data' },
      { id: 'e29', source: 'comp_lube_analysis', target: 'route_lube', type: 'calls_api', label: 'fetches test results' },
      { id: 'e30', source: 'comp_lube_ldr', target: 'route_lube', type: 'calls_api', label: 'logs daily usage' },
      { id: 'e31', source: 'comp_graphify', target: 'route_graphify', type: 'calls_api', label: 'queries live graph' },

      // Server Route to Database Table queries
      { id: 'e32', source: 'route_sms_orders', target: 'table_sms_orders', type: 'queries_table', label: 'SELECT / INSERT / UPDATE' },
      { id: 'e33', source: 'route_sms_orders', target: 'table_sms_order_items', type: 'queries_table', label: 'JOIN requirements' },
      { id: 'e34', source: 'route_sms_orders', target: 'table_sms_order_vessels', type: 'queries_table', label: 'JOIN status' },
      { id: 'e35', source: 'route_sms_orders', target: 'table_sms_order_templates', type: 'queries_table', label: 'CRUD templates' },
      { id: 'e36', source: 'route_sms_upload', target: 'table_sms_order_uploads', type: 'queries_table', label: 'INSERT upload' },
      { id: 'e37', source: 'route_sms_sidebar_status', target: 'table_sms_orders', type: 'queries_table', label: 'evaluates deadlines' },
      { id: 'e38', source: 'route_sms_sidebar_status', target: 'table_sms_order_uploads', type: 'queries_table', label: 'evaluates unchecked' },
      { id: 'e39', source: 'route_sms_checked', target: 'table_sms_order_uploads', type: 'queries_table', label: 'UPDATE checked_at' },
      { id: 'e40', source: 'route_vessels', target: 'table_vessels', type: 'queries_table', label: 'SELECT vessels' },
      { id: 'e41', source: 'route_certificates', target: 'table_certificates', type: 'queries_table', label: 'SELECT certs' },
      { id: 'e42', source: 'route_auth', target: 'table_users', type: 'queries_table', label: 'SELECT / verify' },
      { id: 'e43', source: 'route_crews', target: 'table_crew_members', type: 'queries_table', label: 'CRUD crew' },
      { id: 'e44', source: 'route_audits', target: 'table_audits', type: 'queries_table', label: 'CRUD audits' },
      { id: 'e45', source: 'route_defects', target: 'table_trouble_reports', type: 'queries_table', label: 'CRUD defects' },
      { id: 'e46', source: 'route_spares', target: 'table_spare_requisitions', type: 'queries_table', label: 'CRUD requisitions' },
      { id: 'e47', source: 'mod_server', target: 'table_audit_logs', type: 'queries_table', label: 'INSERT logAudit' },

      // Type usages
      { id: 'e48', source: 'comp_sms_orders', target: 'type_sms_order', type: 'uses_type', label: 'implements' },
      { id: 'e49', source: 'mod_app', target: 'type_vessel', type: 'uses_type', label: 'implements' },
      { id: 'e50', source: 'mod_app', target: 'type_user', type: 'uses_type', label: 'implements' },
    ];

    const engine = { data: { nodes, edges, stats: {} as any, version: '1.0.0' } } as any;
    const initialEngine = new GraphifyEngine(engine.data);
    initialEngine.calculateMetrics();
    return initialEngine.getGraph();
  }
}

export const defaultGraphEngine = new GraphifyEngine();
