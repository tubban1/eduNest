import { demoSignals, demoRelations, demoReviews, demoClusters } from './demo-data';
import { getSupabaseAdmin } from './supabase-server';
import type { InnovationSignal, RadarRelation, RadarReview, RadarCluster } from './types';

export async function listSignals(limit = 100): Promise<InnovationSignal[]> {
  const db = getSupabaseAdmin();
  if (!db) return demoSignals.slice(0, limit);
  const { data, error } = await db
    .from('radar_signals')
    .select('*')
    .neq('status', 'archived')
    .order('discovered_at', { ascending: false })
    .limit(limit);
  if (error || !data?.length) return demoSignals.slice(0, limit);
  return data as InnovationSignal[];
}

export async function getSignal(id: string): Promise<InnovationSignal | null> {
  if (id.startsWith('demo-')) {
    return demoSignals.find((x) => x.id === id) ?? null;
  }
  const db = getSupabaseAdmin();
  if (!db) {
    return demoSignals.find((x) => x.id === id) ?? null;
  }
  const { data } = await db.from('radar_signals').select('*').eq('id', id).maybeSingle();
  return (data as InnovationSignal | null) ?? (demoSignals.find((x) => x.id === id) ?? null);
}

export async function listRelations(): Promise<RadarRelation[]> {
  const db = getSupabaseAdmin();
  if (!db) return demoRelations;
  const { data, error } = await db.from('radar_relations').select('*');
  if (error || !data?.length) return demoRelations;
  return data as RadarRelation[];
}

export async function getSignalRelations(signalId: string): Promise<{
  relation: RadarRelation;
  relatedSignal: InnovationSignal | undefined;
  direction: 'incoming' | 'outgoing';
}[]> {
  const allRelations = await listRelations();
  const allSignals = await listSignals();
  
  const results: {
    relation: RadarRelation;
    relatedSignal: InnovationSignal | undefined;
    direction: 'incoming' | 'outgoing';
  }[] = [];

  for (const rel of allRelations) {
    if (rel.from_signal_id === signalId) {
      results.push({
        relation: rel,
        relatedSignal: allSignals.find((s) => s.id === rel.to_signal_id),
        direction: 'outgoing',
      });
    } else if (rel.to_signal_id === signalId) {
      results.push({
        relation: rel,
        relatedSignal: allSignals.find((s) => s.id === rel.from_signal_id),
        direction: 'incoming',
      });
    }
  }

  return results;
}

export async function listReviews(signalId?: string): Promise<RadarReview[]> {
  const db = getSupabaseAdmin();
  if (!db) {
    if (signalId) return demoReviews.filter((r) => r.signal_id === signalId);
    return demoReviews;
  }
  let query = db.from('radar_reviews').select('*').order('created_at', { ascending: false });
  if (signalId) {
    query = query.eq('signal_id', signalId);
  }
  const { data, error } = await query;
  if (error || !data?.length) {
    if (signalId) return demoReviews.filter((r) => r.signal_id === signalId);
    return demoReviews;
  }
  return data as RadarReview[];
}

export async function listClusters(): Promise<RadarCluster[]> {
  return demoClusters;
}
