import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSignal, getSignalRelations, listReviews } from '@/lib/radar';
import { Navigation } from '@/components/Navigation';
import { ReviewSection } from '@/components/ReviewSection';
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Building,
  ShieldAlert,
  ShieldCheck,
  Microscope,
  Network,
  Share2,
  Calendar,
  Sparkles,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InnovationPage({ params }: { params: { id: string } }) {
  const signal = await getSignal(params.id);
  if (!signal) notFound();

  const relations = await getSignalRelations(signal.id);
  const reviews = await listReviews(signal.id);

  return (
    <div className="radar-app-shell">
      <Navigation />

      <main className="profile-container">
        {/* Navigation Breadcrumb */}
        <div className="breadcrumb-nav">
          <Link href="/signals" className="back-link">
            <ArrowLeft size={14} />
            <span>Back to Signals Explorer</span>
          </Link>
          <span className="bc-sep">/</span>
          <span className="bc-current">Innovation Dossier {signal.id}</span>
        </div>

        {/* PROFILE HEADER DOSSIER */}
        <header className="profile-dossier-header">
          <div className="dossier-meta-top">
            <div className="origin-badges">
              <span className="flag-box">{signal.country_code || 'GL'}</span>
              <span className="origin-text">
                <MapPin size={12} className="inline mr-1" />
                {signal.city ? `${signal.city}, ` : ''}
                {signal.country || 'Global'}
              </span>
              <span className="type-box">{signal.innovation_type}</span>
            </div>

            <div className="status-badge-cluster">
              <span className={`status-pill status-${signal.status}`}>
                STATUS: {signal.status.toUpperCase()}
              </span>
            </div>
          </div>

          <h1 className="dossier-headline">{signal.title}</h1>
          <p className="dossier-abstract">{signal.summary}</p>

          <div className="dossier-provenance-bar">
            <div className="prov-item">
              <span className="prov-lbl">SOURCE INSTITUTION:</span>
              <span className="prov-val">{signal.source_name || 'Academic Preprint / Research Repo'}</span>
            </div>
            <div className="prov-item">
              <span className="prov-lbl">DISCOVERED:</span>
              <span className="prov-val">{new Date(signal.discovered_at).toLocaleDateString()}</span>
            </div>
            {signal.source_url && signal.source_url !== '#' && (
              <div className="prov-item">
                <a
                  href={signal.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="source-external-link"
                >
                  <span>Primary Source Record</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </header>

        {/* 3-DIMENSION METRIC CONSOLE (STRICTLY DECOUPLED) */}
        <section className="profile-tri-metrics">
          <div className="metric-column">
            <div className="metric-head">
              <span className="metric-label">NOVELTY RATING</span>
              <span className="metric-legend">1 (Derivative) to 5 (Paradigm Shift)</span>
            </div>
            <div className="metric-number text-accent">
              {signal.novelty ? `${signal.novelty} / 5` : 'Not Rated'}
            </div>
            <p className="metric-explainer">
              Degree of pedagogical or technical divergence from conventional educational technology patterns.
            </p>
          </div>

          <div className="metric-column">
            <div className="metric-head">
              <span className="metric-label">MATURITY STAGE</span>
              <span className="metric-legend">Empirical Readiness</span>
            </div>
            <div className="metric-number text-white">
              {signal.maturity.replace('_', ' ').toUpperCase()}
            </div>
            <p className="metric-explainer">
              Development cycle: early signal → experiment → classroom pilot → scaling → established.
            </p>
          </div>

          <div className="metric-column">
            <div className="metric-head">
              <span className="metric-label">EVIDENCE LEVEL</span>
              <span className="metric-legend">Scientific Grounding</span>
            </div>
            <div className="metric-number text-emerald">
              {signal.evidence_level.toUpperCase()}
            </div>
            <p className="metric-explainer">
              Rigour of published findings: anecdotal → single case → emerging cohort → moderate RCT → strong replication.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* THREE STRUCTURALLY SEPARATE LAYERS                                       */}
        {/* ========================================================================= */}

        <div className="dossier-layers-stack">
          {/* LAYER 1: EMPIRICAL EVIDENCE & OBJECTIVE FACTS */}
          <section className="dossier-layer layer-evidence">
            <div className="layer-tag-banner">
              <Microscope size={15} />
              <span>LAYER 1: EMPIRICAL FACT & DOCUMENTED EVIDENCE</span>
            </div>

            <div className="layer-content-grid">
              <div className="layer-block">
                <h4>Core Educational Problem Addressed</h4>
                <p className="problem-highlight">
                  {signal.educational_problem || 'Problem statement pending structured normalization.'}
                </p>
              </div>

              <div className="layer-block">
                <h4>Target Learner Groups</h4>
                <div className="target-chips">
                  {signal.target_groups && signal.target_groups.length > 0 ? (
                    signal.target_groups.map((tg) => (
                      <span key={tg} className="target-chip">
                        {tg}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">General Student Population</span>
                  )}
                </div>
              </div>

              <div className="layer-block full-width">
                <h4>Empirical Evidence Summary</h4>
                <div className="evidence-quote-box">
                  <p>{signal.evidence_summary || 'No peer-reviewed evidence summary registered yet.'}</p>
                </div>
              </div>

              <div className="layer-block full-width">
                <div className="limitation-head">
                  <AlertTriangle size={15} className="text-amber" />
                  <h4>Known Limitations, Constraints & Failure Modes</h4>
                </div>
                <p className="limitation-text">
                  {signal.limitations || 'No documented limitations or negative learning artifacts reported.'}
                </p>
              </div>
            </div>
          </section>

          {/* LAYER 2: AI STRUCTURED INTERPRETATION */}
          <section className="dossier-layer layer-ai-interpretation">
            <div className="layer-tag-banner ai-tag">
              <Sparkles size={15} />
              <span>LAYER 2: AI STRUCTURED INTERPRETATION · NON-NORMATIVE</span>
            </div>

            <div className="layer-content-grid">
              <div className="layer-block">
                <h4>Pedagogical Mechanism Extraction</h4>
                <p>
                  This innovation decomposes standard instruction by substituting passive receptive media 
                  with active student verification cycles. The underlying dynamic shifts cognitive effort from 
                  rote recall toward epistemic evaluation of system outputs.
                </p>
              </div>

              <div className="layer-block">
                <h4>Technological Architecture</h4>
                <p>
                  Operates via localized edge models and sensor event telemetry. Decoupled from proprietary cloud 
                  monopolies to minimize data leakage and latency spikes during in-class student interaction.
                </p>
              </div>
            </div>
          </section>

          {/* LAYER 3: SWISS EDUCATIONAL TRANSLATION & HYPOTHESIS */}
          <section className="dossier-layer layer-swiss-hypothesis">
            <div className="layer-tag-banner swiss-tag">
              <span className="swiss-cross-badge">+</span>
              <span>LAYER 3: SWISS EDUCATIONAL TRANSLATION & HYPOTHESIS</span>
            </div>

            {/* MANDATORY WARNING/CAVEAT */}
            <div className="hypothesis-warning-strip">
              <ShieldAlert size={16} className="warning-icon" />
              <div className="warning-text">
                <strong>Exploratory hypothesis — not a validated recommendation.</strong>
                <span>
                  The following represents a preliminary curricular translation model for Swiss cantonal school contexts 
                  (Lehrplan 21 / Sek I / Sek II / VET / PHBern) and requires rigorous practitioner review prior to piloting.
                </span>
              </div>
            </div>

            <div className="layer-content-grid">
              <div className="layer-block">
                <h4>Relevance to Swiss Educational Context</h4>
                <p className="relevance-box">
                  {signal.swiss_relevance || 'Swiss contextual alignment currently under assessment.'}
                </p>
              </div>

              <div className="layer-block">
                <h4>Exploratory Application Hypothesis</h4>
                <div className="hypothesis-box">
                  <p>
                    {signal.swiss_application_hypothesis || 'No concrete pilot hypothesis formulated yet.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RELATIONAL INTELLIGENCE / RELATED SIGNALS */}
        <section className="profile-relations-dossier">
          <div className="section-eyebrow">RELATIONAL INTELLIGENCE</div>
          <h3 className="section-title">Network Lineage & Related Signals</h3>
          <p className="section-desc">
            Signals connected by pedagogical analogy, shared technical architecture, or cluster membership.
          </p>

          <div className="relations-grid">
            {relations.length > 0 ? (
              relations.map((rel) => {
                const target = rel.relatedSignal;
                if (!target) return null;
                return (
                  <div key={rel.relation.id} className="relation-card">
                    <div className="rel-header">
                      <span className="rel-type-pill">{rel.relation.relation_type.replace('_', ' ')}</span>
                      <span className="rel-conf">
                        {Math.round(rel.relation.confidence * 100)}% confidence
                      </span>
                    </div>

                    <Link href={`/innovation/${target.id}`} className="rel-target-title">
                      <h4>{target.title}</h4>
                    </Link>

                    <p className="rel-rationale">{rel.relation.rationale}</p>

                    <div className="rel-target-meta">
                      <span>{target.country_code} · {target.innovation_type}</span>
                      <Link href={`/innovation/${target.id}`} className="rel-link">
                        <span>Inspect</span>
                        <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-relations-note">
                <Network size={24} className="text-muted mb-2" />
                <p>No explicit topological relations cataloged for this signal yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* HUMAN VALIDATION & REVIEW SECTION (FOR PHBERN / EDUCATORS) */}
        <ReviewSection signalId={signal.id} initialReviews={reviews} />
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
