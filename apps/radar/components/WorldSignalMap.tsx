'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { InnovationSignal } from '@/lib/types';
import {
  Compass,
  Filter,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Activity,
  Maximize2,
  Minimize2,
  Calendar,
  X
} from 'lucide-react';

interface WorldSignalMapProps {
  signals: InnovationSignal[];
  onSelectSignal?: (signal: InnovationSignal) => void;
  selectedSignalId?: string | null;
}

// Approximate equirectangular projection for demonstrator rendering
function project(lat: number, lon: number): { x: number; y: number } {
  // Clamp latitude to avoid pole distortion
  const clampedLat = Math.max(-65, Math.min(75, lat));
  // Standard equirectangular normalization in 0 - 100%
  const x = ((lon + 180) / 360) * 100;
  // Natural latitude curve projection for comfortable display
  const y = ((75 - clampedLat) / 140) * 100;
  return { x, y };
}

// World continent polygons approximation for standalone vector rendering
const CONTINENTS_PATHS = [
  // North America
  'M 12,18 L 22,12 L 32,15 L 36,25 L 28,38 L 24,35 L 20,44 L 17,40 L 14,30 Z',
  // Greenland
  'M 34,8 L 42,9 L 39,18 L 32,16 Z',
  // South America
  'M 26,45 L 34,48 L 36,58 L 32,74 L 28,78 L 25,62 L 23,48 Z',
  // Europe & Scandinavia
  'M 46,20 L 52,16 L 56,18 L 58,26 L 50,32 L 44,28 Z',
  // Africa
  'M 45,34 L 58,35 L 62,48 L 56,66 L 48,68 L 44,52 L 42,38 Z',
  // Asia
  'M 58,16 L 75,15 L 88,24 L 84,40 L 72,44 L 62,38 L 58,26 Z',
  // South Asia / India
  'M 68,36 L 74,38 L 73,48 L 68,44 Z',
  // East Asia & Japan
  'M 80,28 L 86,29 L 83,38 L 78,35 Z',
  // Australia & Oceania
  'M 78,60 L 88,58 L 90,70 L 82,74 L 76,68 Z',
  // UK & Ireland
  'M 44,23 L 47,21 L 46,26 L 43,26 Z'
];

