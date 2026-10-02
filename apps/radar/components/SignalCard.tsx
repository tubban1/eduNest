'use client';

import Link from 'next/link';
import type { InnovationSignal } from '@/lib/types';
import {
  MapPin,
  Sparkles,
  Layers,
  ShieldCheck,
  HelpCircle,
  ArrowUpRight,
  Bookmark
} from 'lucide-react';

interface SignalCardProps {
  signal: InnovationSignal;
  viewMode?: 'grid' | 'dense';
}

export function SignalCard({ signal, viewMode = 'grid' }: SignalCardProps) {
  // Maturity badge styling helper
  const maturityColorMap: Record<string, string> = {
    early_signal: 'tag-early',
    experiment: 'tag-experiment',
    pilot: 'tag-pilot',
    scaling: 'tag-scaling',
    established: 'tag-established'
  };

  // Evidence badge styling helper
  const evidenceColorMap: Record<string, string> = {
    none: 'ev-none',
    anecdotal: 'ev-anecdotal',
    case: 'ev-case',
    emerging: 'ev-emerging',
    moderate: 'ev-moderate',
    strong: 'ev-strong'
  };

  if (viewMode === 'dense') {
    return (
      <Link href={`/innovation/${signal.id}`} className="signal-row-dense">
        <div className="dense-geo">
          <span className="geo-code">{signal.country_code || 'GL'}</span>
          <span className="geo-city">{signal.city || signal.country}</span>
        </div>
        <div className="dense-title-group">
          <h4 className="dense-title">{signal.title}</h4>
          <span className="dense-type">{signal.innovation_type}</span>
        </div>
        <div className="dense-dims">
          <span className="dense-dim-pill">
            <span className="lbl">NOV</span> <b>{signal.novelty ? `${signal.novelty}/5` : '—'}</b>
          </span>
          <span className={`dense-dim-pill ${maturityColorMap[signal.maturity]}`}>
            <span className="lbl">MAT</span> <b>{signal.maturity.replace('_', ' ')}</b>
          </span>
          <span className={`dense-dim-pill ${evidenceColorMap[signal.evidence_level]}`}>
            <span className="lbl">EVID</span> <b>{signal.evidence_level}</b>
          </span>
        </div>
        <ArrowUpRight size={14} className="dense-arrow" />
      </Link>
    );
  }

  return (
    <article className="signal-card-v2">
      {/* 1. WHERE & TYPE HEADER */}
      <div className="card-header-geo">
        <div className="geo-pill">
          <MapPin size={12} className="geo-icon" />
          <span className="country-label">{signal.country || 'Global'}</span>
          {signal.city && <span className="city-label">· {signal.city}</span>}
        </div>
        <span className="type-pill">{signal.innovation_type}</span>
      </div>

      {/* 2. WHAT IS IT? */}
      <div className="card-section what-section">
        <Link href={`/innovation/${signal.id}`} className="title-link">
          <h3 className="card-title">{signal.title}</h3>
        </Link>
        <p className="card-summary">{signal.summary}</p>
      </div>

      {/* 3. INDEPENDENT 3-DIMENSIONAL ASSESSMENT (NO COMPOSITE SCORE) */}
      <div className="card-dimensions-matrix">
        {/* HOW NEW? */}
        <div className="matrix-dimension">
          <div className="dim-head">
            <span className="dim-name">HOW NEW?</span>
            <span className="dim-score text-cyan">{signal.novelty ? `${signal.novelty} / 5` : 'N/A'}</span>
          </div>
          <div className="dim-meter">
            <div
              className="meter-fill meter-cyan"
              style={{ width: `${((signal.novelty || 1) / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* HOW MATURE? */}
        <div className="matrix-dimension">
          <div className="dim-head">
            <span className="dim-name">HOW MATURE?</span>
            <span className={`dim-tag ${maturityColorMap[signal.maturity]}`}>
              {signal.maturity.replace('_', ' ')}
            </span>
          </div>
          <div className="dim-status-indicator stage-dots">
            {['early_signal', 'experiment', 'pilot', 'scaling', 'established'].map((stage, idx) => {
              const currentIdx = ['early_signal', 'experiment', 'pilot', 'scaling', 'established'].indexOf(signal.maturity);
              return (
                <span
                  key={stage}
                  className={`stage-dot ${idx <= currentIdx ? 'active' : ''}`}
                  title={stage.replace('_', ' ')}
                />
              );
            })}
          </div>
        </div>

        {/* WHAT EVIDENCE EXISTS? */}
        <div className="matrix-dimension">
          <div className="dim-head">
            <span className="dim-name">WHAT EVIDENCE?</span>
            <span className={`dim-tag ${evidenceColorMap[signal.evidence_level]}`}>
              {signal.evidence_level}
            </span>
          </div>
          <p className="evidence-micro-summary">
            {signal.evidence_summary ? signal.evidence_summary.slice(0, 85) + '...' : 'Evidence summary undergoing evaluation.'}
          </p>
        </div>
      </div>

      {/* 4. WHY MIGHT IT MATTER? & TARGET GROUP */}
      <div className="card-section why-section">
        {signal.educational_problem && (
          <div className="prob-statement">
            <span className="section-label">ADDRESSES:</span>
            <span className="prob-text">{signal.educational_problem}</span>
          </div>
        )}

        {signal.swiss_relevance && (
          <div className="swiss-relevance-hint">
            <span className="swiss-label">SWISS POTENTIAL:</span>
            <span className="relevance-text">{signal.swiss_relevance}</span>
          </div>
        )}
      </div>

      {/* 5. FOOTER & TAGS */}
      <div className="card-footer-action">
        <div className="tag-cluster">
          {signal.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="inst-tag">
              #{tag}
            </span>
          ))}
        </div>
        <Link href={`/innovation/${signal.id}`} className="view-dossier-link">
          <span>Dossier</span>
          <ArrowUpRight size={13} />
        </Link>
      </div>
    </article>
  );
}
