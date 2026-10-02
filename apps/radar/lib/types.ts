export type EvidenceLevel = 'none' | 'anecdotal' | 'case' | 'emerging' | 'moderate' | 'strong';

export type Maturity = 'early_signal' | 'experiment' | 'pilot' | 'scaling' | 'established';

export type SignalStatus = 'candidate' | 'reviewed' | 'validated' | 'archived';

export interface InnovationSignal {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  source_name?: string | null;
  source_type?: string | null;
  published_at?: string | null;
  discovered_at: string;
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  innovation_type: string;
  educational_problem?: string | null;
  target_groups?: string[] | null;
  novelty?: number | null; // 1 to 5
  maturity: Maturity;
  evidence_level: EvidenceLevel;
  evidence_summary?: string | null;
  swiss_relevance?: string | null;
  swiss_application_hypothesis?: string | null;
  limitations?: string | null;
  tags?: string[] | null;
  status: SignalStatus;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export type RelationType = 'similar_to' | 'related_to' | 'inspired_by' | 'evolved_into' | 'same_cluster';

export interface RadarRelation {
  id: string;
  from_signal_id: string;
  to_signal_id: string;
  relation_type: RelationType;
  confidence: number;
  rationale: string;
  created_at?: string;
}

export interface RadarReview {
  id: string;
  signal_id: string;
  reviewer_name?: string | null;
  reviewer_role?: string | null;
  educational_relevance: 'high' | 'medium' | 'low' | 'questionable';
  evidence_judgement: 'conclusive' | 'preliminary' | 'insufficient' | 'disputed';
  transferability: 'direct' | 'with_adaptations' | 'low' | 'not_recommended';
  notes?: string | null;
  created_at?: string;
}

export interface RadarCluster {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  signalsCount: number;
  signalIds: string[];
  primaryGeography: string[];
  educationalImpact: string;
  emergenceType: 'independent_emergence' | 'policy_driven' | 'technological_push';
  hypothesisStatus: 'provisional_hypothesis' | 'strengthening' | 'debated';
}