export function WorldSignalMap({ signals, onSelectSignal, selectedSignalId }: WorldSignalMapProps) {
  // Filtering states
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedMaturity, setSelectedMaturity] = useState<string>('ALL');
  const [selectedEvidence, setSelectedEvidence] = useState<string>('ALL');
  const [timeframeDays, setTimeframeDays] = useState<number>(0); // 0 = all
  const [activeSignal, setActiveSignal] = useState<InnovationSignal | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Filter signals with geo coords
  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (s.latitude == null || s.longitude == null) return false;

      // Region filter
      if (selectedRegion === 'CH' && s.country_code !== 'CH') return false;
      if (selectedRegion === 'EU' && !['CH', 'DE', 'FI', 'EE', 'GB', 'FR', 'IT', 'NL', 'SE', 'NO', 'AT'].includes(s.country_code || '')) return false;
      if (selectedRegion === 'NA' && !['US', 'CA'].includes(s.country_code || '')) return false;
      if (selectedRegion === 'AP' && !['SG', 'IN', 'AU', 'JP', 'KR', 'NZ'].includes(s.country_code || '')) return false;
      if (selectedRegion === 'AF' && !['KE', 'ZA', 'NG', 'RW', 'GH'].includes(s.country_code || '')) return false;

      // Type filter
      if (selectedType !== 'ALL' && s.innovation_type !== selectedType) return false;

      // Maturity filter
      if (selectedMaturity !== 'ALL' && s.maturity !== selectedMaturity) return false;

      // Evidence filter
      if (selectedEvidence !== 'ALL' && s.evidence_level !== selectedEvidence) return false;

      // Timeframe
      if (timeframeDays > 0) {
        const discDate = new Date(s.discovered_at).getTime();
        const cutoff = Date.now() - timeframeDays * 24 * 60 * 60 * 1000;
        if (discDate < cutoff) return false;
      }

      return true;
    });
  }, [signals, selectedRegion, selectedType, selectedMaturity, selectedEvidence, timeframeDays]);

  // Types list for selector
  const availableTypes = useMemo(() => {
    return Array.from(new Set(signals.map((s) => s.innovation_type))).filter(Boolean);
  }, [signals]);

  // Spatial clustering calculation (grouping points closer than 6% screen distance)
  const clusters = useMemo(() => {
    type ClusterItem = {
      id: string;
      x: number;
      y: number;
      signals: InnovationSignal[];
    };

    const result: ClusterItem[] = [];
    const threshold = 5.5; // percent distance

    filteredSignals.forEach((sig) => {
      const { x, y } = project(sig.latitude!, sig.longitude!);
      const existing = result.find(
        (c) => Math.hypot(c.x - x, c.y - y) < threshold
      );

      if (existing) {
        existing.signals.push(sig);
      } else {
        result.push({
          id: `cluster-${sig.id}`,
          x,
          y,
          signals: [sig],
        });
      }
    });

    return result;
  }, [filteredSignals]);

  const displayedActiveSignal = activeSignal || (selectedSignalId ? signals.find((s) => s.id === selectedSignalId) : null);

  const handleMarkerClick = (sig: InnovationSignal) => {
    setActiveSignal(sig);
    if (onSelectSignal) onSelectSignal(sig);
  };

  return (
    <div className={`map-instrument ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Instrument Header Control Bar */}
      <div className="map-toolbar">
        <div className="map-title-cluster">
          <div className="telemetry-badge">
            <span className="telemetry-dot" />
            LIVE GEO OBSERVATORY
          </div>
          <div className="telemetry-coords">
            <Compass size={13} className="text-emerald" />
            <span>APPROXIMATE GEO VIEW · WGS84 COORDINATES</span>
          </div>
        </div>

        <div className="map-action-cluster">
          <button
            type="button"
            className={`filter-btn ${filterDrawerOpen ? 'active' : ''}`}
            onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
            title="Toggle Filters"
          >
            <Filter size={14} />
            <span>Filters</span>
            {(selectedRegion !== 'ALL' || selectedType !== 'ALL' || selectedMaturity !== 'ALL' || selectedEvidence !== 'ALL') && (
              <span className="filter-badge">•</span>
            )}
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Filter Drawer / Bar */}
      <div className={`map-filter-panel ${filterDrawerOpen ? 'open' : ''}`}>
        <div className="filter-row">
          <div className="filter-group">
            <label>REGION</label>
            <div className="chip-group">
              {[
                { id: 'ALL', label: 'Global' },
                { id: 'CH', label: '🇨🇭 Switzerland' },
                { id: 'EU', label: 'Europe' },
                { id: 'NA', label: 'North America' },
                { id: 'AP', label: 'Asia-Pacific' },
                { id: 'AF', label: 'Africa' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`chip ${selectedRegion === r.id ? 'active' : ''}`}
                  onClick={() => setSelectedRegion(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>INNOVATION TYPE</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="inst-select"
            >
              <option value="ALL">All Innovation Types</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>MATURITY</label>
            <select
              value={selectedMaturity}
              onChange={(e) => setSelectedMaturity(e.target.value)}
              className="inst-select"
            >
              <option value="ALL">All Maturity Stages</option>
              <option value="early_signal">Early Signal</option>
              <option value="experiment">Experiment</option>
              <option value="pilot">Pilot</option>
              <option value="scaling">Scaling</option>
              <option value="established">Established</option>
            </select>
          </div>

          <div className="filter-group">
            <label>EVIDENCE LEVEL</label>
            <select
              value={selectedEvidence}
              onChange={(e) => setSelectedEvidence(e.target.value)}
              className="inst-select"
            >
              <option value="ALL">All Evidence Levels</option>
              <option value="anecdotal">Anecdotal</option>
              <option value="case">Case Study</option>
              <option value="emerging">Emerging</option>
              <option value="moderate">Moderate</option>
              <option value="strong">Strong</option>
            </select>
          </div>

          <div className="filter-group">
            <label>WINDOW</label>
            <div className="chip-group">
              {[
                { days: 0, label: 'All' },
                { days: 30, label: '30d' },
                { days: 90, label: '90d' },
              ].map((w) => (
                <button
                  key={w.days}
                  type="button"
                  className={`chip ${timeframeDays === w.days ? 'active' : ''}`}
                  onClick={() => setTimeframeDays(w.days)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="map-viewport">
        {/* Radar concentric range circles */}
        <div className="radar-sweep-effect" />
        <div className="radar-crosshair-h" />
        <div className="radar-crosshair-v" />

        {/* Global Topology Layer (SVG continents) */}
        <svg
          className="world-topology-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Equirectangular latitude & longitude coordinate grid */}
          <g className="geo-graticule">
            {[15, 30, 45, 60, 75, 90].map((y) => (
              <line key={`lat-${y}`} x1="0" y1={y} x2="100" y2={y} />
            ))}
            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((x) => (
              <line key={`lon-${x}`} x1={x} y1="0" x2={x} y2="100" />
            ))}
          </g>

          {/* Continents outlines */}
          <g className="geo-continents">
            {CONTINENTS_PATHS.map((p, i) => (
              <path key={i} d={p} />
            ))}
          </g>
        </svg>

        {/* Signal Markers & Clusters */}
        <div className="markers-layer">
          {clusters.map((cluster) => {
            const isSingle = cluster.signals.length === 1;
            const primarySignal = cluster.signals[0];
            const isSelected = displayedActiveSignal?.id === primarySignal.id;

            if (isSingle) {
              return (
                <div
                  key={cluster.id}
                  className={`map-node ${isSelected ? 'selected' : ''}`}
                  style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}
                  onClick={() => handleMarkerClick(primarySignal)}
                >
                  <div className="pulse-beacon" />
                  <div className="node-marker">
                    <span className="node-dot" />
                  </div>
                  <div className="node-label">
                    <span className="country-tag">{primarySignal.country_code}</span>
                    <span className="city-tag">{primarySignal.city || primarySignal.country}</span>
                  </div>
                </div>
              );
            }

            // Clustered multi-signals
            const hasSelectedInside = cluster.signals.some(
              (s) => s.id === displayedActiveSignal?.id
            );

            return (
              <div
                key={cluster.id}
                className={`map-cluster-node ${hasSelectedInside ? 'has-selected' : ''}`}
                style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}
                onClick={() => handleMarkerClick(primarySignal)}
                title={`${cluster.signals.length} signals in this zone`}
              >
                <div className="cluster-beacon" />
                <div className="cluster-pill">
                  <span className="cluster-count">{cluster.signals.length}</span>
                  <span className="cluster-geo">{primarySignal.country_code}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Status Ticker */}
        <div className="map-footer-ticker">
          <div className="ticker-item">
            <span className="label">LOCATED SIGNALS:</span>
            <span className="val">{filteredSignals.length} of {signals.length}</span>
          </div>
          <div className="ticker-item">
            <span className="label">OBSERVED CLUSTERS:</span>
            <span className="val">{clusters.length} SPATIAL HUBS</span>
          </div>
          <div className="ticker-item disclaimer">
            <span>NO COMPOSITE RANKING · INDEPENDENT DESCRIPTIVE MAPPING</span>
          </div>
        </div>

        {/* Floating Signal Profile Preview (Inspector Window) */}
        {displayedActiveSignal && (
          <div className="map-inspector-card">
            <div className="inspector-head">
              <div className="inspector-origin">
                <span className="flag-badge">{displayedActiveSignal.country_code || 'GL'}</span>
                <span className="place">
                  {displayedActiveSignal.city ? `${displayedActiveSignal.city}, ` : ''}
                  {displayedActiveSignal.country}
                </span>
                <span className="type-badge">{displayedActiveSignal.innovation_type}</span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setActiveSignal(null)}
              >
                <X size={14} />
              </button>
            </div>

            <h4 className="inspector-title">{displayedActiveSignal.title}</h4>
            <p className="inspector-summary">{displayedActiveSignal.summary}</p>

            {/* Separated 3-Dimensional Assessment Bar */}
            <div className="inspector-dimensions">
              <div className="dim-box">
                <span className="dim-label">NOVELTY</span>
                <span className="dim-val text-accent">
                  {displayedActiveSignal.novelty ? `${displayedActiveSignal.novelty} / 5` : 'N/A'}
                </span>
              </div>
              <div className="dim-box">
                <span className="dim-label">MATURITY</span>
                <span className="dim-val">{displayedActiveSignal.maturity.replace('_', ' ')}</span>
              </div>
              <div className="dim-box">
                <span className="dim-label">EVIDENCE</span>
                <span className="dim-val text-emerald">{displayedActiveSignal.evidence_level}</span>
              </div>
            </div>

            {/* Educational Problem Addressed */}
            {displayedActiveSignal.educational_problem && (
              <div className="inspector-problem">
                <span className="sec-tag">EDUCATIONAL PROBLEM:</span>
                <p>{displayedActiveSignal.educational_problem}</p>
              </div>
            )}

            {/* Swiss Hypothesis Hint */}
            {displayedActiveSignal.swiss_application_hypothesis && (
              <div className="inspector-swiss-hint">
                <div className="swiss-flag-bar">
                  <span className="swiss-plus">+</span>
                  <span>SWISS EXPLORATORY HYPOTHESIS</span>
                </div>
                <p>{displayedActiveSignal.swiss_application_hypothesis}</p>
              </div>
            )}

            <div className="inspector-footer">
              <span className="source-cite">
                Source: {displayedActiveSignal.source_name || 'Academic Record'}
              </span>
              <Link
                href={`/innovation/${displayedActiveSignal.id}`}
                className="inspect-dossier-btn"
              >
                <span>Inspect Dossier</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
