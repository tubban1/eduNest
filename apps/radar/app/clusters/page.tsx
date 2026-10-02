import Link from 'next/link';
import { listClusters, listSignals, listRelations } from '@/lib/radar';
import { Navigation } from '@/components/Navigation';
import { ClustersClient } from './ClustersClient';
import { ArrowLeft, Network } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ClustersPage() {
  const clusters = await listClusters();
  const signals = await listSignals(100);
  const relations = await listRelations();

  return (
    <div className="radar-app-shell">
      <Navigation />

      <main className="explorer-page-container">
        {/* Breadcrumb & Title */}
        <div className="page-header-block">
          <div className="breadcrumb-nav">
            <Link href="/" className="back-link">
              <ArrowLeft size={13} />
              <span>Back to Global Radar</span>
            </Link>
            <span className="bc-sep">/</span>
            <span className="bc-current">Relational Clusters</span>
          </div>

          <div className="page-title-row">
            <div>
              <div className="page-eyebrow">
                <Network size={13} className="text-emerald" />
                <span>RELATIONAL INTELLIGENCE & PATTERN SYNTHESIS</span>
              </div>
              <h1 className="page-headline">Emerging Innovation Clusters</h1>
              <p className="page-subhead">
                Mapping how disparate grassroots experiments and academic pilots across different countries 
                converge into recognizable pedagogical patterns. All clusters remain provisional, 
                falsifiable research hypotheses.
              </p>
            </div>
          </div>
        </div>

        {/* Relational Intelligence Workbench */}
        <ClustersClient
          clusters={clusters}
          signals={signals}
          relations={relations}
        />
      </main>

      <footer className="global-footer">
        <div className="footer-content">
          <div>AI Education Innovation Radar · BeLEARN Booster Demonstrator</div>
          <div>Provisional inductive clustering · Not deterministic market trends</div>
        </div>
      </footer>
    </div>
  );
}
