/**
 * metadata_json 规范化函数
 * 将多样本格式映射为 canonical + extras 结构（见 metadata_unified_schema.md）
 */

/**
 * 将原始 metadata 转为 { canonical, extras }
 * @param {object} payload - 原始 metadata_json
 * @returns {{ canonical: object, extras: object }}
 */
function normalizeMetadata(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      canonical: { topic: '未知', language: 'zh-CN', stages: [], learning_objectives: [] },
      extras: {}
    };
  }

  // 若已有 canonical，只做轻量校验与补充；extras 取原有 extras，若为空则从根级别其他键收集
  if (payload.canonical && typeof payload.canonical === 'object') {
    const canonical = ensureCanonicalFormat(payload.canonical);
    const extras =
      payload.extras && Object.keys(payload.extras).length > 0
        ? payload.extras
        : buildExtras(payload);
    return { canonical, extras };
  }

  const canonical = buildCanonical(payload);
  const extras = buildExtras(payload);
  return { canonical, extras };
}

function ensureCanonicalFormat(c) {
  const out = {
    topic: c.topic || '未知',
    language: c.language || 'zh-CN',
    stages: Array.isArray(c.stages) ? c.stages.map((s, i) => normalizeStage(s, i)) : [],
    learning_objectives: Array.isArray(c.learning_objectives) ? c.learning_objectives : []
  };
  const cm = normalizeConceptMap(c.concept_map);
  if (cm.length) out.concept_map = cm;
  const isum = normalizeInteractionsSummary(c.interactions_summary);
  if (isum.length) out.interactions_summary = isum;
  if (c.visual_hints != null) out.visual_hints = c.visual_hints;
  if (c.signals && typeof c.signals === 'object') out.signals = c.signals;
  return out;
}

function buildCanonical(payload) {
  const meta = payload.meta || {};
  const stages = extractStages(payload);
  const conceptMap = normalizeConceptMap(payload.conceptMap ?? payload.concept_map);
  const interactionsSummary = normalizeInteractionsSummary(
    payload.interactions ?? payload.interactions_summary
  );
  const visualHints = normalizeVisualHints(payload.visualElements ?? payload.visual_hints);

  return {
    topic: meta.title ?? meta.topic ?? meta.subtopic ?? meta.category ?? '未知',
    language: meta.language ?? payload.language ?? 'zh-CN',
    stages,
    learning_objectives:
      payload.learning_objectives ??
      payload.learningObjectives ??
      payload.objectives ??
      meta.learningObjectives ??
      meta.objectives ??
      [],
    ...(conceptMap.length > 0 && { concept_map: conceptMap }),
    ...(interactionsSummary.length > 0 && { interactions_summary: interactionsSummary }),
    ...(visualHints != null && { visual_hints: visualHints })
  };
}

function extractStages(payload) {
  const raw =
    payload.sections ??
    payload.contentStructure?.stages ??
    payload.contentFlow?.stages ??
    payload.pageStructure?.stages ??
    [];

  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw.map((item, i) => {
    const idx = resolveIndex(item, i);
    return normalizeStage(
      {
        index: idx,
        title: item.title ?? item.name ?? `步骤 ${idx}`,
        description: item.content ?? item.description ?? item.focus ?? undefined,
        key_concept: item.key_concept ?? item.keyConcept ?? item.concept ?? undefined,
        formula: item.formula ?? item.mathFormula ?? item.result ?? undefined,
        pedagogy: item.pedagogy ?? item.type ?? undefined,
        interactivity_hint:
          item.interactivity_hint ??
          item.interactivity ??
          item.interaction ??
          (typeof item.interactiveElement === 'string' ? item.interactiveElement : undefined)
      },
      i
    );
  });
}

function resolveIndex(item, arrayIndex) {
  // 统一输出 1-based index，按数组顺序
  return arrayIndex + 1;
}

function normalizeStage(s, arrayIndex) {
  let idx = typeof s.index === 'number' && s.index >= 1 ? s.index : arrayIndex + 1;
  const out = {
    index: idx,
    title: String(s.title || '未命名')
  };
  if (s.description) out.description = s.description;
  if (s.key_concept) out.key_concept = s.key_concept;
  if (s.formula) out.formula = s.formula;
  if (s.pedagogy) out.pedagogy = s.pedagogy;
  if (s.interactivity_hint) out.interactivity_hint = s.interactivity_hint;
  return out;
}

function normalizeConceptMap(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((x) => {
        if (typeof x === 'string') return { concept: x, description: '' };
        if (x && typeof x === 'object') {
          return {
            concept: x.concept ?? x.source ?? Object.keys(x)[0] ?? '',
            formula: x.formula,
            description: x.description ?? x.relationship ?? (typeof Object.values(x)[0] === 'string' ? Object.values(x)[0] : '') ?? ''
          };
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof val === 'object') {
    return Object.entries(val).map(([concept, desc]) => ({
      concept,
      description: typeof desc === 'string' ? desc : ''
    }));
  }
  return [];
}

function normalizeInteractionsSummary(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((x) => {
        if (x && typeof x === 'object' && ('action' in x || 'result' in x))
          return { action: x.action ?? x.trigger ?? '', result: x.result ?? x.effect ?? '' };
        return null;
      })
      .filter(Boolean);
  }
  if (typeof val === 'object') {
    return Object.entries(val)
      .map(([k, v]) => ({
        action: k,
        result: typeof v === 'string' ? v : JSON.stringify(v)
      }))
      .slice(0, 20);
  }
  return [];
}

function normalizeVisualHints(val) {
  if (val == null) return undefined;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val
      .map((x) => (typeof x === 'string' ? x : x?.description ?? x?.element ?? ''))
      .filter(Boolean)
      .join('; ') || undefined;
  }
  if (typeof val === 'object') {
    const parts = [];
    if (val.components) parts.push(Array.isArray(val.components) ? val.components.join(', ') : val.components);
    if (val.theme) parts.push(val.theme);
    if (val.layout) parts.push(val.layout);
    return parts.length ? parts.join('; ') : undefined;
  }
  return undefined;
}

/** 构建 extras：仅跳过已完全映射为 canonical 的来源键，其余保留 */
function buildExtras(payload) {
  const skip = new Set([
    'canonical',
    'extras',
    'sections',
    'contentStructure',
    'contentFlow',
    'pageStructure',
    'conceptMap',
    'concept_map',
    'objectives',
    'learningObjectives',
    'learning_objectives'
  ]);

  const extras = {};
  for (const [k, v] of Object.entries(payload)) {
    if (skip.has(k) || v == null) continue;
    extras[k] = v;
  }
  return extras;
}

module.exports = { normalizeMetadata, ensureCanonicalFormat };
