'use client';

import { useState } from 'react';
import { X, CheckCircle, ArrowRight, ShieldCheck, Microscope, Database, Globe, Network, Compass, UserCheck } from 'lucide-react';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PIPELINE_STEPS = [
  {
    code: 'SCAN',
    name: 'Signal Scanning',
    icon: Globe,
    desc: 'Automated & curated monitoring of global academic publications, pilot repositories, patent notices, policy briefs, and grassroots teaching experiments.'
  },
  {
    code: 'STRUCTURE',
    name: 'Extraction & Normalization',
    icon: Database,
    desc: 'Deconstructing raw claims into educational problem statements, pedagogical mechanisms, target learner groups, and technological architectures.'
  },
  {
    code: 'LOCATE',
    name: 'Geospatial Intelligence',
    icon: Compass,
    desc: 'Pinpointing institutional origin, municipal context, and national educational governance framework (avoiding vague "global AI" hype).'
  },
  {
    code: 'ASSESS',
    name: 'Separated Dimension Evaluation',
    icon: Microscope,
    desc: 'Rigidly decoupling Novelty (1-5), Maturity stage, and Empirical Evidence level. Strict avoidance of arbitrary composite ranking scores.'
  },
  {
    code: 'CONNECT',
    name: 'Relational Intelligence',
    icon: Network,
    desc: 'Detecting cross-border parallel emergence, conceptual lineage (similar_to, inspired_by), and synthesizing provisional emerging clusters.'
  },
  {
    code: 'TRANSLATE',
    name: 'Swiss Contextualization',
    icon: ArrowRight,
    desc: 'Translating global mechanisms into exploratory hypotheses for Lehrplan 21, Sek I/II, dual vocational education (Berufslehre), and PHBern teacher education.'
  },
  {
    code: 'HUMAN REVIEW',
    name: 'Practitioner Validation',
    icon: UserCheck,
    desc: 'Rigorous peer evaluation by Swiss educators, school leaders, and didactics experts to assess actual classroom transferability.'
  }
];

export function MethodologyModal({ isOpen, onClose }: MethodologyModalProps) {
  const [activeStep, setActiveStep] = useState(0);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="methodology-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="eyebrow-inst">BELEARN BOOSTER RESEARCH FRAMEWORK</div>
            <h2 className="modal-title">AI Education Innovation Radar Methodology</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="modal-intro">
          This system is deliberately engineered <strong>not</strong> as a commercial EdTech news aggregator or marketing leaderboard. It operates as an exploratory scientific instrument transforming international innovation signals into actionable local pedagogical intelligence.
        </p>

        {/* 7-Step Pipeline Interactive Stepper */}
        <div className="pipeline-container">
          <div className="pipeline-nav">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.code}
                  type="button"
                  className={`pipeline-step-btn ${activeStep === idx ? 'active' : ''}`}
                  onClick={() => setActiveStep(idx)}
                >
                  <div className="step-num">0{idx + 1}</div>
                  <div className="step-label">{step.code}</div>
                </button>
              );
            })}
          </div>

          <div className="active-step-card">
            <div className="step-card-header">
              <span className="step-badge">STAGE 0{activeStep + 1} OF 07</span>
              <h3>{PIPELINE_STEPS[activeStep].name}</h3>
            </div>
            <p className="step-card-desc">{PIPELINE_STEPS[activeStep].desc}</p>
          </div>
        </div>

        {/* Comparison Matrix: Aggregator vs Radar */}
        <div className="comparison-section">
          <h4>Why this Radar ≠ Commercial EdTech News Aggregator</h4>
          <div className="comparison-table">
            <div className="comp-col commercial">
              <h5>Commercial EdTech Portals</h5>
              <ul>
                <li>Vendors and sponsored PR articles dominate.</li>
                <li>Single composite "innovation rank" or popularity score.</li>
                <li>Hype claims conflated with validated evidence.</li>
                <li>No localized educational curriculum translation.</li>
                <li>Opaque commercial recommendation algorithms.</li>
              </ul>
            </div>
            <div className="comp-col radar">
              <h5>AI Education Innovation Radar</h5>
              <ul>
                <li>Academic, institutional, and grassroots curated sources.</li>
                <li>Strictly decoupled Novelty, Maturity, and Evidence dimensions.</li>
                <li>Clear separation of empirical fact, AI inference, and hypotheses.</li>
                <li>Tailored Swiss educational translation (Lehrplan 21 / Sek I/II / VET).</li>
                <li>Transparent methodology and human practitioner review loop.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <span className="disclaimer-note">
            BeLEARN Booster Demonstrator · Prepared for BeLEARN & PHBern Educational Research Consortium
          </span>
          <button type="button" className="inst-action-btn" onClick={onClose}>
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}
