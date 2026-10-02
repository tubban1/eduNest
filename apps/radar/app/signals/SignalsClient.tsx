'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { InnovationSignal } from '@/lib/types';
import { SignalCard } from '@/components/SignalCard';
import {
  Search,
  Filter,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Sparkles,
  MapPin,
  ShieldAlert,
  X,
  ArrowUpDown
} from 'lucide-react';

interface SignalsClientProps {
  initialSignals: InnovationSignal[];
}

export function SignalsClient({ initialSignals }: SignalsClientProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedMaturity, setSelectedMaturity] = useState('ALL');
  const [selectedEvidence, setSelectedEvidence] = useState('ALL');
  const [selectedTargetGroup, setSelectedTargetGroup] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'discovered_desc' | 'novelty_desc' | 'maturity_asc' | 'evidence_desc'>('discovered_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'dense'>('grid');

  // Available metadata lists for filters
  const countries = useMemo(() => {
    return Array.from(new Set(initialSignals.map((s) => s.country_code).filter(Boolean) as string[])).sort();
  }, [initialSignals]);

  const innovationTypes = useMemo(() => {
    return Array.from(new Set(initialSignals.map((s) => s.innovation_type))).filter(Boolean).sort();
  }, [initialSignals]);

  const targetGroups = useMemo(() => {
    const set = new Set<string>();
    initialSignals.forEach((s) => s.target_groups?.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [initialSignals]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    initialSignals.forEach((s) => s.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [initialSignals]);

  // Filtering and Sorting logic
  const filteredSignals = useMemo(() => {
    return initialSignals
      .filter((s) => {
        // Query search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = s.title.toLowerCase().includes(q);
          const matchSummary = s.summary.toLowerCase().includes(q);
          const matchProblem = s.educational_problem?.toLowerCase().includes(q);
          const matchSource = s.source_name?.toLowerCase().includes(q);
          const matchCountry = s.country?.toLowerCase().includes(q);
          const matchTags = s.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchSummary && !matchProblem && !matchSource && !matchCountry && !matchTags) {
            return false;
          }
        }

        // Tag filter
        if (selectedTag && !s.tags?.includes(selectedTag)) return false;

        // Country filter
        if (selectedCountry !== 'ALL' && s.country_code !== selectedCountry) return false;

        // Type filter
        if (selectedType !== 'ALL' && s.innovation_type !== selectedType) return false;

        // Maturity filter
        if (selectedMaturity !== 'ALL' && s.maturity !== selectedMaturity) return false;

        // Evidence filter
        if (selectedEvidence !== 'ALL' && s.evidence_level !== selectedEvidence) return false;

        // Target group filter
        if (selectedTargetGroup !== 'ALL' && !s.target_groups?.includes(selectedTargetGroup)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'discovered_desc') {
          return new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime();
        }
        if (sortBy === 'novelty_desc') {
          return (b.novelty || 0) - (a.novelty || 0);
        }
        if (sortBy === 'maturity_asc') {
          const order = ['early_signal', 'experiment', 'pilot', 'scaling', 'established'];
          return order.indexOf(a.maturity) - order.indexOf(b.maturity);
        }
        if (sortBy === 'evidence_desc') {
          const order = ['strong', 'moderate', 'emerging', 'case', 'anecdotal', 'none'];
          return order.indexOf(a.evidence_level) - order.indexOf(b.evidence_level);
        }
        return 0;
      });
  }, [
    initialSignals,
    searchQuery,
    selectedTag,
    selectedCountry,
    selectedType,
    selectedMaturity,
    selectedEvidence,
    selectedTargetGroup,
    sortBy
  ]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCountry('ALL');
    setSelectedType('ALL');
    setSelectedMaturity('ALL');
    setSelectedEvidence('ALL');
    setSelectedTargetGroup('ALL');
    setSelectedTag(null);
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedCountry !== 'ALL' ||
    selectedType !== 'ALL' ||
    selectedMaturity !== 'ALL' ||
    selectedEvidence !== 'ALL' ||
    selectedTargetGroup !== 'ALL' ||
    selectedTag !== null;

  return (
    <div className="explorer-layout">
      {/* Explorer Controls Console */}
      <div className="explorer-control-bar">
        {/* Search input */}
        <div className="explorer-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search signals by keyword, pedagogy, problem, author, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View toggles & Sort */}
        <div className="explorer-actions">
          <div className="sort-control">
            <ArrowUpDown size={14} className="sort-icon" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="sort-select"
            >
              <option value="discovered_desc">Latest Discovered</option>
              <option value="novelty_desc">Highest Novelty (1-5)</option>
              <option value="maturity_asc">Maturity: Early → Pilot</option>
              <option value="evidence_desc">Evidence: Strong → Anecdotal</option>
            </select>
          </div>

          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Matrix Card View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'dense' ? 'active' : ''}`}
              onClick={() => setViewMode('dense')}
              title="Dense Dossier List"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chips & Dropdowns */}
      <div className="explorer-filter-matrix">
        <div className="filter-select-cluster">
          {/* Country / Geography */}
          <div className="filter-field">
            <label>GEOGRAPHY</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="inst-select-sm"
            >
              <option value="ALL">All Geographies</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c} {c === 'CH' ? '(🇨🇭 Switzerland)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Innovation Type */}
          <div className="filter-field">
            <label>INNOVATION TYPE</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="inst-select-sm"
            >
              <option value="ALL">All Types</option>
              {innovationTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Maturity */}
          <div className="filter-field">
            <label>MATURITY</label>
            <select
              value={selectedMaturity}
              onChange={(e) => setSelectedMaturity(e.target.value)}
              className="inst-select-sm"
            >
              <option value="ALL">All Stages</option>
              <option value="early_signal">Early Signal</option>
              <option value="experiment">Experiment</option>
              <option value="pilot">Pilot</option>
              <option value="scaling">Scaling</option>
              <option value="established">Established</option>
            </select>
          </div>

          {/* Evidence Level */}
          <div className="filter-field">
            <label>EVIDENCE LEVEL</label>
            <select
              value={selectedEvidence}
              onChange={(e) => setSelectedEvidence(e.target.value)}
              className="inst-select-sm"
            >
              <option value="ALL">All Evidence</option>
              <option value="anecdotal">Anecdotal</option>
              <option value="case">Case Study</option>
              <option value="emerging">Emerging</option>
              <option value="moderate">Moderate</option>
              <option value="strong">Strong</option>
            </select>
          </div>

          {/* Target Group */}
          <div className="filter-field">
            <label>TARGET GROUP</label>
            <select
              value={selectedTargetGroup}
              onChange={(e) => setSelectedTargetGroup(e.target.value)}
              className="inst-select-sm"
            >
              <option value="ALL">All Learners</option>
              {targetGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Tag Row */}
        <div className="explorer-tag-strip">
          <span className="tag-strip-label">QUICK TAGS:</span>
          <div className="tag-chips">
            {allTags.slice(0, 10).map((t) => (
              <button
                key={t}
                type="button"
                className={`tag-pill-btn ${selectedTag === t ? 'active' : ''}`}
                onClick={() => setSelectedTag(selectedTag === t ? null : t)}
              >
                #{t}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="reset-filters-btn"
              onClick={clearAllFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="explorer-meta-header">
        <div className="results-count">
          Showing <strong>{filteredSignals.length}</strong> of{' '}
          <strong>{initialSignals.length}</strong> innovation signals
        </div>
        <div className="disclaimer-badge">
          Independent Dimensions · Strictly No Combined Total Score
        </div>
      </div>

      {/* Grid or Dense Table View */}
      {filteredSignals.length > 0 ? (
        <div className={viewMode === 'grid' ? 'signals-matrix-grid' : 'signals-dense-list'}>
          {filteredSignals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} viewMode={viewMode} />
          ))}
        </div>
      ) : (
        <div className="empty-search-state">
          <ShieldAlert size={36} className="text-muted" />
          <h3>No matching innovation signals</h3>
          <p>
            No signals matched your current filter criteria. Try adjusting your search query, 
            geography, or maturity criteria.
          </p>
          <button
            type="button"
            className="inst-action-btn"
            onClick={clearAllFilters}
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
