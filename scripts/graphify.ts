import fs from 'fs';
import path from 'path';
import { GraphifyEngine } from '../src/services/graphifyScanner';

async function runGraphify() {
  console.log('🔍 [Graphify] Scanning codebase architecture and dependencies...');
  
  const engine = new GraphifyEngine();
  const graph = engine.getGraph();
  
  const jsonPath = path.join(process.cwd(), 'graphify.json');
  fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2), 'utf-8');
  console.log(`✅ [Graphify] Exported JSON knowledge graph to: ${jsonPath}`);

  const mdPath = path.join(process.cwd(), 'GRAPHIFY.md');
  const markdown = engine.exportMarkdown();
  fs.writeFileSync(mdPath, markdown, 'utf-8');
  console.log(`✅ [Graphify] Exported Markdown AI context to: ${mdPath}`);

  console.log('\n📊 [Graphify Summary]');
  console.log(`- Total Nodes: ${graph.stats.totalNodes}`);
  console.log(`- Total Edges: ${graph.stats.totalEdges}`);
  console.log(`- Components: ${graph.stats.componentsCount}`);
  console.log(`- API Routes: ${graph.stats.routesCount}`);
  console.log(`- Database Tables: ${graph.stats.tablesCount}`);
  console.log(`- Estimated LOC: ~${graph.stats.totalLoc.toLocaleString()}`);
  console.log('\n🚀 Graphify is fully operational.');
}

runGraphify().catch(err => {
  console.error('❌ [Graphify] Error:', err);
  process.exit(1);
});
