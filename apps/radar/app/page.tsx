import Link from 'next/link';
import {
  Globe2,
  Radar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Compass,
  Layers,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  BookOpen
} from 'lucide-react';
import { listSignals, listClusters } from '@/lib/radar';
import { WorldSignalMap } from '@/components/WorldSignalMap';
import { SignalCard } from '@/components/SignalCard';
import { Navigation } from '@/components/Navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const signals = await listSignals(100);
  const clusters = await listClusters();

  // Metrics calculation
  const totalSignals = signals.length;
  const observedCountries = Array.from(new Set(signals.map((s) => s.country_code).filter(Boolean)));
  const innovationTypes = Array.from(new Set(signals.map((s) => s.innovation_type))).length;
  const swissTranslationsCount = signals.filter((s) => Boolean(s.swiss_application_hypothesis)).length;

  return (
    <div className="radar-app-shell">
      <Navigation />

      <main className="radar-main">
        {/* HERO: SCIENTIFIC INTELLIGENCE CONSOLE */}
        <section className="hero-instrument">
          <div className="hero-content">
            <div className="hero-eyebrow">
              <span className="inst-indicator" />
              <span>BELEARN BOOSTER RESEARCH DEMONSTRATOR</span>
              <span className="inst-pipe">/</span>
              <span>PHBERN COGNATE LAB</span>
            </div>

            <h1 className="hero-headline">
              Global Education <br />
              <span className="text-highlight">Innovation Radar</span>
            </h1>

            <p className="hero-manifesto">
              A scientific intelligence instrument monitoring early educational experiments, 
              geospatial diffusion patterns, and emerging pedagogical clusters worldwide — 
              systematically translating unverified global signals into structured, 
              exploratory hypotheses for Swiss educational practice.
            </p>

            {/* FLOW PIPELINE INDICATOR: Global signals → origins → connections → clusters → Swiss translation */}
            <div className="pipeline-flow-banner">
              <span className="flow-step active">
                <span className="dot" /> Global Signals
              </span>
              <span className="flow-sep">→</span>
              <span className="flow-step">Geographic Origins</span>
              <span className="flow-sep">→</span>
              <span className="flow-step">Connections</span>
              <span className="flow-sep">→</span>
              <span className="flow-step">Emerging Clusters</span>
              <span className="flow-sep">→</span>
              <span className="flow-step swiss-focus">
                <span className="swiss-cross">+</span> Swiss Translation
              </span>
            </div>
          </div>

          {/* TELEMETRY TELEMETRIC COUNTERS */}
          <div className="hero-metrics-panel">
            <div className="metric-cell">
              <div className="metric-header">
                <Activity size={14} className="metric-icon" />
                <span className="metric-tag">ACTIVE SIGNALS</span>
              </div>
              <div className="metric-value">{totalSignals}</div>
              <div className="metric-sub">Curated international observations</div>
            </div>

            <div className="metric-cell">
              <div className="metric-header">
                <Compass size={14} className="metric-icon" />
                <span className="metric-tag">COUNTRIES OBSERVED</span>
              </div>
              <div className="metric-value">{observedCountries.length}</div>
              <div className="metric-sub">Global distribution nodes</div>
            </div>

            <div className="metric-cell">
              <div className="metric-header">
                <Layers size={14} className="metric-icon" />
                <span className="metric-tag">EMERGING CLUSTERS</span>
              </div>
              <div className="metric-value">{clusters.length}</div>
              <div className="metric-sub">Provisional relational syntheses</div>
            </div>

            <div className="metric-cell">
              <div className="metric-header">
                <ShieldCheck size={14} className="metric-icon text-accent" />
                <span className="metric-tag">SWISS TRANSLATIONS</span>
              </div>
              <div className="metric-value">{swissTranslationsCount}</div>
              <div className="metric-sub">Exploratory local hypotheses</div>
            </div>
          </div>
        </section>

        {/* WORKSPACE: MAP & LIVE RADAR FEED */}
        <section className="intelligence-workspace">
          <div className="workspace-map-pane">
            <WorldSignalMap signals={signals} />
          </div>

          <aside className="workspace-feed-pane">
            <div className="feed-header">
              <div className="feed-title-block">
                <span className="section-eyebrow">RECENT DISCOVERIES</span>
                <h3>Live Signal Stream</h3>
              </div>
              <Link href="/signals" className="feed-all-link">
                <span>All {totalSignals}</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="feed-stream">
              {signals.slice(0, 5).map((s) => (
                <SignalCard key={s.id} signal={s} viewMode="dense" />
              ))}
            </div>

            <div className="feed-footer-meta">
              <span className="feed-note">
                Demonstration feed · live ingestion pipeline not yet connected.
              </span>
            </div>
          </aside>
        </section>

        {/* SECTION: RELATIONAL INTELLIGENCE / EMERGING CLUSTERS PREVIEW */}
        <section className="clusters-section">
          <div className="section-header-wide">
            <div>
              <div className="section-eyebrow">RELATIONAL INTELLIGENCE</div>
              <h2 className="section-title">Emerging Pedagogical Clusters</h2>
              <p className="section-desc">
                Signals appearing independently across multiple jurisdictions often indicate an 
                underlying paradigm shift. Clusters are provisional hypotheses, not deterministic trends.
              </p>
            </div>
            <Link href="/clusters" className="inst-action-link">
              <span>Inspect All Clusters</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="cluster-cards-grid">
            {clusters.slice(0, 3).map((c) => (
              <div key={c.id} className="cluster-preview-card">
                <div className="cluster-card-head">
                  <span className="cluster-tag">
                    {c.signalsCount} OBSERVED SIGNALS
                  </span>
                  <span className="cluster-status-pill">
                    {c.hypothesisStatus.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="cluster-card-title">{c.title}</h3>
                <p className="cluster-card-sub">{c.subtitle}</p>

                <div className="cluster-geo-trace">
                  <span className="geo-trace-label">OBSERVED GEOGRAPHIES:</span>
                  <div className="geo-trace-tags">
                    {c.primaryGeography.map((g) => (
                      <span key={g} className="geo-badge">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="cluster-card-impact">
                  <span className="impact-label">EDUCATIONAL HYPOTHESIS:</span>
                  <p>{c.educationalImpact}</p>
                </div>

                <div className="cluster-card-footer">
                  <Link href={`/clusters#${c.id}`} className="cluster-explore-link">
                    <span>Trace Relational Graph</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: SWISS TRANSLATION SHOWCASE */}
        <section className="swiss-translation-showcase">
          <div className="swiss-header-strip">
            <div className="swiss-badge-large">
              <span className="swiss-cross">+</span>
              <span>SWISS EDUCATIONAL TRANSLATION FRAMEWORK</span>
            </div>
            <div className="swiss-caveat-notice">
              <ShieldCheck size={14} />
              <span>Exploratory hypothesis — not a validated recommendation</span>
            </div>
          </div>

          <div className="swiss-intro-grid">
            <div className="swiss-lead">
              <h3>How international innovation informs Swiss classrooms</h3>
              <p>
                A technological development in Silicon Valley or Singapore cannot be transplanted directly into 
                the Swiss public education system. Every signal on this radar undergoes structured pedagogical translation, 
                examining its compatibility with Lehrplan 21, cantonal autonomy, the dual VET model (Berufslehre), 
                and PHBern pre-service teacher competencies.
              </p>
            </div>

            <div className="swiss-criteria-box">
              <h4>Systemic Translation Dimensions</h4>
              <ul>
                <li><strong>Curricular Compatibility:</strong> Lehrplan 21 / Sek I / Sek II competencies.</li>
                <li><strong>Public Governance & Sovereignty:</strong> Cantonal data protection compliance.</li>
                <li><strong>Pedagogical Agency:</strong> Empowering educators rather than replacing didactics.</li>
                <li><strong>Empirical Verifiability:</strong> Measurable impact on student learning artifacts.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="global-footer">
        <div className="footer-content">
          <div className="footer-left">
            <div className="footer-brand">
              <Radar size={16} className="text-emerald" />
              <span>AI Education Innovation Radar · BeLEARN Booster Demonstrator</span>
            </div>
            <p className="footer-text">
              Demonstrator developed for the BeLEARN Consortium & PHBern. 
              Designed for scientific signal monitoring, relational clustering, and localized educational translation. 
              Not a commercial ranking portal.
            </p>
          </div>

          <div className="footer-right">
            <div className="footer-nav">
              <Link href="/signals">Signals Explorer</Link>
              <Link href="/clusters">Emerging Clusters</Link>
              <Link href="/mcp">MCP Interface</Link>
              <a href="https://belearn.swiss" target="_blank" rel="noreferrer">
                BeLEARN Swiss
              </a>
            </div>
            <div className="footer-disclaimer">
              <span>Strictly separated metrics: Novelty ≠ Maturity ≠ Evidence.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
