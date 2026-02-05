#!/usr/bin/env node

/**
 * 分析 content 表中现有 metadata_json 的结构与用词
 *
 * 用法：
 *   node scripts/analyze-metadata-json.js [--output=report.json]
 *
 * 输出：统计根键、stages 来源、字段命名等，便于规划迁移脚本
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 递归收集对象所有键路径（含嵌套）
function collectKeys(obj, prefix = '', result = new Map()) {
  if (obj === null || typeof obj !== 'object') return result;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    result.set(path, (result.get(path) || 0) + 1);
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      collectKeys(v, path, result);
    }
  }
  return result;
}

// 判断 stages 来源
function getStagesSource(payload) {
  const sources = [
    ['sections', payload.sections],
    ['contentStructure.stages', payload.contentStructure?.stages],
    ['contentFlow.stages', payload.contentFlow?.stages],
    ['pageStructure.stages', payload.pageStructure?.stages],
    ['canonical.stages', payload.canonical?.stages]
  ];
  for (const [name, arr] of sources) {
    if (Array.isArray(arr) && arr.length > 0) return name;
  }
  return null;
}

// 收集单条 stage 的字段名
function collectStageFields(stages) {
  const fieldCounts = new Map();
  for (const s of stages) {
    if (s && typeof s === 'object') {
      for (const k of Object.keys(s)) {
        fieldCounts.set(k, (fieldCounts.get(k) || 0) + 1);
      }
    }
  }
  return fieldCounts;
}

// 判断 conceptMap 形态
function getConceptMapType(val) {
  if (!val) return null;
  if (Array.isArray(val)) {
    const first = val[0];
    if (typeof first === 'string') return 'array_of_strings';
    if (first && typeof first === 'object') {
      if ('concept' in first || 'source' in first) return 'array_of_objects';
      return 'array_of_objects_other';
    }
  }
  if (typeof val === 'object' && !Array.isArray(val)) return 'object_key_value';
  return 'other';
}

// 判断 objectives 来源
function getObjectivesKey(payload) {
  const keys = ['objectives', 'learningObjectives', 'learning_objectives'];
  for (const k of keys) {
    if (payload[k] && Array.isArray(payload[k])) return k;
    if (payload.meta?.[k] && Array.isArray(payload.meta[k])) return `meta.${k}`;
  }
  return null;
}

async function main() {
  const outFile = process.argv.find(a => a.startsWith('--output='))?.split('=')[1];

  const { data: rows, error } = await supabase
    .from('content')
    .select('id, short_id, title, metadata_json')
    .not('metadata_json', 'is', null);

  if (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }

  const list = (rows || []).filter(r => r.metadata_json != null);
  console.log(`共 ${list.length} 条 content 含有 metadata_json\n`);

  const rootKeyCounts = new Map();
  const stagesSourceCounts = new Map();
  const stageFieldCounts = new Map();
  const conceptMapTypeCounts = new Map();
  const objectivesKeyCounts = new Map();
  const allKeyPaths = new Map();
  const samples = [];

  for (const row of list) {
    const m = row.metadata_json;
    if (typeof m !== 'object') continue;

    // 已有 canonical 的跳过或单独统计
    if (m.canonical) {
      rootKeyCounts.set('_has_canonical', (rootKeyCounts.get('_has_canonical') || 0) + 1);
    }

    for (const k of Object.keys(m)) {
      rootKeyCounts.set(k, (rootKeyCounts.get(k) || 0) + 1);
    }

    collectKeys(m, '', allKeyPaths);

    const stagesSrc = getStagesSource(m);
    if (stagesSrc) {
      stagesSourceCounts.set(stagesSrc, (stagesSourceCounts.get(stagesSrc) || 0) + 1);
      const stages = m.sections || m.contentStructure?.stages || m.contentFlow?.stages || m.pageStructure?.stages || m.canonical?.stages || [];
      for (const [f, c] of collectStageFields(stages)) {
        stageFieldCounts.set(f, (stageFieldCounts.get(f) || 0) + c);
      }
    }

    const cm = m.conceptMap ?? m.concept_map ?? m.canonical?.concept_map;
    if (cm) {
      const t = getConceptMapType(cm);
      conceptMapTypeCounts.set(t, (conceptMapTypeCounts.get(t) || 0) + 1);
    }

    const objKey = getObjectivesKey(m) ?? getObjectivesKey(m?.canonical || {});
    if (objKey) objectivesKeyCounts.set(objKey, (objectivesKeyCounts.get(objKey) || 0) + 1);

    // 采样前 5 条结构摘要
    if (samples.length < 5) {
      samples.push({
        short_id: row.short_id,
        title: (row.title || '').slice(0, 40),
        rootKeys: Object.keys(m),
        stagesSource: stagesSrc,
        stageCount: (m.sections || m.contentStructure?.stages || m.contentFlow?.stages || m.pageStructure?.stages || m.canonical?.stages || []).length
      });
    }
  }

  const report = {
    total: list.length,
    rootKeys: Object.fromEntries([...rootKeyCounts.entries()].sort((a, b) => b[1] - a[1])),
    stagesSource: Object.fromEntries([...stagesSourceCounts.entries()].sort((a, b) => b[1] - a[1])),
    stageFields: Object.fromEntries([...stageFieldCounts.entries()].sort((a, b) => b[1] - a[1])),
    conceptMapType: Object.fromEntries(conceptMapTypeCounts),
    objectivesKey: Object.fromEntries(objectivesKeyCounts),
    topKeyPaths: Object.fromEntries(
      [...allKeyPaths.entries()]
        .filter(([k]) => !k.includes('.'))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
    ),
    samples
  };

  console.log('=== 根键统计 ===');
  console.log(JSON.stringify(report.rootKeys, null, 2));
  console.log('\n=== stages 来源 ===');
  console.log(JSON.stringify(report.stagesSource, null, 2));
  console.log('\n=== stage 条目字段名 ===');
  console.log(JSON.stringify(report.stageFields, null, 2));
  console.log('\n=== conceptMap 形态 ===');
  console.log(JSON.stringify(report.conceptMapType, null, 2));
  console.log('\n=== objectives 键名 ===');
  console.log(JSON.stringify(report.objectivesKey, null, 2));
  console.log('\n=== 采样 ===');
  console.log(JSON.stringify(report.samples, null, 2));

  if (outFile) {
    const fs = require('fs');
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n报告已写入 ${outFile}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
