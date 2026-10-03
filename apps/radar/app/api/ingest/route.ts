import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { InnovationSignal, Maturity, EvidenceLevel } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_MATURITIES: Maturity[] = ['early_signal', 'experiment', 'pilot', 'scaling', 'established'];
const VALID_EVIDENCE_LEVELS: EvidenceLevel[] = ['none', 'anecdotal', 'case', 'emerging', 'moderate', 'strong'];

function sanitizeSignal(input: any): Partial<InnovationSignal> | null {
  if (!input || typeof input !== 'object') return null;

  const title = (input.title || '').trim();
  const summary = (input.summary || '').trim();
  const source_url = (input.source_url || '').trim();

  if (!title || !summary || !source_url) return null;

  const rawMaturity = (input.maturity || '').toLowerCase().replace(/[\s-]/g, '_');
  const maturity: Maturity = VALID_MATURITIES.includes(rawMaturity) ? rawMaturity : 'early_signal';

  const rawEvidence = (input.evidence_level || '').toLowerCase().trim();
  const evidence_level: EvidenceLevel = VALID_EVIDENCE_LEVELS.includes(rawEvidence) ? rawEvidence : 'emerging';

  let novelty = typeof input.novelty === 'number' ? Math.round(input.novelty) : 3;
  if (novelty < 1) novelty = 1;
  if (novelty > 5) novelty = 5;

  let country_code = (input.country_code || '').trim().toUpperCase();
  if (country_code.length !== 2) {
    country_code = country_code ? country_code.slice(0, 2) : 'GL';
  }

  const target_groups = Array.isArray(input.target_groups)
    ? input.target_groups.map((g: any) => String(g).trim()).filter(Boolean)
    : [];

  const tags = Array.isArray(input.tags)
    ? input.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean)
    : [];

  return {
    title,
    summary,
    source_url,
    source_name: input.source_name ? String(input.source_name).trim() : null,
    source_type: input.source_type ? String(input.source_type).trim() : 'field_experiment',
    country: input.country ? String(input.country).trim() : null,
    country_code,
    city: input.city ? String(input.city).trim() : null,
    latitude: typeof input.latitude === 'number' ? input.latitude : null,
    longitude: typeof input.longitude === 'number' ? input.longitude : null,
    innovation_type: input.innovation_type ? String(input.innovation_type).trim() : 'Pedagogy',
    educational_problem: input.educational_problem ? String(input.educational_problem).trim() : null,
    target_groups,
    novelty,
    maturity,
    evidence_level,
    evidence_summary: input.evidence_summary ? String(input.evidence_summary).trim() : null,
    swiss_relevance: input.swiss_relevance ? String(input.swiss_relevance).trim() : null,
    swiss_application_hypothesis: input.swiss_application_hypothesis ? String(input.swiss_application_hypothesis).trim() : null,
    limitations: input.limitations ? String(input.limitations).trim() : null,
    tags,
    status: 'candidate'
  };
}

export async function POST(req: NextRequest) {
  // 1. Authenticate Request
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.headers.get('x-radar-ingest-key');
  const expectedKey = process.env.RADAR_INGEST_KEY;

  if (!expectedKey || !token || token !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized. Invalid or missing ingestion key.' },
      { status: 401 }
    );
  }

  // 2. Parse Body
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }

  // Support array or single item or wrapped objects { signals: [...] } / { signal: {...} }
  const rawList: any[] = Array.isArray(body)
    ? body
    : Array.isArray(body.signals)
    ? body.signals
    : body.signal
    ? [body.signal]
    : [body];

  const sanitized = rawList.map(sanitizeSignal).filter(Boolean) as Partial<InnovationSignal>[];

  if (!sanitized.length) {
    return NextResponse.json(
      { error: 'No valid signals found in payload. Each signal must include title, summary and source_url.' },
      { status: 422 }
    );
  }

  // 3. Connect Supabase
  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      {
        error: 'Database connection unconfigured.',
        message: 'SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured on Vercel.'
      },
      { status: 503 }
    );
  }

  // 4. Upsert into radar_signals table
  const { data, error } = await db
    .from('radar_signals')
    .upsert(sanitized, { onConflict: 'source_url' })
    .select('id, title, country_code, discovered_at');

  if (error) {
    return NextResponse.json(
      {
        error: 'Database write error',
        details: error.message,
        hint: error.hint || 'Ensure 001_radar.sql migration has been run in Supabase.'
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    ingestedCount: data.length,
    signals: data
  });
}
