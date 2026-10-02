'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { RadarCluster, InnovationSignal, RadarRelation } from '@/lib/types';
import {
  Network,
  Globe2,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  MapPin,
  Compass,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Share2
} from 'lucide-react';

interface ClustersClientProps {
  clusters: RadarCluster[];
  signals: InnovationSignal[];
  relations: RadarRelation[];
}

export function ClustersClient({ clusters, signals, relations }: ClustersClientProps) {
  const [activeClusterId, setActiveClusterId] = useState<string>(clusters[0]?.id || '');
  const [activeSignalId, setActiveSignalId] = useState<string | null>(null);

  const activeCluster = useMemo(() => {
    return clusters.find((c) => c.id === activeClusterId) || clusters[0];
  }, [clusters, activeClusterId]);

  // Signals belonging to active cluster
  const clusterSignals = useMemo(() => {
    if (!activeCluster) return [];
    return signals.filter((s) => activeCluster.signalIds.includes(s.id));
  }, [activeCluster, signals]);

  // Countries represented in active cluster
  const clusterCountries = useMemo(() => {
    const set = new Set<string>();
    clusterSignals.forEach((s) => {
      if (s.country) set.add(s.country);
    });
    return Array.from(set);
  }, [clusterSignals]);

  // Relational connections inside this cluster
  const activeClusterRelations = useMemo(() => {
    const ids = new Set(clusterSignals.map((s) => s.id));
    return relations.filter((r) => ids.has(r.from_signal_id) || ids.has(r.to_signal_id));
  }, [clusterSignals, relations]);

  return (
    <div className="clusters-intelligence-layout">
      {/* HEADER DISCLAIMER BANNER */}
      <div className="cluster-hypothesis-banner">
        <div className="hypothesis-tag">
          <Layers size={14} className="text-accent" />
          <span>PROVISIONAL / EMERGING HYPOTHESES</span>
        </div>
        <p className="hypothesis-disclaimer">
          Clusters represent early inductive pattern recognition across distributed geographic signals, 
          <strong> not established consensus trends</strong>. They serve to highlight where independent teams 
          across multiple jurisdictions are converging on similar pedagogical or structural solutions.
        </p>
      </div>

      {/* TOP: INTERACTIVE CONSTELLATION GRAPH (RELATIONAL VIEW) */}
      <section className="constellation-instrument">
        <div className="constellation-header">
          <div className="constellation-title-group">
            <span className="inst-badge">RELATIONAL TOPOLOGY</span>
            <h3>Cluster Constellation & Multi-Country Diffusion</h3>
          </div>
          <div className="constellation-legend">
            <span className="legend-item"><span className="legend-node cluster" /> Cluster Core</span>
            <span className="legend-item"><span className="legend-node signal" /> Observed Signal</span>
            <span className="legend-item"><span className="legend-node geo" /> National Origin</span>
          </div>
        </div>

        {/* Network SVG Stage */}
        <div className="constellation-viewport">
          <svg className="constellation-svg" viewBox="0 0 800 360">
            {/* Concentric grid rings */}
            <circle cx="400" cy="180" r="80" className="topo-ring" />
            <circle cx="400" cy="180" r="150" className="topo-ring ring-outer" />

            {/* Connecting lines from center to signals */}
            {clusterSignals.map((sig, idx) => {
              const total = clusterSignals.length;
              const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
              const sigX = 400 + Math.cos(angle) * 130;
              const sigY = 180 + Math.sin(angle) * 100;
              const isSelected = activeSignalId === sig.id;

              return (
                <g key={`edge-${sig.id}`}>
                  <line
                    x1="400"
                    y1="180"
                    x2={sigX}
                    y2={sigY}
                    className={`topo-edge ${isSelected ? 'active-edge' : ''}`}
                  />
                  {/* Origin sub-link to country node */}
                  <line
                    x1={sigX}
                    y1={sigY}
                    x2={sigX + (Math.cos(angle) > 0 ? 45 : -45)}
                    y2={sigY + (Math.sin(angle) > 0 ? 30 : -30)}
                    className="topo-edge-geo"
                  />
                </g>
              );
            })}

            {/* Central Cluster Hub Node */}
            <g className="topo-hub" transform="translate(400, 180)">
              <circle r="36" className="hub-circle-pulse" />
              <circle r="26" className="hub-circle-core" />
              <text textAnchor="middle" dy="4" className="hub-text">
                {activeCluster?.title.slice(0, 14)}...
              </text>
            </g>

            {/* Satellite Signal Nodes */}
            {clusterSignals.map((sig, idx) => {
              const total = clusterSignals.length;
              const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
              const sigX = 400 + Math.cos(angle) * 130;
              const sigY = 180 + Math.sin(angle) * 100;
              const geoX = sigX + (Math.cos(angle) > 0 ? 45 : -45);
              const geoY = sigY + (Math.sin(angle) > 0 ? 30 : -30);
              const isSelected = activeSignalId === sig.id;

              return (
                <g
                  key={`node-${sig.id}`}
                  className="satellite-group"
                  onClick={() => setActiveSignalId(activeSignalId === sig.id ? null : sig.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Signal Node */}
                  <circle
                    cx={sigX}
                    cy={sigY}
                    r={isSelected ? 16 : 12}
                    className={`sat-node ${isSelected ? 'selected' : ''}`}
                  />
                  <text
                    x={sigX}
                    y={sigY - 18}
                    textAnchor="middle"
                    className="sat-label"
                  >
                    {sig.title.slice(0, 20)}...
                  </text>

                  {/* Country Origin Tag Node */}
                  <circle cx={geoX} cy={geoY} r="7" className="geo-node" />
                  <text
                    x={geoX + (Math.cos(angle) > 0 ? 10 : -10)}
                    y={geoY + 4}
                    textAnchor={Math.cos(angle) > 0 ? 'start' : 'end'}
                    className="geo-label"
                  >
                    {sig.country_code} ({sig.city || sig.country})
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive instruction hint */}
          <div className="viewport-hint">
            <span>Click any peripheral node to inspect its specific relational rationale</span>
          </div>
        </div>
      </section>

      {/* CLUSTERS DOSSIER WORKBENCH */}
      <div className="clusters-workbench">
        {/* Left Column: Cluster Selector Tabs */}
        <aside className="clusters-sidebar-nav">
          <div className="sidebar-head">
            <span className="sidebar-label">CURATED CLUSTERS</span>
            <span className="count-badge">{clusters.length}</span>
          </div>

          <div className="cluster-tabs">
            {clusters.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cluster-tab-card ${activeClusterId === c.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveClusterId(c.id);
                  setActiveSignalId(null);
                }}
              >
                <div className="tab-meta">
                  <span className="tab-signals-count">{c.signalsCount} Signals</span>
                  <span className="tab-status">{c.hypothesisStatus.replace('_', ' ')}</span>
                </div>
                <h4 className="tab-title">{c.title}</h4>
                <p className="tab-sub">{c.subtitle}</p>
                <div className="tab-geos">
                  {c.primaryGeography.slice(0, 3).map((g) => (
                    <span key={g} className="geo-tag-micro">{g}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Right Column: Active Cluster Deep Dossier */}
        <main className="cluster-detail-pane">
          {activeCluster && (
            <article className="cluster-dossier-full">
              <div className="dossier-head">
                <div className="dossier-kicker">
                  <span className="kicker-badge">PROVISIONAL HYPOTHESIS DOSSIER</span>
                  <span className="emergence-badge">
                    {activeCluster.emergenceType === 'independent_emergence'
                      ? '⚡ Illustrative Cross-Country Emergence Hypothesis'
                      : '🏛️ Policy & Institutional Push'}
                  </span>
                </div>
                <h2 className="dossier-title">{activeCluster.title}</h2>
                <p className="dossier-lead">{activeCluster.subtitle}</p>
              </div>

              {/* Emergence Analysis Block */}
              <div className="emergence-analysis-grid">
                <div className="analysis-box">
                  <div className="analysis-head">
                    <Globe2 size={15} className="text-emerald" />
                    <h4>Geographic Dispersion & Concentration</h4>
                  </div>
                  <p>
                    Demo records currently span <strong>{clusterCountries.join(', ')}</strong>. These locations illustrate how geographic dispersion could be inspected once the Radar is populated with verified records.
                  </p>
                </div>

                <div className="analysis-box">
                  <div className="analysis-head">
                    <Sparkles size={15} className="text-accent" />
                    <h4>Educational Impact Hypothesis</h4>
                  </div>
                  <p>{activeCluster.educationalImpact}</p>
                </div>
              </div>

              {/* Signals Composing This Cluster */}
              <div className="cluster-signals-section">
                <div className="signals-section-head">
                  <h4>Signals Formulating this Hypothesis ({clusterSignals.length})</h4>
                  <span className="note-text">Click to open full innovation profile</span>
                </div>

                <div className="cluster-signals-list">
                  {clusterSignals.map((sig) => {
                    const isSelected = activeSignalId === sig.id;
                    return (
                      <div
                        key={sig.id}
                        className={`cluster-signal-item ${isSelected ? 'highlighted' : ''}`}
                      >
                        <div className="sig-item-top">
                          <div className="sig-place">
                            <span className="code-box">{sig.country_code || 'GL'}</span>
                            <span className="place-name">{sig.city || sig.country}</span>
                            <span className="type-name">· {sig.innovation_type}</span>
                          </div>
                          <div className="sig-metrics">
                            <span className="sig-dim">NOV: <b>{sig.novelty}/5</b></span>
                            <span className="sig-dim">MAT: <b>{sig.maturity.replace('_', ' ')}</b></span>
                            <span className="sig-dim">EVID: <b>{sig.evidence_level}</b></span>
                          </div>
                        </div>

                        <Link href={`/innovation/${sig.id}`} className="sig-title-link">
                          <h5>{sig.title}</h5>
                        </Link>

                        <p className="sig-summary-text">{sig.summary}</p>

                        <div className="sig-item-footer">
                          <div className="sig-problem">
                            <strong>Problem:</strong> {sig.educational_problem}
                          </div>
                          <Link href={`/innovation/${sig.id}`} className="view-profile-btn">
                            <span>Dossier</span>
                            <ArrowUpRight size={13} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
