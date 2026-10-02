import Link from 'next/link';
import { listSignals } from '@/lib/radar';
import { Navigation } from '@/components/Navigation';
import { SignalsClient } from './SignalsClient';
import { Sparkles, ArrowLeft, Radio } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SignalsPage() {
  const signals = await listSignals(100);

  return (
    <div className="radar-app-shell">
      <Navigation />

      <main className="explorer-page-container">
        {/* Head Breadcrumb & Title */}
        <div className="page-header-block">
          <div className="breadcrumb-nav">
            <Link href="/" className="back-link">
              <ArrowLeft size={13} />
              <span>Back to Global Radar</span>
            </Link>
            <span className="bc-sep">/</span>
            <span className="bc-current">Signal Explorer</span>
          </div>

          <div className="page-title-row">
            <div>
              <div className="page-eyebrow">
                <Radio size={13} className="text-emerald animate-pulse" />
                <span>OBSERVATIONAL REPOSITORY</span>
              </div>
              <h1 className="page-headline">Innovation Signals Explorer</h1>
              <p className="page-subhead">
                A structured registry of early experiments, pilots, academic findings, and institutional 
                developments. Each signal is cataloged across independent dimensions of novelty, maturity, 
                and empirical evidence.
              </p>
            </div>
          </div>
        </div>

        {/* Client Interactive Explorer */}
        <SignalsClient initialSignals={signals} />
      </main>

      <footer className="global-footer">
        <div className="footer-content">
          <div>AI Education Innovation Radar · BeLEARN Booster Demonstrator</div>
          <div>Exploratory scientific mapping · Not an EdTech product ranking</div>
        </div>
      </footer>
    </div>
  );
}
